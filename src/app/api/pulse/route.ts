import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { computeInvestorScore, computeMomentumScore } from '@/lib/scoring';
import type { Investor, Meeting, InvestorPortfolioCo, Objection } from '@/lib/types';

function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:raise.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
}

function parseJsonSafe<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

const STATUS_PROGRESSION: Record<string, number> = {
  identified: 0, contacted: 1, nda_signed: 2, meeting_scheduled: 3,
  met: 4, engaged: 5, in_dd: 6, term_sheet: 7, closed: 8,
  passed: -1, dropped: -1,
};

const ACTIVE_STAGES = ['engaged', 'in_dd', 'term_sheet'];

// ---------------------------------------------------------------------------
// Layer 1: Overnight Changes (24h deltas)
// ---------------------------------------------------------------------------

interface StatusChange {
  investorId: string;
  investorName: string;
  from: string;
  to: string;
  changedAt: string;
}

interface OvernightChanges {
  statusChanges: StatusChange[];
  newMeetings: number;
  meetingNames: string[];
  tasksCompleted: number;
  newTasks: number;
  newAccelerations: number;
  activityFeed: string[];
}

async function computeOvernightChanges(db: ReturnType<typeof getClient>): Promise<OvernightChanges> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [statusChanges, recentMeetings, completedTasks, createdTasks, recentAccelerations] = await Promise.all([
    // Status changes from activity log
    db.execute({
      sql: `SELECT investor_id, investor_name, subject, detail, created_at
            FROM activity_log
            WHERE event_type = 'status_changed' AND created_at >= ?
            ORDER BY created_at DESC`,
      args: [cutoff],
    }),
    // Meetings logged in last 24h
    db.execute({
      sql: `SELECT investor_name FROM meetings WHERE created_at >= ? ORDER BY created_at DESC`,
      args: [cutoff],
    }),
    // Tasks completed in last 24h
    db.execute({
      sql: `SELECT COUNT(*) as count FROM tasks WHERE status = 'done' AND updated_at >= ?`,
      args: [cutoff],
    }),
    // Tasks created in last 24h
    db.execute({
      sql: `SELECT COUNT(*) as count FROM tasks WHERE created_at >= ?`,
      args: [cutoff],
    }),
    // Acceleration actions in last 24h
    db.execute({
      sql: `SELECT COUNT(*) as count FROM acceleration_actions WHERE created_at >= ?`,
      args: [cutoff],
    }),
  ]);

  // Parse status changes
  const changes: StatusChange[] = [];
  for (const row of statusChanges.rows) {
    const detail = (row.detail as string) || '';
    const subject = (row.subject as string) || '';
    // Try to parse "from -> to" pattern
    const arrowMatch = detail.match(/(\w+)\s*(?:->|→)\s*(\w+)/i);
    const movedMatch = subject.match(/moved to (\w+)/i);

    if (arrowMatch) {
      changes.push({
        investorId: row.investor_id as string,
        investorName: row.investor_name as string,
        from: arrowMatch[1],
        to: arrowMatch[2],
        changedAt: row.created_at as string,
      });
    } else if (movedMatch) {
      changes.push({
        investorId: row.investor_id as string,
        investorName: row.investor_name as string,
        from: 'unknown',
        to: movedMatch[1],
        changedAt: row.created_at as string,
      });
    }
  }

  const meetingNames = recentMeetings.rows.map(r => r.investor_name as string);

  // Build activity feed
  const feed: string[] = [];
  if (changes.length > 0) {
    for (const c of changes.slice(0, 3)) {
      feed.push(`${c.investorName} moved to ${c.to}`);
    }
  }
  if (meetingNames.length > 0) {
    feed.push(`${meetingNames.length} meeting${meetingNames.length > 1 ? 's' : ''} logged`);
  }
  const completed = Number(completedTasks.rows[0]?.count ?? 0);
  if (completed > 0) {
    feed.push(`${completed} task${completed > 1 ? 's' : ''} completed`);
  }
  const accelCount = Number(recentAccelerations.rows[0]?.count ?? 0);
  if (accelCount > 0) {
    feed.push(`${accelCount} acceleration alert${accelCount > 1 ? 's' : ''}`);
  }
  if (feed.length === 0) {
    feed.push('No activity in last 24 hours');
  }

  return {
    statusChanges: changes,
    newMeetings: meetingNames.length,
    meetingNames,
    tasksCompleted: completed,
    newTasks: Number(createdTasks.rows[0]?.count ?? 0),
    newAccelerations: accelCount,
    activityFeed: feed,
  };
}

// ---------------------------------------------------------------------------
// Layer 2: Critical Path (Top 3 Focus + Top 2 Accelerations)
// ---------------------------------------------------------------------------

interface FocusCard {
  investorId: string;
  investorName: string;
  tier: number;
  status: string;
  focusScore: number;
  recommendedAction: string;
  timeEstimate: string;
  momentum: string;
  momentumArrow: string;
  enthusiasm: number;
}

interface AccelerationCard {
  id: string;
  investorId: string;
  investorName: string;
  triggerType: string;
  actionType: string;
  description: string;
  urgency: string;
  expectedLift: number;
  confidence: string;
}

interface CriticalPath {
  topFocus: FocusCard[];
  topAccelerations: AccelerationCard[];
}

function getMomentumArrow(momentum: string): string {
  switch (momentum) {
    case 'accelerating': return '\u2191'; // up
    case 'steady': return '\u2192'; // right
    case 'decelerating': return '\u2198'; // down-right
    case 'stalled': return '\u2193'; // down
    default: return '\u2192';
  }
}

// Focus score computation (simplified from focus route, same logic)
function computeFocusScore(
  investor: Investor,
  meetings: Meeting[],
  portfolio: InvestorPortfolioCo[],
  pendingTaskCount: number,
  openFlagCount: number,
  targetEquityM: number,
  targetCloseDate: string | null,
): { score: number; action: string; timeEstimate: string; momentum: string } {
  const now = new Date().toISOString();
  const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0] ?? null;
  const daysSince = latest ? Math.round(daysBetween(latest.date, now)) : null;

  const investorScore = computeInvestorScore(
    investor, meetings, portfolio, [],
    { targetEquityM, targetCloseDate },
  );
  const { momentum } = computeMomentumScore(investor, meetings);

  // Urgency
  let urgency = 30;
  if (daysSince === null) {
    const statusUrgency: Record<string, number> = {
      identified: 20, contacted: 40, nda_signed: 60,
      meeting_scheduled: 70, engaged: 80, in_dd: 90, term_sheet: 95,
    };
    urgency = statusUrgency[investor.status] ?? 30;
  } else if (daysSince <= 3) urgency = 30;
  else if (daysSince <= 7) urgency = 50;
  else if (daysSince <= 14) urgency = 70;
  else if (daysSince <= 21) urgency = 85;
  else if (daysSince <= 30) urgency = 95;
  else urgency = 100;

  const tierMult: Record<number, number> = { 1: 1.0, 2: 0.85, 3: 0.7, 4: 0.55 };
  const statusMult: Record<string, number> = {
    identified: 0.5, contacted: 0.6, nda_signed: 0.7,
    meeting_scheduled: 0.8, met: 0.75, engaged: 0.9,
    in_dd: 1.0, term_sheet: 1.0,
  };
  urgency = clamp(urgency * (tierMult[investor.tier] ?? 0.7) * (statusMult[investor.status] ?? 0.6));

  // Momentum risk
  let momentumRisk = 30;
  if (meetings.length >= 2) {
    const enthScores = sorted.slice(0, 3).map(m => m.enthusiasm_score);
    if (enthScores.length >= 2 && enthScores[0] < enthScores[1]) {
      momentumRisk += (enthScores[1] - enthScores[0]) * 20;
    }
  }
  if (daysSince && daysSince > 21) momentumRisk += 30;
  momentumRisk = clamp(momentumRisk);

  // Opportunity size
  const tierScores: Record<number, number> = { 1: 100, 2: 70, 3: 45, 4: 25 };
  let opportunity = tierScores[investor.tier] ?? 40;
  if (investor.type === 'sovereign') opportunity += 15;
  else if (investor.type === 'growth') opportunity += 10;
  opportunity = clamp(opportunity);

  // Action readiness
  let actionReady = Math.min(40, pendingTaskCount * 15) + Math.min(30, openFlagCount * 10);
  const statusBonus: Record<string, number> = {
    nda_signed: 15, meeting_scheduled: 10, engaged: 10, in_dd: 20, term_sheet: 25,
  };
  actionReady += statusBonus[investor.status] ?? 0;
  actionReady = clamp(actionReady);

  const score = clamp(
    investorScore.overall * 0.30 +
    urgency * 0.25 +
    momentumRisk * 0.20 +
    opportunity * 0.15 +
    actionReady * 0.10
  );

  // Simplified action determination
  const partner = investor.partner || investor.name;
  let action = `Review and advance ${partner}`;
  let timeEstimate = '15min';

  if (investor.status === 'term_sheet') {
    action = `Negotiate terms with ${partner}`;
    timeEstimate = '2hr';
  } else if (investor.status === 'in_dd') {
    action = pendingTaskCount > 0
      ? `Respond to ${pendingTaskCount} DD requests from ${partner}`
      : `Push ${partner} toward term sheet`;
    timeEstimate = pendingTaskCount > 0 ? '1hr' : '30min';
  } else if (investor.status === 'engaged') {
    const enth = latest?.enthusiasm_score ?? investor.enthusiasm;
    action = enth >= 4
      ? `Push ${partner} toward DD`
      : `Schedule deep dive with ${partner}`;
    timeEstimate = '30min';
  } else if (momentum === 'stalled' && meetings.length > 0) {
    action = `Re-engage ${partner} with value-add update`;
    timeEstimate = '30min';
  } else if (investor.status === 'contacted') {
    action = `Follow up with ${partner} --- send one-pager`;
    timeEstimate = '15min';
  } else if (investor.status === 'identified') {
    action = `Activate warm intro to ${partner}`;
    timeEstimate = '15min';
  } else if (investor.status === 'met' && latest?.next_steps) {
    action = `Execute next steps from ${partner} meeting`;
    timeEstimate = '30min';
  }

  return { score, action, timeEstimate, momentum };
}

async function computeCriticalPath(
  db: ReturnType<typeof getClient>,
  investors: Investor[],
  allMeetings: Meeting[],
  targetEquityM: number,
  targetCloseDate: string | null,
): Promise<CriticalPath> {
  const now = new Date().toISOString();

  // Build lookup maps
  const meetingsByInvestor: Record<string, Meeting[]> = {};
  allMeetings.forEach(m => {
    if (!meetingsByInvestor[m.investor_id]) meetingsByInvestor[m.investor_id] = [];
    meetingsByInvestor[m.investor_id].push(m);
  });

  // Get task and flag counts
  const [taskRows, flagRows, portfolioRows] = await Promise.all([
    db.execute(`
      SELECT investor_id, COUNT(*) as count FROM tasks
      WHERE status IN ('pending', 'in_progress')
      GROUP BY investor_id
    `),
    db.execute(`
      SELECT investor_id, COUNT(*) as count FROM document_flags
      WHERE status = 'open'
      GROUP BY investor_id
    `),
    db.execute(`SELECT * FROM investor_portfolio`),
  ]);

  const taskCountByInvestor: Record<string, number> = {};
  (taskRows.rows as unknown as Array<{ investor_id: string; count: number }>).forEach(r => {
    taskCountByInvestor[r.investor_id] = Number(r.count);
  });

  const flagCountByInvestor: Record<string, number> = {};
  (flagRows.rows as unknown as Array<{ investor_id: string; count: number }>).forEach(r => {
    flagCountByInvestor[r.investor_id] = Number(r.count);
  });

  const portfolioByInvestor: Record<string, InvestorPortfolioCo[]> = {};
  (portfolioRows.rows as unknown as InvestorPortfolioCo[]).forEach(p => {
    if (!portfolioByInvestor[p.investor_id]) portfolioByInvestor[p.investor_id] = [];
    portfolioByInvestor[p.investor_id].push(p);
  });

  // Compute focus scores for active investors
  const focusItems: FocusCard[] = [];
  for (const inv of investors) {
    if (['passed', 'dropped'].includes(inv.status)) continue;
    const meetings = meetingsByInvestor[inv.id] || [];
    const portfolio = portfolioByInvestor[inv.id] || [];
    const pendingTasks = taskCountByInvestor[inv.id] || 0;
    const openFlags = flagCountByInvestor[inv.id] || 0;

    const { score, action, timeEstimate, momentum } = computeFocusScore(
      inv, meetings, portfolio, pendingTasks, openFlags,
      targetEquityM, targetCloseDate,
    );

    const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
    const enthusiasm = sorted[0]?.enthusiasm_score ?? inv.enthusiasm;

    focusItems.push({
      investorId: inv.id,
      investorName: inv.name,
      tier: inv.tier,
      status: inv.status,
      focusScore: score,
      recommendedAction: action,
      timeEstimate,
      momentum,
      momentumArrow: getMomentumArrow(momentum),
      enthusiasm,
    });
  }

  focusItems.sort((a, b) => b.focusScore - a.focusScore);

  // Compute accelerations
  const accelerations: AccelerationCard[] = [];
  for (const inv of investors) {
    if (['passed', 'dropped', 'closed'].includes(inv.status)) continue;
    const meetings = meetingsByInvestor[inv.id] || [];
    const sorted = [...meetings].sort((a, b) => a.date.localeCompare(b.date));

    // Momentum cliff detection
    if (sorted.length >= 2) {
      const recent = sorted.slice(-3);
      const scores = recent.map(m => m.enthusiasm_score);
      let declining = true;
      for (let i = 1; i < scores.length; i++) {
        if (scores[i] >= scores[i - 1]) { declining = false; break; }
      }
      if (declining && scores[0] - scores[scores.length - 1] >= 1) {
        accelerations.push({
          id: `mc_${inv.id}`,
          investorId: inv.id,
          investorName: inv.name,
          triggerType: 'momentum_cliff',
          actionType: 'expert_call',
          description: `Enthusiasm dropping (${scores.join(' \u2192 ')}/5). Schedule founder call to re-engage.`,
          urgency: 'immediate',
          expectedLift: 15,
          confidence: 'medium',
        });
      }
    }

    // Stall risk
    const latestMeeting = sorted[sorted.length - 1];
    if (latestMeeting) {
      const daysSince = daysBetween(latestMeeting.date, now);
      const statusIdx = STATUS_PROGRESSION[inv.status] ?? 0;
      if (daysSince > 14 && statusIdx >= 3 && statusIdx < 8) {
        const isHighConviction = (latestMeeting.enthusiasm_score >= 3.5 || inv.tier <= 2);
        if (isHighConviction) {
          accelerations.push({
            id: `sr_${inv.id}`,
            investorId: inv.id,
            investorName: inv.name,
            triggerType: 'stall_risk',
            actionType: 'warm_reintro',
            description: `${Math.round(daysSince)}d without contact. High-conviction investor going cold.`,
            urgency: '48h',
            expectedLift: 15,
            confidence: 'medium',
          });
        }
      }
    }

    // Term sheet readiness
    const portfolio = portfolioByInvestor[inv.id] || [];
    const invScore = computeInvestorScore(inv, meetings, portfolio, [], { targetEquityM, targetCloseDate });
    const { momentum } = computeMomentumScore(inv, meetings);
    if (invScore.overall >= 70 && momentum !== 'stalled' && momentum !== 'decelerating') {
      const latestEnth = sorted.length > 0 ? sorted[sorted.length - 1].enthusiasm_score : inv.enthusiasm;
      const allObj = meetings.flatMap(m => parseJsonSafe<Objection[]>(m.objections, []));
      const unresolvedShow = allObj.filter(o => o.severity === 'showstopper' && o.response_effectiveness !== 'resolved');
      if (latestEnth >= 4 && unresolvedShow.length === 0 && inv.status !== 'term_sheet' && inv.status !== 'closed') {
        accelerations.push({
          id: `ts_${inv.id}`,
          investorId: inv.id,
          investorName: inv.name,
          triggerType: 'term_sheet_ready',
          actionType: 'escalation',
          description: `All green signals. Push for term sheet within 10 days.`,
          urgency: 'immediate',
          expectedLift: 25,
          confidence: 'high',
        });
      }
    }
  }

  // Sort accelerations by urgency
  const urgencyOrder: Record<string, number> = { immediate: 0, '48h': 1, this_week: 2, next_week: 3 };
  accelerations.sort((a, b) => {
    const diff = (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3);
    return diff !== 0 ? diff : b.expectedLift - a.expectedLift;
  });

  return {
    topFocus: focusItems.slice(0, 3),
    topAccelerations: accelerations.slice(0, 3),
  };
}

// ---------------------------------------------------------------------------
// Layer 3: Conviction Pulse
// ---------------------------------------------------------------------------

interface ConvictionAlert {
  investorId: string;
  investorName: string;
  previousScore: number;
  currentScore: number;
  drop: number;
}

interface ConvictionPulse {
  avgEnthusiasm: number;
  accelerating: number;
  steady: number;
  decelerating: number;
  stalled: number;
  alerts: ConvictionAlert[];
}

function computeConvictionPulse(
  investors: Investor[],
  allMeetings: Meeting[],
): ConvictionPulse {
  const meetingsByInvestor: Record<string, Meeting[]> = {};
  allMeetings.forEach(m => {
    if (!meetingsByInvestor[m.investor_id]) meetingsByInvestor[m.investor_id] = [];
    meetingsByInvestor[m.investor_id].push(m);
  });

  let totalEnthusiasm = 0;
  let enthCount = 0;
  let accelerating = 0;
  let steady = 0;
  let decelerating = 0;
  let stalled = 0;
  const alerts: ConvictionAlert[] = [];

  for (const inv of investors) {
    if (!ACTIVE_STAGES.includes(inv.status) && inv.status !== 'met' && inv.status !== 'contacted') continue;

    const meetings = meetingsByInvestor[inv.id] || [];
    const { momentum } = computeMomentumScore(inv, meetings);

    switch (momentum) {
      case 'accelerating': accelerating++; break;
      case 'steady': steady++; break;
      case 'decelerating': decelerating++; break;
      case 'stalled': stalled++; break;
    }

    // Get latest enthusiasm
    const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
    const latestEnth = sorted[0]?.enthusiasm_score ?? inv.enthusiasm;
    if (latestEnth > 0) {
      totalEnthusiasm += latestEnth;
      enthCount++;
    }

    // Check for enthusiasm drops of 2+
    if (sorted.length >= 2) {
      const curr = sorted[0].enthusiasm_score;
      const prev = sorted[1].enthusiasm_score;
      if (prev - curr >= 2) {
        alerts.push({
          investorId: inv.id,
          investorName: inv.name,
          previousScore: prev,
          currentScore: curr,
          drop: prev - curr,
        });
      }
    }
  }

  alerts.sort((a, b) => b.drop - a.drop);

  return {
    avgEnthusiasm: enthCount > 0 ? Math.round((totalEnthusiasm / enthCount) * 10) / 10 : 0,
    accelerating,
    steady,
    decelerating,
    stalled,
    alerts: alerts.slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// Layer 4: Process Health Summary
// ---------------------------------------------------------------------------

interface ProcessHealth {
  funnel: Record<string, number>;
  overdueFollowups: number;
  openDocumentFlags: number;
  dataQualityPct: number;
  activeInvestors: number;
  totalMeetings: number;
  meetingsThisWeek: number;
  health: 'green' | 'yellow' | 'red';
}

async function computeProcessHealth(
  db: ReturnType<typeof getClient>,
  investors: Investor[],
  allMeetings: Meeting[],
): Promise<ProcessHealth> {
  const now = new Date();
  const nowIso = now.toISOString();

  // Funnel counts
  const funnel: Record<string, number> = {
    identified: 0, contacted: 0, nda_signed: 0, meeting_scheduled: 0,
    met: 0, engaged: 0, in_dd: 0, term_sheet: 0, closed: 0, passed: 0,
  };
  investors.forEach(inv => {
    funnel[inv.status] = (funnel[inv.status] || 0) + 1;
  });

  // Overdue follow-ups
  const overdueResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM followup_actions
          WHERE status = 'pending' AND due_at < ?`,
    args: [nowIso],
  });
  const overdueFollowups = Number(overdueResult.rows[0]?.count ?? 0);

  // Open document flags
  const flagsResult = await db.execute(
    `SELECT COUNT(*) as count FROM document_flags WHERE status = 'open'`
  );
  const openDocumentFlags = Number(flagsResult.rows[0]?.count ?? 0);

  // Data quality: simple field completeness
  const CHECKED_FIELDS = ['partner', 'fund_size', 'check_size_range', 'sector_thesis', 'warm_path', 'ic_process', 'portfolio_conflicts', 'notes'];
  let totalFields = 0;
  let filledFields = 0;
  for (const inv of investors) {
    for (const field of CHECKED_FIELDS) {
      totalFields++;
      const val = (inv as unknown as Record<string, unknown>)[field];
      if (val !== null && val !== undefined && typeof val === 'string' && val.trim().length > 0) {
        filledFields++;
      }
    }
  }
  const dataQualityPct = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  // Meetings this week
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const meetingsThisWeek = allMeetings.filter(m => new Date(m.date) >= weekStart).length;

  // Active investors
  const activeInvestors = investors.filter(i => !['passed', 'dropped'].includes(i.status)).length;

  // Determine health
  const advancedCount = investors.filter(i => ['in_dd', 'term_sheet', 'closed'].includes(i.status)).length;
  let health: 'green' | 'yellow' | 'red' = 'green';
  if (overdueFollowups > 5 || openDocumentFlags > 10) health = 'red';
  else if (overdueFollowups > 2 || openDocumentFlags > 5 || dataQualityPct < 40) health = 'yellow';
  if (activeInvestors > 0 && advancedCount === 0 && allMeetings.length > 15) health = 'yellow';

  return {
    funnel,
    overdueFollowups,
    openDocumentFlags,
    dataQualityPct,
    activeInvestors,
    totalMeetings: allMeetings.length,
    meetingsThisWeek,
    health,
  };
}

// ---------------------------------------------------------------------------
// Main GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const db = getClient();

    const [investorRows, meetingRows, configRow] = await Promise.all([
      db.execute(`SELECT * FROM investors ORDER BY tier ASC, name ASC`),
      db.execute(`SELECT * FROM meetings ORDER BY date DESC`),
      db.execute(`SELECT value FROM config WHERE key = 'raise_config'`),
    ]);

    const investors = investorRows.rows as unknown as Investor[];
    const allMeetings = meetingRows.rows as unknown as Meeting[];

    // Parse raise config
    let targetEquityM = 250;
    let targetCloseDate: string | null = null;
    if (configRow.rows.length > 0) {
      try {
        const cfg = JSON.parse(configRow.rows[0].value as string);
        targetCloseDate = cfg.target_close || null;
        const eqStr = (cfg.equity_amount || '').replace(/[^0-9.]/g, '');
        if (eqStr) targetEquityM = parseFloat(eqStr);
      } catch { /* ignore */ }
    }

    // Run all 4 layers in parallel where possible
    const [overnight, criticalPath, processHealth] = await Promise.all([
      computeOvernightChanges(db),
      computeCriticalPath(db, investors, allMeetings, targetEquityM, targetCloseDate),
      computeProcessHealth(db, investors, allMeetings),
    ]);

    const convictionPulse = computeConvictionPulse(investors, allMeetings);

    return NextResponse.json({
      overnight,
      criticalPath,
      convictionPulse,
      processHealth,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Pulse computation error:', error);
    return NextResponse.json(
      { error: 'Failed to compute pulse', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

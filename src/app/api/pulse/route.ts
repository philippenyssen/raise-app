import { NextResponse } from 'next/server';
import { computeInvestorScore, computeMomentumScore, computeConvictionTrajectory } from '@/lib/scoring';
import type { ScoreSnapshot } from '@/lib/db';
import { generateAutoActions, measureActionEffectiveness, saveHealthSnapshot, getHealthSnapshots, computeTemporalTrends, computeRaiseForecast, logForecastPredictions, detectScoreReversals, computeEngagementVelocity, computeNetworkCascades, getPipelineRankings, detectFomoDynamics, computeMeetingDensity, computeWinLossPatterns } from '@/lib/db';
import type { Investor, Meeting, InvestorPortfolioCo, Objection } from '@/lib/types';
import { getFullContext } from '@/lib/context-bus';
import { getClient, daysBetween, parseJsonSafe, clamp, STATUS_PROGRESSION } from '@/lib/api-helpers';

const ACTIVE_STAGES = ['engaged', 'in_dd', 'term_sheet'];

// ---------------------------------------------------------------------------
// Intelligence Briefing types + builder
// ---------------------------------------------------------------------------

interface InsightItem {
  type: 'critical' | 'opportunity' | 'risk' | 'trend';
  title: string;
  detail: string;
  action: string;
  dataSource: string;
}

interface IntelligenceBriefing {
  insights: InsightItem[];
  generatedAt: string;
}

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
  trajectoryNote?: string;
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
  snapshots?: ScoreSnapshot[],
): { score: number; action: string; timeEstimate: string; momentum: string; trajectoryNote?: string } {
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

  let baseScore = clamp(
    investorScore.overall * 0.30 +
    urgency * 0.25 +
    momentumRisk * 0.20 +
    opportunity * 0.15 +
    actionReady * 0.10
  );

  // --- Conviction trajectory integration ---
  // Trajectory velocity adjusts focus: accelerating investors get priority boost,
  // decelerating investors get urgency boost (needs attention)
  let trajectoryNote: string | undefined;
  if (snapshots && snapshots.length >= 2) {
    const trajectory = computeConvictionTrajectory(snapshots);
    if (trajectory.trend === 'accelerating' && trajectory.velocityPerWeek > 1.0) {
      // Hot investor — boost priority (riding momentum)
      baseScore = clamp(baseScore + Math.min(15, trajectory.velocityPerWeek * 3));
      if (trajectory.predictedTermSheetDate && trajectory.predictedTermSheetDate !== 'now') {
        trajectoryNote = `Accelerating +${trajectory.velocityPerWeek} pts/wk → term sheet ~${trajectory.predictedTermSheetDate}`;
      }
    } else if (trajectory.trend === 'decelerating' && trajectory.velocityPerWeek < -1.0) {
      // Cooling investor — urgency boost (needs intervention)
      baseScore = clamp(baseScore + Math.min(10, Math.abs(trajectory.velocityPerWeek) * 2));
      trajectoryNote = `Decelerating ${trajectory.velocityPerWeek} pts/wk — needs intervention`;
    }
  }
  const score = baseScore;

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

  return { score, action, timeEstimate, momentum, trajectoryNote };
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

  // Get task and flag counts + score snapshots for trajectory
  const [taskRows, flagRows, portfolioRows, snapshotRows] = await Promise.all([
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
    db.execute(`SELECT * FROM score_snapshots ORDER BY snapshot_date ASC`),
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

  const snapshotsByInvestor: Record<string, ScoreSnapshot[]> = {};
  (snapshotRows.rows as unknown as ScoreSnapshot[]).forEach(s => {
    if (!snapshotsByInvestor[s.investor_id]) snapshotsByInvestor[s.investor_id] = [];
    snapshotsByInvestor[s.investor_id].push(s);
  });

  // Compute focus scores for active investors
  const focusItems: FocusCard[] = [];
  for (const inv of investors) {
    if (['passed', 'dropped'].includes(inv.status)) continue;
    const meetings = meetingsByInvestor[inv.id] || [];
    const portfolio = portfolioByInvestor[inv.id] || [];
    const pendingTasks = taskCountByInvestor[inv.id] || 0;
    const openFlags = flagCountByInvestor[inv.id] || 0;

    const investorSnapshots = snapshotsByInvestor[inv.id] || [];
    const { score, action, timeEstimate, momentum, trajectoryNote } = computeFocusScore(
      inv, meetings, portfolio, pendingTasks, openFlags,
      targetEquityM, targetCloseDate, investorSnapshots,
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
      ...(trajectoryNote ? { trajectoryNote } : {}),
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

  // Dynamic focus: always show Tier 1 + in_dd/term_sheet investors, fill rest to max 6
  const mustShow = focusItems.filter(f =>
    f.tier === 1 || f.status === 'in_dd' || f.status === 'term_sheet'
  );
  const others = focusItems.filter(f =>
    f.tier !== 1 && f.status !== 'in_dd' && f.status !== 'term_sheet'
  );
  const merged = [...mustShow];
  for (const o of others) {
    if (!merged.some(m => m.investorId === o.investorId)) merged.push(o);
  }
  merged.sort((a, b) => b.focusScore - a.focusScore);
  const topCount = Math.max(3, Math.min(6, mustShow.length + 1));

  return {
    topFocus: merged.slice(0, topCount),
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
// Layer 5: Intelligence Briefing — synthesizes ALL signals into actionable insights
// ---------------------------------------------------------------------------

async function computeIntelligenceBriefing(
  investors: Investor[],
  allMeetings: Meeting[],
  criticalPath: CriticalPath,
  convictionPulse: ConvictionPulse,
  processHealth: ProcessHealth,
): Promise<IntelligenceBriefing> {
  const insights: InsightItem[] = [];

  // Fetch full context for narrative weaknesses, keystones, calibration, timing
  let fullCtx;
  try {
    fullCtx = await getFullContext();
  } catch {
    // Context bus unavailable — return empty briefing
    return { insights: [], generatedAt: new Date().toISOString() };
  }

  // 1. Narrative weaknesses → "X investors questioning [topic] — strengthen section Y"
  for (const nw of fullCtx.narrativeWeaknesses) {
    const hasResponse = fullCtx.provenResponses.some(pr => pr.topic === nw.topic);
    const severity = nw.investorCount >= 3 ? 'critical' : 'risk';
    insights.push({
      type: severity as 'critical' | 'risk',
      title: `"${nw.topic}" questioned by ${nw.investorCount} investors`,
      detail: `Investors: ${nw.investorNames.join(', ')}. ${nw.questionCount} total questions on this topic.${hasResponse ? ' A proven response exists in the playbook.' : ' No proven response yet.'}`,
      action: hasResponse
        ? `Use proven response for "${nw.topic}" in next meetings with ${nw.investorNames.join(', ')}. Also update documents to preemptively address this.`
        : `Develop a strong response for "${nw.topic}" BEFORE next contact with ${nw.investorNames.join(', ')}. This is a narrative gap.`,
      dataSource: 'narrative_weaknesses',
    });
  }

  // 2. Keystone investors → "Closing [investor] would unlock [N] connected investors"
  for (const ki of fullCtx.keystoneInvestors.slice(0, 2)) {
    const keystoneInv = investors.find(i => i.id === ki.id);
    if (!keystoneInv) continue;
    const isAdvanced = ['engaged', 'in_dd', 'term_sheet'].includes(keystoneInv.status);
    insights.push({
      type: 'opportunity',
      title: `Keystone: closing ${ki.name} unlocks ${ki.connectionCount} connected investors`,
      detail: `Cascade value: ${ki.cascadeValue}. Current status: ${keystoneInv.status}.${isAdvanced ? ' Already in advanced stage — prioritize closing.' : ' Needs advancement — invest disproportionate time.'}`,
      action: isAdvanced
        ? `Prioritize ${ki.name} above all other investors this week. Their commitment creates cascade effects worth ${ki.cascadeValue}.`
        : `Accelerate ${ki.name} to next stage. Their network position makes them the highest-leverage investor in the pipeline.`,
      dataSource: 'keystone_investors',
    });
  }

  // 3. Timing signals → competitive tension, engagement gaps, DD sync
  for (const ts of fullCtx.timingSignals) {
    if (ts.type === 'competitive_tension') {
      insights.push({
        type: 'opportunity',
        title: `Competitive tension: ${ts.investorNames.length} investors active simultaneously`,
        detail: ts.description,
        action: `Leverage competitive tension in conversations. Mention (factually) that multiple investors are in advanced discussions. This creates urgency without pressure.`,
        dataSource: 'timing_signals',
      });
    } else if (ts.type === 'engagement_gap') {
      insights.push({
        type: 'risk',
        title: `Engagement gap: ${ts.investorNames.join(', ')} going silent`,
        detail: ts.description,
        action: `Re-engage ${ts.investorNames.join(', ')} within 48 hours with a value-add update (new data point, competitive intel, or milestone achieved).`,
        dataSource: 'timing_signals',
      });
    } else if (ts.type === 'dd_synchronization') {
      insights.push({
        type: 'opportunity',
        title: `DD synchronization: ${ts.investorNames.length} investors entering DD together`,
        detail: ts.description,
        action: `Synchronize DD timelines to create term sheet competition. Share (with permission) that multiple investors are in DD simultaneously.`,
        dataSource: 'timing_signals',
      });
    }
  }

  // 4. Trajectory alerts → declining investors need intervention
  for (const alert of convictionPulse.alerts) {
    const inv = investors.find(i => i.id === alert.investorId);
    if (!inv) continue;
    const isHighValue = inv.tier <= 2;
    insights.push({
      type: isHighValue ? 'critical' : 'risk',
      title: `${alert.investorName} enthusiasm dropping: ${alert.previousScore} → ${alert.currentScore}`,
      detail: `Drop of ${alert.drop} points.${isHighValue ? ' This is a Tier ' + inv.tier + ' investor — losing them would be significant.' : ''}`,
      action: `Diagnose the cause: check recent objections, competitive intel, or internal politics. Schedule a direct call with ${inv.partner || alert.investorName} to address concerns.`,
      dataSource: 'conviction_pulse',
    });
  }

  // 5. Pipeline health → funnel thin, overdue follow-ups, process breakdown
  if (processHealth.activeInvestors < 5) {
    insights.push({
      type: 'critical',
      title: `Pipeline thin: only ${processHealth.activeInvestors} active investors`,
      detail: `Diversification risk is high. A single pass from a key investor could significantly impact the raise.`,
      action: `Add 3-5 new investor leads this week. Focus on investors with thesis fit and warm paths to accelerate pipeline fill.`,
      dataSource: 'pipeline_health',
    });
  }

  if (processHealth.overdueFollowups > 3) {
    insights.push({
      type: 'risk',
      title: `Execution breakdown: ${processHealth.overdueFollowups} overdue follow-ups`,
      detail: `This signals process issues, not pipeline quality. Overdue follow-ups erode investor confidence.`,
      action: `Block 2 hours today to clear all overdue follow-ups. Each day of delay reduces close probability.`,
      dataSource: 'pipeline_health',
    });
  }

  // 6. Prediction calibration → adjust confidence language
  if (fullCtx.predictionCalibration.resolvedCount >= 5) {
    if (fullCtx.predictionCalibration.biasDirection === 'over_confident') {
      insights.push({
        type: 'trend',
        title: `Predictions have been over-confident — adjust expectations`,
        detail: `Brier score: ${fullCtx.predictionCalibration.brierScore.toFixed(3)}. Based on ${fullCtx.predictionCalibration.resolvedCount} resolved predictions. Actual outcomes have been worse than predicted.`,
        action: `Reduce confidence in probability estimates by ~${Math.round(fullCtx.predictionCalibration.brierScore * 100)}%. Plan for lower conversion rates in pipeline forecasts.`,
        dataSource: 'prediction_calibration',
      });
    } else if (fullCtx.predictionCalibration.biasDirection === 'under_confident') {
      insights.push({
        type: 'trend',
        title: `Predictions have been conservative — actual outcomes are better`,
        detail: `Brier score: ${fullCtx.predictionCalibration.brierScore.toFixed(3)}. Based on ${fullCtx.predictionCalibration.resolvedCount} resolved predictions.`,
        action: `Consider being more aggressive with timeline estimates and conversion expectations.`,
        dataSource: 'prediction_calibration',
      });
    }
  }

  // 7. Contradiction detection: high enthusiasm + no progression
  const meetingsByInvestor: Record<string, Meeting[]> = {};
  allMeetings.forEach(m => {
    if (!meetingsByInvestor[m.investor_id]) meetingsByInvestor[m.investor_id] = [];
    meetingsByInvestor[m.investor_id].push(m);
  });

  for (const inv of investors) {
    if (['passed', 'dropped', 'closed'].includes(inv.status)) continue;
    const meetings = meetingsByInvestor[inv.id] || [];
    if (meetings.length < 3) continue;

    const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
    const latestEnth = sorted[0]?.enthusiasm_score ?? 0;
    const statusIdx = STATUS_PROGRESSION[inv.status] ?? 0;

    // High enthusiasm (4+) but stuck in early stage (met or earlier) after 3+ meetings
    if (latestEnth >= 4 && statusIdx <= 4 && meetings.length >= 3) {
      insights.push({
        type: 'risk',
        title: `Contradiction: ${inv.name} shows high enthusiasm (${latestEnth}/5) but stuck at "${inv.status}" after ${meetings.length} meetings`,
        detail: `This pattern often indicates politeness without conviction, or an internal blocker the investor hasn't surfaced. ${meetings.length} meetings without progression is a red flag.`,
        action: `Directly ask ${inv.partner || inv.name}: "What would need to be true for you to move to DD this month?" If they can't answer specifically, deprioritize.`,
        dataSource: 'contradiction_detection',
      });
    }
  }

  // 8. Narrative drift — struggling investor types
  const struggling = fullCtx.narrativeDrift.filter(nd => nd.status === 'struggling');
  if (struggling.length > 0) {
    insights.push({
      type: 'risk',
      title: `Narrative not landing with: ${struggling.map(s => s.investorType).join(', ')}`,
      detail: struggling.map(s =>
        `${s.investorType}: avg enthusiasm ${s.avgEnthusiasm}/5, conversion ${s.conversionRate}%, top objection "${s.topObjection}" (n=${s.sampleSize})`
      ).join('. '),
      action: `Consider creating tailored pitch variants for ${struggling.map(s => s.investorType).join(', ')}. Address their specific objections upfront in presentations.`,
      dataSource: 'narrative_drift',
    });
  }

  // 9. Temporal trends — multi-metric decline or improvement (cycle 14)
  try {
    const temporalData = await computeTemporalTrends();
    if (temporalData.trends.length > 0) {
      const declining = temporalData.trends.filter(t => t.direction === 'declining');
      const improving = temporalData.trends.filter(t => t.direction === 'improving');

      if (declining.length >= 3) {
        insights.push({
          type: 'critical',
          title: `Raise momentum deteriorating: ${declining.length}/5 metrics declining`,
          detail: declining.map(t => `${t.metric}: ${t.delta7d > 0 ? '+' : ''}${t.delta7d}% (7d)`).join(', '),
          action: `Multiple metrics declining simultaneously indicates systemic issues. Conduct strategic review immediately — is this a pipeline problem, narrative fatigue, or execution gap?`,
          dataSource: 'temporal_trends',
        });
      } else if (improving.length >= 3) {
        insights.push({
          type: 'opportunity',
          title: `Momentum building: ${improving.length}/5 metrics improving`,
          detail: improving.map(t => `${t.metric}: +${t.delta7d}% (7d)`).join(', '),
          action: `Capitalize on current momentum — accelerate engagement with advanced-stage investors and push for term sheet discussions.`,
          dataSource: 'temporal_trends',
        });
      }

      // Alert on long decline streaks
      for (const trend of temporalData.trends) {
        if (trend.alert && trend.streak >= 4) {
          insights.push({
            type: 'risk',
            title: `${trend.metric} declining ${trend.streak} consecutive days`,
            detail: trend.alert,
            action: `Investigate root cause of sustained ${trend.metric.toLowerCase()} decline. Check if triggered by a specific event and address structurally.`,
            dataSource: 'temporal_trends',
          });
        }
      }
    }
  } catch { /* non-blocking */ }

  // Score reversal insights (cycle 26)
  try {
    const reversals = await detectScoreReversals();
    const critical = reversals.filter(r => r.severity === 'critical');
    if (critical.length > 0) {
      insights.push({
        type: 'critical',
        title: `${critical.length} investor(s) with critical score drop`,
        detail: critical.map(r => `${r.investorName}: ${r.previousScore}→${r.currentScore} (${r.delta})`).join(', '),
        action: `Investigate score drops immediately — these may indicate loss of conviction. Prioritize direct outreach to ${critical[0].investorName}.`,
        dataSource: 'score_reversals',
      });
    }
  } catch { /* non-blocking */ }

  // Forecast insights (cycle 19)
  try {
    const forecastData = await computeRaiseForecast();
    if (forecastData.confidence === 'low') {
      insights.push({
        type: 'risk',
        title: 'Close date forecast has low confidence',
        detail: `Predicted close: ${forecastData.expectedCloseDate}, but pipeline lacks advanced-stage investors for reliable prediction. ${forecastData.riskFactors.join('. ')}.`,
        action: 'Focus on advancing 2-3 investors to engaged/DD stage to improve forecast reliability.',
        dataSource: 'raise_forecast',
      });
    }
    if (forecastData.criticalPathInvestors.length > 0) {
      const criticalStalled = forecastData.forecasts
        .filter(f => forecastData.criticalPathInvestors.includes(f.investorName) && f.daysInStage > 21);
      if (criticalStalled.length > 0) {
        insights.push({
          type: 'critical',
          title: `Critical path investor${criticalStalled.length > 1 ? 's' : ''} stalled`,
          detail: `${criticalStalled.map(f => `${f.investorName} (${f.daysInStage}d at "${f.currentStage}")`).join(', ')} — delays push entire raise timeline.`,
          action: `Escalate ${criticalStalled[0].investorName} immediately. Schedule a direct call with the decision maker.`,
          dataSource: 'raise_forecast',
        });
      }
    }
  } catch { /* non-blocking */ }

  // Follow-up conviction signals — capitalize on positive momentum (cycle 37)
  if (fullCtx.recentFollowupSignals.length > 0) {
    const positive = fullCtx.recentFollowupSignals.filter(s => s.convictionDelta > 0);
    const negative = fullCtx.recentFollowupSignals.filter(s => s.convictionDelta < 0);

    if (positive.length > 0) {
      const names = positive.slice(0, 3).map(s => `${s.investorName || s.investorId} (+${s.convictionDelta})`).join(', ');
      insights.push({
        type: 'opportunity',
        title: `Follow-up momentum: ${positive.length} positive signal${positive.length > 1 ? 's' : ''}`,
        detail: `Recent follow-ups lifted conviction: ${names}. Momentum peaks 24-72h post-completion.`,
        action: `Schedule next touchpoint with ${positive[0].investorName || positive[0].investorId} within 2-3 days to capitalize.`,
        dataSource: 'followup_signals',
      });
    }

    if (negative.length > 0) {
      const names = negative.slice(0, 2).map(s => `${s.investorName || s.investorId} (${s.convictionDelta})`).join(', ');
      insights.push({
        type: 'risk',
        title: `Follow-up backfire: ${negative.length} conviction drop${negative.length > 1 ? 's' : ''}`,
        detail: `Follow-ups decreased conviction for ${names}. Likely messaging misalignment.`,
        action: `Review what was communicated vs. what they needed. Prepare corrective data for next contact.`,
        dataSource: 'followup_signals',
      });
    }
  }

  // Sort: critical first, then opportunity, then risk, then trend
  const typeOrder: Record<string, number> = { critical: 0, opportunity: 1, risk: 2, trend: 3 };
  insights.sort((a, b) => (typeOrder[a.type] ?? 3) - (typeOrder[b.type] ?? 3));

  // Cap at 9 insights to keep it actionable
  return {
    insights: insights.slice(0, 9),
    generatedAt: new Date().toISOString(),
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

    // Layer 5: Intelligence Briefing — synthesize all signals into actionable insights
    const intelligenceBriefing = await computeIntelligenceBriefing(
      investors, allMeetings, criticalPath, convictionPulse, processHealth,
    );

    // Layer 6: Real-time intelligence signals (cycle 34)
    const [velocityData, cascadeData, rankingData, fomoData, densityData, winLossData] = await Promise.all([
      computeEngagementVelocity().catch(() => []),
      computeNetworkCascades().catch(() => []),
      getPipelineRankings().catch(() => []),
      detectFomoDynamics().catch(() => []),
      computeMeetingDensity().catch(() => null),
      computeWinLossPatterns().catch(() => null),
    ]);

    const realTimeSignals = {
      investorMomentum: {
        accelerating: velocityData.filter(v => v.acceleration === 'accelerating').slice(0, 5).map(v => ({ name: v.investorName, tier: v.tier, recentMeetings: v.recentMeetings, signal: v.signal })),
        decelerating: velocityData.filter(v => v.acceleration === 'decelerating').slice(0, 3).map(v => ({ name: v.investorName, tier: v.tier, signal: v.signal })),
        goneSilent: velocityData.filter(v => v.acceleration === 'gone_silent').slice(0, 3).map(v => ({ name: v.investorName, tier: v.tier, daysSilent: v.daysSinceLastMeeting })),
      },
      networkCascades: cascadeData.slice(0, 3).map(nc => ({
        keystoneName: nc.keystoneName,
        chainLength: nc.cascadeChain.length,
        topChain: nc.cascadeChain.slice(0, 3).map(c => ({ name: c.investorName, probability: Math.round(c.probability * 100) })),
        bottleneck: nc.networkBottleneck ? { name: nc.networkBottleneck.investorName, impact: nc.networkBottleneck.impactIfPass } : null,
        signal: nc.signal,
      })),
      pipelineMovement: {
        rising: rankingData.filter(r => r.rankChange >= 2).slice(0, 3).map(r => ({ name: r.investorName, rank: r.rank, change: r.rankChange, score: r.score })),
        falling: rankingData.filter(r => r.rankChange <= -2).slice(0, 3).map(r => ({ name: r.investorName, rank: r.rank, change: r.rankChange, score: r.score })),
      },
      fomoOpportunities: fomoData.slice(0, 3).map(f => ({
        trigger: f.advancingInvestor,
        advancingTo: f.advancingTo,
        intensity: f.fomoIntensity,
        affectedCount: f.affectedInvestors.length,
        recommendation: f.recommendation,
      })),
      meetingHealth: densityData ? {
        densityScore: densityData.densityScore,
        currentWeek: densityData.currentWeekCount,
        avgPerWeek: densityData.avgPerWeek,
        gapWeeks: densityData.gapWeeks?.length || 0,
        insight: densityData.insight,
      } : null,
      winLossInsight: winLossData ? {
        closedCount: winLossData.closedCount,
        passedCount: winLossData.passedCount,
        keyPredictors: winLossData.distinguishingFactors.filter(f => f.significance === 'high').map(f => f.factor),
        insights: winLossData.insights.slice(0, 3),
      } : null,
    };

    // Non-blocking intelligence refresh: trigger auto-action generation + measurement
    // This makes the pulse dashboard the "heartbeat" — every view refreshes intelligence
    try { generateAutoActions().catch(() => {}); } catch { /* non-blocking */ }
    try { measureActionEffectiveness().catch(() => {}); } catch { /* non-blocking */ }
    // Non-blocking: log forecast predictions for calibration learning (cycle 23)
    try { logForecastPredictions().catch(() => {}); } catch { /* non-blocking */ }

    // Non-blocking: store daily health snapshot if not stored today (cycle 11)
    try {
      getHealthSnapshots(1).then(snapshots => {
        const today = new Date().toISOString().split('T')[0];
        if (!snapshots.length || snapshots[0].snapshot_date !== today) {
          const activeInvestors = investors.filter(i => !['passed', 'dropped'].includes(i.status)).length;
          const advancedCount = investors.filter(i => ['engaged', 'in_dd', 'term_sheet'].includes(i.status)).length;
          const pScore = Math.min(100, Math.round(activeInvestors * 4 + advancedCount * 10 + convictionPulse.avgEnthusiasm * 4));
          const nScore = Math.min(100, Math.round(70 - (convictionPulse.decelerating * 5) + (convictionPulse.accelerating * 5)));
          const rScore = Math.min(100, Math.round(pScore * 0.4 + nScore * 0.3 + (processHealth.dataQualityPct * 0.3)));
          saveHealthSnapshot({
            pipelineScore: pScore,
            narrativeScore: nScore,
            readinessScore: rScore,
            velocity: processHealth.meetingsThisWeek / Math.max(1, (new Date().getDay() || 7)),
            activeInvestors,
            strategicSummary: `${activeInvestors} active, ${advancedCount} advanced, health: ${processHealth.health}`,
          }).catch(() => {});
        }
      }).catch(() => {});
    } catch { /* non-blocking */ }

    return NextResponse.json({
      overnight,
      criticalPath,
      convictionPulse,
      processHealth,
      intelligenceBriefing,
      realTimeSignals,
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

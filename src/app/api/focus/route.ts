import { NextResponse } from 'next/server';
import { computeInvestorScore, computeMomentumScore } from '@/lib/scoring';
import type { Investor, Meeting, InvestorPortfolioCo, IntelligenceBrief, Objection } from '@/lib/types';
import { getClient, daysBetween, parseJsonSafe, clamp } from '@/lib/api-helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreDimensionData {
  name: string;
  score: number;
  signal: 'strong' | 'moderate' | 'weak' | 'unknown';
  evidence: string;
}

interface FocusItem {
  investorId: string;
  investorName: string;
  investorType: string;
  investorTier: number;
  status: string;
  enthusiasm: number;
  focusScore: number;
  components: {
    investorScore: number;
    urgency: number;
    momentumRisk: number;
    opportunitySize: number;
    actionReadiness: number;
  };
  scoringDimensions: ScoreDimensionData[];
  recommendedAction: string;
  timeEstimate: string;
  expectedImpact: string;
  riskIfIgnored: string;
  daysSinceLastMeeting: number | null;
  lastMeetingDate: string | null;
  lastMeetingType: string | null;
  momentum: string;
  pendingTaskCount: number;
  openFlagCount: number;
  unresolvedObjections: string[];
  topObjectionTopic: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  identified: 'Identified', contacted: 'Contacted', nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Set', met: 'Met', engaged: 'Engaged',
  in_dd: 'In DD', term_sheet: 'Term Sheet', closed: 'Closed',
  passed: 'Passed', dropped: 'Dropped',
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  intro: 'Intro', management_presentation: 'Mgmt Presentation',
  deep_dive: 'Deep Dive', site_visit: 'Site Visit',
  dd_session: 'DD Session', negotiation: 'Negotiation', social: 'Social',
};

// ---------------------------------------------------------------------------
// Focus Score Computation
// ---------------------------------------------------------------------------

function computeUrgencyScore(
  daysSinceLastMeeting: number | null,
  tier: number,
  status: string,
): number {
  // Base urgency from recency
  let recencyScore = 0;
  if (daysSinceLastMeeting === null) {
    // Never met — urgency depends on status
    const statusUrgency: Record<string, number> = {
      identified: 20, contacted: 40, nda_signed: 60,
      meeting_scheduled: 70, met: 50, engaged: 80,
      in_dd: 90, term_sheet: 95,
    };
    recencyScore = statusUrgency[status] ?? 30;
  } else if (daysSinceLastMeeting <= 3) {
    recencyScore = 30; // Recently met, low urgency
  } else if (daysSinceLastMeeting <= 7) {
    recencyScore = 50;
  } else if (daysSinceLastMeeting <= 14) {
    recencyScore = 70;
  } else if (daysSinceLastMeeting <= 21) {
    recencyScore = 85;
  } else if (daysSinceLastMeeting <= 30) {
    recencyScore = 95;
  } else {
    recencyScore = 100; // Urgent - going cold
  }

  // Tier multiplier: Tier 1 investors are more urgent
  const tierMultiplier: Record<number, number> = { 1: 1.0, 2: 0.85, 3: 0.7, 4: 0.55 };
  const multiplier = tierMultiplier[tier] ?? 0.7;

  // Status multiplier: advanced stages are more urgent
  const statusMultiplier: Record<string, number> = {
    identified: 0.5, contacted: 0.6, nda_signed: 0.7,
    meeting_scheduled: 0.8, met: 0.75, engaged: 0.9,
    in_dd: 1.0, term_sheet: 1.0,
  };
  const sMult = statusMultiplier[status] ?? 0.6;

  return clamp(recencyScore * multiplier * sMult);
}

function computeMomentumRiskScore(
  meetings: Meeting[],
  investor: Investor,
): number {
  if (meetings.length === 0) {
    // No meetings: moderate risk if we should have contacted them
    const statusRisk: Record<string, number> = {
      identified: 20, contacted: 40, nda_signed: 50,
      meeting_scheduled: 30, engaged: 70, in_dd: 80,
    };
    return statusRisk[investor.status] ?? 30;
  }

  const sorted = [...meetings].sort((a, b) => a.date.localeCompare(b.date));
  const now = new Date().toISOString();
  const latest = sorted[sorted.length - 1];
  const daysSince = daysBetween(latest.date, now);

  let riskScore = 0;

  // 1. Enthusiasm decline (biggest risk signal)
  if (sorted.length >= 2) {
    const latestEnth = sorted[sorted.length - 1].enthusiasm_score;
    const prevEnth = sorted[sorted.length - 2].enthusiasm_score;
    if (latestEnth < prevEnth) {
      riskScore += (prevEnth - latestEnth) * 20; // 20 pts per point drop
    }
    if (latestEnth <= 2) {
      riskScore += 25; // Very low enthusiasm = high risk
    }
  }

  // 2. Stale engagement
  if (daysSince > 21) riskScore += 30;
  else if (daysSince > 14) riskScore += 20;
  else if (daysSince > 7) riskScore += 10;

  // 3. Unresolved showstopper objections
  const allObjections = meetings.flatMap(m => parseJsonSafe<Objection[]>(m.objections, []));
  const unresolvedShowstoppers = allObjections.filter(
    o => o.severity === 'showstopper' && o.response_effectiveness !== 'resolved'
  );
  riskScore += unresolvedShowstoppers.length * 15;

  // 4. No follow-up requested in last meeting
  const latestSignals = parseJsonSafe<Record<string, unknown>>(latest.engagement_signals, {});
  if (!latestSignals.requested_followup && meetings.length >= 2) {
    riskScore += 10;
  }

  return clamp(riskScore);
}

function computeOpportunitySizeScore(investor: Investor): number {
  // Tier-based opportunity size
  const tierScores: Record<number, number> = { 1: 100, 2: 70, 3: 45, 4: 25 };
  let score = tierScores[investor.tier] ?? 40;

  // Type bonus: some investor types write larger checks
  const typeBonus: Record<string, number> = {
    sovereign: 15, growth: 10, vc: 0, strategic: 5,
    debt: -10, family_office: -5,
  };
  score += typeBonus[investor.type] ?? 0;

  // Speed bonus: fast movers are more valuable to close first
  if (investor.speed === 'fast') score += 5;

  return clamp(score);
}

function computeActionReadinessScore(
  pendingTaskCount: number,
  openFlagCount: number,
  unresolvedObjections: number,
  status: string,
): number {
  // More pending items = more need for CEO attention
  let score = 0;

  // Pending tasks
  score += Math.min(40, pendingTaskCount * 15);

  // Open document flags
  score += Math.min(30, openFlagCount * 10);

  // Unresolved objections
  score += Math.min(30, unresolvedObjections * 10);

  // Status that requires action
  const statusBonus: Record<string, number> = {
    nda_signed: 15, meeting_scheduled: 10, engaged: 10,
    in_dd: 20, term_sheet: 25,
  };
  score += statusBonus[status] ?? 0;

  return clamp(score);
}

// ---------------------------------------------------------------------------
// Recommended Action Logic
// ---------------------------------------------------------------------------

function determineRecommendedAction(
  investor: Investor,
  meetings: Meeting[],
  daysSince: number | null,
  unresolvedObjections: string[],
  pendingTaskCount: number,
  momentum: string,
  topObjectionTopic: string | null,
): { action: string; timeEstimate: string; expectedImpact: string; riskIfIgnored: string } {
  const sorted = meetings.length > 0
    ? [...meetings].sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const latest = sorted[0] ?? null;
  const latestEnth = latest?.enthusiasm_score ?? investor.enthusiasm;
  const partner = investor.partner || investor.name;

  // Status-driven actions (most specific first)
  if (investor.status === 'term_sheet') {
    return {
      action: `Negotiate terms with ${partner} --- all signals are positive, don't let momentum fade`,
      timeEstimate: '2hr meeting + 1hr prep',
      expectedImpact: `If closed this week: secures anchor commitment at target valuation`,
      riskIfIgnored: `Term sheet may expire or investor redirects capital to competing deal`,
    };
  }

  if (investor.status === 'in_dd') {
    if (pendingTaskCount > 0) {
      return {
        action: `Respond to outstanding DD requests from ${partner} --- ${pendingTaskCount} pending items need CEO input`,
        timeEstimate: '1hr prep + 30min review',
        expectedImpact: `Fast DD response signals operational excellence; conviction likely rises to ${Math.min(5, latestEnth + 1)}/5`,
        riskIfIgnored: `${Math.max(1, Math.round(daysSince ?? 7))} days without DD response signals disorganization`,
      };
    }
    return {
      action: `Push for term sheet with ${partner} --- DD is progressing, propose timeline for IC decision`,
      timeEstimate: '30min call',
      expectedImpact: `If term sheet received: anchors the round and creates FOMO for other investors`,
      riskIfIgnored: `DD fatigue sets in after 3+ weeks without clear next step`,
    };
  }

  // Unresolved showstopper objections take priority
  if (unresolvedObjections.length > 0) {
    const topObj = unresolvedObjections[0];
    return {
      action: `Address "${topObj}" raised by ${partner} --- prepare data-backed response before enthusiasm drops further`,
      timeEstimate: '45min prep + 15min call',
      expectedImpact: `Resolving top objection typically moves enthusiasm from ${latestEnth}/5 to ${Math.min(5, latestEnth + 1)}/5`,
      riskIfIgnored: `Unresolved objection becomes internal narrative at IC --- harder to reverse once embedded`,
    };
  }

  // Momentum-based actions
  if (momentum === 'stalled' && meetings.length > 0) {
    return {
      action: `Re-engage ${partner} with a value-add update --- share recent milestone or market data to restart conversation`,
      timeEstimate: '30min prep + 15min call',
      expectedImpact: `Re-engagement within 48 hours recovers 70%+ of stalled processes`,
      riskIfIgnored: `${Math.round(daysSince ?? 14)}+ days of silence --- investor likely reallocates attention`,
    };
  }

  if (momentum === 'decelerating') {
    if (topObjectionTopic) {
      return {
        action: `Send updated materials addressing ${topObjectionTopic} concerns to ${partner} before next meeting`,
        timeEstimate: '30min prep',
        expectedImpact: `Proactive objection handling signals conviction and keeps momentum alive`,
        riskIfIgnored: `Decelerating processes rarely re-accelerate without proactive intervention`,
      };
    }
    return {
      action: `Schedule a focused call with ${partner} --- propose specific agenda to maintain cadence`,
      timeEstimate: '15min prep + 30min call',
      expectedImpact: `Consistent cadence prevents the "we'll circle back" fade`,
      riskIfIgnored: `3 more days of deceleration shifts investor attention to other opportunities`,
    };
  }

  // Status-driven actions for earlier stages
  switch (investor.status) {
    case 'identified':
      return {
        action: `Activate warm intro through ${investor.warm_path || 'best available path'} to reach ${partner}`,
        timeEstimate: '15min outreach',
        expectedImpact: `Warm intros convert at 3-5x the rate of cold outreach`,
        riskIfIgnored: `Competitor may reach them first with a conflicting deal`,
      };

    case 'contacted':
      return {
        action: `Follow up with ${partner} --- send tailored one-pager and propose 30-min intro call`,
        timeEstimate: '15min prep + email',
        expectedImpact: `Second touch within 5 days doubles response rate`,
        riskIfIgnored: `Initial outreach fades from inbox after 7-10 days`,
      };

    case 'nda_signed':
      return {
        action: `Schedule deep dive with ${partner} --- NDA is signed, they're ready for the full management presentation`,
        timeEstimate: '30min prep + 1hr meeting',
        expectedImpact: `Moving to management presentation accelerates timeline by 2-3 weeks`,
        riskIfIgnored: `NDA without follow-up signals lack of preparation`,
      };

    case 'meeting_scheduled':
      return {
        action: `Prepare for upcoming meeting with ${partner} --- review their portfolio for discussion points and prepare for likely objections`,
        timeEstimate: '45min prep',
        expectedImpact: `Tailored preparation dramatically improves first-meeting conversion`,
        riskIfIgnored: `Generic presentation risks losing a high-potential investor at first contact`,
      };

    case 'met': {
      if (latest?.next_steps) {
        return {
          action: `Execute next steps from ${partner} meeting: ${latest.next_steps.substring(0, 100)}`,
          timeEstimate: '30min execution',
          expectedImpact: `Completing next steps within 48 hours shows execution quality`,
          riskIfIgnored: `Delayed follow-up is the #1 reason investors lose interest post-meeting`,
        };
      }
      return {
        action: `Send follow-up materials to ${partner} and propose deep dive on financial model`,
        timeEstimate: '30min prep',
        expectedImpact: `Fast follow-up within 48 hours converts 60%+ of positive first meetings`,
        riskIfIgnored: `Every day of delay reduces conversion probability by ~5%`,
      };
    }

    case 'engaged': {
      if (latestEnth >= 4) {
        return {
          action: `Push ${partner} toward DD --- enthusiasm is high (${latestEnth}/5), propose structured DD timeline`,
          timeEstimate: '30min call',
          expectedImpact: `Entering DD at peak enthusiasm maximizes conversion probability`,
          riskIfIgnored: `High enthusiasm is perishable --- peaks don't last more than 2-3 weeks`,
        };
      }
      return {
        action: `Schedule site visit or deep dive with ${partner} to deepen engagement`,
        timeEstimate: '1hr meeting',
        expectedImpact: `Site visits convert at 2x the rate of remote meetings`,
        riskIfIgnored: `Engagement without deepening stalls at the "interested but not committed" stage`,
      };
    }

    default:
      return {
        action: `Review and update status for ${partner} --- determine appropriate next step`,
        timeEstimate: '15min review',
        expectedImpact: `Keeping pipeline current prevents missed opportunities`,
        riskIfIgnored: `Stale pipeline data leads to misallocated CEO time`,
      };
  }
}

// ---------------------------------------------------------------------------
// Main GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const db = getClient();

    const [
      investorRows,
      meetingRows,
      taskRows,
      flagRows,
      configRow,
      portfolioRows,
    ] = await Promise.all([
      db.execute(`
        SELECT * FROM investors
        WHERE status NOT IN ('passed', 'dropped')
        ORDER BY tier ASC, name ASC
      `),
      db.execute(`SELECT * FROM meetings ORDER BY date DESC`),
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
      db.execute(`SELECT value FROM config WHERE key = 'raise_config'`),
      db.execute(`SELECT * FROM investor_portfolio`),
    ]);

    const investors = investorRows.rows as unknown as Investor[];
    const allMeetings = meetingRows.rows as unknown as Meeting[];
    const now = new Date().toISOString();

    // Build lookup maps
    const meetingsByInvestor: Record<string, Meeting[]> = {};
    allMeetings.forEach(m => {
      if (!meetingsByInvestor[m.investor_id]) meetingsByInvestor[m.investor_id] = [];
      meetingsByInvestor[m.investor_id].push(m);
    });

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

    // Parse raise config
    let targetEquityM = 250; // default
    let targetCloseDate: string | null = null;
    if (configRow.rows.length > 0) {
      try {
        const cfg = JSON.parse(configRow.rows[0].value as string);
        targetCloseDate = cfg.target_close || null;
        const eqStr = (cfg.equity_amount || '').replace(/[^0-9.]/g, '');
        if (eqStr) targetEquityM = parseFloat(eqStr);
      } catch { /* ignore */ }
    }

    // Compute focus items
    const focusItems: FocusItem[] = [];

    for (const investor of investors) {
      const meetings = meetingsByInvestor[investor.id] || [];
      const portfolio = portfolioByInvestor[investor.id] || [];
      const pendingTaskCount = taskCountByInvestor[investor.id] || 0;
      const openFlagCount = flagCountByInvestor[investor.id] || 0;

      // Get latest meeting info
      const sortedMeetings = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
      const latestMeeting = sortedMeetings[0] ?? null;
      const daysSinceLastMeeting = latestMeeting
        ? Math.round(daysBetween(latestMeeting.date, now))
        : null;

      // Compute investor score from scoring.ts
      const investorScore = computeInvestorScore(
        investor, meetings, portfolio, [],
        { targetEquityM, targetCloseDate },
      );

      // Compute momentum
      const { momentum } = computeMomentumScore(investor, meetings);

      // Extract unresolved objections
      const allObjections = meetings.flatMap(m => parseJsonSafe<Objection[]>(m.objections, []));
      const unresolvedObjections = allObjections
        .filter(o => o.response_effectiveness !== 'resolved' && (o.severity === 'showstopper' || o.severity === 'significant'))
        .map(o => o.text);
      const topObjectionTopic = allObjections
        .filter(o => o.response_effectiveness !== 'resolved')
        .map(o => o.topic)
        .filter(Boolean)[0] ?? null;

      // Compute focus sub-scores
      const investorScoreComponent = investorScore.overall; // 0-100
      const urgency = computeUrgencyScore(daysSinceLastMeeting, investor.tier, investor.status);
      const momentumRisk = computeMomentumRiskScore(meetings, investor);
      const opportunitySize = computeOpportunitySizeScore(investor);
      const actionReadiness = computeActionReadinessScore(
        pendingTaskCount, openFlagCount, unresolvedObjections.length, investor.status,
      );

      // Weighted focus score
      const focusScore = clamp(
        investorScoreComponent * 0.30 +
        urgency * 0.25 +
        momentumRisk * 0.20 +
        opportunitySize * 0.15 +
        actionReadiness * 0.10
      );

      // Determine recommended action
      const actionResult = determineRecommendedAction(
        investor, meetings, daysSinceLastMeeting,
        unresolvedObjections, pendingTaskCount, momentum, topObjectionTopic,
      );

      focusItems.push({
        investorId: investor.id,
        investorName: investor.name,
        investorType: investor.type,
        investorTier: investor.tier,
        status: investor.status,
        enthusiasm: investor.enthusiasm || (latestMeeting?.enthusiasm_score ?? 0),
        focusScore,
        components: {
          investorScore: investorScoreComponent,
          urgency,
          momentumRisk,
          opportunitySize,
          actionReadiness,
        },
        scoringDimensions: investorScore.dimensions.map(d => ({
          name: d.name,
          score: d.score,
          signal: d.signal,
          evidence: d.evidence,
        })),
        recommendedAction: actionResult.action,
        timeEstimate: actionResult.timeEstimate,
        expectedImpact: actionResult.expectedImpact,
        riskIfIgnored: actionResult.riskIfIgnored,
        daysSinceLastMeeting,
        lastMeetingDate: latestMeeting?.date ?? null,
        lastMeetingType: latestMeeting?.type ?? null,
        momentum,
        pendingTaskCount,
        openFlagCount,
        unresolvedObjections: unresolvedObjections.slice(0, 3),
        topObjectionTopic,
      });
    }

    // Sort by focus score descending
    focusItems.sort((a, b) => b.focusScore - a.focusScore);

    // Quick Wins: score 50-70 with a single addressable objection or clear next step
    const quickWins = focusItems.filter(item =>
      item.focusScore >= 40 && item.focusScore <= 75 &&
      (item.unresolvedObjections.length === 1 ||
       (item.status === 'nda_signed' || item.status === 'met') && item.momentum !== 'stalled')
    ).slice(0, 5);

    // Stale Alerts: engaged+ with no meeting in 14+ days
    const engagedStatuses = ['engaged', 'in_dd', 'term_sheet'];
    const staleAlerts = focusItems.filter(item =>
      engagedStatuses.includes(item.status) &&
      (item.daysSinceLastMeeting === null || item.daysSinceLastMeeting >= 14)
    ).sort((a, b) => (b.daysSinceLastMeeting ?? 999) - (a.daysSinceLastMeeting ?? 999));

    // Weekly budget computation
    const timeEstimates: Record<string, number> = {
      '15min outreach': 0.25, '15min prep + email': 0.25, '15min prep + 30min call': 0.75,
      '15min call': 0.25, '15min review': 0.25,
      '30min prep': 0.5, '30min call': 0.5, '30min prep + 15min call': 0.75,
      '30min prep + 1hr meeting': 1.5,
      '45min prep': 0.75, '45min prep + 15min call': 1,
      '1hr meeting': 1, '1hr prep + 30min review': 1.5,
      '2hr meeting + 1hr prep': 3, '30min execution': 0.5,
    };

    let totalHours = 0;
    let meetingsCount = 0;
    let followUpsCount = 0;

    // Only count top investors (up to 15 most important)
    const topItems = focusItems.slice(0, 15);
    for (const item of topItems) {
      const hours = timeEstimates[item.timeEstimate] ?? 0.5;
      totalHours += hours;
      if (item.timeEstimate.includes('meeting') || item.timeEstimate.includes('call')) {
        meetingsCount++;
      } else {
        followUpsCount++;
      }
    }

    const weeklyBudget = {
      totalHoursRecommended: Math.round(totalHours * 10) / 10,
      meetingsRecommended: meetingsCount,
      followUpsRecommended: followUpsCount,
      investorCount: topItems.length,
    };

    return NextResponse.json({
      priorityQueue: focusItems,
      quickWins,
      staleAlerts,
      weeklyBudget,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Focus computation error:', error);
    return NextResponse.json(
      { error: 'Failed to compute focus data', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import { computeInvestorScore, computeMomentumScore } from '@/lib/scoring';
import type { Investor, Meeting, Objection } from '@/lib/types';
import { updateAccelerationAction, createTask, createFollowup, logActivity } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';
import { getClient, daysBetween, parseJsonSafe, STATUS_PROGRESSION, loadAllMeetings, loadRaiseConfig, loadAllPortfolios, groupByInvestorId } from '@/lib/api-helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccelerationItem { id: string; investorId: string; investorName: string; investorTier: number; investorType: string; status: string; enthusiasm: number; score: number; momentum: string; triggerType: 'momentum_cliff' | 'stall_risk' | 'window_closing' | 'catalyst_match' | 'competitive_pressure' | 'term_sheet_ready'; actionType: 'milestone_share' | 'expert_call' | 'site_visit' | 'competitive_signal' | 'warm_reintro' | 'data_update' | 'escalation'; description: string; expectedLift: number; confidence: 'high' | 'medium' | 'low'; timeEstimate: '15min' | '30min' | '1hr' | '2hr' | 'half_day'; urgency: 'immediate' | '48h' | 'this_week' | 'next_week'; triggerEvidence: string }

interface InvestorSummary { investorId: string; investorName: string; investorTier: number; investorType: string; status: string; enthusiasm: number; score: number; momentum: string; reason: string }

// ---------------------------------------------------------------------------
// Trigger Detection Functions
// ---------------------------------------------------------------------------

function detectMomentumCliff(investor: Investor, meetings: Meeting[]): AccelerationItem | null {
  if (meetings.length < 2) return null;
  const sorted = [...meetings].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-3);
  if (recent.length < 2) return null;

  const scores = recent.map(m => m.enthusiasm_score);
  let declining = true;
  for (let i = 1; i < scores.length; i++) { if (scores[i] >= scores[i - 1]) { declining = false; break; } }
  if (!declining) return null;

  const drop = scores[0] - scores[scores.length - 1];
  if (drop < 0.5) return null;

  const latestMeeting = sorted[sorted.length - 1];
  const objections = parseJsonSafe<Objection[]>(latestMeeting.objections, []);
  const unresolvedShowstoppers = objections.filter(o => o.response_effectiveness !== 'resolved' && (o.severity === 'showstopper' || o.severity === 'significant'));

  let description: string, actionType: AccelerationItem['actionType'], timeEstimate: AccelerationItem['timeEstimate'];
  if (unresolvedShowstoppers.length > 0) {
    description = `Enthusiasm dropping (${scores.join(' -> ')}/5). Unresolved objection on "${unresolvedShowstoppers[0].text}" is likely driving the decline. Send targeted response with updated data within 48 hours.`;
    actionType = 'data_update'; timeEstimate = '1hr';
  } else {
    description = `Enthusiasm declining across last ${scores.length} meetings (${scores.join(' -> ')}/5). Schedule a founder call to re-engage and understand concerns before momentum is lost.`;
    actionType = 'expert_call'; timeEstimate = '30min';
  }

  return { id: `mc_${investor.id}_${Date.now()}`, investorId: investor.id, investorName: investor.name, investorTier: investor.tier, investorType: investor.type, status: investor.status, enthusiasm: investor.enthusiasm, score: 0, momentum: 'decelerating', triggerType: 'momentum_cliff', actionType, description, expectedLift: drop >= 1.5 ? 10 : 15, confidence: drop >= 1.5 ? 'medium' : 'high', timeEstimate, urgency: 'immediate', triggerEvidence: `Enthusiasm trend: ${scores.join(' -> ')}/5 over last ${scores.length} meetings` };
}

function detectStallRisk(investor: Investor, meetings: Meeting[], now: string): AccelerationItem | null {
  const statusIdx = STATUS_PROGRESSION[investor.status] ?? 0;
  if (statusIdx <= 0 || statusIdx >= 8) return null;

  const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
  const latestMeeting = sorted[0] ?? null;
  const daysSinceLastMeeting = latestMeeting ? daysBetween(latestMeeting.date, now) : null;
  const latestEnth = latestMeeting?.enthusiasm_score ?? investor.enthusiasm;
  const daysSinceUpdate = daysBetween(investor.updated_at, now);
  const isStaleStatus = daysSinceUpdate > 21 && latestEnth < 3.5;
  const isGoingCold = daysSinceLastMeeting !== null && daysSinceLastMeeting > 14;
  const isVeryStale = daysSinceLastMeeting !== null && daysSinceLastMeeting > 30;

  if (!isStaleStatus && !isGoingCold) return null;

  const partner = investor.partner || investor.name;
  const isHighConviction = latestEnth >= 3.5 || investor.tier <= 2;

  let description: string, actionType: AccelerationItem['actionType'], timeEstimate: AccelerationItem['timeEstimate'], urgency: AccelerationItem['urgency'], expectedLift: number, confidence: AccelerationItem['confidence'];

  if (isVeryStale && !isHighConviction) {
    description = `${partner} has gone ${Math.round(daysSinceLastMeeting!)}d without contact, enthusiasm at ${latestEnth}/5. Deprioritize and reallocate time to higher-conviction investors.`;
    actionType = 'data_update'; timeEstimate = '15min'; urgency = 'next_week'; expectedLift = 5; confidence = 'low';
  } else if (isHighConviction && isGoingCold) {
    description = `${partner} hasn't been contacted in ${Math.round(daysSinceLastMeeting!)}d but has strong fundamentals (enthusiasm ${latestEnth}/5, Tier ${investor.tier}). Schedule a founder call to re-engage --- they may be interested but waiting for a catalyst.`;
    actionType = 'expert_call'; timeEstimate = '30min'; urgency = '48h'; expectedLift = 15; confidence = 'medium';
  } else if (isStaleStatus) {
    description = `${partner} has been in "${investor.status}" status for ${Math.round(daysSinceUpdate)}d with enthusiasm at ${latestEnth}/5. Send a milestone update or market data point to restart forward motion.`;
    actionType = 'milestone_share'; timeEstimate = '30min'; urgency = 'this_week'; expectedLift = 10; confidence = 'medium';
  } else {
    description = `${partner} is going cold --- ${Math.round(daysSinceLastMeeting!)}d since last meeting. Send a warm re-engagement message with a specific discussion point.`;
    actionType = 'warm_reintro'; timeEstimate = '15min'; urgency = '48h'; expectedLift = 10; confidence = 'medium';
  }

  return { id: `sr_${investor.id}_${Date.now()}`, investorId: investor.id, investorName: investor.name, investorTier: investor.tier, investorType: investor.type, status: investor.status, enthusiasm: investor.enthusiasm, score: 0, momentum: 'stalled', triggerType: 'stall_risk', actionType, description, expectedLift, confidence, timeEstimate, urgency, triggerEvidence: isStaleStatus ? `Status "${investor.status}" unchanged for ${Math.round(daysSinceUpdate)}d, enthusiasm ${latestEnth}/5` : `${Math.round(daysSinceLastMeeting!)}d since last meeting` };
}

function detectWindowClosing(investor: Investor, meetings: Meeting[], targetCloseDate: string | null, now: string): AccelerationItem | null {
  if (!targetCloseDate) return null;
  const daysToClose = daysBetween(now, targetCloseDate);
  if (daysToClose > 120) return null;
  const statusIdx = STATUS_PROGRESSION[investor.status] ?? 0;
  if (statusIdx >= 5 || statusIdx <= 0) return null;

  const stepsRemaining = 7 - statusIdx;
  const estimatedDaysNeeded = stepsRemaining * 14;
  if (estimatedDaysNeeded <= daysToClose) return null;

  const partner = investor.partner || investor.name;
  return { id: `wc_${investor.id}_${Date.now()}`, investorId: investor.id, investorName: investor.name, investorTier: investor.tier, investorType: investor.type, status: investor.status, enthusiasm: investor.enthusiasm, score: 0, momentum: 'steady', triggerType: 'window_closing', actionType: 'data_update', description: `${partner} is in "${investor.status}" with ~${Math.round(daysToClose)}d until target close. At current pace, they need ~${estimatedDaysNeeded}d to reach term sheet. Accelerate by sharing complete data room access and offering reference calls to compress the DD timeline.`, expectedLift: 10, confidence: 'medium', timeEstimate: '1hr', urgency: daysToClose < 45 ? 'immediate' : '48h', triggerEvidence: `${Math.round(daysToClose)}d to target close, ~${estimatedDaysNeeded}d needed at current pace` };
}

function detectCompetitivePressure(investor: Investor, meetings: Meeting[], allInvestors: Investor[], now: string): AccelerationItem | null {
  const statusIdx = STATUS_PROGRESSION[investor.status] ?? 0;
  if (statusIdx <= 0 || statusIdx >= 7) return null;

  const recentAccelerators = allInvestors.filter(other => other.id !== investor.id && other.tier === investor.tier && (STATUS_PROGRESSION[other.status] ?? 0) > statusIdx && daysBetween(other.updated_at, now) <= 7);
  if (recentAccelerators.length === 0) return null;

  const partner = investor.partner || investor.name;
  const movingNames = recentAccelerators.slice(0, 2).map(i => `a Tier ${i.tier} investor`).join(' and ');

  return { id: `cp_${investor.id}_${Date.now()}`, investorId: investor.id, investorName: investor.name, investorTier: investor.tier, investorType: investor.type, status: investor.status, enthusiasm: investor.enthusiasm, score: 0, momentum: 'steady', triggerType: 'competitive_pressure', actionType: 'competitive_signal', description: `${movingNames} recently advanced to a later stage. Mention process momentum to ${partner} without naming specifics --- competitive dynamics create urgency that generic follow-ups cannot.`, expectedLift: 10, confidence: 'medium', timeEstimate: '15min', urgency: '48h', triggerEvidence: `${recentAccelerators.length} peer investor(s) in Tier ${investor.tier} moved forward in last 7d` };
}

function detectTermSheetReadiness(investor: Investor, meetings: Meeting[], score: number, momentum: string): AccelerationItem | null {
  if (score < 70 || investor.status === 'term_sheet' || investor.status === 'closed' || investor.status === 'passed' || investor.status === 'dropped') return null;
  if (momentum === 'stalled' || momentum === 'decelerating') return null;

  const allObjections = meetings.flatMap(m => parseJsonSafe<Objection[]>(m.objections, []));
  if (allObjections.filter(o => o.severity === 'showstopper' && o.response_effectiveness !== 'resolved').length > 0) return null;

  const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
  const latestEnth = sorted[0]?.enthusiasm_score ?? investor.enthusiasm;
  if (latestEnth < 4) return null;

  const partner = investor.partner || investor.name;
  return { id: `ts_${investor.id}_${Date.now()}`, investorId: investor.id, investorName: investor.name, investorTier: investor.tier, investorType: investor.type, status: investor.status, enthusiasm: investor.enthusiasm, score, momentum, triggerType: 'term_sheet_ready', actionType: 'escalation', description: `${partner} shows all green signals: score ${score}/100, momentum ${momentum}, enthusiasm ${latestEnth}/5, no unresolved showstoppers. Push for term sheet within 10 days --- propose a specific timeline for IC submission.`, expectedLift: 25, confidence: 'high', timeEstimate: '30min', urgency: 'immediate', triggerEvidence: `Score ${score}/100, momentum ${momentum}, enthusiasm ${latestEnth}/5, 0 showstoppers` };
}

// ---------------------------------------------------------------------------
// GET Handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const db = getClient();
    const [investorRows, allMeetings, raiseConfig, allPortfolios] = await Promise.all([
      db.execute(`SELECT * FROM investors WHERE status NOT IN ('passed', 'dropped', 'closed') ORDER BY tier ASC, name ASC`),
      loadAllMeetings(db), loadRaiseConfig(db), loadAllPortfolios(db),]);

    const investors = investorRows.rows as unknown as Investor[];
    const now = new Date().toISOString();
    const meetingsByInvestor = groupByInvestorId(allMeetings);
    const portfolioByInvestor = groupByInvestorId(allPortfolios);
    const { targetEquityM, targetCloseDate } = raiseConfig;

    const accelerations: AccelerationItem[] = [];
    const termSheetReady: InvestorSummary[] = [];
    const atRisk: InvestorSummary[] = [];
    const deprioritize: InvestorSummary[] = [];

    for (const investor of investors) {
      const meetings = meetingsByInvestor[investor.id] || [];
      const portfolio = portfolioByInvestor[investor.id] || [];
      const investorScore = computeInvestorScore(investor, meetings, portfolio, [], { targetEquityM, targetCloseDate });
      const { momentum } = computeMomentumScore(investor, meetings);
      const score = investorScore.overall;

      const triggers: (AccelerationItem | null)[] = [detectMomentumCliff(investor, meetings), detectStallRisk(investor, meetings, now), detectWindowClosing(investor, meetings, targetCloseDate, now), detectCompetitivePressure(investor, meetings, investors, now), detectTermSheetReadiness(investor, meetings, score, momentum)];

      for (const trigger of triggers) {
        if (!trigger) continue;
        trigger.score = score;
        trigger.momentum = momentum;
        accelerations.push(trigger);

        const summary: InvestorSummary = { investorId: investor.id, investorName: investor.name, investorTier: investor.tier, investorType: investor.type, status: investor.status, enthusiasm: investor.enthusiasm, score, momentum, reason: trigger.triggerEvidence };

        if (trigger.triggerType === 'term_sheet_ready') termSheetReady.push(summary);
        else if (trigger.triggerType === 'stall_risk' && trigger.urgency === 'next_week' && trigger.confidence === 'low') deprioritize.push(summary);
        else if ((trigger.triggerType === 'momentum_cliff' || (trigger.triggerType === 'stall_risk' && trigger.urgency !== 'next_week')) && !atRisk.find(r => r.investorId === investor.id)) atRisk.push(summary);
      }}

    const urgencyOrder: Record<string, number> = { immediate: 0, '48h': 1, this_week: 2, next_week: 3 };
    accelerations.sort((a, b) => {
      const urgDiff = (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3);
      return urgDiff !== 0 ? urgDiff : b.expectedLift - a.expectedLift;});

    return NextResponse.json({
      summary: { immediate: accelerations.filter(a => a.urgency === 'immediate').length, this_week: accelerations.filter(a => a.urgency === '48h' || a.urgency === 'this_week').length, total: accelerations.length },
      accelerations, termSheetReady, atRisk, deprioritize, generatedAt: new Date().toISOString(),});
  } catch (error) {
    return NextResponse.json({ error: 'Failed to run acceleration analysis', detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }}

// ---------------------------------------------------------------------------
// PUT Handler
// ---------------------------------------------------------------------------

export async function PUT(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 }); }

  try {
    const { id, status, actual_lift } = body;
    if (!id) return NextResponse.json({ error: 'Missing action id' }, { status: 400 });

    const actionStatus = (status as string) || 'executed';
    await updateAccelerationAction(id as string, { status: actionStatus, actual_lift: (actual_lift as number) ?? null, executed_at: new Date().toISOString() });

    if (actionStatus === 'executed') {
      const investor_id = body.investor_id as string | undefined;
      const investor_name = body.investor_name as string | undefined;
      const description = body.description as string | undefined;
      const trigger_type = body.trigger_type as string | undefined;
      const action_type = body.action_type as string | undefined;
      const expected_lift = body.expected_lift as number | undefined;

      if (investor_id) {
        try {
          const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
          await createTask({ title: `[Acceleration] ${description || action_type || 'Follow through'}`, description: `Auto-generated from ${trigger_type || 'acceleration'} action. Expected conviction lift: +${expected_lift || '?'} pts.`, assignee: '', due_date: tomorrow.toISOString().split('T')[0], status: 'in_progress', priority: trigger_type === 'term_sheet_ready' ? 'critical' : 'high', phase: 'management_presentations', investor_id: investor_id || '', investor_name: investor_name || '', auto_generated: true });
        } catch { /* non-blocking */ }

        try {
          const followupDue = new Date(); followupDue.setHours(followupDue.getHours() + 24);
          await createFollowup({ meeting_id: '', investor_id: investor_id || '', investor_name: investor_name || '', action_type: trigger_type === 'term_sheet_ready' ? 'schedule_followup' : 'warm_reengagement', description: `Check-in after acceleration action: ${description || action_type}. Did conviction improve?`, due_at: followupDue.toISOString() });
        } catch { /* non-blocking */ }

        try {
          await logActivity({ event_type: 'acceleration_executed', subject: `Acceleration: ${action_type || trigger_type}`, detail: `${description}. Expected lift: +${expected_lift || '?'} pts.`, investor_id: investor_id || '', investor_name: investor_name || '' });
        } catch { /* non-blocking */ }
      }}

    emitContextChange('acceleration_executed', `Acceleration ${id} ${actionStatus}${body.investor_name ? ` for ${body.investor_name}` : ''}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update acceleration action', detail: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }}

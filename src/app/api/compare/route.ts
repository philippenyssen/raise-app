import { NextRequest, NextResponse } from 'next/server';
import { getInvestor, getMeetings, getInvestorPortfolio, getIntelligenceBriefs, getRaiseConfig, getScoreSnapshots, getFollowups, getAccelerationActions, upsertScoreSnapshot } from '@/lib/db';
import type { AccelerationAction } from '@/lib/db';
import { computeInvestorScore, computeConvictionTrajectory } from '@/lib/scoring';
import type { Investor, Meeting, Objection, FollowupAction } from '@/lib/types';
import { daysBetween, parseJsonSafe } from '@/lib/api-helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ObjectionProfile { totalCount: number; byTopic: Record<string, number>; unresolvedCount: number; avgSeverityScore: number; resolutionRate: number }
interface MeetingHistorySummary { totalMeetings: number; lastMeetingDate: string | null; lastMeetingType: string | null; daysSinceLastMeeting: number | null; meetingTypes: Record<string, number>; enthusiasmTrend: number[] }
interface FollowupStatus { pendingCount: number; overdueCount: number; completedCount: number; avgConvictionDelta: number }
type AccelerationStatusLabel = 'Term Sheet Ready' | 'Active' | 'At Risk' | 'Stalled';
interface AccelerationStatus { label: AccelerationStatusLabel; activeTriggers: string[]; pendingActions: number }

interface InvestorCompareProfile {
  investor: Investor;
  score: ReturnType<typeof computeInvestorScore>;
  convictionTrajectory: ReturnType<typeof computeConvictionTrajectory>;
  objectionProfile: ObjectionProfile;
  meetingHistory: MeetingHistorySummary;
  followupStatus: FollowupStatus;
  accelerationStatus: AccelerationStatus;
  recommendedAction: string;
}

interface DecisionMatrixEntry { dimension: string; winnerId: string; winnerName: string; scores: Record<string, number> }
interface ComparisonVerdict {
  mostLikelyToClose: { id: string; name: string; reason: string } | null;
  fastestDecision: { id: string; name: string; reason: string } | null;
  lowestRisk: { id: string; name: string; reason: string } | null;
  bestMomentum: { id: string; name: string; reason: string } | null;
  highestCheckPotential: { id: string; name: string; reason: string } | null;
}
interface ComparisonRecommendation { type: 'strong' | 'competitive' | 'none_ready'; text: string; primaryInvestorId: string | null; primaryInvestorName: string | null }

function buildObjectionProfile(meetings: Meeting[]): ObjectionProfile {
  const byTopic: Record<string, number> = {};
  let totalCount = 0, unresolvedCount = 0, severitySum = 0, resolvedCount = 0;

  for (const m of meetings) {
    const objs = parseJsonSafe<Objection[]>(m.objections, []);
    for (const o of objs) {
      totalCount++;
      const topic = o.topic || 'general';
      byTopic[topic] = (byTopic[topic] || 0) + 1;
      if (o.response_effectiveness === 'unresolved') unresolvedCount++;
      if (o.response_effectiveness === 'resolved') resolvedCount++;
      severitySum += o.severity === 'showstopper' ? 3 : o.severity === 'significant' ? 2 : 1;
    }}

  return {
    totalCount, byTopic, unresolvedCount,
    avgSeverityScore: totalCount > 0 ? Math.round((severitySum / totalCount) * 10) / 10 : 0,
    resolutionRate: totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0,};
}

function buildMeetingHistory(meetings: Meeting[]): MeetingHistorySummary {
  const now = new Date().toISOString();
  const sorted = [...meetings].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const meetingTypes: Record<string, number> = {};
  for (const m of meetings) meetingTypes[m.type] = (meetingTypes[m.type] || 0) + 1;
  const enthusiasmTrend = [...meetings].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(m => m.enthusiasm_score).reverse();

  return {
    totalMeetings: meetings.length,
    lastMeetingDate: latest?.date ?? null,
    lastMeetingType: latest?.type ?? null,
    daysSinceLastMeeting: latest ? Math.round(daysBetween(latest.date, now)) : null,
    meetingTypes, enthusiasmTrend,};
}

function buildFollowupStatus(followups: FollowupAction[]): FollowupStatus {
  const now = new Date().toISOString();
  let pendingCount = 0, overdueCount = 0, completedCount = 0, deltaSum = 0, deltaCount = 0;
  for (const f of followups) {
    if (f.status === 'pending') { pendingCount++; if (f.due_at < now) overdueCount++; }
    else if (f.status === 'completed') { completedCount++; if (f.conviction_delta !== 0) { deltaSum += f.conviction_delta; deltaCount++; } }
  }
  return { pendingCount, overdueCount, completedCount, avgConvictionDelta: deltaCount > 0 ? Math.round((deltaSum / deltaCount) * 10) / 10 : 0 };
}

function buildAccelerationStatus(investor: Investor, momentum: string, score: number, actions: AccelerationAction[]): AccelerationStatus {
  const pendingActions = actions.filter(a => a.status === 'pending');
  const activeTriggers = [...new Set(pendingActions.map(a => a.trigger_type))];
  let label: AccelerationStatusLabel;
  if (investor.status === 'term_sheet' || (score >= 75 && momentum === 'accelerating')) label = 'Term Sheet Ready';
  else if (momentum === 'stalled' || investor.status === 'passed' || investor.status === 'dropped') label = 'Stalled';
  else if (momentum === 'decelerating' || score < 35) label = 'At Risk';
  else label = 'Active';
  return { label, activeTriggers, pendingActions: pendingActions.length };
}

function buildDecisionMatrix(profiles: InvestorCompareProfile[]): DecisionMatrixEntry[] {
  const dimensionNames = profiles[0]?.score.dimensions.map(d => d.name) ?? [];
  return dimensionNames.map(dimName => {
    const scores: Record<string, number> = {};
    let winnerId = '', winnerName = '', maxScore = -1;
    for (const p of profiles) {
      const s = p.score.dimensions.find(d => d.name === dimName)?.score ?? 0;
      scores[p.investor.id] = s;
      if (s > maxScore) { maxScore = s; winnerId = p.investor.id; winnerName = p.investor.name; }
    }
    return { dimension: dimName, winnerId, winnerName, scores };});
}

function buildVerdict(profiles: InvestorCompareProfile[]): ComparisonVerdict {
  if (profiles.length === 0) return { mostLikelyToClose: null, fastestDecision: null, lowestRisk: null, bestMomentum: null, highestCheckPotential: null };

  const likelyToClose = [...profiles].sort((a, b) => {
    const bonus = (p: InvestorCompareProfile) => (p.accelerationStatus.label === 'Term Sheet Ready' ? 30 : 0) + (p.score.momentum === 'accelerating' ? 15 : p.score.momentum === 'steady' ? 5 : 0);
    return (b.score.overall + bonus(b)) - (a.score.overall + bonus(a));
  })[0];

  const fastest = [...profiles].sort((a, b) => {
    const spd = (p: InvestorCompareProfile) => (p.score.dimensions.find(d => d.name === 'Speed Match')?.score ?? 0) + p.meetingHistory.totalMeetings * 2 - (p.meetingHistory.daysSinceLastMeeting ?? 999);
    return spd(b) - spd(a);
  })[0];

  const lowestRisk = [...profiles].sort((a, b) => {
    const risk = (p: InvestorCompareProfile) => (p.score.dimensions.find(d => d.name === 'Conflict Risk')?.score ?? 0) - p.objectionProfile.unresolvedCount * 10;
    return risk(b) - risk(a);
  })[0];

  const bestMomentum = [...profiles].sort((a, b) => {
    const mom = (p: InvestorCompareProfile) => (p.score.dimensions.find(d => d.name === 'Momentum')?.score ?? 0) + p.convictionTrajectory.velocityPerWeek * 5;
    return mom(b) - mom(a);
  })[0];

  const highestCheck = [...profiles].sort((a, b) => (b.score.dimensions.find(d => d.name === 'Check Size Fit')?.score ?? 0) - (a.score.dimensions.find(d => d.name === 'Check Size Fit')?.score ?? 0))[0];

  return {
    mostLikelyToClose: { id: likelyToClose.investor.id, name: likelyToClose.investor.name, reason: `Score ${likelyToClose.score.overall}, ${likelyToClose.score.momentum} momentum, ${likelyToClose.accelerationStatus.label}` },
    fastestDecision: { id: fastest.investor.id, name: fastest.investor.name, reason: `Speed: ${fastest.investor.speed}, ${fastest.meetingHistory.totalMeetings} meetings, ${fastest.meetingHistory.daysSinceLastMeeting ?? 'N/A'}d since last` },
    lowestRisk: { id: lowestRisk.investor.id, name: lowestRisk.investor.name, reason: `${lowestRisk.objectionProfile.unresolvedCount} unresolved objections, conflict score ${lowestRisk.score.dimensions.find(d => d.name === 'Conflict Risk')?.score ?? 0}` },
    bestMomentum: { id: bestMomentum.investor.id, name: bestMomentum.investor.name, reason: `${bestMomentum.score.momentum}, velocity ${bestMomentum.convictionTrajectory.velocityPerWeek} pts/wk` },
    highestCheckPotential: { id: highestCheck.investor.id, name: highestCheck.investor.name, reason: `Check fit score ${highestCheck.score.dimensions.find(d => d.name === 'Check Size Fit')?.score ?? 0}, range: ${highestCheck.investor.check_size_range || 'unknown'}` },
  };
}

function buildRecommendation(profiles: InvestorCompareProfile[]): ComparisonRecommendation {
  if (profiles.length === 0) return { type: 'none_ready', text: 'No investors selected for comparison.', primaryInvestorId: null, primaryInvestorName: null };

  const sorted = [...profiles].sort((a, b) => b.score.overall - a.score.overall);
  const top = sorted[0], second = sorted.length > 1 ? sorted[1] : null;
  const hasShowstoppers = top.objectionProfile.unresolvedCount > 0 && top.objectionProfile.avgSeverityScore >= 2.5;

  if (top.score.overall >= 75 && (top.score.momentum === 'accelerating' || top.score.momentum === 'steady') && !hasShowstoppers) {
    return { type: 'strong', text: `Strong recommendation: prioritize ${top.investor.name}. Score ${top.score.overall}, ${top.score.momentum} momentum, no unresolved showstoppers.`, primaryInvestorId: top.investor.id, primaryInvestorName: top.investor.name };
  }

  if (second && Math.abs(top.score.overall - second.score.overall) <= 12) {
    const faster = top.convictionTrajectory.velocityPerWeek >= second.convictionTrajectory.velocityPerWeek ? top : second;
    return { type: 'competitive', text: `Both ${top.investor.name} (${top.score.overall}) and ${second.investor.name} (${second.score.overall}) are competitive. Focus on ${faster.investor.name} — faster trajectory (${faster.convictionTrajectory.velocityPerWeek} pts/wk).`, primaryInvestorId: faster.investor.id, primaryInvestorName: faster.investor.name };
  }

  if (top.score.overall < 50) return { type: 'none_ready', text: `None ready for term sheet. Top scorer ${top.investor.name} at ${top.score.overall}. Focus on objection resolution and meeting cadence first.`, primaryInvestorId: null, primaryInvestorName: null };

  return { type: 'competitive', text: `${top.investor.name} leads at ${top.score.overall}. ${top.score.momentum} momentum. ${top.objectionProfile.unresolvedCount > 0 ? `Address ${top.objectionProfile.unresolvedCount} unresolved objection(s) to accelerate.` : 'Push for next milestone.'}`, primaryInvestorId: top.investor.id, primaryInvestorName: top.investor.name };
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 }); }

  try {
    const investorIds: string[] = body.investor_ids as string[];
    if (!Array.isArray(investorIds) || investorIds.length < 2 || investorIds.length > 4) {
      return NextResponse.json({ error: 'investor_ids must be an array of 2-4 investor IDs' }, { status: 400 });
    }

    const raiseConfig = await getRaiseConfig();
    let targetEquityM = 250;
    let targetCloseDate: string | null = null;
    if (raiseConfig) {
      const eqStr = (raiseConfig.equity_amount || '').replace(/[^0-9.]/g, '').trim();
      const eqVal = parseFloat(eqStr);
      if (!isNaN(eqVal)) targetEquityM = eqVal >= 1000 ? eqVal / 1000 : eqVal > 0 ? eqVal : 250;
      targetCloseDate = raiseConfig.target_close || null;
    }

    const profilePromises = investorIds.map(async (id): Promise<InvestorCompareProfile | null> => {
      const [investor, meetings, portfolio, briefs, snapshots, followups, accActions] = await Promise.all([
        getInvestor(id), getMeetings(id), getInvestorPortfolio(id), getIntelligenceBriefs(undefined, id),
        getScoreSnapshots(id), getFollowups({ investor_id: id }), getAccelerationActions({ investor_id: id }),]);
      if (!investor) return null;

      const score = computeInvestorScore(investor, meetings, portfolio, briefs, { targetEquityM, targetCloseDate });
      const engagementDim = score.dimensions.find(d => d.name === 'Engagement');
      const momentumDim = score.dimensions.find(d => d.name === 'Momentum');
      upsertScoreSnapshot({ investor_id: id, overall_score: score.overall, engagement_score: engagementDim?.score, momentum_score: momentumDim?.score, enthusiasm: investor.enthusiasm, meeting_count: meetings.length, predicted_outcome: score.predictedOutcome }).catch(e => console.error('[COMPARE_SNAPSHOT]', e instanceof Error ? e.message : e));

      return {
        investor, score,
        convictionTrajectory: computeConvictionTrajectory(snapshots),
        objectionProfile: buildObjectionProfile(meetings),
        meetingHistory: buildMeetingHistory(meetings),
        followupStatus: buildFollowupStatus(followups),
        accelerationStatus: buildAccelerationStatus(investor, score.momentum, score.overall, accActions),
        recommendedAction: score.nextBestAction,
      };});

    const profiles = (await Promise.all(profilePromises)).filter((p): p is InvestorCompareProfile => p !== null);
    if (profiles.length < 2) return NextResponse.json({ error: 'Couldn\'t find enough valid investors. At least 2 required.' }, { status: 404 });

    return NextResponse.json({
      profiles,
      decisionMatrix: buildDecisionMatrix(profiles),
      verdict: buildVerdict(profiles),
      recommendation: buildRecommendation(profiles),});
  } catch (err) {
    console.error('[COMPARE_POST]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to compare investors' }, { status: 500 });
  }}

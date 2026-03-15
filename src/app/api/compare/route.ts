import { NextRequest, NextResponse } from 'next/server';
import {
  getInvestor,
  getMeetings,
  getInvestorPortfolio,
  getIntelligenceBriefs,
  getRaiseConfig,
  getScoreSnapshots,
  getFollowups,
  getAccelerationActions,
  upsertScoreSnapshot,
} from '@/lib/db';
import type { AccelerationAction } from '@/lib/db';
import { computeInvestorScore, computeConvictionTrajectory } from '@/lib/scoring';
import type { Investor, Meeting, Objection, FollowupAction } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ObjectionProfile {
  totalCount: number;
  byTopic: Record<string, number>;
  unresolvedCount: number;
  avgSeverityScore: number; // 1=minor, 2=significant, 3=showstopper
  resolutionRate: number; // 0-100%
}

interface MeetingHistorySummary {
  totalMeetings: number;
  lastMeetingDate: string | null;
  lastMeetingType: string | null;
  daysSinceLastMeeting: number | null;
  meetingTypes: Record<string, number>;
  enthusiasmTrend: number[]; // last 3 meeting enthusiasm scores
}

interface FollowupStatus {
  pendingCount: number;
  overdueCount: number;
  completedCount: number;
  avgConvictionDelta: number;
}

type AccelerationStatusLabel = 'Term Sheet Ready' | 'Active' | 'At Risk' | 'Stalled';

interface AccelerationStatus {
  label: AccelerationStatusLabel;
  activeTriggers: string[];
  pendingActions: number;
}

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

interface DecisionMatrixEntry {
  dimension: string;
  winnerId: string;
  winnerName: string;
  scores: Record<string, number>;
}

interface ComparisonVerdict {
  mostLikelyToClose: { id: string; name: string; reason: string } | null;
  fastestDecision: { id: string; name: string; reason: string } | null;
  lowestRisk: { id: string; name: string; reason: string } | null;
  bestMomentum: { id: string; name: string; reason: string } | null;
  highestCheckPotential: { id: string; name: string; reason: string } | null;
}

interface ComparisonRecommendation {
  type: 'strong' | 'competitive' | 'none_ready';
  text: string;
  primaryInvestorId: string | null;
  primaryInvestorName: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJsonSafe<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; }
  catch { return fallback; }
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24);
}

function buildObjectionProfile(meetings: Meeting[]): ObjectionProfile {
  const byTopic: Record<string, number> = {};
  let totalCount = 0;
  let unresolvedCount = 0;
  let severitySum = 0;
  let resolvedCount = 0;

  for (const m of meetings) {
    const objs = parseJsonSafe<Objection[]>(m.objections, []);
    for (const o of objs) {
      totalCount++;
      const topic = o.topic || 'general';
      byTopic[topic] = (byTopic[topic] || 0) + 1;

      if (o.response_effectiveness === 'unresolved') unresolvedCount++;
      if (o.response_effectiveness === 'resolved') resolvedCount++;

      if (o.severity === 'showstopper') severitySum += 3;
      else if (o.severity === 'significant') severitySum += 2;
      else severitySum += 1;
    }
  }

  return {
    totalCount,
    byTopic,
    unresolvedCount,
    avgSeverityScore: totalCount > 0 ? Math.round((severitySum / totalCount) * 10) / 10 : 0,
    resolutionRate: totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0,
  };
}

function buildMeetingHistory(meetings: Meeting[]): MeetingHistorySummary {
  const now = new Date().toISOString();
  const sorted = [...meetings].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  const meetingTypes: Record<string, number> = {};
  for (const m of meetings) {
    meetingTypes[m.type] = (meetingTypes[m.type] || 0) + 1;
  }

  // Last 3 meeting enthusiasm scores (most recent first)
  const recentMeetings = [...meetings]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const enthusiasmTrend = recentMeetings
    .map(m => m.enthusiasm_score)
    .reverse(); // oldest to newest

  return {
    totalMeetings: meetings.length,
    lastMeetingDate: latest?.date ?? null,
    lastMeetingType: latest?.type ?? null,
    daysSinceLastMeeting: latest ? Math.round(daysBetween(latest.date, now)) : null,
    meetingTypes,
    enthusiasmTrend,
  };
}

function buildFollowupStatus(followups: FollowupAction[]): FollowupStatus {
  const now = new Date().toISOString();
  let pendingCount = 0;
  let overdueCount = 0;
  let completedCount = 0;
  let deltaSum = 0;
  let deltaCount = 0;

  for (const f of followups) {
    if (f.status === 'pending') {
      pendingCount++;
      if (f.due_at < now) overdueCount++;
    } else if (f.status === 'completed') {
      completedCount++;
      if (f.conviction_delta !== 0) {
        deltaSum += f.conviction_delta;
        deltaCount++;
      }
    }
  }

  return {
    pendingCount,
    overdueCount,
    completedCount,
    avgConvictionDelta: deltaCount > 0 ? Math.round((deltaSum / deltaCount) * 10) / 10 : 0,
  };
}

function buildAccelerationStatus(
  investor: Investor,
  momentum: string,
  score: number,
  actions: AccelerationAction[],
): AccelerationStatus {
  const pendingActions = actions.filter(a => a.status === 'pending');
  const activeTriggers = [...new Set(pendingActions.map(a => a.trigger_type))];

  let label: AccelerationStatusLabel;
  if (investor.status === 'term_sheet' || (score >= 75 && momentum === 'accelerating')) {
    label = 'Term Sheet Ready';
  } else if (momentum === 'stalled' || (investor.status === 'passed' || investor.status === 'dropped')) {
    label = 'Stalled';
  } else if (momentum === 'decelerating' || score < 35) {
    label = 'At Risk';
  } else {
    label = 'Active';
  }

  return { label, activeTriggers, pendingActions: pendingActions.length };
}

function buildDecisionMatrix(profiles: InvestorCompareProfile[]): DecisionMatrixEntry[] {
  // Collect all dimension names from the first profile
  const dimensionNames = profiles[0]?.score.dimensions.map(d => d.name) ?? [];

  return dimensionNames.map(dimName => {
    const scores: Record<string, number> = {};
    let winnerId = '';
    let winnerName = '';
    let maxScore = -1;

    for (const p of profiles) {
      const dim = p.score.dimensions.find(d => d.name === dimName);
      const s = dim?.score ?? 0;
      scores[p.investor.id] = s;
      if (s > maxScore) {
        maxScore = s;
        winnerId = p.investor.id;
        winnerName = p.investor.name;
      }
    }

    return { dimension: dimName, winnerId, winnerName, scores };
  });
}

function buildVerdict(profiles: InvestorCompareProfile[]): ComparisonVerdict {
  if (profiles.length === 0) {
    return { mostLikelyToClose: null, fastestDecision: null, lowestRisk: null, bestMomentum: null, highestCheckPotential: null };
  }

  // Most likely to close: highest overall score + accelerating + term sheet or DD status
  const likelyToClose = [...profiles].sort((a, b) => {
    const aBonus = a.accelerationStatus.label === 'Term Sheet Ready' ? 30 : 0;
    const bBonus = b.accelerationStatus.label === 'Term Sheet Ready' ? 30 : 0;
    const aMom = a.score.momentum === 'accelerating' ? 15 : a.score.momentum === 'steady' ? 5 : 0;
    const bMom = b.score.momentum === 'accelerating' ? 15 : b.score.momentum === 'steady' ? 5 : 0;
    return (b.score.overall + bBonus + bMom) - (a.score.overall + aBonus + aMom);
  })[0];

  // Fastest decision: best speed score + IC process + meeting velocity
  const fastest = [...profiles].sort((a, b) => {
    const aSpeed = a.score.dimensions.find(d => d.name === 'Speed Match')?.score ?? 0;
    const bSpeed = b.score.dimensions.find(d => d.name === 'Speed Match')?.score ?? 0;
    const aMeetings = a.meetingHistory.totalMeetings;
    const bMeetings = b.meetingHistory.totalMeetings;
    const aRecency = a.meetingHistory.daysSinceLastMeeting ?? 999;
    const bRecency = b.meetingHistory.daysSinceLastMeeting ?? 999;
    return (bSpeed + bMeetings * 2 - bRecency) - (aSpeed + aMeetings * 2 - aRecency);
  })[0];

  // Lowest risk: highest conflict score + fewest unresolved objections
  const lowestRisk = [...profiles].sort((a, b) => {
    const aConflict = a.score.dimensions.find(d => d.name === 'Conflict Risk')?.score ?? 0;
    const bConflict = b.score.dimensions.find(d => d.name === 'Conflict Risk')?.score ?? 0;
    return (bConflict - b.objectionProfile.unresolvedCount * 10) - (aConflict - a.objectionProfile.unresolvedCount * 10);
  })[0];

  // Best momentum
  const bestMomentum = [...profiles].sort((a, b) => {
    const aScore = a.score.dimensions.find(d => d.name === 'Momentum')?.score ?? 0;
    const bScore = b.score.dimensions.find(d => d.name === 'Momentum')?.score ?? 0;
    const aVelocity = a.convictionTrajectory.velocityPerWeek;
    const bVelocity = b.convictionTrajectory.velocityPerWeek;
    return (bScore + bVelocity * 5) - (aScore + aVelocity * 5);
  })[0];

  // Highest check potential
  const highestCheck = [...profiles].sort((a, b) => {
    const aFit = a.score.dimensions.find(d => d.name === 'Check Size Fit')?.score ?? 0;
    const bFit = b.score.dimensions.find(d => d.name === 'Check Size Fit')?.score ?? 0;
    return bFit - aFit;
  })[0];

  return {
    mostLikelyToClose: {
      id: likelyToClose.investor.id,
      name: likelyToClose.investor.name,
      reason: `Score ${likelyToClose.score.overall}, ${likelyToClose.score.momentum} momentum, ${likelyToClose.accelerationStatus.label}`,
    },
    fastestDecision: {
      id: fastest.investor.id,
      name: fastest.investor.name,
      reason: `Speed: ${fastest.investor.speed}, ${fastest.meetingHistory.totalMeetings} meetings, ${fastest.meetingHistory.daysSinceLastMeeting ?? 'N/A'}d since last`,
    },
    lowestRisk: {
      id: lowestRisk.investor.id,
      name: lowestRisk.investor.name,
      reason: `${lowestRisk.objectionProfile.unresolvedCount} unresolved objections, conflict score ${lowestRisk.score.dimensions.find(d => d.name === 'Conflict Risk')?.score ?? 0}`,
    },
    bestMomentum: {
      id: bestMomentum.investor.id,
      name: bestMomentum.investor.name,
      reason: `${bestMomentum.score.momentum}, velocity ${bestMomentum.convictionTrajectory.velocityPerWeek} pts/wk`,
    },
    highestCheckPotential: {
      id: highestCheck.investor.id,
      name: highestCheck.investor.name,
      reason: `Check fit score ${highestCheck.score.dimensions.find(d => d.name === 'Check Size Fit')?.score ?? 0}, range: ${highestCheck.investor.check_size_range || 'unknown'}`,
    },
  };
}

function buildRecommendation(profiles: InvestorCompareProfile[]): ComparisonRecommendation {
  if (profiles.length === 0) {
    return { type: 'none_ready', text: 'No investors selected for comparison.', primaryInvestorId: null, primaryInvestorName: null };
  }

  const sorted = [...profiles].sort((a, b) => b.score.overall - a.score.overall);
  const top = sorted[0];
  const second = sorted.length > 1 ? sorted[1] : null;

  const hasShowstoppers = top.objectionProfile.unresolvedCount > 0 &&
    top.objectionProfile.avgSeverityScore >= 2.5;

  // Strong recommendation
  if (
    top.score.overall >= 75 &&
    (top.score.momentum === 'accelerating' || top.score.momentum === 'steady') &&
    !hasShowstoppers
  ) {
    return {
      type: 'strong',
      text: `Strong recommendation: prioritize ${top.investor.name}. Score ${top.score.overall}, ${top.score.momentum} momentum, no unresolved showstoppers.`,
      primaryInvestorId: top.investor.id,
      primaryInvestorName: top.investor.name,
    };
  }

  // Two competitive
  if (second && Math.abs(top.score.overall - second.score.overall) <= 12) {
    const fasterTrajectory = top.convictionTrajectory.velocityPerWeek >= second.convictionTrajectory.velocityPerWeek
      ? top : second;
    return {
      type: 'competitive',
      text: `Both ${top.investor.name} (${top.score.overall}) and ${second.investor.name} (${second.score.overall}) are competitive. Focus on ${fasterTrajectory.investor.name} — faster trajectory (${fasterTrajectory.convictionTrajectory.velocityPerWeek} pts/wk).`,
      primaryInvestorId: fasterTrajectory.investor.id,
      primaryInvestorName: fasterTrajectory.investor.name,
    };
  }

  // None ready
  if (top.score.overall < 50) {
    return {
      type: 'none_ready',
      text: `None ready for term sheet. Top scorer ${top.investor.name} at ${top.score.overall}. Focus on objection resolution and meeting cadence first.`,
      primaryInvestorId: null,
      primaryInvestorName: null,
    };
  }

  // Default: top is clear leader but not strong enough for "strong"
  return {
    type: 'competitive',
    text: `${top.investor.name} leads at ${top.score.overall}. ${top.score.momentum} momentum. ${top.objectionProfile.unresolvedCount > 0 ? `Address ${top.objectionProfile.unresolvedCount} unresolved objection(s) to accelerate.` : 'Push for next milestone.'}`,
    primaryInvestorId: top.investor.id,
    primaryInvestorName: top.investor.name,
  };
}

// ---------------------------------------------------------------------------
// POST Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  try {
    const investorIds: string[] = body.investor_ids as string[];

    if (!Array.isArray(investorIds) || investorIds.length < 2 || investorIds.length > 4) {
      return NextResponse.json(
        { error: 'investor_ids must be an array of 2-4 investor IDs' },
        { status: 400 },
      );
    }

    // Fetch raise config for scoring context
    const raiseConfig = await getRaiseConfig();
    let targetEquityM = 250;
    let targetCloseDate: string | null = null;
    if (raiseConfig) {
      const eqStr = (raiseConfig.equity_amount || '').replace(/[^0-9.]/g, '').trim();
      const eqVal = parseFloat(eqStr);
      if (!isNaN(eqVal)) targetEquityM = eqVal >= 1000 ? eqVal / 1000 : eqVal > 0 ? eqVal : 250;
      targetCloseDate = raiseConfig.target_close || null;
    }

    // Fetch all data for all investors in parallel
    const profilePromises = investorIds.map(async (id): Promise<InvestorCompareProfile | null> => {
      const [investor, meetings, portfolio, briefs, snapshots, followups, accActions] = await Promise.all([
        getInvestor(id),
        getMeetings(id),
        getInvestorPortfolio(id),
        getIntelligenceBriefs(undefined, id),
        getScoreSnapshots(id),
        getFollowups({ investor_id: id }),
        getAccelerationActions({ investor_id: id }),
      ]);

      if (!investor) return null;

      // Compute score
      const score = computeInvestorScore(
        investor,
        meetings,
        portfolio,
        briefs,
        { targetEquityM, targetCloseDate },
      );

      // Auto-snapshot (non-blocking)
      const engagementDim = score.dimensions.find(d => d.name === 'Engagement');
      const momentumDim = score.dimensions.find(d => d.name === 'Momentum');
      upsertScoreSnapshot({
        investor_id: id,
        overall_score: score.overall,
        engagement_score: engagementDim?.score,
        momentum_score: momentumDim?.score,
        enthusiasm: investor.enthusiasm,
        meeting_count: meetings.length,
        predicted_outcome: score.predictedOutcome,
      }).catch(() => {});

      // Conviction trajectory
      const trajectory = computeConvictionTrajectory(snapshots);

      // Objection profile
      const objectionProfile = buildObjectionProfile(meetings);

      // Meeting history
      const meetingHistory = buildMeetingHistory(meetings);

      // Follow-up status
      const followupStatus = buildFollowupStatus(followups);

      // Acceleration status
      const accelerationStatus = buildAccelerationStatus(
        investor,
        score.momentum,
        score.overall,
        accActions,
      );

      return {
        investor,
        score,
        convictionTrajectory: trajectory,
        objectionProfile,
        meetingHistory,
        followupStatus,
        accelerationStatus,
        recommendedAction: score.nextBestAction,
      };
    });

    const rawProfiles = await Promise.all(profilePromises);
    const profiles = rawProfiles.filter((p): p is InvestorCompareProfile => p !== null);

    if (profiles.length < 2) {
      return NextResponse.json(
        { error: 'Could not find enough valid investors. At least 2 required.' },
        { status: 404 },
      );
    }

    // Build comparison outputs
    const decisionMatrix = buildDecisionMatrix(profiles);
    const verdict = buildVerdict(profiles);
    const recommendation = buildRecommendation(profiles);

    return NextResponse.json({
      profiles,
      decisionMatrix,
      verdict,
      recommendation,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import {
  getInvestor,
  getMeetings,
  getFollowups,
  getObjectionsByInvestor,
  getAllInvestors,
  computeEngagementVelocity,
  computeRaiseForecast,
  getScoreSnapshots,
  getRaiseConfig,
} from '@/lib/db';

/**
 * Predictive Close Timeline API
 *
 * Synthesizes scoring, velocity, stage data, objections, and meeting patterns
 * into a probability-weighted close timeline with risk factors.
 *
 * GET /api/investors/[id]/predict
 */

const STAGE_ORDER = ['identified', 'contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged', 'in_dd', 'term_sheet', 'closed'];

const STAGE_MEDIAN_DAYS: Record<string, number> = {
  identified: 3, contacted: 5, nda_signed: 5, meeting_scheduled: 4,
  met: 7, engaged: 14, in_dd: 21, term_sheet: 10,
};

const STAGE_CLOSE_PROB: Record<string, number> = {
  identified: 0.05, contacted: 0.08, nda_signed: 0.12, meeting_scheduled: 0.15,
  met: 0.22, engaged: 0.35, in_dd: 0.55, term_sheet: 0.80, closed: 1.0,
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [investor, meetings, followups, objections, allInvestors, velocityAll, forecastData, snapshots, config] = await Promise.all([
      getInvestor(id),
      getMeetings(id),
      getFollowups({ investor_id: id }),
      getObjectionsByInvestor(id).catch(() => []),
      getAllInvestors(),
      computeEngagementVelocity().catch(() => []),
      computeRaiseForecast().catch(() => null),
      getScoreSnapshots(id).catch(() => []),
      getRaiseConfig().catch(() => null),
    ]);

    if (!investor) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 });
    }

    const now = Date.now();
    const stageIdx = STAGE_ORDER.indexOf(investor.status);

    // --- Base close probability from stage ---
    let closeProbability = STAGE_CLOSE_PROB[investor.status] ?? 0.10;

    // --- Adjustments ---

    // Tier adjustment
    if (investor.tier === 1) closeProbability *= 1.15;
    else if (investor.tier === 3) closeProbability *= 0.85;

    // Enthusiasm adjustment
    const enthusiasm = investor.enthusiasm ?? 3;
    if (enthusiasm >= 4) closeProbability *= 1.0 + (enthusiasm - 3) * 0.1;
    else if (enthusiasm <= 2) closeProbability *= 0.7;

    // Meeting momentum
    const sortedMeetings = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
    const recentMeetingCount = sortedMeetings.filter(m => {
      const d = new Date(m.date).getTime();
      return now - d < 21 * 864e5;
    }).length;
    if (recentMeetingCount >= 2) closeProbability *= 1.1;
    else if (meetings.length === 0 && stageIdx >= 3) closeProbability *= 0.6;

    // Objection risk
    const unresolvedObjections = objections.filter(o =>
      o.effectiveness !== 'effective' && o.effectiveness !== 'partially_effective'
    );
    const showstoppers = unresolvedObjections.filter(o => o.objection_topic === 'showstopper' || o.effectiveness === 'ineffective');
    if (showstoppers.length > 0) closeProbability *= 0.5;
    else if (unresolvedObjections.length >= 3) closeProbability *= 0.75;

    // Velocity data
    const thisVelocity = velocityAll.find(v => v.investorId === id);
    if (thisVelocity) {
      const accel = typeof thisVelocity.acceleration === 'string' ? parseFloat(thisVelocity.acceleration) : thisVelocity.acceleration;
      if (accel > 0) closeProbability *= 1.1;
      else if (thisVelocity.signal === 'decelerating') closeProbability *= 0.8;
      else if (thisVelocity.signal === 'gone_silent') closeProbability *= 0.5;
    }

    // Score trend from snapshots
    let scoreTrend: 'rising' | 'falling' | 'stable' = 'stable';
    if (snapshots.length >= 2) {
      const recent = snapshots.slice(-3);
      const avgRecent = recent.reduce((s, r) => s + (r.overall_score ?? 0), 0) / recent.length;
      const older = snapshots.slice(0, Math.max(1, snapshots.length - 3));
      const avgOlder = older.reduce((s, r) => s + (r.overall_score ?? 0), 0) / older.length;
      if (avgRecent > avgOlder + 5) { scoreTrend = 'rising'; closeProbability *= 1.1; }
      else if (avgRecent < avgOlder - 5) { scoreTrend = 'falling'; closeProbability *= 0.85; }
    }

    // Pending followups risk
    const pendingFollowups = followups.filter(f => f.status === 'pending');
    const overdueFollowups = pendingFollowups.filter(f => {
      const due = new Date(f.due_at || '').getTime();
      return due < now;
    });
    if (overdueFollowups.length >= 2) closeProbability *= 0.85;

    // Cap probability
    closeProbability = Math.min(0.95, Math.max(0.02, closeProbability));

    // --- Estimated days to close ---
    const remainingStages = STAGE_ORDER.slice(stageIdx + 1).filter(s => s !== 'closed');
    let estimatedDaysToClose = remainingStages.reduce((sum, s) => sum + (STAGE_MEDIAN_DAYS[s] ?? 7), 0);

    // Adjust based on velocity
    const accelNum = thisVelocity ? (typeof thisVelocity.acceleration === 'string' ? parseFloat(thisVelocity.acceleration) : thisVelocity.acceleration) : 0;
    if (accelNum > 0) {
      estimatedDaysToClose = Math.round(estimatedDaysToClose * 0.8);
    } else if (accelNum < 0) {
      estimatedDaysToClose = Math.round(estimatedDaysToClose * 1.3);
    }

    // Days already spent in current stage
    const daysInStage = Math.max(0, Math.round((now - new Date(investor.updated_at).getTime()) / 864e5));
    const expectedDaysInStage = STAGE_MEDIAN_DAYS[investor.status] ?? 7;
    const stageOverdue = daysInStage > expectedDaysInStage * 1.5;
    if (stageOverdue) estimatedDaysToClose += Math.round((daysInStage - expectedDaysInStage) * 0.5);

    // Use forecast data if available
    const invForecast = forecastData?.forecasts?.find((f: { investorId: string }) => f.investorId === id);
    if (invForecast) {
      estimatedDaysToClose = Math.round((estimatedDaysToClose + invForecast.predictedDaysToClose) / 2);
    }

    const estimatedCloseDate = new Date(now + estimatedDaysToClose * 864e5).toISOString().slice(0, 10);

    // --- Outcome distribution ---
    const passProbability = Math.max(0.02, 1 - closeProbability - 0.15);
    const stallProbability = Math.max(0.03, 1 - closeProbability - passProbability);
    const outcomes = [
      { outcome: 'close', probability: Math.round(closeProbability * 100), label: 'Closes deal', timeframe: `~${estimatedDaysToClose} days` },
      { outcome: 'stall', probability: Math.round(stallProbability * 100), label: 'Stalls / goes silent', timeframe: 'N/A' },
      { outcome: 'pass', probability: Math.round(passProbability * 100), label: 'Passes on deal', timeframe: 'N/A' },
    ];

    // --- Risk factors ---
    const risks: { factor: string; severity: 'high' | 'medium' | 'low'; detail: string }[] = [];

    if (showstoppers.length > 0) risks.push({ factor: 'Showstopper objection', severity: 'high', detail: `${showstoppers.length} unresolved critical objection(s)` });
    if (stageOverdue) risks.push({ factor: 'Stage overdue', severity: 'medium', detail: `${daysInStage} days in ${investor.status.replace(/_/g, ' ')} (expected ~${expectedDaysInStage})` });
    if (overdueFollowups.length > 0) risks.push({ factor: 'Overdue follow-ups', severity: overdueFollowups.length >= 2 ? 'high' : 'medium', detail: `${overdueFollowups.length} overdue action(s)` });
    if (thisVelocity?.signal === 'gone_silent') risks.push({ factor: 'Gone silent', severity: 'high', detail: `No contact for ${thisVelocity.daysSinceLastMeeting} days` });
    if (thisVelocity?.signal === 'decelerating') risks.push({ factor: 'Decelerating', severity: 'medium', detail: 'Meeting pace slowing down' });
    if (scoreTrend === 'falling') risks.push({ factor: 'Score declining', severity: 'medium', detail: 'Overall score trending downward' });
    if (enthusiasm <= 2) risks.push({ factor: 'Low enthusiasm', severity: 'medium', detail: `Enthusiasm ${enthusiasm}/5` });
    if (meetings.length === 0 && stageIdx >= 2) risks.push({ factor: 'No meetings yet', severity: 'high', detail: 'Advanced stage but zero meetings recorded' });

    // --- Next steps to advance ---
    const nextSteps: { action: string; priority: 'critical' | 'high' | 'normal'; rationale: string }[] = [];

    if (overdueFollowups.length > 0) {
      nextSteps.push({ action: `Complete ${overdueFollowups.length} overdue follow-up(s)`, priority: 'critical', rationale: 'Overdue actions signal disengagement to the investor' });
    }
    if (showstoppers.length > 0) {
      nextSteps.push({ action: 'Address critical objection with data', priority: 'critical', rationale: 'Showstopper objections block advancement' });
    }
    if (investor.status === 'met' || investor.status === 'engaged') {
      nextSteps.push({ action: 'Schedule follow-up meeting within 5 days', priority: 'high', rationale: 'Maintain momentum — meetings drive conviction' });
    }
    if (investor.status === 'in_dd') {
      nextSteps.push({ action: 'Proactively share DD materials', priority: 'high', rationale: 'Reduce friction — anticipate DD questions' });
    }
    if (investor.status === 'term_sheet') {
      nextSteps.push({ action: 'Push for signed term sheet', priority: 'critical', rationale: 'Close window before competitive dynamics shift' });
    }
    if (recentMeetingCount === 0 && stageIdx >= 3) {
      nextSteps.push({ action: 'Re-engage with value-add touchpoint', priority: 'high', rationale: 'No recent meetings — risk of going cold' });
    }
    if (pendingFollowups.length > 0 && overdueFollowups.length === 0) {
      nextSteps.push({ action: `Complete ${pendingFollowups.length} pending follow-up(s) on time`, priority: 'normal', rationale: 'Stay on top of commitments' });
    }

    // --- Peer comparison ---
    const peerInvestors = allInvestors.filter(i =>
      i.id !== id && i.status === investor.status && i.status !== 'passed' && i.status !== 'dropped'
    );
    const avgPeerEnthusiasm = peerInvestors.length > 0
      ? Math.round(peerInvestors.reduce((s, i) => s + (i.enthusiasm ?? 3), 0) / peerInvestors.length * 10) / 10
      : null;

    return NextResponse.json({
      investorId: id,
      investorName: investor.name,
      currentStage: investor.status,
      tier: investor.tier,
      enthusiasm,

      prediction: {
        closeProbability: Math.round(closeProbability * 100),
        estimatedDaysToClose,
        estimatedCloseDate,
        confidence: closeProbability > 0.6 ? 'high' : closeProbability > 0.3 ? 'medium' : 'low',
        scoreTrend,
      },

      outcomes,
      risks: risks.sort((a, b) => {
        const sev = { high: 0, medium: 1, low: 2 };
        return sev[a.severity] - sev[b.severity];
      }),
      nextSteps: nextSteps.sort((a, b) => {
        const pri = { critical: 0, high: 1, normal: 2 };
        return pri[a.priority] - pri[b.priority];
      }),

      context: {
        daysInStage,
        expectedDaysInStage,
        stageOverdue,
        totalMeetings: meetings.length,
        recentMeetings: recentMeetingCount,
        unresolvedObjections: unresolvedObjections.length,
        pendingFollowups: pendingFollowups.length,
        overdueFollowups: overdueFollowups.length,
        peerComparison: avgPeerEnthusiasm !== null ? {
          avgPeerEnthusiasm,
          relativePosition: enthusiasm > avgPeerEnthusiasm ? 'above' : enthusiasm < avgPeerEnthusiasm ? 'below' : 'at',
        } : null,
      },

      generatedAt: new Date().toISOString(),
    }, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('[PREDICT_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to generate prediction' }, { status: 500 });
  }
}

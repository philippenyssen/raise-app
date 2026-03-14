import { NextResponse } from 'next/server';
import { getFullContext } from '@/lib/context-bus';
import { saveHealthSnapshot, getHealthSnapshots } from '@/lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StrategicRecommendation {
  priority: 1 | 2 | 3 | 4 | 5;
  category: 'pipeline' | 'narrative' | 'execution' | 'timing' | 'risk';
  title: string;
  rationale: string;
  action: string;
  expectedImpact: string;
  deadline: string;
}

interface StrategicAssessment {
  ceoBrief: string;
  raiseVelocity: {
    meetingsPerWeek: number;
    stageAdvancesPerWeek: number;
    trend: 'accelerating' | 'steady' | 'decelerating';
  };
  narrativeHealthScore: number;
  pipelineConcentrationRisk: number; // Herfindahl index 0-1
  fundraiseReadinessScore: number;
  recommendations: StrategicRecommendation[];
  healthSnapshot: {
    pipelineScore: number;
    narrativeScore: number;
    readinessScore: number;
    velocity: number;
    activeInvestors: number;
  };
  historicalSnapshots: {
    date: string;
    pipelineScore: number;
    narrativeScore: number;
    readinessScore: number;
    velocity: number;
    activeInvestors: number;
  }[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Metric computation helpers
// ---------------------------------------------------------------------------

/**
 * Compute raise velocity: meetings/week and stage advances/week
 * Uses recent activity timestamps to gauge pace.
 */
function computeRaiseVelocity(ctx: Awaited<ReturnType<typeof getFullContext>>): {
  meetingsPerWeek: number;
  stageAdvancesPerWeek: number;
  trend: 'accelerating' | 'steady' | 'decelerating';
} {
  const now = Date.now();
  const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
  const fourWeeksAgo = now - 28 * 24 * 60 * 60 * 1000;

  // Count meetings in last 2 weeks and 2-4 weeks ago from activity log
  let recentMeetings = 0;
  let olderMeetings = 0;
  let recentAdvances = 0;
  let olderAdvances = 0;

  for (const entry of ctx.recentActivity) {
    // Parse timestamp from "[YYYY-MM-DDTHH:MM:SS...]" prefix
    const tsMatch = entry.match(/^\[([\d-T:.Z+]+)\]/);
    if (!tsMatch) continue;
    const ts = new Date(tsMatch[1]).getTime();
    if (isNaN(ts)) continue;

    const isRecent = ts >= twoWeeksAgo;
    const isOlder = ts >= fourWeeksAgo && ts < twoWeeksAgo;

    if (entry.toLowerCase().includes('meeting') || entry.toLowerCase().includes('met ')) {
      if (isRecent) recentMeetings++;
      else if (isOlder) olderMeetings++;
    }
    if (entry.toLowerCase().includes('moved to') || entry.toLowerCase().includes('status')) {
      if (isRecent) recentAdvances++;
      else if (isOlder) olderAdvances++;
    }
  }

  // Also count from investor data: meetings by date
  let totalMeetingCount = 0;
  let investorsWithMeetings = 0;
  for (const inv of ctx.investors) {
    if (inv.meetingCount > 0) {
      totalMeetingCount += inv.meetingCount;
      investorsWithMeetings++;
    }
  }

  // Meetings per week (based on recent 2-week window)
  const meetingsPerWeek = Math.round((recentMeetings / 2) * 10) / 10;
  const stageAdvancesPerWeek = Math.round((recentAdvances / 2) * 10) / 10;

  // Determine trend by comparing recent vs older period
  let trend: 'accelerating' | 'steady' | 'decelerating' = 'steady';
  const recentActivity = recentMeetings + recentAdvances;
  const olderActivity = olderMeetings + olderAdvances;
  if (olderActivity > 0) {
    const ratio = recentActivity / olderActivity;
    if (ratio > 1.3) trend = 'accelerating';
    else if (ratio < 0.7) trend = 'decelerating';
  } else if (recentActivity > 0) {
    trend = 'accelerating';
  }

  // If pipeline flow data provides a velocity trend, use that as additional signal
  if (ctx.pipelineFlow?.velocityTrend === 'accelerating' && trend === 'steady') {
    trend = 'accelerating';
  } else if (ctx.pipelineFlow?.velocityTrend === 'decelerating' && trend === 'steady') {
    trend = 'decelerating';
  }

  return { meetingsPerWeek, stageAdvancesPerWeek, trend };
}

/**
 * Narrative Health Score (0-100):
 * Based on question convergence (inversely), objection resolution rate,
 * and enthusiasm trend across all investors.
 */
function computeNarrativeHealth(ctx: Awaited<ReturnType<typeof getFullContext>>): number {
  let score = 70; // Start at 70 (baseline)

  // Penalty for narrative weaknesses (question convergence = multiple investors questioning same topic)
  for (const nw of ctx.narrativeWeaknesses) {
    if (nw.investorCount >= 3) score -= 15; // Critical gap
    else if (nw.investorCount >= 2) score -= 8;  // Warning
  }

  // Penalty for persistent objections
  if (ctx.objectionEvolution) {
    score -= ctx.objectionEvolution.persistent.length * 8;
    // Bonus for resolved objections
    score += Math.min(15, ctx.objectionEvolution.resolvedCount * 3);
  }

  // Penalty for struggling investor types
  const struggling = ctx.narrativeDrift.filter(nd => nd.status === 'struggling');
  score -= struggling.length * 10;

  // Bonus for proven responses
  score += Math.min(10, ctx.provenResponses.length * 3);

  // Enthusiasm signal
  if (ctx.pipelineHealth.avgEnthusiasm >= 4) score += 10;
  else if (ctx.pipelineHealth.avgEnthusiasm >= 3) score += 5;
  else if (ctx.pipelineHealth.avgEnthusiasm < 2.5) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Pipeline Concentration Risk: Herfindahl index of expected pipeline value.
 * 0 = perfectly diversified, 1 = concentrated on single investor.
 */
function computePipelineConcentration(ctx: Awaited<ReturnType<typeof getFullContext>>): number {
  const activeInvestors = ctx.investors.filter(i =>
    !['passed', 'dropped'].includes(i.status)
  );

  if (activeInvestors.length <= 1) return 1;

  // Assign relative value weights based on status advancement and tier
  const statusWeights: Record<string, number> = {
    identified: 1, contacted: 2, nda_signed: 3, meeting_scheduled: 4,
    met: 5, engaged: 10, in_dd: 20, term_sheet: 40, closed: 50,
  };
  const tierMultipliers: Record<number, number> = { 1: 4, 2: 2, 3: 1, 4: 0.5 };

  const values = activeInvestors.map(inv => {
    const statusW = statusWeights[inv.status] ?? 1;
    const tierM = tierMultipliers[inv.tier] ?? 1;
    return statusW * tierM * Math.max(1, inv.enthusiasm);
  });

  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;

  // Herfindahl index: sum of squared market shares
  const hhi = values.reduce((s, v) => s + Math.pow(v / total, 2), 0);

  return Math.round(hhi * 100) / 100;
}

/**
 * Fundraise Readiness Score (0-100):
 * Composite of pipeline depth, narrative health, execution quality, data room completeness.
 */
function computeReadiness(
  ctx: Awaited<ReturnType<typeof getFullContext>>,
  narrativeScore: number,
  concentration: number,
): number {
  let score = 0;

  // Pipeline depth (30 points)
  const activeCount = ctx.pipelineHealth.totalActive;
  const advancedCount = (ctx.pipelineHealth.byStatus['engaged'] || 0)
    + (ctx.pipelineHealth.byStatus['in_dd'] || 0)
    + (ctx.pipelineHealth.byStatus['term_sheet'] || 0);
  score += Math.min(15, activeCount * 1.5); // Up to 15 for pipeline breadth
  score += Math.min(15, advancedCount * 5);  // Up to 15 for advanced investors

  // Narrative health (25 points)
  score += (narrativeScore / 100) * 25;

  // Execution quality (20 points)
  // Penalize overdue follow-ups, reward completed tasks
  const overdueRatio = ctx.pipelineHealth.overdueFollowups / Math.max(1, activeCount);
  score += Math.max(0, 20 - overdueRatio * 40); // Full marks if no overdue

  // Data room completeness (15 points)
  const docCount = ctx.documents.length;
  score += Math.min(15, docCount * 2); // Up to 15 for documents

  // Diversification bonus/penalty (10 points)
  score += (1 - concentration) * 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Generate 3-5 strategic recommendations ranked by impact.
 */
function generateRecommendations(
  ctx: Awaited<ReturnType<typeof getFullContext>>,
  velocity: ReturnType<typeof computeRaiseVelocity>,
  narrativeScore: number,
  concentration: number,
  readiness: number,
): StrategicRecommendation[] {
  const recs: StrategicRecommendation[] = [];

  // 1. Pipeline velocity issue
  if (velocity.trend === 'decelerating') {
    recs.push({
      priority: 1,
      category: 'pipeline',
      title: 'Pipeline momentum is slowing down',
      rationale: `Meetings/week: ${velocity.meetingsPerWeek}, stage advances/week: ${velocity.stageAdvancesPerWeek}. The pace is decelerating compared to the prior period. In fundraising, loss of momentum is the #1 killer.`,
      action: 'Schedule 3+ new investor meetings this week. Re-engage stalled conversations with a milestone update. Create urgency with competitive timing signals.',
      expectedImpact: 'Reversing deceleration typically yields 2-3x increase in conversion rates within 2 weeks.',
      deadline: 'This week',
    });
  }

  // 2. Narrative gap
  if (narrativeScore < 50) {
    const weakTopics = ctx.narrativeWeaknesses.map(nw => `"${nw.topic}"`).join(', ');
    recs.push({
      priority: narrativeScore < 30 ? 1 : 2,
      category: 'narrative',
      title: 'Narrative needs urgent strengthening',
      rationale: `Narrative health is ${narrativeScore}/100. Weak areas: ${weakTopics || 'general narrative not resonating'}. ${ctx.narrativeDrift.filter(nd => nd.status === 'struggling').length} investor types are struggling.`,
      action: 'Review and strengthen pitch materials on flagged topics. Develop type-specific pitch variants for struggling investor segments. Use proven responses from the playbook.',
      expectedImpact: 'Addressing narrative gaps typically lifts enthusiasm by 0.5-1.0 points across pipeline.',
      deadline: 'Within 3 days',
    });
  }

  // 3. Concentration risk
  if (concentration > 0.35) {
    recs.push({
      priority: 2,
      category: 'risk',
      title: 'Pipeline too concentrated on few investors',
      rationale: `Herfindahl index: ${Math.round(concentration * 100)}%. A single pass from a top investor could derail the raise. Healthy fundraises have concentration below 25%.`,
      action: 'Add 5+ new investors to the pipeline, diversifying across types and tiers. Ensure no single investor represents more than 20% of expected close value.',
      expectedImpact: 'Reducing concentration below 25% gives the raise structural resilience.',
      deadline: 'Next 2 weeks',
    });
  }

  // 4. Execution gaps
  if (ctx.pipelineHealth.overdueFollowups > 2) {
    recs.push({
      priority: ctx.pipelineHealth.overdueFollowups > 5 ? 1 : 3,
      category: 'execution',
      title: `${ctx.pipelineHealth.overdueFollowups} overdue follow-ups`,
      rationale: `Each day of delayed follow-up reduces close probability. ${ctx.pipelineHealth.overdueFollowups} pending items signal process breakdown to sophisticated investors.`,
      action: 'Block 2 hours today to clear all overdue follow-ups. Set up daily follow-up review cadence.',
      expectedImpact: 'Clearing overdue follow-ups prevents 10-15% probability erosion per stalled investor.',
      deadline: 'Today',
    });
  }

  // 5. Keystone investor priority
  if (ctx.keystoneInvestors.length > 0) {
    const ki = ctx.keystoneInvestors[0];
    const kiInv = ctx.investors.find(i => i.id === ki.id);
    const isAdvanced = kiInv && ['engaged', 'in_dd', 'term_sheet'].includes(kiInv.status);
    if (!isAdvanced && kiInv) {
      recs.push({
        priority: 2,
        category: 'pipeline',
        title: `Accelerate keystone investor: ${ki.name}`,
        rationale: `${ki.name} is connected to ${ki.connectionCount} other pipeline investors with cascade value "${ki.cascadeValue}". Currently at "${kiInv.status}". Closing this investor creates a domino effect.`,
        action: `Prioritize ${ki.name} above other investors. Allocate 2x normal time and attention. Schedule a milestone-driven engagement within 48 hours.`,
        expectedImpact: `Potential to unlock ${ki.connectionCount} additional investors through network effects.`,
        deadline: 'This week',
      });
    }
  }

  // 6. Timing opportunity
  if (ctx.timingSignals.some(ts => ts.type === 'competitive_tension')) {
    recs.push({
      priority: 3,
      category: 'timing',
      title: 'Leverage competitive tension',
      rationale: 'Multiple investors are active simultaneously. This is the optimal moment to create urgency and drive toward term sheets.',
      action: 'Communicate (factually) that the process is competitive. Synchronize DD timelines where possible. Push advanced investors toward commitment.',
      expectedImpact: 'Competitive tension typically compresses timelines by 30-50% and improves terms.',
      deadline: 'Immediate',
    });
  }

  // 7. Emerging objections
  if (ctx.objectionEvolution && ctx.objectionEvolution.emerging.length > 0) {
    recs.push({
      priority: 3,
      category: 'narrative',
      title: `New objections emerging: ${ctx.objectionEvolution.emerging.join(', ')}`,
      rationale: 'These objection topics are appearing in recent meetings and growing. If unaddressed, they will become persistent blockers.',
      action: 'Develop clear responses for each emerging objection. Update pitch materials to preemptively address them. Brief the team on approved responses.',
      expectedImpact: 'Proactively addressing emerging objections prevents them from becoming deal-breakers.',
      deadline: 'Before next investor meeting',
    });
  }

  // Sort by priority
  recs.sort((a, b) => a.priority - b.priority);

  // Cap at 5
  return recs.slice(0, 5);
}

/**
 * Generate CEO brief: 3 sentences max summarizing the strategic situation.
 */
function generateCEOBrief(
  ctx: Awaited<ReturnType<typeof getFullContext>>,
  velocity: ReturnType<typeof computeRaiseVelocity>,
  narrativeScore: number,
  readiness: number,
  recommendations: StrategicRecommendation[],
): string {
  const activeCount = ctx.pipelineHealth.totalActive;
  const advancedCount = (ctx.pipelineHealth.byStatus['engaged'] || 0)
    + (ctx.pipelineHealth.byStatus['in_dd'] || 0)
    + (ctx.pipelineHealth.byStatus['term_sheet'] || 0)
    + (ctx.pipelineHealth.byStatus['closed'] || 0);

  // Sentence 1: Pipeline state
  let s1: string;
  if (advancedCount >= 3) {
    s1 = `Strong pipeline: ${activeCount} active investors with ${advancedCount} in advanced stages (engaged/DD/term sheet).`;
  } else if (activeCount >= 5) {
    s1 = `Building pipeline: ${activeCount} active investors, ${advancedCount} in advanced stages — need to convert more to DD.`;
  } else {
    s1 = `Thin pipeline: only ${activeCount} active investors with ${advancedCount} advanced — pipeline expansion is the top priority.`;
  }

  // Sentence 2: Momentum + narrative
  let s2: string;
  if (velocity.trend === 'accelerating' && narrativeScore >= 60) {
    s2 = `Momentum is accelerating (${velocity.meetingsPerWeek} meetings/week) and narrative is strong (${narrativeScore}/100).`;
  } else if (velocity.trend === 'decelerating') {
    s2 = `Warning: momentum is decelerating (${velocity.meetingsPerWeek} meetings/week) — need to increase activity pace immediately.`;
  } else {
    s2 = `Steady pace at ${velocity.meetingsPerWeek} meetings/week; narrative health at ${narrativeScore}/100${narrativeScore < 50 ? ' — needs improvement' : ''}.`;
  }

  // Sentence 3: Top priority
  const topRec = recommendations[0];
  const s3 = topRec
    ? `Top priority: ${topRec.title.toLowerCase()} (deadline: ${topRec.deadline.toLowerCase()}).`
    : `Readiness score: ${readiness}/100 — maintain current trajectory.`;

  return `${s1} ${s2} ${s3}`;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const ctx = await getFullContext();

    // Compute all strategic metrics
    const velocity = computeRaiseVelocity(ctx);
    const narrativeScore = computeNarrativeHealth(ctx);
    const concentration = computePipelineConcentration(ctx);
    const readiness = computeReadiness(ctx, narrativeScore, concentration);
    const recommendations = generateRecommendations(ctx, velocity, narrativeScore, concentration, readiness);
    const ceoBrief = generateCEOBrief(ctx, velocity, narrativeScore, readiness, recommendations);

    // Pipeline score: combination of breadth, advancement, and enthusiasm
    const pipelineScore = Math.round(
      Math.min(40, ctx.pipelineHealth.totalActive * 4) +
      Math.min(40, ((ctx.pipelineHealth.byStatus['engaged'] || 0)
        + (ctx.pipelineHealth.byStatus['in_dd'] || 0)
        + (ctx.pipelineHealth.byStatus['term_sheet'] || 0)) * 10) +
      Math.min(20, ctx.pipelineHealth.avgEnthusiasm * 4)
    );

    // Get historical snapshots for trend display
    let historicalSnapshots: { date: string; pipelineScore: number; narrativeScore: number; readinessScore: number; velocity: number; activeInvestors: number }[] = [];
    try {
      const snapshots = await getHealthSnapshots(30);
      historicalSnapshots = snapshots.map(s => ({
        date: s.snapshot_date,
        pipelineScore: s.pipeline_score,
        narrativeScore: s.narrative_score,
        readinessScore: s.readiness_score,
        velocity: s.velocity,
        activeInvestors: s.active_investors,
      }));
    } catch { /* non-blocking */ }

    // Non-blocking: store today's snapshot if not already stored
    try {
      const recentSnapshots = await getHealthSnapshots(1);
      const today = new Date().toISOString().split('T')[0];
      if (!recentSnapshots.length || recentSnapshots[0].snapshot_date !== today) {
        saveHealthSnapshot({
          pipelineScore: Math.min(100, pipelineScore),
          narrativeScore,
          readinessScore: readiness,
          velocity: velocity.meetingsPerWeek,
          activeInvestors: ctx.pipelineHealth.totalActive,
          strategicSummary: ceoBrief,
        }).catch(() => {});
      }
    } catch { /* non-blocking */ }

    const assessment: StrategicAssessment = {
      ceoBrief,
      raiseVelocity: velocity,
      narrativeHealthScore: narrativeScore,
      pipelineConcentrationRisk: concentration,
      fundraiseReadinessScore: readiness,
      recommendations,
      healthSnapshot: {
        pipelineScore: Math.min(100, pipelineScore),
        narrativeScore,
        readinessScore: readiness,
        velocity: velocity.meetingsPerWeek,
        activeInvestors: ctx.pipelineHealth.totalActive,
      },
      historicalSnapshots,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(assessment);
  } catch (error) {
    console.error('Strategic assessment error:', error);
    return NextResponse.json(
      { error: 'Failed to compute strategic assessment', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

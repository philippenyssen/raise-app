import { NextResponse } from 'next/server';
import { getFullContext } from '@/lib/context-bus';
import { saveHealthSnapshot, getHealthSnapshots, computeTemporalTrends, computeRaiseForecast } from '@/lib/db';
import type { TemporalTrends, RaiseForecast } from '@/lib/db';
import { MS_PER_DAY } from '@/lib/time';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StrategicRecommendation { priority: 1 | 2 | 3 | 4 | 5; category: 'pipeline' | 'narrative' | 'execution' | 'timing' | 'risk'; title: string; rationale: string; action: string; expectedImpact: string; deadline: string }

interface StrategicAssessment {
  ceoBrief: string;
  raiseVelocity: { meetingsPerWeek: number; stageAdvancesPerWeek: number; trend: 'accelerating' | 'steady' | 'decelerating' };
  narrativeHealthScore: number;
  pipelineConcentrationRisk: number;
  fundraiseReadinessScore: number;
  recommendations: StrategicRecommendation[];
  healthSnapshot: { pipelineScore: number; narrativeScore: number; readinessScore: number; velocity: number; activeInvestors: number };
  historicalSnapshots: { date: string; pipelineScore: number; narrativeScore: number; readinessScore: number; velocity: number; activeInvestors: number }[];
  temporalTrends: TemporalTrends | null;
  raiseForecast: { expectedCloseDate: string; confidence: string; criticalPath: string[]; nearestClose: { name: string; days: number; stage: string } | null; riskFactors: string[]; investorForecasts: { name: string; stage: string; days: number; confidence: string }[] } | null;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Metric computation helpers
// ---------------------------------------------------------------------------

function computeRaiseVelocity(ctx: Awaited<ReturnType<typeof getFullContext>>): { meetingsPerWeek: number; stageAdvancesPerWeek: number; trend: 'accelerating' | 'steady' | 'decelerating' } {
  const now = Date.now();
  const twoWeeksAgo = now - 14 * MS_PER_DAY;
  const fourWeeksAgo = now - 28 * MS_PER_DAY;

  let recentMeetings = 0, olderMeetings = 0, recentAdvances = 0, olderAdvances = 0;

  for (const entry of ctx.recentActivity) {
    const tsMatch = entry.match(/^\[([\d-T:.Z+]+)\]/);
    if (!tsMatch) continue;
    const ts = new Date(tsMatch[1]).getTime();
    if (isNaN(ts)) continue;
    const isRecent = ts >= twoWeeksAgo, isOlder = ts >= fourWeeksAgo && ts < twoWeeksAgo;

    if (entry.toLowerCase().includes('meeting') || entry.toLowerCase().includes('met ')) {
      if (isRecent) recentMeetings++;
      else if (isOlder) olderMeetings++;
    }
    if (entry.toLowerCase().includes('moved to') || entry.toLowerCase().includes('status')) {
      if (isRecent) recentAdvances++;
      else if (isOlder) olderAdvances++;
    }}

  const meetingsPerWeek = Math.round((recentMeetings / 2) * 10) / 10;
  const stageAdvancesPerWeek = Math.round((recentAdvances / 2) * 10) / 10;

  let trend: 'accelerating' | 'steady' | 'decelerating' = 'steady';
  const recentActivity = recentMeetings + recentAdvances, olderActivity = olderMeetings + olderAdvances;
  if (olderActivity > 0) {
    const ratio = recentActivity / olderActivity;
    if (ratio > 1.3) trend = 'accelerating';
    else if (ratio < 0.7) trend = 'decelerating';
  } else if (recentActivity > 0) trend = 'accelerating';

  if (ctx.pipelineFlow?.velocityTrend === 'accelerating' && trend === 'steady') trend = 'accelerating';
  else if (ctx.pipelineFlow?.velocityTrend === 'decelerating' && trend === 'steady') trend = 'decelerating';

  return { meetingsPerWeek, stageAdvancesPerWeek, trend };
}

function computeNarrativeHealth(ctx: Awaited<ReturnType<typeof getFullContext>>): number {
  let score = 70;
  for (const nw of ctx.narrativeWeaknesses) {
    if (nw.investorCount >= 3) score -= 15;
    else if (nw.investorCount >= 2) score -= 8;
  }
  if (ctx.objectionEvolution) {
    score -= ctx.objectionEvolution.persistent.length * 8;
    score += Math.min(15, ctx.objectionEvolution.resolvedCount * 3);
  }
  score -= ctx.narrativeDrift.filter(nd => nd.status === 'struggling').length * 10;
  score += Math.min(10, ctx.provenResponses.length * 3);
  if (ctx.pipelineHealth.avgEnthusiasm >= 4) score += 10;
  else if (ctx.pipelineHealth.avgEnthusiasm >= 3) score += 5;
  else if (ctx.pipelineHealth.avgEnthusiasm < 2.5) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function computePipelineConcentration(ctx: Awaited<ReturnType<typeof getFullContext>>): number {
  const activeInvestors = ctx.investors.filter(i => !['passed', 'dropped'].includes(i.status));
  if (activeInvestors.length <= 1) return 1;

  const statusWeights: Record<string, number> = { identified: 1, contacted: 2, nda_signed: 3, meeting_scheduled: 4, met: 5, engaged: 10, in_dd: 20, term_sheet: 40, closed: 50 };
  const tierMultipliers: Record<number, number> = { 1: 4, 2: 2, 3: 1, 4: 0.5 };
  const values = activeInvestors.map(inv => (statusWeights[inv.status] ?? 1) * (tierMultipliers[inv.tier] ?? 1) * Math.max(1, inv.enthusiasm));
  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  return Math.round(values.reduce((s, v) => s + Math.pow(v / total, 2), 0) * 100) / 100;
}

function computeReadiness(ctx: Awaited<ReturnType<typeof getFullContext>>, narrativeScore: number, concentration: number): number {
  let score = 0;
  const activeCount = ctx.pipelineHealth.totalActive;
  const advancedCount = (ctx.pipelineHealth.byStatus['engaged'] || 0) + (ctx.pipelineHealth.byStatus['in_dd'] || 0) + (ctx.pipelineHealth.byStatus['term_sheet'] || 0);
  score += Math.min(15, activeCount * 1.5) + Math.min(15, advancedCount * 5);
  score += (narrativeScore / 100) * 25;
  score += Math.max(0, 20 - (ctx.pipelineHealth.overdueFollowups / Math.max(1, activeCount)) * 40);
  score += Math.min(15, ctx.documents.length * 2);
  score += (1 - concentration) * 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function generateRecommendations(ctx: Awaited<ReturnType<typeof getFullContext>>, velocity: ReturnType<typeof computeRaiseVelocity>, narrativeScore: number, concentration: number, readiness: number): StrategicRecommendation[] {
  const recs: StrategicRecommendation[] = [];

  if (velocity.trend === 'decelerating') recs.push({ priority: 1, category: 'pipeline', title: 'Pipeline momentum is slowing down', rationale: `Meetings/week: ${velocity.meetingsPerWeek}, stage advances/week: ${velocity.stageAdvancesPerWeek}. The pace is decelerating compared to the prior period. In fundraising, loss of momentum is the #1 killer.`, action: 'Schedule 3+ new investor meetings this week. Re-engage stalled conversations with a milestone update. Create urgency with competitive timing signals.', expectedImpact: 'Reversing deceleration typically yields 2-3x increase in conversion rates within 2 weeks.', deadline: 'This week' });

  if (narrativeScore < 50) {
    const weakTopics = ctx.narrativeWeaknesses.map(nw => `"${nw.topic}"`).join(', ');
    recs.push({ priority: narrativeScore < 30 ? 1 : 2, category: 'narrative', title: 'Narrative needs urgent strengthening', rationale: `Narrative health is ${narrativeScore}/100. Weak areas: ${weakTopics || 'general narrative not resonating'}. ${ctx.narrativeDrift.filter(nd => nd.status === 'struggling').length} investor types are struggling.`, action: 'Review and strengthen pitch materials on flagged topics. Develop type-specific pitch variants for struggling investor segments. Use proven responses from the playbook.', expectedImpact: 'Addressing narrative gaps typically lifts enthusiasm by 0.5-1.0 points across pipeline.', deadline: 'Within 3 days' });
  }

  if (concentration > 0.35) recs.push({ priority: 2, category: 'risk', title: 'Pipeline too concentrated on few investors', rationale: `Herfindahl index: ${Math.round(concentration * 100)}%. A single pass from a top investor could derail the raise. Healthy fundraises have concentration below 25%.`, action: 'Add 5+ new investors to the pipeline, diversifying across types and tiers. Ensure no single investor represents more than 20% of expected close value.', expectedImpact: 'Reducing concentration below 25% gives the raise structural resilience.', deadline: 'Next 2 weeks' });

  if (ctx.pipelineHealth.overdueFollowups > 2) recs.push({ priority: ctx.pipelineHealth.overdueFollowups > 5 ? 1 : 3, category: 'execution', title: `${ctx.pipelineHealth.overdueFollowups} overdue follow-ups`, rationale: `Each day of delayed follow-up reduces close probability. ${ctx.pipelineHealth.overdueFollowups} pending items signal process breakdown to sophisticated investors.`, action: 'Block 2 hours today to clear all overdue follow-ups. Set up daily follow-up review cadence.', expectedImpact: 'Clearing overdue follow-ups prevents 10-15% probability erosion per stalled investor.', deadline: 'Today' });

  if (ctx.keystoneInvestors.length > 0) {
    const ki = ctx.keystoneInvestors[0];
    const kiInv = ctx.investors.find(i => i.id === ki.id);
    if (kiInv && !['engaged', 'in_dd', 'term_sheet'].includes(kiInv.status)) recs.push({ priority: 2, category: 'pipeline', title: `Accelerate keystone investor: ${ki.name}`, rationale: `${ki.name} is connected to ${ki.connectionCount} other pipeline investors with cascade value "${ki.cascadeValue}". Currently at "${kiInv.status}". Closing this investor creates a domino effect.`, action: `Prioritize ${ki.name} above other investors. Allocate 2x normal time and attention. Schedule a milestone-driven engagement within 48 hours.`, expectedImpact: `Potential to unlock ${ki.connectionCount} additional investors through network effects.`, deadline: 'This week' });
  }

  if (ctx.timingSignals.some(ts => ts.type === 'competitive_tension')) recs.push({ priority: 3, category: 'timing', title: 'Leverage competitive tension', rationale: 'Multiple investors are active simultaneously. This is the optimal moment to create urgency and drive toward term sheets.', action: 'Communicate (factually) that the process is competitive. Synchronize DD timelines where possible. Push advanced investors toward commitment.', expectedImpact: 'Competitive tension typically compresses timelines by 30-50% and improves terms.', deadline: 'Immediate' });

  if (ctx.objectionEvolution && ctx.objectionEvolution.emerging.length > 0) recs.push({ priority: 3, category: 'narrative', title: `New objections emerging: ${ctx.objectionEvolution.emerging.join(', ')}`, rationale: 'These objection topics are appearing in recent meetings and growing. If unaddressed, they will become persistent blockers.', action: 'Develop clear responses for each emerging objection. Update pitch materials to preemptively address them. Brief the team on approved responses.', expectedImpact: 'Proactively addressing emerging objections prevents them from becoming deal-breakers.', deadline: 'Before next investor meeting' });

  if (ctx.temporalTrends && ctx.temporalTrends.trends.length > 0) {
    const declining = ctx.temporalTrends.trends.filter(t => t.direction === 'declining');
    if (declining.length >= 3) recs.push({ priority: 1, category: 'risk', title: `${declining.length}/5 health metrics are declining`, rationale: `Declining: ${declining.map(t => `${t.metric} (${t.delta7d}% over 7d)`).join(', ')}. Multiple simultaneous declines indicate systemic momentum loss, not isolated issues.`, action: 'Conduct a strategic review today. Identify the root cause (market timing? execution gaps? narrative fatigue?) and implement a course correction within 48 hours.', expectedImpact: 'Early intervention on multi-metric decline prevents cascading deterioration that becomes irrecoverable.', deadline: 'Today' });

    const longStreaks = ctx.temporalTrends.trends.filter(t => t.direction === 'declining' && t.streak >= 4);
    for (const ls of longStreaks.slice(0, 1)) recs.push({ priority: 2, category: ls.metric.includes('Narrative') ? 'narrative' : ls.metric.includes('Pipeline') ? 'pipeline' : 'execution', title: `${ls.metric} declining for ${ls.streak} consecutive days`, rationale: `Current: ${ls.current}, was ${ls.avg7d} (7d avg). This sustained decline suggests a structural issue, not random fluctuation.`, action: `Investigate why ${ls.metric.toLowerCase()} keeps deteriorating. Check if a specific event triggered the decline and address the root cause.`, expectedImpact: `Reversing a ${ls.streak}-day decline requires targeted intervention, not more of the same.`, deadline: 'This week' });
  }

  if (ctx.raiseForecast) {
    const rf = ctx.raiseForecast;
    if (rf.confidence === 'low') recs.push({ priority: 2, category: 'pipeline', title: 'Close date forecast has low confidence', rationale: `Predicted close: ${rf.expectedCloseDate}, but confidence is LOW. ${rf.riskFactors.join('. ')}.`, action: 'Accelerate 2-3 investors to engaged/DD stage to improve forecast predictability. Focus on investors closest to advancing.', expectedImpact: 'Moving 2 investors to DD stage typically shifts forecast confidence from low to medium.', deadline: 'Next 2 weeks' });
    if (rf.nearestClose && rf.nearestClose.days > 60) recs.push({ priority: 3, category: 'timing', title: `Nearest close is ${rf.nearestClose.days} days away`, rationale: `${rf.nearestClose.name} at "${rf.nearestClose.stage}" is the closest to closing but predicted at ~${rf.nearestClose.days} days. No investor is near term sheet.`, action: 'Identify 1-2 investors who can be fast-tracked. Consider a "champion dinner" or site visit to compress timelines.', expectedImpact: 'Targeted acceleration can reduce close timeline by 30-50% for willing investors.', deadline: 'This week' });
  }

  const deceleratingT1T2 = ctx.engagementVelocity.filter(v => (v.acceleration === 'decelerating' || v.acceleration === 'gone_silent') && v.tier <= 2);
  if (deceleratingT1T2.length >= 2) recs.push({ priority: 1, category: 'pipeline', title: `${deceleratingT1T2.length} high-tier investors losing engagement momentum`, rationale: `${deceleratingT1T2.map(v => `${v.investorName} (T${v.tier}, ${v.acceleration})`).join(', ')} — meeting frequency is dropping for priority investors. This is an early warning of conversion failure.`, action: `Schedule direct re-engagement with each decelerating T1-2 investor within 48 hours. Bring new information or milestone to restart cadence.`, expectedImpact: 'Re-engaging within 48 hours of deceleration detection recovers 60-80% of at-risk deals.', deadline: 'This week' });

  if (ctx.networkCascades.length > 0) {
    const topCascade = ctx.networkCascades[0];
    if (topCascade.networkBottleneck) {
      const bottleneckInv = ctx.investors.find(i => i.id === topCascade.networkBottleneck!.investorId);
      if (bottleneckInv && bottleneckInv.stageHealth !== 'on_track') recs.push({ priority: 2, category: 'risk', title: `Network bottleneck at risk: ${topCascade.networkBottleneck.investorName}`, rationale: `${topCascade.networkBottleneck.investorName} is the bottleneck in ${topCascade.keystoneName}'s cascade chain (${topCascade.cascadeChain.length} downstream investors). Currently ${bottleneckInv.stageHealth}. If this investor passes, the cascade collapses.`, action: `Prioritize ${topCascade.networkBottleneck.investorName} above all others. Allocate CEO time directly. Remove blockers.`, expectedImpact: `Securing this bottleneck unlocks ${topCascade.cascadeChain.length} downstream closes through network effects.`, deadline: 'This week' });
    }}

  const highFomo = ctx.fomoDynamics.filter(f => f.fomoIntensity === 'high');
  if (highFomo.length > 0) recs.push({ priority: 2, category: 'timing', title: `FOMO window open: ${highFomo.length} high-intensity competitive trigger(s)`, rationale: `${highFomo.map(f => `${f.advancingInvestor} advancing to ${f.advancingTo}, affecting ${f.affectedInvestors.length} investors`).join('; ')}. Competitive pressure is at peak — this is a time-limited opportunity.`, action: `Contact affected investors within 24 hours with process update: "we're seeing strong momentum in the process." Don't name names but signal urgency.`, expectedImpact: 'FOMO-driven engagement typically compresses decision timelines by 40-60%.', deadline: 'Today' });

  recs.sort((a, b) => a.priority - b.priority);
  return recs.slice(0, 7);
}

function generateCEOBrief(ctx: Awaited<ReturnType<typeof getFullContext>>, velocity: ReturnType<typeof computeRaiseVelocity>, narrativeScore: number, readiness: number, recommendations: StrategicRecommendation[]): string {
  const activeCount = ctx.pipelineHealth.totalActive;
  const advancedCount = (ctx.pipelineHealth.byStatus['engaged'] || 0) + (ctx.pipelineHealth.byStatus['in_dd'] || 0) + (ctx.pipelineHealth.byStatus['term_sheet'] || 0) + (ctx.pipelineHealth.byStatus['closed'] || 0);

  const s1 = advancedCount >= 3 ? `Strong pipeline: ${activeCount} active investors with ${advancedCount} in advanced stages (engaged/DD/term sheet).` : activeCount >= 5 ? `Building pipeline: ${activeCount} active investors, ${advancedCount} in advanced stages — need to convert more to DD.` : `Thin pipeline: only ${activeCount} active investors with ${advancedCount} advanced — pipeline expansion is the top priority.`;
  const s2 = velocity.trend === 'accelerating' && narrativeScore >= 60 ? `Momentum is accelerating (${velocity.meetingsPerWeek} meetings/week) and narrative is strong (${narrativeScore}/100).` : velocity.trend === 'decelerating' ? `Warning: momentum is decelerating (${velocity.meetingsPerWeek} meetings/week) — need to increase activity pace immediately.` : `Steady pace at ${velocity.meetingsPerWeek} meetings/week; narrative health at ${narrativeScore}/100${narrativeScore < 50 ? ' — needs improvement' : ''}.`;
  const topRec = recommendations[0];
  const s3 = topRec ? `Top priority: ${topRec.title.toLowerCase()} (deadline: ${topRec.deadline.toLowerCase()}).` : `Readiness score: ${readiness}/100 — maintain current trajectory.`;
  return `${s1} ${s2} ${s3}`;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const ctx = await getFullContext();
    const velocity = computeRaiseVelocity(ctx);
    const narrativeScore = computeNarrativeHealth(ctx);
    const concentration = computePipelineConcentration(ctx);
    const readiness = computeReadiness(ctx, narrativeScore, concentration);
    const recommendations = generateRecommendations(ctx, velocity, narrativeScore, concentration, readiness);
    const ceoBrief = generateCEOBrief(ctx, velocity, narrativeScore, readiness, recommendations);

    const pipelineScore = Math.round(Math.min(40, ctx.pipelineHealth.totalActive * 4) + Math.min(40, ((ctx.pipelineHealth.byStatus['engaged'] || 0) + (ctx.pipelineHealth.byStatus['in_dd'] || 0) + (ctx.pipelineHealth.byStatus['term_sheet'] || 0)) * 10) + Math.min(20, ctx.pipelineHealth.avgEnthusiasm * 4));

    let historicalSnapshots: { date: string; pipelineScore: number; narrativeScore: number; readinessScore: number; velocity: number; activeInvestors: number }[] = [];
    try {
      historicalSnapshots = (await getHealthSnapshots(30)).map(s => ({ date: s.snapshot_date, pipelineScore: s.pipeline_score, narrativeScore: s.narrative_score, readinessScore: s.readiness_score, velocity: s.velocity, activeInvestors: s.active_investors }));
    } catch (e) { console.error('[HEALTH_SNAPSHOTS]', e instanceof Error ? e.message : e); }

    let temporalTrends: TemporalTrends | null = null;
    try { temporalTrends = await computeTemporalTrends(); } catch (e) { console.error('[TEMPORAL_TRENDS]', e instanceof Error ? e.message : e); }

    let raiseForecastResult: RaiseForecast | null = null;
    try { raiseForecastResult = await computeRaiseForecast(); } catch (e) { console.error('[RAISE_FORECAST]', e instanceof Error ? e.message : e); }

    try {
      const recentSnapshots = await getHealthSnapshots(1);
      const today = new Date().toISOString().split('T')[0];
      if (!recentSnapshots.length || recentSnapshots[0].snapshot_date !== today) {
        saveHealthSnapshot({ pipelineScore: Math.min(100, pipelineScore), narrativeScore, readinessScore: readiness, velocity: velocity.meetingsPerWeek, activeInvestors: ctx.pipelineHealth.totalActive, strategicSummary: ceoBrief }).catch(e => console.error('[STRATEGIC_SNAPSHOT]', e instanceof Error ? e.message : e));
      }
    } catch (e) { console.error('[HEALTH_SNAPSHOT_SAVE]', e instanceof Error ? e.message : e); }

    const assessment: StrategicAssessment = {
      ceoBrief, raiseVelocity: velocity, narrativeHealthScore: narrativeScore, pipelineConcentrationRisk: concentration,
      fundraiseReadinessScore: readiness, recommendations,
      healthSnapshot: { pipelineScore: Math.min(100, pipelineScore), narrativeScore, readinessScore: readiness, velocity: velocity.meetingsPerWeek, activeInvestors: ctx.pipelineHealth.totalActive },
      historicalSnapshots, temporalTrends,
      raiseForecast: raiseForecastResult ? (() => {
        const nearest = raiseForecastResult.forecasts.length > 0 ? raiseForecastResult.forecasts.reduce((best, f) => f.predictedDaysToClose < best.predictedDaysToClose ? f : best) : null;
        return {
          expectedCloseDate: raiseForecastResult.expectedCloseDate, confidence: raiseForecastResult.confidence, criticalPath: raiseForecastResult.criticalPathInvestors,
          nearestClose: nearest ? { name: nearest.investorName, days: nearest.predictedDaysToClose, stage: nearest.currentStage } : null,
          riskFactors: raiseForecastResult.riskFactors,
          investorForecasts: raiseForecastResult.forecasts.slice(0, 10).map(f => ({ name: f.investorName, stage: f.currentStage, days: f.predictedDaysToClose, confidence: f.confidence })),
        };
      })() : null,
      generatedAt: new Date().toISOString(),};

    return NextResponse.json(assessment);
  } catch (error) {
    console.error('[STRATEGIC_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to compute strategic assessment' }, { status: 500 });
  }}

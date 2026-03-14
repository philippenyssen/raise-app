/**
 * Context Bus — Unified context propagation system.
 *
 * Every input event anywhere in the app calls contextBus.emit() with the event type.
 * This invalidates cached context and triggers downstream refresh.
 *
 * Every consumer (workspace AI, meeting briefs, reports) calls contextBus.getContext()
 * which returns the FULL fundraise context ordered by recency (most recent first).
 */

import {
  getRaiseConfig,
  getAllDocuments,
  getDataRoomContext,
  getIntelligenceContext,
  getAllInvestors,
  getMeetings,
  getAllTasks,
  getActivityLog,
  getFollowups,
  getObjectionPlaybook,
  getRevenueCommitments,
  getScoreSnapshots,
  getAccelerationActions,
  getQuestionPatterns,
  getCalibrationData,
  computeNarrativeSignals,
  getKeystoneInvestors,
  getAutoActionEffectiveness,
  computeObjectionEvolution,
  computePipelineFlow,
  detectCompoundSignals,
  computeTemporalTrends,
  computeRaiseForecast,
  getForecastCalibration,
  computeWinLossPatterns,
  detectScoreReversals,
  getPipelineRankings,
  computeMeetingDensity,
  detectFomoDynamics,
  computeEngagementVelocity,
  computeNetworkCascades,
} from './db';
import type { TemporalTrends, RaiseForecast, ForecastCalibration, WinLossPatterns, ScoreReversal, PipelineRanking, MeetingDensity, FomoDynamic, EngagementVelocity, NetworkCascade } from './db';

// ---------------------------------------------------------------------------
// Context version — monotonically increasing counter
// ---------------------------------------------------------------------------

let contextVersion = 0;
let lastBuildVersion = -1;
let cachedContext: FullContext | null = null;

export function getContextVersion(): number {
  return contextVersion;
}

/**
 * Emit a context change event. Call this after ANY write operation.
 * This invalidates the cached context so the next consumer gets fresh data.
 */
export function emitContextChange(source: ContextSource, detail?: string): void {
  contextVersion++;
  cachedContext = null; // invalidate

  // Track what changed for incremental consumers
  recentChanges.push({
    version: contextVersion,
    source,
    detail: detail || source,
    timestamp: new Date().toISOString(),
  });

  // Keep only last 50 changes
  if (recentChanges.length > 50) {
    recentChanges.splice(0, recentChanges.length - 50);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContextSource =
  | 'meeting_logged'
  | 'meeting_updated'
  | 'investor_created'
  | 'investor_updated'
  | 'document_created'
  | 'document_updated'
  | 'data_room_uploaded'
  | 'intelligence_added'
  | 'task_created'
  | 'task_updated'
  | 'followup_created'
  | 'followup_updated'
  | 'objection_updated'
  | 'settings_updated'
  | 'commitment_created'
  | 'commitment_updated'
  | 'acceleration_executed'
  | 'status_changed';

interface ContextChange {
  version: number;
  source: ContextSource;
  detail: string;
  timestamp: string;
}

interface InvestorSnapshot {
  id: string;
  name: string;
  type: string;
  tier: number;
  status: string;
  enthusiasm: number;
  partner: string;
  meetingCount: number;
  lastMeetingDate: string | null;
  lastMeetingEnthusiasm: number | null;
  unresolvedObjections: string[];
  pendingTasks: number;
  pendingFollowups: number;
  // Lifecycle intelligence (cycle 16)
  daysInCurrentStage: number;
  stageHealth: 'on_track' | 'slow' | 'stalled';
  daysSinceLastContact: number | null;
}

export interface FullContext {
  version: number;
  buildTimestamp: string;

  // Raise configuration
  raiseConfig: Record<string, unknown> | null;

  // Investor pipeline state (ordered by tier, then status advancement)
  investors: InvestorSnapshot[];

  // Recent activity (most recent first, last 30 entries)
  recentActivity: string[];

  // Recent changes to context (what triggered this refresh)
  recentChanges: ContextChange[];

  // Documents (titles + types for context, not full content)
  documents: { id: string; title: string; type: string; status: string; updatedAt: string }[];

  // Data room summary
  dataRoomSummary: string;

  // Intelligence summary
  intelligenceSummary: string;

  // Objection landscape
  topObjections: { topic: string; count: number; hasEffectiveResponse: boolean }[];

  // Revenue backlog
  backlogSummary: { totalCommitted: number; probabilityWeighted: number; count: number };

  // Pipeline health
  pipelineHealth: {
    totalActive: number;
    byStatus: Record<string, number>;
    byTier: Record<number, number>;
    avgEnthusiasm: number;
    overdueFollowups: number;
    pendingTasks: number;
  };

  // Acceleration alerts
  pendingAccelerations: number;

  // Cross-investor question convergence (narrative weakness signals)
  narrativeWeaknesses: {
    topic: string;
    questionCount: number;
    investorCount: number;
    investorNames: string[];
    suggestedAction: string;
  }[];

  // Prediction calibration metrics
  predictionCalibration: {
    brierScore: number;
    biasDirection: string;
    resolvedCount: number;
    calibrationNote: string;
  };

  // Narrative drift by investor type
  narrativeDrift: {
    investorType: string;
    avgEnthusiasm: number;
    conversionRate: number;
    topObjection: string;
    topQuestionTopic: string;
    sampleSize: number;
    status: 'effective' | 'struggling' | 'insufficient_data';
  }[];

  // Proven objection responses (best response per topic)
  provenResponses: {
    topic: string;
    bestResponse: string;
    avgEnthusiasmLift: number;
    timesUsed: number;
  }[];

  // Keystone investors — closing one unlocks others via network effects
  keystoneInvestors: {
    id: string;
    name: string;
    connectionCount: number;
    cascadeValue: string;
  }[];

  // Timing signals from cross-investor timing correlation analysis
  timingSignals: {
    type: 'competitive_tension' | 'engagement_gap' | 'dd_synchronization';
    description: string;
    investorNames: string[];
    urgency: 'high' | 'medium' | 'low';
  }[];

  // Monte Carlo confidence intervals from stress test
  monteCarlo: {
    p10: number;
    p50: number;
    p90: number;
    probOfTarget: number;
  } | null;

  // Action effectiveness — what's working and what's not (learning intelligence)
  actionEffectiveness: {
    overallAvgLift: number;
    bestActionType: string;
    worstActionType: string;
    totalMeasured: number;
  } | null;

  // Objection evolution — temporal intelligence on how objections change (cycle 10)
  objectionEvolution: {
    emerging: string[];
    persistent: string[];
    resolvedCount: number;
  } | null;

  // Pipeline flow — stage bottlenecks and velocity (cycle 10)
  pipelineFlow: {
    bottleneckStage: string;
    velocityTrend: string;
    avgDaysToClose: number;
  } | null;

  // Strategic health — consolidated fundraise health metrics (cycle 11)
  strategicHealth: {
    readinessScore: number;
    narrativeScore: number;
    pipelineConcentration: number; // 0=diversified, 1=concentrated
    velocityTrend: string;
  } | null;

  // Compound intelligence signals — cross-signal correlation (cycle 13)
  compoundSignals: {
    signal: string;
    sources: string[];
    confidence: string;
    recommendation: string;
  }[];

  // Temporal intelligence — health trend analysis (cycle 14)
  temporalTrends: TemporalTrends | null;

  // Close date forecasting — investor timeline prediction (cycle 18)
  raiseForecast: {
    expectedCloseDate: string;
    confidence: string;
    criticalPath: string[];
    riskFactors: string[];
    nearestClose: { name: string; days: number; stage: string } | null;
  } | null;

  // Forecast calibration — learning from outcomes (cycle 23)
  forecastCalibration: ForecastCalibration | null;

  // Win/loss pattern analysis — what distinguishes closers from passers (cycle 25)
  winLossPatterns: WinLossPatterns | null;

  // Score reversals — significant drops in investor scores (cycle 26)
  scoreReversals: ScoreReversal[];

  // Pipeline rankings — comparative investor ranking with movement (cycle 26)
  pipelineRankings: PipelineRanking[];

  // Meeting density — engagement distribution analysis (cycle 27)
  meetingDensity: MeetingDensity | null;

  // FOMO dynamics — competitive pressure from advancing investors (cycle 27)
  fomoDynamics: FomoDynamic[];

  // Engagement velocity — per-investor meeting frequency acceleration (cycle 29)
  engagementVelocity: EngagementVelocity[];

  // Network cascade intelligence (cycle 32)
  networkCascades: NetworkCascade[];
}

const recentChanges: ContextChange[] = [];

// ---------------------------------------------------------------------------
// Build full context (with caching)
// ---------------------------------------------------------------------------

export async function getFullContext(): Promise<FullContext> {
  // Return cached if version hasn't changed
  if (cachedContext && lastBuildVersion === contextVersion) {
    return cachedContext;
  }

  // Build fresh context from ALL data sources
  const [
    raiseConfig,
    allDocs,
    dataRoomContext,
    intelligenceContext,
    investors,
    allMeetings,
    tasks,
    activity,
    followups,
    playbook,
    commitmentsData,
    accelerations,
    questionPatterns,
    calibrationData,
    narrativeSignals,
    keystoneInvestorsData,
    actionEffectivenessData,
    objectionEvolutionData,
    pipelineFlowData,
    compoundSignalsData,
    temporalTrendsData,
    raiseForecastData,
    forecastCalibrationData,
    winLossPatternsData,
    scoreReversalsData,
    pipelineRankingsData,
    meetingDensityData,
    fomoDynamicsData,
    engagementVelocityData,
    networkCascadesData,
  ] = await Promise.all([
    getRaiseConfig().catch(() => null),
    getAllDocuments().catch(() => []),
    getDataRoomContext().catch(() => ''),
    getIntelligenceContext().catch(() => ''),
    getAllInvestors().catch(() => []),
    getMeetings().catch(() => []),
    getAllTasks().catch(() => []),
    getActivityLog(30).catch(() => []),
    getFollowups().catch(() => []),
    getObjectionPlaybook().catch(() => []),
    getRevenueCommitments().catch(() => []),
    getAccelerationActions().catch(() => []),
    getQuestionPatterns().catch(() => []),
    getCalibrationData().catch(() => ({ totalPredictions: 0, resolvedPredictions: 0, brierScore: 0, biasDirection: 'insufficient_data', byStatus: [] })),
    computeNarrativeSignals().catch(() => []),
    getKeystoneInvestors().catch(() => []),
    getAutoActionEffectiveness().catch(() => null),
    computeObjectionEvolution().catch(() => null),
    computePipelineFlow().catch(() => null),
    detectCompoundSignals().catch(() => []),
    computeTemporalTrends().catch(() => null),
    computeRaiseForecast().catch(() => null),
    getForecastCalibration().catch(() => null),
    computeWinLossPatterns().catch(() => null),
    detectScoreReversals().catch(() => []),
    getPipelineRankings().catch(() => []),
    computeMeetingDensity().catch(() => null),
    detectFomoDynamics().catch(() => []),
    computeEngagementVelocity().catch(() => []),
    computeNetworkCascades().catch(() => []),
  ]);

  // Build investor snapshots enriched with meeting/task/followup data
  type MeetingRow = { id: string; investor_id: string; date: string; enthusiasm_score: number; objections: string; type: string };
  const meetingsByInvestor: Record<string, MeetingRow[]> = {};
  for (const m of allMeetings as MeetingRow[]) {
    if (!meetingsByInvestor[m.investor_id]) meetingsByInvestor[m.investor_id] = [];
    meetingsByInvestor[m.investor_id].push(m);
  }

  const tasksByInvestor: Record<string, number> = {};
  for (const t of tasks as Array<{ investor_id: string; status: string }>) {
    if (t.investor_id && (t.status === 'pending' || t.status === 'in_progress')) {
      tasksByInvestor[t.investor_id] = (tasksByInvestor[t.investor_id] || 0) + 1;
    }
  }

  const followupsByInvestor: Record<string, number> = {};
  for (const f of followups as Array<{ investor_id: string; status: string }>) {
    if (f.investor_id && f.status === 'pending') {
      followupsByInvestor[f.investor_id] = (followupsByInvestor[f.investor_id] || 0) + 1;
    }
  }

  // Stage health thresholds: expected max days in each stage before it's "slow" or "stalled"
  const stageThresholds: Record<string, { slow: number; stalled: number }> = {
    identified: { slow: 14, stalled: 30 },
    contacted: { slow: 10, stalled: 21 },
    nda_signed: { slow: 7, stalled: 14 },
    meeting_scheduled: { slow: 14, stalled: 28 },
    met: { slow: 14, stalled: 30 },
    engaged: { slow: 21, stalled: 45 },
    in_dd: { slow: 30, stalled: 60 },
    term_sheet: { slow: 21, stalled: 45 },
  };

  type InvRow = { id: string; name: string; type: string; tier: number; status: string; enthusiasm: number; partner: string; updated_at?: string; created_at?: string };
  const investorSnapshots: InvestorSnapshot[] = (investors as InvRow[])
    .filter(i => !['passed', 'dropped'].includes(i.status))
    .map(inv => {
      const meetings = meetingsByInvestor[inv.id] || [];
      const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
      const latest = sorted[0];

      // Extract unresolved objections
      const objections: string[] = [];
      for (const m of meetings) {
        try {
          const objs = JSON.parse(m.objections || '[]') as Array<{ text?: string; severity?: string; resolved?: boolean }>;
          for (const o of objs) {
            if (!o.resolved && o.text) objections.push(o.text);
          }
        } catch { /* skip */ }
      }

      // Lifecycle intelligence (cycle 16)
      const now = Date.now();
      const msPerDay = 1000 * 60 * 60 * 24;

      // Days in current stage: use updated_at as proxy for when they entered current stage
      const stageEntryDate = inv.updated_at || inv.created_at || new Date().toISOString();
      const daysInCurrentStage = Math.max(0, Math.round((now - new Date(stageEntryDate).getTime()) / msPerDay));

      // Stage health: compare days in stage to thresholds
      const thresholds = stageThresholds[inv.status] || { slow: 21, stalled: 45 };
      let stageHealth: 'on_track' | 'slow' | 'stalled' = 'on_track';
      if (daysInCurrentStage >= thresholds.stalled) stageHealth = 'stalled';
      else if (daysInCurrentStage >= thresholds.slow) stageHealth = 'slow';

      // Days since last contact
      const daysSinceLastContact = latest ? Math.round((now - new Date(latest.date).getTime()) / msPerDay) : null;

      return {
        id: inv.id,
        name: inv.name,
        type: inv.type,
        tier: inv.tier,
        status: inv.status,
        enthusiasm: latest?.enthusiasm_score ?? inv.enthusiasm,
        partner: inv.partner || '',
        meetingCount: meetings.length,
        lastMeetingDate: latest?.date || null,
        lastMeetingEnthusiasm: latest?.enthusiasm_score ?? null,
        unresolvedObjections: objections.slice(0, 3), // top 3
        pendingTasks: tasksByInvestor[inv.id] || 0,
        pendingFollowups: followupsByInvestor[inv.id] || 0,
        daysInCurrentStage,
        stageHealth,
        daysSinceLastContact,
      };
    })
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      const statusOrder: Record<string, number> = {
        term_sheet: 0, in_dd: 1, engaged: 2, met: 3,
        meeting_scheduled: 4, nda_signed: 5, contacted: 6, identified: 7,
      };
      return (statusOrder[a.status] ?? 8) - (statusOrder[b.status] ?? 8);
    });

  // Pipeline health
  const activeInvestors = investorSnapshots;
  const byStatus: Record<string, number> = {};
  const byTier: Record<number, number> = {};
  let totalEnthusiasm = 0;
  for (const inv of activeInvestors) {
    byStatus[inv.status] = (byStatus[inv.status] || 0) + 1;
    byTier[inv.tier] = (byTier[inv.tier] || 0) + 1;
    totalEnthusiasm += inv.enthusiasm;
  }

  const overdueFollowups = (followups as Array<{ status: string; due_at: string }>)
    .filter(f => f.status === 'pending' && new Date(f.due_at) < new Date()).length;
  const pendingTaskCount = (tasks as Array<{ status: string }>)
    .filter(t => t.status === 'pending' || t.status === 'in_progress').length;

  // Revenue backlog summary
  const activeCommitments = (commitmentsData as Array<{ status: string; amount_eur: number; confidence: number }>)
    .filter(c => c.status === 'active');

  // Top objections
  const topObjections = (playbook as Array<{ topic: string; count: number; has_effective_response: boolean }>)
    .slice(0, 5)
    .map(p => ({ topic: p.topic, count: p.count, hasEffectiveResponse: !!p.has_effective_response }));

  // Recent activity (most recent first)
  const recentActivityStrings = (activity as Array<{ subject: string; detail: string; created_at: string; investor_name: string }>)
    .map(a => `[${a.created_at}] ${a.subject}${a.investor_name ? ` (${a.investor_name})` : ''}${a.detail ? `: ${a.detail}` : ''}`);

  // Pending accelerations
  const pendingAccelerations = (accelerations as Array<{ status: string }>)
    .filter(a => a.status === 'pending').length;

  const context: FullContext = {
    version: contextVersion,
    buildTimestamp: new Date().toISOString(),
    raiseConfig: raiseConfig as Record<string, unknown> | null,
    investors: investorSnapshots,
    recentActivity: recentActivityStrings,
    recentChanges: [...recentChanges].reverse().slice(0, 10),
    documents: (allDocs as Array<{ id: string; title: string; type: string; status: string; updated_at: string }>)
      .map(d => ({ id: d.id, title: d.title, type: d.type, status: d.status, updatedAt: d.updated_at })),
    dataRoomSummary: dataRoomContext.substring(0, 3000),
    intelligenceSummary: intelligenceContext.substring(0, 3000),
    topObjections,
    backlogSummary: {
      totalCommitted: activeCommitments.reduce((s, c) => s + c.amount_eur, 0),
      probabilityWeighted: activeCommitments.reduce((s, c) => s + c.amount_eur * c.confidence, 0),
      count: activeCommitments.length,
    },
    pipelineHealth: {
      totalActive: activeInvestors.length,
      byStatus,
      byTier,
      avgEnthusiasm: activeInvestors.length > 0 ? Math.round((totalEnthusiasm / activeInvestors.length) * 10) / 10 : 0,
      overdueFollowups,
      pendingTasks: pendingTaskCount,
    },
    pendingAccelerations,

    // Narrative weaknesses from cross-investor question convergence
    narrativeWeaknesses: (questionPatterns as Array<{ topic: string; questionCount: number; investorCount: number; investorNames: string[]; recentQuestions: string[] }>)
      .filter(qp => qp.investorCount >= 2) // convergence = 2+ investors asking same topic
      .slice(0, 5)
      .map(qp => ({
        topic: qp.topic,
        questionCount: qp.questionCount,
        investorCount: qp.investorCount,
        investorNames: qp.investorNames.slice(0, 5),
        suggestedAction: qp.investorCount >= 3
          ? `CRITICAL: ${qp.investorCount} investors questioning "${qp.topic}" — narrative needs urgent strengthening`
          : `WARNING: ${qp.investorCount} investors questioning "${qp.topic}" — consider reinforcing this area`,
      })),

    // Prediction calibration
    predictionCalibration: {
      brierScore: (calibrationData as { brierScore: number }).brierScore,
      biasDirection: (calibrationData as { biasDirection: string }).biasDirection,
      resolvedCount: (calibrationData as { resolvedPredictions: number }).resolvedPredictions,
      calibrationNote: (calibrationData as { biasDirection: string }).biasDirection === 'over_confident'
        ? 'Our predictions have been systematically over-confident. Treat probabilities with skepticism.'
        : (calibrationData as { biasDirection: string }).biasDirection === 'under_confident'
        ? 'Our predictions have been conservative. Actual outcomes have been better than predicted.'
        : (calibrationData as { resolvedPredictions: number }).resolvedPredictions < 5
        ? 'Insufficient resolved predictions for calibration. Treat probabilities as rough estimates.'
        : 'Predictions are reasonably calibrated.',
    },

    // Narrative drift by investor type
    narrativeDrift: (narrativeSignals as Array<{ investorType: string; avgEnthusiasm: number; conversionRate: number; topObjection: string; topQuestionTopic: string; sampleSize: number }>)
      .map(ns => ({
        ...ns,
        status: (ns.sampleSize < 2 ? 'insufficient_data' : ns.avgEnthusiasm < 2.5 || ns.conversionRate < 20 ? 'struggling' : 'effective') as 'effective' | 'struggling' | 'insufficient_data',
      })),

    // Proven responses (from objection playbook with effectiveness data)
    provenResponses: (playbook as Array<{ topic: string; count: number; has_effective_response: boolean; best_response?: string; avg_lift?: number }>)
      .filter(p => p.has_effective_response && p.best_response)
      .slice(0, 5)
      .map(p => ({
        topic: p.topic,
        bestResponse: p.best_response || '',
        avgEnthusiasmLift: p.avg_lift || 0,
        timesUsed: p.count,
      })),

    // Keystone investors (closing one unlocks others)
    keystoneInvestors: (keystoneInvestorsData as Array<{ id: string; name: string; connectionCount: number; cascadeValue: string }>)
      .filter(k => k.cascadeValue !== 'minimal')
      .slice(0, 5)
      .map(k => ({
        id: k.id,
        name: k.name,
        connectionCount: k.connectionCount,
        cascadeValue: k.cascadeValue,
      })),

    // Timing signals — populated by momentum route, not fetched here (too expensive)
    timingSignals: [],

    // Monte Carlo — populated by stress test response, not fetched in bus
    monteCarlo: null,

    // Action effectiveness — learning intelligence
    actionEffectiveness: actionEffectivenessData ? {
      overallAvgLift: (actionEffectivenessData as { overallAvgLift: number }).overallAvgLift,
      bestActionType: (actionEffectivenessData as { ruleEffectiveness: Array<{ actionType: string }> }).ruleEffectiveness.length > 0
        ? (actionEffectivenessData as { ruleEffectiveness: Array<{ actionType: string; avgLift: number }> }).ruleEffectiveness.sort((a, b) => b.avgLift - a.avgLift)[0].actionType
        : 'none',
      worstActionType: (actionEffectivenessData as { ruleEffectiveness: Array<{ actionType: string }> }).ruleEffectiveness.length > 0
        ? (actionEffectivenessData as { ruleEffectiveness: Array<{ actionType: string; avgLift: number }> }).ruleEffectiveness.sort((a, b) => a.avgLift - b.avgLift)[0].actionType
        : 'none',
      totalMeasured: (actionEffectivenessData as { ruleEffectiveness: Array<{ count: number }> }).ruleEffectiveness.reduce((s, r) => s + r.count, 0),
    } : null,

    // Objection evolution — temporal objection intelligence (cycle 10)
    objectionEvolution: objectionEvolutionData ? {
      emerging: (objectionEvolutionData as { emergingObjections: Array<{ topic: string }> }).emergingObjections.map(e => e.topic),
      persistent: (objectionEvolutionData as { persistentObjections: Array<{ topic: string }> }).persistentObjections.map(p => p.topic),
      resolvedCount: (objectionEvolutionData as { resolvedObjections: Array<unknown> }).resolvedObjections.length,
    } : null,

    // Strategic health — populated by strategic assessment route, not fetched in bus (cycle 11)
    strategicHealth: null,

    // Compound intelligence signals — cross-signal correlation (cycle 13)
    compoundSignals: (compoundSignalsData as Array<{ signal: string; sources: string[]; confidence: string; recommendation: string }>)
      .map(cs => ({
        signal: cs.signal,
        sources: cs.sources,
        confidence: cs.confidence,
        recommendation: cs.recommendation,
      })),

    // Temporal intelligence — health trend analysis (cycle 14)
    temporalTrends: (temporalTrendsData as TemporalTrends | null),

    // Pipeline flow — bottleneck and velocity intelligence (cycle 10)
    pipelineFlow: pipelineFlowData ? {
      bottleneckStage: (pipelineFlowData as { bottleneckStage: string }).bottleneckStage,
      velocityTrend: (pipelineFlowData as { velocityTrend: string }).velocityTrend,
      avgDaysToClose: (() => {
        const flow = pipelineFlowData as { avgDaysPerStage: Record<string, number> };
        const allDays = Object.values(flow.avgDaysPerStage).filter(d => d > 0);
        return allDays.length > 0 ? Math.round(allDays.reduce((a, b) => a + b, 0)) : 0;
      })(),
    } : null,

    // Raise forecast — close date prediction (cycle 18)
    raiseForecast: raiseForecastData ? (() => {
      const fd = raiseForecastData as RaiseForecast;
      const nearest = fd.forecasts.length > 0
        ? fd.forecasts.reduce((best, f) => f.predictedDaysToClose < best.predictedDaysToClose ? f : best)
        : null;
      return {
        expectedCloseDate: fd.expectedCloseDate,
        confidence: fd.confidence,
        criticalPath: fd.criticalPathInvestors,
        riskFactors: fd.riskFactors,
        nearestClose: nearest ? { name: nearest.investorName, days: nearest.predictedDaysToClose, stage: nearest.currentStage } : null,
      };
    })() : null,

    // Forecast calibration — learning from outcomes (cycle 23)
    forecastCalibration: (forecastCalibrationData as ForecastCalibration | null),

    // Win/loss pattern analysis (cycle 25)
    winLossPatterns: (winLossPatternsData as WinLossPatterns | null),

    // Score reversals and pipeline rankings (cycle 26)
    scoreReversals: (scoreReversalsData as ScoreReversal[]),
    pipelineRankings: (pipelineRankingsData as PipelineRanking[]),

    // Meeting density and FOMO dynamics (cycle 27)
    meetingDensity: (meetingDensityData as MeetingDensity | null),
    fomoDynamics: (fomoDynamicsData as FomoDynamic[]),

    // Engagement velocity (cycle 29)
    engagementVelocity: (engagementVelocityData as EngagementVelocity[]),
    networkCascades: (networkCascadesData as NetworkCascade[]),
  };

  cachedContext = context;
  lastBuildVersion = contextVersion;

  return context;
}

// ---------------------------------------------------------------------------
// Context serialization for AI system prompts
// ---------------------------------------------------------------------------

export function contextToSystemPrompt(ctx: FullContext): string {
  const lines: string[] = [];

  lines.push('=== FULL FUNDRAISE CONTEXT (auto-updated, most recent data takes precedence) ===');
  lines.push(`Context version: ${ctx.version} | Built: ${ctx.buildTimestamp}`);
  lines.push('');

  // Raise config
  if (ctx.raiseConfig) {
    lines.push('RAISE PARAMETERS:');
    const cfg = ctx.raiseConfig as Record<string, string>;
    if (cfg.company_name) lines.push(`Company: ${cfg.company_name}`);
    if (cfg.round_type) lines.push(`Round: ${cfg.round_type}`);
    if (cfg.equity_amount) lines.push(`Target equity: ${cfg.equity_amount}`);
    if (cfg.debt_amount) lines.push(`Target debt: ${cfg.debt_amount}`);
    if (cfg.pre_money_valuation) lines.push(`Pre-money: ${cfg.pre_money_valuation}`);
    if (cfg.target_close) lines.push(`Target close: ${cfg.target_close}`);
    lines.push('');
  }

  // Pipeline snapshot
  lines.push(`PIPELINE: ${ctx.pipelineHealth.totalActive} active investors`);
  lines.push(`Avg enthusiasm: ${ctx.pipelineHealth.avgEnthusiasm}/5`);
  lines.push(`Status: ${Object.entries(ctx.pipelineHealth.byStatus).map(([s, c]) => `${s}:${c}`).join(', ')}`);
  lines.push(`Tiers: ${Object.entries(ctx.pipelineHealth.byTier).map(([t, c]) => `T${t}:${c}`).join(', ')}`);
  if (ctx.pipelineHealth.overdueFollowups > 0) lines.push(`WARNING: ${ctx.pipelineHealth.overdueFollowups} overdue follow-ups`);
  if (ctx.pipelineHealth.pendingTasks > 0) lines.push(`Pending tasks: ${ctx.pipelineHealth.pendingTasks}`);
  if (ctx.pendingAccelerations > 0) lines.push(`Pending acceleration actions: ${ctx.pendingAccelerations}`);
  lines.push('');

  // Top investors (most advanced first)
  lines.push('KEY INVESTORS (by stage, most advanced first):');
  for (const inv of ctx.investors.slice(0, 15)) {
    let line = `- [T${inv.tier}] ${inv.name} (${inv.status}, enthusiasm ${inv.enthusiasm}/5)`;
    if (inv.partner) line += ` — partner: ${inv.partner}`;
    if (inv.meetingCount > 0) line += ` — ${inv.meetingCount} meetings`;
    if (inv.lastMeetingDate) line += `, last: ${inv.lastMeetingDate}`;
    // Lifecycle intelligence (cycle 16)
    if (inv.daysInCurrentStage > 0) {
      line += ` — ${inv.daysInCurrentStage}d in stage`;
      if (inv.stageHealth === 'stalled') line += ' [STALLED]';
      else if (inv.stageHealth === 'slow') line += ' [SLOW]';
    }
    if (inv.daysSinceLastContact !== null && inv.daysSinceLastContact > 14) {
      line += ` — ${inv.daysSinceLastContact}d since contact`;
    }
    if (inv.pendingTasks > 0) line += ` — ${inv.pendingTasks} pending tasks`;
    if (inv.unresolvedObjections.length > 0) line += ` — OBJECTIONS: ${inv.unresolvedObjections.join('; ')}`;
    lines.push(line);
  }
  // Lifecycle summary
  const stalledCount = ctx.investors.filter(i => i.stageHealth === 'stalled').length;
  const slowCount = ctx.investors.filter(i => i.stageHealth === 'slow').length;
  if (stalledCount > 0 || slowCount > 0) {
    lines.push(`LIFECYCLE: ${stalledCount} stalled, ${slowCount} slow — these investors need intervention or deprioritization`);
  }
  lines.push('');

  // Objection landscape
  if (ctx.topObjections.length > 0) {
    lines.push('TOP OBJECTIONS:');
    for (const obj of ctx.topObjections) {
      lines.push(`- "${obj.topic}" (×${obj.count})${obj.hasEffectiveResponse ? ' ✓ has effective response' : ' ✗ NO effective response'}`);
    }
    lines.push('');
  }

  // Revenue backlog
  if (ctx.backlogSummary.count > 0) {
    const fmtEur = (n: number) => n >= 1e9 ? `€${(n/1e9).toFixed(1)}Bn` : `€${(n/1e6).toFixed(0)}M`;
    lines.push(`REVENUE BACKLOG: ${fmtEur(ctx.backlogSummary.totalCommitted)} total, ${fmtEur(ctx.backlogSummary.probabilityWeighted)} probability-weighted (${ctx.backlogSummary.count} commitments)`);
    lines.push('');
  }

  // Documents
  if (ctx.documents.length > 0) {
    lines.push('DOCUMENTS:');
    for (const doc of ctx.documents) {
      lines.push(`- ${doc.title} (${doc.type}, ${doc.status}) — updated ${doc.updatedAt}`);
    }
    lines.push('');
  }

  // Recent activity (last 10, most recent first)
  if (ctx.recentActivity.length > 0) {
    lines.push('RECENT ACTIVITY (most recent first):');
    for (const a of ctx.recentActivity.slice(0, 10)) {
      lines.push(`  ${a}`);
    }
    lines.push('');
  }

  // Recent context changes
  if (ctx.recentChanges.length > 0) {
    lines.push('RECENT CONTEXT CHANGES:');
    for (const c of ctx.recentChanges.slice(0, 5)) {
      lines.push(`  [v${c.version}] ${c.timestamp}: ${c.source} — ${c.detail}`);
    }
    lines.push('');
  }

  // Narrative Health (cross-investor question convergence)
  if (ctx.narrativeWeaknesses.length > 0) {
    lines.push('NARRATIVE HEALTH (cross-investor question patterns):');
    for (const nw of ctx.narrativeWeaknesses) {
      lines.push(`- "${nw.topic}" questioned by ${nw.investorCount} investors (${nw.investorNames.join(', ')})`);
      lines.push(`  → ${nw.suggestedAction}`);
    }
    lines.push('');
  }

  // Narrative effectiveness by investor type
  if (ctx.narrativeDrift.length > 0) {
    lines.push('NARRATIVE EFFECTIVENESS BY INVESTOR TYPE:');
    for (const nd of ctx.narrativeDrift) {
      const statusIcon = nd.status === 'effective' ? '✓' : nd.status === 'struggling' ? '✗' : '?';
      lines.push(`- ${statusIcon} ${nd.investorType}: avg enthusiasm ${nd.avgEnthusiasm}/5, conversion ${nd.conversionRate}%, top objection: "${nd.topObjection}", top question: "${nd.topQuestionTopic}" (n=${nd.sampleSize})`);
    }
    const struggling = ctx.narrativeDrift.filter(nd => nd.status === 'struggling');
    if (struggling.length > 0) {
      lines.push(`WARNING: Narrative not landing with: ${struggling.map(s => s.investorType).join(', ')} — consider type-specific pitch adjustments`);
    }
    lines.push('');
  }

  // Proven objection responses
  if (ctx.provenResponses.length > 0) {
    lines.push('PROVEN OBJECTION RESPONSES (use these in conversations):');
    for (const pr of ctx.provenResponses) {
      lines.push(`- "${pr.topic}": ${pr.bestResponse} (avg +${pr.avgEnthusiasmLift} enthusiasm, used ${pr.timesUsed}x)`);
    }
    lines.push('');
  }

  // Prediction calibration
  if (ctx.predictionCalibration.resolvedCount > 0) {
    lines.push(`PREDICTION CALIBRATION: ${ctx.predictionCalibration.calibrationNote}`);
    lines.push(`Brier score: ${ctx.predictionCalibration.brierScore} | Bias: ${ctx.predictionCalibration.biasDirection} | Based on ${ctx.predictionCalibration.resolvedCount} resolved predictions`);
    lines.push('');
  }

  // Keystone investors (closing one unlocks others)
  if (ctx.keystoneInvestors.length > 0) {
    lines.push('KEYSTONE INVESTORS (closing one unlocks others):');
    for (const ki of ctx.keystoneInvestors) {
      lines.push(`- ${ki.name} → connected to ${ki.connectionCount} other investors in pipeline (cascade: ${ki.cascadeValue})`);
    }
    lines.push('');
  }

  // Monte Carlo forecast confidence intervals
  if (ctx.monteCarlo) {
    lines.push('MONTE CARLO FORECAST (1000 simulations):');
    lines.push(`P10 (pessimistic): €${ctx.monteCarlo.p10}M | P50 (median): €${ctx.monteCarlo.p50}M | P90 (optimistic): €${ctx.monteCarlo.p90}M`);
    lines.push(`Probability of reaching target: ${ctx.monteCarlo.probOfTarget}%`);
    lines.push('');
  }

  // Timing signals (cross-investor timing correlation)
  if (ctx.timingSignals && ctx.timingSignals.length > 0) {
    lines.push('TIMING SIGNALS (cross-investor timing patterns):');
    for (const ts of ctx.timingSignals) {
      const urgencyTag = ts.urgency === 'high' ? 'URGENT' : ts.urgency === 'medium' ? 'WATCH' : 'INFO';
      lines.push(`- [${urgencyTag}] ${ts.type}: ${ts.description}`);
      lines.push(`  Investors: ${ts.investorNames.join(', ')}`);
    }
    lines.push('');
  }

  // Action effectiveness (learning intelligence — what's working)
  if (ctx.actionEffectiveness && ctx.actionEffectiveness.totalMeasured > 0) {
    lines.push('ACTION EFFECTIVENESS (what\'s working):');
    lines.push(`- Best action type: ${ctx.actionEffectiveness.bestActionType} (highest avg lift)`);
    lines.push(`- Worst action type: ${ctx.actionEffectiveness.worstActionType} (lowest avg lift)`);
    lines.push(`- Overall avg lift: ${ctx.actionEffectiveness.overallAvgLift}`);
    lines.push(`- Based on ${ctx.actionEffectiveness.totalMeasured} measured outcomes`);
    lines.push('');
  }

  // Objection evolution (temporal objection intelligence)
  if (ctx.objectionEvolution) {
    const oe = ctx.objectionEvolution;
    if (oe.emerging.length > 0 || oe.persistent.length > 0 || oe.resolvedCount > 0) {
      lines.push('OBJECTION EVOLUTION (how objections are changing over time):');
      if (oe.emerging.length > 0) {
        lines.push(`- EMERGING (new/growing): ${oe.emerging.join(', ')} — these are appearing in recent meetings. Prepare responses proactively.`);
      }
      if (oe.persistent.length > 0) {
        lines.push(`- PERSISTENT (not going away): ${oe.persistent.join(', ')} — current responses are NOT working. Rethink approach for these topics.`);
      }
      if (oe.resolvedCount > 0) {
        lines.push(`- RESOLVED: ${oe.resolvedCount} objection topic(s) have stopped appearing — previous responses worked.`);
      }
      lines.push('');
    }
  }

  // Pipeline flow (bottleneck and velocity intelligence)
  if (ctx.pipelineFlow) {
    const pf = ctx.pipelineFlow;
    lines.push('PIPELINE FLOW:');
    lines.push(`- Bottleneck stage: "${pf.bottleneckStage}" — investors spend the most time here. Focus process improvement efforts on this stage.`);
    lines.push(`- Pipeline velocity: ${pf.velocityTrend}${pf.velocityTrend === 'decelerating' ? ' — WARNING: investors are taking longer to move through stages' : pf.velocityTrend === 'accelerating' ? ' — momentum is building, transitions are getting faster' : ' — stable pace'}`);
    if (pf.avgDaysToClose > 0) {
      lines.push(`- Sum of avg stage durations: ~${pf.avgDaysToClose} days`);
    }
    lines.push('');
  }

  // Strategic health (consolidated fundraise assessment)
  if (ctx.strategicHealth) {
    lines.push(`STRATEGIC HEALTH: Readiness ${ctx.strategicHealth.readinessScore}/100 | Narrative ${ctx.strategicHealth.narrativeScore}/100 | Concentration ${Math.round(ctx.strategicHealth.pipelineConcentration * 100)}% | Velocity: ${ctx.strategicHealth.velocityTrend}`);
    lines.push('');
  }

  // Compound intelligence signals (cross-signal correlation)
  if (ctx.compoundSignals && ctx.compoundSignals.length > 0) {
    lines.push('COMPOUND INTELLIGENCE SIGNALS (multiple sources converging):');
    for (const cs of ctx.compoundSignals) {
      const confTag = cs.confidence === 'very_high' ? 'VERY HIGH' : 'HIGH';
      lines.push(`- [${confTag}] ${cs.signal} (sources: ${cs.sources.join(', ')}) → ${cs.recommendation}`);
    }
    lines.push('');
  }

  // Temporal intelligence — health trends over time (cycle 14)
  if (ctx.temporalTrends && ctx.temporalTrends.trends.length > 0) {
    const tt = ctx.temporalTrends;
    lines.push(`TEMPORAL TRENDS (${tt.daysOfData} days of data, overall: ${tt.overallDirection}):`);
    for (const trend of tt.trends) {
      const dirIcon = trend.direction === 'improving' ? '\u2191' : trend.direction === 'declining' ? '\u2193' : '\u2192';
      let line = `- ${dirIcon} ${trend.metric}: ${trend.current} (7d avg: ${trend.avg7d}, ${trend.delta7d > 0 ? '+' : ''}${trend.delta7d}% | 30d avg: ${trend.avg30d}, ${trend.delta30d > 0 ? '+' : ''}${trend.delta30d}%)`;
      if (trend.streak >= 2) line += ` [${trend.streak}-day streak]`;
      lines.push(line);
      if (trend.alert) {
        lines.push(`  ALERT: ${trend.alert}`);
      }
    }
    lines.push('');
  }

  // Raise forecast — close date prediction (cycle 18)
  if (ctx.raiseForecast) {
    const rf = ctx.raiseForecast;
    lines.push(`RAISE FORECAST (predicted close: ${rf.expectedCloseDate}, confidence: ${rf.confidence}):`);
    if (rf.nearestClose) {
      lines.push(`- Nearest close: ${rf.nearestClose.name} (~${rf.nearestClose.days} days, at "${rf.nearestClose.stage}")`);
    }
    if (rf.criticalPath.length > 0) {
      lines.push(`- Critical path investors: ${rf.criticalPath.join(', ')}`);
    }
    if (rf.riskFactors.length > 0) {
      lines.push(`- Risk factors: ${rf.riskFactors.join('; ')}`);
    }
    lines.push('');
  }

  // Forecast calibration — learning from outcomes (cycle 23)
  if (ctx.forecastCalibration && ctx.forecastCalibration.totalPredictions > 0) {
    const fc = ctx.forecastCalibration;
    lines.push(`FORECAST CALIBRATION (${fc.totalPredictions} predictions, ${fc.resolvedPredictions} resolved, ${fc.closedPredictions} closed):`);
    if (fc.biasDirection !== 'insufficient_data') {
      lines.push(`- Bias: ${fc.biasDirection} (avg ${fc.avgAccuracyDelta > 0 ? '+' : ''}${fc.avgAccuracyDelta} days off)`);
      if (fc.biasDirection === 'optimistic') {
        lines.push(`  → Forecasts have been too aggressive — add ~${Math.abs(fc.avgAccuracyDelta)} days to predicted close dates`);
      } else if (fc.biasDirection === 'pessimistic') {
        lines.push(`  → Forecasts have been too conservative — investors are closing faster than predicted`);
      }
      if (fc.byConfidence.length > 0) {
        lines.push(`- By confidence: ${fc.byConfidence.map(c => `${c.confidence}: avg ${c.avgDelta > 0 ? '+' : ''}${c.avgDelta}d (n=${c.count})`).join(', ')}`);
      }
      if (fc.byStage.length > 0) {
        lines.push(`- By stage at prediction: ${fc.byStage.map(s => `${s.stage}: avg ${s.avgDelta > 0 ? '+' : ''}${s.avgDelta}d (n=${s.count})`).join(', ')}`);
      }
    } else {
      lines.push(`- Insufficient resolved predictions for calibration — treat forecast as rough estimate`);
    }
    lines.push('');
  }

  // Meeting density — engagement distribution (cycle 27)
  if (ctx.meetingDensity) {
    const md = ctx.meetingDensity;
    lines.push(`MEETING DENSITY (12-week analysis, score ${md.densityScore}/100):`);
    lines.push(`- Current week: ${md.currentWeekCount} meetings | Average: ${md.avgPerWeek}/week`);
    if (md.gapWeeks.length > 0) {
      lines.push(`- Gap weeks (zero meetings): ${md.gapWeeks.join(', ')}`);
    }
    if (md.clusterWeeks.length > 0) {
      lines.push(`- Cluster weeks (3+ meetings): ${md.clusterWeeks.join(', ')}`);
    }
    lines.push(`- ${md.insight}`);
    lines.push('');
  }

  // FOMO dynamics — competitive pressure (cycle 27)
  if (ctx.fomoDynamics.length > 0) {
    lines.push('COMPETITIVE DYNAMICS (FOMO signals from advancing investors):');
    for (const fomo of ctx.fomoDynamics.slice(0, 3)) {
      const intensityTag = fomo.fomoIntensity === 'high' ? 'HIGH' : fomo.fomoIntensity === 'medium' ? 'MEDIUM' : 'LOW';
      lines.push(`- [${intensityTag}] ${fomo.advancingInvestor} → ${fomo.advancingTo} | Affects: ${fomo.affectedInvestors.slice(0, 3).map(a => a.name).join(', ')}`);
      lines.push(`  → ${fomo.recommendation}`);
    }
    lines.push('');
  }

  // Engagement velocity — per-investor meeting frequency trends (cycle 29)
  const concerningVelocity = ctx.engagementVelocity.filter(v => v.acceleration === 'gone_silent' || v.acceleration === 'decelerating');
  const acceleratingVelocity = ctx.engagementVelocity.filter(v => v.acceleration === 'accelerating');
  if (concerningVelocity.length > 0 || acceleratingVelocity.length > 0) {
    lines.push('ENGAGEMENT VELOCITY (meeting frequency trends by investor):');
    for (const v of concerningVelocity.slice(0, 5)) {
      lines.push(`- [${v.acceleration === 'gone_silent' ? 'SILENT' : 'SLOWING'}] ${v.investorName} (T${v.tier}): ${v.signal}`);
    }
    for (const v of acceleratingVelocity.slice(0, 3)) {
      lines.push(`- [ACCELERATING] ${v.investorName} (T${v.tier}): ${v.signal}`);
    }
    lines.push('');
  }

  // Score reversals — significant drops (cycle 26)
  if (ctx.scoreReversals.length > 0) {
    lines.push('SCORE REVERSALS (significant score drops since last snapshot):');
    for (const rev of ctx.scoreReversals) {
      const severityTag = rev.severity === 'critical' ? 'CRITICAL' : rev.severity === 'warning' ? 'WARNING' : 'NOTABLE';
      lines.push(`- [${severityTag}] ${rev.investorName}: ${rev.previousScore}→${rev.currentScore} (${rev.delta}) between ${rev.previousDate} and ${rev.currentDate}`);
    }
    lines.push('');
  }

  // Pipeline rankings — comparative positioning (cycle 26)
  if (ctx.pipelineRankings.length > 0) {
    lines.push(`PIPELINE RANKINGS (${ctx.pipelineRankings.length} active investors, by score):`);
    for (const r of ctx.pipelineRankings.slice(0, 10)) {
      let changeStr = '';
      if (r.previousRank !== null && r.rankChange !== 0) {
        changeStr = r.rankChange > 0 ? ` ↑${r.rankChange}` : ` ↓${Math.abs(r.rankChange)}`;
      }
      lines.push(`- #${r.rank}${changeStr} ${r.investorName} (T${r.tier}, ${r.status}, score: ${r.score})`);
    }
    lines.push('');
  }

  // Win/loss pattern analysis — outcome-driven learning (cycle 25)
  if (ctx.winLossPatterns && (ctx.winLossPatterns.closedCount > 0 || ctx.winLossPatterns.passedCount > 0)) {
    const wl = ctx.winLossPatterns;
    lines.push(`WIN/LOSS PATTERNS (${wl.closedCount} closed, ${wl.passedCount} passed, ${wl.droppedCount} dropped):`);
    if (wl.winnerProfile) {
      lines.push(`- Winner profile: score ${wl.winnerProfile.avgScore}, enthusiasm ${wl.winnerProfile.avgEnthusiasm}/5, ${wl.winnerProfile.avgMeetings} meetings, ${wl.winnerProfile.avgDaysToClose}d to close, tiers: ${wl.winnerProfile.commonTiers}`);
    }
    if (wl.loserProfile) {
      lines.push(`- Loser profile: score ${wl.loserProfile.avgScore}, enthusiasm ${wl.loserProfile.avgEnthusiasm}/5, ${wl.loserProfile.avgMeetings} meetings, ${wl.loserProfile.avgDaysToPass}d to pass, tiers: ${wl.loserProfile.commonTiers}`);
    }
    const highSigFactors = wl.distinguishingFactors.filter(f => f.significance === 'high');
    if (highSigFactors.length > 0) {
      lines.push(`- KEY PREDICTORS: ${highSigFactors.map(f => `${f.factor} (closed: ${f.closedAvg}, passed: ${f.passedAvg})`).join('; ')}`);
    }
    for (const insight of wl.insights) {
      lines.push(`- ${insight}`);
    }
    lines.push('');
  }

  // Network cascade intelligence — probability-weighted capital chains (cycle 32)
  if (ctx.networkCascades.length > 0) {
    lines.push('NETWORK CASCADES (keystone investors → cascade chains):');
    for (const cascade of ctx.networkCascades.slice(0, 3)) {
      const chainStr = cascade.cascadeChain.slice(0, 4).map(c => `${c.investorName} (${Math.round(c.probability * 100)}%)`).join(' → ');
      lines.push(`- ${cascade.keystoneName}: ${chainStr}`);
      if (cascade.networkBottleneck) {
        lines.push(`  BOTTLENECK: ${cascade.networkBottleneck.investorName} — if passes, cascade impact: ${cascade.networkBottleneck.impactIfPass}`);
      }
      lines.push(`  → ${cascade.signal}`);
    }
    lines.push('');
  }

  // =========================================================================
  // INTELLIGENCE SYNTHESIS (reasoning aids — connect the dots between sources)
  // =========================================================================
  const synthesisLines: string[] = [];

  // Connect narrative weaknesses to investors with pending follow-ups
  if (ctx.narrativeWeaknesses.length > 0 && ctx.investors.length > 0) {
    for (const nw of ctx.narrativeWeaknesses) {
      const affectedInvestors = ctx.investors.filter(inv =>
        nw.investorNames.includes(inv.name)
      );
      if (affectedInvestors.length > 0) {
        const nextMeetings = affectedInvestors.filter(inv => inv.pendingFollowups > 0);
        if (nextMeetings.length > 0) {
          synthesisLines.push(`URGENT: "${nw.topic}" weakness affects investors with pending follow-ups: ${nextMeetings.map(i => i.name).join(', ')} — address BEFORE next contact`);
        }
      }
    }
  }

  // Connect keystone investors to pipeline value
  if (ctx.keystoneInvestors.length > 0) {
    const topKeystone = ctx.keystoneInvestors[0];
    if (topKeystone) {
      synthesisLines.push(`KEYSTONE PRIORITY: Closing ${topKeystone.name} (${topKeystone.connectionCount} connections) should be top priority — cascade value: ${topKeystone.cascadeValue}`);
    }
  }

  // Connect prediction calibration to confidence language
  if (ctx.predictionCalibration.resolvedCount >= 5 && ctx.predictionCalibration.biasDirection === 'over_confident') {
    synthesisLines.push(`CALIBRATION WARNING: Reduce confidence in probability statements by ~${Math.round(ctx.predictionCalibration.brierScore * 100)}% based on track record`);
  }

  // Pipeline health synthesis
  if (ctx.pipelineHealth.overdueFollowups > 3) {
    synthesisLines.push(`PROCESS HEALTH: ${ctx.pipelineHealth.overdueFollowups} overdue follow-ups — this signals execution breakdown, not pipeline quality`);
  }
  if (ctx.pipelineHealth.totalActive < 5) {
    synthesisLines.push(`PIPELINE THIN: Only ${ctx.pipelineHealth.totalActive} active investors — diversification risk. Consider adding 3-5 new leads.`);
  }

  // Connect narrative drift to upcoming interactions
  const strugglingTypes = ctx.narrativeDrift.filter(nd => nd.status === 'struggling');
  if (strugglingTypes.length > 0) {
    const struggleNames = strugglingTypes.map(s => s.investorType);
    const affectedInvestors = ctx.investors.filter(inv => struggleNames.includes(inv.type));
    if (affectedInvestors.length > 0) {
      synthesisLines.push(`NARRATIVE RISK: ${affectedInvestors.length} active investors are types where narrative is struggling (${struggleNames.join(', ')}). Tailor pitch before next contact with: ${affectedInvestors.slice(0, 5).map(i => i.name).join(', ')}`);
    }
  }

  // Lifecycle synthesis: stalled high-value investors need attention (cycle 16)
  const stalledHighValue = ctx.investors.filter(i => i.stageHealth === 'stalled' && i.tier <= 2);
  if (stalledHighValue.length > 0) {
    synthesisLines.push(`STALLED HIGH-VALUE: ${stalledHighValue.map(i => `${i.name} (T${i.tier}, ${i.daysInCurrentStage}d at "${i.status}")`).join(', ')} — these investors have been stuck too long. Either escalate or deprioritize.`);
  }

  // Contradiction: enthusiastic but stalled lifecycle
  for (const inv of ctx.investors) {
    if (inv.enthusiasm >= 4 && inv.stageHealth === 'stalled' && inv.tier <= 2) {
      synthesisLines.push(`LIFECYCLE CONTRADICTION: ${inv.name} has enthusiasm ${inv.enthusiasm}/5 but has been at "${inv.status}" for ${inv.daysInCurrentStage} days — high enthusiasm without progression suggests internal blockers or politeness`);
    }
  }

  // Temporal trend synthesis: declining metrics feed urgency
  if (ctx.temporalTrends) {
    const declining = ctx.temporalTrends.trends.filter(t => t.direction === 'declining');
    if (declining.length >= 3) {
      synthesisLines.push(`TRAJECTORY WARNING: ${declining.length}/5 key metrics are declining — the raise is losing momentum across multiple dimensions. Immediate course correction needed.`);
    } else if (declining.length >= 2) {
      synthesisLines.push(`WATCH: ${declining.map(t => t.metric).join(' and ')} are both declining — monitor closely for compound deterioration.`);
    }

    // Specific: declining narrative + emerging objections = narrative crisis escalation
    const narrativeDecline = ctx.temporalTrends.trends.find(t => t.metric === 'Narrative Strength' && t.direction === 'declining');
    if (narrativeDecline && ctx.objectionEvolution && ctx.objectionEvolution.emerging.length > 0) {
      synthesisLines.push(`COMPOUND RISK: Narrative score declining (${narrativeDecline.delta7d}% over 7d) while new objections are emerging (${ctx.objectionEvolution.emerging.join(', ')}) — narrative overhaul urgently needed`);
    }

    // Positive: improving trends + accelerating velocity = momentum confirmation
    const improving = ctx.temporalTrends.trends.filter(t => t.direction === 'improving');
    if (improving.length >= 3) {
      synthesisLines.push(`MOMENTUM CONFIRMED: ${improving.length}/5 metrics are improving — capitalize on current momentum with accelerated investor engagement`);
    }
  }

  // Contradiction detection: investors with high enthusiasm but no progression
  for (const inv of ctx.investors) {
    if (inv.meetingCount >= 3 && inv.enthusiasm >= 4) {
      const earlyStatuses = ['identified', 'contacted', 'nda_signed', 'meeting_scheduled', 'met'];
      if (earlyStatuses.includes(inv.status)) {
        synthesisLines.push(`CONTRADICTION: ${inv.name} has enthusiasm ${inv.enthusiasm}/5 after ${inv.meetingCount} meetings but still at "${inv.status}" — possible politeness signal, probe for real conviction`);
      }
    }
  }

  // Forecast synthesis: connect close date prediction to pipeline health (cycle 18)
  if (ctx.raiseForecast) {
    const rf = ctx.raiseForecast;
    if (rf.confidence === 'low') {
      synthesisLines.push(`FORECAST WARNING: Close date prediction has LOW confidence — pipeline needs more advanced-stage investors or faster stage transitions`);
    }
    if (rf.nearestClose && rf.nearestClose.days > 90) {
      synthesisLines.push(`TIMELINE RISK: Nearest predicted close is ${rf.nearestClose.days} days away (${rf.nearestClose.name}) — consider accelerating top prospects`);
    }
    // Forecast + temporal trends: declining metrics + distant close = compounding risk
    if (ctx.temporalTrends && ctx.temporalTrends.overallDirection === 'declining' && rf.confidence !== 'high') {
      synthesisLines.push(`COMPOUND TIMELINE RISK: Health metrics are declining AND close date confidence is ${rf.confidence} — fundraise momentum is at risk of stalling completely`);
    }

    // Cross-system contradiction: enthusiastic investors with distant close dates (cycle 22)
    if (rf.nearestClose) {
      const nearInv = ctx.investors.find(i => i.name === rf.nearestClose!.name);
      if (nearInv && nearInv.enthusiasm >= 4 && rf.nearestClose.days > 60) {
        synthesisLines.push(`FORECAST CONTRADICTION: ${nearInv.name} has enthusiasm ${nearInv.enthusiasm}/5 but forecast predicts ~${rf.nearestClose.days}d to close — high enthusiasm should translate to faster movement. Either the forecast is conservative or the enthusiasm is superficial.`);
      }
    }

    // Stalled critical path + positive temporal = misleading signals (cycle 22)
    if (ctx.temporalTrends && ctx.temporalTrends.overallDirection === 'improving') {
      const stalledCritical = ctx.investors.filter(i =>
        rf.criticalPath.includes(i.name) && i.stageHealth === 'stalled'
      );
      if (stalledCritical.length > 0) {
        synthesisLines.push(`SIGNAL MISMATCH: Health metrics are improving but critical path investor${stalledCritical.length > 1 ? 's' : ''} ${stalledCritical.map(i => i.name).join(', ')} ${stalledCritical.length > 1 ? 'are' : 'is'} stalled — improving averages may mask that the most important investors aren't progressing`);
      }
    }
  }

  // Engagement velocity synthesis (cycle 29)
  const silentT1T2 = ctx.engagementVelocity.filter(v => v.acceleration === 'gone_silent' && v.tier <= 2);
  if (silentT1T2.length > 0) {
    synthesisLines.push(`GONE SILENT: ${silentT1T2.map(v => `${v.investorName} (T${v.tier}, ${v.daysSinceLastMeeting}d)`).join(', ')} — high-tier investors have stopped engaging. This is a strong negative signal — investigate or deprioritize.`);
  }
  const deceleratingHighEnthusiasm = ctx.engagementVelocity.filter(v => {
    if (v.acceleration !== 'decelerating') return false;
    const inv = ctx.investors.find(i => i.id === v.investorId);
    return inv && inv.enthusiasm >= 4;
  });
  if (deceleratingHighEnthusiasm.length > 0) {
    synthesisLines.push(`VELOCITY CONTRADICTION: ${deceleratingHighEnthusiasm.map(v => v.investorName).join(', ')} show high enthusiasm but decelerating meeting frequency — gap between stated interest and behavior`);
  }

  // Meeting density + FOMO synthesis (cycle 27)
  if (ctx.meetingDensity && ctx.meetingDensity.densityScore < 40 && ctx.fomoDynamics.length > 0) {
    synthesisLines.push(`MOMENTUM GAP: Meeting density is low (${ctx.meetingDensity.densityScore}/100) but ${ctx.fomoDynamics.length} FOMO trigger(s) exist — use competitive dynamics to schedule meetings this week`);
  }
  if (ctx.meetingDensity && ctx.meetingDensity.currentWeekCount === 0 && ctx.investors.filter(i => i.tier <= 2).length >= 3) {
    synthesisLines.push(`DEAD WEEK: Zero meetings this week with ${ctx.investors.filter(i => i.tier <= 2).length} active T1-2 investors — engagement gap will hurt momentum`);
  }

  // Score reversal synthesis: critical drops on T1-2 investors need immediate attention (cycle 26)
  const criticalReversals = ctx.scoreReversals.filter(r => r.severity === 'critical');
  if (criticalReversals.length > 0) {
    const t12Reversals = criticalReversals.filter(r => {
      const inv = ctx.investors.find(i => i.id === r.investorId);
      return inv && inv.tier <= 2;
    });
    if (t12Reversals.length > 0) {
      synthesisLines.push(`SCORE CRISIS: ${t12Reversals.map(r => `${r.investorName} dropped ${Math.abs(r.delta)} points`).join(', ')} — investigate immediately, these are priority investors losing conviction`);
    }
  }

  // Rank change synthesis: rising investors = momentum confirmation (cycle 26)
  const bigRisers = ctx.pipelineRankings.filter(r => r.rankChange >= 3);
  const bigFallers = ctx.pipelineRankings.filter(r => r.rankChange <= -3);
  if (bigRisers.length > 0) {
    synthesisLines.push(`RISING: ${bigRisers.map(r => `${r.investorName} (↑${r.rankChange} to #${r.rank})`).join(', ')} — capitalize on momentum`);
  }
  if (bigFallers.length > 0) {
    synthesisLines.push(`FALLING: ${bigFallers.map(r => `${r.investorName} (↓${Math.abs(r.rankChange)} to #${r.rank})`).join(', ')} — engagement may be declining`);
  }

  // Win/loss pattern synthesis: flag active investors matching loser profile (cycle 25)
  if (ctx.winLossPatterns && ctx.winLossPatterns.loserProfile && ctx.winLossPatterns.passedCount >= 2) {
    const lp = ctx.winLossPatterns.loserProfile;
    for (const inv of ctx.investors) {
      if (inv.enthusiasm <= lp.avgEnthusiasm && inv.meetingCount >= lp.avgMeetings && inv.tier <= 2) {
        synthesisLines.push(`LOSER PATTERN MATCH: ${inv.name} matches passed-investor profile (enthusiasm ${inv.enthusiasm}/5, ${inv.meetingCount} meetings) — historical data suggests this investor may pass. Consider direct conviction check.`);
      }
    }
  }

  // Forecast calibration synthesis: adjust trust in forecast based on track record (cycle 23)
  if (ctx.forecastCalibration && ctx.forecastCalibration.biasDirection !== 'insufficient_data') {
    const fc = ctx.forecastCalibration;
    if (fc.biasDirection === 'optimistic' && Math.abs(fc.avgAccuracyDelta) > 14 && ctx.raiseForecast) {
      synthesisLines.push(`CALIBRATION ADJUSTMENT: Forecasts have been optimistic by ~${fc.avgAccuracyDelta} days on average — the predicted close date of ${ctx.raiseForecast.expectedCloseDate} should be pushed back by ~${Math.round(fc.avgAccuracyDelta * 0.7)} days based on track record`);
    }
  }

  // Cross-system: high-tier investors with low engagement but long stage dwell (cycle 22)
  for (const inv of ctx.investors) {
    if (inv.tier <= 2 && inv.meetingCount === 0 && inv.daysInCurrentStage > 14 && inv.status !== 'identified') {
      synthesisLines.push(`DORMANT T${inv.tier}: ${inv.name} has been at "${inv.status}" for ${inv.daysInCurrentStage}d with ZERO meetings — either activate or remove to avoid inflating pipeline metrics`);
    }
  }

  // Network cascade synthesis: bottleneck investor gone silent or stalled (cycle 32)
  for (const cascade of ctx.networkCascades) {
    if (!cascade.networkBottleneck) continue;
    const bottleneckInv = ctx.investors.find(i => i.id === cascade.networkBottleneck!.investorId);
    if (bottleneckInv && (bottleneckInv.stageHealth === 'stalled' || bottleneckInv.daysSinceLastContact !== null && bottleneckInv.daysSinceLastContact > 21)) {
      synthesisLines.push(`CASCADE RISK: ${bottleneckInv.name} is the bottleneck in ${cascade.keystoneName}'s cascade chain but is ${bottleneckInv.stageHealth === 'stalled' ? 'stalled' : `silent for ${bottleneckInv.daysSinceLastContact}d`} — losing this investor collapses the chain`);
    }
  }

  if (synthesisLines.length > 0) {
    // Cap synthesis lines at 15 to prevent prompt bloat (cycle 30)
    const cappedSynthesis = synthesisLines.slice(0, 15);
    lines.push('=== INTELLIGENCE SYNTHESIS (reasoning aids) ===');
    for (const sl of cappedSynthesis) {
      lines.push(sl);
    }
    if (synthesisLines.length > 15) {
      lines.push(`(${synthesisLines.length - 15} additional synthesis signals omitted for brevity)`);
    }
    lines.push('');
  }

  // Prompt size tracking (cycle 30)
  const prompt = lines.join('\n');
  const charCount = prompt.length;
  const lineCount = lines.length;

  // If prompt exceeds budget, truncate lower-priority sections
  const MAX_PROMPT_CHARS = 20000;
  if (charCount > MAX_PROMPT_CHARS) {
    // Trim from bottom (synthesis gets truncated first, then recent activity)
    const trimmedLines = lines.slice(0, Math.max(50, Math.floor(lines.length * (MAX_PROMPT_CHARS / charCount))));
    trimmedLines.push(`\n[Context truncated: ${charCount} chars → ${MAX_PROMPT_CHARS} budget. ${lineCount} lines → ${trimmedLines.length} lines]`);
    return trimmedLines.join('\n');
  }

  return prompt;
}

/**
 * Get context system stats for monitoring (cycle 30)
 */
export function getContextStats(ctx: FullContext): {
  dataSources: number;
  contextFields: number;
  investorCount: number;
  synthesisRules: number;
  promptChars: number;
} {
  const prompt = contextToSystemPrompt(ctx);
  return {
    dataSources: 29, // manually tracked
    contextFields: Object.keys(ctx).length,
    investorCount: ctx.investors.length,
    synthesisRules: (prompt.match(/INTELLIGENCE SYNTHESIS/g) || []).length > 0
      ? (prompt.split('=== INTELLIGENCE SYNTHESIS')[1] || '').split('\n').filter(l => l.trim().length > 0).length
      : 0,
    promptChars: prompt.length,
  };
}

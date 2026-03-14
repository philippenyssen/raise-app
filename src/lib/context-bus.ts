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
} from './db';
import type { TemporalTrends } from './db';

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

  type InvRow = { id: string; name: string; type: string; tier: number; status: string; enthusiasm: number; partner: string };
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
    if (inv.pendingTasks > 0) line += ` — ${inv.pendingTasks} pending tasks`;
    if (inv.unresolvedObjections.length > 0) line += ` — OBJECTIONS: ${inv.unresolvedObjections.join('; ')}`;
    lines.push(line);
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

  if (synthesisLines.length > 0) {
    lines.push('=== INTELLIGENCE SYNTHESIS (reasoning aids) ===');
    for (const sl of synthesisLines) {
      lines.push(sl);
    }
    lines.push('');
  }

  return lines.join('\n');
}

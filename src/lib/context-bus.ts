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
} from './db';

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

  return lines.join('\n');
}

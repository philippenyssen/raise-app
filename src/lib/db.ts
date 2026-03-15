import { createClient, type Client, type InValue } from '@libsql/client';
import { Investor, Meeting, RaiseConfig, MarketDeal, InvestorPartner, InvestorPortfolioCo, Competitor, IntelligenceBrief, Task, ActivityEvent, type RaisePhase, type TaskPriority, type FollowupAction, type FollowupActionType, type FollowupStatus } from './types';
import { PIPELINE_ORDER } from './api-helpers';

// Acceleration Action types
export interface AccelerationAction {
  id: string;
  investor_id: string;
  investor_name: string | null;
  trigger_type: 'momentum_cliff' | 'stall_risk' | 'window_closing' | 'catalyst_match' | 'competitive_pressure' | 'term_sheet_ready' | 'cascade_bottleneck' | 'velocity_decay';
  action_type: 'milestone_share' | 'expert_call' | 'site_visit' | 'competitive_signal' | 'warm_reintro' | 'data_update' | 'escalation' | 'fomo_outreach';
  description: string;
  expected_lift: number;
  confidence: 'high' | 'medium' | 'low';
  status: 'pending' | 'executed' | 'skipped';
  actual_lift: number | null;
  executed_at: string | null;
  created_at: string;
}

let client: Client;
let initialized = false;

// In-memory TTL cache for expensive computations — prevents redundant DB queries
// across multiple API routes hitting the same function within the TTL window
const _computeCache = new Map<string, { data: unknown; expires: number; pending?: Promise<unknown> }>();

function cachedCompute<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = _computeCache.get(key);
  if (entry && entry.expires > now) return Promise.resolve(entry.data as T);
  if (entry?.pending) return entry.pending as Promise<T>;
  const promise = fn().then(result => {
    _computeCache.set(key, { data: result, expires: now + ttlMs });
    return result;
  }).catch(err => {
    _computeCache.delete(key);
    throw err;
  });
  _computeCache.set(key, { data: null, expires: 0, pending: promise });
  return promise;
}

export function invalidateComputeCache(keyPrefix?: string) {
  if (!keyPrefix) { _computeCache.clear(); return; }
  for (const k of _computeCache.keys()) { if (k.startsWith(keyPrefix)) _computeCache.delete(k); }
}

async function genericUpdate(
  table: string,
  id: string,
  updates: Record<string, unknown>,
  opts?: { exclude?: string[]; autoUpdatedAt?: boolean; booleanFields?: string[] },
) {
  assertIdentifier(table);
  await ensureInitialized();
  const excl = new Set(opts?.exclude ?? ['id', 'created_at']);
  const fields = Object.keys(updates).filter(k => !excl.has(k));
  if (fields.length === 0) return;
  fields.forEach(assertIdentifier);
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const bools = new Set(opts?.booleanFields ?? []);
  const values = fields.map(f => {
    const v = updates[f];
    if (bools.has(f) || typeof v === 'boolean') return v ? 1 : 0;
    return v as InValue;
  });
  const suffix = opts?.autoUpdatedAt !== false ? `, updated_at = datetime('now')` : '';
  await getClient().execute({
    sql: `UPDATE ${table} SET ${sets}${suffix} WHERE id = ?`,
    args: [...values, id],
  });
}

async function genericGetById<T>(table: string, id: string): Promise<T | null> {
  await ensureInitialized();
  const result = await getClient().execute({ sql: `SELECT * FROM ${table} WHERE id = ?`, args: [id] });
  return result.rows.length > 0 ? (result.rows[0] as unknown as T) : null;
}

async function genericDelete(table: string, id: string) {
  await ensureInitialized();
  await getClient().execute({ sql: `DELETE FROM ${table} WHERE id = ?`, args: [id] });
}

function assertIdentifier(name: string): void {
  if (!/^[a-zA-Z_]\w{0,63}$/.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
}

async function genericGetByField<T>(
  tableName: string,
  field: string,
  value: string,
  opts?: { orderBy?: string; limit?: number },
): Promise<T[]> {
  assertIdentifier(tableName);
  assertIdentifier(field);
  await ensureInitialized();
  let sql = `SELECT * FROM ${tableName} WHERE ${field} = ?`;
  if (opts?.orderBy && /^[\w]+(?: (?:ASC|DESC))?(?:, ?[\w]+(?: (?:ASC|DESC))?)*$/i.test(opts.orderBy)) sql += ` ORDER BY ${opts.orderBy}`;
  if (opts?.limit && Number.isInteger(opts.limit) && opts.limit > 0) sql += ` LIMIT ${opts.limit}`;
  const result = await getClient().execute({ sql, args: [value] });
  return result.rows as unknown as T[];
}

async function genericCreate(
  tableName: string,
  data: Record<string, unknown>,
  opts?: { timestamps?: string[] },
): Promise<string> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const entries = Object.entries(data).filter(([, v]) => v !== undefined);
  const tsCols = opts?.timestamps ?? ['created_at', 'updated_at'];
  const cols = ['id', ...entries.map(([k]) => k), ...tsCols];
  const vals: InValue[] = [id, ...entries.map(([, v]) => v as InValue), ...tsCols.map(() => now)];
  const placeholders = cols.map(() => '?').join(', ');
  await getClient().execute({
    sql: `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`,
    args: vals,
  });
  return id;
}

function getClient(): Client {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:raise.db',
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

async function ensureInitialized() {
  if (initialized) return;
  const db = getClient();

  await db.batch([
    `CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS investors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'vc',
      tier INTEGER NOT NULL DEFAULT 2,
      status TEXT NOT NULL DEFAULT 'identified',
      partner TEXT DEFAULT '',
      fund_size TEXT DEFAULT '',
      check_size_range TEXT DEFAULT '',
      sector_thesis TEXT DEFAULT '',
      warm_path TEXT DEFAULT '',
      ic_process TEXT DEFAULT '',
      speed TEXT DEFAULT 'medium',
      portfolio_conflicts TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      enthusiasm INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      investor_id TEXT NOT NULL,
      investor_name TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'intro',
      attendees TEXT DEFAULT '',
      duration_minutes INTEGER DEFAULT 60,
      raw_notes TEXT DEFAULT '',
      questions_asked TEXT DEFAULT '[]',
      objections TEXT DEFAULT '[]',
      engagement_signals TEXT DEFAULT '{}',
      competitive_intel TEXT DEFAULT '',
      next_steps TEXT DEFAULT '',
      enthusiasm_score INTEGER DEFAULT 3,
      status_after TEXT DEFAULT 'met',
      ai_analysis TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      outcome_rating INTEGER DEFAULT NULL,
      objections_addressed TEXT DEFAULT '[]',
      competitive_mentions TEXT DEFAULT '[]',
      key_takeaway TEXT DEFAULT '',
      prep_usefulness INTEGER DEFAULT NULL,
      FOREIGN KEY (investor_id) REFERENCES investors(id)
    )`,
    `CREATE TABLE IF NOT EXISTS convergence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT DEFAULT (datetime('now')),
      story INTEGER DEFAULT 0,
      materials INTEGER DEFAULT 0,
      model INTEGER DEFAULT 0,
      investors INTEGER DEFAULT 0,
      objections INTEGER DEFAULT 0,
      pricing INTEGER DEFAULT 0,
      terms INTEGER DEFAULT 0,
      funnel INTEGER DEFAULT 0,
      timeline INTEGER DEFAULT 0,
      team INTEGER DEFAULT 0,
      score INTEGER DEFAULT 0,
      notes TEXT DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'custom',
      content TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      content TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      change_summary TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (document_id) REFERENCES documents(id)
    )`,
    `CREATE TABLE IF NOT EXISTS data_room_files (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      mime_type TEXT DEFAULT '',
      size_bytes INTEGER DEFAULT 0,
      extracted_text TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      uploaded_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS model_sheets (
      id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL DEFAULT 'default',
      sheet_name TEXT NOT NULL,
      sheet_order INTEGER DEFAULT 0,
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS term_sheets (
      id TEXT PRIMARY KEY,
      investor TEXT NOT NULL,
      valuation TEXT DEFAULT '',
      amount TEXT DEFAULT '',
      liq_pref TEXT DEFAULT '1x non-participating',
      anti_dilution TEXT DEFAULT 'Broad-based weighted average',
      board_seats TEXT DEFAULT '1 + observer',
      dividends TEXT DEFAULT 'None',
      protective_provisions TEXT DEFAULT 'Standard',
      option_pool TEXT DEFAULT '',
      exclusivity TEXT DEFAULT '',
      strategic_value INTEGER DEFAULT 3,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS market_deals (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      round TEXT DEFAULT '',
      amount TEXT DEFAULT '',
      valuation TEXT DEFAULT '',
      lead_investors TEXT DEFAULT '',
      other_investors TEXT DEFAULT '',
      date TEXT DEFAULT '',
      sector TEXT DEFAULT '',
      sub_sector TEXT DEFAULT '',
      equity_story TEXT DEFAULT '',
      relevance TEXT DEFAULT '',
      source TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS investor_partners (
      id TEXT PRIMARY KEY,
      investor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      title TEXT DEFAULT '',
      focus_areas TEXT DEFAULT '',
      notable_deals TEXT DEFAULT '',
      board_seats TEXT DEFAULT '',
      linkedin TEXT DEFAULT '',
      background TEXT DEFAULT '',
      relevance_to_us TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (investor_id) REFERENCES investors(id)
    )`,
    `CREATE TABLE IF NOT EXISTS investor_portfolio (
      id TEXT PRIMARY KEY,
      investor_id TEXT NOT NULL,
      company TEXT NOT NULL,
      sector TEXT DEFAULT '',
      stage_invested TEXT DEFAULT '',
      amount TEXT DEFAULT '',
      date TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      relevance TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (investor_id) REFERENCES investors(id)
    )`,
    `CREATE TABLE IF NOT EXISTS competitors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sector TEXT DEFAULT '',
      hq TEXT DEFAULT '',
      last_round TEXT DEFAULT '',
      last_valuation TEXT DEFAULT '',
      total_raised TEXT DEFAULT '',
      key_investors TEXT DEFAULT '',
      revenue TEXT DEFAULT '',
      employees TEXT DEFAULT '',
      positioning TEXT DEFAULT '',
      strengths TEXT DEFAULT '',
      weaknesses TEXT DEFAULT '',
      threat_level TEXT DEFAULT 'medium',
      our_advantage TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS intelligence_briefs (
      id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      brief_type TEXT NOT NULL DEFAULT 'investor',
      content TEXT DEFAULT '',
      sources TEXT DEFAULT '[]',
      investor_id TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      assignee TEXT DEFAULT '',
      due_date TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      phase TEXT DEFAULT 'preparation',
      investor_id TEXT DEFAULT '',
      investor_name TEXT DEFAULT '',
      auto_generated INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      detail TEXT DEFAULT '',
      investor_id TEXT DEFAULT '',
      investor_name TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS document_flags (
      id TEXT PRIMARY KEY,
      document_id TEXT DEFAULT '',
      meeting_id TEXT DEFAULT '',
      investor_id TEXT DEFAULT '',
      investor_name TEXT DEFAULT '',
      flag_type TEXT DEFAULT 'objection_response',
      description TEXT DEFAULT '',
      section_hint TEXT DEFAULT '',
      objection_text TEXT DEFAULT '',
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS objection_responses (
      id TEXT PRIMARY KEY,
      objection_text TEXT NOT NULL,
      objection_topic TEXT NOT NULL,
      investor_id TEXT,
      investor_name TEXT,
      meeting_id TEXT,
      response_text TEXT DEFAULT '',
      effectiveness TEXT DEFAULT 'unknown',
      next_meeting_enthusiasm_delta INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS score_snapshots (
      id TEXT PRIMARY KEY,
      investor_id TEXT NOT NULL,
      overall_score INTEGER NOT NULL,
      engagement_score INTEGER,
      momentum_score INTEGER,
      enthusiasm INTEGER,
      meeting_count INTEGER,
      predicted_outcome TEXT,
      snapshot_date TEXT DEFAULT (date('now')),
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS followup_actions (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      investor_id TEXT NOT NULL,
      investor_name TEXT,
      action_type TEXT NOT NULL,
      description TEXT NOT NULL,
      due_at TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      outcome TEXT DEFAULT '',
      conviction_delta INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      executed_at TEXT,
      measured_lift INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS acceleration_actions (
      id TEXT PRIMARY KEY,
      investor_id TEXT NOT NULL,
      investor_name TEXT,
      trigger_type TEXT NOT NULL,
      action_type TEXT NOT NULL,
      description TEXT NOT NULL,
      expected_lift INTEGER DEFAULT 0,
      confidence TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      actual_lift INTEGER,
      executed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS revenue_commitments (
      id TEXT PRIMARY KEY,
      customer TEXT NOT NULL,
      program TEXT NOT NULL DEFAULT '',
      contract_type TEXT NOT NULL DEFAULT 'firm',
      amount_eur REAL NOT NULL,
      start_date TEXT,
      end_date TEXT,
      annual_amount REAL,
      confidence REAL NOT NULL DEFAULT 0.8,
      status TEXT NOT NULL DEFAULT 'active',
      source_doc TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS question_patterns (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      question_text TEXT NOT NULL,
      investor_id TEXT NOT NULL,
      investor_name TEXT,
      investor_type TEXT,
      meeting_id TEXT NOT NULL,
      meeting_date TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS prediction_log (
      id TEXT PRIMARY KEY,
      investor_id TEXT NOT NULL,
      investor_name TEXT,
      predicted_close_prob REAL,
      predicted_close_date TEXT,
      prediction_date TEXT DEFAULT (date('now')),
      actual_outcome TEXT,
      actual_close_date TEXT,
      resolved_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS narrative_signals (
      id TEXT PRIMARY KEY,
      investor_type TEXT NOT NULL,
      avg_enthusiasm REAL,
      conversion_rate REAL,
      top_objection TEXT,
      top_question_topic TEXT,
      sample_size INTEGER,
      snapshot_date TEXT DEFAULT (date('now')),
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS investor_relationships (
      id TEXT PRIMARY KEY,
      investor_a_id TEXT NOT NULL,
      investor_b_id TEXT NOT NULL,
      relationship_type TEXT NOT NULL,
      strength INTEGER DEFAULT 3,
      evidence TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ], 'write');

  // Migration: add enthusiasm_at_objection column if missing
  try { await db.execute(`ALTER TABLE objection_responses ADD COLUMN enthusiasm_at_objection INTEGER DEFAULT 0`); } catch { /* column already exists */ }

  // Migration: health_snapshots table for strategic assessment tracking (cycle 11)
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS health_snapshots (
      id TEXT PRIMARY KEY,
      snapshot_date TEXT DEFAULT (date('now')),
      pipeline_score INTEGER,
      narrative_score INTEGER,
      readiness_score INTEGER,
      velocity REAL,
      active_investors INTEGER,
      strategic_summary TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  } catch { /* already exists */ }

  // Forecast log — tracks forecast predictions for calibration (cycle 23)
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS forecast_log (
      id TEXT PRIMARY KEY,
      investor_id TEXT NOT NULL,
      investor_name TEXT,
      predicted_days_to_close INTEGER,
      predicted_close_date TEXT,
      confidence TEXT,
      stage_at_prediction TEXT,
      actual_outcome TEXT,
      actual_days_to_outcome INTEGER,
      accuracy_delta INTEGER,
      logged_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT
    )`);
  } catch { /* already exists */ }

  // Enrichment system tables
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS enrichment_jobs (
      id TEXT PRIMARY KEY,
      investor_id TEXT NOT NULL,
      investor_name TEXT NOT NULL,
      sources TEXT DEFAULT '[]',
      status TEXT DEFAULT 'queued',
      results_count INTEGER DEFAULT 0,
      errors TEXT DEFAULT '[]',
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS enrichment_records (
      id TEXT PRIMARY KEY,
      investor_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      field_value TEXT NOT NULL,
      category TEXT NOT NULL,
      confidence REAL DEFAULT 0.5,
      source_url TEXT DEFAULT '',
      raw_json TEXT DEFAULT '',
      fetched_at TEXT NOT NULL,
      stale_after TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS enrichment_source_config (
      source_id TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 1,
      api_key TEXT DEFAULT '',
      last_used TEXT,
      total_calls INTEGER DEFAULT 0,
      total_results INTEGER DEFAULT 0,
      avg_confidence REAL DEFAULT 0
    )`);
  } catch { /* already exists */ }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS skill_executions (
      id TEXT PRIMARY KEY,
      skill_name TEXT NOT NULL,
      skill_type TEXT NOT NULL DEFAULT 'product_ai',
      version INTEGER DEFAULT 1,
      trigger_source TEXT DEFAULT 'api',
      input_summary TEXT DEFAULT '',
      outcome TEXT NOT NULL DEFAULT 'success',
      output_quality REAL DEFAULT 0,
      parse_success INTEGER DEFAULT 1,
      latency_ms INTEGER DEFAULT 0,
      error_message TEXT DEFAULT '',
      fields_extracted INTEGER DEFAULT 0,
      fields_expected INTEGER DEFAULT 0,
      user_accepted INTEGER DEFAULT 1,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )`);
  } catch { /* already exists */ }

  // Data room access tracking
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS data_room_access (
      id TEXT PRIMARY KEY,
      investor_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      accessed_at TEXT DEFAULT (datetime('now'))
    )`);
  } catch { /* already exists */ }

  // Migration: add meeting outcome feedback columns
  try { await db.execute(`ALTER TABLE meetings ADD COLUMN outcome_rating INTEGER DEFAULT NULL`); } catch { /* column already exists */ }
  try { await db.execute(`ALTER TABLE meetings ADD COLUMN objections_addressed TEXT DEFAULT '[]'`); } catch { /* column already exists */ }
  try { await db.execute(`ALTER TABLE meetings ADD COLUMN competitive_mentions TEXT DEFAULT '[]'`); } catch { /* column already exists */ }
  try { await db.execute(`ALTER TABLE meetings ADD COLUMN key_takeaway TEXT DEFAULT ''`); } catch { /* column already exists */ }
  try { await db.execute(`ALTER TABLE meetings ADD COLUMN prep_usefulness INTEGER DEFAULT NULL`); } catch { /* column already exists */ }

  // Indexes for frequent foreign key lookups
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_enrichment_investor ON enrichment_records(investor_id)`); } catch { /* */ }
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_meetings_investor ON meetings(investor_id)`); } catch { /* */ }
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_followups_investor ON followup_actions(investor_id)`); } catch { /* */ }
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_score_snapshots_investor ON score_snapshots(investor_id)`); } catch { /* */ }
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_tasks_investor ON tasks(investor_id)`); } catch { /* */ }
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(date)`); } catch { /* */ }
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_activity_log_investor ON activity_log(investor_id, created_at)`); } catch { /* */ }
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_document_versions_doc ON document_versions(document_id)`); } catch { /* */ }
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_objection_responses_topic ON objection_responses(objection_topic)`); } catch { /* */ }
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_investors_status ON investors(status)`); } catch { /* */ }
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`); } catch { /* */ }
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_followups_status ON followup_actions(status)`); } catch { /* */ }
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_followups_status_due ON followup_actions(status, due_at)`); } catch { /* */ }
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(event_type, created_at)`); } catch { /* */ }
  try { await db.execute(`CREATE INDEX IF NOT EXISTS idx_meetings_investor_date ON meetings(investor_id, date DESC)`); } catch { /* */ }

  initialized = true;
}

// Clear all data (for re-seeding)
export async function clearAllData() {
  await ensureInitialized();
  const db = getClient();
  await db.batch([
    'DELETE FROM meetings',
    'DELETE FROM investors',
    'DELETE FROM config',
    'DELETE FROM convergence',
  ], 'write');
}

// Config
export async function getConfig(key: string): Promise<string | null> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: 'SELECT value FROM config WHERE key = ?',
    args: [key],
  });
  return result.rows.length > 0 ? (result.rows[0].value as string) : null;
}

export async function setConfig(key: string, value: string) {
  await ensureInitialized();
  await getClient().execute({
    sql: 'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
    args: [key, value],
  });
}

export async function getRaiseConfig(): Promise<RaiseConfig | null> {
  const raw = await getConfig('raise_config');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function setRaiseConfig(config: RaiseConfig) {
  await setConfig('raise_config', JSON.stringify(config));
}

// Investors
export async function getAllInvestors(): Promise<Investor[]> {
  await ensureInitialized();
  const result = await getClient().execute(
    `SELECT i.*, (SELECT MAX(m.date) FROM meetings m WHERE m.investor_id = i.id) as last_meeting_date
     FROM investors i ORDER BY i.tier ASC, i.name ASC`
  );
  return result.rows as unknown as Investor[];
}

export const getInvestor = (id: string) => genericGetById<Investor>('investors', id);

export async function createInvestor(investor: Partial<Investor> & { name: string }): Promise<Investor> {
  const id = await genericCreate('investors', {
    name: investor.name,
    type: investor.type ?? 'vc',
    tier: investor.tier ?? 2,
    status: investor.status ?? 'identified',
    partner: investor.partner ?? '',
    fund_size: investor.fund_size ?? '',
    check_size_range: investor.check_size_range ?? '',
    sector_thesis: investor.sector_thesis ?? '',
    warm_path: investor.warm_path ?? '',
    ic_process: investor.ic_process ?? '',
    speed: investor.speed ?? 'medium',
    portfolio_conflicts: investor.portfolio_conflicts ?? '',
    notes: investor.notes ?? '',
    enthusiasm: investor.enthusiasm ?? 0,
  });
  return (await getInvestor(id))!;
}

export async function updateInvestor(id: string, updates: Partial<Investor>) {
  await genericUpdate('investors', id, updates as Record<string, unknown>);
}

export async function deleteInvestor(id: string) {
  await ensureInitialized();
  await getClient().execute({
    sql: 'DELETE FROM meetings WHERE investor_id = ?',
    args: [id],
  });
  await getClient().execute({
    sql: 'DELETE FROM investors WHERE id = ?',
    args: [id],
  });
}

// Meetings
export async function getMeetings(investorId?: string): Promise<Meeting[]> {
  await ensureInitialized();
  if (investorId) {
    const result = await getClient().execute({
      sql: 'SELECT * FROM meetings WHERE investor_id = ? ORDER BY date DESC',
      args: [investorId],
    });
    return result.rows as unknown as Meeting[];
  }
  const result = await getClient().execute('SELECT * FROM meetings ORDER BY date DESC');
  return result.rows as unknown as Meeting[];
}

export const getMeeting = (id: string) => genericGetById<Meeting>('meetings', id);

export async function createMeeting(meeting: Partial<Omit<Meeting, 'id' | 'created_at'>> & { investor_id: string; investor_name: string; date: string }): Promise<Meeting> {
  const id = await genericCreate('meetings', {
    investor_id: meeting.investor_id,
    investor_name: meeting.investor_name,
    date: meeting.date,
    type: meeting.type ?? 'intro',
    attendees: meeting.attendees ?? '',
    duration_minutes: meeting.duration_minutes ?? 60,
    raw_notes: meeting.raw_notes ?? '',
    questions_asked: meeting.questions_asked ?? '[]',
    objections: meeting.objections ?? '[]',
    engagement_signals: meeting.engagement_signals ?? '{}',
    competitive_intel: meeting.competitive_intel ?? '',
    next_steps: meeting.next_steps ?? '',
    enthusiasm_score: meeting.enthusiasm_score ?? 3,
    status_after: meeting.status_after ?? 'met',
    ai_analysis: meeting.ai_analysis ?? '',
  }, { timestamps: ['created_at'] });
  return (await getMeeting(id))!;
}

export async function updateMeeting(id: string, updates: Partial<Meeting>) {
  await genericUpdate('meetings', id, updates as Record<string, unknown>, { autoUpdatedAt: false });
}

// Funnel Metrics
export async function getFunnelMetrics() {
  await ensureInitialized();
  const db = getClient();
  const statusResult = await db.execute('SELECT status, COUNT(*) as count FROM investors GROUP BY status');
  const statusCounts = statusResult.rows as unknown as { status: string; count: number }[];

  const counts: Record<string, number> = {};
  statusCounts.forEach(s => { counts[s.status] = Number(s.count); });

  const contacted = (counts['contacted'] ?? 0) + (counts['nda_signed'] ?? 0) + (counts['meeting_scheduled'] ?? 0) +
    (counts['met'] ?? 0) + (counts['engaged'] ?? 0) + (counts['in_dd'] ?? 0) +
    (counts['term_sheet'] ?? 0) + (counts['closed'] ?? 0) + (counts['passed'] ?? 0);
  const meetings = (counts['met'] ?? 0) + (counts['engaged'] ?? 0) + (counts['in_dd'] ?? 0) +
    (counts['term_sheet'] ?? 0) + (counts['closed'] ?? 0);
  const engaged = (counts['engaged'] ?? 0) + (counts['in_dd'] ?? 0) +
    (counts['term_sheet'] ?? 0) + (counts['closed'] ?? 0);
  const in_dd = (counts['in_dd'] ?? 0) + (counts['term_sheet'] ?? 0) + (counts['closed'] ?? 0);
  const term_sheets = (counts['term_sheet'] ?? 0) + (counts['closed'] ?? 0);

  const totalResult = await db.execute('SELECT COUNT(*) as count FROM investors');
  const total = totalResult.rows[0] as unknown as { count: number };

  return {
    total,
    contacted,
    nda_signed: contacted,
    meetings,
    engaged,
    in_dd,
    term_sheets,
    closed: counts['closed'] ?? 0,
    passed: counts['passed'] ?? 0,
    dropped: counts['dropped'] ?? 0,
    conversion_rates: {
      contact_to_meeting: contacted > 0 ? Math.round((meetings / contacted) * 100) : 0,
      meeting_to_engaged: meetings > 0 ? Math.round((engaged / meetings) * 100) : 0,
      engaged_to_dd: engaged > 0 ? Math.round((in_dd / engaged) * 100) : 0,
      dd_to_term_sheet: in_dd > 0 ? Math.round((term_sheets / in_dd) * 100) : 0,
    },
    targets: {
      contact_to_meeting: 50,
      meeting_to_engaged: 60,
      engaged_to_dd: 40,
      dd_to_term_sheet: 50,
    }
  };
}

// Convergence
export async function getLatestConvergence() {
  await ensureInitialized();
  const result = await getClient().execute('SELECT * FROM convergence ORDER BY id DESC LIMIT 1');
  return result.rows.length > 0 ? result.rows[0] : null;
}

// Analytics
export async function getObjectionPatterns(): Promise<{ text: string; count: number; topic: string }[]> {
  await ensureInitialized();
  const result = await getClient().execute("SELECT objections FROM meetings WHERE objections != '[]'");
  const meetingRows = result.rows as unknown as { objections: string }[];
  const objMap = new Map<string, { count: number; topic: string }>();

  meetingRows.forEach(m => {
    try {
      const objs = JSON.parse(m.objections as string) as { text: string; topic: string }[];
      objs.forEach(o => {
        const key = o.text.toLowerCase().trim();
        const existing = objMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          objMap.set(key, { count: 1, topic: o.topic || 'general' });
        }
      });
    } catch { /* skip malformed */ }
  });

  return Array.from(objMap.entries())
    .map(([text, data]) => ({ text, count: data.count, topic: data.topic }))
    .sort((a, b) => b.count - a.count);
}

// Documents
export interface Document {
  id: string;
  title: string;
  type: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  content: string;
  version_number: number;
  change_summary: string;
  created_at: string;
}

export async function getAllDocuments(): Promise<Document[]> {
  await ensureInitialized();
  const result = await getClient().execute('SELECT * FROM documents ORDER BY updated_at DESC');
  return result.rows as unknown as Document[];
}

export async function getAllDocumentSummaries(): Promise<Omit<Document, 'content'>[]> {
  await ensureInitialized();
  const result = await getClient().execute('SELECT id, title, type, status, created_at, updated_at FROM documents ORDER BY updated_at DESC');
  return result.rows as unknown as Omit<Document, 'content'>[];
}

export const getDocument = (id: string) => genericGetById<Document>('documents', id);

export async function createDocument(doc: { title: string; type: string; content?: string }): Promise<Document> {
  const id = await genericCreate('documents', {
    title: doc.title,
    type: doc.type,
    content: doc.content || '',
    status: 'draft',
  });
  const now = new Date().toISOString();
  await getClient().execute({
    sql: `INSERT INTO document_versions (id, document_id, content, version_number, change_summary, created_at) VALUES (?, ?, ?, 1, 'Initial version', ?)`,
    args: [crypto.randomUUID(), id, doc.content || '', now],
  });
  return (await getDocument(id))!;
}

export async function updateDocument(id: string, updates: { title?: string; content?: string; status?: string; change_summary?: string }): Promise<void> {
  await ensureInitialized();
  const db = getClient();
  const now = new Date().toISOString();

  const sets: string[] = ['updated_at = ?'];
  const values: InValue[] = [now];

  if (updates.title !== undefined) { sets.push('title = ?'); values.push(updates.title); }
  if (updates.content !== undefined) { sets.push('content = ?'); values.push(updates.content); }
  if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }

  values.push(id);
  await db.execute({ sql: `UPDATE documents SET ${sets.join(', ')} WHERE id = ?`, args: values });

  // Create new version if content changed
  if (updates.content !== undefined) {
    const versionResult = await db.execute({
      sql: 'SELECT MAX(version_number) as max_ver FROM document_versions WHERE document_id = ?',
      args: [id],
    });
    const nextVersion = ((versionResult.rows[0] as unknown as { max_ver: number | null }).max_ver ?? 0) + 1;
    await db.execute({
      sql: `INSERT INTO document_versions (id, document_id, content, version_number, change_summary, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), id, updates.content, nextVersion, updates.change_summary || '', now],
    });
  }
}

export async function deleteDocument(id: string): Promise<void> {
  await ensureInitialized();
  const db = getClient();
  await db.execute({ sql: 'DELETE FROM document_versions WHERE document_id = ?', args: [id] });
  await db.execute({ sql: 'DELETE FROM documents WHERE id = ?', args: [id] });
}

export async function getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: 'SELECT * FROM document_versions WHERE document_id = ? ORDER BY version_number DESC',
    args: [documentId],
  });
  return result.rows as unknown as DocumentVersion[];
}

export const getDocumentVersion = (id: string) => genericGetById<DocumentVersion>('document_versions', id);

// Data Room
export interface DataRoomFile {
  id: string;
  filename: string;
  category: string;
  mime_type: string;
  size_bytes: number;
  extracted_text: string;
  summary: string;
  uploaded_at: string;
}

export async function getAllDataRoomFiles(): Promise<DataRoomFile[]> {
  await ensureInitialized();
  const result = await getClient().execute('SELECT * FROM data_room_files ORDER BY uploaded_at DESC');
  return result.rows as unknown as DataRoomFile[];
}

export async function getDataRoomFileCount(): Promise<number> {
  await ensureInitialized();
  const result = await getClient().execute('SELECT COUNT(*) as cnt FROM data_room_files');
  return Number((result.rows[0] as unknown as { cnt: number }).cnt) || 0;
}

export async function getAllDataRoomFileSummaries(): Promise<Omit<DataRoomFile, 'extracted_text'>[]> {
  await ensureInitialized();
  const result = await getClient().execute('SELECT id, filename, category, mime_type, size_bytes, summary, uploaded_at FROM data_room_files ORDER BY uploaded_at DESC');
  return result.rows as unknown as Omit<DataRoomFile, 'extracted_text'>[];
}

const getDataRoomFile = (id: string) => genericGetById<DataRoomFile>('data_room_files', id);

export async function createDataRoomFile(file: { filename: string; category: string; mime_type: string; size_bytes: number; extracted_text: string; summary?: string }): Promise<DataRoomFile> {
  const id = await genericCreate('data_room_files', {
    filename: file.filename,
    category: file.category,
    mime_type: file.mime_type,
    size_bytes: file.size_bytes,
    extracted_text: file.extracted_text,
    summary: file.summary || '',
  }, { timestamps: ['uploaded_at'] });
  return (await getDataRoomFile(id))!;
}

export const deleteDataRoomFile = (id: string) => genericDelete('data_room_files', id);

export async function getDataRoomContext(): Promise<string> {
  const files = await getAllDataRoomFiles();
  if (files.length === 0) return 'No data room files uploaded yet.';
  return files.map(f => {
    const text = f.extracted_text.substring(0, 3000);
    return `--- ${f.filename} (${f.category}) ---\n${f.summary ? `Summary: ${f.summary}\n` : ''}${text}`;
  }).join('\n\n');
}

// Data Room Access
export interface DataRoomAccessRecord {
  id: string;
  investor_id: string;
  document_id: string;
  accessed_at: string;
}

export async function logDataRoomAccess(investorId: string, documentId: string): Promise<DataRoomAccessRecord> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  await getClient().execute({
    sql: `INSERT INTO data_room_access (id, investor_id, document_id, accessed_at) VALUES (?, ?, ?, datetime('now'))`,
    args: [id, investorId, documentId],
  });
  return { id, investor_id: investorId, document_id: documentId, accessed_at: new Date().toISOString() };
}

export async function getAllDataRoomAccess(): Promise<DataRoomAccessRecord[]> {
  await ensureInitialized();
  const result = await getClient().execute('SELECT * FROM data_room_access ORDER BY accessed_at DESC');
  return result.rows as unknown as DataRoomAccessRecord[];
}

// Model Sheets
export interface ModelSheet {
  id: string;
  model_id: string;
  sheet_name: string;
  sheet_order: number;
  data: string; // JSON: { cells: Record<string, CellData>, colWidths?: Record<string,number> }
  created_at: string;
  updated_at: string;
}

export async function getModelSheets(modelId: string = 'default'): Promise<ModelSheet[]> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: 'SELECT * FROM model_sheets WHERE model_id = ? ORDER BY sheet_order ASC',
    args: [modelId],
  });
  return result.rows as unknown as ModelSheet[];
}

export const getModelSheet = (id: string) => genericGetById<ModelSheet>('model_sheets', id);

export async function createModelSheet(sheet: { model_id?: string; sheet_name: string; sheet_order: number; data: string }): Promise<ModelSheet> {
  const id = await genericCreate('model_sheets', {
    model_id: sheet.model_id || 'default',
    sheet_name: sheet.sheet_name,
    sheet_order: sheet.sheet_order,
    data: sheet.data,
  });
  return (await getModelSheet(id))!;
}

export async function updateModelSheet(id: string, updates: { sheet_name?: string; data?: string; sheet_order?: number }) {
  await genericUpdate('model_sheets', id, updates as Record<string, unknown>);
}

export const deleteModelSheet = (id: string) => genericDelete('model_sheets', id);

// Term Sheets
export interface TermSheet {
  id: string;
  investor: string;
  valuation: string;
  amount: string;
  liq_pref: string;
  anti_dilution: string;
  board_seats: string;
  dividends: string;
  protective_provisions: string;
  option_pool: string;
  exclusivity: string;
  strategic_value: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export async function getAllTermSheets(): Promise<TermSheet[]> {
  await ensureInitialized();
  const result = await getClient().execute('SELECT * FROM term_sheets ORDER BY created_at DESC');
  return result.rows as unknown as TermSheet[];
}

export const getTermSheet = (id: string) => genericGetById<TermSheet>('term_sheets', id);

export async function createTermSheet(ts: Omit<TermSheet, 'id' | 'created_at' | 'updated_at'>): Promise<TermSheet> {
  const id = await genericCreate('term_sheets', ts as Record<string, unknown>);
  return (await getTermSheet(id))!;
}

export async function updateTermSheet(id: string, updates: Partial<Omit<TermSheet, 'id' | 'created_at'>>) {
  await genericUpdate('term_sheets', id, updates as Record<string, unknown>, { exclude: ['id', 'created_at', 'updated_at'] });
}

export const deleteTermSheet = (id: string) => genericDelete('term_sheets', id);

// Market Deals

export async function getAllMarketDeals(): Promise<MarketDeal[]> {
  await ensureInitialized();
  const result = await getClient().execute('SELECT * FROM market_deals ORDER BY date DESC');
  return result.rows as unknown as MarketDeal[];
}

const getMarketDeal = (id: string) => genericGetById<MarketDeal>('market_deals', id);

export async function createMarketDeal(deal: Omit<MarketDeal, 'id' | 'created_at' | 'updated_at'>): Promise<MarketDeal> {
  const id = await genericCreate('market_deals', deal as Record<string, unknown>);
  return (await getMarketDeal(id))!;
}

export async function updateMarketDeal(id: string, updates: Partial<MarketDeal>) {
  await genericUpdate('market_deals', id, updates as Record<string, unknown>);
}

export const deleteMarketDeal = (id: string) => genericDelete('market_deals', id);

// Investor Partners

export async function getInvestorPartners(investorId: string): Promise<InvestorPartner[]> {
  return genericGetByField<InvestorPartner>('investor_partners', 'investor_id', investorId, { orderBy: 'name ASC' });
}

export async function createInvestorPartner(partner: Omit<InvestorPartner, 'id' | 'created_at' | 'updated_at'>): Promise<InvestorPartner> {
  const id = await genericCreate('investor_partners', partner as Record<string, unknown>);
  return (await genericGetById<InvestorPartner>('investor_partners', id))!;
}

export async function updateInvestorPartner(id: string, updates: Partial<InvestorPartner>) {
  await genericUpdate('investor_partners', id, updates as Record<string, unknown>, { exclude: ['id', 'created_at', 'investor_id'] });
}

export const deleteInvestorPartner = (id: string) => genericDelete('investor_partners', id);

// Investor Portfolio Companies

export async function getInvestorPortfolio(investorId: string): Promise<InvestorPortfolioCo[]> {
  return genericGetByField<InvestorPortfolioCo>('investor_portfolio', 'investor_id', investorId, { orderBy: 'date DESC' });
}

export async function getAllPortfolios(): Promise<InvestorPortfolioCo[]> {
  await ensureInitialized();
  const result = await getClient().execute('SELECT * FROM investor_portfolio ORDER BY date DESC');
  return result.rows as unknown as InvestorPortfolioCo[];
}

export async function createPortfolioCo(co: Omit<InvestorPortfolioCo, 'id' | 'created_at'>): Promise<InvestorPortfolioCo> {
  const id = await genericCreate('investor_portfolio', co as Record<string, unknown>, { timestamps: ['created_at'] });
  return (await genericGetById<InvestorPortfolioCo>('investor_portfolio', id))!;
}

export const deletePortfolioCo = (id: string) => genericDelete('investor_portfolio', id);

// Competitors

export async function getAllCompetitors(): Promise<Competitor[]> {
  await ensureInitialized();
  const result = await getClient().execute('SELECT * FROM competitors ORDER BY threat_level DESC, name ASC');
  return result.rows as unknown as Competitor[];
}

const getCompetitor = (id: string) => genericGetById<Competitor>('competitors', id);

export async function createCompetitor(comp: Omit<Competitor, 'id' | 'created_at' | 'updated_at'>): Promise<Competitor> {
  const id = await genericCreate('competitors', comp as Record<string, unknown>);
  return (await getCompetitor(id))!;
}

export async function updateCompetitor(id: string, updates: Partial<Competitor>) {
  await genericUpdate('competitors', id, updates as Record<string, unknown>);
}

export const deleteCompetitor = (id: string) => genericDelete('competitors', id);

// Intelligence Briefs

export async function getIntelligenceBriefs(briefType?: string, investorId?: string): Promise<IntelligenceBrief[]> {
  await ensureInitialized();
  let sql = 'SELECT * FROM intelligence_briefs';
  const args: InValue[] = [];
  const conditions: string[] = [];
  if (briefType) { conditions.push('brief_type = ?'); args.push(briefType); }
  if (investorId) { conditions.push('investor_id = ?'); args.push(investorId); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY updated_at DESC';
  const result = await getClient().execute({ sql, args });
  return result.rows as unknown as IntelligenceBrief[];
}

const getIntelligenceBrief = (id: string) => genericGetById<IntelligenceBrief>('intelligence_briefs', id);

export async function createIntelligenceBrief(brief: Omit<IntelligenceBrief, 'id' | 'created_at' | 'updated_at'>): Promise<IntelligenceBrief> {
  const id = await genericCreate('intelligence_briefs', {
    subject: brief.subject,
    brief_type: brief.brief_type,
    content: brief.content,
    sources: brief.sources,
    investor_id: brief.investor_id || null,
  });
  return (await getIntelligenceBrief(id))!;
}

export const deleteIntelligenceBrief = (id: string) => genericDelete('intelligence_briefs', id);

// Tasks

export async function getAllTasks(filters?: { status?: string; phase?: string; investor_id?: string }): Promise<Task[]> {
  await ensureInitialized();
  let sql = 'SELECT * FROM tasks';
  const args: InValue[] = [];
  const conditions: string[] = [];
  if (filters?.status) { conditions.push('status = ?'); args.push(filters.status); }
  if (filters?.phase) { conditions.push('phase = ?'); args.push(filters.phase); }
  if (filters?.investor_id) { conditions.push('investor_id = ?'); args.push(filters.investor_id); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY CASE priority WHEN \'critical\' THEN 0 WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END, due_date ASC';
  const result = await getClient().execute({ sql, args });
  return result.rows as unknown as Task[];
}

export async function createTask(task: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
  const id = await genericCreate('tasks', {
    title: task.title,
    description: task.description,
    assignee: task.assignee,
    due_date: task.due_date,
    status: task.status,
    priority: task.priority,
    phase: task.phase,
    investor_id: task.investor_id,
    investor_name: task.investor_name,
    auto_generated: task.auto_generated ? 1 : 0,
  });
  return (await genericGetById<Task>('tasks', id))!;
}

export async function updateTask(id: string, updates: Partial<Task>) {
  await genericUpdate('tasks', id, updates as Record<string, unknown>);
}

export const getTask = (id: string) => genericGetById<Task>('tasks', id);
export const deleteTask = (id: string) => genericDelete('tasks', id);

export async function getUpcomingTasks(limit: number = 5): Promise<Task[]> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: `SELECT * FROM tasks WHERE status IN ('pending', 'in_progress') ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, due_date ASC LIMIT ?`,
    args: [limit],
  });
  return result.rows as unknown as Task[];
}

// Activity Log

export async function logActivity(event: Omit<ActivityEvent, 'id' | 'created_at'>): Promise<void> {
  await ensureInitialized();
  await getClient().execute({
    sql: `INSERT INTO activity_log (id, event_type, subject, detail, investor_id, investor_name, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [crypto.randomUUID(), event.event_type, event.subject, event.detail, event.investor_id, event.investor_name],
  });
}

export async function getActivityLog(limit: number = 20, investorId?: string): Promise<ActivityEvent[]> {
  await ensureInitialized();
  if (investorId) {
    const result = await getClient().execute({
      sql: 'SELECT * FROM activity_log WHERE investor_id = ? ORDER BY created_at DESC LIMIT ?',
      args: [investorId, limit],
    });
    return result.rows as unknown as ActivityEvent[];
  }
  const result = await getClient().execute({
    sql: 'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?',
    args: [limit],
  });
  return result.rows as unknown as ActivityEvent[];
}

// Skill execution tracking — product AI skills
export async function logSkillExecution(execution: {
  skill_name: string;
  skill_type?: string;
  version?: number;
  trigger_source?: string;
  input_summary?: string;
  outcome: 'success' | 'partial' | 'failure';
  output_quality?: number;
  parse_success?: boolean;
  latency_ms?: number;
  error_message?: string;
  fields_extracted?: number;
  fields_expected?: number;
  user_accepted?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await ensureInitialized();
  await getClient().execute({
    sql: `INSERT INTO skill_executions (id, skill_name, skill_type, version, trigger_source, input_summary, outcome, output_quality, parse_success, latency_ms, error_message, fields_extracted, fields_expected, user_accepted, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      crypto.randomUUID(),
      execution.skill_name,
      execution.skill_type ?? 'product_ai',
      execution.version ?? 1,
      execution.trigger_source ?? 'api',
      execution.input_summary ?? '',
      execution.outcome,
      execution.output_quality ?? 0,
      execution.parse_success !== false ? 1 : 0,
      execution.latency_ms ?? 0,
      execution.error_message ?? '',
      execution.fields_extracted ?? 0,
      execution.fields_expected ?? 0,
      execution.user_accepted !== false ? 1 : 0,
      JSON.stringify(execution.metadata ?? {}),
    ],
  });
}

export async function getSkillExecutions(skillName?: string, limit: number = 50): Promise<Array<{
  id: string; skill_name: string; skill_type: string; version: number;
  trigger_source: string; outcome: string; output_quality: number;
  parse_success: number; latency_ms: number; error_message: string;
  fields_extracted: number; fields_expected: number; user_accepted: number;
  created_at: string;
}>> {
  await ensureInitialized();
  const sql = skillName
    ? 'SELECT * FROM skill_executions WHERE skill_name = ? ORDER BY created_at DESC LIMIT ?'
    : 'SELECT * FROM skill_executions ORDER BY created_at DESC LIMIT ?';
  const args = skillName ? [skillName, limit] : [limit];
  const result = await getClient().execute({ sql, args });
  return result.rows as unknown as Array<{
    id: string; skill_name: string; skill_type: string; version: number;
    trigger_source: string; outcome: string; output_quality: number;
    parse_success: number; latency_ms: number; error_message: string;
    fields_extracted: number; fields_expected: number; user_accepted: number;
    created_at: string;
  }>;
}

export async function getSkillHealthMetrics(): Promise<Array<{
  skill_name: string; total_executions: number; success_rate: number;
  avg_quality: number; parse_success_rate: number; avg_latency_ms: number;
  last_execution: string;
}>> {
  await ensureInitialized();
  const result = await getClient().execute(
    `SELECT
      skill_name,
      COUNT(*) as total_executions,
      ROUND(100.0 * SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) / COUNT(*), 1) as success_rate,
      ROUND(AVG(output_quality), 2) as avg_quality,
      ROUND(100.0 * SUM(parse_success) / COUNT(*), 1) as parse_success_rate,
      ROUND(AVG(latency_ms), 0) as avg_latency_ms,
      MAX(created_at) as last_execution
    FROM skill_executions
    GROUP BY skill_name
    ORDER BY success_rate ASC, total_executions DESC`
  );
  return result.rows as unknown as Array<{
    skill_name: string; total_executions: number; success_rate: number;
    avg_quality: number; parse_success_rate: number; avg_latency_ms: number;
    last_execution: string;
  }>;
}

// Document Flags

export interface DocumentFlag {
  id: string;
  document_id: string;
  meeting_id: string;
  investor_id: string;
  investor_name: string;
  flag_type: string; // 'objection_response' | 'number_update' | 'section_improvement'
  description: string;
  section_hint: string;
  objection_text: string;
  status: string; // 'open' | 'addressed' | 'dismissed'
  created_at: string;
}

export async function getDocumentFlags(filters?: { status?: string; meeting_id?: string; document_id?: string; investor_id?: string }): Promise<DocumentFlag[]> {
  await ensureInitialized();
  let sql = 'SELECT * FROM document_flags';
  const args: InValue[] = [];
  const conditions: string[] = [];
  if (filters?.status) { conditions.push('status = ?'); args.push(filters.status); }
  if (filters?.meeting_id) { conditions.push('meeting_id = ?'); args.push(filters.meeting_id); }
  if (filters?.document_id) { conditions.push('document_id = ?'); args.push(filters.document_id); }
  if (filters?.investor_id) { conditions.push('investor_id = ?'); args.push(filters.investor_id); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  const result = await getClient().execute({ sql, args });
  return result.rows as unknown as DocumentFlag[];
}

export async function createDocumentFlag(flag: Omit<DocumentFlag, 'id' | 'created_at'>): Promise<DocumentFlag> {
  const id = await genericCreate('document_flags', flag as Record<string, unknown>, { timestamps: ['created_at'] });
  return (await genericGetById<DocumentFlag>('document_flags', id))!;
}

export async function updateDocumentFlag(id: string, updates: { status?: string }) {
  await ensureInitialized();
  if (updates.status) {
    await getClient().execute({
      sql: 'UPDATE document_flags SET status = ? WHERE id = ?',
      args: [updates.status, id],
    });
  }
}

// Post-Meeting Intelligence Pipeline

// Maps objection topics to document section hints and flag types
const OBJECTION_TO_DOC_MAP: Record<string, { section_hint: string; flag_type: string; doc_types: string[] }> = {
  valuation: { section_hint: 'Valuation section, SOTP analysis, comparable companies', flag_type: 'objection_response', doc_types: ['memo', 'exec_brief', 'one_pager'] },
  competition: { section_hint: 'Competitive landscape, moat analysis, differentiation', flag_type: 'objection_response', doc_types: ['memo', 'deck'] },
  market: { section_hint: 'Market sizing, TAM/SAM/SOM, demand drivers', flag_type: 'section_improvement', doc_types: ['memo', 'deck', 'one_pager'] },
  execution: { section_hint: 'Management team, track record, operational plan', flag_type: 'section_improvement', doc_types: ['memo', 'exec_brief'] },
  team: { section_hint: 'Team section, hiring plan, key-person risk', flag_type: 'section_improvement', doc_types: ['memo', 'exec_brief'] },
  financial: { section_hint: 'Financial model, P&L, unit economics, margins', flag_type: 'number_update', doc_types: ['memo', 'one_pager'] },
  timing: { section_hint: 'Timeline, milestones, go-to-market pace', flag_type: 'section_improvement', doc_types: ['memo', 'deck'] },
  structure: { section_hint: 'Deal structure, terms, governance', flag_type: 'objection_response', doc_types: ['memo'] },
  risk: { section_hint: 'Risk section, bear case, sensitivity analysis', flag_type: 'objection_response', doc_types: ['memo', 'exec_brief'] },
  technical: { section_hint: 'Technology section, product architecture, IP', flag_type: 'section_improvement', doc_types: ['memo', 'deck'] },
};

// Determine task priority based on investor tier
function getPriorityForTier(tier: number): TaskPriority {
  if (tier === 1) return 'critical';
  if (tier === 2) return 'high';
  if (tier === 3) return 'medium';
  return 'low';
}

// Determine due date offset based on action type keywords
function getDueDateForAction(actionText: string): string {
  const now = new Date();
  const lower = actionText.toLowerCase();

  // Urgent: same day / next day
  if (lower.includes('send') || lower.includes('email') || lower.includes('share') || lower.includes('forward') || lower.includes('thank you') || lower.includes('follow up email')) {
    return new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }
  // Near-term: 2-3 days
  if (lower.includes('schedule') || lower.includes('call') || lower.includes('intro') || lower.includes('connect') || lower.includes('coordinate')) {
    return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }
  // Medium: 5-7 days
  if (lower.includes('prepare') || lower.includes('dd') || lower.includes('due diligence') || lower.includes('model') || lower.includes('update') || lower.includes('revise')) {
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }
  // Default: 5 days
  return new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

// Determine phase from meeting status
function getPhaseFromStatus(status: string): RaisePhase {
  switch (status) {
    case 'in_dd': return 'due_diligence';
    case 'term_sheet': return 'term_sheets';
    case 'negotiation': return 'negotiation';
    case 'engaged': return 'management_presentations';
    default: return 'outreach';
  }
}

export interface PostMeetingActions {
  tasks: Task[];
  document_flags: DocumentFlag[];
  investor_updates: {
    enthusiasm: number;
    suggested_status: string;
    previous_status?: string;
    previous_enthusiasm?: number;
    auto_advanced?: { from: string; to: string };
  };
}

export async function processPostMeetingIntelligence(
  meeting: Meeting,
  aiData: Record<string, unknown>,
  investorTier: number,
): Promise<PostMeetingActions> {
  const results: PostMeetingActions = {
    tasks: [],
    document_flags: [],
    investor_updates: {
      enthusiasm: (aiData.enthusiasm_score as number) || 3,
      suggested_status: (aiData.suggested_status as string) || 'met',
    },
  };

  const suggestedStatus = (aiData.suggested_status as string) || 'met';
  const phase = getPhaseFromStatus(suggestedStatus);
  const priority = getPriorityForTier(investorTier);

  // 1. Parse next_steps and generate granular tasks
  const nextSteps = meeting.next_steps || (aiData.next_steps as string) || '';
  if (nextSteps) {
    // Split next_steps into individual actions (by newline, semicolons, bullet points, or numbered items)
    const actionLines = nextSteps
      .split(/[\n;]|(?:\d+\.\s)/)
      .map(s => s.replace(/^[-•*]\s*/, '').trim())
      .filter(s => s.length > 5);

    if (actionLines.length > 0) {
      const taskResults = await Promise.all(actionLines.map(action => {
        const dueDate = getDueDateForAction(action);
        return createTask({
          title: `${action.charAt(0).toUpperCase() + action.slice(1)}`,
          description: `Auto-generated from meeting with ${meeting.investor_name} on ${meeting.date}.\n\nOriginal next steps: ${nextSteps}`,
          assignee: '',
          due_date: dueDate,
          status: 'pending',
          priority,
          phase,
          investor_id: meeting.investor_id,
          investor_name: meeting.investor_name,
          auto_generated: true,
        });
      }));
      results.tasks.push(...taskResults);
    } else {
      // Single block of next steps — create one follow-up task
      results.tasks.push(await createTask({
        title: `Follow up: ${meeting.investor_name}`,
        description: nextSteps,
        assignee: '',
        due_date: getDueDateForAction(nextSteps),
        status: 'pending',
        priority,
        phase,
        investor_id: meeting.investor_id,
        investor_name: meeting.investor_name,
        auto_generated: true,
      }));
    }
  }

  // 2. Create tasks from objections (showstoppers and significant)
  try {
    const objections = JSON.parse(meeting.objections || '[]') as { text: string; severity: string; topic: string }[];
    const criticalObjections = objections.filter(o => o.severity === 'showstopper' || o.severity === 'significant');
    if (criticalObjections.length > 0) {
      results.tasks.push(await createTask({
        title: `Address ${criticalObjections.length} objection${criticalObjections.length > 1 ? 's' : ''} from ${meeting.investor_name}`,
        description: criticalObjections.map(o => `[${o.severity.toUpperCase()}] ${o.text} (topic: ${o.topic})`).join('\n'),
        assignee: '',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        priority: criticalObjections.some(o => o.severity === 'showstopper') ? 'critical' : 'high',
        phase: 'preparation',
        investor_id: meeting.investor_id,
        investor_name: meeting.investor_name,
        auto_generated: true,
      }));
    }
  } catch { /* skip malformed */ }

  // 3. Stage-specific tasks
  if (suggestedStatus === 'in_dd') {
    results.tasks.push(await createTask({
      title: `Prepare DD materials for ${meeting.investor_name}`,
      description: 'Prepare data room access, financial model, management reference list, and DD request responses.',
      assignee: '',
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pending',
      priority,
      phase: 'due_diligence',
      investor_id: meeting.investor_id,
      investor_name: meeting.investor_name,
      auto_generated: true,
    }));
  } else if (suggestedStatus === 'engaged') {
    results.tasks.push(await createTask({
      title: `Send follow-up materials to ${meeting.investor_name}`,
      description: 'Send deck, one-pager, executive brief, or additional materials requested during the meeting.',
      assignee: '',
      due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pending',
      priority,
      phase: 'management_presentations',
      investor_id: meeting.investor_id,
      investor_name: meeting.investor_name,
      auto_generated: true,
    }));
  }

  // 4. Generate document flags from objections
  try {
    const objections = JSON.parse(meeting.objections || '[]') as { text: string; severity: string; topic: string }[];
    // Get all documents to match against
    const allDocs = await getAllDocuments();

    const flagPromises: Promise<typeof results.document_flags[0]>[] = [];
    for (const objection of objections) {
      const mapping = OBJECTION_TO_DOC_MAP[objection.topic] || OBJECTION_TO_DOC_MAP['execution'];

      // Find matching documents by type
      const matchingDocs = allDocs.filter(d => mapping.doc_types.includes(d.type));

      if (matchingDocs.length > 0) {
        for (const doc of matchingDocs) {
          flagPromises.push(createDocumentFlag({
            document_id: doc.id,
            meeting_id: meeting.id,
            investor_id: meeting.investor_id,
            investor_name: meeting.investor_name,
            flag_type: objection.severity === 'showstopper' ? 'objection_response' : mapping.flag_type,
            description: `${meeting.investor_name} raised a ${objection.severity} objection about ${objection.topic}: "${objection.text}". Review and strengthen this section.`,
            section_hint: mapping.section_hint,
            objection_text: objection.text,
            status: 'open',
          }));
        }
      } else {
        // Flag without a specific document — general flag
        flagPromises.push(createDocumentFlag({
          document_id: '',
          meeting_id: meeting.id,
          investor_id: meeting.investor_id,
          investor_name: meeting.investor_name,
          flag_type: mapping.flag_type,
          description: `${meeting.investor_name} raised a ${objection.severity} objection about ${objection.topic}: "${objection.text}". No matching document found — consider creating content to address this.`,
          section_hint: mapping.section_hint,
          objection_text: objection.text,
          status: 'open',
        }));
      }
    }
    const flagResults = await Promise.all(flagPromises);
    results.document_flags.push(...flagResults);
  } catch { /* skip malformed */ }

  // 5. Engagement signal-based flags
  try {
    const signals = JSON.parse(meeting.engagement_signals || '{}') as {
      pricing_reception?: string;
      slides_that_fell_flat?: string[];
    };

    const engagementFlagPromises: Promise<typeof results.document_flags[0]>[] = [];

    if (signals.pricing_reception === 'negative') {
      const pricingDocs = (await getAllDocuments()).filter(d => ['memo', 'exec_brief', 'one_pager', 'deck'].includes(d.type));
      for (const doc of pricingDocs) {
        engagementFlagPromises.push(createDocumentFlag({
          document_id: doc.id,
          meeting_id: meeting.id,
          investor_id: meeting.investor_id,
          investor_name: meeting.investor_name,
          flag_type: 'section_improvement',
          description: `Pricing received negatively by ${meeting.investor_name}. Consider strengthening valuation justification and comparable analysis.`,
          section_hint: 'Valuation, pricing justification, comparable valuations',
          objection_text: 'Negative pricing reception',
          status: 'open',
        }));
      }
    }

    if (signals.slides_that_fell_flat && signals.slides_that_fell_flat.length > 0) {
      const deckDocs = (await getAllDocuments()).filter(d => d.type === 'deck');
      for (const doc of deckDocs) {
        engagementFlagPromises.push(createDocumentFlag({
          document_id: doc.id,
          meeting_id: meeting.id,
          investor_id: meeting.investor_id,
          investor_name: meeting.investor_name,
          flag_type: 'section_improvement',
          description: `Slides that fell flat with ${meeting.investor_name}: ${signals.slides_that_fell_flat.join(', ')}. Consider reworking these sections.`,
          section_hint: signals.slides_that_fell_flat.join(', '),
          objection_text: '',
          status: 'open',
        }));
      }
    }

    const engagementFlagResults = await Promise.all(engagementFlagPromises);
    results.document_flags.push(...engagementFlagResults);
  } catch { /* skip malformed */ }

  // 6. Update investor profile (auto-advance only if forward move, enthusiasm >= 3, not to closed/term_sheet)
  const investor = await getInvestor(meeting.investor_id);
  if (investor) {
    results.investor_updates.previous_status = investor.status;
    results.investor_updates.previous_enthusiasm = investor.enthusiasm;
    const enthusiasm = (aiData.enthusiasm_score as number) || investor.enthusiasm;
    const curIdx = PIPELINE_ORDER.indexOf(investor.status);
    const newIdx = PIPELINE_ORDER.indexOf(suggestedStatus);
    const manualOnly = ['closed', 'term_sheet'];
    const shouldAdvance = newIdx > curIdx && enthusiasm >= 3 && !manualOnly.includes(suggestedStatus);

    await updateInvestor(meeting.investor_id, {
      ...(shouldAdvance ? { status: suggestedStatus as Investor['status'] } : {}),
      enthusiasm,
    });
    if (shouldAdvance) {
      results.investor_updates.auto_advanced = { from: investor.status, to: suggestedStatus };
    }
  }

  // --- Objection Learning: Auto-close objections addressed in this meeting ---
  try {
    const investorId = meeting.investor_id;
    const priorObjections = await getObjectionsByInvestor(investorId);
    const meetingNotes = ((meeting.raw_notes || '') + ' ' + (meeting.next_steps || '')).toLowerCase();

    for (const obj of priorObjections) {
      if (obj.effectiveness && obj.effectiveness !== 'unknown') continue; // already rated

      const objTopic = (obj.objection_topic || '').toLowerCase();
      const objText = (obj.objection_text || '').toLowerCase();

      // Check if this meeting's notes reference the objection topic
      const topicWords = objTopic.split(/\s+/).filter(w => w.length > 3);
      const mentionsObj = topicWords.some(w => meetingNotes.includes(w)) ||
        (objText.length > 10 && objText.split(/\s+/).filter(w => w.length > 4).some(w => meetingNotes.includes(w)));

      if (mentionsObj) {
        // Measure effectiveness by enthusiasm delta
        const currentEnthusiasm = meeting.enthusiasm_score || 3;
        const objMeetingEnthusiasm = (obj as unknown as Record<string, unknown>).enthusiasm_at_objection as number || 3;
        const delta = currentEnthusiasm - objMeetingEnthusiasm;

        let effectiveness: string;
        if (delta >= 1) effectiveness = 'effective';
        else if (delta >= 0) effectiveness = 'partially_effective';
        else effectiveness = 'ineffective';

        await updateObjectionResponse(
          obj.id,
          `Addressed in meeting on ${meeting.date}. Enthusiasm moved ${delta >= 0 ? '+' : ''}${delta}.`,
          effectiveness,
        );
      }
    }
  } catch { /* non-blocking objection learning */ }

  // --- Followup Efficacy: Measure lift from recent followups ---
  try {
    await measureFollowupEfficacy(meeting.investor_id);
  } catch { /* non-blocking */ }

  // --- Compound cascade: meeting intelligence feeds into broader analysis (cycle 13) ---
  try {
    // Re-check narrative health after new data point
    const narrativeSignals = await computeNarrativeSignals();
    const investorType = investor?.type || 'vc';
    const typeSignal = narrativeSignals.find(s => s.investorType === investorType);

    // If this investor type is struggling, auto-create action
    if (typeSignal && typeSignal.avgEnthusiasm < 2.5) {
      const existingActions = await getAccelerationActions();
      const hasTypeAction = existingActions.some(a =>
        a.description.includes(investorType) && a.status === 'pending'
      );
      if (!hasTypeAction) {
        await createAccelerationAction({
          investor_id: `narrative_${investorType}`,
          investor_name: null,
          trigger_type: 'catalyst_match',
          action_type: 'data_update',
          description: `[AUTO] "${investorType}" investors averaging ${typeSignal.avgEnthusiasm.toFixed(1)}/5 enthusiasm after latest meeting — adapt pitch for this investor type`,
          expected_lift: 7,
          confidence: 'medium',
          status: 'pending',
          actual_lift: null,
          executed_at: null,
        });
      }
    }
  } catch { /* non-blocking */ }

  // --- Compound cascade: detect compound signals and auto-create high-confidence actions (cycle 13) ---
  try {
    const compoundSignals = await detectCompoundSignals();
    const veryHighSignals = compoundSignals.filter(s => s.confidence === 'very_high');
    for (const cs of veryHighSignals.slice(0, 3)) {
      // Extract investor name from signal for dedup
      const syntheticId = `compound_${cs.sources.join('_')}_${Date.now()}`;
      await createAccelerationAction({
        investor_id: syntheticId,
        investor_name: null,
        trigger_type: 'catalyst_match',
        action_type: 'escalation',
        description: `[AUTO-COMPOUND] ${cs.recommendation}`,
        expected_lift: 15,
        confidence: 'high',
        status: 'pending',
        actual_lift: null,
        executed_at: null,
      });
    }
  } catch { /* non-blocking */ }

  return results;
}

// Get all post-meeting actions for a specific meeting
export async function getMeetingActions(meetingId: string): Promise<PostMeetingActions | null> {
  const meeting = await getMeeting(meetingId);
  if (!meeting) return null;

  // Get tasks linked to this investor that were auto-generated around the meeting time
  const allTasks = await getAllTasks({ investor_id: meeting.investor_id });
  const meetingTasks = allTasks.filter(t =>
    t.auto_generated &&
    t.investor_id === meeting.investor_id &&
    // Tasks created within 1 minute of the meeting
    Math.abs(new Date(t.created_at).getTime() - new Date(meeting.created_at).getTime()) < 60000
  );

  // Get document flags for this meeting
  const flags = await getDocumentFlags({ meeting_id: meetingId });

  // Get investor for current state
  const investor = await getInvestor(meeting.investor_id);

  return {
    tasks: meetingTasks,
    document_flags: flags,
    investor_updates: {
      enthusiasm: meeting.enthusiasm_score,
      suggested_status: meeting.status_after,
      previous_status: investor?.status,
      previous_enthusiasm: investor?.enthusiasm,
    },
  };
}

// Intelligence context for AI workspace
export async function getIntelligenceContext(): Promise<string> {
  const [deals, competitors, briefs] = await Promise.all([
    getAllMarketDeals(),
    getAllCompetitors(),
    getIntelligenceBriefs(),
  ]);
  const parts: string[] = [];
  if (deals.length > 0) {
    parts.push('## Recent Market Deals\n' + deals.slice(0, 10).map(d =>
      `- ${d.company}: ${d.round} ${d.amount} at ${d.valuation} (${d.date}) — Led by ${d.lead_investors}. ${d.relevance}`
    ).join('\n'));
  }
  if (competitors.length > 0) {
    parts.push('## Competitors\n' + competitors.map(c =>
      `- ${c.name} [${c.threat_level}]: ${c.positioning}. Last round: ${c.last_round} at ${c.last_valuation}. Our advantage: ${c.our_advantage}`
    ).join('\n'));
  }
  if (briefs.length > 0) {
    parts.push('## Intelligence Briefs\n' + briefs.slice(0, 5).map(b =>
      `- [${b.brief_type}] ${b.subject}: ${b.content.substring(0, 500)}...`
    ).join('\n'));
  }
  return parts.length > 0 ? parts.join('\n\n') : 'No intelligence data yet.';
}

// Objection Responses / Playbook

export interface ObjectionRecord {
  id: string;
  objection_text: string;
  objection_topic: string;
  investor_id: string | null;
  investor_name: string | null;
  meeting_id: string | null;
  response_text: string;
  effectiveness: 'effective' | 'partially_effective' | 'ineffective' | 'unknown';
  next_meeting_enthusiasm_delta: number;
  created_at: string;
  updated_at: string;
}

export async function getObjectionPlaybook(): Promise<{
  topic: string;
  objections: ObjectionRecord[];
  count: number;
  best_response: ObjectionRecord | null;
  effectiveness_distribution: { effective: number; partially_effective: number; ineffective: number; unknown: number };
}[]> {
  await ensureInitialized();
  const result = await getClient().execute('SELECT * FROM objection_responses ORDER BY created_at DESC');
  const all = result.rows as unknown as ObjectionRecord[];

  const byTopic = new Map<string, ObjectionRecord[]>();
  for (const rec of all) {
    const topic = rec.objection_topic || 'general';
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic)!.push(rec);
  }

  return Array.from(byTopic.entries())
    .map(([topic, objections]) => {
      const dist = { effective: 0, partially_effective: 0, ineffective: 0, unknown: 0 };
      let best: ObjectionRecord | null = null;
      for (const o of objections) {
        dist[o.effectiveness as keyof typeof dist] = (dist[o.effectiveness as keyof typeof dist] || 0) + 1;
        if (o.effectiveness === 'effective' && o.response_text) {
          if (!best || o.next_meeting_enthusiasm_delta > best.next_meeting_enthusiasm_delta) {
            best = o;
          }
        }
      }
      return { topic, objections, count: objections.length, best_response: best, effectiveness_distribution: dist };
    })
    .sort((a, b) => b.count - a.count);
}

export async function createObjectionRecord(data: {
  objection_text: string;
  objection_topic: string;
  investor_id?: string;
  investor_name?: string;
  meeting_id?: string;
  response_text?: string;
  effectiveness?: string;
  enthusiasm_at_objection?: number;
}): Promise<ObjectionRecord> {
  const id = await genericCreate('objection_responses', {
    objection_text: data.objection_text,
    objection_topic: data.objection_topic,
    investor_id: data.investor_id || null,
    investor_name: data.investor_name || null,
    meeting_id: data.meeting_id || null,
    response_text: data.response_text || '',
    effectiveness: data.effectiveness || 'unknown',
    next_meeting_enthusiasm_delta: 0,
    enthusiasm_at_objection: data.enthusiasm_at_objection ?? 0,
  });
  return (await genericGetById<ObjectionRecord>('objection_responses', id))!;
}

export async function updateObjectionResponse(id: string, response: string, effectiveness: string): Promise<void> {
  await ensureInitialized();
  await getClient().execute({
    sql: `UPDATE objection_responses SET response_text = ?, effectiveness = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [response, effectiveness, id],
  });
}

export async function getTopObjections(limit: number = 10): Promise<{ objection_text: string; objection_topic: string; count: number; has_effective_response: boolean }[]> {
  await ensureInitialized();
  const result = await getClient().execute('SELECT * FROM objection_responses ORDER BY created_at DESC');
  const all = result.rows as unknown as ObjectionRecord[];

  const grouped = new Map<string, { topic: string; count: number; has_effective: boolean }>();
  for (const rec of all) {
    const key = rec.objection_text.toLowerCase().trim();
    const existing = grouped.get(key);
    if (existing) {
      existing.count++;
      if (rec.effectiveness === 'effective') existing.has_effective = true;
    } else {
      grouped.set(key, {
        topic: rec.objection_topic,
        count: 1,
        has_effective: rec.effectiveness === 'effective',
      });
    }
  }

  return Array.from(grouped.entries())
    .map(([text, data]) => ({
      objection_text: text,
      objection_topic: data.topic,
      count: data.count,
      has_effective_response: data.has_effective,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getBestResponses(topic: string): Promise<ObjectionRecord[]> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: `SELECT * FROM objection_responses WHERE objection_topic = ? AND response_text != '' ORDER BY
      CASE effectiveness
        WHEN 'effective' THEN 0
        WHEN 'partially_effective' THEN 1
        WHEN 'unknown' THEN 2
        WHEN 'ineffective' THEN 3
      END ASC, next_meeting_enthusiasm_delta DESC`,
    args: [topic],
  });
  return result.rows as unknown as ObjectionRecord[];
}

export async function getObjectionsByInvestor(investorId: string): Promise<ObjectionRecord[]> {
  return genericGetByField<ObjectionRecord>('objection_responses', 'investor_id', investorId, { orderBy: 'created_at DESC' });
}

export async function updateObjectionEnthusiasmDelta(investorId: string, enthusiasmDelta: number): Promise<void> {
  await ensureInitialized();
  // Update the most recent objections for this investor that don't yet have a delta
  await getClient().execute({
    sql: `UPDATE objection_responses SET next_meeting_enthusiasm_delta = ?, effectiveness = CASE
      WHEN ? > 0 THEN 'effective'
      WHEN ? = 0 AND effectiveness = 'unknown' THEN 'partially_effective'
      ELSE effectiveness
    END, updated_at = datetime('now')
    WHERE investor_id = ? AND next_meeting_enthusiasm_delta = 0 AND effectiveness = 'unknown'`,
    args: [enthusiasmDelta, enthusiasmDelta, enthusiasmDelta, investorId],
  });
}

// ---------------------------------------------------------------------------
// Score Snapshots
// ---------------------------------------------------------------------------

export interface ScoreSnapshot {
  id: string;
  investor_id: string;
  overall_score: number;
  engagement_score: number | null;
  momentum_score: number | null;
  enthusiasm: number | null;
  meeting_count: number | null;
  predicted_outcome: string | null;
  snapshot_date: string;
  created_at: string;
}

export async function upsertScoreSnapshot(snapshot: {
  investor_id: string;
  overall_score: number;
  engagement_score?: number;
  momentum_score?: number;
  enthusiasm?: number;
  meeting_count?: number;
  predicted_outcome?: string;
}): Promise<void> {
  await ensureInitialized();
  const db = getClient();
  const today = new Date().toISOString().split('T')[0];
  const id = `snap_${snapshot.investor_id}_${today}`;

  await db.execute({
    sql: `INSERT OR REPLACE INTO score_snapshots (id, investor_id, overall_score, engagement_score, momentum_score, enthusiasm, meeting_count, predicted_outcome, snapshot_date, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      id,
      snapshot.investor_id,
      snapshot.overall_score,
      snapshot.engagement_score ?? null,
      snapshot.momentum_score ?? null,
      snapshot.enthusiasm ?? null,
      snapshot.meeting_count ?? null,
      snapshot.predicted_outcome ?? null,
      today,
    ] as InValue[],
  });
}

export async function getScoreSnapshots(investorId: string, limit: number = 90): Promise<ScoreSnapshot[]> {
  return genericGetByField<ScoreSnapshot>('score_snapshots', 'investor_id', investorId, { orderBy: 'snapshot_date ASC', limit });
}

// ---------------------------------------------------------------------------
// Score Reversal Detection + Pipeline Rankings (cycle 26)
// ---------------------------------------------------------------------------

export interface ScoreReversal {
  investorId: string;
  investorName: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  previousDate: string;
  currentDate: string;
  severity: 'critical' | 'warning' | 'notable';
}

export interface PipelineRanking {
  rank: number;
  previousRank: number | null;
  rankChange: number; // positive = moved up, negative = moved down
  investorId: string;
  investorName: string;
  tier: number;
  score: number;
  status: string;
}

export function detectScoreReversals(): Promise<ScoreReversal[]> {
  return cachedCompute('detectScoreReversals', 120_000, async () => {
  await ensureInitialized();
  const db = getClient();

  // Get latest 2 snapshots per investor
  const result = await db.execute(`
    SELECT s.investor_id, s.overall_score, s.snapshot_date, i.name
    FROM score_snapshots s
    JOIN investors i ON i.id = s.investor_id
    WHERE i.status NOT IN ('passed', 'dropped', 'closed')
    ORDER BY s.investor_id, s.snapshot_date DESC
  `);

  const byInvestor: Record<string, Array<{ score: number; date: string; name: string }>> = {};
  for (const row of result.rows) {
    const id = row.investor_id as string;
    if (!byInvestor[id]) byInvestor[id] = [];
    if (byInvestor[id].length < 2) {
      byInvestor[id].push({
        score: row.overall_score as number,
        date: row.snapshot_date as string,
        name: row.name as string,
      });
    }
  }

  const reversals: ScoreReversal[] = [];
  for (const [investorId, snapshots] of Object.entries(byInvestor)) {
    if (snapshots.length < 2) continue;
    const [current, previous] = snapshots; // sorted DESC
    const delta = current.score - previous.score;

    if (delta <= -15) {
      reversals.push({
        investorId,
        investorName: current.name,
        previousScore: previous.score,
        currentScore: current.score,
        delta,
        previousDate: previous.date,
        currentDate: current.date,
        severity: delta <= -25 ? 'critical' : 'warning',
      });
    } else if (delta <= -10) {
      reversals.push({
        investorId,
        investorName: current.name,
        previousScore: previous.score,
        currentScore: current.score,
        delta,
        previousDate: previous.date,
        currentDate: current.date,
        severity: 'notable',
      });
    }
  }

  // Sort by severity then delta
  const sevOrder = { critical: 0, warning: 1, notable: 2 };
  reversals.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || a.delta - b.delta);

  return reversals;
  });
}

export function getPipelineRankings(): Promise<PipelineRanking[]> {
  return cachedCompute('getPipelineRankings', 120_000, async () => {
  await ensureInitialized();
  const db = getClient();

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Get today's scores (or most recent)
  const currentResult = await db.execute(`
    SELECT s.investor_id, s.overall_score, i.name, i.tier, i.status
    FROM score_snapshots s
    JOIN investors i ON i.id = s.investor_id
    WHERE i.status NOT IN ('passed', 'dropped', 'closed')
      AND s.snapshot_date = (SELECT MAX(s2.snapshot_date) FROM score_snapshots s2 WHERE s2.investor_id = s.investor_id)
    ORDER BY s.overall_score DESC
  `);

  // Get yesterday's rankings for comparison
  const previousResult = await db.execute({
    sql: `
      SELECT s.investor_id, s.overall_score
      FROM score_snapshots s
      WHERE s.snapshot_date <= ?
        AND s.snapshot_date = (SELECT MAX(s2.snapshot_date) FROM score_snapshots s2 WHERE s2.investor_id = s.investor_id AND s2.snapshot_date <= ?)
    `,
    args: [yesterday, yesterday],
  });

  // Build previous rank map
  const previousScores = (previousResult.rows as unknown as Array<{ investor_id: string; overall_score: number }>)
    .sort((a, b) => b.overall_score - a.overall_score);
  const prevRankMap: Record<string, number> = {};
  previousScores.forEach((row, idx) => { prevRankMap[row.investor_id] = idx + 1; });

  // Build current rankings
  const rankings: PipelineRanking[] = (currentResult.rows as unknown as Array<{
    investor_id: string; overall_score: number; name: string; tier: number; status: string;
  }>).map((row, idx) => {
    const currentRank = idx + 1;
    const previousRank = prevRankMap[row.investor_id] ?? null;
    return {
      rank: currentRank,
      previousRank,
      rankChange: previousRank !== null ? previousRank - currentRank : 0,
      investorId: row.investor_id,
      investorName: row.name,
      tier: row.tier,
      score: row.overall_score,
      status: row.status,
    };
  });

  return rankings;
  });
}

// ---------------------------------------------------------------------------
// Meeting Density + FOMO Dynamics (cycle 27)
// ---------------------------------------------------------------------------

export interface MeetingDensity {
  weeklyDistribution: { week: string; count: number }[];
  currentWeekCount: number;
  avgPerWeek: number;
  gapWeeks: string[]; // weeks with zero meetings
  clusterWeeks: string[]; // weeks with 3+ meetings
  densityScore: number; // 0-100, higher = more evenly distributed
  insight: string;
}

export interface FomoDynamic {
  advancingInvestor: string;
  advancingTo: string;
  affectedInvestors: { name: string; tier: number; status: string; daysInStage: number }[];
  fomoIntensity: 'high' | 'medium' | 'low';
  recommendation: string;
}

export function computeMeetingDensity(): Promise<MeetingDensity> {
  return cachedCompute('computeMeetingDensity', 120_000, async () => {
  await ensureInitialized();
  const db = getClient();

  // Get meetings from last 12 weeks
  const result = await db.execute(`
    SELECT date FROM meetings
    WHERE date >= date('now', '-84 days')
    ORDER BY date ASC
  `);

  const meetings = result.rows as unknown as Array<{ date: string }>;

  // Group by ISO week
  const weekMap: Record<string, number> = {};
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getTime() - i * 7 * 86400000);
    const week = getISOWeek(d);
    weekMap[week] = 0;
  }

  for (const m of meetings) {
    const week = getISOWeek(new Date(m.date));
    if (weekMap[week] !== undefined) weekMap[week]++;
    else weekMap[week] = 1;
  }

  const weeks = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));

  const counts = weeks.map(w => w.count);
  const totalMeetings = counts.reduce((s, c) => s + c, 0);
  const avgPerWeek = counts.length > 0 ? Math.round((totalMeetings / counts.length) * 10) / 10 : 0;
  const currentWeekCount = weeks.length > 0 ? weeks[weeks.length - 1].count : 0;
  const gapWeeks = weeks.filter(w => w.count === 0).map(w => w.week);
  const clusterWeeks = weeks.filter(w => w.count >= 3).map(w => w.week);

  // Density score: coefficient of variation (lower variance = higher score)
  const variance = counts.length > 1
    ? counts.reduce((s, c) => s + Math.pow(c - avgPerWeek, 2), 0) / counts.length
    : 0;
  const cv = avgPerWeek > 0 ? Math.sqrt(variance) / avgPerWeek : 1;
  const densityScore = Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));

  let insight = '';
  if (gapWeeks.length >= 3) {
    insight = `${gapWeeks.length} gap weeks (zero meetings) in last 12 weeks — engagement is sporadic. Aim for at least 1-2 meetings every week.`;
  } else if (clusterWeeks.length >= 2 && gapWeeks.length >= 1) {
    insight = `Meetings are clustered — ${clusterWeeks.length} busy weeks vs ${gapWeeks.length} dead weeks. Spread meetings more evenly for sustained momentum.`;
  } else if (densityScore >= 70) {
    insight = `Good meeting cadence (density score ${densityScore}/100). Meetings well-distributed across weeks.`;
  } else {
    insight = `Meeting density ${densityScore}/100. ${avgPerWeek} meetings/week average.`;
  }

  return {
    weeklyDistribution: weeks,
    currentWeekCount,
    avgPerWeek,
    gapWeeks,
    clusterWeeks,
    densityScore,
    insight,
  };
  });
}

function getISOWeek(date: Date): string {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + (jan4.getDay() + 6) % 7) / 7) + 1;
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export interface EngagementVelocity {
  investorId: string;
  investorName: string;
  tier: number;
  recentMeetings: number; // last 14 days
  previousMeetings: number; // 15-28 days ago
  acceleration: 'accelerating' | 'decelerating' | 'stable' | 'new' | 'gone_silent';
  daysSinceLastMeeting: number | null;
  avgDaysBetweenMeetings: number | null;
  signal: string;
}

export function computeEngagementVelocity(): Promise<EngagementVelocity[]> {
  return cachedCompute('computeEngagementVelocity', 120_000, async () => {
  await ensureInitialized();
  const db = getClient();

  const result = await db.execute(`
    SELECT m.investor_id, m.date, i.name, i.tier, i.status
    FROM meetings m
    JOIN investors i ON i.id = m.investor_id
    WHERE i.status NOT IN ('passed', 'dropped', 'closed')
    ORDER BY m.investor_id, m.date DESC
  `);

  const byInvestor: Record<string, { name: string; tier: number; status: string; dates: string[] }> = {};
  for (const row of result.rows) {
    const id = row.investor_id as string;
    if (!byInvestor[id]) byInvestor[id] = { name: row.name as string, tier: row.tier as number, status: row.status as string, dates: [] };
    byInvestor[id].dates.push(row.date as string);
  }

  const now = Date.now();
  const msPerDay = 1000 * 60 * 60 * 24;
  const velocities: EngagementVelocity[] = [];

  for (const [investorId, data] of Object.entries(byInvestor)) {
    const { name, tier, dates } = data;

    // Count meetings in windows
    const recent = dates.filter(d => (now - new Date(d).getTime()) / msPerDay <= 14).length;
    const previous = dates.filter(d => {
      const daysAgo = (now - new Date(d).getTime()) / msPerDay;
      return daysAgo > 14 && daysAgo <= 28;
    }).length;

    // Days since last meeting
    const daysSinceLastMeeting = dates.length > 0
      ? Math.round((now - new Date(dates[0]).getTime()) / msPerDay)
      : null;

    // Average days between meetings
    let avgDaysBetweenMeetings: number | null = null;
    if (dates.length >= 2) {
      const sortedDates = [...dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      const gaps: number[] = [];
      for (let i = 1; i < sortedDates.length; i++) {
        gaps.push((new Date(sortedDates[i]).getTime() - new Date(sortedDates[i-1]).getTime()) / msPerDay);
      }
      avgDaysBetweenMeetings = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length);
    }

    // Determine acceleration
    let acceleration: EngagementVelocity['acceleration'] = 'stable';
    let signal = '';

    if (dates.length === 0) continue; // no meetings at all

    if (daysSinceLastMeeting !== null && daysSinceLastMeeting > 28) {
      acceleration = 'gone_silent';
      signal = `No meetings in ${daysSinceLastMeeting} days — engagement has stopped`;
    } else if (recent > previous && recent >= 2) {
      acceleration = 'accelerating';
      signal = `Meeting frequency increasing (${previous}→${recent} in 2-week windows) — momentum building`;
    } else if (recent < previous && previous >= 2) {
      acceleration = 'decelerating';
      signal = `Meeting frequency declining (${previous}→${recent} in 2-week windows) — losing engagement`;
    } else if (dates.length <= 1) {
      acceleration = 'new';
      signal = `Only ${dates.length} meeting(s) — too early to measure velocity`;
    } else {
      signal = `Stable engagement (${recent} recent, ${previous} previous)`;
    }

    velocities.push({
      investorId,
      investorName: name,
      tier,
      recentMeetings: recent,
      previousMeetings: previous,
      acceleration,
      daysSinceLastMeeting,
      avgDaysBetweenMeetings,
      signal,
    });
  }

  // Sort: gone_silent and decelerating first (concerning), then by tier
  const accOrder = { gone_silent: 0, decelerating: 1, new: 2, stable: 3, accelerating: 4 };
  velocities.sort((a, b) => accOrder[a.acceleration] - accOrder[b.acceleration] || a.tier - b.tier);

  return velocities;
  });
}

export function detectFomoDynamics(): Promise<FomoDynamic[]> {
  return cachedCompute('detectFomoDynamics', 120_000, async () => {
  await ensureInitialized();
  const db = getClient();

  // Find investors who recently advanced to a new stage (last 7 days)
  const advancedResult = await db.execute(`
    SELECT i.id, i.name, i.status, i.tier, i.updated_at
    FROM investors i
    WHERE i.status IN ('engaged', 'in_dd', 'term_sheet', 'closed')
      AND i.updated_at >= datetime('now', '-7 days')
    ORDER BY CASE i.status
      WHEN 'term_sheet' THEN 0 WHEN 'in_dd' THEN 1 WHEN 'engaged' THEN 2 WHEN 'closed' THEN 3
    END ASC
  `);

  // Get all active investors at earlier stages
  const activeResult = await db.execute(`
    SELECT i.id, i.name, i.status, i.tier, i.updated_at, i.created_at
    FROM investors i
    WHERE i.status NOT IN ('passed', 'dropped', 'closed')
    ORDER BY i.tier ASC
  `);

  const advancedInvestors = advancedResult.rows as unknown as Array<{
    id: string; name: string; status: string; tier: number; updated_at: string;
  }>;

  const activeInvestors = activeResult.rows as unknown as Array<{
    id: string; name: string; status: string; tier: number; updated_at: string; created_at: string;
  }>;

  const msPerDay = 1000 * 60 * 60 * 24;
  const now = Date.now();
  const stageRank: Record<string, number> = {
    identified: 0, contacted: 1, nda_signed: 2, meeting_scheduled: 3,
    met: 4, engaged: 5, in_dd: 6, term_sheet: 7, closed: 8,
  };

  const fomos: FomoDynamic[] = [];

  for (const adv of advancedInvestors) {
    const advRank = stageRank[adv.status] ?? 0;

    // Find investors who should feel FOMO: similar or higher tier, at an earlier stage
    const affected = activeInvestors
      .filter(a => a.id !== adv.id && (stageRank[a.status] ?? 0) < advRank && a.tier <= adv.tier + 1)
      .map(a => ({
        name: a.name,
        tier: a.tier,
        status: a.status,
        daysInStage: Math.max(0, Math.round((now - new Date(a.updated_at || a.created_at).getTime()) / msPerDay)),
      }));

    if (affected.length === 0) continue;

    const fomoIntensity: 'high' | 'medium' | 'low' =
      adv.status === 'term_sheet' || adv.status === 'closed' ? 'high' :
      adv.status === 'in_dd' ? 'medium' : 'low';

    const recommendation = fomoIntensity === 'high'
      ? `${adv.name} is at ${adv.status} — use this to create urgency with ${affected.slice(0, 3).map(a => a.name).join(', ')}. Mention process is advancing.`
      : fomoIntensity === 'medium'
      ? `${adv.name} entering DD signals commitment — mention this dynamic to investors at earlier stages to accelerate.`
      : `${adv.name} advancing to engaged — subtle competitive signal for other investors.`;

    fomos.push({
      advancingInvestor: adv.name,
      advancingTo: adv.status,
      affectedInvestors: affected.slice(0, 5),
      fomoIntensity,
      recommendation,
    });
  }

  // Sort by intensity
  const intOrder = { high: 0, medium: 1, low: 2 };
  fomos.sort((a, b) => intOrder[a.fomoIntensity] - intOrder[b.fomoIntensity]);

  return fomos;
  });
}

// ---------------------------------------------------------------------------
// Acceleration Actions
// ---------------------------------------------------------------------------

export async function createAccelerationAction(action: Omit<AccelerationAction, 'id' | 'created_at'>): Promise<AccelerationAction> {
  const id = await genericCreate('acceleration_actions', {
    investor_id: action.investor_id,
    investor_name: action.investor_name ?? null,
    trigger_type: action.trigger_type,
    action_type: action.action_type,
    description: action.description,
    expected_lift: action.expected_lift,
    confidence: action.confidence,
    status: action.status,
    actual_lift: action.actual_lift ?? null,
    executed_at: action.executed_at ?? null,
  }, { timestamps: ['created_at'] });
  return (await genericGetById<AccelerationAction>('acceleration_actions', id))!;
}

export async function getAccelerationActions(filters?: { investor_id?: string; status?: string; trigger_type?: string }): Promise<AccelerationAction[]> {
  await ensureInitialized();
  let sql = 'SELECT * FROM acceleration_actions';
  const args: InValue[] = [];
  const conditions: string[] = [];
  if (filters?.investor_id) { conditions.push('investor_id = ?'); args.push(filters.investor_id); }
  if (filters?.status) { conditions.push('status = ?'); args.push(filters.status); }
  if (filters?.trigger_type) { conditions.push('trigger_type = ?'); args.push(filters.trigger_type); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  const result = await getClient().execute({ sql, args });
  return result.rows as unknown as AccelerationAction[];
}

export async function updateAccelerationAction(id: string, updates: { status?: string; actual_lift?: number; executed_at?: string }): Promise<void> {
  await genericUpdate('acceleration_actions', id, updates as Record<string, unknown>, { autoUpdatedAt: false });
}

// ---------------------------------------------------------------------------
// Follow-up Actions
// ---------------------------------------------------------------------------

export async function createFollowup(followup: {
  meeting_id: string;
  investor_id: string;
  investor_name: string;
  action_type: FollowupActionType;
  description: string;
  due_at: string;
}): Promise<FollowupAction> {
  const id = await genericCreate('followup_actions', {
    meeting_id: followup.meeting_id,
    investor_id: followup.investor_id,
    investor_name: followup.investor_name,
    action_type: followup.action_type,
    description: followup.description,
    due_at: followup.due_at,
    status: 'pending',
    outcome: '',
    conviction_delta: 0,
    completed_at: null,
  }, { timestamps: ['created_at'] });
  return (await genericGetById<FollowupAction>('followup_actions', id))!;
}

export async function getFollowups(filters?: {
  status?: FollowupStatus;
  investor_id?: string;
  meeting_id?: string;
}): Promise<FollowupAction[]> {
  await ensureInitialized();
  let sql = 'SELECT * FROM followup_actions';
  const args: InValue[] = [];
  const conditions: string[] = [];
  if (filters?.status) { conditions.push('status = ?'); args.push(filters.status); }
  if (filters?.investor_id) { conditions.push('investor_id = ?'); args.push(filters.investor_id); }
  if (filters?.meeting_id) { conditions.push('meeting_id = ?'); args.push(filters.meeting_id); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY due_at ASC';
  const result = await getClient().execute({ sql, args });
  return result.rows as unknown as FollowupAction[];
}

export async function updateFollowup(id: string, updates: {
  status?: FollowupStatus;
  outcome?: string;
  conviction_delta?: number;
  completed_at?: string;
  executed_at?: string;
  measured_lift?: number;
}): Promise<void> {
  await genericUpdate('followup_actions', id, updates as Record<string, unknown>, { autoUpdatedAt: false });
}

export async function getPendingFollowups(): Promise<FollowupAction[]> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: `SELECT * FROM followup_actions WHERE status = 'pending' ORDER BY due_at ASC`,
    args: [],
  });
  return result.rows as unknown as FollowupAction[];
}

export async function getOverdueFollowups(): Promise<FollowupAction[]> {
  await ensureInitialized();
  const now = new Date().toISOString();
  const result = await getClient().execute({
    sql: `SELECT * FROM followup_actions WHERE status = 'pending' AND due_at < ? ORDER BY due_at ASC`,
    args: [now],
  });
  return result.rows as unknown as FollowupAction[];
}

/**
 * Backfill investor enthusiasm from recent completed follow-ups (cycle 37).
 * Recalculates enthusiasm by blending current value with recency-weighted
 * conviction_delta from follow-ups completed in the last 7 days.
 */
export async function backfillEnthusiasmFromFollowups(
  investorId: string
): Promise<void> {
  await ensureInitialized();
  const db = getClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const result = await db.execute({
    sql: `SELECT conviction_delta, completed_at FROM followup_actions
          WHERE investor_id = ? AND status = 'completed'
            AND completed_at IS NOT NULL AND completed_at >= ?
            AND conviction_delta IS NOT NULL
          ORDER BY completed_at DESC`,
    args: [investorId, sevenDaysAgo],
  });

  const followups = result.rows as unknown as { conviction_delta: number; completed_at: string }[];
  if (followups.length === 0) return;

  const now = Date.now();
  let weightedSum = 0;
  let weightSum = 0;
  for (const fu of followups) {
    const ageD = (now - new Date(fu.completed_at).getTime()) / (1000 * 60 * 60 * 24);
    const weight = Math.max(0.3, 1.0 - ageD / 7);
    weightedSum += fu.conviction_delta * weight;
    weightSum += weight;
  }
  const avgWeightedDelta = weightedSum / weightSum;

  const invResult = await db.execute({
    sql: `SELECT enthusiasm FROM investors WHERE id = ?`,
    args: [investorId],
  });
  if (invResult.rows.length === 0) return;

  const current = (invResult.rows[0] as unknown as { enthusiasm: number }).enthusiasm || 3;
  const deltaInfluence = avgWeightedDelta * 0.3; // max ±1.5 from follow-ups
  const newEnthusiasm = Math.max(1, Math.min(5, current + deltaInfluence));
  const rounded = Math.round(newEnthusiasm * 10) / 10;

  if (Math.abs(rounded - current) >= 0.1) {
    await db.execute({
      sql: `UPDATE investors SET enthusiasm = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [rounded, investorId],
    });
  }
}

/**
 * Get recent follow-up completion signals for context bus (cycle 37).
 * Returns follow-ups completed in last 24h with their conviction deltas.
 */
export async function getRecentFollowupSignals(): Promise<Array<{
  investorId: string;
  investorName: string | null;
  convictionDelta: number;
  actionType: string;
  completedAt: string;
  hoursAgo: number;
}>> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: `SELECT investor_id, investor_name, conviction_delta, action_type, completed_at
          FROM followup_actions
          WHERE status = 'completed' AND completed_at IS NOT NULL
            AND completed_at >= datetime('now', '-24 hours')
            AND conviction_delta IS NOT NULL
          ORDER BY completed_at DESC`,
    args: [],
  });

  const now = Date.now();
  return (result.rows as unknown as Array<{
    investor_id: string; investor_name: string | null;
    conviction_delta: number; action_type: string; completed_at: string;
  }>).map(r => ({
    investorId: r.investor_id,
    investorName: r.investor_name,
    convictionDelta: r.conviction_delta,
    actionType: r.action_type,
    completedAt: r.completed_at,
    hoursAgo: Math.round((now - new Date(r.completed_at).getTime()) / (60 * 60 * 1000)),
  }));
}

async function measureFollowupEfficacy(investorId: string): Promise<void> {
  const db = getClient();

  // Get completed followups for this investor from last 30 days
  const followups = await db.execute({
    sql: `SELECT * FROM followup_actions WHERE investor_id = ? AND status = 'completed' AND created_at > datetime('now', '-30 days') ORDER BY created_at DESC`,
    args: [investorId],
  });

  // Get meetings for this investor
  const meetings = await db.execute({
    sql: `SELECT * FROM meetings WHERE investor_id = ? ORDER BY date ASC`,
    args: [investorId],
  });

  const meetingRows = meetings.rows as unknown as Array<{ date: string; enthusiasm_score: number }>;

  for (const fu of followups.rows) {
    const row = fu as unknown as { id: string; due_at: string; measured_lift: number | null; created_at: string };
    if (row.measured_lift !== null) continue; // already measured

    const fuDate = new Date(row.due_at || row.created_at);

    // Find the meeting just before this followup
    const meetingBefore = meetingRows
      .filter(m => new Date(m.date) <= fuDate)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    // Find the meeting just after this followup (within 14 days)
    const meetingAfter = meetingRows
      .filter(m => {
        const md = new Date(m.date);
        return md > fuDate && (md.getTime() - fuDate.getTime()) < 14 * 24 * 60 * 60 * 1000;
      })
      .sort((a, b) => a.date.localeCompare(b.date))[0];

    if (meetingBefore && meetingAfter) {
      const lift = (meetingAfter.enthusiasm_score || 3) - (meetingBefore.enthusiasm_score || 3);
      await db.execute({
        sql: `UPDATE followup_actions SET measured_lift = ?, executed_at = COALESCE(executed_at, ?) WHERE id = ?`,
        args: [lift, fuDate.toISOString(), row.id],
      });
    }
  }
}

// Generate follow-up choreography after a meeting
export async function generateFollowupChoreography(
  meeting: Meeting,
  aiData: Record<string, unknown>,
  investorTier: number,
): Promise<FollowupAction[]> {
  const results: FollowupAction[] = [];
  const meetingDate = new Date(meeting.date + 'T12:00:00Z');
  const enthusiasm = (aiData.enthusiasm_score as number) || meeting.enthusiasm_score || 3;
  const suggestedStatus = (aiData.suggested_status as string) || meeting.status_after || 'met';

  // Tier 1 gets faster cadence
  const tierMultiplier = investorTier === 1 ? 0.75 : investorTier === 2 ? 1 : 1.5;

  // Parse objections
  let objections: { text: string; severity: string; topic: string }[] = [];
  try {
    objections = JSON.parse(meeting.objections || '[]');
  } catch { /* skip */ }
  const hasShowstopper = objections.some(o => o.severity === 'showstopper');
  const hasSignificant = objections.some(o => o.severity === 'showstopper' || o.severity === 'significant');

  // T+0h: Thank-you note
  const thankYouDue = new Date(meetingDate.getTime() + Math.round(2 * tierMultiplier) * 60 * 60 * 1000);
  const nextSteps = meeting.next_steps || (aiData.next_steps as string) || '';
  const thankYouDesc = `Send personalized thank-you note to ${meeting.investor_name}.` +
    (nextSteps ? `\n\nReference next steps discussed: ${nextSteps}` : '') +
    `\n\nMeeting was a ${meeting.type.replace(/_/g, ' ')} on ${meeting.date}. Enthusiasm level: ${enthusiasm}/5.`;
  results.push(await createFollowup({
    meeting_id: meeting.id,
    investor_id: meeting.investor_id,
    investor_name: meeting.investor_name,
    action_type: 'thank_you',
    description: thankYouDesc,
    due_at: thankYouDue.toISOString(),
  }));

  // T+24h: If unresolved showstopper/significant objection, send targeted response
  if (hasSignificant) {
    const objResponseDue = new Date(meetingDate.getTime() + Math.round(24 * tierMultiplier) * 60 * 60 * 1000);
    const criticalObjs = objections.filter(o => o.severity === 'showstopper' || o.severity === 'significant');
    const objDesc = `Send targeted response to ${criticalObjs.length} unresolved objection${criticalObjs.length > 1 ? 's' : ''} from ${meeting.investor_name}:\n\n` +
      criticalObjs.map(o => `- [${o.severity.toUpperCase()}] ${o.text} (topic: ${o.topic})`).join('\n') +
      `\n\nUse the objection playbook best answers. ${hasShowstopper ? 'SHOWSTOPPER present — this is blocking.' : 'Address before next meeting.'}`;
    results.push(await createFollowup({
      meeting_id: meeting.id,
      investor_id: meeting.investor_id,
      investor_name: meeting.investor_name,
      action_type: 'objection_response',
      description: objDesc,
      due_at: objResponseDue.toISOString(),
    }));
  }

  // T+48h: If enthusiasm >= 4, schedule next meeting / DD session
  if (enthusiasm >= 4) {
    const scheduleDue = new Date(meetingDate.getTime() + Math.round(48 * tierMultiplier) * 60 * 60 * 1000);
    const nextMeetingType = suggestedStatus === 'in_dd' ? 'DD session' :
      suggestedStatus === 'engaged' ? 'deep dive' :
      suggestedStatus === 'term_sheet' ? 'term sheet discussion' : 'follow-up meeting';
    results.push(await createFollowup({
      meeting_id: meeting.id,
      investor_id: meeting.investor_id,
      investor_name: meeting.investor_name,
      action_type: 'schedule_followup',
      description: `Schedule ${nextMeetingType} with ${meeting.investor_name}. Enthusiasm at ${enthusiasm}/5 — capitalize on momentum.\n\nSuggested status: ${suggestedStatus}. ${investorTier === 1 ? 'Tier 1 — prioritize for earliest available slot.' : ''}`,
      due_at: scheduleDue.toISOString(),
    }));
  }

  // Stage-specific: data share after management presentation or deep dive
  if (['management_presentation', 'deep_dive', 'dd_session'].includes(meeting.type)) {
    const dataShareDue = new Date(meetingDate.getTime() + Math.round(24 * tierMultiplier) * 60 * 60 * 1000);
    const materials = suggestedStatus === 'in_dd'
      ? 'data room access, financial model, management reference list, and DD request list'
      : suggestedStatus === 'engaged'
      ? 'executive brief, one-pager, and requested supplementary materials'
      : 'deck and one-pager';
    results.push(await createFollowup({
      meeting_id: meeting.id,
      investor_id: meeting.investor_id,
      investor_name: meeting.investor_name,
      action_type: 'data_share',
      description: `Share materials with ${meeting.investor_name}: ${materials}.\n\nThis is a ${meeting.type.replace(/_/g, ' ')} follow-up. Send within 24h to maintain momentum.`,
      due_at: dataShareDue.toISOString(),
    }));
  }

  // T+5d: Warm re-engagement
  const reengageDue = new Date(meetingDate.getTime() + Math.round(5 * 24 * tierMultiplier) * 60 * 60 * 1000);
  results.push(await createFollowup({
    meeting_id: meeting.id,
    investor_id: meeting.investor_id,
    investor_name: meeting.investor_name,
    action_type: 'warm_reengagement',
    description: `Check in with ${meeting.investor_name} if no response received. Share a relevant new data point (milestone, market intel, or comparable deal).\n\n${investorTier === 1 ? 'Tier 1 investor — consider reaching through warm path if direct channel is silent.' : 'Standard re-engagement.'}`,
    due_at: reengageDue.toISOString(),
  }));

  // T+10d: Escalation via warm path
  const escalateDue = new Date(meetingDate.getTime() + Math.round(10 * 24 * tierMultiplier) * 60 * 60 * 1000);
  results.push(await createFollowup({
    meeting_id: meeting.id,
    investor_id: meeting.investor_id,
    investor_name: meeting.investor_name,
    action_type: 'milestone_update',
    description: `If still no response from ${meeting.investor_name}, escalate via warm path or share a milestone update.\n\n${enthusiasm <= 2 ? 'Low enthusiasm — consider whether to persist or reallocate effort.' : 'Maintain engagement — this investor showed interest.'}`,
    due_at: escalateDue.toISOString(),
  }));

  return results;
}

// Revenue Commitments
export async function getRevenueCommitments(filters?: { status?: string; confidence_min?: number }): Promise<unknown[]> {
  await ensureInitialized();
  let sql = 'SELECT * FROM revenue_commitments';
  const conditions: string[] = [];
  const args: InValue[] = [];
  if (filters?.status) { conditions.push('status = ?'); args.push(filters.status); }
  if (filters?.confidence_min) { conditions.push('confidence >= ?'); args.push(filters.confidence_min); }
  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY amount_eur DESC';
  const result = await getClient().execute({ sql, args });
  return result.rows as unknown[];
}

export async function createRevenueCommitment(commitment: {
  customer: string;
  program: string;
  contract_type: string;
  amount_eur: number;
  start_date?: string;
  end_date?: string;
  annual_amount?: number;
  confidence: number;
  status?: string;
  source_doc?: string;
  notes?: string;
}): Promise<unknown> {
  const id = await genericCreate('revenue_commitments', {
    customer: commitment.customer,
    program: commitment.program || '',
    contract_type: commitment.contract_type || 'firm',
    amount_eur: commitment.amount_eur,
    start_date: commitment.start_date || null,
    end_date: commitment.end_date || null,
    annual_amount: commitment.annual_amount || null,
    confidence: commitment.confidence,
    status: commitment.status || 'active',
    source_doc: commitment.source_doc || '',
    notes: commitment.notes || '',
  });
  return (await genericGetById('revenue_commitments', id))!;
}

export async function updateRevenueCommitment(id: string, updates: Record<string, unknown>): Promise<void> {
  const allowed = new Set(['customer', 'program', 'contract_type', 'amount_eur', 'start_date', 'end_date', 'annual_amount', 'confidence', 'status', 'source_doc', 'notes']);
  const filtered = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.has(k)));
  await genericUpdate('revenue_commitments', id, filtered);
}

export const deleteRevenueCommitment = (id: string) => genericDelete('revenue_commitments', id);

// ---------------------------------------------------------------------------
// Question Pattern Analysis
// ---------------------------------------------------------------------------

export async function extractAndStoreQuestionPatterns(meetingId: string, investorId: string, investorName: string, investorType: string, questionsJson: string, meetingDate: string): Promise<void> {
  await ensureInitialized();
  const db = getClient();
  try {
    const questions = JSON.parse(questionsJson) as Array<{ text?: string; topic?: string }>;
    for (const q of questions) {
      if (!q.text) continue;
      const topic = q.topic || extractTopic(q.text);
      await db.execute({
        sql: `INSERT OR IGNORE INTO question_patterns (id, topic, question_text, investor_id, investor_name, investor_type, meeting_id, meeting_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [crypto.randomUUID(), topic, q.text, investorId, investorName, investorType, meetingId, meetingDate],
      });
    }
  } catch { /* skip malformed */ }
}

function extractTopic(questionText: string): string {
  const text = questionText.toLowerCase();
  const topicKeywords: Record<string, string[]> = {
    'valuation': ['valuation', 'price', 'multiple', 'expensive', 'premium', 'worth'],
    'timeline': ['timeline', 'when', 'schedule', 'delay', 'on time', 'deadline'],
    'competition': ['competitor', 'competition', 'market share', 'differentiat'],
    'team': ['team', 'hire', 'talent', 'ceo', 'founder', 'management', 'key person'],
    'technology': ['technology', 'tech', 'platform', 'product', 'r&d', 'patent'],
    'revenue': ['revenue', 'sales', 'growth', 'customer', 'contract', 'backlog', 'pipeline'],
    'risk': ['risk', 'downside', 'fail', 'worst case', 'what if'],
    'governance': ['governance', 'board', 'control', 'rights', 'protection'],
    'exit': ['exit', 'ipo', 'liquidity', 'return', 'secondary'],
    'capital': ['capital', 'burn', 'runway', 'cash', 'funding', 'dilution'],
    'regulation': ['regulation', 'regulatory', 'compliance', 'government', 'policy', 'itar'],
    'integration': ['integration', 'acquisition', 'merger', 'synergy', 'mynaric'],
  };
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(kw => text.includes(kw))) return topic;
  }
  return 'general';
}

export async function getQuestionPatterns(): Promise<{
  topic: string;
  questionCount: number;
  investorCount: number;
  investorNames: string[];
  investorTypes: string[];
  recentQuestions: string[];
}[]> {
  await ensureInitialized();
  const db = getClient();
  const result = await db.execute(`
    SELECT topic, question_text, investor_name, investor_type, investor_id
    FROM question_patterns
    ORDER BY meeting_date DESC
  `);
  const rows = result.rows as unknown as Array<{ topic: string; question_text: string; investor_name: string; investor_type: string; investor_id: string }>;

  const byTopic = new Map<string, { questions: string[]; investors: Set<string>; investorNames: Set<string>; investorTypes: Set<string> }>();
  for (const row of rows) {
    if (!byTopic.has(row.topic)) {
      byTopic.set(row.topic, { questions: [], investors: new Set(), investorNames: new Set(), investorTypes: new Set() });
    }
    const entry = byTopic.get(row.topic)!;
    entry.questions.push(row.question_text);
    entry.investors.add(row.investor_id);
    entry.investorNames.add(row.investor_name);
    entry.investorTypes.add(row.investor_type);
  }

  return Array.from(byTopic.entries())
    .map(([topic, data]) => ({
      topic,
      questionCount: data.questions.length,
      investorCount: data.investors.size,
      investorNames: Array.from(data.investorNames),
      investorTypes: Array.from(data.investorTypes),
      recentQuestions: data.questions.slice(0, 3),
    }))
    .sort((a, b) => b.investorCount - a.investorCount || b.questionCount - a.questionCount);
}

// ---------------------------------------------------------------------------
// Prediction Calibration
// ---------------------------------------------------------------------------

export async function logPrediction(investorId: string, investorName: string, closeProbability: number, predictedCloseDate: string | null): Promise<void> {
  await ensureInitialized();
  await getClient().execute({
    sql: `INSERT INTO prediction_log (id, investor_id, investor_name, predicted_close_prob, predicted_close_date) VALUES (?, ?, ?, ?, ?)`,
    args: [crypto.randomUUID(), investorId, investorName, closeProbability, predictedCloseDate],
  });
}

export async function resolvePrediction(investorId: string, outcome: 'closed' | 'passed' | 'dropped', closeDate?: string): Promise<void> {
  await ensureInitialized();
  const now = new Date().toISOString();
  await getClient().execute({
    sql: `UPDATE prediction_log SET actual_outcome = ?, actual_close_date = ?, resolved_at = ? WHERE investor_id = ? AND actual_outcome IS NULL`,
    args: [outcome, closeDate || null, now, investorId],
  });
}

export async function getCalibrationData(): Promise<{
  totalPredictions: number;
  resolvedPredictions: number;
  brierScore: number;
  biasDirection: 'over_confident' | 'under_confident' | 'calibrated' | 'insufficient_data';
  byStatus: { status: string; avgPredicted: number; actualRate: number; count: number }[];
}> {
  await ensureInitialized();
  const db = getClient();

  const allResult = await db.execute(`SELECT COUNT(*) as count FROM prediction_log`);
  const totalPredictions = (allResult.rows[0] as unknown as { count: number }).count;

  const resolvedResult = await db.execute(`
    SELECT predicted_close_prob, actual_outcome
    FROM prediction_log
    WHERE actual_outcome IS NOT NULL
  `);
  const resolved = resolvedResult.rows as unknown as Array<{ predicted_close_prob: number; actual_outcome: string }>;

  if (resolved.length < 3) {
    return {
      totalPredictions,
      resolvedPredictions: resolved.length,
      brierScore: 0,
      biasDirection: 'insufficient_data',
      byStatus: [],
    };
  }

  // Brier score: mean squared error of probability predictions
  let brierSum = 0;
  let totalPredictedProb = 0;
  let actualCloseCount = 0;
  for (const r of resolved) {
    const actual = r.actual_outcome === 'closed' ? 1 : 0;
    brierSum += (r.predicted_close_prob - actual) ** 2;
    totalPredictedProb += r.predicted_close_prob;
    actualCloseCount += actual;
  }
  const brierScore = brierSum / resolved.length;

  const avgPredicted = totalPredictedProb / resolved.length;
  const actualRate = actualCloseCount / resolved.length;
  const biasDirection = resolved.length < 5 ? 'insufficient_data' as const :
    avgPredicted > actualRate + 0.1 ? 'over_confident' as const :
    avgPredicted < actualRate - 0.1 ? 'under_confident' as const :
    'calibrated' as const;

  // Compute empirical close rates per investor status bucket
  // Join prediction_log with investors to group by status at time of prediction
  const byStatusResult = await db.execute(`
    SELECT i.status,
           AVG(p.predicted_close_prob) as avg_predicted,
           SUM(CASE WHEN p.actual_outcome = 'closed' THEN 1.0 ELSE 0.0 END) / COUNT(*) as actual_rate,
           COUNT(*) as count
    FROM prediction_log p
    JOIN investors i ON i.id = p.investor_id
    WHERE p.actual_outcome IS NOT NULL
    GROUP BY i.status
    HAVING COUNT(*) >= 2
  `);
  const byStatus = (byStatusResult.rows as unknown as Array<{ status: string; avg_predicted: number; actual_rate: number; count: number }>)
    .map(row => ({
      status: row.status,
      avgPredicted: Math.round(row.avg_predicted * 1000) / 1000,
      actualRate: Math.round(row.actual_rate * 1000) / 1000,
      count: row.count,
    }));

  return {
    totalPredictions,
    resolvedPredictions: resolved.length,
    brierScore: Math.round(brierScore * 1000) / 1000,
    biasDirection,
    byStatus,
  };
}

// ---------------------------------------------------------------------------
// Narrative Drift Detection
// ---------------------------------------------------------------------------

export function computeNarrativeSignals(): Promise<{
  investorType: string;
  avgEnthusiasm: number;
  conversionRate: number;
  topObjection: string;
  topQuestionTopic: string;
  sampleSize: number;
}[]> {
  return cachedCompute('computeNarrativeSignals', 120_000, async () => {
  await ensureInitialized();
  const db = getClient();

  // Get enthusiasm by investor type
  const enthusiasmResult = await db.execute(`
    SELECT i.type as investor_type,
           AVG(m.enthusiasm_score) as avg_enthusiasm,
           COUNT(DISTINCT i.id) as sample_size
    FROM investors i
    JOIN meetings m ON m.investor_id = i.id
    WHERE i.status NOT IN ('passed', 'dropped')
    GROUP BY i.type
  `);
  const enthusiasmByType = new Map<string, { avg: number; sample: number }>();
  for (const row of enthusiasmResult.rows as unknown as Array<{ investor_type: string; avg_enthusiasm: number; sample_size: number }>) {
    enthusiasmByType.set(row.investor_type, { avg: Math.round(row.avg_enthusiasm * 10) / 10, sample: row.sample_size });
  }

  // Get conversion rates by type (reached engaged+ / total met)
  const conversionResult = await db.execute(`
    SELECT type as investor_type,
           COUNT(*) as total,
           SUM(CASE WHEN status IN ('engaged', 'in_dd', 'term_sheet', 'closed') THEN 1 ELSE 0 END) as converted
    FROM investors
    WHERE status NOT IN ('identified')
    GROUP BY type
  `);
  const conversionByType = new Map<string, number>();
  for (const row of conversionResult.rows as unknown as Array<{ investor_type: string; total: number; converted: number }>) {
    conversionByType.set(row.investor_type, row.total > 0 ? Math.round((row.converted / row.total) * 100) : 0);
  }

  // Get top objection by investor type
  const objectionResult = await db.execute(`
    SELECT i.type as investor_type, m.objections
    FROM meetings m
    JOIN investors i ON i.id = m.investor_id
    WHERE m.objections != '[]'
  `);
  const objectionsByType = new Map<string, Map<string, number>>();
  for (const row of objectionResult.rows as unknown as Array<{ investor_type: string; objections: string }>) {
    try {
      const objs = JSON.parse(row.objections) as Array<{ topic?: string; text?: string }>;
      if (!objectionsByType.has(row.investor_type)) objectionsByType.set(row.investor_type, new Map());
      const typeMap = objectionsByType.get(row.investor_type)!;
      for (const o of objs) {
        const topic = o.topic || 'general';
        typeMap.set(topic, (typeMap.get(topic) || 0) + 1);
      }
    } catch { /* skip */ }
  }

  // Get top question topic by investor type
  const questionResult = await db.execute(`
    SELECT investor_type, topic, COUNT(*) as cnt
    FROM question_patterns
    GROUP BY investor_type, topic
    ORDER BY cnt DESC
  `);
  const topQuestionByType = new Map<string, string>();
  for (const row of questionResult.rows as unknown as Array<{ investor_type: string; topic: string; cnt: number }>) {
    if (!topQuestionByType.has(row.investor_type)) {
      topQuestionByType.set(row.investor_type, row.topic);
    }
  }

  // Combine all signals
  const allTypes = new Set([
    ...Array.from(enthusiasmByType.keys()),
    ...Array.from(conversionByType.keys()),
    ...Array.from(objectionsByType.keys()),
  ]);

  return Array.from(allTypes).map(type => {
    const enthusiasm = enthusiasmByType.get(type);
    const objTopics = objectionsByType.get(type);
    let topObjection = 'none';
    if (objTopics) {
      let maxCount = 0;
      Array.from(objTopics.entries()).forEach(([topic, count]) => {
        if (count > maxCount) { maxCount = count; topObjection = topic; }
      });
    }

    return {
      investorType: type,
      avgEnthusiasm: enthusiasm?.avg ?? 0,
      conversionRate: conversionByType.get(type) ?? 0,
      topObjection,
      topQuestionTopic: topQuestionByType.get(type) || 'none',
      sampleSize: enthusiasm?.sample ?? 0,
    };
  });
  });
}

// ---------------------------------------------------------------------------
// Relationship Graph Intelligence
// ---------------------------------------------------------------------------

export interface InvestorRelationship {
  id: string;
  investor_a_id: string;
  investor_b_id: string;
  relationship_type: string; // 'co_investment' | 'warm_path_mention' | 'shared_portfolio' | 'same_syndicate'
  strength: number; // 1-5
  evidence: string;
  created_at: string;
  // Enriched fields (joined at query time)
  investor_a_name?: string;
  investor_b_name?: string;
  investor_a_status?: string;
  investor_b_status?: string;
  investor_a_enthusiasm?: number;
  investor_b_enthusiasm?: number;
}

/**
 * Detect co-investors from market deals:
 * Scans market_deals for pipeline investors appearing in lead_investors/other_investors,
 * then cross-references co-investors against the pipeline to find shared deal history.
 */
async function detectMarketDealCoInvestors(): Promise<{
  investorName: string;
  investorId: string;
  dealCompany: string;
  coInvestors: string[];
  dealRound: string;
}[]> {
  await ensureInitialized();
  const db = getClient();

  const [dealsResult, investorsResult] = await Promise.all([
    db.execute('SELECT company, round, lead_investors, other_investors FROM market_deals'),
    db.execute('SELECT id, name FROM investors WHERE status NOT IN (\'passed\', \'dropped\')'),
  ]);

  const deals = dealsResult.rows as unknown as Array<{
    company: string; round: string; lead_investors: string; other_investors: string;
  }>;
  const pipelineInvestors = investorsResult.rows as unknown as Array<{ id: string; name: string }>;

  const matches: {
    investorName: string;
    investorId: string;
    dealCompany: string;
    coInvestors: string[];
    dealRound: string;
  }[] = [];

  for (const deal of deals) {
    // Parse all investors from the deal (comma-separated strings)
    const leadList = (deal.lead_investors || '').split(',').map(s => s.trim()).filter(Boolean);
    const otherList = (deal.other_investors || '').split(',').map(s => s.trim()).filter(Boolean);
    const allDealInvestors = [...leadList, ...otherList];

    if (allDealInvestors.length === 0) continue;

    // Check if any pipeline investor appears in this deal
    for (const pipelineInv of pipelineInvestors) {
      const nameLC = pipelineInv.name.toLowerCase();
      const matchedInDeal = allDealInvestors.find(di =>
        di.toLowerCase() === nameLC ||
        di.toLowerCase().includes(nameLC) ||
        nameLC.includes(di.toLowerCase())
      );

      if (matchedInDeal) {
        // The co-investors are all deal participants EXCEPT the matched pipeline investor
        const coInvestors = allDealInvestors.filter(di => di !== matchedInDeal);
        if (coInvestors.length > 0) {
          matches.push({
            investorName: pipelineInv.name,
            investorId: pipelineInv.id,
            dealCompany: deal.company,
            coInvestors,
            dealRound: deal.round || 'unknown',
          });
        }
      }
    }
  }

  return matches;
}

/**
 * Build the relationship graph by scanning all investors for:
 * 1. Shared portfolio companies (co-investment signal)
 * 2. Warm path mentions of other investor names
 * 3. Market deal co-investor detection
 * Returns all discovered relationships (also persists them).
 */
export async function buildRelationshipGraph(): Promise<InvestorRelationship[]> {
  await ensureInitialized();
  const db = getClient();

  // Load all investors and their portfolios
  const investorsResult = await db.execute('SELECT id, name, warm_path FROM investors');
  const investors = investorsResult.rows as unknown as Array<{ id: string; name: string; warm_path: string }>;
  const investorNameMap = new Map<string, string>(); // id -> name
  for (const inv of investors) {
    investorNameMap.set(inv.id, inv.name);
  }

  const portfolioResult = await db.execute('SELECT investor_id, company FROM investor_portfolio');
  const portfolioRows = portfolioResult.rows as unknown as Array<{ investor_id: string; company: string }>;

  // Build company -> investor[] map
  const companyInvestors = new Map<string, Set<string>>();
  for (const row of portfolioRows) {
    const companyKey = row.company.toLowerCase().trim();
    if (!companyInvestors.has(companyKey)) companyInvestors.set(companyKey, new Set());
    companyInvestors.get(companyKey)!.add(row.investor_id);
  }

  const discovered: Array<{ a: string; b: string; type: string; strength: number; evidence: string }> = [];

  // 1. Shared portfolio companies = co-investment signal
  for (const [company, investorIds] of companyInvestors.entries()) {
    const ids = Array.from(investorIds);
    if (ids.length < 2) continue;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        discovered.push({
          a: ids[i],
          b: ids[j],
          type: 'co_investment',
          strength: 4, // Strong signal
          evidence: `Both invested in ${company}`,
        });
      }
    }
  }

  // 2. Warm path mentions — check if investor A's warm_path mentions investor B's name
  for (const invA of investors) {
    if (!invA.warm_path) continue;
    const pathLower = invA.warm_path.toLowerCase();
    for (const invB of investors) {
      if (invA.id === invB.id) continue;
      // Check if the warm path contains the other investor's name (or a significant substring)
      const nameWords = invB.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const fullNameMatch = pathLower.includes(invB.name.toLowerCase());
      const partialMatch = nameWords.length > 0 && nameWords.some(w => pathLower.includes(w));

      if (fullNameMatch || partialMatch) {
        discovered.push({
          a: invA.id,
          b: invB.id,
          type: 'warm_path_mention',
          strength: fullNameMatch ? 4 : 2,
          evidence: `${investorNameMap.get(invA.id)}'s warm path mentions ${invB.name}`,
        });
      }
    }
  }

  // 3. Market deal co-investor detection
  const marketDealCoInvestors = await detectMarketDealCoInvestors();
  for (const match of marketDealCoInvestors) {
    // For each pipeline investor found in a market deal, check if any co-investors are also in pipeline
    const investorId = match.investorId;
    for (const coInvestorName of match.coInvestors) {
      // Find co-investor in pipeline by name (case-insensitive partial match)
      const coInvestor = investors.find(inv =>
        inv.id !== investorId &&
        (inv.name.toLowerCase() === coInvestorName.toLowerCase() ||
         inv.name.toLowerCase().includes(coInvestorName.toLowerCase()) ||
         coInvestorName.toLowerCase().includes(inv.name.toLowerCase()))
      );
      if (coInvestor) {
        discovered.push({
          a: investorId,
          b: coInvestor.id,
          type: 'market_deal_coinvestor',
          strength: 3, // Moderate signal — they co-invested in a market deal
          evidence: `Both involved in ${match.dealCompany} ${match.dealRound}: ${match.investorName} and ${coInvestor.name}`,
        });
      }
    }
  }

  // 4. Deduplicate (A-B and B-A are the same relationship)
  const existingPairs = new Set<string>();
  const uniqueRelationships = discovered.filter(r => {
    const pairKey = [r.a, r.b].sort().join('|') + '|' + r.type;
    if (existingPairs.has(pairKey)) return false;
    existingPairs.add(pairKey);
    return true;
  });

  // 5. Clear existing relationships and insert fresh
  await db.execute('DELETE FROM investor_relationships');

  for (const rel of uniqueRelationships) {
    await db.execute({
      sql: `INSERT INTO investor_relationships (id, investor_a_id, investor_b_id, relationship_type, strength, evidence) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), rel.a, rel.b, rel.type, rel.strength, rel.evidence],
    });
  }

  // 6. Return enriched results
  return getInvestorRelationshipsAll();
}

/**
 * Get all relationships for a specific investor, enriched with names and statuses.
 */
export async function getInvestorRelationships(investorId: string): Promise<InvestorRelationship[]> {
  await ensureInitialized();
  const db = getClient();
  const result = await db.execute({
    sql: `
      SELECT
        r.*,
        a.name as investor_a_name, a.status as investor_a_status, a.enthusiasm as investor_a_enthusiasm,
        b.name as investor_b_name, b.status as investor_b_status, b.enthusiasm as investor_b_enthusiasm
      FROM investor_relationships r
      JOIN investors a ON a.id = r.investor_a_id
      JOIN investors b ON b.id = r.investor_b_id
      WHERE r.investor_a_id = ? OR r.investor_b_id = ?
      ORDER BY r.strength DESC
    `,
    args: [investorId, investorId],
  });
  return result.rows as unknown as InvestorRelationship[];
}

/**
 * Get all relationships in the graph, enriched with investor data.
 */
async function getInvestorRelationshipsAll(): Promise<InvestorRelationship[]> {
  await ensureInitialized();
  const db = getClient();
  const result = await db.execute(`
    SELECT
      r.*,
      a.name as investor_a_name, a.status as investor_a_status, a.enthusiasm as investor_a_enthusiasm,
      b.name as investor_b_name, b.status as investor_b_status, b.enthusiasm as investor_b_enthusiasm
    FROM investor_relationships r
    JOIN investors a ON a.id = r.investor_a_id
    JOIN investors b ON b.id = r.investor_b_id
    ORDER BY r.strength DESC
  `);
  return result.rows as unknown as InvestorRelationship[];
}

/**
 * Identify keystone investors — those whose commitment would cascade to others
 * based on relationship density + co-investment patterns.
 *
 * A keystone investor has:
 * 1. High connection count to other pipeline investors
 * 2. Strong relationships (co-investment > warm path mention)
 * 3. Connected investors who are still in active pipeline
 */
export async function getKeystoneInvestors(): Promise<{
  id: string;
  name: string;
  connectionCount: number;
  cascadeValue: string;
  connectedInvestors: { id: string; name: string; status: string; enthusiasm: number; relationshipType: string }[];
}[]> {
  await ensureInitialized();
  const db = getClient();

  // Get all relationships enriched with investor data
  const relationships = await getInvestorRelationshipsAll();

  // Get all active investors
  const activeResult = await db.execute(`SELECT id, name, status, enthusiasm FROM investors WHERE status NOT IN ('passed', 'dropped')`);
  const activeInvestors = new Map<string, { name: string; status: string; enthusiasm: number }>();
  for (const row of activeResult.rows as unknown as Array<{ id: string; name: string; status: string; enthusiasm: number }>) {
    activeInvestors.set(row.id, { name: row.name, status: row.status, enthusiasm: row.enthusiasm });
  }

  // Build adjacency map: investor -> connected investors
  const adjacency = new Map<string, Map<string, { type: string; strength: number }>>();

  for (const rel of relationships) {
    // Only count connections to active pipeline investors
    if (!activeInvestors.has(rel.investor_a_id) || !activeInvestors.has(rel.investor_b_id)) continue;

    // A -> B
    if (!adjacency.has(rel.investor_a_id)) adjacency.set(rel.investor_a_id, new Map());
    const existingAB = adjacency.get(rel.investor_a_id)!.get(rel.investor_b_id);
    if (!existingAB || rel.strength > existingAB.strength) {
      adjacency.get(rel.investor_a_id)!.set(rel.investor_b_id, { type: rel.relationship_type, strength: rel.strength });
    }

    // B -> A
    if (!adjacency.has(rel.investor_b_id)) adjacency.set(rel.investor_b_id, new Map());
    const existingBA = adjacency.get(rel.investor_b_id)!.get(rel.investor_a_id);
    if (!existingBA || rel.strength > existingBA.strength) {
      adjacency.get(rel.investor_b_id)!.set(rel.investor_a_id, { type: rel.relationship_type, strength: rel.strength });
    }
  }

  // Score each investor by cascade potential
  const keystones: Array<{
    id: string;
    name: string;
    connectionCount: number;
    cascadeValue: string;
    connectedInvestors: { id: string; name: string; status: string; enthusiasm: number; relationshipType: string }[];
  }> = [];

  for (const [investorId, connections] of adjacency.entries()) {
    const investorData = activeInvestors.get(investorId);
    if (!investorData || connections.size === 0) continue;

    const connectedList = Array.from(connections.entries()).map(([connId, conn]) => {
      const connData = activeInvestors.get(connId);
      return {
        id: connId,
        name: connData?.name || 'Unknown',
        status: connData?.status || 'unknown',
        enthusiasm: connData?.enthusiasm || 0,
        relationshipType: conn.type,
      };
    });

    // Cascade value: high if many connections, especially to undecided investors
    const undecidedConnections = connectedList.filter(c =>
      ['identified', 'contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged'].includes(c.status)
    );
    const cascadeValue = undecidedConnections.length >= 3 ? 'high'
      : undecidedConnections.length >= 2 ? 'medium'
      : connections.size >= 2 ? 'low'
      : 'minimal';

    keystones.push({
      id: investorId,
      name: investorData.name,
      connectionCount: connections.size,
      cascadeValue,
      connectedInvestors: connectedList,
    });
  }

  // Sort by cascade potential
  return keystones
    .sort((a, b) => {
      const cascadeOrder: Record<string, number> = { high: 0, medium: 1, low: 2, minimal: 3 };
      const cascadeDiff = (cascadeOrder[a.cascadeValue] || 3) - (cascadeOrder[b.cascadeValue] || 3);
      if (cascadeDiff !== 0) return cascadeDiff;
      return b.connectionCount - a.connectionCount;
    });
}

// ---------------------------------------------------------------------------
// Network Cascade Intelligence (cycle 32)
// ---------------------------------------------------------------------------

export interface NetworkCascade {
  keystoneId: string;
  keystoneName: string;
  cascadeChain: { investorId: string; investorName: string; probability: number; cumulativeProbability: number; status: string; tier: number }[];
  totalCascadeProbability: number; // product of all chain probabilities
  networkBottleneck: { investorId: string; investorName: string; impactIfPass: number } | null; // investor whose pass collapses most value
  signal: string;
}

export function computeNetworkCascades(): Promise<NetworkCascade[]> {
  return cachedCompute('computeNetworkCascades', 120_000, async () => {
  const keystones = await getKeystoneInvestors();
  if (keystones.length === 0) return [];

  const db = getClient();
  // Get tier + check size data for all active investors
  const activeResult = await db.execute(`SELECT id, name, tier, status, enthusiasm, check_size_range FROM investors WHERE status NOT IN ('passed', 'dropped')`);
  const investorMap = new Map<string, { name: string; tier: number; status: string; enthusiasm: number; checkSize: string }>();
  for (const row of activeResult.rows as unknown as Array<{ id: string; name: string; tier: number; status: string; enthusiasm: number; check_size_range: string }>) {
    investorMap.set(row.id, { name: row.name, tier: row.tier, status: row.status, enthusiasm: row.enthusiasm, checkSize: row.check_size_range || '' });
  }

  // Status-based base probability of closing (reusing scoring logic)
  const statusProb: Record<string, number> = {
    identified: 0.05, contacted: 0.10, nda_signed: 0.15, meeting_scheduled: 0.20,
    met: 0.30, engaged: 0.45, in_dd: 0.65, term_sheet: 0.85, closed: 1.0,
  };

  const cascades: NetworkCascade[] = [];

  for (const keystone of keystones.slice(0, 5)) { // top 5 keystones
    if (keystone.connectedInvestors.length === 0) continue;

    // For each connected investor, compute cascade probability:
    // P(connected closes | keystone closes) = baseProb × networkBoost
    // networkBoost = 1.0 + (relationship_strength / 10) + (enthusiasm / 10)
    const chain = keystone.connectedInvestors
      .filter(c => c.status !== 'closed' && c.status !== 'passed')
      .map(conn => {
        const inv = investorMap.get(conn.id);
        const baseProb = statusProb[conn.status] || 0.10;
        const networkBoost = 1.0 + (conn.enthusiasm / 10);
        const conditionalProb = Math.min(0.95, baseProb * networkBoost);
        return {
          investorId: conn.id,
          investorName: conn.name,
          probability: Math.round(conditionalProb * 100) / 100,
          cumulativeProbability: 0, // filled below
          status: conn.status,
          tier: inv?.tier || 3,
        };
      })
      .sort((a, b) => b.probability - a.probability);

    // Compute cumulative cascade probability (product)
    let cumulative = 1.0;
    for (const link of chain) {
      cumulative *= link.probability;
      link.cumulativeProbability = Math.round(cumulative * 100) / 100;
    }

    // Network bottleneck: which connected investor's pass would reduce total chain value the most
    let bottleneck: NetworkCascade['networkBottleneck'] = null;
    let maxImpact = 0;
    for (const link of chain) {
      // Impact = how much the total probability drops if this link breaks
      const withoutThis = chain.filter(l => l.investorId !== link.investorId)
        .reduce((prod, l) => prod * l.probability, 1.0);
      const withThis = chain.reduce((prod, l) => prod * l.probability, 1.0);
      const impact = withThis - withoutThis;
      if (Math.abs(impact) > maxImpact) {
        maxImpact = Math.abs(impact);
        bottleneck = { investorId: link.investorId, investorName: link.investorName, impactIfPass: Math.round(impact * 100) / 100 };
      }
    }

    const totalProb = chain.reduce((prod, l) => prod * l.probability, 1.0);
    const highProbCount = chain.filter(c => c.probability >= 0.5).length;
    const signal = highProbCount >= 3
      ? `Closing ${keystone.name} likely cascades to ${highProbCount} investors (${chain.length} connected)`
      : chain.length >= 2
        ? `${keystone.name} connects to ${chain.length} investors but cascade probability is moderate`
        : `${keystone.name} has limited cascade potential`;

    cascades.push({
      keystoneId: keystone.id,
      keystoneName: keystone.name,
      cascadeChain: chain,
      totalCascadeProbability: Math.round(totalProb * 1000) / 1000,
      networkBottleneck: bottleneck,
      signal,
    });
  }

  return cascades.sort((a, b) => b.cascadeChain.length - a.cascadeChain.length);
  });
}

/**
 * Compute network effect score for a specific investor.
 * Checks if connected investors are positive (committed/high enthusiasm) or negative (passed).
 * Returns a score 0-100 and evidence string.
 */
export async function computeNetworkEffectData(investorId: string): Promise<{
  score: number;
  evidence: string;
  positiveSignals: string[];
  negativeSignals: string[];
}> {
  const relationships = await getInvestorRelationships(investorId);

  if (relationships.length === 0) {
    return { score: 0, evidence: 'No relationship data available', positiveSignals: [], negativeSignals: [] };
  }

  let positiveWeight = 0;
  let negativeWeight = 0;
  const positiveSignals: string[] = [];
  const negativeSignals: string[] = [];

  for (const rel of relationships) {
    // Determine the "other" investor in the relationship
    const isA = rel.investor_a_id === investorId;
    const otherName = isA ? (rel.investor_b_name || 'Unknown') : (rel.investor_a_name || 'Unknown');
    const otherStatus = isA ? (rel.investor_b_status || '') : (rel.investor_a_status || '');
    const otherEnthusiasm = isA ? (rel.investor_b_enthusiasm || 0) : (rel.investor_a_enthusiasm || 0);
    const relStrength = rel.strength || 1;

    // Positive signals: committed, closed, high enthusiasm, in DD, term sheet
    if (['closed', 'term_sheet'].includes(otherStatus)) {
      positiveWeight += relStrength * 3;
      positiveSignals.push(`${otherName} has committed (${otherStatus})`);
    } else if (['in_dd'].includes(otherStatus) && otherEnthusiasm >= 4) {
      positiveWeight += relStrength * 2;
      positiveSignals.push(`${otherName} is in DD with high enthusiasm`);
    } else if (otherEnthusiasm >= 4) {
      positiveWeight += relStrength * 1.5;
      positiveSignals.push(`${otherName} shows high enthusiasm (${otherEnthusiasm}/5)`);
    }

    // Negative signals: passed, dropped
    if (['passed', 'dropped'].includes(otherStatus)) {
      negativeWeight += relStrength * 2;
      negativeSignals.push(`${otherName} has ${otherStatus}`);
    } else if (otherEnthusiasm <= 1 && otherEnthusiasm > 0) {
      negativeWeight += relStrength * 1;
      negativeSignals.push(`${otherName} has low enthusiasm (${otherEnthusiasm}/5)`);
    }
  }

  // Compute score: base 50, +/- based on network signals
  const netSignal = positiveWeight - negativeWeight;
  const maxSignal = relationships.length * 5 * 3; // max possible positive weight
  const normalizedBoost = maxSignal > 0 ? (netSignal / maxSignal) * 50 : 0;
  const score = Math.max(0, Math.min(100, Math.round(50 + normalizedBoost)));

  const evidenceParts: string[] = [];
  evidenceParts.push(`${relationships.length} connection${relationships.length > 1 ? 's' : ''} in pipeline`);
  if (positiveSignals.length > 0) evidenceParts.push(`${positiveSignals.length} positive signal${positiveSignals.length > 1 ? 's' : ''}`);
  if (negativeSignals.length > 0) evidenceParts.push(`${negativeSignals.length} negative signal${negativeSignals.length > 1 ? 's' : ''}`);

  return {
    score,
    evidence: evidenceParts.join(', '),
    positiveSignals,
    negativeSignals,
  };
}

/**
 * Get aggregated competitive intel from all meetings (cross-investor synthesis).
 * Returns consolidated competitive mentions from the full pipeline.
 */
export async function getAggregatedCompetitiveIntel(): Promise<{
  competitor: string;
  mentionCount: number;
  investors: string[];
  latestMention: string;
  context: string[];
}[]> {
  await ensureInitialized();
  const db = getClient();
  const result = await db.execute(`
    SELECT m.competitive_intel, m.investor_name, m.date
    FROM meetings m
    WHERE m.competitive_intel != '' AND m.competitive_intel IS NOT NULL
    ORDER BY m.date DESC
  `);
  const rows = result.rows as unknown as Array<{ competitive_intel: string; investor_name: string; date: string }>;

  // Parse and aggregate competitive intel mentions
  const competitorMap = new Map<string, { mentionCount: number; investors: Set<string>; latestMention: string; context: string[] }>();

  for (const row of rows) {
    const intel = row.competitive_intel.trim();
    if (!intel) continue;

    // Try to extract competitor names from the intel text
    // Use simple heuristic: look for capitalized words/phrases that could be company names
    const normalizedIntel = intel.toLowerCase();

    // Common competitor keywords to detect
    const competitorKeywords = ['iceye', 'planet', 'maxar', 'airbus', 'thales', 'oneweb', 'spacex',
      'rocket lab', 'sierra', 'k2 space', 'stoke', 'anduril', 'l3harris', 'bae', 'rheinmetall',
      'capella', 'blacksky', 'spire', 'hawkeye'];

    let matchedCompetitor = 'general_competitive';
    for (const kw of competitorKeywords) {
      if (normalizedIntel.includes(kw)) {
        matchedCompetitor = kw;
        break;
      }
    }

    if (!competitorMap.has(matchedCompetitor)) {
      competitorMap.set(matchedCompetitor, { mentionCount: 0, investors: new Set(), latestMention: '', context: [] });
    }
    const entry = competitorMap.get(matchedCompetitor)!;
    entry.mentionCount++;
    entry.investors.add(row.investor_name);
    if (!entry.latestMention || row.date > entry.latestMention) entry.latestMention = row.date;
    if (entry.context.length < 5) entry.context.push(`${row.investor_name}: ${intel.substring(0, 200)}`);
  }

  return Array.from(competitorMap.entries())
    .map(([competitor, data]) => ({
      competitor,
      mentionCount: data.mentionCount,
      investors: Array.from(data.investors),
      latestMention: data.latestMention,
      context: data.context,
    }))
    .sort((a, b) => b.mentionCount - a.mentionCount);
}

/**
 * Get question patterns for a specific investor type (for meeting prep).
 * Returns the most common question topics for that type.
 */
export async function getQuestionPatternsForType(investorType: string): Promise<{
  topic: string;
  questionCount: number;
  exampleQuestions: string[];
}[]> {
  await ensureInitialized();
  const db = getClient();
  const result = await db.execute({
    sql: `
      SELECT topic, question_text
      FROM question_patterns
      WHERE investor_type = ?
      ORDER BY meeting_date DESC
    `,
    args: [investorType],
  });
  const rows = result.rows as unknown as Array<{ topic: string; question_text: string }>;

  const byTopic = new Map<string, string[]>();
  for (const row of rows) {
    if (!byTopic.has(row.topic)) byTopic.set(row.topic, []);
    byTopic.get(row.topic)!.push(row.question_text);
  }

  return Array.from(byTopic.entries())
    .map(([topic, questions]) => ({
      topic,
      questionCount: questions.length,
      exampleQuestions: questions.slice(0, 3),
    }))
    .sort((a, b) => b.questionCount - a.questionCount);
}

/**
 * Get proven responses for objection topics (best response per topic).
 */
export async function getProvenResponsesForTopics(topics: string[]): Promise<{
  topic: string;
  bestResponse: string;
  effectiveness: string;
  enthusiasmLift: number;
}[]> {
  await ensureInitialized();
  const db = getClient();

  const results: { topic: string; bestResponse: string; effectiveness: string; enthusiasmLift: number }[] = [];

  for (const topic of topics) {
    const resp = await db.execute({
      sql: `SELECT response_text, effectiveness, next_meeting_enthusiasm_delta
            FROM objection_responses
            WHERE objection_topic = ? AND response_text != '' AND effectiveness = 'effective'
            ORDER BY next_meeting_enthusiasm_delta DESC LIMIT 1`,
      args: [topic],
    });
    if (resp.rows.length > 0) {
      const row = resp.rows[0] as unknown as { response_text: string; effectiveness: string; next_meeting_enthusiasm_delta: number };
      results.push({
        topic,
        bestResponse: row.response_text,
        effectiveness: row.effectiveness,
        enthusiasmLift: row.next_meeting_enthusiasm_delta,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Auto-Action Engine — Autonomous intelligence that detects patterns and acts
// ---------------------------------------------------------------------------

const AUTO_ACTION_RULES = [
  {
    condition: 'narrative_weakness_critical' as const,
    trigger_type: 'catalyst_match' as const,
    action_type: 'data_update' as const,
    template: (topic: string, count: number) =>
      `[AUTO] ${count} investors questioned "${topic}" — update pitch materials and prepare response framework before next meetings`,
    expected_lift: 5,
    confidence: 'medium' as const,
  },
  {
    condition: 'engagement_gap' as const,
    trigger_type: 'stall_risk' as const,
    action_type: 'milestone_share' as const,
    template: (name: string, days: number) =>
      `[AUTO] ${name} has gone ${days} days without contact — send milestone update or news hook to re-engage`,
    expected_lift: 8,
    confidence: 'medium' as const,
  },
  {
    condition: 'declining_trajectory' as const,
    trigger_type: 'momentum_cliff' as const,
    action_type: 'expert_call' as const,
    template: (name: string, velocity: string) =>
      `[AUTO] ${name} declining at ${velocity}/wk — schedule direct call with partner to understand concerns`,
    expected_lift: 10,
    confidence: 'high' as const,
  },
  {
    condition: 'keystone_uncommitted' as const,
    trigger_type: 'window_closing' as const,
    action_type: 'escalation' as const,
    template: (name: string, connections: number) =>
      `[AUTO] ${name} is a keystone investor (connected to ${connections} others) — prioritize advancement to unlock cascade`,
    expected_lift: 15,
    confidence: 'high' as const,
  },
  {
    condition: 'narrative_struggling_type' as const,
    trigger_type: 'catalyst_match' as const,
    action_type: 'data_update' as const,
    template: (type: string, enthusiasm: string) =>
      `[AUTO] "${type}" investors averaging only ${enthusiasm}/5 enthusiasm — create type-specific pitch variant`,
    expected_lift: 7,
    confidence: 'medium' as const,
  },
] as const;

export interface AutoActionResult {
  actionsCreated: AccelerationAction[];
  rulesEvaluated: number;
  patternsDetected: number;
  skippedDuplicate: number;
  skippedIneffective: string[];
  boostedRules: string[];
}

/**
 * Generate autonomous acceleration actions based on detected intelligence patterns.
 * Checks each rule condition against current data, avoids duplicates,
 * and creates acceleration_actions for new detections.
 */
export async function generateAutoActions(): Promise<AutoActionResult> {
  await ensureInitialized();
  const db = getClient();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const actionsCreated: AccelerationAction[] = [];
  let patternsDetected = 0;
  let skippedDuplicate = 0;
  const skippedIneffective: string[] = [];
  const boostedRules: string[] = [];

  // --- Learning: fetch historical effectiveness to guide rule application ---
  let effectiveness: Awaited<ReturnType<typeof getAutoActionEffectiveness>> | null = null;
  try {
    effectiveness = await getAutoActionEffectiveness();
  } catch { /* non-blocking — proceed without learning data */ }

  // Build a lookup: "triggerType:actionType" → { avgLift, count }
  const effectivenessMap = new Map<string, { avgLift: number; count: number }>();
  if (effectiveness) {
    for (const rule of effectiveness.ruleEffectiveness) {
      effectivenessMap.set(`${rule.triggerType}:${rule.actionType}`, {
        avgLift: rule.avgLift,
        count: rule.count,
      });
    }
  }

  // Helper: check if a rule should be skipped due to poor measured effectiveness
  function shouldSkipRule(triggerType: string, actionType: string): boolean {
    const key = `${triggerType}:${actionType}`;
    const data = effectivenessMap.get(key);
    if (!data) return false; // No data yet — keep the rule active
    // Skip if measured 5+ times with avgLift < 2
    if (data.count >= 5 && data.avgLift < 2) {
      skippedIneffective.push(`${triggerType}/${actionType} (avgLift=${data.avgLift}, n=${data.count})`);
      return true;
    }
    return false;
  }

  // Helper: boost expected_lift if a rule has proven highly effective
  function adjustExpectedLift(triggerType: string, actionType: string, baseExpectedLift: number): number {
    const key = `${triggerType}:${actionType}`;
    const data = effectivenessMap.get(key);
    if (!data) return baseExpectedLift;
    // Boost if measured 5+ times with avgLift > 8
    if (data.count >= 5 && data.avgLift > 8) {
      const boosted = Math.round(Math.max(baseExpectedLift, data.avgLift));
      boostedRules.push(`${triggerType}/${actionType} (${baseExpectedLift}→${boosted}, n=${data.count})`);
      return boosted;
    }
    return baseExpectedLift;
  }

  // Helper: check if a similar pending action already exists (same investor + trigger_type in last 7 days)
  async function hasDuplicateAction(investorId: string, triggerType: string): Promise<boolean> {
    const result = await db.execute({
      sql: `SELECT COUNT(*) as count FROM acceleration_actions
            WHERE investor_id = ? AND trigger_type = ? AND status = 'pending' AND created_at >= ?`,
      args: [investorId, triggerType, sevenDaysAgo],
    });
    return Number((result.rows[0] as unknown as { count: number }).count) > 0;
  }

  // --- Rule 1: narrative_weakness_critical (3+ investors same topic) ---
  try {
    const rule1 = AUTO_ACTION_RULES[0];
    if (shouldSkipRule(rule1.trigger_type, rule1.action_type)) {
      // Rule skipped due to poor effectiveness
    } else {
      const patterns = await getQuestionPatterns();
      const criticalPatterns = patterns.filter(p => p.investorCount >= 3);
      for (const pattern of criticalPatterns) {
        patternsDetected++;
        // Use a synthetic investor_id for cross-investor patterns
        const syntheticId = `narrative_${pattern.topic}`;
        if (await hasDuplicateAction(syntheticId, 'catalyst_match')) {
          skippedDuplicate++;
          continue;
        }
        const action = await createAccelerationAction({
          investor_id: syntheticId,
          investor_name: pattern.investorNames.join(', '),
          trigger_type: rule1.trigger_type,
          action_type: rule1.action_type,
          description: rule1.template(pattern.topic, pattern.investorCount),
          expected_lift: adjustExpectedLift(rule1.trigger_type, rule1.action_type, rule1.expected_lift),
          confidence: rule1.confidence,
          status: 'pending',
          actual_lift: null,
          executed_at: null,
        });
        actionsCreated.push(action);
      }
    }
  } catch { /* non-blocking */ }

  // --- Rule 2: engagement_gap (21+ days no contact for active investors) ---
  try {
    const rule2 = AUTO_ACTION_RULES[1];
    if (shouldSkipRule(rule2.trigger_type, rule2.action_type)) {
      // Rule skipped due to poor effectiveness
    } else {
      const investorsResult = await db.execute(
        `SELECT id, name, status FROM investors WHERE status NOT IN ('passed', 'dropped', 'closed', 'identified')`
      );
      const activeInvestors = investorsResult.rows as unknown as Array<{ id: string; name: string; status: string }>;

      for (const inv of activeInvestors) {
        const lastMeetingResult = await db.execute({
          sql: `SELECT MAX(date) as last_date FROM meetings WHERE investor_id = ?`,
          args: [inv.id],
        });
        const lastDate = (lastMeetingResult.rows[0] as unknown as { last_date: string | null }).last_date;
        if (!lastDate) continue;

        const daysSince = Math.round((now.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince >= 21) {
          patternsDetected++;
          if (await hasDuplicateAction(inv.id, 'stall_risk')) {
            skippedDuplicate++;
            continue;
          }
          const action = await createAccelerationAction({
            investor_id: inv.id,
            investor_name: inv.name,
            trigger_type: rule2.trigger_type,
            action_type: rule2.action_type,
            description: rule2.template(inv.name, daysSince),
            expected_lift: adjustExpectedLift(rule2.trigger_type, rule2.action_type, rule2.expected_lift),
            confidence: rule2.confidence,
            status: 'pending',
            actual_lift: null,
            executed_at: null,
          });
          actionsCreated.push(action);
        }
      }
    }
  } catch { /* non-blocking */ }

  // --- Rule 3: declining_trajectory (score declining >2 pts/week) ---
  try {
    const rule3 = AUTO_ACTION_RULES[2];
    if (shouldSkipRule(rule3.trigger_type, rule3.action_type)) {
      // Rule skipped due to poor effectiveness
    } else {
      const snapshotsResult = await db.execute(
        `SELECT investor_id, overall_score, snapshot_date FROM score_snapshots
         WHERE snapshot_date >= date('now', '-21 days')
         ORDER BY investor_id, snapshot_date ASC`
      );
      const snapRows = snapshotsResult.rows as unknown as Array<{ investor_id: string; overall_score: number; snapshot_date: string }>;

      // Group by investor
      const snapsByInvestor = new Map<string, Array<{ score: number; date: string }>>();
      for (const row of snapRows) {
        if (!snapsByInvestor.has(row.investor_id)) snapsByInvestor.set(row.investor_id, []);
        snapsByInvestor.get(row.investor_id)!.push({ score: row.overall_score, date: row.snapshot_date });
      }

      for (const [investorId, snaps] of snapsByInvestor.entries()) {
        if (snaps.length < 2) continue;
        const first = snaps[0];
        const last = snaps[snaps.length - 1];
        const daysDiff = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff < 3) continue; // need at least 3 days of data

        const weeksDiff = daysDiff / 7;
        const velocityPerWeek = weeksDiff > 0 ? (last.score - first.score) / weeksDiff : 0;

        if (velocityPerWeek < -2) {
          patternsDetected++;
          if (await hasDuplicateAction(investorId, 'momentum_cliff')) {
            skippedDuplicate++;
            continue;
          }
          // Get investor name
          const invResult = await db.execute({ sql: `SELECT name FROM investors WHERE id = ?`, args: [investorId] });
          const invName = invResult.rows.length > 0 ? (invResult.rows[0] as unknown as { name: string }).name : 'Unknown';

          const action = await createAccelerationAction({
            investor_id: investorId,
            investor_name: invName,
            trigger_type: rule3.trigger_type,
            action_type: rule3.action_type,
            description: rule3.template(invName, velocityPerWeek.toFixed(1)),
            expected_lift: adjustExpectedLift(rule3.trigger_type, rule3.action_type, rule3.expected_lift),
            confidence: rule3.confidence,
            status: 'pending',
            actual_lift: null,
            executed_at: null,
          });
          actionsCreated.push(action);
        }
      }
    }
  } catch { /* non-blocking */ }

  // --- Rule 4: keystone_uncommitted (keystone investor not at engaged+) ---
  try {
    const rule4 = AUTO_ACTION_RULES[3];
    if (shouldSkipRule(rule4.trigger_type, rule4.action_type)) {
      // Rule skipped due to poor effectiveness
    } else {
      const keystones = await getKeystoneInvestors();
      for (const ks of keystones) {
        if (ks.cascadeValue === 'minimal') continue;
        // Check if investor is NOT yet at engaged or beyond
        const invResult = await db.execute({ sql: `SELECT status FROM investors WHERE id = ?`, args: [ks.id] });
        if (invResult.rows.length === 0) continue;
        const status = (invResult.rows[0] as unknown as { status: string }).status;
        const advancedStatuses = ['engaged', 'in_dd', 'term_sheet', 'closed'];
        if (advancedStatuses.includes(status)) continue;

        patternsDetected++;
        if (await hasDuplicateAction(ks.id, 'window_closing')) {
          skippedDuplicate++;
          continue;
        }
        const action = await createAccelerationAction({
          investor_id: ks.id,
          investor_name: ks.name,
          trigger_type: rule4.trigger_type,
          action_type: rule4.action_type,
          description: rule4.template(ks.name, ks.connectionCount),
          expected_lift: adjustExpectedLift(rule4.trigger_type, rule4.action_type, rule4.expected_lift),
          confidence: rule4.confidence,
          status: 'pending',
          actual_lift: null,
          executed_at: null,
        });
        actionsCreated.push(action);
      }
    }
  } catch { /* non-blocking */ }

  // --- Rule 5: narrative_struggling_type (investor type with avg enthusiasm < 2.5) ---
  try {
    const rule5 = AUTO_ACTION_RULES[4];
    if (shouldSkipRule(rule5.trigger_type, rule5.action_type)) {
      // Rule skipped due to poor effectiveness
    } else {
      const narrativeSignals = await computeNarrativeSignals();
      const struggling = narrativeSignals.filter(ns => ns.avgEnthusiasm > 0 && ns.avgEnthusiasm < 2.5 && ns.sampleSize >= 2);
      for (const signal of struggling) {
        patternsDetected++;
        const syntheticId = `narrative_type_${signal.investorType}`;
        if (await hasDuplicateAction(syntheticId, 'catalyst_match')) {
          skippedDuplicate++;
          continue;
        }
        const action = await createAccelerationAction({
          investor_id: syntheticId,
          investor_name: `All ${signal.investorType} investors`,
          trigger_type: rule5.trigger_type,
          action_type: rule5.action_type,
          description: rule5.template(signal.investorType, signal.avgEnthusiasm.toFixed(1)),
          expected_lift: adjustExpectedLift(rule5.trigger_type, rule5.action_type, rule5.expected_lift),
          confidence: rule5.confidence,
          status: 'pending',
          actual_lift: null,
          executed_at: null,
        });
        actionsCreated.push(action);
      }
    }
  } catch { /* non-blocking */ }

  // --- Rule 6: pipeline_bottleneck (stuck at bottleneck stage > 21 days) ---
  try {
    if (!shouldSkipRule('stall_risk', 'escalation')) {
      const pipelineFlow = await computePipelineFlow();
      if (pipelineFlow.bottleneckStage && pipelineFlow.bottleneckAvgDays > 21) {
        // Find investors currently stuck at the bottleneck stage
        const investorsResult = await db.execute({
          sql: `SELECT id, name, status FROM investors WHERE status = ? AND status NOT IN ('passed', 'dropped')`,
          args: [pipelineFlow.bottleneckStage],
        });
        const stuckInvestors = investorsResult.rows as unknown as Array<{ id: string; name: string; status: string }>;

        for (const inv of stuckInvestors.slice(0, 3)) {
          patternsDetected++;
          if (await hasDuplicateAction(inv.id, 'stall_risk')) {
            skippedDuplicate++;
            continue;
          }
          const action = await createAccelerationAction({
            investor_id: inv.id,
            investor_name: inv.name,
            trigger_type: 'stall_risk',
            action_type: 'escalation',
            description: `[AUTO] ${inv.name} stuck at "${pipelineFlow.bottleneckStage}" (bottleneck stage, avg ${Math.round(pipelineFlow.bottleneckAvgDays)} days) — escalate to unblock`,
            expected_lift: adjustExpectedLift('stall_risk', 'escalation', 10),
            confidence: 'medium',
            status: 'pending',
            actual_lift: null,
            executed_at: null,
          });
          actionsCreated.push(action);
        }
      }
    }
  } catch { /* non-blocking */ }

  // --- Rule 7: compound_signal (very_high confidence compound signals → high-lift actions) ---
  try {
    const compoundSignals = await detectCompoundSignals();
    const veryHighSignals = compoundSignals.filter(s => s.confidence === 'very_high');
    for (const cs of veryHighSignals.slice(0, 3)) {
      patternsDetected++;
      // Build a stable synthetic ID from the signal sources for dedup
      const syntheticId = `compound_${cs.sources.sort().join('_')}`;
      if (await hasDuplicateAction(syntheticId, 'catalyst_match')) {
        skippedDuplicate++;
        continue;
      }
      const action = await createAccelerationAction({
        investor_id: syntheticId,
        investor_name: null,
        trigger_type: 'catalyst_match',
        action_type: 'escalation',
        description: `[AUTO-COMPOUND] ${cs.recommendation}`,
        expected_lift: 15,
        confidence: 'high',
        status: 'pending',
        actual_lift: null,
        executed_at: null,
      });
      actionsCreated.push(action);
    }
  } catch { /* non-blocking */ }

  // --- Rule 8: temporal_decline (3+ metrics declining simultaneously) ---
  try {
    if (!shouldSkipRule('catalyst_match', 'escalation')) {
      const temporalData = await computeTemporalTrends();
      const decliningMetrics = temporalData.trends.filter(t => t.direction === 'declining');
      if (decliningMetrics.length >= 3) {
        patternsDetected++;
        const syntheticId = `temporal_decline_${new Date().toISOString().split('T')[0]}`;
        if (!(await hasDuplicateAction(syntheticId, 'escalation'))) {
          const metricNames = decliningMetrics.map(t => t.metric).join(', ');
          const action = await createAccelerationAction({
            investor_id: syntheticId,
            investor_name: null,
            trigger_type: 'catalyst_match',
            action_type: 'escalation',
            description: `[AUTO-TEMPORAL] Multiple health metrics declining: ${metricNames}. Raise momentum is deteriorating — immediate strategic review required.`,
            expected_lift: 12,
            confidence: 'high',
            status: 'pending',
            actual_lift: null,
            executed_at: null,
          });
          actionsCreated.push(action);
        } else { skippedDuplicate++; }
      }

      // Also flag individual metrics with long decline streaks
      for (const trend of temporalData.trends) {
        if (trend.alert && trend.streak >= 4) {
          patternsDetected++;
          const trendId = `temporal_${trend.metric.replace(/\s/g, '_').toLowerCase()}_streak`;
          if (!(await hasDuplicateAction(trendId, 'escalation'))) {
            const action = await createAccelerationAction({
              investor_id: trendId,
              investor_name: null,
              trigger_type: 'catalyst_match',
              action_type: 'escalation',
              description: `[AUTO-TEMPORAL] ${trend.alert}`,
              expected_lift: 8,
              confidence: 'medium',
              status: 'pending',
              actual_lift: null,
              executed_at: null,
            });
            actionsCreated.push(action);
          } else { skippedDuplicate++; }
        }
      }
    }
  } catch { /* non-blocking */ }

  // --- Rule 9: critical_path_stalled (critical path investors stuck in stage) ---
  try {
    if (!shouldSkipRule('window_closing', 'escalation')) {
      const forecastData = await computeRaiseForecast();
      const criticalNames = forecastData.criticalPathInvestors;
      // Find critical path investors who are stalled
      const activeInvestors = (await db.execute(`SELECT * FROM investors WHERE status NOT IN ('passed','dropped','closed')`)).rows as unknown as Array<{
        id: string; name: string; status: string; updated_at: string; created_at: string;
      }>;
      const msPerDay = 1000 * 60 * 60 * 24;
      for (const inv of activeInvestors) {
        if (!criticalNames.includes(inv.name)) continue;
        const daysInStage = Math.max(0, Math.round((Date.now() - new Date(inv.updated_at || inv.created_at).getTime()) / msPerDay));
        if (daysInStage >= 21) {
          patternsDetected++;
          if (!(await hasDuplicateAction(inv.id, 'escalation'))) {
            const action = await createAccelerationAction({
              investor_id: inv.id,
              investor_name: inv.name,
              trigger_type: 'window_closing',
              action_type: 'escalation',
              description: `[AUTO-FORECAST] Critical path investor ${inv.name} is stalled at "${inv.status}" for ${daysInStage} days. This investor is on the critical path to close — delays here push the entire raise timeline.`,
              expected_lift: 14,
              confidence: 'high',
              status: 'pending',
              actual_lift: null,
              executed_at: null,
            });
            actionsCreated.push(action);
          } else { skippedDuplicate++; }
        }
      }
    }
  } catch { /* non-blocking */ }

  // --- Rule 10: dormant_high_tier (T1-2 investors with zero meetings past identified) ---
  try {
    if (!shouldSkipRule('stall_risk', 'warm_reintro')) {
      const dormantInvestors = (await db.execute(
        `SELECT i.id, i.name, i.tier, i.status, i.updated_at, i.created_at,
                (SELECT COUNT(*) FROM meetings m WHERE m.investor_id = i.id) as meeting_count
         FROM investors i
         WHERE i.status NOT IN ('passed', 'dropped', 'closed', 'identified')
           AND i.tier <= 2`
      )).rows as unknown as Array<{
        id: string; name: string; tier: number; status: string;
        updated_at: string; created_at: string; meeting_count: number;
      }>;

      const msPerDay = 1000 * 60 * 60 * 24;
      for (const inv of dormantInvestors) {
        if (inv.meeting_count > 0) continue;
        const daysInStage = Math.max(0, Math.round((Date.now() - new Date(inv.updated_at || inv.created_at).getTime()) / msPerDay));
        if (daysInStage >= 14) {
          patternsDetected++;
          if (!(await hasDuplicateAction(inv.id, 'warm_reintro'))) {
            const action = await createAccelerationAction({
              investor_id: inv.id,
              investor_name: inv.name,
              trigger_type: 'stall_risk',
              action_type: 'warm_reintro',
              description: `[AUTO-DORMANT] T${inv.tier} investor ${inv.name} at "${inv.status}" for ${daysInStage}d with ZERO meetings. Either schedule first meeting or remove from pipeline to avoid inflating metrics.`,
              expected_lift: 10,
              confidence: 'medium',
              status: 'pending',
              actual_lift: null,
              executed_at: null,
            });
            actionsCreated.push(action);
          } else { skippedDuplicate++; }
        }
      }
    }
  } catch { /* non-blocking */ }

  // --- Rule 11: fomo_trigger (competitive urgency from advancing investors) --- (cycle 28)
  try {
    if (!shouldSkipRule('competitive_pressure', 'fomo_outreach')) {
      const fomos = await detectFomoDynamics();
      for (const fomo of fomos) {
        if (fomo.fomoIntensity !== 'high') continue; // only auto-act on high-intensity FOMO
        for (const affected of fomo.affectedInvestors.slice(0, 2)) { // top 2 per trigger
          patternsDetected++;
          // Build a synthetic investor ID lookup
          const invResult = await db.execute({ sql: `SELECT id FROM investors WHERE name = ? LIMIT 1`, args: [affected.name] });
          const invId = invResult.rows.length > 0 ? invResult.rows[0].id as string : null;
          if (!invId) continue;
          if (!(await hasDuplicateAction(invId, 'fomo_outreach'))) {
            const action = await createAccelerationAction({
              investor_id: invId,
              investor_name: affected.name,
              trigger_type: 'competitive_pressure',
              action_type: 'fomo_outreach',
              description: `[AUTO-FOMO] ${fomo.advancingInvestor} has reached ${fomo.advancingTo} — create competitive urgency with ${affected.name} (T${affected.tier}, at "${affected.status}"). Mention process is advancing with other investors.`,
              expected_lift: 12,
              confidence: 'medium',
              status: 'pending',
              actual_lift: null,
              executed_at: null,
            });
            actionsCreated.push(action);
          } else { skippedDuplicate++; }
        }
      }
    }
  } catch { /* non-blocking */ }

  // --- Rule 12: cascade_bottleneck (network bottleneck investor stalled/slow) --- (cycle 36)
  try {
    if (!shouldSkipRule('cascade_bottleneck', 'escalation')) {
      const cascades = await computeNetworkCascades();
      for (const cascade of cascades.slice(0, 3)) {
        if (!cascade.networkBottleneck) continue;
        // Query bottleneck investor for stale check
        const bnResult = await db.execute({ sql: `SELECT id, name, updated_at, created_at FROM investors WHERE id = ? LIMIT 1`, args: [cascade.networkBottleneck.investorId] });
        if (bnResult.rows.length === 0) continue;
        const bottleneckInv = bnResult.rows[0] as unknown as { id: string; name: string; updated_at: string; created_at: string };
        // Only act if bottleneck is stalled or slow
        const daysSinceUpdate = Math.round((Date.now() - new Date(bottleneckInv.updated_at || bottleneckInv.created_at).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceUpdate < 14) continue; // not stalled yet
        patternsDetected++;
        if (!(await hasDuplicateAction(bottleneckInv.id, 'escalation'))) {
          const action = await createAccelerationAction({
            investor_id: bottleneckInv.id,
            investor_name: bottleneckInv.name,
            trigger_type: 'cascade_bottleneck',
            action_type: 'escalation',
            description: `[AUTO-CASCADE] ${bottleneckInv.name} is the network bottleneck in ${cascade.keystoneName}'s cascade chain (${cascade.cascadeChain.length} downstream). Stalled for ${daysSinceUpdate}d. If this investor passes, the cascade collapses. Escalate immediately.`,
            expected_lift: 15,
            confidence: 'high',
            status: 'pending',
            actual_lift: null,
            executed_at: null,
          });
          actionsCreated.push(action);
        } else { skippedDuplicate++; }
      }
    }
  } catch { /* non-blocking */ }

  // --- Rule 13: velocity_decay (high-tier investor engagement decelerating) --- (cycle 36)
  try {
    if (!shouldSkipRule('velocity_decay', 'warm_reintro')) {
      const velocities = await computeEngagementVelocity();
      for (const vel of velocities) {
        if (vel.tier > 2) continue; // only T1-2
        if (vel.acceleration !== 'gone_silent' && vel.acceleration !== 'decelerating') continue;
        patternsDetected++;
        if (!(await hasDuplicateAction(vel.investorId, 'warm_reintro'))) {
          const action = await createAccelerationAction({
            investor_id: vel.investorId,
            investor_name: vel.investorName,
            trigger_type: 'velocity_decay',
            action_type: 'warm_reintro',
            description: `[AUTO-VELOCITY] ${vel.investorName} (T${vel.tier}) is ${vel.acceleration === 'gone_silent' ? 'SILENT' : 'decelerating'} — ${vel.signal}. Re-engage with milestone update or competitive timing signal before they disengage permanently.`,
            expected_lift: vel.acceleration === 'gone_silent' ? 10 : 8,
            confidence: 'medium',
            status: 'pending',
            actual_lift: null,
            executed_at: null,
          });
          actionsCreated.push(action);
        } else { skippedDuplicate++; }
      }
    }
  } catch { /* non-blocking */ }

  return {
    actionsCreated,
    rulesEvaluated: AUTO_ACTION_RULES.length + 8, // +1 Rule 6-13
    patternsDetected,
    skippedDuplicate,
    skippedIneffective,
    boostedRules,
  };
}

// ---------------------------------------------------------------------------
// Compound Signal Detection — Cross-signal correlation engine (cycle 13)
// ---------------------------------------------------------------------------

export function detectCompoundSignals(): Promise<{
  signal: string;
  sources: string[];
  confidence: 'high' | 'very_high';
  recommendation: string;
}[]> {
  return cachedCompute('detectCompoundSignals', 120_000, async () => {
  await ensureInitialized();
  const db = getClient();
  const signals: {
    signal: string;
    sources: string[];
    confidence: 'high' | 'very_high';
    recommendation: string;
  }[] = [];

  // --- Signal 1: Convergent Decline ---
  // Investor has declining trajectory + engagement gap + unresolved objections → very high confidence they will pass
  try {
    const investorsResult = await db.execute(
      `SELECT id, name, status FROM investors WHERE status NOT IN ('passed', 'dropped', 'closed', 'identified')`
    );
    const activeInvestors = investorsResult.rows as unknown as Array<{ id: string; name: string; status: string }>;
    const now = Date.now();

    for (const inv of activeInvestors) {
      const convergentSources: string[] = [];

      // Check declining trajectory
      const snapsResult = await db.execute({
        sql: `SELECT overall_score, snapshot_date FROM score_snapshots WHERE investor_id = ? AND snapshot_date >= date('now', '-21 days') ORDER BY snapshot_date ASC`,
        args: [inv.id],
      });
      const snaps = snapsResult.rows as unknown as Array<{ overall_score: number; snapshot_date: string }>;
      if (snaps.length >= 2) {
        const first = snaps[0];
        const last = snaps[snaps.length - 1];
        const daysDiff = (new Date(last.snapshot_date).getTime() - new Date(first.snapshot_date).getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff >= 3) {
          const weeksDiff = daysDiff / 7;
          const velocity = (last.overall_score - first.overall_score) / weeksDiff;
          if (velocity < -1.5) {
            convergentSources.push('declining_trajectory');
          }
        }
      }

      // Check engagement gap (21+ days since last meeting)
      const lastMeetingResult = await db.execute({
        sql: `SELECT MAX(date) as last_date FROM meetings WHERE investor_id = ?`,
        args: [inv.id],
      });
      const lastDate = (lastMeetingResult.rows[0] as unknown as { last_date: string | null }).last_date;
      if (lastDate) {
        const daysSince = Math.round((now - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince >= 21) {
          convergentSources.push('engagement_gap');
        }
      }

      // Check unresolved objections
      const objResult = await db.execute({
        sql: `SELECT COUNT(*) as count FROM objection_responses WHERE investor_id = ? AND (effectiveness IS NULL OR effectiveness = 'unknown' OR effectiveness = 'ineffective')`,
        args: [inv.id],
      });
      const unresolvedCount = Number((objResult.rows[0] as unknown as { count: number }).count);
      if (unresolvedCount >= 2) {
        convergentSources.push('unresolved_objections');
      }

      if (convergentSources.length >= 3) {
        signals.push({
          signal: `${inv.name}: convergent decline detected — declining trajectory + engagement gap + unresolved objections all point to likely pass`,
          sources: convergentSources,
          confidence: 'very_high',
          recommendation: `Schedule direct call with ${inv.name}'s partner immediately — if no progress in 7 days, reallocate effort to higher-probability investors`,
        });
      } else if (convergentSources.length === 2) {
        signals.push({
          signal: `${inv.name}: early decline warning — ${convergentSources.join(' + ')} detected`,
          sources: convergentSources,
          confidence: 'high',
          recommendation: `Proactively reach out to ${inv.name} before full disengagement — address the ${convergentSources.includes('unresolved_objections') ? 'unresolved objections' : 'communication gap'} first`,
        });
      }
    }
  } catch { /* non-blocking */ }

  // --- Signal 2: Ready to Close ---
  // Investor has accelerating trajectory + high enthusiasm + process signals + no objections → ready to close
  try {
    const investorsResult = await db.execute(
      `SELECT id, name, status, enthusiasm FROM investors WHERE status IN ('engaged', 'in_dd', 'term_sheet')`
    );
    const advancedInvestors = investorsResult.rows as unknown as Array<{ id: string; name: string; status: string; enthusiasm: number }>;

    for (const inv of advancedInvestors) {
      const closeSources: string[] = [];

      // Check accelerating or positive trajectory
      const snapsResult = await db.execute({
        sql: `SELECT overall_score, snapshot_date FROM score_snapshots WHERE investor_id = ? AND snapshot_date >= date('now', '-21 days') ORDER BY snapshot_date ASC`,
        args: [inv.id],
      });
      const snaps = snapsResult.rows as unknown as Array<{ overall_score: number; snapshot_date: string }>;
      if (snaps.length >= 2) {
        const first = snaps[0];
        const last = snaps[snaps.length - 1];
        const daysDiff = (new Date(last.snapshot_date).getTime() - new Date(first.snapshot_date).getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff >= 3) {
          const weeksDiff = daysDiff / 7;
          const velocity = (last.overall_score - first.overall_score) / weeksDiff;
          if (velocity > 1) {
            closeSources.push('accelerating_trajectory');
          }
        }
      }

      // High enthusiasm
      if (inv.enthusiasm >= 4) {
        closeSources.push('high_enthusiasm');
      }

      // Process signals (DD or term sheet stage)
      if (['in_dd', 'term_sheet'].includes(inv.status)) {
        closeSources.push('advanced_stage');
      }

      // No unresolved objections
      const objResult = await db.execute({
        sql: `SELECT COUNT(*) as count FROM objection_responses WHERE investor_id = ? AND (effectiveness IS NULL OR effectiveness = 'unknown' OR effectiveness = 'ineffective')`,
        args: [inv.id],
      });
      const unresolvedCount = Number((objResult.rows[0] as unknown as { count: number }).count);
      if (unresolvedCount === 0) {
        closeSources.push('no_objections');
      }

      if (closeSources.length >= 4) {
        signals.push({
          signal: `${inv.name}: all signals point to READY TO CLOSE — accelerating trajectory, high enthusiasm, advanced stage, no objections`,
          sources: closeSources,
          confidence: 'very_high',
          recommendation: `Push for term sheet / commitment with ${inv.name} NOW — all indicators aligned. Delay risks losing momentum.`,
        });
      } else if (closeSources.length >= 3) {
        signals.push({
          signal: `${inv.name}: strong close indicators — ${closeSources.join(', ')}`,
          sources: closeSources,
          confidence: 'high',
          recommendation: `Prioritize ${inv.name} for close — address any remaining gap (${['accelerating_trajectory', 'high_enthusiasm', 'advanced_stage', 'no_objections'].filter(s => !closeSources.includes(s)).join(', ') || 'none'}) to accelerate`,
        });
      }
    }
  } catch { /* non-blocking */ }

  // --- Signal 3: Narrative Crisis ---
  // 3+ investors questioning same topic + declining overall enthusiasm + objection resolution rate < 50%
  try {
    const narrativeSources: string[] = [];

    // Check question convergence
    const patterns = await getQuestionPatterns();
    const criticalTopics = patterns.filter(p => p.investorCount >= 3);
    if (criticalTopics.length >= 1) {
      narrativeSources.push('question_convergence');
    }

    // Check overall enthusiasm trend
    const narrativeSignals = await computeNarrativeSignals();
    const totalSignals = narrativeSignals.filter(ns => ns.sampleSize >= 2);
    if (totalSignals.length > 0) {
      const avgEnthusiasm = totalSignals.reduce((sum, ns) => sum + ns.avgEnthusiasm, 0) / totalSignals.length;
      if (avgEnthusiasm < 3.0) {
        narrativeSources.push('low_overall_enthusiasm');
      }
    }

    // Check objection resolution rate
    const objEvolution = await computeObjectionEvolution();
    const totalObjTopics = objEvolution.emergingObjections.length + objEvolution.persistentObjections.length + objEvolution.resolvedObjections.length;
    if (totalObjTopics > 0) {
      const resolutionRate = objEvolution.resolvedObjections.length / totalObjTopics;
      if (resolutionRate < 0.5) {
        narrativeSources.push('low_objection_resolution');
      }
    }

    if (narrativeSources.length >= 3) {
      signals.push({
        signal: `NARRATIVE CRISIS: question convergence + low enthusiasm + poor objection resolution all indicate pitch is not landing`,
        sources: narrativeSources,
        confidence: 'very_high',
        recommendation: `Urgent pitch overhaul needed — focus on the ${criticalTopics.length} topic(s) investors keep questioning (${criticalTopics.map(t => t.topic).join(', ')}). Consider external pitch coaching or investor advisory board feedback.`,
      });
    } else if (narrativeSources.length === 2) {
      signals.push({
        signal: `Narrative weakening: ${narrativeSources.join(' + ')} detected — pitch may need adjustment`,
        sources: narrativeSources,
        confidence: 'high',
        recommendation: `Review pitch materials against recent investor feedback — preemptively strengthen before next round of meetings`,
      });
    }
  } catch { /* non-blocking */ }

  // --- Signal 4: Competitive Window ---
  // DD synchronization + keystone investor advancing + declining time-between-meetings → optimal moment for term sheet push
  try {
    const windowSources: string[] = [];

    // Check DD synchronization (2+ investors in DD)
    const ddInvestors = await db.execute(
      `SELECT COUNT(*) as count FROM investors WHERE status = 'in_dd' AND status NOT IN ('passed', 'dropped')`
    );
    const ddCount = Number((ddInvestors.rows[0] as unknown as { count: number }).count);
    if (ddCount >= 2) {
      windowSources.push('dd_synchronization');
    }

    // Check if keystone investor is advancing
    const keystones = await getKeystoneInvestors();
    for (const ks of keystones) {
      if (ks.cascadeValue !== 'minimal') {
        const invResult = await db.execute({ sql: `SELECT status FROM investors WHERE id = ?`, args: [ks.id] });
        if (invResult.rows.length > 0) {
          const status = (invResult.rows[0] as unknown as { status: string }).status;
          if (['engaged', 'in_dd', 'term_sheet'].includes(status)) {
            windowSources.push('keystone_advancing');
            break;
          }
        }
      }
    }

    // Check meeting density (declining time between meetings = increasing urgency)
    const recentMeetings = await db.execute(
      `SELECT date FROM meetings ORDER BY date DESC LIMIT 10`
    );
    const meetingDates = (recentMeetings.rows as unknown as Array<{ date: string }>).map(r => new Date(r.date).getTime());
    if (meetingDates.length >= 4) {
      const gaps: number[] = [];
      for (let i = 0; i < meetingDates.length - 1; i++) {
        gaps.push((meetingDates[i] - meetingDates[i + 1]) / (1000 * 60 * 60 * 24));
      }
      const recentAvgGap = gaps.slice(0, Math.floor(gaps.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(gaps.length / 2);
      const olderAvgGap = gaps.slice(Math.floor(gaps.length / 2)).reduce((a, b) => a + b, 0) / (gaps.length - Math.floor(gaps.length / 2));
      if (recentAvgGap < olderAvgGap * 0.7) {
        windowSources.push('meeting_density_increasing');
      }
    }

    if (windowSources.length >= 3) {
      signals.push({
        signal: `COMPETITIVE WINDOW OPEN: DD sync + keystone advancing + accelerating meeting pace — optimal moment for term sheet push`,
        sources: windowSources,
        confidence: 'very_high',
        recommendation: `This is the optimal window to push for commitments — competitive tension is real, keystone investor is advancing, and momentum is building. Present term sheet to most advanced investors.`,
      });
    } else if (windowSources.length === 2) {
      signals.push({
        signal: `Competitive window forming: ${windowSources.join(' + ')}`,
        sources: windowSources,
        confidence: 'high',
        recommendation: `Prepare term sheet materials — window for competitive tension leverage is approaching`,
      });
    }
  } catch { /* non-blocking */ }

  return signals;
  });
}

// ---------------------------------------------------------------------------
// Smart Follow-up Timing — Optimal timing for follow-ups based on patterns
// ---------------------------------------------------------------------------

export async function computeOptimalFollowupTiming(investorId: string): Promise<{
  optimalDayOfWeek: string;
  optimalTimeOfDay: string;
  reasoning: string;
}> {
  await ensureInitialized();
  const db = getClient();

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Get all meetings with this investor and their enthusiasm scores
  const meetingsResult = await db.execute({
    sql: `SELECT date, enthusiasm_score FROM meetings WHERE investor_id = ? ORDER BY date DESC`,
    args: [investorId],
  });
  const meetings = meetingsResult.rows as unknown as Array<{ date: string; enthusiasm_score: number }>;

  // Get the investor's type for type-level pattern analysis
  const invResult = await db.execute({ sql: `SELECT type, name FROM investors WHERE id = ?`, args: [investorId] });
  const investor = invResult.rows.length > 0
    ? (invResult.rows[0] as unknown as { type: string; name: string })
    : { type: 'vc', name: 'Unknown' };

  // Analyze day-of-week patterns for THIS investor
  const dayScores: Record<number, { total: number; count: number }> = {};
  for (const m of meetings) {
    const date = new Date(m.date);
    const day = date.getUTCDay();
    if (!dayScores[day]) dayScores[day] = { total: 0, count: 0 };
    dayScores[day].total += m.enthusiasm_score;
    dayScores[day].count++;
  }

  // Analyze day-of-week patterns for ALL investors of this type (broader signal)
  const typeResult = await db.execute({
    sql: `SELECT m.date, m.enthusiasm_score
          FROM meetings m
          JOIN investors i ON i.id = m.investor_id
          WHERE i.type = ?
          ORDER BY m.date DESC
          LIMIT 100`,
    args: [investor.type],
  });
  const typeMeetings = typeResult.rows as unknown as Array<{ date: string; enthusiasm_score: number }>;

  const typeDayScores: Record<number, { total: number; count: number }> = {};
  for (const m of typeMeetings) {
    const date = new Date(m.date);
    const day = date.getUTCDay();
    if (!typeDayScores[day]) typeDayScores[day] = { total: 0, count: 0 };
    typeDayScores[day].total += m.enthusiasm_score;
    typeDayScores[day].count++;
  }

  // Find optimal day (blend individual + type patterns, weight individual 70%, type 30%)
  let bestDay = 2; // Default to Tuesday
  let bestDayScore = 0;
  const reasonParts: string[] = [];

  for (let day = 1; day <= 5; day++) { // Monday-Friday only
    const individual = dayScores[day];
    const typeLevel = typeDayScores[day];

    const indivAvg = individual && individual.count > 0 ? individual.total / individual.count : 0;
    const typeAvg = typeLevel && typeLevel.count > 0 ? typeLevel.total / typeLevel.count : 0;

    let blended: number;
    if (individual && individual.count >= 2) {
      blended = indivAvg * 0.7 + typeAvg * 0.3;
    } else if (typeLevel && typeLevel.count >= 2) {
      blended = typeAvg;
    } else {
      // Default: midweek slightly preferred
      blended = day === 2 || day === 3 ? 3.2 : 3.0;
    }

    if (blended > bestDayScore) {
      bestDayScore = blended;
      bestDay = day;
    }
  }

  // Determine time of day based on investor type heuristics
  let optimalTime = '10:00 AM';
  const typeHeuristics: Record<string, { time: string; reason: string }> = {
    'vc': { time: '10:00 AM', reason: 'VCs typically have morning partner meetings; late morning catches attention' },
    'growth': { time: '9:30 AM', reason: 'Growth equity runs on tight schedules; early catch is best' },
    'sovereign': { time: '11:00 AM', reason: 'Sovereign wealth funds operate across time zones; late morning accommodates review cycles' },
    'strategic': { time: '2:00 PM', reason: 'Strategic/corporate investors often have morning internal meetings; afternoon is review time' },
    'family_office': { time: '10:30 AM', reason: 'Family offices have flexible schedules; mid-morning is reliable' },
    'debt': { time: '9:00 AM', reason: 'Debt providers start early; catching the credit committee prep window' },
  };

  const typeHint = typeHeuristics[investor.type] || typeHeuristics['vc'];
  optimalTime = typeHint.time;

  // Build reasoning
  if (meetings.length >= 3) {
    const indivData = dayScores[bestDay];
    if (indivData && indivData.count >= 2) {
      reasonParts.push(`${investor.name}'s meetings on ${DAY_NAMES[bestDay]}s averaged ${(indivData.total / indivData.count).toFixed(1)}/5 enthusiasm (n=${indivData.count})`);
    }
  }

  if (typeMeetings.length >= 5) {
    const typeData = typeDayScores[bestDay];
    if (typeData && typeData.count >= 2) {
      reasonParts.push(`${investor.type} investors generally show higher enthusiasm on ${DAY_NAMES[bestDay]}s (${(typeData.total / typeData.count).toFixed(1)}/5, n=${typeData.count})`);
    }
  }

  reasonParts.push(typeHint.reason);

  if (meetings.length < 3 && typeMeetings.length < 5) {
    reasonParts.push('Limited meeting history — recommendation based on type-level heuristics. Will improve with more data.');
  }

  return {
    optimalDayOfWeek: DAY_NAMES[bestDay],
    optimalTimeOfDay: optimalTime,
    reasoning: reasonParts.join('. ') + '.',
  };
}

// ---------------------------------------------------------------------------
// Learning Intelligence — Action Outcome Measurement
// ---------------------------------------------------------------------------

export async function measureActionEffectiveness(): Promise<{
  measured: number;
  avgLift: number;
  bestActionType: string;
  worstActionType: string;
  byType: { actionType: string; avgLift: number; count: number }[];
}> {
  await ensureInitialized();
  const db = getClient();

  // Get all executed actions that haven't been measured yet
  const unmeasuredResult = await db.execute(
    `SELECT * FROM acceleration_actions WHERE status = 'executed' AND actual_lift IS NULL`
  );
  const unmeasuredActions = unmeasuredResult.rows as unknown as AccelerationAction[];

  let measured = 0;
  const liftsByType: Record<string, { total: number; count: number }> = {};

  for (const action of unmeasuredActions) {
    // Skip synthetic investor IDs (narrative_* patterns) — no investor-level measurement possible
    if (action.investor_id.startsWith('narrative_')) {
      // For narrative-type actions, mark with neutral lift (can't measure directly)
      await db.execute({
        sql: `UPDATE acceleration_actions SET actual_lift = 0 WHERE id = ?`,
        args: [action.id],
      });
      measured++;
      if (!liftsByType[action.action_type]) liftsByType[action.action_type] = { total: 0, count: 0 };
      liftsByType[action.action_type].total += 0;
      liftsByType[action.action_type].count++;
      continue;
    }

    const executedAt = action.executed_at;
    if (!executedAt) continue;

    // Find the last meeting BEFORE execution
    const beforeResult = await db.execute({
      sql: `SELECT enthusiasm_score FROM meetings
            WHERE investor_id = ? AND date < ?
            ORDER BY date DESC LIMIT 1`,
      args: [action.investor_id, executedAt],
    });

    // Find the first meeting AFTER execution
    const afterResult = await db.execute({
      sql: `SELECT enthusiasm_score FROM meetings
            WHERE investor_id = ? AND date > ?
            ORDER BY date ASC LIMIT 1`,
      args: [action.investor_id, executedAt],
    });

    // Check if investor status progressed
    const invResult = await db.execute({
      sql: `SELECT status FROM investors WHERE id = ?`,
      args: [action.investor_id],
    });
    const currentStatus = invResult.rows.length > 0
      ? (invResult.rows[0] as unknown as { status: string }).status
      : null;

    // Check if any new meetings were scheduled after execution
    const newMeetingsResult = await db.execute({
      sql: `SELECT COUNT(*) as count FROM meetings
            WHERE investor_id = ? AND date > ?`,
      args: [action.investor_id, executedAt],
    });
    const newMeetingCount = Number((newMeetingsResult.rows[0] as unknown as { count: number }).count);

    // Compute lift score (-10 to +20)
    let lift = 0;

    // Enthusiasm change component (-5 to +10)
    const enthBefore = beforeResult.rows.length > 0
      ? Number((beforeResult.rows[0] as unknown as { enthusiasm_score: number }).enthusiasm_score)
      : null;
    const enthAfter = afterResult.rows.length > 0
      ? Number((afterResult.rows[0] as unknown as { enthusiasm_score: number }).enthusiasm_score)
      : null;

    if (enthBefore !== null && enthAfter !== null) {
      const enthDelta = enthAfter - enthBefore;
      lift += Math.max(-5, Math.min(10, enthDelta * 3)); // Scale: each point of enthusiasm = 3 lift
    }

    // Status progression component (0 to +8)
    if (currentStatus) {
      const statusOrder: Record<string, number> = {
        identified: 0, contacted: 1, nda_signed: 2, meeting_scheduled: 3,
        met: 4, engaged: 5, in_dd: 6, term_sheet: 7, closed: 8,
        passed: -1, dropped: -1,
      };
      // We need the status at execution time — approximate from activity log
      const statusAtExecResult = await db.execute({
        sql: `SELECT detail FROM activity_log
              WHERE investor_id = ? AND event_type = 'status_changed' AND created_at <= ?
              ORDER BY created_at DESC LIMIT 1`,
        args: [action.investor_id, executedAt],
      });
      let statusAtExec: string | null = null;
      if (statusAtExecResult.rows.length > 0) {
        const detail = (statusAtExecResult.rows[0] as unknown as { detail: string }).detail || '';
        const match = detail.match(/(?:->|→)\s*(\w+)/i);
        if (match) statusAtExec = match[1];
      }

      if (statusAtExec) {
        const oldIdx = statusOrder[statusAtExec] ?? 0;
        const newIdx = statusOrder[currentStatus] ?? 0;
        if (newIdx > oldIdx) {
          lift += Math.min(8, (newIdx - oldIdx) * 3);
        } else if (currentStatus === 'passed' || currentStatus === 'dropped') {
          lift -= 5; // Investor was lost
        }
      }
    }

    // Engagement increase component (0 to +5)
    if (newMeetingCount > 0) {
      lift += Math.min(5, newMeetingCount * 2);
    }

    // If we have NO post-execution data at all, skip measuring (wait for more data)
    if (enthAfter === null && newMeetingCount === 0) {
      // Check if enough time has passed (14+ days) — if so, neutral lift
      const execDate = new Date(executedAt);
      const daysSinceExec = (Date.now() - execDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceExec < 14) continue; // Not enough time, skip for now
      // If 14+ days with no interaction, that's a signal of low effectiveness
      lift = -2;
    }

    // Clamp to range
    lift = Math.max(-10, Math.min(20, Math.round(lift)));

    // Update the action with measured lift
    await db.execute({
      sql: `UPDATE acceleration_actions SET actual_lift = ? WHERE id = ?`,
      args: [lift, action.id],
    });

    measured++;
    if (!liftsByType[action.action_type]) liftsByType[action.action_type] = { total: 0, count: 0 };
    liftsByType[action.action_type].total += lift;
    liftsByType[action.action_type].count++;
  }

  // Also include previously measured actions for the aggregation
  const allMeasuredResult = await db.execute(
    `SELECT action_type, actual_lift FROM acceleration_actions WHERE actual_lift IS NOT NULL`
  );
  const allMeasured = allMeasuredResult.rows as unknown as Array<{ action_type: string; actual_lift: number }>;

  const allByType: Record<string, { total: number; count: number }> = {};
  let totalLift = 0;
  for (const row of allMeasured) {
    if (!allByType[row.action_type]) allByType[row.action_type] = { total: 0, count: 0 };
    allByType[row.action_type].total += row.actual_lift;
    allByType[row.action_type].count++;
    totalLift += row.actual_lift;
  }

  const byType = Object.entries(allByType).map(([actionType, data]) => ({
    actionType,
    avgLift: data.count > 0 ? Math.round((data.total / data.count) * 10) / 10 : 0,
    count: data.count,
  }));

  byType.sort((a, b) => b.avgLift - a.avgLift);

  return {
    measured,
    avgLift: allMeasured.length > 0 ? Math.round((totalLift / allMeasured.length) * 10) / 10 : 0,
    bestActionType: byType.length > 0 ? byType[0].actionType : 'none',
    worstActionType: byType.length > 0 ? byType[byType.length - 1].actionType : 'none',
    byType,
  };
}

// ---------------------------------------------------------------------------
// Learning Intelligence — Auto-Action Rule Effectiveness
// ---------------------------------------------------------------------------

export async function getAutoActionEffectiveness(): Promise<{
  ruleEffectiveness: {
    triggerType: string;
    actionType: string;
    avgLift: number;
    count: number;
    confidence: 'high' | 'medium' | 'low';
    recommendation: string;
  }[];
  overallAvgLift: number;
}> {
  await ensureInitialized();
  const db = getClient();

  // Aggregate measured lifts by trigger_type + action_type
  const result = await db.execute(
    `SELECT trigger_type, action_type, AVG(actual_lift) as avg_lift, COUNT(*) as count
     FROM acceleration_actions
     WHERE actual_lift IS NOT NULL
     GROUP BY trigger_type, action_type
     ORDER BY avg_lift DESC`
  );

  const rows = result.rows as unknown as Array<{
    trigger_type: string;
    action_type: string;
    avg_lift: number;
    count: number;
  }>;

  const ruleEffectiveness = rows.map(row => {
    const avgLift = Math.round(row.avg_lift * 10) / 10;
    const count = Number(row.count);

    // Confidence based on sample size
    let confidence: 'high' | 'medium' | 'low';
    if (count >= 10) confidence = 'high';
    else if (count >= 5) confidence = 'medium';
    else confidence = 'low';

    // Recommendation based on measured effectiveness
    let recommendation: string;
    if (count < 5) {
      recommendation = 'Insufficient data — continue measuring';
    } else if (avgLift > 8) {
      recommendation = 'HIGH PERFORMER — increase frequency and expected_lift';
    } else if (avgLift > 4) {
      recommendation = 'Effective — continue using';
    } else if (avgLift > 2) {
      recommendation = 'Marginally effective — consider refining trigger conditions';
    } else if (avgLift > 0) {
      recommendation = 'LOW PERFORMER — consider modifying or reducing frequency';
    } else {
      recommendation = 'INEFFECTIVE — skip this rule until redesigned';
    }

    return {
      triggerType: row.trigger_type,
      actionType: row.action_type,
      avgLift,
      count,
      confidence,
      recommendation,
    };
  });

  // Overall average lift across all measured actions
  const overallResult = await db.execute(
    `SELECT AVG(actual_lift) as avg_lift FROM acceleration_actions WHERE actual_lift IS NOT NULL`
  );
  const overallAvgLift = overallResult.rows.length > 0
    ? Math.round(Number((overallResult.rows[0] as unknown as { avg_lift: number | null }).avg_lift ?? 0) * 10) / 10
    : 0;

  return {
    ruleEffectiveness,
    overallAvgLift,
  };
}

// ---------------------------------------------------------------------------
// Objection Evolution — temporal intelligence on how objections change (Cycle 10)
// ---------------------------------------------------------------------------

export function computeObjectionEvolution(): Promise<{
  emergingObjections: { topic: string; firstSeen: string; growthRate: number; currentCount: number }[];
  resolvedObjections: { topic: string; peakCount: number; resolvedDate: string; effectiveResponse: string }[];
  persistentObjections: { topic: string; count: number; duration: number; avgEnthusiasmImpact: number }[];
  objectionHeatMap: { topic: string; week: string; count: number }[];
}> {
  return cachedCompute('computeObjectionEvolution', 120_000, async () => {
  await ensureInitialized();
  const db = getClient();

  // Fetch all meetings with objections, ordered by date
  const meetingsResult = await db.execute(
    `SELECT m.date, m.objections, m.enthusiasm_score, m.investor_id
     FROM meetings m
     WHERE m.objections != '[]'
     ORDER BY m.date ASC`
  );
  const meetingRows = meetingsResult.rows as unknown as Array<{
    date: string;
    objections: string;
    enthusiasm_score: number;
    investor_id: string;
  }>;

  // Parse all objections with their dates
  interface ObjectionEvent {
    topic: string;
    text: string;
    date: string;
    enthusiasm: number;
    investorId: string;
  }
  const allEvents: ObjectionEvent[] = [];

  for (const row of meetingRows) {
    try {
      const objs = JSON.parse(row.objections) as Array<{ topic?: string; text?: string }>;
      for (const obj of objs) {
        if (obj.topic) {
          allEvents.push({
            topic: obj.topic,
            text: obj.text || '',
            date: row.date,
            enthusiasm: row.enthusiasm_score,
            investorId: row.investor_id,
          });
        }
      }
    } catch { /* skip malformed JSON */ }
  }

  if (allEvents.length === 0) {
    return { emergingObjections: [], resolvedObjections: [], persistentObjections: [], objectionHeatMap: [] };
  }

  // Group events by topic
  const byTopic = new Map<string, ObjectionEvent[]>();
  for (const evt of allEvents) {
    if (!byTopic.has(evt.topic)) byTopic.set(evt.topic, []);
    byTopic.get(evt.topic)!.push(evt);
  }

  // Compute ISO week string for heat map
  const getWeek = (dateStr: string): string => {
    const d = new Date(dateStr);
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((d.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    const weekNum = Math.ceil((dayOfYear + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  };

  // Build heat map
  const objectionHeatMap: { topic: string; week: string; count: number }[] = [];
  const heatMapAgg = new Map<string, number>(); // "topic|week" → count
  for (const evt of allEvents) {
    const key = `${evt.topic}|${getWeek(evt.date)}`;
    heatMapAgg.set(key, (heatMapAgg.get(key) || 0) + 1);
  }
  for (const [key, count] of heatMapAgg) {
    const [topic, week] = key.split('|');
    objectionHeatMap.push({ topic, week, count });
  }
  objectionHeatMap.sort((a, b) => a.week.localeCompare(b.week));

  // Determine time boundaries
  const allDates = allEvents.map(e => new Date(e.date).getTime());
  const latestDate = Math.max(...allDates);
  const msPerDay = 1000 * 60 * 60 * 24;
  const recentThresholdMs = latestDate - 21 * msPerDay; // last 3 weeks = recent
  const olderThresholdMs = latestDate - 42 * msPerDay; // 6 weeks ago

  // Classify topics
  const emergingObjections: { topic: string; firstSeen: string; growthRate: number; currentCount: number }[] = [];
  const resolvedObjections: { topic: string; peakCount: number; resolvedDate: string; effectiveResponse: string }[] = [];
  const persistentObjections: { topic: string; count: number; duration: number; avgEnthusiasmImpact: number }[] = [];

  for (const [topic, events] of byTopic) {
    const sortedEvents = events.sort((a, b) => a.date.localeCompare(b.date));
    const firstSeen = sortedEvents[0].date;
    const lastSeen = sortedEvents[sortedEvents.length - 1].date;
    const firstTime = new Date(firstSeen).getTime();
    const lastTime = new Date(lastSeen).getTime();

    const recentEvents = sortedEvents.filter(e => new Date(e.date).getTime() >= recentThresholdMs);
    const olderEvents = sortedEvents.filter(e => new Date(e.date).getTime() < recentThresholdMs && new Date(e.date).getTime() >= olderThresholdMs);

    // EMERGING: first seen recently, or strong growth in recent vs older period
    if (firstTime >= recentThresholdMs || (recentEvents.length > olderEvents.length && recentEvents.length >= 2)) {
      const durationWeeks = Math.max(1, (lastTime - firstTime) / (7 * msPerDay));
      const growthRate = Math.round((recentEvents.length / durationWeeks) * 10) / 10;
      emergingObjections.push({
        topic,
        firstSeen,
        growthRate,
        currentCount: events.length,
      });
      continue;
    }

    // RESOLVED: last seen more than 3 weeks ago, and had at least 2 occurrences
    if (lastTime < recentThresholdMs && events.length >= 2) {
      // Look for the effective response in objection_responses table
      let effectiveResponse = '';
      try {
        const respResult = await db.execute({
          sql: `SELECT response_text FROM objection_responses
                WHERE objection_topic = ? AND effectiveness = 'effective' AND response_text != ''
                ORDER BY updated_at DESC LIMIT 1`,
          args: [topic],
        });
        if (respResult.rows.length > 0) {
          effectiveResponse = String((respResult.rows[0] as unknown as { response_text: string }).response_text);
        }
      } catch { /* non-blocking */ }

      // Count by week to find peak
      const weekCounts = new Map<string, number>();
      for (const evt of sortedEvents) {
        const w = getWeek(evt.date);
        weekCounts.set(w, (weekCounts.get(w) || 0) + 1);
      }
      const peakCount = Math.max(...weekCounts.values());

      resolvedObjections.push({
        topic,
        peakCount,
        resolvedDate: lastSeen,
        effectiveResponse,
      });
      continue;
    }

    // PERSISTENT: spans both old and recent, keeps appearing
    if (events.length >= 3 && recentEvents.length > 0 && olderEvents.length > 0) {
      const durationWeeks = Math.round((lastTime - firstTime) / (7 * msPerDay) * 10) / 10;
      const avgEnthusiasm = events.reduce((s, e) => s + e.enthusiasm, 0) / events.length;
      // Impact = how much lower enthusiasm is in meetings with this objection vs baseline 3
      const avgEnthusiasmImpact = Math.round((3 - avgEnthusiasm) * 10) / 10;

      persistentObjections.push({
        topic,
        count: events.length,
        duration: durationWeeks,
        avgEnthusiasmImpact,
      });
    }
  }

  // Sort by relevance
  emergingObjections.sort((a, b) => b.growthRate - a.growthRate);
  persistentObjections.sort((a, b) => b.count - a.count);
  resolvedObjections.sort((a, b) => b.peakCount - a.peakCount);

  return {
    emergingObjections,
    resolvedObjections,
    persistentObjections,
    objectionHeatMap,
  };
  });
}

// ---------------------------------------------------------------------------
// Pipeline Flow Intelligence — stage dwell time, bottlenecks, velocity (Cycle 10)
// ---------------------------------------------------------------------------

export function computePipelineFlow(): Promise<{
  avgDaysPerStage: Record<string, number>;
  bottleneckStage: string;
  bottleneckAvgDays: number;
  conversionByStage: Record<string, number>;
  velocityTrend: 'accelerating' | 'steady' | 'decelerating';
  stageHealth: { stage: string; count: number; avgDays: number; conversionRate: number; health: 'healthy' | 'slow' | 'blocked' }[];
}> {
  return cachedCompute('computePipelineFlow', 120_000, async () => {
  await ensureInitialized();
  const db = getClient();

  // Define ordered stages
  const stageOrder = ['identified', 'contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged', 'in_dd', 'term_sheet', 'closed'];
  const stageIndex = new Map(stageOrder.map((s, i) => [s, i]));

  // Get all status change events from activity_log
  const statusChanges = await db.execute(
    `SELECT investor_id, detail, created_at
     FROM activity_log
     WHERE event_type = 'status_changed'
     ORDER BY investor_id, created_at ASC`
  );
  const changeRows = statusChanges.rows as unknown as Array<{
    investor_id: string;
    detail: string;
    created_at: string;
  }>;

  // Also get current investor statuses for investors who may never have had a status_changed event
  const investorsResult = await db.execute(
    `SELECT id, status, created_at FROM investors WHERE status NOT IN ('passed', 'dropped')`
  );
  const investorRows = investorsResult.rows as unknown as Array<{
    id: string;
    status: string;
    created_at: string;
  }>;

  // Build per-investor timeline: list of (stage, enteredDate)
  const investorTimelines = new Map<string, { stage: string; date: string }[]>();

  // Initialize with creation date → 'identified'
  for (const inv of investorRows) {
    if (!investorTimelines.has(inv.id)) {
      investorTimelines.set(inv.id, [{ stage: 'identified', date: inv.created_at }]);
    }
  }

  // Parse status changes from activity_log detail field
  // Common patterns: "Status changed to engaged", "Status: contacted → met", etc.
  for (const row of changeRows) {
    const detail = row.detail || '';
    // Try to extract the new status from the detail
    let newStatus: string | null = null;

    // Pattern 1: "Status changed to <status>"
    const match1 = detail.match(/(?:changed|updated)\s+(?:to|→)\s+(\w+)/i);
    if (match1) newStatus = match1[1].toLowerCase();

    // Pattern 2: "<old> → <new>"
    if (!newStatus) {
      const match2 = detail.match(/→\s*(\w+)/);
      if (match2) newStatus = match2[1].toLowerCase();
    }

    // Pattern 3: just the status name if detail is short
    if (!newStatus && stageIndex.has(detail.toLowerCase().trim())) {
      newStatus = detail.toLowerCase().trim();
    }

    if (newStatus && stageIndex.has(newStatus)) {
      if (!investorTimelines.has(row.investor_id)) {
        investorTimelines.set(row.investor_id, []);
      }
      investorTimelines.get(row.investor_id)!.push({ stage: newStatus, date: row.created_at });
    }
  }

  // Compute stage dwell times and conversions
  const stageDwellDays: Record<string, number[]> = {};
  const stageEntryDates: Record<string, string[]> = {}; // for velocity trend
  const stageEntered: Record<string, number> = {};
  const stageAdvanced: Record<string, number> = {};

  for (const stage of stageOrder) {
    stageDwellDays[stage] = [];
    stageEntryDates[stage] = [];
    stageEntered[stage] = 0;
    stageAdvanced[stage] = 0;
  }

  const msPerDay = 1000 * 60 * 60 * 24;

  for (const [, timeline] of investorTimelines) {
    const sorted = [...timeline].sort((a, b) => a.date.localeCompare(b.date));

    for (let i = 0; i < sorted.length; i++) {
      const stage = sorted[i].stage;
      if (!stageIndex.has(stage)) continue;

      stageEntered[stage] = (stageEntered[stage] || 0) + 1;
      stageEntryDates[stage] = stageEntryDates[stage] || [];
      stageEntryDates[stage].push(sorted[i].date);

      // If there's a next stage in the timeline, compute dwell time
      if (i < sorted.length - 1) {
        const nextStage = sorted[i + 1].stage;
        const dwellMs = new Date(sorted[i + 1].date).getTime() - new Date(sorted[i].date).getTime();
        const dwellDays = Math.max(0, dwellMs / msPerDay);
        stageDwellDays[stage] = stageDwellDays[stage] || [];
        stageDwellDays[stage].push(dwellDays);

        // Count as advanced if next stage is further along
        if ((stageIndex.get(nextStage) ?? -1) > (stageIndex.get(stage) ?? -1)) {
          stageAdvanced[stage] = (stageAdvanced[stage] || 0) + 1;
        }
      }
    }
  }

  // Also count investors currently AT each stage (for stageHealth.count)
  const currentStageCounts: Record<string, number> = {};
  for (const inv of investorRows) {
    currentStageCounts[inv.status] = (currentStageCounts[inv.status] || 0) + 1;
  }

  // Compute averages
  const avgDaysPerStage: Record<string, number> = {};
  for (const stage of stageOrder) {
    const dwells = stageDwellDays[stage] || [];
    avgDaysPerStage[stage] = dwells.length > 0
      ? Math.round((dwells.reduce((a, b) => a + b, 0) / dwells.length) * 10) / 10
      : 0;
  }

  // Find bottleneck (stage with longest average dwell time, excluding stages with no data)
  let bottleneckStage = 'identified';
  let bottleneckAvgDays = 0;
  for (const stage of stageOrder) {
    if (avgDaysPerStage[stage] > bottleneckAvgDays && (stageDwellDays[stage] || []).length > 0) {
      bottleneckStage = stage;
      bottleneckAvgDays = avgDaysPerStage[stage];
    }
  }

  // Conversion rates per stage
  const conversionByStage: Record<string, number> = {};
  for (const stage of stageOrder) {
    const entered = stageEntered[stage] || 0;
    const advanced = stageAdvanced[stage] || 0;
    conversionByStage[stage] = entered > 0 ? Math.round((advanced / entered) * 100) : 0;
  }

  // Velocity trend: is the pipeline moving faster or slower over time?
  // Compare average dwell times of recent transitions vs older transitions.
  let velocityTrend: 'accelerating' | 'steady' | 'decelerating' = 'steady';
  const allDwells: { date: string; days: number }[] = [];
  for (const [, timeline] of investorTimelines) {
    const sorted = [...timeline].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < sorted.length - 1; i++) {
      const dwellMs = new Date(sorted[i + 1].date).getTime() - new Date(sorted[i].date).getTime();
      allDwells.push({ date: sorted[i].date, days: dwellMs / msPerDay });
    }
  }

  if (allDwells.length >= 4) {
    allDwells.sort((a, b) => a.date.localeCompare(b.date));
    const midpoint = Math.floor(allDwells.length / 2);
    const firstHalf = allDwells.slice(0, midpoint);
    const secondHalf = allDwells.slice(midpoint);
    const avgFirst = firstHalf.reduce((s, d) => s + d.days, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, d) => s + d.days, 0) / secondHalf.length;

    if (avgSecond < avgFirst * 0.75) {
      velocityTrend = 'accelerating'; // transitions getting faster
    } else if (avgSecond > avgFirst * 1.35) {
      velocityTrend = 'decelerating'; // transitions getting slower
    }
  }

  // Stage health classification
  const stageHealth: { stage: string; count: number; avgDays: number; conversionRate: number; health: 'healthy' | 'slow' | 'blocked' }[] = [];
  // Healthy thresholds vary by stage
  const healthThresholds: Record<string, { slow: number; blocked: number }> = {
    identified: { slow: 14, blocked: 30 },
    contacted: { slow: 10, blocked: 21 },
    nda_signed: { slow: 7, blocked: 14 },
    meeting_scheduled: { slow: 14, blocked: 30 },
    met: { slow: 14, blocked: 30 },
    engaged: { slow: 21, blocked: 45 },
    in_dd: { slow: 30, blocked: 60 },
    term_sheet: { slow: 21, blocked: 45 },
    closed: { slow: 999, blocked: 999 }, // terminal
  };

  for (const stage of stageOrder) {
    const avgDays = avgDaysPerStage[stage];
    const conversion = conversionByStage[stage];
    const count = currentStageCounts[stage] || 0;
    const thresholds = healthThresholds[stage] || { slow: 21, blocked: 45 };

    let health: 'healthy' | 'slow' | 'blocked';
    if (avgDays >= thresholds.blocked || (conversion > 0 && conversion < 20 && count > 2)) {
      health = 'blocked';
    } else if (avgDays >= thresholds.slow || (conversion > 0 && conversion < 40)) {
      health = 'slow';
    } else {
      health = 'healthy';
    }

    stageHealth.push({
      stage,
      count,
      avgDays,
      conversionRate: conversion,
      health,
    });
  }

  return {
    avgDaysPerStage,
    bottleneckStage,
    bottleneckAvgDays,
    conversionByStage,
    velocityTrend,
    stageHealth,
  };
  });
}

// ---------------------------------------------------------------------------
// Health Snapshots — strategic assessment tracking (cycle 11)
// ---------------------------------------------------------------------------

export interface HealthSnapshot {
  id: string;
  snapshot_date: string;
  pipeline_score: number;
  narrative_score: number;
  readiness_score: number;
  velocity: number;
  active_investors: number;
  strategic_summary: string;
  created_at: string;
}

export async function saveHealthSnapshot(snapshot: {
  pipelineScore: number;
  narrativeScore: number;
  readinessScore: number;
  velocity: number;
  activeInvestors: number;
  strategicSummary: string;
}): Promise<void> {
  await ensureInitialized();
  const db = getClient();
  const id = `hs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await db.execute({
    sql: `INSERT INTO health_snapshots (id, pipeline_score, narrative_score, readiness_score, velocity, active_investors, strategic_summary)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      snapshot.pipelineScore,
      snapshot.narrativeScore,
      snapshot.readinessScore,
      snapshot.velocity,
      snapshot.activeInvestors,
      snapshot.strategicSummary,
    ],
  });
}

export async function getHealthSnapshots(limit: number = 30): Promise<HealthSnapshot[]> {
  await ensureInitialized();
  const db = getClient();
  const result = await db.execute({
    sql: `SELECT * FROM health_snapshots ORDER BY snapshot_date DESC, created_at DESC LIMIT ?`,
    args: [limit],
  });
  return result.rows as unknown as HealthSnapshot[];
}

// ---------------------------------------------------------------------------
// Close Date Forecasting — Investor timeline prediction (cycle 18)
// ---------------------------------------------------------------------------

export interface InvestorForecast {
  investorId: string;
  investorName: string;
  currentStage: string;
  tier: number;
  daysInStage: number;
  predictedDaysToClose: number;
  predictedCloseDate: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface RaiseForecast {
  forecasts: InvestorForecast[];
  expectedCloseDate: string;
  expectedAmount: number;
  confidence: 'high' | 'medium' | 'low';
  criticalPathInvestors: string[];
  riskFactors: string[];
}

export function computeRaiseForecast(): Promise<RaiseForecast> {
  return cachedCompute('computeRaiseForecast', 120_000, async () => {
  await ensureInitialized();
  const db = getClient();

  // Get active investors and pipeline flow data
  const [investorsResult, pipelineFlowData] = await Promise.all([
    db.execute(`SELECT * FROM investors WHERE status NOT IN ('passed', 'dropped', 'closed') ORDER BY tier ASC, name ASC`),
    computePipelineFlow(),
  ]);

  const investors = investorsResult.rows as unknown as Array<{
    id: string; name: string; status: string; tier: number; enthusiasm: number;
    updated_at: string; created_at: string;
  }>;

  const stageOrder = ['identified', 'contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged', 'in_dd', 'term_sheet', 'closed'];

  // Average days per stage from pipeline flow
  const avgDaysPerStage = pipelineFlowData.avgDaysPerStage;
  const conversionByStage = pipelineFlowData.conversionByStage;

  // Calibration-aware bias correction (cycle 24): learn from past forecast accuracy
  let calibrationMultiplier = 1.0;
  try {
    const calibration = await getForecastCalibration();
    if (calibration.biasDirection !== 'insufficient_data' && calibration.closedPredictions >= 3) {
      // If forecasts have been optimistic (predicted faster than reality), increase predicted days
      // If pessimistic (predicted slower), decrease predicted days
      // Scale: avgDelta of 14 days on a ~60 day average → ~23% adjustment
      // Use conservative 50% of raw delta as adjustment to avoid overcorrection
      const avgTotalPredicted = 60; // rough baseline for normalization
      const adjustmentFactor = (calibration.avgAccuracyDelta * 0.5) / avgTotalPredicted;
      calibrationMultiplier = 1.0 + Math.max(-0.3, Math.min(0.3, adjustmentFactor)); // cap at ±30%
    }
  } catch { /* non-blocking — use default 1.0 */ }

  // Fallback averages if no data
  const defaultDays: Record<string, number> = {
    identified: 7, contacted: 5, nda_signed: 3, meeting_scheduled: 7,
    met: 10, engaged: 14, in_dd: 21, term_sheet: 14,
  };

  const now = Date.now();
  const msPerDay = 1000 * 60 * 60 * 24;

  const forecasts: InvestorForecast[] = [];

  for (const inv of investors) {
    const currentIdx = stageOrder.indexOf(inv.status);
    if (currentIdx < 0) continue;

    const daysInStage = Math.max(0, Math.round((now - new Date(inv.updated_at || inv.created_at).getTime()) / msPerDay));

    // Sum up expected days from current stage to close
    let totalDaysRemaining = 0;
    let cumulativeConversion = 1.0;

    for (let i = currentIdx; i < stageOrder.length - 1; i++) {
      const stage = stageOrder[i];
      const avgDays = avgDaysPerStage[stage] || defaultDays[stage] || 14;
      const conversion = conversionByStage[stage] || 50;

      if (i === currentIdx) {
        // For current stage, subtract time already spent (but minimum 1 day remaining)
        totalDaysRemaining += Math.max(1, avgDays - daysInStage);
      } else {
        totalDaysRemaining += avgDays;
      }
      cumulativeConversion *= (conversion / 100);
    }

    // Tier adjustment: T1 investors often move faster
    const tierMultiplier = inv.tier === 1 ? 0.8 : inv.tier === 2 ? 1.0 : inv.tier === 3 ? 1.2 : 1.5;
    totalDaysRemaining = Math.round(totalDaysRemaining * tierMultiplier);

    // Enthusiasm adjustment: high enthusiasm = faster progression
    if (inv.enthusiasm >= 4) totalDaysRemaining = Math.round(totalDaysRemaining * 0.85);
    else if (inv.enthusiasm <= 2) totalDaysRemaining = Math.round(totalDaysRemaining * 1.3);

    // Calibration adjustment: apply learned bias correction from historical accuracy (cycle 24)
    totalDaysRemaining = Math.round(totalDaysRemaining * calibrationMultiplier);

    const predictedCloseDate = new Date(now + totalDaysRemaining * msPerDay).toISOString().split('T')[0];

    // Confidence based on stage advancement and data quality
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (currentIdx >= 6) confidence = 'high'; // in_dd or term_sheet
    else if (currentIdx >= 4 && inv.enthusiasm >= 4) confidence = 'medium'; // met/engaged + enthusiastic
    else if (currentIdx <= 2 || cumulativeConversion < 0.1) confidence = 'low'; // early stage

    const reasoning = `Stage ${currentIdx + 1}/9, ${daysInStage}d in "${inv.status}", ~${totalDaysRemaining}d remaining (${Math.round(cumulativeConversion * 100)}% path probability)`;

    forecasts.push({
      investorId: inv.id,
      investorName: inv.name,
      currentStage: inv.status,
      tier: inv.tier,
      daysInStage,
      predictedDaysToClose: totalDaysRemaining,
      predictedCloseDate,
      confidence,
      reasoning,
    });
  }

  // Sort by predicted close date
  forecasts.sort((a, b) => a.predictedDaysToClose - b.predictedDaysToClose);

  // Aggregate: expected close date = when we'd reach target amount
  // Use high/medium confidence investors first
  const closeable = forecasts.filter(f => f.confidence !== 'low');
  const expectedCloseDate = closeable.length > 0
    ? closeable[Math.min(2, closeable.length - 1)].predictedCloseDate // 3rd investor to close
    : forecasts.length > 0
    ? forecasts[Math.floor(forecasts.length / 2)].predictedCloseDate
    : new Date(now + 90 * msPerDay).toISOString().split('T')[0]; // 90-day default

  // Critical path: first 3 investors by close date
  const criticalPathInvestors = forecasts.slice(0, 3).map(f => f.investorName);

  // Risk factors
  const riskFactors: string[] = [];
  const lowConfidence = forecasts.filter(f => f.confidence === 'low');
  if (lowConfidence.length > forecasts.length * 0.6) {
    riskFactors.push('Most pipeline is early-stage — close dates are uncertain');
  }
  if (forecasts.length < 5) {
    riskFactors.push('Pipeline too narrow for reliable forecasting');
  }
  const slowInvestors = forecasts.filter(f => f.daysInStage > 30);
  if (slowInvestors.length > 0) {
    riskFactors.push(`${slowInvestors.length} investor(s) stalled >30 days in current stage`);
  }

  // Overall confidence
  let overallConfidence: 'high' | 'medium' | 'low' = 'medium';
  if (closeable.length >= 3 && riskFactors.length === 0) overallConfidence = 'high';
  else if (closeable.length < 2 || riskFactors.length >= 2) overallConfidence = 'low';

  return {
    forecasts,
    expectedCloseDate,
    expectedAmount: 0, // would need raise config
    confidence: overallConfidence,
    criticalPathInvestors,
    riskFactors,
  };
  });
}

// ---------------------------------------------------------------------------
// Forecast Calibration — Learning from Outcomes (cycle 23)
// ---------------------------------------------------------------------------

/**
 * Log forecast predictions for later calibration.
 * Called periodically (e.g., weekly) to snapshot current forecasts.
 */
export async function logForecastPredictions(): Promise<number> {
  await ensureInitialized();
  const db = getClient();

  const forecast = await computeRaiseForecast();
  let logged = 0;

  for (const f of forecast.forecasts) {
    // Only log one prediction per investor per week
    const existing = await db.execute({
      sql: `SELECT id FROM forecast_log WHERE investor_id = ? AND logged_at >= datetime('now', '-7 days') AND actual_outcome IS NULL`,
      args: [f.investorId],
    });
    if (existing.rows.length > 0) continue;

    const id = `fl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.execute({
      sql: `INSERT INTO forecast_log (id, investor_id, investor_name, predicted_days_to_close, predicted_close_date, confidence, stage_at_prediction)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [id, f.investorId, f.investorName, f.predictedDaysToClose, f.predictedCloseDate, f.confidence, f.currentStage],
    });
    logged++;
  }

  return logged;
}

/**
 * Resolve forecast predictions when an investor reaches a terminal state.
 * Called when investor status changes to closed/passed/dropped.
 */
export async function resolveForecastPredictions(investorId: string, outcome: 'closed' | 'passed' | 'dropped'): Promise<number> {
  await ensureInitialized();
  const db = getClient();

  const unresolved = await db.execute({
    sql: `SELECT * FROM forecast_log WHERE investor_id = ? AND actual_outcome IS NULL ORDER BY logged_at ASC`,
    args: [investorId],
  });

  let resolved = 0;
  const now = Date.now();
  const msPerDay = 1000 * 60 * 60 * 24;

  for (const row of unresolved.rows) {
    const loggedAt = new Date(row.logged_at as string).getTime();
    const actualDays = Math.round((now - loggedAt) / msPerDay);
    const predictedDays = row.predicted_days_to_close as number;

    // Accuracy delta: positive = took longer than predicted, negative = faster
    const accuracyDelta = outcome === 'closed'
      ? actualDays - predictedDays // meaningful comparison only for closures
      : null; // for passes/drops, we can't meaningfully compare

    await db.execute({
      sql: `UPDATE forecast_log SET actual_outcome = ?, actual_days_to_outcome = ?, accuracy_delta = ?, resolved_at = datetime('now') WHERE id = ?`,
      args: [outcome, actualDays, accuracyDelta, row.id as string],
    });
    resolved++;
  }

  return resolved;
}

/**
 * Compute forecast calibration metrics — how accurate have our forecasts been?
 */
export interface ForecastCalibration {
  totalPredictions: number;
  resolvedPredictions: number;
  closedPredictions: number;
  avgAccuracyDelta: number; // avg days off for closed predictions
  biasDirection: 'optimistic' | 'pessimistic' | 'calibrated' | 'insufficient_data';
  byConfidence: { confidence: string; count: number; avgDelta: number }[];
  byStage: { stage: string; count: number; avgDelta: number }[];
}

export async function getForecastCalibration(): Promise<ForecastCalibration> {
  await ensureInitialized();
  const db = getClient();

  const all = await db.execute(`SELECT * FROM forecast_log`);
  const resolved = all.rows.filter(r => r.actual_outcome !== null);
  const closed = resolved.filter(r => r.actual_outcome === 'closed' && r.accuracy_delta !== null);

  if (closed.length < 3) {
    return {
      totalPredictions: all.rows.length,
      resolvedPredictions: resolved.length,
      closedPredictions: closed.length,
      avgAccuracyDelta: 0,
      biasDirection: 'insufficient_data',
      byConfidence: [],
      byStage: [],
    };
  }

  const deltas = closed.map(r => r.accuracy_delta as number);
  const avgDelta = deltas.reduce((s, d) => s + d, 0) / deltas.length;

  // Bias: avg delta > 7 days = optimistic (predicted faster than reality)
  // avg delta < -7 days = pessimistic (predicted slower)
  const biasDirection = avgDelta > 7 ? 'optimistic' : avgDelta < -7 ? 'pessimistic' : 'calibrated';

  // By confidence level
  const confGroups: Record<string, number[]> = {};
  for (const r of closed) {
    const conf = r.confidence as string;
    if (!confGroups[conf]) confGroups[conf] = [];
    confGroups[conf].push(r.accuracy_delta as number);
  }
  const byConfidence = Object.entries(confGroups).map(([confidence, ds]) => ({
    confidence,
    count: ds.length,
    avgDelta: Math.round(ds.reduce((s, d) => s + d, 0) / ds.length),
  }));

  // By stage at prediction
  const stageGroups: Record<string, number[]> = {};
  for (const r of closed) {
    const stage = r.stage_at_prediction as string;
    if (!stageGroups[stage]) stageGroups[stage] = [];
    stageGroups[stage].push(r.accuracy_delta as number);
  }
  const byStage = Object.entries(stageGroups).map(([stage, ds]) => ({
    stage,
    count: ds.length,
    avgDelta: Math.round(ds.reduce((s, d) => s + d, 0) / ds.length),
  }));

  return {
    totalPredictions: all.rows.length,
    resolvedPredictions: resolved.length,
    closedPredictions: closed.length,
    avgAccuracyDelta: Math.round(avgDelta),
    biasDirection,
    byConfidence,
    byStage,
  };
}

// ---------------------------------------------------------------------------
// Win/Loss Pattern Analysis — Learning from Outcomes (cycle 25)
// ---------------------------------------------------------------------------

export interface WinLossPatterns {
  closedCount: number;
  passedCount: number;
  droppedCount: number;
  distinguishingFactors: {
    factor: string;
    closedAvg: number;
    passedAvg: number;
    delta: number; // positive = winners have more
    significance: 'high' | 'medium' | 'low';
  }[];
  winnerProfile: {
    avgScore: number;
    avgEnthusiasm: number;
    avgMeetings: number;
    avgDaysToClose: number;
    commonTiers: string;
    commonTypes: string;
  } | null;
  loserProfile: {
    avgScore: number;
    avgEnthusiasm: number;
    avgMeetings: number;
    avgDaysToPass: number;
    commonTiers: string;
    commonTypes: string;
  } | null;
  insights: string[];
}

export function computeWinLossPatterns(): Promise<WinLossPatterns> {
  return cachedCompute('computeWinLossPatterns', 120_000, async () => {
  await ensureInitialized();
  const db = getClient();

  // Get terminal investors
  const [closedResult, passedResult, droppedResult] = await Promise.all([
    db.execute(`SELECT * FROM investors WHERE status = 'closed'`),
    db.execute(`SELECT * FROM investors WHERE status = 'passed'`),
    db.execute(`SELECT * FROM investors WHERE status = 'dropped'`),
  ]);

  const closed = closedResult.rows as unknown as Array<{
    id: string; name: string; tier: number; type: string; enthusiasm: number;
    created_at: string; updated_at: string;
  }>;
  const passed = passedResult.rows as unknown as Array<{
    id: string; name: string; tier: number; type: string; enthusiasm: number;
    created_at: string; updated_at: string;
  }>;
  const dropped = droppedResult.rows as unknown as Array<{
    id: string; name: string; tier: number; type: string; enthusiasm: number;
    created_at: string; updated_at: string;
  }>;

  const insights: string[] = [];

  if (closed.length === 0 && passed.length === 0) {
    return {
      closedCount: 0, passedCount: 0, droppedCount: dropped.length,
      distinguishingFactors: [], winnerProfile: null, loserProfile: null,
      insights: ['No closed or passed investors yet — patterns will emerge as outcomes resolve'],
    };
  }

  const msPerDay = 1000 * 60 * 60 * 24;

  // Helper: get meeting count + score snapshots for a set of investors
  async function enrichInvestors(invs: typeof closed) {
    const enriched = [];
    for (const inv of invs) {
      const [meetingsResult, scoresResult] = await Promise.all([
        db.execute({ sql: `SELECT COUNT(*) as cnt FROM meetings WHERE investor_id = ?`, args: [inv.id] }),
        db.execute({ sql: `SELECT overall_score, engagement_score, momentum_score FROM score_snapshots WHERE investor_id = ? ORDER BY snapshot_date DESC LIMIT 1`, args: [inv.id] }),
      ]);
      const meetingCount = (meetingsResult.rows[0] as unknown as { cnt: number }).cnt;
      const latestScore = scoresResult.rows[0] as unknown as { overall_score: number; engagement_score: number; momentum_score: number } | undefined;
      const daysInPipeline = Math.max(1, Math.round((new Date(inv.updated_at || inv.created_at).getTime() - new Date(inv.created_at).getTime()) / msPerDay));

      enriched.push({
        ...inv,
        meetingCount,
        overallScore: latestScore?.overall_score ?? 0,
        engagementScore: latestScore?.engagement_score ?? 0,
        momentumScore: latestScore?.momentum_score ?? 0,
        daysInPipeline,
      });
    }
    return enriched;
  }

  const [enrichedClosed, enrichedPassed] = await Promise.all([
    enrichInvestors(closed),
    enrichInvestors(passed),
  ]);

  // Compute averages
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const mode = (arr: string[]) => {
    const counts: Record<string, number> = {};
    for (const v of arr) counts[v] = (counts[v] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]).join(', ') || 'N/A';
  };

  // Distinguishing factors
  const factors: WinLossPatterns['distinguishingFactors'] = [];

  if (enrichedClosed.length > 0 && enrichedPassed.length > 0) {
    const comparisons = [
      { factor: 'Overall Score', closedVals: enrichedClosed.map(i => i.overallScore), passedVals: enrichedPassed.map(i => i.overallScore) },
      { factor: 'Enthusiasm', closedVals: enrichedClosed.map(i => i.enthusiasm), passedVals: enrichedPassed.map(i => i.enthusiasm) },
      { factor: 'Meeting Count', closedVals: enrichedClosed.map(i => i.meetingCount), passedVals: enrichedPassed.map(i => i.meetingCount) },
      { factor: 'Engagement Score', closedVals: enrichedClosed.map(i => i.engagementScore), passedVals: enrichedPassed.map(i => i.engagementScore) },
      { factor: 'Momentum Score', closedVals: enrichedClosed.map(i => i.momentumScore), passedVals: enrichedPassed.map(i => i.momentumScore) },
      { factor: 'Tier (lower=better)', closedVals: enrichedClosed.map(i => i.tier), passedVals: enrichedPassed.map(i => i.tier) },
      { factor: 'Days in Pipeline', closedVals: enrichedClosed.map(i => i.daysInPipeline), passedVals: enrichedPassed.map(i => i.daysInPipeline) },
    ];

    for (const comp of comparisons) {
      const closedAvg = Math.round(avg(comp.closedVals) * 10) / 10;
      const passedAvg = Math.round(avg(comp.passedVals) * 10) / 10;
      const delta = Math.round((closedAvg - passedAvg) * 10) / 10;
      const relDelta = passedAvg !== 0 ? Math.abs(delta / passedAvg) : Math.abs(delta);
      const significance: 'high' | 'medium' | 'low' = relDelta > 0.3 ? 'high' : relDelta > 0.15 ? 'medium' : 'low';

      factors.push({ factor: comp.factor, closedAvg, passedAvg, delta, significance });
    }

    // Sort by significance
    const sigOrder = { high: 0, medium: 1, low: 2 };
    factors.sort((a, b) => sigOrder[a.significance] - sigOrder[b.significance]);

    // Generate insights
    const highSig = factors.filter(f => f.significance === 'high');
    if (highSig.length > 0) {
      insights.push(`Strongest predictors of close: ${highSig.map(f => f.factor).join(', ')}`);
    }

    const closedMeetingAvg = avg(enrichedClosed.map(i => i.meetingCount));
    const passedMeetingAvg = avg(enrichedPassed.map(i => i.meetingCount));
    if (closedMeetingAvg > passedMeetingAvg * 1.5) {
      insights.push(`Winners averaged ${Math.round(closedMeetingAvg)} meetings vs ${Math.round(passedMeetingAvg)} for passers — more meetings correlate with close`);
    }

    const closedEnthAvg = avg(enrichedClosed.map(i => i.enthusiasm));
    const passedEnthAvg = avg(enrichedPassed.map(i => i.enthusiasm));
    if (closedEnthAvg - passedEnthAvg >= 1.0) {
      insights.push(`Enthusiasm gap of ${(closedEnthAvg - passedEnthAvg).toFixed(1)} between winners and losers — enthusiasm is a reliable signal`);
    } else if (Math.abs(closedEnthAvg - passedEnthAvg) < 0.5) {
      insights.push(`Enthusiasm similar between winners (${closedEnthAvg.toFixed(1)}) and losers (${passedEnthAvg.toFixed(1)}) — enthusiasm alone is NOT predictive here`);
    }
  }

  return {
    closedCount: closed.length,
    passedCount: passed.length,
    droppedCount: dropped.length,
    distinguishingFactors: factors,
    winnerProfile: enrichedClosed.length > 0 ? {
      avgScore: Math.round(avg(enrichedClosed.map(i => i.overallScore))),
      avgEnthusiasm: Math.round(avg(enrichedClosed.map(i => i.enthusiasm)) * 10) / 10,
      avgMeetings: Math.round(avg(enrichedClosed.map(i => i.meetingCount)) * 10) / 10,
      avgDaysToClose: Math.round(avg(enrichedClosed.map(i => i.daysInPipeline))),
      commonTiers: mode(enrichedClosed.map(i => `T${i.tier}`)),
      commonTypes: mode(enrichedClosed.map(i => i.type || 'unknown')),
    } : null,
    loserProfile: enrichedPassed.length > 0 ? {
      avgScore: Math.round(avg(enrichedPassed.map(i => i.overallScore))),
      avgEnthusiasm: Math.round(avg(enrichedPassed.map(i => i.enthusiasm)) * 10) / 10,
      avgMeetings: Math.round(avg(enrichedPassed.map(i => i.meetingCount)) * 10) / 10,
      avgDaysToPass: Math.round(avg(enrichedPassed.map(i => i.daysInPipeline))),
      commonTiers: mode(enrichedPassed.map(i => `T${i.tier}`)),
      commonTypes: mode(enrichedPassed.map(i => i.type || 'unknown')),
    } : null,
    insights,
  };
  });
}

// ---------------------------------------------------------------------------
// Temporal Intelligence — Health Trend Analysis (cycle 14)
// ---------------------------------------------------------------------------

export interface TemporalTrend {
  metric: string;
  current: number;
  avg7d: number;
  avg30d: number;
  delta7d: number;     // percentage change vs 7d avg
  delta30d: number;    // percentage change vs 30d avg
  direction: 'improving' | 'declining' | 'stable';
  streak: number;      // consecutive snapshots in same direction
  alert: string | null; // non-null if trend warrants attention
}

export interface TemporalTrends {
  trends: TemporalTrend[];
  overallDirection: 'improving' | 'declining' | 'mixed' | 'stable';
  daysOfData: number;
  alertCount: number;
}

export function computeTemporalTrends(): Promise<TemporalTrends> {
  return cachedCompute('computeTemporalTrends', 120_000, async () => {
  await ensureInitialized();
  const db = getClient();

  // Get snapshots ordered most recent first
  const result = await db.execute({
    sql: `SELECT * FROM health_snapshots ORDER BY snapshot_date DESC, created_at DESC LIMIT 60`,
    args: [],
  });

  const snapshots = result.rows as unknown as HealthSnapshot[];

  if (snapshots.length < 2) {
    return { trends: [], overallDirection: 'stable', daysOfData: snapshots.length, alertCount: 0 };
  }

  // Deduplicate by date (keep most recent per date)
  const byDate = new Map<string, HealthSnapshot>();
  for (const s of snapshots) {
    if (!byDate.has(s.snapshot_date)) {
      byDate.set(s.snapshot_date, s);
    }
  }

  const sorted = [...byDate.values()].sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
  const current = sorted[0];
  const daysOfData = sorted.length;

  // Windows: last 7 and last 30 snapshots (by date, most recent first)
  const last7 = sorted.slice(0, Math.min(7, sorted.length));
  const last30 = sorted.slice(0, Math.min(30, sorted.length));

  function computeTrend(
    metricName: string,
    field: keyof HealthSnapshot,
  ): TemporalTrend {
    const currentVal = Number(current[field] || 0);
    const values7d = last7.map(s => Number(s[field] || 0));
    const values30d = last30.map(s => Number(s[field] || 0));

    const avg7 = values7d.length > 0 ? values7d.reduce((s, v) => s + v, 0) / values7d.length : currentVal;
    const avg30 = values30d.length > 0 ? values30d.reduce((s, v) => s + v, 0) / values30d.length : currentVal;

    const delta7 = avg7 > 0 ? Math.round(((currentVal - avg7) / avg7) * 100) : 0;
    const delta30 = avg30 > 0 ? Math.round(((currentVal - avg30) / avg30) * 100) : 0;

    // Direction from 7d delta
    let direction: 'improving' | 'declining' | 'stable' = 'stable';
    if (delta7 > 5) direction = 'improving';
    else if (delta7 < -5) direction = 'declining';

    // Streak: count consecutive snapshots moving in same direction
    // values7d[0] is today (most recent), values7d[1] is yesterday, etc.
    let streak = 0;
    if (values7d.length >= 2) {
      for (let i = 0; i < values7d.length - 1; i++) {
        if (direction === 'improving' && values7d[i] >= values7d[i + 1]) streak++;
        else if (direction === 'declining' && values7d[i] <= values7d[i + 1]) streak++;
        else break;
      }
    }

    // Generate alert for concerning trends
    let alert: string | null = null;
    if (direction === 'declining' && streak >= 3) {
      alert = `${metricName} declining for ${streak} consecutive days (current: ${currentVal}, 7d avg: ${Math.round(avg7 * 10) / 10})`;
    } else if (direction === 'declining' && delta30 < -15) {
      alert = `${metricName} is ${Math.abs(delta30)}% below 30-day average — significant deterioration`;
    }

    return {
      metric: metricName,
      current: currentVal,
      avg7d: Math.round(avg7 * 10) / 10,
      avg30d: Math.round(avg30 * 10) / 10,
      delta7d: delta7,
      delta30d: delta30,
      direction,
      streak,
      alert,
    };
  }

  const trends: TemporalTrend[] = [
    computeTrend('Pipeline Health', 'pipeline_score'),
    computeTrend('Narrative Strength', 'narrative_score'),
    computeTrend('Fundraise Readiness', 'readiness_score'),
    computeTrend('Raise Velocity', 'velocity'),
    computeTrend('Active Investors', 'active_investors'),
  ];

  // Overall direction
  const improving = trends.filter(t => t.direction === 'improving').length;
  const declining = trends.filter(t => t.direction === 'declining').length;
  let overallDirection: 'improving' | 'declining' | 'mixed' | 'stable';
  if (improving >= 3 && declining === 0) overallDirection = 'improving';
  else if (declining >= 3 && improving === 0) overallDirection = 'declining';
  else if (improving > 0 && declining > 0) overallDirection = 'mixed';
  else overallDirection = 'stable';

  const alertCount = trends.filter(t => t.alert !== null).length;

  return { trends, overallDirection, daysOfData, alertCount };
  });
}

// ---------------------------------------------------------------------------
// Enrichment CRUD
// ---------------------------------------------------------------------------

export async function createEnrichmentJob(job: {
  id: string;
  investor_id: string;
  investor_name: string;
  sources: string[];
  status: string;
}) {
  await ensureInitialized();
  await getClient().execute({
    sql: `INSERT INTO enrichment_jobs (id, investor_id, investor_name, sources, status, started_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    args: [job.id, job.investor_id, job.investor_name, JSON.stringify(job.sources), job.status],
  });
}

export async function updateEnrichmentJob(id: string, updates: {
  status?: string;
  results_count?: number;
  errors?: string[];
  completed_at?: string;
}) {
  const mapped: Record<string, unknown> = { ...updates };
  if (updates.errors) mapped.errors = JSON.stringify(updates.errors);
  await genericUpdate('enrichment_jobs', id, mapped, { autoUpdatedAt: false });
}

export async function getEnrichmentJobs(investorId?: string): Promise<EnrichmentJobRow[]> {
  await ensureInitialized();
  if (investorId) {
    const result = await getClient().execute({
      sql: 'SELECT * FROM enrichment_jobs WHERE investor_id = ? ORDER BY created_at DESC LIMIT 20',
      args: [investorId],
    });
    return result.rows as unknown as EnrichmentJobRow[];
  }
  const result = await getClient().execute('SELECT * FROM enrichment_jobs ORDER BY created_at DESC LIMIT 50');
  return result.rows as unknown as EnrichmentJobRow[];
}

export interface EnrichmentJobRow {
  id: string;
  investor_id: string;
  investor_name: string;
  sources: string;
  status: string;
  results_count: number;
  errors: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export async function saveEnrichmentRecords(records: {
  investor_id: string;
  source_id: string;
  field_name: string;
  field_value: string;
  category: string;
  confidence: number;
  source_url: string;
  fetched_at: string;
}[]) {
  await ensureInitialized();
  const db = getClient();
  const staleDays = 30;
  const staleDate = new Date(Date.now() + staleDays * 86400000).toISOString();

  for (const record of records) {
    const id = crypto.randomUUID();
    await db.execute({
      sql: `INSERT OR REPLACE INTO enrichment_records (id, investor_id, source_id, field_name, field_value, category, confidence, source_url, fetched_at, stale_after)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, record.investor_id, record.source_id, record.field_name, record.field_value, record.category, record.confidence, record.source_url || '', record.fetched_at, staleDate],
    });
  }
}

export async function getEnrichmentRecords(investorId: string): Promise<EnrichmentRecordRow[]> {
  return genericGetByField<EnrichmentRecordRow>('enrichment_records', 'investor_id', investorId, { orderBy: 'confidence DESC, fetched_at DESC' });
}

export interface EnrichmentRecordRow {
  id: string;
  investor_id: string;
  source_id: string;
  field_name: string;
  field_value: string;
  category: string;
  confidence: number;
  source_url: string;
  fetched_at: string;
  stale_after: string;
  created_at: string;
}

export async function getEnrichmentStats(): Promise<{
  total_records: number;
  total_investors_enriched: number;
  total_jobs: number;
  records_by_source: { source_id: string; count: number }[];
  records_by_category: { category: string; count: number }[];
  avg_confidence: number;
  stale_count: number;
}> {
  await ensureInitialized();
  const db = getClient();

  const [totalRes, investorsRes, jobsRes, bySourceRes, byCatRes, avgConfRes, staleRes] = await Promise.all([
    db.execute('SELECT COUNT(*) as cnt FROM enrichment_records'),
    db.execute('SELECT COUNT(DISTINCT investor_id) as cnt FROM enrichment_records'),
    db.execute('SELECT COUNT(*) as cnt FROM enrichment_jobs'),
    db.execute('SELECT source_id, COUNT(*) as cnt FROM enrichment_records GROUP BY source_id ORDER BY cnt DESC'),
    db.execute('SELECT category, COUNT(*) as cnt FROM enrichment_records GROUP BY category ORDER BY cnt DESC'),
    db.execute('SELECT AVG(confidence) as avg FROM enrichment_records'),
    db.execute({ sql: 'SELECT COUNT(*) as cnt FROM enrichment_records WHERE stale_after < ?', args: [new Date().toISOString()] }),
  ]);

  return {
    total_records: (totalRes.rows[0] as unknown as { cnt: number }).cnt || 0,
    total_investors_enriched: (investorsRes.rows[0] as unknown as { cnt: number }).cnt || 0,
    total_jobs: (jobsRes.rows[0] as unknown as { cnt: number }).cnt || 0,
    records_by_source: bySourceRes.rows as unknown as { source_id: string; count: number }[],
    records_by_category: byCatRes.rows as unknown as { category: string; count: number }[],
    avg_confidence: (avgConfRes.rows[0] as unknown as { avg: number }).avg || 0,
    stale_count: (staleRes.rows[0] as unknown as { cnt: number }).cnt || 0,
  };
}

export async function deleteEnrichmentRecords(investorId: string, sourceId?: string) {
  await ensureInitialized();
  if (sourceId) {
    await getClient().execute({
      sql: 'DELETE FROM enrichment_records WHERE investor_id = ? AND source_id = ?',
      args: [investorId, sourceId],
    });
  } else {
    await getClient().execute({
      sql: 'DELETE FROM enrichment_records WHERE investor_id = ?',
      args: [investorId],
    });
  }
}

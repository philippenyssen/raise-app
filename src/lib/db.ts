import { createClient, type Client, type InValue } from '@libsql/client';
import { Investor, Meeting, RaiseConfig, MarketDeal, InvestorPartner, InvestorPortfolioCo, Competitor, IntelligenceBrief, Task, ActivityEvent, type RaisePhase, type TaskPriority, type FollowupAction, type FollowupActionType, type FollowupStatus } from './types';

// Acceleration Action types
export interface AccelerationAction {
  id: string;
  investor_id: string;
  investor_name: string | null;
  trigger_type: 'momentum_cliff' | 'stall_risk' | 'window_closing' | 'catalyst_match' | 'competitive_pressure' | 'term_sheet_ready';
  action_type: 'milestone_share' | 'expert_call' | 'site_visit' | 'competitive_signal' | 'warm_reintro' | 'data_update' | 'escalation';
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
      completed_at TEXT
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
  ], 'write');

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
  return raw ? JSON.parse(raw) : null;
}

export async function setRaiseConfig(config: RaiseConfig) {
  await setConfig('raise_config', JSON.stringify(config));
}

// Investors
export async function getAllInvestors(): Promise<Investor[]> {
  await ensureInitialized();
  const result = await getClient().execute('SELECT * FROM investors ORDER BY tier ASC, name ASC');
  return result.rows as unknown as Investor[];
}

export async function getInvestor(id: string): Promise<Investor | null> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: 'SELECT * FROM investors WHERE id = ?',
    args: [id],
  });
  return result.rows.length > 0 ? (result.rows[0] as unknown as Investor) : null;
}

export async function createInvestor(investor: Partial<Investor> & { name: string }): Promise<Investor> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getClient().execute({
    sql: `INSERT INTO investors (id, name, type, tier, status, partner, fund_size, check_size_range, sector_thesis, warm_path, ic_process, speed, portfolio_conflicts, notes, enthusiasm, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      investor.name,
      investor.type ?? 'vc',
      investor.tier ?? 2,
      investor.status ?? 'identified',
      investor.partner ?? '',
      investor.fund_size ?? '',
      investor.check_size_range ?? '',
      investor.sector_thesis ?? '',
      investor.warm_path ?? '',
      investor.ic_process ?? '',
      investor.speed ?? 'medium',
      investor.portfolio_conflicts ?? '',
      investor.notes ?? '',
      investor.enthusiasm ?? 0,
      now,
      now,
    ],
  });
  return (await getInvestor(id))!;
}

export async function updateInvestor(id: string, updates: Partial<Investor>) {
  await ensureInitialized();
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at');
  if (fields.length === 0) return;
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as Record<string, unknown>)[f] as InValue);
  await getClient().execute({
    sql: `UPDATE investors SET ${sets}, updated_at = datetime('now') WHERE id = ?`,
    args: [...values, id],
  });
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

export async function getMeeting(id: string): Promise<Meeting | null> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: 'SELECT * FROM meetings WHERE id = ?',
    args: [id],
  });
  return result.rows.length > 0 ? (result.rows[0] as unknown as Meeting) : null;
}

export async function createMeeting(meeting: Partial<Omit<Meeting, 'id' | 'created_at'>> & { investor_id: string; investor_name: string; date: string }): Promise<Meeting> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  await getClient().execute({
    sql: `INSERT INTO meetings (id, investor_id, investor_name, date, type, attendees, duration_minutes, raw_notes, questions_asked, objections, engagement_signals, competitive_intel, next_steps, enthusiasm_score, status_after, ai_analysis, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      id,
      meeting.investor_id,
      meeting.investor_name,
      meeting.date,
      meeting.type ?? 'intro',
      meeting.attendees ?? '',
      meeting.duration_minutes ?? 60,
      meeting.raw_notes ?? '',
      meeting.questions_asked ?? '[]',
      meeting.objections ?? '[]',
      meeting.engagement_signals ?? '{}',
      meeting.competitive_intel ?? '',
      meeting.next_steps ?? '',
      meeting.enthusiasm_score ?? 3,
      meeting.status_after ?? 'met',
      meeting.ai_analysis ?? '',
    ],
  });
  return (await getMeeting(id))!;
}

export async function updateMeeting(id: string, updates: Partial<Meeting>) {
  await ensureInitialized();
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at');
  if (fields.length === 0) return;
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as Record<string, unknown>)[f] as InValue);
  await getClient().execute({
    sql: `UPDATE meetings SET ${sets} WHERE id = ?`,
    args: [...values, id],
  });
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

export async function saveConvergence(data: Record<string, unknown>) {
  await ensureInitialized();
  await getClient().execute({
    sql: `INSERT INTO convergence (story, materials, model, investors, objections, pricing, terms, funnel, timeline, team, score, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.story ? 1 : 0, data.materials ? 1 : 0, data.model ? 1 : 0,
      data.investors ? 1 : 0, data.objections ? 1 : 0, data.pricing ? 1 : 0,
      data.terms ? 1 : 0, data.funnel ? 1 : 0, data.timeline ? 1 : 0,
      data.team ? 1 : 0, (data.score as number) ?? 0, (data.notes as string) ?? '',
    ],
  });
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

export async function getEnthusiasmTrend(): Promise<{ date: string; score: number; investor: string }[]> {
  await ensureInitialized();
  const result = await getClient().execute(`
    SELECT date, enthusiasm_score as score, investor_name as investor
    FROM meetings ORDER BY date ASC
  `);
  return result.rows as unknown as { date: string; score: number; investor: string }[];
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

export async function getDocument(id: string): Promise<Document | null> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: 'SELECT * FROM documents WHERE id = ?',
    args: [id],
  });
  return result.rows.length > 0 ? (result.rows[0] as unknown as Document) : null;
}

export async function createDocument(doc: { title: string; type: string; content?: string }): Promise<Document> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getClient().execute({
    sql: `INSERT INTO documents (id, title, type, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
    args: [id, doc.title, doc.type, doc.content || '', now, now],
  });
  // Create initial version
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

export async function getDocumentVersion(versionId: string): Promise<DocumentVersion | null> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: 'SELECT * FROM document_versions WHERE id = ?',
    args: [versionId],
  });
  return result.rows.length > 0 ? (result.rows[0] as unknown as DocumentVersion) : null;
}

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

export async function getDataRoomFile(id: string): Promise<DataRoomFile | null> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: 'SELECT * FROM data_room_files WHERE id = ?',
    args: [id],
  });
  return result.rows.length > 0 ? (result.rows[0] as unknown as DataRoomFile) : null;
}

export async function createDataRoomFile(file: { filename: string; category: string; mime_type: string; size_bytes: number; extracted_text: string; summary?: string }): Promise<DataRoomFile> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  await getClient().execute({
    sql: `INSERT INTO data_room_files (id, filename, category, mime_type, size_bytes, extracted_text, summary, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [id, file.filename, file.category, file.mime_type, file.size_bytes, file.extracted_text, file.summary || ''],
  });
  return (await getDataRoomFile(id))!;
}

export async function updateDataRoomFile(id: string, updates: { category?: string; summary?: string }) {
  await ensureInitialized();
  const sets: string[] = [];
  const values: InValue[] = [];
  if (updates.category !== undefined) { sets.push('category = ?'); values.push(updates.category); }
  if (updates.summary !== undefined) { sets.push('summary = ?'); values.push(updates.summary); }
  if (sets.length === 0) return;
  values.push(id);
  await getClient().execute({ sql: `UPDATE data_room_files SET ${sets.join(', ')} WHERE id = ?`, args: values });
}

export async function deleteDataRoomFile(id: string) {
  await ensureInitialized();
  await getClient().execute({ sql: 'DELETE FROM data_room_files WHERE id = ?', args: [id] });
}

export async function getDataRoomContext(): Promise<string> {
  const files = await getAllDataRoomFiles();
  if (files.length === 0) return 'No data room files uploaded yet.';
  return files.map(f => {
    const text = f.extracted_text.substring(0, 3000);
    return `--- ${f.filename} (${f.category}) ---\n${f.summary ? `Summary: ${f.summary}\n` : ''}${text}`;
  }).join('\n\n');
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

export async function getModelSheet(id: string): Promise<ModelSheet | null> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: 'SELECT * FROM model_sheets WHERE id = ?',
    args: [id],
  });
  return result.rows.length > 0 ? (result.rows[0] as unknown as ModelSheet) : null;
}

export async function createModelSheet(sheet: { model_id?: string; sheet_name: string; sheet_order: number; data: string }): Promise<ModelSheet> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getClient().execute({
    sql: `INSERT INTO model_sheets (id, model_id, sheet_name, sheet_order, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, sheet.model_id || 'default', sheet.sheet_name, sheet.sheet_order, sheet.data, now, now],
  });
  return (await getModelSheet(id))!;
}

export async function updateModelSheet(id: string, updates: { sheet_name?: string; data?: string; sheet_order?: number }) {
  await ensureInitialized();
  const sets: string[] = ['updated_at = ?'];
  const values: InValue[] = [new Date().toISOString()];
  if (updates.sheet_name !== undefined) { sets.push('sheet_name = ?'); values.push(updates.sheet_name); }
  if (updates.data !== undefined) { sets.push('data = ?'); values.push(updates.data); }
  if (updates.sheet_order !== undefined) { sets.push('sheet_order = ?'); values.push(updates.sheet_order); }
  values.push(id);
  await getClient().execute({ sql: `UPDATE model_sheets SET ${sets.join(', ')} WHERE id = ?`, args: values });
}

export async function deleteModelSheet(id: string) {
  await ensureInitialized();
  await getClient().execute({ sql: 'DELETE FROM model_sheets WHERE id = ?', args: [id] });
}

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

export async function getTermSheet(id: string): Promise<TermSheet | null> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: 'SELECT * FROM term_sheets WHERE id = ?',
    args: [id],
  });
  return result.rows.length > 0 ? (result.rows[0] as unknown as TermSheet) : null;
}

export async function createTermSheet(ts: Omit<TermSheet, 'id' | 'created_at' | 'updated_at'>): Promise<TermSheet> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getClient().execute({
    sql: `INSERT INTO term_sheets (id, investor, valuation, amount, liq_pref, anti_dilution, board_seats, dividends, protective_provisions, option_pool, exclusivity, strategic_value, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, ts.investor, ts.valuation, ts.amount, ts.liq_pref, ts.anti_dilution, ts.board_seats, ts.dividends, ts.protective_provisions, ts.option_pool, ts.exclusivity, ts.strategic_value, ts.notes, now, now],
  });
  return (await getTermSheet(id))!;
}

export async function updateTermSheet(id: string, updates: Partial<Omit<TermSheet, 'id' | 'created_at'>>) {
  await ensureInitialized();
  const fields = Object.keys(updates).filter(k => k !== 'updated_at');
  if (fields.length === 0) return;
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as Record<string, unknown>)[f] as InValue);
  await getClient().execute({
    sql: `UPDATE term_sheets SET ${sets}, updated_at = datetime('now') WHERE id = ?`,
    args: [...values, id],
  });
}

export async function deleteTermSheet(id: string) {
  await ensureInitialized();
  await getClient().execute({ sql: 'DELETE FROM term_sheets WHERE id = ?', args: [id] });
}

// Market Deals

export async function getAllMarketDeals(): Promise<MarketDeal[]> {
  await ensureInitialized();
  const result = await getClient().execute('SELECT * FROM market_deals ORDER BY date DESC');
  return result.rows as unknown as MarketDeal[];
}

export async function getMarketDeal(id: string): Promise<MarketDeal | null> {
  await ensureInitialized();
  const result = await getClient().execute({ sql: 'SELECT * FROM market_deals WHERE id = ?', args: [id] });
  return result.rows.length > 0 ? (result.rows[0] as unknown as MarketDeal) : null;
}

export async function createMarketDeal(deal: Omit<MarketDeal, 'id' | 'created_at' | 'updated_at'>): Promise<MarketDeal> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getClient().execute({
    sql: `INSERT INTO market_deals (id, company, round, amount, valuation, lead_investors, other_investors, date, sector, sub_sector, equity_story, relevance, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, deal.company, deal.round, deal.amount, deal.valuation, deal.lead_investors, deal.other_investors, deal.date, deal.sector, deal.sub_sector, deal.equity_story, deal.relevance, deal.source, now, now],
  });
  return (await getMarketDeal(id))!;
}

export async function updateMarketDeal(id: string, updates: Partial<MarketDeal>) {
  await ensureInitialized();
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at');
  if (fields.length === 0) return;
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as Record<string, unknown>)[f] as InValue);
  await getClient().execute({
    sql: `UPDATE market_deals SET ${sets}, updated_at = datetime('now') WHERE id = ?`,
    args: [...values, id],
  });
}

export async function deleteMarketDeal(id: string) {
  await ensureInitialized();
  await getClient().execute({ sql: 'DELETE FROM market_deals WHERE id = ?', args: [id] });
}

// Investor Partners

export async function getInvestorPartners(investorId: string): Promise<InvestorPartner[]> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: 'SELECT * FROM investor_partners WHERE investor_id = ? ORDER BY name ASC',
    args: [investorId],
  });
  return result.rows as unknown as InvestorPartner[];
}

export async function createInvestorPartner(partner: Omit<InvestorPartner, 'id' | 'created_at' | 'updated_at'>): Promise<InvestorPartner> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getClient().execute({
    sql: `INSERT INTO investor_partners (id, investor_id, name, title, focus_areas, notable_deals, board_seats, linkedin, background, relevance_to_us, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, partner.investor_id, partner.name, partner.title, partner.focus_areas, partner.notable_deals, partner.board_seats, partner.linkedin, partner.background, partner.relevance_to_us, now, now],
  });
  const result = await getClient().execute({ sql: 'SELECT * FROM investor_partners WHERE id = ?', args: [id] });
  return result.rows[0] as unknown as InvestorPartner;
}

export async function updateInvestorPartner(id: string, updates: Partial<InvestorPartner>) {
  await ensureInitialized();
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at' && k !== 'investor_id');
  if (fields.length === 0) return;
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as Record<string, unknown>)[f] as InValue);
  await getClient().execute({
    sql: `UPDATE investor_partners SET ${sets}, updated_at = datetime('now') WHERE id = ?`,
    args: [...values, id],
  });
}

export async function deleteInvestorPartner(id: string) {
  await ensureInitialized();
  await getClient().execute({ sql: 'DELETE FROM investor_partners WHERE id = ?', args: [id] });
}

// Investor Portfolio Companies

export async function getInvestorPortfolio(investorId: string): Promise<InvestorPortfolioCo[]> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: 'SELECT * FROM investor_portfolio WHERE investor_id = ? ORDER BY date DESC',
    args: [investorId],
  });
  return result.rows as unknown as InvestorPortfolioCo[];
}

export async function createPortfolioCo(co: Omit<InvestorPortfolioCo, 'id' | 'created_at'>): Promise<InvestorPortfolioCo> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  await getClient().execute({
    sql: `INSERT INTO investor_portfolio (id, investor_id, company, sector, stage_invested, amount, date, status, relevance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [id, co.investor_id, co.company, co.sector, co.stage_invested, co.amount, co.date, co.status, co.relevance],
  });
  const result = await getClient().execute({ sql: 'SELECT * FROM investor_portfolio WHERE id = ?', args: [id] });
  return result.rows[0] as unknown as InvestorPortfolioCo;
}

export async function deletePortfolioCo(id: string) {
  await ensureInitialized();
  await getClient().execute({ sql: 'DELETE FROM investor_portfolio WHERE id = ?', args: [id] });
}

// Competitors

export async function getAllCompetitors(): Promise<Competitor[]> {
  await ensureInitialized();
  const result = await getClient().execute('SELECT * FROM competitors ORDER BY threat_level DESC, name ASC');
  return result.rows as unknown as Competitor[];
}

export async function getCompetitor(id: string): Promise<Competitor | null> {
  await ensureInitialized();
  const result = await getClient().execute({ sql: 'SELECT * FROM competitors WHERE id = ?', args: [id] });
  return result.rows.length > 0 ? (result.rows[0] as unknown as Competitor) : null;
}

export async function createCompetitor(comp: Omit<Competitor, 'id' | 'created_at' | 'updated_at'>): Promise<Competitor> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getClient().execute({
    sql: `INSERT INTO competitors (id, name, sector, hq, last_round, last_valuation, total_raised, key_investors, revenue, employees, positioning, strengths, weaknesses, threat_level, our_advantage, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, comp.name, comp.sector, comp.hq, comp.last_round, comp.last_valuation, comp.total_raised, comp.key_investors, comp.revenue, comp.employees, comp.positioning, comp.strengths, comp.weaknesses, comp.threat_level, comp.our_advantage, now, now],
  });
  return (await getCompetitor(id))!;
}

export async function updateCompetitor(id: string, updates: Partial<Competitor>) {
  await ensureInitialized();
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at');
  if (fields.length === 0) return;
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => (updates as Record<string, unknown>)[f] as InValue);
  await getClient().execute({
    sql: `UPDATE competitors SET ${sets}, updated_at = datetime('now') WHERE id = ?`,
    args: [...values, id],
  });
}

export async function deleteCompetitor(id: string) {
  await ensureInitialized();
  await getClient().execute({ sql: 'DELETE FROM competitors WHERE id = ?', args: [id] });
}

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

export async function getIntelligenceBrief(id: string): Promise<IntelligenceBrief | null> {
  await ensureInitialized();
  const result = await getClient().execute({ sql: 'SELECT * FROM intelligence_briefs WHERE id = ?', args: [id] });
  return result.rows.length > 0 ? (result.rows[0] as unknown as IntelligenceBrief) : null;
}

export async function createIntelligenceBrief(brief: Omit<IntelligenceBrief, 'id' | 'created_at' | 'updated_at'>): Promise<IntelligenceBrief> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getClient().execute({
    sql: `INSERT INTO intelligence_briefs (id, subject, brief_type, content, sources, investor_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, brief.subject, brief.brief_type, brief.content, brief.sources, brief.investor_id || null, now, now],
  });
  return (await getIntelligenceBrief(id))!;
}

export async function updateIntelligenceBrief(id: string, updates: { content?: string; sources?: string }) {
  await ensureInitialized();
  const sets: string[] = ['updated_at = ?'];
  const values: InValue[] = [new Date().toISOString()];
  if (updates.content !== undefined) { sets.push('content = ?'); values.push(updates.content); }
  if (updates.sources !== undefined) { sets.push('sources = ?'); values.push(updates.sources); }
  values.push(id);
  await getClient().execute({ sql: `UPDATE intelligence_briefs SET ${sets.join(', ')} WHERE id = ?`, args: values });
}

export async function deleteIntelligenceBrief(id: string) {
  await ensureInitialized();
  await getClient().execute({ sql: 'DELETE FROM intelligence_briefs WHERE id = ?', args: [id] });
}

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
  await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getClient().execute({
    sql: `INSERT INTO tasks (id, title, description, assignee, due_date, status, priority, phase, investor_id, investor_name, auto_generated, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, task.title, task.description, task.assignee, task.due_date, task.status, task.priority, task.phase, task.investor_id, task.investor_name, task.auto_generated ? 1 : 0, now, now],
  });
  const result = await getClient().execute({ sql: 'SELECT * FROM tasks WHERE id = ?', args: [id] });
  return result.rows[0] as unknown as Task;
}

export async function updateTask(id: string, updates: Partial<Task>) {
  await ensureInitialized();
  const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at');
  if (fields.length === 0) return;
  const sets = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => {
    const val = (updates as Record<string, unknown>)[f];
    if (typeof val === 'boolean') return val ? 1 : 0;
    return val as InValue;
  });
  await getClient().execute({
    sql: `UPDATE tasks SET ${sets}, updated_at = datetime('now') WHERE id = ?`,
    args: [...values, id],
  });
}

export async function deleteTask(id: string) {
  await ensureInitialized();
  await getClient().execute({ sql: 'DELETE FROM tasks WHERE id = ?', args: [id] });
}

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

// Auto-generate tasks after meeting
export async function generatePostMeetingTasks(meeting: Meeting, suggestedStatus: string): Promise<Task[]> {
  const tasks: Task[] = [];
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Always create follow-up task
  if (meeting.next_steps) {
    tasks.push(await createTask({
      title: `Follow up: ${meeting.investor_name}`,
      description: meeting.next_steps,
      assignee: '',
      due_date: in3Days,
      status: 'pending',
      priority: 'high',
      phase: suggestedStatus === 'in_dd' ? 'due_diligence' : suggestedStatus === 'engaged' ? 'management_presentations' : 'outreach',
      investor_id: meeting.investor_id,
      investor_name: meeting.investor_name,
      auto_generated: true,
    }));
  }

  // If objections exist, create task to address them in materials
  try {
    const objs = JSON.parse(meeting.objections || '[]');
    const showstoppers = objs.filter((o: { severity: string }) => o.severity === 'showstopper' || o.severity === 'significant');
    if (showstoppers.length > 0) {
      tasks.push(await createTask({
        title: `Address objections from ${meeting.investor_name}`,
        description: showstoppers.map((o: { text: string; severity: string }) => `[${o.severity}] ${o.text}`).join('\n'),
        assignee: '',
        due_date: in7Days,
        status: 'pending',
        priority: showstoppers.some((o: { severity: string }) => o.severity === 'showstopper') ? 'critical' : 'high',
        phase: 'preparation',
        investor_id: meeting.investor_id,
        investor_name: meeting.investor_name,
        auto_generated: true,
      }));
    }
  } catch { /* skip malformed */ }

  // If engaged or DD, create materials preparation task
  if (suggestedStatus === 'engaged' || suggestedStatus === 'in_dd') {
    tasks.push(await createTask({
      title: suggestedStatus === 'in_dd' ? `Prepare DD materials for ${meeting.investor_name}` : `Send follow-up materials to ${meeting.investor_name}`,
      description: suggestedStatus === 'in_dd' ? 'Prepare data room access, financial model, and DD request list responses.' : 'Send deck, one-pager, or additional requested materials.',
      assignee: '',
      due_date: in3Days,
      status: 'pending',
      priority: 'high',
      phase: suggestedStatus === 'in_dd' ? 'due_diligence' : 'management_presentations',
      investor_id: meeting.investor_id,
      investor_name: meeting.investor_name,
      auto_generated: true,
    }));
  }

  return tasks;
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
  await ensureInitialized();
  const id = crypto.randomUUID();
  await getClient().execute({
    sql: `INSERT INTO document_flags (id, document_id, meeting_id, investor_id, investor_name, flag_type, description, section_hint, objection_text, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [id, flag.document_id, flag.meeting_id, flag.investor_id, flag.investor_name, flag.flag_type, flag.description, flag.section_hint, flag.objection_text, flag.status],
  });
  const result = await getClient().execute({ sql: 'SELECT * FROM document_flags WHERE id = ?', args: [id] });
  return result.rows[0] as unknown as DocumentFlag;
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

export async function deleteDocumentFlag(id: string) {
  await ensureInitialized();
  await getClient().execute({ sql: 'DELETE FROM document_flags WHERE id = ?', args: [id] });
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
      for (const action of actionLines) {
        const dueDate = getDueDateForAction(action);
        results.tasks.push(await createTask({
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
        }));
      }
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

    for (const objection of objections) {
      const mapping = OBJECTION_TO_DOC_MAP[objection.topic] || OBJECTION_TO_DOC_MAP['execution'];

      // Find matching documents by type
      const matchingDocs = allDocs.filter(d => mapping.doc_types.includes(d.type));

      if (matchingDocs.length > 0) {
        for (const doc of matchingDocs) {
          results.document_flags.push(await createDocumentFlag({
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
        results.document_flags.push(await createDocumentFlag({
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
  } catch { /* skip malformed */ }

  // 5. Engagement signal-based flags
  try {
    const signals = JSON.parse(meeting.engagement_signals || '{}') as {
      pricing_reception?: string;
      slides_that_fell_flat?: string[];
    };

    if (signals.pricing_reception === 'negative') {
      const pricingDocs = (await getAllDocuments()).filter(d => ['memo', 'exec_brief', 'one_pager', 'deck'].includes(d.type));
      for (const doc of pricingDocs) {
        results.document_flags.push(await createDocumentFlag({
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
        results.document_flags.push(await createDocumentFlag({
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
  } catch { /* skip malformed */ }

  // 6. Update investor profile
  const investor = await getInvestor(meeting.investor_id);
  if (investor) {
    results.investor_updates.previous_status = investor.status;
    results.investor_updates.previous_enthusiasm = investor.enthusiasm;

    await updateInvestor(meeting.investor_id, {
      status: suggestedStatus as Investor['status'],
      enthusiasm: (aiData.enthusiasm_score as number) || investor.enthusiasm,
    });
  }

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
}): Promise<ObjectionRecord> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await getClient().execute({
    sql: `INSERT INTO objection_responses (id, objection_text, objection_topic, investor_id, investor_name, meeting_id, response_text, effectiveness, next_meeting_enthusiasm_delta, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    args: [
      id,
      data.objection_text,
      data.objection_topic,
      data.investor_id || null,
      data.investor_name || null,
      data.meeting_id || null,
      data.response_text || '',
      data.effectiveness || 'unknown',
      now,
      now,
    ],
  });
  const result = await getClient().execute({ sql: 'SELECT * FROM objection_responses WHERE id = ?', args: [id] });
  return result.rows[0] as unknown as ObjectionRecord;
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
  await ensureInitialized();
  const result = await getClient().execute({
    sql: 'SELECT * FROM objection_responses WHERE investor_id = ? ORDER BY created_at DESC',
    args: [investorId],
  });
  return result.rows as unknown as ObjectionRecord[];
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
  await ensureInitialized();
  const result = await getClient().execute({
    sql: 'SELECT * FROM score_snapshots WHERE investor_id = ? ORDER BY snapshot_date ASC LIMIT ?',
    args: [investorId, limit],
  });
  return result.rows as unknown as ScoreSnapshot[];
}

// ---------------------------------------------------------------------------
// Acceleration Actions
// ---------------------------------------------------------------------------

export async function createAccelerationAction(action: Omit<AccelerationAction, 'id' | 'created_at'>): Promise<AccelerationAction> {
  await ensureInitialized();
  const id = crypto.randomUUID();
  await getClient().execute({
    sql: `INSERT INTO acceleration_actions (id, investor_id, investor_name, trigger_type, action_type, description, expected_lift, confidence, status, actual_lift, executed_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      id,
      action.investor_id,
      action.investor_name ?? null,
      action.trigger_type,
      action.action_type,
      action.description,
      action.expected_lift,
      action.confidence,
      action.status,
      action.actual_lift ?? null,
      action.executed_at ?? null,
    ] as InValue[],
  });
  const result = await getClient().execute({ sql: 'SELECT * FROM acceleration_actions WHERE id = ?', args: [id] });
  return result.rows[0] as unknown as AccelerationAction;
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
  await ensureInitialized();
  const sets: string[] = [];
  const values: InValue[] = [];
  if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
  if (updates.actual_lift !== undefined) { sets.push('actual_lift = ?'); values.push(updates.actual_lift); }
  if (updates.executed_at !== undefined) { sets.push('executed_at = ?'); values.push(updates.executed_at); }
  if (sets.length === 0) return;
  values.push(id);
  await getClient().execute({ sql: `UPDATE acceleration_actions SET ${sets.join(', ')} WHERE id = ?`, args: values });
}

export async function getAccelerationHistory(investorId: string): Promise<AccelerationAction[]> {
  await ensureInitialized();
  const result = await getClient().execute({
    sql: 'SELECT * FROM acceleration_actions WHERE investor_id = ? ORDER BY created_at DESC',
    args: [investorId],
  });
  return result.rows as unknown as AccelerationAction[];
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
  await ensureInitialized();
  const id = crypto.randomUUID();
  await getClient().execute({
    sql: `INSERT INTO followup_actions (id, meeting_id, investor_id, investor_name, action_type, description, due_at, status, outcome, conviction_delta, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', '', 0, datetime('now'), NULL)`,
    args: [id, followup.meeting_id, followup.investor_id, followup.investor_name, followup.action_type, followup.description, followup.due_at],
  });
  const result = await getClient().execute({ sql: 'SELECT * FROM followup_actions WHERE id = ?', args: [id] });
  return result.rows[0] as unknown as FollowupAction;
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
}): Promise<void> {
  await ensureInitialized();
  const sets: string[] = [];
  const values: InValue[] = [];
  if (updates.status !== undefined) { sets.push('status = ?'); values.push(updates.status); }
  if (updates.outcome !== undefined) { sets.push('outcome = ?'); values.push(updates.outcome); }
  if (updates.conviction_delta !== undefined) { sets.push('conviction_delta = ?'); values.push(updates.conviction_delta); }
  if (updates.completed_at !== undefined) { sets.push('completed_at = ?'); values.push(updates.completed_at); }
  if (sets.length === 0) return;
  values.push(id);
  await getClient().execute({ sql: `UPDATE followup_actions SET ${sets.join(', ')} WHERE id = ?`, args: values });
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

export async function deleteFollowup(id: string): Promise<void> {
  await ensureInitialized();
  await getClient().execute({ sql: 'DELETE FROM followup_actions WHERE id = ?', args: [id] });
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

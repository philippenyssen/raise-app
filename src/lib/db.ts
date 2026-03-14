import { createClient, type Client, type InValue } from '@libsql/client';
import { Investor, Meeting, RaiseConfig, MarketDeal, InvestorPartner, InvestorPortfolioCo, Competitor, IntelligenceBrief, Task, ActivityEvent } from './types';

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

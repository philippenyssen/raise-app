import { createClient, type Client, type InValue } from '@libsql/client';
import { Investor, Meeting, RaiseConfig } from './types';

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

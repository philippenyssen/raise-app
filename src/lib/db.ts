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

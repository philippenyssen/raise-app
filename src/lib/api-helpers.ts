import { createClient } from '@libsql/client';
import type { Investor, Meeting, InvestorPortfolioCo } from '@/lib/types';

export function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:raise.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

export async function loadAllMeetings(db?: ReturnType<typeof getClient>): Promise<Meeting[]> {
  const client = db ?? getClient();
  const result = await client.execute(`SELECT * FROM meetings ORDER BY date DESC`);
  return result.rows as unknown as Meeting[];
}

export interface RaiseConfig {
  targetEquityM: number;
  targetCloseDate: string | null;
  companyName: string;
}

export async function loadRaiseConfig(db?: ReturnType<typeof getClient>): Promise<RaiseConfig> {
  const client = db ?? getClient();
  const result = await client.execute(`SELECT value FROM config WHERE key = 'raise_config'`);
  let targetEquityM = 250;
  let targetCloseDate: string | null = null;
  let companyName = 'Aerospacelab';
  if (result.rows.length > 0) {
    try {
      const cfg = JSON.parse(result.rows[0].value as string);
      targetCloseDate = cfg.target_close || null;
      companyName = cfg.company_name || companyName;
      const eqStr = (cfg.equity_amount || '').replace(/[^0-9.]/g, '');
      if (eqStr) targetEquityM = parseFloat(eqStr);
    } catch { /* ignore */ }
  }
  return { targetEquityM, targetCloseDate, companyName };
}

export async function loadAllPortfolios(db?: ReturnType<typeof getClient>): Promise<InvestorPortfolioCo[]> {
  const client = db ?? getClient();
  const result = await client.execute(`SELECT * FROM investor_portfolio`);
  return result.rows as unknown as InvestorPortfolioCo[];
}

export function groupByInvestorId<T extends { investor_id: string }>(items: T[]): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (const item of items) {
    if (!map[item.investor_id]) map[item.investor_id] = [];
    map[item.investor_id].push(item);
  }
  return map;
}
export function daysBetween(a: string | Date, b: string | Date): number {
  const da = typeof a === 'string' ? new Date(a) : a;
  const db = typeof b === 'string' ? new Date(b) : b;
  return Math.abs(da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24);
}
export function parseJsonSafe<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export const PIPELINE_ORDER = [
  'identified', 'contacted', 'nda_signed', 'meeting_scheduled',
  'met', 'engaged', 'in_dd', 'term_sheet', 'closed',
];

export function stageIndex(status: string): number {
  const idx = PIPELINE_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
}

export const STATUS_PROGRESSION: Record<string, number> = {
  identified: 0, contacted: 1, nda_signed: 2, meeting_scheduled: 3,
  met: 4, engaged: 5, in_dd: 6, term_sheet: 7, closed: 8,
  passed: -1, dropped: -1,
};

export function parseMoneyRange(s: string): [number, number] | null {
  if (!s) return null;
  const cleaned = s.replace(/[€$£,]/g, '').trim().toLowerCase();

  const rangeMatch = cleaned.match(/([\d.]+)\s*m?\s*[-–to]+\s*([\d.]+)\s*m/i);
  if (rangeMatch) {
    return [parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2])];
  }

  const singleMatch = cleaned.match(/([\d.]+)\s*(m|b|k|bn|million|billion)?/i);
  if (singleMatch) {
    let val = parseFloat(singleMatch[1]);
    const unit = (singleMatch[2] || '').toLowerCase();
    if (unit === 'b' || unit === 'bn' || unit === 'billion') val *= 1000;
    if (unit === 'k') val /= 1000;
    return [val * 0.8, val * 1.2];
  }

  return null;
}

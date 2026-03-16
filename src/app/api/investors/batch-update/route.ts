import { NextRequest, NextResponse } from 'next/server';
import { updateInvestor, getInvestor, resolvePrediction, resolveForecastPredictions, logActivity } from '@/lib/db';
import type { InvestorStatus } from '@/lib/types';

const VALID_STATUSES = new Set(['identified', 'contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged', 'in_dd', 'term_sheet', 'closed', 'passed', 'dropped']);

interface BatchItem {
  investor_id: string;
  status: string;
}

export async function POST(req: NextRequest) {
  let body: { updates?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates = body.updates;
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'updates must be a non-empty array' }, { status: 400 });
  }
  if (updates.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 updates per batch' }, { status: 400 });
  }

  const items: BatchItem[] = [];
  for (const u of updates) {
    if (!u || typeof u !== 'object' || !u.investor_id || !u.status) {
      return NextResponse.json({ error: 'Each update must have investor_id and status' }, { status: 400 });
    }
    if (!VALID_STATUSES.has(u.status)) {
      return NextResponse.json({ error: `Invalid status "${u.status}" for investor ${u.investor_id}` }, { status: 400 });
    }
    items.push({ investor_id: u.investor_id, status: u.status });
  }

  const results: { investor_id: string; success: boolean; error?: string }[] = [];

  for (const item of items) {
    try {
      await updateInvestor(item.investor_id, { status: item.status as InvestorStatus });

      if (['passed', 'dropped', 'closed'].includes(item.status)) {
        try {
          const current = await getInvestor(item.investor_id);
          if (current && current.status === item.status) {
            const outcome = item.status as 'closed' | 'passed' | 'dropped';
            await resolvePrediction(item.investor_id, outcome, outcome === 'closed' ? new Date().toISOString().split('T')[0] : undefined);
            await resolveForecastPredictions(item.investor_id, outcome);
          }
        } catch (e) { console.error('[BATCH_RESOLVE]', e instanceof Error ? e.message : e); }
      }

      logActivity({ event_type: 'status_changed', subject: item.investor_id, detail: `Batch update: status → ${item.status}`, investor_id: item.investor_id, investor_name: '' }).catch(e => console.error('[BATCH_ACTIVITY]', e instanceof Error ? e.message : e));
      results.push({ investor_id: item.investor_id, success: true });
    } catch (err) {
      results.push({ investor_id: item.investor_id, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return NextResponse.json({
    results,
    summary: { total: items.length, succeeded, failed },
  }, { status: failed > 0 && succeeded === 0 ? 500 : 200 });
}

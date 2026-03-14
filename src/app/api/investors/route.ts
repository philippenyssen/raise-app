import { NextRequest, NextResponse } from 'next/server';
import { getAllInvestors, getInvestor, createInvestor, updateInvestor, deleteInvestor, resolvePrediction, resolveForecastPredictions, buildRelationshipGraph } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

// Allowlisted fields that can be updated via API
const ALLOWED_UPDATE_FIELDS = new Set([
  'name', 'type', 'tier', 'status', 'partner', 'fund_size', 'check_size_range',
  'sector_thesis', 'warm_path', 'ic_process', 'speed', 'portfolio_conflicts',
  'notes', 'enthusiasm',
]);

function filterFields<T extends Record<string, unknown>>(data: T, allowed: Set<string>): Partial<T> {
  const filtered: Record<string, unknown> = {};
  for (const key of Object.keys(data)) {
    if (allowed.has(key)) filtered[key] = data[key];
  }
  return filtered as Partial<T>;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (id) {
    const investor = await getInvestor(id);
    if (!investor) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(investor);
  }
  const investors = await getAllInvestors();
  return NextResponse.json(investors);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const investor = await createInvestor(filterFields(body, ALLOWED_UPDATE_FIELDS) as { name: string });
  emitContextChange('investor_created', `Created investor ${body.name}`);

  // Rebuild relationship graph after creating a new investor (non-blocking)
  try { buildRelationshipGraph().catch(() => {}); } catch { /* non-blocking */ }

  return NextResponse.json(investor, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...rawUpdates } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const updates = filterFields(rawUpdates, ALLOWED_UPDATE_FIELDS);
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no valid fields to update' }, { status: 400 });
  }
  await updateInvestor(id, updates);

  // Resolve predictions when investor reaches terminal state
  if (updates.status && ['passed', 'dropped', 'closed'].includes(updates.status as string)) {
    try {
      const outcome = updates.status as 'closed' | 'passed' | 'dropped';
      await resolvePrediction(id, outcome, outcome === 'closed' ? new Date().toISOString().split('T')[0] : undefined);
      // Also resolve forecast predictions for calibration learning (cycle 23)
      await resolveForecastPredictions(id, outcome);
    } catch { /* non-blocking */ }
  }

  emitContextChange('investor_updated', `Updated investor ${id}${updates.status ? ` status=${updates.status}` : ''}`);

  // Rebuild relationship graph when warm_path changes (non-blocking)
  if (updates.warm_path !== undefined) {
    try { buildRelationshipGraph().catch(() => {}); } catch { /* non-blocking */ }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await deleteInvestor(id);
  return NextResponse.json({ ok: true });
}

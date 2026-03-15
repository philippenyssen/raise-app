import { NextRequest, NextResponse } from 'next/server';
import { getAllInvestors, getInvestor, createInvestor, updateInvestor, deleteInvestor, resolvePrediction, resolveForecastPredictions, buildRelationshipGraph } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

// Allowlisted fields that can be updated via API
const ALLOWED_UPDATE_FIELDS = new Set([
  'name', 'type', 'tier', 'status', 'partner', 'fund_size', 'check_size_range',
  'sector_thesis', 'warm_path', 'ic_process', 'speed', 'portfolio_conflicts',
  'notes', 'enthusiasm',]);

function filterFields<T extends Record<string, unknown>>(data: T, allowed: Set<string>): Partial<T> {
  const filtered: Record<string, unknown> = {};
  for (const key of Object.keys(data)) {
    if (allowed.has(key)) filtered[key] = data[key];
  }
  return filtered as Partial<T>;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (id) {
      const investor = await getInvestor(id);
      if (!investor) return NextResponse.json({ error: `Investor ${id} not found` }, { status: 404 });
      return NextResponse.json(investor);
    }
    const investors = await getAllInvestors();
    return NextResponse.json(investors, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } });
  } catch (error) {
    console.error('[INVESTORS_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to fetch investors' },
      { status: 500 });
  }}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ error: 'name is required and must be a non-empty string' }, { status: 400 });
  }
  body.name = (body.name as string).trim();
  const textLimits: Record<string, number> = { name: 255, sector_thesis: 2000, warm_path: 1000, ic_process: 2000, notes: 10000, portfolio_conflicts: 2000, partner: 255, fund_size: 100, check_size_range: 100 };
  for (const [field, max] of Object.entries(textLimits)) {
    if (body[field] && typeof body[field] === 'string' && (body[field] as string).length > max) {
      return NextResponse.json({ error: `${field} exceeds maximum length of ${max} characters` }, { status: 400 });
    }
  }

  if (body.tier !== undefined && (typeof body.tier !== 'number' || body.tier < 1 || body.tier > 4)) {
    return NextResponse.json({ error: 'tier must be a number between 1 and 4' }, { status: 400 });
  }

  const validTypes = ['vc', 'growth', 'sovereign', 'strategic', 'debt', 'family_office'];
  if (body.type !== undefined && !validTypes.includes(body.type as string)) {
    return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
  }

  try {
    const investor = await createInvestor(filterFields(body, ALLOWED_UPDATE_FIELDS) as { name: string });
    emitContextChange('investor_created', `Created investor ${body.name}`);

    // Rebuild relationship graph after creating a new investor (non-blocking)
    try { buildRelationshipGraph().catch(e => console.error('[RELATIONSHIP_GRAPH]', e instanceof Error ? e.message : e)); } catch { /* non-blocking */ }

    // Fire-and-forget: trigger enrichment for the newly created investor (5s timeout)
    try {
      const baseUrl = req.nextUrl.origin;
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), 5000);
      fetch(`${baseUrl}/api/enrichment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enrich', investor_id: investor.id, auto_apply: true }),
        signal: ac.signal,
      }).catch(e => console.error('[AUTO_ENRICH]', e instanceof Error ? e.message : e)).finally(() => clearTimeout(tid));
    } catch { /* non-blocking */ }

    return NextResponse.json(investor, { status: 201 });
  } catch (error) {
    console.error('[INVESTORS_POST]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to create investor' },
      { status: 500 });
  }}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const { id, ...rawUpdates } = body;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required and must be a string' }, { status: 400 });
  }

  const validStatuses = ['identified', 'contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged', 'in_dd', 'term_sheet', 'closed', 'passed', 'dropped'];
  if (rawUpdates.status && !validStatuses.includes(rawUpdates.status as string)) {
    return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
  }

  if (rawUpdates.enthusiasm !== undefined) {
    const enth = rawUpdates.enthusiasm as number;
    if (typeof enth !== 'number' || enth < 0 || enth > 5) {
      return NextResponse.json({ error: 'enthusiasm must be a number between 0 and 5' }, { status: 400 });
    }}

  const updates = filterFields(rawUpdates, ALLOWED_UPDATE_FIELDS);
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update. Allowed fields: ' + [...ALLOWED_UPDATE_FIELDS].join(', ') }, { status: 400 });
  }

  try {
    await updateInvestor(id as string, updates);

    // Resolve predictions when investor reaches terminal state
    if (updates.status && ['passed', 'dropped', 'closed'].includes(updates.status as string)) {
      try {
        const outcome = updates.status as 'closed' | 'passed' | 'dropped';
        await resolvePrediction(id as string, outcome, outcome === 'closed' ? new Date().toISOString().split('T')[0] : undefined);
        await resolveForecastPredictions(id as string, outcome);
      } catch { /* non-blocking */ }
    }

    emitContextChange('investor_updated', `Updated investor ${id}${updates.status ? ` status=${updates.status}` : ''}`);

    // Rebuild relationship graph when warm_path changes (non-blocking)
    if (updates.warm_path !== undefined) {
      try { buildRelationshipGraph().catch(e => console.error('[RELATIONSHIP_GRAPH]', e instanceof Error ? e.message : e)); } catch { /* non-blocking */ }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[INVESTORS_PUT]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to update investor' },
      { status: 500 });
  }}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });

  try {
    const investor = await getInvestor(id);
    if (!investor) { return NextResponse.json({ error: `Investor ${id} not found` }, { status: 404 }); }
    await deleteInvestor(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[INVESTORS_DELETE]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to delete investor' },
      { status: 500 });
  }}

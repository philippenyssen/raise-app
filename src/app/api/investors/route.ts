import { NextRequest, NextResponse } from 'next/server';
import { getAllInvestors, getInvestor, createInvestor, updateInvestor, deleteInvestor } from '@/lib/db';

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
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await deleteInvestor(id);
  return NextResponse.json({ ok: true });
}

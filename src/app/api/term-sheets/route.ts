import { NextRequest, NextResponse } from 'next/server';
import { getAllTermSheets, createTermSheet, updateTermSheet, deleteTermSheet } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

const ALLOWED_FIELDS = new Set([
  'investor', 'valuation', 'amount', 'liq_pref', 'anti_dilution', 'board_seats',
  'dividends', 'protective_provisions', 'option_pool', 'exclusivity', 'strategic_value', 'notes',
]);

export async function GET() {
  try {
    const sheets = await getAllTermSheets();
    return NextResponse.json(sheets, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
  } catch (err) {
    console.error('[TERM_SHEETS_GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to load term sheets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  if (!body.investor) {
    return NextResponse.json({ error: 'investor is required' }, { status: 400 });
  }
  const textLimits: Record<string, number> = { investor: 255, valuation: 100, amount: 100, liq_pref: 500, anti_dilution: 500, board_seats: 500, dividends: 500, protective_provisions: 2000, option_pool: 500, exclusivity: 500, notes: 5000 };
  for (const [field, max] of Object.entries(textLimits)) {
    if (body[field] && typeof body[field] === 'string' && (body[field] as string).length > max) {
      return NextResponse.json({ error: `${field} exceeds maximum length of ${max} characters` }, { status: 400 });
    }
  }
  const rawSV = Number(body.strategic_value);
  const strategic_value = (!isNaN(rawSV) && rawSV >= 1 && rawSV <= 5) ? rawSV : 3;
  try {
    const sheet = await createTermSheet({
      investor: (body.investor as string).trim(),
      valuation: ((body.valuation as string) ?? '').trim(),
      amount: ((body.amount as string) ?? '').trim(),
      liq_pref: (body.liq_pref as string) ?? '1x non-participating',
      anti_dilution: (body.anti_dilution as string) ?? 'Broad-based weighted average',
      board_seats: (body.board_seats as string) ?? '1 + observer',
      dividends: (body.dividends as string) ?? 'None',
      protective_provisions: (body.protective_provisions as string) ?? 'Standard',
      option_pool: (body.option_pool as string) ?? '',
      exclusivity: (body.exclusivity as string) ?? '',
      strategic_value,
      notes: (body.notes as string) ?? '',
    });
    return NextResponse.json(sheet, { status: 201 });
  } catch (err) {
    console.error('[TERM_SHEETS_POST]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to create term sheet' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const { id, ...raw } = body;
  const updates: Record<string, unknown> = Object.fromEntries(
    Object.entries(raw).filter(([k]) => ALLOWED_FIELDS.has(k))
  );
  if (updates.strategic_value !== undefined) {
    const rawSV = Number(updates.strategic_value);
    updates.strategic_value = (!isNaN(rawSV) && rawSV >= 1 && rawSV <= 5) ? rawSV : 3;
  }
  try {
    await updateTermSheet(id as string, updates);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[TERM_SHEETS_PUT]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to update term sheet' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  try {
    await deleteTermSheet(id);
    emitContextChange('term_sheet_deleted', `Deleted term sheet ${id}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[TERM_SHEETS_DELETE]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to delete term sheet' }, { status: 500 });
  }
}

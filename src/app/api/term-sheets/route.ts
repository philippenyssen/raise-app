import { NextRequest, NextResponse } from 'next/server';
import { getAllTermSheets, createTermSheet, updateTermSheet, deleteTermSheet } from '@/lib/db';

export async function GET() {
  const sheets = await getAllTermSheets();
  return NextResponse.json(sheets);
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
  const sheet = await createTermSheet({
    investor: body.investor as string,
    valuation: (body.valuation as string) ?? '',
    amount: (body.amount as string) ?? '',
    liq_pref: (body.liq_pref as string) ?? '1x non-participating',
    anti_dilution: (body.anti_dilution as string) ?? 'Broad-based weighted average',
    board_seats: (body.board_seats as string) ?? '1 + observer',
    dividends: (body.dividends as string) ?? 'None',
    protective_provisions: (body.protective_provisions as string) ?? 'Standard',
    option_pool: (body.option_pool as string) ?? '',
    exclusivity: (body.exclusivity as string) ?? '',
    strategic_value: (body.strategic_value as number) ?? 3,
    notes: (body.notes as string) ?? '',
  });
  return NextResponse.json(sheet);
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const { id, ...updates } = body;
  await updateTermSheet(id as string, updates);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await deleteTermSheet(id);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getAllTermSheets, createTermSheet, updateTermSheet, deleteTermSheet } from '@/lib/db';

export async function GET() {
  const sheets = await getAllTermSheets();
  return NextResponse.json(sheets);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.investor) {
    return NextResponse.json({ error: 'investor is required' }, { status: 400 });
  }
  const sheet = await createTermSheet({
    investor: body.investor,
    valuation: body.valuation ?? '',
    amount: body.amount ?? '',
    liq_pref: body.liq_pref ?? '1x non-participating',
    anti_dilution: body.anti_dilution ?? 'Broad-based weighted average',
    board_seats: body.board_seats ?? '1 + observer',
    dividends: body.dividends ?? 'None',
    protective_provisions: body.protective_provisions ?? 'Standard',
    option_pool: body.option_pool ?? '',
    exclusivity: body.exclusivity ?? '',
    strategic_value: body.strategic_value ?? 3,
    notes: body.notes ?? '',
  });
  return NextResponse.json(sheet);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const { id, ...updates } = body;
  await updateTermSheet(id, updates);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await deleteTermSheet(id);
  return NextResponse.json({ ok: true });
}

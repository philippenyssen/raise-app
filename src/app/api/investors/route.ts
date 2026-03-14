import { NextRequest, NextResponse } from 'next/server';
import { getAllInvestors, createInvestor, updateInvestor, deleteInvestor } from '@/lib/db';

export async function GET() {
  const investors = getAllInvestors();
  return NextResponse.json(investors);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const investor = createInvestor(body);
  return NextResponse.json(investor, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  updateInvestor(id, updates);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  deleteInvestor(id);
  return NextResponse.json({ ok: true });
}

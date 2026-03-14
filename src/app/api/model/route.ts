import { NextRequest, NextResponse } from 'next/server';
import { getModelSheets, createModelSheet, updateModelSheet, deleteModelSheet } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const modelId = searchParams.get('modelId') || 'default';
  const sheets = await getModelSheets(modelId);
  return NextResponse.json(sheets);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sheet_name, sheet_order, data, model_id } = body;

  if (!sheet_name) {
    return NextResponse.json({ error: 'sheet_name is required' }, { status: 400 });
  }

  const sheet = await createModelSheet({
    model_id: model_id || 'default',
    sheet_name,
    sheet_order: sheet_order ?? 0,
    data: typeof data === 'string' ? data : JSON.stringify(data || {}),
  });

  return NextResponse.json(sheet);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, sheet_name, data, sheet_order } = body;

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  await updateModelSheet(id, {
    sheet_name,
    data: typeof data === 'string' ? data : (data ? JSON.stringify(data) : undefined),
    sheet_order,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await deleteModelSheet(id);
  return NextResponse.json({ success: true });
}

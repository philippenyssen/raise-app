import { NextRequest, NextResponse } from 'next/server';
import { getModelSheets, createModelSheet, updateModelSheet, deleteModelSheet } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const modelId = searchParams.get('modelId') || 'default';
  const sheets = await getModelSheets(modelId);
  return NextResponse.json(sheets);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { sheet_name, sheet_order, data, model_id } = body as {
    sheet_name: string; sheet_order: number; data: unknown; model_id: string;
  };

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
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { id, sheet_name, data, sheet_order } = body as {
    id: string; sheet_name: string; data: unknown; sheet_order: number;
  };

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  await updateModelSheet(id, {
    sheet_name,
    data: typeof data === 'string' ? data : (data ? JSON.stringify(data) : undefined),
    sheet_order,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await deleteModelSheet(id);
  return NextResponse.json({ ok: true });
}

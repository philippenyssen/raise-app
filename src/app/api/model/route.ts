import { NextRequest, NextResponse } from 'next/server';
import { getModelSheets, createModelSheet, updateModelSheet, deleteModelSheet } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const modelId = searchParams.get('modelId') || 'default';
    const sheets = await getModelSheets(modelId);
    return NextResponse.json(sheets, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
  } catch (err) {
    console.error('[MODEL_GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to load model sheets' }, { status: 500 });
  }
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
  const textLimits: Record<string, number> = { sheet_name: 255, model_id: 100 };
  for (const [field, max] of Object.entries(textLimits)) {
    if (body[field] && typeof body[field] === 'string' && (body[field] as string).length > max) {
      return NextResponse.json({ error: `${field} exceeds maximum length of ${max} characters` }, { status: 400 });
    }
  }

  try {
    const sheet = await createModelSheet({
      model_id: model_id || 'default',
      sheet_name,
      sheet_order: sheet_order ?? 0,
      data: typeof data === 'string' ? data : JSON.stringify(data || {}),
    });
    return NextResponse.json(sheet, { status: 201 });
  } catch (err) {
    console.error('[MODEL_POST]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to create model sheet' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const id = body.id as string | undefined;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.sheet_name !== undefined) updates.sheet_name = body.sheet_name;
  if (body.sheet_order !== undefined) updates.sheet_order = body.sheet_order;
  if (body.data !== undefined) updates.data = typeof body.data === 'string' ? body.data : JSON.stringify(body.data);

  try {
    await updateModelSheet(id, updates);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[MODEL_PUT]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to update model sheet' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  try {
    await deleteModelSheet(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[MODEL_DELETE]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to delete model sheet' }, { status: 500 });
  }
}

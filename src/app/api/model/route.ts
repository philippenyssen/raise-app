import { NextRequest, NextResponse } from 'next/server';
import { getModelSheets, getModelSheet, createModelSheet, updateModelSheet, deleteModelSheet } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
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
  const sheet_name = typeof body.sheet_name === 'string' ? (body.sheet_name as string).trim() : '';
  const sheet_order = body.sheet_order as number;
  const data = body.data as unknown;
  const model_id = typeof body.model_id === 'string' ? (body.model_id as string).trim() : '';

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
    emitContextChange('model_updated', `Created model sheet ${sheet_name}`);
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
  const existing = await getModelSheet(id);
  if (!existing) return NextResponse.json({ error: `Model sheet ${id} not found` }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (body.sheet_name !== undefined) updates.sheet_name = typeof body.sheet_name === 'string' ? body.sheet_name.trim() : body.sheet_name;
  if (body.sheet_order !== undefined) updates.sheet_order = body.sheet_order;
  if (body.data !== undefined) updates.data = typeof body.data === 'string' ? body.data : JSON.stringify(body.data);

  try {
    await updateModelSheet(id, updates);
    emitContextChange('model_updated', `Updated model sheet ${id}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[MODEL_PUT]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to update model sheet' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  try {
    await deleteModelSheet(id);
    emitContextChange('model_updated', `Deleted model sheet ${id}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[MODEL_DELETE]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to delete model sheet' }, { status: 500 });
  }
}

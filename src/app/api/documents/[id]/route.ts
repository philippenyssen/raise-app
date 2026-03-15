import { NextRequest, NextResponse } from 'next/server';
import { getDocument, updateDocument, deleteDocument } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const doc = await getDocument(id);
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    return NextResponse.json(doc, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } });
  } catch (err) {
    console.error('[DOCUMENT_GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to load document' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const allowed = ['title', 'content', 'status', 'change_summary'];
  const maxLengths: Record<string, number> = { title: 500, content: 5_000_000, status: 50, change_summary: 2000 };
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      const val = typeof body[key] === 'string' ? (body[key] as string).trim() : body[key];
      if (typeof val === 'string' && val.length > (maxLengths[key] || 10000)) {
        return NextResponse.json({ error: `${key} exceeds maximum length of ${maxLengths[key]} characters` }, { status: 400 });
      }
      updates[key] = val;
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }
  try {
    await updateDocument(id, updates);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DOCUMENT_PUT]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteDocument(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DOCUMENT_DELETE]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}

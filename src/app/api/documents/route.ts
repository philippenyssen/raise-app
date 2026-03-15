import { NextRequest, NextResponse } from 'next/server';
import { getAllDocuments, createDocument } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

export async function GET() {
  try {
    const documents = await getAllDocuments();
    return NextResponse.json(documents, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
  } catch (e) {
    console.error('[DOCUMENTS_GET]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Failed to load documents' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  const ALLOWED_FIELDS = new Set(['title', 'type', 'content']);
  const filtered = Object.fromEntries(
    Object.entries(body).filter(([k]) => ALLOWED_FIELDS.has(k))
  ) as { title: string; type: string; content: string };
  const doc = await createDocument(filtered);
  emitContextChange('document_created', `Created document ${filtered.title || ''}`);
  return NextResponse.json(doc, { status: 201 });
}

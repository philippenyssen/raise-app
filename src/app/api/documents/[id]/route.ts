import { NextRequest, NextResponse } from 'next/server';
import { getDocument, updateDocument, deleteDocument } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const doc = await getDocument(id);
    if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(doc);
  } catch {
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
  try {
    await updateDocument(id, body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteDocument(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}

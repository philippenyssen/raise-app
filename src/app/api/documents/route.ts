import { NextRequest, NextResponse } from 'next/server';
import { getAllDocuments, createDocument } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

export async function GET() {
  const documents = await getAllDocuments();
  return NextResponse.json(documents);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const doc = await createDocument(body as { title: string; type: string; content: string });
  emitContextChange('document_created', `Created document ${(body.title as string) || ''}`);
  return NextResponse.json(doc, { status: 201 });
}

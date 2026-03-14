import { NextRequest, NextResponse } from 'next/server';
import { getAllDocuments, createDocument } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

export async function GET() {
  const documents = await getAllDocuments();
  return NextResponse.json(documents);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const doc = await createDocument(body);
  emitContextChange('document_created', `Created document ${body.title || ''}`);
  return NextResponse.json(doc, { status: 201 });
}

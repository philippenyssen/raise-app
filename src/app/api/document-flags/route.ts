import { NextRequest, NextResponse } from 'next/server';
import { getDocumentFlags, updateDocumentFlag } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') ?? undefined;
  const document_id = searchParams.get('document_id') ?? undefined;
  const investor_id = searchParams.get('investor_id') ?? undefined;
  const meeting_id = searchParams.get('meeting_id') ?? undefined;

  const flags = await getDocumentFlags({ status, document_id, investor_id, meeting_id });
  return NextResponse.json(flags);
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { id, status } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const validStatuses = ['open', 'addressed', 'resolved'];
  if (status && !validStatuses.includes(status as string)) {
    return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
  }
  await updateDocumentFlag(id as string, { status: status as string });
  return NextResponse.json({ ok: true });
}

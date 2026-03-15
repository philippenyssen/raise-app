import { NextRequest, NextResponse } from 'next/server';
import { getDocumentVersions, getDocumentVersion } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const versionId = searchParams.get('version_id');

  if (versionId) {
    const version = await getDocumentVersion(versionId);
    if (!version) return NextResponse.json({ error: 'Document version not found' }, { status: 404 });
    return NextResponse.json(version);
  }

  const versions = await getDocumentVersions(id);
  return NextResponse.json(versions);
}

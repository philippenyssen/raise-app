import { NextRequest, NextResponse } from 'next/server';
import { getDocumentVersions, getDocumentVersion } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    const versionId = searchParams.get('version_id');

    if (versionId) {
      const version = await getDocumentVersion(versionId);
      if (!version) return NextResponse.json({ error: 'Document version not found' }, { status: 404 });
      return NextResponse.json(version);
    }

    const versions = await getDocumentVersions(id);
    return NextResponse.json(versions, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
  } catch (e) {
    console.error('[DOCUMENT_VERSIONS_GET]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load versions' }, { status: 500 });
  }
}

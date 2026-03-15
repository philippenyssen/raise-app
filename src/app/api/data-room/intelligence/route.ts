import { NextRequest, NextResponse } from 'next/server';
import { getAllDataRoomFiles, getAllDataRoomAccess, getAllInvestors, logDataRoomAccess } from '@/lib/db';

const STAGE_RECOMMENDATIONS: Record<string, string[]> = {
  identified: ['financial', 'commercial'],
  contacted: ['financial', 'commercial'],
  nda_signed: ['financial', 'commercial', 'technical'],
  meeting_scheduled: ['financial', 'commercial', 'technical'],
  met: ['financial', 'commercial', 'technical', 'team'],
  engaged: ['financial', 'legal', 'commercial', 'technical', 'team'],
  in_dd: ['financial', 'legal', 'commercial', 'technical', 'team', 'other'],
  term_sheet: ['financial', 'legal', 'commercial', 'technical', 'team', 'other'],
  closed: ['financial', 'legal', 'commercial', 'technical', 'team', 'other'],
  passed: [],
  dropped: [],};

export async function GET() {
  const [files, accessRecords, investors] = await Promise.all([
    getAllDataRoomFiles(),
    getAllDataRoomAccess(),
    getAllInvestors(),]);

  const fileMap = new Map(files.map(f => [f.id, f]));

  const document_access_log = accessRecords.map(r => {
    const inv = investors.find(i => i.id === r.investor_id);
    const doc = fileMap.get(r.document_id);
    return {
      investor_name: inv?.name || 'Unknown',
      investor_id: r.investor_id,
      document_id: r.document_id,
      document_title: doc?.filename || 'Unknown',
      accessed_at: r.accessed_at,
    };});

  const docAccessCounts: Record<string, number> = {};
  for (const r of accessRecords) {
    docAccessCounts[r.document_id] = (docAccessCounts[r.document_id] || 0) + 1;
  }
  const most_requested = Object.entries(docAccessCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([docId, count]) => {
      const doc = fileMap.get(docId);
      return {
        document_id: docId,
        document_title: doc?.filename || 'Unknown',
        category: doc?.category || 'other',
        access_count: count,
      };});

  const activeStatuses = new Set(['contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged', 'in_dd', 'term_sheet', 'closed']);
  const activeInvestors = investors.filter(i => activeStatuses.has(i.status));

  const investorAccessedDocs: Record<string, Set<string>> = {};
  for (const r of accessRecords) {
    if (!investorAccessedDocs[r.investor_id]) investorAccessedDocs[r.investor_id] = new Set();
    investorAccessedDocs[r.investor_id].add(r.document_id);
  }

  const per_investor_access = activeInvestors.map(inv => {
    const accessedDocIds = investorAccessedDocs[inv.id] || new Set<string>();
    const accessed_documents = Array.from(accessedDocIds).map(docId => {
      const doc = fileMap.get(docId);
      return {
        document_id: docId,
        document_title: doc?.filename || 'Unknown',
        category: doc?.category || 'other',
      };});

    const recommendedCategories = STAGE_RECOMMENDATIONS[inv.status] || [];
    const accessedCategories = new Set(accessed_documents.map(d => d.category));
    const missingCategories = recommendedCategories.filter(c => !accessedCategories.has(c));
    const recommended_documents = files
      .filter(f => missingCategories.includes(f.category) && !accessedDocIds.has(f.id))
      .map(f => ({
        document_id: f.id,
        document_title: f.filename,
        category: f.category,
        reason: `${inv.status} investors should see ${f.category} documents`,
      }));

    return {
      investor_id: inv.id,
      investor_name: inv.name,
      status: inv.status,
      tier: inv.tier,
      documents_accessed: accessed_documents.length,
      accessed_documents,
      recommended_documents,
    };});

  const unreached_investors = activeInvestors
    .filter(inv => !investorAccessedDocs[inv.id] || investorAccessedDocs[inv.id].size === 0)
    .map(inv => ({
      investor_id: inv.id,
      investor_name: inv.name,
      status: inv.status,
      tier: inv.tier,
      recommended_categories: STAGE_RECOMMENDATIONS[inv.status] || [],
    }));

  return NextResponse.json({
    document_access_log,
    most_requested,
    per_investor_access,
    unreached_investors,
    total_files: files.length,
    total_access_events: accessRecords.length,}, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { investor_id, document_id } = body;
  if (!investor_id || !document_id) {
    return NextResponse.json({ error: 'investor_id and document_id are required' }, { status: 400 });
  }
  const record = await logDataRoomAccess(investor_id as string, document_id as string);
  return NextResponse.json(record);
}

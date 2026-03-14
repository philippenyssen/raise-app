import { NextRequest, NextResponse } from 'next/server';
import { getObjectionPlaybook, updateObjectionResponse, getTopObjections, getBestResponses, getObjectionsByInvestor, getAllInvestors } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const investorId = searchParams.get('investor_id');
  const topic = searchParams.get('topic');
  const view = searchParams.get('view'); // 'top' | 'best' | 'investor' | default full playbook

  if (view === 'top') {
    const limit = parseInt(searchParams.get('limit') || '10');
    const top = await getTopObjections(limit);
    return NextResponse.json(top);
  }

  if (view === 'best' && topic) {
    const best = await getBestResponses(topic);
    return NextResponse.json(best);
  }

  if (view === 'investor' && investorId) {
    const objections = await getObjectionsByInvestor(investorId);
    return NextResponse.json(objections);
  }

  // Full playbook
  const playbook = await getObjectionPlaybook();
  const topObjections = await getTopObjections(5);
  const investors = await getAllInvestors();

  // Compute unresolved: most frequent objections with no effective response
  const unresolved = topObjections
    .filter(o => !o.has_effective_response)
    .slice(0, 3);

  return NextResponse.json({
    playbook,
    top_objections: topObjections,
    unresolved,
    investors: investors.map(i => ({ id: i.id, name: i.name })),
    total_objections: playbook.reduce((sum, t) => sum + t.count, 0),
    topics_count: playbook.length,
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, response_text, effectiveness } = body;

  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  await updateObjectionResponse(
    id,
    response_text ?? '',
    effectiveness ?? 'unknown'
  );

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getObjectionPlaybook, updateObjectionResponse, getTopObjections, getBestResponses, getObjectionsByInvestor, getAllInvestors, logActivity, getFollowups, updateFollowup } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const investorId = searchParams.get('investor_id');
  const topic = searchParams.get('topic');
  const view = searchParams.get('view'); // 'top' | 'best' | 'investor' | default full playbook

  if (view === 'top') {
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10) || 10, 1), 100);
    const top = await getTopObjections(limit);
    return NextResponse.json(top, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
  }

  if (view === 'best' && topic) {
    const best = await getBestResponses(topic);
    return NextResponse.json(best, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
  }

  if (view === 'investor' && investorId) {
    const objections = await getObjectionsByInvestor(investorId);
    return NextResponse.json(objections, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } });
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
    topics_count: playbook.length,}, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const ALLOWED_FIELDS = new Set([
    'id', 'response_text', 'effectiveness', 'investor_id', 'investor_name', 'objection_topic',
  ]);
  const filtered: Record<string, unknown> = Object.fromEntries(
    Object.entries(body).filter(([k]) => ALLOWED_FIELDS.has(k))
  );

  const { id, response_text, effectiveness } = filtered as {
    id: string; response_text: string; effectiveness: string;
  };

  if (!id) { return NextResponse.json({ error: 'id is required' }, { status: 400 }); }
  const textLimits: Record<string, number> = { response_text: 10000, investor_name: 255, objection_topic: 500 };
  for (const [field, max] of Object.entries(textLimits)) {
    if (filtered[field] && typeof filtered[field] === 'string' && (filtered[field] as string).length > max) {
      return NextResponse.json({ error: `${field} exceeds maximum length of ${max} characters` }, { status: 400 });
    }
  }

  await updateObjectionResponse(
    id,
    response_text ?? '',
    effectiveness ?? 'unknown');

  // --- WIRE: Objection Response → Cascade Updates ---
  if (effectiveness === 'effective' || effectiveness === 'partially_effective') {
    const investor_id = filtered.investor_id as string | undefined;
    const investor_name = filtered.investor_name as string | undefined;
    const objection_topic = filtered.objection_topic as string | undefined;

    // Log activity
    try {
      if (investor_id) {
        await logActivity({
          event_type: 'objection_resolved',
          subject: `Objection resolved: ${objection_topic || 'unknown topic'}`,
          detail: `Response marked "${effectiveness}". ${response_text ? 'Response: ' + response_text.substring(0, 100) : ''}`,
          investor_id,
          investor_name: investor_name || '',});
      }
    } catch (e) { console.error('[OBJECTION_ACTIVITY]', e instanceof Error ? e.message : e); }

    // Auto-complete follow-ups related to this objection
    try {
      if (investor_id) {
        const followups = await getFollowups({ investor_id, status: 'pending' });
        for (const fu of followups) {
          if (fu.action_type === 'objection_response' && fu.status === 'pending') {
            await updateFollowup(fu.id, {
              status: 'completed',
              outcome: `Auto-resolved: objection "${objection_topic}" marked ${effectiveness}`,
              conviction_delta: effectiveness === 'effective' ? 1 : 0,});
          }}
      }
    } catch (e) { console.error('[OBJECTION_FOLLOWUP_RESOLVE]', e instanceof Error ? e.message : e); }
  }

  emitContextChange('objection_updated', `Objection ${id} response: ${effectiveness || 'updated'}`);
  return NextResponse.json({ ok: true });
}

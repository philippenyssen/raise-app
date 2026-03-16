import { NextRequest, NextResponse } from 'next/server';
import { getFollowups, createFollowup, updateFollowup, getPendingFollowups, getOverdueFollowups, backfillEnthusiasmFromFollowups, computeOptimalFollowupTiming, computeEngagementVelocity, computeNetworkCascades } from '@/lib/db';
import type { FollowupActionType, FollowupStatus } from '@/lib/types';
import { emitContextChange } from '@/lib/context-bus';
import { MS_PER_DAY } from '@/lib/time';

function enrichTemporal<T extends { status: string; due_at: string }>(f: T) {
  const now = Date.now();
  const dueTime = new Date(f.due_at).getTime();
  if (isNaN(dueTime)) return { ...f, isOverdue: false, daysOverdue: null, daysUntilDue: null };
  const isOverdue = f.status === 'pending' && dueTime < now;
  return {
    ...f,
    isOverdue,
    daysOverdue: isOverdue ? Math.round((now - dueTime) / MS_PER_DAY) : null,
    daysUntilDue: f.status === 'pending' && !isOverdue ? Math.round((dueTime - now) / MS_PER_DAY) : null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status') as FollowupStatus | null;
    const investor_id = searchParams.get('investor_id');
    const meeting_id = searchParams.get('meeting_id');
    const view = searchParams.get('view');

    if (view === 'overdue') {
      const overdue = await getOverdueFollowups();
      return NextResponse.json(overdue, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } });
    }

    if (view === 'pending') {
      const pending = await getPendingFollowups();
      return NextResponse.json(pending, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } });
    }

    if (view === 'intelligence') {
      const filters: { status?: FollowupStatus; investor_id?: string; meeting_id?: string } = {};
      if (status) filters.status = status;
      if (investor_id) filters.investor_id = investor_id;
      if (meeting_id) filters.meeting_id = meeting_id;

      const [followups, velocities, cascades] = await Promise.all([
        getFollowups(Object.keys(filters).length > 0 ? filters : undefined),
        computeEngagementVelocity().catch(e => { console.error('[FOLLOWUPS] velocity failed:', e instanceof Error ? e.message : e); return [] as Awaited<ReturnType<typeof computeEngagementVelocity>>; }),
        computeNetworkCascades().catch(e => { console.error('[FOLLOWUPS] cascades failed:', e instanceof Error ? e.message : e); return [] as Awaited<ReturnType<typeof computeNetworkCascades>>; }),]);

      const uniqueInvestorIds = [...new Set(followups.map(f => f.investor_id))];
      const timingResults = await Promise.all(
        uniqueInvestorIds.map(id =>
          computeOptimalFollowupTiming(id)
            .then(timing => ({ investorId: id, ...timing }))
            .catch(() => ({ investorId: id, optimalDayOfWeek: 'Tuesday', optimalTimeOfDay: '10:00 AM', reasoning: 'Default — insufficient data.' }))
        ));
      const timingMap: Record<string, { optimalDayOfWeek: string; optimalTimeOfDay: string; reasoning: string }> = {};
      for (const t of timingResults) {
        timingMap[t.investorId] = { optimalDayOfWeek: t.optimalDayOfWeek, optimalTimeOfDay: t.optimalTimeOfDay, reasoning: t.reasoning };
      }

      const velocityMap: Record<string, { acceleration: string; signal: string; daysSinceLastMeeting: number | null; recentMeetings: number; previousMeetings: number }> = {};
      for (const v of velocities) {
        velocityMap[v.investorId] = { acceleration: v.acceleration, signal: v.signal, daysSinceLastMeeting: v.daysSinceLastMeeting, recentMeetings: v.recentMeetings, previousMeetings: v.previousMeetings };
      }

      const cascadeMap: Record<string, { cascadeChainLength: number; signal: string; keystoneName: string; totalCascadeProbability: number }> = {};
      for (const c of cascades) {
        cascadeMap[c.keystoneId] = { cascadeChainLength: c.cascadeChain.length, signal: c.signal, keystoneName: c.keystoneName, totalCascadeProbability: c.totalCascadeProbability };
        for (const link of c.cascadeChain) {
          if (!cascadeMap[link.investorId]) {
            cascadeMap[link.investorId] = { cascadeChainLength: 0, signal: `Part of ${c.keystoneName}'s network cascade`, keystoneName: c.keystoneName, totalCascadeProbability: link.probability };
          }}
      }

      const enriched = followups.map(f => ({
        ...enrichTemporal(f),
        timing: timingMap[f.investor_id] || null,
        velocity: velocityMap[f.investor_id] || null,
        cascade: cascadeMap[f.investor_id] || null,
      }));

      return NextResponse.json(enriched, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
    }

    const filters: { status?: FollowupStatus; investor_id?: string; meeting_id?: string } = {};
    if (status) filters.status = status;
    if (investor_id) filters.investor_id = investor_id;
    if (meeting_id) filters.meeting_id = meeting_id;

    const followups = await getFollowups(Object.keys(filters).length > 0 ? filters : undefined);
    return NextResponse.json(followups.map(enrichTemporal), { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } });
  } catch (error) {
    console.error('[FOLLOWUPS_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to fetch follow-ups' },
      { status: 500 });
  }}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { meeting_id, investor_id, investor_name, action_type, description, due_at } = body as {
    meeting_id: string; investor_id: string; investor_name: string;
    action_type: string; description: string; due_at: string;
  };

  if (!meeting_id || !investor_id || !action_type || !description || !due_at) {
    return NextResponse.json({ error: 'meeting_id, investor_id, action_type, description, and due_at are required' }, { status: 400 });
  }
  const textLimits: Record<string, number> = { investor_name: 255, action_type: 100, description: 5000 };
  for (const [field, max] of Object.entries(textLimits)) {
    if (body[field] && typeof body[field] === 'string' && (body[field] as string).length > max) {
      return NextResponse.json({ error: `${field} exceeds maximum length of ${max} characters` }, { status: 400 });
    }
  }
  if (isNaN(new Date(due_at).getTime())) {
    return NextResponse.json({ error: 'due_at must be a valid date string' }, { status: 400 });
  }

  try {
    const followup = await createFollowup({
      meeting_id,
      investor_id,
      investor_name: investor_name || '',
      action_type: action_type as FollowupActionType,
      description,
      due_at,});

    emitContextChange('followup_created', `Follow-up for ${investor_name || investor_id}: ${action_type}`);
    return NextResponse.json(followup, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[FOLLOWUPS_POST]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Failed to create follow-up' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const ALLOWED_FIELDS = new Set([
    'id', 'status', 'outcome', 'conviction_delta', 'investor_id', 'due_at',
  ]);
  const filtered: Record<string, unknown> = Object.fromEntries(
    Object.entries(body).filter(([k]) => ALLOWED_FIELDS.has(k))
  );

  const { id, status, outcome, conviction_delta, due_at } = filtered as {
    id: string; status: string; outcome: string; conviction_delta: number; due_at: string;
  };

  if (!id) { return NextResponse.json({ error: 'id is required' }, { status: 400 }); }

  const updates: { status?: FollowupStatus; outcome?: string; conviction_delta?: number; completed_at?: string; due_at?: string } = {};
  if (status) updates.status = status as FollowupStatus;
  if (outcome !== undefined) updates.outcome = outcome as string;
  if (conviction_delta !== undefined) updates.conviction_delta = conviction_delta as number;
  if (due_at !== undefined) {
    if (isNaN(new Date(due_at).getTime())) {
      return NextResponse.json({ error: 'due_at must be a valid date string' }, { status: 400 });
    }
    updates.due_at = due_at;
  }
  if (status === 'completed' || status === 'skipped') {
    updates.completed_at = new Date().toISOString();
  }

  try {
    await updateFollowup(id as string, updates);
    emitContextChange('followup_updated', `Follow-up ${id} ${status || 'updated'}`);

    if (status === 'completed' && conviction_delta !== undefined) {
      const searchParams = req.nextUrl.searchParams;
      const invId = (filtered.investor_id as string) || searchParams.get('investor_id');
      if (invId) {
        backfillEnthusiasmFromFollowups(invId).catch(e => { console.error('[FOLLOWUPS] backfill failed:', e instanceof Error ? e.message : e); });
      }}

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[FOLLOWUPS_PUT]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to update follow-up' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getFollowups, createFollowup, updateFollowup, getPendingFollowups, getOverdueFollowups, backfillEnthusiasmFromFollowups, computeOptimalFollowupTiming, computeEngagementVelocity, computeNetworkCascades } from '@/lib/db';
import type { FollowupActionType, FollowupStatus } from '@/lib/types';
import { emitContextChange } from '@/lib/context-bus';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as FollowupStatus | null;
    const investor_id = searchParams.get('investor_id');
    const meeting_id = searchParams.get('meeting_id');
    const view = searchParams.get('view');

    if (view === 'overdue') {
      const overdue = await getOverdueFollowups();
      return NextResponse.json(overdue);
    }

    if (view === 'pending') {
      const pending = await getPendingFollowups();
      return NextResponse.json(pending);
    }

    if (view === 'intelligence') {
      const filters: { status?: FollowupStatus; investor_id?: string; meeting_id?: string } = {};
      if (status) filters.status = status;
      if (investor_id) filters.investor_id = investor_id;
      if (meeting_id) filters.meeting_id = meeting_id;

      const [followups, velocities, cascades] = await Promise.all([
        getFollowups(Object.keys(filters).length > 0 ? filters : undefined),
        computeEngagementVelocity().catch(() => []),
        computeNetworkCascades().catch(() => []),
      ]);

      const uniqueInvestorIds = [...new Set(followups.map(f => f.investor_id))];
      const timingResults = await Promise.all(
        uniqueInvestorIds.map(id =>
          computeOptimalFollowupTiming(id)
            .then(timing => ({ investorId: id, ...timing }))
            .catch(() => ({ investorId: id, optimalDayOfWeek: 'Tuesday', optimalTimeOfDay: '10:00 AM', reasoning: 'Default — insufficient data.' }))
        )
      );
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
          }
        }
      }

      const enriched = followups.map(f => ({
        ...f,
        timing: timingMap[f.investor_id] || null,
        velocity: velocityMap[f.investor_id] || null,
        cascade: cascadeMap[f.investor_id] || null,
      }));

      return NextResponse.json(enriched);
    }

    const filters: { status?: FollowupStatus; investor_id?: string; meeting_id?: string } = {};
    if (status) filters.status = status;
    if (investor_id) filters.investor_id = investor_id;
    if (meeting_id) filters.meeting_id = meeting_id;

    const followups = await getFollowups(Object.keys(filters).length > 0 ? filters : undefined);
    return NextResponse.json(followups);
  } catch (error) {
    console.error('GET /api/followups failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch follow-ups', detail: error instanceof Error ? error.message : 'Database error' },
      { status: 500 }
    );
  }
}

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

  const followup = await createFollowup({
    meeting_id,
    investor_id,
    investor_name: investor_name || '',
    action_type: action_type as FollowupActionType,
    description,
    due_at,
  });

  emitContextChange('followup_created', `Follow-up for ${investor_name || investor_id}: ${action_type}`);
  return NextResponse.json(followup, { status: 201 });
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { id, status, outcome, conviction_delta } = body as {
    id: string; status: string; outcome: string; conviction_delta: number;
  };

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const updates: { status?: FollowupStatus; outcome?: string; conviction_delta?: number; completed_at?: string } = {};
  if (status) updates.status = status as FollowupStatus;
  if (outcome !== undefined) updates.outcome = outcome as string;
  if (conviction_delta !== undefined) updates.conviction_delta = conviction_delta as number;
  if (status === 'completed' || status === 'skipped') {
    updates.completed_at = new Date().toISOString();
  }

  await updateFollowup(id as string, updates);
  emitContextChange('followup_updated', `Follow-up ${id} ${status || 'updated'}`);

  if (status === 'completed' && conviction_delta !== undefined) {
    const { searchParams } = new URL(req.url);
    const invId = (body.investor_id as string) || searchParams.get('investor_id');
    if (invId) {
      backfillEnthusiasmFromFollowups(invId).catch(() => {/* non-blocking */});
    }
  }

  return NextResponse.json({ ok: true });
}

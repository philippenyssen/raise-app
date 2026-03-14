import { NextRequest, NextResponse } from 'next/server';
import { getFollowups, createFollowup, updateFollowup, getPendingFollowups, getOverdueFollowups } from '@/lib/db';
import type { FollowupActionType, FollowupStatus } from '@/lib/types';
import { emitContextChange } from '@/lib/context-bus';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as FollowupStatus | null;
  const investor_id = searchParams.get('investor_id');
  const meeting_id = searchParams.get('meeting_id');
  const view = searchParams.get('view'); // 'pending' | 'overdue' | 'all'

  if (view === 'overdue') {
    const overdue = await getOverdueFollowups();
    return NextResponse.json(overdue);
  }

  if (view === 'pending') {
    const pending = await getPendingFollowups();
    return NextResponse.json(pending);
  }

  const filters: { status?: FollowupStatus; investor_id?: string; meeting_id?: string } = {};
  if (status) filters.status = status;
  if (investor_id) filters.investor_id = investor_id;
  if (meeting_id) filters.meeting_id = meeting_id;

  const followups = await getFollowups(Object.keys(filters).length > 0 ? filters : undefined);
  return NextResponse.json(followups);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { meeting_id, investor_id, investor_name, action_type, description, due_at } = body;

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
  const body = await req.json();
  const { id, status, outcome, conviction_delta } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const updates: { status?: FollowupStatus; outcome?: string; conviction_delta?: number; completed_at?: string } = {};
  if (status) updates.status = status as FollowupStatus;
  if (outcome !== undefined) updates.outcome = outcome;
  if (conviction_delta !== undefined) updates.conviction_delta = conviction_delta;
  if (status === 'completed' || status === 'skipped') {
    updates.completed_at = new Date().toISOString();
  }

  await updateFollowup(id, updates);
  emitContextChange('followup_updated', `Follow-up ${id} ${status || 'updated'}`);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getMeetingActions, updateTask, updateDocumentFlag, deleteTask } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const actions = await getMeetingActions(id);
  if (!actions) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }
  return NextResponse.json(actions, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } });
}

// Accept or dismiss individual actions
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // consume the params
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { action_type, action_id, operation } = body as {
    action_type: string; action_id: string; operation: string;
  };

  if (!action_type || !action_id || !operation) {
    return NextResponse.json({ error: 'action_type, action_id, and operation required' }, { status: 400 });
  }

  try {
    if (action_type === 'task') {
      if (operation === 'dismiss') {
        await deleteTask(action_id);
      } else if (operation === 'accept') {
        await updateTask(action_id, { status: 'in_progress' });
      }
      emitContextChange('task_updated', `Task ${action_id} ${operation}ed`);
    } else if (action_type === 'document_flag') {
      if (operation === 'dismiss') {
        await updateDocumentFlag(action_id, { status: 'dismissed' });
      } else if (operation === 'accept') {
        await updateDocumentFlag(action_id, { status: 'open' });
      }
      emitContextChange('document_flag_updated', `Document flag ${action_id} ${operation}ed`);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[MEETING_ACTIONS_PUT]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to update action' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getMeetingActions, updateTask, updateDocumentFlag, deleteTask } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const actions = await getMeetingActions(id);
  if (!actions) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }
  return NextResponse.json(actions);
}

// Accept or dismiss individual actions
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // consume the params
  const body = await req.json();
  const { action_type, action_id, operation } = body;

  // action_type: 'task' | 'document_flag'
  // operation: 'accept' | 'dismiss'

  if (!action_type || !action_id || !operation) {
    return NextResponse.json({ error: 'action_type, action_id, and operation required' }, { status: 400 });
  }

  if (action_type === 'task') {
    if (operation === 'dismiss') {
      await deleteTask(action_id);
    } else if (operation === 'accept') {
      await updateTask(action_id, { status: 'in_progress' });
    }
  } else if (action_type === 'document_flag') {
    if (operation === 'dismiss') {
      await updateDocumentFlag(action_id, { status: 'dismissed' });
    } else if (operation === 'accept') {
      await updateDocumentFlag(action_id, { status: 'open' }); // confirm it stays open
    }
  }

  return NextResponse.json({ ok: true });
}

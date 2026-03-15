import { NextRequest, NextResponse } from 'next/server';
import { getAllTasks, createTask, updateTask, deleteTask, getUpcomingTasks, getActivityLog, logActivity, getDocumentFlags, updateDocumentFlag, createFollowup, getFollowups, updateFollowup } from '@/lib/db';
import { emitContextChange } from '@/lib/context-bus';
import type { TaskStatus, TaskPriority, RaisePhase } from '@/lib/types';

const ALLOWED_TASK_FIELDS = new Set([
  'title', 'description', 'assignee', 'due_date', 'status', 'priority',
  'phase', 'investor_id', 'investor_name',
]);

export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type');

    if (type === 'upcoming') {
      const limit = parseInt(req.nextUrl.searchParams.get('limit') || '5');
      return NextResponse.json(await getUpcomingTasks(limit));
    }

    if (type === 'activity') {
      const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');
      const investorId = req.nextUrl.searchParams.get('investor_id') || undefined;
      return NextResponse.json(await getActivityLog(limit, investorId));
    }

    const filters: { status?: string; phase?: string; investor_id?: string } = {};
    const status = req.nextUrl.searchParams.get('status');
    const phase = req.nextUrl.searchParams.get('phase');
    const investorId = req.nextUrl.searchParams.get('investor_id');
    if (status) filters.status = status;
    if (phase) filters.phase = phase;
    if (investorId) filters.investor_id = investorId;

    return NextResponse.json(await getAllTasks(Object.keys(filters).length > 0 ? filters : undefined));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  try {
    if (body.action === 'log_activity') {
      await logActivity(body.data as Parameters<typeof logActivity>[0]);
      return NextResponse.json({ ok: true });
    }

    const task = await createTask({
      title: (body.title as string) || '',
      description: (body.description as string) || '',
      assignee: (body.assignee as string) || '',
      due_date: (body.due_date as string) || '',
      status: ((body.status as string) || 'pending') as TaskStatus,
      priority: ((body.priority as string) || 'medium') as TaskPriority,
      phase: ((body.phase as string) || 'preparation') as RaisePhase,
      investor_id: (body.investor_id as string) || '',
      investor_name: (body.investor_name as string) || '',
      auto_generated: (body.auto_generated as boolean) || false,
    });

    emitContextChange('task_created', `Task: ${body.title || 'untitled'}`);
    return NextResponse.json(task);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  try {
    const id = body.id as string;
    const { id: _id, ...raw } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Filter to allowed fields
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (ALLOWED_TASK_FIELDS.has(k)) updates[k] = v;
    }

    await updateTask(id, updates);

    // Log completion + cascade downstream effects
    if (updates.status === 'done') {
      const investorId = (raw.investor_id as string) || '';
      const investorName = (raw.investor_name as string) || '';

      await logActivity({
        event_type: 'task_completed',
        subject: (raw.title as string) || 'Task completed',
        detail: '',
        investor_id: investorId,
        investor_name: investorName,
      });

      // --- WIRE: Task Done → Document Flags + Follow-ups ---
      if (investorId) {
        // Auto-resolve related document flags for this investor
        try {
          const flags = await getDocumentFlags({ investor_id: investorId, status: 'open' });
          const taskTitle = ((raw.title as string) || '').toLowerCase();
          for (const flag of flags) {
            // If task title mentions the flag type or section, mark it addressed
            const flagDesc = (flag.description || '').toLowerCase();
            const flagSection = (flag.section_hint || '').toLowerCase();
            if (
              taskTitle.includes('material') || taskTitle.includes('dd') ||
              taskTitle.includes('document') || taskTitle.includes('deck') ||
              taskTitle.includes(flagSection) || flagDesc.includes('prepare')
            ) {
              await updateDocumentFlag(flag.id, { status: 'addressed' });
            }
          }
        } catch { /* non-blocking */ }

        // Auto-trigger data_share follow-up if task was about preparing materials
        try {
          const taskTitle = ((raw.title as string) || '').toLowerCase();
          if (
            taskTitle.includes('prepare') || taskTitle.includes('material') ||
            taskTitle.includes('dd') || taskTitle.includes('data room') ||
            taskTitle.includes('deck') || taskTitle.includes('model')
          ) {
            const dueAt = new Date();
            dueAt.setHours(dueAt.getHours() + 4);
            await createFollowup({
              meeting_id: '',
              investor_id: investorId,
              investor_name: investorName,
              action_type: 'data_share',
              description: `Materials ready: "${raw.title}". Send to investor and confirm receipt.`,
              due_at: dueAt.toISOString(),
            });
          }
        } catch { /* non-blocking */ }

        // Auto-complete follow-ups that were waiting for this task
        try {
          const followups = await getFollowups({ investor_id: investorId, status: 'pending' });
          for (const fu of followups) {
            const fuDesc = (fu.description || '').toLowerCase();
            const taskTitle = ((raw.title as string) || '').toLowerCase();
            if (fu.action_type === 'data_share' && (fuDesc.includes('prepare') || fuDesc.includes(taskTitle.substring(0, 20)))) {
              await updateFollowup(fu.id, {
                status: 'completed',
                outcome: `Auto-completed: task "${raw.title}" marked done`,
                conviction_delta: 0,
              });
            }
          }
        } catch { /* non-blocking */ }
      }
    }

    emitContextChange('task_updated', `Task ${id} ${updates.status === 'done' ? 'completed' : 'updated'}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    await deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

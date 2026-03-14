import { NextRequest, NextResponse } from 'next/server';
import { getAllTasks, createTask, updateTask, deleteTask, getUpcomingTasks, getActivityLog, logActivity } from '@/lib/db';

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
  try {
    const body = await req.json();

    if (body.action === 'log_activity') {
      await logActivity(body.data);
      return NextResponse.json({ ok: true });
    }

    const task = await createTask({
      title: body.title || '',
      description: body.description || '',
      assignee: body.assignee || '',
      due_date: body.due_date || '',
      status: body.status || 'pending',
      priority: body.priority || 'medium',
      phase: body.phase || 'preparation',
      investor_id: body.investor_id || '',
      investor_name: body.investor_name || '',
      auto_generated: body.auto_generated || false,
    });

    return NextResponse.json(task);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...raw } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Filter to allowed fields
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (ALLOWED_TASK_FIELDS.has(k)) updates[k] = v;
    }

    await updateTask(id, updates);

    // Log completion
    if (updates.status === 'done') {
      await logActivity({
        event_type: 'task_completed',
        subject: raw.title || 'Task completed',
        detail: '',
        investor_id: raw.investor_id || '',
        investor_name: raw.investor_name || '',
      });
    }

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

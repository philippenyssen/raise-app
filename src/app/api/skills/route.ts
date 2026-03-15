import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const skillName = req.nextUrl.searchParams.get('skill');
    const view = req.nextUrl.searchParams.get('view') ?? 'health';

    if (view === 'health') {
      const metrics = await db.getSkillHealthMetrics();
      return NextResponse.json(metrics);
    }

    if (view === 'executions') {
      const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50');
      const executions = await db.getSkillExecutions(skillName ?? undefined, limit);
      return NextResponse.json(executions);
    }

    return NextResponse.json({ error: 'Invalid view parameter. Use "health" or "executions".' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to fetch skill data' }, { status: 500 });
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
    if (!body.skill_name || !body.outcome) {
      return NextResponse.json({ error: 'skill_name and outcome are required' }, { status: 400 });
    }
    await db.logSkillExecution(body as Parameters<typeof db.logSkillExecution>[0]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to log skill execution' }, { status: 500 });
  }
}

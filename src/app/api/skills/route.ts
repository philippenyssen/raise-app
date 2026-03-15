import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const skillName = req.nextUrl.searchParams.get('skill');
    const view = req.nextUrl.searchParams.get('view') ?? 'health';

    if (view === 'health') {
      const metrics = await db.getSkillHealthMetrics();
      return NextResponse.json(metrics, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
    }

    if (view === 'executions') {
      const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10) || 50, 1), 500);
      const executions = await db.getSkillExecutions(skillName ?? undefined, limit);
      return NextResponse.json(executions);
    }

    return NextResponse.json({ error: 'Invalid view parameter. Use "health" or "executions".' }, { status: 400 });
  } catch (err) {
    console.error('[SKILLS_GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to fetch skill data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  const textLimits: Record<string, number> = { skill_name: 255, outcome: 100, trigger: 255, failure_reason: 1000 };
  for (const [field, max] of Object.entries(textLimits)) {
    if (body[field] && typeof body[field] === 'string' && (body[field] as string).length > max) {
      return NextResponse.json({ error: `${field} exceeds maximum length of ${max} characters` }, { status: 400 });
    }
  }
  try {
    if (!body.skill_name || !body.outcome) {
      return NextResponse.json({ error: 'skill_name and outcome are required' }, { status: 400 });
    }
    await db.logSkillExecution(body as Parameters<typeof db.logSkillExecution>[0]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[SKILLS_POST]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to log skill execution' }, { status: 500 });
  }
}

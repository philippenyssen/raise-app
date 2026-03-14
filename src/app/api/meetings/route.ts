import { NextRequest, NextResponse } from 'next/server';
import { getMeetings, createMeeting, updateMeeting, updateInvestor, generatePostMeetingTasks, logActivity } from '@/lib/db';
import { analyzeMeetingNotes } from '@/lib/ai';
import type { Investor } from '@/lib/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const investorId = searchParams.get('investor_id') ?? undefined;
  const meetings = await getMeetings(investorId);
  return NextResponse.json(meetings);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { raw_notes, investor_id, investor_name, date, type, attendees, duration_minutes, analyze } = body;

  let aiData = {};
  if (analyze && raw_notes) {
    try {
      aiData = await analyzeMeetingNotes(raw_notes, investor_name, type || 'intro');
    } catch (err) {
      console.error('AI analysis failed:', err);
    }
  }

  const meeting = await createMeeting({
    investor_id,
    investor_name,
    date: date || new Date().toISOString().split('T')[0],
    type: type || 'intro',
    attendees: attendees || '',
    duration_minutes: duration_minutes || 60,
    raw_notes: raw_notes || '',
    questions_asked: JSON.stringify((aiData as Record<string, unknown>).questions_asked || []),
    objections: JSON.stringify((aiData as Record<string, unknown>).objections || []),
    engagement_signals: JSON.stringify((aiData as Record<string, unknown>).engagement_signals || {}),
    competitive_intel: (aiData as Record<string, string>).competitive_intel || '',
    next_steps: (aiData as Record<string, string>).next_steps || '',
    enthusiasm_score: (aiData as Record<string, number>).enthusiasm_score || 3,
    status_after: (aiData as Record<string, string>).suggested_status || 'met',
    ai_analysis: (aiData as Record<string, string>).ai_analysis || '',
  });

  // Update investor status and enthusiasm
  const suggestedStatus = (aiData as Record<string, string>).suggested_status;
  if (suggestedStatus) {
    await updateInvestor(investor_id, {
      status: suggestedStatus as Investor['status'],
      enthusiasm: (aiData as Record<string, number>).enthusiasm_score || 3,
    });
  }

  // Auto-generate follow-up tasks
  try {
    await generatePostMeetingTasks(meeting, suggestedStatus || 'met');
  } catch { /* non-blocking */ }

  // Log activity
  try {
    await logActivity({
      event_type: 'meeting_logged',
      subject: `${type || 'Meeting'} with ${investor_name}`,
      detail: (aiData as Record<string, string>).ai_analysis || '',
      investor_id,
      investor_name,
    });
  } catch { /* non-blocking */ }

  return NextResponse.json(meeting, { status: 201 });
}

const ALLOWED_MEETING_FIELDS = new Set([
  'date', 'type', 'attendees', 'duration_minutes', 'raw_notes',
  'questions_asked', 'objections', 'engagement_signals', 'competitive_intel',
  'next_steps', 'enthusiasm_score', 'status_after', 'ai_analysis',
]);

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, ...rawUpdates } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const updates: Record<string, unknown> = {};
  for (const key of Object.keys(rawUpdates)) {
    if (ALLOWED_MEETING_FIELDS.has(key)) updates[key] = rawUpdates[key];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no valid fields to update' }, { status: 400 });
  }
  await updateMeeting(id, updates);
  return NextResponse.json({ ok: true });
}

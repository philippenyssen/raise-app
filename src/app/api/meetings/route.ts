import { NextRequest, NextResponse } from 'next/server';
import { getMeetings, createMeeting, updateMeeting, getInvestor, processPostMeetingIntelligence, logActivity, createObjectionRecord, updateObjectionEnthusiasmDelta, generateFollowupChoreography } from '@/lib/db';
import { analyzeMeetingNotes } from '@/lib/ai';
import { emitContextChange } from '@/lib/context-bus';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const investorId = searchParams.get('investor_id') ?? undefined;
  const meetings = await getMeetings(investorId);
  return NextResponse.json(meetings);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { raw_notes, investor_id, investor_name, date, type, attendees, duration_minutes, analyze } = body;

  let aiData: Record<string, unknown> = {};
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
    questions_asked: JSON.stringify(aiData.questions_asked || []),
    objections: JSON.stringify(aiData.objections || []),
    engagement_signals: JSON.stringify(aiData.engagement_signals || {}),
    competitive_intel: (aiData.competitive_intel as string) || '',
    next_steps: (aiData.next_steps as string) || '',
    enthusiasm_score: (aiData.enthusiasm_score as number) || 3,
    status_after: (aiData.suggested_status as string) || 'met',
    ai_analysis: (aiData.ai_analysis as string) || '',
  });

  // Run post-meeting intelligence pipeline
  let postMeetingActions = null;
  try {
    const investor = await getInvestor(investor_id);
    const investorTier = investor?.tier ?? 2;
    postMeetingActions = await processPostMeetingIntelligence(meeting, aiData, investorTier);
  } catch (err) {
    console.error('Post-meeting intelligence pipeline failed:', err);
  }

  // Log activity
  try {
    await logActivity({
      event_type: 'meeting_logged',
      subject: `${type || 'Meeting'} with ${investor_name}`,
      detail: (aiData.ai_analysis as string) || '',
      investor_id,
      investor_name,
    });
  } catch { /* non-blocking */ }

  // Generate follow-up choreography
  let followupPlan = null;
  try {
    const investor = await getInvestor(investor_id);
    const tier = investor?.tier ?? 2;
    followupPlan = await generateFollowupChoreography(meeting, aiData, tier);
  } catch (err) {
    console.error('Follow-up choreography generation failed:', err);
  }

  // Auto-populate objection_responses from extracted objections
  try {
    const objections = (aiData.objections || []) as { text: string; severity: string; topic: string }[];
    if (objections.length > 0) {
      // Check for enthusiasm delta from previous meetings with this investor
      const previousMeetings = await getMeetings(investor_id);
      // previousMeetings is sorted DESC — the first one after the current is the previous
      const prevMeeting = previousMeetings.find(m => m.id !== meeting.id);
      if (prevMeeting) {
        const delta = (meeting.enthusiasm_score || 3) - (prevMeeting.enthusiasm_score || 3);
        if (delta !== 0) {
          await updateObjectionEnthusiasmDelta(investor_id, delta);
        }
      }

      // Create new objection records for this meeting
      for (const obj of objections) {
        await createObjectionRecord({
          objection_text: obj.text,
          objection_topic: obj.topic || 'general',
          investor_id,
          investor_name,
          meeting_id: meeting.id,
        });
      }
    }
  } catch (err) {
    console.error('Objection playbook auto-population failed:', err);
  }

  emitContextChange('meeting_logged', `Meeting with ${investor_name}`);

  return NextResponse.json({
    ...meeting,
    post_meeting_actions: postMeetingActions,
    followup_plan: followupPlan,
  }, { status: 201 });
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
  emitContextChange('meeting_updated', `Meeting ${id} updated`);
  return NextResponse.json({ ok: true });
}

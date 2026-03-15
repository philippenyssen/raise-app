import { NextRequest, NextResponse } from 'next/server';
import { getMeetings, getMeeting, createMeeting, updateMeeting, getInvestor, processPostMeetingIntelligence, logActivity, createObjectionRecord, updateObjectionEnthusiasmDelta, generateFollowupChoreography, extractAndStoreQuestionPatterns } from '@/lib/db';
import { analyzeMeetingNotes } from '@/lib/ai';
import { emitContextChange } from '@/lib/context-bus';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const investorId = searchParams.get('investor_id') ?? undefined;
    const meetings = await getMeetings(investorId);
    return NextResponse.json(meetings);
  } catch (error) {
    console.error('GET /api/meetings failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meetings', detail: error instanceof Error ? error.message : 'Database error' },
      { status: 500 });
  }}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 }); }

  const { raw_notes, investor_id, investor_name, date, type, attendees, duration_minutes, analyze } = body;

  if (!investor_id || typeof investor_id !== 'string') {
    return NextResponse.json({ error: 'investor_id is required' }, { status: 400 });
  }
  if (!investor_name || typeof investor_name !== 'string') {
    return NextResponse.json({ error: 'investor_name is required' }, { status: 400 });
  }

  const validTypes = ['intro', 'deep_dive', 'dd', 'negotiation', 'social', 'follow_up'];
  if (type && !validTypes.includes(type as string)) {
    return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
  }

  if (duration_minutes !== undefined && (typeof duration_minutes !== 'number' || duration_minutes < 1)) {
    return NextResponse.json({ error: 'duration_minutes must be a positive number' }, { status: 400 });
  }

  let aiData: Record<string, unknown> = {};
  if (analyze && raw_notes) {
    try {
      aiData = await analyzeMeetingNotes(raw_notes as string, investor_name as string, (type as string) || 'intro');
    } catch (err) {
      console.error('AI analysis failed:', err);
    }}

  try {
  const meeting = await createMeeting({
    investor_id,
    investor_name,
    date: (date as string) || new Date().toISOString().split('T')[0],
    type: ((type as string) || 'intro') as import('@/lib/types').MeetingType,
    attendees: (attendees as string) || '',
    duration_minutes: (duration_minutes as number) || 60,
    raw_notes: (raw_notes as string) || '',
    questions_asked: JSON.stringify(aiData.questions_asked || []),
    objections: JSON.stringify(aiData.objections || []),
    engagement_signals: JSON.stringify(aiData.engagement_signals || {}),
    competitive_intel: (aiData.competitive_intel as string) || '',
    next_steps: (aiData.next_steps as string) || '',
    enthusiasm_score: (aiData.enthusiasm_score as number) || 3,
    status_after: (aiData.suggested_status as string) || 'met',
    ai_analysis: (aiData.ai_analysis as string) || '',});

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
      investor_name,});
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
        }}

      // Create new objection records for this meeting
      for (const obj of objections) {
        await createObjectionRecord({
          objection_text: obj.text,
          objection_topic: obj.topic || 'general',
          investor_id,
          investor_name,
          meeting_id: meeting.id,});
      }}
  } catch (err) {
    console.error('Objection playbook auto-population failed:', err);
  }

  // Extract and store question patterns for cross-investor analysis
  try {
    const investor = await getInvestor(investor_id);
    await extractAndStoreQuestionPatterns(
      meeting.id,
      investor_id,
      investor_name,
      investor?.type || 'vc',
      JSON.stringify(aiData.questions_asked || []),
      (typeof date === 'string' ? date : null) || new Date().toISOString().split('T')[0],);
  } catch { /* non-blocking */ }

  emitContextChange('meeting_logged', `Meeting with ${investor_name}`);

  const autoAdvanced = postMeetingActions?.investor_updates?.auto_advanced || null;
  return NextResponse.json({
    ...meeting,
    post_meeting_actions: postMeetingActions,
    followup_plan: followupPlan,
    auto_advanced: autoAdvanced,
  }, { status: 201 });
  } catch (error) {
    console.error('POST /api/meetings failed:', error);
    return NextResponse.json(
      { error: 'Failed to create meeting', detail: error instanceof Error ? error.message : 'Database error' },
      { status: 500 });
  }}

const ALLOWED_MEETING_FIELDS = new Set([
  'date', 'type', 'attendees', 'duration_minutes', 'raw_notes',
  'questions_asked', 'objections', 'engagement_signals', 'competitive_intel',
  'next_steps', 'enthusiasm_score', 'status_after', 'ai_analysis',
  'outcome_rating', 'objections_addressed', 'competitive_mentions',
  'key_takeaway', 'prep_usefulness',]);

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 }); }

  const { id, ...rawUpdates } = body;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id is required and must be a string' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const key of Object.keys(rawUpdates)) {
    if (ALLOWED_MEETING_FIELDS.has(key)) updates[key] = rawUpdates[key];
  }
  if (Object.keys(updates).length === 0) { return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 }); }

  try {
    await updateMeeting(id as string, updates);
    emitContextChange('meeting_updated', `Meeting ${id} updated`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PUT /api/meetings failed:', error);
    return NextResponse.json(
      { error: 'Failed to update meeting', detail: error instanceof Error ? error.message : 'Database error' },
      { status: 500 });
  }}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 }); }

  const { meeting_id, outcome_rating, objections_addressed, competitive_mentions, key_takeaway, prep_usefulness } = body;

  if (!meeting_id || typeof meeting_id !== 'string') {
    return NextResponse.json({ error: 'meeting_id is required' }, { status: 400 });
  }

  try {
    const meeting = await getMeeting(meeting_id as string);
    if (!meeting) { return NextResponse.json({ error: `Meeting ${meeting_id} not found` }, { status: 404 }); }

    const updates: Record<string, unknown> = {};
    if (outcome_rating !== undefined) updates.outcome_rating = outcome_rating;
    if (objections_addressed !== undefined) updates.objections_addressed = JSON.stringify(objections_addressed);
    if (competitive_mentions !== undefined) updates.competitive_mentions = JSON.stringify(competitive_mentions);
    if (key_takeaway !== undefined) updates.key_takeaway = key_takeaway;
    if (prep_usefulness !== undefined) updates.prep_usefulness = prep_usefulness;

    if (Object.keys(updates).length === 0) { return NextResponse.json({ error: 'No outcome fields provided' }, { status: 400 }); }

    await updateMeeting(meeting_id as string, updates);

    try {
      await logActivity({
        event_type: 'meeting_logged',
        subject: `Outcome recorded for meeting with ${meeting.investor_name}`,
        detail: (key_takeaway as string) || '',
        investor_id: meeting.investor_id,
        investor_name: meeting.investor_name,});
    } catch { /* non-blocking */ }

    emitContextChange('meeting_updated', `Meeting outcome recorded for ${meeting.investor_name}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PATCH /api/meetings failed:', error);
    return NextResponse.json(
      { error: 'Failed to update meeting outcome', detail: error instanceof Error ? error.message : 'Database error' },
      { status: 500 });
  }}

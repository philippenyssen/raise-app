import { NextRequest, NextResponse } from 'next/server';
import {
  createMeeting,
  getInvestor,
  getMeetings,
  processPostMeetingIntelligence,
  generateFollowupChoreography,
  logActivity,
  createObjectionRecord,
  updateObjectionEnthusiasmDelta,
  extractAndStoreQuestionPatterns,
} from '@/lib/db';
import { analyzeMeetingNotes } from '@/lib/ai';
import { emitContextChange } from '@/lib/context-bus';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  try {
    const {
      investorId,
      investorName,
      rawNotes,
      meetingType,
      duration,
      enthusiasm,
    } = body as {
      investorId: string; investorName: string; rawNotes: string;
      meetingType: string; duration: number; enthusiasm: number;
    };

    if (!investorId || !investorName || !rawNotes) {
      return NextResponse.json(
        { error: 'investorId, investorName, and rawNotes are required' },
        { status: 400 },);
    }

    // 1. AI extraction — infer meeting type and enthusiasm if not provided
    const inferredType = meetingType || 'intro';
    let aiData: Record<string, unknown> = {};
    try {
      aiData = await analyzeMeetingNotes(rawNotes, investorName, inferredType);
    } catch (err) {
    }

    // Apply user overrides — explicit values take precedence over AI inference
    if (meetingType) {
      aiData.inferred_meeting_type = meetingType;
    }
    if (enthusiasm) {
      aiData.enthusiasm_score = enthusiasm;
    }

    const finalType = meetingType || (aiData.inferred_meeting_type as string) || 'intro';
    const finalEnthusiasm = enthusiasm || (aiData.enthusiasm_score as number) || 3;
    const finalStatus = (aiData.suggested_status as string) || 'met';

    // 2. Create meeting record
    const meeting = await createMeeting({
      investor_id: investorId,
      investor_name: investorName,
      date: new Date().toISOString().split('T')[0],
      type: finalType as 'intro' | 'management_presentation' | 'deep_dive' | 'site_visit' | 'dd_session' | 'negotiation' | 'social',
      attendees: '',
      duration_minutes: duration || 60,
      raw_notes: rawNotes,
      questions_asked: JSON.stringify(aiData.questions_asked || []),
      objections: JSON.stringify(aiData.objections || []),
      engagement_signals: JSON.stringify(aiData.engagement_signals || {}),
      competitive_intel: (aiData.competitive_intel as string) || '',
      next_steps: (aiData.next_steps as string) || '',
      enthusiasm_score: finalEnthusiasm,
      status_after: finalStatus,
      ai_analysis: (aiData.ai_analysis as string) || '',});

    // 3. Run post-meeting intelligence pipeline (non-blocking failures)
    let intelligenceSummary = '';
    try {
      const investor = await getInvestor(investorId);
      const investorTier = investor?.tier ?? 2;
      const actions = await processPostMeetingIntelligence(meeting, aiData, investorTier);
      const taskCount = actions.tasks?.length || 0;
      const flagCount = actions.document_flags?.length || 0;
      intelligenceSummary = `Created ${taskCount} task${taskCount !== 1 ? 's' : ''}, flagged ${flagCount} document update${flagCount !== 1 ? 's' : ''}`;
      if (actions.investor_updates?.suggested_status) {
        intelligenceSummary += `, suggested status: ${actions.investor_updates.suggested_status}`;
      }
    } catch (err) {
      intelligenceSummary = 'Intelligence pipeline failed — tasks not generated';
    }

    // 4. Generate follow-up choreography
    let followups: unknown[] = [];
    try {
      const investor = await getInvestor(investorId);
      const tier = investor?.tier ?? 2;
      followups = await generateFollowupChoreography(meeting, aiData, tier);
    } catch (err) {
    }

    // 5. Objection tracking + enthusiasm delta (non-blocking)
    try {
      const objections = (aiData.objections || []) as { text: string; severity: string; topic: string }[];
      if (objections.length > 0) {
        const previousMeetings = await getMeetings(investorId);
        const prevMeeting = previousMeetings.find(m => m.id !== meeting.id);
        if (prevMeeting) {
          const delta = (meeting.enthusiasm_score || 3) - (prevMeeting.enthusiasm_score || 3);
          if (delta !== 0) {
            await updateObjectionEnthusiasmDelta(investorId, delta);
          }}
        for (const obj of objections) {
          await createObjectionRecord({
            objection_text: obj.text,
            objection_topic: obj.topic || 'general',
            investor_id: investorId,
            investor_name: investorName,
            meeting_id: meeting.id,});
        }}
    } catch (err) {
    }

    // 6. Question pattern extraction (non-blocking)
    try {
      const investor = await getInvestor(investorId);
      await extractAndStoreQuestionPatterns(
        meeting.id,
        investorId,
        investorName,
        investor?.type || 'vc',
        JSON.stringify(aiData.questions_asked || []),
        new Date().toISOString().split('T')[0],);
    } catch { /* non-blocking */ }

    // 7. Activity log (non-blocking)
    try {
      await logActivity({
        event_type: 'meeting_logged',
        subject: `Quick capture: ${finalType} with ${investorName}`,
        detail: (aiData.ai_analysis as string) || '',
        investor_id: investorId,
        investor_name: investorName,});
    } catch { /* non-blocking */ }

    emitContextChange('meeting_logged', `Quick capture: meeting with ${investorName}`);

    // 8. Build extracted data response
    const questions = (aiData.questions_asked || []) as { text: string }[];
    const extractedObjections = (aiData.objections || []) as { text: string }[];
    const signals = aiData.engagement_signals as Record<string, unknown> | undefined;
    const signalsSummary = signals
      ? [
          signals.asked_about_process && 'asked about process',
          signals.asked_about_timeline && 'asked about timeline',
          signals.requested_followup && 'requested follow-up',
          signals.mentioned_competitors && 'mentioned competitors',
          signals.pricing_reception && `pricing: ${signals.pricing_reception}`,
        ].filter(Boolean).join(', ') || 'No strong signals detected'
      : 'No signals extracted';

    return NextResponse.json({
      meeting,
      extracted: {
        questions: questions.map(q => q.text || String(q)),
        objections: extractedObjections.map(o => o.text || String(o)),
        signals: signalsSummary,
        competitiveIntel: (aiData.competitive_intel as string) || '',
        nextSteps: (aiData.next_steps as string) || '',
        suggestedStatusUpdate: finalStatus !== 'met' ? finalStatus : null,},
      followups,
      intelligence: intelligenceSummary,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: 'Quick capture failed' },
      { status: 500 },);
  }}

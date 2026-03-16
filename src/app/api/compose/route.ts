import { NextRequest, NextResponse } from 'next/server';
import { getAIClient, AI_MODEL } from '@/lib/ai';
import { getAllInvestors, getMeetings, getFollowups, getObjectionsByInvestor, getRaiseConfig } from '@/lib/db';

const STAGE_CONTEXT: Record<string, { goal: string; tone: string }> = {
  identified: { goal: 'Introduce yourself and establish relevance', tone: 'warm and professional, create curiosity' },
  contacted: { goal: 'Follow up on initial contact, secure a meeting', tone: 'persistent but not pushy, reference shared context' },
  nda_signed: { goal: 'Share materials and propose meeting time', tone: 'confident and organized, show preparedness' },
  meeting_scheduled: { goal: 'Confirm meeting and set expectations', tone: 'efficient, share agenda items' },
  met: { goal: 'Follow up on meeting, share materials, address questions', tone: 'responsive and thorough, reference specific discussion points' },
  engaged: { goal: 'Deepen engagement, address objections, push toward DD', tone: 'consultative, address concerns directly' },
  in_dd: { goal: 'Support DD process, respond to requests, maintain momentum', tone: 'proactive and transparent, anticipate questions' },
  term_sheet: { goal: 'Negotiate terms, push for signed term sheet', tone: 'professional and decisive, create urgency without pressure' },
};

export async function POST(req: NextRequest) {
  try {
    const { investorId, messageType } = await req.json();
    if (!investorId) {
      return NextResponse.json({ error: 'investorId required' }, { status: 400 });
    }

    const [allInvestors, allMeetings, allFollowups, config] = await Promise.all([
      getAllInvestors(),
      getMeetings(investorId),
      getFollowups({ investor_id: investorId }),
      getRaiseConfig(),
    ]);

    const investor = allInvestors.find(i => i.id === investorId);
    if (!investor) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 });
    }

    let objections: { objection_text: string; objection_topic: string; effectiveness: string }[] = [];
    try { objections = await getObjectionsByInvestor(investorId); } catch { /* empty */ }

    const stageCtx = STAGE_CONTEXT[investor.status] ?? STAGE_CONTEXT.contacted;
    const sortedMeetings = [...allMeetings].sort((a, b) => b.date.localeCompare(a.date));
    const lastMeeting = sortedMeetings[0];
    const pendingFollowups = allFollowups.filter(f => f.status === 'pending');
    const unresolvedObjections = objections.filter(o =>
      o.effectiveness !== 'effective' && o.effectiveness !== 'partially_effective'
    );

    const type = messageType || 'follow_up';
    const companyName = config?.company_name || 'our company';

    const systemPrompt = `You are a fundraise communication advisor for ${companyName} raising a Series C. Write professional investor communications that are:
- Concise (under 200 words)
- Specific to the investor's context
- Stage-appropriate
- Never salesy or desperate
- Always providing value or moving the process forward

Return JSON: { "subject": "email subject line", "body": "email body text", "tone": "one-word tone descriptor", "callToAction": "what you're asking for" }`;

    const userPrompt = `Write a ${type.replace(/_/g, ' ')} message for ${investor.name}.

INVESTOR CONTEXT:
- Type: ${investor.type}
- Tier: ${investor.tier} (1=highest priority)
- Current stage: ${investor.status.replace(/_/g, ' ')}
- Enthusiasm: ${investor.enthusiasm}/5
- Stage goal: ${stageCtx.goal}
- Desired tone: ${stageCtx.tone}

${lastMeeting ? `LAST MEETING (${lastMeeting.date}):
- Type: ${lastMeeting.type.replace(/_/g, ' ')}
- Duration: ${lastMeeting.duration_minutes}min
${lastMeeting.ai_analysis ? `- Summary: ${lastMeeting.ai_analysis.slice(0, 300)}` : ''}` : 'No meetings yet.'}

${pendingFollowups.length > 0 ? `PENDING FOLLOW-UPS:
${pendingFollowups.slice(0, 3).map(f => `- ${f.action_type.replace(/_/g, ' ')}: ${f.description}`).join('\n')}` : ''}

${unresolvedObjections.length > 0 ? `OPEN OBJECTIONS:
${unresolvedObjections.slice(0, 3).map(o => `- [${o.objection_topic}] ${o.objection_text}`).join('\n')}` : ''}

${type === 'meeting_request' ? 'Goal: Secure a meeting. Propose 2-3 time windows.' : ''}
${type === 'follow_up' ? 'Goal: Follow up after last interaction. Reference specific discussion points.' : ''}
${type === 'materials_share' ? 'Goal: Share relevant materials. Explain what you\'re sharing and why.' : ''}
${type === 'objection_response' ? 'Goal: Address the top open objection with data and confidence.' : ''}
${type === 'status_update' ? 'Goal: Share a meaningful company milestone or progress update.' : ''}`;

    const client = getAIClient();
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    let parsed: { subject: string; body: string; tone: string; callToAction: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { subject: `Follow-up: ${investor.name}`, body: text, tone: 'professional', callToAction: 'Reply to continue the conversation' };
    }

    return NextResponse.json({
      draft: parsed,
      investorName: investor.name,
      stage: investor.status,
      messageType: type,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[COMPOSE_POST]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 });
  }
}

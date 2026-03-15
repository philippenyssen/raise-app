import { NextRequest, NextResponse } from 'next/server';
import {
  getInvestor,
  getMeetings,
  getObjectionPlaybook,
  getObjectionsByInvestor,
  getAllDocuments,
  getRaiseConfig,
  getInvestorPartners,
  getInvestorPortfolio,
  getIntelligenceBriefs,
  getQuestionPatternsForType,
  getProvenResponsesForTopics,
  getAggregatedCompetitiveIntel,
  getInvestorRelationships,
  getScoreSnapshots,
  computeRaiseForecast,
  computeEngagementVelocity,
  detectFomoDynamics,
  computeNetworkCascades,
  computeWinLossPatterns,
} from '@/lib/db';
import { getAIClient, AI_MODEL } from '@/lib/ai';
import { checkRateLimit, parseJsonSafe } from '@/lib/api-helpers';
import { computeAdvancedTrajectory } from '@/lib/scoring';
import { getNarrativeProfile, getAnticipatedQuestions } from '@/lib/investor-narratives';
import type { InvestorType, Objection } from '@/lib/types';

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  return raw ? parseJsonSafe(raw, fallback) : fallback;
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit('meeting-brief')) { return NextResponse.json({ error: 'Too many requests' }, { status: 429 }); }
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 }); }

  try {
    const investor_id = body.investor_id as string;
    if (!investor_id) { return NextResponse.json({ error: 'investor_id is required' }, { status: 400 }); }

    // 1. Load investor profile
    const investor = await getInvestor(investor_id);
    if (!investor) { return NextResponse.json({ error: 'Investor not found' }, { status: 404 }); }

    // 2. Get narrative profile for this investor type
    const narrative = getNarrativeProfile(investor.type as InvestorType);

    // 3. Load all contextual data in parallel (including cross-investor intelligence)
    const [
      meetings,
      ,
      playbook,
      documents,
      raiseConfig,
      partners,
      portfolio,
      briefs,
      typeQuestionPatterns,
      aggregatedCompetitiveIntel,
      investorRelationships,
    ] = await Promise.all([
      getMeetings(investor_id),
      getObjectionsByInvestor(investor_id),
      getObjectionPlaybook(),
      getAllDocuments(),
      getRaiseConfig(),
      getInvestorPartners(investor_id),
      getInvestorPortfolio(investor_id),
      getIntelligenceBriefs(undefined, investor_id),
      getQuestionPatternsForType(investor.type),
      getAggregatedCompetitiveIntel(),
      getInvestorRelationships(investor_id).catch(() => []),]);

    // 3b. Compute conviction trajectory for this investor (cycle 11)
    let trajectoryContext = '';
    try {
      const snapshots = await getScoreSnapshots(investor_id);
      if (snapshots.length >= 3) {
        const trajectory = computeAdvancedTrajectory(snapshots);
        if (trajectory.pattern === 'plateau') {
          trajectoryContext = `CONVICTION TRAJECTORY WARNING: Investor is in a plateau (${trajectory.plateauDuration} weeks flat). Score has not meaningfully changed. Consider a new value-add approach — share a milestone, new data point, or competitive signal to break the stall.`;
        } else if (trajectory.pattern === 'decelerating' || trajectory.riskLevel === 'high' || trajectory.riskLevel === 'critical') {
          trajectoryContext = `CONVICTION TRAJECTORY ALERT: Investor conviction is declining (${trajectory.velocityPerWeek > 0 ? '+' : ''}${trajectory.velocityPerWeek} pts/week, risk: ${trajectory.riskLevel}). Diagnose cause in this meeting: probe for unstated concerns, competitive alternatives, or internal politics.`;
        } else if (trajectory.pattern === 'accelerating') {
          trajectoryContext = `CONVICTION TRAJECTORY POSITIVE: Investor is accelerating (+${trajectory.velocityPerWeek} pts/week). Lean into the momentum — push for next concrete commitment (DD, term sheet, timeline).`;
        } else if (trajectory.pattern === 'inflecting') {
          trajectoryContext = `CONVICTION TRAJECTORY INFLECTION: Investor trajectory has changed direction${trajectory.inflectionDate ? ` around ${trajectory.inflectionDate}` : ''}. Pay attention to what caused the shift and adapt accordingly.`;
        }}
    } catch { /* non-blocking — trajectory is supplementary */ }

    // 3c. Compute forecast context for this investor (cycle 20)
    let forecastContext = '';
    try {
      const forecastData = await computeRaiseForecast();
      const investorForecast = forecastData.forecasts.find(f => f.investorId === investor_id);
      const isCriticalPath = forecastData.criticalPathInvestors.includes(investor.name);
      if (investorForecast) {
        forecastContext = `This investor is predicted to close in ~${investorForecast.predictedDaysToClose} days (${investorForecast.predictedCloseDate}), confidence: ${investorForecast.confidence}.`;
        if (isCriticalPath) {
          forecastContext += ` CRITICAL PATH: This investor is on the critical path for the entire raise. Delays here push the raise timeline. Prioritize acceleration.`;
        }
        if (investorForecast.confidence === 'low') {
          forecastContext += ` Low confidence suggests this investor needs to be pushed to the next stage to improve predictability.`;
        }
        forecastContext += ` Overall raise expected close: ${forecastData.expectedCloseDate} (${forecastData.confidence} confidence).`;
      }
    } catch { /* non-blocking */ }

    // 3d. Engagement velocity + FOMO + cascade + win/loss (cycle 35)
    let tacticalContext = '';
    try {
      const [velocities, fomos, cascades, winLoss] = await Promise.all([
        computeEngagementVelocity().catch(() => []),
        detectFomoDynamics().catch(() => []),
        computeNetworkCascades().catch(() => []),
        computeWinLossPatterns().catch(() => null),]);

      const parts: string[] = [];

      // Velocity signal for this investor
      const thisVelocity = velocities.find(v => v.investorId === investor_id);
      if (thisVelocity) {
        parts.push(`VELOCITY: ${thisVelocity.acceleration.toUpperCase()} — ${thisVelocity.signal}`);
        if (thisVelocity.daysSinceLastMeeting && thisVelocity.avgDaysBetweenMeetings && thisVelocity.daysSinceLastMeeting > thisVelocity.avgDaysBetweenMeetings * 1.5) {
          parts.push(`SILENCE RISK: ${thisVelocity.daysSinceLastMeeting}d since last meeting (avg: ${thisVelocity.avgDaysBetweenMeetings}d). Push to lock next meeting before this one ends.`);
        }}

      // FOMO pressure on this investor
      const fomoForThis = fomos.find(f => f.affectedInvestors.some(a => a.name === investor.name));
      if (fomoForThis) {
        parts.push(`COMPETITIVE LEVER: ${fomoForThis.advancingInvestor} just moved to ${fomoForThis.advancingTo} (intensity: ${fomoForThis.fomoIntensity}). Use this as leverage — signal process momentum without naming names.`);
      }

      // Network cascade dependency
      const cascadeAffecting = cascades.find(c => c.cascadeChain.some(ch => ch.investorId === investor_id));
      if (cascadeAffecting) {
        const thisLink = cascadeAffecting.cascadeChain.find(ch => ch.investorId === investor_id);
        parts.push(`NETWORK LINK: If ${cascadeAffecting.keystoneName} closes, this investor's close probability rises to ${Math.round((thisLink?.probability || 0) * 100)}%. Mention the broader syndicate forming.`);
      }

      // Win/loss pattern match
      if (winLoss && winLoss.distinguishingFactors.length > 0) {
        const highSig = winLoss.distinguishingFactors.filter(f => f.significance === 'high');
        if (highSig.length > 0) {
          parts.push(`WIN PREDICTORS: Key factors that distinguish closers from passers: ${highSig.map(f => `${f.factor} (closed avg: ${f.closedAvg}, passed avg: ${f.passedAvg})`).join('; ')}`);
        }}

      if (parts.length > 0) {
        tacticalContext = parts.join('\n');
      }
    } catch { /* non-blocking */ }

    // 4. Extract historical questions from meetings
    const historicalQuestions: string[] = [];
    const historicalObjections: { text: string; severity: string; topic: string; addressed: boolean; response_effectiveness: string; meetingDate: string }[] = [];
    meetings.forEach(m => {
      const questions = safeJsonParse<{ text: string; topic: string }[]>(m.questions_asked, []);
      questions.forEach(q => historicalQuestions.push(q.text));
      const objs = safeJsonParse<Objection[]>(m.objections, []);
      objs.forEach(o => historicalObjections.push({
        text: o.text,
        severity: o.severity,
        topic: o.topic,
        addressed: o.addressed,
        response_effectiveness: o.response_effectiveness,
        meetingDate: m.date,
      }));});

    // 5. Get anticipated questions (merged: type-specific + historical)
    const anticipatedQuestions = getAnticipatedQuestions(
      investor.type as InvestorType,
      historicalQuestions,);

    // 6. Find best responses from the playbook for similar objections
    const relevantPlaybook = playbook
      .filter(p => narrative.emphasis.some(e =>
        e.toLowerCase().includes(p.topic) || p.topic.includes(e.toLowerCase().split(' ')[0])
      ) || p.count >= 2)
      .map(p => ({
        topic: p.topic,
        count: p.count,
        bestResponse: p.best_response?.response_text || null,
        effectiveness: p.effectiveness_distribution,
      }));

    // 6b. Fetch proven responses for the most common objection topics
    const objectionTopics = relevantPlaybook.map(p => p.topic);
    const provenResponses = await getProvenResponsesForTopics(objectionTopics);

    // 7. Previous meeting summary
    const latestMeeting = meetings[0] || null;
    const unresolvedObjections = historicalObjections.filter(o => o.response_effectiveness !== 'resolved');

    // 8. Document summaries for data room priority
    const documentsByType = new Map<string, { id: string; title: string; type: string; updated_at: string }[]>();
    documents.forEach(d => {
      if (!documentsByType.has(d.type)) documentsByType.set(d.type, []);
      documentsByType.get(d.type)!.push({ id: d.id, title: d.title, type: d.type, updated_at: d.updated_at });});

    // 9. Generate personalized brief with Claude (now with cross-investor intelligence + trajectory)
    const contextForAI = buildAIContext({
      investor,
      narrative,
      meetings,
      historicalObjections,
      unresolvedObjections,
      anticipatedQuestions,
      relevantPlaybook,
      raiseConfig,
      partners,
      portfolio,
      briefs,
      latestMeeting,
      typeQuestionPatterns,
      provenResponses,
      aggregatedCompetitiveIntel,
      investorRelationships,
      trajectoryContext,
      forecastContext,
      tacticalContext,});

    const response = await getAIClient().messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: contextForAI,
      }],});

    const aiSummary = response.content[0].type === 'text' ? response.content[0].text : '';

    // 10. Parse AI response
    let briefContent: {
      personalized_opening: string;
      key_talking_points: string[];
      metrics_to_highlight: { metric: string; value: string; why: string }[];
      anticipated_questions_with_answers: { question: string; suggested_answer: string }[];
      previous_meeting_summary: string | null;
      unresolved_items: string[];
      risks_to_watch: string[];
      recommended_ask: string;
    };

    const briefFallback = {
      personalized_opening: narrative.openingHook,
      key_talking_points: narrative.emphasis,
      metrics_to_highlight: narrative.keyMetrics.map(m => ({ metric: m, value: 'See model', why: 'Key for this investor type' })),
      anticipated_questions_with_answers: anticipatedQuestions.map(q => ({ question: q, suggested_answer: 'Prepare specific data point.' })),
      previous_meeting_summary: null,
      unresolved_items: [] as string[],
      risks_to_watch: [] as string[],
      recommended_ask: 'Push for next milestone in process.',};
    try {
      briefContent = JSON.parse(aiSummary);
    } catch {
      const jsonMatch = aiSummary.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { briefContent = JSON.parse(jsonMatch[0]); } catch { briefContent = briefFallback; }
      } else {
        briefContent = briefFallback;
      }}

    // 11. Assemble the full brief
    const brief = {
      investor: {
        id: investor.id,
        name: investor.name,
        type: investor.type,
        tier: investor.tier,
        status: investor.status,
        enthusiasm: investor.enthusiasm,
        partner: investor.partner,
        fund_size: investor.fund_size,
        check_size_range: investor.check_size_range,
        sector_thesis: investor.sector_thesis,},
      narrative_profile: {
        opening_hook: narrative.openingHook,
        emphasis: narrative.emphasis,
        tone_guidance: narrative.toneGuidance,
        avoid_topics: narrative.avoidTopics,},
      brief: briefContent,
      data_room_priority: narrative.dataRoomPriority.map(category => {
        const matchingDocs = documents.filter(d => {
          const catLower = category.toLowerCase();
          return d.title.toLowerCase().includes(catLower) ||
            d.type.toLowerCase().includes(catLower.split(' ')[0]);});
        return {
          category,
          documents: matchingDocs.map(d => ({ id: d.id, title: d.title, type: d.type })),};
      }),
      playbook_insights: relevantPlaybook,
      meeting_history: {
        total_meetings: meetings.length,
        latest_meeting: latestMeeting ? {
          date: latestMeeting.date,
          type: latestMeeting.type,
          enthusiasm: latestMeeting.enthusiasm_score,
          next_steps: latestMeeting.next_steps,
          ai_analysis: latestMeeting.ai_analysis,
        } : null,
        unresolved_objections: unresolvedObjections.map(o => ({
          text: o.text,
          severity: o.severity,
          topic: o.topic,
          from_date: o.meetingDate,
        })),
        enthusiasm_trajectory: meetings.map(m => ({
          date: m.date,
          score: m.enthusiasm_score,
        })).reverse(),},
      partners: partners.map(p => ({
        name: p.name,
        title: p.title,
        focus_areas: p.focus_areas,
        relevance: p.relevance_to_us,
      })),
      // Cross-investor intelligence
      cross_investor_intel: {
        type_question_patterns: typeQuestionPatterns.slice(0, 5).map(p => ({
          topic: p.topic,
          frequency: p.questionCount,
          examples: p.exampleQuestions,
        })),
        proven_responses: provenResponses.map(r => ({
          topic: r.topic,
          response: r.bestResponse,
          effectiveness: r.effectiveness,
          enthusiasm_lift: r.enthusiasmLift,
        })),
        competitive_intel_summary: aggregatedCompetitiveIntel.slice(0, 5).map(c => ({
          competitor: c.competitor,
          mention_count: c.mentionCount,
          investors_mentioning: c.investors,
          latest_context: c.context.slice(0, 2),
        })),
        network_connections: investorRelationships.slice(0, 5).map(r => ({
          related_investor: r.investor_a_id === investor_id ? r.investor_b_name : r.investor_a_name,
          relationship_type: r.relationship_type,
          their_status: r.investor_a_id === investor_id ? r.investor_b_status : r.investor_a_status,
          their_enthusiasm: r.investor_a_id === investor_id ? r.investor_b_enthusiasm : r.investor_a_enthusiasm,
        })),},
      generated_at: new Date().toISOString(),};

    return NextResponse.json(brief);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to generate meeting brief' },
      { status: 500 },);
  }}

// Build the prompt for the AI personalization step
function buildAIContext(ctx: {
  investor: { name: string; type: string; tier: number; status: string; enthusiasm: number; sector_thesis: string; partner: string; notes: string; ic_process: string };
  narrative: { openingHook: string; emphasis: string[]; keyMetrics: string[]; toneGuidance: string; avoidTopics: string[] };
  meetings: { date: string; type: string; raw_notes: string; enthusiasm_score: number; next_steps: string; ai_analysis: string }[];
  historicalObjections: { text: string; severity: string; topic: string; response_effectiveness: string; meetingDate: string }[];
  unresolvedObjections: { text: string; severity: string; topic: string; meetingDate: string }[];
  anticipatedQuestions: string[];
  relevantPlaybook: { topic: string; count: number; bestResponse: string | null }[];
  raiseConfig: { company_name: string; pre_money: string; post_money: string; equity_amount: string; debt_amount: string; one_paragraph_pitch: string; three_beliefs: string[] } | null;
  partners: { name: string; title: string; focus_areas: string; relevance_to_us: string }[];
  portfolio: { company: string; sector: string; relevance: string }[];
  briefs: { subject: string; content: string }[];
  latestMeeting: { date: string; type: string; raw_notes: string; enthusiasm_score: number; next_steps: string; ai_analysis: string } | null;
  typeQuestionPatterns?: { topic: string; questionCount: number; exampleQuestions: string[] }[];
  provenResponses?: { topic: string; bestResponse: string; effectiveness: string; enthusiasmLift: number }[];
  aggregatedCompetitiveIntel?: { competitor: string; mentionCount: number; investors: string[]; context: string[] }[];
  investorRelationships?: { investor_a_id: string; investor_b_id: string; investor_a_name?: string; investor_b_name?: string; investor_a_status?: string; investor_b_status?: string; relationship_type: string }[];
  trajectoryContext?: string;
  forecastContext?: string;
  tacticalContext?: string;
}): string {
  const meetingHistory = ctx.meetings.slice(0, 5).map(m =>
    `Date: ${m.date} | Type: ${m.type} | Enthusiasm: ${m.enthusiasm_score}/5\nAnalysis: ${m.ai_analysis}\nNext Steps: ${m.next_steps}`
  ).join('\n---\n');

  const unresolvedList = ctx.unresolvedObjections.map(o =>
    `- [${o.severity}] ${o.text} (from ${o.meetingDate})`
  ).join('\n');

  const playbookContext = ctx.relevantPlaybook.map(p =>
    `Topic: ${p.topic} (raised ${p.count}x)${p.bestResponse ? `\nBest response: ${p.bestResponse}` : ''}`
  ).join('\n');

  const portfolioContext = ctx.portfolio.map(p =>
    `- ${p.company} (${p.sector}): ${p.relevance}`
  ).join('\n');

  return `You are the world's best fundraising advisor. Generate a personalized meeting brief for the following investor meeting.

INVESTOR: ${ctx.investor.name}
TYPE: ${ctx.investor.type}
TIER: ${ctx.investor.tier}
STATUS: ${ctx.investor.status}
ENTHUSIASM: ${ctx.investor.enthusiasm}/5
KEY PARTNER: ${ctx.investor.partner || 'Unknown'}
SECTOR THESIS: ${(ctx.investor.sector_thesis || 'Not specified').substring(0, 2000)}
IC PROCESS: ${(ctx.investor.ic_process || 'Unknown').substring(0, 2000)}
NOTES: ${(ctx.investor.notes || 'None').substring(0, 5000)}

NARRATIVE PROFILE FOR ${ctx.investor.type.toUpperCase()} INVESTORS:
- Opening hook: ${ctx.narrative.openingHook}
- Emphasize: ${ctx.narrative.emphasis.join(', ')}
- Key metrics: ${ctx.narrative.keyMetrics.join(', ')}
- Tone: ${ctx.narrative.toneGuidance}
- Avoid: ${ctx.narrative.avoidTopics.join(', ')}

${ctx.raiseConfig ? `COMPANY CONTEXT:
Company: ${ctx.raiseConfig.company_name}
Pre-money: ${ctx.raiseConfig.pre_money}
Equity: ${ctx.raiseConfig.equity_amount}
Debt: ${ctx.raiseConfig.debt_amount}
Pitch: ${ctx.raiseConfig.one_paragraph_pitch}
Three Beliefs: ${ctx.raiseConfig.three_beliefs?.join(' | ') || 'Not set'}` : ''}

MEETING HISTORY (${ctx.meetings.length} meetings):
${meetingHistory || 'No previous meetings.'}

UNRESOLVED OBJECTIONS:
${unresolvedList || 'None.'}

PLAYBOOK INSIGHTS:
${playbookContext || 'No playbook data yet.'}

PORTFOLIO COMPANIES:
${portfolioContext || 'None tracked.'}

${ctx.briefs.length > 0 ? `INTELLIGENCE BRIEFS:\n${ctx.briefs.slice(0, 2).map(b => `${b.subject}: ${b.content.substring(0, 500)}`).join('\n')}` : ''}

ANTICIPATED QUESTIONS (for this investor type):
${ctx.anticipatedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

${ctx.typeQuestionPatterns && ctx.typeQuestionPatterns.length > 0 ? `CROSS-INVESTOR QUESTION PATTERNS (what ${ctx.investor.type} investors typically ask):
${ctx.typeQuestionPatterns.slice(0, 5).map(p => `- "${p.topic}" (asked ${p.questionCount}x by ${ctx.investor.type} investors): ${p.exampleQuestions.slice(0, 2).join('; ')}`).join('\n')}` : ''}

${ctx.provenResponses && ctx.provenResponses.length > 0 ? `PROVEN RESPONSES (responses that worked best in prior meetings):
${ctx.provenResponses.map(r => `- Topic "${r.topic}": ${r.bestResponse} (${r.effectiveness}, +${r.enthusiasmLift} enthusiasm)`).join('\n')}` : ''}

${ctx.aggregatedCompetitiveIntel && ctx.aggregatedCompetitiveIntel.length > 0 ? `COMPETITIVE INTEL FROM ALL MEETINGS (cross-investor synthesis):
${ctx.aggregatedCompetitiveIntel.slice(0, 5).map(c => `- ${c.competitor}: mentioned by ${c.investors.join(', ')} (${c.mentionCount}x). Latest: ${c.context[0] || 'N/A'}`).join('\n')}` : ''}

${ctx.investorRelationships && ctx.investorRelationships.length > 0 ? `NETWORK CONNECTIONS (this investor's relationships to others in pipeline):
${ctx.investorRelationships.slice(0, 5).map(r => {
  const otherName = r.investor_a_name || r.investor_b_name || 'Unknown';
  const otherStatus = r.investor_a_status || r.investor_b_status || 'unknown';
  return `- Connected to ${otherName} (${r.relationship_type}) — their status: ${otherStatus}`;
}).join('\n')}
Use these connections strategically — mention shared portfolio companies or co-investors as social proof.` : ''}

${ctx.trajectoryContext ? `CONVICTION TRAJECTORY ANALYSIS:
${ctx.trajectoryContext}
Factor this into your recommendations — if declining, focus on re-engagement; if plateaued, suggest pattern-breaking actions; if accelerating, push for commitment.` : ''}

${ctx.forecastContext ? `RAISE FORECAST CONTEXT:
${ctx.forecastContext}` : ''}

${ctx.tacticalContext ? `REAL-TIME TACTICAL INTELLIGENCE:
${ctx.tacticalContext}
Use these signals to calibrate urgency: if velocity is decelerating, push for commitment NOW. If FOMO pressure exists, mention process momentum. If a keystone is closing, frame the syndicate narrative.` : ''}

Generate a JSON meeting brief (no markdown, pure JSON):
{
  "personalized_opening": "A 2-3 sentence personalized opening hook for THIS specific investor, incorporating their thesis, history, and the narrative profile.",
  "key_talking_points": ["3-5 specific talking points tailored to this investor type and their history with us"],
  "metrics_to_highlight": [
    {"metric": "metric name", "value": "the actual value or range", "why": "why this metric matters to THIS investor"}],
  "anticipated_questions_with_answers": [
    {"question": "anticipated question", "suggested_answer": "A concise, specific suggested answer with data points. 2-3 sentences max."}
  ],
  "previous_meeting_summary": "1-2 sentence summary of where we left off (null if no previous meetings)",
  "unresolved_items": ["List of specific unresolved items from previous interactions that MUST be addressed"],
  "risks_to_watch": ["Specific risks to monitor during this meeting — body language cues, topics to avoid, potential landmines"],
  "recommended_ask": "What specific ask or next step should we push for at the end of this meeting"
}

Be specific and actionable. Reference real data from the context. Do not be generic.`;
}

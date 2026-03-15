import Anthropic from '@anthropic-ai/sdk';
import { logSkillExecution } from './db';

let _client: Anthropic | null = null;
export function getAIClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic();
  }
  return _client;
}

function logAISkill(
  skill_name: string,
  success: boolean,
  fields_expected: number,
  fields_extracted: number,
  opts?: { trigger_source?: string; input_summary?: string; latency_ms?: number },
) {
  logSkillExecution({
    skill_name,
    skill_type: 'product_ai',
    ...(opts?.trigger_source && { trigger_source: opts.trigger_source }),
    ...(opts?.input_summary && { input_summary: opts.input_summary }),
    outcome: success ? 'success' : 'partial',
    parse_success: success,
    fields_extracted,
    fields_expected,
    ...(opts?.latency_ms !== undefined && { latency_ms: opts.latency_ms }),
  }).catch(() => {});
}

/** Extract text from AI response, flagging truncation */
function extractText(response: { content: { type: string; text?: string }[]; stop_reason: string | null }): { text: string; truncated: boolean } {
  const text = response.content[0]?.type === 'text' ? (response.content[0] as { text: string }).text : '';
  const truncated = response.stop_reason === 'max_tokens';
  return { text, truncated };
}

function safeParseJSON<T>(text: string, fallback: T): { parsed: T; success: boolean } {
  try {
    return { parsed: JSON.parse(text), success: true };
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return { parsed: JSON.parse(jsonMatch[0]), success: true }; } catch { /* fall through */ }
    }
    return { parsed: fallback, success: false };
  }}

export async function analyzeMeetingNotes(rawNotes: string, investorName: string, meetingType: string): Promise<{
  questions_asked: { text: string; topic: string }[];
  objections: { text: string; severity: string; topic: string }[];
  engagement_signals: {
    enthusiasm: number;
    asked_about_process: boolean;
    asked_about_timeline: boolean;
    requested_followup: boolean;
    mentioned_competitors: boolean;
    pricing_reception: string;
    slides_that_landed: string[];
    slides_that_fell_flat: string[];
    check_size_mentioned: string;
    ic_process_details: string;
    co_investors_referenced: string[];
    portfolio_conflicts_surfaced: string[];
    competitive_bids_mentioned: string[];
    followup_commitments: string[];
    specific_concerns: string[];
    body_language_at_pricing: string;
  };
  competitive_intel: string;
  next_steps: string;
  enthusiasm_score: number;
  ai_analysis: string;
  suggested_status: string;
}> {
  if (rawNotes.trim().length < 30) {
    return {
      questions_asked: [],
      objections: [],
      engagement_signals: {
        enthusiasm: 3, asked_about_process: false, asked_about_timeline: false,
        requested_followup: false, mentioned_competitors: false, pricing_reception: 'not_discussed',
        slides_that_landed: [], slides_that_fell_flat: [], check_size_mentioned: '',
        ic_process_details: '', co_investors_referenced: [], portfolio_conflicts_surfaced: [],
        competitive_bids_mentioned: [], followup_commitments: [], specific_concerns: [],
        body_language_at_pricing: 'not_discussed',},
      competitive_intel: '',
      next_steps: '',
      enthusiasm_score: 3,
      ai_analysis: 'Notes too brief for meaningful analysis. Add more detail about what was discussed, questions asked, and signals observed.',
      suggested_status: 'met',};
  }

  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0,
    system: 'You are a fundraise intelligence AI. Return only valid JSON. No markdown code blocks, no explanations outside the JSON structure.',
    messages: [{
      role: 'user',
      content: `Analyze these meeting notes from a Series C fundraise meeting.

INVESTOR: ${investorName}
MEETING TYPE: ${meetingType}

RAW NOTES:
${rawNotes}

Extract structured data in this exact JSON format (no markdown, just pure JSON):
{
  "questions_asked": [{"text": "question text", "topic": "valuation|market|team|competition|risk|financial|technical|process"}],
  "objections": [{"text": "objection text", "severity": "showstopper|significant|minor", "topic": "valuation|execution|market|competition|team|timing|structure"}],
  "engagement_signals": {
    "enthusiasm": 3,
    "asked_about_process": false,
    "asked_about_timeline": false,
    "requested_followup": false,
    "mentioned_competitors": false,
    "pricing_reception": "positive|neutral|negative|not_discussed",
    "slides_that_landed": ["slide/topic descriptions that clearly resonated"],
    "slides_that_fell_flat": ["slide/topic descriptions that got poor reception or confusion"],
    "check_size_mentioned": "exact quote or amount if they mentioned their check size or allocation, empty string if not discussed",
    "ic_process_details": "any details shared about their IC process — number of votes needed, timeline, who else needs to approve, committee schedule",
    "co_investors_referenced": ["names of other investors they mentioned — whether positively or negatively"],
    "portfolio_conflicts_surfaced": ["any portfolio companies they mentioned that could conflict with our deal"],
    "competitive_bids_mentioned": ["any competing deals or term sheets they referenced seeing from other companies"],
    "followup_commitments": ["specific commitments made — e.g. 'will send DD list by Friday', 'scheduling call with CTO next week'"],
    "specific_concerns": ["distinct concerns raised that are not objections but need addressing — e.g. 'wanted clarity on FX exposure', 'asked about board composition post-close'"],
    "body_language_at_pricing": "positive|neutral|negative|not_discussed"
  },
  "competitive_intel": "Any intelligence gathered about competitors, market, other investors. Include: other deals they are looking at, market sentiment they shared, intel about other funds' activity in the sector.",
  "next_steps": "Clear next steps from both sides, with owners and deadlines if mentioned",
  "enthusiasm_score": 3,
  "ai_analysis": "2-3 sentence analysis of the meeting quality and investor interest level. Be direct and honest. Note what's missing from the notes that would be valuable to capture.",
  "suggested_status": "met|engaged|in_dd|passed"
}

Enthusiasm scale: 1=Cold/polite 2=Lukewarm 3=Interested 4=Excited 5=Ready to term sheet

Be rigorous. Don't infer enthusiasm that isn't there. If notes are sparse, flag what's missing. Empty arrays and empty strings are preferred over fabricated data.`
    }]});

  const { text } = extractText(response);
  const fallback = {
    questions_asked: [] as { text: string; topic: string }[],
    objections: [] as { text: string; severity: string; topic: string }[],
    engagement_signals: { enthusiasm: 3, asked_about_process: false, asked_about_timeline: false, requested_followup: false, mentioned_competitors: false, pricing_reception: 'not_discussed', slides_that_landed: [] as string[], slides_that_fell_flat: [] as string[], check_size_mentioned: '', ic_process_details: '', co_investors_referenced: [] as string[], portfolio_conflicts_surfaced: [] as string[], competitive_bids_mentioned: [] as string[], followup_commitments: [] as string[], specific_concerns: [] as string[], body_language_at_pricing: 'not_discussed' },
    competitive_intel: '', next_steps: '', enthusiasm_score: 3,
    ai_analysis: 'Could not parse meeting notes. Please add more detail.', suggested_status: 'met',};
  const expectedFields = 10;
  const { parsed, success } = safeParseJSON(text, fallback);
  if (success) {
    if (typeof parsed.enthusiasm_score === 'number') {
      parsed.enthusiasm_score = Math.max(1, Math.min(5, Math.round(parsed.enthusiasm_score)));
    }
    if (!Array.isArray(parsed.questions_asked)) parsed.questions_asked = [];
    if (!Array.isArray(parsed.objections)) parsed.objections = [];
    if (typeof parsed.engagement_signals !== 'object' || parsed.engagement_signals === null) {
      parsed.engagement_signals = fallback.engagement_signals;
    }}
  const extractedFields = success
    ? Object.values(parsed).filter(v => v !== '' && v !== null && (Array.isArray(v) ? v.length > 0 : true)).length
    : 0;
  logAISkill('analyze_meeting_notes', success, expectedFields, extractedFields, { trigger_source: 'api', input_summary: `${investorName} / ${meetingType} / ${rawNotes.length} chars`, latency_ms: 0 });
  return parsed;
}

export async function analyzePatterns(meetings: { raw_notes: string; objections: string; engagement_signals: string; investor_name: string; enthusiasm_score: number; date: string }[]): Promise<{
  top_objections: { text: string; count: number; unique_or_repeated: string; recommendation: string }[];
  story_effectiveness: { landing: string[]; failing: string[]; exciting: string[] };
  investor_velocity: { investor: string; trajectory: string; evidence: string; action: string }[];
  pricing_trend: string;
  material_changes: { change: string; priority: string; rationale: string }[];
  overall_assessment: string;
  convergence_signals: string[];
}> {
  const meetingSummaries = meetings.map(m => {
    let objs: { text: string }[] = [];
    try { objs = JSON.parse(m.objections || '[]'); } catch { /* use default */ }
    let signals: unknown = {};
    try { signals = JSON.parse(m.engagement_signals || '{}'); } catch { /* use default */ }
    return `
DATE: ${m.date} | INVESTOR: ${m.investor_name} | ENTHUSIASM: ${m.enthusiasm_score}/5
OBJECTIONS: ${objs.map((o) => o.text).join('; ') || 'None recorded'}
SIGNALS: ${JSON.stringify(signals)}
NOTES: ${m.raw_notes.substring(0, 500)}`;
  }).join('\n---\n');

  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0,
    system: 'You are a fundraise intelligence AI. Return only valid JSON. No markdown code blocks, no explanations outside the JSON structure.',
    messages: [{
      role: 'user',
      content: `Combining the expertise of Gregg Lemkau (Goldman Sachs), Marc Andreessen (a16z), and Travis Kalanick (process mastery), analyze these ${meetings.length} investor meetings from a Series C fundraise and identify patterns:

${meetingSummaries}

Return JSON (no markdown):
{
  "top_objections": [{"text": "objection pattern", "count": 1, "unique_or_repeated": "unique|repeated", "recommendation": "how to address this in materials — be specific about what to change or add"}],
  "story_effectiveness": {
    "landing": ["specific parts of the story that consistently resonate — quote actual topics/slides if possible"],
    "failing": ["specific parts that consistently fall flat, confuse, or generate skepticism"],
    "exciting": ["parts that generate visible excitement — the 'lean forward' moments"]
  },
  "investor_velocity": [{"investor": "investor name", "trajectory": "accelerating|steady|stalling|cooling", "evidence": "specific behavioral evidence", "action": "what to do about it"}],
  "pricing_trend": "Is pricing reception improving, stable, or worsening? Brief assessment with evidence.",
  "material_changes": [{"change": "specific change to make — page/slide/section and exact revision", "priority": "critical|high|medium|low", "rationale": "pattern-based evidence from meetings"}],
  "overall_assessment": "2-3 sentence honest assessment of process health. Be direct — would Gregg Lemkau be worried or confident? What is the single biggest risk to closing?",
  "convergence_signals": ["signs that the story/process is converging toward term sheets — be specific about which investors are closest"]
}`
    }]});

  const { text } = extractText(response);
  const patternsFallback = { top_objections: [] as { text: string; count: number; unique_or_repeated: string; recommendation: string }[], story_effectiveness: { landing: [] as string[], failing: [] as string[], exciting: [] as string[] }, investor_velocity: [] as { investor: string; trajectory: string; evidence: string; action: string }[], pricing_trend: 'Not enough data', material_changes: [] as { change: string; priority: string; rationale: string }[], overall_assessment: 'Need more meetings to identify patterns.', convergence_signals: [] as string[] };
  const { parsed, success } = safeParseJSON(text, patternsFallback);
  logAISkill('analyze_patterns', success, 7, success ? 7 : 0, { trigger_source: 'api', input_summary: `${meetings.length} meetings` });
  return parsed;
}

export async function assessProcessHealth(funnel: Record<string, unknown>, objections: unknown[], recentMeetings: unknown[]): Promise<{
  health: string;
  diagnosis: string;
  recommendations: string[];
  risk_factors: string[];
}> {
  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    temperature: 0,
    system: 'You are a fundraise intelligence AI. Return only valid JSON. No markdown code blocks, no explanations outside the JSON structure.',
    messages: [{
      role: 'user',
      content: `Assess this Series C fundraise process health:

FUNNEL: ${JSON.stringify(funnel)}
TOP OBJECTIONS: ${JSON.stringify(objections)}
RECENT MEETINGS (last 5): ${JSON.stringify(recentMeetings)}

Return JSON (no markdown):
{
  "health": "green|yellow|red",
  "diagnosis": "What's working and what's not. Be specific and honest.",
  "recommendations": ["specific action items for the next week"],
  "risk_factors": ["things that could derail the process"]
}`
    }]});

  const { text } = extractText(response);
  const healthFallback = { health: 'yellow' as const, diagnosis: 'Insufficient data for assessment.', recommendations: ['Add more meeting data'], risk_factors: [] as string[] };
  const { parsed, success } = safeParseJSON(text, healthFallback);
  logAISkill('assess_process_health', success, 4, success ? 4 : 0);
  return parsed;
}

// Document AI Operations

export async function improveSection(section: string, instruction: string, context: string): Promise<string> {
  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0.3,
    system: 'You are a Series C fundraise advisor. Be concise, specific, and actionable. Focus on what matters for closing the deal.',
    messages: [{
      role: 'user',
      content: `Improve the following section of a Series C fundraise document in expert investment banking memo style.

INSTRUCTION: ${instruction}

SECTION TO IMPROVE:
${section}

SURROUNDING CONTEXT (for reference only, do not rewrite this):
${context.substring(0, 2000)}

Return ONLY the improved text. No explanations, no markdown code blocks, just the improved content.`
    }]});
  return extractText(response).text || section;
}

export async function checkConsistency(
  documents: { title: string; content: string }[],
  raiseConfig: { company_name: string; pre_money: string; post_money: string; equity_amount: string } | null
): Promise<{ discrepancies: { location: string; issue: string; suggestion: string }[] }> {
  const docSummaries = documents.map(d => `--- ${d.title} ---\n${d.content.substring(0, 3000)}`).join('\n\n');

  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0,
    system: 'You are a fundraise intelligence AI. Return only valid JSON. No markdown code blocks, no explanations outside the JSON structure.',
    messages: [{
      role: 'user',
      content: `As an IC-grade document reviewer, check these fundraise documents for numerical inconsistencies, contradictions, and factual discrepancies.

RAISE CONFIG: ${JSON.stringify(raiseConfig)}

DOCUMENTS:
${docSummaries}

Return JSON (no markdown):
{
  "discrepancies": [
    {"location": "Document: section or line", "issue": "what is inconsistent", "suggestion": "how to fix"}]
}

If no discrepancies found, return {"discrepancies": []}.`
    }]});

  const text = response.content[0].type === 'text' ? response.content[0].text : '{"discrepancies":[]}';
  const { parsed, success } = safeParseJSON(text, { discrepancies: [] as { location: string; issue: string; suggestion: string }[] });
  logAISkill('check_consistency', success, 1, success ? (parsed.discrepancies?.length ?? 0) : 0);
  return parsed;
}

export async function findWeakArguments(content: string): Promise<{ weaknesses: { claim: string; issue: string; suggestion: string }[] }> {
  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0,
    system: 'You are a fundraise intelligence AI. Return only valid JSON. No markdown code blocks, no explanations outside the JSON structure.',
    messages: [{
      role: 'user',
      content: `As a skeptical IC member, review this Series C investment memo. Find weak arguments, unsourced claims, circular reasoning, and unsubstantiated superlatives.

DOCUMENT:
${content.substring(0, 8000)}

Return JSON (no markdown):
{
  "weaknesses": [
    {"claim": "the claim or statement", "issue": "why it is weak", "suggestion": "how to strengthen it"}]
}

Be thorough but fair. Flag only genuinely weak arguments, not stylistic preferences.`
    }]});

  const text = response.content[0].type === 'text' ? response.content[0].text : '{"weaknesses":[]}';
  const { parsed, success } = safeParseJSON(text, { weaknesses: [] as { claim: string; issue: string; suggestion: string }[] });
  logAISkill('find_weak_arguments', success, 1, success ? (parsed.weaknesses?.length ?? 0) : 0);
  return parsed;
}

// Intelligence Research Functions

export async function researchInvestor(investorName: string, context?: string): Promise<{
  overview: string;
  fund_details: { aum: string; vintage: string; strategy: string; hq: string };
  key_partners: { name: string; title: string; focus: string; notable_deals: string }[];
  recent_investments: { company: string; round: string; amount: string; date: string; sector: string }[];
  investment_thesis: string;
  ic_process: string;
  typical_check: string;
  portfolio_in_sector: { company: string; relevance: string }[];
  fit_assessment: string;
  approach_strategy: string;
}> {
  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0,
    system: 'You are a fundraise intelligence AI. Return only valid JSON. No markdown code blocks, no explanations outside the JSON structure.',
    messages: [{
      role: 'user',
      content: `Generate a comprehensive research dossier on this investor for a Series C fundraise in the European space/defense technology sector.

INVESTOR: ${investorName}
${context ? `ADDITIONAL CONTEXT: ${context}` : ''}

OUR COMPANY: Aerospacelab — European vertically-integrated satellite manufacturer. Series C raising €250M equity + €250M debt at €2.0Bn pre-money. €4.1Bn contracted backlog (IRIS2). Revenue: €51M FY2025, projected €120M FY2026.

Generate a research dossier in this exact JSON format (no markdown, pure JSON):
{
  "overview": "2-3 sentence overview of the fund/firm",
  "fund_details": {
    "aum": "Assets under management",
    "vintage": "Current fund vintage year",
    "strategy": "Growth/late-stage/crossover/etc.",
    "hq": "Location"
  },
  "key_partners": [
    {"name": "Partner name", "title": "Managing Partner/GP/etc.", "focus": "Sector focus areas", "notable_deals": "2-3 most relevant deals"}
  ],
  "recent_investments": [
    {"company": "Company name", "round": "Series X", "amount": "$XM", "date": "2025-XX", "sector": "sector"}],
  "investment_thesis": "What this investor looks for — sectors, metrics, stage preferences, business model preferences",
  "ic_process": "How their IC works — number of partners needed, timeline, typical diligence depth",
  "typical_check": "$X-Y range for this stage",
  "portfolio_in_sector": [
    {"company": "Portfolio company in space/defense/deep tech", "relevance": "How it relates to us — conflict, synergy, or neutral"}
  ],
  "fit_assessment": "1-2 sentences on how well our company fits their mandate. Be honest — flag mismatches.",
  "approach_strategy": "Recommended approach — who to contact, what angle to lead with, what to emphasize/de-emphasize"
}

Be specific with real data where you have it. If you're uncertain about specific numbers, note it. Do NOT fabricate fund sizes or investment amounts — say "estimated" or "reported" if uncertain.`
    }]});

  const { text } = extractText(response);
  const investorFallback = { overview: 'Research could not be completed. Try providing more context.', fund_details: { aum: '', vintage: '', strategy: '', hq: '' }, key_partners: [] as { name: string; title: string; focus: string; notable_deals: string }[], recent_investments: [] as { company: string; round: string; amount: string; date: string; sector: string }[], investment_thesis: '', ic_process: '', typical_check: '', portfolio_in_sector: [] as { company: string; relevance: string }[], fit_assessment: '', approach_strategy: '' };
  const { parsed, success } = safeParseJSON(text, investorFallback);
  logAISkill('research_investor', success, 10, success ? Object.values(parsed).filter(v => v !== '' && (Array.isArray(v) ? v.length > 0 : true)).length : 0, { trigger_source: 'api', input_summary: investorName });
  return parsed;
}

export async function researchCompetitor(companyName: string, context?: string): Promise<{
  overview: string;
  financials: { revenue: string; employees: string; total_raised: string; last_round: string; last_valuation: string; key_investors: string };
  positioning: string;
  strengths: string[];
  weaknesses: string[];
  our_advantage: string;
  threat_assessment: string;
  recent_news: string[];
}> {
  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0,
    system: 'You are a fundraise intelligence AI. Return only valid JSON. No markdown code blocks, no explanations outside the JSON structure.',
    messages: [{
      role: 'user',
      content: `Research this company as a competitor to Aerospacelab (European satellite manufacturer, Series C, €51M revenue, €4.1Bn backlog).

COMPANY: ${companyName}
${context ? `CONTEXT: ${context}` : ''}

Return JSON (no markdown):
{
  "overview": "2-3 sentence company overview",
  "financials": {
    "revenue": "Latest known revenue",
    "employees": "Headcount",
    "total_raised": "Total funding raised",
    "last_round": "Most recent round details",
    "last_valuation": "Most recent valuation",
    "key_investors": "Notable investors"
  },
  "positioning": "How they position themselves vs us — products, markets, strategy",
  "strengths": ["Competitive strengths"],
  "weaknesses": ["Competitive weaknesses"],
  "our_advantage": "Where Aerospacelab has structural advantage",
  "threat_assessment": "Overall threat level and why",
  "recent_news": ["Notable recent developments"]
}

Be specific. Note uncertainty where appropriate.`
    }]});

  const { text } = extractText(response);
  const competitorFallback = { overview: '', financials: { revenue: '', employees: '', total_raised: '', last_round: '', last_valuation: '', key_investors: '' }, positioning: '', strengths: [] as string[], weaknesses: [] as string[], our_advantage: '', threat_assessment: '', recent_news: [] as string[] };
  const { parsed, success } = safeParseJSON(text, competitorFallback);
  logAISkill('research_competitor', success, 8, success ? 8 : 0, { input_summary: companyName });
  return parsed;
}

export async function researchMarketDeals(sector: string): Promise<{
  deals: { company: string; round: string; amount: string; valuation: string; lead: string; date: string; equity_story: string }[];
  trends: string[];
  valuation_context: string;
  implications_for_us: string;
}> {
  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0,
    system: 'You are a fundraise intelligence AI. Return only valid JSON. No markdown code blocks, no explanations outside the JSON structure.',
    messages: [{
      role: 'user',
      content: `As a capital markets analyst, research recent fundraising activity in this sector.

SECTOR: ${sector}
CONTEXT: We are Aerospacelab, raising Series C at €2.0Bn pre-money (€250M equity). European satellite/defense company.

Return JSON (no markdown):
{
  "deals": [
    {"company": "name", "round": "Series X", "amount": "$XM", "valuation": "$XBn", "lead": "Lead investor(s)", "date": "YYYY-MM", "equity_story": "Brief equity story / thesis"}
  ],
  "trends": ["Key market trends affecting fundraising in this sector"],
  "valuation_context": "How current valuations compare historically. Are we in an up/down cycle?",
  "implications_for_us": "What these deals mean for our fundraise — pricing, investor appetite, competition for capital"
}

Focus on 2025-2026 deals. Include space, defense tech, aerospace, satellite, and adjacent sectors. Be specific with real data.`
    }]});

  const { text } = extractText(response);
  const marketFallback = { deals: [] as { company: string; round: string; amount: string; valuation: string; lead: string; date: string; equity_story: string }[], trends: [] as string[], valuation_context: '', implications_for_us: '' };
  const { parsed, success } = safeParseJSON(text, marketFallback);
  logAISkill('research_market_deals', success, 4, success ? 4 : 0, { input_summary: sector });
  return parsed;
}

export async function generateInvestorBrief(
  investorData: {
    name: string;
    type: string;
    status: string;
    sector_thesis: string;
    check_size_range: string;
    ic_process: string;
    portfolio_conflicts: string;
    warm_path: string;
    partner: string;
    recent_deals: { company: string; round: string; amount: string; date: string; sector: string }[];
    portfolio_in_sector: { company: string; relevance: string }[];
  },
  meetingHistory: {
    date: string;
    type: string;
    enthusiasm_score: number;
    raw_notes: string;
    objections: string;
    engagement_signals: string;
    next_steps: string;
  }[],
): Promise<{
  firm_context: string;
  interaction_summary: string;
  open_objections: { objection: string; recommended_response: string; priority: string }[];
  talking_points: string[];
  risk_factors: string[];
  opportunities: string[];
  suggested_meeting_arc: string;
}> {
  const meetingSummaries = meetingHistory.map(m => {
    let objs: { text: string; severity: string }[] = [];
    try { objs = JSON.parse(m.objections || '[]'); } catch { /* use default */ }
    let signals: Record<string, unknown> = {};
    try { signals = JSON.parse(m.engagement_signals || '{}'); } catch { /* use default */ }
    return `DATE: ${m.date} | TYPE: ${m.type} | ENTHUSIASM: ${m.enthusiasm_score}/5
NOTES: ${m.raw_notes.substring(0, 600)}
OBJECTIONS: ${objs.map(o => `[${o.severity}] ${o.text}`).join('; ') || 'None'}
SIGNALS: ${JSON.stringify(signals)}
NEXT STEPS: ${m.next_steps || 'None recorded'}`;
  }).join('\n---\n');

  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0,
    system: 'You are a fundraise intelligence AI. Return only valid JSON. No markdown code blocks, no explanations outside the JSON structure.',
    messages: [{
      role: 'user',
      content: `Prepare a 1-page pre-meeting brief for a Series C fundraise.

INVESTOR PROFILE:
- Name: ${investorData.name}
- Type: ${investorData.type}
- Current Status: ${investorData.status}
- Thesis: ${investorData.sector_thesis || 'Unknown'}
- Check Size: ${investorData.check_size_range || 'Unknown'}
- IC Process: ${investorData.ic_process || 'Unknown'}
- Portfolio Conflicts: ${investorData.portfolio_conflicts || 'None known'}
- Warm Path: ${investorData.warm_path || 'None'}
- Key Partner: ${investorData.partner || 'Unknown'}
- Recent Deals: ${JSON.stringify(investorData.recent_deals?.slice(0, 5) || [])}
- Sector Portfolio: ${JSON.stringify(investorData.portfolio_in_sector?.slice(0, 5) || [])}

MEETING HISTORY (${meetingHistory.length} meetings):
${meetingSummaries || 'No prior meetings'}

OUR COMPANY: Aerospacelab — European vertically-integrated satellite manufacturer. Series C raising €250M equity + €250M debt at €2.0Bn pre-money. €4.1Bn contracted backlog (IRIS2). Revenue: €51M FY2025, projected €120M FY2026.

Generate a pre-meeting brief in this exact JSON format (no markdown, pure JSON):
{
  "firm_context": "2-3 sentences on the firm's recent activity, thesis evolution, and what they care about right now. What deals have they done recently that signal their current appetite?",
  "interaction_summary": "Concise summary of all past interactions — key takeaways, how enthusiasm has evolved, what they responded to positively vs negatively. If no meetings, note what we know about their appetite.",
  "open_objections": [
    {"objection": "the unresolved concern", "recommended_response": "specific talking point or data to address it", "priority": "must_address|should_address|monitor"}
  ],
  "talking_points": ["5-7 specific talking points tailored to this investor's thesis, concerns, and stage in process. Lead with what resonated. Address what fell flat. Include 1-2 new angles."],
  "risk_factors": ["things that could go wrong in this meeting — their known concerns, portfolio conflicts, process bottlenecks, partner dynamics"],
  "opportunities": ["openings to advance the deal — topics to steer toward, asks to make, commitment to seek"],
  "suggested_meeting_arc": "Recommended flow for the meeting: open with X, transition to Y, close with Z. Be specific about what to say and when."
}

Be direct and tactical. This brief should make the meeting 2x more productive.`
    }]});

  const { text } = extractText(response);
  const briefFallback = {
    firm_context: 'Insufficient data to generate firm context. Review investor profile manually.',
    interaction_summary: meetingHistory.length > 0
      ? `${meetingHistory.length} prior meetings. Review notes for details.`
      : 'No prior interactions recorded.',
    open_objections: [] as { objection: string; recommended_response: string; priority: string }[],
    talking_points: [] as string[],
    risk_factors: [] as string[],
    opportunities: [] as string[],
    suggested_meeting_arc: 'Standard flow: rapport, thesis alignment, business update, Q&A, next steps.',};
  const { parsed, success } = safeParseJSON(text, briefFallback);
  logAISkill('generate_investor_brief', success, 7, success ? Object.values(parsed).filter(v => v !== '' && (Array.isArray(v) ? v.length > 0 : true)).length : 0, { trigger_source: 'api', input_summary: `${investorData.name} / ${meetingHistory.length} meetings` });
  return parsed;
}

export async function polishGoldmanStyle(content: string): Promise<string> {
  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    temperature: 0.3,
    system: 'You are a Series C fundraise advisor. Be concise, specific, and actionable. Focus on what matters for closing the deal.',
    messages: [{
      role: 'user',
      content: `Rewrite this content in Goldman Sachs ECM Managing Director style — concise, authoritative investment banking memo:
- Short sentences, active voice
- Lead with the conclusion
- Numbers first, narrative second
- Remove hedging language
- Use "we believe" sparingly and only for genuine opinions
- Bold key metrics inline

CONTENT:
${content}

Return ONLY the rewritten text. No explanations.`
    }]});
  return extractText(response).text || content;
}

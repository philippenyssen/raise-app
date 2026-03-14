import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;
function getAIClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic();
  }
  return _client;
}

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
  };
  competitive_intel: string;
  next_steps: string;
  enthusiasm_score: number;
  ai_analysis: string;
  suggested_status: string;
}> {
  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are an expert fundraising process analyst. Analyze these meeting notes from a Series C fundraise meeting.

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
    "slides_that_landed": ["slide/topic descriptions"],
    "slides_that_fell_flat": ["slide/topic descriptions"]
  },
  "competitive_intel": "Any intelligence gathered about competitors, market, other investors",
  "next_steps": "Clear next steps from both sides",
  "enthusiasm_score": 3,
  "ai_analysis": "2-3 sentence analysis of the meeting quality and investor interest level. Be direct and honest.",
  "suggested_status": "met|engaged|in_dd|passed"
}

Enthusiasm scale: 1=Cold/polite 2=Lukewarm 3=Interested 4=Excited 5=Ready to term sheet

Be rigorous. Don't infer enthusiasm that isn't there. If notes are sparse, flag what's missing.`
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {
      questions_asked: [],
      objections: [],
      engagement_signals: {
        enthusiasm: 3,
        asked_about_process: false,
        asked_about_timeline: false,
        requested_followup: false,
        mentioned_competitors: false,
        pricing_reception: 'not_discussed',
        slides_that_landed: [],
        slides_that_fell_flat: [],
      },
      competitive_intel: '',
      next_steps: '',
      enthusiasm_score: 3,
      ai_analysis: 'Could not parse meeting notes. Please add more detail.',
      suggested_status: 'met',
    };
  }
}

export async function analyzePatterns(meetings: { raw_notes: string; objections: string; engagement_signals: string; investor_name: string; enthusiasm_score: number; date: string }[]): Promise<{
  top_objections: { text: string; count: number; recommendation: string }[];
  story_effectiveness: { landing: string[]; failing: string[]; exciting: string[] };
  pricing_trend: string;
  material_changes: { change: string; priority: string; rationale: string }[];
  overall_assessment: string;
  convergence_signals: string[];
}> {
  const meetingSummaries = meetings.map(m => {
    const objs = JSON.parse(m.objections || '[]');
    const signals = JSON.parse(m.engagement_signals || '{}');
    return `
DATE: ${m.date} | INVESTOR: ${m.investor_name} | ENTHUSIASM: ${m.enthusiasm_score}/5
OBJECTIONS: ${objs.map((o: { text: string }) => o.text).join('; ') || 'None recorded'}
SIGNALS: ${JSON.stringify(signals)}
NOTES: ${m.raw_notes.substring(0, 500)}`;
  }).join('\n---\n');

  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are a world-class fundraising advisor combining the expertise of Gregg Lemkau (Goldman Sachs), Marc Andreessen (a16z), and Travis Kalanick (process mastery).

Analyze these ${meetings.length} investor meetings from a Series C fundraise and identify patterns:

${meetingSummaries}

Return JSON (no markdown):
{
  "top_objections": [{"text": "objection pattern", "count": 1, "recommendation": "how to address this in materials"}],
  "story_effectiveness": {
    "landing": ["parts of the story that consistently resonate"],
    "failing": ["parts that consistently fall flat or confuse"],
    "exciting": ["parts that generate visible excitement"]
  },
  "pricing_trend": "Is pricing reception improving, stable, or worsening? Brief assessment.",
  "material_changes": [{"change": "specific change to make", "priority": "critical|high|medium|low", "rationale": "why based on pattern data"}],
  "overall_assessment": "2-3 sentence honest assessment of process health. Be direct — would Gregg Lemkau be worried or confident?",
  "convergence_signals": ["signs that the story/process is converging toward term sheets"]
}`
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return {
      top_objections: [],
      story_effectiveness: { landing: [], failing: [], exciting: [] },
      pricing_trend: 'Not enough data',
      material_changes: [],
      overall_assessment: 'Need more meetings to identify patterns.',
      convergence_signals: [],
    };
  }
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
    messages: [{
      role: 'user',
      content: `You are a fundraise process health monitor. Assess this Series C process:

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
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return { health: 'yellow', diagnosis: 'Insufficient data for assessment.', recommendations: ['Add more meeting data'], risk_factors: [] };
  }
}

// Document AI Operations

export async function improveSection(section: string, instruction: string, context: string): Promise<string> {
  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are an expert investment banking memo writer. Improve the following section of a Series C fundraise document.

INSTRUCTION: ${instruction}

SECTION TO IMPROVE:
${section}

SURROUNDING CONTEXT (for reference only, do not rewrite this):
${context.substring(0, 2000)}

Return ONLY the improved text. No explanations, no markdown code blocks, just the improved content.`
    }]
  });
  return response.content[0].type === 'text' ? response.content[0].text : section;
}

export async function checkConsistency(
  documents: { title: string; content: string }[],
  raiseConfig: { company_name: string; pre_money: string; post_money: string; equity_amount: string } | null
): Promise<{ discrepancies: { location: string; issue: string; suggestion: string }[] }> {
  const docSummaries = documents.map(d => `--- ${d.title} ---\n${d.content.substring(0, 3000)}`).join('\n\n');

  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are an IC-grade document reviewer. Check these fundraise documents for numerical inconsistencies, contradictions, and factual discrepancies.

RAISE CONFIG: ${JSON.stringify(raiseConfig)}

DOCUMENTS:
${docSummaries}

Return JSON (no markdown):
{
  "discrepancies": [
    {"location": "Document: section or line", "issue": "what is inconsistent", "suggestion": "how to fix"}
  ]
}

If no discrepancies found, return {"discrepancies": []}.`
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{"discrepancies":[]}';
  try { return JSON.parse(text); } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return { discrepancies: [] };
  }
}

export async function findWeakArguments(content: string): Promise<{ weaknesses: { claim: string; issue: string; suggestion: string }[] }> {
  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are a skeptical IC member reviewing a Series C investment memo. Find weak arguments, unsourced claims, circular reasoning, and unsubstantiated superlatives.

DOCUMENT:
${content.substring(0, 8000)}

Return JSON (no markdown):
{
  "weaknesses": [
    {"claim": "the claim or statement", "issue": "why it is weak", "suggestion": "how to strengthen it"}
  ]
}

Be thorough but fair. Flag only genuinely weak arguments, not stylistic preferences.`
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{"weaknesses":[]}';
  try { return JSON.parse(text); } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return { weaknesses: [] };
  }
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
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: `You are a world-class fundraising intelligence analyst. Generate a comprehensive research dossier on this investor for a Series C fundraise in the European space/defense technology sector.

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
    {"company": "Company name", "round": "Series X", "amount": "$XM", "date": "2025-XX", "sector": "sector"}
  ],
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
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return {
      overview: 'Research could not be completed. Try providing more context.',
      fund_details: { aum: '', vintage: '', strategy: '', hq: '' },
      key_partners: [],
      recent_investments: [],
      investment_thesis: '',
      ic_process: '',
      typical_check: '',
      portfolio_in_sector: [],
      fit_assessment: '',
      approach_strategy: '',
    };
  }
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
    messages: [{
      role: 'user',
      content: `You are a competitive intelligence analyst. Research this company as a competitor to Aerospacelab (European satellite manufacturer, Series C, €51M revenue, €4.1Bn backlog).

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
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try { return JSON.parse(text); } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return { overview: '', financials: { revenue: '', employees: '', total_raised: '', last_round: '', last_valuation: '', key_investors: '' }, positioning: '', strengths: [], weaknesses: [], our_advantage: '', threat_assessment: '', recent_news: [] };
  }
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
    messages: [{
      role: 'user',
      content: `You are a capital markets analyst. Research recent fundraising activity in this sector.

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
    }]
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try { return JSON.parse(text); } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return { deals: [], trends: [], valuation_context: '', implications_for_us: '' };
  }
}

export async function polishGoldmanStyle(content: string): Promise<string> {
  const response = await getAIClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are a Goldman Sachs ECM Managing Director. Rewrite this content in concise, authoritative investment banking memo style:
- Short sentences, active voice
- Lead with the conclusion
- Numbers first, narrative second
- Remove hedging language
- Use "we believe" sparingly and only for genuine opinions
- Bold key metrics inline

CONTENT:
${content}

Return ONLY the rewritten text. No explanations.`
    }]
  });
  return response.content[0].type === 'text' ? response.content[0].text : content;
}

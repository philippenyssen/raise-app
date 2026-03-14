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

import { AI_MODEL, getAIClient } from './ai';

interface GenerateContext {
  dataRoomContext: string;
  raiseConfig: string;
  existingDocs: { title: string; type: string; content: string }[];
}

const DELIVERABLE_PROMPTS: Record<string, { system: string; instruction: string }> = {
  teaser: {
    system: `You are a Goldman Sachs ECM Managing Director writing a Series C fundraise teaser. You combine concise investment banking prose with compelling venture-stage storytelling.`,
    instruction: `Write a 2-3 page TEASER for this Series C fundraise. Structure:

1. **Cover**: Company name, one-line description, round details (pre-money, raise amount, lead)
2. **The Opportunity**: 2-3 paragraphs on why this company, why now
3. **Key Metrics Table**: Revenue, growth rate, backlog, cash position, team size
4. **Market**: TAM/SAM/SOM with sources
5. **Why Now**: 3-5 bullet points on timing catalysts
6. **Returns**: Bear/Base/Bull MOIC table
7. **Process**: Timeline, next steps, contact

Style: Short sentences. Active voice. Numbers first. No hedging. Bold key metrics. Every claim must be traceable to the data room.`,
  },

  exec_summary: {
    system: `You are a senior VC partner writing a 1-page executive summary for your IC. You need to convey enough information for a go/no-go decision in under 2 minutes of reading.`,
    instruction: `Write a 1-PAGE EXECUTIVE SUMMARY. Must fit on one page when printed. Structure:

1. **Deal Header**: Company, round, valuation, raise, lead investor (if known)
2. **The Pitch** (1 sentence): What + why + so what
3. **Three Beliefs**: 3 testable assertions that drive the investment thesis. For each: if true → MOIC, if false → MOIC
4. **Key Numbers** (table): Revenue, growth, backlog, cash, burn, runway
5. **Why Now** (3 bullets): Timing catalysts
6. **Key Risks** (3 bullets): Honest, specific
7. **Returns** (table): Bear/Base/Bull — Revenue at exit, MOIC, IRR

Absolute maximum 400 words. Every word must earn its place.`,},

  memo: {
    system: `You are an IC-grade investment memo writer at a top-10 global VC fund. Your memos are known for being rigorous, honest, and decision-enabling. You write for skeptical IC members who have seen thousands of deals.`,
    instruction: `Write a ~6 PAGE INVESTMENT MEMORANDUM. Structure:

1. **Executive Summary** (half page): What, why, how much, expected returns
2. **Three Beliefs**: The 3 testable assertions. If-true/if-false MOIC for each
3. **Company Overview**: Business description, key metrics, competitive position
4. **Market Opportunity**: TAM/SAM/SOM with sources, secular tailwinds, regulatory
5. **Business Model**: Revenue streams, unit economics, customer concentration
6. **Financial Performance**: Historical + projections, revenue bridge, P&L summary
7. **Team**: Founders, key hires, board composition
8. **Use of Proceeds**: How the capital will be deployed
9. **Risk Factors**: Honest, specific, quantified where possible
10. **Valuation**: Comparable companies, SOTP, return scenarios (Bear/Base/Bull)

Every number must be sourced from the data room. Flag assumptions that are not verifiable. Be direct — no hedging language.`,},

  dd_memo: {
    system: `You are a senior associate at a leading growth equity fund writing a comprehensive confirmatory due diligence memorandum. This document must be thorough enough to support a $100M+ investment decision and survive LP scrutiny.`,
    instruction: `Write a COMPREHENSIVE DUE DILIGENCE MEMORANDUM (50+ pages equivalent). This is the long-form document. Structure:

1. **Executive Summary & Recommendation** (2 pages)
2. **Three Beliefs Framework** with detailed evidence for each
3. **Company Deep-Dive**: History, founding story, evolution, current state
4. **Market Analysis**: TAM/SAM/SOM waterfall, competitive landscape map, regulatory environment, secular trends
5. **Business Model Deep-Dive**: Revenue by segment, unit economics per product, customer lifetime value, churn/expansion, pricing power analysis
6. **Financial Analysis**: 5-year historical + 5-year projections, revenue bridge (bottom-up), margin evolution, cash flow analysis, working capital dynamics, capex plan
7. **Technology & IP**: Product architecture, tech stack, patents, moats, technical risks
8. **Team Assessment**: Founder track record, key person risk, organizational design, talent pipeline, comp benchmarks
9. **Competitive Intelligence**: Detailed competitor profiles, win/loss analysis, sustainable advantages
10. **Customer Analysis**: Top 10 customers, concentration risk, reference check findings, expansion patterns
11. **Risk Matrix**: 15+ risks with probability, impact, mitigation
12. **Valuation**: DCF, comparable companies (detailed), precedent transactions, SOTP, scenario analysis
13. **Returns Waterfall**: Entry → exit with dilution, preferences, participation
14. **ESG & Compliance**: Environmental, social, governance assessment
15. **Appendices**: Org chart, cap table, key contracts summary, patent list

Be exhaustive. Use tables extensively. Cross-reference data room sources. Flag gaps in the data room that need to be filled.`,},

  deck: {
    system: `You are creating a management presentation deck for a Series C fundraise. This is a 30-50 slide equivalent document in markdown format. Each section represents a slide or slide group.`,
    instruction: `Write a MANAGEMENT PRESENTATION DECK (30-50 slides in markdown). Each ## heading is a slide. Structure:

OPENING (slides 1-3):
- Cover slide: Company name, tagline, round details
- The Pitch: One sentence + 3 key metrics
- Three Beliefs

COMPANY (slides 4-8):
- Company overview
- Key milestones timeline
- Product portfolio
- Technology differentiation
- Team

MARKET (slides 9-13):
- Market size (TAM/SAM/SOM)
- Market dynamics & tailwinds
- Competitive landscape
- Regulatory environment
- Why now

BUSINESS (slides 14-20):
- Business model
- Revenue streams breakdown
- Unit economics
- Customer case studies
- Revenue bridge (bottom-up)
- Growth trajectory

FINANCIALS (slides 21-28):
- Historical financials
- Revenue projections
- P&L summary
- Cash flow
- Use of proceeds
- Return scenarios (Bear/Base/Bull)

INVESTMENT (slides 29-35):
- Valuation context (comps)
- Why this price
- Cap table
- Governance
- Risk factors (honest)
- Process & timeline

Use tables, bullet points, and bold metrics. Each slide should have 4-6 key points maximum. Include speaker notes as blockquotes below each slide.`,
  },};

export async function generateDeliverable(
  type: string,
  context: GenerateContext
): Promise<string> {
  const prompt = DELIVERABLE_PROMPTS[type];
  if (!prompt) throw new Error(`Unknown deliverable type: ${type}`);

  // Build context from existing docs
  const existingContext = context.existingDocs
    .map(d => `--- ${d.title} (${d.type}) ---\n${d.content.substring(0, 3000)}`)
    .join('\n\n');

  const response = await getAIClient().messages.create({
    model: AI_MODEL,
    max_tokens: 16384,
    temperature: 0,
    system: prompt.system,
    messages: [{
      role: 'user',
      content: `${prompt.instruction}

RAISE CONFIGURATION:
${context.raiseConfig}

DATA ROOM (source materials — use these as the primary source of truth):
${context.dataRoomContext.substring(0, 30000)}

${existingContext ? `EXISTING DOCUMENTS (for cross-reference and consistency):
${existingContext}` : ''}

Generate the document now. Use markdown formatting. Every claim must be traceable to the data room context provided. If data is missing, use [PLACEHOLDER: describe what's needed] markers.`,
    }],});

  if (response.stop_reason === 'max_tokens') console.error('[GENERATE_DOC] Response truncated — output may be incomplete');
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

export async function generateDeckAsSlides(
  context: GenerateContext
): Promise<string> {
  const response = await getAIClient().messages.create({
    model: AI_MODEL,
    max_tokens: 16384,
    temperature: 0,
    system: `You are a McKinsey partner creating a Series C fundraise management presentation. Output slides as a JSON array. Each slide has: id (UUID string), layout ("title"|"title_content"|"section"|"two_column"|"blank"), and elements array. Each element has: id (UUID), type ("title"|"subtitle"|"body"|"bullet"|"number"), content (string), x (% from left, 5-10), y (% from top), width (% width, 80-90), fontSize (optional, e.g. "2.5em" for titles, "1em" for body).

For bullet elements, use newlines to separate items. For number elements, use a key metric value like "€734M" or "4.3x".`,
    messages: [{
      role: 'user',
      content: `Create a 15-20 slide management presentation for this Series C fundraise.

SLIDE STRUCTURE:
1. Title slide: Company name + tagline + round details
2. The Pitch: One sentence + 3 key metrics
3. Three Beliefs: 3 testable assertions
4-5. Company overview + milestones
6-7. Product + technology differentiation
8-9. Market size + dynamics
10-11. Business model + revenue streams
12-13. Financial performance + projections
14. Use of proceeds
15-16. Returns scenario (Bear/Base/Bull)
17. Team
18. Risk factors
19. Why now + timeline
20. Process & contact

DATA ROOM:
${context.dataRoomContext.substring(0, 25000)}

RAISE CONFIG:
${context.raiseConfig}

Return ONLY a valid JSON array of slide objects. No markdown, no explanation.`,
    }],
  });

  if (response.stop_reason === 'max_tokens') console.error('[GENERATE_DECK] Response truncated');
  const text = response.content[0].type === 'text' ? response.content[0].text : '[]';

  // Extract JSON from response
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.stringify(JSON.parse(match[0]), null, 2); } catch { /* fall through */ }
    }
    return '[]';
  }
}

export async function generateSpreadsheetDoc(
  context: GenerateContext
): Promise<string> {
  const cells = await generateModelFromContext(context);
  return JSON.stringify(cells, null, 2);
}

export async function generateModelFromContext(
  context: GenerateContext
): Promise<Record<string, Record<string, { v: string | number; f?: string; t?: 's' | 'n'; bold?: boolean; bg?: string }>>> {
  const response = await getAIClient().messages.create({
    model: AI_MODEL,
    max_tokens: 8192,
    temperature: 0,
    system: `You are a top-tier financial modeler at Goldman Sachs. You build bottom-up financial models for Series C fundraises. Every number must be derived from unit economics (units × price × probability). You output cell data as JSON.`,
    messages: [{
      role: 'user',
      content: `Build the ASSUMPTIONS sheet for a Series C financial model based on this data:

DATA ROOM:
${context.dataRoomContext.substring(0, 20000)}

RAISE CONFIG:
${context.raiseConfig}

Return a JSON object where:
- Keys are cell references (e.g., "A1", "B3")
- Values are objects with: v (value), f (formula string if applicable), t ('s' for string, 'n' for number), bold (boolean), bg (CSS class like 'bg-zinc-800')

Include rows for:
- Revenue segments with units × price × probability
- Cost assumptions (COGS %, R&D %, SG&A %)
- Growth rates
- Valuation assumptions (pre-money, raise, post-money)
- Key operating metrics

Years: 2024A through 2030E (columns B through H).
Row labels in column A.

Return ONLY valid JSON, no markdown.`,
    }],});

  if (response.stop_reason === 'max_tokens') console.error('[GENERATE_MODEL] Response truncated — JSON may be incomplete');
  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    return {};
  }}

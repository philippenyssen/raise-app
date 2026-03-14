import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAllDocuments } from '@/lib/db';
import { getFullContext, contextToSystemPrompt } from '@/lib/context-bus';
import type { FullContext } from '@/lib/context-bus';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

// Budget for other-docs snippets in the system prompt
const OTHER_DOCS_BUDGET = 8000;

// ---------------------------------------------------------------------------
// In-memory context cache with TTL
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 30_000; // 30 seconds

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

const contextCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = contextCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    contextCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCached<T>(key: string, value: T): void {
  contextCache.set(key, { value, timestamp: Date.now() });
}

/** Fetch-or-cache a value produced by an async factory. */
async function cachedFetch<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const hit = getCached<T>(key);
  if (hit !== null) return hit;
  const value = await factory();
  setCached(key, value);
  return value;
}

/** Simple FNV-1a-inspired hash of a string → hex. Used for the context_hash header. */
function quickHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

// ---------------------------------------------------------------------------
// Query intent detection + context steering (cycle 15)
// ---------------------------------------------------------------------------

interface QueryIntent {
  type: 'investor_specific' | 'strategy' | 'document' | 'objection' | 'general';
  investorName?: string;
  investorId?: string;
}

function detectQueryIntent(
  messages: Array<{ role: string; content: string }>,
  ctx: FullContext,
): QueryIntent {
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content?.toLowerCase() || '';

  // Check for investor-specific queries (match investor names)
  for (const inv of ctx.investors) {
    const nameLower = inv.name.toLowerCase();
    // Match full name or significant portion (3+ chars)
    if (nameLower.length >= 3 && lastUserMsg.includes(nameLower)) {
      return { type: 'investor_specific', investorName: inv.name, investorId: inv.id };
    }
  }

  // Objection/pitch queries
  const objectionKeywords = ['objection', 'pushback', 'concern', 'question they', 'they asked', 'respond to', 'handle', 'counter'];
  if (objectionKeywords.some(kw => lastUserMsg.includes(kw))) {
    return { type: 'objection' };
  }

  // Strategy/overview queries
  const strategyKeywords = ['strategy', 'next steps', 'what should', 'how are we', 'pipeline', 'progress', 'recommend', 'priority', 'priorities', 'focus', 'momentum', 'trajectory', 'health', 'where do we stand'];
  if (strategyKeywords.some(kw => lastUserMsg.includes(kw))) {
    return { type: 'strategy' };
  }

  // Document queries
  const docKeywords = ['document', 'rewrite', 'improve', 'draft', 'edit', 'memo', 'pitch', 'deck', 'strengthen', 'section'];
  if (docKeywords.some(kw => lastUserMsg.includes(kw))) {
    return { type: 'document' };
  }

  return { type: 'general' };
}

/**
 * Build a dynamic focus instruction that steers the AI's attention to
 * the most relevant context sections for this specific query.
 */
function buildQueryFocus(
  intent: QueryIntent,
  ctx: FullContext,
): string {
  const lines: string[] = [];

  if (intent.type === 'investor_specific' && intent.investorName) {
    const inv = ctx.investors.find(i => i.name === intent.investorName);
    if (inv) {
      lines.push(`QUERY FOCUS: The user is asking about ${inv.name}. Here is deep context for this investor:`);
      lines.push(`- Status: ${inv.status} | Tier: ${inv.tier} | Enthusiasm: ${inv.enthusiasm}/5 | Partner: ${inv.partner || 'unknown'}`);
      lines.push(`- Meetings: ${inv.meetingCount}${inv.lastMeetingDate ? ` | Last meeting: ${inv.lastMeetingDate}` : ''}`);
      if (inv.unresolvedObjections.length > 0) {
        lines.push(`- Unresolved objections: ${inv.unresolvedObjections.join('; ')}`);
      }
      if (inv.pendingTasks > 0) lines.push(`- ${inv.pendingTasks} pending tasks`);
      if (inv.pendingFollowups > 0) lines.push(`- ${inv.pendingFollowups} pending follow-ups`);

      // Check compound signals involving this investor
      const relevantSignals = ctx.compoundSignals.filter(cs =>
        cs.signal.toLowerCase().includes(inv.name.toLowerCase())
      );
      if (relevantSignals.length > 0) {
        lines.push(`- COMPOUND SIGNALS: ${relevantSignals.map(s => s.signal).join('; ')}`);
      }

      // Check if this is a keystone investor
      const keystone = ctx.keystoneInvestors.find(k => k.id === inv.id);
      if (keystone) {
        lines.push(`- KEYSTONE: Connected to ${keystone.connectionCount} other investors (cascade: ${keystone.cascadeValue})`);
      }

      // Check narrative effectiveness for this investor type
      const typeDrift = ctx.narrativeDrift.find(nd => nd.investorType === inv.type);
      if (typeDrift) {
        lines.push(`- Narrative effectiveness for ${inv.type} type: ${typeDrift.status} (avg enthusiasm: ${typeDrift.avgEnthusiasm}/5, conversion: ${typeDrift.conversionRate}%)`);
      }

      lines.push(`Prioritize this investor's data in the KEY INVESTORS section. Use their specific objection history, trajectory, and meeting patterns to give targeted advice.`);
    }
  } else if (intent.type === 'strategy') {
    lines.push(`QUERY FOCUS: The user is asking about strategic priorities. Pay special attention to:`);
    if (ctx.temporalTrends) {
      const declining = ctx.temporalTrends.trends.filter(t => t.direction === 'declining');
      const improving = ctx.temporalTrends.trends.filter(t => t.direction === 'improving');
      if (declining.length > 0) lines.push(`- DECLINING TRENDS: ${declining.map(t => `${t.metric} (${t.delta7d}%)`).join(', ')}`);
      if (improving.length > 0) lines.push(`- IMPROVING TRENDS: ${improving.map(t => `${t.metric} (+${t.delta7d}%)`).join(', ')}`);
    }
    if (ctx.compoundSignals.length > 0) {
      lines.push(`- COMPOUND SIGNALS requiring attention: ${ctx.compoundSignals.length}`);
    }
    lines.push(`- Pipeline health, temporal trends, compound signals, and strategic recommendations are most relevant.`);
    lines.push(`- Be specific and decisive. Rank priorities by impact. Don't hedge.`);
  } else if (intent.type === 'objection') {
    lines.push(`QUERY FOCUS: The user is asking about objections/pushback. Pay special attention to:`);
    lines.push(`- TOP OBJECTIONS section (frequency, effective responses)`);
    lines.push(`- OBJECTION EVOLUTION section (emerging vs persistent vs resolved)`);
    lines.push(`- PROVEN OBJECTION RESPONSES (use the specific responses that have worked)`);
    lines.push(`- NARRATIVE EFFECTIVENESS BY INVESTOR TYPE (which types are struggling)`);
    lines.push(`When recommending responses, ALWAYS prefer proven responses from the playbook over generic advice.`);
  } else if (intent.type === 'document') {
    lines.push(`QUERY FOCUS: The user is working on a document. Pay special attention to:`);
    lines.push(`- NARRATIVE HEALTH section (what topics are investors questioning)`);
    lines.push(`- PROVEN OBJECTION RESPONSES (incorporate these into document language)`);
    lines.push(`- Cross-reference all numbers against RAISE PARAMETERS and REVENUE BACKLOG`);
    lines.push(`- Focus on making the document IC-grade: concise, evidence-based, Goldman style.`);
  }

  if (lines.length === 0) return '';
  return lines.join('\n') + '\n\n';
}

// ---------------------------------------------------------------------------

function buildOtherDocsContext(docs: { id: string; title: string; type: string; content: string }[], excludeId: string | null): string {
  const others = docs.filter(d => d.id !== excludeId);
  if (others.length === 0) return 'None';

  const perDocBudget = Math.floor(OTHER_DOCS_BUDGET / Math.max(others.length, 1));
  return others.map(d => {
    const snippet = d.content.substring(0, Math.min(perDocBudget, 2000));
    return `- ${d.title} (${d.type}): ${snippet}${d.content.length > snippet.length ? '...' : ''}`;
  }).join('\n');
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messages, documentId, documentContent, documentTitle } = body;

  // Build context from unified context bus (includes investors, meetings, objections, tasks, follow-ups, backlog, accelerations)
  const fullCtx = await getFullContext();

  // Still need full doc content for buildOtherDocsContext — context bus only stores titles
  const allDocs = await cachedFetch('allDocs', getAllDocuments);

  // otherDocsContext depends on which document is active, so key by documentId
  const otherDocsCacheKey = `otherDocs:${documentId ?? '__none__'}`;
  let otherDocsContext = getCached<string>(otherDocsCacheKey);
  if (otherDocsContext === null) {
    otherDocsContext = buildOtherDocsContext(allDocs, documentId);
    setCached(otherDocsCacheKey, otherDocsContext);
  }

  const fullContextStr = contextToSystemPrompt(fullCtx);

  // Detect query intent and build focused context steering (cycle 15)
  const queryIntent = detectQueryIntent(messages, fullCtx);
  const queryFocus = buildQueryFocus(queryIntent, fullCtx);

  const systemPrompt = `${queryFocus}You are an expert fundraising advisor and document specialist embedded in a Series C fundraise execution platform. You combine the expertise of:

- A Goldman Sachs ECM Managing Director (document style, IC-readiness)
- A top-tier VC Partner (investor perspective, what makes deals close)
- A financial modeler (numbers, unit economics, returns)
- A skeptical IC member (finding weak arguments)
- A corporate lawyer (legal precision, risk language)

${fullContextStr}

CURRENT DOCUMENT: "${documentTitle}" (${documentId ? 'loaded' : 'none selected'})
${documentContent ? `\nDOCUMENT CONTENT:\n${documentContent.substring(0, 60000)}` : ''}

OTHER DOCUMENTS IN THIS RAISE:
${otherDocsContext}

DATA ROOM (source materials):
${fullCtx.dataRoomSummary}

MARKET INTELLIGENCE (deals, competitors, research briefs):
${fullCtx.intelligenceSummary}

INSTRUCTIONS:
1. When the user asks you to improve, rewrite, or change the document, respond with your analysis AND include the full updated document content.
2. When providing updated content, wrap it in <updated_content>...</updated_content> tags so the system can extract and apply it.
3. For financial model changes, wrap cell updates in <cell_updates>[{"ref":"A1","value":"new value","formula":"=B1+C1"}]</cell_updates> tags.
4. Be direct, specific, and IC-grade in your feedback. No hedging.
5. Every suggestion should make the document more compelling, more accurate, or more concise.
6. When asked to "rewrite in Goldman style": short sentences, active voice, numbers first, no hedging, bold key metrics.
7. Cross-reference numbers against the raise configuration, investor pipeline, revenue backlog, and other documents for consistency.
8. If the user speaks casually or gives voice-transcribed input, interpret their intent and execute precisely.
9. You have FULL CONTEXT of the entire fundraise — pipeline, meetings, objections, tasks, backlog. Use this context in every response.
10. When numbers or facts conflict, ALWAYS use the most recent data (check timestamps in recent activity).
11. PATTERN SYNTHESIS: When you see narrative weaknesses (topics questioned by 2+ investors), cross-reference with:
   - Which documents cover that topic → suggest specific edits
   - Which investor types are asking → tailor response to their frame
   - Whether proven responses exist → recommend using them
   Do NOT just report the pattern — recommend a specific action.
12. STRATEGIC PRIORITIZATION: When advising on next actions, always consider:
   - Keystone investors first (closing one unlocks others via network effects)
   - Investors with declining trajectories get urgent attention
   - Timing signals (competitive tension = leverage, engagement gaps = re-engage)
   Weight your advice by cascade impact, not just individual probability.
13. CONVICTION ARC REASONING: For each investor, reason about their conviction arc:
   - Are they accelerating? → Push for next stage advancement
   - Steady? → Introduce new information to catalyze movement
   - Decelerating? → Diagnose why (objections? competition? internal politics?)
   - Stalled? → Consider whether to invest more time or redirect energy
14. CONTRADICTION DETECTION: When data conflicts, flag it explicitly:
   - Enthusiasm score high but engagement signals weak = possible politeness, not conviction
   - Multiple meetings but no status progression = stuck in loop
   - Strong objection responses but no enthusiasm lift = wrong objection targeted
15. PREDICTIVE REASONING: Don't just describe current state. Predict:
   - "Based on trajectory, [investor] likely reaches DD in ~3 weeks"
   - "If [keystone investor] commits, expect [connected investors] to accelerate within 2 weeks"
   - "Narrative weakness on [topic] will likely become a showstopper if not addressed before next meeting with [investor]"
16. FUNDRAISE PHASE AWARENESS: Adjust your advice based on the raise phase:
   - Discovery: focus on thesis fit and warm paths
   - Outreach: focus on meeting conversion and first impressions
   - Mgmt Presentations: focus on narrative effectiveness and objection handling
   - Due Diligence: focus on speed, responsiveness, and competitive tension
   - Negotiation: focus on term optimization and closing tactics
17. EVIDENCE-BASED RECOMMENDATIONS: When recommending actions, prefer action types that have empirically worked (shown in ACTION EFFECTIVENESS). Avoid recommending action types with low measured effectiveness unless the situation specifically calls for it. Always mention the evidence basis: "Based on X measured outcomes, [action type] has been most effective for this type of situation."
18. TEMPORAL AWARENESS: When TEMPORAL TRENDS data is available, incorporate trajectory into your reasoning:
   - If a metric is declining, don't just report the current value — report the trend ("Pipeline health is 65 and declining 8% over 7 days")
   - If multiple metrics decline simultaneously, flag it as a systemic issue, not isolated incidents
   - If metrics are improving, validate that the improvement is real (check if it correlates with actual pipeline events)
   - Use streak data: a 4-day declining streak is more concerning than a single-day dip`;

  // Compute a lightweight context hash from the context bus version + document length.
  // The client can use this to detect when cached context has changed.
  const contextHash = quickHash(`v${fullCtx.version}:${(documentContent ?? '').length}`);

  try {
    const stream = getClient().messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
            }
          }
          // Send done signal
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Stream error' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Context-Hash': contextHash,
      },
    });
  } catch (err) {
    console.error('Workspace AI error:', err);
    const msg = err instanceof Error ? err.message : 'AI request failed';
    let status = 500;
    let userMsg = msg;
    if (msg.includes('credit balance') || msg.includes('too low')) {
      status = 402;
      userMsg = 'Anthropic API: insufficient credits. Check console.anthropic.com/settings/billing — make sure credits are on the same workspace as the API key.';
    } else if (msg.includes('authentication') || msg.includes('api_key') || msg.includes('401')) {
      status = 401;
      userMsg = 'Anthropic API key missing or invalid. Set ANTHROPIC_API_KEY in environment variables and redeploy.';
    }
    return new Response(
      JSON.stringify({ error: userMsg }),
      { status, headers: { 'Content-Type': 'application/json', 'X-Context-Hash': contextHash } }
    );
  }
}

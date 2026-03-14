import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getRaiseConfig, getAllDocuments, getDataRoomContext, getIntelligenceContext } from '@/lib/db';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

// Smart context budgeting — allocate tokens based on content type importance
const CONTEXT_BUDGET = {
  document: 60000,    // Active document gets most context
  dataRoom: 20000,    // Data room source materials
  otherDocs: 8000,    // Summaries of other documents
  config: 2000,       // Raise config
};

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

function buildOtherDocsContext(docs: { id: string; title: string; type: string; content: string }[], excludeId: string | null): string {
  const others = docs.filter(d => d.id !== excludeId);
  if (others.length === 0) return 'None';

  const perDocBudget = Math.floor(CONTEXT_BUDGET.otherDocs / Math.max(others.length, 1));
  return others.map(d => {
    const snippet = d.content.substring(0, Math.min(perDocBudget, 2000));
    return `- ${d.title} (${d.type}): ${snippet}${d.content.length > snippet.length ? '...' : ''}`;
  }).join('\n');
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messages, documentId, documentContent, documentTitle } = body;

  // Build context with smart budgeting — uses cache to avoid re-fetching on every message
  const raiseConfig = await cachedFetch('raiseConfig', getRaiseConfig);
  const allDocs = await cachedFetch('allDocs', getAllDocuments);
  const dataRoomContext = await cachedFetch('dataRoomContext', getDataRoomContext);
  const intelligenceContext = await cachedFetch('intelligenceContext', getIntelligenceContext);

  // otherDocsContext depends on which document is active, so key by documentId
  const otherDocsCacheKey = `otherDocs:${documentId ?? '__none__'}`;
  let otherDocsContext = getCached<string>(otherDocsCacheKey);
  if (otherDocsContext === null) {
    otherDocsContext = buildOtherDocsContext(allDocs, documentId);
    setCached(otherDocsCacheKey, otherDocsContext);
  }

  // For model/cell context, use full content (already condensed by the model page)
  const isModelContext = documentTitle?.startsWith('Financial Model');
  const docBudget = isModelContext ? CONTEXT_BUDGET.document : CONTEXT_BUDGET.document;

  const systemPrompt = `You are an expert fundraising advisor and document specialist embedded in a Series C fundraise execution platform. You combine the expertise of:

- A Goldman Sachs ECM Managing Director (document style, IC-readiness)
- A top-tier VC Partner (investor perspective, what makes deals close)
- A financial modeler (numbers, unit economics, returns)
- A skeptical IC member (finding weak arguments)
- A corporate lawyer (legal precision, risk language)

CURRENT DOCUMENT: "${documentTitle}" (${documentId ? 'loaded' : 'none selected'})
${documentContent ? `\nDOCUMENT CONTENT:\n${documentContent.substring(0, docBudget)}` : ''}

RAISE CONFIGURATION:
${raiseConfig ? JSON.stringify(raiseConfig, null, 2).substring(0, CONTEXT_BUDGET.config) : 'Not configured yet'}

OTHER DOCUMENTS IN THIS RAISE:
${otherDocsContext}

DATA ROOM (source materials):
${dataRoomContext.substring(0, CONTEXT_BUDGET.dataRoom)}

MARKET INTELLIGENCE (deals, competitors, research briefs):
${intelligenceContext.substring(0, 6000)}

INSTRUCTIONS:
1. When the user asks you to improve, rewrite, or change the document, respond with your analysis AND include the full updated document content.
2. When providing updated content, wrap it in <updated_content>...</updated_content> tags so the system can extract and apply it.
3. For financial model changes, wrap cell updates in <cell_updates>[{"ref":"A1","value":"new value","formula":"=B1+C1"}]</cell_updates> tags.
4. Be direct, specific, and IC-grade in your feedback. No hedging.
5. Every suggestion should make the document more compelling, more accurate, or more concise.
6. When asked to "rewrite in Goldman style": short sentences, active voice, numbers first, no hedging, bold key metrics.
7. Cross-reference numbers against the raise configuration and other documents for consistency.
8. If the user speaks casually or gives voice-transcribed input, interpret their intent and execute precisely.`;

  // Compute a lightweight context hash from the lengths of the context components.
  // The client can use this to detect when cached context has changed.
  const contextHash = quickHash(
    `${raiseConfig ? JSON.stringify(raiseConfig).length : 0}:${dataRoomContext.length}:${intelligenceContext.length}:${otherDocsContext.length}:${(documentContent ?? '').length}`
  );

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

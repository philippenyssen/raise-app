import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getRaiseConfig, getAllDocuments, getDataRoomContext } from '@/lib/db';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messages, documentId, documentContent, documentTitle } = body;

  // Build context
  const raiseConfig = await getRaiseConfig();
  const allDocs = await getAllDocuments();
  const otherDocs = allDocs.filter(d => d.id !== documentId).map(d => `- ${d.title} (${d.type}): ${d.content.substring(0, 500)}...`).join('\n');
  const dataRoomContext = await getDataRoomContext();

  const systemPrompt = `You are an expert fundraising advisor and document specialist embedded in a Series C fundraise execution platform. You combine the expertise of:

- A Goldman Sachs ECM Managing Director (document style, IC-readiness)
- A top-tier VC Partner (investor perspective, what makes deals close)
- A financial modeler (numbers, unit economics, returns)
- A skeptical IC member (finding weak arguments)
- A corporate lawyer (legal precision, risk language)

CURRENT DOCUMENT: "${documentTitle}" (${documentId ? 'loaded' : 'none selected'})
${documentContent ? `\nDOCUMENT CONTENT:\n${documentContent.substring(0, 50000)}` : ''}

RAISE CONFIGURATION:
${raiseConfig ? JSON.stringify(raiseConfig, null, 2) : 'Not configured yet'}

OTHER DOCUMENTS IN THIS RAISE:
${otherDocs || 'None'}

DATA ROOM (source materials):
${dataRoomContext.substring(0, 30000)}

INSTRUCTIONS:
1. When the user asks you to improve, rewrite, or change the document, respond with your analysis AND include the full updated document content.
2. When providing updated content, wrap it in <updated_content>...</updated_content> tags so the system can extract and apply it.
3. Be direct, specific, and IC-grade in your feedback. No hedging.
4. Every suggestion should make the document more compelling, more accurate, or more concise.
5. When asked to "rewrite in Goldman style": short sentences, active voice, numbers first, no hedging, bold key metrics.
6. Cross-reference numbers against the raise configuration and other documents for consistency.
7. If the user speaks casually or gives voice-transcribed input, interpret their intent and execute precisely.`;

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
      },
    });
  } catch (err) {
    console.error('Workspace AI error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'AI request failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

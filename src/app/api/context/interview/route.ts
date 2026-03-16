import { NextRequest } from 'next/server';
import { getConfig } from '@/lib/db';
import { AI_MODEL, getAIClient } from '@/lib/ai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CONTEXT_FIELDS = [
  { key: 'company_name', label: 'Company Name', category: 'Company' },
  { key: 'founded_year', label: 'Year Founded', category: 'Company' },
  { key: 'hq_location', label: 'Headquarters', category: 'Company' },
  { key: 'sector', label: 'Sector', category: 'Company' },
  { key: 'stage', label: 'Stage', category: 'Company' },
  { key: 'mission', label: 'Mission', category: 'Company' },
  { key: 'employee_count', label: 'Employee Count', category: 'Company' },
  { key: 'website', label: 'Website', category: 'Company' },
  { key: 'product_description', label: 'Product Description', category: 'Product' },
  { key: 'key_differentiators', label: 'Key Differentiators', category: 'Product' },
  { key: 'moat', label: 'Competitive Moat', category: 'Product' },
  { key: 'ip_portfolio', label: 'IP Portfolio', category: 'Product' },
  { key: 'tech_stack', label: 'Technology Stack', category: 'Product' },
  { key: 'product_roadmap', label: 'Product Roadmap', category: 'Product' },
  { key: 'tam', label: 'TAM', category: 'Market' },
  { key: 'sam', label: 'SAM', category: 'Market' },
  { key: 'som', label: 'SOM', category: 'Market' },
  { key: 'market_trends', label: 'Market Trends', category: 'Market' },
  { key: 'competitive_landscape', label: 'Competitive Landscape', category: 'Market' },
  { key: 'revenue_current', label: 'Current Revenue', category: 'Traction' },
  { key: 'revenue_growth', label: 'Revenue Growth', category: 'Traction' },
  { key: 'key_customers', label: 'Key Customers', category: 'Traction' },
  { key: 'customer_count', label: 'Customer Count', category: 'Traction' },
  { key: 'key_metrics', label: 'Key KPIs', category: 'Traction' },
  { key: 'contracts_backlog', label: 'Contracts & Backlog', category: 'Traction' },
  { key: 'founder_bio', label: 'Founder Bio', category: 'Team' },
  { key: 'leadership_team', label: 'Leadership Team', category: 'Team' },
  { key: 'key_hires_planned', label: 'Key Hires Planned', category: 'Team' },
  { key: 'board_members', label: 'Board Members', category: 'Team' },
  { key: 'financial_summary', label: 'Financial Summary', category: 'Financial' },
  { key: 'unit_economics', label: 'Unit Economics', category: 'Financial' },
  { key: 'burn_rate', label: 'Burn Rate', category: 'Financial' },
  { key: 'runway', label: 'Runway', category: 'Financial' },
  { key: 'cap_table', label: 'Cap Table', category: 'Financial' },
  { key: 'previous_rounds', label: 'Previous Rounds', category: 'Financial' },
  { key: 'raise_amount', label: 'Raise Amount', category: 'Raise' },
  { key: 'valuation', label: 'Valuation', category: 'Raise' },
  { key: 'use_of_proceeds', label: 'Use of Proceeds', category: 'Raise' },
  { key: 'target_investors', label: 'Target Investors', category: 'Raise' },
  { key: 'timeline', label: 'Timeline', category: 'Raise' },
  { key: 'one_paragraph_pitch', label: 'One-Paragraph Pitch', category: 'Raise' },
  { key: 'three_beliefs', label: 'Three Core Beliefs', category: 'Raise' },
  { key: 'corporate_structure', label: 'Corporate Structure', category: 'Legal' },
  { key: 'key_contracts', label: 'Key Contracts', category: 'Legal' },
  { key: 'regulatory', label: 'Regulatory', category: 'Legal' },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages } = body as { messages: Message[] };

    // Load current context to know what's missing
    const raw = await getConfig('company_context');
    const ctx: Record<string, string> = raw ? JSON.parse(raw) : {};

    const filled = CONTEXT_FIELDS.filter(f => ctx[f.key]?.trim());
    const missing = CONTEXT_FIELDS.filter(f => !ctx[f.key]?.trim());
    const filledPct = Math.round((filled.length / CONTEXT_FIELDS.length) * 100);

    const filledSummary = filled.length > 0
      ? filled.map(f => `  - ${f.label}: ${ctx[f.key]!.substring(0, 100)}`).join('\n')
      : '  (none)';
    const missingSummary = missing.map(f => `  - ${f.label} [${f.category}]`).join('\n');

    // Group missing by category for smarter questioning
    const missingByCategory: Record<string, string[]> = {};
    for (const f of missing) {
      if (!missingByCategory[f.category]) missingByCategory[f.category] = [];
      missingByCategory[f.category].push(f.label);
    }

    const systemPrompt = `You are a Series C fundraise advisor conducting an intake interview with a founder. Your job is to gather all the information needed to generate investor-grade fundraising materials.

CURRENT STATUS: ${filledPct}% complete (${filled.length}/${CONTEXT_FIELDS.length} fields filled)

ALREADY FILLED:
${filledSummary}

STILL MISSING (grouped by category):
${Object.entries(missingByCategory).map(([cat, fields]) => `  [${cat}]: ${fields.join(', ')}`).join('\n')}

RULES:
1. Ask 2-3 questions at a time, grouped by topic. Don't overwhelm.
2. Be conversational and warm but efficient. You're a senior advisor, not a chatbot.
3. When the founder answers, extract structured data and include it in a special XML block.
4. After extracting data from each answer, acknowledge what you captured and move to the next topic.
5. Prioritize in this order: Company basics → Product → Traction/Revenue → Market → Team → Financials → Raise Details → Legal
6. If the founder gives a detailed answer, extract MULTIPLE fields at once.
7. Skip fields that are already filled unless the founder corrects them.
8. When all critical fields are covered (>80%), congratulate them and suggest generating documents.

EXTRACTION FORMAT — include this XML block at the END of your message when you extract data:
<context_update>
{"field_key": "extracted value", "another_field": "another value"}
</context_update>

For example, if the founder says "We're Acme Corp, founded in 2020, based in Brussels, building satellites":
<context_update>
{"company_name": "Acme Corp", "founded_year": "2020", "hq_location": "Brussels", "product_description": "Building satellites"}
</context_update>

Only include the XML block when you actually have data to extract. Don't include it in your opening message unless the founder already provided information.

Valid field keys: ${CONTEXT_FIELDS.map(f => f.key).join(', ')}`;

    const aiMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // If no messages yet, this is the opening — AI should start the conversation
    if (aiMessages.length === 0) {
      aiMessages.push({
        role: 'user',
        content: filled.length === 0
          ? 'I want to start filling in my company context for my Series C fundraise. Help me.'
          : `I've already filled in some context (${filledPct}%). Help me fill in the rest.`,
      });
    }

    const stream = getAIClient().messages.stream({
      model: AI_MODEL,
      max_tokens: 2048,
      temperature: 0.3,
      system: systemPrompt,
      messages: aiMessages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const data = JSON.stringify({ type: 'text', text: event.delta.text });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`));
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
    console.error('[CONTEXT_INTERVIEW]', err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: 'Interview failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

import { NextResponse } from 'next/server';
import { getConfig, getAllDataRoomFiles } from '@/lib/db';
import { AI_MODEL, getAIClient } from '@/lib/ai';

export async function POST() {
  try {
    const raw = await getConfig('company_context');
    const ctx: Record<string, string> = raw ? JSON.parse(raw) : {};
    const files = await getAllDataRoomFiles();

    // Build a summary of what's filled and what's missing
    const FIELD_LABELS: Record<string, string> = {
      company_name: 'Company Name', founded_year: 'Year Founded', hq_location: 'Headquarters',
      sector: 'Sector', stage: 'Stage', mission: 'Mission', employee_count: 'Employee Count', website: 'Website',
      product_description: 'Product Description', key_differentiators: 'Key Differentiators', moat: 'Competitive Moat',
      ip_portfolio: 'IP Portfolio', tech_stack: 'Technology Stack', product_roadmap: 'Product Roadmap',
      tam: 'TAM', sam: 'SAM', som: 'SOM', market_trends: 'Market Trends', competitive_landscape: 'Competitive Landscape',
      revenue_current: 'Current Revenue', revenue_growth: 'Revenue Growth', key_customers: 'Key Customers',
      customer_count: 'Customer Count', key_metrics: 'Key KPIs', contracts_backlog: 'Contracts & Backlog',
      founder_bio: 'Founder Bio', leadership_team: 'Leadership Team', key_hires_planned: 'Key Hires Planned',
      org_structure: 'Organization Structure', board_members: 'Board Members',
      financial_summary: 'Financial Summary', unit_economics: 'Unit Economics', burn_rate: 'Burn Rate',
      runway: 'Runway', cap_table: 'Cap Table', previous_rounds: 'Previous Rounds',
      raise_amount: 'Raise Amount', valuation: 'Target Valuation', use_of_proceeds: 'Use of Proceeds',
      target_investors: 'Target Investors', timeline: 'Timeline', one_paragraph_pitch: 'One-Paragraph Pitch',
      three_beliefs: 'Three Core Beliefs',
      corporate_structure: 'Corporate Structure', key_contracts: 'Key Contracts', regulatory: 'Regulatory',
      additional_context: 'Additional Context',
    };

    const filled: string[] = [];
    const missing: string[] = [];
    for (const [key, label] of Object.entries(FIELD_LABELS)) {
      if (ctx[key]?.trim()) {
        filled.push(`${label}: ${ctx[key].substring(0, 200)}`);
      } else {
        missing.push(label);
      }
    }

    const fileContext = files.length > 0
      ? files.map(f => `- ${f.filename} (${f.category}): ${(f.summary || f.extracted_text?.substring(0, 200) || 'no text')}`).join('\n')
      : 'No data room files uploaded.';

    const response = await getAIClient().messages.create({
      model: AI_MODEL,
      max_tokens: 4096,
      temperature: 0,
      system: 'You are a Series C fundraise advisor. You analyze context completeness and generate targeted questions to fill gaps. Return only valid JSON.',
      messages: [{
        role: 'user',
        content: `Analyze this company's fundraise context and identify the most critical gaps. The company is preparing for a Series C raise.

FILLED FIELDS:
${filled.join('\n')}

MISSING FIELDS:
${missing.join(', ')}

DATA ROOM FILES:
${fileContext}

Return a JSON object with this structure:
{
  "readiness_score": <number 1-10>,
  "readiness_label": "<Not Ready | Needs Work | Almost Ready | Ready>",
  "summary": "<1-2 sentence assessment>",
  "critical_gaps": [
    {
      "field": "<field_key from the context>",
      "label": "<human readable name>",
      "priority": "<critical | high | medium>",
      "question": "<specific question to ask the founder to fill this gap>",
      "why": "<why an investor would need this information>"
    }
  ],
  "suggestions": [
    "<actionable suggestion to improve materials>"
  ],
  "data_room_gaps": [
    "<file type or document that should be uploaded to the data room>"
  ]
}

Focus on the gaps that matter most for a Series C IC memo. Prioritize: financial data, market validation, competitive position, team, and deal terms. Return 5-10 critical gaps, 3-5 suggestions, and 3-5 data room gaps. Return ONLY JSON.`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { return NextResponse.json(JSON.parse(match[0])); } catch { /* fall through */ }
      }
      return NextResponse.json({ error: 'AI returned invalid JSON', raw: text.substring(0, 500) }, { status: 422 });
    }
  } catch (err) {
    console.error('[CONTEXT_ANALYZE]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}

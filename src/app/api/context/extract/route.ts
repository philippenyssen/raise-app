import { NextResponse } from 'next/server';
import { getAllDataRoomFiles, getConfig } from '@/lib/db';
import { AI_MODEL, getAIClient } from '@/lib/ai';

export async function POST() {
  try {
    const files = await getAllDataRoomFiles();
    if (files.length === 0) {
      return NextResponse.json({ error: 'No data room files to extract from. Upload files first.' }, { status: 400 });
    }

    const raw = await getConfig('company_context');
    const current: Record<string, string> = raw ? JSON.parse(raw) : {};

    // Build file content for AI
    const fileContent = files
      .map(f => `--- ${f.filename} (${f.category}) ---\n${f.extracted_text?.substring(0, 4000) || 'No extracted text'}`)
      .join('\n\n');

    const response = await getAIClient().messages.create({
      model: AI_MODEL,
      max_tokens: 8192,
      temperature: 0,
      system: 'You are a Series C fundraise analyst extracting structured company data from documents. Return only valid JSON. Be precise — only extract information that is clearly stated in the documents, never fabricate.',
      messages: [{
        role: 'user',
        content: `Extract structured company context from these data room files. Map information to the fields below.

EXISTING CONTEXT (do NOT overwrite non-empty fields unless the documents have clearly more recent/accurate data):
${Object.entries(current)
  .filter(([, v]) => v?.trim())
  .map(([k, v]) => `${k}: ${v.substring(0, 100)}`)
  .join('\n')}

TARGET FIELDS TO FILL (extract from documents):
- company_name, founded_year, hq_location, sector, stage, mission, employee_count, website
- product_description, key_differentiators, moat, ip_portfolio, tech_stack, product_roadmap
- tam, sam, som, market_trends, competitive_landscape
- revenue_current, revenue_growth, key_customers, customer_count, key_metrics, contracts_backlog
- founder_bio, leadership_team, key_hires_planned, org_structure, board_members
- financial_summary, unit_economics, burn_rate, runway, cap_table, previous_rounds
- raise_amount, valuation, use_of_proceeds, target_investors, timeline, one_paragraph_pitch, three_beliefs
- corporate_structure, key_contracts, regulatory

DOCUMENTS:
${fileContent.substring(0, 40000)}

Return a JSON object where:
- Keys are the field names from above
- Values are the extracted text
- ONLY include fields where you found clear information in the documents
- Do NOT include fields where you'd be guessing
- Do NOT include fields that already have good data in the existing context
- For each value, be comprehensive but concise

Example:
{
  "company_name": "Acme Corp",
  "revenue_current": "€51M ARR (FY2025)",
  "tam": "$45B global market by 2030 (Source: McKinsey report)"
}

Return ONLY the JSON object, no markdown.`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    let extracted: Record<string, string>;
    try {
      extracted = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { extracted = JSON.parse(match[0]); } catch { extracted = {}; }
      } else {
        extracted = {};
      }
    }

    // Filter to only valid context fields
    const VALID_FIELDS = new Set([
      'company_name', 'founded_year', 'hq_location', 'sector', 'stage', 'mission', 'employee_count', 'website',
      'product_description', 'key_differentiators', 'moat', 'ip_portfolio', 'tech_stack', 'product_roadmap',
      'tam', 'sam', 'som', 'market_trends', 'competitive_landscape',
      'revenue_current', 'revenue_growth', 'key_customers', 'customer_count', 'key_metrics', 'contracts_backlog',
      'founder_bio', 'leadership_team', 'key_hires_planned', 'org_structure', 'board_members',
      'financial_summary', 'unit_economics', 'burn_rate', 'runway', 'cap_table', 'previous_rounds',
      'raise_amount', 'valuation', 'use_of_proceeds', 'target_investors', 'timeline', 'one_paragraph_pitch', 'three_beliefs',
      'corporate_structure', 'key_contracts', 'regulatory', 'additional_context',
    ]);

    const filtered: Record<string, string> = {};
    let newFieldCount = 0;
    let updatedFieldCount = 0;
    for (const [key, value] of Object.entries(extracted)) {
      if (VALID_FIELDS.has(key) && typeof value === 'string' && value.trim()) {
        filtered[key] = value;
        if (!current[key]?.trim()) {
          newFieldCount++;
        } else {
          updatedFieldCount++;
        }
      }
    }

    return NextResponse.json({
      extracted: filtered,
      newFields: newFieldCount,
      updatedFields: updatedFieldCount,
      totalExtracted: Object.keys(filtered).length,
      sourceFiles: files.length,
    });
  } catch (err) {
    console.error('[CONTEXT_EXTRACT]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getRaiseConfig, getAllDocuments, getDataRoomContext, createDocument, updateDocument, getModelSheets, updateModelSheet, getConfig } from '@/lib/db';
import { generateDeliverable, generateModelFromContext, generateDeckAsSlides, generateSpreadsheetDoc } from '@/lib/generate';

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }
  const { type, investor_id } = body as { type: string; investor_id?: string };

  try {
    const raiseConfig = await getRaiseConfig();
    const dataRoomContext = await getDataRoomContext();
    const allDocs = await getAllDocuments();

    // Load company context (structured data from Context page)
    let companyContext = '';
    try {
      const raw = await getConfig('company_context');
      if (raw) {
        const ctx = JSON.parse(raw);
        const CONTEXT_GROUPS: Record<string, string[]> = {
          'COMPANY OVERVIEW': ['company_name', 'founded_year', 'hq_location', 'sector', 'stage', 'mission', 'employee_count', 'website'],
          'PRODUCT & TECHNOLOGY': ['product_description', 'key_differentiators', 'moat', 'ip_portfolio', 'tech_stack', 'product_roadmap'],
          'MARKET': ['tam', 'sam', 'som', 'market_trends', 'competitive_landscape'],
          'TRACTION & METRICS': ['revenue_current', 'revenue_growth', 'key_customers', 'customer_count', 'key_metrics', 'contracts_backlog'],
          'TEAM': ['founder_bio', 'leadership_team', 'key_hires_planned', 'org_structure', 'board_members'],
          'FINANCIALS': ['financial_summary', 'unit_economics', 'burn_rate', 'runway', 'cap_table', 'previous_rounds'],
          'THIS RAISE': ['raise_amount', 'valuation', 'use_of_proceeds', 'target_investors', 'timeline', 'one_paragraph_pitch', 'three_beliefs'],
          'LEGAL & CORPORATE': ['corporate_structure', 'key_contracts', 'regulatory'],
        };
        const groupSections: string[] = [];
        for (const [group, keys] of Object.entries(CONTEXT_GROUPS)) {
          const lines = keys
            .filter(k => typeof ctx[k] === 'string' && ctx[k].trim())
            .map(k => `  ${k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}: ${ctx[k]}`);
          if (lines.length > 0) {
            groupSections.push(`[${group}]\n${lines.join('\n')}`);
          }
        }
        if (ctx.additional_context?.trim()) {
          groupSections.push(`[ADDITIONAL CONTEXT]\n${ctx.additional_context}`);
        }
        if (groupSections.length > 0) {
          companyContext = '\n\n--- COMPANY CONTEXT (structured) ---\n' + groupSections.join('\n\n');
        }
      }
    } catch { /* ignore parse errors */ }

    // Load investor profile for adaptive generation
    let investorContext = '';
    if (investor_id) {
      try {
        const { getInvestor } = await import('@/lib/db');
        const investor = await getInvestor(investor_id);
        if (investor) {
          const profile = [
            `Name: ${investor.name}`,
            `Type: ${investor.type}`,
            `Tier: ${investor.tier}`,
            investor.fund_size ? `Fund Size: ${investor.fund_size}` : null,
            investor.sector_thesis ? `Investment Thesis: ${investor.sector_thesis}` : null,
            investor.check_size_range ? `Check Size: ${investor.check_size_range}` : null,
            investor.ic_process ? `IC Process: ${investor.ic_process}` : null,
            investor.speed ? `Decision Speed: ${investor.speed}` : null,
            investor.partner ? `Key Partner: ${investor.partner}` : null,
            investor.portfolio_conflicts ? `Portfolio Conflicts: ${investor.portfolio_conflicts}` : null,
            investor.notes ? `Notes: ${investor.notes}` : null,
          ].filter(Boolean).join('\n');

          investorContext = `\n\n--- TARGET INVESTOR PROFILE ---\n${profile}\n\nINSTRUCTION: ADAPT this deliverable specifically for this investor:\n- Lead with themes that match their thesis\n- Emphasize metrics they care about (${investor.type === 'growth' ? 'revenue growth, unit economics, path to profitability' : investor.type === 'vc' ? 'market size, competitive moat, team, vision' : investor.type === 'sovereign' ? 'strategic alignment, job creation, geopolitical positioning' : investor.type === 'debt' ? 'cash flow stability, asset coverage, covenant headroom' : 'returns, market opportunity'})\n- Match their style (${investor.speed === 'fast' ? 'concise, data-driven, get to the point' : investor.speed === 'slow' ? 'comprehensive, detailed, leave no question unanswered' : 'balanced depth with clear structure'})\n- If they have portfolio conflicts, proactively address differentiation`;
        }
      } catch { /* ignore */ }
    }

    const context = {
      dataRoomContext: dataRoomContext + companyContext + investorContext,
      raiseConfig: raiseConfig ? JSON.stringify(raiseConfig, null, 2) : 'Not configured',
      existingDocs: allDocs.map(d => ({ title: d.title, type: d.type, content: d.content.substring(0, 8000) })),
    };

    if (type === 'model') {
      // Generate model assumptions and populate the first sheet
      const cells = await generateModelFromContext(context);
      const sheets = await getModelSheets();
      const assumptionsSheet = sheets.find(s => s.sheet_name === 'Assumptions');
      if (assumptionsSheet) {
        await updateModelSheet(assumptionsSheet.id, { data: JSON.stringify(cells) });
      }
      return NextResponse.json({ ok: true, type: 'model', sheetsUpdated: 1 });
    }

    // Generate deck as slide format (JSON)
    if (type === 'deck') {
      const slideContent = await generateDeckAsSlides(context);
      const existing = allDocs.find(d => d.type === 'presentation' || d.type === 'deck');
      if (existing) {
        await updateDocument(existing.id, {
          content: slideContent,
          change_summary: `AI-generated deck from data room (${new Date().toISOString()})`,
        });
        return NextResponse.json({ ok: true, type: 'presentation', documentId: existing.id, action: 'updated' });
      } else {
        const doc = await createDocument({ title: 'Management Presentation', type: 'presentation', content: slideContent });
        return NextResponse.json({ ok: true, type: 'presentation', documentId: doc.id, action: 'created' }, { status: 201 });
      }
    }

    // Generate spreadsheet model as document
    if (type === 'spreadsheet_model') {
      const cellContent = await generateSpreadsheetDoc(context);
      const existing = allDocs.find(d => d.type === 'model');
      if (existing) {
        await updateDocument(existing.id, {
          content: cellContent,
          change_summary: `AI-generated model from data room (${new Date().toISOString()})`,
        });
        return NextResponse.json({ ok: true, type: 'model', documentId: existing.id, action: 'updated' });
      } else {
        const doc = await createDocument({ title: 'Financial Model', type: 'model', content: cellContent });
        return NextResponse.json({ ok: true, type: 'model', documentId: doc.id, action: 'created' }, { status: 201 });
      }
    }

    // Generate document
    const TYPE_TITLES: Record<string, string> = {
      teaser: 'Series C Teaser',
      exec_summary: 'Executive Summary',
      memo: 'Investment Memorandum',
      dd_memo: 'Confirmatory DD Memorandum',
    };

    const content = await generateDeliverable(type, context);

    // Validate generated content before saving
    if (!content || typeof content !== 'string' || content.trim().length < 50) {
      return NextResponse.json(
        { error: 'AI generated insufficient content. Try again.' },
        { status: 422 }
      );
    }

    // Create or update the document
    const existing = allDocs.find(d => d.type === type);
    if (existing) {
      await updateDocument(existing.id, {
        content,
        change_summary: `AI-generated from data room (${new Date().toISOString()})`,
      });
      return NextResponse.json({ ok: true, type, documentId: existing.id, action: 'updated' });
    } else {
      // Create new
      const doc = await createDocument({
        title: TYPE_TITLES[type] || type,
        type,
        content,
      });
      return NextResponse.json({ ok: true, type, documentId: doc.id, action: 'created' }, { status: 201 });
    }
  } catch (err) {
    console.error('[GENERATE_POST]', err instanceof Error ? err.message : err);
    const msg = err instanceof Error ? err.message : 'Generation failed';
    // Detect billing/authentication errors and provide clear guidance
    if (msg.includes('credit balance') || msg.includes('too low')) {
      return NextResponse.json(
        { error: 'Anthropic API: insufficient credits. Check console.anthropic.com/settings/billing — make sure credits are on the same workspace as the API key. If you just added credits, try generating a new API key and redeploying.' },
        { status: 402 }
      );
    }
    if (msg.includes('authentication') || msg.includes('api_key') || msg.includes('401')) {
      return NextResponse.json(
        { error: 'AI service configuration error — please contact your administrator' },
        { status: 401 }
      );
    }
    console.error('[GENERATE]', msg);
    return NextResponse.json({ error: 'Document generation failed' }, { status: 500 });
  }
}

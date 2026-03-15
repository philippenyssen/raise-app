import { NextRequest, NextResponse } from 'next/server';
import {
  getAllMarketDeals, createMarketDeal, updateMarketDeal, deleteMarketDeal,
  getAllCompetitors, createCompetitor, updateCompetitor, deleteCompetitor,
  getIntelligenceBriefs, createIntelligenceBrief, deleteIntelligenceBrief,
  getInvestorPartners, createInvestorPartner, updateInvestorPartner, deleteInvestorPartner,
  getInvestorPortfolio, createPortfolioCo, deletePortfolioCo,
} from '@/lib/db';
import { researchInvestor, researchCompetitor, researchMarketDeals } from '@/lib/ai';
import { emitContextChange } from '@/lib/context-bus';

// GET: Fetch intelligence data by type
export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');
  const investorId = req.nextUrl.searchParams.get('investor_id');

  try {
    switch (type) {
      case 'deals':
        return NextResponse.json(await getAllMarketDeals());
      case 'competitors':
        return NextResponse.json(await getAllCompetitors());
      case 'briefs':
        return NextResponse.json(await getIntelligenceBriefs(
          req.nextUrl.searchParams.get('brief_type') || undefined,
          investorId || undefined
        ));
      case 'partners':
        if (!investorId) return NextResponse.json({ error: 'investor_id required' }, { status: 400 });
        return NextResponse.json(await getInvestorPartners(investorId));
      case 'portfolio':
        if (!investorId) return NextResponse.json({ error: 'investor_id required' }, { status: 400 });
        return NextResponse.json(await getInvestorPortfolio(investorId));
      case 'all': {
        const [deals, competitors, briefs] = await Promise.all([
          getAllMarketDeals(),
          getAllCompetitors(),
          getIntelligenceBriefs(),]);
        return NextResponse.json({ deals, competitors, briefs });
      }
      default:
        return NextResponse.json({ error: 'type parameter required (deals|competitors|briefs|partners|portfolio|all)' }, { status: 400 });
    }
  } catch (err) {
    console.error('[INTELLIGENCE_GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to load intelligence data' }, { status: 500 });
  }}

// POST: Create intelligence data or run AI research
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 }); }

  try {
    const action = body.action as string;
    const data = body.data as Record<string, unknown> | undefined;

    switch (action) {
      // CRUD operations
      case 'create_deal': {
        const deal = await createMarketDeal(data as Parameters<typeof createMarketDeal>[0]);
        emitContextChange('intelligence_added', `Market deal: ${(data as Record<string, string>)?.company || ''}`);
        return NextResponse.json(deal);
      }
      case 'create_competitor': {
        const comp = await createCompetitor(data as Parameters<typeof createCompetitor>[0]);
        emitContextChange('intelligence_added', `Competitor: ${(data as Record<string, string>)?.name || ''}`);
        return NextResponse.json(comp);
      }
      case 'create_brief': {
        const brief = await createIntelligenceBrief(data as Parameters<typeof createIntelligenceBrief>[0]);
        emitContextChange('intelligence_added', `Brief: ${(data as Record<string, string>)?.subject || ''}`);
        return NextResponse.json(brief);
      }
      case 'create_partner': {
        const partner = await createInvestorPartner(data as Parameters<typeof createInvestorPartner>[0]);
        emitContextChange('intelligence_added', `Partner: ${(data as Record<string, string>)?.name || ''}`);
        return NextResponse.json(partner);
      }
      case 'create_portfolio': {
        const portfolio = await createPortfolioCo(data as Parameters<typeof createPortfolioCo>[0]);
        emitContextChange('intelligence_added', `Portfolio co: ${(data as Record<string, string>)?.company || ''}`);
        return NextResponse.json(portfolio);
      }

      // AI Research operations
      case 'research_investor': {
        const name = ((body.name as string) || '').trim();
        const context = body.context as string | undefined;
        const investor_id = body.investor_id as string | undefined;
        const research = await researchInvestor(name, context);

        // Store as intelligence brief
        const brief = await createIntelligenceBrief({
          subject: name,
          brief_type: 'investor',
          content: formatInvestorResearch(name, research),
          sources: JSON.stringify(['Claude AI analysis based on training data']),
          investor_id: investor_id || undefined,});

        // Auto-create partner entries if investor_id provided
        if (investor_id && research.key_partners?.length > 0) {
          for (const p of research.key_partners) {
            await createInvestorPartner({
              investor_id,
              name: p.name,
              title: p.title,
              focus_areas: p.focus,
              notable_deals: p.notable_deals,
              board_seats: '',
              linkedin: '',
              background: '',
              relevance_to_us: '',});
          }}

        // Auto-create portfolio entries if investor_id provided
        if (investor_id && research.recent_investments?.length > 0) {
          for (const inv of research.recent_investments) {
            await createPortfolioCo({
              investor_id,
              company: inv.company,
              sector: inv.sector,
              stage_invested: inv.round,
              amount: inv.amount,
              date: inv.date,
              status: 'active',
              relevance: '',});
          }}

        emitContextChange('intelligence_added', `Investor research: ${name}`);
        return NextResponse.json({ brief, research });
      }

      case 'research_competitor': {
        const compName = ((body.name as string) || '').trim();
        const compCtx = body.context as string | undefined;
        const research = await researchCompetitor(compName, compCtx);

        // Auto-create competitor entry
        const competitor = await createCompetitor({
          name: compName,
          sector: 'Space/Defense',
          hq: '',
          last_round: research.financials?.last_round || '',
          last_valuation: research.financials?.last_valuation || '',
          total_raised: research.financials?.total_raised || '',
          key_investors: research.financials?.key_investors || '',
          revenue: research.financials?.revenue || '',
          employees: research.financials?.employees || '',
          positioning: research.positioning || '',
          strengths: research.strengths?.join('; ') || '',
          weaknesses: research.weaknesses?.join('; ') || '',
          threat_level: research.threat_assessment?.toLowerCase().includes('high') ? 'high' :
                       research.threat_assessment?.toLowerCase().includes('critical') ? 'critical' : 'medium',
          our_advantage: research.our_advantage || '',});

        // Store research brief
        const brief = await createIntelligenceBrief({
          subject: compName,
          brief_type: 'competitor',
          content: formatCompetitorResearch(compName, research),
          sources: JSON.stringify(['Claude AI analysis based on training data']),});

        emitContextChange('intelligence_added', `Competitor research: ${compName}`);
        return NextResponse.json({ competitor, brief, research });
      }

      case 'research_market': {
        const sector = body.sector as string | undefined;
        const research = await researchMarketDeals(sector || 'Space, Defense Technology, Satellites');

        // Auto-create deal entries
        if (research.deals?.length > 0) {
          for (const d of research.deals) {
            await createMarketDeal({
              company: d.company,
              round: d.round,
              amount: d.amount,
              valuation: d.valuation,
              lead_investors: d.lead,
              other_investors: '',
              date: d.date,
              sector: sector || 'Space/Defense',
              sub_sector: '',
              equity_story: d.equity_story,
              relevance: '',
              source: 'AI Research',});
          }}

        // Store brief
        const brief = await createIntelligenceBrief({
          subject: `Market Deals: ${sector || 'Space/Defense'}`,
          brief_type: 'market',
          content: formatMarketResearch(research),
          sources: JSON.stringify(['Claude AI analysis based on training data']),});

        emitContextChange('intelligence_added', `Market research: ${sector || 'Space/Defense'}`);
        return NextResponse.json({ brief, research });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[INTELLIGENCE_POST]', msg);
    if (msg.includes('credit balance') || msg.includes('too low')) {
      return NextResponse.json({ error: 'Anthropic API: insufficient credits. Check console.anthropic.com/settings/billing.' }, { status: 402 });
    }
    return NextResponse.json({ error: 'Could not process intelligence request' }, { status: 500 });
  }}

// PUT: Update intelligence data
export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 }); }

  try {
    const type = body.type as string;
    const id = body.id as string;
    const ALLOWED_FIELDS: Record<string, Set<string>> = {
      deal: new Set(['name', 'status', 'stage', 'amount', 'notes', 'source', 'sector', 'lead_investor']),
      competitor: new Set(['name', 'threat_level', 'strengths', 'weaknesses', 'notes', 'recent_activity']),
      partner: new Set(['name', 'firm', 'relationship_strength', 'notes', 'last_contact']),
    };
    const allowed = ALLOWED_FIELDS[type];
    if (!allowed) return NextResponse.json({ error: 'type required (deal|competitor|partner)' }, { status: 400 });
    const filtered = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.has(k)));
    switch (type) {
      case 'deal':
        await updateMarketDeal(id, filtered);
        return NextResponse.json({ ok: true });
      case 'competitor':
        await updateCompetitor(id, filtered);
        return NextResponse.json({ ok: true });
      case 'partner':
        await updateInvestorPartner(id, filtered);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: 'type required (deal|competitor|partner)' }, { status: 400 });
    }
  } catch (err) {
    console.error('[INTELLIGENCE_PUT]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to update intelligence data' }, { status: 500 });
  }}

// DELETE: Remove intelligence data
export async function DELETE(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');
  const id = req.nextUrl.searchParams.get('id');
  if (!type || !id) return NextResponse.json({ error: 'type and id required' }, { status: 400 });

  try {
    switch (type) {
      case 'deal': await deleteMarketDeal(id); break;
      case 'competitor': await deleteCompetitor(id); break;
      case 'brief': await deleteIntelligenceBrief(id); break;
      case 'partner': await deleteInvestorPartner(id); break;
      case 'portfolio': await deletePortfolioCo(id); break;
      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[INTELLIGENCE_DELETE]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to delete intelligence data' }, { status: 500 });
  }}

// Format helpers
function formatInvestorResearch(name: string, r: Awaited<ReturnType<typeof researchInvestor>>): string {
  return `# ${name} — Investor Intelligence Brief

## Overview
${r.overview}

## Fund Details
- **AUM**: ${r.fund_details.aum}
- **Vintage**: ${r.fund_details.vintage}
- **Strategy**: ${r.fund_details.strategy}
- **HQ**: ${r.fund_details.hq}

## Key Partners
${r.key_partners.map(p => `### ${p.name} — ${p.title}\n- Focus: ${p.focus}\n- Notable deals: ${p.notable_deals}`).join('\n\n')}

## Recent Investments
| Company | Round | Amount | Date | Sector |
|---------|-------|--------|------|--------|
${r.recent_investments.map(i => `| ${i.company} | ${i.round} | ${i.amount} | ${i.date} | ${i.sector} |`).join('\n')}

## Investment Thesis
${r.investment_thesis}

## IC Process
${r.ic_process}

## Typical Check Size
${r.typical_check}

## Portfolio in Our Sector
${r.portfolio_in_sector.map(p => `- **${p.company}**: ${p.relevance}`).join('\n')}

## Fit Assessment
${r.fit_assessment}

## Recommended Approach
${r.approach_strategy}

---
*Generated ${new Date().toISOString().split('T')[0]}*`;
}

function formatCompetitorResearch(name: string, r: Awaited<ReturnType<typeof researchCompetitor>>): string {
  return `# ${name} — Competitive Intelligence

## Overview
${r.overview}

## Financials
- Revenue: ${r.financials.revenue}
- Employees: ${r.financials.employees}
- Total Raised: ${r.financials.total_raised}
- Last Round: ${r.financials.last_round}
- Last Valuation: ${r.financials.last_valuation}
- Key Investors: ${r.financials.key_investors}

## Market Positioning
${r.positioning}

## Strengths
${r.strengths.map(s => `- ${s}`).join('\n')}

## Weaknesses
${r.weaknesses.map(w => `- ${w}`).join('\n')}

## Our Advantage
${r.our_advantage}

## Threat Assessment
${r.threat_assessment}

## Recent News
${r.recent_news.map(n => `- ${n}`).join('\n')}

---
*Generated ${new Date().toISOString().split('T')[0]}*`;
}

function formatMarketResearch(r: Awaited<ReturnType<typeof researchMarketDeals>>): string {
  return `# Market Deal Intelligence

## Recent Deals
| Company | Round | Amount | Valuation | Lead | Date |
|---------|-------|--------|-----------|------|------|
${r.deals.map(d => `| ${d.company} | ${d.round} | ${d.amount} | ${d.valuation} | ${d.lead} | ${d.date} |`).join('\n')}

## Market Trends
${r.trends.map(t => `- ${t}`).join('\n')}

## Valuation Context
${r.valuation_context}

## Implications for Our Raise
${r.implications_for_us}

---
*Generated ${new Date().toISOString().split('T')[0]}*`;
}

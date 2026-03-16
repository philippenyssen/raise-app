import { NextRequest, NextResponse } from 'next/server';
import { getConfig, setConfig, getAllDataRoomFiles, getRaiseConfig } from '@/lib/db';

export interface CompanyContext {
  // Company basics
  company_name: string;
  founded_year: string;
  hq_location: string;
  sector: string;
  stage: string;
  mission: string;
  employee_count: string;
  website: string;

  // Product & Technology
  product_description: string;
  key_differentiators: string;
  moat: string;
  ip_portfolio: string;
  tech_stack: string;
  product_roadmap: string;

  // Market
  tam: string;
  sam: string;
  som: string;
  market_trends: string;
  competitive_landscape: string;

  // Traction & Metrics
  revenue_current: string;
  revenue_growth: string;
  key_customers: string;
  customer_count: string;
  key_metrics: string;
  contracts_backlog: string;

  // Team
  founder_bio: string;
  leadership_team: string;
  key_hires_planned: string;
  org_structure: string;
  board_members: string;

  // Financial
  financial_summary: string;
  unit_economics: string;
  burn_rate: string;
  runway: string;
  cap_table: string;
  previous_rounds: string;

  // Raise Details
  raise_amount: string;
  valuation: string;
  use_of_proceeds: string;
  target_investors: string;
  timeline: string;
  one_paragraph_pitch: string;
  three_beliefs: string;

  // Legal & Corporate
  corporate_structure: string;
  key_contracts: string;
  regulatory: string;

  // Additional context (free-form)
  additional_context: string;
}

const EMPTY_CONTEXT: CompanyContext = {
  company_name: '', founded_year: '', hq_location: '', sector: '', stage: '', mission: '', employee_count: '', website: '',
  product_description: '', key_differentiators: '', moat: '', ip_portfolio: '', tech_stack: '', product_roadmap: '',
  tam: '', sam: '', som: '', market_trends: '', competitive_landscape: '',
  revenue_current: '', revenue_growth: '', key_customers: '', customer_count: '', key_metrics: '', contracts_backlog: '',
  founder_bio: '', leadership_team: '', key_hires_planned: '', org_structure: '', board_members: '',
  financial_summary: '', unit_economics: '', burn_rate: '', runway: '', cap_table: '', previous_rounds: '',
  raise_amount: '', valuation: '', use_of_proceeds: '', target_investors: '', timeline: '', one_paragraph_pitch: '', three_beliefs: '',
  corporate_structure: '', key_contracts: '', regulatory: '',
  additional_context: '',
};

interface ContextCategory {
  id: string;
  label: string;
  fields: { key: keyof CompanyContext; label: string; multiline?: boolean }[];
}

const CATEGORIES: ContextCategory[] = [
  {
    id: 'company', label: 'Company Overview',
    fields: [
      { key: 'company_name', label: 'Company Name' },
      { key: 'founded_year', label: 'Year Founded' },
      { key: 'hq_location', label: 'Headquarters' },
      { key: 'sector', label: 'Sector / Industry' },
      { key: 'stage', label: 'Stage' },
      { key: 'mission', label: 'Mission / Vision', multiline: true },
      { key: 'employee_count', label: 'Employee Count' },
      { key: 'website', label: 'Website' },
    ],
  },
  {
    id: 'product', label: 'Product & Technology',
    fields: [
      { key: 'product_description', label: 'Product Description', multiline: true },
      { key: 'key_differentiators', label: 'Key Differentiators', multiline: true },
      { key: 'moat', label: 'Competitive Moat', multiline: true },
      { key: 'ip_portfolio', label: 'IP Portfolio', multiline: true },
      { key: 'tech_stack', label: 'Technology Stack', multiline: true },
      { key: 'product_roadmap', label: 'Product Roadmap', multiline: true },
    ],
  },
  {
    id: 'market', label: 'Market & Competition',
    fields: [
      { key: 'tam', label: 'Total Addressable Market (TAM)' },
      { key: 'sam', label: 'Serviceable Addressable Market (SAM)' },
      { key: 'som', label: 'Serviceable Obtainable Market (SOM)' },
      { key: 'market_trends', label: 'Key Market Trends', multiline: true },
      { key: 'competitive_landscape', label: 'Competitive Landscape', multiline: true },
    ],
  },
  {
    id: 'traction', label: 'Traction & Metrics',
    fields: [
      { key: 'revenue_current', label: 'Current Revenue / ARR' },
      { key: 'revenue_growth', label: 'Revenue Growth Rate' },
      { key: 'key_customers', label: 'Key Customers', multiline: true },
      { key: 'customer_count', label: 'Number of Customers' },
      { key: 'key_metrics', label: 'Key KPIs & Metrics', multiline: true },
      { key: 'contracts_backlog', label: 'Contracts / Backlog', multiline: true },
    ],
  },
  {
    id: 'team', label: 'Team & Leadership',
    fields: [
      { key: 'founder_bio', label: 'Founder Bio(s)', multiline: true },
      { key: 'leadership_team', label: 'Leadership Team', multiline: true },
      { key: 'key_hires_planned', label: 'Key Hires Planned', multiline: true },
      { key: 'org_structure', label: 'Organization Structure', multiline: true },
      { key: 'board_members', label: 'Board Members', multiline: true },
    ],
  },
  {
    id: 'financial', label: 'Financial Details',
    fields: [
      { key: 'financial_summary', label: 'Financial Summary (P&L, projections)', multiline: true },
      { key: 'unit_economics', label: 'Unit Economics', multiline: true },
      { key: 'burn_rate', label: 'Monthly Burn Rate' },
      { key: 'runway', label: 'Current Runway' },
      { key: 'cap_table', label: 'Cap Table Summary', multiline: true },
      { key: 'previous_rounds', label: 'Previous Fundraising Rounds', multiline: true },
    ],
  },
  {
    id: 'raise', label: 'This Raise',
    fields: [
      { key: 'raise_amount', label: 'Target Raise Amount' },
      { key: 'valuation', label: 'Target Valuation' },
      { key: 'use_of_proceeds', label: 'Use of Proceeds', multiline: true },
      { key: 'target_investors', label: 'Target Investor Profile', multiline: true },
      { key: 'timeline', label: 'Fundraise Timeline' },
      { key: 'one_paragraph_pitch', label: 'One-Paragraph Pitch', multiline: true },
      { key: 'three_beliefs', label: 'Three Core Beliefs (thesis)', multiline: true },
    ],
  },
  {
    id: 'legal', label: 'Legal & Corporate',
    fields: [
      { key: 'corporate_structure', label: 'Corporate Structure', multiline: true },
      { key: 'key_contracts', label: 'Key Contracts & Agreements', multiline: true },
      { key: 'regulatory', label: 'Regulatory Environment', multiline: true },
    ],
  },
];

function computeCompleteness(ctx: CompanyContext, dataRoomFiles: { category: string }[]) {
  const result: { id: string; label: string; filled: number; total: number; hasFiles: boolean }[] = [];
  const drCategories = new Set(dataRoomFiles.map(f => f.category));

  for (const cat of CATEGORIES) {
    const filled = cat.fields.filter(f => ctx[f.key]?.trim().length > 0).length;
    const categoryFileMap: Record<string, string[]> = {
      company: ['other'],
      product: ['technical'],
      market: ['commercial'],
      traction: ['commercial'],
      team: ['team'],
      financial: ['financial'],
      raise: [],
      legal: ['legal'],
    };
    const hasFiles = (categoryFileMap[cat.id] || []).some(c => drCategories.has(c));
    result.push({ id: cat.id, label: cat.label, filled, total: cat.fields.length, hasFiles });
  }

  const totalFields = CATEGORIES.reduce((s, c) => s + c.fields.length, 0);
  const filledFields = result.reduce((s, r) => s + r.filled, 0);
  const overallPct = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  return { categories: result, overall: overallPct, totalFields, filledFields };
}

export async function GET() {
  try {
    const raw = await getConfig('company_context');
    const ctx: CompanyContext = raw ? { ...EMPTY_CONTEXT, ...JSON.parse(raw) } : { ...EMPTY_CONTEXT };

    // Merge raise config if it exists
    const raiseConfig = await getRaiseConfig();
    if (raiseConfig) {
      if (raiseConfig.company_name && !ctx.company_name) ctx.company_name = raiseConfig.company_name;
      if (raiseConfig.equity_amount && !ctx.raise_amount) ctx.raise_amount = raiseConfig.equity_amount;
      if (raiseConfig.pre_money && !ctx.valuation) ctx.valuation = raiseConfig.pre_money;
      if (raiseConfig.one_paragraph_pitch && !ctx.one_paragraph_pitch) ctx.one_paragraph_pitch = raiseConfig.one_paragraph_pitch;
      if (raiseConfig.three_beliefs?.length && !ctx.three_beliefs) ctx.three_beliefs = raiseConfig.three_beliefs.join('\n');
    }

    const dataRoomFiles = await getAllDataRoomFiles();
    const completeness = computeCompleteness(ctx, dataRoomFiles);

    return NextResponse.json({
      context: ctx,
      completeness,
      categories: CATEGORIES,
      dataRoomFileCount: dataRoomFiles.length,
    }, {
      headers: { 'Cache-Control': 'max-age=10, stale-while-revalidate=30' },
    });
  } catch (err) {
    console.error('[CONTEXT_GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to load context' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { context } = body as { context: Partial<CompanyContext> };

    // Merge with existing
    const raw = await getConfig('company_context');
    const existing: CompanyContext = raw ? { ...EMPTY_CONTEXT, ...JSON.parse(raw) } : { ...EMPTY_CONTEXT };

    const updated = { ...existing };
    for (const [key, value] of Object.entries(context)) {
      if (key in EMPTY_CONTEXT && typeof value === 'string') {
        (updated as Record<string, string>)[key] = value;
      }
    }

    await setConfig('company_context', JSON.stringify(updated));

    // Also sync back to raise config
    const raiseConfig = await getRaiseConfig();
    if (raiseConfig) {
      let changed = false;
      if (updated.company_name && updated.company_name !== raiseConfig.company_name) {
        raiseConfig.company_name = updated.company_name;
        changed = true;
      }
      if (updated.one_paragraph_pitch && updated.one_paragraph_pitch !== raiseConfig.one_paragraph_pitch) {
        raiseConfig.one_paragraph_pitch = updated.one_paragraph_pitch;
        changed = true;
      }
      if (changed) {
        const { setRaiseConfig } = await import('@/lib/db');
        await setRaiseConfig(raiseConfig);
      }
    }

    const dataRoomFiles = await getAllDataRoomFiles();
    const completeness = computeCompleteness(updated, dataRoomFiles);

    return NextResponse.json({ ok: true, completeness });
  } catch (err) {
    console.error('[CONTEXT_PUT]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to save context' }, { status: 500 });
  }
}

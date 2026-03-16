import { NextRequest, NextResponse } from 'next/server';
import { getInvestor, getMeetings, getInvestorPartners, getInvestorPortfolio } from '@/lib/db';
import { generateInvestorBrief } from '@/lib/ai';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const investor = await getInvestor(id);
    if (!investor) return NextResponse.json({ error: 'Investor not found' }, { status: 404 });

    const [meetings, partners, portfolio] = await Promise.all([
      getMeetings(id, 20),
      getInvestorPartners(id),
      getInvestorPortfolio(id),
    ]);

    const brief = await generateInvestorBrief(
      {
        name: investor.name,
        type: investor.type,
        status: investor.status,
        sector_thesis: investor.sector_thesis || '',
        check_size_range: investor.check_size_range || '',
        ic_process: investor.ic_process || '',
        portfolio_conflicts: investor.portfolio_conflicts || '',
        warm_path: investor.warm_path || '',
        partner: investor.partner || '',
        recent_deals: portfolio.map(p => ({
          company: p.company,
          round: p.stage_invested || '',
          amount: p.amount || '',
          date: p.date || '',
          sector: p.sector || '',
        })),
        portfolio_in_sector: portfolio.filter(p => p.relevance).map(p => ({
          company: p.company,
          relevance: p.relevance || '',
        })),
      },
      meetings.map(m => ({
        date: m.date,
        type: m.type,
        enthusiasm_score: m.enthusiasm_score ?? 3,
        raw_notes: m.raw_notes || '',
        objections: m.objections || '[]',
        engagement_signals: m.engagement_signals || '{}',
        next_steps: m.next_steps || '',
      })),
    );

    return NextResponse.json({
      ...brief,
      investorName: investor.name,
      meetingCount: meetings.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[INVESTOR_BRIEF]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to generate brief' }, { status: 500 });
  }
}

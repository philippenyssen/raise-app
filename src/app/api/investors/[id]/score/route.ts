import { NextRequest, NextResponse } from 'next/server';
import { getInvestor, getMeetings, getInvestorPortfolio, getIntelligenceBriefs, getRaiseConfig } from '@/lib/db';
import { computeInvestorScore } from '@/lib/scoring';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Fetch all data in parallel
  const [investor, meetings, portfolio, briefs, raiseConfig] = await Promise.all([
    getInvestor(id),
    getMeetings(id),
    getInvestorPortfolio(id),
    getIntelligenceBriefs(undefined, id),
    getRaiseConfig(),
  ]);

  if (!investor) {
    return NextResponse.json({ error: 'Investor not found' }, { status: 404 });
  }

  // Parse raise config for scoring context
  let targetEquityM = 250; // default: €250M
  let targetCloseDate: string | null = null;

  if (raiseConfig) {
    // Parse equity amount from config
    const eqStr = (raiseConfig.equity_amount || '').replace(/[€$£,]/g, '').trim().toLowerCase();
    const eqMatch = eqStr.match(/([\d.]+)\s*(m|b|bn|million|billion)?/i);
    if (eqMatch) {
      let val = parseFloat(eqMatch[1]);
      const unit = (eqMatch[2] || '').toLowerCase();
      if (unit === 'b' || unit === 'bn' || unit === 'billion') val *= 1000;
      targetEquityM = val;
    }
    targetCloseDate = raiseConfig.target_close || null;
  }

  const score = computeInvestorScore(
    investor,
    meetings,
    portfolio,
    briefs,
    { targetEquityM, targetCloseDate },
  );

  return NextResponse.json(score);
}

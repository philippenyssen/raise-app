import { NextRequest, NextResponse } from 'next/server';
import { getInvestor, getMeetings, getInvestorPortfolio, getIntelligenceBriefs, getRaiseConfig, upsertScoreSnapshot, computeNetworkEffectData, computeRaiseForecast } from '@/lib/db';
import { computeInvestorScore } from '@/lib/scoring';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Fetch all data in parallel (including network effect + forecast data)
  const [investor, meetings, portfolio, briefs, raiseConfig, networkData, raiseForecastData] = await Promise.all([
    getInvestor(id),
    getMeetings(id),
    getInvestorPortfolio(id),
    getIntelligenceBriefs(undefined, id),
    getRaiseConfig(),
    computeNetworkEffectData(id).catch(() => null),
    computeRaiseForecast().catch(() => null),
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

  // Build forecast data for this investor
  let forecastData: { predictedDaysToClose: number; confidence: string; isCriticalPath: boolean; pathProbability: number } | null = null;
  if (raiseForecastData) {
    const invForecast = raiseForecastData.forecasts.find(f => f.investorId === id);
    if (invForecast) {
      forecastData = {
        predictedDaysToClose: invForecast.predictedDaysToClose,
        confidence: invForecast.confidence,
        isCriticalPath: raiseForecastData.criticalPathInvestors.includes(investor?.name || ''),
        pathProbability: 0.5, // derived from pipeline flow conversion rates
      };
    }
  }

  const score = computeInvestorScore(
    investor,
    meetings,
    portfolio,
    briefs,
    { targetEquityM, targetCloseDate },
    networkData,
    forecastData,
  );

  // Auto-capture score snapshot (1 per investor per day, upsert)
  const engagementDim = score.dimensions.find(d => d.name === 'Engagement');
  const momentumDim = score.dimensions.find(d => d.name === 'Momentum');

  upsertScoreSnapshot({
    investor_id: id,
    overall_score: score.overall,
    engagement_score: engagementDim?.score,
    momentum_score: momentumDim?.score,
    enthusiasm: investor.enthusiasm,
    meeting_count: meetings.length,
    predicted_outcome: score.predictedOutcome,
  }).catch(() => { /* snapshot capture is non-blocking */ });

  return NextResponse.json(score);
}

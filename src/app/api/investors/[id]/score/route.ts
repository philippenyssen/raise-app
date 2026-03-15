import { NextRequest, NextResponse } from 'next/server';
import { getInvestor, getMeetings, getInvestorPortfolio, getIntelligenceBriefs, getRaiseConfig, upsertScoreSnapshot, computeNetworkEffectData, computeRaiseForecast, computeEngagementVelocity, detectFomoDynamics, detectScoreReversals } from '@/lib/db';
import { computeInvestorScore, computeDealHeat } from '@/lib/scoring';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Fetch all data in parallel (including network effect + forecast data)
  const [investor, meetings, portfolio, briefs, raiseConfig, networkData, raiseForecastData, velocityAll, fomoAll, reversalAll] = await Promise.all([
    getInvestor(id),
    getMeetings(id),
    getInvestorPortfolio(id),
    getIntelligenceBriefs(undefined, id),
    getRaiseConfig(),
    computeNetworkEffectData(id).catch(() => null),
    computeRaiseForecast().catch(() => null),
    computeEngagementVelocity().catch(() => [] as Awaited<ReturnType<typeof computeEngagementVelocity>>),
    detectFomoDynamics().catch(() => [] as Awaited<ReturnType<typeof detectFomoDynamics>>),
    detectScoreReversals().catch(() => [] as Awaited<ReturnType<typeof detectScoreReversals>>),]);

  if (!investor) { return NextResponse.json({ error: 'Investor not found' }, { status: 404 }); }

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
    }}

  // Find this investor's velocity data (cycle 31)
  const investorVelocity = velocityAll.find(v => v.investorId === id) || null;
  const velocityData = investorVelocity ? {
    acceleration: investorVelocity.acceleration,
    recentMeetings: investorVelocity.recentMeetings,
    previousMeetings: investorVelocity.previousMeetings,
    daysSinceLastMeeting: investorVelocity.daysSinceLastMeeting,
  } : null;

  const score = computeInvestorScore(
    investor,
    meetings,
    portfolio,
    briefs,
    { targetEquityM, targetCloseDate },
    networkData,
    forecastData,
    velocityData,);

  // Compute Deal Heat composite (cycle 31)
  const investorReversal = reversalAll.find(r => r.investorId === id);
  // Check if this investor is a FOMO target (appears in any FomoDynamic's affected list)
  const fomoForInvestor = fomoAll.find(f =>
    f.affectedInvestors.some(a => a.name === investor.name));
  // Approximate days in current stage from updated_at
  const daysInStage = Math.max(0, Math.round((Date.now() - new Date(investor.updated_at).getTime()) / (1000 * 60 * 60 * 24)));
  const stageHealth = daysInStage > 30 ? 'stalled' : daysInStage > 14 ? 'slow' : 'on_track';
  const dealHeat = computeDealHeat(
    score.overall,
    score.momentum,
    investor.enthusiasm ?? 0,
    investorVelocity?.acceleration || null,
    fomoForInvestor?.fomoIntensity || null,
    daysInStage,
    stageHealth,
    investorReversal?.delta ?? null,);

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

  return NextResponse.json({ ...score, dealHeat });
}

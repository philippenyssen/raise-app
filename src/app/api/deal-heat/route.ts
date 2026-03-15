import { NextResponse } from 'next/server';
import { getAllInvestors, getMeetings, getInvestorPortfolio, getIntelligenceBriefs, getRaiseConfig, computeNetworkEffectData, computeRaiseForecast, computeEngagementVelocity, detectFomoDynamics, detectScoreReversals } from '@/lib/db';
import { computeInvestorScore, computeDealHeat } from '@/lib/scoring';

export async function GET() {
  try {
  const [investors, raiseConfig, raiseForecastData, velocityAll, fomoAll, reversalAll] = await Promise.all([
    getAllInvestors(),
    getRaiseConfig(),
    computeRaiseForecast().catch(() => null),
    computeEngagementVelocity().catch(() => [] as Awaited<ReturnType<typeof computeEngagementVelocity>>),
    detectFomoDynamics().catch(() => [] as Awaited<ReturnType<typeof detectFomoDynamics>>),
    detectScoreReversals().catch(() => [] as Awaited<ReturnType<typeof detectScoreReversals>>),]);

  let targetEquityM = 250;
  let targetCloseDate: string | null = null;

  if (raiseConfig) {
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

  const activeStatuses = new Set(['contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged', 'in_dd', 'term_sheet', 'closed']);
  const activeInvestors = investors.filter(inv => activeStatuses.has(inv.status));

  const results = await Promise.all(
    activeInvestors.map(async (investor) => {
      const [meetings, portfolio, briefs, networkData] = await Promise.all([
        getMeetings(investor.id),
        getInvestorPortfolio(investor.id),
        getIntelligenceBriefs(undefined, investor.id),
        computeNetworkEffectData(investor.id).catch(() => null),]);

      let forecastData: { predictedDaysToClose: number; confidence: string; isCriticalPath: boolean; pathProbability: number } | null = null;
      if (raiseForecastData) {
        const invForecast = raiseForecastData.forecasts.find(f => f.investorId === investor.id);
        if (invForecast) {
          forecastData = {
            predictedDaysToClose: invForecast.predictedDaysToClose,
            confidence: invForecast.confidence,
            isCriticalPath: raiseForecastData.criticalPathInvestors.includes(investor.name),
            pathProbability: 0.5,};
        }}

      const investorVelocity = velocityAll.find(v => v.investorId === investor.id) || null;
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

      const investorReversal = reversalAll.find(r => r.investorId === investor.id);
      const fomoForInvestor = fomoAll.find(f =>
        f.affectedInvestors.some(a => a.name === investor.name));
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

      const lastMeeting = meetings.length > 0
        ? meetings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
        : null;

      return {
        id: investor.id,
        name: investor.name,
        type: investor.type,
        tier: investor.tier,
        status: investor.status,
        dealHeat,
        enthusiasm: investor.enthusiasm ?? 0,
        lastMeeting,
      };}));

  results.sort((a, b) => b.dealHeat.heat - a.dealHeat.heat);

  const counts = {
    hot: results.filter(r => r.dealHeat.label === 'hot').length,
    warm: results.filter(r => r.dealHeat.label === 'warm').length,
    cool: results.filter(r => r.dealHeat.label === 'cool').length,
    cold: results.filter(r => r.dealHeat.label === 'cold').length,
    frozen: results.filter(r => r.dealHeat.label === 'frozen').length,
    total: results.length,};

  return NextResponse.json({ investors: results, counts, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error('Deal heat API error:', err);
    return NextResponse.json({ error: 'Failed to compute deal heat' }, { status: 500 });
  }}

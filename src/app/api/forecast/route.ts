import { NextResponse } from 'next/server';
import { computeRaiseForecast, getRaiseConfig } from '@/lib/db';

export async function GET() {
  try {
    const [forecast, raiseConfig] = await Promise.all([
      computeRaiseForecast(),
      getRaiseConfig(),]);

    const equityAmount = parseMoneyString(raiseConfig?.equity_amount);
    const targetAmount = equityAmount || 250;
    const currency = detectCurrency(raiseConfig?.equity_amount || raiseConfig?.debt_amount || '');

    const committedInvestors = forecast.forecasts.filter(f => f.currentStage === 'term_sheet' || f.currentStage === 'closed');
    const highConfidence = forecast.forecasts.filter(f => f.confidence === 'high');
    const mediumConfidence = forecast.forecasts.filter(f => f.confidence === 'medium');
    const lowConfidence = forecast.forecasts.filter(f => f.confidence === 'low');

    const committedAmount = estimateCapital(committedInvestors);
    const expectedAmount = estimateCapital(highConfidence) + estimateCapital(mediumConfidence) * 0.5;
    const bestCaseAmount = estimateCapital(forecast.forecasts);
    const worstCaseAmount = estimateCapital(committedInvestors);

    return NextResponse.json({
      forecast,
      raiseTarget: targetAmount,
      currency,
      companyName: raiseConfig?.company_name || '',
      roundType: 'Series C',
      amounts: {
        committed: committedAmount,
        expected: committedAmount + expectedAmount,
        bestCase: bestCaseAmount,
        worstCase: worstCaseAmount,},
      distribution: {
        high: highConfidence.length,
        medium: mediumConfidence.length,
        low: lowConfidence.length,},
      scenarios: {
        best: {
          label: 'Best Case',
          description: 'All active investors close',
          amount: bestCaseAmount,
          investorCount: forecast.forecasts.length,
          closeDate: forecast.forecasts.length > 0
            ? forecast.forecasts[forecast.forecasts.length - 1].predictedCloseDate
            : forecast.expectedCloseDate,},
        base: {
          label: 'Base Case',
          description: 'Weighted by confidence',
          amount: committedAmount + expectedAmount,
          investorCount: committedInvestors.length + highConfidence.filter(f => !committedInvestors.includes(f)).length + Math.round(mediumConfidence.length * 0.5),
          closeDate: forecast.expectedCloseDate,},
        worst: {
          label: 'Worst Case',
          description: 'Only committed investors',
          amount: worstCaseAmount,
          investorCount: committedInvestors.length,
          closeDate: committedInvestors.length > 0
            ? committedInvestors[committedInvestors.length - 1].predictedCloseDate
            : 'N/A',},},
      generated_at: new Date().toISOString(),});
  } catch (error) {
    console.error('Forecast API error:', error);
    return NextResponse.json(
      { error: 'Failed to compute forecast', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 });
  }}

function parseMoneyString(s: unknown): number {
  if (typeof s === 'number') return s;
  if (typeof s !== 'string') return 0;
  const cleaned = s.replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (s.toLowerCase().includes('b')) return num * 1_000_000_000;
  if (s.toLowerCase().includes('m')) return num * 1_000_000;
  if (s.toLowerCase().includes('k')) return num * 1_000;
  return num;
}

function detectCurrency(s: string): string {
  if (s.includes('$')) return 'USD';
  if (s.includes('\u00a3')) return 'GBP';
  return 'EUR';
}

function estimateCapital(investors: Array<{ tier: number }>): number {
  let total = 0;
  for (const inv of investors) {
    if (inv.tier === 1) total += 50_000_000;
    else if (inv.tier === 2) total += 25_000_000;
    else if (inv.tier === 3) total += 10_000_000;
    else total += 5_000_000;
  }
  return total;
}

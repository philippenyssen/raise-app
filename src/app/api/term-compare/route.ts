import { NextResponse } from 'next/server';
import type { TermScenario, TermScenarioResult as ScenarioResult } from '@/lib/types';

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function computeFounderFriendlyScore(s: TermScenario, allScenarios: TermScenario[]): number {
  let score = 50;

  // Liquidation preference: 1x is standard, higher is worse
  if (s.liquidation_preference <= 1.0) score += 15;
  else if (s.liquidation_preference <= 1.5) score += 5;
  else if (s.liquidation_preference >= 2.0) score -= 15;
  else score -= 5;

  // Participation: non-participating is founder-friendly
  if (!s.participation) score += 12;
  else score -= 12;

  // Anti-dilution: broad-based is standard, narrow is harsh, none is best
  if (s.anti_dilution === 'none') score += 10;
  else if (s.anti_dilution === 'broad') score += 5;
  else score -= 10; // narrow / full ratchet

  // Board seats: 1 is standard, 0 is great, 2+ is aggressive
  if (s.board_seats === 0) score += 8;
  else if (s.board_seats === 1) score += 3;
  else if (s.board_seats >= 2) score -= (s.board_seats - 1) * 8;

  // Pro-rata rights: standard, slight negative for founders (dilution pressure)
  if (!s.pro_rata_rights) score += 3;
  else score -= 2;

  // Drag-along threshold: lower is more investor-aggressive
  if (s.drag_along_threshold >= 75) score += 5;
  else if (s.drag_along_threshold >= 60) score += 0;
  else score -= 8;

  // Valuation relative to others: higher pre-money is better for founders
  if (allScenarios.length > 1) {
    const avgPreMoney = allScenarios.reduce((sum, sc) => sum + sc.pre_money_valuation, 0) / allScenarios.length;
    if (s.pre_money_valuation > avgPreMoney * 1.1) score += 5;
    else if (s.pre_money_valuation < avgPreMoney * 0.9) score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

function computeEffectiveValuation(s: TermScenario): number {
  const postMoney = s.pre_money_valuation + s.investment_amount;
  let discount = 0;

  // Participating preferred creates a hidden cost
  if (s.participation) {
    discount += s.investment_amount * (s.liquidation_preference - 1) * 0.5;
    discount += s.investment_amount * 0.10; // participation premium penalty
  }

  // Non-participating but high preference still has cost
  if (!s.participation && s.liquidation_preference > 1.0) {
    discount += s.investment_amount * (s.liquidation_preference - 1) * 0.3;
  }

  // Narrow anti-dilution is more punitive than broad
  if (s.anti_dilution === 'narrow') {
    discount += s.investment_amount * 0.05;
  }

  return Math.round((postMoney - discount) * 100) / 100;
}

function generateComparisonNotes(s: TermScenario, allScenarios: TermScenario[]): string[] {
  const notes: string[] = [];
  if (allScenarios.length < 2) return notes;

  const others = allScenarios.filter(o => o.investor_name !== s.investor_name);

  // Valuation comparison
  const maxVal = Math.max(...allScenarios.map(sc => sc.pre_money_valuation));
  const minVal = Math.min(...allScenarios.map(sc => sc.pre_money_valuation));
  if (s.pre_money_valuation === maxVal && maxVal !== minVal) {
    notes.push('Highest pre-money valuation across all offers');
  }
  if (s.pre_money_valuation === minVal && maxVal !== minVal) {
    notes.push('Lowest pre-money valuation across all offers');
  }

  // Liquidation preference
  if (s.liquidation_preference > 1.0 && others.some(o => o.liquidation_preference <= 1.0)) {
    notes.push(`${s.liquidation_preference}x preference is above market standard (1x)`);
  }
  if (s.participation && others.some(o => !o.participation)) {
    notes.push('Participating preferred --- investor captures upside AND downside protection');
  }

  // Anti-dilution
  if (s.anti_dilution === 'narrow' && others.some(o => o.anti_dilution !== 'narrow')) {
    notes.push('Narrow-based anti-dilution is more punitive than broad-based');
  }
  if (s.anti_dilution === 'none' && others.some(o => o.anti_dilution !== 'none')) {
    notes.push('No anti-dilution is the most founder-friendly option');
  }

  // Board seats
  const maxSeats = Math.max(...allScenarios.map(sc => sc.board_seats));
  if (s.board_seats === maxSeats && s.board_seats > 1 && others.some(o => o.board_seats < s.board_seats)) {
    notes.push(`${s.board_seats} board seats --- more control than other offers`);
  }
  if (s.board_seats === 0 && others.some(o => o.board_seats > 0)) {
    notes.push('No board seat requirement --- preserves founder control');
  }

  // Drag-along
  if (s.drag_along_threshold < 50 && others.some(o => o.drag_along_threshold >= 50)) {
    notes.push(`Low drag-along threshold (${s.drag_along_threshold}%) gives investor significant exit control`);
  }

  // Investment amount
  const maxAmount = Math.max(...allScenarios.map(sc => sc.investment_amount));
  if (s.investment_amount === maxAmount && allScenarios.filter(sc => sc.investment_amount === maxAmount).length === 1) {
    notes.push('Largest check size across all offers');
  }

  return notes;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
  }

  try {
    const scenarios: TermScenario[] = body.scenarios as TermScenario[];

    if (!scenarios || !Array.isArray(scenarios) || scenarios.length < 1) {
      return NextResponse.json(
        { error: 'At least 1 scenario required' },
        { status: 400 },);
    }

    if (scenarios.length > 5) {
      return NextResponse.json(
        { error: 'Maximum 5 scenarios allowed' },
        { status: 400 },);
    }

    // Validate each scenario
    for (const s of scenarios) {
      if (!s.investor_name || s.pre_money_valuation <= 0 || s.investment_amount <= 0) {
        return NextResponse.json(
          { error: `Invalid scenario for "${s.investor_name || 'unnamed'}": name, pre-money, and investment amount are required` },
          { status: 400 },);
      }}

    // Assume 100% founder ownership pre-round for dilution calculation
    const founderOwnershipPreRound = 100;

    const results: ScenarioResult[] = scenarios.map(s => {
      const postMoney = s.pre_money_valuation + s.investment_amount;
      const ownershipPct = (s.investment_amount / postMoney) * 100;
      const dilution = founderOwnershipPreRound - (founderOwnershipPreRound * (s.pre_money_valuation / postMoney));
      const effectiveVal = computeEffectiveValuation(s);
      const score = computeFounderFriendlyScore(s, scenarios);
      const notes = generateComparisonNotes(s, scenarios);

      return {
        investor_name: s.investor_name,
        pre_money_valuation: s.pre_money_valuation,
        investment_amount: s.investment_amount,
        post_money_valuation: Math.round(postMoney * 100) / 100,
        ownership_percentage: Math.round(ownershipPct * 100) / 100,
        dilution_to_founders: Math.round(dilution * 100) / 100,
        effective_valuation: effectiveVal,
        founder_friendly_score: score,
        liquidation_preference: s.liquidation_preference,
        participation: s.participation,
        anti_dilution: s.anti_dilution,
        board_seats: s.board_seats,
        pro_rata_rights: s.pro_rata_rights,
        drag_along_threshold: s.drag_along_threshold,
        comparison_notes: notes,
      };});

    // Determine best-for-founders and most-capital-friendly
    const bestForFounders = [...results].sort((a, b) => b.founder_friendly_score - a.founder_friendly_score)[0];
    const mostCapital = [...results].sort((a, b) => b.investment_amount - a.investment_amount)[0];
    const highestValuation = [...results].sort((a, b) => b.effective_valuation - a.effective_valuation)[0];

    return NextResponse.json({
      results,
      recommendations: {
        best_for_founders: bestForFounders.investor_name,
        most_capital: mostCapital.investor_name,
        highest_effective_valuation: highestValuation.investor_name,},
      generated_at: new Date().toISOString(),});
  } catch (error) {
    console.error('[TERM_COMPARE_POST]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to compare term sheets' },
      { status: 500 },);
  }}

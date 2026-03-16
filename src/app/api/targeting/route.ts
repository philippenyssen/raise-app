import { NextResponse } from 'next/server';
import { getClient } from '@/lib/api-helpers';

/**
 * Investor Targeting API
 *
 * Computes optimal investor closing sequence, prioritization matrix,
 * and FOMO activation plan for the fundraise.
 *
 * Returns:
 * - matrix: 2D plot data (check size × speed, colored by tier/probability)
 * - sequence: optimal closing order with cumulative capital
 * - fomo: which investors to pressure in parallel
 * - derisking: per-investor next steps to advance stage
 *
 * GET /api/targeting
 */

const STAGE_ORDER = ['identified', 'contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged', 'in_dd', 'term_sheet', 'closed', 'passed'];

function stageIndex(s: string): number { return STAGE_ORDER.indexOf(s); }

// Estimate days to close from current stage
function estimatedDaysToClose(status: string, enthusiasm: number, tier: number): number {
  const base: Record<string, number> = {
    identified: 90, contacted: 75, nda_signed: 65, meeting_scheduled: 55,
    met: 45, engaged: 35, in_dd: 21, term_sheet: 10, closed: 0,
  };
  let days = base[status] ?? 90;
  // Enthusiasm adjustment
  if (enthusiasm >= 4) days *= 0.75;
  else if (enthusiasm <= 2) days *= 1.4;
  // Tier adjustment (tier 1 investors move faster once engaged)
  if (tier === 1 && stageIndex(status) >= stageIndex('engaged')) days *= 0.85;
  return Math.round(days);
}

function closeProbability(status: string, enthusiasm: number, tier: number, meetingCount: number): number {
  const base: Record<string, number> = {
    identified: 5, contacted: 8, nda_signed: 12, meeting_scheduled: 15,
    met: 20, engaged: 35, in_dd: 55, term_sheet: 80, closed: 100,
  };
  let prob = (base[status] ?? 5) / 100;
  if (enthusiasm >= 4) prob *= 1.3;
  else if (enthusiasm <= 2) prob *= 0.6;
  if (tier === 1) prob *= 1.15;
  if (meetingCount >= 3) prob *= 1.1;
  return Math.min(0.95, Math.round(prob * 100) / 100);
}

function parseCheckSize(range: string | null): { min: number; max: number; mid: number } {
  if (!range) return { min: 10, max: 50, mid: 25 };
  const nums = range.match(/[\d.]+/g);
  if (!nums || nums.length === 0) return { min: 10, max: 50, mid: 25 };
  const min = parseFloat(nums[0]);
  const max = nums.length > 1 ? parseFloat(nums[1]) : min * 1.5;
  return { min, max, mid: (min + max) / 2 };
}

export async function GET() {
  const t0 = Date.now();
  try {
    const db = getClient();

    const [investorRes, meetingRes, followupRes, configRes] = await Promise.all([
      db.execute(`SELECT id, name, type, tier, status, enthusiasm, check_size_range, notes, created_at, updated_at FROM investors WHERE status NOT IN ('dropped', 'passed')`),
      db.execute(`SELECT investor_id, COUNT(*) as cnt FROM meetings GROUP BY investor_id`),
      db.execute(`SELECT investor_id, action_type, status, due_at FROM followup_actions WHERE status = 'pending' ORDER BY due_at ASC`),
      db.execute(`SELECT value FROM config WHERE key = 'raise_config'`),
    ]);

    const investors = investorRes.rows as unknown as { id: string; name: string; type: string; tier: number; status: string; enthusiasm: number; check_size_range: string; notes: string; created_at: string; updated_at: string }[];
    const meetingCounts = new Map<string, number>();
    for (const r of meetingRes.rows as unknown as { investor_id: string; cnt: number }[]) {
      meetingCounts.set(r.investor_id, Number(r.cnt));
    }
    const pendingFollowups = new Map<string, { action_type: string; due_at: string }[]>();
    for (const r of followupRes.rows as unknown as { investor_id: string; action_type: string; status: string; due_at: string }[]) {
      if (!pendingFollowups.has(r.investor_id)) pendingFollowups.set(r.investor_id, []);
      pendingFollowups.get(r.investor_id)!.push({ action_type: r.action_type, due_at: r.due_at });
    }

    let targetEquityM = 250;
    if (configRes.rows.length > 0) {
      try {
        const cfg = JSON.parse(configRes.rows[0].value as string);
        const eqStr = (cfg.equity_amount || '').replace(/[^0-9.]/g, '');
        if (eqStr) targetEquityM = parseFloat(eqStr);
      } catch { /* ignore */ }
    }

    // Build investor targeting data
    const active = investors.filter(i => i.status !== 'closed');
    const closedInvestors = investors.filter(i => i.status === 'closed');
    const closedCapital = closedInvestors.reduce((sum, i) => sum + parseCheckSize(i.check_size_range).mid, 0);
    const remainingTarget = Math.max(0, targetEquityM - closedCapital);

    interface TargetInvestor {
      id: string;
      name: string;
      type: string;
      tier: number;
      status: string;
      enthusiasm: number;
      checkSize: { min: number; max: number; mid: number };
      daysToClose: number;
      probability: number;
      expectedValue: number; // checkSize * probability
      meetingCount: number;
      pendingActions: { action_type: string; due_at: string }[];
      score: number; // composite targeting score
      closeDateEstimate: string;
    }

    const now = new Date();
    const targets: TargetInvestor[] = active.map(inv => {
      const mc = meetingCounts.get(inv.id) || 0;
      const check = parseCheckSize(inv.check_size_range);
      const days = estimatedDaysToClose(inv.status, inv.enthusiasm, inv.tier);
      const prob = closeProbability(inv.status, inv.enthusiasm, inv.tier, mc);
      const ev = +(check.mid * prob).toFixed(1);

      // Composite score: high EV + short timeline + high probability
      // Normalize each dimension, weight: speed 35%, EV 35%, probability 30%
      const speedScore = Math.max(0, 1 - days / 100);
      const evScore = Math.min(1, ev / 80);
      const probScore = prob;
      const score = +(speedScore * 0.35 + evScore * 0.35 + probScore * 0.30).toFixed(3);

      const closeDate = new Date(now);
      closeDate.setDate(closeDate.getDate() + days);

      return {
        id: inv.id,
        name: inv.name,
        type: inv.type,
        tier: inv.tier,
        status: inv.status,
        enthusiasm: inv.enthusiasm,
        checkSize: check,
        daysToClose: days,
        probability: prob,
        expectedValue: ev,
        meetingCount: mc,
        pendingActions: pendingFollowups.get(inv.id) || [],
        score,
        closeDateEstimate: closeDate.toISOString().slice(0, 10),
      };
    });

    // Sort by composite score (highest first) for optimal sequence
    targets.sort((a, b) => b.score - a.score);

    // --- Optimal Closing Sequence ---
    // Greedy: pick highest-score investors that reach target capital
    const sequence: (TargetInvestor & { cumulativeCapital: number; order: number })[] = [];
    let cumCapital = closedCapital;
    let order = 1;
    const used = new Set<string>();
    // First pass: in_dd and term_sheet (closest to close)
    const nearClose = targets.filter(t => ['in_dd', 'term_sheet'].includes(t.status));
    nearClose.sort((a, b) => a.daysToClose - b.daysToClose);
    for (const t of nearClose) {
      cumCapital += t.checkSize.mid;
      sequence.push({ ...t, cumulativeCapital: +cumCapital.toFixed(1), order: order++ });
      used.add(t.id);
      if (cumCapital >= targetEquityM) break;
    }
    // Second pass: remaining by score
    if (cumCapital < targetEquityM) {
      for (const t of targets) {
        if (used.has(t.id)) continue;
        cumCapital += t.checkSize.mid;
        sequence.push({ ...t, cumulativeCapital: +cumCapital.toFixed(1), order: order++ });
        used.add(t.id);
        if (cumCapital >= targetEquityM * 1.3) break; // Over-target for buffer
      }
    }

    // --- FOMO Groups ---
    // Group investors by tier for parallel pressure
    const fomoGroups: { tier: number; investors: { name: string; id: string; status: string; checkSize: number; daysToClose: number }[]; tactic: string }[] = [];
    const tierGroups = new Map<number, TargetInvestor[]>();
    for (const t of targets.filter(t => stageIndex(t.status) >= stageIndex('engaged'))) {
      if (!tierGroups.has(t.tier)) tierGroups.set(t.tier, []);
      tierGroups.get(t.tier)!.push(t);
    }
    for (const [tier, group] of tierGroups) {
      if (group.length < 2) continue;
      fomoGroups.push({
        tier,
        investors: group.slice(0, 4).map(g => ({
          name: g.name, id: g.id, status: g.status,
          checkSize: g.checkSize.mid, daysToClose: g.daysToClose,
        })),
        tactic: tier === 1
          ? 'Signal competing term sheet interest to accelerate DD timelines'
          : tier === 2
          ? 'Share momentum updates (meetings with tier 1) to maintain urgency'
          : 'Batch communications — update on process momentum weekly',
      });
    }

    // --- De-risking Next Steps ---
    const derisking = targets.slice(0, 15).map(t => {
      const nextSteps: string[] = [];
      if (t.status === 'identified') nextSteps.push('Send introductory email or secure warm introduction');
      if (t.status === 'contacted') nextSteps.push('Schedule first meeting', 'Send NDA if required');
      if (t.status === 'nda_signed' || t.status === 'meeting_scheduled') nextSteps.push('Confirm meeting logistics', 'Prepare tailored deck');
      if (t.status === 'met') nextSteps.push('Send follow-up materials', 'Schedule deep-dive meeting');
      if (t.status === 'engaged') nextSteps.push('Share data room access', 'Arrange management presentation');
      if (t.status === 'in_dd') nextSteps.push('Address DD questions promptly', 'Push for term sheet timeline');
      if (t.status === 'term_sheet') nextSteps.push('Review terms with counsel', 'Negotiate key provisions');
      if (t.pendingActions.length > 0) {
        const overdue = t.pendingActions.filter(a => a.due_at < now.toISOString());
        if (overdue.length > 0) nextSteps.unshift(`Clear ${overdue.length} overdue follow-up(s)`);
      }
      return { id: t.id, name: t.name, status: t.status, tier: t.tier, nextSteps };
    });

    // --- Summary metrics ---
    const totalExpectedValue = +(targets.reduce((s, t) => s + t.expectedValue, 0)).toFixed(1);
    const avgDaysToClose = targets.length > 0 ? Math.round(targets.reduce((s, t) => s + t.daysToClose, 0) / targets.length) : 0;
    const highProbCount = targets.filter(t => t.probability >= 0.4).length;
    const coverageRatio = +(totalExpectedValue / Math.max(1, remainingTarget)).toFixed(1);

    return NextResponse.json({
      summary: {
        targetEquityM,
        closedCapital: +closedCapital.toFixed(1),
        remainingTarget: +remainingTarget.toFixed(1),
        totalExpectedValue,
        coverageRatio,
        activeCount: targets.length,
        highProbCount,
        avgDaysToClose,
      },
      matrix: targets.map(t => ({
        id: t.id, name: t.name, tier: t.tier, status: t.status,
        x: t.daysToClose, // speed (days)
        y: t.checkSize.mid, // capital
        size: t.probability,
        color: t.tier,
        enthusiasm: t.enthusiasm,
        score: t.score,
      })),
      sequence: sequence.slice(0, 20),
      fomoGroups,
      derisking,
      generatedAt: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        'Server-Timing': `total;dur=${Date.now() - t0}`,
      },
    });
  } catch (error) {
    console.error('[TARGETING_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to compute targeting data' }, { status: 500 });
  }
}

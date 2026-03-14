import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { computeMomentumScore } from '@/lib/scoring';
import type { Investor, Meeting } from '@/lib/types';

function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:raise.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_WEIGHT: Record<string, number> = {
  identified: 0.05,
  contacted: 0.10,
  nda_signed: 0.15,
  meeting_scheduled: 0.20,
  met: 0.25,
  engaged: 0.35,
  in_dd: 0.55,
  term_sheet: 0.80,
  closed: 1.0,
  passed: 0,
  dropped: 0,
};

const TIER_ADJUSTMENT: Record<number, number> = {
  1: 1.2,
  2: 1.0,
  3: 0.8,
  4: 0.6,
};

const MOMENTUM_ADJUSTMENT: Record<string, number> = {
  accelerating: 0.10,
  steady: 0,
  decelerating: -0.15,
  stalled: -0.25,
};

// Average days to progress between stages (defaults when no data)
const DEFAULT_STAGE_DAYS: Record<string, number> = {
  identified: 7,
  contacted: 10,
  nda_signed: 7,
  meeting_scheduled: 5,
  met: 14,
  engaged: 21,
  in_dd: 30,
  term_sheet: 14,
};

const PIPELINE_ORDER = [
  'identified', 'contacted', 'nda_signed', 'meeting_scheduled',
  'met', 'engaged', 'in_dd', 'term_sheet', 'closed',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseMoneyRange(s: string): [number, number] | null {
  if (!s) return null;
  const cleaned = s.replace(/[€$£,]/g, '').trim().toLowerCase();

  // Range: "50-100m", "50m-100m"
  const rangeMatch = cleaned.match(/([\d.]+)\s*m?\s*[-–to]+\s*([\d.]+)\s*m/i);
  if (rangeMatch) {
    return [parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2])];
  }

  // Single value: "100m", "2b", "500k"
  const singleMatch = cleaned.match(/([\d.]+)\s*(m|b|k|bn|million|billion)?/i);
  if (singleMatch) {
    let val = parseFloat(singleMatch[1]);
    const unit = (singleMatch[2] || '').toLowerCase();
    if (unit === 'b' || unit === 'bn' || unit === 'billion') val *= 1000;
    if (unit === 'k') val /= 1000;
    return [val * 0.8, val * 1.2];
  }

  return null;
}

function daysBetween(a: string | Date, b: string | Date): number {
  const da = typeof a === 'string' ? new Date(a) : a;
  const db = typeof b === 'string' ? new Date(b) : b;
  return Math.abs(da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24);
}

function clamp(n: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, n));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + Math.round(days));
  return d;
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

interface InvestorForecast {
  id: string;
  name: string;
  tier: number;
  type: string;
  status: string;
  enthusiasm: number;
  momentum: string;
  checkSizeRange: string;
  expectedCheck: number;
  closeProbability: number;
  expectedValue: number;
  predictedCloseDate: string | null;
  bottleneck: string;
}

interface GapInvestor {
  id: string;
  name: string;
  tier: number;
  status: string;
  currentExpected: number;
  potentialExpected: number;
  intervention: string;
  timeCost: string;
  impactDelta: number;
}

interface RiskItem {
  description: string;
  probability: string;
  impact: string;
  mitigation: string;
}

function computeCloseProbability(
  investor: Investor,
  momentum: string,
  meetings?: Meeting[],
): number {
  const statusBase = STATUS_WEIGHT[investor.status] ?? 0;
  if (statusBase === 0) return 0;

  const enthusiasmMultiplier = (investor.enthusiasm || 3) / 5;
  const tierAdj = TIER_ADJUSTMENT[investor.tier] ?? 1.0;
  const momentumAdj = MOMENTUM_ADJUSTMENT[momentum] ?? 0;

  let prob = statusBase * enthusiasmMultiplier * tierAdj;
  prob = prob + (prob * momentumAdj);

  // --- Investor-specific adjustments based on meeting signals ---
  if (meetings && meetings.length > 0) {
    // Unresolved showstoppers reduce probability significantly
    let showstopperCount = 0;
    let unresolvedObjCount = 0;
    for (const m of meetings) {
      try {
        const objs = JSON.parse(m.objections || '[]') as Array<{ severity?: string; resolved?: boolean }>;
        for (const o of objs) {
          if (o.severity === 'showstopper' && !o.resolved) showstopperCount++;
          if (!o.resolved) unresolvedObjCount++;
        }
      } catch { /* skip */ }
    }
    // Each unresolved showstopper reduces prob by 15-25%
    if (showstopperCount > 0) {
      prob *= Math.max(0.3, 1 - showstopperCount * 0.20);
    } else if (unresolvedObjCount > 2) {
      prob *= Math.max(0.5, 1 - unresolvedObjCount * 0.05);
    }

    // Enthusiasm trend: declining enthusiasm across last 3 meetings is a red flag
    const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
    if (sorted.length >= 3) {
      const recent3 = sorted.slice(0, 3).map(m => m.enthusiasm_score || 3);
      const isDecline = recent3[0] < recent3[1] && recent3[1] < recent3[2];
      if (isDecline) {
        const drop = recent3[2] - recent3[0];
        prob *= Math.max(0.5, 1 - drop * 0.10);
      }
    }

    // Meeting frequency signal: many meetings in short time = positive signal
    if (sorted.length >= 2) {
      const firstDate = new Date(sorted[sorted.length - 1].date).getTime();
      const lastDate = new Date(sorted[0].date).getTime();
      const spanDays = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
      const meetingsPerWeek = (sorted.length / spanDays) * 7;
      if (meetingsPerWeek > 1.5) {
        prob = Math.min(1, prob * 1.10); // high meeting frequency = slight boost
      }
    }

    // Engagement signals: process questions = strong buy signal
    let processSignals = 0;
    for (const m of meetings) {
      try {
        const signals = JSON.parse(m.engagement_signals || '{}');
        if (signals.asked_about_process) processSignals++;
        if (signals.asked_about_timeline) processSignals++;
      } catch { /* skip */ }
    }
    if (processSignals >= 2) {
      prob = Math.min(1, prob * 1.08);
    }
  }

  return clamp(prob);
}

function computeExpectedCheck(investor: Investor): number {
  const range = parseMoneyRange(investor.check_size_range);
  if (!range) return 0;
  return (range[0] + range[1]) / 2;
}

// Type-specific velocity multipliers based on typical investor behavior
const TYPE_VELOCITY: Record<string, number> = {
  vc: 0.85,           // VCs move fast, especially in competitive processes
  growth: 0.90,       // Growth equity slightly faster than average
  sovereign: 1.40,    // Sovereign wealth funds have multi-layer approvals
  strategic: 1.30,    // Strategic investors need internal alignment
  family_office: 1.15, // Family offices — fewer hurdles but less urgency
  debt: 1.10,         // Debt providers — credit committee process
};

function computePredictedCloseDate(
  investor: Investor,
  avgStageDays: Record<string, number>,
): Date | null {
  const currentIdx = PIPELINE_ORDER.indexOf(investor.status);
  if (currentIdx < 0 || investor.status === 'closed') return null;
  if (investor.status === 'passed' || investor.status === 'dropped') return null;

  const typeMultiplier = TYPE_VELOCITY[investor.type] ?? 1.0;
  // Tier 1 investors tend to move faster (they have dedicated deal teams)
  const tierMultiplier = investor.tier === 1 ? 0.85 : investor.tier === 2 ? 1.0 : 1.15;

  let totalDays = 0;
  for (let i = currentIdx; i < PIPELINE_ORDER.length - 1; i++) {
    const stage = PIPELINE_ORDER[i];
    const baseDays = avgStageDays[stage] ?? DEFAULT_STAGE_DAYS[stage] ?? 14;
    totalDays += baseDays * typeMultiplier * tierMultiplier;
  }

  return addDays(new Date(), totalDays);
}

function determineBottleneck(
  investor: Investor,
  momentum: string,
  meetings: Meeting[],
): string {
  if (investor.status === 'passed' || investor.status === 'dropped') {
    return 'Investor has passed/dropped';
  }
  if (investor.status === 'closed') {
    return 'Already closed';
  }
  if (momentum === 'stalled') {
    const lastMeeting = meetings.sort((a, b) => b.date.localeCompare(a.date))[0];
    const daysSince = lastMeeting ? Math.round(daysBetween(lastMeeting.date, new Date().toISOString())) : null;
    return daysSince ? `Stalled --- no contact in ${daysSince} days` : 'Stalled --- no meetings logged';
  }
  if (momentum === 'decelerating') {
    return 'Momentum decelerating --- enthusiasm or frequency declining';
  }
  if ((investor.enthusiasm || 0) <= 2) {
    return 'Low enthusiasm (score: ' + (investor.enthusiasm || 0) + '/5)';
  }
  if (investor.status === 'identified') {
    return 'Not yet contacted --- need to activate intro path';
  }
  if (investor.status === 'contacted') {
    return 'Awaiting response to outreach';
  }
  if (investor.status === 'met' || investor.status === 'engaged') {
    return 'Need to deepen engagement --- push toward DD';
  }
  if (investor.status === 'in_dd') {
    return 'In DD --- accelerate DD response time to reach term sheet';
  }
  if (investor.status === 'term_sheet') {
    return 'Term sheet stage --- negotiate and close';
  }
  return 'Progressing normally';
}

function determineIntervention(investor: Investor, momentum: string): { intervention: string; timeCost: string } {
  if (momentum === 'stalled') {
    return {
      intervention: `Re-engage with milestone update and propose call within 48h`,
      timeCost: '30min prep + 15min call',
    };
  }

  switch (investor.status) {
    case 'identified':
      return {
        intervention: `Activate warm intro through ${investor.warm_path || 'available path'}`,
        timeCost: '15min outreach',
      };
    case 'contacted':
      return {
        intervention: 'Send tailored one-pager and follow up',
        timeCost: '15min prep + email',
      };
    case 'nda_signed':
    case 'meeting_scheduled':
      return {
        intervention: 'Schedule management presentation with full deck',
        timeCost: '30min prep + 1hr meeting',
      };
    case 'met':
      return {
        intervention: 'Send follow-up materials and propose deep dive on model',
        timeCost: '30min prep + 30min call',
      };
    case 'engaged':
      return {
        intervention: 'Push for DD start --- propose structured DD timeline and data room access',
        timeCost: '30min call',
      };
    case 'in_dd':
      return {
        intervention: 'Accelerate DD responses and push for term sheet timeline',
        timeCost: '1hr prep + 30min call',
      };
    case 'term_sheet':
      return {
        intervention: 'Negotiate key terms and push for close',
        timeCost: '2hr meeting + 1hr prep',
      };
    default:
      return {
        intervention: 'Review and determine next step',
        timeCost: '15min review',
      };
  }
}

// The probability lift if we successfully accelerate by one stage
function estimateProbabilityLift(currentStatus: string): number {
  const currentIdx = PIPELINE_ORDER.indexOf(currentStatus);
  if (currentIdx < 0 || currentIdx >= PIPELINE_ORDER.length - 1) return 0;
  const nextStatus = PIPELINE_ORDER[currentIdx + 1];
  return (STATUS_WEIGHT[nextStatus] ?? 0) - (STATUS_WEIGHT[currentStatus] ?? 0);
}

// ---------------------------------------------------------------------------
// Main GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const db = getClient();

    const [investorRows, meetingRows, activityRows, configRow] = await Promise.all([
      db.execute(`SELECT * FROM investors ORDER BY tier ASC, name ASC`),
      db.execute(`SELECT * FROM meetings ORDER BY date DESC`),
      db.execute(`
        SELECT investor_id, detail, created_at FROM activity_log
        WHERE event_type = 'status_changed'
        ORDER BY created_at ASC
      `),
      db.execute(`SELECT value FROM config WHERE key = 'raise_config'`),
    ]);

    const investors = investorRows.rows as unknown as Investor[];
    const allMeetings = meetingRows.rows as unknown as Meeting[];
    const activities = activityRows.rows as unknown as Array<{
      investor_id: string; detail: string; created_at: string;
    }>;

    // Parse raise config
    let targetEquityM = 250;
    let targetCloseDate: string | null = null;
    let companyName = 'Aerospacelab';
    if (configRow.rows.length > 0) {
      try {
        const cfg = JSON.parse(configRow.rows[0].value as string);
        targetCloseDate = cfg.target_close || null;
        companyName = cfg.company_name || companyName;
        const eqStr = (cfg.equity_amount || '').replace(/[^0-9.]/g, '');
        if (eqStr) targetEquityM = parseFloat(eqStr);
      } catch { /* ignore */ }
    }

    // Build lookup maps
    const meetingsByInvestor: Record<string, Meeting[]> = {};
    allMeetings.forEach(m => {
      if (!meetingsByInvestor[m.investor_id]) meetingsByInvestor[m.investor_id] = [];
      meetingsByInvestor[m.investor_id].push(m);
    });

    // Compute average stage durations from activity log
    const stageDurations: Record<string, number[]> = {};
    const stageEntryTimes: Record<string, Record<string, string>> = {};
    activities.forEach(a => {
      const detail = a.detail || '';
      let newStatus = '';
      const movedMatch = detail.match(/(?:moved to|status.*?→|->)\s*(\w+)/i);
      if (movedMatch) newStatus = movedMatch[1].toLowerCase();
      if (newStatus && a.investor_id) {
        if (!stageEntryTimes[a.investor_id]) stageEntryTimes[a.investor_id] = {};
        stageEntryTimes[a.investor_id][newStatus] = a.created_at;
      }
    });

    for (const invId of Object.keys(stageEntryTimes)) {
      const entries = stageEntryTimes[invId];
      for (let i = 0; i < PIPELINE_ORDER.length - 1; i++) {
        const stage = PIPELINE_ORDER[i];
        const nextStage = PIPELINE_ORDER[i + 1];
        if (entries[stage] && entries[nextStage]) {
          const days = daysBetween(entries[stage], entries[nextStage]);
          if (days >= 0 && days < 365) {
            if (!stageDurations[stage]) stageDurations[stage] = [];
            stageDurations[stage].push(days);
          }
        }
      }
    }

    const avgStageDays: Record<string, number> = {};
    for (const [stage, durations] of Object.entries(stageDurations)) {
      if (durations.length > 0) {
        avgStageDays[stage] = durations.reduce((a, b) => a + b, 0) / durations.length;
      }
    }

    // Filter active investors (not passed/dropped)
    const activeInvestors = investors.filter(i => !['passed', 'dropped'].includes(i.status));

    // Compute per-investor forecasts
    const investorForecasts: InvestorForecast[] = [];

    for (const inv of activeInvestors) {
      const meetings = meetingsByInvestor[inv.id] || [];
      const { momentum } = computeMomentumScore(inv, meetings);

      const closeProbability = computeCloseProbability(inv, momentum, meetings);
      const expectedCheck = computeExpectedCheck(inv);
      const expectedValue = closeProbability * expectedCheck;
      const predictedClose = computePredictedCloseDate(inv, avgStageDays);
      const bottleneck = determineBottleneck(inv, momentum, meetings);

      investorForecasts.push({
        id: inv.id,
        name: inv.name,
        tier: inv.tier,
        type: inv.type,
        status: inv.status,
        enthusiasm: inv.enthusiasm || 0,
        momentum,
        checkSizeRange: inv.check_size_range,
        expectedCheck,
        closeProbability: Math.round(closeProbability * 1000) / 10, // percentage with 1 decimal
        expectedValue: Math.round(expectedValue * 10) / 10,
        predictedCloseDate: predictedClose ? predictedClose.toISOString().split('T')[0] : null,
        bottleneck,
      });
    }

    // Sort by expected value descending
    investorForecasts.sort((a, b) => b.expectedValue - a.expectedValue);

    // Aggregate forecasts
    const totalExpected = investorForecasts.reduce((s, f) => s + f.expectedValue, 0);
    const baseCase = Math.round(totalExpected * 10) / 10;

    // Best case: all engaged+ investors close at midpoint check
    const bestCase = Math.round(
      investorForecasts
        .filter(f => ['engaged', 'in_dd', 'term_sheet', 'closed'].includes(f.status))
        .reduce((s, f) => s + f.expectedCheck, 0) * 10
    ) / 10;

    // Worst case: only term_sheet+ investors close
    const worstCase = Math.round(
      investorForecasts
        .filter(f => ['term_sheet', 'closed'].includes(f.status))
        .reduce((s, f) => s + f.expectedCheck, 0) * 10
    ) / 10;

    const shortfall = baseCase < targetEquityM ? Math.round((targetEquityM - baseCase) * 10) / 10 : null;

    // Overall close probability (Monte Carlo-like: prob of reaching target)
    // Simplified: use sum of expected values / target as a proxy
    const closeProbabilityOverall = Math.min(100, Math.round((baseCase / targetEquityM) * 100));

    // Estimated close date (weighted average by expected value)
    let estimatedCloseDate: string | null = null;
    const forecastsWithDates = investorForecasts.filter(f => f.predictedCloseDate && f.expectedValue > 0);
    if (forecastsWithDates.length > 0) {
      const weightedSum = forecastsWithDates.reduce((s, f) => {
        return s + new Date(f.predictedCloseDate!).getTime() * f.expectedValue;
      }, 0);
      const totalWeight = forecastsWithDates.reduce((s, f) => s + f.expectedValue, 0);
      if (totalWeight > 0) {
        const avgTimestamp = weightedSum / totalWeight;
        estimatedCloseDate = new Date(avgTimestamp).toISOString().split('T')[0];
      }
    }

    // On track assessment
    let onTrack = true;
    if (shortfall && shortfall > targetEquityM * 0.1) {
      onTrack = false;
    }
    if (targetCloseDate && estimatedCloseDate) {
      if (new Date(estimatedCloseDate) > new Date(targetCloseDate)) {
        onTrack = false;
      }
    }

    // Gap analysis: investors who could close the gap if accelerated
    const gapInvestors: GapInvestor[] = [];
    if (shortfall && shortfall > 0) {
      // Find investors not yet at engaged+ who have significant check sizes
      const candidatesForAcceleration = investorForecasts
        .filter(f => !['closed', 'term_sheet', 'passed', 'dropped'].includes(f.status))
        .filter(f => f.expectedCheck > 0)
        .sort((a, b) => {
          // Sort by potential impact: (accelerated expected value - current) / time cost
          const aLift = estimateProbabilityLift(a.status) * a.expectedCheck;
          const bLift = estimateProbabilityLift(b.status) * b.expectedCheck;
          return bLift - aLift;
        });

      for (const cand of candidatesForAcceleration.slice(0, 8)) {
        const inv = activeInvestors.find(i => i.id === cand.id)!;
        const liftProb = estimateProbabilityLift(cand.status);
        const potentialExpected = Math.round((cand.closeProbability / 100 + liftProb) * cand.expectedCheck * 10) / 10;
        const { intervention, timeCost } = determineIntervention(inv, cand.momentum);

        gapInvestors.push({
          id: cand.id,
          name: cand.name,
          tier: cand.tier,
          status: cand.status,
          currentExpected: cand.expectedValue,
          potentialExpected,
          intervention,
          timeCost,
          impactDelta: Math.round((potentialExpected - cand.expectedValue) * 10) / 10,
        });
      }

      // Sort by impact delta descending
      gapInvestors.sort((a, b) => b.impactDelta - a.impactDelta);
    }

    // Critical path: minimum viable set to reach target
    const sortedByExpectedCheck = [...investorForecasts]
      .filter(f => f.closeProbability > 20) // only somewhat likely
      .sort((a, b) => b.expectedCheck - a.expectedCheck);

    let cumulative = 0;
    const minimumViableSet: string[] = [];
    for (const f of sortedByExpectedCheck) {
      if (cumulative >= targetEquityM) break;
      minimumViableSet.push(f.name);
      cumulative += f.expectedCheck;
    }

    // Risk scenarios
    const risks: RiskItem[] = [];

    // 1. Concentration risk
    const topInvestorExpected = investorForecasts[0];
    if (topInvestorExpected && topInvestorExpected.expectedValue > baseCase * 0.3) {
      risks.push({
        description: `High concentration: ${topInvestorExpected.name} represents ${Math.round((topInvestorExpected.expectedValue / baseCase) * 100)}% of expected commitments`,
        probability: 'Medium',
        impact: `If ${topInvestorExpected.name} passes, shortfall increases by €${Math.round(topInvestorExpected.expectedValue)}M`,
        mitigation: 'Diversify pipeline --- add 3-5 more investors at similar check sizes',
      });
    }

    // 2. Timeline risk
    if (targetCloseDate) {
      const daysToTarget = daysBetween(new Date(), targetCloseDate);
      const investorsNotOnTime = investorForecasts.filter(
        f => f.predictedCloseDate && new Date(f.predictedCloseDate) > new Date(targetCloseDate!)
      );
      if (investorsNotOnTime.length > 0) {
        risks.push({
          description: `${investorsNotOnTime.length} investor(s) predicted to close after target date (${targetCloseDate})`,
          probability: daysToTarget < 60 ? 'High' : 'Medium',
          impact: `€${Math.round(investorsNotOnTime.reduce((s, f) => s + f.expectedValue, 0))}M at risk of missing timeline`,
          mitigation: 'Accelerate DD for late investors or identify faster-moving alternatives',
        });
      }
    }

    // 3. Pipeline depth risk
    const engagedPlusCount = investorForecasts.filter(
      f => ['engaged', 'in_dd', 'term_sheet', 'closed'].includes(f.status)
    ).length;
    if (engagedPlusCount < 3) {
      risks.push({
        description: `Thin advanced pipeline: only ${engagedPlusCount} investor(s) at engaged+ stage`,
        probability: 'High',
        impact: 'Insufficient competitive tension --- may result in weaker terms',
        mitigation: 'Accelerate top-of-funnel investors through to engagement stage',
      });
    }

    // 4. Enthusiasm risk
    const lowEnthusiasm = investorForecasts.filter(f => f.enthusiasm > 0 && f.enthusiasm <= 2);
    if (lowEnthusiasm.length > 3) {
      risks.push({
        description: `${lowEnthusiasm.length} investors with low enthusiasm (2/5 or below)`,
        probability: 'Medium',
        impact: 'Low-enthusiasm investors rarely convert --- pipeline value may be overstated',
        mitigation: 'Focus energy on high-enthusiasm investors; consider dropping low-conviction leads',
      });
    }

    // 5. Stalled momentum risk
    const stalledCount = investorForecasts.filter(f => f.momentum === 'stalled').length;
    if (stalledCount > 0) {
      risks.push({
        description: `${stalledCount} investor(s) with stalled momentum --- at risk of going cold`,
        probability: 'High',
        impact: `€${Math.round(investorForecasts.filter(f => f.momentum === 'stalled').reduce((s, f) => s + f.expectedValue, 0))}M expected value at risk`,
        mitigation: 'Immediate re-engagement with value-add updates for each stalled investor',
      });
    }

    // Health status
    let healthStatus: 'green' | 'yellow' | 'red' = 'green';
    if (shortfall && shortfall > targetEquityM * 0.3) {
      healthStatus = 'red';
    } else if (shortfall && shortfall > 0) {
      healthStatus = 'yellow';
    }
    if (!onTrack && healthStatus === 'green') {
      healthStatus = 'yellow';
    }

    // Compute health message
    let healthMessage: string;
    if (healthStatus === 'green') {
      healthMessage = `On track to close €${targetEquityM}M${targetCloseDate ? ` by ${targetCloseDate}` : ''}`;
    } else if (healthStatus === 'yellow') {
      const interventionCount = gapInvestors.filter(g => g.impactDelta > 5).length;
      healthMessage = `€${shortfall ?? 0}M shortfall at current pace --- ${interventionCount > 0 ? `${interventionCount} intervention(s) needed` : 'acceleration required'}`;
    } else {
      healthMessage = `Unlikely to close at current pace --- major pipeline restructuring needed`;
    }

    return NextResponse.json({
      target: targetEquityM,
      targetCloseDate,
      companyName,
      healthStatus,
      healthMessage,
      forecast: {
        best: bestCase,
        base: baseCase,
        worst: worstCase,
      },
      shortfall,
      closeProbability: closeProbabilityOverall,
      estimatedCloseDate,
      onTrack,
      investorForecasts,
      gapInvestors,
      criticalPath: {
        minimumViableSet,
        totalIfAllClose: Math.round(cumulative * 10) / 10,
      },
      risks,
      summary: {
        totalActive: activeInvestors.length,
        totalPassed: investors.filter(i => ['passed', 'dropped'].includes(i.status)).length,
        avgCloseProbability: investorForecasts.length > 0
          ? Math.round(investorForecasts.reduce((s, f) => s + f.closeProbability, 0) / investorForecasts.length * 10) / 10
          : 0,
        medianExpectedCheck: investorForecasts.length > 0
          ? investorForecasts.filter(f => f.expectedCheck > 0).sort((a, b) => a.expectedCheck - b.expectedCheck)[
              Math.floor(investorForecasts.filter(f => f.expectedCheck > 0).length / 2)
            ]?.expectedCheck ?? 0
          : 0,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stress test computation error:', error);
    return NextResponse.json(
      { error: 'Failed to compute stress test', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

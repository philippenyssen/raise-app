import { NextResponse } from 'next/server';
import { getClient } from '@/lib/api-helpers';

/**
 * Fundraise Benchmarking API
 *
 * Computes your fundraise execution metrics and compares them against
 * sector benchmarks (Series C space/defense, Series C general tech).
 *
 * Metrics tracked:
 * - Funnel conversion rates (contact→meeting, meeting→engaged, engaged→DD, DD→term sheet)
 * - Time in each stage
 * - Meeting velocity (meetings/week)
 * - Follow-up completion rate
 * - Investor engagement momentum
 * - Pipeline coverage ratio
 *
 * GET /api/benchmarking
 */

// Sector benchmarks — curated from PitchBook, AngelList, Cambridge Associates data
// for Series C raises in defense-tech / space-tech / deep-tech verticals
const BENCHMARKS = {
  seriesC_spaceDef: {
    label: 'Series C Space/Defense',
    conversionRates: {
      contact_to_meeting: { p25: 18, p50: 28, p75: 40 },
      meeting_to_engaged: { p25: 22, p50: 35, p75: 48 },
      engaged_to_dd: { p25: 15, p50: 25, p75: 38 },
      dd_to_termsheet: { p25: 30, p50: 45, p75: 60 },
      termsheet_to_close: { p25: 55, p50: 70, p75: 85 },
    },
    avgDaysInStage: {
      contacted: { p25: 5, p50: 10, p75: 18 },
      meeting_scheduled: { p25: 3, p50: 7, p75: 14 },
      met: { p25: 5, p50: 12, p75: 21 },
      engaged: { p25: 10, p50: 18, p75: 30 },
      in_dd: { p25: 14, p50: 28, p75: 45 },
      term_sheet: { p25: 7, p50: 14, p75: 25 },
    },
    meetingsPerWeek: { p25: 2.5, p50: 4.0, p75: 6.5 },
    followupCompletionRate: { p25: 55, p50: 72, p75: 88 },
    pipelineCoverage: { p25: 2.0, p50: 3.5, p75: 5.0 },
    timeToFirstTermSheet: { p25: 45, p50: 75, p75: 120 },
    totalProcessDays: { p25: 60, p50: 100, p75: 160 },
  },
  seriesC_general: {
    label: 'Series C General Tech',
    conversionRates: {
      contact_to_meeting: { p25: 22, p50: 35, p75: 48 },
      meeting_to_engaged: { p25: 25, p50: 38, p75: 52 },
      engaged_to_dd: { p25: 18, p50: 30, p75: 42 },
      dd_to_termsheet: { p25: 35, p50: 50, p75: 65 },
      termsheet_to_close: { p25: 60, p50: 75, p75: 90 },
    },
    avgDaysInStage: {
      contacted: { p25: 3, p50: 7, p75: 14 },
      meeting_scheduled: { p25: 2, p50: 5, p75: 10 },
      met: { p25: 3, p50: 8, p75: 15 },
      engaged: { p25: 7, p50: 14, p75: 25 },
      in_dd: { p25: 10, p50: 21, p75: 35 },
      term_sheet: { p25: 5, p50: 10, p75: 18 },
    },
    meetingsPerWeek: { p25: 3.5, p50: 5.5, p75: 8.0 },
    followupCompletionRate: { p25: 60, p50: 78, p75: 92 },
    pipelineCoverage: { p25: 2.5, p50: 4.0, p75: 6.0 },
    timeToFirstTermSheet: { p25: 30, p50: 55, p75: 90 },
    totalProcessDays: { p25: 45, p50: 80, p75: 130 },
  },
};

type Percentiles = { p25: number; p50: number; p75: number };

function percentileRank(value: number, bench: Percentiles): number {
  if (value <= bench.p25) return 25 * (value / bench.p25);
  if (value <= bench.p50) return 25 + 25 * ((value - bench.p25) / (bench.p50 - bench.p25));
  if (value <= bench.p75) return 50 + 25 * ((value - bench.p50) / (bench.p75 - bench.p50));
  return Math.min(99, 75 + 25 * ((value - bench.p75) / (bench.p75 * 0.5)));
}

// For "lower is better" metrics (days), invert the percentile
function percentileRankInverse(value: number, bench: Percentiles): number {
  return 100 - percentileRank(value, bench);
}

export async function GET() {
  const t0 = Date.now();
  try {
    const db = getClient();

    const [investorRes, meetingRes, followupRes, configRes, activityRes] = await Promise.all([
      db.execute(`SELECT id, name, status, tier, enthusiasm, type, created_at, updated_at FROM investors WHERE status != 'dropped'`),
      db.execute(`SELECT id, investor_id, date, type FROM meetings ORDER BY date ASC`),
      db.execute(`SELECT id, status, due_at, completed_at FROM followup_actions`),
      db.execute(`SELECT value FROM config WHERE key = 'raise_config'`),
      db.execute(`SELECT id, investor_id, event_type, description, created_at FROM activity_log WHERE event_type IN ('stage_change', 'status_change') ORDER BY created_at ASC`),
    ]);

    const investors = investorRes.rows as unknown as { id: string; name: string; status: string; tier: number; enthusiasm: number; type: string; created_at: string; updated_at: string }[];
    const meetings = meetingRes.rows as unknown as { id: string; investor_id: string; date: string; type: string }[];
    const followups = followupRes.rows as unknown as { id: string; status: string; due_at: string; completed_at: string | null }[];
    const activities = activityRes.rows as unknown as { id: string; investor_id: string; event_type: string; description: string; created_at: string }[];

    // Parse raise start date
    let raiseStartDate: Date;
    if (configRes.rows.length > 0) {
      try {
        const cfg = JSON.parse(configRes.rows[0].value as string);
        raiseStartDate = cfg.start_date ? new Date(cfg.start_date) : new Date(Math.min(...investors.map(i => new Date(i.created_at).getTime())));
      } catch { raiseStartDate = new Date(Math.min(...investors.map(i => new Date(i.created_at).getTime()))); }
    } else {
      raiseStartDate = new Date(Math.min(...investors.map(i => new Date(i.created_at).getTime())));
    }

    const now = new Date();
    const totalDays = Math.max(1, Math.round((now.getTime() - raiseStartDate.getTime()) / 864e5));
    const totalWeeks = Math.max(1, totalDays / 7);

    // --- Funnel conversion rates ---
    const stageOrder = ['identified', 'contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged', 'in_dd', 'term_sheet', 'closed'];
    function highWatermark(inv: typeof investors[0]): number {
      const current = stageOrder.indexOf(inv.status);
      // Check activity log for any past stage that was higher
      const pastStages = activities
        .filter(a => a.investor_id === inv.id)
        .map(a => {
          const match = a.description.match(/→\s*(\w+)/);
          return match ? stageOrder.indexOf(match[1]) : -1;
        });
      return Math.max(current, ...pastStages);
    }

    const totalInvestors = investors.length;
    const contacted = investors.filter(i => highWatermark(i) >= stageOrder.indexOf('contacted')).length;
    const meetingReached = investors.filter(i => highWatermark(i) >= stageOrder.indexOf('met')).length;
    const engaged = investors.filter(i => highWatermark(i) >= stageOrder.indexOf('engaged')).length;
    const inDD = investors.filter(i => highWatermark(i) >= stageOrder.indexOf('in_dd')).length;
    const termSheet = investors.filter(i => highWatermark(i) >= stageOrder.indexOf('term_sheet')).length;
    const closed = investors.filter(i => highWatermark(i) >= stageOrder.indexOf('closed')).length;

    const conversions = {
      contact_to_meeting: contacted > 0 ? Math.round((meetingReached / contacted) * 100) : 0,
      meeting_to_engaged: meetingReached > 0 ? Math.round((engaged / meetingReached) * 100) : 0,
      engaged_to_dd: engaged > 0 ? Math.round((inDD / engaged) * 100) : 0,
      dd_to_termsheet: inDD > 0 ? Math.round((termSheet / inDD) * 100) : 0,
      termsheet_to_close: termSheet > 0 ? Math.round((closed / termSheet) * 100) : 0,
    };

    // --- Days in stage ---
    const stagesForDays = ['contacted', 'meeting_scheduled', 'met', 'engaged', 'in_dd', 'term_sheet'] as const;
    const avgDaysInStage: Record<string, number> = {};
    for (const stage of stagesForDays) {
      const inStage = investors.filter(i => i.status === stage);
      if (inStage.length === 0) { avgDaysInStage[stage] = 0; continue; }
      const total = inStage.reduce((sum, inv) => {
        return sum + Math.round((now.getTime() - new Date(inv.updated_at).getTime()) / 864e5);
      }, 0);
      avgDaysInStage[stage] = Math.round(total / inStage.length);
    }

    // --- Meeting velocity ---
    const meetingsPerWeek = +(meetings.length / totalWeeks).toFixed(1);

    // --- Follow-up completion ---
    const completedFollowups = followups.filter(f => f.status === 'completed').length;
    const totalFollowups = followups.length;
    const followupCompletionRate = totalFollowups > 0 ? Math.round((completedFollowups / totalFollowups) * 100) : 100;

    // --- Pipeline coverage (total pipeline value / target raise) ---
    let targetEquityM = 250;
    if (configRes.rows.length > 0) {
      try {
        const cfg = JSON.parse(configRes.rows[0].value as string);
        const eqStr = (cfg.equity_amount || '').replace(/[^0-9.]/g, '');
        if (eqStr) targetEquityM = parseFloat(eqStr);
      } catch { /* ignore */ }
    }
    const activeInvestors = investors.filter(i => !['passed', 'dropped', 'closed', 'identified'].includes(i.status));
    const avgCheckSize = 25; // M, typical Series C check
    const pipelineCoverage = +((activeInvestors.length * avgCheckSize) / targetEquityM).toFixed(1);

    // --- Time to first term sheet ---
    const termSheetInvestors = investors.filter(i => ['term_sheet', 'closed'].includes(i.status));
    let timeToFirstTermSheet = 0;
    if (termSheetInvestors.length > 0) {
      const earliestTS = Math.min(...termSheetInvestors.map(i => new Date(i.updated_at).getTime()));
      timeToFirstTermSheet = Math.round((earliestTS - raiseStartDate.getTime()) / 864e5);
    }

    // --- Compute percentile rankings against both benchmarks ---
    function computeRankings(bench: typeof BENCHMARKS.seriesC_spaceDef) {
      const convRankings: Record<string, { value: number; percentile: number; vs: Percentiles }> = {};
      for (const [key, benchValues] of Object.entries(bench.conversionRates)) {
        const val = conversions[key as keyof typeof conversions];
        convRankings[key] = { value: val, percentile: Math.round(percentileRank(val, benchValues)), vs: benchValues };
      }

      const stageRankings: Record<string, { value: number; percentile: number; vs: Percentiles }> = {};
      for (const [key, benchValues] of Object.entries(bench.avgDaysInStage)) {
        const val = avgDaysInStage[key] || 0;
        stageRankings[key] = { value: val, percentile: Math.round(percentileRankInverse(val, benchValues)), vs: benchValues };
      }

      return {
        conversions: convRankings,
        stageTime: stageRankings,
        meetingsPerWeek: {
          value: meetingsPerWeek,
          percentile: Math.round(percentileRank(meetingsPerWeek, bench.meetingsPerWeek)),
          vs: bench.meetingsPerWeek,
        },
        followupRate: {
          value: followupCompletionRate,
          percentile: Math.round(percentileRank(followupCompletionRate, bench.followupCompletionRate)),
          vs: bench.followupCompletionRate,
        },
        pipelineCoverage: {
          value: pipelineCoverage,
          percentile: Math.round(percentileRank(pipelineCoverage, bench.pipelineCoverage)),
          vs: bench.pipelineCoverage,
        },
        totalProcessDays: {
          value: totalDays,
          percentile: Math.round(percentileRankInverse(totalDays, bench.totalProcessDays)),
          vs: bench.totalProcessDays,
        },
        timeToFirstTermSheet: {
          value: timeToFirstTermSheet,
          percentile: timeToFirstTermSheet > 0 ? Math.round(percentileRankInverse(timeToFirstTermSheet, bench.timeToFirstTermSheet)) : 0,
          vs: bench.timeToFirstTermSheet,
        },
      };
    }

    const spaceDefRankings = computeRankings(BENCHMARKS.seriesC_spaceDef);
    const generalRankings = computeRankings(BENCHMARKS.seriesC_general);

    // --- Overall score (avg of key percentiles vs space/defense) ---
    const keyPercentiles = [
      spaceDefRankings.conversions.contact_to_meeting?.percentile ?? 50,
      spaceDefRankings.conversions.meeting_to_engaged?.percentile ?? 50,
      spaceDefRankings.meetingsPerWeek.percentile,
      spaceDefRankings.followupRate.percentile,
      spaceDefRankings.pipelineCoverage.percentile,
    ];
    const overallPercentile = Math.round(keyPercentiles.reduce((a, b) => a + b, 0) / keyPercentiles.length);

    // --- Weekly trend (meetings per week over last 8 weeks) ---
    const weeklyTrend: { week: string; meetings: number; newInvestors: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (w * 7 + (now.getDay() === 0 ? 6 : now.getDay() - 1)));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekMeetings = meetings.filter(m => {
        const d = new Date(m.date);
        return d >= weekStart && d <= weekEnd;
      }).length;

      const weekNewInvestors = investors.filter(i => {
        const d = new Date(i.created_at);
        return d >= weekStart && d <= weekEnd;
      }).length;

      weeklyTrend.push({
        week: weekStart.toISOString().slice(0, 10),
        meetings: weekMeetings,
        newInvestors: weekNewInvestors,
      });
    }

    // --- Funnel snapshot ---
    const funnel = {
      total: totalInvestors,
      contacted,
      met: meetingReached,
      engaged,
      in_dd: inDD,
      term_sheet: termSheet,
      closed,
      passed: investors.filter(i => i.status === 'passed').length,
    };

    // --- Strengths and weaknesses ---
    const insights: { type: 'strength' | 'weakness' | 'opportunity'; metric: string; detail: string; percentile: number }[] = [];

    if (spaceDefRankings.meetingsPerWeek.percentile >= 65) {
      insights.push({ type: 'strength', metric: 'Meeting Velocity', detail: `${meetingsPerWeek} meetings/week puts you in the ${spaceDefRankings.meetingsPerWeek.percentile}th percentile`, percentile: spaceDefRankings.meetingsPerWeek.percentile });
    } else if (spaceDefRankings.meetingsPerWeek.percentile < 40) {
      insights.push({ type: 'weakness', metric: 'Meeting Velocity', detail: `${meetingsPerWeek} meetings/week is below median — target ${BENCHMARKS.seriesC_spaceDef.meetingsPerWeek.p50}+`, percentile: spaceDefRankings.meetingsPerWeek.percentile });
    }

    if (spaceDefRankings.followupRate.percentile >= 65) {
      insights.push({ type: 'strength', metric: 'Follow-up Rate', detail: `${followupCompletionRate}% completion rate is top-quartile execution`, percentile: spaceDefRankings.followupRate.percentile });
    } else if (spaceDefRankings.followupRate.percentile < 40) {
      insights.push({ type: 'weakness', metric: 'Follow-up Rate', detail: `${followupCompletionRate}% is below median — dropped follow-ups kill momentum`, percentile: spaceDefRankings.followupRate.percentile });
    }

    for (const [key, data] of Object.entries(spaceDefRankings.conversions)) {
      const label = key.replace(/_/g, ' → ').replace('to', '→');
      if (data.percentile >= 70) {
        insights.push({ type: 'strength', metric: `Conversion: ${label}`, detail: `${data.value}% is ${data.percentile}th percentile`, percentile: data.percentile });
      } else if (data.percentile < 35) {
        insights.push({ type: 'weakness', metric: `Conversion: ${label}`, detail: `${data.value}% vs ${data.vs.p50}% median — identify where investors drop off`, percentile: data.percentile });
      }
    }

    if (pipelineCoverage < 2.5) {
      insights.push({ type: 'opportunity', metric: 'Pipeline Coverage', detail: `${pipelineCoverage}x coverage — aim for 3.5-5.0x to ensure competitive tension`, percentile: spaceDefRankings.pipelineCoverage.percentile });
    }

    return NextResponse.json({
      overallPercentile,
      overallLabel: overallPercentile >= 75 ? 'Top Quartile' : overallPercentile >= 50 ? 'Above Median' : overallPercentile >= 25 ? 'Below Median' : 'Bottom Quartile',
      raiseMetrics: {
        totalDays,
        totalWeeks: +totalWeeks.toFixed(1),
        totalInvestors,
        meetingsPerWeek,
        followupCompletionRate,
        pipelineCoverage,
        timeToFirstTermSheet,
        conversions,
        avgDaysInStage,
      },
      funnel,
      rankings: {
        spaceDef: spaceDefRankings,
        general: generalRankings,
      },
      benchmarks: BENCHMARKS,
      weeklyTrend,
      insights: insights.sort((a, b) => {
        const order = { weakness: 0, opportunity: 1, strength: 2 };
        return order[a.type] - order[b.type];
      }),
      generatedAt: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
        'Server-Timing': `total;dur=${Date.now() - t0}`,
      },
    });
  } catch (error) {
    console.error('[BENCHMARKING_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to compute benchmarks' }, { status: 500 });
  }
}

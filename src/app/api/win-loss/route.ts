import { NextResponse } from 'next/server';
import { computeWinLossPatterns, getFunnelMetrics } from '@/lib/db';
import { getClient, groupByInvestorId } from '@/lib/api-helpers';
import type { InvestorRow, MeetingRow, ObjectionRow } from '@/lib/api-types';

export async function GET() {
  try {
    const db = getClient();

    const [patterns, funnel, allInvestorsResult, allMeetingsResult, objectionsResult] = await Promise.all([
      computeWinLossPatterns(),
      getFunnelMetrics(),
      db.execute(`SELECT id, name, type, tier, status, enthusiasm, check_size_range, notes, created_at, updated_at FROM investors`),
      db.execute(`SELECT id, investor_id, date, type, enthusiasm_score FROM meetings ORDER BY date ASC`),
      db.execute(`SELECT investor_id, objection_topic, objection_text FROM objection_responses`),
    ]);

    const investors = allInvestorsResult.rows as unknown as InvestorRow[];
    const meetings = allMeetingsResult.rows as unknown as MeetingRow[];
    const objections = objectionsResult.rows as unknown as ObjectionRow[];

    const closed = investors.filter(i => i.status === 'closed');
    const passed = investors.filter(i => i.status === 'passed');
    const dropped = investors.filter(i => i.status === 'dropped');

    // ── Pass Reasons Breakdown ──────────────────────────────────────
    // Extract reasons from notes field of passed/dropped investors
    // and from objection topics associated with those investors
    const passReasons: Record<string, number> = {};

    for (const inv of [...passed, ...dropped]) {
      // Check objections for this investor
      const invObjections = objections.filter(o => o.investor_id === inv.id);
      if (invObjections.length > 0) {
        for (const obj of invObjections) {
          const topic = obj.objection_topic || 'Unspecified';
          passReasons[topic] = (passReasons[topic] || 0) + 1;
        }
      } else {
        // Fall back to notes analysis
        const notes = (inv.notes || '').toLowerCase();
        if (notes.includes('valuation') || notes.includes('price') || notes.includes('expensive')) {
          passReasons['Valuation'] = (passReasons['Valuation'] || 0) + 1;
        } else if (notes.includes('sector') || notes.includes('thesis') || notes.includes('fit')) {
          passReasons['Sector Fit'] = (passReasons['Sector Fit'] || 0) + 1;
        } else if (notes.includes('timing') || notes.includes('slow') || notes.includes('wait')) {
          passReasons['Timing'] = (passReasons['Timing'] || 0) + 1;
        } else if (notes.includes('conflict') || notes.includes('portfolio')) {
          passReasons['Portfolio Conflict'] = (passReasons['Portfolio Conflict'] || 0) + 1;
        } else if (notes.includes('size') || notes.includes('check') || notes.includes('allocation')) {
          passReasons['Check Size Mismatch'] = (passReasons['Check Size Mismatch'] || 0) + 1;
        } else if (notes.includes('competition') || notes.includes('competitor')) {
          passReasons['Competitive Concern'] = (passReasons['Competitive Concern'] || 0) + 1;
        } else if (notes.length > 0) {
          passReasons['Other'] = (passReasons['Other'] || 0) + 1;
        } else {
          passReasons['Unknown'] = (passReasons['Unknown'] || 0) + 1;
        }
      }
    }

    const passReasonsRanked = Object.entries(passReasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    // ── Average Days to Pass vs Close ───────────────────────────────
    const msPerDay = 1000 * 60 * 60 * 24;

    const closedDays = closed.map(i => {
      return Math.max(1, Math.round((new Date(i.updated_at || i.created_at).getTime() - new Date(i.created_at).getTime()) / msPerDay));
    });
    const passedDays = passed.map(i => {
      return Math.max(1, Math.round((new Date(i.updated_at || i.created_at).getTime() - new Date(i.created_at).getTime()) / msPerDay));
    });

    const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

    const avgDaysToClose = avg(closedDays);
    const avgDaysToPass = avg(passedDays);

    // ── Conversion Funnel ───────────────────────────────────────────
    const funnelStages = [
      { stage: 'Contacted', count: funnel.contacted, dropOff: 0 },
      { stage: 'Meeting Held', count: funnel.meetings, dropOff: funnel.contacted > 0 ? Math.round(((funnel.contacted - funnel.meetings) / funnel.contacted) * 100) : 0 },
      { stage: 'Engaged', count: funnel.engaged, dropOff: funnel.meetings > 0 ? Math.round(((funnel.meetings - funnel.engaged) / funnel.meetings) * 100) : 0 },
      { stage: 'Due Diligence', count: funnel.in_dd, dropOff: funnel.engaged > 0 ? Math.round(((funnel.engaged - funnel.in_dd) / funnel.engaged) * 100) : 0 },
      { stage: 'Term Sheet', count: funnel.term_sheets, dropOff: funnel.in_dd > 0 ? Math.round(((funnel.in_dd - funnel.term_sheets) / funnel.in_dd) * 100) : 0 },
      { stage: 'Closed', count: funnel.closed, dropOff: funnel.term_sheets > 0 ? Math.round(((funnel.term_sheets - funnel.closed) / funnel.term_sheets) * 100) : 0 },
    ];

    // ── Best/Worst Investor Types by Close Rate ─────────────────────
    const typeStats: Record<string, { total: number; closed: number; passed: number; dropped: number }> = {};
    for (const inv of investors) {
      if (!typeStats[inv.type]) typeStats[inv.type] = { total: 0, closed: 0, passed: 0, dropped: 0 };
      typeStats[inv.type].total++;
      if (inv.status === 'closed') typeStats[inv.type].closed++;
      if (inv.status === 'passed') typeStats[inv.type].passed++;
      if (inv.status === 'dropped') typeStats[inv.type].dropped++;
    }

    const typePerformance = Object.entries(typeStats)
      .map(([type, stats]) => ({
        type,
        total: stats.total,
        closed: stats.closed,
        passed: stats.passed,
        dropped: stats.dropped,
        closeRate: stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0,
        passRate: stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.closeRate - a.closeRate);

    // ── Time by Stage for Wins vs Losses ────────────────────────────
    // Track meeting count per investor
    const meetingsByInvestor = groupByInvestorId(meetings);

    const closedMeetingCounts = closed.map(i => (meetingsByInvestor[i.id] || []).length);
    const passedMeetingCounts = passed.map(i => (meetingsByInvestor[i.id] || []).length);

    const closedEnthusiasms = closed.map(i => {
      const invMeetings = meetingsByInvestor[i.id] || [];
      if (invMeetings.length === 0) return i.enthusiasm;
      const lastMeeting = invMeetings[invMeetings.length - 1];
      return lastMeeting.enthusiasm_score || i.enthusiasm;
    });
    const passedEnthusiasms = passed.map(i => {
      const invMeetings = meetingsByInvestor[i.id] || [];
      if (invMeetings.length === 0) return i.enthusiasm;
      const lastMeeting = invMeetings[invMeetings.length - 1];
      return lastMeeting.enthusiasm_score || i.enthusiasm;
    });

    // ── Key Predictors ──────────────────────────────────────────────
    const predictors: { signal: string; description: string; strength: 'strong' | 'moderate' | 'weak' }[] = [];

    if (closed.length > 0 && passed.length > 0) {
      const avgClosedMeetings = avg(closedMeetingCounts);
      const avgPassedMeetings = avg(passedMeetingCounts);
      if (avgClosedMeetings > avgPassedMeetings * 1.3) {
        predictors.push({
          signal: 'Meeting Count',
          description: `Winners avg ${avgClosedMeetings} meetings vs ${avgPassedMeetings} for passers`,
          strength: avgClosedMeetings > avgPassedMeetings * 2 ? 'strong' : 'moderate',
        });
      }

      const avgClosedEnth = avg(closedEnthusiasms);
      const avgPassedEnth = avg(passedEnthusiasms);
      if (avgClosedEnth - avgPassedEnth >= 1) {
        predictors.push({
          signal: 'Enthusiasm',
          description: `Winners avg ${avgClosedEnth}/5 enthusiasm vs ${avgPassedEnth}/5 for passers`,
          strength: avgClosedEnth - avgPassedEnth >= 2 ? 'strong' : 'moderate',
        });
      }

      const closedTierAvg = avg(closed.map(i => i.tier));
      const passedTierAvg = avg(passed.map(i => i.tier));
      if (closedTierAvg < passedTierAvg) {
        predictors.push({
          signal: 'Tier Quality',
          description: `Winners avg Tier ${closedTierAvg.toFixed(1)} vs Tier ${passedTierAvg.toFixed(1)} for passers`,
          strength: passedTierAvg - closedTierAvg >= 1 ? 'strong' : 'moderate',
        });
      }

      // Speed to first meeting
      const getFirstMeetingDays = (inv: InvestorRow) => {
        const invMeetings = meetingsByInvestor[inv.id] || [];
        if (invMeetings.length === 0) return null;
        const first = invMeetings[0];
        return Math.max(1, Math.round((new Date(first.date).getTime() - new Date(inv.created_at).getTime()) / msPerDay));
      };

      const closedFirstMeeting = closed.map(getFirstMeetingDays).filter((d): d is number => d !== null);
      const passedFirstMeeting = passed.map(getFirstMeetingDays).filter((d): d is number => d !== null);

      if (closedFirstMeeting.length > 0 && passedFirstMeeting.length > 0) {
        const avgClosedFirst = avg(closedFirstMeeting);
        const avgPassedFirst = avg(passedFirstMeeting);
        if (avgClosedFirst < avgPassedFirst) {
          predictors.push({
            signal: 'Speed to First Meeting',
            description: `Winners had first meeting in ${avgClosedFirst} days vs ${avgPassedFirst} for passers`,
            strength: avgPassedFirst > avgClosedFirst * 1.5 ? 'strong' : 'moderate',
          });
        }
      }
    }

    if (predictors.length === 0) {
      predictors.push({
        signal: 'Insufficient Data',
        description: 'More closed/passed outcomes needed to identify reliable predictors',
        strength: 'weak',
      });
    }

    // ── Recommendations ─────────────────────────────────────────────
    const recommendations: string[] = [];

    if (passed.length > closed.length * 2) {
      recommendations.push('Pass rate is high relative to closes. Review qualification criteria to focus on higher-probability investors earlier.');
    }
    if (avgDaysToPass > 0 && avgDaysToPass > 30) {
      recommendations.push(`Investors who pass take avg ${avgDaysToPass} days. Consider implementing earlier go/no-go gates to save time.`);
    }
    if (avgDaysToClose > 60) {
      recommendations.push(`Avg ${avgDaysToClose} days to close is long. Look for process bottlenecks in DD and term sheet stages.`);
    }

    const topPassReason = passReasonsRanked[0];
    if (topPassReason && topPassReason.count >= 2) {
      recommendations.push(`"${topPassReason.reason}" is the top pass reason (${topPassReason.count}x). Develop a targeted counter-narrative or pre-empt this in initial meetings.`);
    }

    const bestType = typePerformance[0];
    const worstType = typePerformance[typePerformance.length - 1];
    if (bestType && worstType && bestType.type !== worstType.type && bestType.closeRate > worstType.closeRate) {
      const typeLabels: Record<string, string> = { vc: 'VCs', growth: 'Growth funds', sovereign: 'Sovereign funds', strategic: 'Strategics', debt: 'Debt providers', family_office: 'Family offices' };
      recommendations.push(`${typeLabels[bestType.type] || bestType.type} close at ${bestType.closeRate}% vs ${typeLabels[worstType.type] || worstType.type} at ${worstType.closeRate}%. Allocate more time to ${typeLabels[bestType.type] || bestType.type}.`);
    }

    if (closed.length === 0 && passed.length === 0) {
      recommendations.push('No terminal outcomes yet. Patterns will emerge as investors close or pass.');
    }

    // ── Median and Distribution ─────────────────────────────────────
    const sorted = (arr: number[]) => [...arr].sort((a, b) => a - b);
    const median = (arr: number[]) => {
      if (arr.length === 0) return 0;
      const s = sorted(arr);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 !== 0 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
    };

    return NextResponse.json({
      patterns,
      passReasons: passReasonsRanked,
      timing: {
        avgDaysToClose,
        avgDaysToPass,
        medianDaysToClose: median(closedDays),
        medianDaysToPass: median(passedDays),
      },
      funnel: funnelStages,
      typePerformance,
      predictors,
      recommendations,
      summary: {
        totalInvestors: investors.length,
        active: investors.filter(i => !['closed', 'passed', 'dropped'].includes(i.status)).length,
        closed: closed.length,
        passed: passed.length,
        dropped: dropped.length,
        overallCloseRate: investors.length > 0 ? Math.round((closed.length / investors.length) * 100) : 0,
        avgClosedMeetings: avg(closedMeetingCounts),
        avgPassedMeetings: avg(passedMeetingCounts),
        avgClosedEnthusiasm: closedEnthusiasms.length > 0 ? Math.round(avg(closedEnthusiasms) * 10) / 10 : 0,
        avgPassedEnthusiasm: passedEnthusiasms.length > 0 ? Math.round(avg(passedEnthusiasms) * 10) / 10 : 0,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Win/Loss API error:', error);
    return NextResponse.json(
      { error: 'Failed to compute win/loss analysis', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

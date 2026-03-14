import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:raise.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

// Pipeline stage ordering for forward/backward detection
const PIPELINE_ORDER = [
  'identified', 'contacted', 'nda_signed', 'meeting_scheduled',
  'met', 'engaged', 'in_dd', 'term_sheet', 'closed',
];

function stageIndex(status: string): number {
  const idx = PIPELINE_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
}

// Get Monday of the week containing a given date
function getWeekStart(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Format a date as YYYY-MM-DD for week label
function weekLabel(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Generate the last N week start dates (most recent last)
function getLastNWeeks(n: number): Date[] {
  const now = new Date();
  const currentWeekStart = getWeekStart(now);
  const weeks: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const ws = new Date(currentWeekStart);
    ws.setDate(ws.getDate() - i * 7);
    weeks.push(ws);
  }
  return weeks;
}

// Determine which week bucket a date falls into
function dateToWeekIndex(d: Date, weeks: Date[]): number {
  const ts = d.getTime();
  for (let i = weeks.length - 1; i >= 0; i--) {
    const weekEnd = new Date(weeks[i]);
    weekEnd.setDate(weekEnd.getDate() + 7);
    if (ts >= weeks[i].getTime() && ts < weekEnd.getTime()) {
      return i;
    }
  }
  return -1;
}

interface InvestorRow {
  id: string;
  name: string;
  type: string;
  tier: number;
  status: string;
  enthusiasm: number;
  created_at: string;
  updated_at: string;
}

interface MeetingRow {
  id: string;
  investor_id: string;
  investor_name: string;
  date: string;
  type: string;
  enthusiasm_score: number;
  status_after: string;
  created_at: string;
}

interface ActivityRow {
  id: string;
  event_type: string;
  subject: string;
  detail: string;
  investor_id: string;
  investor_name: string;
  created_at: string;
}

interface TaskRow {
  id: string;
  investor_id: string;
  status: string;
  updated_at: string;
  created_at: string;
}

interface FollowupRow {
  id: string;
  investor_id: string;
  status: string;
  completed_at: string | null;
  created_at: string;
}

export async function GET() {
  try {
    const db = getClient();
    const NUM_WEEKS = 8;
    const weeks = getLastNWeeks(NUM_WEEKS);
    const cutoffDate = weeks[0].toISOString();

    // Fetch all relevant data in parallel
    const [
      investorRows,
      meetingRows,
      activityRows,
      taskRows,
      followupRows,
    ] = await Promise.all([
      db.execute(`
        SELECT id, name, type, tier, status, enthusiasm, created_at, updated_at
        FROM investors
        WHERE status NOT IN ('passed', 'dropped')
        ORDER BY tier ASC, name ASC
      `),
      db.execute({
        sql: `
          SELECT id, investor_id, investor_name, date, type, enthusiasm_score, status_after, created_at
          FROM meetings
          WHERE date >= ?
          ORDER BY date ASC
        `,
        args: [cutoffDate],
      }),
      db.execute({
        sql: `
          SELECT id, event_type, subject, detail, investor_id, investor_name, created_at
          FROM activity_log
          WHERE created_at >= ?
          ORDER BY created_at ASC
        `,
        args: [cutoffDate],
      }),
      db.execute({
        sql: `
          SELECT id, investor_id, status, updated_at, created_at
          FROM tasks
          WHERE updated_at >= ? OR created_at >= ?
        `,
        args: [cutoffDate, cutoffDate],
      }),
      db.execute({
        sql: `
          SELECT id, investor_id, status, completed_at, created_at
          FROM followup_actions
          WHERE created_at >= ? OR completed_at >= ?
        `,
        args: [cutoffDate, cutoffDate],
      }),
    ]);

    const investors = investorRows.rows as unknown as InvestorRow[];
    const meetings = meetingRows.rows as unknown as MeetingRow[];
    const activities = activityRows.rows as unknown as ActivityRow[];
    const tasks = taskRows.rows as unknown as TaskRow[];
    const followups = followupRows.rows as unknown as FollowupRow[];

    // ═══════════════════════════════════════════════════════════════════
    // 1. INVESTOR MOMENTUM MATRIX
    // ═══════════════════════════════════════════════════════════════════

    // Pre-index data by investor and week
    const meetingsByInvWeek: Record<string, Record<number, number>> = {};
    meetings.forEach(m => {
      const wi = dateToWeekIndex(new Date(m.date), weeks);
      if (wi < 0) return;
      if (!meetingsByInvWeek[m.investor_id]) meetingsByInvWeek[m.investor_id] = {};
      meetingsByInvWeek[m.investor_id][wi] = (meetingsByInvWeek[m.investor_id][wi] || 0) + 1;
    });

    // Status changes by investor and week
    const statusChangesByInvWeek: Record<string, Record<number, { forward: number; backward: number }>> = {};
    activities.forEach(a => {
      if (a.event_type !== 'status_changed' || !a.investor_id) return;
      const wi = dateToWeekIndex(new Date(a.created_at), weeks);
      if (wi < 0) return;

      // Parse direction from detail
      const detail = a.detail || '';
      let direction: 'forward' | 'backward' | 'unknown' = 'unknown';

      // Try to extract old->new status
      const arrowMatch = detail.match(/(\w+)\s*(?:→|->)\s*(\w+)/);
      if (arrowMatch) {
        const oldIdx = stageIndex(arrowMatch[1].toLowerCase());
        const newIdx = stageIndex(arrowMatch[2].toLowerCase());
        direction = newIdx > oldIdx ? 'forward' : newIdx < oldIdx ? 'backward' : 'unknown';
      } else {
        // "Moved to X" — assume forward
        const movedMatch = detail.match(/moved to (\w+)/i);
        if (movedMatch) direction = 'forward';
      }

      if (!statusChangesByInvWeek[a.investor_id]) statusChangesByInvWeek[a.investor_id] = {};
      if (!statusChangesByInvWeek[a.investor_id][wi]) statusChangesByInvWeek[a.investor_id][wi] = { forward: 0, backward: 0 };
      if (direction === 'forward') statusChangesByInvWeek[a.investor_id][wi].forward++;
      else if (direction === 'backward') statusChangesByInvWeek[a.investor_id][wi].backward++;
      else statusChangesByInvWeek[a.investor_id][wi].forward++; // default: assume forward
    });

    // Enthusiasm changes by investor and week
    const enthusiasmByInvWeek: Record<string, Record<number, { delta: number }>> = {};
    // Group meetings by investor, ordered by date, compute deltas
    const meetingsByInvestor: Record<string, MeetingRow[]> = {};
    meetings.forEach(m => {
      if (!meetingsByInvestor[m.investor_id]) meetingsByInvestor[m.investor_id] = [];
      meetingsByInvestor[m.investor_id].push(m);
    });
    Object.entries(meetingsByInvestor).forEach(([invId, mtgs]) => {
      mtgs.sort((a, b) => a.date.localeCompare(b.date));
      for (let i = 1; i < mtgs.length; i++) {
        const delta = mtgs[i].enthusiasm_score - mtgs[i - 1].enthusiasm_score;
        if (delta !== 0) {
          const wi = dateToWeekIndex(new Date(mtgs[i].date), weeks);
          if (wi < 0) continue;
          if (!enthusiasmByInvWeek[invId]) enthusiasmByInvWeek[invId] = {};
          if (!enthusiasmByInvWeek[invId][wi]) enthusiasmByInvWeek[invId][wi] = { delta: 0 };
          enthusiasmByInvWeek[invId][wi].delta += delta;
        }
      }
    });

    // Tasks completed by investor and week
    const tasksCompletedByInvWeek: Record<string, Record<number, number>> = {};
    tasks.forEach(t => {
      if (t.status !== 'done' || !t.investor_id) return;
      const date = t.updated_at || t.created_at;
      const wi = dateToWeekIndex(new Date(date), weeks);
      if (wi < 0) return;
      if (!tasksCompletedByInvWeek[t.investor_id]) tasksCompletedByInvWeek[t.investor_id] = {};
      tasksCompletedByInvWeek[t.investor_id][wi] = (tasksCompletedByInvWeek[t.investor_id][wi] || 0) + 1;
    });

    // Follow-ups completed by investor and week
    const followupsCompletedByInvWeek: Record<string, Record<number, number>> = {};
    followups.forEach(f => {
      if (f.status !== 'completed' || !f.investor_id) return;
      const date = f.completed_at || f.created_at;
      const wi = dateToWeekIndex(new Date(date), weeks);
      if (wi < 0) return;
      if (!followupsCompletedByInvWeek[f.investor_id]) followupsCompletedByInvWeek[f.investor_id] = {};
      followupsCompletedByInvWeek[f.investor_id][wi] = (followupsCompletedByInvWeek[f.investor_id][wi] || 0) + 1;
    });

    // Build momentum matrix
    const weekLabels = weeks.map(w => weekLabel(w));

    const matrix = investors.map(inv => {
      const weeklyScores = weeks.map((_, wi) => {
        let score = 0;

        // Meetings: +15 each
        const meetingCount = meetingsByInvWeek[inv.id]?.[wi] || 0;
        score += meetingCount * 15;

        // Status changes: +20 forward, -10 backward
        const statusChanges = statusChangesByInvWeek[inv.id]?.[wi];
        if (statusChanges) {
          score += statusChanges.forward * 20;
          score -= statusChanges.backward * 10;
        }

        // Enthusiasm changes: +10 per point up, -15 per point down
        const enthDelta = enthusiasmByInvWeek[inv.id]?.[wi]?.delta || 0;
        if (enthDelta > 0) score += enthDelta * 10;
        else if (enthDelta < 0) score += enthDelta * 15; // negative * 15 = negative contribution

        // Tasks completed: +5 each
        const taskCount = tasksCompletedByInvWeek[inv.id]?.[wi] || 0;
        score += taskCount * 5;

        // Follow-ups completed: +8 each
        const followupCount = followupsCompletedByInvWeek[inv.id]?.[wi] || 0;
        score += followupCount * 8;

        // Cap at 0-100
        return {
          week: weekLabels[wi],
          score: Math.max(0, Math.min(100, score)),
        };
      });

      return {
        investorId: inv.id,
        investorName: inv.name,
        type: inv.type,
        tier: inv.tier,
        weeklyScores,
      };
    });

    // Sort by current week momentum (descending)
    matrix.sort((a, b) => {
      const aScore = a.weeklyScores[a.weeklyScores.length - 1]?.score || 0;
      const bScore = b.weeklyScores[b.weeklyScores.length - 1]?.score || 0;
      return bScore - aScore;
    });

    // ═══════════════════════════════════════════════════════════════════
    // 2. COHORT PATTERNS
    // ═══════════════════════════════════════════════════════════════════

    const typeGroups: Record<string, typeof matrix> = {};
    matrix.forEach(inv => {
      if (!typeGroups[inv.type]) typeGroups[inv.type] = [];
      typeGroups[inv.type].push(inv);
    });

    const cohorts = Object.entries(typeGroups).map(([type, members]) => {
      const weeklyAvg = weekLabels.map((wl, wi) => {
        const scores = members.map(m => m.weeklyScores[wi]?.score || 0);
        const avg = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;
        return { week: wl, score: avg };
      });

      // Determine trend: compare last 2 weeks average to previous 2 weeks average
      const recentAvg = weeklyAvg.length >= 2
        ? (weeklyAvg[weeklyAvg.length - 1].score + weeklyAvg[weeklyAvg.length - 2].score) / 2
        : weeklyAvg[weeklyAvg.length - 1]?.score || 0;
      const earlierAvg = weeklyAvg.length >= 4
        ? (weeklyAvg[weeklyAvg.length - 3].score + weeklyAvg[weeklyAvg.length - 4].score) / 2
        : weeklyAvg.length >= 3
          ? weeklyAvg[weeklyAvg.length - 3].score
          : 0;

      const diff = recentAvg - earlierAvg;
      let trend: 'heating' | 'cooling' | 'stable' = 'stable';
      if (diff > 5) trend = 'heating';
      else if (diff < -5) trend = 'cooling';

      return { type, weeklyAvg, trend, memberCount: members.length };
    });

    // ═══════════════════════════════════════════════════════════════════
    // 3. MOMENTUM ANOMALIES
    // ═══════════════════════════════════════════════════════════════════

    const TYPE_LABELS: Record<string, string> = {
      vc: 'VC',
      growth: 'Growth VC',
      sovereign: 'Sovereign Fund',
      strategic: 'Strategic',
      debt: 'Debt Provider',
      family_office: 'Family Office',
    };

    const anomalies: {
      investorId: string;
      investorName: string;
      type: string;
      deviation: number;
      direction: 'above' | 'below';
      message: string;
    }[] = [];

    // For each investor, compare their current week score to their cohort average
    matrix.forEach(inv => {
      const cohort = cohorts.find(c => c.type === inv.type);
      if (!cohort || cohort.memberCount < 2) return;

      const currentScore = inv.weeklyScores[inv.weeklyScores.length - 1]?.score || 0;
      const cohortCurrentAvg = cohort.weeklyAvg[cohort.weeklyAvg.length - 1]?.score || 0;
      const deviation = currentScore - cohortCurrentAvg;
      const typeLabel = TYPE_LABELS[inv.type] || inv.type;

      if (Math.abs(deviation) >= 15) {
        const direction: 'above' | 'below' = deviation > 0 ? 'above' : 'below';
        const absDeviation = Math.abs(Math.round(deviation));

        let message: string;
        if (direction === 'above') {
          message = `${inv.investorName} is ${absDeviation}pts above avg ${typeLabel} momentum — unusually engaged`;
        } else {
          message = `${inv.investorName} is ${absDeviation}pts below avg ${typeLabel} momentum — may need attention`;
        }

        anomalies.push({
          investorId: inv.investorId,
          investorName: inv.investorName,
          type: inv.type,
          deviation: Math.round(deviation),
          direction,
          message,
        });
      }
    });

    // Sort anomalies by absolute deviation descending
    anomalies.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

    // ═══════════════════════════════════════════════════════════════════
    // 4. CROSS-INVESTOR SIGNALS
    // ═══════════════════════════════════════════════════════════════════

    const crossSignals: {
      week: string;
      description: string;
      affectedInvestors: string[];
    }[] = [];

    // For each week, check if 3+ investors in same tier dropped momentum
    for (let wi = 1; wi < weeks.length; wi++) {
      const wl = weekLabels[wi];
      const prevWl = weekLabels[wi - 1];

      // Group drops by tier
      const dropsByTier: Record<number, { name: string; drop: number }[]> = {};
      matrix.forEach(inv => {
        const curr = inv.weeklyScores[wi]?.score || 0;
        const prev = inv.weeklyScores[wi - 1]?.score || 0;
        const drop = prev - curr;
        if (drop >= 10) {
          if (!dropsByTier[inv.tier]) dropsByTier[inv.tier] = [];
          dropsByTier[inv.tier].push({ name: inv.investorName, drop });
        }
      });

      Object.entries(dropsByTier).forEach(([tier, drops]) => {
        if (drops.length >= 3) {
          crossSignals.push({
            week: wl,
            description: `${drops.length} Tier ${tier} investors saw momentum drop in week of ${wl} — possible systemic signal (market event? competitor news?)`,
            affectedInvestors: drops.map(d => d.name),
          });
        }
      });

      // Check for type-based drops
      const dropsByType: Record<string, { name: string; drop: number }[]> = {};
      matrix.forEach(inv => {
        const curr = inv.weeklyScores[wi]?.score || 0;
        const prev = inv.weeklyScores[wi - 1]?.score || 0;
        const drop = prev - curr;
        if (drop >= 10) {
          if (!dropsByType[inv.type]) dropsByType[inv.type] = [];
          dropsByType[inv.type].push({ name: inv.investorName, drop });
        }
      });

      Object.entries(dropsByType).forEach(([type, drops]) => {
        if (drops.length >= 3) {
          const typeLabel = TYPE_LABELS[type] || type;
          // Avoid duplicate if already captured by tier
          const existing = crossSignals.find(s => s.week === wl && s.affectedInvestors.some(n => drops.some(d => d.name === n)));
          if (!existing) {
            crossSignals.push({
              week: wl,
              description: `${drops.length} ${typeLabel} investors had momentum drops in week of ${wl} — cohort-wide cooling`,
              affectedInvestors: drops.map(d => d.name),
            });
          }
        }
      });

      // Check follower pattern: if one type spikes, does another follow?
      const spikesByType: Record<string, number> = {};
      cohorts.forEach(c => {
        const currAvg = c.weeklyAvg[wi]?.score || 0;
        const prevAvg = c.weeklyAvg[wi - 1]?.score || 0;
        if (currAvg - prevAvg >= 10) {
          spikesByType[c.type] = currAvg - prevAvg;
        }
      });

      if (wi >= 2) {
        const prevSpikeTypes = new Set<string>();
        cohorts.forEach(c => {
          const prevAvg = c.weeklyAvg[wi - 1]?.score || 0;
          const prevPrevAvg = c.weeklyAvg[wi - 2]?.score || 0;
          if (prevAvg - prevPrevAvg >= 10) {
            prevSpikeTypes.add(c.type);
          }
        });

        Object.entries(spikesByType).forEach(([type, spike]) => {
          // Check if a different type spiked in the previous week
          prevSpikeTypes.forEach(prevType => {
            if (prevType !== type) {
              const prevLabel = TYPE_LABELS[prevType] || prevType;
              const currLabel = TYPE_LABELS[type] || type;
              crossSignals.push({
                week: wl,
                description: `${currLabel} momentum spiked (+${Math.round(spike)}) one week after ${prevLabel} — possible follower pattern`,
                affectedInvestors: (typeGroups[type] || []).map(m => m.investorName),
              });
            }
          });
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5. OVERALL PIPELINE VELOCITY TREND
    // ═══════════════════════════════════════════════════════════════════

    const overallTrend = weekLabels.map((wl, wi) => {
      const scores = matrix.map(inv => inv.weeklyScores[wi]?.score || 0);
      const avg = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
      return { week: wl, score: avg };
    });

    // Determine overall direction
    const recentOverall = overallTrend.length >= 2
      ? (overallTrend[overallTrend.length - 1].score + overallTrend[overallTrend.length - 2].score) / 2
      : overallTrend[overallTrend.length - 1]?.score || 0;
    const earlierOverall = overallTrend.length >= 4
      ? (overallTrend[overallTrend.length - 3].score + overallTrend[overallTrend.length - 4].score) / 2
      : overallTrend.length >= 3
        ? overallTrend[overallTrend.length - 3].score
        : 0;

    const overallDiff = recentOverall - earlierOverall;
    let overallDirection: 'accelerating' | 'stable' | 'decelerating' = 'stable';
    if (overallDiff > 3) overallDirection = 'accelerating';
    else if (overallDiff < -3) overallDirection = 'decelerating';

    return NextResponse.json({
      matrix,
      cohorts,
      anomalies,
      crossSignals,
      overallTrend,
      overallDirection,
      weeks: weekLabels,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Momentum API error:', error);
    return NextResponse.json(
      { error: 'Failed to compute momentum data', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

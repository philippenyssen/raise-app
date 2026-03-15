import { NextResponse } from 'next/server';
import { createAccelerationAction, computeNarrativeSignals } from '@/lib/db';
import { getClient, stageIndex, groupByInvestorId } from '@/lib/api-helpers';
import type { InvestorRow, MeetingRow, ActivityRow, TaskRow, FollowupRow } from '@/lib/api-types';

interface TrajectoryAlert { investorId: string; investorName: string; type: 'critical_warning' | 'early_warning' | 'term_sheet_signal'; currentScore: number; predictedScore21d: number; slopePerWeek: number; daysToThreshold: number | null; recommendedAction: string; }
interface TimingSignal { type: 'competitive_tension' | 'engagement_gap' | 'dd_synchronization'; description: string; investorNames: string[]; urgency: 'high' | 'medium' | 'low'; }

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
    if (ts >= weeks[i].getTime() && ts < weekEnd.getTime()) { return i; }
  }
  return -1;
}

export async function GET() {
  const t0 = Date.now();
  try {
    const db = getClient();
    const NUM_WEEKS = 8;
    const weeks = getLastNWeeks(NUM_WEEKS);
    const cutoffDate = weeks[0].toISOString();

    // Fetch all relevant data in parallel (single meetings query, filter in-memory)
    const [
      investorRows,
      allMeetingRows,
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
      db.execute(`SELECT id, investor_id, investor_name, date, type, enthusiasm_score, status_after, created_at FROM meetings ORDER BY date ASC`),
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
    const allMeetings = allMeetingRows.rows as unknown as MeetingRow[];
    const meetings = allMeetings.filter(m => m.date >= cutoffDate);
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
      meetingsByInvWeek[m.investor_id][wi] = (meetingsByInvWeek[m.investor_id][wi] || 0) + 1;});

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
    const meetingsByInvestor = groupByInvestorId(meetings);
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
      }});

    // Tasks completed by investor and week
    const tasksCompletedByInvWeek: Record<string, Record<number, number>> = {};
    tasks.forEach(t => {
      if (t.status !== 'done' || !t.investor_id) return;
      const date = t.updated_at || t.created_at;
      const wi = dateToWeekIndex(new Date(date), weeks);
      if (wi < 0) return;
      if (!tasksCompletedByInvWeek[t.investor_id]) tasksCompletedByInvWeek[t.investor_id] = {};
      tasksCompletedByInvWeek[t.investor_id][wi] = (tasksCompletedByInvWeek[t.investor_id][wi] || 0) + 1;});

    // Follow-ups completed by investor and week
    const followupsCompletedByInvWeek: Record<string, Record<number, number>> = {};
    followups.forEach(f => {
      if (f.status !== 'completed' || !f.investor_id) return;
      const date = f.completed_at || f.created_at;
      const wi = dateToWeekIndex(new Date(date), weeks);
      if (wi < 0) return;
      if (!followupsCompletedByInvWeek[f.investor_id]) followupsCompletedByInvWeek[f.investor_id] = {};
      followupsCompletedByInvWeek[f.investor_id][wi] = (followupsCompletedByInvWeek[f.investor_id][wi] || 0) + 1;});

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
        };});

      return {
        investorId: inv.id,
        investorName: inv.name,
        type: inv.type,
        tier: inv.tier,
        weeklyScores,
      };});

    // Sort by current week momentum (descending)
    matrix.sort((a, b) => {
      const aScore = a.weeklyScores[a.weeklyScores.length - 1]?.score || 0;
      const bScore = b.weeklyScores[b.weeklyScores.length - 1]?.score || 0;
      return bScore - aScore;});

    // ═══════════════════════════════════════════════════════════════════
    // 2. COHORT PATTERNS
    // ═══════════════════════════════════════════════════════════════════

    const typeGroups: Record<string, typeof matrix> = {};
    matrix.forEach(inv => {
      if (!typeGroups[inv.type]) typeGroups[inv.type] = [];
      typeGroups[inv.type].push(inv);});

    const cohorts = Object.entries(typeGroups).map(([type, members]) => {
      const weeklyAvg = weekLabels.map((wl, wi) => {
        const scores = members.map(m => m.weeklyScores[wi]?.score || 0);
        const avg = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;
        return { week: wl, score: avg };});

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

      return { type, weeklyAvg, trend, memberCount: members.length };});

    // ═══════════════════════════════════════════════════════════════════
    // 3. MOMENTUM ANOMALIES
    // ═══════════════════════════════════════════════════════════════════

    const TYPE_LABELS: Record<string, string> = {
      vc: 'VC',
      growth: 'Growth VC',
      sovereign: 'Sovereign Fund',
      strategic: 'Strategic',
      debt: 'Debt Provider',
      family_office: 'Family Office',};

    const anomalies: { investorId: string; investorName: string; type: string; deviation: number; direction: 'above' | 'below'; message: string }[] = [];

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
          message,});
      }});

    // Sort anomalies by absolute deviation descending
    anomalies.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

    // ═══════════════════════════════════════════════════════════════════
    // 4. CROSS-INVESTOR SIGNALS
    // ═══════════════════════════════════════════════════════════════════

    const crossSignals: { week: string; description: string; affectedInvestors: string[] }[] = [];

    // For each week, check if 3+ investors in same tier dropped momentum
    for (let wi = 1; wi < weeks.length; wi++) {
      const wl = weekLabels[wi];
      // weekLabels[wi - 1] available if needed for cross-week comparison

      // Group drops by tier
      const dropsByTier: Record<number, { name: string; drop: number }[]> = {};
      matrix.forEach(inv => {
        const curr = inv.weeklyScores[wi]?.score || 0;
        const prev = inv.weeklyScores[wi - 1]?.score || 0;
        const drop = prev - curr;
        if (drop >= 10) {
          if (!dropsByTier[inv.tier]) dropsByTier[inv.tier] = [];
          dropsByTier[inv.tier].push({ name: inv.investorName, drop });
        }});

      Object.entries(dropsByTier).forEach(([tier, drops]) => {
        if (drops.length >= 3) {
          crossSignals.push({
            week: wl,
            description: `${drops.length} Tier ${tier} investors saw momentum drop in week of ${wl} — possible systemic signal (market event? competitor news?)`,
            affectedInvestors: drops.map(d => d.name),});
        }});

      // Check for type-based drops
      const dropsByType: Record<string, { name: string; drop: number }[]> = {};
      matrix.forEach(inv => {
        const curr = inv.weeklyScores[wi]?.score || 0;
        const prev = inv.weeklyScores[wi - 1]?.score || 0;
        const drop = prev - curr;
        if (drop >= 10) {
          if (!dropsByType[inv.type]) dropsByType[inv.type] = [];
          dropsByType[inv.type].push({ name: inv.investorName, drop });
        }});

      Object.entries(dropsByType).forEach(([type, drops]) => {
        if (drops.length >= 3) {
          const typeLabel = TYPE_LABELS[type] || type;
          // Avoid duplicate if already captured by tier
          const existing = crossSignals.find(s => s.week === wl && s.affectedInvestors.some(n => drops.some(d => d.name === n)));
          if (!existing) {
            crossSignals.push({
              week: wl,
              description: `${drops.length} ${typeLabel} investors had momentum drops in week of ${wl} — cohort-wide cooling`,
              affectedInvestors: drops.map(d => d.name),});
          }
        }});

      // Check follower pattern: if one type spikes, does another follow?
      const spikesByType: Record<string, number> = {};
      cohorts.forEach(c => {
        const currAvg = c.weeklyAvg[wi]?.score || 0;
        const prevAvg = c.weeklyAvg[wi - 1]?.score || 0;
        if (currAvg - prevAvg >= 10) {
          spikesByType[c.type] = currAvg - prevAvg;
        }});

      if (wi >= 2) {
        const prevSpikeTypes = new Set<string>();
        cohorts.forEach(c => {
          const prevAvg = c.weeklyAvg[wi - 1]?.score || 0;
          const prevPrevAvg = c.weeklyAvg[wi - 2]?.score || 0;
          if (prevAvg - prevPrevAvg >= 10) {
            prevSpikeTypes.add(c.type);
          }});

        Object.entries(spikesByType).forEach(([type, spike]) => {
          // Check if a different type spiked in the previous week
          prevSpikeTypes.forEach(prevType => {
            if (prevType !== type) {
              const prevLabel = TYPE_LABELS[prevType] || prevType;
              const currLabel = TYPE_LABELS[type] || type;
              crossSignals.push({
                week: wl,
                description: `${currLabel} momentum spiked (+${Math.round(spike)}) one week after ${prevLabel} — possible follower pattern`,
                affectedInvestors: (typeGroups[type] || []).map(m => m.investorName),});
            }});});
      }}

    // ═══════════════════════════════════════════════════════════════════
    // 4B. AUTO-ACTION: Anomalies → Acceleration Actions (compounding loop)
    // ═══════════════════════════════════════════════════════════════════

    // When anomalies are detected, auto-create acceleration actions so
    // the insight doesn't just sit in a dashboard — it drives CEO action
    try {
      // Negative anomalies (below cohort) → create acceleration action
      for (const anomaly of anomalies.filter(a => a.direction === 'below' && Math.abs(a.deviation) >= 20)) {
        await createAccelerationAction({ investor_id: anomaly.investorId, investor_name: anomaly.investorName, trigger_type: 'momentum_cliff', action_type: 'warm_reintro', description: `${anomaly.message}. Investigate: competitor news? unresolved objection? internal politics? macro event?`, expected_lift: Math.min(20, Math.abs(anomaly.deviation) * 0.5), confidence: 'medium', status: 'pending', actual_lift: null, executed_at: null });
      }

      // Cross-investor signals (systemic drops) → narrative/strategy review
      const recentCrossSignals = crossSignals.filter(s => {
        const signalDate = new Date(s.week);
        const daysAgo = (Date.now() - signalDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo <= 14; // only action recent signals
      });
      if (recentCrossSignals.length > 0) {
        const latestSignal = recentCrossSignals[0];
        await createAccelerationAction({ investor_id: '', investor_name: 'Pipeline-wide', trigger_type: 'competitive_pressure', action_type: 'competitive_signal', description: `Systemic signal: ${latestSignal.description}. Review: (1) competitive landscape changes, (2) narrative/deck adjustments, (3) market timing. Affected: ${latestSignal.affectedInvestors.join(', ')}.`, expected_lift: 10, confidence: 'low', status: 'pending', actual_lift: null, executed_at: null });
      }
    } catch (e) { console.error('[MOMENTUM_ACCEL]', e instanceof Error ? e.message : e); }

    // ═══════════════════════════════════════════════════════════════════
    // 5. OVERALL PIPELINE VELOCITY TREND
    // ═══════════════════════════════════════════════════════════════════

    const overallTrend = weekLabels.map((wl, wi) => {
      const scores = matrix.map(inv => inv.weeklyScores[wi]?.score || 0);
      const avg = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
      return { week: wl, score: avg };});

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

    // ═══════════════════════════════════════════════════════════════════
    // 6. TRAJECTORY EARLY WARNING SYSTEM
    // ═══════════════════════════════════════════════════════════════════

    const trajectoryAlerts: TrajectoryAlert[] = [];

    for (const inv of matrix) {
      const scores = inv.weeklyScores.filter(ws => ws.score > 0);
      if (scores.length < 3) continue;

      // Linear regression on weekly scores
      const n = scores.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += scores[i].score;
        sumXY += i * scores[i].score;
        sumX2 += i * i;
      }
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      const currentScore = scores[scores.length - 1].score;
      const weeksTo21d = 3; // ~21 days
      const predictedScore21d = Math.max(0, Math.min(100, Math.round(intercept + slope * (n - 1 + weeksTo21d))));
      const slopePerWeek = Math.round(slope * 10) / 10;

      // Calculate days to pass threshold (score < 20)
      let daysToPassThreshold: number | null = null;
      if (slope < 0 && currentScore > 20) {
        const weeksToPass = (20 - currentScore) / slope;
        if (weeksToPass > 0) daysToPassThreshold = Math.round(weeksToPass * 7);
      }

      // Calculate days to term sheet threshold (score > 70)
      let daysToTermSheet: number | null = null;
      if (slope > 0 && currentScore < 70) {
        const weeksToTS = (70 - currentScore) / slope;
        if (weeksToTS > 0) daysToTermSheet = Math.round(weeksToTS * 7);
      }

      if (daysToPassThreshold !== null && daysToPassThreshold <= 7) {
        trajectoryAlerts.push({
          investorId: inv.investorId,
          investorName: inv.investorName,
          type: 'critical_warning',
          currentScore,
          predictedScore21d,
          slopePerWeek,
          daysToThreshold: daysToPassThreshold,
          recommendedAction: `CRITICAL: ${inv.investorName} heading to pass in ~${daysToPassThreshold} days (${slopePerWeek} pts/wk). Immediate CEO call or site visit needed. Consider: (1) Address top unresolved objection, (2) Share new milestone/catalyst, (3) Escalate through warm path.`,
        });

        // Auto-create critical acceleration action
        try {
          await createAccelerationAction({ investor_id: inv.investorId, investor_name: inv.investorName, trigger_type: 'momentum_cliff', action_type: 'escalation', description: `CRITICAL: Trajectory predicts pass in ${daysToPassThreshold} days. Slope: ${slopePerWeek} pts/wk. Immediate intervention required.`, expected_lift: 15, confidence: 'high', status: 'pending', actual_lift: null, executed_at: null });
        } catch (e) { console.error('[MOMENTUM_CLIFF]', e instanceof Error ? e.message : e); }
      } else if (daysToPassThreshold !== null && daysToPassThreshold <= 21) {
        trajectoryAlerts.push({
          investorId: inv.investorId,
          investorName: inv.investorName,
          type: 'early_warning',
          currentScore,
          predictedScore21d,
          slopePerWeek,
          daysToThreshold: daysToPassThreshold,
          recommendedAction: `WARNING: ${inv.investorName} declining at ${slopePerWeek} pts/wk. At this rate, will reach pass threshold in ~${daysToPassThreshold} days. Schedule deep dive or share milestone update within 5 days.`,
        });
      } else if (daysToTermSheet !== null && daysToTermSheet <= 14) {
        trajectoryAlerts.push({
          investorId: inv.investorId,
          investorName: inv.investorName,
          type: 'term_sheet_signal',
          currentScore,
          predictedScore21d,
          slopePerWeek,
          daysToThreshold: daysToTermSheet,
          recommendedAction: `OPPORTUNITY: ${inv.investorName} accelerating at +${slopePerWeek} pts/wk. Predicted to reach term sheet readiness in ~${daysToTermSheet} days. Prepare: (1) term sheet framework, (2) board materials, (3) reference calls.`,
        });
      }}

    // Sort: critical first, then early_warning, then term_sheet_signal
    const alertOrder = { critical_warning: 0, early_warning: 1, term_sheet_signal: 2 };
    trajectoryAlerts.sort((a, b) => (alertOrder[a.type] ?? 9) - (alertOrder[b.type] ?? 9));

    // ═══════════════════════════════════════════════════════════════════
    // 7. CROSS-INVESTOR TIMING CORRELATION
    // ═══════════════════════════════════════════════════════════════════

    const timingSignals: TimingSignal[] = [];

    // Reuse all-meetings from initial parallel batch for timing analysis
    const allMeetingsForTiming = allMeetings as unknown as Array<{ id: string; investor_id: string; investor_name: string; date: string; type: string; status_after: string }>;

    // (a) Meeting clusters: 3+ different-investor meetings within 5 days = competitive tension
    const meetingDates = allMeetingsForTiming.map(m => ({
      date: new Date(m.date),
      investorId: m.investor_id,
      investorName: m.investor_name,
    }));

    for (let i = 0; i < meetingDates.length; i++) {
      const anchor = meetingDates[i];
      const windowEnd = new Date(anchor.date);
      windowEnd.setDate(windowEnd.getDate() + 5);

      const cluster = meetingDates
        .filter(m => m.date >= anchor.date && m.date <= windowEnd)
        .reduce((acc, m) => {
          if (!acc.has(m.investorId)) acc.set(m.investorId, m.investorName);
          return acc;
        }, new Map<string, string>());

      if (cluster.size >= 3) {
        const investorNames = Array.from(cluster.values());
        // Avoid duplicates: check if we already have a competitive_tension signal with same investors
        const alreadyExists = timingSignals.some(
          ts => ts.type === 'competitive_tension' &&
                ts.investorNames.length === investorNames.length &&
                ts.investorNames.every(n => investorNames.includes(n)));
        if (!alreadyExists) {
          timingSignals.push({
            type: 'competitive_tension',
            description: `${cluster.size} different investors met within 5 days around ${anchor.date.toISOString().slice(0, 10)} — competitive tension signal. Use this leverage in conversations.`,
            investorNames,
            urgency: 'high',});
        }}
    }

    // (b) Engagement gaps: investor with meetings, then no meeting for 21+ days = stall risk
    const meetingsByInvestorAll: Record<string, { date: Date; name: string }[]> = {};
    for (const m of allMeetingsForTiming) {
      if (!meetingsByInvestorAll[m.investor_id]) meetingsByInvestorAll[m.investor_id] = [];
      meetingsByInvestorAll[m.investor_id].push({ date: new Date(m.date), name: m.investor_name });
    }

    const now = new Date();
    for (const [invId, invMeetings] of Object.entries(meetingsByInvestorAll)) {
      if (invMeetings.length < 1) continue;
      const sorted = invMeetings.sort((a, b) => a.date.getTime() - b.date.getTime());
      const lastMeeting = sorted[sorted.length - 1];
      const daysSinceLast = (now.getTime() - lastMeeting.date.getTime()) / (1000 * 60 * 60 * 24);

      // Only flag active investors
      const investorRecord = investors.find(inv => inv.id === invId);
      if (!investorRecord) continue;

      if (daysSinceLast >= 21) {
        timingSignals.push({
          type: 'engagement_gap',
          description: `${lastMeeting.name} had ${sorted.length} meeting(s) but none in ${Math.round(daysSinceLast)} days — stall risk. Re-engage with milestone update.`,
          investorNames: [lastMeeting.name],
          urgency: daysSinceLast >= 35 ? 'high' : 'medium',});
      }}

    // (c) DD synchronization: 2+ investors entering DD within 14 days = leverage opportunity
    const ddEntries: { investorId: string; investorName: string; date: Date }[] = [];
    for (const m of allMeetingsForTiming) {
      if (m.status_after === 'in_dd') {
        ddEntries.push({
          investorId: m.investor_id,
          investorName: m.investor_name,
          date: new Date(m.date),});
      }}
    // Deduplicate: keep first DD entry per investor
    const ddByInvestor = new Map<string, { investorName: string; date: Date }>();
    for (const entry of ddEntries) {
      if (!ddByInvestor.has(entry.investorId)) {
        ddByInvestor.set(entry.investorId, { investorName: entry.investorName, date: entry.date });
      }}
    const ddList = Array.from(ddByInvestor.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

    for (let i = 0; i < ddList.length; i++) {
      const windowEnd = new Date(ddList[i].date);
      windowEnd.setDate(windowEnd.getDate() + 14);
      const synchronized = ddList.filter(d => d.date >= ddList[i].date && d.date <= windowEnd);

      if (synchronized.length >= 2) {
        const names = synchronized.map(d => d.investorName);
        const alreadyExists = timingSignals.some(
          ts => ts.type === 'dd_synchronization' &&
                ts.investorNames.every(n => names.includes(n)));
        if (!alreadyExists) {
          timingSignals.push({
            type: 'dd_synchronization',
            description: `${synchronized.length} investors entered DD within 14 days (${ddList[i].date.toISOString().slice(0, 10)} window) — leverage opportunity for competitive term sheet pressure.`,
            investorNames: names,
            urgency: 'high',});
        }}
    }

    // Auto-create acceleration actions for competitive tension signals
    try {
      for (const ts of timingSignals.filter(s => s.type === 'competitive_tension' && s.urgency === 'high')) {
        await createAccelerationAction({ investor_id: '', investor_name: 'Pipeline-wide', trigger_type: 'competitive_pressure', action_type: 'competitive_signal', description: `Timing signal: ${ts.description} Investors: ${ts.investorNames.join(', ')}`, expected_lift: 15, confidence: 'medium', status: 'pending', actual_lift: null, executed_at: null });
      }
    } catch (e) { console.error('[MOMENTUM_TIMING]', e instanceof Error ? e.message : e); }

    // ═══════════════════════════════════════════════════════════════════
    // 8. NARRATIVE DRIFT INTEGRATION
    // ═══════════════════════════════════════════════════════════════════
    // Fetch narrative signals and enrich anomalies/alerts with narrative context
    // when the investor's type is "struggling" (avg enthusiasm < 2.5 or conversion < 20%).

    let narrativeHealth: { investorType: string; avgEnthusiasm: number; conversionRate: number; topObjection: string; topQuestionTopic: string; sampleSize: number; status: 'effective' | 'struggling' | 'insufficient_data' }[] = [];

    try {
      const rawSignals = await computeNarrativeSignals();
      narrativeHealth = rawSignals.map(ns => ({
        ...ns,
        status: (ns.sampleSize < 2
          ? 'insufficient_data'
          : ns.avgEnthusiasm < 2.5 || ns.conversionRate < 20
            ? 'struggling'
            : 'effective') as 'effective' | 'struggling' | 'insufficient_data',
      }));

      // Build a lookup of struggling types
      const strugglingTypes = new Map<string, typeof narrativeHealth[number]>();
      for (const nh of narrativeHealth) {
        if (nh.status === 'struggling') {
          strugglingTypes.set(nh.investorType, nh);
        }}

      // Enrich anomalies with narrative context when their investor type is struggling
      for (const anomaly of anomalies) {
        const signal = strugglingTypes.get(anomaly.type);
        if (signal) {
          (anomaly as unknown as Record<string, unknown>).narrativeContext =
            `Narrative not landing for ${anomaly.type} investors (avg enthusiasm: ${signal.avgEnthusiasm}/5, conversion: ${signal.conversionRate}%). ` +
            `Top objection: "${signal.topObjection}". Top question: "${signal.topQuestionTopic}". ` +
            `Consider adapting pitch for this investor type.`;
        }}

      // Enrich trajectory alerts with narrative context too
      for (const alert of trajectoryAlerts) {
        const invEntry = matrix.find(m => m.investorId === alert.investorId);
        if (!invEntry) continue;
        const signal = strugglingTypes.get(invEntry.type);
        if (signal) {
          (alert as unknown as Record<string, unknown>).narrativeContext =
            `Narrative struggling with ${invEntry.type} investors (avg enthusiasm: ${signal.avgEnthusiasm}/5, conversion: ${signal.conversionRate}%). ` +
            `Consider type-specific pitch adjustments before re-engagement.`;
        }}
    } catch (e) { console.error('[MOMENTUM_NARRATIVE]', e instanceof Error ? e.message : e); }

    return NextResponse.json({
      matrix,
      cohorts,
      anomalies,
      crossSignals,
      trajectoryAlerts,
      timingSignals,
      narrativeHealth,
      overallTrend,
      overallDirection,
      weeks: weekLabels,
      generatedAt: new Date().toISOString(),}, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60', 'Server-Timing': `total;dur=${Date.now() - t0}` } });
  } catch (error) {
    console.error('[MOMENTUM_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to compute momentum data' },
      { status: 500 });
  }}

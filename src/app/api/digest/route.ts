import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/api-helpers';
import type { InvestorRow, MeetingRow, FollowupRow } from '@/lib/api-types';

/**
 * Weekly Digest API
 *
 * Generates a comprehensive weekly fundraise status report:
 * - Pipeline movement (stage changes this week)
 * - Meeting activity (count, types, top investors met)
 * - Follow-up completion rate
 * - New investors added
 * - Risk alerts (stalled, declining enthusiasm)
 * - Key metrics vs. prior week
 * - Priorities for next week
 *
 * GET /api/digest?weeks_back=0 (0 = current week, 1 = last week)
 */
export async function GET(req: NextRequest) {
  const t0 = Date.now();
  try {
    const weeksBack = parseInt(req.nextUrl.searchParams.get('weeks_back') || '0') || 0;

    // Calculate week boundaries (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + mondayOffset - (weeksBack * 7));
    thisMonday.setHours(0, 0, 0, 0);
    const thisSunday = new Date(thisMonday);
    thisSunday.setDate(thisMonday.getDate() + 6);
    thisSunday.setHours(23, 59, 59, 999);

    // Prior week for comparison
    const priorMonday = new Date(thisMonday);
    priorMonday.setDate(thisMonday.getDate() - 7);
    const priorSunday = new Date(thisMonday);
    priorSunday.setDate(thisMonday.getDate() - 1);
    priorSunday.setHours(23, 59, 59, 999);

    const weekStart = thisMonday.toISOString().slice(0, 10);
    const weekEnd = thisSunday.toISOString().slice(0, 10);
    const priorStart = priorMonday.toISOString().slice(0, 10);
    const priorEnd = priorSunday.toISOString().slice(0, 10);

    const db = getClient();

    const [investorRows, meetingRows, priorMeetingRows, followupRows, priorFollowupRows, activityRows, newInvestorRows] = await Promise.all([
      db.execute(`SELECT id, name, tier, status, enthusiasm, type, updated_at, created_at FROM investors WHERE status NOT IN ('dropped')`),
      db.execute({
        sql: `SELECT id, investor_id, date, type, duration_minutes, investor_name, enthusiasm_score
              FROM meetings WHERE date >= ? AND date <= ? ORDER BY date ASC`,
        args: [weekStart, weekEnd],
      }),
      db.execute({
        sql: `SELECT id FROM meetings WHERE date >= ? AND date <= ?`,
        args: [priorStart, priorEnd],
      }),
      db.execute({
        sql: `SELECT id, investor_id, action_type, status, due_at FROM followup_actions
              WHERE due_at >= ? AND due_at <= ? ORDER BY due_at ASC`,
        args: [weekStart, weekEnd],
      }),
      db.execute({
        sql: `SELECT id, status FROM followup_actions WHERE due_at >= ? AND due_at <= ?`,
        args: [priorStart, priorEnd],
      }),
      db.execute({
        sql: `SELECT id, investor_id, event_type, description, created_at FROM activity_log
              WHERE created_at >= ? AND created_at <= ? ORDER BY created_at DESC`,
        args: [weekStart + 'T00:00:00', weekEnd + 'T23:59:59'],
      }),
      db.execute({
        sql: `SELECT id, name, tier, type FROM investors WHERE created_at >= ? AND created_at <= ?`,
        args: [weekStart + 'T00:00:00', weekEnd + 'T23:59:59'],
      }),
    ]);

    const investors = investorRows.rows as unknown as (InvestorRow & { enthusiasm?: number; type?: string; updated_at: string; created_at: string })[];
    const meetings = meetingRows.rows as unknown as (MeetingRow & { investor_name?: string; enthusiasm_score?: number; duration_minutes?: number })[];
    const priorMeetings = priorMeetingRows.rows as unknown as { id: string }[];
    const followups = followupRows.rows as unknown as (FollowupRow & { action_type?: string })[];
    const priorFollowups = priorFollowupRows.rows as unknown as { id: string; status: string }[];
    const activities = activityRows.rows as unknown as { id: string; investor_id: string; event_type: string; description: string; created_at: string }[];
    const newInvestors = newInvestorRows.rows as unknown as { id: string; name: string; tier: number; type: string }[];

    // --- Pipeline snapshot ---
    const stages = ['identified', 'contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged', 'in_dd', 'term_sheet', 'closed', 'passed'];
    const pipelineSnapshot: Record<string, number> = {};
    for (const s of stages) {
      pipelineSnapshot[s] = investors.filter(i => i.status === s).length;
    }
    const totalActive = investors.filter(i => !['passed', 'dropped', 'closed'].includes(i.status)).length;

    // --- Stage changes this week ---
    const stageChanges = activities
      .filter(a => a.event_type === 'stage_change' || a.event_type === 'status_change')
      .map(a => ({
        investorId: a.investor_id,
        description: a.description,
        date: a.created_at.slice(0, 10),
      }));

    // --- Meeting stats ---
    const meetingCount = meetings.length;
    const priorMeetingCount = priorMeetings.length;
    const meetingDelta = meetingCount - priorMeetingCount;
    const uniqueInvestorsMet = new Set(meetings.map(m => m.investor_id)).size;
    const meetingsByType: Record<string, number> = {};
    for (const m of meetings) {
      const t = m.type || 'other';
      meetingsByType[t] = (meetingsByType[t] || 0) + 1;
    }
    const topMeetings = meetings.slice(0, 5).map(m => ({
      investorName: m.investor_name || 'Unknown',
      type: m.type,
      date: m.date.split('T')[0],
      enthusiasm: m.enthusiasm_score,
    }));

    // --- Follow-up stats ---
    const completedFollowups = followups.filter(f => f.status === 'completed').length;
    const totalFollowups = followups.length;
    const completionRate = totalFollowups > 0 ? Math.round((completedFollowups / totalFollowups) * 100) : 100;
    const priorCompleted = priorFollowups.filter(f => f.status === 'completed').length;
    const priorTotal = priorFollowups.length;
    const priorRate = priorTotal > 0 ? Math.round((priorCompleted / priorTotal) * 100) : 100;
    const overdueFollowups = followups.filter(f => f.status === 'pending' && f.due_at && f.due_at < new Date().toISOString()).length;

    // --- Risk alerts ---
    const risks: { type: string; investor: string; detail: string; severity: 'high' | 'medium' }[] = [];

    // Stalled investors (>14 days in same stage for engaged+)
    const advancedStages = ['engaged', 'in_dd', 'term_sheet'];
    for (const inv of investors) {
      if (!advancedStages.includes(inv.status)) continue;
      const daysInStage = Math.round((Date.now() - new Date(inv.updated_at).getTime()) / 864e5);
      if (daysInStage > 14) {
        risks.push({ type: 'stalled', investor: inv.name, detail: `${daysInStage} days in ${inv.status.replace(/_/g, ' ')}`, severity: daysInStage > 21 ? 'high' : 'medium' });
      }
    }

    // Low enthusiasm tier 1-2
    for (const inv of investors) {
      if (inv.tier <= 2 && (inv.enthusiasm ?? 3) <= 2 && !['passed', 'closed'].includes(inv.status)) {
        risks.push({ type: 'low_enthusiasm', investor: inv.name, detail: `Tier ${inv.tier}, enthusiasm ${inv.enthusiasm}/5`, severity: 'high' });
      }
    }

    // --- Wins & Passes this week ---
    const wins = stageChanges.filter(s => s.description.toLowerCase().includes('closed') || s.description.toLowerCase().includes('term_sheet'));
    const passes = stageChanges.filter(s => s.description.toLowerCase().includes('passed'));

    // --- Metrics comparison ---
    const metrics = {
      meetings: { current: meetingCount, prior: priorMeetingCount, delta: meetingDelta },
      followupRate: { current: completionRate, prior: priorRate, delta: completionRate - priorRate },
      activeInvestors: { current: totalActive },
      newInvestors: { current: newInvestors.length },
      overdueFollowups: { current: overdueFollowups },
    };

    // --- Priorities for next week ---
    const priorities: { action: string; reason: string; priority: 'critical' | 'high' | 'normal' }[] = [];

    if (overdueFollowups > 0) {
      priorities.push({ action: `Clear ${overdueFollowups} overdue follow-up(s)`, reason: 'Overdue actions signal disengagement', priority: 'critical' });
    }
    const inDD = investors.filter(i => i.status === 'in_dd');
    if (inDD.length > 0) {
      priorities.push({ action: `Push ${inDD.length} DD investor(s) toward term sheet`, reason: 'DD is the highest-leverage stage', priority: 'high' });
    }
    const stalledT1 = risks.filter(r => r.severity === 'high' && r.type === 'stalled');
    if (stalledT1.length > 0) {
      priorities.push({ action: `Re-engage ${stalledT1.length} stalled investor(s)`, reason: 'Risk of losing momentum', priority: 'high' });
    }
    const identified = investors.filter(i => i.status === 'identified');
    if (identified.length > 5) {
      priorities.push({ action: `Convert ${identified.length} identified investors to contacted`, reason: 'Pipeline velocity starts with outreach', priority: 'normal' });
    }

    return NextResponse.json({
      weekRange: { start: weekStart, end: weekEnd },
      weeksBack,
      pipelineSnapshot,
      totalActive,
      stageChanges,
      meetings: {
        count: meetingCount,
        priorCount: priorMeetingCount,
        delta: meetingDelta,
        uniqueInvestors: uniqueInvestorsMet,
        byType: meetingsByType,
        top: topMeetings,
      },
      followups: {
        total: totalFollowups,
        completed: completedFollowups,
        completionRate,
        priorRate,
        overdue: overdueFollowups,
      },
      newInvestors: newInvestors.map(i => ({ name: i.name, tier: i.tier, type: i.type })),
      risks: risks.sort((a, b) => (a.severity === 'high' ? 0 : 1) - (b.severity === 'high' ? 0 : 1)),
      wins,
      passes,
      metrics,
      priorities: priorities.sort((a, b) => {
        const p = { critical: 0, high: 1, normal: 2 };
        return p[a.priority] - p[b.priority];
      }),
      generatedAt: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        'Server-Timing': `total;dur=${Date.now() - t0}`,
      },
    });
  } catch (error) {
    console.error('[DIGEST_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to generate weekly digest' }, { status: 500 });
  }
}

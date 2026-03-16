import { NextResponse } from 'next/server';
import { getClient, groupByInvestorId } from '@/lib/api-helpers';
import type { InvestorRow, MeetingRow, FollowupRow, ActivityRow } from '@/lib/api-types';

const STAGE_ORDER = ['contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged', 'in_dd', 'term_sheet', 'closed'] as const;

const EXPECTED_DAYS: Record<string, number> = {
  contacted: 5,
  nda_signed: 5,
  meeting_scheduled: 4,
  met: 7,
  engaged: 14,
  in_dd: 14,
  term_sheet: 7,
};

const STAGE_ACTIONS: Record<string, (inv: { name: string; daysSinceLastMeeting: number; hasOverdueFollowups: boolean; enthusiasm: number }) => string> = {
  contacted: (inv) => inv.daysSinceLastMeeting > 7 ? `Re-engage ${inv.name} — send warm intro or follow-up email` : `Schedule intro meeting with ${inv.name}`,
  nda_signed: () => 'Send NDA or push for signature',
  meeting_scheduled: (inv) => inv.daysSinceLastMeeting > 10 ? 'Confirm meeting date — may need reschedule' : 'Prepare meeting brief',
  met: (inv) => inv.hasOverdueFollowups ? 'Complete overdue follow-ups first' : inv.enthusiasm >= 3 ? 'Schedule deep-dive or management presentation' : 'Send additional materials to build conviction',
  engaged: (inv) => inv.enthusiasm >= 4 ? 'Push for DD kickoff — share data room access' : 'Address open objections before DD',
  in_dd: (inv) => inv.hasOverdueFollowups ? 'Respond to DD information requests' : 'Check in on DD progress — offer expert calls',
  term_sheet: () => 'Negotiate and push for signed term sheet',
};

export async function GET() {
  const t0 = Date.now();
  try {
    const db = getClient();

    const [investorRows, meetingRows, followupRows, activityRows] = await Promise.all([
      db.execute(`
        SELECT id, name, type, tier, status, enthusiasm, created_at, updated_at
        FROM investors
        WHERE status NOT IN ('passed', 'dropped', 'identified', 'closed')
        ORDER BY tier ASC, name ASC
      `),
      db.execute(`
        SELECT id, investor_id, date, type, enthusiasm_score
        FROM meetings ORDER BY date ASC
      `),
      db.execute(`
        SELECT id, investor_id, status, due_at
        FROM followup_actions ORDER BY due_at ASC
      `),
      db.execute(`
        SELECT investor_id, detail, created_at
        FROM activity_log
        WHERE event_type = 'status_changed'
        ORDER BY created_at ASC
      `),
    ]);

    const investors = investorRows.rows as unknown as InvestorRow[];
    const meetings = meetingRows.rows as unknown as MeetingRow[];
    const followups = followupRows.rows as unknown as FollowupRow[];
    const statusChanges = activityRows.rows as unknown as ActivityRow[];

    const meetingsByInvestor = groupByInvestorId(meetings);
    const followupsByInvestor = groupByInvestorId(followups);
    const statusChangesByInvestor = groupByInvestorId(statusChanges.filter(a => !!a.investor_id));

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    interface StuckInvestor {
      id: string;
      name: string;
      tier: number;
      daysInStage: number;
      expectedDays: number;
      overdueFactor: number;
      enthusiasm: number;
      daysSinceLastMeeting: number;
      hasOverdueFollowups: boolean;
      suggestedAction: string;
    }

    interface StageBottleneck {
      stage: string;
      totalInvestors: number;
      stuckCount: number;
      avgDaysInStage: number;
      expectedDays: number;
      stuckInvestors: StuckInvestor[];
    }

    const stageMap = new Map<string, { investors: StuckInvestor[]; totalCount: number; totalDays: number }>();

    for (const stage of STAGE_ORDER) {
      if (stage === 'closed') continue;
      stageMap.set(stage, { investors: [], totalCount: 0, totalDays: 0 });
    }

    for (const inv of investors) {
      const stage = inv.status;
      const entry = stageMap.get(stage);
      if (!entry) continue;

      const invMeetings = meetingsByInvestor[inv.id] || [];
      const invFollowups = followupsByInvestor[inv.id] || [];
      const invStatusChanges = statusChangesByInvestor[inv.id] || [];

      const firstContactDate = invMeetings.length > 0 ? new Date(invMeetings[0].date) : new Date(inv.created_at);
      const lastMeetingDate = invMeetings.length > 0 ? new Date(invMeetings[invMeetings.length - 1].date) : null;
      const daysSinceLastMeeting = lastMeetingDate
        ? Math.round((now.getTime() - lastMeetingDate.getTime()) / 864e5)
        : Math.round((now.getTime() - firstContactDate.getTime()) / 864e5);

      let lastStageChangeDate = firstContactDate;
      if (invStatusChanges.length > 0) {
        lastStageChangeDate = new Date(invStatusChanges[invStatusChanges.length - 1].created_at);
      } else if (lastMeetingDate) {
        lastStageChangeDate = lastMeetingDate;
      }
      const daysInStage = Math.max(0, Math.round((now.getTime() - lastStageChangeDate.getTime()) / 864e5));
      const expectedDays = EXPECTED_DAYS[stage] ?? 14;

      const overdueFollowups = invFollowups.filter(f => f.status === 'pending' && f.due_at && f.due_at.split('T')[0] < today);
      const hasOverdueFollowups = overdueFollowups.length > 0;

      entry.totalCount++;
      entry.totalDays += daysInStage;

      const overdueFactor = daysInStage / expectedDays;
      const isStuck = overdueFactor > 1.5;

      if (isStuck) {
        const actionFn = STAGE_ACTIONS[stage];
        const suggestedAction = actionFn
          ? actionFn({ name: inv.name, daysSinceLastMeeting, hasOverdueFollowups, enthusiasm: inv.enthusiasm })
          : `Follow up with ${inv.name}`;

        entry.investors.push({
          id: inv.id,
          name: inv.name,
          tier: inv.tier,
          daysInStage,
          expectedDays,
          overdueFactor: Math.round(overdueFactor * 10) / 10,
          enthusiasm: inv.enthusiasm,
          daysSinceLastMeeting,
          hasOverdueFollowups,
          suggestedAction,
        });
      }
    }

    const bottlenecks: StageBottleneck[] = [];

    for (const stage of STAGE_ORDER) {
      if (stage === 'closed') continue;
      const entry = stageMap.get(stage);
      if (!entry || entry.totalCount === 0) continue;

      entry.investors.sort((a, b) => {
        if (a.tier !== b.tier) return a.tier - b.tier;
        return b.overdueFactor - a.overdueFactor;
      });

      bottlenecks.push({
        stage,
        totalInvestors: entry.totalCount,
        stuckCount: entry.investors.length,
        avgDaysInStage: Math.round(entry.totalDays / entry.totalCount),
        expectedDays: EXPECTED_DAYS[stage] ?? 14,
        stuckInvestors: entry.investors.slice(0, 5),
      });
    }

    const totalStuck = bottlenecks.reduce((s, b) => s + b.stuckCount, 0);
    const totalActive = investors.length;
    const worstStage = bottlenecks.reduce<StageBottleneck | null>(
      (worst, b) => (!worst || b.stuckCount > worst.stuckCount) ? b : worst,
      null,
    );

    return NextResponse.json({
      bottlenecks: bottlenecks.filter(b => b.stuckCount > 0 || b.totalInvestors > 0),
      summary: {
        totalActive,
        totalStuck,
        stuckPct: totalActive > 0 ? Math.round((totalStuck / totalActive) * 100) : 0,
        worstStage: worstStage?.stage ?? null,
        worstStageCount: worstStage?.stuckCount ?? 0,
      },
      generated_at: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        'Server-Timing': `total;dur=${Date.now() - t0}`,
      },
    });
  } catch (error) {
    console.error('[BOTTLENECKS_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to compute bottleneck data' }, { status: 500 });
  }
}

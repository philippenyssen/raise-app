import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:raise.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

const PIPELINE_ORDER = [
  'identified', 'contacted', 'nda_signed', 'meeting_scheduled',
  'met', 'engaged', 'in_dd', 'term_sheet', 'closed',
];

// Stage duration benchmarks in days (cumulative target from first contact)
const STAGE_BENCHMARKS: Record<string, number> = {
  contacted: 0,
  nda_signed: 5,
  meeting_scheduled: 10,
  met: 14,
  engaged: 21,
  in_dd: 35,
  term_sheet: 49,
  closed: 56,
};

// Expected days per stage transition
const STAGE_DURATIONS: Record<string, number> = {
  contacted: 5,
  nda_signed: 5,
  meeting_scheduled: 4,
  met: 7,
  engaged: 14,
  in_dd: 14,
  term_sheet: 7,
};

function stageIndex(status: string): number {
  const idx = PIPELINE_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
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
  date: string;
  type: string;
  enthusiasm_score: number;
  status_after: string;
}

interface FollowupRow {
  id: string;
  investor_id: string;
  status: string;
  due_at: string;
  completed_at: string | null;
}

interface ActivityRow {
  investor_id: string;
  detail: string;
  created_at: string;
}

export async function GET() {
  try {
    const db = getClient();

    const [investorRows, meetingRows, followupRows, activityRows, configRows] = await Promise.all([
      db.execute(`
        SELECT id, name, type, tier, status, enthusiasm, created_at, updated_at
        FROM investors
        WHERE status NOT IN ('passed', 'dropped', 'identified')
        ORDER BY tier ASC, name ASC
      `),
      db.execute(`
        SELECT id, investor_id, date, type, enthusiasm_score, status_after
        FROM meetings
        ORDER BY date ASC
      `),
      db.execute(`
        SELECT id, investor_id, status, due_at, completed_at
        FROM followup_actions
        ORDER BY due_at ASC
      `),
      db.execute(`
        SELECT investor_id, detail, created_at
        FROM activity_log
        WHERE event_type = 'status_changed'
        ORDER BY created_at ASC
      `),
      db.execute(`SELECT value FROM config WHERE key = 'raise_config'`),
    ]);

    const investors = investorRows.rows as unknown as InvestorRow[];
    const meetings = meetingRows.rows as unknown as MeetingRow[];
    const followups = followupRows.rows as unknown as FollowupRow[];
    const statusChanges = activityRows.rows as unknown as ActivityRow[];

    // Parse raise config for launch date
    let raiseStartDate: Date | null = null;
    if (configRows.rows.length > 0) {
      try {
        const config = JSON.parse(configRows.rows[0].value as string);
        if (config.target_close) {
          // target_close is the end date; raise start is ~60 days before
          const targetClose = new Date(config.target_close);
          raiseStartDate = new Date(targetClose);
          raiseStartDate.setDate(raiseStartDate.getDate() - 60);
        }
      } catch { /* ignore parse errors */ }
    }

    const now = new Date();

    // Index meetings by investor
    const meetingsByInvestor: Record<string, MeetingRow[]> = {};
    for (const m of meetings) {
      if (!meetingsByInvestor[m.investor_id]) meetingsByInvestor[m.investor_id] = [];
      meetingsByInvestor[m.investor_id].push(m);
    }

    // Index followups by investor
    const followupsByInvestor: Record<string, FollowupRow[]> = {};
    for (const f of followups) {
      if (!followupsByInvestor[f.investor_id]) followupsByInvestor[f.investor_id] = [];
      followupsByInvestor[f.investor_id].push(f);
    }

    // Index status changes by investor
    const statusChangesByInvestor: Record<string, ActivityRow[]> = {};
    for (const a of statusChanges) {
      if (!a.investor_id) continue;
      if (!statusChangesByInvestor[a.investor_id]) statusChangesByInvestor[a.investor_id] = [];
      statusChangesByInvestor[a.investor_id].push(a);
    }

    // Compute velocity metrics for each investor
    const velocityData = investors.map(inv => {
      const invMeetings = meetingsByInvestor[inv.id] || [];
      const invFollowups = followupsByInvestor[inv.id] || [];
      const invStatusChanges = statusChangesByInvestor[inv.id] || [];

      // First meeting date (first contact proxy)
      const firstMeetingDate = invMeetings.length > 0
        ? new Date(invMeetings[0].date)
        : new Date(inv.created_at);

      const lastMeetingDate = invMeetings.length > 0
        ? new Date(invMeetings[invMeetings.length - 1].date)
        : null;

      // Days in process
      const daysInProcess = Math.max(0, Math.round(
        (now.getTime() - firstMeetingDate.getTime()) / (1000 * 60 * 60 * 24)
      ));

      // Days in current stage (from last status change or last meeting)
      let lastStageChangeDate = firstMeetingDate;
      if (invStatusChanges.length > 0) {
        lastStageChangeDate = new Date(invStatusChanges[invStatusChanges.length - 1].created_at);
      } else if (lastMeetingDate) {
        lastStageChangeDate = lastMeetingDate;
      }
      const daysInCurrentStage = Math.max(0, Math.round(
        (now.getTime() - lastStageChangeDate.getTime()) / (1000 * 60 * 60 * 24)
      ));

      // Days to 60-day target
      const daysToTarget = Math.max(0, 60 - daysInProcess);

      // Current stage index and remaining stages
      const currentStageIdx = stageIndex(inv.status);
      const closedIdx = stageIndex('closed');
      const remainingStages = Math.max(0, closedIdx - currentStageIdx);

      // Projected close date based on velocity
      // Calculate avg days per stage transition so far
      const stagesCompleted = Math.max(1, currentStageIdx - stageIndex('contacted'));
      const avgDaysPerStage = stagesCompleted > 0 ? daysInProcess / stagesCompleted : 14;
      const remainingDays = Math.round(remainingStages * avgDaysPerStage);
      const projectedCloseDate = new Date(now);
      projectedCloseDate.setDate(projectedCloseDate.getDate() + remainingDays);

      // Is on track? Current stage should be at or ahead of benchmark
      const benchmarkDays = STAGE_BENCHMARKS[inv.status] ?? 0;
      const expectedStageDuration = STAGE_DURATIONS[inv.status] ?? 14;
      const isOnTrack = daysInProcess <= (benchmarkDays + expectedStageDuration + 7) && // within grace
        daysInCurrentStage <= (expectedStageDuration * 2); // not stuck

      // Bottleneck detection
      const bottlenecks: string[] = [];
      const daysSinceLastMeeting = lastMeetingDate
        ? Math.round((now.getTime() - lastMeetingDate.getTime()) / (1000 * 60 * 60 * 24))
        : daysInProcess;

      if (daysSinceLastMeeting > 14) {
        bottlenecks.push(`No meeting in ${daysSinceLastMeeting}d`);
      }

      if (daysInCurrentStage > expectedStageDuration * 1.5) {
        bottlenecks.push(`Stuck in ${inv.status.replace(/_/g, ' ')} for ${daysInCurrentStage}d`);
      }

      const pendingFollowups = invFollowups.filter(f => f.status === 'pending');
      const overdueFollowups = pendingFollowups.filter(f => new Date(f.due_at) < now);
      if (overdueFollowups.length > 0) {
        bottlenecks.push(`${overdueFollowups.length} overdue follow-up${overdueFollowups.length > 1 ? 's' : ''}`);
      } else if (pendingFollowups.length === 0 && invMeetings.length > 0) {
        bottlenecks.push('No scheduled follow-up');
      }

      if (inv.enthusiasm <= 2) {
        bottlenecks.push('Low enthusiasm');
      }

      // Meetings per week
      const meetingsPerWeek = daysInProcess > 0
        ? (invMeetings.length / (daysInProcess / 7))
        : 0;

      // Velocity score (0-100)
      let velocityScore = 50; // baseline

      // Stage progress contribution (0-30)
      const expectedProgress = Math.min(1, daysInProcess / 56);
      const actualProgress = currentStageIdx / closedIdx;
      const progressRatio = expectedProgress > 0 ? actualProgress / expectedProgress : 1;
      velocityScore += Math.round(Math.min(30, Math.max(-30, (progressRatio - 1) * 30)));

      // Meeting frequency contribution (0-20)
      if (meetingsPerWeek >= 1) velocityScore += 20;
      else if (meetingsPerWeek >= 0.5) velocityScore += 10;
      else if (meetingsPerWeek < 0.25 && daysInProcess > 14) velocityScore -= 15;

      // Recency contribution (0-15)
      if (daysSinceLastMeeting <= 7) velocityScore += 15;
      else if (daysSinceLastMeeting <= 14) velocityScore += 8;
      else if (daysSinceLastMeeting > 21) velocityScore -= 10;

      // Follow-up health (0-10)
      if (overdueFollowups.length === 0 && pendingFollowups.length > 0) velocityScore += 10;
      else if (overdueFollowups.length > 0) velocityScore -= overdueFollowups.length * 5;

      // Enthusiasm bonus (0-10)
      if (inv.enthusiasm >= 4) velocityScore += 10;
      else if (inv.enthusiasm >= 3) velocityScore += 5;
      else if (inv.enthusiasm <= 1) velocityScore -= 10;

      // Clamp
      velocityScore = Math.max(0, Math.min(100, velocityScore));

      // Tracking status
      let trackingStatus: 'on_track' | 'behind' | 'at_risk' = 'on_track';
      if (!isOnTrack && velocityScore < 30) trackingStatus = 'at_risk';
      else if (!isOnTrack || velocityScore < 50) trackingStatus = 'behind';

      return {
        investor_id: inv.id,
        investor_name: inv.name,
        investor_type: inv.type,
        investor_tier: inv.tier,
        status: inv.status,
        enthusiasm: inv.enthusiasm,
        days_in_process: daysInProcess,
        days_in_current_stage: daysInCurrentStage,
        projected_close_date: projectedCloseDate.toISOString().slice(0, 10),
        days_to_target: daysToTarget,
        on_track: isOnTrack,
        tracking_status: trackingStatus,
        bottleneck: bottlenecks.length > 0 ? bottlenecks.join(' / ') : 'On pace',
        velocity_score: velocityScore,
        meeting_count: invMeetings.length,
        meetings_per_week: Math.round(meetingsPerWeek * 10) / 10,
        days_since_last_meeting: daysSinceLastMeeting,
      };
    });

    // Sort by urgency: at_risk first, then behind, then on_track; within each, by days_to_target ascending
    const statusOrder = { at_risk: 0, behind: 1, on_track: 2 };
    velocityData.sort((a, b) => {
      const orderDiff = (statusOrder[a.tracking_status] ?? 2) - (statusOrder[b.tracking_status] ?? 2);
      if (orderDiff !== 0) return orderDiff;
      return a.days_to_target - b.days_to_target;
    });

    // Summary stats
    const onTrackCount = velocityData.filter(v => v.tracking_status === 'on_track').length;
    const behindCount = velocityData.filter(v => v.tracking_status === 'behind').length;
    const atRiskCount = velocityData.filter(v => v.tracking_status === 'at_risk').length;
    const avgVelocityScore = velocityData.length > 0
      ? Math.round(velocityData.reduce((sum, v) => sum + v.velocity_score, 0) / velocityData.length)
      : 0;
    const avgDaysInProcess = velocityData.length > 0
      ? Math.round(velocityData.reduce((sum, v) => sum + v.days_in_process, 0) / velocityData.length)
      : 0;

    // Raise-level progress
    let raiseDaysElapsed = 0;
    if (raiseStartDate) {
      raiseDaysElapsed = Math.max(0, Math.round(
        (now.getTime() - raiseStartDate.getTime()) / (1000 * 60 * 60 * 24)
      ));
    } else {
      // Fallback: use earliest first meeting across all investors
      const allFirstDates = velocityData.map(v => v.days_in_process);
      raiseDaysElapsed = allFirstDates.length > 0 ? Math.max(...allFirstDates) : 0;
    }

    return NextResponse.json({
      investors: velocityData,
      summary: {
        total_active: velocityData.length,
        on_track: onTrackCount,
        behind: behindCount,
        at_risk: atRiskCount,
        avg_velocity_score: avgVelocityScore,
        avg_days_in_process: avgDaysInProcess,
        raise_days_elapsed: Math.min(raiseDaysElapsed, 90),
        raise_target_days: 60,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Velocity API error:', error);
    return NextResponse.json(
      { error: 'Failed to compute velocity data', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

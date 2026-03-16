import { NextResponse } from 'next/server';
import { getAllInvestors, getMeetings, getFollowups, getObjectionsByInvestor, getDataRoomFileCount } from '@/lib/db';

interface ReadinessResult {
  investorId: string;
  investorName: string;
  tier: number;
  status: string;
  readinessScore: number;
  signals: {
    meetingRecency: number;
    meetingFrequency: number;
    followupCompletion: number;
    objectionResolution: number;
    engagementDepth: number;
  };
  blockingFactors: string[];
  readinessLevel: 'ready' | 'progressing' | 'stalled' | 'cold';
}

export async function GET() {
  try {
    const [investors, allMeetings, allFollowups, dataRoomCount] = await Promise.all([
      getAllInvestors(),
      getMeetings(),
      getFollowups(),
      getDataRoomFileCount(),
    ]);

    const activeStatuses = new Set(['contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged', 'in_dd', 'term_sheet', 'closed']);
    const activeInvestors = investors.filter(inv => activeStatuses.has(inv.status));

    const meetingsByInvestor = new Map<string, typeof allMeetings>();
    for (const m of allMeetings) {
      const list = meetingsByInvestor.get(m.investor_id) ?? [];
      list.push(m);
      meetingsByInvestor.set(m.investor_id, list);
    }

    const followupsByInvestor = new Map<string, typeof allFollowups>();
    for (const f of allFollowups) {
      const list = followupsByInvestor.get(f.investor_id) ?? [];
      list.push(f);
      followupsByInvestor.set(f.investor_id, list);
    }

    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    const results: ReadinessResult[] = await Promise.all(
      activeInvestors.map(async (inv) => {
        const meetings = meetingsByInvestor.get(inv.id) ?? [];
        const followups = followupsByInvestor.get(inv.id) ?? [];
        let objections: { effectiveness: string; response_text: string }[] = [];
        try { objections = await getObjectionsByInvestor(inv.id); } catch { /* empty */ }

        const blockingFactors: string[] = [];

        // 1. Meeting Recency (0-100): how recently was the last meeting?
        const lastMeetingDate = meetings.length > 0
          ? Math.max(...meetings.map(m => new Date(m.date).getTime()))
          : 0;
        const daysSinceLastMeeting = lastMeetingDate > 0 ? Math.floor((now - lastMeetingDate) / 864e5) : 999;
        let meetingRecency = 0;
        if (daysSinceLastMeeting <= 3) meetingRecency = 100;
        else if (daysSinceLastMeeting <= 7) meetingRecency = 85;
        else if (daysSinceLastMeeting <= 14) meetingRecency = 65;
        else if (daysSinceLastMeeting <= 21) meetingRecency = 40;
        else if (daysSinceLastMeeting <= 30) meetingRecency = 20;
        else meetingRecency = 5;

        if (daysSinceLastMeeting > 14 && meetings.length > 0) {
          blockingFactors.push(`No meeting in ${daysSinceLastMeeting} days`);
        }
        if (meetings.length === 0) {
          blockingFactors.push('No meetings yet');
        }

        // 2. Meeting Frequency (0-100): meeting cadence over last 30 days
        const recentMeetings = meetings.filter(m => now - new Date(m.date).getTime() < 30 * 864e5);
        const meetingFrequency = Math.min(100, recentMeetings.length * 30);

        // 3. Follow-up Completion (0-100): % of follow-ups completed on time
        const investorFollowups = followups.filter(f => f.investor_id === inv.id);
        const totalFU = investorFollowups.length;
        const completedFU = investorFollowups.filter(f => f.status === 'completed').length;
        const overdueFU = investorFollowups.filter(f =>
          f.status === 'pending' && f.due_at && f.due_at.split('T')[0] < today
        ).length;
        const followupCompletion = totalFU > 0
          ? Math.round(((completedFU) / totalFU) * 100)
          : (meetings.length > 0 ? 50 : 100); // No followups but had meetings = neutral

        if (overdueFU > 0) {
          blockingFactors.push(`${overdueFU} overdue follow-up${overdueFU > 1 ? 's' : ''}`);
        }

        // 4. Objection Resolution (0-100): % of objections with responses
        const totalObjections = objections.length;
        const resolvedObjections = objections.filter(o =>
          o.effectiveness === 'effective' || o.effectiveness === 'partially_effective' || (o.response_text && o.response_text.length > 0)
        ).length;
        const objectionResolution = totalObjections > 0
          ? Math.round((resolvedObjections / totalObjections) * 100)
          : 100; // No objections = no blockers

        if (totalObjections > 0 && resolvedObjections < totalObjections) {
          blockingFactors.push(`${totalObjections - resolvedObjections} unresolved objection${totalObjections - resolvedObjections > 1 ? 's' : ''}`);
        }

        // 5. Engagement Depth (0-100): based on stage progression + meeting types
        const stageDepth: Record<string, number> = {
          contacted: 10, nda_signed: 20, meeting_scheduled: 25,
          met: 35, engaged: 55, in_dd: 75, term_sheet: 90, closed: 100,
        };
        const depthFromStage = stageDepth[inv.status] ?? 5;
        const hasDeepDive = meetings.some(m => m.type === 'dd_session' || m.type === 'site_visit');
        const hasNegotiation = meetings.some(m => m.type === 'negotiation');
        const engagementBonus = (hasDeepDive ? 10 : 0) + (hasNegotiation ? 15 : 0);
        const engagementDepth = Math.min(100, depthFromStage + engagementBonus);

        if (['contacted', 'nda_signed', 'meeting_scheduled'].includes(inv.status) && meetings.length >= 2) {
          blockingFactors.push('Multiple meetings but status hasn\'t advanced');
        }

        // Composite readiness score (weighted)
        const readinessScore = Math.round(
          meetingRecency * 0.25 +
          meetingFrequency * 0.15 +
          followupCompletion * 0.20 +
          objectionResolution * 0.15 +
          engagementDepth * 0.25
        );

        const readinessLevel: ReadinessResult['readinessLevel'] =
          readinessScore >= 70 ? 'ready' :
          readinessScore >= 45 ? 'progressing' :
          readinessScore >= 20 ? 'stalled' :
          'cold';

        return {
          investorId: inv.id,
          investorName: inv.name,
          tier: inv.tier ?? 3,
          status: inv.status,
          readinessScore,
          signals: {
            meetingRecency,
            meetingFrequency,
            followupCompletion,
            objectionResolution,
            engagementDepth,
          },
          blockingFactors: blockingFactors.slice(0, 3),
          readinessLevel,
        };
      })
    );

    results.sort((a, b) => b.readinessScore - a.readinessScore);

    const summary = {
      ready: results.filter(r => r.readinessLevel === 'ready').length,
      progressing: results.filter(r => r.readinessLevel === 'progressing').length,
      stalled: results.filter(r => r.readinessLevel === 'stalled').length,
      cold: results.filter(r => r.readinessLevel === 'cold').length,
      avgReadiness: results.length > 0
        ? Math.round(results.reduce((s, r) => s + r.readinessScore, 0) / results.length)
        : 0,
      totalActive: results.length,
      dataRoomReady: dataRoomCount >= 5,
      topBlockers: getTopBlockers(results),
    };

    return NextResponse.json({
      investors: results,
      summary,
      generated_at: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
  } catch (error) {
    console.error('[READINESS_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to compute readiness' }, { status: 500 });
  }
}

function getTopBlockers(results: ReadinessResult[]): { blocker: string; count: number }[] {
  const blockerMap = new Map<string, number>();
  for (const r of results) {
    for (const b of r.blockingFactors) {
      const normalized = b.replace(/\d+/g, 'N');
      blockerMap.set(normalized, (blockerMap.get(normalized) ?? 0) + 1);
    }
  }
  return [...blockerMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([blocker, count]) => ({ blocker, count }));
}

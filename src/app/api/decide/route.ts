import { NextResponse } from 'next/server';
import { getAllInvestors, getMeetings, getAllTasks, getFollowups, getRaiseConfig } from '@/lib/db';
import type { Investor, Meeting } from '@/lib/types';

interface FocusInvestor {
  id: string;
  name: string;
  type: string;
  tier: number;
  status: string;
  focusScore: number;
  signals: { label: string; type: 'positive' | 'warning' | 'neutral' }[];
  action: string;
  actionRationale: string;
  daysSinceContact: number | null;
  enthusiasm: number;
  meetingCount: number;
  pendingFollowups: number;
  pendingTasks: number;
}

export async function GET() {
  try {
    const [investors, meetings, tasks, followups, config] = await Promise.all([
      getAllInvestors(),
      getMeetings(undefined, 500),
      getAllTasks({ status: 'pending' }),
      getFollowups({ status: 'pending' }),
      getRaiseConfig().catch(() => null),
    ]);

    const now = Date.now();
    const meetingsByInvestor = new Map<string, Meeting[]>();
    for (const m of meetings) {
      const arr = meetingsByInvestor.get(m.investor_id) || [];
      arr.push(m);
      meetingsByInvestor.set(m.investor_id, arr);
    }

    const tasksByInvestor = new Map<string, number>();
    for (const t of tasks) {
      if (t.investor_id) tasksByInvestor.set(t.investor_id, (tasksByInvestor.get(t.investor_id) || 0) + 1);
    }

    const followupsByInvestor = new Map<string, number>();
    for (const f of followups) {
      if (f.investor_id) followupsByInvestor.set(f.investor_id, (followupsByInvestor.get(f.investor_id) || 0) + 1);
    }

    // Only active investors
    const active = investors.filter(i => !['passed', 'dropped', 'closed', 'identified'].includes(i.status));

    const STAGE_WEIGHT: Record<string, number> = {
      term_sheet: 50, in_dd: 40, engaged: 30, met: 20,
      meeting_scheduled: 15, nda_signed: 10, contacted: 5,
    };

    const scored: FocusInvestor[] = active.map(inv => {
      const invMeetings = meetingsByInvestor.get(inv.id) || [];
      const sorted = [...invMeetings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastMeeting = sorted[0];
      const daysSinceContact = lastMeeting ? Math.floor((now - new Date(lastMeeting.date).getTime()) / 864e5) : null;

      // Recent activity (meetings in last 14 days)
      const recentMeetings = sorted.filter(m => (now - new Date(m.date).getTime()) < 14 * 864e5).length;

      // Enthusiasm trend
      const lastTwo = sorted.slice(0, 2);
      const enthDelta = lastTwo.length === 2 ? (lastTwo[0].enthusiasm_score || 3) - (lastTwo[1].enthusiasm_score || 3) : 0;

      const pending = followupsByInvestor.get(inv.id) || 0;
      const taskCount = tasksByInvestor.get(inv.id) || 0;

      // Focus Score computation
      let score = 0;

      // 1. Stage proximity (0-50)
      score += STAGE_WEIGHT[inv.status] || 0;

      // 2. Recent engagement velocity (0-20)
      score += Math.min(recentMeetings * 7, 20);

      // 3. Enthusiasm / confidence (0-15)
      score += Math.min(inv.enthusiasm * 3, 15);

      // 4. Momentum direction (0-10)
      score += enthDelta > 0 ? 10 : enthDelta === 0 ? 5 : 0;

      // 5. Risk of loss: staleness penalty (-15 to 0)
      if (daysSinceContact !== null) {
        if (daysSinceContact > 21) score -= 15;
        else if (daysSinceContact > 14) score -= 10;
        else if (daysSinceContact > 7) score -= 5;
      }

      // 6. Tier bonus (T1 = +5, T2 = +3)
      score += inv.tier === 1 ? 5 : inv.tier === 2 ? 3 : 0;

      // 7. Pending actions bonus (more pending = more opportunity to move forward)
      if (pending > 0) score += 3;
      if (taskCount > 0) score += 2;

      // Build signals
      const signals: FocusInvestor['signals'] = [];
      if (inv.status === 'term_sheet') signals.push({ label: 'Has term sheet', type: 'positive' });
      if (inv.status === 'in_dd') signals.push({ label: 'In due diligence', type: 'positive' });
      if (recentMeetings >= 2) signals.push({ label: `${recentMeetings} meetings in 14d`, type: 'positive' });
      if (enthDelta > 0) signals.push({ label: 'Enthusiasm rising', type: 'positive' });
      if (enthDelta < 0) signals.push({ label: 'Enthusiasm declining', type: 'warning' });
      if (daysSinceContact !== null && daysSinceContact > 14) signals.push({ label: `${daysSinceContact}d since last contact`, type: 'warning' });
      if (pending > 2) signals.push({ label: `${pending} overdue follow-ups`, type: 'warning' });
      if (inv.tier === 1) signals.push({ label: 'Tier 1', type: 'neutral' });

      // Generate action recommendation
      const { action, rationale } = generateAction(inv, daysSinceContact, pending, taskCount, enthDelta, sorted);

      return {
        id: inv.id,
        name: inv.name,
        type: inv.type,
        tier: inv.tier,
        status: inv.status,
        focusScore: Math.max(0, Math.round(score)),
        signals,
        action,
        actionRationale: rationale,
        daysSinceContact,
        enthusiasm: inv.enthusiasm,
        meetingCount: invMeetings.length,
        pendingFollowups: pending,
        pendingTasks: taskCount,
      };
    });

    scored.sort((a, b) => b.focusScore - a.focusScore);
    const top = scored.slice(0, 10);

    // Generate 60-second narrative
    const inDD = active.filter(i => i.status === 'in_dd').length;
    const termSheets = active.filter(i => i.status === 'term_sheet').length;
    const engaged = active.filter(i => i.status === 'engaged').length;
    const totalActive = active.length;
    const targetClose = config?.target_close || '';

    let narrative = `${totalActive} active investor${totalActive !== 1 ? 's' : ''} in pipeline`;
    if (termSheets > 0) narrative += `, ${termSheets} with term sheet${termSheets > 1 ? 's' : ''}`;
    if (inDD > 0) narrative += `, ${inDD} in due diligence`;
    if (engaged > 0) narrative += `, ${engaged} engaged`;
    narrative += '.';

    if (top.length > 0) {
      narrative += ` Priority this week: ${top.slice(0, 3).map(t => t.name).join(', ')}.`;
    }

    const atRisk = scored.filter(s => s.daysSinceContact !== null && s.daysSinceContact > 14);
    if (atRisk.length > 0) {
      narrative += ` ${atRisk.length} investor${atRisk.length > 1 ? 's' : ''} going cold (14+ days no contact).`;
    }

    if (targetClose) {
      const daysToTarget = Math.floor((new Date(targetClose).getTime() - now) / 864e5);
      if (daysToTarget > 0) narrative += ` Target close in ${daysToTarget} days.`;
    }

    return NextResponse.json({
      focusRanking: top,
      narrative,
      stats: { totalActive, inDD, termSheets, engaged, atRisk: atRisk.length, totalPipeline: investors.length },
      generatedAt: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
  } catch (err) {
    console.error('[DECIDE]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to generate focus ranking' }, { status: 500 });
  }
}

function generateAction(
  inv: Investor,
  daysSince: number | null,
  pendingFollowups: number,
  pendingTasks: number,
  enthDelta: number,
  meetings: Meeting[],
): { action: string; rationale: string } {
  if (inv.status === 'term_sheet') {
    return { action: 'Review and compare term sheet', rationale: 'Term sheet in hand — prioritize review with counsel and comparison against other offers.' };
  }
  if (inv.status === 'in_dd') {
    if (pendingTasks > 0) return { action: `Complete ${pendingTasks} pending DD task${pendingTasks > 1 ? 's' : ''}`, rationale: 'Active DD — clear blockers to maintain momentum toward term sheet.' };
    return { action: 'Schedule next DD session', rationale: 'Keep DD momentum — aim to complete within 2-3 weeks.' };
  }
  if (daysSince !== null && daysSince > 14) {
    return { action: 'Re-engage with update or invite', rationale: `${daysSince} days since last contact — risk of going cold. Send a targeted update.` };
  }
  if (pendingFollowups > 0) {
    return { action: `Execute ${pendingFollowups} pending follow-up${pendingFollowups > 1 ? 's' : ''}`, rationale: 'Outstanding follow-ups signal you care about the relationship.' };
  }
  if (enthDelta < 0) {
    const lastMeeting = meetings[0];
    const lastObjections = lastMeeting ? (() => { try { return JSON.parse(lastMeeting.objections || '[]'); } catch { return []; } })() : [];
    if (lastObjections.length > 0) {
      return { action: `Address objection: "${lastObjections[0]?.text || 'recent concern'}"`, rationale: 'Enthusiasm declining — proactively address the top concern before next meeting.' };
    }
    return { action: 'Send proactive update addressing concerns', rationale: 'Enthusiasm declining — re-engage with compelling data or milestone update.' };
  }
  if (inv.status === 'engaged') {
    return { action: 'Push for DD commitment', rationale: 'Engaged but not in DD — propose specific DD workstream to advance.' };
  }
  if (inv.status === 'met') {
    return { action: 'Schedule follow-up deep dive', rationale: 'Met once — convert initial interest into deeper engagement.' };
  }
  return { action: 'Schedule introductory meeting', rationale: 'Early stage — get face time to build relationship.' };
}

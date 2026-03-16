import { NextResponse } from 'next/server';
import { getAllInvestors, getMeetings, getObjectionsByInvestor } from '@/lib/db';
import type { Investor, Meeting } from '@/lib/types';

interface WinBackCandidate {
  id: string;
  name: string;
  type: string;
  tier: number;
  status: 'passed' | 'dropped';
  daysSinceExit: number;
  exitDate: string | null;
  winBackScore: number;
  originalReason: string;
  newEvidence: string[];
  readiness: 'ready' | 'warming' | 'too_early' | 'too_late';
  recommendedAction: string;
  meetingCount: number;
  peakEnthusiasm: number;
  lastEnthusiasm: number;
}

export async function GET() {
  try {
    const [investors, allMeetings] = await Promise.all([
      getAllInvestors(),
      getMeetings(undefined, 1000),
    ]);

    const now = Date.now();
    const meetingsByInvestor = new Map<string, Meeting[]>();
    for (const m of allMeetings) {
      const arr = meetingsByInvestor.get(m.investor_id) || [];
      arr.push(m);
      meetingsByInvestor.set(m.investor_id, arr);
    }

    // Get active investor milestones for "what's changed" context
    const activeInvestors = investors.filter(i => !['passed', 'dropped', 'identified'].includes(i.status));
    const avgEnthusiasm = activeInvestors.length > 0
      ? activeInvestors.reduce((s, i) => s + (i.enthusiasm || 0), 0) / activeInvestors.length
      : 3;
    const inDD = activeInvestors.filter(i => i.status === 'in_dd').length;
    const termSheets = activeInvestors.filter(i => i.status === 'term_sheet').length;

    const exited = investors.filter(i => i.status === 'passed' || i.status === 'dropped');

    const candidates: WinBackCandidate[] = [];

    for (const inv of exited) {
      const meetings = meetingsByInvestor.get(inv.id) || [];
      if (meetings.length === 0) continue; // Never met = not a win-back candidate

      const sorted = [...meetings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastMeetingDate = sorted[0]?.date;
      const daysSinceExit = lastMeetingDate
        ? Math.floor((now - new Date(lastMeetingDate).getTime()) / 864e5)
        : 999;

      // Extract pass reason from last meeting objections or notes
      let originalReason = '';
      for (const m of sorted) {
        try {
          const objs = JSON.parse(m.objections || '[]');
          const showstopper = objs.find((o: { severity: string }) => o.severity === 'showstopper');
          if (showstopper) { originalReason = showstopper.text; break; }
          if (objs.length > 0 && !originalReason) originalReason = objs[0].text;
        } catch { /* skip */ }
      }
      if (!originalReason && sorted[0]?.raw_notes) {
        originalReason = sorted[0].raw_notes.length > 100
          ? sorted[0].raw_notes.slice(0, 100) + '...'
          : sorted[0].raw_notes;
      }

      // Peak and last enthusiasm
      const enthusiasms = sorted.map(m => m.enthusiasm_score).filter((s): s is number => s != null);
      const peakEnthusiasm = enthusiasms.length > 0 ? Math.max(...enthusiasms) : 0;
      const lastEnthusiasm = enthusiasms[0] || 0;

      // Win-Back Score (0-100)
      let score = 0;

      // 1. Timing window (ideal: 90-365 days, peak at 180d)
      if (daysSinceExit >= 90 && daysSinceExit <= 365) {
        score += 25 - Math.abs(daysSinceExit - 180) * 0.1;
      } else if (daysSinceExit >= 30 && daysSinceExit < 90) {
        score += 10;
      }

      // 2. Prior relationship depth
      score += Math.min(meetings.length * 5, 20);

      // 3. Peak enthusiasm (higher = more likely to re-engage)
      score += peakEnthusiasm * 4; // max 20

      // 4. Tier bonus
      score += inv.tier === 1 ? 15 : inv.tier === 2 ? 10 : 5;

      // 5. Current pipeline momentum (more momentum = better re-engage story)
      if (termSheets > 0) score += 10;
      if (inDD >= 2) score += 5;

      // 6. Penalty: enthusiasm cratered
      if (lastEnthusiasm <= 1) score -= 10;

      score = Math.max(0, Math.min(100, Math.round(score)));

      // New evidence since exit
      const newEvidence: string[] = [];
      if (termSheets > 0) newEvidence.push(`${termSheets} term sheet${termSheets > 1 ? 's' : ''} received since their exit`);
      if (inDD > 0) newEvidence.push(`${inDD} investors now in due diligence`);
      if (avgEnthusiasm > 3.5) newEvidence.push(`Average pipeline enthusiasm ${avgEnthusiasm.toFixed(1)}/5`);
      const recentActiveMeetings = allMeetings.filter(m => (now - new Date(m.date).getTime()) < 30 * 864e5).length;
      if (recentActiveMeetings >= 5) newEvidence.push(`${recentActiveMeetings} meetings in last 30 days (momentum)`);

      // Readiness classification
      let readiness: WinBackCandidate['readiness'];
      if (daysSinceExit < 30) readiness = 'too_early';
      else if (daysSinceExit > 540) readiness = 'too_late';
      else if (score >= 50) readiness = 'ready';
      else readiness = 'warming';

      // Recommended action
      let recommendedAction: string;
      if (readiness === 'too_early') {
        recommendedAction = 'Wait — too soon since exit. Let 2-3 months pass before re-engaging.';
      } else if (readiness === 'too_late') {
        recommendedAction = 'Low priority — significant time elapsed. Only re-engage with major milestone.';
      } else if (score >= 60) {
        recommendedAction = `Re-engage now: send "what's changed" update referencing ${newEvidence[0] || 'pipeline momentum'}`;
      } else if (score >= 40) {
        recommendedAction = 'Warm outreach: casual update, don\'t push for meeting yet. Build bridge.';
      } else {
        recommendedAction = 'Monitor — not enough new evidence to justify re-engagement yet.';
      }

      candidates.push({
        id: inv.id,
        name: inv.name,
        type: inv.type,
        tier: inv.tier,
        status: inv.status as 'passed' | 'dropped',
        daysSinceExit,
        exitDate: lastMeetingDate || null,
        winBackScore: score,
        originalReason,
        newEvidence,
        readiness,
        recommendedAction,
        meetingCount: meetings.length,
        peakEnthusiasm,
        lastEnthusiasm,
      });
    }

    candidates.sort((a, b) => b.winBackScore - a.winBackScore);

    const summary = {
      total: candidates.length,
      ready: candidates.filter(c => c.readiness === 'ready').length,
      warming: candidates.filter(c => c.readiness === 'warming').length,
      tooEarly: candidates.filter(c => c.readiness === 'too_early').length,
      tooLate: candidates.filter(c => c.readiness === 'too_late').length,
      avgScore: candidates.length > 0 ? Math.round(candidates.reduce((s, c) => s + c.winBackScore, 0) / candidates.length) : 0,
    };

    return NextResponse.json({
      candidates,
      summary,
      context: { activeInvestors: activeInvestors.length, inDD, termSheets, avgEnthusiasm: Math.round(avgEnthusiasm * 10) / 10 },
      generated_at: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' } });
  } catch (err) {
    console.error('[WIN_BACK]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to compute win-back candidates' }, { status: 500 });
  }
}

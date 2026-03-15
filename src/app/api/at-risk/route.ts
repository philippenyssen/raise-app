import { NextResponse } from 'next/server';
import { detectScoreReversals, computeEngagementVelocity } from '@/lib/db';

export async function GET() {
  try {
    const [reversals, velocities] = await Promise.all([
      detectScoreReversals().catch(e => { console.error('[AT_RISK] reversals failed:', e instanceof Error ? e.message : e); return []; }),
      computeEngagementVelocity().catch(e => { console.error('[AT_RISK] velocity failed:', e instanceof Error ? e.message : e); return [] as Awaited<ReturnType<typeof computeEngagementVelocity>>; }),
    ]);

    const staleInvestors = velocities
      .filter(v => (v.acceleration === 'gone_silent' || v.acceleration === 'decelerating') && v.tier <= 2)
      .map(v => ({
        investorId: v.investorId,
        investorName: v.investorName,
        tier: v.tier,
        daysSinceLastMeeting: v.daysSinceLastMeeting,
        acceleration: v.acceleration,
        signal: v.signal,
      }));

    return NextResponse.json({
      scoreReversals: reversals,
      staleInvestors,
    }, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } });
  } catch (err) {
    console.error('[AT_RISK_GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to compute at-risk investors' }, { status: 500 });
  }
}

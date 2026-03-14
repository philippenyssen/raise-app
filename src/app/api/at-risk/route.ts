import { NextResponse } from 'next/server';
import { detectScoreReversals, computeEngagementVelocity } from '@/lib/db';

export async function GET() {
  try {
    const [reversals, velocities] = await Promise.all([
      detectScoreReversals().catch(() => []),
      computeEngagementVelocity().catch(() => []),
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
    });
  } catch {
    return NextResponse.json({ scoreReversals: [], staleInvestors: [] });
  }
}

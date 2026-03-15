import { NextRequest, NextResponse } from 'next/server';
import { getInvestor, getScoreSnapshots } from '@/lib/db';
import { computeConvictionTrajectory } from '@/lib/scoring';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const investor = await getInvestor(id);
    if (!investor) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 });
    }

    const snapshots = await getScoreSnapshots(id);
    const trajectory = computeConvictionTrajectory(snapshots);

    return NextResponse.json(trajectory);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to load trajectory' }, { status: 500 });
  }
}

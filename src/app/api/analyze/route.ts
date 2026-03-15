import { NextResponse } from 'next/server';
import { getMeetings, getObjectionPatterns, getFunnelMetrics } from '@/lib/db';
import { analyzePatterns, assessProcessHealth } from '@/lib/ai';

export async function GET() {
  const meetings = await getMeetings();
  const objections = await getObjectionPatterns();
  const funnel = await getFunnelMetrics();

  if (meetings.length < 2) {
    return NextResponse.json({
      patterns: null,
      health: { health: 'yellow', diagnosis: 'Need at least 2 meetings for pattern analysis.', recommendations: ['Log more meeting debriefs'], risk_factors: [] },
      objections,
      funnel,
      meeting_count: meetings.length,
    });
  }

  try {
    const [patterns, health] = await Promise.all([
      analyzePatterns(meetings.slice(0, 20)),
      assessProcessHealth(funnel, objections, meetings.slice(0, 5)),
    ]);

    return NextResponse.json({
      patterns,
      health,
      objections,
      funnel,
      meeting_count: meetings.length,
    });
  } catch (err) {
    return NextResponse.json({
      patterns: null,
      health: { health: 'yellow', diagnosis: 'AI analysis temporarily unavailable.', recommendations: [], risk_factors: [] },
      objections,
      funnel,
      meeting_count: meetings.length,
      error: 'AI analysis failed — check ANTHROPIC_API_KEY',
    });
  }
}

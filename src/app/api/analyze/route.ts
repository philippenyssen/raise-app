import { NextResponse } from 'next/server';
import { getMeetings, getObjectionPatterns, getFunnelMetrics } from '@/lib/db';
import { analyzePatterns, assessProcessHealth } from '@/lib/ai';

export async function GET() {
  try {
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
      }, { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' } });
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
      }, { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' } });
    } catch (err) {
      console.error('[ANALYZE_AI]', err instanceof Error ? err.message : err);
      return NextResponse.json({
        patterns: null,
        health: { health: 'yellow', diagnosis: 'AI analysis temporarily unavailable.', recommendations: [], risk_factors: [] },
        objections,
        funnel,
        meeting_count: meetings.length,
        error: 'AI analysis failed — check ANTHROPIC_API_KEY',
      });
    }
  } catch (err) {
    console.error('[ANALYZE_GET]', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Failed to load analysis data' },
      { status: 500 },
    );
  }
}

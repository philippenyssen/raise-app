import { NextResponse } from 'next/server';
import { getObjectionPlaybook, computeObjectionEvolution } from '@/lib/db';

interface ResponseEffectivenessEntry {
  response_text: string;
  objection_topic: string;
  objection_text: string;
  investor_name: string | null;
  times_used: number;
  positive_outcomes: number;
  negative_outcomes: number;
  neutral_outcomes: number;
  effectiveness_score: number;
  avg_enthusiasm_delta: number;
  created_at: string;
}

interface TopicEffectiveness {
  topic: string;
  total_raised: number;
  positive_outcomes: number;
  negative_outcomes: number;
  neutral_outcomes: number;
  effectiveness_score: number;
  resolution_rate: number;
  first_seen: string;
  last_seen: string;
  trend: 'improving' | 'declining' | 'stable';
  best_response: string | null;
  worst_response: string | null;
}

export async function GET() {
  const [playbook, evolution] = await Promise.all([
    getObjectionPlaybook(),
    computeObjectionEvolution(),
  ]);

  // Build per-topic effectiveness
  const topicEffectiveness: TopicEffectiveness[] = [];

  for (const group of playbook) {
    let positiveOutcomes = 0;
    let negativeOutcomes = 0;
    let neutralOutcomes = 0;
    let resolved = 0;
    let firstSeen = '';
    let lastSeen = '';

    for (const obj of group.objections) {
      if (obj.next_meeting_enthusiasm_delta > 0) positiveOutcomes++;
      else if (obj.next_meeting_enthusiasm_delta < 0) negativeOutcomes++;
      else neutralOutcomes++;

      if (obj.effectiveness === 'effective' || obj.effectiveness === 'partially_effective') {
        resolved++;
      }

      if (!firstSeen || obj.created_at < firstSeen) firstSeen = obj.created_at;
      if (!lastSeen || obj.created_at > lastSeen) lastSeen = obj.created_at;
    }

    const totalWithOutcome = positiveOutcomes + negativeOutcomes + neutralOutcomes;
    const effectivenessScore = totalWithOutcome > 0
      ? Math.round((positiveOutcomes / totalWithOutcome) * 100)
      : 0;

    const resolutionRate = group.count > 0
      ? Math.round((resolved / group.count) * 100)
      : 0;

    // Determine trend: compare first half vs second half enthusiasm deltas
    const sorted = [...group.objections].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const mid = Math.floor(sorted.length / 2);
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (sorted.length >= 4) {
      const firstHalf = sorted.slice(0, mid);
      const secondHalf = sorted.slice(mid);
      const avgFirst = firstHalf.reduce((s, o) => s + o.next_meeting_enthusiasm_delta, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((s, o) => s + o.next_meeting_enthusiasm_delta, 0) / secondHalf.length;
      if (avgSecond - avgFirst > 0.3) trend = 'improving';
      else if (avgFirst - avgSecond > 0.3) trend = 'declining';
    }

    // Best and worst responses
    const withResponse = group.objections.filter(o => o.response_text.trim());
    const bestObj = withResponse
      .filter(o => o.effectiveness === 'effective')
      .sort((a, b) => b.next_meeting_enthusiasm_delta - a.next_meeting_enthusiasm_delta)[0];
    const worstObj = withResponse
      .filter(o => o.effectiveness === 'ineffective')
      .sort((a, b) => a.next_meeting_enthusiasm_delta - b.next_meeting_enthusiasm_delta)[0];

    topicEffectiveness.push({
      topic: group.topic,
      total_raised: group.count,
      positive_outcomes: positiveOutcomes,
      negative_outcomes: negativeOutcomes,
      neutral_outcomes: neutralOutcomes,
      effectiveness_score: effectivenessScore,
      resolution_rate: resolutionRate,
      first_seen: firstSeen,
      last_seen: lastSeen,
      trend,
      best_response: bestObj?.response_text || null,
      worst_response: worstObj?.response_text || null,});
  }

  // Build per-response effectiveness leaderboard
  const responseLeaderboard: ResponseEffectivenessEntry[] = [];
  const responseMap = new Map<string, {
    response_text: string;
    objection_topic: string;
    objection_text: string;
    investor_name: string | null;
    deltas: number[];
    created_at: string;
  }>();

  for (const group of playbook) {
    for (const obj of group.objections) {
      if (!obj.response_text.trim()) continue;
      const key = obj.response_text.toLowerCase().trim();
      const existing = responseMap.get(key);
      if (existing) {
        existing.deltas.push(obj.next_meeting_enthusiasm_delta);
      } else {
        responseMap.set(key, {
          response_text: obj.response_text,
          objection_topic: obj.objection_topic,
          objection_text: obj.objection_text,
          investor_name: obj.investor_name,
          deltas: [obj.next_meeting_enthusiasm_delta],
          created_at: obj.created_at,});
      }}
  }

  for (const [, data] of responseMap) {
    const pos = data.deltas.filter(d => d > 0).length;
    const neg = data.deltas.filter(d => d < 0).length;
    const neutral = data.deltas.filter(d => d === 0).length;
    const total = data.deltas.length;
    const score = total > 0 ? Math.round((pos / total) * 100) : 0;
    const avgDelta = total > 0 ? Math.round((data.deltas.reduce((s, d) => s + d, 0) / total) * 10) / 10 : 0;

    responseLeaderboard.push({
      response_text: data.response_text,
      objection_topic: data.objection_topic,
      objection_text: data.objection_text,
      investor_name: data.investor_name,
      times_used: total,
      positive_outcomes: pos,
      negative_outcomes: neg,
      neutral_outcomes: neutral,
      effectiveness_score: score,
      avg_enthusiasm_delta: avgDelta,
      created_at: data.created_at,});
  }

  // Sort leaderboard: best first (by effectiveness score, then avg delta)
  responseLeaderboard.sort((a, b) => {
    if (b.effectiveness_score !== a.effectiveness_score) return b.effectiveness_score - a.effectiveness_score;
    return b.avg_enthusiasm_delta - a.avg_enthusiasm_delta;});

  // Overall stats
  const totalObjections = playbook.reduce((s, g) => s + g.count, 0);
  const totalResolved = playbook.reduce((s, g) => s + g.effectiveness_distribution.effective + g.effectiveness_distribution.partially_effective, 0);
  const totalEffective = playbook.reduce((s, g) => s + g.effectiveness_distribution.effective, 0);
  const totalIneffective = playbook.reduce((s, g) => s + g.effectiveness_distribution.ineffective, 0);
  const overallResolutionRate = totalObjections > 0 ? Math.round((totalResolved / totalObjections) * 100) : 0;
  const overallEffectivenessRate = totalObjections > 0 ? Math.round((totalEffective / totalObjections) * 100) : 0;

  return NextResponse.json({
    topic_effectiveness: topicEffectiveness.sort((a, b) => b.effectiveness_score - a.effectiveness_score),
    response_leaderboard: responseLeaderboard,
    worst_responses: [...responseLeaderboard].sort((a, b) => a.effectiveness_score - b.effectiveness_score).slice(0, 10),
    evolution,
    summary: {
      total_objections: totalObjections,
      total_resolved: totalResolved,
      total_effective: totalEffective,
      total_ineffective: totalIneffective,
      overall_resolution_rate: overallResolutionRate,
      overall_effectiveness_rate: overallEffectivenessRate,
      topics_count: playbook.length,
      responses_count: responseLeaderboard.length,
    },}, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } });
}

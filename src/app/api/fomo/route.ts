import { NextResponse } from 'next/server';
import { detectFomoDynamics, computeMeetingDensity, computeEngagementVelocity } from '@/lib/db';
import { getClient, STATUS_PROGRESSION as STAGE_RANK } from '@/lib/api-helpers';
import { STATUS_LABELS as STAGE_LABELS } from '@/lib/constants';

export async function GET() {
  try {
    const db = getClient();

    const [fomos, meetingDensity, velocities] = await Promise.all([
      detectFomoDynamics(),
      computeMeetingDensity(),
      computeEngagementVelocity(),]);

    // Fetch active investors for per-investor FOMO scoring
    const investorResult = await db.execute(`
      SELECT id, name, tier, status, type, enthusiasm, updated_at
      FROM investors
      WHERE status NOT IN ('passed', 'dropped')
      ORDER BY tier ASC, name ASC
    `);
    const investors = investorResult.rows as unknown as Array<{
      id: string; name: string; tier: number; status: string;
      type: string; enthusiasm: number; updated_at: string;
    }>;

    // Fetch recent status changes (last 14 days) for trigger events
    const activityResult = await db.execute(`
      SELECT event_type, subject, detail, investor_id, investor_name, created_at
      FROM activity_log
      WHERE event_type = 'status_changed'
        AND created_at >= datetime('now', '-14 days')
      ORDER BY created_at DESC
    `);
    const statusChanges = activityResult.rows as unknown as Array<{
      event_type: string; subject: string; detail: string;
      investor_id: string; investor_name: string; created_at: string;
    }>;

    // Fetch recent meetings (last 14 days) for meeting density signal
    const meetingsResult = await db.execute(`
      SELECT m.investor_id, m.investor_name, m.date, m.type, i.tier, i.status
      FROM meetings m
      JOIN investors i ON i.id = m.investor_id
      WHERE m.date >= date('now', '-14 days')
      ORDER BY m.date DESC
    `);
    const recentMeetings = meetingsResult.rows as unknown as Array<{
      investor_id: string; investor_name: string; date: string;
      type: string; tier: number; status: string;
    }>;

    // Fetch network relationships for connection-based FOMO
    const relResult = await db.execute(`
      SELECT r.investor_a_id, r.investor_b_id, r.relationship_type, r.strength
      FROM investor_relationships r
    `);
    const relationships = relResult.rows as unknown as Array<{
      investor_a_id: string; investor_b_id: string;
      relationship_type: string; strength: number;
    }>;

    // Build adjacency map for network connections
    const connectionMap = new Map<string, Set<string>>();
    for (const rel of relationships) {
      if (!connectionMap.has(rel.investor_a_id)) connectionMap.set(rel.investor_a_id, new Set());
      if (!connectionMap.has(rel.investor_b_id)) connectionMap.set(rel.investor_b_id, new Set());
      connectionMap.get(rel.investor_a_id)!.add(rel.investor_b_id);
      connectionMap.get(rel.investor_b_id)!.add(rel.investor_a_id);
    }

    // Build investor lookup
    const investorLookup = new Map(investors.map(inv => [inv.id, inv]));

    // Count advancing investors (status changes in last 14 days)
    const advancingInvestorIds = new Set(statusChanges.map(sc => sc.investor_id));

    // Count meetings per investor in last 14 days
    const meetingCountByInvestor = new Map<string, number>();
    for (const m of recentMeetings) {
      meetingCountByInvestor.set(m.investor_id, (meetingCountByInvestor.get(m.investor_id) || 0) + 1);
    }

    // Compute per-investor FOMO intensity
    const perInvestorFomo = investors.map(inv => {
      const rank = STAGE_RANK[inv.status] ?? 0;
      if (rank < 0) return null; // passed/dropped

      // Factor 1: How many other investors are advancing ahead of this one?
      let advancingAheadCount = 0;
      const triggerInvestors: { name: string; status: string; statusLabel: string }[] = [];
      for (const advId of advancingInvestorIds) {
        if (advId === inv.id) continue;
        const adv = investorLookup.get(advId);
        if (!adv) continue;
        const advRank = STAGE_RANK[adv.status] ?? 0;
        if (advRank > rank) {
          advancingAheadCount++;
          triggerInvestors.push({
            name: adv.name,
            status: adv.status,
            statusLabel: STAGE_LABELS[adv.status] ?? adv.status,});
        }}

      // Factor 2: Meeting density around this investor's peers
      let peerMeetingDensity = 0;
      const connections = connectionMap.get(inv.id) ?? new Set();
      for (const connId of connections) {
        peerMeetingDensity += meetingCountByInvestor.get(connId) || 0;
      }

      // Factor 3: Network connections to advancing investors
      let connectedAdvancingCount = 0;
      for (const connId of connections) {
        if (advancingInvestorIds.has(connId)) {
          connectedAdvancingCount++;
        }}

      // Compute intensity (0-100)
      // - Advancing ahead: up to 40 pts (capped at 4 investors)
      // - Peer meeting density: up to 30 pts (capped at 6 meetings)
      // - Connected advancing: up to 30 pts (capped at 3 connections)
      const advancingScore = Math.min(40, advancingAheadCount * 10);
      const densityScore = Math.min(30, peerMeetingDensity * 5);
      const connectionScore = Math.min(30, connectedAdvancingCount * 10);
      const intensity = Math.min(100, advancingScore + densityScore + connectionScore);

      // Generate recommendation
      let recommendation = '';
      if (intensity >= 70) {
        const topTrigger = triggerInvestors[0];
        recommendation = topTrigger
          ? `High competitive pressure — mention that other investors are progressing to ${topTrigger.statusLabel}. Create urgency: "We are progressing with several parties and expect to move quickly."`
          : `Multiple signals of competitive activity. Share milestone updates and mention process momentum.`;
      } else if (intensity >= 40) {
        recommendation = triggerInvestors.length > 0
          ? `Moderate pressure — subtly reference process momentum. "${triggerInvestors.length} investor(s) advancing in parallel" is a useful signal to share.`
          : `Some competitive dynamic exists. Consider sharing a recent milestone to maintain engagement.`;
      } else if (intensity > 0) {
        recommendation = `Low pressure — focus on building conviction rather than competitive urgency. Share data room access or offer reference calls.`;
      } else {
        recommendation = `No competitive pressure detected. Focus on relationship building and thesis alignment.`;
      }

      return {
        investorId: inv.id,
        investorName: inv.name,
        tier: inv.tier,
        type: inv.type,
        status: inv.status,
        statusLabel: STAGE_LABELS[inv.status] ?? inv.status,
        enthusiasm: inv.enthusiasm,
        intensity,
        advancingScore,
        densityScore,
        connectionScore,
        triggerInvestors: triggerInvestors.slice(0, 5),
        connectedAdvancingCount,
        peerMeetingDensity,
        recommendation,};
    }).filter(Boolean) as Array<{
      investorId: string; investorName: string; tier: number; type: string;
      status: string; statusLabel: string; enthusiasm: number; intensity: number;
      advancingScore: number; densityScore: number; connectionScore: number;
      triggerInvestors: { name: string; status: string; statusLabel: string }[];
      connectedAdvancingCount: number; peerMeetingDensity: number; recommendation: string;
    }>;

    // Sort by intensity descending
    perInvestorFomo.sort((a, b) => b.intensity - a.intensity);

    // Overall FOMO level (weighted average of top investors)
    const topInvestors = perInvestorFomo.filter(f => f.tier <= 2);
    const overallIntensity = topInvestors.length > 0
      ? Math.round(topInvestors.reduce((sum, f) => sum + f.intensity, 0) / topInvestors.length)
      : perInvestorFomo.length > 0
        ? Math.round(perInvestorFomo.reduce((sum, f) => sum + f.intensity, 0) / perInvestorFomo.length)
        : 0;

    let overallDescription = '';
    if (overallIntensity >= 70) {
      overallDescription = 'Strong competitive tension in the pipeline. Multiple investors are advancing and creating natural urgency. Leverage this dynamic carefully.';
    } else if (overallIntensity >= 40) {
      overallDescription = 'Moderate competitive dynamic. Some investors are progressing faster than others — use this asymmetry to accelerate lagging investors.';
    } else if (overallIntensity > 0) {
      overallDescription = 'Limited competitive pressure. Focus on building individual conviction before leveraging competitive dynamics.';
    } else {
      overallDescription = 'No competitive pressure detected. Pipeline needs more parallel conversations to create natural FOMO.';
    }

    // Build trigger events (recent events creating pressure)
    const triggerEvents: Array<{
      type: 'status_change' | 'meeting_cluster' | 'commitment_signal';
      investorName: string;
      detail: string;
      date: string;
      impactLevel: 'high' | 'medium' | 'low';
    }> = [];

    // Status changes as triggers
    for (const sc of statusChanges.slice(0, 10)) {
      const inv = investorLookup.get(sc.investor_id);
      const rank = inv ? (STAGE_RANK[inv.status] ?? 0) : 0;
      const impactLevel = rank >= 6 ? 'high' : rank >= 4 ? 'medium' : 'low';
      triggerEvents.push({
        type: 'status_change',
        investorName: sc.investor_name,
        detail: sc.detail || `${sc.investor_name} status changed`,
        date: sc.created_at,
        impactLevel,});
    }

    // Meeting clusters as triggers (3+ meetings in 5 days)
    const sortedMeetings = [...recentMeetings].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < sortedMeetings.length; i++) {
      const windowEnd = new Date(sortedMeetings[i].date);
      windowEnd.setDate(windowEnd.getDate() + 5);
      const cluster = sortedMeetings.filter(m =>
        new Date(m.date) >= new Date(sortedMeetings[i].date) &&
        new Date(m.date) <= windowEnd);
      const uniqueInvestors = new Set(cluster.map(m => m.investor_name));
      if (uniqueInvestors.size >= 3) {
        triggerEvents.push({
          type: 'meeting_cluster',
          investorName: `${uniqueInvestors.size} investors`,
          detail: `${uniqueInvestors.size} different investors had meetings within 5 days — competitive tension signal`,
          date: sortedMeetings[i].date,
          impactLevel: 'high',});
        break; // only report the most recent cluster
      }}

    // Strategy cards — actionable FOMO leverage suggestions
    const strategyCards: Array<{
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      targetInvestors: string[];
    }> = [];

    // Build strategies from FOMO dynamics
    for (const fomo of fomos) {
      if (fomo.fomoIntensity === 'high') {
        strategyCards.push({
          title: `Leverage ${fomo.advancingInvestor}'s progress`,
          description: fomo.recommendation,
          priority: 'high',
          targetInvestors: fomo.affectedInvestors.map(a => a.name),});
      }}

    // Add meeting density strategy if applicable
    if (meetingDensity.gapWeeks.length >= 2) {
      strategyCards.push({
        title: 'Fill meeting gaps to sustain pressure',
        description: `${meetingDensity.gapWeeks.length} weeks with zero meetings in the last 12 weeks. Consistent meeting cadence is essential for maintaining competitive tension. Schedule at least 2 meetings per week.`,
        priority: 'medium',
        targetInvestors: perInvestorFomo.filter(f => f.intensity < 30).slice(0, 3).map(f => f.investorName),});
    }

    // Add velocity-based strategies
    const acceleratingInvestors = velocities.filter(v => v.acceleration === 'accelerating');
    const deceleratingInvestors = velocities.filter(v => v.acceleration === 'decelerating' || v.acceleration === 'gone_silent');

    if (acceleratingInvestors.length > 0 && deceleratingInvestors.length > 0) {
      strategyCards.push({
        title: 'Use accelerating investors to re-engage stalling ones',
        description: `${acceleratingInvestors.map(a => a.investorName).slice(0, 2).join(' and ')} ${acceleratingInvestors.length === 1 ? 'is' : 'are'} accelerating. Use this momentum to re-engage ${deceleratingInvestors.map(d => d.investorName).slice(0, 2).join(' and ')} — mention that other parties are progressing.`,
        priority: 'high',
        targetInvestors: deceleratingInvestors.slice(0, 3).map(d => d.investorName),});
    }

    // Add tier-based strategy
    const tier1High = perInvestorFomo.filter(f => f.tier === 1 && f.intensity >= 50);
    const tier2Low = perInvestorFomo.filter(f => f.tier === 2 && f.intensity < 30);
    if (tier1High.length > 0 && tier2Low.length > 0) {
      strategyCards.push({
        title: 'Cascade Tier 1 momentum to Tier 2',
        description: `Tier 1 investors ${tier1High.map(f => f.investorName).join(', ')} show strong competitive pressure. Reference this dynamic to accelerate Tier 2 investors who are not yet feeling urgency.`,
        priority: 'medium',
        targetInvestors: tier2Low.slice(0, 3).map(f => f.investorName),});
    }

    // Sort strategy cards by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    strategyCards.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return NextResponse.json({
      overallIntensity,
      overallDescription,
      perInvestorFomo,
      triggerEvents,
      strategyCards,
      fomos,
      meetingDensity: {
        densityScore: meetingDensity.densityScore,
        avgPerWeek: meetingDensity.avgPerWeek,
        currentWeekCount: meetingDensity.currentWeekCount,
        gapWeeks: meetingDensity.gapWeeks.length,
        insight: meetingDensity.insight,},
      stats: {
        totalInvestors: investors.length,
        advancingCount: advancingInvestorIds.size,
        recentMeetingCount: recentMeetings.length,
        highFomoCount: perInvestorFomo.filter(f => f.intensity >= 70).length,
        mediumFomoCount: perInvestorFomo.filter(f => f.intensity >= 40 && f.intensity < 70).length,
        lowFomoCount: perInvestorFomo.filter(f => f.intensity > 0 && f.intensity < 40).length,
        zeroFomoCount: perInvestorFomo.filter(f => f.intensity === 0).length,},
      generatedAt: new Date().toISOString(),});
  } catch (error) {
    console.error('[FOMO_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to compute FOMO dynamics' },
      { status: 500 },);
  }}

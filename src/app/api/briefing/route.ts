import { NextResponse } from 'next/server';
import {
  getAllInvestors,
  getMeetings,
  getOverdueFollowups,
  getRaiseConfig,
  detectScoreReversals,
  detectCompoundSignals,
  computeTemporalTrends,
  computeRaiseForecast,
  detectFomoDynamics,
  computePipelineFlow,
} from '@/lib/db';
import { getAIClient, AI_MODEL } from '@/lib/ai';
import { parseJsonSafe, checkRateLimit } from '@/lib/api-helpers';

let aiSummaryCache: { text: string; ts: number } | null = null;
const AI_SUMMARY_TTL = 5 * 60_000; // 5 minutes

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning, Philippe';
  if (hour < 18) return 'Good afternoon, Philippe';
  return 'Good evening, Philippe';
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export async function GET() {
  if (!checkRateLimit('briefing')) { return NextResponse.json({ error: 'Too many requests' }, { status: 429 }); }
  try {
    // ═══════════════════════════════════════════════════════════════════
    // 1. GATHER ALL DATA (parallel, resilient — each source independent)
    // ═══════════════════════════════════════════════════════════════════

    const [
      investorsResult,
      meetingsResult,
      overdueResult,
      configResult,
      reversalsResult,
      compoundResult,
      trendsResult,
      forecastResult,
      fomoResult,
      pipelineResult,
    ] = await Promise.allSettled([
      getAllInvestors(),
      getMeetings(),
      getOverdueFollowups(),
      getRaiseConfig(),
      detectScoreReversals(),
      detectCompoundSignals(),
      computeTemporalTrends(),
      computeRaiseForecast(),
      detectFomoDynamics(),
      computePipelineFlow(),]);

    const investors = investorsResult.status === 'fulfilled' ? investorsResult.value : [];
    const allMeetings = meetingsResult.status === 'fulfilled' ? meetingsResult.value : [];
    const overdueFollowups = overdueResult.status === 'fulfilled' ? overdueResult.value : [];
    const config = configResult.status === 'fulfilled' ? configResult.value : null;
    const reversals = reversalsResult.status === 'fulfilled' ? reversalsResult.value : [];
    const compoundSignals = compoundResult.status === 'fulfilled' ? compoundResult.value : [];
    const trends = trendsResult.status === 'fulfilled' ? trendsResult.value : null;
    const forecast = forecastResult.status === 'fulfilled' ? forecastResult.value : null;
    const fomos = fomoResult.status === 'fulfilled' ? fomoResult.value : [];
    const pipelineFlow = pipelineResult.status === 'fulfilled' ? pipelineResult.value : null;

    // ═══════════════════════════════════════════════════════════════════
    // 2. DERIVE TODAY'S MEETINGS
    // ═══════════════════════════════════════════════════════════════════

    const today = todayStr();
    const todayMeetings = allMeetings
      .filter(m => m.date?.startsWith(today))
      .map(m => {
        const objections = parseJsonSafe<Array<{ text: string }>>(m.objections, []);
        const lastObjection = objections.length > 0 ? objections[objections.length - 1].text : null;

        const inv = investors.find(i => i.id === m.investor_id);
        const keyPoint = lastObjection
          ? `Address previous objection: "${lastObjection}"`
          : inv && inv.enthusiasm >= 4
            ? `High enthusiasm (${inv.enthusiasm}/5) — push for next steps`
            : inv && inv.enthusiasm <= 2
              ? `Low engagement — lead with strongest proof points`
              : 'Focus on building conviction and listening for signals';

        const meetingCount = allMeetings.filter(am => am.investor_id === m.investor_id).length;

        return {
          investorId: m.investor_id,
          investorName: m.investor_name,
          time: m.date,
          type: m.type || 'meeting',
          prepLink: `/meetings/prep?investor=${m.investor_id}`,
          captureLink: `/meetings/capture?investor=${m.investor_id}`,
          keyPoint,
          enthusiasm: inv?.enthusiasm ?? 0,
          meetingCount,
        };});

    // ═══════════════════════════════════════════════════════════════════
    // 3. PIPELINE SNAPSHOT
    // ═══════════════════════════════════════════════════════════════════

    const activeInvestors = investors.filter(i => !['passed', 'dropped'].includes(i.status));
    const inDDCount = investors.filter(i => i.status === 'in_dd').length;
    const termSheetCount = investors.filter(i => i.status === 'term_sheet').length;
    const totalTarget = config
      ? parseInt(config.equity_amount.replace(/[^0-9]/g, '')) || 250
      : 250;

    let forecastStr = '';
    if (forecast) {
      const conf = forecast.confidence;
      const expectedDate = forecast.expectedCloseDate;
      const criticalCount = forecast.criticalPathInvestors.length;
      if (conf === 'high') {
        forecastStr = `On track — expected close by ${expectedDate} with ${criticalCount} investor(s) on critical path`;
      } else if (conf === 'medium') {
        forecastStr = `Progressing — expected close by ${expectedDate}, need to accelerate ${criticalCount} critical-path investor(s)`;
      } else {
        const neededInDD = Math.max(0, 3 - inDDCount);
        forecastStr = neededInDD > 0
          ? `Behind — need ${neededInDD} more investor(s) into DD to hit target`
          : 'Early stage — pipeline building, no clear close date yet';
      }
    } else {
      forecastStr = 'Insufficient data for forecast';
    }

    const pipelineSnapshot = {
      totalActive: activeInvestors.length,
      inDD: inDDCount,
      termSheets: termSheetCount,
      totalTarget,
      forecast: forecastStr,};

    // ═══════════════════════════════════════════════════════════════════
    // 4. URGENT ACTIONS
    // ═══════════════════════════════════════════════════════════════════

    const urgentActions: Array<{
      title: string;
      description: string;
      investorName: string | null;
      category: 'meeting' | 'followup' | 'escalation' | 'preparation' | 'outreach';
      link: string;
      timeEstimate: string;
    }> = [];

    // (a) Today's meetings needing prep
    for (const m of todayMeetings) {
      urgentActions.push({
        title: `Prepare for ${m.type} with ${m.investorName}`,
        description: m.keyPoint,
        investorName: m.investorName,
        category: 'preparation',
        link: m.prepLink,
        timeEstimate: '15-30 min',});
    }

    // (b) Overdue follow-ups (sorted by oldest first)
    for (const fu of overdueFollowups.slice(0, 5)) {
      const daysOverdue = Math.max(0, Math.round(
        (Date.now() - new Date(fu.due_at).getTime()) / (1000 * 60 * 60 * 24)
      ));
      urgentActions.push({
        title: `Overdue: ${fu.description.substring(0, 60)}`,
        description: `${daysOverdue} day(s) overdue for ${fu.investor_name}. ${
          fu.action_type === 'data_share' ? 'Send the requested materials.'
          : fu.action_type === 'schedule_followup' ? 'Schedule the next meeting.'
          : 'Complete this follow-up.'}`,
        investorName: fu.investor_name,
        category: 'followup',
        link: `/investors/${fu.investor_id}`,
        timeEstimate: '10-20 min',});
    }

    // (c) Compound signals requiring escalation
    for (const sig of compoundSignals.slice(0, 2)) {
      urgentActions.push({
        title: sig.confidence === 'very_high' ? 'Critical: convergent decline' : 'Early warning signal',
        description: sig.recommendation,
        investorName: null,
        category: 'escalation',
        link: '/dealflow',
        timeEstimate: '20-30 min',});
    }

    // (d) Stale T1-T2 investors (no meeting in 14+ days, still active mid-funnel+)
    const now = Date.now();
    const msPerDay = 1000 * 60 * 60 * 24;
    const meetingsByInvestor: Record<string, string> = {};
    for (const m of allMeetings) {
      if (!m.date) continue;
      if (!meetingsByInvestor[m.investor_id] || m.date > meetingsByInvestor[m.investor_id]) {
        meetingsByInvestor[m.investor_id] = m.date;
      }}

    const staleHighTier = investors
      .filter(i =>
        i.tier <= 2 &&
        !['passed', 'dropped', 'closed', 'identified'].includes(i.status) &&
        (!meetingsByInvestor[i.id] || (now - new Date(meetingsByInvestor[i.id]).getTime()) / msPerDay > 14))
      .sort((a, b) => a.tier - b.tier)
      .slice(0, 3);

    for (const inv of staleHighTier) {
      const lastMeeting = meetingsByInvestor[inv.id];
      const daysSince = lastMeeting
        ? Math.round((now - new Date(lastMeeting).getTime()) / msPerDay)
        : null;
      urgentActions.push({
        title: `Re-engage T${inv.tier}: ${inv.name}`,
        description: daysSince
          ? `No meeting in ${daysSince} days. Status: ${inv.status}. Risk of going cold.`
          : `No meetings logged yet. Status: ${inv.status}. Reach out today.`,
        investorName: inv.name,
        category: 'outreach',
        link: `/investors/${inv.id}`,
        timeEstimate: '10-15 min',});
    }

    // Sort: preparation first, then escalation, followup, outreach, meeting
    const categoryOrder: Record<string, number> = {
      preparation: 0, escalation: 1, followup: 2, outreach: 3, meeting: 4,};
    urgentActions.sort((a, b) => (categoryOrder[a.category] ?? 5) - (categoryOrder[b.category] ?? 5));

    const topActions = urgentActions.slice(0, 5);

    // ═══════════════════════════════════════════════════════════════════
    // 5. ALERTS
    // ═══════════════════════════════════════════════════════════════════

    const alerts: Array<{
      type: 'warning' | 'opportunity' | 'risk';
      title: string;
      detail: string;
    }> = [];

    // Score reversals -> risk
    for (const rev of reversals.slice(0, 3)) {
      alerts.push({
        type: 'risk',
        title: `Score drop: ${rev.investorName}`,
        detail: `Score dropped ${Math.abs(rev.delta)} points (${rev.previousScore} -> ${rev.currentScore}). Severity: ${rev.severity}.`,
      });
    }

    // FOMO opportunities
    for (const fomo of fomos.filter(f => f.fomoIntensity === 'high').slice(0, 2)) {
      alerts.push({
        type: 'opportunity',
        title: `FOMO leverage: ${fomo.advancingInvestor} advancing`,
        detail: fomo.recommendation,});
    }

    // Temporal declining trends -> warning
    if (trends) {
      for (const trend of trends.trends.filter(t => t.alert !== null).slice(0, 2)) {
        alerts.push({
          type: 'warning',
          title: `Trend alert: ${trend.metric}`,
          detail: trend.alert!,});
      }}

    // Pipeline bottleneck warning
    if (pipelineFlow && pipelineFlow.bottleneckStage) {
      const stageLabel = pipelineFlow.bottleneckStage.replace(/_/g, ' ');
      alerts.push({
        type: 'warning',
        title: `Pipeline bottleneck at "${stageLabel}"`,
        detail: `Average ${Math.round(pipelineFlow.bottleneckAvgDays)} days in stage.${pipelineFlow.velocityTrend === 'decelerating' ? ' Velocity is decelerating.' : ''}`,
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6. MOMENTUM
    // ═══════════════════════════════════════════════════════════════════

    let momentum: 'accelerating' | 'steady' | 'decelerating' | 'stalled' = 'steady';
    let momentumChange = '';

    if (trends) {
      if (trends.overallDirection === 'improving') {
        momentum = 'accelerating';
        momentumChange = 'Improving across key metrics this week';
      } else if (trends.overallDirection === 'declining') {
        momentum = 'decelerating';
        momentumChange = 'Key metrics declining — needs attention';
      } else if (trends.overallDirection === 'mixed') {
        momentum = 'steady';
        const improving = trends.trends.filter(t => t.direction === 'improving').map(t => t.metric);
        const declining = trends.trends.filter(t => t.direction === 'declining').map(t => t.metric);
        momentumChange = `Mixed: ${improving.join(', ') || 'none'} up, ${declining.join(', ') || 'none'} down`;
      } else {
        momentum = 'steady';
        momentumChange = 'Holding steady — no significant changes';
      }}

    // Check for stalled: no meetings in 7+ days with active pipeline
    const recentMeetings = allMeetings.filter(m => {
      return (now - new Date(m.date).getTime()) / msPerDay <= 7;});
    if (recentMeetings.length === 0 && activeInvestors.length > 0) {
      momentum = 'stalled';
      momentumChange = 'No meetings in the past 7 days — process has stalled';
    }

    // Pipeline velocity can override to accelerating
    if (pipelineFlow && pipelineFlow.velocityTrend === 'accelerating' && momentum !== 'stalled') {
      momentum = 'accelerating';
      if (!momentumChange.includes('accelerat')) {
        momentumChange = 'Pipeline velocity accelerating' + (momentumChange ? `. ${momentumChange}` : '');
      }}

    // ═══════════════════════════════════════════════════════════════════
    // 7. AI-GENERATED SUMMARY
    // ═══════════════════════════════════════════════════════════════════

    let todaySummary = '';

    try {
      const summaryContext = {
        totalActive: activeInvestors.length,
        inDD: inDDCount,
        termSheets: termSheetCount,
        closed: investors.filter(i => i.status === 'closed').length,
        todayMeetingCount: todayMeetings.length,
        todayMeetingInvestors: todayMeetings.map(m => m.investorName),
        overdueFollowupCount: overdueFollowups.length,
        momentum,
        alertCount: alerts.length,
        riskAlerts: alerts.filter(a => a.type === 'risk').length,
        opportunityAlerts: alerts.filter(a => a.type === 'opportunity').length,
        forecastConfidence: forecast?.confidence || 'unknown',
        expectedCloseDate: forecast?.expectedCloseDate || 'unknown',
        reversalCount: reversals.length,
        companyName: config?.company_name || 'Aerospacelab',
        equityTarget: config?.equity_amount || '250M',
        recentMeetingCount: recentMeetings.length,
        pipelineVelocity: pipelineFlow?.velocityTrend || 'unknown',};

      if (aiSummaryCache && Date.now() - aiSummaryCache.ts < AI_SUMMARY_TTL) {
        todaySummary = aiSummaryCache.text;
      } else {
        const response = await getAIClient().messages.create({
          model: AI_MODEL,
          max_tokens: 300,
          temperature: 0,
          messages: [{
            role: 'user',
            content: `You are a chief of staff for a CEO running a Series C fundraise. Write a 2-3 sentence morning briefing summary. Be direct, actionable, and honest. No fluff.

DATA:
${JSON.stringify(summaryContext)}

Rules:
- Lead with the most important thing (good or bad)
- Mention today's meetings if any
- Flag risks if momentum is decelerating or stalled
- If things are going well, say so briefly
- Use specific numbers
- No greetings, no sign-offs, just the summary`,
          }],});

        const block = response.content[0];
        const text = block?.type === 'text' && block.text ? block.text : '';
        if (!text || response.stop_reason === 'max_tokens') {
          console.error('[BRIEFING_AI] Empty or truncated response, stop_reason:', response.stop_reason);
        }
        todaySummary = text || 'Unable to generate summary.';
        aiSummaryCache = { text: todaySummary, ts: Date.now() };
      }
    } catch (e) {
      console.error('[BRIEFING_AI_SUMMARY]', e instanceof Error ? e.message : e);
      // Fallback: deterministic summary without AI
      const parts: string[] = [];
      if (todayMeetings.length > 0) {
        parts.push(`${todayMeetings.length} meeting(s) today: ${todayMeetings.map(m => m.investorName).join(', ')}.`);
      }
      parts.push(`Pipeline: ${activeInvestors.length} active investors, ${inDDCount} in DD, ${termSheetCount} term sheet(s).`);
      if (overdueFollowups.length > 0) {
        parts.push(`${overdueFollowups.length} overdue follow-up(s) need attention.`);
      }
      todaySummary = parts.join(' ');
    }

    // ═══════════════════════════════════════════════════════════════════
    // 8. RETURN BRIEFING
    // ═══════════════════════════════════════════════════════════════════

    return NextResponse.json({
      greeting: getGreeting(),
      todaySummary,
      urgentActions: topActions,
      todayMeetings,
      pipelineSnapshot,
      alerts,
      momentum,
      momentumChange,
      generatedAt: new Date().toISOString(),}, { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } });
  } catch (error) {
    console.error('[BRIEFING_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to generate briefing' },
      { status: 500 });
  }}

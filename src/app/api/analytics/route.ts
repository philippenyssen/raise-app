import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:raise.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

// Pipeline stage order for funnel analysis
const PIPELINE_ORDER = [
  'identified', 'contacted', 'nda_signed', 'meeting_scheduled',
  'met', 'engaged', 'in_dd', 'term_sheet', 'closed',
];

const STAGE_LABELS: Record<string, string> = {
  identified: 'Identified',
  contacted: 'Contacted',
  nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Set',
  met: 'Met',
  engaged: 'Engaged',
  in_dd: 'In DD',
  term_sheet: 'Term Sheet',
  closed: 'Closed',
  passed: 'Passed',
  dropped: 'Dropped',
};

// Stage weights for velocity scoring
const STAGE_WEIGHTS: Record<string, number> = {
  identified: 0, contacted: 1, nda_signed: 2, meeting_scheduled: 3,
  met: 4, engaged: 5, in_dd: 6, term_sheet: 8, closed: 10,
  passed: 0, dropped: 0,
};

// Tier weights for pipeline velocity
const TIER_WEIGHTS: Record<number, number> = { 1: 4, 2: 3, 3: 2, 4: 1 };

export async function GET() {
  try {
    const db = getClient();

    // Run all queries in parallel for speed
    const [
      investorRows,
      meetingRows,
      activityRows,
      statusCountRows,
      meetingsPerWeekRows,
      investorsPerWeekRows,
      configRow,
    ] = await Promise.all([
      // All investors with key fields
      db.execute(`
        SELECT id, name, type, tier, status, enthusiasm, created_at, updated_at
        FROM investors
        ORDER BY tier ASC, name ASC
      `),

      // All meetings with structured data
      db.execute(`
        SELECT id, investor_id, investor_name, date, type, enthusiasm_score,
               objections, questions_asked, competitive_intel, engagement_signals,
               status_after, created_at
        FROM meetings
        ORDER BY date DESC
      `),

      // Activity log for status changes (used for time-in-stage calculation)
      db.execute(`
        SELECT id, event_type, subject, detail, investor_id, investor_name, created_at
        FROM activity_log
        WHERE event_type = 'status_changed'
        ORDER BY created_at ASC
      `),

      // Status counts
      db.execute(`
        SELECT status, COUNT(*) as count
        FROM investors
        GROUP BY status
      `),

      // Meetings per week (last 8 weeks)
      db.execute(`
        SELECT strftime('%Y-W%W', date) as week, COUNT(*) as count
        FROM meetings
        WHERE date >= date('now', '-56 days')
        GROUP BY week
        ORDER BY week ASC
      `),

      // Investors added per week (last 8 weeks)
      db.execute(`
        SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) as count
        FROM investors
        WHERE created_at >= date('now', '-56 days')
        GROUP BY week
        ORDER BY week ASC
      `),

      // Get raise config for target close date
      db.execute(`SELECT value FROM config WHERE key = 'raise_config'`),
    ]);

    const investors = investorRows.rows as unknown as Array<{
      id: string; name: string; type: string; tier: number;
      status: string; enthusiasm: number; created_at: string; updated_at: string;
    }>;

    const meetings = meetingRows.rows as unknown as Array<{
      id: string; investor_id: string; investor_name: string; date: string;
      type: string; enthusiasm_score: number; objections: string;
      questions_asked: string; competitive_intel: string;
      engagement_signals: string; status_after: string; created_at: string;
    }>;

    const activities = activityRows.rows as unknown as Array<{
      id: string; event_type: string; subject: string; detail: string;
      investor_id: string; investor_name: string; created_at: string;
    }>;

    const statusCounts: Record<string, number> = {};
    (statusCountRows.rows as unknown as Array<{ status: string; count: number }>)
      .forEach(r => { statusCounts[r.status] = Number(r.count); });

    // Parse raise config
    let targetCloseDate: string | null = null;
    if (configRow.rows.length > 0) {
      try {
        const cfg = JSON.parse(configRow.rows[0].value as string);
        targetCloseDate = cfg.target_close || null;
      } catch { /* ignore */ }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 1. FUNNEL ANALYTICS
    // ═══════════════════════════════════════════════════════════════════

    // Count investors at or past each stage (cumulative funnel)
    const funnelCumulative: Record<string, number> = {};
    PIPELINE_ORDER.forEach((stage, idx) => {
      funnelCumulative[stage] = investors.filter(inv => {
        const invIdx = PIPELINE_ORDER.indexOf(inv.status);
        // Include passed/dropped investors based on their last active stage
        // For active investors, include if at or past this stage
        return invIdx >= idx;
      }).length;
    });

    // Count investors exactly at each stage
    const funnelExact: Record<string, number> = {};
    PIPELINE_ORDER.forEach(stage => {
      funnelExact[stage] = statusCounts[stage] || 0;
    });
    funnelExact['passed'] = statusCounts['passed'] || 0;
    funnelExact['dropped'] = statusCounts['dropped'] || 0;

    // Conversion rates between adjacent stages
    const conversionRates: Array<{
      from: string; to: string; rate: number;
      fromCount: number; toCount: number;
    }> = [];

    for (let i = 0; i < PIPELINE_ORDER.length - 1; i++) {
      const from = PIPELINE_ORDER[i];
      const to = PIPELINE_ORDER[i + 1];
      const fromCount = funnelCumulative[from] || 0;
      const toCount = funnelCumulative[to] || 0;
      const rate = fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0;
      conversionRates.push({
        from, to, rate, fromCount, toCount,
      });
    }

    // Drop-off rates at each stage
    const dropOffRates: Array<{ stage: string; rate: number; count: number }> = [];
    for (let i = 0; i < PIPELINE_ORDER.length - 1; i++) {
      const from = PIPELINE_ORDER[i];
      const to = PIPELINE_ORDER[i + 1];
      const fromCount = funnelCumulative[from] || 0;
      const toCount = funnelCumulative[to] || 0;
      const dropOff = fromCount > 0 ? Math.round(((fromCount - toCount) / fromCount) * 100) : 0;
      dropOffRates.push({
        stage: from,
        rate: dropOff,
        count: fromCount - toCount,
      });
    }

    // Average time in stage (from activity log status changes)
    const stageEntryTimes: Record<string, Record<string, string>> = {};
    // Map investor_id -> { stage -> entered_at }
    activities.forEach(a => {
      if (a.event_type === 'status_changed' && a.investor_id) {
        // detail might contain "status:old->new" or "Moved to <stage>"
        const detail = a.detail || '';
        let newStatus = '';
        // Try to extract new status from detail
        const movedMatch = detail.match(/(?:moved to|status.*?→|->)\s*(\w+)/i);
        if (movedMatch) {
          newStatus = movedMatch[1].toLowerCase();
        }
        // Also try subject line for the status
        const subjectMatch = a.subject.match(/moved to (\w+)/i);
        if (!newStatus && subjectMatch) {
          newStatus = subjectMatch[1].toLowerCase();
        }

        if (newStatus && a.investor_id) {
          if (!stageEntryTimes[a.investor_id]) stageEntryTimes[a.investor_id] = {};
          stageEntryTimes[a.investor_id][newStatus] = a.created_at;
        }
      }
    });

    // Compute avg time per stage (days)
    const avgTimeInStage: Record<string, { avgDays: number; count: number }> = {};
    for (const stage of PIPELINE_ORDER) {
      const durations: number[] = [];
      for (const inv of investors) {
        const invIdx = PIPELINE_ORDER.indexOf(inv.status);
        const stageIdx = PIPELINE_ORDER.indexOf(stage);
        // If investor was in this stage and moved on
        const entries = stageEntryTimes[inv.id];
        if (entries && entries[stage]) {
          const enteredAt = new Date(entries[stage]).getTime();
          // Find when they left this stage (entered next stage)
          const nextStageIdx = stageIdx + 1;
          if (nextStageIdx < PIPELINE_ORDER.length) {
            const nextStage = PIPELINE_ORDER[nextStageIdx];
            if (entries[nextStage]) {
              const leftAt = new Date(entries[nextStage]).getTime();
              const days = (leftAt - enteredAt) / (1000 * 60 * 60 * 24);
              if (days >= 0 && days < 365) durations.push(days);
            }
          }
        }
      }
      if (durations.length > 0) {
        avgTimeInStage[stage] = {
          avgDays: Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10,
          count: durations.length,
        };
      }
    }

    // Current bottleneck: stage with the most investors stuck (highest exact count in mid-funnel)
    const midFunnelStages = ['contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged', 'in_dd'];
    let bottleneckStage = '';
    let bottleneckCount = 0;
    midFunnelStages.forEach(stage => {
      if ((funnelExact[stage] || 0) > bottleneckCount) {
        bottleneckCount = funnelExact[stage] || 0;
        bottleneckStage = stage;
      }
    });

    const funnel = {
      cumulative: funnelCumulative,
      exact: funnelExact,
      conversionRates,
      dropOffRates,
      avgTimeInStage,
      bottleneck: bottleneckStage ? {
        stage: bottleneckStage,
        label: STAGE_LABELS[bottleneckStage] || bottleneckStage,
        count: bottleneckCount,
      } : null,
    };

    // ═══════════════════════════════════════════════════════════════════
    // 2. VELOCITY METRICS
    // ═══════════════════════════════════════════════════════════════════

    // Meetings per week (last 8 weeks)
    const now = new Date();
    const meetingsPerWeek: Array<{ week: string; count: number }> = [];
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (w * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const count = meetings.filter(m => {
        const d = new Date(m.date);
        return d >= weekStart && d < weekEnd;
      }).length;

      const weekLabel = `W${Math.ceil((weekStart.getDate()) / 7)} ${weekStart.toLocaleString('default', { month: 'short' })}`;
      meetingsPerWeek.push({ week: weekLabel, count });
    }

    // New investors per week (last 8 weeks)
    const investorsPerWeek: Array<{ week: string; count: number }> = [];
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (w * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const count = investors.filter(inv => {
        const d = new Date(inv.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;

      const weekLabel = `W${Math.ceil((weekStart.getDate()) / 7)} ${weekStart.toLocaleString('default', { month: 'short' })}`;
      investorsPerWeek.push({ week: weekLabel, count });
    }

    // Pipeline velocity score: weighted sum of (tier_weight * stage_weight * enthusiasm)
    const activeInvestors = investors.filter(i => !['passed', 'dropped'].includes(i.status));
    const velocityScore = activeInvestors.length > 0
      ? Math.round(
          (activeInvestors.reduce((sum, inv) => {
            const tierW = TIER_WEIGHTS[inv.tier] || 1;
            const stageW = STAGE_WEIGHTS[inv.status] || 0;
            const enthW = Math.max(inv.enthusiasm || 1, 1);
            return sum + (tierW * stageW * enthW);
          }, 0) / activeInvestors.length) * 10
        ) / 10
      : 0;

    // Days since last meaningful progress (last meeting or status change)
    const lastMeetingDate = meetings.length > 0 ? new Date(meetings[0].date) : null;
    const lastActivityDate = activities.length > 0
      ? new Date(activities[activities.length - 1].created_at)
      : null;
    const lastProgressDate = [lastMeetingDate, lastActivityDate]
      .filter(Boolean)
      .sort((a, b) => (b?.getTime() || 0) - (a?.getTime() || 0))[0];
    const daysSinceProgress = lastProgressDate
      ? Math.round((now.getTime() - lastProgressDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Estimated time to close
    // Based on: current pipeline velocity and target close date
    let estimatedDaysToClose: number | null = null;
    let onTrack: boolean | null = null;
    if (targetCloseDate) {
      const targetDate = new Date(targetCloseDate);
      const daysRemaining = Math.round((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      estimatedDaysToClose = daysRemaining > 0 ? daysRemaining : 0;

      // Are we on track? Check if we have DD/term sheet activity
      const advancedCount = investors.filter(i =>
        ['in_dd', 'term_sheet', 'closed'].includes(i.status)
      ).length;
      onTrack = advancedCount > 0 || daysRemaining > 90;
    }

    const velocity = {
      meetingsPerWeek,
      investorsPerWeek,
      velocityScore,
      daysSinceProgress,
      estimatedDaysToClose,
      onTrack,
      totalMeetings: meetings.length,
      meetingsThisWeek: meetingsPerWeek.length > 0 ? meetingsPerWeek[meetingsPerWeek.length - 1].count : 0,
      meetingsLastWeek: meetingsPerWeek.length > 1 ? meetingsPerWeek[meetingsPerWeek.length - 2].count : 0,
    };

    // ═══════════════════════════════════════════════════════════════════
    // 3. ENGAGEMENT INTELLIGENCE
    // ═══════════════════════════════════════════════════════════════════

    // Average enthusiasm by investor type
    const enthusiasmByType: Record<string, { avg: number; count: number }> = {};
    const typeGroups: Record<string, number[]> = {};
    investors.forEach(inv => {
      if (inv.enthusiasm > 0) {
        if (!typeGroups[inv.type]) typeGroups[inv.type] = [];
        typeGroups[inv.type].push(inv.enthusiasm);
      }
    });
    Object.entries(typeGroups).forEach(([type, scores]) => {
      enthusiasmByType[type] = {
        avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
        count: scores.length,
      };
    });

    // Objection analysis
    const objectionTopics: Record<string, number> = {};
    const allObjections: Array<{ text: string; topic: string; severity: string; addressed: boolean }> = [];
    let totalObjections = 0;
    let addressedObjections = 0;

    meetings.forEach(m => {
      try {
        const objs = JSON.parse(m.objections || '[]') as Array<{
          text: string; topic: string; severity?: string; addressed?: boolean;
          response_effectiveness?: string;
        }>;
        objs.forEach(o => {
          totalObjections++;
          const topic = (o.topic || 'general').toLowerCase();
          objectionTopics[topic] = (objectionTopics[topic] || 0) + 1;
          if (o.addressed || o.response_effectiveness === 'resolved') {
            addressedObjections++;
          }
          allObjections.push({
            text: o.text || '',
            topic,
            severity: o.severity || 'minor',
            addressed: o.addressed || o.response_effectiveness === 'resolved' || false,
          });
        });
      } catch { /* skip malformed */ }
    });

    const topObjections = Object.entries(objectionTopics)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const objectionResolutionRate = totalObjections > 0
      ? Math.round((addressedObjections / totalObjections) * 100)
      : 0;

    // Competitive mentions
    let competitiveMentions = 0;
    const competitorNames: Record<string, number> = {};
    meetings.forEach(m => {
      const intel = m.competitive_intel || '';
      if (intel.trim().length > 0) {
        competitiveMentions++;
        // Try to extract competitor names (simple heuristic)
        const words = intel.split(/[\s,;.]+/).filter(w => w.length > 2);
        words.forEach(w => {
          if (w[0] === w[0].toUpperCase() && w !== 'The' && w !== 'They') {
            competitorNames[w] = (competitorNames[w] || 0) + 1;
          }
        });
      }
    });

    // Questions trending
    const questionsByWeek: Record<string, string[]> = {};
    meetings.forEach(m => {
      try {
        const qs = JSON.parse(m.questions_asked || '[]') as string[];
        const week = m.date.substring(0, 7); // YYYY-MM
        if (!questionsByWeek[week]) questionsByWeek[week] = [];
        questionsByWeek[week].push(...qs);
      } catch { /* skip */ }
    });

    const engagement = {
      enthusiasmByType,
      avgEnthusiasm: investors.filter(i => i.enthusiasm > 0).length > 0
        ? Math.round(
            (investors.filter(i => i.enthusiasm > 0)
              .reduce((s, i) => s + i.enthusiasm, 0) /
              investors.filter(i => i.enthusiasm > 0).length) * 10
          ) / 10
        : 0,
      topObjections,
      objectionResolutionRate,
      totalObjections,
      addressedObjections,
      competitiveMentions,
      topCompetitors: Object.entries(competitorNames)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };

    // ═══════════════════════════════════════════════════════════════════
    // 4. RISK SIGNALS
    // ═══════════════════════════════════════════════════════════════════

    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Stale investors: engaged+ but no meeting in 2+ weeks
    const engagedStatuses = ['engaged', 'in_dd', 'term_sheet'];
    const staleInvestors: Array<{
      id: string; name: string; status: string; tier: number; type: string;
      lastMeetingDate: string | null; daysSinceLastMeeting: number | null;
    }> = [];

    const meetingsByInvestor: Record<string, string> = {};
    meetings.forEach(m => {
      if (!meetingsByInvestor[m.investor_id] || m.date > meetingsByInvestor[m.investor_id]) {
        meetingsByInvestor[m.investor_id] = m.date;
      }
    });

    investors.forEach(inv => {
      if (engagedStatuses.includes(inv.status)) {
        const lastMeeting = meetingsByInvestor[inv.id];
        const lastDate = lastMeeting ? new Date(lastMeeting) : null;
        const daysSince = lastDate
          ? Math.round((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        if (!lastDate || lastDate < twoWeeksAgo) {
          staleInvestors.push({
            id: inv.id,
            name: inv.name,
            status: inv.status,
            tier: inv.tier,
            type: inv.type,
            lastMeetingDate: lastMeeting || null,
            daysSinceLastMeeting: daysSince,
          });
        }
      }
    });

    // Declining enthusiasm: investors whose most recent meeting score is lower than earlier
    const decliningEnthusiasm: Array<{
      id: string; name: string; tier: number; type: string;
      previousScore: number; currentScore: number; trend: string;
    }> = [];

    const meetingsByInvestorAll: Record<string, Array<{ date: string; score: number }>> = {};
    meetings.forEach(m => {
      if (!meetingsByInvestorAll[m.investor_id]) meetingsByInvestorAll[m.investor_id] = [];
      meetingsByInvestorAll[m.investor_id].push({ date: m.date, score: m.enthusiasm_score });
    });

    Object.entries(meetingsByInvestorAll).forEach(([invId, mtgs]) => {
      if (mtgs.length >= 2) {
        mtgs.sort((a, b) => a.date.localeCompare(b.date));
        const latest = mtgs[mtgs.length - 1];
        const previous = mtgs[mtgs.length - 2];
        if (latest.score < previous.score) {
          const inv = investors.find(i => i.id === invId);
          if (inv && !['passed', 'dropped'].includes(inv.status)) {
            decliningEnthusiasm.push({
              id: inv.id,
              name: inv.name,
              tier: inv.tier,
              type: inv.type,
              previousScore: previous.score,
              currentScore: latest.score,
              trend: `${previous.score} -> ${latest.score}`,
            });
          }
        }
      }
    });

    // High-tier investors not progressing
    const highTierStuck: Array<{
      id: string; name: string; tier: number; status: string; type: string;
      daysInStage: number;
    }> = [];

    investors.forEach(inv => {
      if (inv.tier <= 2 && !['passed', 'dropped', 'closed', 'term_sheet'].includes(inv.status)) {
        const created = new Date(inv.created_at);
        const updated = new Date(inv.updated_at);
        const daysInStage = Math.round((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
        // Flag if stuck more than 14 days
        if (daysInStage > 14) {
          highTierStuck.push({
            id: inv.id,
            name: inv.name,
            tier: inv.tier,
            status: inv.status,
            type: inv.type,
            daysInStage,
          });
        }
      }
    });

    // Process concentration risk
    const investorsByType: Record<string, number> = {};
    activeInvestors.forEach(inv => {
      investorsByType[inv.type] = (investorsByType[inv.type] || 0) + 1;
    });
    const maxTypeConcentration = activeInvestors.length > 0
      ? Math.max(...Object.values(investorsByType)) / activeInvestors.length
      : 0;
    const concentrationRisk = maxTypeConcentration > 0.6;
    const dominantType = Object.entries(investorsByType)
      .sort((a, b) => b[1] - a[1])[0];

    // Timeline risk
    let timelineRisk: 'low' | 'medium' | 'high' = 'low';
    if (estimatedDaysToClose !== null) {
      const advancedCount = investors.filter(i =>
        ['in_dd', 'term_sheet', 'closed'].includes(i.status)
      ).length;
      if (estimatedDaysToClose < 30 && advancedCount === 0) timelineRisk = 'high';
      else if (estimatedDaysToClose < 60 && advancedCount === 0) timelineRisk = 'medium';
    }

    const risks = {
      staleInvestors: staleInvestors.sort((a, b) => a.tier - b.tier),
      decliningEnthusiasm: decliningEnthusiasm.sort((a, b) => a.tier - b.tier),
      highTierStuck: highTierStuck.sort((a, b) => a.tier - b.tier),
      concentrationRisk: {
        isRisky: concentrationRisk,
        maxConcentration: Math.round(maxTypeConcentration * 100),
        dominantType: dominantType ? dominantType[0] : null,
        breakdown: investorsByType,
      },
      timelineRisk: {
        level: timelineRisk,
        daysRemaining: estimatedDaysToClose,
        targetDate: targetCloseDate,
      },
      totalAlerts:
        staleInvestors.length +
        decliningEnthusiasm.length +
        highTierStuck.length +
        (concentrationRisk ? 1 : 0) +
        (timelineRisk !== 'low' ? 1 : 0),
    };

    // ═══════════════════════════════════════════════════════════════════
    // 5. WIN/LOSS INSIGHTS
    // ═══════════════════════════════════════════════════════════════════

    const passedInvestors = investors.filter(i => i.status === 'passed');
    const droppedInvestors = investors.filter(i => i.status === 'dropped');
    const exitedInvestors = [...passedInvestors, ...droppedInvestors];

    // Common pass reasons from last meetings' objections
    const passReasons: Record<string, number> = {};
    exitedInvestors.forEach(inv => {
      const invMeetings = meetings.filter(m => m.investor_id === inv.id);
      if (invMeetings.length > 0) {
        const lastMeeting = invMeetings[0]; // already sorted DESC
        try {
          const objs = JSON.parse(lastMeeting.objections || '[]') as Array<{ topic: string; text: string }>;
          objs.forEach(o => {
            const topic = o.topic || 'general';
            passReasons[topic] = (passReasons[topic] || 0) + 1;
          });
        } catch { /* skip */ }
      }
    });

    // Stage at which investors pass
    const passStageDistribution: Record<string, number> = {};
    exitedInvestors.forEach(inv => {
      // Find the last active stage from activity log
      const invActivities = activities.filter(a => a.investor_id === inv.id);
      if (invActivities.length > 1) {
        // The second-to-last status change tells us which stage they were in
        const lastActive = invActivities[invActivities.length - 2];
        if (lastActive) {
          const detail = lastActive.detail || lastActive.subject;
          const match = detail.match(/(?:moved to|->)\s*(\w+)/i);
          if (match) {
            passStageDistribution[match[1]] = (passStageDistribution[match[1]] || 0) + 1;
          }
        }
      }
    });

    // Type/tier correlation with outcomes
    const outcomeByTier: Record<number, { active: number; passed: number; dropped: number }> = {};
    const outcomeByType: Record<string, { active: number; passed: number; dropped: number }> = {};

    investors.forEach(inv => {
      // By tier
      if (!outcomeByTier[inv.tier]) outcomeByTier[inv.tier] = { active: 0, passed: 0, dropped: 0 };
      if (inv.status === 'passed') outcomeByTier[inv.tier].passed++;
      else if (inv.status === 'dropped') outcomeByTier[inv.tier].dropped++;
      else outcomeByTier[inv.tier].active++;

      // By type
      if (!outcomeByType[inv.type]) outcomeByType[inv.type] = { active: 0, passed: 0, dropped: 0 };
      if (inv.status === 'passed') outcomeByType[inv.type].passed++;
      else if (inv.status === 'dropped') outcomeByType[inv.type].dropped++;
      else outcomeByType[inv.type].active++;
    });

    const winLoss = {
      passedCount: passedInvestors.length,
      droppedCount: droppedInvestors.length,
      passRate: investors.length > 0
        ? Math.round((exitedInvestors.length / investors.length) * 100)
        : 0,
      topPassReasons: Object.entries(passReasons)
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      passStageDistribution,
      outcomeByTier,
      outcomeByType,
    };

    // ═══════════════════════════════════════════════════════════════════
    // 6. SUMMARY STATS
    // ═══════════════════════════════════════════════════════════════════

    const summary = {
      totalInvestors: investors.length,
      activeInvestors: activeInvestors.length,
      totalMeetings: meetings.length,
      avgEnthusiasm: engagement.avgEnthusiasm,
      pipelineStages: PIPELINE_ORDER.map(stage => ({
        stage,
        label: STAGE_LABELS[stage],
        count: funnelExact[stage] || 0,
      })),
    };

    return NextResponse.json({
      funnel,
      velocity,
      engagement,
      risks,
      winLoss,
      summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to compute analytics', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

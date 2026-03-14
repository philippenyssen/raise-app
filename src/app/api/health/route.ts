import { NextResponse } from 'next/server';
import { getFunnelMetrics, getLatestConvergence, getAllInvestors, getMeetings, getObjectionPatterns } from '@/lib/db';

export async function GET() {
  const funnel = await getFunnelMetrics();
  const convergence = await getLatestConvergence();
  const investors = await getAllInvestors();
  const meetings = await getMeetings();
  const objections = await getObjectionPatterns();

  const tierBreakdown = {
    tier1: investors.filter(i => i.tier === 1).length,
    tier2: investors.filter(i => i.tier === 2).length,
    tier3: investors.filter(i => i.tier === 3).length,
    tier4: investors.filter(i => i.tier === 4).length,
  };

  const statusBreakdown: Record<string, number> = {};
  investors.forEach(i => {
    statusBreakdown[i.status] = (statusBreakdown[i.status] || 0) + 1;
  });

  const avgEnthusiasm = meetings.length > 0
    ? Math.round((meetings.reduce((sum, m) => sum + m.enthusiasm_score, 0) / meetings.length) * 10) / 10
    : 0;

  // Determine health
  let health: 'green' | 'yellow' | 'red' = 'green';
  const cr = funnel.conversion_rates;
  const belowTarget = [
    cr.contact_to_meeting < funnel.targets.contact_to_meeting,
    cr.meeting_to_engaged < funnel.targets.meeting_to_engaged,
    cr.engaged_to_dd < funnel.targets.engaged_to_dd,
    cr.dd_to_term_sheet < funnel.targets.dd_to_term_sheet,
  ].filter(Boolean).length;

  if (belowTarget >= 3 || funnel.term_sheets === 0 && funnel.meetings > 15) health = 'red';
  else if (belowTarget >= 1) health = 'yellow';

  return NextResponse.json({
    funnel,
    convergence,
    tierBreakdown,
    statusBreakdown,
    avgEnthusiasm,
    health,
    topObjections: objections.slice(0, 5),
    totalInvestors: investors.length,
    totalMeetings: meetings.length,
  });
}

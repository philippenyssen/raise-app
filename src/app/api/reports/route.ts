import { NextRequest, NextResponse } from 'next/server';
import { getAllInvestors, getMeetings, getAllTasks, getFunnelMetrics, getObjectionPlaybook, getFollowups, getScoreSnapshots, getObjectionsByInvestor, getInvestor, getAccelerationActions } from '@/lib/db';
import { computeInvestorScore, computeMomentumScore, computeConvictionTrajectory } from '@/lib/scoring';
import type { Investor, Meeting } from '@/lib/types';
import { daysBetween, parseJsonSafe, PIPELINE_ORDER, groupByInvestorId } from '@/lib/api-helpers';
import { STATUS_LABELS } from '@/lib/constants';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }

function weekOf(d: Date): string {
  const mon = new Date(d);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  return `${mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;
}

// ─── Shared styles ───────────────────────────────────────────────────────────

const BASE_STYLES = `
<style>
  @media print { body { margin: 0; padding: 0; } .report-container { box-shadow: none !important; } .no-print { display: none !important; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; color: #1a1a2e; background: #fafaf8; line-height: 1.5; }
  .report-container { max-width: 900px; margin: 0 auto; padding: 40px 48px; }
  .report-header { border-bottom: 2px solid #1a1a2e; padding-bottom: 16px; margin-bottom: 24px; }
  .report-header h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 24px; font-weight: 300; letter-spacing: -0.5px; }
  .report-header .subtitle { font-size: 13px; color: #8a8880; margin-top: 4px; }
  .report-header .date { font-size: 12px; color: #8a8880; margin-top: 2px; }
  .health-badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:500;letter-spacing:.2px}
  .health-green{background:#e4e3e0;color:#1a1a2e} .health-yellow{background:#e4e3e0;color:#1b2a4a} .health-red{background:#1b2a4a;color:#fafaf8}
  .metrics-strip{display:flex;gap:0;border:1px solid #e4e3e0;border-radius:8px;overflow:hidden;margin:20px 0}
  .metric-box{flex:1;padding:14px 16px;border-right:1px solid #e4e3e0;text-align:center} .metric-box:last-child{border-right:none}
  .metric-value{font-size:24px;font-weight:700;color:#1a1a2e} .metric-label{font-size:11px;color:#8a8880;letter-spacing:.2px;margin-top:2px}
  .section{margin-top:24px} .section-title{font-size:14px;font-weight:600;letter-spacing:-.01em;color:#1a1a2e;border-bottom:1px solid #e4e3e0;padding-bottom:6px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse;font-size:13px} th{text-align:left;padding:8px 10px;background:#fafaf8;font-weight:500;font-size:11px;letter-spacing:.2px;color:#8a8880;border-bottom:2px solid #e4e3e0}
  td{padding:8px 10px;border-bottom:1px solid #e4e3e0;vertical-align:top} tr:last-child td{border-bottom:none}
  .status-badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500}
  .status-identified,.status-passed,.status-dropped{background:#e4e3e0;color:#8a8880} .status-contacted{background:#e4e3e0;color:#1b2a4a} .status-met{background:#e4e3e0;color:#1a1a2e}
  .status-engaged,.status-in_dd{background:#1b2a4a;color:#fafaf8} .status-term_sheet,.status-closed{background:#1a1a2e;color:#fafaf8}
  .priority-critical{background:#1a1a2e;color:#fafaf8} .priority-high{background:#1b2a4a;color:#fafaf8} .priority-medium{background:#e4e3e0;color:#1b2a4a} .priority-low{background:#e4e3e0;color:#8a8880}
  .enthusiasm{display:inline-block;min-width:24px;text-align:center;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:600}
  .enth-high{background:#1a1a2e;color:#fafaf8} .enth-mid{background:#e4e3e0;color:#1b2a4a} .enth-low{background:#e4e3e0;color:#8a8880}
  .risk-item{padding:8px 12px;background:#e4e3e0;border-left:3px solid #1a1a2e;border-radius:0 4px 4px 0;margin-bottom:8px;font-size:13px}
  .action-item{padding:8px 12px;background:#e4e3e0;border-left:3px solid #1b2a4a;border-radius:0 4px 4px 0;margin-bottom:8px;font-size:13px}
  .gap-item{padding:6px 10px;background:#e4e3e0;border-left:3px solid #8a8880;border-radius:0 4px 4px 0;margin-bottom:6px;font-size:12px}
  .conviction-up{color:#1a1a2e;font-weight:700} .conviction-down{color:#8a8880} .conviction-steady{color:#1b2a4a}
  .funnel-bar{height:18px;border-radius:3px;display:inline-block;vertical-align:middle}
  .score-bar{height:8px;background:#e4e3e0;border-radius:4px;overflow:hidden;display:inline-block;width:80px;vertical-align:middle;margin-left:6px} .score-fill{height:100%;border-radius:4px}
  .timestamp{font-size:11px;color:#8a8880;margin-top:24px;text-align:right}
  .investor-header{display:flex;align-items:center;gap:16px;margin-bottom:16px} .investor-header h2{font-size:18px;font-weight:700}
  .profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;font-size:13px;margin-bottom:20px;padding:14px;background:#fafaf8;border:1px solid #e4e3e0;border-radius:8px}
  .profile-label{color:#8a8880;font-size:11px;letter-spacing:.2px} .profile-value{font-weight:500;margin-top:1px}
  .recommendation-box{padding:16px;border:2px solid #1b2a4a;border-radius:8px;background:#fafaf8;margin-top:20px}
  .recommendation-box h3{font-size:13px;font-weight:600;letter-spacing:-.01em;color:#1a1a2e;margin-bottom:8px} .recommendation-box p{font-size:13px;line-height:1.6}
</style>
`;

// ─── Health indicator logic ──────────────────────────────────────────────────

function computeHealth(funnel: Awaited<ReturnType<typeof getFunnelMetrics>>, investors: Investor[], meetings: Meeting[]): { level: 'green' | 'yellow' | 'red'; label: string } {
  const cr = funnel.conversion_rates;
  const belowTarget = [cr.contact_to_meeting < funnel.targets.contact_to_meeting, cr.meeting_to_engaged < funnel.targets.meeting_to_engaged, cr.engaged_to_dd < funnel.targets.engaged_to_dd, cr.dd_to_term_sheet < funnel.targets.dd_to_term_sheet].filter(Boolean).length;

  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const recentMeetings = meetings.filter(m => new Date(m.date) >= twoWeeksAgo);
  const hasTermSheets = investors.some(i => i.status === 'term_sheet' || i.status === 'closed');

  if (belowTarget >= 3 || (funnel.meetings > 15 && !hasTermSheets) || recentMeetings.length === 0) return { level: 'red', label: 'Needs Attention' };
  if (belowTarget >= 1 || recentMeetings.length < 2) return { level: 'yellow', label: 'On Track with Risks' };
  return { level: 'green', label: 'On Track' };
}

// ─── REPORT 1: Board Update ──────────────────────────────────────────────────

async function generateBoardUpdate(): Promise<string> {
  const [investors, meetings, funnel, tasks] = await Promise.all([getAllInvestors(), getMeetings(), getFunnelMetrics(), getAllTasks(), getAccelerationActions()]);

  const now = new Date();
  const health = computeHealth(funnel, investors, meetings);
  const activeInvestors = investors.filter(i => !['passed', 'dropped'].includes(i.status));

  const stageCounts: Record<string, number> = {};
  investors.forEach(i => { stageCounts[i.status] = (stageCounts[i.status] || 0) + 1; });

  const meetingsByInvestor = groupByInvestorId(meetings);

  let accelerating = 0, steady = 0, decelerating = 0;
  for (const inv of activeInvestors) {
    const invMeetings = meetingsByInvestor[inv.id] || [];
    if (invMeetings.length >= 2) {
      const sorted = [...invMeetings].sort((a, b) => a.date.localeCompare(b.date));
      const last = sorted[sorted.length - 1].enthusiasm_score;
      const prev = sorted[sorted.length - 2].enthusiasm_score;
      if (last > prev) accelerating++;
      else if (last < prev) decelerating++;
      else steady++;
    } else { steady++; }
  }

  const focusInvestors = [...activeInvestors].filter(i => i.tier <= 2).sort((a, b) => {
    const aIdx = PIPELINE_ORDER.indexOf(a.status), bIdx = PIPELINE_ORDER.indexOf(b.status);
    if (bIdx !== aIdx) return bIdx - aIdx;
    return b.enthusiasm - a.enthusiasm;
  }).slice(0, 3);

  const risksArr: string[] = [];
  const staleEngaged = activeInvestors.filter(inv => {
    if (!['engaged', 'in_dd', 'term_sheet'].includes(inv.status)) return false;
    const invMeetings = meetingsByInvestor[inv.id] || [];
    if (invMeetings.length === 0) return true;
    const latest = invMeetings.sort((a, b) => b.date.localeCompare(a.date))[0];
    return daysBetween(latest.date, now.toISOString()) > 14;});
  if (staleEngaged.length > 0) risksArr.push(`${staleEngaged.length} engaged investor${staleEngaged.length > 1 ? 's' : ''} with no contact in 14+ days: ${staleEngaged.map(i => i.name).join(', ')}`);
  if (decelerating > 2) risksArr.push(`${decelerating} investors showing declining enthusiasm --- review objections and re-engagement strategy`);
  const pendingCriticalTasks = tasks.filter(t => t.priority === 'critical' && t.status === 'pending');
  if (pendingCriticalTasks.length > 0) risksArr.push(`${pendingCriticalTasks.length} critical task${pendingCriticalTasks.length > 1 ? 's' : ''} still pending`);

  const nextSteps: string[] = [];
  if (focusInvestors.length > 0) nextSteps.push(`Progress ${focusInvestors[0].name} to next stage (currently: ${STATUS_LABELS[focusInvestors[0].status] || focusInvestors[0].status})`);
  if (staleEngaged.length > 0) nextSteps.push(`Re-engage ${staleEngaged[0].name} with updated milestone or market data`);
  const contactedOnly = activeInvestors.filter(i => i.status === 'contacted' || i.status === 'identified');
  if (contactedOnly.length > 5) nextSteps.push(`Convert pipeline: ${contactedOnly.length} investors still in early outreach`);
  if (nextSteps.length === 0) nextSteps.push('Maintain current meeting cadence and push advanced investors to next milestones');

  const pipelineRows = PIPELINE_ORDER.filter(stage => (stageCounts[stage] || 0) > 0).map(stage => {
    const count = stageCounts[stage] || 0;
    const bg = stage === 'term_sheet' || stage === 'closed' ? '#1a1a2e' : stage === 'in_dd' || stage === 'engaged' ? '#1b2a4a' : '#8a8880';
    return `<tr><td><span class="status-badge status-${stage}">${STATUS_LABELS[stage] || stage}</span></td><td style="font-weight:600;">${count}</td><td><div class="funnel-bar" style="width:${Math.max(4, count * 12)}px; background:${bg};"></div></td></tr>`;
  }).join('');

  const focusRows = focusInvestors.map(inv => {
    const enthClass = inv.enthusiasm >= 4 ? 'enth-high' : inv.enthusiasm >= 3 ? 'enth-mid' : 'enth-low';
    let action = 'Schedule follow-up';
    if (inv.status === 'engaged') action = 'Push for DD';
    if (inv.status === 'in_dd') action = 'Respond to DD requests';
    if (inv.status === 'term_sheet') action = 'Negotiate terms';
    if (inv.status === 'met') action = 'Send follow-up materials';
    return `<tr><td style="font-weight:600;">${inv.name}</td><td><span class="status-badge status-${inv.status}">${STATUS_LABELS[inv.status]}</span></td><td><span class="enthusiasm ${enthClass}">${inv.enthusiasm}/5</span></td><td>${action}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Board Update</title>${BASE_STYLES}</head><body>
<div class="report-container">
  <div class="report-header">
    <h1>Series C Fundraise &mdash; Board Update</h1>
    <div class="subtitle">Confidential &mdash; Internal Use Only</div>
    <div class="date">${fmtDate(now)}</div></div>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
    <span style="font-weight:600;font-size:13px;">Process Health:</span>
    <span class="health-badge health-${health.level}">${health.label}</span></div>
  <div class="metrics-strip">
    <div class="metric-box"><div class="metric-value">${investors.length}</div><div class="metric-label">Total Investors</div></div>
    <div class="metric-box"><div class="metric-value">${activeInvestors.length}</div><div class="metric-label">Active Pipeline</div></div>
    <div class="metric-box"><div class="metric-value">${stageCounts['engaged'] || 0}</div><div class="metric-label">Engaged</div></div>
    <div class="metric-box"><div class="metric-value">${stageCounts['in_dd'] || 0}</div><div class="metric-label">In DD</div></div>
    <div class="metric-box"><div class="metric-value">${stageCounts['term_sheet'] || 0}</div><div class="metric-label">Term Sheets</div></div>
  </div>
  <div class="section">
    <div class="section-title">Pipeline Funnel</div>
    <table><thead><tr><th>Stage</th><th>Count</th><th>Distribution</th></tr></thead><tbody>${pipelineRows}</tbody></table>
    <div style="font-size:11px;color:#999;margin-top:8px;">
      Conversion: Contact&rarr;Meeting ${funnel.conversion_rates.contact_to_meeting}% &bull; Meeting&rarr;Engaged ${funnel.conversion_rates.meeting_to_engaged}% &bull; Engaged&rarr;DD ${funnel.conversion_rates.engaged_to_dd}% &bull; DD&rarr;TS ${funnel.conversion_rates.dd_to_term_sheet}%
    </div></div>
  <div class="section">
    <div class="section-title">Top Focus Investors</div>
    <table><thead><tr><th>Investor</th><th>Status</th><th>Enthusiasm</th><th>Recommended Action</th></tr></thead><tbody>${focusRows || '<tr><td colspan="4" style="color:#999;">No tier 1-2 active investors</td></tr>'}</tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Conviction Trends</div>
    <div class="metrics-strip">
      <div class="metric-box"><div class="metric-value conviction-up">${accelerating}</div><div class="metric-label">Accelerating</div></div>
      <div class="metric-box"><div class="metric-value conviction-steady">${steady}</div><div class="metric-label">Steady</div></div>
      <div class="metric-box"><div class="metric-value conviction-down">${decelerating}</div><div class="metric-label">Decelerating</div></div>
    </div></div>
  ${risksArr.length > 0 ? `<div class="section"><div class="section-title">Key Risks</div>${risksArr.map(r => `<div class="risk-item">${r}</div>`).join('')}</div>` : ''}
  <div class="section">
    <div class="section-title">Next Steps</div>
    ${nextSteps.map((s, i) => `<div class="action-item"><strong>${i + 1}.</strong> ${s}</div>`).join('')}</div>
  <div class="timestamp">Generated ${now.toISOString().replace('T', ' ').substring(0, 19)} UTC</div></div>
</body></html>`;
}

// ─── REPORT 2: Weekly Team Agenda ────────────────────────────────────────────

async function generateWeeklyAgenda(): Promise<string> {
  const [investors, meetings, tasks, followups, playbook] = await Promise.all([getAllInvestors(), getMeetings(), getAllTasks(), getFollowups(), getObjectionPlaybook()]);

  const now = new Date();
  const activeInvestors = investors.filter(i => !['passed', 'dropped'].includes(i.status));
  const meetingsByInvestor = groupByInvestorId(meetings);

  const toEngage = [...activeInvestors].sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const aIdx = PIPELINE_ORDER.indexOf(a.status), bIdx = PIPELINE_ORDER.indexOf(b.status);
    if (bIdx !== aIdx) return bIdx - aIdx;
    return b.enthusiasm - a.enthusiasm;
  }).slice(0, 5);

  const engageRows = toEngage.map(inv => {
    let action = 'Send outreach', time = '15 min';
    if (inv.status === 'term_sheet') { action = 'Negotiate terms'; time = '2-3 hrs'; }
    else if (inv.status === 'in_dd') { action = 'Respond to DD requests'; time = '1-2 hrs'; }
    else if (inv.status === 'engaged') { action = 'Push for DD / deep dive'; time = '1 hr'; }
    else if (inv.status === 'met') { action = 'Send follow-up materials'; time = '30 min'; }
    else if (inv.status === 'meeting_scheduled') { action = 'Prepare for meeting'; time = '45 min'; }
    else if (inv.status === 'contacted') { action = 'Follow up on outreach'; time = '15 min'; }
    return `<tr><td style="font-weight:600;">${inv.name}</td><td><span class="status-badge status-${inv.status}">${STATUS_LABELS[inv.status]}</span></td><td>${action}</td><td>${time}</td></tr>`;
  }).join('');

  const overdue = followups.filter(f => f.status === 'pending' && new Date(f.due_at) < now);
  const overdueRows = overdue.slice(0, 8).map(f => {
    const daysOverdue = daysBetween(f.due_at, now.toISOString());
    return `<tr><td style="font-weight:600;">${f.investor_name}</td><td>${f.description.length > 60 ? f.description.substring(0, 60) + '...' : f.description}</td><td style="color:#1a1a2e;font-weight:600;">${daysOverdue}d overdue</td></tr>`;
  }).join('');

  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const recentMeetings = meetings.filter(m => new Date(m.date) >= twoWeeksAgo);
  const recentObjections: Record<string, { count: number; bestResponse: string }> = {};
  recentMeetings.forEach(m => {
    const objs = parseJsonSafe<Array<{ text: string; topic: string }>>(m.objections, []);
    objs.forEach(o => {
      const topic = o.topic || 'general';
      if (!recentObjections[topic]) recentObjections[topic] = { count: 0, bestResponse: '' };
      recentObjections[topic].count++;});});
  playbook.forEach(entry => {
    if (recentObjections[entry.topic] && entry.best_response) recentObjections[entry.topic].bestResponse = entry.best_response.response_text.substring(0, 120) + '...';
  });

  const objectionRows = Object.entries(recentObjections).sort(([, a], [, b]) => b.count - a.count).slice(0, 3).map(([topic, data]) => `<tr><td style="font-weight:600;text-transform:capitalize;">${topic}</td><td>${data.count} time${data.count > 1 ? 's' : ''}</td><td style="font-size:12px;">${data.bestResponse || '<em style="color:#999;">No response recorded</em>'}</td></tr>`).join('');

  const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const criticalTasks = pendingTasks.filter(t => t.priority === 'critical');
  const highTasks = pendingTasks.filter(t => t.priority === 'high');
  const mediumTasks = pendingTasks.filter(t => t.priority === 'medium');

  function taskRows(taskList: typeof pendingTasks, maxItems: number = 5): string {
    return taskList.slice(0, maxItems).map(t => `<tr><td>${t.title.length > 50 ? t.title.substring(0, 50) + '...' : t.title}</td><td>${t.investor_name || '---'}</td><td>${t.due_date || '---'}</td></tr>`).join('');
  }

  const gaps: string[] = [];
  const noEnthusiasm = activeInvestors.filter(i => !i.enthusiasm || i.enthusiasm === 0);
  if (noEnthusiasm.length > 0) gaps.push(`${noEnthusiasm.length} investor${noEnthusiasm.length > 1 ? 's' : ''} with no enthusiasm score`);
  const noPartner = activeInvestors.filter(i => !i.partner);
  if (noPartner.length > 0) gaps.push(`${noPartner.length} investor${noPartner.length > 1 ? 's' : ''} with no partner name`);
  const noFundSize = activeInvestors.filter(i => !i.fund_size);
  if (noFundSize.length > 0) gaps.push(`${noFundSize.length} investor${noFundSize.length > 1 ? 's' : ''} with no fund size`);
  const noCheckSize = activeInvestors.filter(i => !i.check_size_range);
  if (noCheckSize.length > 0) gaps.push(`${noCheckSize.length} investor${noCheckSize.length > 1 ? 's' : ''} with no check size range`);
  const noMeetingInvestors = activeInvestors.filter(i => ['engaged', 'in_dd'].includes(i.status) && !(meetingsByInvestor[i.id] || []).length);
  if (noMeetingInvestors.length > 0) gaps.push(`${noMeetingInvestors.length} engaged+ investor${noMeetingInvestors.length > 1 ? 's' : ''} with no meeting recorded`);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Weekly Agenda</title>${BASE_STYLES}</head><body>
<div class="report-container">
  <div class="report-header">
    <h1>Weekly Fundraise Agenda</h1>
    <div class="subtitle">Week of ${weekOf(now)}</div>
    <div class="date">${fmtDate(now)}</div></div>
  <div class="section">
    <div class="section-title">This Week's Focus &mdash; Top Investors to Engage</div>
    <table><thead><tr><th>Investor</th><th>Status</th><th>Action</th><th>Time Est.</th></tr></thead><tbody>${engageRows}</tbody></table>
  </div>
  ${overdue.length > 0 ? `<div class="section"><div class="section-title">Overdue Follow-ups (${overdue.length})</div><table><thead><tr><th>Investor</th><th>Action</th><th>Overdue</th></tr></thead><tbody>${overdueRows}</tbody></table></div>` : ''}
  ${Object.keys(recentObjections).length > 0 ? `<div class="section"><div class="section-title">Top Objections This Week</div><table><thead><tr><th>Topic</th><th>Frequency</th><th>Best Response</th></tr></thead><tbody>${objectionRows}</tbody></table></div>` : ''}
  <div class="section">
    <div class="section-title">Tasks Due</div>
    ${criticalTasks.length > 0 ? `<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:600;margin-bottom:6px;"><span class="status-badge priority-critical">Critical</span> (${criticalTasks.length})</div><table><thead><tr><th>Task</th><th>Investor</th><th>Due</th></tr></thead><tbody>${taskRows(criticalTasks)}</tbody></table></div>` : ''}
    ${highTasks.length > 0 ? `<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:600;margin-bottom:6px;"><span class="status-badge priority-high">High</span> (${highTasks.length})</div><table><thead><tr><th>Task</th><th>Investor</th><th>Due</th></tr></thead><tbody>${taskRows(highTasks)}</tbody></table></div>` : ''}
    ${mediumTasks.length > 0 ? `<div style="margin-bottom:12px;"><div style="font-size:12px;font-weight:600;margin-bottom:6px;"><span class="status-badge priority-medium">Medium</span> (${mediumTasks.length})</div><table><thead><tr><th>Task</th><th>Investor</th><th>Due</th></tr></thead><tbody>${taskRows(mediumTasks, 3)}</tbody></table></div>` : ''}
    ${pendingTasks.length === 0 ? '<div style="color:#999;font-size:13px;">No pending tasks</div>' : ''}</div>
  ${gaps.length > 0 ? `<div class="section"><div class="section-title">Data Quality &mdash; Fields to Fill</div>${gaps.slice(0, 5).map(g => `<div class="gap-item">${g}</div>`).join('')}</div>` : ''}
  <div class="timestamp">Generated ${now.toISOString().replace('T', ' ').substring(0, 19)} UTC</div></div>
</body></html>`;
}

// ─── REPORT 3: Investor Status Brief ─────────────────────────────────────────

async function generateInvestorBrief(investorId: string): Promise<string> {
  const investor = await getInvestor(investorId);
  if (!investor) return `<!DOCTYPE html><html><head><title>Not Found</title>${BASE_STYLES}</head><body><div class="report-container"><h1>Investor not found</h1><p>No investor with ID "${investorId}"</p></div></body></html>`;

  const [meetings, objections, followups, snapshots, accelerationActions] = await Promise.all([getMeetings(investorId), getObjectionsByInvestor(investorId), getFollowups({ investor_id: investorId }), getScoreSnapshots(investorId), getAccelerationActions({ investor_id: investorId })]);

  const now = new Date();
  const sortedMeetings = [...meetings].sort((a, b) => a.date.localeCompare(b.date));
  const trajectory = computeConvictionTrajectory(snapshots);
  const score = computeInvestorScore(investor, meetings, [], [], { targetEquityM: 250, targetCloseDate: null });
  const { momentum } = computeMomentumScore(investor, meetings);
  const enthClass = investor.enthusiasm >= 4 ? 'enth-high' : investor.enthusiasm >= 3 ? 'enth-mid' : 'enth-low';
  const latestMeeting = sortedMeetings.length > 0 ? sortedMeetings[sortedMeetings.length - 1] : null;
  const daysSinceLastMeeting = latestMeeting ? daysBetween(latestMeeting.date, now.toISOString()) : null;

  const meetingRows = sortedMeetings.slice(-10).reverse().map(m => {
    const enthMeetingClass = m.enthusiasm_score >= 4 ? 'enth-high' : m.enthusiasm_score >= 3 ? 'enth-mid' : 'enth-low';
    return `<tr><td>${m.date}</td><td style="text-transform:capitalize;">${(m.type || 'meeting').replace(/_/g, ' ')}</td><td><span class="enthusiasm ${enthMeetingClass}">${m.enthusiasm_score}/5</span></td><td style="font-size:12px;">${m.next_steps ? (m.next_steps.length > 80 ? m.next_steps.substring(0, 80) + '...' : m.next_steps) : '---'}</td></tr>`;
  }).join('');

  const objectionRows = objections.slice(0, 8).map(o => {
    const effClass = o.effectiveness === 'effective' ? 'conviction-up' : o.effectiveness === 'ineffective' ? 'conviction-down' : 'conviction-steady';
    return `<tr><td style="text-transform:capitalize;">${o.objection_topic}</td><td style="font-size:12px;">${o.objection_text.length > 60 ? o.objection_text.substring(0, 60) + '...' : o.objection_text}</td><td style="font-size:12px;">${o.response_text ? (o.response_text.length > 60 ? o.response_text.substring(0, 60) + '...' : o.response_text) : '<em style="color:#999;">No response</em>'}</td><td><span class="${effClass}" style="font-weight:600;text-transform:capitalize;">${o.effectiveness}</span></td></tr>`;
  }).join('');

  const pendingFollowups = followups.filter(f => f.status === 'pending');
  const completedFollowups = followups.filter(f => f.status === 'completed');
  const followupRows = [...pendingFollowups, ...completedFollowups.slice(0, 5)].map(f => {
    const isOverdue = f.status === 'pending' && new Date(f.due_at) < now;
    return `<tr><td style="font-size:12px;">${f.description.length > 50 ? f.description.substring(0, 50) + '...' : f.description}</td><td>${f.due_at}</td><td><span class="status-badge ${f.status === 'completed' ? 'status-closed' : isOverdue ? 'priority-critical' : 'status-contacted'}">${isOverdue ? 'Overdue' : f.status}</span></td></tr>`;
  }).join('');

  const accelRows = accelerationActions.slice(0, 5).map(a => `<tr><td style="text-transform:capitalize;font-size:12px;">${a.trigger_type.replace(/_/g, ' ')}</td><td style="font-size:12px;">${a.description.length > 80 ? a.description.substring(0, 80) + '...' : a.description}</td><td><span class="status-badge ${a.status === 'executed' ? 'status-closed' : 'status-contacted'}">${a.status}</span></td></tr>`).join('');

  const dimRows = score.dimensions.map(d => {
    const pct = Math.round(d.score);
    const color = pct >= 70 ? '#1a1a2e' : pct >= 40 ? '#1b2a4a' : '#8a8880';
    return `<tr><td>${d.name}</td><td style="font-weight:600;">${pct}/100</td><td><div class="score-bar"><div class="score-fill" style="width:${pct}%;background:${color};"></div></div></td></tr>`;
  }).join('');

  let recommendation = '';
  if (score.overall >= 70 && momentum === 'accelerating') {
    recommendation = `Strong prospect. ${investor.name} shows high conviction signals (score ${score.overall}/100, momentum accelerating). Push aggressively toward the next stage. This investor is likely to convert if engagement cadence is maintained.`;
  } else if (score.overall >= 50 && momentum !== 'stalled') {
    recommendation = `Active prospect. ${investor.name} has moderate-to-good signals (score ${score.overall}/100, momentum ${momentum}). Address any open objections and maintain regular touchpoints. ${daysSinceLastMeeting && daysSinceLastMeeting > 10 ? `Note: ${daysSinceLastMeeting} days since last meeting --- consider scheduling a check-in.` : ''}`;
  } else if (momentum === 'stalled' || momentum === 'decelerating') {
    recommendation = `At risk. ${investor.name} shows ${momentum} momentum with score ${score.overall}/100. ${daysSinceLastMeeting && daysSinceLastMeeting > 14 ? `No contact in ${daysSinceLastMeeting} days.` : ''} Evaluate whether to re-engage with a compelling catalyst or reallocate time to higher-conviction investors.`;
  } else {
    recommendation = `Early stage. ${investor.name} is in the ${STATUS_LABELS[investor.status] || investor.status} stage with score ${score.overall}/100. Continue standard outreach process and build the relationship.`;
  }

  const trajectoryStr = trajectory.trend === 'accelerating' ? 'Accelerating' : trajectory.trend === 'decelerating' ? 'Decelerating' : trajectory.trend === 'steady' ? 'Steady' : 'Insufficient data';
  const trajectoryClass = trajectory.trend === 'accelerating' ? 'conviction-up' : trajectory.trend === 'decelerating' ? 'conviction-down' : 'conviction-steady';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${investor.name} Brief</title>${BASE_STYLES}</head><body>
<div class="report-container">
  <div class="report-header">
    <h1>${investor.name} &mdash; Status Brief</h1>
    <div class="subtitle">Confidential Investor Assessment</div>
    <div class="date">${fmtDate(now)}</div></div>
  <div class="profile-grid">
    <div><div class="profile-label">Type</div><div class="profile-value" style="text-transform:capitalize;">${investor.type.replace(/_/g, ' ')}</div></div>
    <div><div class="profile-label">Tier</div><div class="profile-value">Tier ${investor.tier}</div></div>
    <div><div class="profile-label">Partner</div><div class="profile-value">${investor.partner || '---'}</div></div>
    <div><div class="profile-label">Fund Size</div><div class="profile-value">${investor.fund_size || '---'}</div></div>
    <div><div class="profile-label">Check Range</div><div class="profile-value">${investor.check_size_range || '---'}</div></div>
    <div><div class="profile-label">Status</div><div class="profile-value"><span class="status-badge status-${investor.status}">${STATUS_LABELS[investor.status]}</span></div></div>
    <div><div class="profile-label">Enthusiasm</div><div class="profile-value"><span class="enthusiasm ${enthClass}">${investor.enthusiasm}/5</span></div></div>
    <div><div class="profile-label">Speed</div><div class="profile-value" style="text-transform:capitalize;">${investor.speed || '---'}</div></div>
  </div>
  <div class="metrics-strip">
    <div class="metric-box"><div class="metric-value">${score.overall}</div><div class="metric-label">Overall Score</div></div>
    <div class="metric-box"><div class="metric-value ${trajectoryClass}">${trajectoryStr}</div><div class="metric-label">Conviction Trend</div></div>
    <div class="metric-box"><div class="metric-value">${meetings.length}</div><div class="metric-label">Meetings</div></div>
    <div class="metric-box"><div class="metric-value">${daysSinceLastMeeting !== null ? daysSinceLastMeeting + 'd' : '---'}</div><div class="metric-label">Since Last Meeting</div></div>
  </div>
  <div class="section">
    <div class="section-title">Score Breakdown</div>
    <table><thead><tr><th>Dimension</th><th>Score</th><th>Bar</th></tr></thead><tbody>${dimRows}</tbody></table></div>
  ${meetings.length > 0 ? `<div class="section"><div class="section-title">Meeting History</div><table><thead><tr><th>Date</th><th>Type</th><th>Enthusiasm</th><th>Key Takeaway</th></tr></thead><tbody>${meetingRows}</tbody></table></div>` : ''}
  ${objections.length > 0 ? `<div class="section"><div class="section-title">Objections (${objections.length})</div><table><thead><tr><th>Topic</th><th>Objection</th><th>Response</th><th>Effectiveness</th></tr></thead><tbody>${objectionRows}</tbody></table></div>` : ''}
  ${followups.length > 0 ? `<div class="section"><div class="section-title">Follow-ups</div><table><thead><tr><th>Action</th><th>Due</th><th>Status</th></tr></thead><tbody>${followupRows}</tbody></table></div>` : ''}
  ${accelerationActions.length > 0 ? `<div class="section"><div class="section-title">Acceleration Triggers</div><table><thead><tr><th>Trigger</th><th>Recommendation</th><th>Status</th></tr></thead><tbody>${accelRows}</tbody></table></div>` : ''}
  <div class="recommendation-box">
    <h3>Assessment &amp; Recommendation</h3>
    <p>${recommendation}</p></div>
  <div class="timestamp">Generated ${now.toISOString().replace('T', ' ').substring(0, 19)} UTC</div></div>
</body></html>`;
}

// ─── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get('type');
  const investorId = searchParams.get('investor_id');

  if (!type || !['board', 'team', 'investor_brief'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type. Must be one of: board, team, investor_brief' }, { status: 400 });
  }
  if (type === 'investor_brief' && !investorId) {
    return NextResponse.json({ error: 'investor_id is required for investor_brief report type' }, { status: 400 });
  }

  try {
    let html: string;
    if (type === 'board') html = await generateBoardUpdate();
    else if (type === 'team') html = await generateWeeklyAgenda();
    else html = await generateInvestorBrief(investorId!);

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' } });
  } catch (error) {
    console.error('[REPORTS_GET]', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }}

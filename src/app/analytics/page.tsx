'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import { cachedFetch } from '@/lib/cache';
import { relativeTime } from '@/lib/time';
import { STATUS_LABELS as STAGE_LABELS, TYPE_LABELS } from '@/lib/constants';
import {
  BarChart3, TrendingUp, AlertTriangle, Users, Clock,
  ArrowRight, RefreshCw, Target, Zap, ShieldAlert,
  ChevronDown, ChevronUp, Calendar, MessageSquare,
} from 'lucide-react';
import {
  stTextMuted, stTextTertiary, stTextSecondary, stTextPrimary, stFontSm,
  stSurface0, stSurface1, stBorderTop,
  labelMuted10, labelSmMuted, labelSecondary, labelTertiary, labelMuted, textSmTertiary,
} from '@/lib/styles';
import { EnthusiasmDots } from '@/components/shared';

const objectionBadge = { fontSize: 'var(--font-size-xs)', background: 'var(--danger-muted)', color: 'var(--text-secondary)' } as const;
const competitorBadge = { fontSize: 'var(--font-size-xs)', background: 'var(--surface-2)', color: 'var(--text-tertiary)' } as const;

// ── Types ────────────────────────────────────────────────────────────

interface AnalyticsData {
  funnel: {
    cumulative: Record<string, number>;
    exact: Record<string, number>;
    conversionRates: Array<{
      from: string; to: string; rate: number;
      fromCount: number; toCount: number;
    }>;
    dropOffRates: Array<{ stage: string; rate: number; count: number }>;
    avgTimeInStage: Record<string, { avgDays: number; count: number }>;
    bottleneck: { stage: string; label: string; count: number } | null;
  };
  velocity: {
    meetingsPerWeek: Array<{ week: string; count: number }>;
    investorsPerWeek: Array<{ week: string; count: number }>;
    velocityScore: number;
    daysSinceProgress: number | null;
    estimatedDaysToClose: number | null;
    onTrack: boolean | null;
    totalMeetings: number;
    dailyActivity: Array<{ date: string; count: number }>;
    meetingsThisWeek: number;
    meetingsLastWeek: number;
  };
  engagement: {
    enthusiasmByType: Record<string, { avg: number; count: number }>;
    avgEnthusiasm: number;
    topObjections: Array<{ topic: string; count: number }>;
    objectionResolutionRate: number;
    totalObjections: number;
    addressedObjections: number;
    competitiveMentions: number;
    topCompetitors: Array<{ name: string; count: number }>;
  };
  risks: {
    staleInvestors: Array<{
      id: string; name: string; status: string; tier: number; type: string;
      lastMeetingDate: string | null; daysSinceLastMeeting: number | null;
    }>;
    decliningEnthusiasm: Array<{
      id: string; name: string; tier: number; type: string;
      previousScore: number; currentScore: number; trend: string;
    }>;
    highTierStuck: Array<{
      id: string; name: string; tier: number; status: string; type: string;
      daysInStage: number;
    }>;
    concentrationRisk: {
      isRisky: boolean;
      maxConcentration: number;
      dominantType: string | null;
      breakdown: Record<string, number>;
    };
    timelineRisk: {
      level: 'low' | 'medium' | 'high';
      daysRemaining: number | null;
      targetDate: string | null;
    };
    totalAlerts: number;
  };
  winLoss: {
    passedCount: number;
    droppedCount: number;
    passRate: number;
    topPassReasons: Array<{ topic: string; count: number }>;
    passStageDistribution: Record<string, number>;
    outcomeByTier: Record<number, { active: number; passed: number; dropped: number }>;
    outcomeByType: Record<string, { active: number; passed: number; dropped: number }>;
  };
  summary: {
    totalInvestors: number;
    activeInvestors: number;
    totalMeetings: number;
    avgEnthusiasm: number;
    pipelineStages: Array<{ stage: string; label: string; count: number }>;
  };
  generatedAt: string;
}

// ── Constants ────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  identified: 'var(--chart-7)',
  contacted: 'var(--chart-6)',
  nda_signed: 'var(--chart-5)',
  meeting_scheduled: 'var(--chart-4)',
  met: 'var(--chart-3)',
  engaged: 'var(--chart-2)',
  in_dd: 'var(--chart-1)',
  term_sheet: 'var(--accent)',
  closed: 'var(--text-primary)',};

// ── Main Page ────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['funnel', 'velocity', 'risks', 'engagement', 'winloss']));

  useEffect(() => { document.title = 'Raise | Process Analytics'; }, []);
  useEffect(() => { fetchAnalytics(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchAnalytics(); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const res = await cachedFetch('/api/analytics');
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      setData(await res.json());
    } catch (err) {
      toast('Couldn\'t load analytics — try refreshing the page', 'error');
    } finally {
      setLoading(false);
    }}

  function toggleSection(section: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;});
  }

  // ── Loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 page-content">
        <div className="skeleton" style={{ height: '28px', width: '250px' }} />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Computing pipeline analytics...</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={{ height: '96px', borderRadius: 'var(--radius-xl)' }} />
          ))}</div>
        <div className="skeleton" style={{ height: '250px', borderRadius: 'var(--radius-xl)' }} />
        <div className="skeleton" style={{ height: '180px', borderRadius: 'var(--radius-xl)' }} />
      </div>);
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Process Analytics</h1>
        <div className="rounded-xl p-8 text-center space-y-3" style={{ background: 'var(--danger-muted)' }}>
          <p style={textSmTertiary}>Couldn\'t load analytics data.</p>
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 rounded-lg text-sm transition-colors btn-surface"
            style={{ background: 'var(--surface-2)', ...stTextPrimary }}>
            Retry</button></div>
      </div>);
  }

  const { funnel, velocity, engagement, risks, winLoss, summary } = data;
  const maxStageCount = useMemo(() => Math.max(...(summary.pipelineStages?.map(s => s.count) ?? []), 1), [summary.pipelineStages]);

  // Pre-sort expensive Object.entries chains
  const sortedEnthusiasmByType = useMemo(
    () => Object.entries(engagement.enthusiasmByType).sort((a, b) => b[1].avg - a[1].avg),
    [engagement.enthusiasmByType]
  );
  const sortedOutcomeByTier = useMemo(
    () => Object.entries(winLoss.outcomeByTier).sort(([a], [b]) => Number(a) - Number(b)),
    [winLoss.outcomeByTier]
  );
  const sortedOutcomeByType = useMemo(
    () => Object.entries(winLoss.outcomeByType).sort(([, a], [, b]) => (b.active / (b.active + b.passed + b.dropped)) - (a.active / (a.active + a.passed + a.dropped))),
    [winLoss.outcomeByType]
  );

  return (
    <div className="space-y-6 pb-12 page-content">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Process Analytics</h1>
          <p className="text-sm mt-1" style={stTextMuted}>
            Deep funnel, velocity, and risk analysis</p></div>
        <div className="flex items-center gap-3">
          <span style={labelMuted10}>
            Updated {relativeTime(data.generatedAt)}</span>
          <button
            onClick={fetchAnalytics}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors btn-surface"
            style={{ background: 'var(--surface-2)', ...stTextPrimary }}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh</button></div></div>

      {/* ── Summary Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 card-stagger">
        <SummaryCard label="Active Pipeline" value={String(summary.activeInvestors)} sub={`of ${summary.totalInvestors} total`} icon={<Users className="w-4 h-4" />} color="var(--accent)"/>
        <SummaryCard label="Velocity Score" value={velocity.velocityScore > 0 ? velocity.velocityScore.toFixed(1) : '—'} sub="tier x stage x signal" icon={<Zap className="w-4 h-4" />} color="var(--warning)"/>
        <SummaryCard label="Risk Alerts" value={String(risks.totalAlerts)} sub={risks.totalAlerts === 0 ? 'all clear' : 'need attention'} icon={<ShieldAlert className="w-4 h-4" />} color={risks.totalAlerts === 0 ? 'var(--success)' : risks.totalAlerts <= 3 ? 'var(--warning)' : 'var(--danger)'} />
        <SummaryCard label="Avg Time to Close" value={velocity.estimatedDaysToClose !== null ? `${velocity.estimatedDaysToClose}d` : '—'} sub={velocity.estimatedDaysToClose !== null ? 'estimated' : 'no data yet'} icon={<Clock className="w-4 h-4" />} color="var(--accent)"/>
        <SummaryCard label="Meetings" value={String(velocity.totalMeetings)} sub={`${velocity.meetingsThisWeek} this week`} icon={<Calendar className="w-4 h-4" />} color="var(--accent-muted)"/></div>

      {/* ── Top Objections Summary ─────────────────────────────── */}
      {engagement.topObjections.length > 0 && (
        <div className="rounded-xl px-5 py-3 flex items-center gap-4" style={stSurface1}>
          <span style={{ color: 'var(--warning)' }}><AlertTriangle className="w-4 h-4" /></span>
          <div className="flex-1">
            <div className="text-xs font-normal tracking-wider mb-1" style={stTextMuted}>Top Objections</div>
            <div className="flex flex-wrap gap-2">
              {engagement.topObjections.slice(0, 5).map((o, i) => (
                <span key={i} className="px-2 py-0.5 rounded" style={objectionBadge}>
                  {o.topic} ({o.count}x)</span>))}</div></div></div>)}

      {/* ── Bottleneck Alert ─────────────────────────────────────── */}
      {funnel.bottleneck && funnel.bottleneck.count > 2 && (
        <div
          className="rounded-xl px-5 py-4 flex items-center gap-4"
          style={{ background: 'color-mix(in srgb, var(--warning-muted) 20%, transparent)' }}>
          <AlertTriangle className="w-5 h-5 shrink-0" style={stTextTertiary} />
          <div>
            <div className="text-sm font-normal" style={stTextTertiary}>
              Bottleneck Detected: {funnel.bottleneck.label}</div>
            <div className="text-xs mt-0.5" style={stTextTertiary}>
              {funnel.bottleneck.count} investors stuck at this stage.
              Consider targeted follow-ups to move them forward.</div></div>
          <Link
            href="/pipeline"
            className="ml-auto shrink-0 flex items-center gap-1" style={labelTertiary}>
            Pipeline <ArrowRight className="w-3 h-3" /></Link></div>
      )}

      {/* ── Timeline Risk Alert ──────────────────────────────────── */}
      {risks.timelineRisk.level !== 'low' && (
        <div
          className="rounded-xl px-5 py-4 flex items-center gap-4"
          style={{
            background: `color-mix(in srgb, ${risks.timelineRisk.level === 'high' ? 'var(--danger-muted)' : 'var(--warning-muted)'} 20%, transparent)`,
          }}>
          <Clock className="w-5 h-5 shrink-0" style={{ color: risks.timelineRisk.level === 'high' ? 'var(--danger)' : 'var(--warning)' }}
            />
          <div>
            <div className="text-sm font-normal" style={{ color: risks.timelineRisk.level === 'high' ? 'var(--danger)' : 'var(--warning)' }}>
              Timeline Risk: {risks.timelineRisk.level === 'high' ? 'Critical' : 'Elevated'}</div>
            <div className="text-xs mt-0.5" style={stTextTertiary}>
              {risks.timelineRisk.daysRemaining !== null
                ? `${risks.timelineRisk.daysRemaining} days remaining to target close`
                : 'No target close date set'}
              {risks.timelineRisk.targetDate && ` (${new Date(risks.timelineRisk.targetDate).toLocaleDateString()})`}.
              No investors in advanced stages (DD+) yet.</div></div></div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          1. FUNNEL ANALYTICS
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Funnel Analytics"
        icon={<BarChart3 className="w-4 h-4" />}
        isOpen={expandedSections.has('funnel')}
        onToggle={() => toggleSection('funnel')}>
        {/* Funnel Visualization */}
        <div className="space-y-6">
          {/* Horizontal funnel bars */}
          <div>
            <h3 className="text-xs font-normal tracking-wider mb-3" style={stTextMuted}>
              Pipeline Distribution</h3>
            <div className="space-y-2">
              {summary.pipelineStages.map((stage, idx) => {
                const pct = (stage.count / maxStageCount) * 100;
                return (
                  <div key={stage.stage} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-right shrink-0" style={stTextTertiary}>
                      {stage.label}</div>
                    <div className="flex-1 h-8 rounded overflow-hidden relative" style={stSurface0}>
                      <div
                        className="h-full rounded transition-all duration-700 ease-out flex items-center px-3"
                        style={{
                          width: `${Math.max(pct, stage.count > 0 ? 8 : 0)}%`,
                          background: STAGE_COLORS[stage.stage] || 'var(--surface-3)', }}>
                        {stage.count > 0 && (
                          <span className="text-xs font-normal" style={{ ...stTextPrimary, opacity: 0.9 }}>{stage.count}</span>
                        )}</div></div>
                  </div>);
              })}
              {/* Passed / Dropped */}
              {((funnel.exact['passed'] || 0) > 0 || (funnel.exact['dropped'] || 0) > 0) && (
                <div className="pt-2 mt-2 space-y-2" style={stBorderTop}>
                  {(funnel.exact['passed'] || 0) > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-xs text-right shrink-0" style={{ ...stTextPrimary, opacity: 0.8 }}>Passed</div>
                      <div className="flex-1 h-8 rounded overflow-hidden" style={stSurface0}>
                        <div
                          className="h-full rounded flex items-center px-3"
                          style={{
                            width: `${Math.max((funnel.exact['passed'] / maxStageCount) * 100, 8)}%`,
                            background: 'var(--danger-muted)', }}>
                          <span className="text-xs font-normal" style={stTextPrimary}>{funnel.exact['passed']}</span></div></div>
                    </div>
                  )}
                  {(funnel.exact['dropped'] || 0) > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-xs text-right shrink-0" style={stTextMuted}>Dropped</div>
                      <div className="flex-1 h-8 rounded overflow-hidden" style={stSurface0}>
                        <div
                          className="h-full rounded flex items-center px-3"
                          style={{
                            width: `${Math.max((funnel.exact['dropped'] / maxStageCount) * 100, 8)}%`,
                            background: 'var(--surface-2)', }}>
                          <span className="text-xs font-normal" style={stTextTertiary}>{funnel.exact['dropped']}</span></div>
                      </div></div>
                  )}</div>
              )}</div></div>

          {/* Conversion Funnel */}
          {(() => {
            const stages = summary.pipelineStages.filter(s => !['passed','dropped'].includes(s.stage));
            const total = stages[0]?.count || 1;
            return (
              <div>
                <h3 className="text-xs font-normal tracking-wider mb-3" style={stTextMuted}>Conversion Funnel</h3>
                <div className="flex flex-col items-center gap-0.5">
                  {stages.map((s, i) => {
                    const w = Math.max(20, (s.count / total) * 100);
                    const prev = stages[i - 1]?.count || total;
                    const drop = i > 0 && prev > 0 ? Math.round(((prev - s.count) / prev) * 100) : 0;
                    return (
                      <div key={s.stage} className="flex items-center gap-2 w-full" style={{ maxWidth: '500px' }}>
                        <div className="h-7 rounded flex items-center justify-center transition-all" style={{ width: `${w}%`, margin: '0 auto', background: STAGE_COLORS[s.stage] || 'var(--surface-3)', minWidth: '60px' }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>{s.label} ({s.count})</span></div>
                        {i > 0 && drop > 0 && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger)', whiteSpace: 'nowrap' }}>-{drop}%</span>}
                      </div>);
                  })}</div></div>);
          })()}

          {/* Conversion Rates */}
          <div>
            <h3 className="text-xs font-normal tracking-wider mb-3" style={stTextMuted}>
              Stage-to-Stage Conversion</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {funnel.conversionRates.map(cr => (
                <div key={`${cr.from}-${cr.to}`} className="rounded-lg p-3">
                  <div className="mb-1 truncate" style={labelMuted10}>
                    {STAGE_LABELS[cr.from]} {'->'} {STAGE_LABELS[cr.to]}</div>
                  <div
                    className="text-xl font-normal"
                    style={{
                      color: cr.rate >= 60 ? 'var(--success)' :
                        cr.rate >= 30 ? 'var(--warning)' :
                        cr.rate > 0 ? 'var(--danger)' : 'var(--text-muted)', }}>
                    {cr.rate}%</div>
                  <div style={labelMuted10}>
                    {cr.fromCount} {'->'} {cr.toCount}</div></div>
              ))}</div></div>

          {/* Drop-off Analysis */}
          <div>
            <h3 className="text-xs font-normal tracking-wider mb-3" style={stTextMuted}>
              Drop-off by Stage</h3>
            <div className="space-y-1.5">
              {funnel.dropOffRates.filter(d => d.rate > 0).map(d => (
                <div key={d.stage} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-right shrink-0" style={stTextTertiary}>
                    {STAGE_LABELS[d.stage]}</div>
                  <div className="flex-1 h-6 rounded overflow-hidden" style={stSurface0}>
                    <div
                      className="h-full rounded-l flex items-center px-2"
                      style={{ width: `${Math.max(d.rate, 5)}%`, background: 'var(--danger-muted)' }}>
                      <span className="font-normal whitespace-nowrap" style={{ fontSize: 'var(--font-size-xs)', ...stTextPrimary }}>
                        {d.rate}% ({d.count})</span></div></div></div>
              ))}
              {funnel.dropOffRates.every(d => d.rate === 0) && (
                <p style={labelSmMuted}>No drop-offs detected yet. Add more investors and progress them through stages.</p>
              )}</div></div>

          {/* Average Time in Stage */}
          {Object.keys(funnel.avgTimeInStage).length > 0 && (
            <div>
              <h3 className="text-xs font-normal tracking-wider mb-3" style={stTextMuted}>
                Average Time in Stage (days)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(funnel.avgTimeInStage).map(([stage, data]) => (
                  <div key={stage} className="rounded-lg p-3">
                    <div className="mb-1" style={labelMuted10}>{STAGE_LABELS[stage]}</div>
                    <div
                      className="text-lg font-normal"
                      style={{
                        color: data.avgDays > 14 ? 'var(--danger)' :
                          data.avgDays > 7 ? 'var(--warning)' :
                          'var(--success)', }}>
                      {data.avgDays}d</div>
                    <div style={labelMuted10}>n={data.count}</div></div>
                ))}</div></div>
          )}</div></CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════
          2. VELOCITY METRICS
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Velocity Metrics"
        icon={<TrendingUp className="w-4 h-4" />}
        isOpen={expandedSections.has('velocity')}
        onToggle={() => toggleSection('velocity')}>
        <div className="space-y-6">
          {/* Key velocity numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg p-3">
              <div style={labelMuted10}>Meetings This Week</div>
              <div className="text-2xl font-normal" style={stTextPrimary}>{velocity.meetingsThisWeek}</div>
              <div style={labelMuted10}>
                {velocity.meetingsLastWeek > 0 && (
                  <span style={{ color: velocity.meetingsThisWeek >= velocity.meetingsLastWeek ? 'var(--success)' : 'var(--danger)' }}>
                    {velocity.meetingsThisWeek >= velocity.meetingsLastWeek ? '+' : ''}
                    {velocity.meetingsThisWeek - velocity.meetingsLastWeek} vs last week</span>
                )}</div></div>
            <div className="rounded-lg p-3">
              <div style={labelMuted10}>Pipeline Velocity</div>
              <div className="text-2xl font-normal" style={stTextTertiary}>{velocity.velocityScore > 0 ? velocity.velocityScore.toFixed(1) : '—'}</div>
              <div style={labelMuted10}>weighted score</div></div>
            <div className="rounded-lg p-3">
              <div style={labelMuted10}>Days Since Progress</div>
              <div
                className="text-2xl font-normal"
                style={{
                  color: velocity.daysSinceProgress === null ? 'var(--text-muted)' :
                    velocity.daysSinceProgress > 7 ? 'var(--danger)' :
                    velocity.daysSinceProgress > 3 ? 'var(--warning)' :
                    'var(--success)', }}>
                {velocity.daysSinceProgress !== null ? velocity.daysSinceProgress : '—'}</div>
              <div style={labelMuted10}>last meeting or status change</div></div>
            <div className="rounded-lg p-3">
              <div style={labelMuted10}>Est. Days to Close</div>
              <div
                className="text-2xl font-normal"
                style={{
                  color: velocity.estimatedDaysToClose === null ? 'var(--text-muted)' :
                    velocity.estimatedDaysToClose < 30 ? 'var(--danger)' :
                    velocity.estimatedDaysToClose < 60 ? 'var(--warning)' :
                    'var(--accent)', }}>
                {velocity.estimatedDaysToClose !== null ? velocity.estimatedDaysToClose : '—'}</div>
              <div style={labelMuted10}>
                {velocity.onTrack === true && <span style={stTextSecondary}>On track</span>}
                {velocity.onTrack === false && <span style={stTextPrimary}>Behind schedule</span>}
                {velocity.onTrack === null && 'no target set'}</div></div></div>

          {/* Meetings per week sparkline */}
          <div>
            <h3 className="text-xs font-normal tracking-wider mb-3" style={stTextMuted}>
              Meetings Per Week (Last 8 Weeks)</h3>
            <SparklineChart data={velocity.meetingsPerWeek} color="var(--accent)" /></div>

          {/* Investors added per week */}
          <div>
            <h3 className="text-xs font-normal tracking-wider mb-3" style={stTextMuted}>
              New Investors Per Week</h3>
            <SparklineChart data={velocity.investorsPerWeek} color="var(--accent-muted)" /></div>

          {/* Activity Heatmap */}
          <div>
            <h3 className="text-xs font-normal tracking-wider mb-3" style={stTextMuted}>Daily Activity (4 Weeks)</h3>
            <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {['M','T','W','T','F','S','S'].map((d, i) => <div key={i} className="text-center" style={labelMuted}>{d}</div>)}
              {(() => {
                const maxActivity = Math.max(...velocity.dailyActivity.map(x => x.count), 1);
                return velocity.dailyActivity.map((d) => {
                  const intensity = d.count / maxActivity;
                  return <div key={d.date} className="rounded" title={`${d.date}: ${d.count} activities`} style={{ aspectRatio: '1', background: d.count === 0 ? 'var(--surface-1)' : `color-mix(in srgb, var(--accent) ${Math.round(20 + intensity * 80)}%, var(--surface-1))` }} />;
                });
              })()}</div></div></div></CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════
          3. RISK SIGNALS
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title={`Risk Signals${risks.totalAlerts > 0 ? ` (${risks.totalAlerts})` : ''}`}
        icon={<ShieldAlert className="w-4 h-4" />}
        isOpen={expandedSections.has('risks')}
        onToggle={() => toggleSection('risks')}
        badge={risks.totalAlerts > 0 ? {
          text: String(risks.totalAlerts),
          color: risks.totalAlerts > 5 ? 'var(--danger)' : risks.totalAlerts > 2 ? 'var(--warning)' : 'var(--accent)',
        } : undefined}>
        <div className="space-y-5">
          {/* Stale Investors */}
          <RiskSection
            title="Stale Investors"
            subtitle="Engaged+ investors with no meeting in 2+ weeks"
            count={risks.staleInvestors.length}
            severity={risks.staleInvestors.length > 3 ? 'high' : risks.staleInvestors.length > 0 ? 'medium' : 'low'}>
            {risks.staleInvestors.length === 0 ? (
              <p style={labelSmMuted}>No stale investors. All engaged investors have recent meetings.</p>
            ) : (
              <div className="space-y-1.5">
                {risks.staleInvestors.map(inv => (
                  <StaleInvestorRow key={inv.id} inv={inv} />
                ))}</div>
            )}</RiskSection>

          {/* Declining Enthusiasm */}
          <RiskSection
            title="Declining Enthusiasm"
            subtitle="Investors whose signal score dropped between meetings"
            count={risks.decliningEnthusiasm.length}
            severity={risks.decliningEnthusiasm.length > 2 ? 'high' : risks.decliningEnthusiasm.length > 0 ? 'medium' : 'low'}>
            {risks.decliningEnthusiasm.length === 0 ? (
              <p style={labelSmMuted}>No declining enthusiasm detected.</p>
            ) : (
              <div className="space-y-1.5">
                {risks.decliningEnthusiasm.map(inv => (
                  <DecliningEnthusiasmRow key={inv.id} inv={inv} />
                ))}</div>
            )}</RiskSection>

          {/* High-Tier Stuck */}
          <RiskSection
            title="High-Tier Investors Not Progressing"
            subtitle="T1/T2 investors stuck in stage for 14+ days"
            count={risks.highTierStuck.length}
            severity={risks.highTierStuck.length > 3 ? 'high' : risks.highTierStuck.length > 0 ? 'medium' : 'low'}>
            {risks.highTierStuck.length === 0 ? (
              <p style={labelSmMuted}>All high-tier investors are progressing.</p>
            ) : (
              <div className="space-y-1.5">
                {risks.highTierStuck.map(inv => (
                  <HighTierStuckRow key={inv.id} inv={inv} />
                ))}</div>
            )}</RiskSection>

          {/* Concentration Risk */}
          <RiskSection
            title="Concentration Risk"
            subtitle="Diversification across investor types"
            count={risks.concentrationRisk.isRisky ? 1 : 0}
            severity={risks.concentrationRisk.isRisky ? 'medium' : 'low'}>
            <div className="space-y-3">
              {risks.concentrationRisk.isRisky && (
                <p style={textSmTertiary}>
                  {risks.concentrationRisk.maxConcentration}% of active pipeline is {TYPE_LABELS[risks.concentrationRisk.dominantType || ''] || risks.concentrationRisk.dominantType}.
                  Consider diversifying investor outreach.</p>
              )}
              <div className="flex gap-2 flex-wrap">
                {Object.entries(risks.concentrationRisk.breakdown).map(([type, count]) => (
                  <div key={type} className="rounded px-3 py-2">
                    <div style={labelMuted10}>{TYPE_LABELS[type] || type}</div>
                    <div className="text-sm font-normal" style={stTextPrimary}>{count}</div></div>
                ))}</div></div></RiskSection></div></CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════
          4. ENGAGEMENT INTELLIGENCE
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Engagement Intelligence"
        icon={<MessageSquare className="w-4 h-4" />}
        isOpen={expandedSections.has('engagement')}
        onToggle={() => toggleSection('engagement')}>
        <div className="space-y-6">
          {/* Enthusiasm by Type */}
          <div>
            <h3 className="text-xs font-normal tracking-wider mb-3" style={stTextMuted}>
              Average Enthusiasm by Investor Type</h3>
            {Object.keys(engagement.enthusiasmByType).length === 0 ? (
              <p style={labelSmMuted}>No enthusiasm data yet. Log meetings to track investor signals.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {sortedEnthusiasmByType.map(([type, data]) => (
                    <div key={type} className="rounded-lg p-3">
                      <div className="mb-1" style={labelMuted10}>{TYPE_LABELS[type] || type}</div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-lg font-normal"
                          style={{
                            color: data.avg >= 4 ? 'var(--success)' :
                              data.avg >= 3 ? 'var(--accent)' :
                              data.avg >= 2 ? 'var(--warning)' :
                              'var(--danger)', }}>
                          {data.avg}</span>
                        <EnthusiasmDots score={Math.round(data.avg)} /></div>
                      <div className="mt-0.5" style={labelMuted10}>n={data.count}</div></div>
                  ))}</div>
            )}</div>

          {/* Objection Leaderboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <h3 className="text-xs font-normal tracking-wider mb-3" style={stTextMuted}>
                Top Objection Topics</h3>
              {engagement.topObjections.length === 0 ? (
                <p style={labelSmMuted}>No objections recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {engagement.topObjections.map((obj, i) => {
                    const maxCount = engagement.topObjections[0]?.count || 1;
                    const pct = (obj.count / maxCount) * 100;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs w-4 text-right shrink-0" style={stTextMuted}>
                          {i + 1}.</span>
                        <div className="flex-1 relative">
                          <div className="h-7 rounded overflow-hidden" style={stSurface0}>
                            <div
                              className="h-full rounded flex items-center px-2"
                              style={{ width: `${Math.max(pct, 15)}%`, background: 'var(--danger-muted)' }}>
                              <span className="truncate" style={labelSecondary}>{obj.topic}</span></div>
                          </div></div>
                        <span className="text-xs font-normal shrink-0 w-8 text-right" style={stTextPrimary}>
                          {obj.count}x</span>
                      </div>);
                  })}</div>
              )}</div>

            <div className="space-y-4">
              {/* Objection Resolution */}
              <div>
                <h3 className="text-xs font-normal tracking-wider mb-3" style={stTextMuted}>
                  Objection Resolution</h3>
                <div className="rounded-lg p-4">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-3xl font-normal"
                      style={{
                        color: engagement.objectionResolutionRate >= 70 ? 'var(--success)' :
                          engagement.objectionResolutionRate >= 40 ? 'var(--warning)' :
                          engagement.totalObjections === 0 ? 'var(--text-muted)' :
                          'var(--danger)', }}>
                      {engagement.totalObjections > 0 ? `${engagement.objectionResolutionRate}%` : '—'}</span>
                    <span style={labelMuted}>resolved</span></div>
                  <div className="mt-2 h-3 rounded-full overflow-hidden" style={stSurface0}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${engagement.objectionResolutionRate}%`,
                        background: engagement.objectionResolutionRate >= 70 ? 'var(--success)' :
                          engagement.objectionResolutionRate >= 40 ? 'var(--warning)' :
                          'var(--danger)', }}/></div>
                  <div className="mt-2" style={labelMuted10}>
                    {engagement.addressedObjections} of {engagement.totalObjections} objections addressed</div></div></div>

              {/* Competitive Mentions */}
              <div>
                <h3 className="text-xs font-normal tracking-wider mb-3" style={stTextMuted}>
                  Competitive Intelligence</h3>
                <div className="rounded-lg p-4">
                  <div className="text-2xl font-normal" style={stTextPrimary}>
                    {engagement.competitiveMentions}</div>
                  <div style={labelMuted10}>meetings with competitive mentions</div>
                  {engagement.topCompetitors.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {engagement.topCompetitors.map(c => (
                        <span
                          key={c.name}
                          className="px-2 py-1 rounded"
                          style={competitorBadge}>
                          {c.name} ({c.count}x)</span>
                      ))}</div>
                  )}</div></div></div></div></div></CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════
          5. WIN/LOSS INSIGHTS
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Win / Loss Insights"
        icon={<Target className="w-4 h-4" />}
        isOpen={expandedSections.has('winloss')}
        onToggle={() => toggleSection('winloss')}>
        <div className="space-y-6">
          {/* Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg p-3">
              <div style={labelMuted10}>Passed</div>
              <div className="text-2xl font-normal" style={stTextPrimary}>{winLoss.passedCount}</div></div>
            <div className="rounded-lg p-3">
              <div style={labelMuted10}>Dropped</div>
              <div className="text-2xl font-normal" style={stTextMuted}>{winLoss.droppedCount}</div></div>
            <div className="rounded-lg p-3">
              <div style={labelMuted10}>Attrition Rate</div>
              <div
                className="text-2xl font-normal"
                style={{
                  color: winLoss.passRate > 30 ? 'var(--danger)' :
                    winLoss.passRate > 15 ? 'var(--warning)' :
                    winLoss.passRate > 0 ? 'var(--success)' :
                    'var(--text-muted)', }}>
                {winLoss.passRate}%</div></div>
            <div className="rounded-lg p-3">
              <div style={labelMuted10}>Active</div>
              <div className="text-2xl font-normal" style={stTextSecondary}>
                {summary.activeInvestors}</div></div></div>

          {/* Outcomes by Tier */}
          {Object.keys(winLoss.outcomeByTier).length > 0 && (
            <div>
              <h3 className="text-xs font-normal tracking-wider mb-3" style={stTextMuted}>
                Outcomes by Tier</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {sortedOutcomeByTier.map(([tier, data]) => {
                    const total = data.active + data.passed + data.dropped;
                    return (
                      <div key={tier} className="rounded-lg p-3">
                        <div className="mb-2" style={labelMuted10}>Tier {tier}</div>
                        <div className="h-4 rounded-full overflow-hidden flex" style={stSurface0}>
                          {data.active > 0 && (
                            <div
                              className="h-full"
                              style={{ width: `${(data.active / total) * 100}%`, background: 'var(--success)' }}
                              title={`Active: ${data.active}`}/>
                          )}
                          {data.passed > 0 && (
                            <div
                              className="h-full"
                              style={{ width: `${(data.passed / total) * 100}%`, background: 'var(--danger)' }}
                              title={`Passed: ${data.passed}`}/>
                          )}
                          {data.dropped > 0 && (
                            <div
                              className="h-full"
                              style={{ width: `${(data.dropped / total) * 100}%`, background: 'var(--surface-3)' }}
                              title={`Dropped: ${data.dropped}`}/>
                          )}</div>
                        <div className="flex justify-between mt-1.5" style={{ fontSize: 'var(--font-size-xs)' }}>
                          <span style={stTextSecondary}>{data.active} active</span>
                          <span style={stTextPrimary}>{data.passed + data.dropped} out</span></div>
                      </div>);
                  })}</div></div>
          )}

          {/* Outcomes by Type */}
          {Object.keys(winLoss.outcomeByType).length > 0 && (
            <div>
              <h3 className="text-xs font-normal tracking-wider mb-3" style={stTextMuted}>
                Outcomes by Investor Type</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {sortedOutcomeByType.map(([type, data]) => {
                    const total = data.active + data.passed + data.dropped;
                    const retentionRate = total > 0 ? Math.round((data.active / total) * 100) : 0;
                    return (
                      <div key={type} className="rounded-lg p-3">
                        <div className="mb-1" style={labelMuted10}>{TYPE_LABELS[type] || type}</div>
                        <div
                          className="text-lg font-normal"
                          style={{
                            color: retentionRate >= 80 ? 'var(--success)' :
                              retentionRate >= 50 ? 'var(--warning)' :
                              'var(--danger)', }}>
                          {retentionRate}%</div>
                        <div style={labelMuted10}>
                          {data.active} active, {data.passed} passed, {data.dropped} dropped</div>
                      </div>);
                  })}</div></div>
          )}

          {/* Top Pass Reasons */}
          {winLoss.topPassReasons.length > 0 && (
            <div>
              <h3 className="text-xs font-normal tracking-wider mb-3" style={stTextMuted}>
                Top Pass Reasons</h3>
              <div className="space-y-1.5">
                {winLoss.topPassReasons.map((reason, i) => (
                  <div key={i} className="flex items-center gap-3 py-1">
                    <span className="text-xs w-4 text-right" style={stTextMuted}>{i + 1}.</span>
                    <span className="text-sm flex-1" style={stTextSecondary}>{reason.topic}</span>
                    <span className="text-xs font-normal" style={stTextPrimary}>{reason.count}x</span></div>
                ))}</div></div>
          )}

          {/* Empty state */}
          {winLoss.passedCount === 0 && winLoss.droppedCount === 0 && (
            <p style={labelSmMuted}>
              No investors have passed or dropped yet. Win/loss insights will appear as the process progresses.</p>
          )}</div></CollapsibleSection>
    </div>);
}

// ── Subcomponents ──────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, icon, color,
}: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <div className="rounded-xl px-4 py-3" style={stSurface1}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="font-normal tracking-wider" style={labelMuted10}>{label}</span></div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-normal" style={stTextPrimary}>{value}</span>
        <span style={labelMuted10}>{sub}</span></div>
    </div>);
}

function CollapsibleSection({
  title, icon, isOpen, onToggle, children, badge,
}: {
  title: string; icon: React.ReactNode; isOpen: boolean;
  onToggle: () => void; children: React.ReactNode;
  badge?: { text: string; color: string };
}) {
  return (
    <div className="rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 transition-colors hover-row"
        style={{ background: 'transparent' }}>
        <div className="flex items-center gap-3">
          <span style={stTextTertiary}>{icon}</span>
          <span className="text-sm font-normal" style={stTextPrimary}>{title}</span>
          {badge && (
            <span className="font-normal px-1.5 py-0.5 rounded-full" style={{ fontSize: 'var(--font-size-xs)', background: badge.color, ...stTextPrimary }}>
              {badge.text}</span>
          )}</div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4" style={stTextMuted} />
        ) : (
          <ChevronDown className="w-4 h-4" style={stTextMuted} />
        )}</button>
      {isOpen && (
        <div className="px-5 pb-5 pt-4" style={stBorderTop}>
          {children}</div>
      )}
    </div>);
}

function SparklineChart({
  data, color,
}: {
  data: Array<{ week: string; count: number }>;
  color: string;
}) {
  const maxVal = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="font-normal" style={labelMuted10}>{d.count}</span>
          <div className="w-full rounded-t relative" style={{ height: '72px', ...stSurface0 }}>
            <div
              className="absolute bottom-0 w-full rounded-t transition-all duration-500"
              style={{
                height: `${Math.max((d.count / maxVal) * 100, d.count > 0 ? 8 : 0)}%`,
                background: color, }}/></div>
          <span className="truncate w-full text-center" style={{ fontSize: 'var(--font-size-xs)', ...stTextMuted }}>{d.week}</span></div>
      ))}
    </div>);
}


function RiskSection({
  title, subtitle, count, severity, children,
}: {
  title: string; subtitle: string; count: number;
  severity: 'low' | 'medium' | 'high'; children: React.ReactNode;
}) {
  const borderColor = {
    low: 'var(--border-subtle)',
    medium: 'var(--warning-muted)',
    high: 'var(--danger-muted)',
  }[severity];

  const dotColor = {
    low: 'var(--success)',
    medium: 'var(--warning)',
    high: 'var(--danger)',
  }[severity];

  const badgeBg = {
    low: 'var(--surface-3)',
    medium: 'var(--warning)',
    high: 'var(--danger)',
  }[severity];

  const badgeText = {
    low: 'var(--text-secondary)',
    medium: 'var(--text-primary)',
    high: 'var(--text-primary)',
  }[severity];

  return (
    <div className="rounded-lg p-4" style={{ border: `1px solid ${borderColor}` }}>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full" style={{ background: dotColor }} />
        <h4 className="text-sm font-normal" style={stTextPrimary}>{title}</h4>
        {count > 0 && (
          <span
            className="font-normal px-1.5 py-0.5 rounded-full"
            style={{ fontSize: 'var(--font-size-xs)', background: badgeBg, color: badgeText }}>
            {count}</span>
        )}</div>
      <p className="mb-3" style={labelMuted10}>{subtitle}</p>
      {children}
    </div>);
}

function StaleInvestorRow({ inv }: { inv: { id: string; name: string; status: string; tier: number; type: string; daysSinceLastMeeting: number | null } }) {
  const tierStyle = inv.tier === 1
    ? { background: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' }
    : inv.tier === 2
    ? { background: 'color-mix(in srgb, var(--accent-muted) 20%, transparent)', color: 'var(--accent-muted)' }
    : { background: 'var(--surface-1)', color: 'var(--text-tertiary)' };

  return (
    <Link
      href={`/investors/${inv.id}`}
      className="flex items-center justify-between py-2 px-3 rounded-lg transition-colors group hover-row">
      <div className="flex items-center gap-3 min-w-0">
        <span className="px-1.5 py-0.5 rounded" style={{ fontSize: 'var(--font-size-xs)', ...tierStyle }}>
          T{inv.tier}</span>
        <span className="text-sm font-normal truncate" style={stTextPrimary}>{inv.name}</span>
        <span style={labelMuted10}>{STAGE_LABELS[inv.status]}</span></div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs" style={stTextPrimary}>
          {inv.daysSinceLastMeeting !== null
            ? `${inv.daysSinceLastMeeting}d ago`
            : 'No meetings'}</span>
        <ArrowRight className="w-3 h-3 transition-colors" style={stTextMuted}
          /></div>
    </Link>);
}

function DecliningEnthusiasmRow({ inv }: { inv: { id: string; name: string; tier: number; type: string; previousScore: number; currentScore: number } }) {
  const tierStyle = inv.tier === 1
    ? { background: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }
    : { background: 'color-mix(in srgb, var(--accent-muted) 20%, transparent)', color: 'var(--accent-muted)', border: '1px solid color-mix(in srgb, var(--accent-muted) 30%, transparent)' };

  return (
    <Link
      href={`/investors/${inv.id}`}
      className="flex items-center justify-between py-2 px-3 rounded-lg transition-colors group hover-row">
      <div className="flex items-center gap-3 min-w-0">
        <span className="px-1.5 py-0.5 rounded" style={{ fontSize: 'var(--font-size-xs)', ...tierStyle }}>T{inv.tier}</span>
        <span className="text-sm font-normal truncate" style={stTextPrimary}>{inv.name}</span></div>
      <div className="flex items-center gap-2 shrink-0">
        <EnthusiasmDots score={inv.previousScore} size="sm" />
        <span className="text-xs" style={stTextMuted}>{'>'}</span>
        <EnthusiasmDots score={inv.currentScore} size="sm" />
        <ArrowRight className="w-3 h-3 ml-1 transition-colors" style={stTextMuted}
          /></div>
    </Link>);
}

function HighTierStuckRow({ inv }: { inv: { id: string; name: string; tier: number; status: string; type: string; daysInStage: number } }) {
  return (
    <Link
      href={`/investors/${inv.id}`}
      className="flex items-center justify-between py-2 px-3 rounded-lg transition-colors group hover-row">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="px-1.5 py-0.5 rounded"
          style={{
            fontSize: 'var(--font-size-xs)',
            background: 'color-mix(in srgb, var(--accent) 20%, transparent)',
            color: 'var(--accent)',
            border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', }}>
          T{inv.tier}</span>
        <span className="text-sm font-normal truncate" style={stTextPrimary}>{inv.name}</span>
        <span style={labelMuted10}>{STAGE_LABELS[inv.status]}</span></div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs" style={stTextTertiary}>
          {inv.daysInStage}d in stage</span>
        <ArrowRight className="w-3 h-3 transition-colors" style={stTextMuted}
          /></div>
    </Link>);
}

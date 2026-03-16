'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { cachedFetch } from '@/lib/cache';
import Link from 'next/link';
import {
  Target, Activity, Shield, Users, TrendingUp, TrendingDown,
  Minus, RefreshCw, AlertTriangle, ArrowRight, Clock,
  BarChart3, MessageCircleWarning, Zap, CheckCircle2, ExternalLink,
} from 'lucide-react';
import { deltaColor, gaugeColor, gaugeColor as gaugeBarColor, labelMuted, labelMuted10, labelSecondary, stAccent, stFontSm, stFontXs, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary, textSmTertiary } from '@/lib/styles';
import { useToast } from '@/components/toast';
import { relativeTime } from '@/lib/time';
import { CopyButton } from '@/components/copy-button';

const mbSpace1 = { marginBottom: 'var(--space-1)' } as const;
const fontSmTertiary = { ...textSmTertiary, fontWeight: 400 } as const;
const trendValueBase = { fontSize: 'var(--font-size-lg)', fontWeight: 300, fontVariantNumeric: 'tabular-nums' } as const;
const trendDeltaRow = { fontSize: 'var(--font-size-xs)' } as const;
const trendStreakLabel = { fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-0)' } as const;
const investorLinkStyle = { color: 'var(--accent)', textDecoration: 'none', fontWeight: 400 } as const;
const daysNumericStyle = { fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' } as const;
const numPrimaryStyle = { color: 'var(--text-primary)', fontWeight: 400, fontVariantNumeric: 'tabular-nums' } as const;
const riskFactorText = { fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', opacity: 0.8 } as const;
const trendAlertWrap = { marginTop: 'var(--space-1)' } as const;
const trendAlertText = { fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', lineHeight: 1.3 } as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StrategicRecommendation {
  priority: 1 | 2 | 3 | 4 | 5;
  category: 'pipeline' | 'narrative' | 'execution' | 'timing' | 'risk';
  title: string;
  rationale: string;
  action: string;
  expectedImpact: string;
  deadline: string;
}

interface HealthSnapshotPoint {
  date: string;
  pipelineScore: number;
  narrativeScore: number;
  readinessScore: number;
  velocity: number;
  activeInvestors: number;
}

interface TemporalTrend {
  metric: string;
  current: number;
  avg7d: number;
  avg30d: number;
  delta7d: number;
  delta30d: number;
  direction: 'improving' | 'declining' | 'stable';
  streak: number;
  alert: string | null;
}

interface TemporalTrends {
  trends: TemporalTrend[];
  overallDirection: 'improving' | 'declining' | 'mixed' | 'stable';
  daysOfData: number;
  alertCount: number;
}

interface RaiseForecastData {
  expectedCloseDate: string;
  confidence: string;
  criticalPath: string[];
  nearestClose: { name: string; days: number; stage: string } | null;
  riskFactors: string[];
  investorForecasts: { name: string; stage: string; days: number; confidence: string }[];
}

interface StrategicData {
  ceoBrief: string;
  raiseVelocity: {
    meetingsPerWeek: number;
    stageAdvancesPerWeek: number;
    trend: 'accelerating' | 'steady' | 'decelerating';
  };
  narrativeHealthScore: number;
  pipelineConcentrationRisk: number;
  fundraiseReadinessScore: number;
  recommendations: StrategicRecommendation[];
  healthSnapshot: {
    pipelineScore: number;
    narrativeScore: number;
    readinessScore: number;
    velocity: number;
    activeInvestors: number;
  };
  historicalSnapshots: HealthSnapshotPoint[];
  temporalTrends: TemporalTrends | null;
  raiseForecast: RaiseForecastData | null;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  pipeline:  { label: 'Pipeline',  color: 'var(--accent)',    bg: 'var(--accent-muted)',    border: 'var(--border-default)',    icon: Users },
  narrative: { label: 'Narrative', color: 'var(--chart-4)',          bg: 'var(--cat-12)', border: 'var(--cat-40)', icon: MessageCircleWarning },
  execution: { label: 'Execution', color: 'var(--text-secondary)',   bg: 'var(--success-muted)',   border: 'var(--accent-40)',   icon: Zap },
  timing:    { label: 'Timing',    color: 'var(--text-tertiary)',   bg: 'var(--warning-muted)',   border: 'var(--warn-40)',  icon: Clock },
  risk:      { label: 'Risk',      color: 'var(--text-primary)',    bg: 'var(--danger-muted)',    border: 'var(--accent-8)',   icon: Shield },
};

const TREND_CONFIG = {
  accelerating: { label: 'Accelerating', icon: TrendingUp,    color: 'var(--text-secondary)',  bg: 'var(--success-muted)',  border: 'var(--accent-40)' },
  steady:       { label: 'Steady',       icon: Minus,          color: 'var(--text-tertiary)',  bg: 'var(--warning-muted)',  border: 'var(--warn-40)' },
  decelerating: { label: 'Decelerating', icon: TrendingDown,   color: 'var(--text-primary)',   bg: 'var(--danger-muted)',   border: 'var(--accent-8)' },
};

function priorityStyle(p: number): React.CSSProperties {
  if (p === 1) return { background: 'var(--danger-muted)', color: 'var(--text-primary)', borderColor: 'var(--accent-8)' };
  if (p === 2) return { background: 'var(--warn-12)', color: 'var(--text-tertiary)', borderColor: 'var(--warn-40)' };
  if (p === 3) return { background: 'var(--warning-muted)', color: 'var(--text-tertiary)', borderColor: 'var(--warn-40)' };
  return { background: 'var(--surface-2)', color: 'var(--text-tertiary)', borderColor: 'var(--border-default)' };
}

function directionStyle(direction: string): React.CSSProperties {
  if (direction === 'improving') return { background: 'var(--success-muted)', color: 'var(--text-secondary)', borderColor: 'var(--accent-40)' };
  if (direction === 'declining') return { background: 'var(--danger-muted)', color: 'var(--text-primary)', borderColor: 'var(--accent-8)' };
  if (direction === 'mixed') return { background: 'var(--warning-muted)', color: 'var(--text-tertiary)', borderColor: 'var(--warn-40)' };
  return { background: 'var(--surface-2)', color: 'var(--text-tertiary)', borderColor: 'var(--border-default)' };
}

function trendCardStyle(direction: string): React.CSSProperties {
  const border = direction === 'improving' ? 'var(--accent-15)' : direction === 'declining' ? 'var(--accent-8)' : 'var(--border-subtle)';
  const bg = direction === 'improving' ? 'var(--accent-4)' : direction === 'declining' ? 'var(--accent-8)' : 'var(--surface-1)';
  return { borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', border: `1px solid ${border}`, background: bg };
}

function confidenceStyle(confidence: string): React.CSSProperties {
  if (confidence === 'high') return { background: 'var(--success-muted)', color: 'var(--text-secondary)', borderColor: 'var(--accent-40)' };
  if (confidence === 'medium') return { background: 'var(--warning-muted)', color: 'var(--text-tertiary)', borderColor: 'var(--warn-40)' };
  return { background: 'var(--danger-muted)', color: 'var(--text-primary)', borderColor: 'var(--accent-8)' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StrategicPage() {
  const { toast } = useToast();
  const [data, setData] = useState<StrategicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readinessMap, setReadinessMap] = useState<Record<string, { score: number; level: string; blockers: string[] }>>({});

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [stratRes, readyRes] = await Promise.allSettled([
        cachedFetch('/api/intelligence/strategic').then(r => { if (!r.ok) throw new Error('Couldn\'t load strategic data — try refreshing'); return r.json(); }),
        cachedFetch('/api/readiness').then(r => r.ok ? r.json() : null),
      ]);
      if (stratRes.status === 'rejected') throw stratRes.reason;
      setData(stratRes.value);
      if (readyRes.status === 'fulfilled' && readyRes.value?.investors) {
        const map: Record<string, { score: number; level: string; blockers: string[] }> = {};
        for (const inv of readyRes.value.investors) {
          map[inv.investorName] = { score: inv.readinessScore ?? 0, level: inv.readinessLevel ?? 'cold', blockers: inv.blockingFactors ?? [] };
        }
        setReadinessMap(map);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Couldn\'t load data — try refreshing';
      setError(msg);
      if (!silent) toast(msg, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { document.title = 'Raise | Strategic Dashboard'; }, []);
  useEffect(() => {
    fetchData();
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) fetchData(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6 page-content">
        <div className="skeleton" style={{ height: '28px', width: '250px' }} />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading strategic intelligence...</p>
        <div className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-lg)' }} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={{ height: '140px', borderRadius: 'var(--radius-lg)' }} />
          ))}</div>
        <div className="skeleton" style={{ height: '250px', borderRadius: 'var(--radius-lg)' }} />
      </div>);
  }

  if (error || !data) {
    return (
      <div className="space-y-8">
        <h1 className="page-title">Strategic Dashboard</h1>
        <div style={{ background: 'var(--accent-8)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)' }} className="text-center space-y-3">
          <AlertTriangle className="w-8 h-8 mx-auto" style={stTextPrimary} />
          <p style={stTextTertiary}>{error || 'Couldn\'t load strategic data.'}</p>
          <button
            onClick={() => fetchData()}
            className="btn btn-sm btn-secondary btn-surface transition-colors">
            Retry</button></div>
      </div>);
  }

  const trendCfg = TREND_CONFIG[data.raiseVelocity.trend];
  const TrendIcon = trendCfg.icon;
  const concentrationPct = Math.round(data.pipelineConcentrationRisk * 100);

  return (
    <div className="page-content space-y-6">
      {/* ================================================================ */}
      {/* HEADER                                                           */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Strategic Dashboard</h1>
          <p className="page-subtitle" style={stFontSm}>Consolidated intelligence assessment</p></div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="btn btn-sm btn-secondary btn-surface transition-colors"
          style={{ opacity: refreshing ? 0.5 : 1 }}>
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}</button></div>

      {/* ================================================================ */}
      {/* CEO BRIEF                                                        */}
      {/* ================================================================ */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={stAccent} />
            <span className="section-title" style={{ marginBottom: 0 }}>CEO Brief</span></div>
          <CopyButton text={data.ceoBrief} /></div>
        <p style={{ fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)', lineHeight: 1.6 }}>{data.ceoBrief}</p></div>

      {/* ================================================================ */}
      {/* GAUGE CARDS                                                      */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 card-stagger">
        {/* Readiness Score */}
        <GaugeCard
          label="Fundraise Readiness"
          value={data.fundraiseReadinessScore}
          suffix="/100"
          description="Pipeline depth, narrative, execution, data room"
          barPct={data.fundraiseReadinessScore}
          barColor={gaugeBarColor(data.fundraiseReadinessScore)}
          valueColor={gaugeColor(data.fundraiseReadinessScore)} />
        {/* Narrative Health */}
        <GaugeCard
          label="Narrative Health"
          value={data.narrativeHealthScore}
          suffix="/100"
          description="Question convergence, objections, enthusiasm"
          barPct={data.narrativeHealthScore}
          barColor={gaugeBarColor(data.narrativeHealthScore)}
          valueColor={gaugeColor(data.narrativeHealthScore)} />
        {/* Pipeline Concentration */}
        <GaugeCard
          label="Pipeline Concentration"
          value={concentrationPct}
          suffix="%"
          description={concentrationPct < 25 ? 'Well diversified' : concentrationPct < 40 ? 'Moderate risk' : 'Too concentrated'}
          barPct={concentrationPct}
          barColor={gaugeBarColor(data.pipelineConcentrationRisk, true)}
          valueColor={gaugeColor(data.pipelineConcentrationRisk, true)} />
        {/* Raise Velocity */}
        <div className="card-metric flex flex-col">
          <div className="metric-label" style={mbSpace1}>Raise Velocity</div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className="badge"
              style={{
                background: trendCfg.bg,
                color: trendCfg.color,
                border: `1px solid ${trendCfg.border}`,
                fontSize: 'var(--font-size-xs)',
                fontWeight: 400, }}>
              <TrendIcon className="w-3 h-3" />
              {trendCfg.label}</span></div>
          <div className="mt-auto space-y-1.5">
            <div className="flex items-center justify-between" style={stFontSm}>
              <span style={stTextMuted}>Meetings/wk</span>
              <span style={numPrimaryStyle}>{data.raiseVelocity.meetingsPerWeek}</span>
            </div>
            <div className="flex items-center justify-between" style={stFontSm}>
              <span style={stTextMuted}>Advances/wk</span>
              <span style={numPrimaryStyle}>{data.raiseVelocity.stageAdvancesPerWeek}</span>
            </div></div></div></div>

      {/* ================================================================ */}
      {/* HEALTH TREND SPARKLINE                                           */}
      {/* ================================================================ */}
      {data.historicalSnapshots.length >= 2 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4" style={stAccent} />
            <span style={fontSmTertiary}>Health Trend</span>
            <span className="ml-auto" style={labelMuted}>{data.historicalSnapshots.length} snapshots</span></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SparklineRow
              label="Readiness"
              values={data.historicalSnapshots.map(s => s.readinessScore)}
              dates={data.historicalSnapshots.map(s => s.date)}
              color="success" />
            <SparklineRow
              label="Narrative"
              values={data.historicalSnapshots.map(s => s.narrativeScore)}
              dates={data.historicalSnapshots.map(s => s.date)}
              color="purple" />
            <SparklineRow
              label="Pipeline"
              values={data.historicalSnapshots.map(s => s.pipelineScore)}
              dates={data.historicalSnapshots.map(s => s.date)}
              color="accent" /></div></div>
      )}

      {/* ================================================================ */}
      {/* TEMPORAL TRENDS (cycle 14)                                        */}
      {/* ================================================================ */}
      {data.temporalTrends && data.temporalTrends.trends.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4" style={stAccent} />
            <span style={fontSmTertiary}>Temporal Intelligence</span>
            <span className="badge ml-2" style={{ ...directionStyle(data.temporalTrends.overallDirection), border: `1px solid`, fontSize: 'var(--font-size-xs)', fontWeight: 400 }}>{data.temporalTrends.overallDirection}</span>
            <span className="ml-auto" style={labelMuted}>{data.temporalTrends.daysOfData} days of data</span></div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {data.temporalTrends.trends.map((trend) => (
              <div
                key={trend.metric}
                style={trendCardStyle(trend.direction)}>
                <div className="metric-label" style={mbSpace1}>{trend.metric}</div>
                <div className="flex items-center gap-1.5">
                  {trend.direction === 'improving' ? (
                    <TrendingUp className="w-3.5 h-3.5" style={stTextSecondary} />
                  ) : trend.direction === 'declining' ? (
                    <TrendingDown className="w-3.5 h-3.5" style={stTextPrimary} />
                  ) : (
                    <Minus className="w-3.5 h-3.5" style={stTextMuted} />
                  )}
                  <span style={{
                    ...trendValueBase,
                    color:
                      trend.direction === 'improving' ? 'var(--success)' :
                      trend.direction === 'declining' ? 'var(--danger)' :
                      'var(--text-primary)',
                  }}>{trend.current}</span></div>
                <div className="mt-1 space-y-0.5">
                  <div className="flex justify-between" style={trendDeltaRow}>
                    <span style={stTextMuted}>7d</span>
                    <span style={{ color: deltaColor(trend.delta7d) }}>
                      {trend.delta7d > 0 ? '+' : ''}{trend.delta7d}%</span></div>
                  <div className="flex justify-between" style={trendDeltaRow}>
                    <span style={stTextMuted}>30d</span>
                    <span style={{ color: deltaColor(trend.delta30d) }}>
                      {trend.delta30d > 0 ? '+' : ''}{trend.delta30d}%</span></div>
                  {trend.streak >= 2 && (
                    <div style={trendStreakLabel}>{trend.streak}-day streak</div>
                  )}</div>
                {trend.alert && (
                  <div className="flex items-start gap-1" style={trendAlertWrap}>
                    <AlertTriangle className="w-2.5 h-2.5 shrink-0 mt-0.5" style={stTextPrimary} />
                    <span style={trendAlertText}>{trend.alert}</span></div>
                )}</div>
            ))}</div></div>
      )}

      {/* ================================================================ */}
      {/* RAISE FORECAST                                                   */}
      {/* ================================================================ */}
      {data.raiseForecast && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4" style={{ color: 'var(--chart-4)' }} />
            <span style={fontSmTertiary}>Raise Forecast</span>
            <span
              className="badge ml-2"
              style={{
                ...confidenceStyle(data.raiseForecast.confidence),
                border: '1px solid',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 400, }}>
              {data.raiseForecast.confidence} confidence</span></div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Expected close */}
            <div style={{ borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', background: 'var(--cat-4)' }}>
              <div className="metric-label" style={mbSpace1}>Expected Close</div>
              <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 300, color: 'var(--chart-4)', fontVariantNumeric: 'tabular-nums' }}>{data.raiseForecast.expectedCloseDate}</div>
            </div>
            {/* Nearest close */}
            {data.raiseForecast.nearestClose && (
              <div style={{ borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', background: 'var(--accent-muted)' }}>
                <div className="metric-label" style={mbSpace1}>Nearest Close</div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 300, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>~{data.raiseForecast.nearestClose.days}d</div>
                <div style={{ ...labelMuted, marginTop: 'var(--space-0)' }}>{data.raiseForecast.nearestClose.name} ({data.raiseForecast.nearestClose.stage})</div>
              </div>
            )}
            {/* Critical path */}
            <div style={{ borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', background: 'var(--surface-1)' }}>
              <div className="metric-label" style={mbSpace1}>Critical Path</div>
              <div className="space-y-0.5">
                {data.raiseForecast.criticalPath.map((name) => (
                  <div key={name} style={labelSecondary}>{name}</div>
                ))}</div></div></div>

          {/* Investor forecasts table */}
          {data.raiseForecast.investorForecasts.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full" style={stFontXs} aria-label="Investor stage forecast">
                <thead>
                  <tr className="table-header">
                    <th scope="col" className="text-left py-1.5 pr-3">Investor</th>
                    <th scope="col" className="text-left py-1.5 pr-3">Stage</th>
                    <th scope="col" className="text-right py-1.5 pr-3">Days to Close</th>
                    <th scope="col" className="text-center py-1.5 pr-3">Readiness</th>
                    <th scope="col" className="text-left py-1.5">Confidence</th></tr></thead>
                <tbody>
                  {data.raiseForecast.investorForecasts.map((f) => {
                    const ready = readinessMap[f.name];
                    return (
                    <tr key={f.name} className="table-row">
                      <td className="py-1.5 pr-3">
                        <Link href={`/dealflow?search=${encodeURIComponent(f.name)}`} style={investorLinkStyle}>{f.name}</Link>
                      </td>
                      <td className="py-1.5 pr-3" style={stTextMuted}>{f.stage}</td>
                      <td className="py-1.5 pr-3 text-right" style={daysNumericStyle}>~{f.days}d</td>
                      <td className="py-1.5 pr-3 text-center" title={ready?.blockers?.length ? `Blockers: ${ready.blockers.join(', ')}` : undefined}>
                        {ready ? (
                          <span style={{ fontSize: 'var(--font-size-xs)', fontVariantNumeric: 'tabular-nums', color: ready.level === 'ready' ? 'var(--success)' : ready.level === 'progressing' ? 'var(--warning)' : 'var(--text-muted)' }}>{ready.score}</span>
                        ) : <span style={stTextMuted}>—</span>}
                      </td>
                      <td className="py-1.5">
                        <span style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-0) var(--space-1)', borderRadius: 'var(--radius-sm)', ...confidenceStyle(f.confidence) }}>{f.confidence}</span>
                      </td></tr>);
                  })}</tbody></table></div>
          )}

          {/* Risk factors */}
          {data.raiseForecast.riskFactors.length > 0 && (
            <div className="space-y-1" style={{ marginTop: 'var(--space-3)' }}>
              {data.raiseForecast.riskFactors.map((rf, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" style={stTextTertiary} />
                  <span style={riskFactorText}>{rf}</span></div>
              ))}</div>
          )}</div>
      )}

      {/* ================================================================ */}
      {/* STRATEGIC RECOMMENDATIONS                                        */}
      {/* ================================================================ */}
      <div
        style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div
          className="flex items-center gap-2"
          style={{ padding: 'var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
          <Target className="w-4 h-4" style={stAccent} />
          <h2 style={fontSmTertiary}>Strategic Recommendations</h2>
          <span className="ml-auto" style={labelMuted}>{data.recommendations.length} actions</span></div>

        {data.recommendations.length === 0 ? (
          <div className="text-center" style={{ padding: 'var(--space-8)' }}>
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={stTextSecondary} />
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>No critical recommendations at this time. Process is on track.</p>
          </div>
        ) : (
          <div>
            {data.recommendations.map((rec, i) => (
              <RecommendationRow key={i} rec={rec} isLast={i === data.recommendations.length - 1} />
            ))}</div>
        )}</div>

      {/* Footer */}
      <div className="text-center" style={{ ...labelMuted, padding: 'var(--space-2) 0' }}>
        Updated {relativeTime(data.generatedAt)} — Press R to refresh</div>
    </div>);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const ACTION_ROUTES: Record<string, { route: string; label: string }> = {
  pipeline:  { route: '/dealflow',     label: 'Open Dealflow' },
  narrative: { route: '/objections',   label: 'Fix Narrative' },
  execution: { route: '/focus',        label: 'Open Focus' },
  timing:    { route: '/velocity',     label: 'Check Velocity' },
  risk:      { route: '/stress-test',  label: 'Stress Test' },};

function deriveActionRoute(rec: StrategicRecommendation): { route: string; label: string } {
  const text = `${rec.title} ${rec.action} ${rec.rationale}`.toLowerCase();
  if (text.includes('meeting') || text.includes('schedule') || text.includes('reconnect'))
    return { route: '/meetings/new', label: 'Schedule Meeting' };
  if (text.includes('follow') || text.includes('followup') || text.includes('nudge') || text.includes('outreach'))
    return { route: '/followups', label: 'Send Follow-up' };
  if (text.includes('data room') || text.includes('document'))
    return { route: '/data-room', label: 'Open Data Room' };
  if (text.includes('objection') || text.includes('narrative') || text.includes('story'))
    return { route: '/objections', label: 'Fix Objections' };
  if (text.includes('forecast') || text.includes('close date'))
    return { route: '/forecast', label: 'View Forecast' };
  if (text.includes('pipeline') || text.includes('diversif'))
    return { route: '/pipeline', label: 'View Pipeline' };
  return ACTION_ROUTES[rec.category] || { route: '/focus', label: 'Take Action' };
}

function RecommendationRow({ rec, isLast }: { rec: StrategicRecommendation; isLast: boolean }) {
  const catCfg = CATEGORY_CONFIG[rec.category] || CATEGORY_CONFIG.pipeline;
  const CatIcon = catCfg.icon;
  const actionLink = deriveActionRoute(rec);

  return (
    <div
      className="hover-row transition-colors"
      style={{ padding: 'var(--space-5)', borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}>
      <div className="flex items-start gap-4">
        {/* Priority badge */}
        <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
          <span style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-0) var(--space-1)', borderRadius: 'var(--radius-sm)', border: '1px solid', fontWeight: 300, ...priorityStyle(rec.priority) }}>P{rec.priority}</span>
          <div className="w-7 h-7 flex items-center justify-center" style={{ borderRadius: 'var(--radius-sm)', background: catCfg.bg }}>
            <CatIcon className="w-3.5 h-3.5" style={{ color: catCfg.color }} /></div></div>

        <div className="flex-1 min-w-0">
          {/* Title + category badge */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>{rec.title}</h3>
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                padding: 'var(--space-0) var(--space-1)',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${catCfg.border}`,
                background: catCfg.bg,
                color: catCfg.color, }}>
              {catCfg.label}</span></div>

          {/* Rationale */}
          <p style={{ ...labelMuted, marginBottom: 'var(--space-2)' }}>{rec.rationale}</p>

          {/* Action */}
          <div className="flex items-start gap-1.5 mb-2">
            <ArrowRight className="w-3 h-3 shrink-0 mt-0.5" style={stAccent} />
            <p style={labelSecondary}>{rec.action}</p></div>

          {/* Impact + Deadline + Action button */}
          <div className="flex items-center gap-4" style={labelMuted10}>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {rec.expectedImpact}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {rec.deadline}</span>
            <Link
              href={actionLink.route}
              className="ml-auto flex items-center gap-1 transition-colors hover-accent-invert"
              style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-muted)', transition: 'all 150ms ease', textDecoration: 'none' }}>
              {actionLink.label}
              <ExternalLink className="w-3 h-3" /></Link></div></div></div>
    </div>);
}

function GaugeCard({ label, value, suffix, description, barPct, barColor, valueColor }: {
  label: string;
  value: number;
  suffix: string;
  description: string;
  barPct: number;
  barColor: string;
  valueColor: string;
}) {
  return (
    <div className="card-metric flex flex-col">
      <div className="metric-label" style={mbSpace1}>{label}</div>
      <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 300, fontVariantNumeric: 'tabular-nums', color: valueColor }}>
        {value}<span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 400, color: 'var(--text-muted)' }}>{suffix}</span>
      </div>
      <div style={{ ...labelMuted, marginTop: 'var(--space-1)', marginBottom: 'var(--space-3)' }}>{description}</div>
      <div
        className="mt-auto w-full"
        style={{
          height: '8px',
          background: 'var(--surface-3)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden', }}>
        <div style={{ height: '100%', borderRadius: 'var(--radius-full)', transition: 'all 700ms ease', width: `${Math.min(100, barPct)}%`, background: barColor }}
          /></div>
    </div>);
}

function SparklineRow({ label, values, dates, color }: {
  label: string;
  values: number[];
  dates: string[];
  color: 'success' | 'purple' | 'accent';
}) {
  const max = Math.max(...values, 1);
  const latest = values[values.length - 1] ?? 0;
  const first = values[0] ?? 0;
  const delta = latest - first;

  const barColors: Record<string, string> = {
    success: 'var(--success)',
    purple: 'var(--accent)',
    accent: 'var(--accent)',};
  const textColors: Record<string, string> = {
    success: 'var(--success)',
    purple: 'var(--chart-4)',
    accent: 'var(--accent)',};

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span style={labelMuted}>{label}</span>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 300, fontVariantNumeric: 'tabular-nums', color: textColors[color] }}>{latest}</span>
          {delta !== 0 && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: delta > 0 ? 'var(--success)' : 'var(--danger)' }}>
              {delta > 0 ? '+' : ''}{delta}</span>
          )}</div></div>
      <div className="flex items-end gap-0.5 h-8">
        {values.map((v, i) => {
          const h = max > 0 ? (v / max) * 100 : 0;
          return (
            <div key={dates[i] || i} className="flex-1 relative" style={{ height: '100%' }}>
              <div className="absolute bottom-0 w-full" style={{ height: `${Math.max(h, 4)}%`, borderRadius: '2px 2px 0 0', background: barColors[color], opacity: 0.7, transition: 'all 200ms ease' }}
                />
            </div>);
        })}</div>
    </div>);
}

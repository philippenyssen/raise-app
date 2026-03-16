'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { cachedFetch } from '@/lib/cache';
import { EmptyState } from '@/components/ui/empty-state';
import { relativeTime, MS_PER_MINUTE } from '@/lib/time';
import { useRefreshInterval } from '@/lib/hooks/useRefreshInterval';
import { useToast } from '@/components/toast';
import { fmtDateTime } from '@/lib/format';
import { labelMuted, scoreColorStyle, stAccent, stSurface0, stSurface1, stSurface2, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary } from '@/lib/styles';
import {
  Activity, TrendingUp, TrendingDown, Minus, AlertTriangle,
  RefreshCw, Users, ArrowUpRight, ArrowDownRight, Flame,
  Zap, Eye, Clock, MessageSquare, ChevronRight,
} from 'lucide-react';
import { TYPE_LABELS_SHORT as TYPE_LABELS } from '@/lib/constants';

const bgSurface2Sec = { background: 'var(--surface-2)', color: 'var(--text-secondary)' } as const;
const barContainerH100 = { height: '100px' } as const;
const barContainerFull = { height: '100%' } as const;
const alertBadgeStyle = { background: 'var(--surface-2)', color: 'var(--text-muted)' } as const;
const actionCellStyle = { background: 'transparent', color: 'var(--text-muted)' } as const;
const heatRowBg = { background: 'var(--fg-95)' } as const;
const anomalyBadgeStyle = { background: 'var(--warning-muted)', color: 'var(--text-tertiary)', boxShadow: 'inset 0 0 0 1px var(--warn-40)' } as const;
const scheduleButtonStyle = { background: 'var(--accent-15)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent-25)' } as const;
const anomalyBtnAbove = { background: 'var(--accent-30)', color: 'var(--success)', boxShadow: 'inset 0 0 0 1px var(--accent-40)' } as const;
const anomalyBtnBelow = { background: 'var(--fg-30)', color: 'var(--danger)', boxShadow: 'inset 0 0 0 1px var(--fg-40)' } as const;
const deltaUp = { color: 'var(--success)' } as const;
const deltaDown = { color: 'var(--danger)' } as const;
const deltaNeutral = { color: 'var(--text-muted)' } as const;
const anomalyAboveBg = { background: 'var(--accent-20)' } as const;
const anomalyBelowBg = { background: 'var(--fg-20)' } as const;
const anomalyAboveDot = { background: 'var(--accent-40)' } as const;
const anomalyBelowDot = { background: 'var(--fg-40)' } as const;
const anomalyDirUp = { color: 'var(--success)' } as const;
const anomalyDirDown = { color: 'var(--danger)' } as const;

const TRAJECTORY_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  critical_warning:  { border: 'var(--fg-50)',  bg: 'var(--fg-10)',  color: 'var(--danger)' },
  early_warning:     { border: 'var(--warn-50)',  bg: 'var(--fg-6)',  color: 'var(--text-secondary)' },
  term_sheet_signal: { border: 'var(--accent-50)',  bg: 'var(--accent-10)',   color: 'var(--success)' },
};
const TRAJECTORY_LABELS: Record<string, string> = {
  critical_warning: 'Critical',
  early_warning: 'Warning',
  term_sheet_signal: 'Signal',
};

const URGENCY_STYLES: Record<string, { bg: string; border: string; color: string }> = {
  high:   { bg: 'var(--fg-20)',  border: 'var(--fg-40)',  color: 'var(--danger)' },
  medium: { bg: 'var(--warn-20)',  border: 'var(--warn-40)',  color: 'var(--warning)' },
  low:    { bg: 'var(--fg-40)',   border: 'var(--warn-40)',   color: 'var(--text-secondary)' },
};
const TIMING_TYPE_LABELS: Record<string, string> = {
  competitive_tension: 'Competitive Tension',
  engagement_gap: 'Engagement Gap',
  dd_synchronization: 'DD Synchronization',
};
const TIMING_TYPE_ICON_COLORS: Record<string, string> = {
  competitive_tension: 'var(--danger)',
  engagement_gap: 'var(--text-secondary)',
  dd_synchronization: 'var(--success)',
};

const NARRATIVE_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  effective:         { bg: 'var(--accent-20)',   color: 'var(--success)',  label: 'Effective' },
  struggling:        { bg: 'var(--fg-20)', color: 'var(--danger)',  label: 'Struggling' },
  insufficient_data: { bg: 'var(--fg-40)',  color: 'var(--text-muted)', label: 'Low data' },
};

// ── Types ─────────────────────────────────────────────────────────────

interface WeekScore { week: string; score: number; }

interface InvestorMomentum {
  investorId: string;
  investorName: string;
  type: string;
  tier: number;
  weeklyScores: WeekScore[];
}

interface Cohort { type: string; weeklyAvg: WeekScore[]; trend: 'heating' | 'cooling' | 'stable'; memberCount: number; }

interface Anomaly {
  investorId: string;
  investorName: string;
  type: string;
  deviation: number;
  direction: 'above' | 'below';
  message: string;
}

interface CrossSignal { week: string; description: string; affectedInvestors: string[]; }

interface TrajectoryAlert {
  investorId: string;
  investorName: string;
  type: 'critical_warning' | 'early_warning' | 'term_sheet_signal';
  currentScore: number;
  predictedScore21d: number;
  slopePerWeek: number;
  daysToThreshold: number | null;
  recommendedAction: string;
}

interface TimingSignal {
  type: 'competitive_tension' | 'engagement_gap' | 'dd_synchronization';
  description: string;
  investorNames: string[];
  urgency: 'high' | 'medium' | 'low';
}

interface NarrativeHealthEntry {
  investorType: string;
  avgEnthusiasm: number;
  conversionRate: number;
  topObjection: string;
  topQuestionTopic: string;
  sampleSize: number;
  status: 'effective' | 'struggling' | 'insufficient_data';
}

interface MomentumData {
  matrix: InvestorMomentum[];
  cohorts: Cohort[];
  anomalies: Anomaly[];
  crossSignals: CrossSignal[];
  trajectoryAlerts: TrajectoryAlert[];
  timingSignals?: TimingSignal[];
  narrativeHealth?: NarrativeHealthEntry[];
  overallTrend: WeekScore[];
  overallDirection: 'accelerating' | 'stable' | 'decelerating';
  weeks: string[];
  generatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────


const TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  vc:            { bg: 'var(--accent-muted)',      color: 'var(--accent)',         border: 'var(--accent-15)' },
  growth:        { bg: 'var(--accent-muted)',   color: 'var(--text-secondary)', border: 'var(--accent-12)' },
  sovereign:     { bg: 'var(--warn-8)', color: 'var(--text-tertiary)', border: 'var(--warn-15)' },
  strategic:     { bg: 'var(--accent-4)',   color: 'var(--text-secondary)', border: 'var(--accent-8)' },
  debt:          { bg: 'var(--fg-5)',   color: 'var(--text-tertiary)',  border: 'var(--fg-10)' },
  family_office: { bg: 'var(--fg-6)',   color: 'var(--text-tertiary)',  border: 'var(--fg-10)' },};

function trendBarBg(score: number): string {
  if (score >= 50) return 'var(--accent-75)';
  if (score >= 30) return 'var(--accent-40)';
  if (score >= 10) return 'var(--warn-25)';
  return 'var(--fg-10)';
}

function formatWeekLabel(w: string): string {
  const d = new Date(w + 'T00:00:00');
  if (isNaN(d.getTime())) return w;
  const month = d.toLocaleString('default', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}`;
}

const DIRECTION_CONFIG = {
  accelerating: {
    label: 'Accelerating',
    icon: TrendingUp,
    bg: 'var(--accent-40)',
    color: 'var(--success)',
    border: 'var(--accent-50)',},
  stable: {
    label: 'Stable',
    icon: Minus,
    bg: 'var(--warn-40)',
    color: 'var(--warning)',
    border: 'var(--warn-50)',},
  decelerating: {
    label: 'Decelerating',
    icon: TrendingDown,
    bg: 'var(--fg-40)',
    color: 'var(--danger)',
    border: 'var(--fg-50)',},};

const TREND_CONFIG = {
  heating: {
    label: 'Heating up',
    icon: TrendingUp,
    color: 'var(--success)',
    bg: 'var(--accent-30)',},
  cooling: {
    label: 'Cooling down',
    icon: TrendingDown,
    color: 'var(--danger)',
    bg: 'var(--fg-30)',},
  stable: {
    label: 'Stable',
    icon: Minus,
    color: 'var(--text-secondary)',
    bg: 'var(--fg-30)',},};

// ── Page Component ────────────────────────────────────────────────────

export default function MomentumPage() {
  const { toast } = useToast();
  const [data, setData] = useState<MomentumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await cachedFetch('/api/momentum');
      if (!res.ok) throw new Error('Couldn\'t load momentum data — try refreshing');
      const json = await res.json();
      setData(json);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Couldn\'t load data — try refreshing';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }}, [toast]);

  useEffect(() => { document.title = 'Raise | Deal Momentum'; }, []);
  useRefreshInterval(fetchData, 5 * MS_PER_MINUTE);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchData(); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const maxOverall = useMemo(() => data ? Math.max(...data.overallTrend.map(t => t.score), 1) : 1, [data]);
  const anomalyInvestorIds = useMemo(() => data ? new Set(data.anomalies.map(a => a.investorId)) : new Set<string>(), [data]);
  const anomalyByInvestor = useMemo(() => {
    if (!data) return new Map();
    const map = new Map<string, typeof data.anomalies[0]>();
    for (const a of data.anomalies) map.set(a.investorId, a);
    return map;
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6 page-content">
        <div className="skeleton" style={{ height: '28px', width: '220px' }} />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Computing investor momentum signals...</p>
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '100px', borderRadius: 'var(--radius-lg)' }} />)}
        </div>
        <div className="skeleton" style={{ height: '300px', borderRadius: 'var(--radius-lg)' }} />
      </div>);
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen" style={stSurface0}>
        <EmptyState
          icon={AlertTriangle}
          title={error ? 'Couldn\'t load momentum data' : 'No momentum data yet'}
          description={error || 'Add investors and log meetings to see momentum signals.'}
          action={{ label: 'Retry', onClick: fetchData }} />
      </div>);
  }

  const dirConfig = DIRECTION_CONFIG[data.overallDirection];
  const DirIcon = dirConfig.icon;

  return (
    <div className="flex-1 overflow-y-auto page-content" style={stSurface0}>
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="page-title">Deal Momentum</h1>
              <p className="text-sm mt-0.5" style={stTextMuted}>
                Investor behavior patterns &middot; Last 8 weeks</p></div>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: dirConfig.bg, boxShadow: `inset 0 0 0 1px ${dirConfig.border}` }}>
              <DirIcon className="w-4 h-4" style={{ color: dirConfig.color }} />
              <span className="text-sm font-normal" style={{ color: dirConfig.color }}>{dirConfig.label}</span></div></div>
          <div className="flex items-center gap-2">
            <span style={labelMuted}>
              {relativeTime(data.generatedAt)}</span>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
              style={bgSurface2Sec}>
              <RefreshCw className="w-4 h-4" />
              Refresh</button></div></div>

        {/* ── Overall Trend Line ──────────────────────────────────────── */}
        <div
          className="rounded-xl p-6"
          style={stSurface1}>
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4" style={stTextSecondary} />
            <h2 className="text-sm font-normal tracking-wider" style={stTextSecondary}>Pipeline Momentum &mdash; 8 Week Trend</h2>
          </div>
          <div className="flex items-end gap-2 h-32">
            {data.overallTrend.map((t, i) => {
              const height = maxOverall > 0 ? (t.score / maxOverall) * 100 : 0;
              return (
                <div key={t.week} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-mono" style={stTextSecondary}>{t.score}</span>
                  <div className="w-full relative" style={barContainerH100}>
                    <div
                      className="absolute bottom-0 w-full rounded-t transition-all duration-500"
                      style={{ height: `${Math.max(height, 3)}%`, background: trendBarBg(t.score) }} /></div>
                  <span className="text-xs font-mono" style={stTextMuted}>{formatWeekLabel(t.week)}</span>
                </div>);
            })}</div></div>

        {/* ── Trajectory Early Warning ──────────────────────────────── */}
        {data.trajectoryAlerts && data.trajectoryAlerts.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-normal flex items-center gap-2" style={stTextSecondary}>
              Trajectory Alerts
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={alertBadgeStyle}>
                {data.trajectoryAlerts.length}</span></h3>
            {data.trajectoryAlerts.map((alert, i) => {
              const c = TRAJECTORY_COLORS[alert.type] || TRAJECTORY_COLORS.early_warning;
              return (
                <div
                  key={i}
                  className="rounded-lg p-3"
                  style={{ background: c.bg, color: c.color }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-normal ">{TRAJECTORY_LABELS[alert.type]}</span>
                      <span className="text-sm font-normal" style={stTextPrimary}>{alert.investorName}</span></div>
                    <div className="flex items-center gap-3 text-xs">
                      <span>Score: {alert.currentScore}</span>
                      <span>&rarr; {alert.predictedScore21d} (21d)</span>
                      <span style={{ color: alert.slopePerWeek >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {alert.slopePerWeek >= 0 ? '+' : ''}{alert.slopePerWeek}/wk</span>
                      {alert.daysToThreshold && (
                        <span className="font-normal">~{alert.daysToThreshold}d to threshold</span>
                      )}</div></div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs flex-1" style={stTextSecondary}>{alert.recommendedAction}</p>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <Link
                        href={`/meetings/new?investor=${alert.investorId}`}
                        className="px-2.5 py-1 rounded text-xs font-normal hover-accent-bg"
                        style={scheduleButtonStyle}>
                        Schedule</Link>
                      <Link
                        href={`/investors/${alert.investorId}`}
                        className="px-2.5 py-1 rounded text-xs font-normal btn-surface"
                        style={bgSurface2Sec}>
                        Open</Link></div></div>
                </div>);
            })}</div>
        )}

        {/* ── Heatmap Table ───────────────────────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden"
          style={stSurface1}>
          <div
            className="flex items-center gap-2 px-6 py-4"
            style={{ borderBottom: '1px solid var(--border-default)' }}>
            <Eye className="w-4 h-4" style={stAccent} />
            <h2 className="text-sm font-normal tracking-wider" style={stTextSecondary}>Investor Momentum Heatmap</h2>
            <span className="ml-auto text-xs" style={stTextMuted}>{data.matrix.length} active investors &middot; Score 0-100</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Investor momentum heatmap">
              <thead>
                <tr style={stSurface1}>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 text-left px-4 py-3 font-normal text-xs  tracking-wider min-w-[200px]"
                    style={{ background: 'var(--surface-1)', color: 'var(--text-muted)' }}>
                    Investor</th>
                  {data.weeks.map(w => (
                    <th scope="col" key={w} className="px-2 py-3 font-normal text-xs text-center min-w-[72px]" style={stTextMuted}>
                      {formatWeekLabel(w)}</th>
                  ))}
                  <th scope="col" className="px-3 py-3 font-normal text-xs text-center min-w-[60px]" style={stTextMuted}>
                    &Delta;</th>
                  <th scope="col" className="px-2 py-3 font-normal text-xs text-center min-w-[40px]" style={stTextMuted}></th></tr></thead>
              <tbody>
                {data.matrix.length === 0 ? (
                  <tr>
                    <td colSpan={data.weeks.length + 3} className="px-4 py-12 text-center" style={stTextMuted}>
                      Add investors and log meetings to start tracking momentum signals.</td></tr>
                ) : data.matrix.map((inv) => {
                  const isAnomaly = anomalyInvestorIds.has(inv.investorId);
                  const tc = TYPE_COLORS[inv.type] || TYPE_COLORS.vc;
                  const scores = inv.weeklyScores.map(s => s.score);
                  const currentScore = scores[scores.length - 1] || 0;
                  const prevScore = scores.length >= 2 ? scores[scores.length - 2] : 0;
                  const delta = currentScore - prevScore;

                  return (
                    <tr
                      key={inv.investorId}
                      className="transition-colors"
                      style={{ borderBottom: '1px solid var(--border-subtle)', background: isAnomaly ? 'var(--fg-20)' : undefined }}>
                      {/* Investor name + type badge */}
                      <td
                        className="sticky left-0 backdrop-blur z-10 px-4 py-2.5"
                        style={heatRowBg}>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/investors/${inv.investorId}`}
                            className="font-normal truncate max-w-[120px]"
                            style={stTextPrimary}>
                            {inv.investorName}</Link>
                          <span
                            className="px-1.5 py-0.5 rounded text-xs font-normal"
                            style={{ background: tc.bg, color: tc.color, boxShadow: `inset 0 0 0 1px ${tc.border}` }}>
                            {TYPE_LABELS[inv.type] || inv.type}</span>
                          {isAnomaly && (
                            <span title="Anomaly detected"><Zap className="w-3 h-3 flex-shrink-0" style={stTextTertiary} /></span>
                          )}</div></td>

                      {/* Weekly score cells */}
                      {inv.weeklyScores.map((ws) => {
                        const anomalyForWeek = anomalyByInvestor.get(inv.investorId);
                        const isAnomalyCell = anomalyForWeek && ws.week === data.weeks[data.weeks.length - 1];

                        return (
                          <td key={ws.week} className="px-1 py-1.5 text-center">
                            <div
                              className="inline-flex items-center justify-center w-14 h-8 rounded font-mono text-xs font-normal transition-all"
                              style={isAnomalyCell
                                ? { ...scoreColorStyle(ws.score), boxShadow: `0 0 0 2px ${anomalyForWeek.direction === 'above' ? 'var(--accent-muted)' : 'var(--fg-6)'}` }
                                : scoreColorStyle(ws.score)}>
                              {ws.score}</div>
                          </td>);
                      })}

                      {/* Delta column */}
                      <td className="px-3 py-2.5 text-center">
                        <div
                          className="inline-flex items-center gap-0.5 text-xs font-mono font-normal"
                          style={delta > 0 ? deltaUp : delta < 0 ? deltaDown : deltaNeutral}>
                          {delta > 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : delta < 0 ? (
                            <ArrowDownRight className="w-3 h-3" />
                          ) : null}
                          {delta > 0 ? `+${delta}` : delta}</div></td>
                      {/* Quick action */}
                      <td className="px-2 py-2.5 text-center">
                        <Link
                          href={delta < -5 ? `/meetings/new?investor=${inv.investorId}` : `/investors/${inv.investorId}`}
                          title={delta < -5 ? 'Schedule meeting — momentum dropping' : 'View investor'}
                          aria-label={delta < -5 ? `Schedule meeting with ${inv.investorName}` : `View ${inv.investorName}`}
                          className="inline-flex items-center justify-center w-6 h-6 rounded hover-chevron-action"
                          style={actionCellStyle}>
                          <ChevronRight className="w-3.5 h-3.5" /></Link></td>
                    </tr>);
                })}</tbody></table></div>

          {/* Legend */}
          <div
            className="flex items-center gap-4 px-6 py-3"
            style={{ borderTop: '1px solid var(--border-default)', background: 'var(--surface-1)' }}>
            <span className="text-xs  tracking-wider" style={stTextMuted}>Score</span>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded" style={{ background: 'var(--fg-60)' }} /><span className="text-xs" style={stTextMuted}>1-30</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded" style={{ background: 'var(--warn-60)' }} /><span className="text-xs" style={stTextMuted}>31-50</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded" style={{ background: 'var(--accent-60)' }} /><span className="text-xs" style={stTextMuted}>51-70</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded" style={{ background: 'var(--accent-85)' }} /><span className="text-xs" style={stTextMuted}>71-100</span>
            </div>
            <div className="ml-4 flex items-center gap-1.5">
              <div className="w-4 h-3 rounded" style={{ background: 'var(--surface-2)', boxShadow: '0 none' }} />
              <span className="text-xs" style={stTextMuted}>Above cohort</span></div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded" style={{ background: 'var(--surface-2)', boxShadow: '0 none' }} />
              <span className="text-xs" style={stTextMuted}>Below cohort</span></div></div></div>

        {/* ── Cohort Summary + Anomalies Row ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Cohort Summary */}
          <div
            className="rounded-xl p-6"
            style={{ background: 'var(--surface-1)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4" style={stTextSecondary} />
              <h2 className="text-sm font-normal tracking-wider" style={stTextSecondary}>Cohort Momentum</h2></div>
            {data.cohorts.length === 0 ? (
              <EmptyState icon={Users} title="No cohort data yet" description="Add more investors to see momentum patterns by type." />
            ) : (
              <div className="space-y-3">
                {data.cohorts.map(cohort => {
                  const tc = TYPE_COLORS[cohort.type] || TYPE_COLORS.vc;
                  const trendCfg = TREND_CONFIG[cohort.trend];
                  const TrendIcon = trendCfg.icon;
                  const maxCohortScore = Math.max(...cohort.weeklyAvg.map(w => w.score), 1);

                  return (
                    <div key={cohort.type} className="rounded-xl p-4" style={stSurface2}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-normal"
                            style={{ background: tc.bg, color: tc.color, boxShadow: `inset 0 0 0 1px ${tc.border}` }}>
                            {TYPE_LABELS[cohort.type] || cohort.type}</span>
                          <span className="text-xs" style={stTextMuted}>{cohort.memberCount} investors</span></div>
                        <div
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-normal"
                          style={{ background: trendCfg.bg, color: trendCfg.color }}>
                          <TrendIcon className="w-3 h-3" />
                          {trendCfg.label}</div></div>

                      {/* Mini sparkline */}
                      <div className="flex items-end gap-1 h-10">
                        {cohort.weeklyAvg.map((ws) => {
                          const h = maxCohortScore > 0 ? (ws.score / maxCohortScore) * 100 : 0;
                          return (
                            <div key={ws.week} className="flex-1 relative" style={barContainerFull}>
                              <div
                                className="absolute bottom-0 w-full rounded-t"
                                style={{ height: `${Math.max(h, 5)}%`, background: trendBarBg(ws.score), opacity: 0.7 }} />
                            </div>);
                        })}</div>

                      {/* Week labels and scores */}
                      <div className="flex gap-1 mt-1">
                        {cohort.weeklyAvg.map((ws) => (
                          <div key={ws.week} className="flex-1 text-center">
                            <span className="text-xs font-mono" style={stTextMuted}>{ws.score}</span></div>
                        ))}</div>
                    </div>);
                })}</div>
            )}</div>

          {/* Anomalies */}
          <div
            className="rounded-xl p-6"
            style={{ background: 'var(--surface-1)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4" style={stTextTertiary} />
              <h2 className="text-sm font-normal tracking-wider" style={stTextSecondary}>Momentum Anomalies</h2>
              {data.anomalies.length > 0 && (
                <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-normal" style={anomalyBadgeStyle}>{data.anomalies.length}</span>
              )}</div>
            {data.anomalies.length === 0 ? (
              <EmptyState icon={Activity} title="No anomalies detected" description="All investors are tracking near their cohort averages." />
            ) : (
              <div className="space-y-2">
                {data.anomalies.map((anomaly, i) => {
                  const tc = TYPE_COLORS[anomaly.type] || TYPE_COLORS.vc;
                  const isAbove = anomaly.direction === 'above';

                  return (
                    <div
                      key={i}
                      className="rounded-lg p-3"
                      style={isAbove ? anomalyAboveBg : anomalyBelowBg}>
                      <div className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                          style={isAbove ? anomalyAboveDot : anomalyBelowDot}>
                          {isAbove ? (
                            <ArrowUpRight className="w-4 h-4" style={stTextSecondary} />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" style={stTextPrimary} />
                          )}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              href={`/investors/${anomaly.investorId}`}
                              className="text-sm font-normal"
                              style={stTextPrimary}>
                              {anomaly.investorName}</Link>
                            <span
                              className="px-1.5 py-0.5 rounded text-xs font-normal"
                              style={{
                                background: tc.bg,
                                color: tc.color,
                                boxShadow: `inset 0 0 0 1px ${tc.border}`, }}>
                              {TYPE_LABELS[anomaly.type] || anomaly.type}</span>
                            <span
                              className="text-xs font-mono font-normal"
                              style={isAbove ? anomalyDirUp : anomalyDirDown}>
                              {anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation}pts</span></div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs flex-1" style={stTextMuted}>{anomaly.message}</p>
                            <Link
                              href={isAbove ? `/meetings/prep?investor=${anomaly.investorId}` : `/meetings/new?investor=${anomaly.investorId}`}
                              className="ml-3 px-2 py-0.5 rounded text-xs font-normal shrink-0 hover-opacity-link"
                              style={isAbove ? anomalyBtnAbove : anomalyBtnBelow}>
                              {isAbove ? 'Prep Meeting' : 'Re-engage'}</Link></div></div></div>
                    </div>);
                })}</div>
            )}</div></div>

        {/* ── Cross-Investor Signals ──────────────────────────────────── */}
        {data.crossSignals.length > 0 && (
          <div
            className="rounded-xl p-6"
            style={stSurface1}>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4" style={stTextPrimary} />
              <h2 className="text-sm font-normal tracking-wider" style={stTextSecondary}>Cross-Investor Signals</h2>
              <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-normal" style={{ background: 'var(--danger-muted, var(--fg-40))', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--fg-40)' }}>{data.crossSignals.length}</span>
            </div>
            <div className="space-y-3">
              {data.crossSignals.map((signal, i) => (
                <div
                  key={i}
                  className="rounded-xl p-4"
                  style={stSurface2}>
                  <div className="flex items-start gap-3">
                    <div className="w-16 flex-shrink-0">
                      <span className="text-xs font-mono" style={stTextMuted}>{formatWeekLabel(signal.week)}</span></div>
                    <div className="flex-1">
                      <p className="text-sm mb-2" style={stTextSecondary}>{signal.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {signal.affectedInvestors.map(name => (
                          <span key={name} className="px-2 py-0.5 rounded text-xs" style={bgSurface2Sec}>{name}</span>
                        ))}</div></div></div></div>
              ))}</div></div>
        )}

        {/* ── Timing Signals ─────────────────────────────────────────── */}
        {data.timingSignals && data.timingSignals.length > 0 && (
          <div
            className="rounded-xl p-6"
            style={stSurface1}>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4" style={stTextTertiary} />
              <h2 className="text-sm font-normal tracking-wider" style={stTextSecondary}>Timing Signals</h2>
              <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-normal" style={{ background: 'var(--warning-muted, var(--warn-40))', color: 'var(--text-tertiary)', boxShadow: 'inset 0 0 0 1px var(--warn-40)' }}>{data.timingSignals.length}</span>
            </div>
            <div className="space-y-2">
              {data.timingSignals.map((signal, i) => {
                const us = URGENCY_STYLES[signal.urgency] || URGENCY_STYLES.low;

                return (
                  <div
                    key={i}
                    className="rounded-lg p-3"
                    style={{ background: us.bg, color: us.color }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-xs font-normal "
                        style={{ color: TIMING_TYPE_ICON_COLORS[signal.type] || 'var(--text-secondary)' }}>
                        {TIMING_TYPE_LABELS[signal.type] || signal.type}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded font-normal" style={{ background: us.bg, color: us.color }}>{signal.urgency}</span>
                    </div>
                    <p className="text-xs mb-2" style={stTextSecondary}>{signal.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {signal.investorNames.map(name => (
                        <span key={name} className="px-2 py-0.5 rounded text-xs" style={bgSurface2Sec}>{name}</span>
                      ))}</div>
                  </div>);
              })}</div></div>
        )}

        {/* ── Narrative Health by Investor Type ─────────────────────── */}
        {data.narrativeHealth && data.narrativeHealth.length > 0 && (
          <div className="rounded-xl p-6" style={stSurface1}>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4" style={stTextSecondary} />
              <h2 className="text-sm font-normal tracking-wider" style={stTextSecondary}>Narrative Health by Type</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.narrativeHealth.map((nh) => {
                const tc = TYPE_COLORS[nh.investorType] || TYPE_COLORS.vc;
                const sc = NARRATIVE_STATUS_STYLES[nh.status] || NARRATIVE_STATUS_STYLES.insufficient_data;

                return (
                  <div
                    key={nh.investorType}
                    className="rounded-xl p-4"
                    style={{ background: sc.bg }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2 py-0.5 rounded text-xs font-normal" style={{ background: tc.bg, color: tc.color, boxShadow: `inset 0 0 0 1px ${tc.border}` }}>{TYPE_LABELS[nh.investorType] || nh.investorType}</span>
                      <span className="text-xs font-normal " style={{ color: sc.color }}>{sc.label}</span></div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span style={stTextMuted}>Enthusiasm</span>
                        <div className="font-normal tabular-nums" style={{ color: nh.avgEnthusiasm >= 3 ? 'var(--success)' : 'var(--danger)' }}>{nh.avgEnthusiasm.toFixed(1)}/5</div>
                      </div>
                      <div>
                        <span style={stTextMuted}>Conversion</span>
                        <div className="font-normal tabular-nums" style={{ color: nh.conversionRate >= 20 ? 'var(--success)' : 'var(--danger)' }}>{nh.conversionRate}%</div>
                      </div></div>
                    {nh.topObjection && (
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-xs" style={stTextMuted}>
                          Top objection: <span style={stTextSecondary}>{nh.topObjection}</span></div>
                        <Link
                          href="/objections"
                          className="text-xs font-normal shrink-0 ml-2 hover-opacity-70"
                          style={stAccent}>
                          View &rarr;</Link></div>
                    )}
                    {nh.topQuestionTopic && (
                      <div className="text-xs" style={stTextMuted}>
                        Top question: <span style={stTextSecondary}>{nh.topQuestionTopic}</span></div>
                    )}
                    <div className="mt-1 text-xs" style={stTextMuted}>
                      {nh.sampleSize} investor{nh.sampleSize !== 1 ? 's' : ''}</div>
                  </div>);
              })}</div></div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="text-center pb-4">
          <p className="text-xs" style={stTextTertiary}>
            Generated {data.generatedAt ? fmtDateTime(data.generatedAt) : 'just now'}
            &nbsp;&middot;&nbsp; Momentum = meetings + status changes + enthusiasm shifts + tasks + follow-ups</p></div></div>
    </div>);
}

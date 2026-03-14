'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity, TrendingUp, TrendingDown, Minus, AlertTriangle,
  RefreshCw, Users, ArrowUpRight, ArrowDownRight, Flame,
  Zap, Eye, Clock, MessageSquare, ChevronRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────

interface WeekScore {
  week: string;
  score: number;
}

interface InvestorMomentum {
  investorId: string;
  investorName: string;
  type: string;
  tier: number;
  weeklyScores: WeekScore[];
}

interface Cohort {
  type: string;
  weeklyAvg: WeekScore[];
  trend: 'heating' | 'cooling' | 'stable';
  memberCount: number;
}

interface Anomaly {
  investorId: string;
  investorName: string;
  type: string;
  deviation: number;
  direction: 'above' | 'below';
  message: string;
}

interface CrossSignal {
  week: string;
  description: string;
  affectedInvestors: string[];
}

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

const TYPE_LABELS: Record<string, string> = {
  vc: 'VC',
  growth: 'Growth',
  sovereign: 'SWF',
  strategic: 'Strategic',
  debt: 'Debt',
  family_office: 'Family',
};

const TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  vc:            { bg: 'rgba(74,111,165,0.15)',  color: 'rgba(96,165,250,1)',   border: 'rgba(29,78,216,0.4)' },
  growth:        { bg: 'rgba(147,51,234,0.15)',  color: 'rgba(192,132,252,1)',  border: 'rgba(126,34,206,0.4)' },
  sovereign:     { bg: 'rgba(217,119,6,0.15)',   color: 'rgba(251,191,36,1)',   border: 'rgba(180,83,9,0.4)' },
  strategic:     { bg: 'rgba(16,185,129,0.15)',  color: 'rgba(27, 42, 74, 0.06)',   border: 'rgba(4,120,87,0.4)' },
  debt:          { bg: 'rgba(26, 26, 46, 0.05)',  color: 'rgba(251,146,60,1)',   border: 'rgba(194,65,12,0.4)' },
  family_office: { bg: 'rgba(26, 26, 46, 0.06)',   color: 'rgba(251,113,133,1)',  border: 'rgba(190,18,60,0.4)' },
};

function scoreColorStyle(score: number): React.CSSProperties {
  if (score >= 71) return { background: 'rgba(5,150,105,0.8)',  color: 'rgba(236,253,245,1)' };
  if (score >= 51) return { background: 'rgba(6,95,70,0.6)',    color: 'rgba(167,243,208,1)' };
  if (score >= 31) return { background: 'rgba(180,83,9,0.6)',   color: 'rgba(254,243,199,1)' };
  if (score >= 1)  return { background: 'rgba(153,27,27,0.6)',  color: 'rgba(254,202,202,1)' };
  return { background: 'rgba(39,39,42,0.6)', color: 'rgba(113,113,122,1)' };
}

function scoreBorderStyle(score: number): React.CSSProperties {
  if (score >= 71) return { borderColor: 'rgba(27, 42, 74, 0.06)' };
  if (score >= 51) return { borderColor: 'rgba(5,150,105,1)' };
  if (score >= 31) return { borderColor: 'rgba(26, 26, 46, 0.05)' };
  if (score >= 1)  return { borderColor: 'rgba(26, 26, 46, 0.06)' };
  return { borderColor: 'rgba(63,63,70,1)' };
}

function trendBarBg(score: number): string {
  if (score >= 50) return 'rgba(16,185,129,1)';
  if (score >= 30) return 'rgba(26, 26, 46, 0.05)';
  if (score >= 10) return 'rgba(26, 26, 46, 0.05)';
  return 'rgba(26, 26, 46, 0.06)';
}

function formatWeekLabel(w: string): string {
  const d = new Date(w + 'T00:00:00');
  const month = d.toLocaleString('default', { month: 'short' });
  const day = d.getDate();
  return `${month} ${day}`;
}

const DIRECTION_CONFIG = {
  accelerating: {
    label: 'Accelerating',
    icon: TrendingUp,
    bg: 'rgba(6,78,59,0.4)',
    color: 'var(--success, rgba(27, 42, 74, 0.06))',
    border: 'rgba(4,120,87,0.5)',
  },
  stable: {
    label: 'Stable',
    icon: Minus,
    bg: 'rgba(120,53,15,0.4)',
    color: 'var(--warning, rgba(251,191,36,1))',
    border: 'rgba(180,83,9,0.5)',
  },
  decelerating: {
    label: 'Decelerating',
    icon: TrendingDown,
    bg: 'rgba(127,29,29,0.4)',
    color: 'var(--danger, rgba(26, 26, 46, 0.06))',
    border: 'rgba(185,28,28,0.5)',
  },
};

const TREND_CONFIG = {
  heating: {
    label: 'Heating up',
    icon: TrendingUp,
    color: 'var(--success, rgba(27, 42, 74, 0.06))',
    bg: 'rgba(6,78,59,0.3)',
  },
  cooling: {
    label: 'Cooling down',
    icon: TrendingDown,
    color: 'var(--danger, rgba(26, 26, 46, 0.06))',
    bg: 'rgba(127,29,29,0.3)',
  },
  stable: {
    label: 'Stable',
    icon: Minus,
    color: 'var(--text-secondary, rgba(161,161,170,1))',
    bg: 'rgba(39,39,42,0.3)',
  },
};

// ── Page Component ────────────────────────────────────────────────────

export default function MomentumPage() {
  const [data, setData] = useState<MomentumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/momentum');
      if (!res.ok) throw new Error('Failed to fetch momentum data');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen" style={{ background: 'var(--surface-0)' }}>
        <div className="text-center space-y-3">
          <Activity className="w-8 h-8 animate-pulse mx-auto" style={{ color: 'var(--accent)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Computing momentum signals...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen" style={{ background: 'var(--surface-0)' }}>
        <div className="text-center space-y-3">
          <AlertTriangle className="w-8 h-8 mx-auto" style={{ color: 'var(--text-primary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{error || 'No data available'}</p>
          <button onClick={fetchData} className="text-xs" style={{ color: 'var(--text-secondary)' }}>Retry</button>
        </div>
      </div>
    );
  }

  const dirConfig = DIRECTION_CONFIG[data.overallDirection];
  const DirIcon = dirConfig.icon;
  const maxOverall = Math.max(...data.overallTrend.map(t => t.score), 1);

  // Identify anomaly investor IDs for highlighting in the heatmap
  const anomalyInvestorIds = new Set(data.anomalies.map(a => a.investorId));

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--surface-0)' }}>
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="page-title">Deal Momentum</h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Investor behavior patterns &middot; Last 8 weeks
              </p>
            </div>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{
                background: dirConfig.bg,
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: dirConfig.border,
              }}
            >
              <DirIcon className="w-4 h-4" style={{ color: dirConfig.color }} />
              <span className="text-sm font-medium" style={{ color: dirConfig.color }}>{dirConfig.label}</span>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* ── Overall Trend Line ──────────────────────────────────────── */}
        <div
          className="rounded-xl p-6"
          style={{
            background: 'var(--surface-1)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--border-default)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4" style={{ color: 'rgba(251,146,60,1)' }} />
            <h2 className="text-sm font-semibold  tracking-wider" style={{ color: 'var(--text-secondary)' }}>Pipeline Momentum &mdash; 8 Week Trend</h2>
          </div>
          <div className="flex items-end gap-2 h-32">
            {data.overallTrend.map((t, i) => {
              const height = maxOverall > 0 ? (t.score / maxOverall) * 100 : 0;
              return (
                <div key={t.week} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{t.score}</span>
                  <div className="w-full relative" style={{ height: '100px' }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t transition-all duration-500"
                      style={{
                        height: `${Math.max(height, 3)}%`,
                        background: trendBarBg(t.score),
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{formatWeekLabel(t.week)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Trajectory Early Warning ──────────────────────────────── */}
        {data.trajectoryAlerts && data.trajectoryAlerts.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              Trajectory Alerts
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              >
                {data.trajectoryAlerts.length}
              </span>
            </h3>
            {data.trajectoryAlerts.map((alert, i) => {
              const colors: Record<string, { bg: string; border: string; color: string }> = {
                critical_warning:  { border: 'rgba(153,27,27,0.5)',  bg: 'rgba(127,29,29,0.1)',  color: 'var(--danger, rgba(26, 26, 46, 0.06))' },
                early_warning:     { border: 'rgba(154,52,18,0.5)',  bg: 'rgba(26, 26, 46, 0.06)',  color: 'rgba(251,146,60,1)' },
                term_sheet_signal: { border: 'rgba(22,101,52,0.5)',  bg: 'rgba(20,83,45,0.1)',   color: 'var(--success, rgba(74,222,128,1))' },
              };
              const labels: Record<string, string> = {
                critical_warning: 'Critical',
                early_warning: 'Warning',
                term_sheet_signal: 'Signal',
              };
              const c = colors[alert.type] || colors.early_warning;
              return (
                <div
                  key={i}
                  className="rounded-lg p-3"
                  style={{
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: c.border,
                    background: c.bg,
                    color: c.color,
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold ">{labels[alert.type]}</span>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{alert.investorName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span>Score: {alert.currentScore}</span>
                      <span>&rarr; {alert.predictedScore21d} (21d)</span>
                      <span style={{ color: alert.slopePerWeek >= 0 ? 'var(--success, rgba(74,222,128,1))' : 'var(--danger, rgba(26, 26, 46, 0.06))' }}>
                        {alert.slopePerWeek >= 0 ? '+' : ''}{alert.slopePerWeek}/wk
                      </span>
                      {alert.daysToThreshold && (
                        <span className="font-medium">~{alert.daysToThreshold}d to threshold</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>{alert.recommendedAction}</p>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <Link
                        href={`/meetings/new?investor=${alert.investorId}`}
                        className="px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
                        style={{ background: 'rgba(74,111,165,0.15)', color: 'var(--accent)', border: '1px solid rgba(74,111,165,0.25)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,111,165,0.3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(74,111,165,0.15)'; }}
                      >
                        Schedule
                      </Link>
                      <Link
                        href={`/investors/${alert.investorId}`}
                        className="px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Heatmap Table ───────────────────────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: 'var(--surface-1)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--border-default)',
          }}
        >
          <div
            className="flex items-center gap-2 px-6 py-4"
            style={{ borderBottom: '1px solid var(--border-default)' }}
          >
            <Eye className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-semibold  tracking-wider" style={{ color: 'var(--text-secondary)' }}>Investor Momentum Heatmap</h2>
            <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>{data.matrix.length} active investors &middot; Score 0-100</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-1)' }}>
                  <th
                    className="sticky left-0 z-10 text-left px-4 py-3 font-medium text-xs  tracking-wider min-w-[200px]"
                    style={{ background: 'var(--surface-1)', color: 'var(--text-muted)' }}
                  >
                    Investor
                  </th>
                  {data.weeks.map(w => (
                    <th key={w} className="px-2 py-3 font-medium text-xs text-center min-w-[72px]" style={{ color: 'var(--text-muted)' }}>
                      {formatWeekLabel(w)}
                    </th>
                  ))}
                  <th className="px-3 py-3 font-medium text-xs text-center min-w-[60px]" style={{ color: 'var(--text-muted)' }}>
                    &Delta;
                  </th>
                  <th className="px-2 py-3 font-medium text-xs text-center min-w-[40px]" style={{ color: 'var(--text-muted)' }}>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.matrix.length === 0 ? (
                  <tr>
                    <td colSpan={data.weeks.length + 3} className="px-4 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                      No active investors found. Add investors and log meetings to see momentum data.
                    </td>
                  </tr>
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
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: isAnomaly ? 'rgba(39,39,42,0.2)' : undefined,
                      }}
                    >
                      {/* Investor name + type badge */}
                      <td
                        className="sticky left-0 backdrop-blur z-10 px-4 py-2.5"
                        style={{ background: 'rgba(24,24,27,0.95)' }}
                      >
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/investors/${inv.investorId}`}
                            className="font-medium truncate max-w-[120px]"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {inv.investorName}
                          </Link>
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{
                              background: tc.bg,
                              color: tc.color,
                              borderWidth: '1px',
                              borderStyle: 'solid',
                              borderColor: tc.border,
                            }}
                          >
                            {TYPE_LABELS[inv.type] || inv.type}
                          </span>
                          {isAnomaly && (
                            <span title="Anomaly detected"><Zap className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} /></span>
                          )}
                        </div>
                      </td>

                      {/* Weekly score cells */}
                      {inv.weeklyScores.map((ws) => {
                        const anomalyForWeek = data.anomalies.find(
                          a => a.investorId === inv.investorId
                        );
                        const isAnomalyCell = anomalyForWeek && ws.week === data.weeks[data.weeks.length - 1];

                        return (
                          <td key={ws.week} className="px-1 py-1.5 text-center">
                            <div
                              className="inline-flex items-center justify-center w-14 h-8 rounded font-mono text-xs font-semibold transition-all"
                              style={{
                                ...scoreColorStyle(ws.score),
                                ...(isAnomalyCell ? {
                                  boxShadow: `0 0 0 2px ${anomalyForWeek.direction === 'above' ? 'rgba(27, 42, 74, 0.06)' : 'rgba(26, 26, 46, 0.06)'}`,
                                } : {}),
                              }}
                            >
                              {ws.score}
                            </div>
                          </td>
                        );
                      })}

                      {/* Delta column */}
                      <td className="px-3 py-2.5 text-center">
                        <div
                          className="inline-flex items-center gap-0.5 text-xs font-mono font-semibold"
                          style={{
                            color: delta > 0
                              ? 'var(--success, rgba(27, 42, 74, 0.06))'
                              : delta < 0
                                ? 'var(--danger, rgba(26, 26, 46, 0.06))'
                                : 'var(--text-muted)',
                          }}
                        >
                          {delta > 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : delta < 0 ? (
                            <ArrowDownRight className="w-3 h-3" />
                          ) : null}
                          {delta > 0 ? `+${delta}` : delta}
                        </div>
                      </td>
                      {/* Quick action */}
                      <td className="px-2 py-2.5 text-center">
                        <Link
                          href={delta < -5 ? `/meetings/new?investor=${inv.investorId}` : `/investors/${inv.investorId}`}
                          title={delta < -5 ? 'Schedule meeting — momentum dropping' : 'View investor'}
                          className="inline-flex items-center justify-center w-6 h-6 rounded transition-colors"
                          style={{ background: 'transparent', color: 'var(--text-muted)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--accent)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div
            className="flex items-center gap-4 px-6 py-3"
            style={{
              borderTop: '1px solid var(--border-default)',
              background: 'var(--surface-1)',
            }}
          >
            <span className="text-[10px]  tracking-wider" style={{ color: 'var(--text-muted)' }}>Score</span>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded" style={{ background: 'rgba(153,27,27,0.6)' }} /><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>1-30</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded" style={{ background: 'rgba(180,83,9,0.6)' }} /><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>31-50</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded" style={{ background: 'rgba(6,95,70,0.6)' }} /><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>51-70</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded" style={{ background: 'rgba(5,150,105,0.8)' }} /><span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>71-100</span>
            </div>
            <div className="ml-4 flex items-center gap-1.5">
              <div className="w-4 h-3 rounded" style={{ background: 'var(--surface-2)', boxShadow: '0 none' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Above cohort</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded" style={{ background: 'var(--surface-2)', boxShadow: '0 none' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Below cohort</span>
            </div>
          </div>
        </div>

        {/* ── Cohort Summary + Anomalies Row ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Cohort Summary */}
          <div
            className="rounded-xl p-6"
            style={{
              background: 'var(--surface-1)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--border-default)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4" style={{ color: 'rgba(192,132,252,1)' }} />
              <h2 className="text-sm font-semibold  tracking-wider" style={{ color: 'var(--text-secondary)' }}>Cohort Momentum</h2>
            </div>
            {data.cohorts.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No cohort data available.</p>
            ) : (
              <div className="space-y-3">
                {data.cohorts.map(cohort => {
                  const tc = TYPE_COLORS[cohort.type] || TYPE_COLORS.vc;
                  const trendCfg = TREND_CONFIG[cohort.trend];
                  const TrendIcon = trendCfg.icon;
                  const maxCohortScore = Math.max(...cohort.weeklyAvg.map(w => w.score), 1);

                  return (
                    <div key={cohort.type} className="rounded-lg p-4" style={{ background: 'var(--surface-2)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded text-xs font-semibold"
                            style={{
                              background: tc.bg,
                              color: tc.color,
                              borderWidth: '1px',
                              borderStyle: 'solid',
                              borderColor: tc.border,
                            }}
                          >
                            {TYPE_LABELS[cohort.type] || cohort.type}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{cohort.memberCount} investors</span>
                        </div>
                        <div
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                          style={{ background: trendCfg.bg, color: trendCfg.color }}
                        >
                          <TrendIcon className="w-3 h-3" />
                          {trendCfg.label}
                        </div>
                      </div>

                      {/* Mini sparkline */}
                      <div className="flex items-end gap-1 h-10">
                        {cohort.weeklyAvg.map((ws) => {
                          const h = maxCohortScore > 0 ? (ws.score / maxCohortScore) * 100 : 0;
                          return (
                            <div key={ws.week} className="flex-1 relative" style={{ height: '100%' }}>
                              <div
                                className="absolute bottom-0 w-full rounded-t"
                                style={{
                                  height: `${Math.max(h, 5)}%`,
                                  background: trendBarBg(ws.score),
                                  opacity: 0.7,
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Week labels and scores */}
                      <div className="flex gap-1 mt-1">
                        {cohort.weeklyAvg.map((ws) => (
                          <div key={ws.week} className="flex-1 text-center">
                            <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{ws.score}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Anomalies */}
          <div
            className="rounded-xl p-6"
            style={{
              background: 'var(--surface-1)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--border-default)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              <h2 className="text-sm font-semibold  tracking-wider" style={{ color: 'var(--text-secondary)' }}>Momentum Anomalies</h2>
              {data.anomalies.length > 0 && (
                <span
                  className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    background: 'var(--warning-muted, rgba(120,53,15,0.4))',
                    color: 'var(--text-tertiary)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'rgba(180,83,9,0.4)',
                  }}
                >
                  {data.anomalies.length}
                </span>
              )}
            </div>
            {data.anomalies.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No anomalies detected.</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary, rgba(63,63,70,1))' }}>All investors are tracking near their cohort averages.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.anomalies.map((anomaly, i) => {
                  const tc = TYPE_COLORS[anomaly.type] || TYPE_COLORS.vc;
                  const isAbove = anomaly.direction === 'above';

                  return (
                    <div
                      key={i}
                      className="rounded-lg p-3"
                      style={{
                        background: isAbove ? 'rgba(6,78,59,0.2)' : 'rgba(127,29,29,0.2)',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: isAbove ? 'rgba(6,95,70,0.3)' : 'rgba(153,27,27,0.3)',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background: isAbove ? 'rgba(6,78,59,0.4)' : 'rgba(127,29,29,0.4)' }}
                        >
                          {isAbove ? (
                            <ArrowUpRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              href={`/investors/${anomaly.investorId}`}
                              className="text-sm font-medium"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {anomaly.investorName}
                            </Link>
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style={{
                                background: tc.bg,
                                color: tc.color,
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                borderColor: tc.border,
                              }}
                            >
                              {TYPE_LABELS[anomaly.type] || anomaly.type}
                            </span>
                            <span
                              className="text-xs font-mono font-semibold"
                              style={{ color: isAbove ? 'var(--success)' : 'var(--danger)' }}
                            >
                              {anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation}pts
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs flex-1" style={{ color: 'var(--text-muted)' }}>{anomaly.message}</p>
                            <Link
                              href={isAbove ? `/meetings/prep?investor=${anomaly.investorId}` : `/meetings/new?investor=${anomaly.investorId}`}
                              className="ml-3 px-2 py-0.5 rounded text-[10px] font-medium shrink-0 transition-colors"
                              style={{
                                background: isAbove ? 'rgba(6,78,59,0.3)' : 'rgba(127,29,29,0.3)',
                                color: isAbove ? 'var(--success)' : 'var(--danger)',
                                border: `1px solid ${isAbove ? 'rgba(6,95,70,0.4)' : 'rgba(153,27,27,0.4)'}`,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                            >
                              {isAbove ? 'Prep Meeting' : 'Re-engage'}
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Cross-Investor Signals ──────────────────────────────────── */}
        {data.crossSignals.length > 0 && (
          <div
            className="rounded-xl p-6"
            style={{
              background: 'var(--surface-1)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--border-default)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
              <h2 className="text-sm font-semibold  tracking-wider" style={{ color: 'var(--text-secondary)' }}>Cross-Investor Signals</h2>
              <span
                className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background: 'var(--danger-muted, rgba(127,29,29,0.4))',
                  color: 'var(--text-primary)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'rgba(185,28,28,0.4)',
                }}
              >
                {data.crossSignals.length}
              </span>
            </div>
            <div className="space-y-3">
              {data.crossSignals.map((signal, i) => (
                <div
                  key={i}
                  className="rounded-lg p-4"
                  style={{
                    background: 'var(--surface-2)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-16 flex-shrink-0">
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{formatWeekLabel(signal.week)}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>{signal.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {signal.affectedInvestors.map(name => (
                          <span
                            key={name}
                            className="px-2 py-0.5 rounded text-[10px]"
                            style={{
                              background: 'var(--surface-2)',
                              color: 'var(--text-secondary)',
                              borderWidth: '1px',
                              borderStyle: 'solid',
                              borderColor: 'var(--border-default)',
                            }}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Timing Signals ─────────────────────────────────────────── */}
        {data.timingSignals && data.timingSignals.length > 0 && (
          <div
            className="rounded-xl p-6"
            style={{
              background: 'var(--surface-1)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--border-default)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              <h2 className="text-sm font-semibold  tracking-wider" style={{ color: 'var(--text-secondary)' }}>Timing Signals</h2>
              <span
                className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  background: 'var(--warning-muted, rgba(120,53,15,0.4))',
                  color: 'var(--text-tertiary)',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'rgba(180,83,9,0.4)',
                }}
              >
                {data.timingSignals.length}
              </span>
            </div>
            <div className="space-y-2">
              {data.timingSignals.map((signal, i) => {
                const urgencyStyles: Record<string, { bg: string; border: string; color: string }> = {
                  high:   { bg: 'rgba(127,29,29,0.2)',  border: 'rgba(153,27,27,0.4)',  color: 'var(--danger, rgba(26, 26, 46, 0.06))' },
                  medium: { bg: 'rgba(113,63,18,0.2)',  border: 'rgba(133,77,14,0.4)',  color: 'var(--warning, rgba(250,204,21,1))' },
                  low:    { bg: 'rgba(39,39,42,0.4)',   border: 'rgba(63,63,70,0.4)',   color: 'var(--text-secondary)' },
                };
                const typeLabels: Record<string, string> = {
                  competitive_tension: 'Competitive Tension',
                  engagement_gap: 'Engagement Gap',
                  dd_synchronization: 'DD Synchronization',
                };
                const typeIconColors: Record<string, string> = {
                  competitive_tension: 'var(--danger, rgba(26, 26, 46, 0.06))',
                  engagement_gap: 'rgba(251,146,60,1)',
                  dd_synchronization: 'var(--success, rgba(27, 42, 74, 0.06))',
                };
                const us = urgencyStyles[signal.urgency] || urgencyStyles.low;

                return (
                  <div
                    key={i}
                    className="rounded-lg p-3"
                    style={{
                      background: us.bg,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: us.border,
                      color: us.color,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-[10px] font-bold "
                        style={{ color: typeIconColors[signal.type] || 'var(--text-secondary)' }}
                      >
                        {typeLabels[signal.type] || signal.type}
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                        style={{
                          background: us.bg,
                          color: us.color,
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: us.border,
                        }}
                      >
                        {signal.urgency.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{signal.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {signal.investorNames.map(name => (
                        <span
                          key={name}
                          className="px-2 py-0.5 rounded text-[10px]"
                          style={{
                            background: 'var(--surface-2)',
                            color: 'var(--text-secondary)',
                            borderWidth: '1px',
                            borderStyle: 'solid',
                            borderColor: 'var(--border-default)',
                          }}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Narrative Health by Investor Type ─────────────────────── */}
        {data.narrativeHealth && data.narrativeHealth.length > 0 && (
          <div
            className="rounded-xl p-6"
            style={{
              background: 'var(--surface-1)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'var(--border-default)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4" style={{ color: 'rgba(192,132,252,1)' }} />
              <h2 className="text-sm font-semibold  tracking-wider" style={{ color: 'var(--text-secondary)' }}>Narrative Health by Type</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.narrativeHealth.map((nh) => {
                const tc = TYPE_COLORS[nh.investorType] || TYPE_COLORS.vc;
                const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
                  effective:         { bg: 'rgba(6,78,59,0.2)',   color: 'var(--success, rgba(27, 42, 74, 0.06))',  label: 'Effective' },
                  struggling:        { bg: 'rgba(127,29,29,0.2)', color: 'var(--danger, rgba(26, 26, 46, 0.06))',  label: 'Struggling' },
                  insufficient_data: { bg: 'rgba(39,39,42,0.4)',  color: 'var(--text-muted)',                   label: 'Low data' },
                };
                const sc = statusStyles[nh.status] || statusStyles.insufficient_data;

                return (
                  <div
                    key={nh.investorType}
                    className="rounded-lg p-4"
                    style={{
                      background: sc.bg,
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'var(--border-default)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={{
                          background: tc.bg,
                          color: tc.color,
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          borderColor: tc.border,
                        }}
                      >
                        {TYPE_LABELS[nh.investorType] || nh.investorType}
                      </span>
                      <span className="text-[10px] font-bold " style={{ color: sc.color }}>{sc.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Enthusiasm</span>
                        <div
                          className="font-semibold tabular-nums"
                          style={{ color: nh.avgEnthusiasm >= 3 ? 'var(--success, rgba(27, 42, 74, 0.06))' : 'var(--danger, rgba(26, 26, 46, 0.06))' }}
                        >
                          {nh.avgEnthusiasm.toFixed(1)}/5
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Conversion</span>
                        <div
                          className="font-semibold tabular-nums"
                          style={{ color: nh.conversionRate >= 20 ? 'var(--success, rgba(27, 42, 74, 0.06))' : 'var(--danger, rgba(26, 26, 46, 0.06))' }}
                        >
                          {nh.conversionRate}%
                        </div>
                      </div>
                    </div>
                    {nh.topObjection && (
                      <div className="mt-2 flex items-center justify-between">
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          Top objection: <span style={{ color: 'var(--text-secondary)' }}>{nh.topObjection}</span>
                        </div>
                        <Link
                          href="/objections"
                          className="text-[10px] font-medium shrink-0 ml-2 transition-colors"
                          style={{ color: 'var(--accent)' }}
                          onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }}
                          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                        >
                          View &rarr;
                        </Link>
                      </div>
                    )}
                    {nh.topQuestionTopic && (
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        Top question: <span style={{ color: 'var(--text-secondary)' }}>{nh.topQuestionTopic}</span>
                      </div>
                    )}
                    <div className="mt-1 text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      {nh.sampleSize} investor{nh.sampleSize !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="text-center pb-4">
          <p className="text-xs" style={{ color: 'var(--text-tertiary, rgba(63,63,70,1))' }}>
            Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : 'just now'}
            &nbsp;&middot;&nbsp; Momentum = meetings + status changes + enthusiasm shifts + tasks + follow-ups
          </p>
        </div>
      </div>
    </div>
  );
}

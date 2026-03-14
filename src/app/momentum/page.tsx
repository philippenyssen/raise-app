'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity, TrendingUp, TrendingDown, Minus, AlertTriangle,
  RefreshCw, Users, ArrowUpRight, ArrowDownRight, Flame,
  Zap, Eye, Clock, MessageSquare,
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

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  vc:            { bg: 'bg-blue-900/30',    text: 'text-blue-400',    border: 'border-blue-700/40' },
  growth:        { bg: 'bg-purple-900/30',  text: 'text-purple-400',  border: 'border-purple-700/40' },
  sovereign:     { bg: 'bg-amber-900/30',   text: 'text-amber-400',   border: 'border-amber-700/40' },
  strategic:     { bg: 'bg-emerald-900/30', text: 'text-emerald-400', border: 'border-emerald-700/40' },
  debt:          { bg: 'bg-orange-900/30',  text: 'text-orange-400',  border: 'border-orange-700/40' },
  family_office: { bg: 'bg-rose-900/30',    text: 'text-rose-400',    border: 'border-rose-700/40' },
};

function scoreColor(score: number): string {
  if (score >= 71) return 'bg-emerald-600/80 text-emerald-50';
  if (score >= 51) return 'bg-emerald-800/60 text-emerald-200';
  if (score >= 31) return 'bg-amber-700/60 text-amber-100';
  if (score >= 1)  return 'bg-red-800/60 text-red-200';
  return 'bg-zinc-800/60 text-zinc-500';
}

function scoreBorderColor(score: number): string {
  if (score >= 71) return 'border-emerald-400';
  if (score >= 51) return 'border-emerald-600';
  if (score >= 31) return 'border-amber-500';
  if (score >= 1)  return 'border-red-500';
  return 'border-zinc-700';
}

function trendBarColor(score: number): string {
  if (score >= 50) return 'bg-emerald-500';
  if (score >= 30) return 'bg-amber-500';
  if (score >= 10) return 'bg-orange-500';
  return 'bg-red-500';
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
    bg: 'bg-emerald-900/40',
    text: 'text-emerald-400',
    border: 'border-emerald-700/50',
  },
  stable: {
    label: 'Stable',
    icon: Minus,
    bg: 'bg-amber-900/40',
    text: 'text-amber-400',
    border: 'border-amber-700/50',
  },
  decelerating: {
    label: 'Decelerating',
    icon: TrendingDown,
    bg: 'bg-red-900/40',
    text: 'text-red-400',
    border: 'border-red-700/50',
  },
};

const TREND_CONFIG = {
  heating: {
    label: 'Heating up',
    icon: TrendingUp,
    color: 'text-emerald-400',
    bg: 'bg-emerald-900/30',
  },
  cooling: {
    label: 'Cooling down',
    icon: TrendingDown,
    color: 'text-red-400',
    bg: 'bg-red-900/30',
  },
  stable: {
    label: 'Stable',
    icon: Minus,
    color: 'text-zinc-400',
    bg: 'bg-zinc-800/30',
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
      <div className="flex-1 flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="text-center space-y-3">
          <Activity className="w-8 h-8 text-blue-500 animate-pulse mx-auto" />
          <p className="text-zinc-400 text-sm">Computing momentum signals...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-red-400 text-sm">{error || 'No data available'}</p>
          <button onClick={fetchData} className="text-xs text-zinc-400 hover:text-white">Retry</button>
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
    <div className="flex-1 overflow-y-auto bg-zinc-950">
      <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Deal Momentum</h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Investor behavior patterns &middot; Last 8 weeks
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${dirConfig.bg} ${dirConfig.border}`}>
              <DirIcon className={`w-4 h-4 ${dirConfig.text}`} />
              <span className={`text-sm font-medium ${dirConfig.text}`}>{dirConfig.label}</span>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* ── Overall Trend Line ──────────────────────────────────────── */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Pipeline Momentum &mdash; 8 Week Trend</h2>
          </div>
          <div className="flex items-end gap-2 h-32">
            {data.overallTrend.map((t, i) => {
              const height = maxOverall > 0 ? (t.score / maxOverall) * 100 : 0;
              return (
                <div key={t.week} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-mono text-zinc-400">{t.score}</span>
                  <div className="w-full relative" style={{ height: '100px' }}>
                    <div
                      className={`absolute bottom-0 w-full rounded-t ${trendBarColor(t.score)} transition-all duration-500`}
                      style={{ height: `${Math.max(height, 3)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-600 font-mono">{formatWeekLabel(t.week)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Trajectory Early Warning ──────────────────────────────── */}
        {data.trajectoryAlerts && data.trajectoryAlerts.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              Trajectory Alerts
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">{data.trajectoryAlerts.length}</span>
            </h3>
            {data.trajectoryAlerts.map((alert, i) => {
              const colors = {
                critical_warning: 'border-red-800/50 bg-red-900/10 text-red-400',
                early_warning: 'border-orange-800/50 bg-orange-900/10 text-orange-400',
                term_sheet_signal: 'border-green-800/50 bg-green-900/10 text-green-400',
              };
              const labels = {
                critical_warning: 'CRITICAL',
                early_warning: 'WARNING',
                term_sheet_signal: 'OPPORTUNITY',
              };
              return (
                <div key={i} className={`border rounded-lg p-3 ${colors[alert.type]}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase">{labels[alert.type]}</span>
                      <span className="text-sm font-medium text-zinc-200">{alert.investorName}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span>Score: {alert.currentScore}</span>
                      <span>&rarr; {alert.predictedScore21d} (21d)</span>
                      <span className={alert.slopePerWeek >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {alert.slopePerWeek >= 0 ? '+' : ''}{alert.slopePerWeek}/wk
                      </span>
                      {alert.daysToThreshold && (
                        <span className="font-medium">~{alert.daysToThreshold}d to threshold</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">{alert.recommendedAction}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Heatmap Table ───────────────────────────────────────────── */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-zinc-800">
            <Eye className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Investor Momentum Heatmap</h2>
            <span className="ml-auto text-xs text-zinc-600">{data.matrix.length} active investors &middot; Score 0-100</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-900">
                  <th className="sticky left-0 bg-zinc-900 z-10 text-left px-4 py-3 text-zinc-500 font-medium text-xs uppercase tracking-wider min-w-[200px]">
                    Investor
                  </th>
                  {data.weeks.map(w => (
                    <th key={w} className="px-2 py-3 text-zinc-500 font-medium text-xs text-center min-w-[72px]">
                      {formatWeekLabel(w)}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-zinc-500 font-medium text-xs text-center min-w-[60px]">
                    &Delta;
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {data.matrix.length === 0 ? (
                  <tr>
                    <td colSpan={data.weeks.length + 2} className="px-4 py-12 text-center text-zinc-600">
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
                      className={`hover:bg-zinc-800/30 transition-colors ${isAnomaly ? 'bg-zinc-800/20' : ''}`}
                    >
                      {/* Investor name + type badge */}
                      <td className="sticky left-0 bg-zinc-900/95 backdrop-blur z-10 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/investors/${inv.investorId}`}
                            className="text-zinc-200 hover:text-white font-medium truncate max-w-[120px]"
                          >
                            {inv.investorName}
                          </Link>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${tc.bg} ${tc.text} ${tc.border}`}>
                            {TYPE_LABELS[inv.type] || inv.type}
                          </span>
                          {isAnomaly && (
                            <span title="Anomaly detected"><Zap className="w-3 h-3 text-amber-400 flex-shrink-0" /></span>
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
                              className={`
                                inline-flex items-center justify-center
                                w-14 h-8 rounded font-mono text-xs font-semibold
                                ${scoreColor(ws.score)}
                                ${isAnomalyCell ? `ring-2 ${anomalyForWeek.direction === 'above' ? 'ring-emerald-400' : 'ring-red-400'}` : ''}
                                transition-all
                              `}
                            >
                              {ws.score}
                            </div>
                          </td>
                        );
                      })}

                      {/* Delta column */}
                      <td className="px-3 py-2.5 text-center">
                        <div className={`inline-flex items-center gap-0.5 text-xs font-mono font-semibold ${
                          delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-zinc-600'
                        }`}>
                          {delta > 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : delta < 0 ? (
                            <ArrowDownRight className="w-3 h-3" />
                          ) : null}
                          {delta > 0 ? `+${delta}` : delta}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-6 py-3 border-t border-zinc-800 bg-zinc-900/80">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Score</span>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded bg-red-800/60" /><span className="text-[10px] text-zinc-500">1-30</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded bg-amber-700/60" /><span className="text-[10px] text-zinc-500">31-50</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded bg-emerald-800/60" /><span className="text-[10px] text-zinc-500">51-70</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded bg-emerald-600/80" /><span className="text-[10px] text-zinc-500">71-100</span>
            </div>
            <div className="ml-4 flex items-center gap-1.5">
              <div className="w-4 h-3 rounded ring-2 ring-emerald-400 bg-zinc-800" />
              <span className="text-[10px] text-zinc-500">Above cohort</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-3 rounded ring-2 ring-red-400 bg-zinc-800" />
              <span className="text-[10px] text-zinc-500">Below cohort</span>
            </div>
          </div>
        </div>

        {/* ── Cohort Summary + Anomalies Row ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Cohort Summary */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Cohort Momentum</h2>
            </div>
            {data.cohorts.length === 0 ? (
              <p className="text-zinc-600 text-sm">No cohort data available.</p>
            ) : (
              <div className="space-y-3">
                {data.cohorts.map(cohort => {
                  const tc = TYPE_COLORS[cohort.type] || TYPE_COLORS.vc;
                  const trendCfg = TREND_CONFIG[cohort.trend];
                  const TrendIcon = trendCfg.icon;
                  const maxCohortScore = Math.max(...cohort.weeklyAvg.map(w => w.score), 1);

                  return (
                    <div key={cohort.type} className="bg-zinc-800/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${tc.bg} ${tc.text} ${tc.border}`}>
                            {TYPE_LABELS[cohort.type] || cohort.type}
                          </span>
                          <span className="text-xs text-zinc-600">{cohort.memberCount} investors</span>
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${trendCfg.bg} ${trendCfg.color}`}>
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
                                className={`absolute bottom-0 w-full rounded-t ${trendBarColor(ws.score)} opacity-70`}
                                style={{ height: `${Math.max(h, 5)}%` }}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Week labels and scores */}
                      <div className="flex gap-1 mt-1">
                        {cohort.weeklyAvg.map((ws) => (
                          <div key={ws.week} className="flex-1 text-center">
                            <span className="text-[9px] font-mono text-zinc-600">{ws.score}</span>
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
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Momentum Anomalies</h2>
              {data.anomalies.length > 0 && (
                <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-900/40 text-amber-400 border border-amber-700/40">
                  {data.anomalies.length}
                </span>
              )}
            </div>
            {data.anomalies.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                <p className="text-zinc-600 text-sm">No anomalies detected.</p>
                <p className="text-zinc-700 text-xs mt-1">All investors are tracking near their cohort averages.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.anomalies.map((anomaly, i) => {
                  const tc = TYPE_COLORS[anomaly.type] || TYPE_COLORS.vc;
                  const isAbove = anomaly.direction === 'above';

                  return (
                    <div
                      key={i}
                      className={`rounded-lg p-3 border ${isAbove ? 'bg-emerald-950/20 border-emerald-800/30' : 'bg-red-950/20 border-red-800/30'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${isAbove ? 'bg-emerald-900/40' : 'bg-red-900/40'}`}>
                          {isAbove ? (
                            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Link
                              href={`/investors/${anomaly.investorId}`}
                              className="text-sm font-medium text-zinc-200 hover:text-white"
                            >
                              {anomaly.investorName}
                            </Link>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${tc.bg} ${tc.text} ${tc.border}`}>
                              {TYPE_LABELS[anomaly.type] || anomaly.type}
                            </span>
                            <span className={`text-xs font-mono font-semibold ${isAbove ? 'text-emerald-400' : 'text-red-400'}`}>
                              {anomaly.deviation > 0 ? '+' : ''}{anomaly.deviation}pts
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500">{anomaly.message}</p>
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
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Cross-Investor Signals</h2>
              <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold bg-red-900/40 text-red-400 border border-red-700/40">
                {data.crossSignals.length}
              </span>
            </div>
            <div className="space-y-3">
              {data.crossSignals.map((signal, i) => (
                <div key={i} className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-700/30">
                  <div className="flex items-start gap-3">
                    <div className="w-16 flex-shrink-0">
                      <span className="text-xs font-mono text-zinc-500">{formatWeekLabel(signal.week)}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-zinc-300 mb-2">{signal.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {signal.affectedInvestors.map(name => (
                          <span key={name} className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400 border border-zinc-700">
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
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Timing Signals</h2>
              <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-900/40 text-amber-400 border border-amber-700/40">
                {data.timingSignals.length}
              </span>
            </div>
            <div className="space-y-2">
              {data.timingSignals.map((signal, i) => {
                const urgencyColors: Record<string, string> = {
                  high: 'bg-red-900/20 border-red-800/40 text-red-400',
                  medium: 'bg-yellow-900/20 border-yellow-800/40 text-yellow-400',
                  low: 'bg-zinc-800/40 border-zinc-700/40 text-zinc-400',
                };
                const typeLabels: Record<string, string> = {
                  competitive_tension: 'Competitive Tension',
                  engagement_gap: 'Engagement Gap',
                  dd_synchronization: 'DD Synchronization',
                };
                const typeIcons: Record<string, string> = {
                  competitive_tension: 'text-red-400',
                  engagement_gap: 'text-orange-400',
                  dd_synchronization: 'text-emerald-400',
                };

                return (
                  <div key={i} className={`rounded-lg p-3 border ${urgencyColors[signal.urgency] || urgencyColors.low}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold uppercase ${typeIcons[signal.type] || 'text-zinc-400'}`}>
                        {typeLabels[signal.type] || signal.type}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${urgencyColors[signal.urgency] || urgencyColors.low}`}>
                        {signal.urgency.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mb-2">{signal.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {signal.investorNames.map(name => (
                        <span key={name} className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400 border border-zinc-700">
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
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">Narrative Health by Type</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.narrativeHealth.map((nh) => {
                const tc = TYPE_COLORS[nh.investorType] || TYPE_COLORS.vc;
                const statusColors: Record<string, { bg: string; text: string; label: string }> = {
                  effective: { bg: 'bg-emerald-900/20', text: 'text-emerald-400', label: 'Effective' },
                  struggling: { bg: 'bg-red-900/20', text: 'text-red-400', label: 'Struggling' },
                  insufficient_data: { bg: 'bg-zinc-800/40', text: 'text-zinc-500', label: 'Low data' },
                };
                const sc = statusColors[nh.status] || statusColors.insufficient_data;

                return (
                  <div key={nh.investorType} className={`rounded-lg p-4 border border-zinc-800 ${sc.bg}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${tc.bg} ${tc.text} ${tc.border}`}>
                        {TYPE_LABELS[nh.investorType] || nh.investorType}
                      </span>
                      <span className={`text-[10px] font-bold uppercase ${sc.text}`}>{sc.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-zinc-600">Enthusiasm</span>
                        <div className={`font-semibold tabular-nums ${nh.avgEnthusiasm >= 3 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {nh.avgEnthusiasm.toFixed(1)}/5
                        </div>
                      </div>
                      <div>
                        <span className="text-zinc-600">Conversion</span>
                        <div className={`font-semibold tabular-nums ${nh.conversionRate >= 20 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {nh.conversionRate}%
                        </div>
                      </div>
                    </div>
                    {nh.topObjection && (
                      <div className="mt-2 text-[10px] text-zinc-500">
                        Top objection: <span className="text-zinc-400">{nh.topObjection}</span>
                      </div>
                    )}
                    {nh.topQuestionTopic && (
                      <div className="text-[10px] text-zinc-500">
                        Top question: <span className="text-zinc-400">{nh.topQuestionTopic}</span>
                      </div>
                    )}
                    <div className="mt-1 text-[9px] text-zinc-600">
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
          <p className="text-xs text-zinc-700">
            Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : 'just now'}
            &nbsp;&middot;&nbsp; Momentum = meetings + status changes + enthusiasm shifts + tasks + follow-ups
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Target, Activity, Shield, Users, TrendingUp, TrendingDown,
  Minus, RefreshCw, AlertTriangle, ArrowRight, Clock,
  BarChart3, MessageCircleWarning, Zap, CheckCircle2,
} from 'lucide-react';

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
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }> }> = {
  pipeline:  { label: 'Pipeline',  color: 'text-blue-400',    bg: 'bg-blue-900/20',    border: 'border-blue-700/40',    icon: Users },
  narrative: { label: 'Narrative', color: 'text-purple-400',  bg: 'bg-purple-900/20',  border: 'border-purple-700/40',  icon: MessageCircleWarning },
  execution: { label: 'Execution', color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-700/40', icon: Zap },
  timing:    { label: 'Timing',    color: 'text-amber-400',   bg: 'bg-amber-900/20',   border: 'border-amber-700/40',   icon: Clock },
  risk:      { label: 'Risk',      color: 'text-red-400',     bg: 'bg-red-900/20',     border: 'border-red-700/40',     icon: Shield },
};

const TREND_CONFIG = {
  accelerating: { label: 'Accelerating', icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-700/40' },
  steady:       { label: 'Steady',       icon: Minus,       color: 'text-amber-400',   bg: 'bg-amber-900/30',   border: 'border-amber-700/40' },
  decelerating: { label: 'Decelerating', icon: TrendingDown, color: 'text-red-400',    bg: 'bg-red-900/30',     border: 'border-red-700/40' },
};

function gaugeColor(score: number, invert = false): string {
  if (invert) {
    if (score >= 0.5) return 'text-red-400';
    if (score >= 0.25) return 'text-yellow-400';
    return 'text-emerald-400';
  }
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function gaugeBarColor(score: number, invert = false): string {
  if (invert) {
    if (score >= 0.5) return 'bg-red-500';
    if (score >= 0.25) return 'bg-yellow-500';
    return 'bg-emerald-500';
  }
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function priorityBadge(p: number): string {
  if (p === 1) return 'bg-red-900/30 text-red-400 border-red-700/40';
  if (p === 2) return 'bg-orange-900/30 text-orange-400 border-orange-700/40';
  if (p === 3) return 'bg-yellow-900/30 text-yellow-400 border-yellow-700/40';
  return 'bg-zinc-800 text-zinc-400 border-zinc-700';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StrategicPage() {
  const [data, setData] = useState<StrategicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/intelligence/strategic');
      if (!res.ok) throw new Error('Failed to load strategic data');
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse" />
        <div className="h-32 bg-zinc-800/50 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 bg-zinc-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-zinc-800/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold tracking-tight">Strategic Dashboard</h1>
        <div className="border border-red-800/30 bg-red-900/10 rounded-xl p-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-zinc-400">{error || 'Could not load strategic data.'}</p>
          <button onClick={() => fetchData()} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const trendCfg = TREND_CONFIG[data.raiseVelocity.trend];
  const TrendIcon = trendCfg.icon;
  const concentrationPct = Math.round(data.pipelineConcentrationRisk * 100);

  return (
    <div className="space-y-6">
      {/* ================================================================ */}
      {/* HEADER                                                           */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
            <Target className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Strategic Dashboard</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Consolidated intelligence assessment</p>
          </div>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ================================================================ */}
      {/* CEO BRIEF                                                        */}
      {/* ================================================================ */}
      <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-blue-400" />
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">CEO Brief</span>
        </div>
        <p className="text-lg text-zinc-200 leading-relaxed">{data.ceoBrief}</p>
      </div>

      {/* ================================================================ */}
      {/* GAUGE CARDS                                                      */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Readiness Score */}
        <GaugeCard
          label="Fundraise Readiness"
          value={data.fundraiseReadinessScore}
          suffix="/100"
          description="Pipeline depth, narrative, execution, data room"
          barPct={data.fundraiseReadinessScore}
          barColor={gaugeBarColor(data.fundraiseReadinessScore)}
          valueColor={gaugeColor(data.fundraiseReadinessScore)}
        />

        {/* Narrative Health */}
        <GaugeCard
          label="Narrative Health"
          value={data.narrativeHealthScore}
          suffix="/100"
          description="Question convergence, objections, enthusiasm"
          barPct={data.narrativeHealthScore}
          barColor={gaugeBarColor(data.narrativeHealthScore)}
          valueColor={gaugeColor(data.narrativeHealthScore)}
        />

        {/* Pipeline Concentration */}
        <GaugeCard
          label="Pipeline Concentration"
          value={concentrationPct}
          suffix="%"
          description={concentrationPct < 25 ? 'Well diversified' : concentrationPct < 40 ? 'Moderate risk' : 'Too concentrated'}
          barPct={concentrationPct}
          barColor={gaugeBarColor(data.pipelineConcentrationRisk, true)}
          valueColor={gaugeColor(data.pipelineConcentrationRisk, true)}
        />

        {/* Raise Velocity */}
        <div className="border border-zinc-800 rounded-xl p-5 flex flex-col">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Raise Velocity</div>
          <div className="flex items-center gap-2 mb-2">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${trendCfg.bg} ${trendCfg.color} ${trendCfg.border}`}>
              <TrendIcon className="w-3 h-3" />
              {trendCfg.label}
            </div>
          </div>
          <div className="mt-auto space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Meetings/wk</span>
              <span className="text-zinc-200 font-semibold tabular-nums">{data.raiseVelocity.meetingsPerWeek}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Advances/wk</span>
              <span className="text-zinc-200 font-semibold tabular-nums">{data.raiseVelocity.stageAdvancesPerWeek}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* HEALTH TREND SPARKLINE                                           */}
      {/* ================================================================ */}
      {data.historicalSnapshots.length >= 2 && (
        <div className="border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-zinc-400 uppercase">Health Trend</span>
            <span className="text-xs text-zinc-600 ml-auto">{data.historicalSnapshots.length} snapshots</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SparklineRow
              label="Readiness"
              values={data.historicalSnapshots.map(s => s.readinessScore)}
              dates={data.historicalSnapshots.map(s => s.date)}
              color="emerald"
            />
            <SparklineRow
              label="Narrative"
              values={data.historicalSnapshots.map(s => s.narrativeScore)}
              dates={data.historicalSnapshots.map(s => s.date)}
              color="purple"
            />
            <SparklineRow
              label="Pipeline"
              values={data.historicalSnapshots.map(s => s.pipelineScore)}
              dates={data.historicalSnapshots.map(s => s.date)}
              color="blue"
            />
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TEMPORAL TRENDS (cycle 14)                                        */}
      {/* ================================================================ */}
      {data.temporalTrends && data.temporalTrends.trends.length > 0 && (
        <div className="border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-zinc-400 uppercase">Temporal Intelligence</span>
            <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full border font-medium ${
              data.temporalTrends.overallDirection === 'improving' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700/40' :
              data.temporalTrends.overallDirection === 'declining' ? 'bg-red-900/30 text-red-400 border-red-700/40' :
              data.temporalTrends.overallDirection === 'mixed' ? 'bg-amber-900/30 text-amber-400 border-amber-700/40' :
              'bg-zinc-800 text-zinc-400 border-zinc-700'
            }`}>
              {data.temporalTrends.overallDirection}
            </span>
            <span className="text-xs text-zinc-600 ml-auto">{data.temporalTrends.daysOfData} days of data</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {data.temporalTrends.trends.map((trend) => (
              <div key={trend.metric} className={`rounded-lg p-3 border ${
                trend.direction === 'improving' ? 'border-emerald-800/30 bg-emerald-900/10' :
                trend.direction === 'declining' ? 'border-red-800/30 bg-red-900/10' :
                'border-zinc-800 bg-zinc-900/30'
              }`}>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{trend.metric}</div>
                <div className="flex items-center gap-1.5">
                  {trend.direction === 'improving' ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  ) : trend.direction === 'declining' ? (
                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Minus className="w-3.5 h-3.5 text-zinc-500" />
                  )}
                  <span className={`text-lg font-bold tabular-nums ${
                    trend.direction === 'improving' ? 'text-emerald-400' :
                    trend.direction === 'declining' ? 'text-red-400' :
                    'text-zinc-300'
                  }`}>{trend.current}</span>
                </div>
                <div className="mt-1 space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-600">7d</span>
                    <span className={trend.delta7d > 0 ? 'text-emerald-500' : trend.delta7d < 0 ? 'text-red-500' : 'text-zinc-500'}>
                      {trend.delta7d > 0 ? '+' : ''}{trend.delta7d}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-zinc-600">30d</span>
                    <span className={trend.delta30d > 0 ? 'text-emerald-500' : trend.delta30d < 0 ? 'text-red-500' : 'text-zinc-500'}>
                      {trend.delta30d > 0 ? '+' : ''}{trend.delta30d}%
                    </span>
                  </div>
                  {trend.streak >= 2 && (
                    <div className="text-[10px] text-amber-500 mt-0.5">{trend.streak}-day streak</div>
                  )}
                </div>
                {trend.alert && (
                  <div className="mt-1.5 flex items-start gap-1">
                    <AlertTriangle className="w-2.5 h-2.5 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-[9px] text-red-400 leading-tight">{trend.alert}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* STRATEGIC RECOMMENDATIONS                                        */}
      {/* ================================================================ */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-medium text-zinc-400 uppercase">Strategic Recommendations</h2>
          <span className="ml-auto text-xs text-zinc-600">{data.recommendations.length} actions</span>
        </div>

        {data.recommendations.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">No critical recommendations at this time. Process is on track.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {data.recommendations.map((rec, i) => {
              const catCfg = CATEGORY_CONFIG[rec.category] || CATEGORY_CONFIG.pipeline;
              const CatIcon = catCfg.icon;

              return (
                <div key={i} className="p-5 hover:bg-zinc-800/20 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Priority badge */}
                    <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${priorityBadge(rec.priority)}`}>
                        P{rec.priority}
                      </span>
                      <div className={`w-7 h-7 rounded flex items-center justify-center ${catCfg.bg}`}>
                        <CatIcon className={`w-3.5 h-3.5 ${catCfg.color}`} />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title + category badge */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-semibold text-zinc-200">{rec.title}</h3>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${catCfg.bg} ${catCfg.color} ${catCfg.border}`}>
                          {catCfg.label}
                        </span>
                      </div>

                      {/* Rationale */}
                      <p className="text-xs text-zinc-500 mb-2">{rec.rationale}</p>

                      {/* Action */}
                      <div className="flex items-start gap-1.5 mb-2">
                        <ArrowRight className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-zinc-300">{rec.action}</p>
                      </div>

                      {/* Impact + Deadline */}
                      <div className="flex items-center gap-4 text-[10px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {rec.expectedImpact}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {rec.deadline}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-zinc-600 py-2">
        Generated {new Date(data.generatedAt).toLocaleString()} — Data-driven from live context bus
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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
    <div className="border border-zinc-800 rounded-xl p-5 flex flex-col">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-3xl font-bold tabular-nums ${valueColor}`}>
        {value}<span className="text-lg font-medium text-zinc-600">{suffix}</span>
      </div>
      <div className="text-xs text-zinc-600 mt-1 mb-3">{description}</div>
      <div className="mt-auto w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.min(100, barPct)}%` }}
        />
      </div>
    </div>
  );
}

function SparklineRow({ label, values, dates, color }: {
  label: string;
  values: number[];
  dates: string[];
  color: 'emerald' | 'purple' | 'blue';
}) {
  const max = Math.max(...values, 1);
  const latest = values[values.length - 1] ?? 0;
  const first = values[0] ?? 0;
  const delta = latest - first;

  const barColors: Record<string, string> = {
    emerald: 'bg-emerald-500',
    purple: 'bg-purple-500',
    blue: 'bg-blue-500',
  };
  const textColors: Record<string, string> = {
    emerald: 'text-emerald-400',
    purple: 'text-purple-400',
    blue: 'text-blue-400',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold tabular-nums ${textColors[color]}`}>{latest}</span>
          {delta !== 0 && (
            <span className={`text-[10px] ${delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {delta > 0 ? '+' : ''}{delta}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-end gap-0.5 h-8">
        {values.map((v, i) => {
          const h = max > 0 ? (v / max) * 100 : 0;
          return (
            <div key={dates[i] || i} className="flex-1 relative" style={{ height: '100%' }}>
              <div
                className={`absolute bottom-0 w-full rounded-t ${barColors[color]} opacity-70 transition-all`}
                style={{ height: `${Math.max(h, 4)}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

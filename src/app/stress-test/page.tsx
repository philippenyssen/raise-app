'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import {
  ShieldAlert, TrendingUp, TrendingDown, ArrowRight,
  RefreshCw, AlertTriangle, CheckCircle2, Target,
  Clock, ChevronDown, ChevronUp, Zap, ArrowUpRight,
  BarChart3,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InvestorForecast {
  id: string;
  name: string;
  tier: number;
  type: string;
  status: string;
  enthusiasm: number;
  momentum: string;
  checkSizeRange: string;
  expectedCheck: number;
  closeProbability: number;
  expectedValue: number;
  predictedCloseDate: string | null;
  bottleneck: string;
}

interface GapInvestor {
  id: string;
  name: string;
  tier: number;
  status: string;
  currentExpected: number;
  potentialExpected: number;
  intervention: string;
  timeCost: string;
  impactDelta: number;
}

interface RiskItem {
  description: string;
  probability: string;
  impact: string;
  mitigation: string;
}

interface MonteCarloData {
  p10: number;
  p50: number;
  p90: number;
  probOfTarget: number;
  runs: number;
}

interface CalibrationData {
  enabled: boolean;
  resolvedCount: number;
  adjustments: Record<string, number> | null;
  note: string;
}

interface StressTestData {
  target: number;
  targetCloseDate: string | null;
  companyName: string;
  healthStatus: 'green' | 'yellow' | 'red';
  healthMessage: string;
  forecast: { best: number; base: number; worst: number };
  shortfall: number | null;
  closeProbability: number;
  estimatedCloseDate: string | null;
  onTrack: boolean;
  investorForecasts: InvestorForecast[];
  gapInvestors: GapInvestor[];
  criticalPath: { minimumViableSet: string[]; totalIfAllClose: number };
  risks: RiskItem[];
  summary: {
    totalActive: number;
    totalPassed: number;
    avgCloseProbability: number;
    medianExpectedCheck: number;
  };
  monteCarlo?: MonteCarloData;
  calibration?: CalibrationData;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  identified: 'Identified', contacted: 'Contacted', nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Set', met: 'Met', engaged: 'Engaged',
  in_dd: 'In DD', term_sheet: 'Term Sheet', closed: 'Closed',
  passed: 'Passed', dropped: 'Dropped',
};

function formatEuro(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}Bn`;
  return `${Math.round(n)}M`;
}

function probColor(p: number): string {
  if (p >= 60) return 'text-green-400';
  if (p >= 30) return 'text-yellow-400';
  return 'text-red-400';
}

function probBg(p: number): string {
  if (p >= 60) return 'bg-green-500';
  if (p >= 30) return 'bg-yellow-500';
  return 'bg-red-500';
}

function tierBadge(tier: number): string {
  const colors: Record<number, string> = {
    1: 'text-amber-400 bg-amber-400/10 border-amber-700/30',
    2: 'text-blue-400 bg-blue-400/10 border-blue-700/30',
    3: 'text-zinc-400 bg-zinc-400/10 border-zinc-700/30',
    4: 'text-zinc-600 bg-zinc-600/10 border-zinc-700/30',
  };
  return colors[tier] ?? colors[3];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StressTestPage() {
  const { toast } = useToast();
  const [data, setData] = useState<StressTestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRisks, setExpandedRisks] = useState<number[]>([]);
  const [showAllInvestors, setShowAllInvestors] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch('/api/stress-test');
      if (res.ok) {
        setData(await res.json());
      } else {
        toast('Failed to load stress test data', 'error');
      }
    } catch {
      toast('Failed to load stress test data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse" />
        <div className="h-24 bg-zinc-800/50 rounded-xl animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-zinc-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-zinc-800/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold tracking-tight">Process Stress Test</h1>
        <div className="border border-red-800/30 bg-red-900/10 rounded-xl p-8 text-center space-y-3">
          <p className="text-zinc-400">Could not load stress test data.</p>
          <button onClick={() => fetchData()} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const visibleInvestors = showAllInvestors
    ? data.investorForecasts
    : data.investorForecasts.slice(0, 15);

  const bannerColors = {
    green: 'border-green-800/50 bg-green-900/10',
    yellow: 'border-yellow-800/50 bg-yellow-900/10',
    red: 'border-red-800/50 bg-red-900/10',
  };
  const bannerTextColors = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
  };
  const bannerIcon = {
    green: <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />,
    yellow: <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />,
    red: <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />,
  };

  return (
    <div className="space-y-6">
      {/* ================================================================ */}
      {/* HEADER                                                           */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Process Stress Test</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Probabilistic close forecast --- {data.companyName} Series C
          </p>
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
      {/* HEALTH BANNER                                                    */}
      {/* ================================================================ */}
      <div className={`border ${bannerColors[data.healthStatus]} rounded-xl p-5 flex items-start gap-4`}>
        {bannerIcon[data.healthStatus]}
        <div className="flex-1">
          <div className={`text-lg font-semibold ${bannerTextColors[data.healthStatus]}`}>
            {data.healthMessage}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-zinc-400">
            <span>Target: <strong className="text-white">EUR {formatEuro(data.target)}</strong></span>
            {data.targetCloseDate && (
              <span>Deadline: <strong className="text-white">{data.targetCloseDate}</strong></span>
            )}
            {data.estimatedCloseDate && (
              <span>Est. close: <strong className={data.onTrack ? 'text-green-400' : 'text-yellow-400'}>
                {data.estimatedCloseDate}
              </strong></span>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* FORECAST STRIP + CLOSE PROBABILITY                               */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Close Probability Gauge */}
        <div className="border border-zinc-800 rounded-xl p-5 flex flex-col items-center justify-center">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Close Probability</div>
          <div className={`text-5xl font-bold tabular-nums ${probColor(data.closeProbability)}`}>
            {data.closeProbability}%
          </div>
          <div className="text-xs text-zinc-500 mt-1">of hitting EUR {formatEuro(data.target)}</div>
          <div className="w-full h-2 bg-zinc-800 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${probBg(data.closeProbability)}`}
              style={{ width: `${Math.min(100, data.closeProbability)}%` }}
            />
          </div>
        </div>

        {/* Best Case */}
        <ForecastCard
          label="Best Case"
          sublabel="All engaged+ close"
          amount={data.forecast.best}
          target={data.target}
          color="green"
        />
        {/* Base Case */}
        <ForecastCard
          label="Base Case"
          sublabel="Expected value sum"
          amount={data.forecast.base}
          target={data.target}
          color={data.forecast.base >= data.target ? 'green' : 'yellow'}
        />
        {/* Worst Case */}
        <ForecastCard
          label="Worst Case"
          sublabel="Only term sheet+"
          amount={data.forecast.worst}
          target={data.target}
          color={data.forecast.worst >= data.target * 0.5 ? 'yellow' : 'red'}
        />
      </div>

      {/* ================================================================ */}
      {/* GAP ANALYSIS (if shortfall)                                      */}
      {/* ================================================================ */}
      {data.shortfall && data.shortfall > 0 && data.gapInvestors.length > 0 && (
        <div className="border-2 border-red-800/40 bg-red-900/5 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-red-400" />
            <h2 className="text-sm font-semibold text-red-400 uppercase">
              Gap Analysis --- EUR {formatEuro(data.shortfall)} Shortfall
            </h2>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Top investors to accelerate to close the gap:
          </p>
          <div className="space-y-2">
            {data.gapInvestors.slice(0, 5).map((gap, i) => (
              <div key={gap.id} className="flex items-start gap-3 py-3 px-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <span className="w-6 h-6 rounded bg-red-600/20 text-red-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/investors/${gap.id}`} className="text-sm font-medium hover:text-blue-400 transition-colors">
                      {gap.name}
                    </Link>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border ${tierBadge(gap.tier)}`}>
                      T{gap.tier}
                    </span>
                    <span className="text-[10px] text-zinc-500">{STATUS_LABELS[gap.status] || gap.status}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">{gap.intervention}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {gap.timeCost}</span>
                    <span>Current: EUR {Math.round(gap.currentExpected)}M</span>
                    <span className="text-green-400">+EUR {Math.round(gap.impactDelta)}M if accelerated</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-green-400 tabular-nums flex items-center gap-1">
                    <ArrowUpRight className="w-4 h-4" />
                    {Math.round(gap.impactDelta)}M
                  </div>
                  <div className="text-[10px] text-zinc-500">potential lift</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* INVESTOR PROBABILITY TABLE                                       */}
      {/* ================================================================ */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-400 uppercase flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Investor Probability Table
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] text-zinc-500">
              <span className="w-2 h-2 rounded-full bg-green-500" /> &gt;60%
              <span className="w-2 h-2 rounded-full bg-yellow-500 ml-2" /> 30-60%
              <span className="w-2 h-2 rounded-full bg-red-500 ml-2" /> &lt;30%
            </div>
            <span className="text-xs text-zinc-500">{data.investorForecasts.length} investors</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] text-zinc-500 uppercase border-b border-zinc-800">
                <th className="px-4 py-3">Investor</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-center">Enth.</th>
                <th className="px-3 py-3 text-center">Momentum</th>
                <th className="px-3 py-3 text-right">Check Range</th>
                <th className="px-3 py-3 text-right">Close Prob.</th>
                <th className="px-3 py-3 text-right">Exp. Value</th>
                <th className="px-3 py-3">Pred. Close</th>
                <th className="px-3 py-3">Bottleneck</th>
              </tr>
            </thead>
            <tbody>
              {visibleInvestors.map((f) => {
                const rowBorder = f.closeProbability >= 60
                  ? 'border-l-2 border-l-green-500'
                  : f.closeProbability >= 30
                  ? 'border-l-2 border-l-yellow-500'
                  : 'border-l-2 border-l-red-500';
                const MomentumIcon = f.momentum === 'accelerating' ? TrendingUp
                  : f.momentum === 'decelerating' ? TrendingDown
                  : null;
                const momentumColor = f.momentum === 'accelerating' ? 'text-green-400'
                  : f.momentum === 'decelerating' ? 'text-orange-400'
                  : f.momentum === 'stalled' ? 'text-red-400'
                  : 'text-zinc-500';

                return (
                  <tr key={f.id} className={`${rowBorder} border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link href={`/investors/${f.id}`} className="font-medium hover:text-blue-400 transition-colors truncate max-w-[180px]">
                          {f.name}
                        </Link>
                        <span className={`text-[9px] px-1 py-0.5 rounded border ${tierBadge(f.tier)}`}>
                          T{f.tier}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-zinc-400">{STATUS_LABELS[f.status] || f.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {f.enthusiasm > 0 ? (
                        <span className={`text-xs font-medium tabular-nums ${
                          f.enthusiasm >= 4 ? 'text-green-400' : f.enthusiasm >= 3 ? 'text-yellow-400' : 'text-red-400'
                        }`}>{f.enthusiasm}/5</span>
                      ) : (
                        <span className="text-xs text-zinc-600">--</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-xs flex items-center justify-center gap-1 ${momentumColor}`}>
                        {MomentumIcon && <MomentumIcon className="w-3 h-3" />}
                        {f.momentum}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-xs text-zinc-400 tabular-nums">{f.checkSizeRange || '--'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`text-sm font-bold tabular-nums ${probColor(f.closeProbability)}`}>
                        {f.closeProbability.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm font-semibold text-white tabular-nums">
                        {f.expectedValue > 0 ? `EUR ${f.expectedValue.toFixed(1)}M` : '--'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-zinc-400 tabular-nums">
                        {f.predictedCloseDate || '--'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-zinc-500 truncate max-w-[200px] block">
                        {f.bottleneck}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data.investorForecasts.length > 15 && (
          <div className="p-3 text-center border-t border-zinc-800">
            <button
              onClick={() => setShowAllInvestors(!showAllInvestors)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mx-auto"
            >
              {showAllInvestors ? (
                <>Show less <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>Show all {data.investorForecasts.length} investors <ChevronDown className="w-3 h-3" /></>
              )}
            </button>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/* RISK SCENARIOS + CRITICAL PATH                                   */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risks */}
        <div className="border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-zinc-400 uppercase flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4" /> Risk Scenarios
          </h2>
          {data.risks.length === 0 ? (
            <p className="text-sm text-zinc-600">No significant risks identified.</p>
          ) : (
            <div className="space-y-2">
              {data.risks.map((risk, i) => {
                const isExpanded = expandedRisks.includes(i);
                const probColor = risk.probability === 'High' ? 'text-red-400 bg-red-400/10 border-red-700/30'
                  : risk.probability === 'Medium' ? 'text-yellow-400 bg-yellow-400/10 border-yellow-700/30'
                  : 'text-zinc-400 bg-zinc-400/10 border-zinc-700/30';
                return (
                  <div key={i} className="border border-zinc-800 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedRisks(prev =>
                        prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                      )}
                      className="w-full flex items-start gap-3 p-3 hover:bg-zinc-800/30 transition-colors text-left"
                    >
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${probColor}`}>
                        {risk.probability}
                      </span>
                      <span className="text-sm text-zinc-300 flex-1">{risk.description}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-600 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-600 shrink-0" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2 border-t border-zinc-800/50 pt-2">
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase">Impact</span>
                          <p className="text-xs text-zinc-400 mt-0.5">{risk.impact}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-500 uppercase">Mitigation</span>
                          <p className="text-xs text-zinc-400 mt-0.5">{risk.mitigation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Critical Path */}
        <div className="border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-zinc-400 uppercase flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4" /> Critical Path
          </h2>
          <div className="mb-4">
            <div className="text-xs text-zinc-500 mb-2">
              Minimum viable set to reach EUR {formatEuro(data.target)} target:
            </div>
            {data.criticalPath.minimumViableSet.length === 0 ? (
              <p className="text-sm text-zinc-600">No investors with sufficient probability identified.</p>
            ) : (
              <div className="space-y-1.5">
                {data.criticalPath.minimumViableSet.map((name, i) => {
                  const investor = data.investorForecasts.find(f => f.name === name);
                  return (
                    <div key={i} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-zinc-800/30">
                      <span className="w-5 h-5 rounded bg-blue-600/20 text-blue-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm text-zinc-300 flex-1 truncate">{name}</span>
                      {investor && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs tabular-nums ${probColor(investor.closeProbability)}`}>
                            {investor.closeProbability.toFixed(0)}%
                          </span>
                          <span className="text-xs text-zinc-500 tabular-nums">
                            EUR {Math.round(investor.expectedCheck)}M
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-t border-zinc-800 pt-3 flex items-center justify-between">
            <span className="text-xs text-zinc-500">Total if all close:</span>
            <span className={`text-lg font-bold tabular-nums ${
              data.criticalPath.totalIfAllClose >= data.target ? 'text-green-400' : 'text-yellow-400'
            }`}>
              EUR {formatEuro(data.criticalPath.totalIfAllClose)}
            </span>
          </div>
          {data.criticalPath.totalIfAllClose < data.target && (
            <div className="mt-2 text-xs text-red-400 bg-red-900/10 border border-red-800/30 rounded-lg p-2.5">
              Even the minimum viable set falls short. Need to add more investors or increase check sizes.
            </div>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* SUMMARY BAR                                                      */}
      {/* ================================================================ */}
      <div className="border border-zinc-800 rounded-xl p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Active Investors" value={data.summary.totalActive} />
          <SummaryCard label="Avg Close Prob." value={`${data.summary.avgCloseProbability}%`} />
          <SummaryCard label="Passed/Dropped" value={data.summary.totalPassed} />
          <SummaryCard label="Median Check" value={data.summary.medianExpectedCheck > 0 ? `EUR ${Math.round(data.summary.medianExpectedCheck)}M` : '--'} />
        </div>
      </div>

      {/* ================================================================ */}
      {/* MONTE CARLO + CALIBRATION                                        */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monte Carlo Confidence Intervals */}
        {data.monteCarlo && (
          <div className="border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-zinc-400 uppercase flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4" /> Monte Carlo Simulation
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              {data.monteCarlo.runs.toLocaleString()} simulation runs of probabilistic close outcomes
            </p>

            {/* P10 / P50 / P90 bars */}
            <div className="space-y-3 mb-4">
              {[
                { label: 'P10 (Pessimistic)', value: data.monteCarlo.p10, color: 'bg-red-500' },
                { label: 'P50 (Median)', value: data.monteCarlo.p50, color: 'bg-yellow-500' },
                { label: 'P90 (Optimistic)', value: data.monteCarlo.p90, color: 'bg-green-500' },
              ].map(({ label, value, color }) => {
                const pct = data.target > 0 ? Math.min(100, (value / data.target) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-500">{label}</span>
                      <span className="text-sm font-semibold text-zinc-200 tabular-nums">
                        EUR {formatEuro(value)}
                      </span>
                    </div>
                    <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${color}`}
                        style={{ width: `${pct}%` }}
                      />
                      {/* Target marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white/40"
                        style={{ left: '100%' }}
                        title={`Target: EUR ${formatEuro(data.target)}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Probability of reaching target */}
            <div className="border-t border-zinc-800 pt-3 flex items-center justify-between">
              <span className="text-xs text-zinc-500">Probability of reaching EUR {formatEuro(data.target)}</span>
              <span className={`text-lg font-bold tabular-nums ${probColor(data.monteCarlo.probOfTarget)}`}>
                {data.monteCarlo.probOfTarget}%
              </span>
            </div>
          </div>
        )}

        {/* Calibration Status */}
        {data.calibration && (
          <div className="border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-zinc-400 uppercase flex items-center gap-2 mb-4">
              <Target className="w-4 h-4" /> Weight Calibration
            </h2>

            <div className="flex items-center gap-3 mb-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                data.calibration.enabled ? 'bg-green-900/30' : 'bg-zinc-800'
              }`}>
                {data.calibration.enabled ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-zinc-500" />
                )}
              </div>
              <div>
                <div className={`text-sm font-medium ${data.calibration.enabled ? 'text-green-400' : 'text-zinc-400'}`}>
                  {data.calibration.enabled ? 'Auto-Calibrated' : 'Hardcoded Weights'}
                </div>
                <div className="text-xs text-zinc-500">
                  {data.calibration.resolvedCount} resolved prediction{data.calibration.resolvedCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <p className="text-xs text-zinc-500 mb-4">{data.calibration.note}</p>

            {/* Per-status adjustments if calibrated */}
            {data.calibration.enabled && data.calibration.adjustments && (
              <div className="border-t border-zinc-800 pt-3">
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Status Adjustments</span>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(data.calibration.adjustments).map(([status, adj]) => (
                    <div key={status} className="flex items-center justify-between px-2 py-1.5 bg-zinc-800/30 rounded text-xs">
                      <span className="text-zinc-400">{status.replace(/_/g, ' ')}</span>
                      <span className={`font-mono tabular-nums ${
                        (adj as number) > 0 ? 'text-green-400' : (adj as number) < 0 ? 'text-red-400' : 'text-zinc-500'
                      }`}>
                        {(adj as number) > 0 ? '+' : ''}{((adj as number) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] text-zinc-600 py-2">
        Generated {new Date(data.generatedAt).toLocaleString()} --- Data-driven from live investor pipeline
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ForecastCard({ label, sublabel, amount, target, color }: {
  label: string;
  sublabel: string;
  amount: number;
  target: number;
  color: 'green' | 'yellow' | 'red';
}) {
  const pct = target > 0 ? Math.round((amount / target) * 100) : 0;
  const borderColor = { green: 'border-green-800/40', yellow: 'border-yellow-800/40', red: 'border-red-800/40' }[color];
  const bgColor = { green: 'bg-green-900/10', yellow: 'bg-yellow-900/10', red: 'bg-red-900/10' }[color];
  const valueColor = { green: 'text-green-400', yellow: 'text-yellow-400', red: 'text-red-400' }[color];

  return (
    <div className={`border ${borderColor} ${bgColor} rounded-xl p-5`}>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-xs text-zinc-600 mb-2">{sublabel}</div>
      <div className={`text-3xl font-bold tabular-nums ${valueColor}`}>
        EUR {formatEuro(amount)}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${probBg(pct)}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <span className="text-xs text-zinc-500 tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-xl font-bold text-zinc-200 tabular-nums mt-1">{value}</div>
    </div>
  );
}

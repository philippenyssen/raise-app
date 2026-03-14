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

function probColorStyle(p: number): React.CSSProperties {
  if (p >= 60) return { color: 'var(--text-secondary)' };
  if (p >= 30) return { color: 'var(--text-tertiary)' };
  return { color: 'var(--text-primary)' };
}

function probBgStyle(p: number): React.CSSProperties {
  if (p >= 60) return { background: 'var(--success)' };
  if (p >= 30) return { background: 'var(--warning)' };
  return { background: 'var(--danger)' };
}

function tierBadgeStyle(tier: number): React.CSSProperties {
  const styles: Record<number, React.CSSProperties> = {
    1: { color: 'var(--text-tertiary)', background: 'var(--warning-muted)', borderColor: 'rgba(138, 136, 128, 0.3)' },
    2: { color: 'var(--accent)', background: 'var(--accent-muted)', borderColor: 'var(--accent-muted)' },
    3: { color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.1)', borderColor: 'var(--border-subtle)' },
    4: { color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.1)', borderColor: 'var(--border-subtle)' },
  };
  return styles[tier] ?? styles[3];
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
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredRisk, setHoveredRisk] = useState<number | null>(null);
  const [hoveredGap, setHoveredGap] = useState<string | null>(null);
  const [hoveredCritical, setHoveredCritical] = useState<number | null>(null);
  const [refreshHover, setRefreshHover] = useState(false);
  const [retryHover, setRetryHover] = useState(false);
  const [showAllHover, setShowAllHover] = useState(false);

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
        <div className="h-8 w-64 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
        <div className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
          ))}
        </div>
        <div className="h-64 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-8">
        <h1 className="page-title">Process Stress Test</h1>
        <div className="rounded-xl p-8 text-center space-y-3" style={{ border: '1px solid var(--danger-muted)', background: 'var(--danger-muted)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Could not load stress test data.</p>
          <button
            onClick={() => fetchData()}
            onMouseEnter={() => setRetryHover(true)}
            onMouseLeave={() => setRetryHover(false)}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{
              background: retryHover ? 'var(--surface-3)' : 'var(--surface-2)',
              color: 'var(--text-secondary)',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const visibleInvestors = showAllInvestors
    ? data.investorForecasts
    : data.investorForecasts.slice(0, 15);

  const bannerStyles: Record<string, React.CSSProperties> = {
    green: { borderColor: 'rgba(27, 42, 74, 0.3)', background: 'var(--success-muted)' },
    yellow: { borderColor: 'rgba(138, 136, 128, 0.3)', background: 'var(--warning-muted)' },
    red: { borderColor: 'rgba(27, 42, 74, 0.10)', background: 'var(--danger-muted)' },
  };
  const bannerTextStyles: Record<string, React.CSSProperties> = {
    green: { color: 'var(--text-secondary)' },
    yellow: { color: 'var(--text-tertiary)' },
    red: { color: 'var(--text-primary)' },
  };
  const bannerIcon = {
    green: <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: 'var(--text-secondary)' }} />,
    yellow: <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />,
    red: <ShieldAlert className="w-5 h-5 shrink-0" style={{ color: 'var(--text-primary)' }} />,
  };

  return (
    <div className="space-y-6 page-content">
      {/* ================================================================ */}
      {/* HEADER                                                           */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Process Stress Test</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Probabilistic close forecast — {data.companyName} Series C
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          onMouseEnter={() => setRefreshHover(true)}
          onMouseLeave={() => setRefreshHover(false)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors disabled:opacity-50"
          style={{
            background: refreshHover && !refreshing ? 'var(--surface-3)' : 'var(--surface-2)',
            color: 'var(--text-secondary)',
          }}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ================================================================ */}
      {/* HEALTH BANNER                                                    */}
      {/* ================================================================ */}
      <div
        className="rounded-xl p-5 flex items-start gap-4"
        style={{ border: '1px solid', ...bannerStyles[data.healthStatus] }}
      >
        {bannerIcon[data.healthStatus]}
        <div className="flex-1">
          <div className="text-lg font-semibold" style={bannerTextStyles[data.healthStatus]}>
            {data.healthMessage}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <span>Target: <strong style={{ color: 'var(--text-primary)' }}>EUR {formatEuro(data.target)}</strong></span>
            {data.targetCloseDate && (
              <span>Deadline: <strong style={{ color: 'var(--text-primary)' }}>{data.targetCloseDate}</strong></span>
            )}
            {data.estimatedCloseDate && (
              <span>Est. close: <strong style={{ color: data.onTrack ? 'var(--success)' : 'var(--warning)' }}>
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
        <div className="card rounded-xl p-5 flex flex-col items-center justify-center">
          <div className=" tracking-wider" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Close Probability</div>
          <div className="text-5xl font-bold tabular-nums" style={{ ...probColorStyle(data.closeProbability), marginTop: '0.5rem' }}>
            {data.closeProbability}%
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>of hitting EUR {formatEuro(data.target)}</div>
          <div className="w-full h-2 rounded-full mt-3 overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ ...probBgStyle(data.closeProbability), width: `${Math.min(100, data.closeProbability)}%` }}
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
        <div
          className="rounded-xl p-5"
          style={{ border: '2px solid rgba(27, 42, 74, 0.08)', background: 'rgba(27, 42, 74, 0.08)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
            <h2 className="text-sm font-semibold " style={{ color: 'var(--text-primary)' }}>
              Gap Analysis — EUR {formatEuro(data.shortfall)} Shortfall
            </h2>
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Top investors to accelerate to close the gap:
          </p>
          <div className="space-y-2">
            {data.gapInvestors.slice(0, 5).map((gap, i) => (
              <div
                key={gap.id}
                className="flex items-start gap-3 py-3 px-4 rounded-lg"
                style={{
                  background: hoveredGap === gap.id ? 'var(--surface-2)' : 'var(--surface-1)',
                  border: '1px solid var(--border-subtle)',
                }}
                onMouseEnter={() => setHoveredGap(gap.id)}
                onMouseLeave={() => setHoveredGap(null)}
              >
                <span
                  className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  style={{ background: 'var(--danger-muted)', color: 'var(--text-primary)' }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/investors/${gap.id}`} className="text-sm font-medium transition-colors" style={{ color: 'var(--text-primary)' }}>
                      {gap.name}
                    </Link>
                    <span
                      className="px-1.5 py-0.5 rounded"
                      style={{ fontSize: '9px', border: '1px solid', ...tierBadgeStyle(gap.tier) }}
                    >
                      T{gap.tier}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{STATUS_LABELS[gap.status] || gap.status}</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{gap.intervention}</p>
                  <div className="flex items-center gap-3 mt-1.5" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {gap.timeCost}</span>
                    <span>Current: EUR {Math.round(gap.currentExpected)}M</span>
                    <span style={{ color: 'var(--text-secondary)' }}>+EUR {Math.round(gap.impactDelta)}M if accelerated</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold tabular-nums flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                    <ArrowUpRight className="w-4 h-4" />
                    {Math.round(gap.impactDelta)}M
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>potential lift</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* INVESTOR PROBABILITY TABLE                                       */}
      {/* ================================================================ */}
      <div className="card rounded-xl overflow-hidden" style={{ padding: 0 }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-medium  flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <TrendingUp className="w-4 h-4" /> Investor Probability Table
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--success)' }} /> &gt;60%
              <span className="w-2 h-2 rounded-full ml-2" style={{ background: 'var(--warning)' }} /> 30-60%
              <span className="w-2 h-2 rounded-full ml-2" style={{ background: 'var(--danger)' }} /> &lt;30%
            </div>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{data.investorForecasts.length} investors</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left " style={{ fontSize: '10px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
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
                const borderLeftColor = f.closeProbability >= 60
                  ? 'var(--success)'
                  : f.closeProbability >= 30
                  ? 'var(--warning)'
                  : 'var(--danger)';
                const MomentumIcon = f.momentum === 'accelerating' ? TrendingUp
                  : f.momentum === 'decelerating' ? TrendingDown
                  : null;
                const momentumStyle: React.CSSProperties = f.momentum === 'accelerating'
                  ? { color: 'var(--text-secondary)' }
                  : f.momentum === 'decelerating'
                  ? { color: 'var(--text-tertiary)' }
                  : f.momentum === 'stalled'
                  ? { color: 'var(--text-primary)' }
                  : { color: 'var(--text-muted)' };

                const enthStyle: React.CSSProperties = f.enthusiasm >= 4
                  ? { color: 'var(--text-secondary)' }
                  : f.enthusiasm >= 3
                  ? { color: 'var(--text-tertiary)' }
                  : { color: 'var(--text-primary)' };

                return (
                  <tr
                    key={f.id}
                    className="transition-colors"
                    style={{
                      borderLeft: `2px solid ${borderLeftColor}`,
                      borderBottom: '1px solid var(--border-subtle)',
                      background: hoveredRow === f.id ? 'var(--surface-2)' : 'transparent',
                    }}
                    onMouseEnter={() => setHoveredRow(f.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link href={`/investors/${f.id}`} className="font-medium transition-colors truncate max-w-[180px]" style={{ color: 'var(--text-primary)' }}>
                          {f.name}
                        </Link>
                        <span
                          className="px-1 py-0.5 rounded"
                          style={{ fontSize: '9px', border: '1px solid', ...tierBadgeStyle(f.tier) }}
                        >
                          T{f.tier}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{STATUS_LABELS[f.status] || f.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {f.enthusiasm > 0 ? (
                        <span className="text-xs font-medium tabular-nums" style={enthStyle}>{f.enthusiasm}/5</span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>--</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs flex items-center justify-center gap-1" style={momentumStyle}>
                        {MomentumIcon && <MomentumIcon className="w-3 h-3" />}
                        {f.momentum}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>{f.checkSizeRange || '--'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm font-bold tabular-nums" style={probColorStyle(f.closeProbability)}>
                        {f.closeProbability.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {f.expectedValue > 0 ? `EUR ${f.expectedValue.toFixed(1)}M` : '--'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {f.predictedCloseDate || '--'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs truncate max-w-[200px] block" style={{ color: 'var(--text-muted)' }}>
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
          <div className="p-3 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setShowAllInvestors(!showAllInvestors)}
              onMouseEnter={() => setShowAllHover(true)}
              onMouseLeave={() => setShowAllHover(false)}
              className="text-xs flex items-center gap-1 mx-auto"
              style={{ color: showAllHover ? 'var(--accent)' : 'var(--accent)' }}
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
        <div className="card">
          <h2 className="text-sm font-medium  flex items-center gap-2 mb-4" style={{ color: 'var(--text-secondary)' }}>
            <AlertTriangle className="w-4 h-4" /> Risk Scenarios
          </h2>
          {data.risks.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No significant risks identified.</p>
          ) : (
            <div className="space-y-2">
              {data.risks.map((risk, i) => {
                const isExpanded = expandedRisks.includes(i);
                const riskBadgeStyle: React.CSSProperties = risk.probability === 'High'
                  ? { color: 'var(--text-primary)', background: 'var(--danger-muted)', borderColor: 'rgba(27, 42, 74, 0.10)' }
                  : risk.probability === 'Medium'
                  ? { color: 'var(--text-tertiary)', background: 'var(--warning-muted)', borderColor: 'rgba(138, 136, 128, 0.3)' }
                  : { color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.1)', borderColor: 'var(--border-subtle)' };
                return (
                  <div key={i} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                    <button
                      onClick={() => setExpandedRisks(prev =>
                        prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                      )}
                      onMouseEnter={() => setHoveredRisk(i)}
                      onMouseLeave={() => setHoveredRisk(null)}
                      className="w-full flex items-start gap-3 p-3 transition-colors text-left"
                      style={{ background: hoveredRisk === i ? 'var(--surface-2)' : 'transparent' }}
                    >
                      <span
                        className="px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                        style={{ fontSize: '9px', border: '1px solid', ...riskBadgeStyle }}
                      >
                        {risk.probability}
                      </span>
                      <span className="text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>{risk.description}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <div>
                          <span className="" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Impact</span>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{risk.impact}</p>
                        </div>
                        <div>
                          <span className="" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Mitigation</span>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{risk.mitigation}</p>
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
        <div className="card">
          <h2 className="text-sm font-medium  flex items-center gap-2 mb-4" style={{ color: 'var(--text-secondary)' }}>
            <Zap className="w-4 h-4" /> Critical Path
          </h2>
          <div className="mb-4">
            <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              Minimum viable set to reach EUR {formatEuro(data.target)} target:
            </div>
            {data.criticalPath.minimumViableSet.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No investors with sufficient probability identified.</p>
            ) : (
              <div className="space-y-1.5">
                {data.criticalPath.minimumViableSet.map((name, i) => {
                  const investor = data.investorForecasts.find(f => f.name === name);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 py-1.5 px-3 rounded-lg"
                      style={{
                        background: hoveredCritical === i ? 'var(--surface-3)' : 'var(--surface-2)',
                      }}
                      onMouseEnter={() => setHoveredCritical(i)}
                      onMouseLeave={() => setHoveredCritical(null)}
                    >
                      <span
                        className="w-5 h-5 rounded flex items-center justify-center font-bold shrink-0"
                        style={{ fontSize: '10px', background: 'var(--accent-muted)', color: 'var(--accent)' }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{name}</span>
                      {investor && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs tabular-nums" style={probColorStyle(investor.closeProbability)}>
                            {investor.closeProbability.toFixed(0)}%
                          </span>
                          <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
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
          <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Total if all close:</span>
            <span
              className="text-lg font-bold tabular-nums"
              style={{ color: data.criticalPath.totalIfAllClose >= data.target ? 'var(--success)' : 'var(--warning)' }}
            >
              EUR {formatEuro(data.criticalPath.totalIfAllClose)}
            </span>
          </div>
          {data.criticalPath.totalIfAllClose < data.target && (
            <div className="mt-2 text-xs rounded-lg p-2.5" style={{ color: 'var(--text-primary)', background: 'var(--danger-muted)', border: '1px solid rgba(27, 42, 74, 0.10)' }}>
              Even the minimum viable set falls short. Need to add more investors or increase check sizes.
            </div>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* SUMMARY BAR                                                      */}
      {/* ================================================================ */}
      <div className="card">
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
          <div className="card">
            <h2 className="text-sm font-medium  flex items-center gap-2 mb-4" style={{ color: 'var(--text-secondary)' }}>
              <BarChart3 className="w-4 h-4" /> Monte Carlo Simulation
            </h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              {data.monteCarlo.runs.toLocaleString()} simulation runs of probabilistic close outcomes
            </p>

            {/* P10 / P50 / P90 bars */}
            <div className="space-y-3 mb-4">
              {[
                { label: 'P10 (Pessimistic)', value: data.monteCarlo.p10, bg: 'var(--danger)' },
                { label: 'P50 (Median)', value: data.monteCarlo.p50, bg: 'var(--warning)' },
                { label: 'P90 (Optimistic)', value: data.monteCarlo.p90, bg: 'var(--success)' },
              ].map(({ label, value, bg }) => {
                const pct = data.target > 0 ? Math.min(100, (value / data.target) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
                      <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        EUR {formatEuro(value)}
                      </span>
                    </div>
                    <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ background: bg, width: `${pct}%` }}
                      />
                      {/* Target marker */}
                      <div
                        className="absolute top-0 bottom-0"
                        style={{ left: '100%', width: '2px', background: 'rgba(228, 227, 224, 0.4)' }}
                        title={`Target: EUR ${formatEuro(data.target)}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Probability of reaching target */}
            <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Probability of reaching EUR {formatEuro(data.target)}</span>
              <span className="text-lg font-bold tabular-nums" style={probColorStyle(data.monteCarlo.probOfTarget)}>
                {data.monteCarlo.probOfTarget}%
              </span>
            </div>
          </div>
        )}

        {/* Calibration Status */}
        {data.calibration && (
          <div className="card">
            <h2 className="text-sm font-medium  flex items-center gap-2 mb-4" style={{ color: 'var(--text-secondary)' }}>
              <Target className="w-4 h-4" /> Weight Calibration
            </h2>

            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: data.calibration.enabled ? 'var(--success-muted)' : 'var(--surface-2)' }}
              >
                {data.calibration.enabled ? (
                  <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                ) : (
                  <AlertTriangle className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: data.calibration.enabled ? 'var(--success)' : 'var(--text-secondary)' }}>
                  {data.calibration.enabled ? 'Auto-Calibrated' : 'Hardcoded Weights'}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {data.calibration.resolvedCount} resolved prediction{data.calibration.resolvedCount !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{data.calibration.note}</p>

            {/* Per-status adjustments if calibrated */}
            {data.calibration.enabled && data.calibration.adjustments && (
              <div className="pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <span className=" tracking-wider" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Status Adjustments</span>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(data.calibration.adjustments).map(([status, adj]) => (
                    <div key={status} className="flex items-center justify-between px-2 py-1.5 rounded text-xs" style={{ background: 'var(--surface-2)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{status.replace(/_/g, ' ')}</span>
                      <span
                        className="font-mono tabular-nums"
                        style={{
                          color: (adj as number) > 0 ? 'var(--success)' : (adj as number) < 0 ? 'var(--danger)' : 'var(--text-muted)',
                        }}
                      >
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
      <div className="text-center py-2" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
        Generated {new Date(data.generatedAt).toLocaleString()} — Data-driven from live investor pipeline
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
  const colorMap: Record<string, { border: string; bg: string; value: string }> = {
    green: { border: 'rgba(27, 42, 74, 0.25)', bg: 'var(--success-muted)', value: 'var(--success)' },
    yellow: { border: 'rgba(138, 136, 128, 0.25)', bg: 'var(--warning-muted)', value: 'var(--warning)' },
    red: { border: 'rgba(27, 42, 74, 0.08)', bg: 'var(--danger-muted)', value: 'var(--danger)' },
  };
  const c = colorMap[color];

  return (
    <div
      className="rounded-xl p-5"
      style={{ border: `1px solid ${c.border}`, background: c.bg }}
    >
      <div className=" tracking-wider" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{sublabel}</div>
      <div className="text-3xl font-bold tabular-nums" style={{ color: c.value }}>
        EUR {formatEuro(amount)}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ ...probBgStyle(pct), width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{pct}%</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className=" tracking-wider" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-xl font-bold tabular-nums mt-1" style={{ color: 'var(--text-secondary)' }}>{value}</div>
    </div>
  );
}

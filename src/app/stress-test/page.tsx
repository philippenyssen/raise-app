'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import { fmtDateTime } from '@/lib/format';
import { relativeTime } from '@/lib/time';
import { STATUS_LABELS } from '@/lib/constants';
import { labelMuted10, stBorderTop, stSurface2, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary } from '@/lib/styles';
import {
  ShieldAlert, TrendingUp, TrendingDown,
  RefreshCw, AlertTriangle, CheckCircle2, Target,
  Clock, ChevronDown, ChevronUp, Zap, ArrowUpRight,
  BarChart3,
} from 'lucide-react';
import type { StressTestInvestorForecast as InvestorForecast, GapInvestor, RiskItem } from '@/lib/types';
import { cachedFetch } from '@/lib/cache';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MonteCarloData {
  p10: number;
  p50: number;
  p90: number;
  probOfTarget: number;
  runs: number;
}

interface CalibrationData { enabled: boolean; resolvedCount: number; adjustments: Record<string, number> | null; note: string; }

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

const BANNER_STYLES: Record<string, React.CSSProperties> = {
  green: { background: 'var(--success-muted)' },
  yellow: { background: 'var(--warning-muted)' },
  red: { background: 'var(--danger-muted)' },
};
const BANNER_TEXT_STYLES: Record<string, React.CSSProperties> = {
  green: { color: 'var(--text-secondary)' },
  yellow: { color: 'var(--text-tertiary)' },
  red: { color: 'var(--text-primary)' },
};

function momentumColor(momentum: string): string {
  if (momentum === 'accelerating') return 'var(--text-secondary)';
  if (momentum === 'decelerating') return 'var(--text-tertiary)';
  if (momentum === 'stalled') return 'var(--text-primary)';
  return 'var(--text-muted)';
}
function enthusiasmColor(enthusiasm: number): string {
  if (enthusiasm >= 4) return 'var(--text-secondary)';
  if (enthusiasm >= 3) return 'var(--text-tertiary)';
  return 'var(--text-primary)';
}

const cpRowBg = { background: 'var(--surface-2)' } as const;
const cpRankBadge = { fontSize: 'var(--font-size-xs)', background: 'var(--accent-muted)', color: 'var(--accent)' } as const;
const riskBadgeHigh: React.CSSProperties = { color: 'var(--text-primary)', background: 'var(--danger-muted)', borderColor: 'var(--accent-10)' };
const riskBadgeMedium: React.CSSProperties = { color: 'var(--text-tertiary)', background: 'var(--warning-muted)', borderColor: 'var(--warn-30)' };
const riskBadgeLow: React.CSSProperties = { color: 'var(--text-secondary)', background: 'var(--white-10)', borderColor: 'var(--border-subtle)' };

const TIER_STYLES: Record<number, React.CSSProperties> = {
  1: { color: 'var(--text-tertiary)', background: 'var(--warning-muted)', borderColor: 'var(--warn-30)' },
  2: { color: 'var(--accent)', background: 'var(--accent-muted)', borderColor: 'var(--accent-muted)' },
  3: { color: 'var(--text-secondary)', background: 'var(--white-10)', borderColor: 'var(--border-subtle)' },
  4: { color: 'var(--text-muted)', background: 'var(--white-10)', borderColor: 'var(--border-subtle)' },
};

function tierBadgeStyle(tier: number): React.CSSProperties {
  return TIER_STYLES[tier] ?? TIER_STYLES[3];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StressTestPage() {
  const { toast } = useToast();
  const [data, setData] = useState<StressTestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [expandedRisks, setExpandedRisks] = useState<number[]>([]);
  const [showAllInvestors, setShowAllInvestors] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await cachedFetch('/api/stress-test');
      if (res.ok) {
        setData(await res.json());
        setLoadedAt(new Date().toISOString());
      } else {
        toast('Couldn\'t load stress test data — try refreshing', 'error');
      }
    } catch (e) {
      console.warn('[STRESS_TEST]', e instanceof Error ? e.message : e);
      toast('Couldn\'t load stress test data — try refreshing', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { document.title = 'Raise | Stress Test'; }, []);
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchData(); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 page-content">
        <div className="skeleton" style={{ height: '28px', width: '250px' }} />
        <div className="skeleton" style={{ height: '96px', borderRadius: 'var(--radius-xl)' }} />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height: '100px', borderRadius: 'var(--radius-xl)' }} />
          ))}</div>
        <div className="skeleton" style={{ height: '250px', borderRadius: 'var(--radius-xl)' }} />
      </div>);
  }

  if (!data) {
    return (
      <div className="space-y-8">
        <h1 className="page-title">Process Stress Test</h1>
        <div className="rounded-xl p-8 text-center space-y-3" style={{ background: 'var(--danger-muted)' }}>
          <p style={stTextSecondary}>Could not load stress test data. If this persists, check Settings to verify your API credentials.</p>
          <button
            onClick={() => fetchData()}
            className="btn-surface px-4 py-2 rounded-lg text-sm"
            title="Retry loading stress test data"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            Retry</button></div>
      </div>);
  }

  const forecastByName = useMemo(() => {
    const m = new Map<string, typeof data.investorForecasts[0]>();
    for (const f of data.investorForecasts) m.set(f.name, f);
    return m;
  }, [data.investorForecasts]);

  const visibleInvestors = showAllInvestors
    ? data.investorForecasts
    : data.investorForecasts.slice(0, 15);

  const bannerIcon = {
    green: <CheckCircle2 className="w-5 h-5 shrink-0" style={stTextSecondary} />,
    yellow: <AlertTriangle className="w-5 h-5 shrink-0" style={stTextTertiary} />,
    red: <ShieldAlert className="w-5 h-5 shrink-0" style={stTextPrimary} />,};

  return (
    <div className="space-y-6 page-content">
      {/* ================================================================ */}
      {/* HEADER                                                           */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Process Stress Test</h1>
          <p className="text-sm mt-1" style={stTextMuted}>
            Probabilistic close forecast — {data.companyName} Series C
            {loadedAt && <> &middot; <span>{relativeTime(loadedAt)}</span></>}</p></div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="btn-surface flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs disabled:opacity-50"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}</button></div>

      {/* ================================================================ */}
      {/* HEALTH BANNER                                                    */}
      {/* ================================================================ */}
      <div
        className="rounded-xl p-5 flex items-start gap-4"
        style={BANNER_STYLES[data.healthStatus]}>
        {bannerIcon[data.healthStatus]}
        <div className="flex-1">
          <div className="text-lg font-normal" style={BANNER_TEXT_STYLES[data.healthStatus]}>
            {data.healthMessage}</div>
          <div className="flex items-center gap-4 mt-2 text-sm" style={stTextSecondary}>
            <span>Target: <strong style={stTextPrimary}>EUR {formatEuro(data.target)}</strong></span>
            {data.targetCloseDate && (
              <span>Deadline: <strong style={stTextPrimary}>{data.targetCloseDate}</strong></span>
            )}
            {data.estimatedCloseDate && (
              <span>Est. close: <strong style={{ color: data.onTrack ? 'var(--success)' : 'var(--warning)' }}>
                {data.estimatedCloseDate}
              </strong></span>
            )}</div></div></div>

      {/* ================================================================ */}
      {/* FORECAST STRIP + CLOSE PROBABILITY                               */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Close Probability Gauge */}
        <div className="card rounded-xl p-5 flex flex-col items-center justify-center">
          <div className=" tracking-wider" style={labelMuted10}>Close Probability</div>
          <div className="text-5xl font-normal tabular-nums" style={{ ...probColorStyle(data.closeProbability), marginTop: '0.5rem' }}>
            {data.closeProbability}%</div>
          <div className="text-xs mt-1" style={stTextMuted}>of hitting EUR {formatEuro(data.target)}</div>
          <div className="w-full h-2 rounded-full mt-3 overflow-hidden" style={stSurface2}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ ...probBgStyle(data.closeProbability), width: `${Math.min(100, data.closeProbability)}%` }} /></div></div>

        {/* Best Case */}
        <ForecastCard
          label="Best Case"
          sublabel="All engaged+ close"
          amount={data.forecast.best}
          target={data.target}
          color="green" />
        {/* Base Case */}
        <ForecastCard
          label="Base Case"
          sublabel="Expected value sum"
          amount={data.forecast.base}
          target={data.target}
          color={data.forecast.base >= data.target ? 'green' : 'yellow'} />
        {/* Worst Case */}
        <ForecastCard
          label="Worst Case"
          sublabel="Only term sheet+"
          amount={data.forecast.worst}
          target={data.target}
          color={data.forecast.worst >= data.target * 0.5 ? 'yellow' : 'red'} /></div>

      {/* ================================================================ */}
      {/* GAP ANALYSIS (if shortfall)                                      */}
      {/* ================================================================ */}
      {data.shortfall && data.shortfall > 0 && data.gapInvestors.length > 0 && (
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--accent-8)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5" style={stTextPrimary} />
            <h2 className="text-sm font-normal " style={stTextPrimary}>
              Gap Analysis — EUR {formatEuro(data.shortfall)} Shortfall</h2></div>
          <p className="text-sm mb-4" style={stTextSecondary}>
            Top investors to accelerate to close the gap:</p>
          <div className="space-y-2">
            {data.gapInvestors.slice(0, 5).map((gap, i) => (
              <div
                key={gap.id}
                className="hover-row flex items-start gap-3 py-3 px-4 rounded-lg"
                style={{ background: 'var(--surface-1)' }}>
                <span
                  className="w-6 h-6 rounded flex items-center justify-center text-xs font-normal shrink-0 mt-0.5"
                  style={{ background: 'var(--danger-muted)', color: 'var(--text-primary)' }}>
                  {i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/investors/${gap.id}`} className="text-sm font-normal transition-colors" style={stTextPrimary}>
                      {gap.name}</Link>
                    <span
                      className="px-1.5 py-0.5 rounded"
                      style={{ fontSize: 'var(--font-size-xs)', border: '1px solid', ...tierBadgeStyle(gap.tier) }}>
                      T{gap.tier}</span>
                    <span style={labelMuted10}>{STATUS_LABELS[gap.status] || gap.status}</span></div>
                  <p className="text-xs mt-1" style={stTextSecondary}>{gap.intervention}</p>
                  <div className="flex items-center gap-3 mt-1.5" style={labelMuted10}>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {gap.timeCost}</span>
                    <span>Current: EUR {Math.round(gap.currentExpected)}M</span>
                    <span style={stTextSecondary}>+EUR {Math.round(gap.impactDelta)}M if accelerated</span></div></div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-normal tabular-nums flex items-center gap-1" style={stTextSecondary}>
                    <ArrowUpRight className="w-4 h-4" />
                    {Math.round(gap.impactDelta)}M</div>
                  <div style={labelMuted10}>potential lift</div></div></div>
            ))}</div></div>
      )}

      {/* ================================================================ */}
      {/* INVESTOR PROBABILITY TABLE                                       */}
      {/* ================================================================ */}
      <div className="card rounded-xl overflow-hidden" style={{ padding: 0 }}>
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 className="text-sm font-normal flex items-center gap-2" style={stTextSecondary}>
            <TrendingUp className="w-4 h-4" /> Investor Probability Table</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2" style={labelMuted10}>
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--success)' }} /> &gt;60%
              <span className="w-2 h-2 rounded-full ml-2" style={{ background: 'var(--warning)' }} /> 30-60%
              <span className="w-2 h-2 rounded-full ml-2" style={{ background: 'var(--danger)' }} /> &lt;30%</div>
            <span className="text-xs" style={stTextMuted}>{data.investorForecasts.length} investors</span></div></div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left " style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th className="px-4 py-3">Investor</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-center">Enth.</th>
                <th className="px-3 py-3 text-center">Momentum</th>
                <th className="px-3 py-3 text-right">Check Range</th>
                <th className="px-3 py-3 text-right">Close Prob.</th>
                <th className="px-3 py-3 text-right">Exp. Value</th>
                <th className="px-3 py-3">Pred. Close</th>
                <th className="px-3 py-3">Bottleneck</th></tr></thead>
            <tbody>
              {visibleInvestors.map((f) => {
                const MomentumIcon = f.momentum === 'accelerating' ? TrendingUp
                  : f.momentum === 'decelerating' ? TrendingDown
                  : null;
                const mColor = momentumColor(f.momentum);
                const eColor = enthusiasmColor(f.enthusiasm);

                return (
                  <tr
                    key={f.id}
                    className="table-row">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Link href={`/investors/${f.id}`} className="font-normal transition-colors truncate max-w-[180px]" style={stTextPrimary}>
                          {f.name}</Link>
                        <span
                          className="px-1 py-0.5 rounded"
                          style={{ fontSize: 'var(--font-size-xs)', border: '1px solid', ...tierBadgeStyle(f.tier) }}>
                          T{f.tier}</span></div></td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs" style={stTextSecondary}>{STATUS_LABELS[f.status] || f.status}</span></td>
                    <td className="px-3 py-2.5 text-center">
                      {f.enthusiasm > 0 ? (
                        <span className="text-xs font-normal tabular-nums" style={{ color: eColor }}>{f.enthusiasm}/5</span>
                      ) : (
                        <span className="text-xs" style={stTextMuted}>--</span>
                      )}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs flex items-center justify-center gap-1" style={{ color: mColor }}>
                        {MomentumIcon && <MomentumIcon className="w-3 h-3" />}
                        {f.momentum}</span></td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-xs tabular-nums" style={stTextSecondary}>{f.checkSizeRange || '--'}</span></td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm font-normal tabular-nums" style={probColorStyle(f.closeProbability)}>
                        {f.closeProbability.toFixed(1)}%</span></td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm font-normal tabular-nums" style={stTextPrimary}>
                        {f.expectedValue > 0 ? `EUR ${f.expectedValue.toFixed(1)}M` : '--'}</span></td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs tabular-nums" style={stTextSecondary}>
                        {f.predictedCloseDate || '--'}</span></td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs truncate max-w-[200px] block" style={stTextMuted}>
                        {f.bottleneck}</span></td>
                  </tr>);
              })}</tbody></table></div>

        {data.investorForecasts.length > 15 && (
          <div className="p-3 text-center" style={stBorderTop}>
            <button
              onClick={() => setShowAllInvestors(!showAllInvestors)}
              className="text-xs flex items-center gap-1 mx-auto"
              style={{ color: 'var(--accent)' }}>
              {showAllInvestors ? (
                <>Show less <ChevronUp className="w-3 h-3" /></>
              ) : (
                <>Show all {data.investorForecasts.length} investors <ChevronDown className="w-3 h-3" /></>
              )}</button></div>
        )}</div>

      {/* ================================================================ */}
      {/* RISK SCENARIOS + CRITICAL PATH                                   */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risks */}
        <div className="card">
          <h2 className="text-sm font-normal flex items-center gap-2 mb-4" style={stTextSecondary}>
            <AlertTriangle className="w-4 h-4" /> Risk Scenarios</h2>
          {data.risks.length === 0 ? (
            <div className="text-center py-6">
              <AlertTriangle className="w-6 h-6 mx-auto mb-2" style={stTextMuted} />
              <p className="text-sm" style={stTextMuted}>No significant risks flagged. Keep monitoring as your pipeline evolves.</p></div>
          ) : (
            <div className="space-y-2">
              {data.risks.map((risk, i) => {
                const isExpanded = expandedRisks.includes(i);
                const riskBadgeStyle = risk.probability === 'High' ? riskBadgeHigh : risk.probability === 'Medium' ? riskBadgeMedium : riskBadgeLow;
                return (
                  <div key={i} className="rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedRisks(prev =>
                        prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                      )}
                      className="hover-row w-full flex items-start gap-3 p-3 text-left">
                      <span
                        className="px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                        style={{ fontSize: 'var(--font-size-xs)', border: '1px solid', ...riskBadgeStyle }}>
                        {risk.probability}</span>
                      <span className="text-sm flex-1" style={stTextSecondary}>{risk.description}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 shrink-0" style={stTextMuted} />
                      ) : (
                        <ChevronDown className="w-4 h-4 shrink-0" style={stTextMuted} />
                      )}</button>
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2 pt-2" style={stBorderTop}>
                        <div>
                          <span className="" style={labelMuted10}>Impact</span>
                          <p className="text-xs mt-0.5" style={stTextSecondary}>{risk.impact}</p></div>
                        <div>
                          <span className="" style={labelMuted10}>Mitigation</span>
                          <p className="text-xs mt-0.5" style={stTextSecondary}>{risk.mitigation}</p></div></div>
                    )}
                  </div>);
              })}</div>
          )}</div>

        {/* Critical Path */}
        <div className="card">
          <h2 className="text-sm font-normal flex items-center gap-2 mb-4" style={stTextSecondary}>
            <Zap className="w-4 h-4" /> Critical Path</h2>
          <div className="mb-4">
            <div className="text-xs mb-2" style={stTextMuted}>
              Investors who must close to reach the EUR {formatEuro(data.target)} target:</div>
            {data.criticalPath.minimumViableSet.length === 0 ? (
              <div className="text-center py-4">
                <Zap className="w-5 h-5 mx-auto mb-2" style={stTextMuted} />
                <p className="text-sm" style={stTextMuted}>Critical path requires more high-probability investors. Advance pipeline conversations or increase check sizes.</p></div>
            ) : (
              <div className="space-y-1.5">
                {data.criticalPath.minimumViableSet.map((name, i) => {
                  const investor = forecastByName.get(name);
                  return (
                    <div
                      key={i}
                      className="hover-row flex items-center gap-3 py-1.5 px-3 rounded-lg"
                      style={cpRowBg}>
                      <span
                        className="w-5 h-5 rounded flex items-center justify-center font-normal shrink-0"
                        style={cpRankBadge}>
                        {i + 1}</span>
                      <span className="text-sm flex-1 truncate" style={stTextSecondary}>{name}</span>
                      {investor && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs tabular-nums" style={probColorStyle(investor.closeProbability)}>
                            {investor.closeProbability.toFixed(0)}%</span>
                          <span className="text-xs tabular-nums" style={stTextMuted}>
                            EUR {Math.round(investor.expectedCheck)}M</span></div>
                      )}
                    </div>);
                })}</div>
            )}</div>
          <div className="pt-3 flex items-center justify-between" style={stBorderTop}>
            <span className="text-xs" style={stTextMuted}>Total if all close:</span>
            <span
              className="text-lg font-normal tabular-nums"
              style={{ color: data.criticalPath.totalIfAllClose >= data.target ? 'var(--success)' : 'var(--warning)' }}>
              EUR {formatEuro(data.criticalPath.totalIfAllClose)}</span></div>
          {data.criticalPath.totalIfAllClose < data.target && (
            <div className="mt-2 text-xs rounded-lg p-2.5" style={{ color: 'var(--text-primary)', background: 'var(--danger-muted)' }}>
              Even the minimum viable set falls short. Need to add more investors or increase check sizes.</div>
          )}</div></div>

      {/* ================================================================ */}
      {/* SUMMARY BAR                                                      */}
      {/* ================================================================ */}
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Active Investors" value={data.summary.totalActive} />
          <SummaryCard label="Avg Close Prob." value={`${data.summary.avgCloseProbability}%`} />
          <SummaryCard label="Passed/Dropped" value={data.summary.totalPassed} />
          <SummaryCard label="Median Check" value={data.summary.medianExpectedCheck > 0 ? `EUR ${Math.round(data.summary.medianExpectedCheck)}M` : '--'}
            /></div></div>

      {/* ================================================================ */}
      {/* MONTE CARLO + CALIBRATION                                        */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monte Carlo Confidence Intervals */}
        {data.monteCarlo && (
          <div className="card">
            <h2 className="text-sm font-normal flex items-center gap-2 mb-4" style={stTextSecondary}>
              <BarChart3 className="w-4 h-4" /> Monte Carlo Simulation</h2>
            <p className="text-xs mb-4" style={stTextMuted}>
              {data.monteCarlo.runs.toLocaleString()} simulation runs of probabilistic close outcomes</p>

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
                      <span className="text-xs" style={stTextMuted}>{label}</span>
                      <span className="text-sm font-normal tabular-nums" style={stTextSecondary}>
                        EUR {formatEuro(value)}</span></div>
                    <div className="relative h-3 rounded-full overflow-hidden" style={stSurface2}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ background: bg, width: `${pct}%` }} />
                      {/* Target marker */}
                      <div
                        className="absolute top-0 bottom-0"
                        style={{ left: '100%', width: '2px', background: 'var(--surface-muted)' }}
                        title={`Target: EUR ${formatEuro(data.target)}`} /></div>
                  </div>);
              })}</div>

            {/* Probability of reaching target */}
            <div className="pt-3 flex items-center justify-between" style={stBorderTop}>
              <span className="text-xs" style={stTextMuted}>Probability of reaching EUR {formatEuro(data.target)}</span>
              <span className="text-lg font-normal tabular-nums" style={probColorStyle(data.monteCarlo.probOfTarget)}>
                {data.monteCarlo.probOfTarget}%</span></div></div>
        )}

        {/* Calibration Status */}
        {data.calibration && (
          <div className="card">
            <h2 className="text-sm font-normal flex items-center gap-2 mb-4" style={stTextSecondary}>
              <Target className="w-4 h-4" /> Weight Calibration</h2>

            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: data.calibration.enabled ? 'var(--success-muted)' : 'var(--surface-2)' }}>
                {data.calibration.enabled ? (
                  <CheckCircle2 className="w-4 h-4" style={stTextSecondary} />
                ) : (
                  <AlertTriangle className="w-4 h-4" style={stTextMuted} />
                )}</div>
              <div>
                <div className="text-sm font-normal" style={{ color: data.calibration.enabled ? 'var(--success)' : 'var(--text-secondary)' }}>
                  {data.calibration.enabled ? 'Auto-Calibrated' : 'Hardcoded Weights'}</div>
                <div className="text-xs" style={stTextMuted}>
                  {data.calibration.resolvedCount} resolved prediction{data.calibration.resolvedCount !== 1 ? 's' : ''}</div>
              </div></div>

            <p className="text-xs mb-4" style={stTextMuted}>{data.calibration.note}</p>

            {/* Per-status adjustments if calibrated */}
            {data.calibration.enabled && data.calibration.adjustments && (
              <div className="pt-3" style={stBorderTop}>
                <span className=" tracking-wider" style={labelMuted10}>Status Adjustments</span>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {Object.entries(data.calibration.adjustments).map(([status, adj]) => (
                    <div key={status} className="flex items-center justify-between px-2 py-1.5 rounded text-xs" style={stSurface2}>
                      <span style={stTextSecondary}>{status.replace(/_/g, ' ')}</span>
                      <span
                        className="font-mono tabular-nums"
                        style={{ color: (adj as number) > 0 ? 'var(--success)' : (adj as number) < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {(adj as number) > 0 ? '+' : ''}{((adj as number) * 100).toFixed(1)}%</span></div>
                  ))}</div></div>
            )}</div>
        )}</div>

      {/* Footer */}
      <div className="text-center py-2" style={labelMuted10}>
        Generated {fmtDateTime(data.generatedAt)} — Data-driven from live investor pipeline</div>
    </div>);
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
    green: { border: 'var(--accent-25)', bg: 'var(--success-muted)', value: 'var(--success)' },
    yellow: { border: 'var(--warn-25)', bg: 'var(--warning-muted)', value: 'var(--warning)' },
    red: { border: 'var(--accent-8)', bg: 'var(--danger-muted)', value: 'var(--danger)' },};
  const c = colorMap[color];

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: c.bg }}>
      <div className=" tracking-wider" style={labelMuted10}>{label}</div>
      <div className="text-xs mb-2" style={stTextMuted}>{sublabel}</div>
      <div className="text-3xl font-normal tabular-nums" style={{ color: c.value }}>
        EUR {formatEuro(amount)}</div>
      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={stSurface2}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ ...probBgStyle(pct), width: `${Math.min(100, pct)}%` }} /></div>
        <span className="text-xs tabular-nums" style={stTextMuted}>{pct}%</span></div>
    </div>);
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className=" tracking-wider" style={labelMuted10}>{label}</div>
      <div className="text-xl font-normal tabular-nums mt-1" style={stTextSecondary}>{value}</div>
    </div>);
}

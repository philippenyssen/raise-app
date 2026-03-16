'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Flame, Gauge, AlertTriangle,
  TrendingUp, TrendingDown, Minus, RefreshCw, ArrowRight,
  Users, Filter, Download,
} from 'lucide-react';
import { cachedFetch } from '@/lib/cache';
import { MS_PER_DAY, MS_PER_MINUTE, relativeTime } from '@/lib/time';
import { STATUS_LABELS, TYPE_LABELS_SHORT as TYPE_LABELS } from '@/lib/constants';
import { labelMuted, skelRow, stAccent, stFontXs, stSurface0, stSurface1, stTextMuted, stTextSecondary } from '@/lib/styles';

// ── Types ─────────────────────────────────────────────────────────────

interface DealflowInvestor {
  id: string;
  name: string;
  type: string;
  tier: number;
  status: string;
  // Heat
  heat: 'hot' | 'warm' | 'cool' | 'cold' | 'frozen';
  heatScore: number;
  heatDrivers: string[];
  // Velocity
  velocityScore: number;
  daysInProcess: number;
  daysInStage: number;
  trackingStatus: 'on_track' | 'behind' | 'at_risk';
  bottleneck: string;
  projectedClose: string;
  // Momentum
  trend: 'up' | 'down' | 'flat';
  currentMomentum: number;
  previousMomentum: number;
  // Meta
  enthusiasm: number;
  lastMeeting: string | null;
  daysSinceLastMeeting: number;
  // Readiness
  readinessScore: number;
  readinessLevel: 'ready' | 'progressing' | 'stalled' | 'cold';
  blockingFactors: string[];
}

type SortKey = 'heat' | 'velocity' | 'momentum' | 'days' | 'name' | 'tier' | 'readiness';
type HeatFilter = 'all' | 'hot' | 'warm' | 'cool' | 'cold' | 'frozen';

// ── Config ────────────────────────────────────────────────────────────

const HEAT_CONFIG: Record<string, { bg: string; border: string; text: string; glow: string; label: string }> = {
  hot:    { bg: 'var(--accent-8)', border: 'var(--accent-15)',  text: 'var(--text-primary)', glow: 'none', label: 'Hot' },
  warm:   { bg: 'var(--accent-muted)',  border: 'var(--accent-12)',  text: 'var(--text-secondary)', glow: 'none', label: 'Warm' },
  cool:   { bg: 'var(--accent-5)', border: 'var(--accent-10)', text: 'var(--text-tertiary)', glow: 'none', label: 'Cool' },
  cold:   { bg: 'var(--accent-4)', border: 'var(--accent-8)', text: 'var(--text-muted)', glow: 'none', label: 'Cold' },
  frozen: { bg: 'var(--accent-3)', border: 'var(--accent-muted)', text: 'var(--text-muted)', glow: 'none', label: 'Frozen' },};


const HEAT_ORDER: Record<string, number> = { hot: 0, warm: 1, cool: 2, cold: 3, frozen: 4 };
const dfRowBase = { gridTemplateColumns: '2fr 80px 90px 80px 70px 60px 80px 1.5fr 80px', borderBottom: '1px solid var(--border-subtle)', textDecoration: 'none' } as const;
const dfNamePrimary = { color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' } as const;
const dfNameSub = { color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' } as const;
const dfVelBar = { background: 'var(--surface-3)' } as const;
const dfVelLabel = { color: 'var(--text-primary)', fontSize: 'var(--font-size-xs)', fontWeight: 400 } as const;
const dfTrendFontXs = { fontSize: 'var(--font-size-xs)' } as const;
const dfSummaryLabel = { color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' } as const;
const dfTrendUp = { ...dfTrendFontXs, color: 'var(--success)' } as const;
const dfTrendDown = { ...dfTrendFontXs, color: 'var(--danger)' } as const;
const dfTrendFlat = { ...dfTrendFontXs, color: 'var(--text-muted)' } as const;
const dfDaysNormal = { fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' } as const;
const dfDaysOverdue = { fontSize: 'var(--font-size-sm)', color: 'var(--danger)' } as const;
const dfLastMeetNormal = { fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' } as const;
const dfLastMeetStale = { fontSize: 'var(--font-size-xs)', color: 'var(--danger)' } as const;
const dfVelFill = { background: 'var(--text-primary)' } as const;
const dfHeaderSubtitle: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-0)' };
const dfExportBtnBase: React.CSSProperties = { background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' };
const dfRefreshBtn: React.CSSProperties = { background: 'var(--surface-2)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' };
const dfHeatLegendLabel = { color: 'var(--text-tertiary)' } as const;
const dfErrorAlert: React.CSSProperties = { background: 'var(--danger-muted)', border: '1px solid var(--danger)', color: 'var(--text-primary)' };
const dfLoadingText: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' };
const dfTableHeader: React.CSSProperties = { gridTemplateColumns: '2fr 80px 90px 80px 70px 60px 80px 1.5fr 80px', background: 'var(--surface-1)', borderBottom: '1px solid var(--border-subtle)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 400, letterSpacing: '0.01em' };
const dfTrackingDot = { background: 'var(--text-secondary)' } as const;
const dfBottleneckLink: React.CSSProperties = { color: 'var(--text-tertiary)', textDecoration: 'none' };
const dfEmptyStateText: React.CSSProperties = { color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' };
const dfClearFilterBtn: React.CSSProperties = { color: 'var(--accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' };
const dfFooterInfo: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' };

function heatBtnStyle(active: boolean): React.CSSProperties {
  return { background: active ? 'var(--surface-3)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', border: active ? '1px solid var(--border-default)' : '1px solid transparent' };
}
function sortBtnStyle(active: boolean): React.CSSProperties {
  return { background: active ? 'var(--accent-muted)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-muted)', border: active ? '1px solid var(--accent)' : '1px solid transparent' };
}

// ── Helpers ───────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <span style={stTextSecondary}><TrendingUp className="w-4 h-4" /></span>;
  if (trend === 'down') return <span style={stTextMuted}><TrendingDown className="w-4 h-4" /></span>;
  return <span style={stTextMuted}><Minus className="w-4 h-4" /></span>;
}

function relativeDate(d: string | null): string {
  if (!d) return 'Never';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / MS_PER_DAY);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

// ── Main Component ────────────────────────────────────────────────────

export default function DealflowPage() {
  const [investors, setInvestors] = useState<DealflowInvestor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('heat');
  const [heatFilter, setHeatFilter] = useState<HeatFilter>('all');
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const safeParse = async (url: string) => {
        const r = await cachedFetch(url);
        if (!r.ok) throw new Error(`${url}: ${r.status}`);
        return r.json();
      };
      const [velRes, heatRes, momRes, readyRes] = await Promise.allSettled([
        safeParse('/api/velocity'),
        safeParse('/api/deal-heat'),
        safeParse('/api/momentum'),
        safeParse('/api/readiness'),]);

      const unwrap = <T,>(r: PromiseSettledResult<T>, label: string): T | null => {
        if (r.status === 'fulfilled') return r.value;
        console.error(`[DEALFLOW] ${label}:`, r.reason instanceof Error ? r.reason.message : r.reason);
        return null;
      };
      const velData = unwrap(velRes, 'velocity');
      const heatData = unwrap(heatRes, 'deal-heat');
      const momData = unwrap(momRes, 'momentum');
      const readyData = unwrap(readyRes, 'readiness');

      // Build a map keyed by investor id/name
      const map = new Map<string, DealflowInvestor>();

      // Seed from velocity data (most complete investor list)
      if (velData?.investors) {
        for (const inv of velData.investors) {
          map.set(inv.investor_id, {
            id: inv.investor_id,
            name: inv.investor_name,
            type: inv.investor_type,
            tier: inv.investor_tier,
            status: inv.status,
            heat: 'cool',
            heatScore: 0,
            heatDrivers: [],
            velocityScore: inv.velocity_score ?? 0,
            daysInProcess: inv.days_in_process ?? 0,
            daysInStage: inv.days_in_current_stage ?? 0,
            trackingStatus: inv.tracking_status ?? 'on_track',
            bottleneck: inv.bottleneck ?? '',
            projectedClose: inv.projected_close_date ?? '',
            trend: 'flat',
            currentMomentum: 0,
            previousMomentum: 0,
            enthusiasm: inv.enthusiasm ?? 0,
            lastMeeting: null,
            daysSinceLastMeeting: inv.days_since_last_meeting ?? 999,
            readinessScore: 0,
            readinessLevel: 'cold',
            blockingFactors: [],});
        }}

      // Merge heat data
      if (heatData?.investors) {
        for (const inv of heatData.investors) {
          const existing = map.get(inv.id);
          if (existing) {
            existing.heat = inv.dealHeat?.label ?? 'cool';
            existing.heatScore = inv.dealHeat?.heat ?? 0;
            existing.heatDrivers = inv.dealHeat?.drivers ?? [];
            existing.lastMeeting = inv.lastMeeting;
          } else {
            map.set(inv.id, {
              id: inv.id,
              name: inv.name,
              type: inv.type,
              tier: inv.tier,
              status: inv.status,
              heat: inv.dealHeat?.label ?? 'cool',
              heatScore: inv.dealHeat?.heat ?? 0,
              heatDrivers: inv.dealHeat?.drivers ?? [],
              velocityScore: 0,
              daysInProcess: 0,
              daysInStage: 0,
              trackingStatus: 'on_track',
              bottleneck: '',
              projectedClose: '',
              trend: 'flat',
              currentMomentum: 0,
              previousMomentum: 0,
              enthusiasm: inv.enthusiasm ?? 0,
              lastMeeting: inv.lastMeeting,
              daysSinceLastMeeting: 999,
              readinessScore: 0,
              readinessLevel: 'cold',
              blockingFactors: [],});
          }}
      }

      // Merge momentum data
      if (momData?.matrix) {
        for (const inv of momData.matrix) {
          const existing = map.get(inv.investorId);
          if (existing && inv.weeklyScores?.length >= 2) {
            const scores = inv.weeklyScores;
            const current = scores[scores.length - 1]?.score ?? 0;
            const prev = scores[scores.length - 2]?.score ?? 0;
            existing.currentMomentum = current;
            existing.previousMomentum = prev;
            existing.trend = current > prev + 5 ? 'up' : current < prev - 5 ? 'down' : 'flat';
          }}
      }

      // Merge readiness data
      if (readyData?.investors) {
        for (const inv of readyData.investors) {
          const existing = map.get(inv.investorId);
          if (existing) {
            existing.readinessScore = inv.readinessScore ?? 0;
            existing.readinessLevel = inv.readinessLevel ?? 'cold';
            existing.blockingFactors = inv.blockingFactors ?? [];
          }}
      }

      setInvestors(Array.from(map.values()));
      setLoadedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn\'t load deal flow — check your connection and refresh');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { document.title = 'Raise | Dealflow'; }, []);
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const stop = () => { if (interval) { clearInterval(interval); interval = null; } };
    const start = () => { stop(); fetchData(); interval = setInterval(() => fetchData(), 5 * MS_PER_MINUTE); };
    const onVis = () => { if (document.hidden) stop(); else start(); };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { if (interval) clearInterval(interval); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'r') { e.preventDefault(); fetchData(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fetchData]);

  // Sort & filter (memoized to avoid re-computation on unrelated state changes)
  const filtered = useMemo(() => investors
    .filter(inv => heatFilter === 'all' || inv.heat === heatFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'heat': return HEAT_ORDER[a.heat] - HEAT_ORDER[b.heat];
        case 'velocity': return b.velocityScore - a.velocityScore;
        case 'momentum': return b.currentMomentum - a.currentMomentum;
        case 'days': return a.daysInProcess - b.daysInProcess;
        case 'name': return a.name.localeCompare(b.name);
        case 'tier': return a.tier - b.tier;
        case 'readiness': return b.readinessScore - a.readinessScore;
        default: return 0;
      }}), [investors, heatFilter, sortBy]);

  // Summary counts (memoized to avoid recomputing on filter/sort changes)
  const counts = useMemo(() => {
    const c = { hot: 0, warm: 0, cool: 0, cold: 0, frozen: 0, atRisk: 0, onTrack: 0 };
    for (const inv of investors) {
      c[inv.heat as keyof typeof c]++;
      if (inv.trackingStatus === 'at_risk') c.atRisk++;
      if (inv.trackingStatus === 'on_track') c.onTrack++;
    }
    return c;
  }, [investors]);

  const summaryStripItems = useMemo(() => [
    { label: 'Hot', count: counts.hot, color: HEAT_CONFIG.hot.text, icon: Flame },
    { label: 'Warm', count: counts.warm, color: HEAT_CONFIG.warm.text, icon: Flame },
    { label: 'Cool', count: counts.cool, color: HEAT_CONFIG.cool.text, icon: Flame },
    { label: 'Cold', count: counts.cold, color: HEAT_CONFIG.cold.text, icon: Flame },
    { label: 'Frozen', count: counts.frozen, color: HEAT_CONFIG.frozen.text, icon: Flame },
    { label: 'On Track', count: counts.onTrack, color: 'var(--text-secondary)', icon: Gauge },
    { label: 'At Risk', count: counts.atRisk, color: 'var(--text-primary)', icon: AlertTriangle },
  ], [counts]);

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="page-content p-6 max-w-[1400px] mx-auto" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Dealflow</h1>
          <p style={dfHeaderSubtitle}>
            Investor health: heat, velocity, and momentum in one view{loadedAt && <> &middot; <span style={stTextMuted}>{relativeTime(loadedAt)}</span></>}</p></div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const rows = [['Name','Type','Tier','Status','Heat','Velocity','Momentum','Days','Tracking','Bottleneck','Enthusiasm','Days Since Meeting','Last Meeting']];
              for (const inv of filtered) rows.push([inv.name, inv.type, String(inv.tier), inv.status, inv.heat, String(inv.velocityScore), String(inv.currentMomentum), String(inv.daysInProcess), inv.trackingStatus, inv.bottleneck, String(inv.enthusiasm), String(inv.daysSinceLastMeeting), inv.lastMeeting || '']);
              const blob = new Blob([rows.map(r => r.join('\t')).join('\n')], { type: 'text/tab-separated-values' });
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dealflow-${new Date().toISOString().split('T')[0]}.tsv`; a.click();
            }}
            disabled={loading || !filtered.length}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
            style={{ ...dfExportBtnBase, opacity: loading || !filtered.length ? 0.5 : 1 }}>
            <Download className="w-3.5 h-3.5" /> Export</button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={dfRefreshBtn}>
            <span style={stTextMuted}><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></span>
            Refresh</button></div></div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {summaryStripItems.map(({ label, count, color, icon: Icon }) => (
          <div
            key={label}
            className="rounded-lg p-3 text-center"
            style={stSurface1}>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span style={{ color }}><Icon className="w-3.5 h-3.5" /></span>
              <span style={dfSummaryLabel}>{label}</span></div>
            <div className="text-xl font-normal" style={{ color }}>{count}</div></div>
        ))}</div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
          <span><Filter className="w-3 h-3" /></span> Heat:</div>
        {(['all', 'hot', 'warm', 'cool', 'cold', 'frozen'] as HeatFilter[]).map(h => (
          <button
            key={h}
            onClick={() => setHeatFilter(h)}
            className="px-2.5 py-1 rounded-md text-xs"
            title={h === 'all' ? 'Show all investors' : h === 'hot' ? 'Recent meetings + high enthusiasm' : h === 'warm' ? 'Active engagement, moderate pace' : h === 'cool' ? 'Some contact but losing momentum' : h === 'cold' ? 'No recent activity' : 'No contact in 30+ days'}
            style={heatBtnStyle(heatFilter === h)}>
            {h === 'all' ? 'All' : h.charAt(0).toUpperCase() + h.slice(1)}</button>
        ))}
        <div style={{ marginLeft: 'auto' }} className="flex items-center gap-1.5">
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>Sort:</span>
          {(['heat', 'velocity', 'momentum', 'readiness', 'days', 'tier', 'name'] as SortKey[]).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className="px-2.5 py-1 rounded-md text-xs"
              style={sortBtnStyle(sortBy === s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}</div></div>

      {/* Heat Legend */}
      <div className="flex items-center gap-4 mb-4" style={labelMuted}>
        {[
          { label: 'Hot', desc: 'Recent meeting + high enthusiasm' },
          { label: 'Warm', desc: 'Active, moderate pace' },
          { label: 'Cool', desc: 'Losing momentum' },
          { label: 'Cold', desc: 'No recent activity' },
          { label: 'Frozen', desc: '30+ days silent' },
        ].map(({ label, desc }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: HEAT_CONFIG[label.toLowerCase()]?.border || 'var(--border-default)' }} />
            <span style={dfHeatLegendLabel}>{label}</span>
            <span>— {desc}</span></span>
        ))}</div>

      {/* Error state */}
      {error && (
        <div role="alert" className="rounded-lg p-4 mb-4 flex items-center justify-between" style={dfErrorAlert}>
          <span style={{ fontSize: 'var(--font-size-sm)' }}>{error}</span>
          <button onClick={() => fetchData()} className="btn btn-secondary btn-sm">Retry</button></div>
      )}

      {/* Loading state */}
      {loading && !investors.length && (
        <div className="space-y-3">
          <p style={dfLoadingText}>Loading investor health signals...</p>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={skelRow} />)}
        </div>
      )}

      {/* Investor Table */}
      {filtered.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={stSurface0}>
          {/* Header row */}
          <div
            className="grid gap-3 px-4 py-2.5"
            style={dfTableHeader}>
            <div>Investor</div>
            <div className="text-center">Heat</div>
            <div className="text-center">Velocity</div>
            <div className="text-center">Trend</div>
            <div className="text-center">Days</div>
            <div className="text-center">Track</div>
            <div className="text-center">Ready</div>
            <div>Bottleneck</div>
            <div className="text-center">Last Meet</div></div>

          {/* Data rows */}
          {filtered.map(inv => {
            const heatCfg = HEAT_CONFIG[inv.heat] || HEAT_CONFIG.cool;
            return (
              <Link
                key={inv.id}
                href={`/investors/${inv.id}`}
                className="table-row grid gap-3 px-4 py-3 items-center transition-colors"
                style={dfRowBase}>
                {/* Investor */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-normal"
                    style={{ background: heatCfg.bg, color: heatCfg.text, border: `1px solid ${heatCfg.border}` }}>
                    {inv.name.charAt(0)}</div>
                  <div className="min-w-0">
                    <div className="font-normal truncate" style={dfNamePrimary}>
                      {inv.name}</div>
                    <div style={dfNameSub}>
                      {TYPE_LABELS[inv.type] || inv.type} · T{inv.tier} · {STATUS_LABELS[inv.status] || inv.status}</div></div>
                </div>

                {/* Heat Badge */}
                <div className="flex justify-center">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-normal"
                    style={{ background: heatCfg.bg, color: heatCfg.text, border: `1px solid ${heatCfg.border}` }}>
                    {heatCfg.label}</span></div>

                {/* Velocity Score */}
                <div className="flex items-center justify-center gap-1.5">
                  <div
                    className="w-10 h-1.5 rounded-full overflow-hidden"
                    style={dfVelBar}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(inv.velocityScore, 100)}%`, ...dfVelFill }} /></div>
                  <span style={dfVelLabel}>
                    {inv.velocityScore}</span></div>

                {/* Momentum Trend */}
                <div className="flex items-center justify-center gap-1">
                  <TrendIcon trend={inv.trend} />
                  <span style={inv.trend === 'up' ? dfTrendUp : inv.trend === 'down' ? dfTrendDown : dfTrendFlat}>
                    {inv.currentMomentum > 0 ? inv.currentMomentum.toFixed(0) : '—'}</span></div>

                {/* Days in Process */}
                <div className="text-center" style={inv.daysInProcess > 45 ? dfDaysOverdue : dfDaysNormal}>
                  {inv.daysInProcess > 0 ? `${inv.daysInProcess}d` : '—'}</div>

                {/* Tracking Status */}
                <div className="flex justify-center">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={dfTrackingDot}
                    title={inv.trackingStatus.replace('_', ' ')} /></div>

                {/* Readiness */}
                <div className="flex items-center justify-center gap-1" title={inv.blockingFactors.length > 0 ? `Blockers: ${inv.blockingFactors.join(', ')}` : 'No blockers identified'}>
                  <span className="tabular-nums" style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 400,
                    color: inv.readinessScore >= 70 ? 'var(--success)' : inv.readinessScore >= 45 ? 'var(--warning)' : 'var(--text-muted)',
                  }}>{inv.readinessScore}</span>
                </div>

                {/* Bottleneck */}
                <div className="truncate" style={stFontXs} onClick={e => e.preventDefault()}>
                  {inv.bottleneck ? (
                    <Link
                      href={
                        /meeting|call|schedule/i.test(inv.bottleneck) ? `/meetings/new?investor=${inv.id}` :
                        /follow.?up|outreach|nudge/i.test(inv.bottleneck) ? `/followups?investor=${inv.id}` :
                        /doc|data.?room|material/i.test(inv.bottleneck) ? `/data-room` :
                        /objection|concern|pushback/i.test(inv.bottleneck) ? `/objections` :
                        `/investors/${inv.id}`
                      }
                      className="inline-flex items-center gap-1 transition-colors hover-text-warning"
                      style={dfBottleneckLink}>
                      <span className="truncate">{inv.bottleneck}</span>
                      <ArrowRight className="w-3 h-3 shrink-0" style={{ opacity: 0.7 }} /></Link>
                  ) : (
                    <span style={stTextMuted}>—</span>
                  )}</div>

                {/* Last Meeting */}
                <div className="text-center" style={inv.daysSinceLastMeeting > 14 ? dfLastMeetStale : dfLastMeetNormal}>
                  {relativeDate(inv.lastMeeting)}</div>
              </Link>);
          })}</div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16" style={stTextMuted}>
          <Users className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm font-normal" style={dfEmptyStateText}>
            {heatFilter !== 'all' ? `No investors in the "${heatFilter}" category right now` : 'No investor activity to display yet'}</p>
          <p className="text-xs" style={stTextMuted}>
            {heatFilter !== 'all' ? (
              <button
                onClick={() => setHeatFilter('all')}
                style={dfClearFilterBtn}>
                Clear filter to see all {investors.length} investors</button>
            ) : (
              <>Heat scores are generated automatically after meetings. <Link href="/meetings/new" style={stAccent}>Log your first meeting</Link></>
            )}</p></div>
      )}

      {/* Footer info */}
      {investors.length > 0 && (
        <div className="flex items-center justify-between mt-4" style={dfFooterInfo}>
          <span>{filtered.length} of {investors.length} investors</span>
          <span>Combines heat, velocity, and momentum data</span></div>
      )}
    </div>);
}

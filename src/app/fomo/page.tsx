'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { cachedFetch } from '@/lib/cache';
import Link from 'next/link';
import {
  Zap, RefreshCw, AlertTriangle, TrendingUp, Users,
  ArrowRight, Clock, Activity, Target, Flame,
} from 'lucide-react';
import { getIntensityColor, inlineBadgeStyle, labelMuted, stAccent, stFontSm, stFontXs, stTextPrimary } from '@/lib/styles';
import { TierBadge, EnthusiasmDots } from '@/components/shared';
import { MS_PER_HOUR } from '@/lib/time';
import { TYPE_LABELS_SHORT as TYPE_LABELS } from '@/lib/constants';
import { fmtDateTime } from '@/lib/format';

const cardSurface1 = { padding: 'var(--space-4)', background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)' } as const;
const textXlLight = { fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)' } as const;
const sectionHeading = { fontSize: 'var(--font-size-base)', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 var(--space-3) 0' } as const;
const filterTabBase: React.CSSProperties = { padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 400, border: 'none', cursor: 'pointer' };
const triggerBadge = { fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text-secondary)' } as const;
const targetBadge: React.CSSProperties = { ...stFontXs, padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text-tertiary)' };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TriggerInvestor { name: string; status: string; statusLabel: string; }

interface InvestorFomo {
  investorId: string;
  investorName: string;
  tier: number;
  type: string;
  status: string;
  statusLabel: string;
  enthusiasm: number;
  intensity: number;
  advancingScore: number;
  densityScore: number;
  connectionScore: number;
  triggerInvestors: TriggerInvestor[];
  connectedAdvancingCount: number;
  peerMeetingDensity: number;
  recommendation: string;
}

interface TriggerEvent {
  type: 'status_change' | 'meeting_cluster' | 'commitment_signal';
  investorName: string;
  detail: string;
  date: string;
  impactLevel: 'high' | 'medium' | 'low';
}

interface StrategyCard { title: string; description: string; priority: 'high' | 'medium' | 'low'; targetInvestors: string[]; }

interface FomoData {
  overallIntensity: number;
  overallDescription: string;
  perInvestorFomo: InvestorFomo[];
  triggerEvents: TriggerEvent[];
  strategyCards: StrategyCard[];
  meetingDensity: {
    densityScore: number;
    avgPerWeek: number;
    currentWeekCount: number;
    gapWeeks: number;
    insight: string;
  };
  stats: {
    totalInvestors: number;
    advancingCount: number;
    recentMeetingCount: number;
    highFomoCount: number;
    mediumFomoCount: number;
    lowFomoCount: number;
    zeroFomoCount: number;
  };
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------


const TYPE_STYLES: Record<string, React.CSSProperties> = {
  vc: { background: 'var(--accent-muted)', color: 'var(--accent)' },
  growth: { background: 'var(--cat-purple-muted)', color: 'var(--chart-4)' },
  sovereign: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  strategic: { background: 'var(--cat-teal-muted)', color: 'var(--cat-teal)' },
  debt: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
  family_office: { background: 'var(--fg-6)', color: 'var(--text-primary)' },};

const IMPACT_STYLES: Record<string, React.CSSProperties> = {
  high: { background: 'var(--danger-muted)', color: 'var(--text-primary)' },
  medium: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  low: { background: 'var(--surface-2)', color: 'var(--text-tertiary)' },};

const PRIORITY_STYLES: Record<string, React.CSSProperties> = {
  high: {},
  medium: {},
  low: {},};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getIntensityLabel(intensity: number): string {
  if (intensity >= 70) return 'High';
  if (intensity >= 40) return 'Medium';
  if (intensity > 0) return 'Low';
  return 'None';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffHrs = Math.floor(diffMs / MS_PER_HOUR);
  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}


// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function IntensityMeter({ intensity, description }: { intensity: number; description: string }) {
  const color = getIntensityColor(intensity);
  const label = getIntensityLabel(intensity);

  return (
    <div
      className="card"
      style={{ padding: 'var(--space-6)', background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)' }}>
      <div className="flex items-center gap-3 mb-4">
        <span className="flex items-center justify-center" style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)' }}>
          <Zap className="w-5 h-5" style={{ color }} /></span>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 400, color: 'var(--text-primary)', margin: 0 }}>Pipeline FOMO Level</h2>
          <p style={{ ...labelMuted, margin: 0 }}>Competitive pressure across active investors</p></div></div>

      <div className="flex items-end gap-4 mb-3">
        <span style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 300, color, lineHeight: 1 }}>{intensity}</span>
        <span style={{ ...stFontSm, color, fontWeight: 400, paddingBottom: '4px' }}>/ 100 — {label}</span></div>

      {/* Bar */}
      <div
        style={{
          width: '100%', height: '8px',
          background: 'var(--surface-2)',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: 'var(--space-3)', }}>
        <div
          style={{
            width: `${intensity}%`, height: '100%',
            background: color,
            borderRadius: '4px',
            transition: 'width 0.6s ease-out',
          }} /></div>

      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
        {description}</p>
    </div>);
}

function StatsRow({ stats, meetingDensity }: { stats: FomoData['stats']; meetingDensity: FomoData['meetingDensity'] }) {
  const items = [
    { label: 'Advancing (14d)', value: stats.advancingCount, icon: TrendingUp, color: 'var(--text-secondary)' },
    { label: 'Recent Meetings', value: stats.recentMeetingCount, icon: Activity, color: 'var(--accent)' },
    { label: 'High FOMO', value: stats.highFomoCount, icon: Flame, color: 'var(--text-primary)' },
    { label: 'Meetings/Week', value: meetingDensity.avgPerWeek, icon: Clock, color: 'var(--text-tertiary)' },];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            style={cardSurface1}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
              <span style={labelMuted}>{item.label}</span></div>
            <span style={textXlLight}>{item.value}</span>
          </div>);
      })}
    </div>);
}

function PressureCard({ inv }: { inv: InvestorFomo }) {
  const [expanded, setExpanded] = useState(false);
  const color = getIntensityColor(inv.intensity);

  return (
    <div
      className="transition-colors hover-row"
      style={{ padding: 'var(--space-4)', background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)', transition: 'all 150ms ease', cursor: 'pointer' }}
      onClick={() => setExpanded(!expanded)}>
      {/* Header row */}
      <div className="flex items-center gap-3">
        {/* Intensity bar */}
        <div style={{ width: '4px', height: '40px', borderRadius: '2px', background: color, flexShrink: 0 }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/investors/${inv.investorId}`}
              className="investor-link"
              style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400 }}
              onClick={e => e.stopPropagation()}>
              {inv.investorName}</Link>
            <TierBadge tier={inv.tier} />
            <span style={inlineBadgeStyle(TYPE_STYLES[inv.type] ?? TYPE_STYLES.vc)}>
              {TYPE_LABELS[inv.type] ?? inv.type}</span>
            <span style={inlineBadgeStyle({
              background: 'var(--surface-2)',
              color: 'var(--text-tertiary)',
            })}>
              {inv.statusLabel}</span></div>
          <div className="flex items-center gap-3 mt-1">
            <EnthusiasmDots value={inv.enthusiasm} />
            {inv.triggerInvestors.length > 0 && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {inv.triggerInvestors.length} trigger{inv.triggerInvestors.length !== 1 ? 's' : ''}</span>
            )}</div></div>

        {/* Intensity score */}
        <div className="shrink-0 text-right">
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 300, color, lineHeight: 1 }}>
            {inv.intensity}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
            {getIntensityLabel(inv.intensity)}</div></div></div>

      {/* Intensity breakdown bar */}
      <div className="flex gap-0.5 mt-3" style={{ height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${inv.advancingScore}%`, background: 'var(--danger)', borderRadius: '2px 0 0 2px' }} title={`Advancing peers: ${inv.advancingScore}`}
          />
        <div style={{ width: `${inv.densityScore}%`, background: 'var(--warning)' }} title={`Meeting density: ${inv.densityScore}`}
          />
        <div style={{ width: `${inv.connectionScore}%`, background: 'var(--accent)', borderRadius: '0 2px 2px 0' }} title={`Network connections: ${inv.connectionScore}`}
          />
        <div style={{ flex: 1, background: 'var(--surface-3)' }} /></div>
      <div className="flex gap-4 mt-1">
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>Advancing {inv.advancingScore}</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Density {inv.densityScore}</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>Network {inv.connectionScore}</span></div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
          {/* Trigger investors */}
          {inv.triggerInvestors.length > 0 && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <span style={{ ...labelMuted, fontWeight: 400, letterSpacing: '0.01em' }}>Creating pressure</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {inv.triggerInvestors.map(t => (
                  <span
                    key={t.name}
                    style={triggerBadge}>
                    {t.name}
                    <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
                      {t.statusLabel}</span></span>
                ))}</div></div>
          )}

          {/* Recommendation */}
          <div style={{ padding: 'var(--space-3)', background: 'var(--surface-0)', borderRadius: 'var(--radius-md)' }}>
            <div className="flex items-start gap-2">
              <span style={{ flexShrink: 0, marginTop: '2px' }}>
                <Target className="w-3.5 h-3.5" style={stAccent} /></span>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {inv.recommendation}</p></div></div></div>
      )}
    </div>);
}

function TriggerEventCard({ event }: { event: TriggerEvent }) {
  const iconMap: Record<string, typeof Zap> = {
    status_change: ArrowRight,
    meeting_cluster: Users,
    commitment_signal: TrendingUp,};
  const Icon = iconMap[event.type] ?? Zap;

  return (
    <div
      className="transition-colors hover-row"
      style={{ padding: 'var(--space-3)', background: 'var(--surface-1)', borderRadius: 'var(--radius-md)', transition: 'all 150ms ease' }}>
      <div className="flex items-start gap-3">
        <span className="flex items-center justify-center shrink-0" style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', ...(IMPACT_STYLES[event.impactLevel] ?? IMPACT_STYLES.low) }}>
          <Icon className="w-3.5 h-3.5" /></span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span style={{ ...stFontSm, fontWeight: 400, color: 'var(--text-primary)' }}>{event.investorName}</span>
            <span style={inlineBadgeStyle(IMPACT_STYLES[event.impactLevel] ?? IMPACT_STYLES.low)}>
              {event.impactLevel}</span></div>
          <p style={{ ...stFontXs, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{event.detail}</p></div>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
          {formatDate(event.date)}</span></div>
    </div>);
}

function StrategyCardComponent({ card }: { card: StrategyCard }) {
  return (
    <div
      className="transition-colors hover-row"
      style={{
        padding: 'var(--space-4)',
        background: 'var(--surface-1)',
        borderRadius: 'var(--radius-lg)',
        transition: 'all 150ms ease',
        ...PRIORITY_STYLES[card.priority], }}>
      <div className="flex items-start gap-2 mb-2">
        <span style={{ flexShrink: 0, marginTop: '2px' }}>
          <Target className="w-4 h-4" style={{ color: card.priority === 'high' ? 'var(--danger)' : card.priority === 'medium' ? 'var(--warning)' : 'var(--text-muted)' }}
            /></span>
        <div>
          <h4 style={{ ...stFontSm, fontWeight: 400, color: 'var(--text-primary)', margin: 0 }}>{card.title}</h4>
          <span style={inlineBadgeStyle({
            background: card.priority === 'high' ? 'var(--danger-muted)' : card.priority === 'medium' ? 'var(--warning-muted)' : 'var(--surface-2)',
            color: card.priority === 'high' ? 'var(--danger)' : card.priority === 'medium' ? 'var(--warning)' : 'var(--text-tertiary)',
            marginTop: '4px',
            display: 'inline-block',
          })}>
            {card.priority} priority</span></div></div>

      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 var(--space-3) 0' }}>
        {card.description}</p>

      {card.targetInvestors.length > 0 && (
        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', letterSpacing: '0.01em' }}>Target</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {card.targetInvestors.map(name => (
              <span key={name} style={targetBadge}>{name}</span>
            ))}</div></div>
      )}
    </div>);
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function FomoPage() {
  const [data, setData] = useState<FomoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterIntensity, setFilterIntensity] = useState<'all' | 'high' | 'medium' | 'low' | 'none'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await cachedFetch('/api/fomo');
      if (!res.ok) throw new Error('Couldn\'t load FOMO data — try refreshing the page');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn\'t load data — try refreshing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { document.title = 'Raise | Pipeline FOMO'; }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchData(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="space-y-6 page-content">
        <div className="skeleton" style={{ height: '28px', width: '220px' }} />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Analyzing competitive pressure dynamics...</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-xl)' }} />)}
        </div>
        <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-xl)' }} />
      </div>);
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="w-6 h-6" style={stTextPrimary} />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>{error}</span>
          <button
            className="btn btn-secondary btn-md"
            onClick={fetchData}>
            Retry</button></div>
      </div>);
  }

  if (!data) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div className="loading-spinner" />
    </div>);

  const filteredInvestors = useMemo(() => data.perInvestorFomo.filter(inv => {
    if (filterIntensity === 'all') return true;
    if (filterIntensity === 'high') return inv.intensity >= 70;
    if (filterIntensity === 'medium') return inv.intensity >= 40 && inv.intensity < 70;
    if (filterIntensity === 'low') return inv.intensity > 0 && inv.intensity < 40;
    if (filterIntensity === 'none') return inv.intensity === 0;
    return true;
  }), [data.perInvestorFomo, filterIntensity]);

  const filterTabs = useMemo((): { key: typeof filterIntensity; label: string; count: number }[] => [
    { key: 'all', label: 'All', count: data.perInvestorFomo.length },
    { key: 'high', label: 'High', count: data.stats.highFomoCount },
    { key: 'medium', label: 'Medium', count: data.stats.mediumFomoCount },
    { key: 'low', label: 'Low', count: data.stats.lowFomoCount },
    { key: 'none', label: 'None', count: data.stats.zeroFomoCount },
  ], [data.perInvestorFomo.length, data.stats.highFomoCount, data.stats.mediumFomoCount, data.stats.lowFomoCount, data.stats.zeroFomoCount]);

  return (
    <div className="flex-1 overflow-y-auto page-content" style={{ padding: 'var(--space-6)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">FOMO Dynamics</h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: '4px' }}>
              Competitive pressure between investors — leverage asymmetry to accelerate the process</p></div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 transition-colors btn-surface"
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 400,
              background: 'var(--surface-1)',
              color: 'var(--text-secondary)',
              cursor: 'pointer', }}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh</button></div>

        {/* Overall intensity meter + stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2">
            <IntensityMeter intensity={data.overallIntensity} description={data.overallDescription} /></div>
          <div className="flex flex-col gap-3">
            <StatsRow stats={data.stats} meetingDensity={data.meetingDensity} /></div></div>

        {/* Two-column layout: Pressure Map + right column */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pressure Map (main column) */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 400, color: 'var(--text-primary)', margin: 0 }}>
                Pressure Map</h2>
              <div className="flex gap-1">
                {filterTabs.map(tab => (
                  <button
                    key={tab.key}
                    className={filterIntensity !== tab.key ? 'hover-filter-tab' : ''}
                    onClick={() => setFilterIntensity(tab.key)}
                    style={{ ...filterTabBase, background: filterIntensity === tab.key ? 'var(--surface-3)' : 'transparent', color: filterIntensity === tab.key ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {tab.label} ({tab.count})</button>
                ))}</div></div>

            <div className="flex flex-col gap-2">
              {filteredInvestors.length === 0 ? (
                <div
                  style={{
                    padding: 'var(--space-8)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--font-size-sm)', }}>
                  No investors match this filter.</div>
              ) : (
                filteredInvestors.map(inv => (
                  <PressureCard key={inv.investorId} inv={inv} />
                ))
              )}</div></div>

          {/* Right column: Triggers + Strategy */}
          <div className="flex flex-col gap-6">
            {/* FOMO Triggers */}
            <div>
              <h2 style={sectionHeading}>
                FOMO Triggers</h2>
              {data.triggerEvents.length === 0 ? (
                <div
                  style={{
                    padding: 'var(--space-6)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--font-size-sm)',
                    background: 'var(--surface-1)',
                    borderRadius: 'var(--radius-lg)', }}>
                  No recent trigger events detected.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.triggerEvents.slice(0, 8).map((event, i) => (
                    <TriggerEventCard key={i} event={event} />
                  ))}</div>
              )}</div>

            {/* Strategy Cards */}
            <div>
              <h2 style={sectionHeading}>
                Strategy Cards</h2>
              {data.strategyCards.length === 0 ? (
                <div
                  style={{
                    padding: 'var(--space-6)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--font-size-sm)',
                    background: 'var(--surface-1)',
                    borderRadius: 'var(--radius-lg)', }}>
                  No actionable strategies right now. Add more investors or schedule meetings to generate competitive dynamics.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.strategyCards.map((card, i) => (
                    <StrategyCardComponent key={i} card={card} />
                  ))}</div>
              )}</div>

            {/* Meeting Density */}
            <div
              style={cardSurface1}>
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4" style={stAccent} />
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', margin: 0 }}>
                  Meeting Cadence</h3></div>
              <div className="flex items-end gap-2 mb-2">
                <span style={textXlLight}>
                  {data.meetingDensity.densityScore}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', paddingBottom: '3px' }}>
                  / 100 density</span></div>
              <div
                style={{
                  width: '100%', height: '4px',
                  background: 'var(--surface-3)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginBottom: 'var(--space-2)', }}>
                <div
                  style={{
                    width: `${data.meetingDensity.densityScore}%`,
                    height: '100%',
                    background: data.meetingDensity.densityScore >= 70 ? 'var(--success)' : data.meetingDensity.densityScore >= 40 ? 'var(--warning)' : 'var(--danger)',
                    borderRadius: '2px',
                  }} /></div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {data.meetingDensity.insight}</p></div></div></div>

        {/* Footer timestamp */}
        <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={labelMuted}>
            Last computed: {fmtDateTime(data.generatedAt)}</span></div></div>
    </div>);
}

'use client';

import { useEffect, useState, useMemo } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { cachedFetch } from '@/lib/cache';
import Link from 'next/link';
import { Flame, Filter, TrendingUp, Thermometer } from 'lucide-react';
import { STATUS_LABELS, TYPE_LABELS } from '@/lib/constants';
import { DealHeatInvestor } from '@/lib/types';
import { fmtDateShort } from '@/lib/format';
import { labelMuted, maxWidthCenter, stTextMuted, textSmMuted, textSmSecondary } from '@/lib/styles';

interface DealHeatData {
  investors: DealHeatInvestor[];
  counts: {
    hot: number;
    warm: number;
    cool: number;
    cold: number;
    frozen: number;
    total: number;
  };
  generated_at: string;
}

type HeatLevel = 'all' | 'hot' | 'warm' | 'cool' | 'cold' | 'frozen';

const invNameStyle: React.CSSProperties = { fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const typeBadgeStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', fontWeight: 400, letterSpacing: '0.01em', padding: 'var(--space-0) var(--space-1)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text-secondary)' };
const driverStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const filterBtnBase: React.CSSProperties = { padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', fontWeight: 400, cursor: 'pointer', transition: 'all 150ms ease' };
const countHidden: React.CSSProperties = { fontSize: 'var(--font-size-xs)', opacity: 0 };
const heatCountLabel = { ...labelMuted, marginTop: 'var(--space-0)' } as const;
const heatCardBase: React.CSSProperties = { padding: 'var(--space-4)', background: 'var(--surface-0)', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', position: 'relative', overflow: 'hidden' };
const heatBarBase: React.CSSProperties = { position: 'absolute', top: 0, left: 0, right: 0, height: '3px' };
const heatCircleBase: React.CSSProperties = { width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', flexShrink: 0 };
const heatLabelBase: React.CSSProperties = { fontSize: 'var(--font-size-xs)', fontWeight: 400, letterSpacing: '0.01em' };
const heatScoreText: React.CSSProperties = { fontSize: 'var(--font-size-sm)', fontWeight: 300, lineHeight: 1 };
const linkNoDecor: React.CSSProperties = { textDecoration: 'none' };
const mtSpace1: React.CSSProperties = { marginTop: 'var(--space-1)' };
const mtSpace3: React.CSSProperties = { marginTop: 'var(--space-3)' };
const driverStyleMt2: React.CSSProperties = { ...driverStyle, marginTop: 'var(--space-2)' };
const cardFooterBorder: React.CSSProperties = { marginTop: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' };

const HEAT_CONFIG: Record<string, { bg: string; border: string; text: string; glow: string; label: string }> = {
  hot:    { bg: 'var(--accent-8)', border: 'var(--accent-15)',  text: 'var(--text-primary)', glow: 'none', label: 'Hot' },
  warm:   { bg: 'var(--accent-muted)',  border: 'var(--accent-12)',  text: 'var(--text-secondary)', glow: 'none', label: 'Warm' },
  cool:   { bg: 'var(--accent-5)', border: 'var(--accent-10)', text: 'var(--text-tertiary)', glow: 'none', label: 'Cool' },
  cold:   { bg: 'var(--accent-4)', border: 'var(--accent-8)', text: 'var(--text-muted)', glow: 'none', label: 'Cold' },
  frozen: { bg: 'var(--accent-3)', border: 'var(--accent-muted)', text: 'var(--text-muted)', glow: 'none', label: 'Frozen' },};

export default function DealHeatPage() {
  const [data, setData] = useState<DealHeatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HeatLevel>('all');

  function fetchDealHeat() {
    setLoading(true);
    setError(null);
    cachedFetch('/api/deal-heat')
      .then(res => {
        if (!res.ok) throw new Error('Couldn\'t load deal heat data — refresh to retry');
        return res.json();})
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { document.title = 'Raise | Deal Heat Map'; }, []);
  useEffect(() => { fetchDealHeat(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchDealHeat(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 p-6 page-content" style={maxWidthCenter}>
        <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-8)' }}>
          <div className="skeleton" style={{ width: '240px', height: '32px' }} /></div>
        <div className="grid grid-cols-5 gap-3" style={{ marginBottom: 'var(--space-6)' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="card skeleton" style={{ height: '80px' }} />
          ))}</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="card skeleton" style={{ height: '160px' }} />
          ))}</div>
      </div>);
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6 page-content" style={maxWidthCenter}>
        <EmptyState icon={Flame} title="Couldn\'t load deal heat data" description={error || 'An unexpected error occurred'} action={{ label: 'Retry', onClick: fetchDealHeat }} />
      </div>);
  }

  const { investors, counts } = data;
  const filtered = useMemo(() => filter === 'all' ? investors : investors.filter(inv => inv.dealHeat.label === filter), [investors, filter]);
  const avgHeat = useMemo(() => investors.length > 0 ? Math.round(investors.reduce((s, i) => s + i.dealHeat.heat, 0) / investors.length) : 0, [investors]);

  const filterButtons: { level: HeatLevel; label: string; count: number }[] = [
    { level: 'all', label: 'All', count: counts.total },
    { level: 'hot', label: 'Hot', count: counts.hot },
    { level: 'warm', label: 'Warm', count: counts.warm },
    { level: 'cool', label: 'Cool', count: counts.cool },
    { level: 'cold', label: 'Cold', count: counts.cold },
    { level: 'frozen', label: 'Frozen', count: counts.frozen },];

  return (
    <div className="flex-1 p-6 page-content" style={maxWidthCenter}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="page-title">Deal Heat Map</h1>
          <p style={{ ...textSmMuted, marginTop: 'var(--space-0)' }}>
            {counts.total} investors &middot; {counts.hot + counts.warm} warm or hot</p></div>
        <div
          className="flex items-center gap-2"
          style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--surface-1)', borderRadius: 'var(--radius-md)' }}>
          <span style={stTextMuted}>
            <Thermometer className="w-4 h-4" /></span>
          <span style={textSmSecondary}>
            Avg Heat:</span>
          <span style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 300,
            color: avgHeat >= 80 ? 'var(--text-primary)' : avgHeat >= 60 ? 'var(--text-secondary)' : avgHeat >= 40 ? 'var(--text-tertiary)' : 'var(--text-muted)',
          }}>
            {avgHeat}</span></div></div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3 card-stagger" style={{ marginBottom: 'var(--space-6)' }}>
        {(['hot', 'warm', 'cool', 'cold', 'frozen'] as const).map(level => {
          const cfg = HEAT_CONFIG[level];
          const count = counts[level];
          return (
            <div
              key={level}
              className="card card-heat-hover"
              style={{
                padding: 'var(--space-4)',
                background: cfg.bg,
                cursor: 'pointer',
                boxShadow: cfg.glow, }}
              onClick={() => setFilter(filter === level ? 'all' : level)}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: cfg.text, fontWeight: 400, letterSpacing: '0.01em' }}>
                {cfg.label}</div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 300, color: cfg.text, marginTop: 'var(--space-1)' }}>
                {count}</div>
              <div style={heatCountLabel}>
                {count === 1 ? 'investor' : 'investors'}</div>
            </div>);
        })}</div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 'var(--space-5)' }}>
        <span style={stTextMuted}>
          <Filter className="w-4 h-4" /></span>
        {filterButtons.map(fb => {
          const active = filter === fb.level;
          const cfg = fb.level !== 'all' ? HEAT_CONFIG[fb.level] : null;
          return (
            <button
              key={fb.level}
              onClick={() => setFilter(fb.level)}
              className="flex items-center gap-1.5"
              style={{
                ...filterBtnBase,
                background: active ? (cfg ? cfg.bg : 'var(--surface-2)') : 'transparent',
                color: active ? (cfg ? cfg.text : 'var(--text-primary)') : 'var(--text-tertiary)', }}>
              {fb.label}
              <span style={countHidden}>
                {fb.count}</span>
            </button>);
        })}</div>

      {/* Heat Grid */}
      {filtered.length === 0 ? (
          <EmptyState
            icon={Thermometer}
            title="No investors at this heat level"
            description="Try a different heat filter or check your active pipeline." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(inv => {
            const cfg = HEAT_CONFIG[inv.dealHeat.label];
            const topDriver = inv.dealHeat.drivers.length > 0 ? inv.dealHeat.drivers[0] : null;
            return (
              <Link
                key={inv.id}
                href={`/investors/${inv.id}`}
                className="block"
                style={linkNoDecor}>
                <div
                  className="card deal-card-hover"
                  style={{ ...heatCardBase, border: `1px solid ${cfg.border}` }}>
                  {/* Heat bar at top */}
                  <div style={{ ...heatBarBase, background: `linear-gradient(90deg, ${cfg.text} ${inv.dealHeat.heat}%, transparent ${inv.dealHeat.heat}%)` }} />

                  {/* Header row */}
                  <div className="flex items-start justify-between" style={mtSpace1}>
                    <div className="min-w-0 flex-1">
                      <div style={invNameStyle}>
                        {inv.name}</div>
                      <div className="flex items-center gap-2" style={mtSpace1}>
                        <span style={typeBadgeStyle}>
                          {TYPE_LABELS[inv.type] || inv.type}</span>
                        <span style={labelMuted}>
                          T{inv.tier}</span></div></div>
                    {/* Heat score circle */}
                    <div style={{ ...heatCircleBase, background: cfg.bg, border: `2px solid ${cfg.border}` }}>
                      <span style={{ ...heatScoreText, color: cfg.text }}>
                        {inv.dealHeat.heat}</span></div></div>

                  {/* Heat label */}
                  <div className="flex items-center gap-2" style={mtSpace3}>
                    <span style={{ ...heatLabelBase, color: cfg.text }}>
                      {cfg.label}</span>
                    <span style={labelMuted}>
                      {STATUS_LABELS[inv.status] || inv.status}</span></div>

                  {/* Top driver */}
                  {topDriver && (
                    <div style={driverStyleMt2}>
                      {topDriver}</div>
                  )}

                  {/* Footer: enthusiasm + last meeting */}
                  <div className="flex items-center justify-between" style={cardFooterBorder}>
                    <div className="flex items-center gap-1" style={labelMuted}>
                      <TrendingUp className="w-3 h-3" />
                      <span>{inv.enthusiasm}/5</span></div>
                    {inv.lastMeeting && (() => {
                      const daysSince = Math.floor((Date.now() - new Date(inv.lastMeeting).getTime()) / 864e5);
                      return daysSince > 14
                        ? <span style={{ fontSize: 'var(--font-size-xs)', color: daysSince > 21 ? 'var(--danger)' : 'var(--warning)', fontWeight: 400 }}>{daysSince}d ago</span>
                        : <div style={labelMuted}>{fmtDateShort(inv.lastMeeting)}</div>;
                    })()}</div></div>
              </Link>);
          })}</div>
      )}
    </div>);
}

'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Investor, InvestorStatus, InvestorType } from '@/lib/types';
import { useToast } from '@/components/toast';
import { cachedFetch, invalidateCache } from '@/lib/cache';
import { relativeTime } from '@/lib/time';
import {
  Users, TrendingUp, Zap, Filter, X, GripVertical, Download,
  Building2, Landmark, Shield, Banknote, Home, Rocket,
  Calendar, SendHorizonal, ClipboardList,
} from 'lucide-react';
import { fmtDate } from '@/lib/format';
import { STATUS_LABELS, TYPE_LABELS } from '@/lib/constants';
import { labelMuted, labelMuted10, stFontSm, stFontXs, stTextMuted, textSmMuted, badgeSmall } from '@/lib/styles';
import { EmptyState } from '@/components/ui/empty-state';
import { MS_PER_MINUTE } from '@/lib/time';

// ── Pipeline column order ────────────────────────────────────────────
const PIPELINE_STATUSES: InvestorStatus[] = [
  'identified', 'contacted', 'nda_signed', 'meeting_scheduled',
  'met', 'engaged', 'in_dd', 'term_sheet', 'closed',];

const EXIT_STATUSES: InvestorStatus[] = ['passed', 'dropped'];

type ColumnStyle = { header: React.CSSProperties; border: React.CSSProperties; bg: React.CSSProperties; badge: React.CSSProperties };
function colStyle(headerBg: string, borderClr: string, bgVal: string, badgeBg: string, badgeClr: string): ColumnStyle {
  return { header: { background: headerBg }, border: { borderColor: borderClr }, bg: { background: bgVal }, badge: { background: badgeBg, color: badgeClr } };
}

const COLUMN_COLORS: Record<InvestorStatus, ColumnStyle> = {
  identified:        colStyle('var(--white-15)',  'var(--border-subtle)', 'var(--white-4)',     'var(--white-25)',    'var(--text-secondary)'),
  contacted:         colStyle('var(--accent-5)',  'var(--accent-5)',      'var(--accent-5)',    'var(--accent-muted)','var(--accent)'),
  nda_signed:        colStyle('var(--accent-5)',  'var(--accent-muted)',  'var(--accent-5)',    'var(--accent-muted)','var(--accent)'),
  meeting_scheduled: colStyle('var(--accent-8)',  'var(--accent-12)',     'var(--accent-3)',    'var(--accent-10)',   'var(--text-secondary)'),
  met:               colStyle('var(--accent-10)', 'var(--accent-15)',     'var(--accent-4)',    'var(--accent-12)',   'var(--text-secondary)'),
  engaged:           colStyle('var(--accent-12)', 'var(--accent-20)',     'var(--accent-4)',    'var(--accent-15)',   'var(--accent)'),
  in_dd:             colStyle('var(--accent-15)', 'var(--accent-25)',     'var(--accent-5)',    'var(--accent-20)',   'var(--accent)'),
  term_sheet:        colStyle('var(--accent-20)', 'var(--accent-25)',     'var(--accent-muted)','var(--accent-25)',   'var(--accent)'),
  closed:            colStyle('var(--accent-25)', 'var(--accent-30)',     'var(--accent-8)',    'var(--accent-30)',   'var(--accent)'),
  passed:            colStyle('var(--accent-8)',  'var(--accent-8)',      'var(--accent-8)',    'var(--accent-8)',    'var(--text-primary)'),
  dropped:           colStyle('var(--white-10)',  'var(--border-subtle)', 'var(--white-3)',     'var(--white-20)',    'var(--text-tertiary)'),
};

const TIER_STYLES: Record<number, React.CSSProperties> = {
  1: { background: 'var(--accent-muted)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent-muted)' },
  2: { background: 'var(--accent-8)', color: 'var(--text-secondary)', boxShadow: 'inset 0 0 0 1px var(--accent-10)' },
  3: { background: 'var(--white-12)', color: 'var(--text-secondary)', boxShadow: 'inset 0 0 0 1px var(--border-default)' },
  4: { background: 'var(--white-8)', color: 'var(--text-muted)', boxShadow: 'inset 0 0 0 1px var(--border-subtle)' },};

const TYPE_ICONS: Record<InvestorType, React.ComponentType<{ className?: string }>> = {
  vc: Rocket,
  growth: TrendingUp,
  sovereign: Landmark,
  strategic: Shield,
  debt: Banknote,
  family_office: Home,};

const TYPE_STYLES: Record<InvestorType, React.CSSProperties> = {
  vc: { background: 'var(--accent-muted)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent-muted)' },
  growth: { background: 'var(--cat-8)', color: 'var(--text-secondary)', boxShadow: 'inset 0 0 0 1px var(--cat-10)' },
  sovereign: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)', boxShadow: 'inset 0 0 0 1px var(--warn-30)' },
  strategic: { background: 'var(--success-muted)', color: 'var(--text-secondary)', boxShadow: 'inset 0 0 0 1px var(--accent-30)' },
  debt: { background: 'var(--warn-12)', color: 'var(--text-tertiary)', boxShadow: 'inset 0 0 0 1px var(--warn-30)' },
  family_office: { background: 'var(--accent-8)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--accent-10)' },};

const compareBarStyle: React.CSSProperties = { position: 'fixed', bottom: 'var(--space-6)', left: '50%', transform: 'translateX(-50%)', background: 'var(--surface-2)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-2) var(--space-4)', boxShadow: 'var(--shadow-lg)', zIndex: 50 };
const filterBtnBase: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--font-size-sm)', fontWeight: 400, transition: 'all 150ms ease' };
const filterBtnActive: React.CSSProperties = { ...filterBtnBase, background: 'var(--accent-muted)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent)' };
const filterBtnInactive: React.CSSProperties = { ...filterBtnBase, background: 'var(--surface-1)', color: 'var(--text-tertiary)' };

// ── Pipeline velocity stage weights ──────────────────────────────────
const STAGE_WEIGHTS: Record<InvestorStatus, number> = {
  identified: 0, contacted: 1, nda_signed: 2, meeting_scheduled: 3,
  met: 4, engaged: 5, in_dd: 6, term_sheet: 8, closed: 10,
  passed: 0, dropped: 0,};

// ── Stat icon color map ──────────────────────────────────────────────
const STAT_ICON_COLORS: Record<string, string> = {
  blue: 'var(--accent)',
  purple: 'var(--accent)',
  amber: 'var(--warning)',
  emerald: 'var(--success)',};

const colHeaderLabel: React.CSSProperties = { ...stFontXs, fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '0.01em' };
const emptyColPlaceholder: React.CSSProperties = { height: '5rem', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center', padding: '0 var(--space-2)' };
const quickAddInputFont: React.CSSProperties = { fontSize: 'var(--font-size-xs)' };
const quickAddBtn: React.CSSProperties = { width: '100%', padding: 'var(--space-1)', fontSize: 'var(--font-size-xs)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)' };

export default function PipelinePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, setDragOverCol] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ tiers: Set<number>; types: Set<string> }>({
    tiers: new Set(),
    types: new Set(),});
  const [showFilters, setShowFilters] = useState(false);
  const [scoreDeltaMap, setScoreDeltaMap] = useState<Map<string, number>>(new Map());
  const boardRef = useRef<HTMLDivElement>(null);
  const [kbCol, setKbCol] = useState(0);
  const [kbRow, setKbRow] = useState(0);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const toggleCompare = useCallback((id: string) => setCompareIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }), []);
  const [quickAddCol, setQuickAddCol] = useState<string | null>(null);
  const [quickAddName, setQuickAddName] = useState('');

  useEffect(() => { document.title = 'Raise | Investor Pipeline'; }, []);
  useEffect(() => {
    const load = () => { fetchInvestors(); cachedFetch('/api/at-risk').then(r => r.ok ? r.json() : null).then(d => { if (d?.scoreReversals) { const m = new Map<string, number>(); d.scoreReversals.forEach((r: { investorId: string; delta: number }) => m.set(r.investorId, r.delta)); setScoreDeltaMap(m); } }).catch(e => console.error('[PIPELINE_ATRISK]', e instanceof Error ? e.message : e)); };
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => { load(); interval = setInterval(load, 5 * MS_PER_MINUTE); };
    const onVis = () => { if (document.hidden) { if (interval) { clearInterval(interval); interval = null; } } else { start(); } };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { if (interval) clearInterval(interval); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  async function fetchInvestors() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await cachedFetch('/api/investors');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Couldn\'t load pipeline data — refresh to retry');
      }
      setInvestors(await res.json());
      setLoadedAt(new Date().toISOString());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Couldn\'t load investors — check your connection and refresh';
      setFetchError(msg);
      toast(msg, 'error');
    }
    setLoading(false);
  }

  // ── Filtering ────────────────────────────────────────────────────
  const filtered = useMemo(() => investors.filter(inv => {
    if (filters.tiers.size > 0 && !filters.tiers.has(inv.tier)) return false;
    if (filters.types.size > 0 && !filters.types.has(inv.type)) return false;
    return true;
  }), [investors, filters]);

  const hasActiveFilters = filters.tiers.size > 0 || filters.types.size > 0;

  const toggleTier = useCallback((tier: number) => {
    setFilters(f => {
      const next = new Set(f.tiers);
      if (next.has(tier)) next.delete(tier); else next.add(tier);
      return { ...f, tiers: next };});
  }, []);

  const toggleType = useCallback((type: string) => {
    setFilters(f => {
      const next = new Set(f.types);
      if (next.has(type)) next.delete(type); else next.add(type);
      return { ...f, types: next };});
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ tiers: new Set(), types: new Set() });
  }, []);

  // ── Stats ────────────────────────────────────────────────────────
  const { activeInvestors, totalCount, avgEnthusiasm, pipelineVelocity, advancedCount } = useMemo(() => {
    const active = filtered.filter(i => !EXIT_STATUSES.includes(i.status));
    let enthSum = 0, enthCount = 0, velSum = 0, adv = 0;
    for (const i of active) {
      if (i.enthusiasm > 0) { enthSum += i.enthusiasm; enthCount++; }
      velSum += STAGE_WEIGHTS[i.status as InvestorStatus] || 0;
      if (['in_dd', 'term_sheet', 'closed'].includes(i.status)) adv++;
    }
    return {
      activeInvestors: active,
      totalCount: filtered.length,
      avgEnthusiasm: enthCount > 0 ? enthSum / enthCount : 0,
      pipelineVelocity: active.length > 0 ? velSum / active.length : 0,
      advancedCount: adv,
    };
  }, [filtered]);

  // ── Keyboard navigation ────────────────────────────────────────
  const colGrid = useMemo(() => PIPELINE_STATUSES.map(s => filtered.filter(i => i.status === s).sort((a, b) => a.tier !== b.tier ? a.tier - b.tier : (b.enthusiasm || 0) - (a.enthusiasm || 0))), [filtered]);
  const selectedId = colGrid[kbCol]?.[kbRow]?.id ?? null;

  useEffect(() => {
    const handleKb = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); setKbCol(c => Math.min(c + 1, PIPELINE_STATUSES.length - 1)); setKbRow(0); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setKbCol(c => Math.max(c - 1, 0)); setKbRow(0); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setKbRow(r => { const max = (colGrid[kbCol]?.length ?? 1) - 1; return Math.min(r + 1, max); }); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setKbRow(r => Math.max(r - 1, 0)); }
      else if (e.key === 'Enter' && selectedId) { e.preventDefault(); router.push(`/investors/${selectedId}`); }
      else if (e.key === 'r' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); fetchInvestors(); }
    };
    window.addEventListener('keydown', handleKb);
    return () => window.removeEventListener('keydown', handleKb);
  }, [kbCol, kbRow, colGrid, selectedId, router]);

  // ── Drag and drop ───────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }, []);

  const handleDragEnd = useCallback((_e: React.DragEvent) => {
    setDragId(null);
    setDragOverCol(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverCol(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;

    const investor = investors.find(i => i.id === id);
    if (!investor || investor.status === newStatus) {
      setDragId(null);
      return;
    }

    const previousStatus = investor.status;

    // Confirm destructive status changes
    if (['passed', 'dropped'].includes(newStatus) && !['passed', 'dropped'].includes(previousStatus)) {
      const ok = window.confirm(`Move ${investor.name} to "${STATUS_LABELS[newStatus as InvestorStatus]}"? This removes them from the active pipeline.`);
      if (!ok) { setDragId(null); return; }
    }

    // Optimistic update
    setInvestors(prev =>
      prev.map(i => i.id === id ? { ...i, status: newStatus as InvestorStatus } : i));
    setDragId(null);

    try {
      const res = await fetch('/api/investors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),});
      if (!res.ok) throw new Error('Failed to update');
      invalidateCache('/api/');
      toast(`${investor.name} moved to ${STATUS_LABELS[newStatus as InvestorStatus]}`);
    } catch (e) {
      console.warn('[PIPELINE_DROP]', e instanceof Error ? e.message : e);
      setInvestors(prev =>
        prev.map(i => i.id === id ? { ...i, status: previousStatus } : i));
      toast('Couldn\'t update status — change reverted, try again', 'error');
    }
  }, [investors, toast]);

  // ── Group investors by status (memoized once) ───────────────────
  const statusGrid = useMemo(() => {
    const grid = new Map<string, Investor[]>();
    for (const s of [...PIPELINE_STATUSES, ...EXIT_STATUSES]) grid.set(s, []);
    for (const i of filtered) {
      const arr = grid.get(i.status);
      if (arr) arr.push(i);
    }
    const sorter = (a: Investor, b: Investor) => a.tier !== b.tier ? a.tier - b.tier : (b.enthusiasm || 0) - (a.enthusiasm || 0);
    for (const arr of grid.values()) arr.sort(sorter);
    return grid;
  }, [filtered]);

  function investorsInStatus(status: InvestorStatus): Investor[] {
    return statusGrid.get(status) || [];
  }

  // ── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton" style={{ height: '2rem', width: '16rem' }} />
        <div className="flex gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={skelTile} />
          ))}</div>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-3" style={skelCol}>
              <div className="skeleton" style={skelHeader} />
              {[...Array(Math.max(0, 3 - i))].map((_, j) => (
                <div key={j} className="skeleton" style={skelCard} />
              ))}</div>
          ))}</div>
      </div>);
  }

  // ── Error state ─────────────────────────────────────────────────
  if (fetchError && investors.length === 0) {
    return (
      <div className="page-content flex items-center justify-center" style={{ minHeight: '400px' }}>
        <EmptyState icon={Users} title="Couldn\'t load pipeline" description={fetchError} action={{ label: 'Retry', onClick: fetchInvestors }} />
      </div>);
  }

  return (
    <div className="page-content space-y-5 h-full flex flex-col">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="page-title" style={{ fontSize: 'var(--font-size-xl)' }}>Investor Pipeline</h1>
          <p className="page-subtitle" style={{ ...textSmMuted, marginTop: 'var(--space-1)' }}>Drag to move through the pipeline{loadedAt ? ` · Updated ${relativeTime(loadedAt)}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <FilterButton
            active={hasActiveFilters}
            count={filters.tiers.size + filters.types.size}
            onClick={() => setShowFilters(!showFilters)} />
          <a
            href="/api/export?type=pipeline"
            download
            className="btn btn-secondary btn-sm">
            <Download className="w-3.5 h-3.5" /> CSV</a>
          <Link
            href="/investors"
            className="btn btn-secondary btn-sm">
            Table View</Link></div></div>

      {/* ── Summary Stats ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0 card-stagger">
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Total Investors"
          value={String(totalCount)}
          sub={`${activeInvestors.length} active`}
          iconColor={STAT_ICON_COLORS.blue} />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Avg Enthusiasm"
          value={avgEnthusiasm > 0 ? avgEnthusiasm.toFixed(1) : '—'}
          sub="out of 5"
          iconColor={STAT_ICON_COLORS.purple} />
        <StatCard
          icon={<Zap className="w-4 h-4" />}
          label="Pipeline Velocity"
          value={pipelineVelocity > 0 ? pipelineVelocity.toFixed(1) : '—'}
          sub="weighted stage avg"
          iconColor={STAT_ICON_COLORS.amber} />
        <StatCard
          icon={<Building2 className="w-4 h-4" />}
          label="In DD+"
          value={String(advancedCount)}
          sub="advanced stage"
          iconColor={STAT_ICON_COLORS.emerald} /></div>

      {/* ── Filter Bar ──────────────────────────────────────────── */}
      {showFilters && (
        <div
          className="flex-shrink-0 space-y-3"
          style={{ borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)' }}>
          <div className="flex items-center justify-between">
            <h3
              className="section-title"
              style={{ marginBottom: 0 }}>
              Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 icon-delete"
                style={{ fontSize: 'var(--font-size-xs)' }}>
                <X className="w-3 h-3" /> Clear all</button>
            )}</div>
          <div className="flex flex-wrap gap-4">
            <div>
              <span style={{ ...labelMuted, display: 'block', marginBottom: 'var(--space-1)' }}>Tier</span>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map(tier => (
                  <TierFilterButton
                    key={tier}
                    tier={tier}
                    active={filters.tiers.has(tier)}
                    onClick={() => toggleTier(tier)} />
                ))}</div></div>
            <div>
              <span style={{ ...labelMuted, display: 'block', marginBottom: 'var(--space-1)' }}>Type</span>
              <div className="flex gap-1.5 flex-wrap">
                {(Object.entries(TYPE_LABELS) as [InvestorType, string][]).map(([key, label]) => (
                  <TypeFilterButton
                    key={key}
                    type={key}
                    label={label}
                    active={filters.types.has(key)}
                    onClick={() => toggleType(key)} />
                ))}</div></div></div></div>
      )}

      {/* ── Pipeline Summary Strip ──────────────────────────────── */}
      {(() => {
        const totalInv = filtered.length;
        let activeCount = 0, inDdCount = 0, termSheetCount = 0, closedCount = 0, passedCount = 0, engagedDaysSum = 0, engagedCount = 0;
        const now = Date.now();
        for (const i of filtered) {
          if (i.status === 'passed') { passedCount++; continue; }
          if (i.status === 'dropped') continue;
          activeCount++;
          if (i.status === 'in_dd') inDdCount++;
          else if (i.status === 'term_sheet') termSheetCount++;
          else if (i.status === 'closed') closedCount++;
          if (i.status !== 'identified') {
            engagedDaysSum += Math.floor((now - new Date(i.created_at).getTime()) / 864e5);
            engagedCount++;
          }
        }
        const convDenom = activeCount + closedCount + passedCount;
        const conversionRate = convDenom > 0 ? ((closedCount / convDenom) * 100).toFixed(1) : '0.0';
        const avgDays = engagedCount > 0 ? Math.round(engagedDaysSum / engagedCount) : 0;

        const metrics = [
          { label: 'Total', value: String(totalInv) },
          { label: 'Active', value: String(activeCount) },
          { label: 'In DD', value: String(inDdCount) },
          { label: 'Term Sheets', value: String(termSheetCount) },
          { label: 'Closed', value: String(closedCount), color: 'var(--text-secondary)' },
          { label: 'Avg Days', value: `${avgDays}d`, color: avgDays > 60 ? 'var(--warning)' : undefined },
          { label: 'Conversion', value: `${conversionRate}%`, color: closedCount > 0 ? 'var(--success)' : undefined },];

        return (
          <div
            className="flex items-center gap-6 flex-shrink-0 overflow-x-auto"
            style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)' }}>
            {metrics.map((m) => (
              <div key={m.label} className="flex flex-col items-center" style={metricColStyle}>
                <span style={metricLabelStyle}>{m.label}</span>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 300, color: m.color || 'var(--text-primary)', lineHeight: 1.2 }}>{m.value}</span>
              </div>
            ))}
          </div>);
      })()}

      {/* ── Kanban Board ────────────────────────────────────────── */}
      <div
        ref={boardRef}
        className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-3 h-full min-w-max">
          {PIPELINE_STATUSES.map(status => {
            const cards = investorsInStatus(status);
            const colors = COLUMN_COLORS[status];

            return (
              <div
                key={status}
                className="w-[260px] flex flex-col"
                style={{ borderRadius: 'var(--radius-xl)', transition: 'all 150ms ease' }}
                onDragOver={e => handleDragOver(e, status)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, status)}>
                {/* Column header */}
                <div style={{ padding: 'var(--space-2) var(--space-3)', borderTopLeftRadius: 'var(--radius-xl)', borderTopRightRadius: 'var(--radius-xl)', ...colors.header }}>
                  <div className="flex items-center justify-between">
                    <span style={colHeaderLabel}>{STATUS_LABELS[status]}</span>
                    <div className="flex items-center gap-1.5">
                      {cards.length > 0 && <ActivePct cards={cards} />}
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 300, padding: 'var(--space-0) var(--space-1)', borderRadius: 'var(--radius-full)', ...colors.badge }}>{cards.length}</span>
                    </div>
                  </div></div>

                {/* Cards container */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2" style={{ ...colors.bg, borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)', minHeight: '120px' }}>
                  {cards.map(inv => (
                    <InvestorCard
                      key={inv.id}
                      investor={inv}
                      convictionDelta={scoreDeltaMap.get(inv.id) ?? null}
                      isDragging={dragId === inv.id}
                      isKbSelected={selectedId === inv.id}
                      isCompareSelected={compareIds.has(inv.id)}
                      onToggleCompare={toggleCompare}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd} />
                  ))}
                  {cards.length === 0 && !quickAddCol && (
                    <div
                      className="flex items-center justify-center"
                      style={emptyColPlaceholder}>
                      {dragId ? 'Drop here'
                        : status === 'identified' ? 'Add investors from the table view'
                        : status === 'closed' ? 'Move investors here when signed'
                        : 'Move investors from earlier stages'}</div>
                  )}
                  {quickAddCol === status ? (
                    <input autoFocus value={quickAddName} onChange={e => setQuickAddName(e.target.value)} placeholder="Investor name..." className="input" style={quickAddInputFont}
                      onKeyDown={async e => { if (e.key === 'Enter' && quickAddName.trim()) { try { const res = await fetch('/api/investors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: quickAddName.trim(), status }) }); if (!res.ok) throw new Error('Failed'); const inv = await res.json(); setInvestors(prev => [...prev, inv]); setQuickAddName(''); setQuickAddCol(null); toast(`Added ${inv.name}`); } catch { toast('Couldn\'t add investor — try again', 'error'); } } if (e.key === 'Escape') { setQuickAddCol(null); setQuickAddName(''); } }} onBlur={() => { if (!quickAddName.trim()) { setQuickAddCol(null); setQuickAddName(''); } }} />
                  ) : (
                    <button onClick={() => { setQuickAddCol(status); setQuickAddName(''); }} className="icon-delete" style={quickAddBtn}>+ Add</button>
                  )}</div>
              </div>);
          })}</div></div>

      {/* ── Exit Row (Passed / Dropped) ─────────────────────────── */}
      {EXIT_STATUSES.some(s => investorsInStatus(s).length > 0 || dragId) && (
        <div
          className="flex-shrink-0 pt-4">
          <div className="flex gap-4">
            {EXIT_STATUSES.map(status => {
              const cards = investorsInStatus(status);
              const colors = COLUMN_COLORS[status];

              return (
                <div
                  key={status}
                  className="flex-1"
                  style={{ borderRadius: 'var(--radius-xl)', transition: 'all 150ms ease' }}
                  onDragOver={e => handleDragOver(e, status)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, status)}>
                  <div
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      borderTopLeftRadius: 'var(--radius-xl)',
                      borderTopRightRadius: 'var(--radius-xl)',
                      ...colors.header, }}>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-secondary)', letterSpacing: '0.01em' }}>
                        {STATUS_LABELS[status]}</span>
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 300,
                          padding: 'var(--space-0) var(--space-1)',
                          borderRadius: 'var(--radius-full)',
                          ...colors.badge, }}>
                        {cards.length}</span></div></div>
                  <div className="p-2" style={{ ...colors.bg, borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
                    {cards.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {cards.map(inv => (
                          <InvestorCard
                            key={inv.id}
                            investor={inv}
                            compact
                            convictionDelta={scoreDeltaMap.get(inv.id) ?? null}
                            isDragging={dragId === inv.id}
                            isCompareSelected={compareIds.has(inv.id)}
                            onToggleCompare={toggleCompare}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd} />
                        ))}</div>
                    ) : (
                      <div
                        className="flex items-center justify-center"
                        style={{ height: '3rem', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                        {dragId ? 'Drop here' : 'None'}</div>
                    )}</div>
                </div>);
            })}</div></div>
      )}

      {/* ── Compare floating bar ──────────────────────────────── */}
      {compareIds.size >= 2 && (
        <div className="flex items-center gap-3" style={compareBarStyle}>
          <span style={{ ...stFontSm, color: 'var(--text-secondary)' }}>{compareIds.size} selected</span>
          <select aria-label="Move selected investors to status" defaultValue="" onChange={async e => { if (!e.target.value) return; const s = e.target.value; try { await Promise.all(Array.from(compareIds).map(id => fetch('/api/investors', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: s }) }).then(r => { if (!r.ok) throw new Error('Failed'); }))); toast(`Moved ${compareIds.size} to ${STATUS_LABELS[s as InvestorStatus]}`); setCompareIds(new Set()); fetchInvestors(); } catch { toast('Couldn\'t move investors — try again', 'error'); } e.target.value = ''; }} className="input" style={{ width: 'auto', fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-2)' }}><option value="" disabled>Move to...</option>{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <Link href={`/compare?ids=${Array.from(compareIds).join(',')}`} className="btn btn-primary btn-sm">Compare</Link>
          <button onClick={() => setCompareIds(new Set())} className="btn btn-secondary btn-sm">Clear</button>
        </div>
      )}
    </div>);
}

// ── Filter Button Component ──────────────────────────────────────────
function FilterButton({
  active,
  count,
  onClick,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 ${active ? '' : 'filter-inactive'}`}
      style={active ? filterBtnActive : filterBtnInactive}>
      <Filter className="w-3.5 h-3.5" />
      Filters
      {active && (
        <span
          style={{
            background: 'var(--accent)',
            color: 'var(--text-primary)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 300,
            padding: 'var(--space-0) var(--space-1)',
            borderRadius: 'var(--radius-full)', }}>
          {count}</span>
      )}
    </button>);
}

// ── Tier Filter Button Component ──────────────────────────────────────
function TierFilterButton({
  tier,
  active,
  onClick,
}: {
  tier: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={active ? '' : 'filter-inactive'}
      style={{
        padding: 'var(--space-1) var(--space-2)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 400,
        transition: 'all 150ms ease',
        ...(active
          ? TIER_STYLES[tier]
          : {
              background: 'var(--surface-1)',
              color: 'var(--text-muted)',
            }), }}>
      T{tier}
    </button>);
}

// ── Type Filter Button Component ──────────────────────────────────────
function TypeFilterButton({
  type,
  label,
  active,
  onClick,
}: {
  type: InvestorType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={active ? '' : 'filter-inactive'}
      style={{
        padding: 'var(--space-1) var(--space-2)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 400,
        transition: 'all 150ms ease',
        ...(active
          ? TYPE_STYLES[type]
          : {
              background: 'var(--surface-1)',
              color: 'var(--text-muted)',
            }), }}>
      {label}
    </button>);
}

// ── Stat Card Component ──────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  iconColor: string;
}) {
  return (
    <div
      className="card-metric"
      style={{ padding: 'var(--space-3) var(--space-4)' }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-1)' }}>
        <span style={{ color: iconColor }}>{icon}</span>
        <span className="metric-label">{label}</span></div>
      <div className="flex items-baseline gap-1.5">
        <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)' }}>{value}</span>
        <span style={labelMuted10}>{sub}</span></div>
    </div>);
}

function enthusiasmDotBg(n: number, enthusiasm: number): string {
  if (n > enthusiasm) return 'var(--border-default)';
  return enthusiasm >= 4 ? 'var(--success)' : enthusiasm >= 3 ? 'var(--accent)' : 'var(--text-muted)';
}

const urgencyBadgeBase: React.CSSProperties = { fontSize: 'var(--font-size-xs)', fontWeight: 400, padding: 'var(--space-0) var(--space-1)', borderRadius: 'var(--radius-sm)' };
const noteStyle: React.CSSProperties = { ...labelMuted, fontStyle: 'italic', flex: 1 };
const lastMeetingBase: React.CSSProperties = { fontSize: 'var(--font-size-xs)', fontWeight: 400 };
const metricLabelStyle: React.CSSProperties = { ...labelMuted, fontWeight: 400, whiteSpace: 'nowrap' };
const metricColStyle: React.CSSProperties = { minWidth: '4rem' };
const quickActionLink: React.CSSProperties = { ...labelMuted, padding: 'var(--space-0) 0', borderRadius: 'var(--radius-sm)', textDecoration: 'none' };
const skelTile: React.CSSProperties = { height: '5rem', width: '9rem', borderRadius: 'var(--radius-lg)' };
const skelCol: React.CSSProperties = { minWidth: '260px' };
const skelHeader: React.CSSProperties = { height: '2.5rem', borderRadius: 'var(--radius-lg)' };
const skelCard: React.CSSProperties = { height: '7rem', borderRadius: 'var(--radius-lg)' };

function computeUrgency(lastMeetingDate: string | null | undefined, tier: number, status: string): { label: string; color: string; bg: string } {
  const days = lastMeetingDate ? Math.floor((Date.now() - new Date(lastMeetingDate).getTime()) / 864e5) : 999;
  const isUrgent = (days >= 14 && tier <= 2) || (days >= 10 && ['engaged', 'in_dd', 'term_sheet'].includes(status));
  const isNormal = days >= 7 || tier <= 2;
  if (isUrgent) return { label: 'Urgent', color: 'var(--danger)', bg: 'var(--danger-muted)' };
  if (isNormal) return { label: 'Normal', color: 'var(--warning)', bg: 'var(--warning-muted)' };
  return { label: 'Low', color: 'var(--text-muted)', bg: 'var(--white-8)' };
}

function lastMeetingColor(lastDate: string | null | undefined): string {
  if (!lastDate) return 'var(--text-muted)';
  const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
  return days >= 14 ? 'var(--danger)' : days >= 7 ? 'var(--warning)' : 'var(--text-muted)';
}

function lastMeetingLabel(lastDate: string | null | undefined): string {
  if (!lastDate) return 'No meetings';
  const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
  return days === 0 ? 'Today' : `${days}d ago`;
}

function ActivePct({ cards }: { cards: { updated_at: string }[] }) {
  const activePct = Math.round((cards.filter(i => (Date.now() - new Date(i.updated_at).getTime()) < 7 * 864e5).length / cards.length) * 100);
  return <span title={`${activePct}% active in last 7 days`} style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: activePct >= 70 ? 'var(--success)' : activePct >= 40 ? 'var(--warning)' : 'var(--text-muted)' }}>{activePct}%</span>;
}

// ── Investor Card Component ──────────────────────────────────────────
function InvestorCard({
  investor,
  compact = false,
  convictionDelta = null,
  isDragging,
  isKbSelected = false,
  isCompareSelected = false,
  onToggleCompare,
  onDragStart,
  onDragEnd,
}: {
  investor: Investor;
  compact?: boolean;
  convictionDelta?: number | null;
  isDragging: boolean;
  isKbSelected?: boolean;
  isCompareSelected?: boolean;
  onToggleCompare?: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
}) {
  const TypeIcon = TYPE_ICONS[investor.type as InvestorType] || Building2;
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (isKbSelected && cardRef.current) cardRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [isKbSelected]);

  const isStale = investor.last_meeting_date
    ? Math.floor((Date.now() - new Date(investor.last_meeting_date).getTime()) / (1000 * 60 * 60 * 24)) >= 14
    : false;

  const completeness = Math.round(([investor.name, investor.fund_size, investor.type, investor.tier, investor.check_size_range, investor.partner, investor.last_meeting_date].filter(Boolean).length / 7) * 100);
  const complColor = completeness >= 80 ? 'var(--success)' : completeness >= 50 ? 'var(--warning)' : 'var(--danger)';

  const cardBaseStyle: React.CSSProperties = {
    background: isKbSelected ? 'var(--surface-2)' : 'var(--surface-1)',
    borderRadius: 'var(--radius-lg)',
    cursor: 'grab',
    boxShadow: isCompareSelected ? 'inset 0 0 0 1.5px var(--accent)' : isKbSelected ? 'inset 0 0 0 1.5px var(--accent)' : 'none',
    borderLeft: isStale ? '3px solid var(--warning)' : 'none',
    ...(isDragging ? { opacity: 0.5, transform: 'scale(0.95)' } : {}),};

  if (compact) {
    return (
      <div
        ref={cardRef}
        draggable
        onDragStart={e => onDragStart(e, investor.id)}
        onDragEnd={onDragEnd}
        aria-label={`${investor.name} — ${investor.status}`}
        className="pipeline-card"
        style={{ ...cardBaseStyle, padding: 'var(--space-2) var(--space-3)' }}>
        <Link href={`/investors/${investor.id}`} className="flex items-center gap-2">
          {onToggleCompare && <span role="checkbox" aria-checked={isCompareSelected} aria-label={`Compare ${investor.name}`} className={`card-compare${isCompareSelected ? ' selected' : ''}`} tabIndex={0} onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleCompare(investor.id); }} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onToggleCompare(investor.id); } }} style={{ width: 12, height: 12, borderRadius: 'var(--radius-sm)', border: `1.5px solid ${isCompareSelected ? 'var(--accent)' : 'var(--border-default)'}`, background: isCompareSelected ? 'var(--accent)' : 'transparent', cursor: 'pointer', flexShrink: 0 }} />}
          <GripVertical className="w-3 h-3 flex-shrink-0 card-grip" aria-hidden="true" />
          <span className="truncate" title={investor.name} style={{ ...stFontXs, fontWeight: 400, color: 'var(--text-secondary)' }}>{investor.name}</span>
          <span style={{ ...badgeSmall, ...TIER_STYLES[investor.tier] }}>T{investor.tier}</span>
        </Link>
      </div>);
  }

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={e => onDragStart(e, investor.id)}
      onDragEnd={onDragEnd}
      aria-label={`${investor.name} — ${investor.status}`}
      className="pipeline-card"
      style={{ ...cardBaseStyle, padding: 'var(--space-3)' }}>
      <Link href={`/investors/${investor.id}`} className="block space-y-2.5" draggable={false}>
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <span className="card-name" style={{ ...stFontSm, fontWeight: 400, color: 'var(--text-secondary)', lineHeight: 1.3 }}>{investor.name}</span>
            {completeness < 100 && <span title={`Profile ${completeness}% complete`} style={{ fontSize: 'var(--font-size-xs)', color: complColor, marginLeft: 'var(--space-1)', fontWeight: 400 }}>{completeness}%</span>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
            {onToggleCompare && <span role="checkbox" aria-checked={isCompareSelected} aria-label={`Compare ${investor.name}`} className={`card-compare${isCompareSelected ? ' selected' : ''}`} tabIndex={0} onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleCompare(investor.id); }} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onToggleCompare(investor.id); } }} style={{ width: 14, height: 14, borderRadius: 'var(--radius-sm)', border: `1.5px solid ${isCompareSelected ? 'var(--accent)' : 'var(--border-default)'}`, background: isCompareSelected ? 'var(--accent)' : 'transparent', cursor: 'pointer' }} />}
            <GripVertical className="w-3.5 h-3.5 card-grip" aria-hidden="true" />
          </div></div>

        {/* Badges row: type + tier */}
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1" style={{ ...badgeSmall, ...TYPE_STYLES[investor.type as InvestorType] }}>
            <TypeIcon className="w-2.5 h-2.5" />{TYPE_LABELS[investor.type as InvestorType] ?? investor.type}</span>
          <span style={{ ...badgeSmall, ...TIER_STYLES[investor.tier] }}>T{investor.tier}</span>
          {isStale && <span style={{ ...badgeSmall, background: 'var(--warning-muted)', color: 'var(--warning)' }}>Stale</span>}
          {convictionDelta !== null && convictionDelta !== 0 && <span style={{ ...badgeSmall, background: convictionDelta > 0 ? 'var(--success-muted)' : 'var(--warning-muted)', color: convictionDelta > 0 ? 'var(--success)' : 'var(--danger)' }}>{convictionDelta > 0 ? '+' : ''}{convictionDelta}</span>}
          {(() => { const d = Math.floor((Date.now() - new Date(investor.updated_at).getTime()) / 864e5); return d > 0 ? <span title="Time in current stage" style={{ ...badgeSmall, color: d >= 14 ? 'var(--warning)' : 'var(--text-muted)', background: 'var(--white-8)' }}>{d}d</span> : null; })()}
        </div>

        {/* Details */}
        <div className="space-y-1">
          {investor.partner && (
            <div className="truncate" title={investor.partner} style={labelMuted}>
              <span style={stTextMuted}>Partner:</span> {investor.partner}</div>
          )}
          {investor.fund_size && (
            <div className="truncate" title={investor.fund_size} style={labelMuted}>
              <span style={stTextMuted}>Fund:</span> {investor.fund_size}</div>
          )}
          {investor.check_size_range && <div className="truncate card-detail-hover" title={investor.check_size_range} style={labelMuted}><span style={stTextMuted}>Check:</span> {investor.check_size_range}</div>}
          {investor.sector_thesis && <div className="truncate card-detail-hover" title={investor.sector_thesis} style={labelMuted}><span style={stTextMuted}>Focus:</span> {investor.sector_thesis}</div>}
        </div>

        {/* Quick note + urgency */}
        {(() => { const u = computeUrgency(investor.last_meeting_date, investor.tier, investor.status); return (
          <div className="flex items-center gap-1.5">
            <span style={{ ...urgencyBadgeBase, background: u.bg, color: u.color }}>{u.label}</span>
            {investor.notes && <span className="truncate" title={investor.notes} style={noteStyle}>{investor.notes.slice(0, 60)}{investor.notes.length > 60 ? '...' : ''}</span>}
          </div>); })()}

        {/* Enthusiasm + last contact row */}
        <div className="flex items-center justify-between">
          {investor.enthusiasm > 0 ? (
            <div className="flex items-center gap-1.5">
              <span style={labelMuted10}>Signal</span>
              <div className="enthusiasm-dots">
                {[1, 2, 3, 4, 5].map(n => (
                  <div key={n} className="enthusiasm-dot" style={{ background: enthusiasmDotBg(n, investor.enthusiasm) }} />
                ))}</div></div>
          ) : <div />}
          <span style={{ ...lastMeetingBase, color: lastMeetingColor(investor.last_meeting_date) }} title={investor.last_meeting_date ? `Last meeting: ${fmtDate(investor.last_meeting_date)}` : undefined}>{lastMeetingLabel(investor.last_meeting_date)}</span></div></Link>

      {/* Quick actions on hover */}
        <div
          className="flex items-center gap-1 pt-2 mt-2 card-detail-hover">
          <Link
            href={`/meetings/prep?investor=${investor.id}`}
            onClick={e => e.stopPropagation()}
            draggable={false}
            aria-label={`Prep meeting with ${investor.name}`}
            className="flex items-center gap-1 flex-1 justify-center sidebar-link"
            style={quickActionLink}>
            <ClipboardList className="w-3 h-3" /> Prep</Link>
          <Link
            href={`/meetings/new?investor=${investor.id}`}
            onClick={e => e.stopPropagation()}
            draggable={false}
            aria-label={`Log meeting with ${investor.name}`}
            className="flex items-center gap-1 flex-1 justify-center sidebar-link"
            style={quickActionLink}>
            <Calendar className="w-3 h-3" /> Log</Link>
          <Link
            href={`/followups?investor=${investor.id}`}
            onClick={e => e.stopPropagation()}
            draggable={false}
            aria-label={`Follow up with ${investor.name}`}
            className="flex items-center gap-1 flex-1 justify-center sidebar-link"
            style={quickActionLink}>
            <SendHorizonal className="w-3 h-3" /> Follow up</Link></div>
    </div>);
}

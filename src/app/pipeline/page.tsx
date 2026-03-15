'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { Investor, InvestorStatus, InvestorTier, InvestorType } from '@/lib/types';
import { useToast } from '@/components/toast';
import {
  Users, TrendingUp, Zap, Filter, X, GripVertical,
  Building2, Landmark, Shield, Banknote, Home, Rocket,
  Calendar, SendHorizonal, ClipboardList,
} from 'lucide-react';
import { fmtDate } from '@/lib/format';

// ── Pipeline column order ────────────────────────────────────────────
const PIPELINE_STATUSES: InvestorStatus[] = [
  'identified', 'contacted', 'nda_signed', 'meeting_scheduled',
  'met', 'engaged', 'in_dd', 'term_sheet', 'closed',
];

const EXIT_STATUSES: InvestorStatus[] = ['passed', 'dropped'];

const STATUS_LABELS: Record<InvestorStatus, string> = {
  identified: 'Identified',
  contacted: 'Contacted',
  nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Set',
  met: 'Met',
  engaged: 'Engaged',
  in_dd: 'In DD',
  term_sheet: 'Term Sheet',
  closed: 'Closed',
  passed: 'Passed',
  dropped: 'Dropped',
};

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
  4: { background: 'var(--white-8)', color: 'var(--text-muted)', boxShadow: 'inset 0 0 0 1px var(--border-subtle)' },
};

const TYPE_LABELS: Record<InvestorType, string> = {
  vc: 'VC',
  growth: 'Growth',
  sovereign: 'Sovereign',
  strategic: 'Strategic',
  debt: 'Debt',
  family_office: 'Family Office',
};

const TYPE_ICONS: Record<InvestorType, React.ComponentType<{ className?: string }>> = {
  vc: Rocket,
  growth: TrendingUp,
  sovereign: Landmark,
  strategic: Shield,
  debt: Banknote,
  family_office: Home,
};

const TYPE_STYLES: Record<InvestorType, React.CSSProperties> = {
  vc: { background: 'var(--accent-muted)', color: 'var(--accent)', boxShadow: 'inset 0 0 0 1px var(--accent-muted)' },
  growth: { background: 'var(--cat-8)', color: 'var(--text-secondary)', boxShadow: 'inset 0 0 0 1px var(--cat-10)' },
  sovereign: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)', boxShadow: 'inset 0 0 0 1px var(--warn-30)' },
  strategic: { background: 'var(--success-muted)', color: 'var(--text-secondary)', boxShadow: 'inset 0 0 0 1px var(--accent-30)' },
  debt: { background: 'var(--warn-12)', color: 'var(--text-tertiary)', boxShadow: 'inset 0 0 0 1px var(--warn-30)' },
  family_office: { background: 'var(--accent-8)', color: 'var(--text-primary)', boxShadow: 'inset 0 0 0 1px var(--accent-10)' },
};

// ── Pipeline velocity stage weights ──────────────────────────────────
const STAGE_WEIGHTS: Record<InvestorStatus, number> = {
  identified: 0, contacted: 1, nda_signed: 2, meeting_scheduled: 3,
  met: 4, engaged: 5, in_dd: 6, term_sheet: 8, closed: 10,
  passed: 0, dropped: 0,
};

// ── Stat icon color map ──────────────────────────────────────────────
const STAT_ICON_COLORS: Record<string, string> = {
  blue: 'var(--accent)',
  purple: 'var(--accent)',
  amber: 'var(--warning)',
  emerald: 'var(--success)',
};

export default function PipelinePage() {
  const { toast } = useToast();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ tiers: Set<number>; types: Set<string> }>({
    tiers: new Set(),
    types: new Set(),
  });
  const [showFilters, setShowFilters] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchInvestors(); }, []);

  async function fetchInvestors() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/investors');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (${res.status})`);
      }
      setInvestors(await res.json());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load investors';
      setFetchError(msg);
      toast(msg, 'error');
    }
    setLoading(false);
  }

  // ── Filtering ────────────────────────────────────────────────────
  const filtered = investors.filter(inv => {
    if (filters.tiers.size > 0 && !filters.tiers.has(inv.tier)) return false;
    if (filters.types.size > 0 && !filters.types.has(inv.type)) return false;
    return true;
  });

  const hasActiveFilters = filters.tiers.size > 0 || filters.types.size > 0;

  function toggleTier(tier: number) {
    setFilters(f => {
      const next = new Set(f.tiers);
      if (next.has(tier)) next.delete(tier); else next.add(tier);
      return { ...f, tiers: next };
    });
  }

  function toggleType(type: string) {
    setFilters(f => {
      const next = new Set(f.types);
      if (next.has(type)) next.delete(type); else next.add(type);
      return { ...f, types: next };
    });
  }

  function clearFilters() {
    setFilters({ tiers: new Set(), types: new Set() });
  }

  // ── Stats ────────────────────────────────────────────────────────
  const activeInvestors = filtered.filter(i => !EXIT_STATUSES.includes(i.status));
  const totalCount = filtered.length;
  const avgEnthusiasm = activeInvestors.length > 0
    ? activeInvestors.reduce((sum, i) => sum + (i.enthusiasm || 0), 0) / activeInvestors.filter(i => i.enthusiasm > 0).length || 0
    : 0;
  const pipelineVelocity = activeInvestors.length > 0
    ? activeInvestors.reduce((sum, i) => sum + STAGE_WEIGHTS[i.status as InvestorStatus], 0) / activeInvestors.length
    : 0;

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

    // Optimistic update
    setInvestors(prev =>
      prev.map(i => i.id === id ? { ...i, status: newStatus as InvestorStatus } : i)
    );
    setDragId(null);

    try {
      const res = await fetch('/api/investors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast(`${investor.name} moved to ${STATUS_LABELS[newStatus as InvestorStatus]}`);
    } catch {
      setInvestors(prev =>
        prev.map(i => i.id === id ? { ...i, status: previousStatus } : i)
      );
      toast('Failed to update status — reverted', 'error');
    }
  }, [investors, toast]);

  // ── Group investors by status ─────────────────────────────────────
  function investorsInStatus(status: InvestorStatus): Investor[] {
    return filtered
      .filter(i => i.status === status)
      .sort((a, b) => {
        // Sort by tier first (lower = better), then by enthusiasm (higher = better)
        if (a.tier !== b.tier) return a.tier - b.tier;
        return (b.enthusiasm || 0) - (a.enthusiasm || 0);
      });
  }

  // ── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton" style={{ height: '2rem', width: '16rem' }} />
        <div className="flex gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '5rem', width: '9rem', borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-3" style={{ minWidth: '260px' }}>
              <div className="skeleton" style={{ height: '2.5rem', borderRadius: 'var(--radius-lg)' }} />
              {[...Array(Math.max(0, 3 - i))].map((_, j) => (
                <div key={j} className="skeleton" style={{ height: '7rem', borderRadius: 'var(--radius-lg)' }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────
  if (fetchError && investors.length === 0) {
    return (
      <div className="page-content flex items-center justify-center" style={{ minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <Users className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--danger)' }} />
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
            Failed to load pipeline
          </h3>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
            {fetchError}
          </p>
          <button
            onClick={fetchInvestors}
            className="btn btn-secondary btn-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content space-y-5 h-full flex flex-col">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="page-title" style={{ fontSize: 'var(--font-size-xl)' }}>Investor Pipeline</h1>
          <p className="page-subtitle" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
            Drag to move through the pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FilterButton
            active={hasActiveFilters}
            count={filters.tiers.size + filters.types.size}
            onClick={() => setShowFilters(!showFilters)}
          />
          <Link
            href="/investors"
            className="btn btn-secondary btn-sm"
          >
            Table View
          </Link>
        </div>
      </div>

      {/* ── Summary Stats ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0 card-stagger">
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Total Investors"
          value={String(totalCount)}
          sub={`${activeInvestors.length} active`}
          iconColor={STAT_ICON_COLORS.blue}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Avg Enthusiasm"
          value={avgEnthusiasm > 0 ? avgEnthusiasm.toFixed(1) : '—'}
          sub="out of 5"
          iconColor={STAT_ICON_COLORS.purple}
        />
        <StatCard
          icon={<Zap className="w-4 h-4" />}
          label="Pipeline Velocity"
          value={pipelineVelocity > 0 ? pipelineVelocity.toFixed(1) : '—'}
          sub="weighted stage avg"
          iconColor={STAT_ICON_COLORS.amber}
        />
        <StatCard
          icon={<Building2 className="w-4 h-4" />}
          label="In DD+"
          value={String(filtered.filter(i => ['in_dd', 'term_sheet', 'closed'].includes(i.status)).length)}
          sub="advanced stage"
          iconColor={STAT_ICON_COLORS.emerald}
        />
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────── */}
      {showFilters && (
        <div
          className="flex-shrink-0 space-y-3"
          style={{
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-4)',
          }}
        >
          <div className="flex items-center justify-between">
            <h3
              className="section-title"
              style={{ marginBottom: 0 }}
            >
              Filters
            </h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 transition-colors"
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              >
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '0.375rem' }}>Tier</span>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map(tier => (
                  <TierFilterButton
                    key={tier}
                    tier={tier}
                    active={filters.tiers.has(tier)}
                    onClick={() => toggleTier(tier)}
                  />
                ))}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '0.375rem' }}>Type</span>
              <div className="flex gap-1.5 flex-wrap">
                {(Object.entries(TYPE_LABELS) as [InvestorType, string][]).map(([key, label]) => (
                  <TypeFilterButton
                    key={key}
                    type={key}
                    label={label}
                    active={filters.types.has(key)}
                    onClick={() => toggleType(key)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Pipeline Summary Strip ──────────────────────────────── */}
      {(() => {
        const totalInv = filtered.length;
        const activeCount = filtered.filter(i => !['passed', 'dropped'].includes(i.status)).length;
        const inDdCount = filtered.filter(i => i.status === 'in_dd').length;
        const termSheetCount = filtered.filter(i => i.status === 'term_sheet').length;
        const closedCount = filtered.filter(i => i.status === 'closed').length;
        const passedCount = filtered.filter(i => i.status === 'passed').length;
        const passRate = totalInv > 0 ? ((passedCount / totalInv) * 100).toFixed(1) : '0.0';
        const convDenom = activeCount + closedCount + passedCount;
        const conversionRate = convDenom > 0 ? ((closedCount / convDenom) * 100).toFixed(1) : '0.0';

        const metrics = [
          { label: 'Total', value: String(totalInv) },
          { label: 'Active', value: String(activeCount) },
          { label: 'In DD', value: String(inDdCount) },
          { label: 'Term Sheets', value: String(termSheetCount) },
          { label: 'Closed', value: String(closedCount), color: 'var(--text-secondary)' },
          { label: 'Pass Rate', value: `${passRate}%`, color: passedCount > 0 ? 'var(--danger)' : undefined },
          { label: 'Conversion', value: `${conversionRate}%`, color: closedCount > 0 ? 'var(--success)' : undefined },
        ];

        return (
          <div
            className="flex items-center gap-6 flex-shrink-0 overflow-x-auto"
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--surface-1)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            {metrics.map((m) => (
              <div key={m.label} className="flex flex-col items-center" style={{ minWidth: '4rem' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 400, whiteSpace: 'nowrap' }}>
                  {m.label}
                </span>
                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 300, color: m.color || 'var(--text-primary)', lineHeight: 1.2 }}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Kanban Board ────────────────────────────────────────── */}
      <div
        ref={boardRef}
        className="flex-1 overflow-x-auto overflow-y-hidden pb-4"
      >
        <div className="flex gap-3 h-full min-w-max">
          {PIPELINE_STATUSES.map(status => {
            const cards = investorsInStatus(status);
            const colors = COLUMN_COLORS[status];
            const isOver = dragOverCol === status;

            return (
              <div
                key={status}
                className="w-[260px] flex flex-col"
                style={{
                  borderRadius: 'var(--radius-xl)',
                  transition: 'all 150ms ease',
                }}
                onDragOver={e => handleDragOver(e, status)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, status)}
              >
                {/* Column header */}
                <div
                  style={{
                    padding: '0.625rem 0.75rem',
                    borderTopLeftRadius: 'var(--radius-xl)',
                    borderTopRightRadius: 'var(--radius-xl)',
                    ...colors.header,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                      {STATUS_LABELS[status]}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 300,
                        padding: '0.125rem 0.375rem',
                        borderRadius: '9999px',
                        ...colors.badge,
                      }}
                    >
                      {cards.length}
                    </span>
                  </div>
                </div>

                {/* Cards container */}
                <div
                  className="flex-1 overflow-y-auto p-2 space-y-2"
                  style={{
                    ...colors.bg,
                    borderBottomLeftRadius: 'var(--radius-xl)',
                    borderBottomRightRadius: 'var(--radius-xl)',
                    minHeight: '120px',
                  }}
                >
                  {cards.map(inv => (
                    <InvestorCard
                      key={inv.id}
                      investor={inv}
                      isDragging={dragId === inv.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                  {cards.length === 0 && (
                    <div
                      className="flex items-center justify-center"
                      style={{ height: '5rem', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center', padding: '0 var(--space-2)' }}
                    >
                      {dragId ? 'Drop here' : 'Drag investors here or add from the investor list'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Exit Row (Passed / Dropped) ─────────────────────────── */}
      {EXIT_STATUSES.some(s => investorsInStatus(s).length > 0 || dragId) && (
        <div
          className="flex-shrink-0 pt-4"
        >
          <div className="flex gap-4">
            {EXIT_STATUSES.map(status => {
              const cards = investorsInStatus(status);
              const colors = COLUMN_COLORS[status];
              const isOver = dragOverCol === status;

              return (
                <div
                  key={status}
                  className="flex-1"
                  style={{
                    borderRadius: 'var(--radius-xl)',
                    transition: 'all 150ms ease',
                  }}
                  onDragOver={e => handleDragOver(e, status)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, status)}
                >
                  <div
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderTopLeftRadius: 'var(--radius-xl)',
                      borderTopRightRadius: 'var(--radius-xl)',
                      ...colors.header,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-secondary)', letterSpacing: '0.01em' }}>
                        {STATUS_LABELS[status]}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 300,
                          padding: '0.125rem 0.375rem',
                          borderRadius: '9999px',
                          ...colors.badge,
                        }}
                      >
                        {cards.length}
                      </span>
                    </div>
                  </div>
                  <div
                    className="p-2"
                    style={{
                      ...colors.bg,
                      borderBottomLeftRadius: 'var(--radius-xl)',
                      borderBottomRightRadius: 'var(--radius-xl)',
                    }}
                  >
                    {cards.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {cards.map(inv => (
                          <InvestorCard
                            key={inv.id}
                            investor={inv}
                            compact
                            isDragging={dragId === inv.id}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                          />
                        ))}
                      </div>
                    ) : (
                      <div
                        className="flex items-center justify-center"
                        style={{ height: '3rem', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}
                      >
                        {dragId ? 'Drop here' : 'None'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
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
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-2 transition-colors"
      style={{
        padding: '0.5rem 0.75rem',
        borderRadius: 'var(--radius-lg)',
        fontSize: 'var(--font-size-sm)',
        fontWeight: 400,
        transition: 'all 150ms ease',
        ...(active
          ? {
              background: 'var(--accent-muted)',
              color: 'var(--accent)',
            }
          : {
              background: 'var(--surface-1)',
              color: hovered ? 'var(--text-secondary)' : 'var(--text-tertiary)',
            }),
      }}
    >
      <Filter className="w-3.5 h-3.5" />
      Filters
      {active && (
        <span
          style={{
            background: 'var(--accent)',
            color: 'var(--text-primary)',
            fontSize: '10px',
            fontWeight: 300,
            padding: '0.125rem 0.375rem',
            borderRadius: '9999px',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
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
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="transition-colors"
      style={{
        padding: '0.25rem 0.625rem',
        borderRadius: 'var(--radius-sm)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 400,
        transition: 'all 150ms ease',
        ...(active
          ? TIER_STYLES[tier]
          : {
              background: 'var(--surface-1)',
              color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
            }),
      }}
    >
      T{tier}
    </button>
  );
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
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="transition-colors"
      style={{
        padding: '0.25rem 0.625rem',
        borderRadius: 'var(--radius-sm)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 400,
        transition: 'all 150ms ease',
        ...(active
          ? TYPE_STYLES[type]
          : {
              background: 'var(--surface-1)',
              color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
            }),
      }}
    >
      {label}
    </button>
  );
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
      style={{
        padding: 'var(--space-3) var(--space-4)',
      }}
    >
      <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-1)' }}>
        <span style={{ color: iconColor }}>{icon}</span>
        <span className="metric-label">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)' }}>{value}</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{sub}</span>
      </div>
    </div>
  );
}

// ── Investor Card Component ──────────────────────────────────────────
function InvestorCard({
  investor,
  compact = false,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  investor: Investor;
  compact?: boolean;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: (e: React.DragEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const TypeIcon = TYPE_ICONS[investor.type as InvestorType] || Building2;

  const isStale = investor.last_meeting_date
    ? Math.floor((Date.now() - new Date(investor.last_meeting_date).getTime()) / (1000 * 60 * 60 * 24)) >= 14
    : false;

  const tierGlow = hovered
    ? investor.tier === 1
      ? 'none'
      : investor.tier === 2
        ? 'none'
        : 'none'
    : 'none';

  const cardBaseStyle: React.CSSProperties = {
    background: hovered ? 'var(--surface-2)' : 'var(--surface-1)',
    borderRadius: 'var(--radius-lg)',
    cursor: 'grab',
    transition: 'all 150ms ease',
    boxShadow: tierGlow,
    borderLeft: isStale ? '3px solid var(--danger)' : 'none',
    ...(isDragging ? { opacity: 0.5, transform: 'scale(0.95)' } : {}),
  };

  if (compact) {
    return (
      <div
        draggable
        onDragStart={e => onDragStart(e, investor.id)}
        onDragEnd={onDragEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="transition-colors"
        style={{
          ...cardBaseStyle,
          padding: '0.5rem 0.75rem',
        }}
      >
        <Link href={`/investors/${investor.id}`} className="flex items-center gap-2">
          <GripVertical className="w-3 h-3 flex-shrink-0" style={{ color: hovered ? 'var(--text-muted)' : 'var(--border-strong)' }} />
          <span className="truncate" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-secondary)' }}>{investor.name}</span>
          <span
            style={{
              padding: '0.125rem 0.375rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '10px',
              fontWeight: 400,
              ...TIER_STYLES[investor.tier],
            }}
          >
            T{investor.tier}
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, investor.id)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="transition-colors"
      style={{
        ...cardBaseStyle,
        padding: 'var(--space-3)',
      }}
    >
      <Link href={`/investors/${investor.id}`} className="block space-y-2.5" draggable={false}>
        {/* Top row: name + drag handle */}
        <div className="flex items-start justify-between gap-1">
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 400,
              color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
              lineHeight: 1.3,
              transition: 'color 150ms ease',
            }}
          >
            {investor.name}
          </span>
          <GripVertical
            className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
            style={{ color: hovered ? 'var(--text-muted)' : 'var(--border-strong)' }}
          />
        </div>

        {/* Badges row: type + tier */}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1"
            style={{
              padding: '0.125rem 0.375rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '10px',
              fontWeight: 400,
              ...TYPE_STYLES[investor.type as InvestorType],
            }}
          >
            <TypeIcon className="w-2.5 h-2.5" />
            {TYPE_LABELS[investor.type as InvestorType] ?? investor.type}
          </span>
          <span
            style={{
              padding: '0.125rem 0.375rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '10px',
              fontWeight: 400,
              ...TIER_STYLES[investor.tier],
            }}
          >
            T{investor.tier}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-1">
          {investor.partner && (
            <div className="truncate" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Partner:</span> {investor.partner}
            </div>
          )}
          {investor.fund_size && (
            <div className="truncate" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Fund:</span> {investor.fund_size}
            </div>
          )}
        </div>

        {/* Enthusiasm + last contact row */}
        <div className="flex items-center justify-between">
          {investor.enthusiasm > 0 ? (
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Signal</span>
              <div className="enthusiasm-dots">
                {[1, 2, 3, 4, 5].map(n => (
                  <div
                    key={n}
                    className="enthusiasm-dot"
                    style={{
                      background: n <= investor.enthusiasm
                        ? investor.enthusiasm >= 4
                          ? 'var(--success)'
                          : investor.enthusiasm >= 3
                          ? 'var(--accent)'
                          : 'var(--text-muted)'
                        : 'var(--border-default)',
                    }}
                  />
                ))}
              </div>
            </div>
          ) : <div />}
          {(() => {
            const lastDate = investor.last_meeting_date;
            if (!lastDate) return <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>No meetings</span>;
            const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
            const isStale = days >= 14;
            const isWarning = days >= 7 && days < 14;
            return (
              <span
                style={{
                  fontSize: '10px',
                  color: isStale ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--text-muted)',
                  fontWeight: 400,
                }}
                title={`Last meeting: ${fmtDate(lastDate)}`}
              >
                {days === 0 ? 'Today' : `${days}d ago`}
              </span>
            );
          })()}
        </div>
      </Link>

      {/* Quick actions on hover */}
      {hovered && (
        <div
          className="flex items-center gap-1 pt-2 mt-2"
        >
          <Link
            href={`/meetings/prep?investor=${investor.id}`}
            onClick={e => e.stopPropagation()}
            draggable={false}
            className="flex items-center gap-1 flex-1 justify-center transition-colors"
            style={{
              fontSize: '10px', color: 'var(--text-muted)',
              padding: '2px 0', borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-muted)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <ClipboardList className="w-3 h-3" /> Prep
          </Link>
          <Link
            href={`/meetings/new?investor=${investor.id}`}
            onClick={e => e.stopPropagation()}
            draggable={false}
            className="flex items-center gap-1 flex-1 justify-center transition-colors"
            style={{
              fontSize: '10px', color: 'var(--text-muted)',
              padding: '2px 0', borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-muted)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Calendar className="w-3 h-3" /> Log
          </Link>
          <Link
            href={`/followups?investor=${investor.id}`}
            onClick={e => e.stopPropagation()}
            draggable={false}
            className="flex items-center gap-1 flex-1 justify-center transition-colors"
            style={{
              fontSize: '10px', color: 'var(--text-muted)',
              padding: '2px 0', borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-muted)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <SendHorizonal className="w-3 h-3" /> Follow up
          </Link>
        </div>
      )}
    </div>
  );
}

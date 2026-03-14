'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { Investor, InvestorStatus, InvestorTier, InvestorType } from '@/lib/types';
import { useToast } from '@/components/toast';
import {
  Users, TrendingUp, Zap, Filter, X, GripVertical,
  Building2, Landmark, Shield, Banknote, Home, Rocket,
} from 'lucide-react';

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

// Color gradient: cool (early) → warm (late)
const COLUMN_COLORS: Record<InvestorStatus, { header: string; border: string; bg: string; badge: string }> = {
  identified:        { header: 'bg-slate-800/60',   border: 'border-slate-700/50',  bg: 'bg-slate-900/20',  badge: 'bg-slate-700 text-slate-300' },
  contacted:         { header: 'bg-blue-900/40',    border: 'border-blue-800/40',   bg: 'bg-blue-950/10',   badge: 'bg-blue-800 text-blue-300' },
  nda_signed:        { header: 'bg-blue-800/40',    border: 'border-blue-700/40',   bg: 'bg-blue-950/15',   badge: 'bg-blue-700 text-blue-200' },
  meeting_scheduled: { header: 'bg-indigo-900/40',  border: 'border-indigo-700/40', bg: 'bg-indigo-950/10', badge: 'bg-indigo-700 text-indigo-200' },
  met:               { header: 'bg-violet-900/40',  border: 'border-violet-700/40', bg: 'bg-violet-950/10', badge: 'bg-violet-700 text-violet-200' },
  engaged:           { header: 'bg-purple-900/40',  border: 'border-purple-700/40', bg: 'bg-purple-950/10', badge: 'bg-purple-700 text-purple-200' },
  in_dd:             { header: 'bg-amber-900/40',   border: 'border-amber-700/40',  bg: 'bg-amber-950/10',  badge: 'bg-amber-700 text-amber-200' },
  term_sheet:        { header: 'bg-orange-900/40',  border: 'border-orange-700/40', bg: 'bg-orange-950/10', badge: 'bg-orange-700 text-orange-200' },
  closed:            { header: 'bg-emerald-900/40', border: 'border-emerald-700/40',bg: 'bg-emerald-950/10',badge: 'bg-emerald-700 text-emerald-200' },
  passed:            { header: 'bg-red-900/30',     border: 'border-red-800/40',    bg: 'bg-red-950/10',    badge: 'bg-red-800 text-red-300' },
  dropped:           { header: 'bg-zinc-800/40',    border: 'border-zinc-700/40',   bg: 'bg-zinc-900/20',   badge: 'bg-zinc-700 text-zinc-400' },
};

const TIER_COLORS: Record<number, string> = {
  1: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  2: 'bg-purple-600/20 text-purple-400 border-purple-600/30',
  3: 'bg-zinc-600/20 text-zinc-400 border-zinc-600/30',
  4: 'bg-zinc-800/50 text-zinc-500 border-zinc-700/30',
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

const TYPE_COLORS: Record<InvestorType, string> = {
  vc: 'bg-blue-900/30 text-blue-400 border-blue-700/30',
  growth: 'bg-purple-900/30 text-purple-400 border-purple-700/30',
  sovereign: 'bg-amber-900/30 text-amber-400 border-amber-700/30',
  strategic: 'bg-emerald-900/30 text-emerald-400 border-emerald-700/30',
  debt: 'bg-orange-900/30 text-orange-400 border-orange-700/30',
  family_office: 'bg-rose-900/30 text-rose-400 border-rose-700/30',
};

// ── Pipeline velocity stage weights ──────────────────────────────────
const STAGE_WEIGHTS: Record<InvestorStatus, number> = {
  identified: 0, contacted: 1, nda_signed: 2, meeting_scheduled: 3,
  met: 4, engaged: 5, in_dd: 6, term_sheet: 8, closed: 10,
  passed: 0, dropped: 0,
};

export default function PipelinePage() {
  const { toast } = useToast();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
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
    try {
      const res = await fetch('/api/investors');
      if (!res.ok) throw new Error('Failed to fetch');
      setInvestors(await res.json());
    } catch {
      toast('Failed to load investors', 'error');
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
    // Make drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDragId(null);
    setDragOverCol(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
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
      toast('Failed to update status', 'error');
      fetchInvestors(); // Revert on failure
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
        <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse" />
        <div className="flex gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 w-36 bg-zinc-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="min-w-[260px] space-y-3">
              <div className="h-10 bg-zinc-800/50 rounded-lg animate-pulse" />
              {[...Array(Math.max(0, 3 - i))].map((_, j) => (
                <div key={j} className="h-28 bg-zinc-800/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 h-full flex flex-col">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investor Pipeline</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Drag investors across stages to update status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
              hasActiveFilters
                ? 'bg-blue-600/20 border-blue-600/40 text-blue-400'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {hasActiveFilters && (
              <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {filters.tiers.size + filters.types.size}
              </span>
            )}
          </button>
          <Link
            href="/investors"
            className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors"
          >
            Table View
          </Link>
        </div>
      </div>

      {/* ── Summary Stats ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Total Investors"
          value={String(totalCount)}
          sub={`${activeInvestors.length} active`}
          color="text-blue-400"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Avg Enthusiasm"
          value={avgEnthusiasm > 0 ? avgEnthusiasm.toFixed(1) : '---'}
          sub="out of 5"
          color="text-purple-400"
        />
        <StatCard
          icon={<Zap className="w-4 h-4" />}
          label="Pipeline Velocity"
          value={pipelineVelocity > 0 ? pipelineVelocity.toFixed(1) : '---'}
          sub="weighted stage avg"
          color="text-amber-400"
        />
        <StatCard
          icon={<Building2 className="w-4 h-4" />}
          label="In DD+"
          value={String(filtered.filter(i => ['in_dd', 'term_sheet', 'closed'].includes(i.status)).length)}
          sub="advanced stage"
          color="text-emerald-400"
        />
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────── */}
      {showFilters && (
        <div className="border border-zinc-800 rounded-xl p-4 space-y-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <span className="text-xs text-zinc-600 block mb-1.5">Tier</span>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map(tier => (
                  <button
                    key={tier}
                    onClick={() => toggleTier(tier)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
                      filters.tiers.has(tier)
                        ? TIER_COLORS[tier]
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    T{tier}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs text-zinc-600 block mb-1.5">Type</span>
              <div className="flex gap-1.5 flex-wrap">
                {(Object.entries(TYPE_LABELS) as [InvestorType, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => toggleType(key)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors border ${
                      filters.types.has(key)
                        ? TYPE_COLORS[key]
                        : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
                className={`w-[260px] flex flex-col rounded-xl border transition-colors ${colors.border} ${
                  isOver ? 'ring-2 ring-blue-500/40 border-blue-600/50' : ''
                }`}
                onDragOver={e => handleDragOver(e, status)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, status)}
              >
                {/* Column header */}
                <div className={`px-3 py-2.5 rounded-t-xl ${colors.header} border-b ${colors.border}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200 tracking-wide">
                      {STATUS_LABELS[status]}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colors.badge}`}>
                      {cards.length}
                    </span>
                  </div>
                </div>

                {/* Cards container */}
                <div className={`flex-1 overflow-y-auto p-2 space-y-2 ${colors.bg} rounded-b-xl min-h-[120px]`}>
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
                    <div className="flex items-center justify-center h-20 text-zinc-700 text-xs">
                      Drop here
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
        <div className="flex-shrink-0 border-t border-zinc-800 pt-4">
          <div className="flex gap-4">
            {EXIT_STATUSES.map(status => {
              const cards = investorsInStatus(status);
              const colors = COLUMN_COLORS[status];
              const isOver = dragOverCol === status;

              return (
                <div
                  key={status}
                  className={`flex-1 rounded-xl border transition-colors ${colors.border} ${
                    isOver ? 'ring-2 ring-blue-500/40 border-blue-600/50' : ''
                  }`}
                  onDragOver={e => handleDragOver(e, status)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, status)}
                >
                  <div className={`px-3 py-2 rounded-t-xl ${colors.header} border-b ${colors.border}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-300 tracking-wide">
                        {STATUS_LABELS[status]}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colors.badge}`}>
                        {cards.length}
                      </span>
                    </div>
                  </div>
                  <div className={`p-2 ${colors.bg} rounded-b-xl`}>
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
                      <div className="flex items-center justify-center h-12 text-zinc-700 text-xs">
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

// ── Stat Card Component ──────────────────────────────────────────────
function StatCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="border border-zinc-800 rounded-xl px-4 py-3 bg-zinc-900/30">
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold text-zinc-100">{value}</span>
        <span className="text-[10px] text-zinc-600">{sub}</span>
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
  const TypeIcon = TYPE_ICONS[investor.type as InvestorType] || Building2;

  if (compact) {
    return (
      <div
        draggable
        onDragStart={e => onDragStart(e, investor.id)}
        onDragEnd={onDragEnd}
        className={`group bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing transition-all hover:border-zinc-700 ${
          isDragging ? 'opacity-50 scale-95' : ''
        }`}
      >
        <Link href={`/investors/${investor.id}`} className="flex items-center gap-2">
          <GripVertical className="w-3 h-3 text-zinc-700 group-hover:text-zinc-500 flex-shrink-0" />
          <span className="text-xs font-medium text-zinc-300 truncate">{investor.name}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${TIER_COLORS[investor.tier]}`}>
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
      className={`group bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all hover:border-zinc-700 hover:bg-zinc-900 ${
        isDragging ? 'opacity-50 scale-95' : ''
      }`}
    >
      <Link href={`/investors/${investor.id}`} className="block space-y-2.5" draggable={false}>
        {/* Top row: name + drag handle */}
        <div className="flex items-start justify-between gap-1">
          <span className="text-sm font-medium text-zinc-200 leading-tight group-hover:text-white transition-colors">
            {investor.name}
          </span>
          <GripVertical className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 flex-shrink-0 mt-0.5" />
        </div>

        {/* Badges row: type + tier */}
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${TYPE_COLORS[investor.type as InvestorType]}`}>
            <TypeIcon className="w-2.5 h-2.5" />
            {TYPE_LABELS[investor.type as InvestorType] ?? investor.type}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${TIER_COLORS[investor.tier]}`}>
            T{investor.tier}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-1">
          {investor.partner && (
            <div className="text-[11px] text-zinc-500 truncate">
              <span className="text-zinc-600">Partner:</span> {investor.partner}
            </div>
          )}
          {investor.fund_size && (
            <div className="text-[11px] text-zinc-500 truncate">
              <span className="text-zinc-600">Fund:</span> {investor.fund_size}
            </div>
          )}
        </div>

        {/* Enthusiasm dots */}
        {investor.enthusiasm > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-600">Signal</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(n => (
                <div
                  key={n}
                  className={`w-1.5 h-1.5 rounded-full ${
                    n <= investor.enthusiasm
                      ? investor.enthusiasm >= 4
                        ? 'bg-emerald-500'
                        : investor.enthusiasm >= 3
                        ? 'bg-blue-500'
                        : 'bg-zinc-500'
                      : 'bg-zinc-800'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </Link>
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity, Flame, Gauge, Clock, AlertTriangle,
  TrendingUp, TrendingDown, Minus, RefreshCw, ArrowRight,
  Users, Filter,
} from 'lucide-react';

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
}

type SortKey = 'heat' | 'velocity' | 'momentum' | 'days' | 'name';
type HeatFilter = 'all' | 'hot' | 'warm' | 'cool' | 'cold' | 'frozen';

// ── Config ────────────────────────────────────────────────────────────

const HEAT_CONFIG: Record<string, { bg: string; border: string; text: string; glow: string; label: string }> = {
  hot:    { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.5)',  text: '#ef4444', glow: '0 0 20px rgba(239, 68, 68, 0.3)', label: 'HOT' },
  warm:   { bg: 'rgba(234, 179, 8, 0.12)',  border: 'rgba(234, 179, 8, 0.4)',  text: '#eab308', glow: '0 0 12px rgba(234, 179, 8, 0.2)', label: 'WARM' },
  cool:   { bg: 'rgba(59, 130, 246, 0.10)', border: 'rgba(59, 130, 246, 0.35)', text: '#3b82f6', glow: 'none', label: 'COOL' },
  cold:   { bg: 'rgba(148, 163, 184, 0.10)', border: 'rgba(148, 163, 184, 0.3)', text: '#94a3b8', glow: 'none', label: 'COLD' },
  frozen: { bg: 'rgba(100, 116, 139, 0.08)', border: 'rgba(100, 116, 139, 0.25)', text: '#64748b', glow: 'none', label: 'FROZEN' },
};

const TYPE_LABELS: Record<string, string> = {
  vc: 'VC', growth: 'Growth', sovereign: 'SWF', strategic: 'Strategic',
  debt: 'Debt', family_office: 'Family',
};

const STATUS_LABELS: Record<string, string> = {
  identified: 'Identified', contacted: 'Contacted', nda_signed: 'NDA',
  meeting_scheduled: 'Meeting Set', met: 'Met', engaged: 'Engaged',
  in_dd: 'In DD', term_sheet: 'Term Sheet', closed: 'Closed',
};

const HEAT_ORDER: Record<string, number> = { hot: 0, warm: 1, cool: 2, cold: 3, frozen: 4 };

// ── Helpers ───────────────────────────────────────────────────────────

function velocityColor(score: number): string {
  if (score >= 70) return 'var(--success)';
  if (score >= 40) return 'var(--warning)';
  return 'var(--danger)';
}

function trackingColor(status: string): string {
  if (status === 'on_track') return 'var(--success)';
  if (status === 'behind') return 'var(--warning)';
  return 'var(--danger)';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <span style={{ color: 'var(--success)' }}><TrendingUp className="w-4 h-4" /></span>;
  if (trend === 'down') return <span style={{ color: 'var(--danger)' }}><TrendingDown className="w-4 h-4" /></span>;
  return <span style={{ color: 'var(--text-muted)' }}><Minus className="w-4 h-4" /></span>;
}

function relativeDate(d: string | null): string {
  if (!d) return 'Never';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
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
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [velRes, heatRes, momRes] = await Promise.allSettled([
        fetch('/api/velocity').then(r => r.json()),
        fetch('/api/deal-heat').then(r => r.json()),
        fetch('/api/momentum').then(r => r.json()),
      ]);

      const velData = velRes.status === 'fulfilled' ? velRes.value : null;
      const heatData = heatRes.status === 'fulfilled' ? heatRes.value : null;
      const momData = momRes.status === 'fulfilled' ? momRes.value : null;

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
          });
        }
      }

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
            });
          }
        }
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
          }
        }
      }

      setInvestors(Array.from(map.values()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sort & filter
  const filtered = investors
    .filter(inv => heatFilter === 'all' || inv.heat === heatFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'heat': return HEAT_ORDER[a.heat] - HEAT_ORDER[b.heat];
        case 'velocity': return b.velocityScore - a.velocityScore;
        case 'momentum': return b.currentMomentum - a.currentMomentum;
        case 'days': return a.daysInProcess - b.daysInProcess;
        case 'name': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });

  // Summary counts
  const counts = { hot: 0, warm: 0, cool: 0, cold: 0, frozen: 0, atRisk: 0, onTrack: 0 };
  for (const inv of investors) {
    counts[inv.heat as keyof typeof counts]++;
    if (inv.trackingStatus === 'at_risk') counts.atRisk++;
    if (inv.trackingStatus === 'on_track') counts.onTrack++;
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-[1400px] mx-auto" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Dealflow</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '2px' }}>
            Investor health: heat, velocity, and momentum in one view
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}
        >
          <span style={{ color: 'var(--text-muted)' }}><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></span>
          Refresh
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {[
          { label: 'Hot', count: counts.hot, color: HEAT_CONFIG.hot.text, icon: Flame },
          { label: 'Warm', count: counts.warm, color: HEAT_CONFIG.warm.text, icon: Flame },
          { label: 'Cool', count: counts.cool, color: HEAT_CONFIG.cool.text, icon: Flame },
          { label: 'Cold', count: counts.cold, color: HEAT_CONFIG.cold.text, icon: Flame },
          { label: 'Frozen', count: counts.frozen, color: HEAT_CONFIG.frozen.text, icon: Flame },
          { label: 'On Track', count: counts.onTrack, color: 'var(--success)', icon: Gauge },
          { label: 'At Risk', count: counts.atRisk, color: 'var(--danger)', icon: AlertTriangle },
        ].map(({ label, count, color, icon: Icon }) => (
          <div
            key={label}
            className="rounded-lg p-3 text-center"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span style={{ color }}><Icon className="w-3.5 h-3.5" /></span>
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>{label}</span>
            </div>
            <div className="text-xl font-bold" style={{ color }}>{count}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
          <span><Filter className="w-3 h-3" /></span> Heat:
        </div>
        {(['all', 'hot', 'warm', 'cool', 'cold', 'frozen'] as HeatFilter[]).map(h => (
          <button
            key={h}
            onClick={() => setHeatFilter(h)}
            className="px-2.5 py-1 rounded-md text-xs"
            style={{
              background: heatFilter === h ? 'var(--surface-3)' : 'transparent',
              color: heatFilter === h ? 'var(--text-primary)' : 'var(--text-muted)',
              border: heatFilter === h ? '1px solid var(--border-default)' : '1px solid transparent',
            }}
          >
            {h === 'all' ? 'All' : h.charAt(0).toUpperCase() + h.slice(1)}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }} className="flex items-center gap-1.5">
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>Sort:</span>
          {(['heat', 'velocity', 'momentum', 'days', 'name'] as SortKey[]).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className="px-2.5 py-1 rounded-md text-xs"
              style={{
                background: sortBy === s ? 'var(--accent-muted)' : 'transparent',
                color: sortBy === s ? 'var(--accent)' : 'var(--text-muted)',
                border: sortBy === s ? '1px solid var(--accent)' : '1px solid transparent',
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg p-4 mb-4" style={{ background: 'var(--danger-muted)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !investors.length && (
        <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
          <span><RefreshCw className="w-5 h-5 animate-spin" /></span>
          <span className="ml-2">Loading dealflow...</span>
        </div>
      )}

      {/* Investor Table */}
      {filtered.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-0)' }}>
          {/* Header row */}
          <div
            className="grid gap-3 px-4 py-2.5"
            style={{
              gridTemplateColumns: '2fr 80px 90px 80px 70px 60px 1.5fr 80px',
              background: 'var(--surface-1)',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-muted)',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            <div>Investor</div>
            <div className="text-center">Heat</div>
            <div className="text-center">Velocity</div>
            <div className="text-center">Trend</div>
            <div className="text-center">Days</div>
            <div className="text-center">Track</div>
            <div>Bottleneck</div>
            <div className="text-center">Last Meet</div>
          </div>

          {/* Data rows */}
          {filtered.map(inv => {
            const heatCfg = HEAT_CONFIG[inv.heat] || HEAT_CONFIG.cool;
            const isHovered = hoveredRow === inv.id;
            return (
              <Link
                key={inv.id}
                href={`/investors/${inv.id}`}
                className="grid gap-3 px-4 py-3 items-center transition-colors"
                style={{
                  gridTemplateColumns: '2fr 80px 90px 80px 70px 60px 1.5fr 80px',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: isHovered ? 'var(--surface-1)' : 'transparent',
                  boxShadow: inv.heat === 'hot' ? heatCfg.glow : 'none',
                  textDecoration: 'none',
                }}
                onMouseEnter={() => setHoveredRow(inv.id)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                {/* Investor */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{ background: heatCfg.bg, color: heatCfg.text, border: `1px solid ${heatCfg.border}` }}
                  >
                    {inv.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate" style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
                      {inv.name}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                      {TYPE_LABELS[inv.type] || inv.type} · T{inv.tier} · {STATUS_LABELS[inv.status] || inv.status}
                    </div>
                  </div>
                </div>

                {/* Heat Badge */}
                <div className="flex justify-center">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: heatCfg.bg, color: heatCfg.text, border: `1px solid ${heatCfg.border}` }}
                  >
                    {heatCfg.label}
                  </span>
                </div>

                {/* Velocity Score */}
                <div className="flex items-center justify-center gap-1.5">
                  <div
                    className="w-10 h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'var(--surface-3)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(inv.velocityScore, 100)}%`, background: velocityColor(inv.velocityScore) }}
                    />
                  </div>
                  <span style={{ color: velocityColor(inv.velocityScore), fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>
                    {inv.velocityScore}
                  </span>
                </div>

                {/* Momentum Trend */}
                <div className="flex items-center justify-center gap-1">
                  <TrendIcon trend={inv.trend} />
                  <span style={{
                    color: inv.trend === 'up' ? 'var(--success)' : inv.trend === 'down' ? 'var(--danger)' : 'var(--text-muted)',
                    fontSize: 'var(--font-size-xs)',
                  }}>
                    {inv.currentMomentum > 0 ? inv.currentMomentum.toFixed(0) : '—'}
                  </span>
                </div>

                {/* Days in Process */}
                <div className="text-center" style={{ fontSize: 'var(--font-size-sm)', color: inv.daysInProcess > 45 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                  {inv.daysInProcess > 0 ? `${inv.daysInProcess}d` : '—'}
                </div>

                {/* Tracking Status */}
                <div className="flex justify-center">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: trackingColor(inv.trackingStatus) }}
                    title={inv.trackingStatus.replace('_', ' ')}
                  />
                </div>

                {/* Bottleneck */}
                <div className="truncate" style={{ fontSize: 'var(--font-size-xs)' }} onClick={e => e.preventDefault()}>
                  {inv.bottleneck ? (
                    <Link
                      href={
                        /meeting|call|schedule/i.test(inv.bottleneck) ? `/meetings/new?investor=${inv.id}` :
                        /follow.?up|outreach|nudge/i.test(inv.bottleneck) ? `/followups?investor=${inv.id}` :
                        /doc|data.?room|material/i.test(inv.bottleneck) ? `/data-room` :
                        /objection|concern|pushback/i.test(inv.bottleneck) ? `/objections` :
                        `/investors/${inv.id}`
                      }
                      className="inline-flex items-center gap-1"
                      style={{ color: 'var(--warning)', textDecoration: 'none' }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#fbbf24'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--warning)'; }}
                    >
                      <span className="truncate">{inv.bottleneck}</span>
                      <ArrowRight className="w-3 h-3 shrink-0" style={{ opacity: 0.7 }} />
                    </Link>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  )}
                </div>

                {/* Last Meeting */}
                <div className="text-center" style={{
                  fontSize: 'var(--font-size-xs)',
                  color: inv.daysSinceLastMeeting > 14 ? 'var(--danger)' : 'var(--text-muted)',
                }}>
                  {relativeDate(inv.lastMeeting)}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <Users className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
            {heatFilter !== 'all' ? `No ${heatFilter} investors` : 'No investors scored yet'}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {heatFilter !== 'all' ? (
              <button
                onClick={() => setHeatFilter('all')}
                style={{ color: 'var(--accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Clear filter to see all {investors.length} investors
              </button>
            ) : (
              <>Log meetings to start generating heat scores. <Link href="/meetings/new" style={{ color: 'var(--accent)' }}>Log a meeting</Link></>
            )}
          </p>
        </div>
      )}

      {/* Footer info */}
      {investors.length > 0 && (
        <div className="flex items-center justify-between mt-4" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
          <span>{filtered.length} of {investors.length} investors</span>
          <span>Combines heat, velocity, and momentum data</span>
        </div>
      )}
    </div>
  );
}

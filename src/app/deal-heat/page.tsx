'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flame, Filter, TrendingUp, Users, Thermometer } from 'lucide-react';

interface DealHeatInvestor {
  id: string;
  name: string;
  type: string;
  tier: number;
  status: string;
  dealHeat: {
    heat: number;
    label: 'hot' | 'warm' | 'cool' | 'cold' | 'frozen';
    drivers: string[];
  };
  enthusiasm: number;
  lastMeeting: string | null;
}

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

const HEAT_CONFIG: Record<string, { bg: string; border: string; text: string; glow: string; label: string }> = {
  hot:    { bg: 'rgba(196, 90, 90, 0.15)', border: 'rgba(196, 90, 90, 0.5)',  text: '#c45a5a', glow: '0 0 20px rgba(196, 90, 90, 0.3)', label: 'Hot' },
  warm:   { bg: 'rgba(234, 179, 8, 0.12)',  border: 'rgba(234, 179, 8, 0.4)',  text: '#c4a35a', glow: '0 0 12px rgba(234, 179, 8, 0.2)', label: 'Warm' },
  cool:   { bg: 'rgba(74, 111, 165, 0.10)', border: 'rgba(74, 111, 165, 0.35)', text: '#4a6fa5', glow: 'none', label: 'Cool' },
  cold:   { bg: 'rgba(148, 163, 184, 0.10)', border: 'rgba(148, 163, 184, 0.3)', text: '#8b8fa3', glow: 'none', label: 'Cold' },
  frozen: { bg: 'rgba(100, 116, 139, 0.08)', border: 'rgba(100, 116, 139, 0.25)', text: '#5c6178', glow: 'none', label: 'Frozen' },
};

const TYPE_LABELS: Record<string, string> = {
  vc: 'VC',
  growth: 'Growth',
  sovereign: 'Sovereign',
  strategic: 'Strategic',
  debt: 'Debt',
  family_office: 'Family Office',
};

const STATUS_LABELS: Record<string, string> = {
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

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function DealHeatPage() {
  const [data, setData] = useState<DealHeatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<HeatLevel>('all');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredFilter, setHoveredFilter] = useState<HeatLevel | null>(null);

  useEffect(() => {
    fetch('/api/deal-heat')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch deal heat data');
        return res.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex-1 p-6" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-8)' }}>
          <div className="skeleton" style={{ width: '240px', height: '32px' }} />
        </div>
        <div className="grid grid-cols-5 gap-3" style={{ marginBottom: 'var(--space-6)' }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="card skeleton" style={{ height: '80px' }} />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="card skeleton" style={{ height: '160px' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <span style={{ color: 'var(--danger)', fontSize: 'var(--font-size-lg)' }}>
            {error || 'Failed to load deal heat data'}
          </span>
        </div>
      </div>
    );
  }

  const { investors, counts } = data;
  const filtered = filter === 'all' ? investors : investors.filter(inv => inv.dealHeat.label === filter);
  const avgHeat = investors.length > 0 ? Math.round(investors.reduce((s, i) => s + i.dealHeat.heat, 0) / investors.length) : 0;

  const filterButtons: { level: HeatLevel; label: string; count: number }[] = [
    { level: 'all', label: 'All', count: counts.total },
    { level: 'hot', label: 'Hot', count: counts.hot },
    { level: 'warm', label: 'Warm', count: counts.warm },
    { level: 'cool', label: 'Cool', count: counts.cool },
    { level: 'cold', label: 'Cold', count: counts.cold },
    { level: 'frozen', label: 'Frozen', count: counts.frozen },
  ];

  return (
    <div className="flex-1 p-6" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="flex items-center gap-3">
          <span style={{ color: '#c45a5a' }}>
            <Flame className="w-7 h-7" />
          </span>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              Deal Heat Map
            </h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: '2px' }}>
              Composite deal temperature across {counts.total} active investors
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-2"
          style={{
            padding: 'var(--space-2) var(--space-3)',
            background: 'var(--surface-1)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>
            <Thermometer className="w-4 h-4" />
          </span>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            Avg Heat:
          </span>
          <span style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 700,
            color: avgHeat >= 80 ? '#c45a5a' : avgHeat >= 60 ? '#c4a35a' : avgHeat >= 40 ? '#4a6fa5' : '#8b8fa3',
          }}>
            {avgHeat}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-3" style={{ marginBottom: 'var(--space-6)' }}>
        {(['hot', 'warm', 'cool', 'cold', 'frozen'] as const).map(level => {
          const cfg = HEAT_CONFIG[level];
          const count = counts[level];
          return (
            <div
              key={level}
              className="card"
              style={{
                padding: 'var(--space-4)',
                border: `1px solid ${cfg.border}`,
                background: cfg.bg,
                cursor: 'pointer',
                boxShadow: cfg.glow,
                transition: 'transform 150ms ease',
                transform: hoveredFilter === level ? 'translateY(-2px)' : 'none',
              }}
              onClick={() => setFilter(filter === level ? 'all' : level)}
              onMouseEnter={() => setHoveredFilter(level)}
              onMouseLeave={() => setHoveredFilter(null)}
            >
              <div style={{ fontSize: 'var(--font-size-xs)', color: cfg.text, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                {cfg.label}
              </div>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: cfg.text, marginTop: 'var(--space-1)' }}>
                {count}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                {count === 1 ? 'investor' : 'investors'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 'var(--space-5)' }}>
        <span style={{ color: 'var(--text-muted)' }}>
          <Filter className="w-4 h-4" />
        </span>
        {filterButtons.map(fb => {
          const active = filter === fb.level;
          const cfg = fb.level !== 'all' ? HEAT_CONFIG[fb.level] : null;
          return (
            <button
              key={fb.level}
              onClick={() => setFilter(fb.level)}
              className="flex items-center gap-1.5"
              style={{
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: active ? 600 : 400,
                background: active ? (cfg ? cfg.bg : 'var(--surface-2)') : 'transparent',
                border: active ? `1px solid ${cfg ? cfg.border : 'var(--border-default)'}` : '1px solid transparent',
                color: active ? (cfg ? cfg.text : 'var(--text-primary)') : 'var(--text-tertiary)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {fb.label}
              <span style={{
                fontSize: 'var(--font-size-xs)',
                opacity: 0.7,
              }}>
                {fb.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Heat Grid */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-lg)' }}>
            No investors at this heat level
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(inv => {
            const cfg = HEAT_CONFIG[inv.dealHeat.label];
            const isHovered = hoveredCard === inv.id;
            const topDriver = inv.dealHeat.drivers.length > 0 ? inv.dealHeat.drivers[0] : null;
            return (
              <Link
                key={inv.id}
                href={`/investors/${inv.id}`}
                className="block"
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="card"
                  style={{
                    padding: 'var(--space-4)',
                    border: `1px solid ${isHovered ? cfg.text : cfg.border}`,
                    background: isHovered ? cfg.bg : 'var(--surface-0)',
                    boxShadow: isHovered ? cfg.glow : 'var(--shadow-sm)',
                    transition: 'all 200ms ease',
                    transform: isHovered ? 'translateY(-3px)' : 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={() => setHoveredCard(inv.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  {/* Heat bar at top */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: `linear-gradient(90deg, ${cfg.text} ${inv.dealHeat.heat}%, transparent ${inv.dealHeat.heat}%)`,
                  }} />

                  {/* Header row */}
                  <div className="flex items-start justify-between" style={{ marginTop: 'var(--space-1)' }}>
                    <div className="min-w-0 flex-1">
                      <div style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {inv.name}
                      </div>
                      <div className="flex items-center gap-2" style={{ marginTop: '4px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface-2)',
                          color: 'var(--text-secondary)',
                        }}>
                          {TYPE_LABELS[inv.type] || inv.type}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                        }}>
                          T{inv.tier}
                        </span>
                      </div>
                    </div>
                    {/* Heat score circle */}
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      background: cfg.bg,
                      border: `2px solid ${cfg.border}`,
                      boxShadow: inv.dealHeat.label === 'hot' ? '0 0 12px rgba(196, 90, 90, 0.25)' : 'none',
                      flexShrink: 0,
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: cfg.text,
                        lineHeight: 1,
                      }}>
                        {inv.dealHeat.heat}
                      </span>
                    </div>
                  </div>

                  {/* Heat label */}
                  <div className="flex items-center gap-2" style={{ marginTop: 'var(--space-3)' }}>
                    <span style={{
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 600,
                      color: cfg.text,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {cfg.label}
                    </span>
                    <span style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--text-muted)',
                    }}>
                      {STATUS_LABELS[inv.status] || inv.status}
                    </span>
                  </div>

                  {/* Top driver */}
                  {topDriver && (
                    <div style={{
                      marginTop: 'var(--space-2)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--text-tertiary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {topDriver}
                    </div>
                  )}

                  {/* Footer: enthusiasm + last meeting */}
                  <div className="flex items-center justify-between" style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      <TrendingUp className="w-3 h-3" />
                      <span>{inv.enthusiasm}/5</span>
                    </div>
                    {inv.lastMeeting && (
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {formatDate(inv.lastMeeting)}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

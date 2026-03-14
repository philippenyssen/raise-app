'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Zap, RefreshCw, AlertTriangle, TrendingUp, Users,
  ArrowRight, Clock, Activity, Target, Flame,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TriggerInvestor {
  name: string;
  status: string;
  statusLabel: string;
}

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

interface StrategyCard {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  targetInvestors: string[];
}

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

const TYPE_LABELS: Record<string, string> = {
  vc: 'VC', growth: 'Growth', sovereign: 'SWF', strategic: 'Strategic',
  debt: 'Debt', family_office: 'Family',
};

const TYPE_STYLES: Record<string, React.CSSProperties> = {
  vc: { background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid rgba(27, 42, 74, 0.10)' },
  growth: { background: 'var(--cat-purple-muted)', color: 'var(--chart-4)', border: '1px solid rgba(90, 90, 122, 0.10)' },
  sovereign: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)', border: '1px solid rgba(26, 26, 46, 0.05)' },
  strategic: { background: 'var(--cat-teal-muted)', color: 'var(--cat-teal)', border: '1px solid rgba(74, 106, 106, 0.10)' },
  debt: { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' },
  family_office: { background: 'rgba(26, 26, 46, 0.06)', color: 'var(--text-primary)', border: '1px solid rgba(26, 26, 46, 0.06)' },
};

const IMPACT_STYLES: Record<string, React.CSSProperties> = {
  high: { background: 'var(--danger-muted)', color: 'var(--text-primary)', border: '1px solid rgba(26, 26, 46, 0.06)' },
  medium: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)', border: '1px solid rgba(26, 26, 46, 0.05)' },
  low: { background: 'var(--surface-2)', color: 'var(--text-tertiary)', border: '1px solid var(--border-default)' },
};

const PRIORITY_STYLES: Record<string, React.CSSProperties> = {
  high: { borderLeft: '2px solid var(--border-default)' },
  medium: { borderLeft: '2px solid var(--border-default)' },
  low: { borderLeft: '3px solid var(--border-default)' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inlineBadgeStyle(styleObj: React.CSSProperties): React.CSSProperties {
  return {
    fontSize: 'var(--font-size-xs)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 500,
    lineHeight: 1.5,
    whiteSpace: 'nowrap' as const,
    ...styleObj,
  };
}

function getIntensityColor(intensity: number): string {
  if (intensity >= 70) return 'var(--danger)';
  if (intensity >= 40) return 'var(--warning)';
  if (intensity > 0) return 'var(--accent)';
  return 'var(--text-muted)';
}

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
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHrs < 1) return 'Just now';
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

function TierBadge({ tier }: { tier: number }) {
  const tierClass = tier <= 3 ? `tier-badge tier-${tier}` : 'tier-badge tier-3';
  return <span className={tierClass}>{tier}</span>;
}

function EnthusiasmDots({ value }: { value: number }) {
  return (
    <div className="enthusiasm-dots">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className="enthusiasm-dot"
          style={{
            background: i <= value
              ? (value >= 4 ? 'var(--success)' : value >= 3 ? 'var(--warning)' : 'var(--danger)')
              : 'var(--border-default)',
          }}
        />
      ))}
    </div>
  );
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
      style={{
        padding: 'var(--space-6)',
        background: 'var(--surface-1)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <span
          className="flex items-center justify-center"
          style={{
            width: '40px', height: '40px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-2)',
          }}
        >
          <Zap className="w-5 h-5" style={{ color }} />
        </span>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Pipeline FOMO Level
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', margin: 0 }}>
            Competitive pressure across active investors
          </p>
        </div>
      </div>

      <div className="flex items-end gap-4 mb-3">
        <span style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color, lineHeight: 1 }}>
          {intensity}
        </span>
        <span style={{ fontSize: 'var(--font-size-sm)', color, fontWeight: 500, paddingBottom: '4px' }}>
          / 100 — {label}
        </span>
      </div>

      {/* Bar */}
      <div
        style={{
          width: '100%', height: '8px',
          background: 'var(--surface-2)',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: 'var(--space-3)',
        }}
      >
        <div
          style={{
            width: `${intensity}%`, height: '100%',
            background: color,
            borderRadius: '4px',
            transition: 'width 0.6s ease-out',
          }}
        />
      </div>

      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
        {description}
      </p>
    </div>
  );
}

function StatsRow({ stats, meetingDensity }: { stats: FomoData['stats']; meetingDensity: FomoData['meetingDensity'] }) {
  const items = [
    { label: 'Advancing (14d)', value: stats.advancingCount, icon: TrendingUp, color: 'var(--text-secondary)' },
    { label: 'Recent Meetings', value: stats.recentMeetingCount, icon: Activity, color: 'var(--accent)' },
    { label: 'High FOMO', value: stats.highFomoCount, icon: Flame, color: 'var(--text-primary)' },
    { label: 'Meetings/Week', value: meetingDensity.avgPerWeek, icon: Clock, color: 'var(--text-tertiary)' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            style={{
              padding: 'var(--space-4)',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {item.label}
              </span>
            </div>
            <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PressureCard({ inv }: { inv: InvestorFomo }) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const color = getIntensityColor(inv.intensity);

  return (
    <div
      style={{
        padding: 'var(--space-4)',
        background: hovered ? 'var(--surface-2)' : 'var(--surface-1)',
        border: `1px solid ${hovered ? 'var(--border-default)' : 'var(--border-subtle)'}`,
        borderRadius: 'var(--radius-lg)',
        transition: 'all 150ms ease',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        {/* Intensity bar */}
        <div
          style={{
            width: '4px', height: '40px',
            borderRadius: '2px',
            background: color,
            flexShrink: 0,
          }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/investors/${inv.investorId}`}
              className="transition-colors"
              style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}
              onClick={e => e.stopPropagation()}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            >
              {inv.investorName}
            </Link>
            <TierBadge tier={inv.tier} />
            <span style={inlineBadgeStyle(TYPE_STYLES[inv.type] ?? TYPE_STYLES.vc)}>
              {TYPE_LABELS[inv.type] ?? inv.type}
            </span>
            <span style={inlineBadgeStyle({
              background: 'var(--surface-2)',
              color: 'var(--text-tertiary)',
              border: '1px solid var(--border-default)',
            })}>
              {inv.statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <EnthusiasmDots value={inv.enthusiasm} />
            {inv.triggerInvestors.length > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {inv.triggerInvestors.length} trigger{inv.triggerInvestors.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Intensity score */}
        <div className="shrink-0 text-right">
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color, lineHeight: 1 }}>
            {inv.intensity}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {getIntensityLabel(inv.intensity)}
          </div>
        </div>
      </div>

      {/* Intensity breakdown bar */}
      <div className="flex gap-0.5 mt-3" style={{ height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
        <div
          style={{
            width: `${inv.advancingScore}%`,
            background: 'var(--danger)',
            borderRadius: '2px 0 0 2px',
          }}
          title={`Advancing peers: ${inv.advancingScore}`}
        />
        <div
          style={{
            width: `${inv.densityScore}%`,
            background: 'var(--warning)',
          }}
          title={`Meeting density: ${inv.densityScore}`}
        />
        <div
          style={{
            width: `${inv.connectionScore}%`,
            background: 'var(--accent)',
            borderRadius: '0 2px 2px 0',
          }}
          title={`Network connections: ${inv.connectionScore}`}
        />
        <div
          style={{
            flex: 1,
            background: 'var(--surface-3)',
          }}
        />
      </div>
      <div className="flex gap-4 mt-1">
        <span style={{ fontSize: '10px', color: 'var(--text-primary)' }}>Advancing {inv.advancingScore}</span>
        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Density {inv.densityScore}</span>
        <span style={{ fontSize: '10px', color: 'var(--accent)' }}>Network {inv.connectionScore}</span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
          {/* Trigger investors */}
          {inv.triggerInvestors.length > 0 && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'none' as const, letterSpacing: '0.06em' }}>
                Creating pressure
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {inv.triggerInvestors.map(t => (
                  <span
                    key={t.name}
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-2)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    {t.name}
                    <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
                      {t.statusLabel}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div
            style={{
              padding: 'var(--space-3)',
              background: 'var(--surface-0)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-start gap-2">
              <span style={{ flexShrink: 0, marginTop: '2px' }}>
                <Target className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
              </span>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {inv.recommendation}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TriggerEventCard({ event }: { event: TriggerEvent }) {
  const [hovered, setHovered] = useState(false);

  const iconMap: Record<string, typeof Zap> = {
    status_change: ArrowRight,
    meeting_cluster: Users,
    commitment_signal: TrendingUp,
  };
  const Icon = iconMap[event.type] ?? Zap;

  return (
    <div
      style={{
        padding: 'var(--space-3)',
        background: hovered ? 'var(--surface-2)' : 'var(--surface-1)',
        border: `1px solid ${hovered ? 'var(--border-default)' : 'var(--border-subtle)'}`,
        borderRadius: 'var(--radius-md)',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex items-center justify-center shrink-0"
          style={{
            width: '28px', height: '28px',
            borderRadius: 'var(--radius-sm)',
            ...(IMPACT_STYLES[event.impactLevel] ?? IMPACT_STYLES.low),
          }}
        >
          <Icon className="w-3.5 h-3.5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
              {event.investorName}
            </span>
            <span style={inlineBadgeStyle(IMPACT_STYLES[event.impactLevel] ?? IMPACT_STYLES.low)}>
              {event.impactLevel}
            </span>
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {event.detail}
          </p>
        </div>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>
          {formatDate(event.date)}
        </span>
      </div>
    </div>
  );
}

function StrategyCardComponent({ card }: { card: StrategyCard }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        padding: 'var(--space-4)',
        background: hovered ? 'var(--surface-2)' : 'var(--surface-1)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        transition: 'all 150ms ease',
        ...PRIORITY_STYLES[card.priority],
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start gap-2 mb-2">
        <span style={{ flexShrink: 0, marginTop: '2px' }}>
          <Target className="w-4 h-4" style={{ color: card.priority === 'high' ? 'var(--danger)' : card.priority === 'medium' ? 'var(--warning)' : 'var(--text-muted)' }} />
        </span>
        <div>
          <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {card.title}
          </h4>
          <span style={inlineBadgeStyle({
            background: card.priority === 'high' ? 'var(--danger-muted)' : card.priority === 'medium' ? 'var(--warning-muted)' : 'var(--surface-2)',
            color: card.priority === 'high' ? 'var(--danger)' : card.priority === 'medium' ? 'var(--warning)' : 'var(--text-tertiary)',
            border: `1px solid ${card.priority === 'high' ? 'rgba(26, 26, 46, 0.06)' : card.priority === 'medium' ? 'rgba(26, 26, 46, 0.05)' : 'var(--border-default)'}`,
            marginTop: '4px',
            display: 'inline-block',
          })}>
            {card.priority} priority
          </span>
        </div>
      </div>

      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 var(--space-3) 0' }}>
        {card.description}
      </p>

      {card.targetInvestors.length > 0 && (
        <div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'none' as const, letterSpacing: '0.06em' }}>
            Target
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {card.targetInvestors.map(name => (
              <span
                key={name}
                style={{
                  fontSize: 'var(--font-size-xs)',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-tertiary)',
                  border: '1px solid var(--border-default)',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function FomoPage() {
  const [data, setData] = useState<FomoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshHovered, setRefreshHovered] = useState(false);
  const [filterIntensity, setFilterIntensity] = useState<'all' | 'high' | 'medium' | 'low' | 'none'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/fomo');
      if (!res.ok) throw new Error('Failed to fetch FOMO data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
            Computing FOMO dynamics...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="w-6 h-6" style={{ color: 'var(--text-primary)' }} />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>{error}</span>
          <button
            className="btn btn-secondary"
            onClick={fetchData}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const filteredInvestors = data.perInvestorFomo.filter(inv => {
    if (filterIntensity === 'all') return true;
    if (filterIntensity === 'high') return inv.intensity >= 70;
    if (filterIntensity === 'medium') return inv.intensity >= 40 && inv.intensity < 70;
    if (filterIntensity === 'low') return inv.intensity > 0 && inv.intensity < 40;
    if (filterIntensity === 'none') return inv.intensity === 0;
    return true;
  });

  const filterTabs: { key: typeof filterIntensity; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: data.perInvestorFomo.length },
    { key: 'high', label: 'High', count: data.stats.highFomoCount },
    { key: 'medium', label: 'Medium', count: data.stats.mediumFomoCount },
    { key: 'low', label: 'Low', count: data.stats.lowFomoCount },
    { key: 'none', label: 'None', count: data.stats.zeroFomoCount },
  ];

  return (
    <div className="flex-1 overflow-y-auto page-content" style={{ padding: 'var(--space-6)' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">FOMO Dynamics</h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: '4px' }}>
              Competitive pressure between investors — leverage asymmetry to accelerate the process
            </p>
          </div>
          <button
            onClick={fetchData}
            onMouseEnter={() => setRefreshHovered(true)}
            onMouseLeave={() => setRefreshHovered(false)}
            className="flex items-center gap-2 transition-colors"
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
              border: '1px solid var(--border-default)',
              background: refreshHovered ? 'var(--surface-2)' : 'var(--surface-1)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Overall intensity meter + stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2">
            <IntensityMeter intensity={data.overallIntensity} description={data.overallDescription} />
          </div>
          <div className="flex flex-col gap-3">
            <StatsRow stats={data.stats} meetingDensity={data.meetingDensity} />
          </div>
        </div>

        {/* Two-column layout: Pressure Map + right column */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pressure Map (main column) */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Pressure Map
              </h2>
              <div className="flex gap-1">
                {filterTabs.map(tab => (
                  <button
                    key={tab.key}
                    className="transition-colors"
                    onClick={() => setFilterIntensity(tab.key)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 500,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                      background: filterIntensity === tab.key ? 'var(--surface-3)' : 'transparent',
                      color: filterIntensity === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                    onMouseEnter={e => {
                      if (filterIntensity !== tab.key) {
                        (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (filterIntensity !== tab.key) {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                      }
                    }}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {filteredInvestors.length === 0 ? (
                <div
                  style={{
                    padding: 'var(--space-8)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  No investors match this filter.
                </div>
              ) : (
                filteredInvestors.map(inv => (
                  <PressureCard key={inv.investorId} inv={inv} />
                ))
              )}
            </div>
          </div>

          {/* Right column: Triggers + Strategy */}
          <div className="flex flex-col gap-6">
            {/* FOMO Triggers */}
            <div>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 var(--space-3) 0' }}>
                FOMO Triggers
              </h2>
              {data.triggerEvents.length === 0 ? (
                <div
                  style={{
                    padding: 'var(--space-6)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--font-size-sm)',
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                  }}
                >
                  No recent trigger events detected.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.triggerEvents.slice(0, 8).map((event, i) => (
                    <TriggerEventCard key={i} event={event} />
                  ))}
                </div>
              )}
            </div>

            {/* Strategy Cards */}
            <div>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 var(--space-3) 0' }}>
                Strategy Cards
              </h2>
              {data.strategyCards.length === 0 ? (
                <div
                  style={{
                    padding: 'var(--space-6)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--font-size-sm)',
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                  }}
                >
                  No actionable strategies right now. Add more investors or schedule meetings to generate competitive dynamics.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.strategyCards.map((card, i) => (
                    <StrategyCardComponent key={i} card={card} />
                  ))}
                </div>
              )}
            </div>

            {/* Meeting Density */}
            <div
              style={{
                padding: 'var(--space-4)',
                background: 'var(--surface-1)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Meeting Cadence
                </h3>
              </div>
              <div className="flex items-end gap-2 mb-2">
                <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {data.meetingDensity.densityScore}
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', paddingBottom: '3px' }}>
                  / 100 density
                </span>
              </div>
              <div
                style={{
                  width: '100%', height: '4px',
                  background: 'var(--surface-3)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginBottom: 'var(--space-2)',
                }}
              >
                <div
                  style={{
                    width: `${data.meetingDensity.densityScore}%`,
                    height: '100%',
                    background: data.meetingDensity.densityScore >= 70 ? 'var(--success)' : data.meetingDensity.densityScore >= 40 ? 'var(--warning)' : 'var(--danger)',
                    borderRadius: '2px',
                  }}
                />
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {data.meetingDensity.insight}
              </p>
            </div>
          </div>
        </div>

        {/* Footer timestamp */}
        <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Last computed: {new Date(data.generatedAt).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

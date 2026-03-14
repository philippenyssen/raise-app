'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import {
  Zap, RefreshCw, CheckCircle, AlertTriangle, Clock, Shield,
  ChevronDown, Play, Ban, XCircle, Rocket, Timer, ArrowUpRight,
  TrendingDown, SkipForward,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccelerationItem {
  id: string;
  investorId: string;
  investorName: string;
  investorTier: number;
  investorType: string;
  status: string;
  enthusiasm: number;
  score: number;
  momentum: string;
  triggerType: string;
  actionType: string;
  description: string;
  expectedLift: number;
  confidence: string;
  timeEstimate: string;
  urgency: string;
  triggerEvidence: string;
}

interface InvestorSummary {
  investorId: string;
  investorName: string;
  investorTier: number;
  investorType: string;
  status: string;
  enthusiasm: number;
  score: number;
  momentum: string;
  reason: string;
}

interface AccelerationData {
  summary: { immediate: number; this_week: number; total: number };
  accelerations: AccelerationItem[];
  termSheetReady: InvestorSummary[];
  atRisk: InvestorSummary[];
  deprioritize: InvestorSummary[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants — style objects using design tokens
// ---------------------------------------------------------------------------

const TYPE_STYLES: Record<string, React.CSSProperties> = {
  vc: { background: 'var(--accent-muted)', color: '#6a8fc0', border: '1px solid rgba(74,111,165,0.25)' },
  growth: { background: 'rgba(167,139,250,0.12)', color: '#8ab0d0', border: '1px solid rgba(167,139,250,0.25)' },
  sovereign: { background: 'var(--warning-muted)', color: '#d4be82', border: '1px solid rgba(196,163,90,0.25)' },
  strategic: { background: 'rgba(45,212,191,0.12)', color: '#4a9e8a', border: '1px solid rgba(45,212,191,0.25)' },
  debt: { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' },
  family_office: { background: 'rgba(196,90,90,0.12)', color: '#d48080', border: '1px solid rgba(196,90,90,0.25)' },
};

const TYPE_LABELS: Record<string, string> = {
  vc: 'VC', growth: 'Growth', sovereign: 'SWF', strategic: 'Strategic',
  debt: 'Debt', family_office: 'Family',
};

const STATUS_LABELS: Record<string, string> = {
  identified: 'Identified', contacted: 'Contacted', nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Set', met: 'Met', engaged: 'Engaged',
  in_dd: 'In DD', term_sheet: 'Term Sheet', closed: 'Closed',
};

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  identified: { background: 'var(--surface-2)', color: 'var(--text-tertiary)', border: '1px solid var(--border-default)' },
  contacted: { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' },
  nda_signed: { background: 'var(--accent-muted)', color: '#6a8fc0', border: '1px solid rgba(74,111,165,0.25)' },
  meeting_scheduled: { background: 'var(--accent-muted)', color: '#7a9ec5', border: '1px solid rgba(74,111,165,0.25)' },
  met: { background: 'rgba(167,139,250,0.12)', color: '#8ab0d0', border: '1px solid rgba(167,139,250,0.25)' },
  engaged: { background: 'rgba(167,139,250,0.12)', color: '#d5c8fd', border: '1px solid rgba(167,139,250,0.2)' },
  in_dd: { background: 'var(--warning-muted)', color: '#d4be82', border: '1px solid rgba(196,163,90,0.25)' },
  term_sheet: { background: 'var(--success-muted)', color: '#6ab88a', border: '1px solid rgba(74,158,110,0.25)' },
};

const MOMENTUM_STYLE: Record<string, React.CSSProperties> = {
  accelerating: { color: 'var(--success)' },
  steady: { color: 'var(--text-tertiary)' },
  decelerating: { color: 'var(--warning)' },
  stalled: { color: 'var(--danger)' },
};

const MOMENTUM_LABELS: Record<string, string> = {
  accelerating: 'Accelerating',
  steady: 'Steady',
  decelerating: 'Decelerating',
  stalled: 'Stalled',
};

const TRIGGER_STYLES: Record<string, React.CSSProperties> = {
  momentum_cliff: { background: 'rgba(249,115,22,0.12)', color: '#d4be82', border: '1px solid rgba(249,115,22,0.25)' },
  stall_risk: { background: 'var(--danger-muted)', color: '#d48080', border: '1px solid rgba(196,90,90,0.25)' },
  window_closing: { background: 'var(--warning-muted)', color: '#d4be82', border: '1px solid rgba(196,163,90,0.25)' },
  catalyst_match: { background: 'var(--accent-muted)', color: '#6a8fc0', border: '1px solid rgba(74,111,165,0.25)' },
  competitive_pressure: { background: 'rgba(167,139,250,0.12)', color: '#8ab0d0', border: '1px solid rgba(167,139,250,0.25)' },
  term_sheet_ready: { background: 'var(--success-muted)', color: '#6ab88a', border: '1px solid rgba(74,158,110,0.25)' },
};

const TRIGGER_LABELS: Record<string, string> = {
  momentum_cliff: 'Momentum Cliff',
  stall_risk: 'Stall Risk',
  window_closing: 'Window Closing',
  catalyst_match: 'Catalyst Match',
  competitive_pressure: 'Competitive Pressure',
  term_sheet_ready: 'Term Sheet Ready',
};

const CONFIDENCE_STYLES: Record<string, React.CSSProperties> = {
  high: { background: 'var(--success-muted)', color: '#6ab88a', border: '1px solid rgba(74,158,110,0.25)' },
  medium: { background: 'var(--warning-muted)', color: '#d4be82', border: '1px solid rgba(196,163,90,0.25)' },
  low: { background: 'var(--surface-2)', color: 'var(--text-tertiary)', border: '1px solid var(--border-default)' },
};

const URGENCY_STYLE: Record<string, React.CSSProperties> = {
  immediate: { color: 'var(--danger)' },
  '48h': { color: '#a58a5a' },
  this_week: { color: 'var(--warning)' },
  next_week: { color: 'var(--text-tertiary)' },
};

type FilterTab = 'all' | 'pending' | 'executed' | 'skipped';

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

function TierBadge({ tier }: { tier: number }) {
  const tierClass = tier <= 3 ? `tier-badge tier-${tier}` : 'tier-badge tier-3';
  return (
    <span className={tierClass}>
      {tier}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function ActionCard({
  item,
  onExecute,
  onSkip,
  executedIds,
  skippedIds,
}: {
  item: AccelerationItem;
  onExecute: (item: AccelerationItem) => void;
  onSkip: (item: AccelerationItem) => void;
  executedIds: Set<string>;
  skippedIds: Set<string>;
}) {
  const isExecuted = executedIds.has(item.id);
  const isSkipped = skippedIds.has(item.id);
  const isDone = isExecuted || isSkipped;
  const [hovered, setHovered] = useState(false);
  const [execHovered, setExecHovered] = useState(false);
  const [skipHovered, setSkipHovered] = useState(false);

  const cardStyle: React.CSSProperties = isDone
    ? {
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        background: 'rgba(24,24,27,0.3)',
        opacity: 0.6,
        transition: 'all 200ms ease',
      }
    : {
        border: `1px solid ${hovered ? 'var(--border-default)' : 'var(--border-subtle)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        background: 'var(--surface-1)',
        transition: 'all 200ms ease',
      };

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Link
              href={`/investors/${item.investorId}`}
              className="transition-colors"
              style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            >
              {item.investorName}
            </Link>
            <TierBadge tier={item.investorTier} />
            <span style={inlineBadgeStyle(TRIGGER_STYLES[item.triggerType] ?? TRIGGER_STYLES.stall_risk)}>
              {TRIGGER_LABELS[item.triggerType] ?? item.triggerType}
            </span>
            <span style={inlineBadgeStyle(CONFIDENCE_STYLES[item.confidence] ?? CONFIDENCE_STYLES.medium)}>
              {item.confidence} confidence
            </span>
            <span style={inlineBadgeStyle(STATUS_STYLES[item.status] ?? STATUS_STYLES.identified)}>
              {STATUS_LABELS[item.status] ?? item.status}
            </span>
          </div>

          {/* Description */}
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '8px' }}>
            {item.description}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              <Timer className="w-3 h-3" />
              {item.timeEstimate}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--success)', opacity: 0.8 }}>
              +{item.expectedLift} pts expected
            </span>
            <span style={{ fontSize: '11px', fontWeight: 500, ...(URGENCY_STYLE[item.urgency] ?? { color: 'var(--text-tertiary)' }) }}>
              {item.urgency === 'immediate' ? 'Act now' : item.urgency === '48h' ? 'Within 48h' : item.urgency === 'this_week' ? 'This week' : 'Next week'}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {item.triggerEvidence}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="shrink-0 flex flex-col gap-1.5">
          {isDone ? (
            <span
              className="flex items-center justify-center"
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                ...(isExecuted
                  ? { background: 'var(--success-muted)', color: 'var(--success)', border: '1px solid rgba(74,158,110,0.2)' }
                  : { background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }
                ),
              }}
            >
              {isExecuted ? 'Done' : 'Skipped'}
            </span>
          ) : (
            <>
              <button
                onClick={() => onExecute(item)}
                onMouseEnter={() => setExecHovered(true)}
                onMouseLeave={() => setExecHovered(false)}
                className="flex items-center gap-1.5 transition-colors"
                style={{
                  padding: '8px 12px',
                  background: execHovered ? 'rgba(74,111,165,0.8)' : 'var(--accent)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 500,
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Play className="w-3 h-3" />
                Execute
              </button>
              <button
                onClick={() => onSkip(item)}
                onMouseEnter={() => setSkipHovered(true)}
                onMouseLeave={() => setSkipHovered(false)}
                className="flex items-center gap-1.5 transition-colors"
                style={{
                  padding: '8px 12px',
                  background: skipHovered ? 'var(--surface-3)' : 'var(--surface-2)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-tertiary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <SkipForward className="w-3 h-3" />
                Skip
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TermSheetReadyCard({ investor }: { investor: InvestorSummary }) {
  return (
    <div
      style={{
        border: '1px solid rgba(74,158,110,0.15)',
        background: 'var(--success-muted)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Rocket className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
        <Link
          href={`/investors/${investor.investorId}`}
          className="transition-colors"
          style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
        >
          {investor.investorName}
        </Link>
        <TierBadge tier={investor.investorTier} />
        <span style={inlineBadgeStyle(TYPE_STYLES[investor.investorType] ?? TYPE_STYLES.vc)}>
          {TYPE_LABELS[investor.investorType] ?? investor.investorType}
        </span>
        <span style={inlineBadgeStyle(STATUS_STYLES[investor.status] ?? STATUS_STYLES.identified)}>
          {STATUS_LABELS[investor.status] ?? investor.status}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Score: <span style={{ color: 'var(--success)', fontWeight: 700 }}>{investor.score}</span>/100
        </span>
        <span style={{ fontSize: '11px', ...(MOMENTUM_STYLE[investor.momentum] ?? {}) }}>
          {MOMENTUM_LABELS[investor.momentum]}
        </span>
        <EnthusiasmDots value={investor.enthusiasm} />
      </div>
      <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>{investor.reason}</p>
      <Link
        href={`/investors/${investor.investorId}`}
        className="inline-flex items-center gap-1.5 transition-colors"
        style={{
          padding: '6px 12px',
          background: 'rgba(74,158,110,0.15)',
          border: '1px solid rgba(74,158,110,0.2)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-sm)',
          color: '#86efce',
          fontWeight: 500,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,158,110,0.25)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(74,158,110,0.15)')}
      >
        <Rocket className="w-3 h-3" />
        Push for Term Sheet
      </Link>
    </div>
  );
}

function AtRiskCard({ investor }: { investor: InvestorSummary }) {
  return (
    <div
      style={{
        border: '1px solid rgba(249,115,22,0.15)',
        background: 'rgba(249,115,22,0.04)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-3.5 h-3.5" style={{ color: '#a58a5a' }} />
        <Link
          href={`/investors/${investor.investorId}`}
          className="transition-colors"
          style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
        >
          {investor.investorName}
        </Link>
        <TierBadge tier={investor.investorTier} />
        <span style={inlineBadgeStyle(TYPE_STYLES[investor.investorType] ?? TYPE_STYLES.vc)}>
          {TYPE_LABELS[investor.investorType] ?? investor.investorType}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Score: <span style={{ color: '#a58a5a', fontWeight: 700 }}>{investor.score}</span>/100
        </span>
        <span style={{ fontSize: '11px', ...(MOMENTUM_STYLE[investor.momentum] ?? {}) }}>
          {investor.momentum === 'decelerating' || investor.momentum === 'stalled'
            ? <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3 inline" />{MOMENTUM_LABELS[investor.momentum]}</span>
            : <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3 inline" />{MOMENTUM_LABELS[investor.momentum]}</span>
          }
        </span>
        <EnthusiasmDots value={investor.enthusiasm} />
      </div>
      <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{investor.reason}</p>
    </div>
  );
}

function DeprioritizeSection({ investors }: { investors: InvestorSummary[] }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  if (investors.length === 0) return null;

  return (
    <div
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="w-full flex items-center justify-between p-3 text-left transition-colors"
        style={{
          background: hovered ? 'var(--surface-1)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <div className="flex items-center gap-2">
          <Ban className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
            Deprioritize ({investors.length})
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-muted)' }}
        />
      </button>
      {expanded && (
        <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {investors.map(inv => (
            <div key={inv.investorId} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <XCircle className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                <Link
                  href={`/investors/${inv.investorId}`}
                  className="transition-colors"
                  style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  {inv.investorName}
                </Link>
                <TierBadge tier={inv.investorTier} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Score: {inv.score}/100</span>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{inv.reason}</span>
            </div>
          ))}
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
            Stop allocating active time to these investors. Move effort to higher-conviction targets.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AccelerationPage() {
  const { toast } = useToast();
  const [data, setData] = useState<AccelerationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [refreshHovered, setRefreshHovered] = useState(false);
  const [retryHovered, setRetryHovered] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/acceleration');
      if (res.ok) {
        setData(await res.json());
      } else {
        toast('Failed to load acceleration data', 'error');
      }
    } catch (err) {
      toast('Failed to load acceleration data', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleExecute(item: AccelerationItem) {
    try {
      const res = await fetch('/api/acceleration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status: 'executed' }),
      });
      if (!res.ok) throw new Error('Failed to mark action as executed');
      setExecutedIds(prev => new Set(prev).add(item.id));
      toast(`Action executed for ${item.investorName}`);
    } catch {
      toast('Failed to update action', 'error');
    }
  }

  async function handleSkip(item: AccelerationItem) {
    try {
      const res = await fetch('/api/acceleration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status: 'skipped' }),
      });
      if (!res.ok) throw new Error('Failed to mark action as skipped');
      setSkippedIds(prev => new Set(prev).add(item.id));
      toast(`Action skipped for ${item.investorName}`);
    } catch {
      toast('Failed to update action', 'error');
    }
  }

  // Filter logic
  function filterActions(actions: AccelerationItem[]): AccelerationItem[] {
    switch (activeTab) {
      case 'pending':
        return actions.filter(a => !executedIds.has(a.id) && !skippedIds.has(a.id));
      case 'executed':
        return actions.filter(a => executedIds.has(a.id));
      case 'skipped':
        return actions.filter(a => skippedIds.has(a.id));
      default:
        return actions;
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)' }} />
          ))}
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: 'var(--surface-0)' }} />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <Zap className="w-6 h-6" style={{ color: 'var(--warning)' }} /> Deal Acceleration
        </h1>
        <div className="rounded-xl p-8 text-center space-y-3" style={{ border: '1px solid var(--border-subtle)' }}>
          <p style={{ color: 'var(--text-tertiary)' }}>Unable to load acceleration data.</p>
          <button
            onClick={fetchData}
            onMouseEnter={() => setRetryHovered(true)}
            onMouseLeave={() => setRetryHovered(false)}
            className="inline-flex items-center gap-2 rounded-lg transition-colors"
            style={{
              padding: '8px 16px',
              background: retryHovered ? 'rgba(74,111,165,0.8)' : 'var(--accent)',
              color: 'white',
              fontSize: 'var(--font-size-sm)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const immediateActions = filterActions(
    data.accelerations.filter(a => a.urgency === 'immediate')
  );
  const thisWeekActions = filterActions(
    data.accelerations.filter(a => a.urgency === '48h' || a.urgency === 'this_week')
  );
  const allFiltered = filterActions(data.accelerations);

  const pendingCount = data.accelerations.filter(a => !executedIds.has(a.id) && !skippedIds.has(a.id)).length;
  const executedCount = executedIds.size;
  const skippedCount = skippedIds.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Zap className="w-6 h-6" style={{ color: 'var(--warning)' }} /> Deal Acceleration
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            {data.summary.total} action{data.summary.total !== 1 ? 's' : ''} detected
            {data.summary.immediate > 0 && (
              <> &middot; <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{data.summary.immediate} immediate</span></>
            )}
            {data.summary.this_week > 0 && (
              <> &middot; <span style={{ color: 'var(--warning)' }}>{data.summary.this_week} this week</span></>
            )}
            {data.termSheetReady.length > 0 && (
              <> &middot; <span style={{ color: 'var(--success)', fontWeight: 500 }}>{data.termSheetReady.length} term sheet ready</span></>
            )}
          </p>
        </div>
        <button
          onClick={fetchData}
          onMouseEnter={() => setRefreshHovered(true)}
          onMouseLeave={() => setRefreshHovered(false)}
          className="flex items-center gap-2 rounded-lg transition-colors"
          style={{
            padding: '8px 12px',
            background: refreshHovered ? 'var(--surface-3)' : 'var(--surface-2)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          className="rounded-xl p-4"
          style={{ border: '1px solid rgba(196,90,90,0.15)', background: 'var(--danger-muted)' }}
        >
          <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--danger)', fontSize: 'var(--font-size-sm)' }}>
            <AlertTriangle className="w-3.5 h-3.5" /> Immediate
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--danger)' }}>{data.summary.immediate}</div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>need same-day attention</div>
        </div>
        <div
          className="rounded-xl p-4"
          style={{ border: '1px solid rgba(196,163,90,0.15)', background: 'var(--warning-muted)' }}
        >
          <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--warning)', fontSize: 'var(--font-size-sm)' }}>
            <Clock className="w-3.5 h-3.5" /> This Week
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--warning)' }}>{data.summary.this_week}</div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>actions for next 7 days</div>
        </div>
        <div
          className="rounded-xl p-4"
          style={{ border: '1px solid rgba(74,158,110,0.15)', background: 'var(--success-muted)' }}
        >
          <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--success)', fontSize: 'var(--font-size-sm)' }}>
            <Rocket className="w-3.5 h-3.5" /> Term Sheet Ready
          </div>
          <div className="text-2xl font-bold" style={{ color: 'var(--success)' }}>{data.termSheetReady.length}</div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>ready for the push</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 pb-px" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {([
          { key: 'all' as FilterTab, label: 'All', count: data.accelerations.length },
          { key: 'pending' as FilterTab, label: 'Pending', count: pendingCount },
          { key: 'executed' as FilterTab, label: 'Executed', count: executedCount },
          { key: 'skipped' as FilterTab, label: 'Skipped', count: skippedCount },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="transition-colors"
            style={{
              padding: '8px 12px',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
              borderBottom: `2px solid ${activeTab === tab.key ? 'var(--accent)' : 'transparent'}`,
              marginBottom: '-1px',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              borderBottomStyle: 'solid' as const,
              borderBottomWidth: '2px',
              borderBottomColor: activeTab === tab.key ? 'var(--accent)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className="ml-1.5 rounded-full"
                style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  background: activeTab === tab.key ? 'var(--accent-muted)' : 'var(--surface-2)',
                  color: activeTab === tab.key ? '#7a9ec5' : 'var(--text-muted)',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Term Sheet Ready */}
      {data.termSheetReady.length > 0 && (activeTab === 'all' || activeTab === 'pending') && (
        <div>
          <h2 className="flex items-center gap-2 mb-3" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--success)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
            <CheckCircle className="w-3.5 h-3.5" /> Term Sheet Ready ({data.termSheetReady.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ borderLeft: '3px solid rgba(74,158,110,0.4)', paddingLeft: '12px' }}>
            {data.termSheetReady.map(inv => (
              <TermSheetReadyCard key={inv.investorId} investor={inv} />
            ))}
          </div>
        </div>
      )}

      {/* Immediate Actions */}
      {immediateActions.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 mb-3" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--danger)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
            <AlertTriangle className="w-3.5 h-3.5" /> Immediate Actions ({immediateActions.length})
          </h2>
          <div className="space-y-2" style={{ borderLeft: '3px solid rgba(196,90,90,0.4)', paddingLeft: '12px' }}>
            {immediateActions.map(item => (
              <ActionCard
                key={item.id}
                item={item}
                onExecute={handleExecute}
                onSkip={handleSkip}
                executedIds={executedIds}
                skippedIds={skippedIds}
              />
            ))}
          </div>
        </div>
      )}

      {/* This Week */}
      {thisWeekActions.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 mb-3" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--warning)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
            <Clock className="w-3.5 h-3.5" /> This Week ({thisWeekActions.length})
          </h2>
          <div className="space-y-2" style={{ borderLeft: '3px solid rgba(234,179,8,0.4)', paddingLeft: '12px' }}>
            {thisWeekActions.map(item => (
              <ActionCard
                key={item.id}
                item={item}
                onExecute={handleExecute}
                onSkip={handleSkip}
                executedIds={executedIds}
                skippedIds={skippedIds}
              />
            ))}
          </div>
        </div>
      )}

      {/* At Risk */}
      {data.atRisk.length > 0 && (activeTab === 'all' || activeTab === 'pending') && (
        <div>
          <h2 className="flex items-center gap-2 mb-3" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: '#a58a5a', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
            <Shield className="w-3.5 h-3.5" /> At Risk ({data.atRisk.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ borderLeft: '3px solid rgba(249,115,22,0.4)', paddingLeft: '12px' }}>
            {data.atRisk.map(inv => (
              <AtRiskCard key={inv.investorId} investor={inv} />
            ))}
          </div>
        </div>
      )}

      {/* Deprioritize */}
      {(activeTab === 'all' || activeTab === 'pending') && (
        <DeprioritizeSection investors={data.deprioritize} />
      )}

      {/* Empty state for filtered views */}
      {allFiltered.length === 0 && data.termSheetReady.length === 0 && data.atRisk.length === 0 && data.deprioritize.length === 0 && (
        <div className="rounded-xl p-8 text-center space-y-3" style={{ border: '1px solid var(--border-subtle)' }}>
          <CheckCircle className="w-8 h-8 mx-auto" style={{ color: 'var(--success)' }} />
          <p style={{ color: 'var(--text-tertiary)' }}>No acceleration actions detected.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>All investors are progressing normally. Check back when new meetings are logged.</p>
        </div>
      )}

      {activeTab !== 'all' && allFiltered.length === 0 && (
        <div className="rounded-xl p-6 text-center" style={{ border: '1px solid var(--border-subtle)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>No {activeTab} actions.</p>
        </div>
      )}
    </div>
  );
}

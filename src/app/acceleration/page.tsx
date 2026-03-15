'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import { STATUS_LABELS, PIPELINE_STATUS_STYLES, MOMENTUM_STYLES, MOMENTUM_LABELS, TRIGGER_STYLES, TRIGGER_LABELS, CONFIDENCE_STYLES, URGENCY_STYLE } from '@/lib/constants';
import {
  AccelerationItem, AccelerationInvestorSummary as InvestorSummary, AccelerationData,
} from '@/lib/types';
import {
  RefreshCw, CheckCircle, AlertTriangle, Clock, Shield,
  ChevronDown, Play, Ban, XCircle, Rocket, Timer, ArrowUpRight,
  TrendingDown, SkipForward,
} from 'lucide-react';
import { labelMuted10, stBorderTop, stSurface0, stSurface1, stSurface2, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary } from '@/lib/styles';

// ---------------------------------------------------------------------------
// Constants — style objects using design tokens
// ---------------------------------------------------------------------------

const TYPE_STYLES: Record<string, React.CSSProperties> = {
  vc: { background: 'var(--accent-muted)', color: 'var(--accent)' },
  growth: { background: 'var(--cat-purple-muted)', color: 'var(--chart-4)' },
  sovereign: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  strategic: { background: 'var(--cat-teal-muted)', color: 'var(--cat-teal)' },
  debt: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
  family_office: { background: 'var(--fg-6)', color: 'var(--text-primary)' },
};

const TYPE_LABELS: Record<string, string> = {
  vc: 'VC', growth: 'Growth', sovereign: 'SWF', strategic: 'Strategic',
  debt: 'Debt', family_office: 'Family',
};

const STATUS_STYLES = PIPELINE_STATUS_STYLES;
const MOMENTUM_STYLE = MOMENTUM_STYLES;


type FilterTab = 'all' | 'pending' | 'executed' | 'skipped';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inlineBadgeStyle(styleObj: React.CSSProperties): React.CSSProperties {
  return {
    fontSize: 'var(--font-size-xs)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 400,
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
          }} />
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
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        background: 'var(--fg-30)',
        opacity: 0.6,
        transition: 'all 200ms ease',
      }
    : {
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        background: 'var(--surface-1)',
        transition: 'all 200ms ease',
      };

  return (
    <div
      className="transition-colors"
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Link
              href={`/investors/${item.investorId}`}
              className="transition-colors"
              style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}>
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
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.8 }}>
              +{item.expectedLift} pts expected
            </span>
            <span style={{ fontSize: '11px', fontWeight: 400, ...(URGENCY_STYLE[item.urgency] ?? { color: 'var(--text-tertiary)' }) }}>
              {item.urgency === 'immediate' ? 'Act now' : item.urgency === '48h' ? 'Within 48h' : item.urgency === 'this_week' ? 'This week' : 'Next week'}
            </span>
            <span style={labelMuted10}>
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
                fontWeight: 400,
                ...(isExecuted
                  ? { background: 'var(--success-muted)', color: 'var(--text-secondary)' }
                  : { background: 'var(--surface-2)', color: 'var(--text-muted)' }
                ), }}
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
                  background: execHovered ? 'var(--accent-hover)' : 'var(--accent)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 400,
                  color: 'var(--text-primary)',
                  border: 'none',
                  cursor: 'pointer', }}
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
                  cursor: 'pointer', }}
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
      style={{ background: 'var(--success-muted)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
      <div className="flex items-center gap-2 mb-2">
        <Rocket className="w-3.5 h-3.5" style={stTextSecondary} />
        <Link
          href={`/investors/${investor.investorId}`}
          className="transition-colors"
          style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}>
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
          Score: <span style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{investor.score}</span>/100
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
          background: 'var(--accent-muted)',
          border: '1px solid var(--accent-muted)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--text-secondary)',
          fontWeight: 400, }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-8)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent-muted)')}>
        <Rocket className="w-3 h-3" />
        Push for Term Sheet
      </Link>
    </div>
  );
}

function AtRiskCard({ investor }: { investor: InvestorSummary }) {
  return (
    <div
      style={{ background: 'var(--fg-5)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-3.5 h-3.5" style={stTextSecondary} />
        <Link
          href={`/investors/${investor.investorId}`}
          className="transition-colors"
          style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}>
          {investor.investorName}
        </Link>
        <TierBadge tier={investor.investorTier} />
        <span style={inlineBadgeStyle(TYPE_STYLES[investor.investorType] ?? TYPE_STYLES.vc)}>
          {TYPE_LABELS[investor.investorType] ?? investor.investorType}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Score: <span style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{investor.score}</span>/100
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
      style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="w-full flex items-center justify-between p-3 text-left transition-colors"
        style={{
          background: hovered ? 'var(--surface-1)' : 'transparent',
          border: 'none',
          cursor: 'pointer', }}
>
        <div className="flex items-center gap-2">
          <Ban className="w-3.5 h-3.5" style={stTextMuted} />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: 400, letterSpacing: '0.01em' }}>
            Deprioritize ({investors.length})
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
          style={stTextMuted} />
      </button>
      {expanded && (
        <div className="p-3 space-y-2" style={stBorderTop}>
          {investors.map(inv => (
            <div key={inv.investorId} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <XCircle className="w-3 h-3" style={stTextMuted} />
                <Link
                  href={`/investors/${inv.investorId}`}
                  className="transition-colors"
                  style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}>
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
        <div className="h-8 w-64 rounded animate-pulse" style={stSurface2} />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={stSurface1} />
          ))}
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl animate-pulse" style={stSurface0} />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Acceleration</h1>
        <div className="rounded-xl p-8 text-center space-y-3">
          <p style={stTextTertiary}>Unable to load acceleration data.</p>
          <button
            onClick={fetchData}
            onMouseEnter={() => setRetryHovered(true)}
            onMouseLeave={() => setRetryHovered(false)}
            className="inline-flex items-center gap-2 rounded-lg transition-colors"
            style={{
              padding: '8px 16px',
              background: retryHovered ? 'var(--accent-hover)' : 'var(--accent)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-size-sm)',
              border: 'none',
              cursor: 'pointer', }}
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
    <div className="space-y-6 page-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Acceleration</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
            {data.summary.total} action{data.summary.total !== 1 ? 's' : ''} detected
            {data.summary.immediate > 0 && (
              <> &middot; <span style={{ color: 'var(--text-primary)', fontWeight: 400 }}>{data.summary.immediate} immediate</span></>
            )}
            {data.summary.this_week > 0 && (
              <> &middot; <span style={stTextTertiary}>{data.summary.this_week} this week</span></>
            )}
            {data.termSheetReady.length > 0 && (
              <> &middot; <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{data.termSheetReady.length} term sheet ready</span></>
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
            cursor: 'pointer', }}
>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 card-stagger">
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--danger-muted)' }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
            <AlertTriangle className="w-3.5 h-3.5" /> Immediate
          </div>
          <div className="text-2xl font-normal" style={stTextPrimary}>{data.summary.immediate}</div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>need same-day attention</div>
        </div>
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--warning-muted)' }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
            <Clock className="w-3.5 h-3.5" /> This Week
          </div>
          <div className="text-2xl font-normal" style={stTextTertiary}>{data.summary.this_week}</div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>actions for next 7 days</div>
        </div>
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--success-muted)' }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            <Rocket className="w-3.5 h-3.5" /> Term Sheet Ready
          </div>
          <div className="text-2xl font-normal" style={stTextSecondary}>{data.termSheetReady.length}</div>
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
              fontWeight: 400,
              borderBottom: `2px solid ${activeTab === tab.key ? 'var(--accent)' : 'transparent'}`,
              marginBottom: '-1px',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              background: 'transparent',
              border: 'none',
              borderBottomStyle: 'solid' as const,
              borderBottomWidth: '2px',
              borderBottomColor: activeTab === tab.key ? 'var(--accent)' : 'transparent',
              cursor: 'pointer', }}
>
            {tab.label}
            {tab.count > 0 && (
              <span
                className="ml-1.5 rounded-full"
                style={{
                  padding: '2px 6px',
                  fontSize: '10px',
                  background: activeTab === tab.key ? 'var(--accent-muted)' : 'var(--surface-2)',
                  color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)', }}
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
          <h2 className="flex items-center gap-2 mb-3" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)', letterSpacing: '0.01em' }}>
            <CheckCircle className="w-3.5 h-3.5" /> Term Sheet Ready ({data.termSheetReady.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.termSheetReady.map(inv => (
              <TermSheetReadyCard key={inv.investorId} investor={inv} />
            ))}
          </div>
        </div>
      )}

      {/* Immediate Actions */}
      {immediateActions.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 mb-3" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
            <AlertTriangle className="w-3.5 h-3.5" /> Immediate Actions ({immediateActions.length})
          </h2>
          <div className="space-y-2">
            {immediateActions.map(item => (
              <ActionCard
                key={item.id}
                item={item}
                onExecute={handleExecute}
                onSkip={handleSkip}
                executedIds={executedIds}
                skippedIds={skippedIds} />
            ))}
          </div>
        </div>
      )}

      {/* This Week */}
      {thisWeekActions.length > 0 && (
        <div>
          <h2 className="flex items-center gap-2 mb-3" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-tertiary)', letterSpacing: '0.01em' }}>
            <Clock className="w-3.5 h-3.5" /> This Week ({thisWeekActions.length})
          </h2>
          <div className="space-y-2">
            {thisWeekActions.map(item => (
              <ActionCard
                key={item.id}
                item={item}
                onExecute={handleExecute}
                onSkip={handleSkip}
                executedIds={executedIds}
                skippedIds={skippedIds} />
            ))}
          </div>
        </div>
      )}

      {/* At Risk */}
      {data.atRisk.length > 0 && (activeTab === 'all' || activeTab === 'pending') && (
        <div>
          <h2 className="flex items-center gap-2 mb-3" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)', letterSpacing: '0.01em' }}>
            <Shield className="w-3.5 h-3.5" /> At Risk ({data.atRisk.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        <div className="rounded-xl p-8 text-center space-y-3">
          <CheckCircle className="w-8 h-8 mx-auto" style={stTextSecondary} />
          <p style={stTextTertiary}>No acceleration actions detected.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>All investors are progressing normally. Check back when new meetings are logged.</p>
        </div>
      )}

      {activeTab !== 'all' && allFiltered.length === 0 && (
        <div className="rounded-xl p-6 text-center">
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>No {activeTab} actions.</p>
        </div>
      )}
    </div>
  );
}

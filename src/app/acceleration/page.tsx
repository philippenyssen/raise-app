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
// Constants
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  vc: 'bg-blue-900/40 text-blue-300 border-blue-800',
  growth: 'bg-purple-900/40 text-purple-300 border-purple-800',
  sovereign: 'bg-amber-900/40 text-amber-300 border-amber-800',
  strategic: 'bg-teal-900/40 text-teal-300 border-teal-800',
  debt: 'bg-zinc-800/60 text-zinc-300 border-zinc-700',
  family_office: 'bg-rose-900/40 text-rose-300 border-rose-800',
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

const STATUS_COLORS: Record<string, string> = {
  identified: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  contacted: 'bg-zinc-800 text-zinc-300 border-zinc-600',
  nda_signed: 'bg-blue-900/30 text-blue-400 border-blue-800',
  meeting_scheduled: 'bg-blue-900/30 text-blue-300 border-blue-800',
  met: 'bg-purple-900/30 text-purple-400 border-purple-800',
  engaged: 'bg-purple-900/30 text-purple-300 border-purple-700',
  in_dd: 'bg-orange-900/30 text-orange-400 border-orange-800',
  term_sheet: 'bg-green-900/30 text-green-400 border-green-800',
};

const MOMENTUM_COLORS: Record<string, string> = {
  accelerating: 'text-green-400',
  steady: 'text-zinc-400',
  decelerating: 'text-yellow-400',
  stalled: 'text-red-400',
};

const MOMENTUM_LABELS: Record<string, string> = {
  accelerating: 'Accelerating',
  steady: 'Steady',
  decelerating: 'Decelerating',
  stalled: 'Stalled',
};

const TRIGGER_COLORS: Record<string, string> = {
  momentum_cliff: 'bg-orange-900/40 text-orange-300 border-orange-800',
  stall_risk: 'bg-red-900/40 text-red-300 border-red-800',
  window_closing: 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  catalyst_match: 'bg-blue-900/40 text-blue-300 border-blue-800',
  competitive_pressure: 'bg-purple-900/40 text-purple-300 border-purple-800',
  term_sheet_ready: 'bg-green-900/40 text-green-300 border-green-800',
};

const TRIGGER_LABELS: Record<string, string> = {
  momentum_cliff: 'Momentum Cliff',
  stall_risk: 'Stall Risk',
  window_closing: 'Window Closing',
  catalyst_match: 'Catalyst Match',
  competitive_pressure: 'Competitive Pressure',
  term_sheet_ready: 'Term Sheet Ready',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-green-900/30 text-green-400 border-green-800',
  medium: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
  low: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

const URGENCY_COLORS: Record<string, string> = {
  immediate: 'text-red-400',
  '48h': 'text-orange-400',
  this_week: 'text-yellow-400',
  next_week: 'text-zinc-400',
};

type FilterTab = 'all' | 'pending' | 'executed' | 'skipped';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function EnthusiasmDots({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            i <= value
              ? value >= 4 ? 'bg-green-400' : value >= 3 ? 'bg-yellow-400' : 'bg-red-400'
              : 'bg-zinc-700'
          }`}
        />
      ))}
    </div>
  );
}

function TierBadge({ tier }: { tier: number }) {
  const colors: Record<number, string> = {
    1: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    2: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
    3: 'bg-zinc-700/30 text-zinc-500 border-zinc-700',
    4: 'bg-zinc-800/30 text-zinc-600 border-zinc-800',
  };
  return (
    <span className={`text-[9px] px-1 py-0.5 rounded border font-medium ${colors[tier] ?? colors[3]}`}>
      T{tier}
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

  return (
    <div className={`border rounded-xl p-4 transition-colors ${
      isDone
        ? 'border-zinc-800/50 bg-zinc-900/30 opacity-60'
        : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
    }`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Link
              href={`/investors/${item.investorId}`}
              className="text-sm font-semibold hover:text-blue-400 transition-colors"
            >
              {item.investorName}
            </Link>
            <TierBadge tier={item.investorTier} />
            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${TRIGGER_COLORS[item.triggerType] ?? TRIGGER_COLORS.stall_risk}`}>
              {TRIGGER_LABELS[item.triggerType] ?? item.triggerType}
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${CONFIDENCE_COLORS[item.confidence] ?? CONFIDENCE_COLORS.medium}`}>
              {item.confidence} confidence
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[item.status] ?? STATUS_COLORS.identified}`}>
              {STATUS_LABELS[item.status] ?? item.status}
            </span>
          </div>

          {/* Description */}
          <p className="text-xs text-zinc-300 leading-relaxed mb-2">
            {item.description}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Timer className="w-3 h-3" />
              {item.timeEstimate}
            </span>
            <span className="text-[11px] text-green-400/80">
              +{item.expectedLift} pts expected
            </span>
            <span className={`text-[11px] font-medium ${URGENCY_COLORS[item.urgency] ?? 'text-zinc-400'}`}>
              {item.urgency === 'immediate' ? 'Act now' : item.urgency === '48h' ? 'Within 48h' : item.urgency === 'this_week' ? 'This week' : 'Next week'}
            </span>
            <span className="text-[10px] text-zinc-600">
              {item.triggerEvidence}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="shrink-0 flex flex-col gap-1.5">
          {isDone ? (
            <span className={`px-3 py-2 rounded-lg text-xs font-medium ${
              isExecuted ? 'bg-green-900/30 text-green-400 border border-green-800/50' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
            }`}>
              {isExecuted ? 'Done' : 'Skipped'}
            </span>
          ) : (
            <>
              <button
                onClick={() => onExecute(item)}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <Play className="w-3 h-3" />
                Execute
              </button>
              <button
                onClick={() => onSkip(item)}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-400 transition-colors flex items-center gap-1.5"
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
    <div className="border border-green-800/40 bg-green-900/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Rocket className="w-3.5 h-3.5 text-green-400" />
        <Link
          href={`/investors/${investor.investorId}`}
          className="text-sm font-semibold hover:text-blue-400 transition-colors"
        >
          {investor.investorName}
        </Link>
        <TierBadge tier={investor.investorTier} />
        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${TYPE_COLORS[investor.investorType] ?? TYPE_COLORS.vc}`}>
          {TYPE_LABELS[investor.investorType] ?? investor.investorType}
        </span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[investor.status] ?? ''}`}>
          {STATUS_LABELS[investor.status] ?? investor.status}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[11px] text-zinc-500">Score: <span className="text-green-400 font-bold">{investor.score}</span>/100</span>
        <span className={`text-[11px] ${MOMENTUM_COLORS[investor.momentum]}`}>
          {MOMENTUM_LABELS[investor.momentum]}
        </span>
        <EnthusiasmDots value={investor.enthusiasm} />
      </div>
      <p className="text-[11px] text-zinc-400 mb-3">{investor.reason}</p>
      <Link
        href={`/investors/${investor.investorId}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-700/30 hover:bg-green-700/50 border border-green-800/50 rounded-lg text-xs text-green-300 font-medium transition-colors"
      >
        <Rocket className="w-3 h-3" />
        Push for Term Sheet
      </Link>
    </div>
  );
}

function AtRiskCard({ investor }: { investor: InvestorSummary }) {
  return (
    <div className="border border-orange-800/40 bg-orange-900/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-3.5 h-3.5 text-orange-400" />
        <Link
          href={`/investors/${investor.investorId}`}
          className="text-sm font-semibold hover:text-blue-400 transition-colors"
        >
          {investor.investorName}
        </Link>
        <TierBadge tier={investor.investorTier} />
        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${TYPE_COLORS[investor.investorType] ?? TYPE_COLORS.vc}`}>
          {TYPE_LABELS[investor.investorType] ?? investor.investorType}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[11px] text-zinc-500">Score: <span className="text-orange-400 font-bold">{investor.score}</span>/100</span>
        <span className={`text-[11px] ${MOMENTUM_COLORS[investor.momentum]}`}>
          {investor.momentum === 'decelerating' || investor.momentum === 'stalled'
            ? <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3 inline" />{MOMENTUM_LABELS[investor.momentum]}</span>
            : <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3 inline" />{MOMENTUM_LABELS[investor.momentum]}</span>
          }
        </span>
        <EnthusiasmDots value={investor.enthusiasm} />
      </div>
      <p className="text-[11px] text-zinc-400">{investor.reason}</p>
    </div>
  );
}

function DeprioritizeSection({ investors }: { investors: InvestorSummary[] }) {
  const [expanded, setExpanded] = useState(false);

  if (investors.length === 0) return null;

  return (
    <div className="border border-zinc-800/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Ban className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
            Deprioritize ({investors.length})
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-600 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="border-t border-zinc-800/50 p-3 space-y-2">
          {investors.map(inv => (
            <div key={inv.investorId} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <XCircle className="w-3 h-3 text-zinc-600" />
                <Link
                  href={`/investors/${inv.investorId}`}
                  className="text-xs text-zinc-400 hover:text-blue-400 transition-colors"
                >
                  {inv.investorName}
                </Link>
                <TierBadge tier={inv.investorTier} />
                <span className="text-[11px] text-zinc-600">Score: {inv.score}/100</span>
              </div>
              <span className="text-[10px] text-zinc-600 max-w-[200px] truncate">{inv.reason}</span>
            </div>
          ))}
          <p className="text-[10px] text-zinc-600 mt-2 pt-2 border-t border-zinc-800/50">
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
        <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-zinc-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-zinc-800/30 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <Zap className="w-6 h-6 text-yellow-400" /> Deal Acceleration
        </h1>
        <div className="border border-zinc-800 rounded-xl p-8 text-center space-y-3">
          <p className="text-zinc-400">Unable to load acceleration data.</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors"
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
            <Zap className="w-6 h-6 text-yellow-400" /> Deal Acceleration
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {data.summary.total} action{data.summary.total !== 1 ? 's' : ''} detected
            {data.summary.immediate > 0 && (
              <> &middot; <span className="text-red-400 font-medium">{data.summary.immediate} immediate</span></>
            )}
            {data.summary.this_week > 0 && (
              <> &middot; <span className="text-yellow-400">{data.summary.this_week} this week</span></>
            )}
            {data.termSheetReady.length > 0 && (
              <> &middot; <span className="text-green-400 font-medium">{data.termSheetReady.length} term sheet ready</span></>
            )}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border border-red-800/30 bg-red-900/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400 text-xs mb-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Immediate
          </div>
          <div className="text-2xl font-bold text-red-400">{data.summary.immediate}</div>
          <div className="text-xs text-zinc-600">need same-day attention</div>
        </div>
        <div className="border border-yellow-800/30 bg-yellow-900/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-400 text-xs mb-1">
            <Clock className="w-3.5 h-3.5" /> This Week
          </div>
          <div className="text-2xl font-bold text-yellow-400">{data.summary.this_week}</div>
          <div className="text-xs text-zinc-600">actions for next 7 days</div>
        </div>
        <div className="border border-green-800/30 bg-green-900/5 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-400 text-xs mb-1">
            <Rocket className="w-3.5 h-3.5" /> Term Sheet Ready
          </div>
          <div className="text-2xl font-bold text-green-400">{data.termSheetReady.length}</div>
          <div className="text-xs text-zinc-600">ready for the push</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800 pb-px">
        {([
          { key: 'all' as FilterTab, label: 'All', count: data.accelerations.length },
          { key: 'pending' as FilterTab, label: 'Pending', count: pendingCount },
          { key: 'executed' as FilterTab, label: 'Executed', count: executedCount },
          { key: 'skipped' as FilterTab, label: 'Skipped', count: skippedCount },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === tab.key ? 'bg-blue-900/50 text-blue-300' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Term Sheet Ready */}
      {data.termSheetReady.length > 0 && (activeTab === 'all' || activeTab === 'pending') && (
        <div>
          <h2 className="text-xs font-medium text-green-400 uppercase tracking-wider flex items-center gap-2 mb-3">
            <CheckCircle className="w-3.5 h-3.5" /> Term Sheet Ready ({data.termSheetReady.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ borderLeft: '3px solid rgb(34 197 94 / 0.4)', paddingLeft: '12px' }}>
            {data.termSheetReady.map(inv => (
              <TermSheetReadyCard key={inv.investorId} investor={inv} />
            ))}
          </div>
        </div>
      )}

      {/* Immediate Actions */}
      {immediateActions.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-2 mb-3">
            <AlertTriangle className="w-3.5 h-3.5" /> Immediate Actions ({immediateActions.length})
          </h2>
          <div className="space-y-2" style={{ borderLeft: '3px solid rgb(239 68 68 / 0.4)', paddingLeft: '12px' }}>
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
          <h2 className="text-xs font-medium text-yellow-400 uppercase tracking-wider flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5" /> This Week ({thisWeekActions.length})
          </h2>
          <div className="space-y-2" style={{ borderLeft: '3px solid rgb(234 179 8 / 0.4)', paddingLeft: '12px' }}>
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
          <h2 className="text-xs font-medium text-orange-400 uppercase tracking-wider flex items-center gap-2 mb-3">
            <Shield className="w-3.5 h-3.5" /> At Risk ({data.atRisk.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ borderLeft: '3px solid rgb(249 115 22 / 0.4)', paddingLeft: '12px' }}>
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
        <div className="border border-zinc-800 rounded-xl p-8 text-center space-y-3">
          <CheckCircle className="w-8 h-8 text-green-400 mx-auto" />
          <p className="text-zinc-400">No acceleration actions detected.</p>
          <p className="text-zinc-500 text-sm">All investors are progressing normally. Check back when new meetings are logged.</p>
        </div>
      )}

      {activeTab !== 'all' && allFiltered.length === 0 && (
        <div className="border border-zinc-800 rounded-xl p-6 text-center">
          <p className="text-zinc-500 text-sm">No {activeTab} actions.</p>
        </div>
      )}
    </div>
  );
}

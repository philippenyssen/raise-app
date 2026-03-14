'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import {
  Target, Clock, AlertTriangle, Zap, ChevronRight, RefreshCw,
  Calendar, CheckCircle, ArrowUpRight, TrendingDown, Timer, Users,
  Rocket, Shield, XCircle, ChevronDown, Play, Ban,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FocusItem {
  investorId: string;
  investorName: string;
  investorType: string;
  investorTier: number;
  status: string;
  enthusiasm: number;
  focusScore: number;
  components: {
    investorScore: number;
    urgency: number;
    momentumRisk: number;
    opportunitySize: number;
    actionReadiness: number;
  };
  recommendedAction: string;
  timeEstimate: string;
  expectedImpact: string;
  riskIfIgnored: string;
  daysSinceLastMeeting: number | null;
  lastMeetingDate: string | null;
  lastMeetingType: string | null;
  momentum: string;
  pendingTaskCount: number;
  openFlagCount: number;
  unresolvedObjections: string[];
  topObjectionTopic: string | null;
}

interface FocusData {
  priorityQueue: FocusItem[];
  quickWins: FocusItem[];
  staleAlerts: FocusItem[];
  weeklyBudget: {
    totalHoursRecommended: number;
    meetingsRecommended: number;
    followUpsRecommended: number;
    investorCount: number;
  };
  generatedAt: string;
}

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
// Helpers
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

function focusScoreColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

function focusScoreBg(score: number): string {
  if (score >= 70) return 'bg-green-500/10 border-green-500/20';
  if (score >= 50) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

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
// Focus Components (existing)
// ---------------------------------------------------------------------------

function PriorityQueueItem({ item, rank }: { item: FocusItem; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded-xl transition-all ${
        rank <= 3 ? 'border-zinc-700 bg-zinc-900/80' : 'border-zinc-800 bg-zinc-900/40'
      } ${expanded ? 'ring-1 ring-zinc-700' : ''}`}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Main row */}
        <div className="flex items-start gap-3">
          {/* Rank number */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
            rank <= 3 ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'
          }`}>
            {rank}
          </div>

          {/* Investor info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/investors/${item.investorId}`}
                onClick={e => e.stopPropagation()}
                className="text-sm font-semibold hover:text-blue-400 transition-colors"
              >
                {item.investorName}
              </Link>
              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${TYPE_COLORS[item.investorType] ?? TYPE_COLORS.vc}`}>
                {TYPE_LABELS[item.investorType] ?? item.investorType}
              </span>
              <TierBadge tier={item.investorTier} />
              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[item.status] ?? STATUS_COLORS.identified}`}>
                {STATUS_LABELS[item.status] ?? item.status}
              </span>
            </div>

            {/* Recommended action */}
            <p className="text-sm text-zinc-200 mt-1.5 leading-snug font-medium">
              {item.recommendedAction}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {/* Time estimate */}
              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                <Timer className="w-3 h-3" />
                {item.timeEstimate}
              </span>

              {/* Days since last meeting */}
              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                <Calendar className="w-3 h-3" />
                {item.daysSinceLastMeeting !== null
                  ? `${item.daysSinceLastMeeting}d ago`
                  : 'No meetings'}
              </span>

              {/* Momentum */}
              <span className={`flex items-center gap-1 text-[11px] ${MOMENTUM_COLORS[item.momentum]}`}>
                {item.momentum === 'decelerating' || item.momentum === 'stalled'
                  ? <TrendingDown className="w-3 h-3" />
                  : <ArrowUpRight className="w-3 h-3" />
                }
                {MOMENTUM_LABELS[item.momentum]}
              </span>

              {/* Enthusiasm */}
              <div className="flex items-center gap-1.5">
                <EnthusiasmDots value={item.enthusiasm} />
              </div>

              {/* Pending tasks */}
              {item.pendingTaskCount > 0 && (
                <span className="text-[11px] text-orange-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {item.pendingTaskCount} task{item.pendingTaskCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Focus score */}
          <div className={`flex flex-col items-center shrink-0 px-3 py-2 rounded-lg border ${focusScoreBg(item.focusScore)}`}>
            <span className={`text-xl font-bold tabular-nums ${focusScoreColor(item.focusScore)}`}>
              {item.focusScore}
            </span>
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Focus</span>
          </div>
        </div>

        {/* Impact + Risk row */}
        <div className="flex items-start gap-4 mt-2.5 ml-11">
          <p className="text-[11px] text-green-400/80 flex-1 leading-relaxed">
            {item.expectedImpact}
          </p>
          <p className="text-[11px] text-red-400/70 flex-1 leading-relaxed">
            {item.riskIfIgnored}
          </p>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3 ml-11 space-y-3">
          {/* Score breakdown */}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Score Breakdown</p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'Investor Score', value: item.components.investorScore, weight: '30%' },
                { label: 'Urgency', value: item.components.urgency, weight: '25%' },
                { label: 'Momentum Risk', value: item.components.momentumRisk, weight: '20%' },
                { label: 'Opportunity Size', value: item.components.opportunitySize, weight: '15%' },
                { label: 'Action Readiness', value: item.components.actionReadiness, weight: '10%' },
              ].map(comp => (
                <div key={comp.label} className="text-center">
                  <div className={`text-sm font-bold tabular-nums ${focusScoreColor(comp.value)}`}>{comp.value}</div>
                  <div className="text-[9px] text-zinc-500 mt-0.5">{comp.label}</div>
                  <div className="text-[8px] text-zinc-600">{comp.weight}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Unresolved objections */}
          {item.unresolvedObjections.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Unresolved Objections</p>
              <div className="space-y-1">
                {item.unresolvedObjections.map((obj, i) => (
                  <div key={i} className="text-xs text-red-400/80 flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    {obj}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Link
              href={`/meetings/new?investor=${item.investorId}`}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-medium transition-colors"
              onClick={e => e.stopPropagation()}
            >
              Schedule Meeting
            </Link>
            <Link
              href={`/investors/${item.investorId}`}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition-colors"
              onClick={e => e.stopPropagation()}
            >
              View Profile
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickWinCard({ item }: { item: FocusItem }) {
  return (
    <div className="border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-3.5 h-3.5 text-yellow-400" />
        <Link
          href={`/investors/${item.investorId}`}
          className="text-sm font-medium hover:text-blue-400 transition-colors"
        >
          {item.investorName}
        </Link>
        <TierBadge tier={item.investorTier} />
      </div>
      {item.unresolvedObjections.length > 0 ? (
        <>
          <p className="text-[11px] text-zinc-500 mb-1">Blocker:</p>
          <p className="text-xs text-red-400/80 mb-2">{item.unresolvedObjections[0]}</p>
          <p className="text-[11px] text-zinc-500 mb-1">Resolution:</p>
          <p className="text-xs text-green-400/80">{item.recommendedAction.substring(0, 120)}</p>
        </>
      ) : (
        <>
          <p className="text-[11px] text-zinc-500 mb-1">Opportunity:</p>
          <p className="text-xs text-zinc-300">{item.recommendedAction.substring(0, 120)}</p>
        </>
      )}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
          <Timer className="w-3 h-3" /> {item.timeEstimate}
        </span>
        <span className={`text-[10px] ${focusScoreColor(item.focusScore)}`}>
          Score: {item.focusScore}
        </span>
      </div>
    </div>
  );
}

function StaleAlertCard({ item, onReengage }: { item: FocusItem; onReengage: (item: FocusItem) => void }) {
  return (
    <div className="border border-red-800/40 bg-red-900/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          <Link
            href={`/investors/${item.investorId}`}
            className="text-sm font-medium hover:text-blue-400 transition-colors"
          >
            {item.investorName}
          </Link>
          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[item.status] ?? ''}`}>
            {STATUS_LABELS[item.status]}
          </span>
        </div>
        <span className="text-xs text-red-400 font-bold">
          {item.daysSinceLastMeeting !== null ? `${item.daysSinceLastMeeting}d` : '--'}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[11px] text-zinc-500">Last enthusiasm:</span>
        <EnthusiasmDots value={item.enthusiasm} />
        <span className={`text-[11px] ${MOMENTUM_COLORS[item.momentum]}`}>
          {MOMENTUM_LABELS[item.momentum]}
        </span>
      </div>
      <button
        onClick={() => onReengage(item)}
        className="px-3 py-1.5 bg-red-800/40 hover:bg-red-700/50 border border-red-800/50 rounded-lg text-xs text-red-300 transition-colors w-full"
      >
        Create Re-engagement Task
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Acceleration Components
// ---------------------------------------------------------------------------

function AccelerationCard({
  item,
  onExecute,
  executing,
}: {
  item: AccelerationItem;
  onExecute: (item: AccelerationItem) => void;
  executing: boolean;
}) {
  return (
    <div className="border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors bg-zinc-900/60">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Header: investor name + badges */}
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

        {/* Execute button */}
        <button
          onClick={() => onExecute(item)}
          disabled={executing}
          className="shrink-0 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <Play className="w-3 h-3" />
          {executing ? 'Done' : 'Execute'}
        </button>
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
      <p className="text-[11px] text-zinc-400">{investor.reason}</p>
    </div>
  );
}

function AtRiskCard({ investor }: { investor: InvestorSummary }) {
  return (
    <div className="border border-red-800/40 bg-red-900/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-3.5 h-3.5 text-red-400" />
        <Link
          href={`/investors/${investor.investorId}`}
          className="text-sm font-semibold hover:text-blue-400 transition-colors"
        >
          {investor.investorName}
        </Link>
        <TierBadge tier={investor.investorTier} />
      </div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[11px] text-zinc-500">Score: <span className="text-red-400 font-bold">{investor.score}</span>/100</span>
        <span className={`text-[11px] ${MOMENTUM_COLORS[investor.momentum]}`}>
          {MOMENTUM_LABELS[investor.momentum]}
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
              </div>
              <span className="text-[10px] text-zinc-600">{inv.reason}</span>
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

export default function FocusPage() {
  const { toast } = useToast();
  const [data, setData] = useState<FocusData | null>(null);
  const [accelData, setAccelData] = useState<AccelerationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accelLoading, setAccelLoading] = useState(true);
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setAccelLoading(true);
    try {
      const [focusRes, accelRes] = await Promise.all([
        fetch('/api/focus'),
        fetch('/api/acceleration'),
      ]);
      if (focusRes.ok) setData(await focusRes.json());
      if (accelRes.ok) setAccelData(await accelRes.json());
    } catch (err) {
      toast('Failed to load focus data', 'error');
      console.error(err);
    } finally {
      setLoading(false);
      setAccelLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleReengage(item: FocusItem) {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Re-engage ${item.investorName} --- ${item.daysSinceLastMeeting ?? '?'}d since last contact`,
          description: `Process is ${item.momentum}. Last enthusiasm: ${item.enthusiasm}/5.\n\nRecommended: ${item.recommendedAction}`,
          assignee: '',
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'pending',
          priority: 'critical',
          phase: 'outreach',
          investor_id: item.investorId,
          investor_name: item.investorName,
          auto_generated: true,
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      toast(`Re-engagement task created for ${item.investorName}`);
    } catch {
      toast('Failed to create task', 'error');
    }
  }

  async function handleExecuteAcceleration(item: AccelerationItem) {
    try {
      const res = await fetch('/api/acceleration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          status: 'executed',
        }),
      });
      if (!res.ok) throw new Error('Failed to mark action as executed');
      setExecutedIds(prev => new Set(prev).add(item.id));
      toast(`Action executed for ${item.investorName}`);
    } catch {
      toast('Failed to update action', 'error');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-zinc-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-32 bg-zinc-800/30 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.priorityQueue.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <Target className="w-6 h-6 text-blue-400" /> CEO Focus
        </h1>
        <div className="border border-zinc-800 rounded-xl p-8 text-center space-y-3">
          <p className="text-zinc-400">No active investors to prioritize.</p>
          <p className="text-zinc-500 text-sm">Add investors and log meetings to see your priority queue.</p>
          <Link href="/investors" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors">
            Add Investors
          </Link>
        </div>
      </div>
    );
  }

  const { priorityQueue, quickWins, staleAlerts, weeklyBudget } = data;

  // Group acceleration items by urgency
  const immediateActions = accelData?.accelerations.filter(a => a.urgency === 'immediate' && !executedIds.has(a.id)) ?? [];
  const thisWeekActions = accelData?.accelerations.filter(a => (a.urgency === '48h' || a.urgency === 'this_week') && !executedIds.has(a.id)) ?? [];
  const hasAccelerationData = accelData && accelData.accelerations.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <Target className="w-6 h-6 text-blue-400" /> CEO Focus
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {weeklyBudget.totalHoursRecommended}h recommended this week across {weeklyBudget.investorCount} investors
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Weekly Budget Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <Clock className="w-3.5 h-3.5" /> Total Time
          </div>
          <div className="text-2xl font-bold">{weeklyBudget.totalHoursRecommended}h</div>
          <div className="text-xs text-zinc-600">recommended this week</div>
        </div>
        <div className="border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <Calendar className="w-3.5 h-3.5" /> Meetings
          </div>
          <div className="text-2xl font-bold">{weeklyBudget.meetingsRecommended}</div>
          <div className="text-xs text-zinc-600">calls & meetings</div>
        </div>
        <div className="border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <CheckCircle className="w-3.5 h-3.5" /> Follow-ups
          </div>
          <div className="text-2xl font-bold">{weeklyBudget.followUpsRecommended}</div>
          <div className="text-xs text-zinc-600">prep & outreach</div>
        </div>
        <div className="border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <Rocket className="w-3.5 h-3.5" /> Acceleration
          </div>
          <div className="text-2xl font-bold">{accelData?.summary.total ?? 0}</div>
          <div className="text-xs text-zinc-600">
            {accelData?.summary.immediate ?? 0} immediate
          </div>
        </div>
      </div>

      {/* Deal Acceleration Engine */}
      {hasAccelerationData && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Rocket className="w-4 h-4 text-blue-400" /> Deal Acceleration Engine
          </h2>

          {/* Term Sheet Ready */}
          {accelData.termSheetReady.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-green-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <CheckCircle className="w-3.5 h-3.5" /> Term Sheet Ready ({accelData.termSheetReady.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {accelData.termSheetReady.map(inv => (
                  <TermSheetReadyCard key={inv.investorId} investor={inv} />
                ))}
              </div>
            </div>
          )}

          {/* Immediate Actions */}
          {immediateActions.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Immediate ({immediateActions.length})
              </h3>
              <div className="space-y-2">
                {immediateActions.map(item => (
                  <AccelerationCard
                    key={item.id}
                    item={item}
                    onExecute={handleExecuteAcceleration}
                    executing={executedIds.has(item.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* This Week Actions */}
          {thisWeekActions.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-yellow-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <Clock className="w-3.5 h-3.5" /> This Week ({thisWeekActions.length})
              </h3>
              <div className="space-y-2">
                {thisWeekActions.map(item => (
                  <AccelerationCard
                    key={item.id}
                    item={item}
                    onExecute={handleExecuteAcceleration}
                    executing={executedIds.has(item.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* At Risk */}
          {accelData.atRisk.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5" /> At Risk ({accelData.atRisk.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {accelData.atRisk.map(inv => (
                  <AtRiskCard key={inv.investorId} investor={inv} />
                ))}
              </div>
            </div>
          )}

          {/* Deprioritize */}
          <DeprioritizeSection investors={accelData.deprioritize} />
        </div>
      )}

      {/* Main content: Priority Queue + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Queue */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4" /> Priority Queue
          </h2>
          <div className="space-y-2">
            {priorityQueue.map((item, i) => (
              <PriorityQueueItem key={item.investorId} item={item} rank={i + 1} />
            ))}
          </div>
        </div>

        {/* Sidebar: Quick Wins + Stale Alerts */}
        <div className="space-y-6">
          {/* Quick Wins */}
          {quickWins.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-yellow-400" /> Quick Wins
              </h2>
              <div className="space-y-2">
                {quickWins.map(item => (
                  <QuickWinCard key={item.investorId} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Stale Alerts */}
          {staleAlerts.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-red-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" /> Stale Alerts
              </h2>
              <div className="space-y-2">
                {staleAlerts.map(item => (
                  <StaleAlertCard key={item.investorId} item={item} onReengage={handleReengage} />
                ))}
              </div>
            </div>
          )}

          {/* If no quick wins or stale alerts */}
          {quickWins.length === 0 && staleAlerts.length === 0 && (
            <div className="border border-zinc-800 rounded-xl p-6 text-center">
              <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-zinc-400">All clear</p>
              <p className="text-xs text-zinc-600 mt-1">No quick wins or stale processes to flag.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

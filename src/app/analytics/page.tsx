'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import {
  BarChart3, TrendingUp, AlertTriangle, Users, Clock,
  ArrowRight, RefreshCw, Target, Zap, ShieldAlert,
  ChevronDown, ChevronUp, Calendar, MessageSquare,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────

interface AnalyticsData {
  funnel: {
    cumulative: Record<string, number>;
    exact: Record<string, number>;
    conversionRates: Array<{
      from: string; to: string; rate: number;
      fromCount: number; toCount: number;
    }>;
    dropOffRates: Array<{ stage: string; rate: number; count: number }>;
    avgTimeInStage: Record<string, { avgDays: number; count: number }>;
    bottleneck: { stage: string; label: string; count: number } | null;
  };
  velocity: {
    meetingsPerWeek: Array<{ week: string; count: number }>;
    investorsPerWeek: Array<{ week: string; count: number }>;
    velocityScore: number;
    daysSinceProgress: number | null;
    estimatedDaysToClose: number | null;
    onTrack: boolean | null;
    totalMeetings: number;
    meetingsThisWeek: number;
    meetingsLastWeek: number;
  };
  engagement: {
    enthusiasmByType: Record<string, { avg: number; count: number }>;
    avgEnthusiasm: number;
    topObjections: Array<{ topic: string; count: number }>;
    objectionResolutionRate: number;
    totalObjections: number;
    addressedObjections: number;
    competitiveMentions: number;
    topCompetitors: Array<{ name: string; count: number }>;
  };
  risks: {
    staleInvestors: Array<{
      id: string; name: string; status: string; tier: number; type: string;
      lastMeetingDate: string | null; daysSinceLastMeeting: number | null;
    }>;
    decliningEnthusiasm: Array<{
      id: string; name: string; tier: number; type: string;
      previousScore: number; currentScore: number; trend: string;
    }>;
    highTierStuck: Array<{
      id: string; name: string; tier: number; status: string; type: string;
      daysInStage: number;
    }>;
    concentrationRisk: {
      isRisky: boolean;
      maxConcentration: number;
      dominantType: string | null;
      breakdown: Record<string, number>;
    };
    timelineRisk: {
      level: 'low' | 'medium' | 'high';
      daysRemaining: number | null;
      targetDate: string | null;
    };
    totalAlerts: number;
  };
  winLoss: {
    passedCount: number;
    droppedCount: number;
    passRate: number;
    topPassReasons: Array<{ topic: string; count: number }>;
    passStageDistribution: Record<string, number>;
    outcomeByTier: Record<number, { active: number; passed: number; dropped: number }>;
    outcomeByType: Record<string, { active: number; passed: number; dropped: number }>;
  };
  summary: {
    totalInvestors: number;
    activeInvestors: number;
    totalMeetings: number;
    avgEnthusiasm: number;
    pipelineStages: Array<{ stage: string; label: string; count: number }>;
  };
  generatedAt: string;
}

// ── Constants ────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  identified: 'bg-slate-600',
  contacted: 'bg-blue-700',
  nda_signed: 'bg-blue-600',
  meeting_scheduled: 'bg-indigo-600',
  met: 'bg-violet-600',
  engaged: 'bg-purple-600',
  in_dd: 'bg-amber-600',
  term_sheet: 'bg-orange-500',
  closed: 'bg-emerald-500',
};

const STAGE_LABELS: Record<string, string> = {
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

const TYPE_LABELS: Record<string, string> = {
  vc: 'VC',
  growth: 'Growth',
  sovereign: 'Sovereign',
  strategic: 'Strategic',
  debt: 'Debt',
  family_office: 'Family Office',
};

// ── Main Page ────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['funnel', 'velocity', 'risks', 'engagement', 'winloss'])
  );

  useEffect(() => { fetchAnalytics(); }, []);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics');
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      setData(await res.json());
    } catch (err) {
      toast('Failed to load analytics', 'error');
    } finally {
      setLoading(false);
    }
  }

  function toggleSection(section: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  // ── Loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-zinc-800/50 rounded-xl animate-pulse" />
        <div className="h-48 bg-zinc-800/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Process Analytics</h1>
        <div className="border border-red-800/30 bg-red-900/10 rounded-xl p-8 text-center space-y-3">
          <p className="text-zinc-400">Could not load analytics data.</p>
          <button onClick={fetchAnalytics} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { funnel, velocity, engagement, risks, winLoss, summary } = data;

  return (
    <div className="space-y-6 pb-12">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Process Analytics</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Deep funnel, velocity, and risk analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-600">
            Updated {new Date(data.generatedAt).toLocaleTimeString()}
          </span>
          <button
            onClick={fetchAnalytics}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Summary Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="Active Pipeline"
          value={String(summary.activeInvestors)}
          sub={`of ${summary.totalInvestors} total`}
          icon={<Users className="w-4 h-4" />}
          color="text-blue-400"
        />
        <SummaryCard
          label="Velocity Score"
          value={velocity.velocityScore > 0 ? velocity.velocityScore.toFixed(1) : '---'}
          sub="tier x stage x signal"
          icon={<Zap className="w-4 h-4" />}
          color="text-amber-400"
        />
        <SummaryCard
          label="Risk Alerts"
          value={String(risks.totalAlerts)}
          sub={risks.totalAlerts === 0 ? 'all clear' : 'need attention'}
          icon={<ShieldAlert className="w-4 h-4" />}
          color={risks.totalAlerts === 0 ? 'text-emerald-400' : risks.totalAlerts <= 3 ? 'text-yellow-400' : 'text-red-400'}
        />
        <SummaryCard
          label="Meetings"
          value={String(velocity.totalMeetings)}
          sub={`${velocity.meetingsThisWeek} this week`}
          icon={<Calendar className="w-4 h-4" />}
          color="text-purple-400"
        />
      </div>

      {/* ── Bottleneck Alert ─────────────────────────────────────── */}
      {funnel.bottleneck && funnel.bottleneck.count > 2 && (
        <div className="border border-amber-700/30 bg-amber-900/10 rounded-xl px-5 py-4 flex items-center gap-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <div className="text-sm font-medium text-amber-300">
              Bottleneck Detected: {funnel.bottleneck.label}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              {funnel.bottleneck.count} investors stuck at this stage.
              Consider targeted follow-ups to move them forward.
            </div>
          </div>
          <Link
            href="/pipeline"
            className="ml-auto shrink-0 text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            Pipeline <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* ── Timeline Risk Alert ──────────────────────────────────── */}
      {risks.timelineRisk.level !== 'low' && (
        <div className={`border rounded-xl px-5 py-4 flex items-center gap-4 ${
          risks.timelineRisk.level === 'high'
            ? 'border-red-700/30 bg-red-900/10'
            : 'border-yellow-700/30 bg-yellow-900/10'
        }`}>
          <Clock className={`w-5 h-5 shrink-0 ${
            risks.timelineRisk.level === 'high' ? 'text-red-400' : 'text-yellow-400'
          }`} />
          <div>
            <div className={`text-sm font-medium ${
              risks.timelineRisk.level === 'high' ? 'text-red-300' : 'text-yellow-300'
            }`}>
              Timeline Risk: {risks.timelineRisk.level === 'high' ? 'Critical' : 'Elevated'}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              {risks.timelineRisk.daysRemaining !== null
                ? `${risks.timelineRisk.daysRemaining} days remaining to target close`
                : 'No target close date set'}
              {risks.timelineRisk.targetDate && ` (${new Date(risks.timelineRisk.targetDate).toLocaleDateString()})`}.
              No investors in advanced stages (DD+) yet.
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          1. FUNNEL ANALYTICS
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Funnel Analytics"
        icon={<BarChart3 className="w-4 h-4" />}
        isOpen={expandedSections.has('funnel')}
        onToggle={() => toggleSection('funnel')}
      >
        {/* Funnel Visualization */}
        <div className="space-y-6">
          {/* Horizontal funnel bars */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Pipeline Distribution
            </h3>
            <div className="space-y-2">
              {summary.pipelineStages.map((stage, idx) => {
                const maxCount = Math.max(...summary.pipelineStages.map(s => s.count), 1);
                const pct = (stage.count / maxCount) * 100;
                return (
                  <div key={stage.stage} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-zinc-400 text-right shrink-0">
                      {stage.label}
                    </div>
                    <div className="flex-1 h-8 bg-zinc-900 rounded overflow-hidden relative">
                      <div
                        className={`h-full ${STAGE_COLORS[stage.stage] || 'bg-zinc-600'} rounded transition-all duration-700 ease-out flex items-center px-3`}
                        style={{ width: `${Math.max(pct, stage.count > 0 ? 8 : 0)}%` }}
                      >
                        {stage.count > 0 && (
                          <span className="text-xs font-bold text-white/90">{stage.count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Passed / Dropped */}
              {((funnel.exact['passed'] || 0) > 0 || (funnel.exact['dropped'] || 0) > 0) && (
                <div className="pt-2 mt-2 border-t border-zinc-800 space-y-2">
                  {(funnel.exact['passed'] || 0) > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-xs text-red-400/80 text-right shrink-0">Passed</div>
                      <div className="flex-1 h-8 bg-zinc-900 rounded overflow-hidden">
                        <div
                          className="h-full bg-red-800/50 rounded flex items-center px-3"
                          style={{ width: `${Math.max((funnel.exact['passed'] / Math.max(...summary.pipelineStages.map(s => s.count), 1)) * 100, 8)}%` }}
                        >
                          <span className="text-xs font-bold text-red-400">{funnel.exact['passed']}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {(funnel.exact['dropped'] || 0) > 0 && (
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-xs text-zinc-500 text-right shrink-0">Dropped</div>
                      <div className="flex-1 h-8 bg-zinc-900 rounded overflow-hidden">
                        <div
                          className="h-full bg-zinc-800 rounded flex items-center px-3"
                          style={{ width: `${Math.max((funnel.exact['dropped'] / Math.max(...summary.pipelineStages.map(s => s.count), 1)) * 100, 8)}%` }}
                        >
                          <span className="text-xs font-bold text-zinc-400">{funnel.exact['dropped']}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Conversion Rates */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Stage-to-Stage Conversion
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {funnel.conversionRates.map(cr => (
                <div key={`${cr.from}-${cr.to}`} className="border border-zinc-800 rounded-lg p-3">
                  <div className="text-[10px] text-zinc-600 mb-1 truncate">
                    {STAGE_LABELS[cr.from]} {'->'} {STAGE_LABELS[cr.to]}
                  </div>
                  <div className={`text-xl font-bold ${
                    cr.rate >= 60 ? 'text-emerald-400' :
                    cr.rate >= 30 ? 'text-yellow-400' :
                    cr.rate > 0 ? 'text-red-400' : 'text-zinc-700'
                  }`}>
                    {cr.rate}%
                  </div>
                  <div className="text-[10px] text-zinc-600">
                    {cr.fromCount} {'->'} {cr.toCount}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Drop-off Analysis */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Drop-off by Stage
            </h3>
            <div className="space-y-1.5">
              {funnel.dropOffRates.filter(d => d.rate > 0).map(d => (
                <div key={d.stage} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-zinc-400 text-right shrink-0">
                    {STAGE_LABELS[d.stage]}
                  </div>
                  <div className="flex-1 h-6 bg-zinc-900 rounded overflow-hidden">
                    <div
                      className="h-full bg-red-900/40 border-r border-red-600/50 rounded-l flex items-center px-2"
                      style={{ width: `${Math.max(d.rate, 5)}%` }}
                    >
                      <span className="text-[10px] font-medium text-red-400 whitespace-nowrap">
                        {d.rate}% ({d.count})
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {funnel.dropOffRates.every(d => d.rate === 0) && (
                <p className="text-sm text-zinc-600">No drop-offs detected yet. Add more investors and progress them through stages.</p>
              )}
            </div>
          </div>

          {/* Average Time in Stage */}
          {Object.keys(funnel.avgTimeInStage).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Average Time in Stage (days)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(funnel.avgTimeInStage).map(([stage, data]) => (
                  <div key={stage} className="border border-zinc-800 rounded-lg p-3">
                    <div className="text-[10px] text-zinc-600 mb-1">{STAGE_LABELS[stage]}</div>
                    <div className={`text-lg font-bold ${
                      data.avgDays > 14 ? 'text-red-400' :
                      data.avgDays > 7 ? 'text-yellow-400' :
                      'text-emerald-400'
                    }`}>
                      {data.avgDays}d
                    </div>
                    <div className="text-[10px] text-zinc-700">n={data.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════
          2. VELOCITY METRICS
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Velocity Metrics"
        icon={<TrendingUp className="w-4 h-4" />}
        isOpen={expandedSections.has('velocity')}
        onToggle={() => toggleSection('velocity')}
      >
        <div className="space-y-6">
          {/* Key velocity numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border border-zinc-800 rounded-lg p-3">
              <div className="text-[10px] text-zinc-600">Meetings This Week</div>
              <div className="text-2xl font-bold">{velocity.meetingsThisWeek}</div>
              <div className="text-[10px] text-zinc-600">
                {velocity.meetingsLastWeek > 0 && (
                  <span className={velocity.meetingsThisWeek >= velocity.meetingsLastWeek ? 'text-emerald-500' : 'text-red-400'}>
                    {velocity.meetingsThisWeek >= velocity.meetingsLastWeek ? '+' : ''}
                    {velocity.meetingsThisWeek - velocity.meetingsLastWeek} vs last week
                  </span>
                )}
              </div>
            </div>
            <div className="border border-zinc-800 rounded-lg p-3">
              <div className="text-[10px] text-zinc-600">Pipeline Velocity</div>
              <div className="text-2xl font-bold text-amber-400">{velocity.velocityScore > 0 ? velocity.velocityScore.toFixed(1) : '---'}</div>
              <div className="text-[10px] text-zinc-600">weighted score</div>
            </div>
            <div className="border border-zinc-800 rounded-lg p-3">
              <div className="text-[10px] text-zinc-600">Days Since Progress</div>
              <div className={`text-2xl font-bold ${
                velocity.daysSinceProgress === null ? 'text-zinc-700' :
                velocity.daysSinceProgress > 7 ? 'text-red-400' :
                velocity.daysSinceProgress > 3 ? 'text-yellow-400' :
                'text-emerald-400'
              }`}>
                {velocity.daysSinceProgress !== null ? velocity.daysSinceProgress : '---'}
              </div>
              <div className="text-[10px] text-zinc-600">last meeting or status change</div>
            </div>
            <div className="border border-zinc-800 rounded-lg p-3">
              <div className="text-[10px] text-zinc-600">Est. Days to Close</div>
              <div className={`text-2xl font-bold ${
                velocity.estimatedDaysToClose === null ? 'text-zinc-700' :
                velocity.estimatedDaysToClose < 30 ? 'text-red-400' :
                velocity.estimatedDaysToClose < 60 ? 'text-yellow-400' :
                'text-blue-400'
              }`}>
                {velocity.estimatedDaysToClose !== null ? velocity.estimatedDaysToClose : '---'}
              </div>
              <div className="text-[10px] text-zinc-600">
                {velocity.onTrack === true && <span className="text-emerald-500">On track</span>}
                {velocity.onTrack === false && <span className="text-red-400">Behind schedule</span>}
                {velocity.onTrack === null && 'no target set'}
              </div>
            </div>
          </div>

          {/* Meetings per week sparkline */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Meetings Per Week (Last 8 Weeks)
            </h3>
            <SparklineChart data={velocity.meetingsPerWeek} color="bg-blue-500" />
          </div>

          {/* Investors added per week */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              New Investors Per Week
            </h3>
            <SparklineChart data={velocity.investorsPerWeek} color="bg-purple-500" />
          </div>
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════
          3. RISK SIGNALS
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title={`Risk Signals${risks.totalAlerts > 0 ? ` (${risks.totalAlerts})` : ''}`}
        icon={<ShieldAlert className="w-4 h-4" />}
        isOpen={expandedSections.has('risks')}
        onToggle={() => toggleSection('risks')}
        badge={risks.totalAlerts > 0 ? {
          text: String(risks.totalAlerts),
          color: risks.totalAlerts > 5 ? 'bg-red-600' : risks.totalAlerts > 2 ? 'bg-yellow-600' : 'bg-blue-600',
        } : undefined}
      >
        <div className="space-y-5">
          {/* Stale Investors */}
          <RiskSection
            title="Stale Investors"
            subtitle="Engaged+ investors with no meeting in 2+ weeks"
            count={risks.staleInvestors.length}
            severity={risks.staleInvestors.length > 3 ? 'high' : risks.staleInvestors.length > 0 ? 'medium' : 'low'}
          >
            {risks.staleInvestors.length === 0 ? (
              <p className="text-sm text-zinc-600">No stale investors. All engaged investors have recent meetings.</p>
            ) : (
              <div className="space-y-1.5">
                {risks.staleInvestors.map(inv => (
                  <Link
                    key={inv.id}
                    href={`/investors/${inv.id}`}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        inv.tier === 1 ? 'bg-blue-600/20 text-blue-400 border-blue-600/30' :
                        inv.tier === 2 ? 'bg-purple-600/20 text-purple-400 border-purple-600/30' :
                        'bg-zinc-600/20 text-zinc-400 border-zinc-600/30'
                      }`}>
                        T{inv.tier}
                      </span>
                      <span className="text-sm font-medium truncate">{inv.name}</span>
                      <span className="text-[10px] text-zinc-600">{STAGE_LABELS[inv.status]}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-red-400">
                        {inv.daysSinceLastMeeting !== null
                          ? `${inv.daysSinceLastMeeting}d ago`
                          : 'No meetings'}
                      </span>
                      <ArrowRight className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </RiskSection>

          {/* Declining Enthusiasm */}
          <RiskSection
            title="Declining Enthusiasm"
            subtitle="Investors whose signal score dropped between meetings"
            count={risks.decliningEnthusiasm.length}
            severity={risks.decliningEnthusiasm.length > 2 ? 'high' : risks.decliningEnthusiasm.length > 0 ? 'medium' : 'low'}
          >
            {risks.decliningEnthusiasm.length === 0 ? (
              <p className="text-sm text-zinc-600">No declining enthusiasm detected.</p>
            ) : (
              <div className="space-y-1.5">
                {risks.decliningEnthusiasm.map(inv => (
                  <Link
                    key={inv.id}
                    href={`/investors/${inv.id}`}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        inv.tier === 1 ? 'bg-blue-600/20 text-blue-400 border-blue-600/30' :
                        'bg-purple-600/20 text-purple-400 border-purple-600/30'
                      }`}>T{inv.tier}</span>
                      <span className="text-sm font-medium truncate">{inv.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <EnthusiasmDots score={inv.previousScore} size="sm" />
                      <span className="text-zinc-600 text-xs">{'>'}</span>
                      <EnthusiasmDots score={inv.currentScore} size="sm" />
                      <ArrowRight className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 ml-1" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </RiskSection>

          {/* High-Tier Stuck */}
          <RiskSection
            title="High-Tier Investors Not Progressing"
            subtitle="T1/T2 investors stuck in stage for 14+ days"
            count={risks.highTierStuck.length}
            severity={risks.highTierStuck.length > 3 ? 'high' : risks.highTierStuck.length > 0 ? 'medium' : 'low'}
          >
            {risks.highTierStuck.length === 0 ? (
              <p className="text-sm text-zinc-600">All high-tier investors are progressing.</p>
            ) : (
              <div className="space-y-1.5">
                {risks.highTierStuck.map(inv => (
                  <Link
                    key={inv.id}
                    href={`/investors/${inv.id}`}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[10px] px-1.5 py-0.5 rounded border bg-blue-600/20 text-blue-400 border-blue-600/30">
                        T{inv.tier}
                      </span>
                      <span className="text-sm font-medium truncate">{inv.name}</span>
                      <span className="text-[10px] text-zinc-600">{STAGE_LABELS[inv.status]}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-yellow-400">
                        {inv.daysInStage}d in stage
                      </span>
                      <ArrowRight className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </RiskSection>

          {/* Concentration Risk */}
          <RiskSection
            title="Concentration Risk"
            subtitle="Diversification across investor types"
            count={risks.concentrationRisk.isRisky ? 1 : 0}
            severity={risks.concentrationRisk.isRisky ? 'medium' : 'low'}
          >
            <div className="space-y-3">
              {risks.concentrationRisk.isRisky && (
                <p className="text-sm text-yellow-400">
                  {risks.concentrationRisk.maxConcentration}% of active pipeline is {TYPE_LABELS[risks.concentrationRisk.dominantType || ''] || risks.concentrationRisk.dominantType}.
                  Consider diversifying investor outreach.
                </p>
              )}
              <div className="flex gap-2 flex-wrap">
                {Object.entries(risks.concentrationRisk.breakdown).map(([type, count]) => (
                  <div key={type} className="border border-zinc-800 rounded px-3 py-2">
                    <div className="text-[10px] text-zinc-600">{TYPE_LABELS[type] || type}</div>
                    <div className="text-sm font-bold">{count}</div>
                  </div>
                ))}
              </div>
            </div>
          </RiskSection>
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════
          4. ENGAGEMENT INTELLIGENCE
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Engagement Intelligence"
        icon={<MessageSquare className="w-4 h-4" />}
        isOpen={expandedSections.has('engagement')}
        onToggle={() => toggleSection('engagement')}
      >
        <div className="space-y-6">
          {/* Enthusiasm by Type */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Average Enthusiasm by Investor Type
            </h3>
            {Object.keys(engagement.enthusiasmByType).length === 0 ? (
              <p className="text-sm text-zinc-600">No enthusiasm data yet. Log meetings to track investor signals.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(engagement.enthusiasmByType)
                  .sort((a, b) => b[1].avg - a[1].avg)
                  .map(([type, data]) => (
                    <div key={type} className="border border-zinc-800 rounded-lg p-3">
                      <div className="text-[10px] text-zinc-600 mb-1">{TYPE_LABELS[type] || type}</div>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${
                          data.avg >= 4 ? 'text-emerald-400' :
                          data.avg >= 3 ? 'text-blue-400' :
                          data.avg >= 2 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {data.avg}
                        </span>
                        <EnthusiasmDots score={Math.round(data.avg)} />
                      </div>
                      <div className="text-[10px] text-zinc-700 mt-0.5">n={data.count}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Objection Leaderboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Top Objection Topics
              </h3>
              {engagement.topObjections.length === 0 ? (
                <p className="text-sm text-zinc-600">No objections recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {engagement.topObjections.map((obj, i) => {
                    const maxCount = engagement.topObjections[0]?.count || 1;
                    const pct = (obj.count / maxCount) * 100;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 w-4 text-right shrink-0">
                          {i + 1}.
                        </span>
                        <div className="flex-1 relative">
                          <div className="h-7 bg-zinc-900 rounded overflow-hidden">
                            <div
                              className="h-full bg-red-900/30 rounded flex items-center px-2"
                              style={{ width: `${Math.max(pct, 15)}%` }}
                            >
                              <span className="text-[11px] text-zinc-300 truncate">{obj.topic}</span>
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-red-400 shrink-0 w-8 text-right">
                          {obj.count}x
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Objection Resolution */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                  Objection Resolution
                </h3>
                <div className="border border-zinc-800 rounded-lg p-4">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-bold ${
                      engagement.objectionResolutionRate >= 70 ? 'text-emerald-400' :
                      engagement.objectionResolutionRate >= 40 ? 'text-yellow-400' :
                      engagement.totalObjections === 0 ? 'text-zinc-700' :
                      'text-red-400'
                    }`}>
                      {engagement.totalObjections > 0 ? `${engagement.objectionResolutionRate}%` : '---'}
                    </span>
                    <span className="text-xs text-zinc-600">resolved</span>
                  </div>
                  <div className="mt-2 h-3 bg-zinc-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        engagement.objectionResolutionRate >= 70 ? 'bg-emerald-500' :
                        engagement.objectionResolutionRate >= 40 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${engagement.objectionResolutionRate}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-2">
                    {engagement.addressedObjections} of {engagement.totalObjections} objections addressed
                  </div>
                </div>
              </div>

              {/* Competitive Mentions */}
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                  Competitive Intelligence
                </h3>
                <div className="border border-zinc-800 rounded-lg p-4">
                  <div className="text-2xl font-bold">
                    {engagement.competitiveMentions}
                  </div>
                  <div className="text-[10px] text-zinc-600">meetings with competitive mentions</div>
                  {engagement.topCompetitors.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {engagement.topCompetitors.map(c => (
                        <span key={c.name} className="text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                          {c.name} ({c.count}x)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ═══════════════════════════════════════════════════════════
          5. WIN/LOSS INSIGHTS
          ═══════════════════════════════════════════════════════════ */}
      <CollapsibleSection
        title="Win / Loss Insights"
        icon={<Target className="w-4 h-4" />}
        isOpen={expandedSections.has('winloss')}
        onToggle={() => toggleSection('winloss')}
      >
        <div className="space-y-6">
          {/* Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border border-zinc-800 rounded-lg p-3">
              <div className="text-[10px] text-zinc-600">Passed</div>
              <div className="text-2xl font-bold text-red-400">{winLoss.passedCount}</div>
            </div>
            <div className="border border-zinc-800 rounded-lg p-3">
              <div className="text-[10px] text-zinc-600">Dropped</div>
              <div className="text-2xl font-bold text-zinc-500">{winLoss.droppedCount}</div>
            </div>
            <div className="border border-zinc-800 rounded-lg p-3">
              <div className="text-[10px] text-zinc-600">Attrition Rate</div>
              <div className={`text-2xl font-bold ${
                winLoss.passRate > 30 ? 'text-red-400' :
                winLoss.passRate > 15 ? 'text-yellow-400' :
                winLoss.passRate > 0 ? 'text-emerald-400' :
                'text-zinc-700'
              }`}>
                {winLoss.passRate}%
              </div>
            </div>
            <div className="border border-zinc-800 rounded-lg p-3">
              <div className="text-[10px] text-zinc-600">Active</div>
              <div className="text-2xl font-bold text-emerald-400">
                {summary.activeInvestors}
              </div>
            </div>
          </div>

          {/* Outcomes by Tier */}
          {Object.keys(winLoss.outcomeByTier).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Outcomes by Tier
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(winLoss.outcomeByTier)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([tier, data]) => {
                    const total = data.active + data.passed + data.dropped;
                    return (
                      <div key={tier} className="border border-zinc-800 rounded-lg p-3">
                        <div className="text-[10px] text-zinc-600 mb-2">Tier {tier}</div>
                        <div className="h-4 bg-zinc-900 rounded-full overflow-hidden flex">
                          {data.active > 0 && (
                            <div
                              className="h-full bg-emerald-600"
                              style={{ width: `${(data.active / total) * 100}%` }}
                              title={`Active: ${data.active}`}
                            />
                          )}
                          {data.passed > 0 && (
                            <div
                              className="h-full bg-red-700"
                              style={{ width: `${(data.passed / total) * 100}%` }}
                              title={`Passed: ${data.passed}`}
                            />
                          )}
                          {data.dropped > 0 && (
                            <div
                              className="h-full bg-zinc-700"
                              style={{ width: `${(data.dropped / total) * 100}%` }}
                              title={`Dropped: ${data.dropped}`}
                            />
                          )}
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-600 mt-1.5">
                          <span className="text-emerald-500">{data.active} active</span>
                          <span className="text-red-400">{data.passed + data.dropped} out</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Outcomes by Type */}
          {Object.keys(winLoss.outcomeByType).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Outcomes by Investor Type
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(winLoss.outcomeByType)
                  .sort(([, a], [, b]) => (b.active / (b.active + b.passed + b.dropped)) - (a.active / (a.active + a.passed + a.dropped)))
                  .map(([type, data]) => {
                    const total = data.active + data.passed + data.dropped;
                    const retentionRate = total > 0 ? Math.round((data.active / total) * 100) : 0;
                    return (
                      <div key={type} className="border border-zinc-800 rounded-lg p-3">
                        <div className="text-[10px] text-zinc-600 mb-1">{TYPE_LABELS[type] || type}</div>
                        <div className={`text-lg font-bold ${
                          retentionRate >= 80 ? 'text-emerald-400' :
                          retentionRate >= 50 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {retentionRate}%
                        </div>
                        <div className="text-[10px] text-zinc-600">
                          {data.active} active, {data.passed} passed, {data.dropped} dropped
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Top Pass Reasons */}
          {winLoss.topPassReasons.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Top Pass Reasons
              </h3>
              <div className="space-y-1.5">
                {winLoss.topPassReasons.map((reason, i) => (
                  <div key={i} className="flex items-center gap-3 py-1">
                    <span className="text-xs text-zinc-500 w-4 text-right">{i + 1}.</span>
                    <span className="text-sm text-zinc-300 flex-1">{reason.topic}</span>
                    <span className="text-xs text-red-400 font-medium">{reason.count}x</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {winLoss.passedCount === 0 && winLoss.droppedCount === 0 && (
            <p className="text-sm text-zinc-600">
              No investors have passed or dropped yet. Win/loss insights will appear as the process progresses.
            </p>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, icon, color,
}: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; color: string;
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

function CollapsibleSection({
  title, icon, isOpen, onToggle, children, badge,
}: {
  title: string; icon: React.ReactNode; isOpen: boolean;
  onToggle: () => void; children: React.ReactNode;
  badge?: { text: string; color: string };
}) {
  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-zinc-400">{icon}</span>
          <span className="text-sm font-medium">{title}</span>
          {badge && (
            <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full ${badge.color}`}>
              {badge.text}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-zinc-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-600" />
        )}
      </button>
      {isOpen && (
        <div className="px-5 pb-5 border-t border-zinc-800/50 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

function SparklineChart({
  data, color,
}: {
  data: Array<{ week: string; count: number }>;
  color: string;
}) {
  const maxVal = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-[10px] text-zinc-500 font-medium">{d.count}</span>
          <div className="w-full bg-zinc-900 rounded-t relative" style={{ height: '72px' }}>
            <div
              className={`absolute bottom-0 w-full ${color} rounded-t transition-all duration-500`}
              style={{ height: `${Math.max((d.count / maxVal) * 100, d.count > 0 ? 8 : 0)}%` }}
            />
          </div>
          <span className="text-[9px] text-zinc-700 truncate w-full text-center">{d.week}</span>
        </div>
      ))}
    </div>
  );
}

function EnthusiasmDots({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const dotSize = size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <div
          key={n}
          className={`${dotSize} rounded-full ${
            n <= score
              ? score >= 4
                ? 'bg-emerald-500'
                : score >= 3
                ? 'bg-blue-500'
                : 'bg-zinc-500'
              : 'bg-zinc-800'
          }`}
        />
      ))}
    </div>
  );
}

function RiskSection({
  title, subtitle, count, severity, children,
}: {
  title: string; subtitle: string; count: number;
  severity: 'low' | 'medium' | 'high'; children: React.ReactNode;
}) {
  const borderColor = {
    low: 'border-zinc-800',
    medium: 'border-yellow-800/30',
    high: 'border-red-800/30',
  }[severity];

  const dotColor = {
    low: 'bg-emerald-500',
    medium: 'bg-yellow-500',
    high: 'bg-red-500',
  }[severity];

  return (
    <div className={`border ${borderColor} rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        <h4 className="text-sm font-medium">{title}</h4>
        {count > 0 && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            severity === 'high' ? 'bg-red-600 text-white' :
            severity === 'medium' ? 'bg-yellow-600 text-white' :
            'bg-zinc-700 text-zinc-300'
          }`}>
            {count}
          </span>
        )}
      </div>
      <p className="text-[10px] text-zinc-600 mb-3">{subtitle}</p>
      {children}
    </div>
  );
}

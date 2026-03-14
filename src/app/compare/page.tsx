'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useToast } from '@/components/toast';
import type { Investor, InvestorType } from '@/lib/types';
import {
  ChevronDown, ChevronRight, X, Trophy, ArrowLeft, TrendingUp, TrendingDown,
  Minus, AlertTriangle, CheckCircle, Clock, Zap, Target, Shield, Users,
  BarChart3, ArrowUpRight, ArrowDownRight, Loader2,
} from 'lucide-react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Type labels
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<InvestorType, string> = {
  vc: 'VC', growth: 'Growth', sovereign: 'Sovereign', strategic: 'Strategic',
  debt: 'Debt', family_office: 'Family Office',
};

const STATUS_LABELS: Record<string, string> = {
  identified: 'Identified', contacted: 'Contacted', nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Set', met: 'Met', engaged: 'Engaged',
  in_dd: 'In DD', term_sheet: 'Term Sheet', closed: 'Closed',
  passed: 'Passed', dropped: 'Dropped',
};

const MEETING_TYPE_LABELS: Record<string, string> = {
  intro: 'Intro', management_presentation: 'Mgmt Pres', deep_dive: 'Deep Dive',
  site_visit: 'Site Visit', dd_session: 'DD Session', negotiation: 'Negotiation', social: 'Social',
};

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface ScoreDimension {
  name: string;
  score: number;
  signal: string;
  evidence: string;
}

interface InvestorScore {
  overall: number;
  dimensions: ScoreDimension[];
  momentum: string;
  predictedOutcome: string;
  nextBestAction: string;
  risks: string[];
  lastUpdated: string;
}

interface ConvictionTrajectory {
  dataPoints: { date: string; score: number; enthusiasm: number }[];
  trend: string;
  velocityPerWeek: number;
  predictedScoreIn30Days: number;
  predictedTermSheetDate: string | null;
  confidenceLevel: string;
}

interface ObjectionProfile {
  totalCount: number;
  byTopic: Record<string, number>;
  unresolvedCount: number;
  avgSeverityScore: number;
  resolutionRate: number;
}

interface MeetingHistorySummary {
  totalMeetings: number;
  lastMeetingDate: string | null;
  lastMeetingType: string | null;
  daysSinceLastMeeting: number | null;
  meetingTypes: Record<string, number>;
  enthusiasmTrend: number[];
}

interface FollowupStatusData {
  pendingCount: number;
  overdueCount: number;
  completedCount: number;
  avgConvictionDelta: number;
}

interface AccelerationStatusData {
  label: string;
  activeTriggers: string[];
  pendingActions: number;
}

interface InvestorCompareProfile {
  investor: Investor;
  score: InvestorScore;
  convictionTrajectory: ConvictionTrajectory;
  objectionProfile: ObjectionProfile;
  meetingHistory: MeetingHistorySummary;
  followupStatus: FollowupStatusData;
  accelerationStatus: AccelerationStatusData;
  recommendedAction: string;
}

interface DecisionMatrixEntry {
  dimension: string;
  winnerId: string;
  winnerName: string;
  scores: Record<string, number>;
}

interface ComparisonVerdict {
  mostLikelyToClose: { id: string; name: string; reason: string } | null;
  fastestDecision: { id: string; name: string; reason: string } | null;
  lowestRisk: { id: string; name: string; reason: string } | null;
  bestMomentum: { id: string; name: string; reason: string } | null;
  highestCheckPotential: { id: string; name: string; reason: string } | null;
}

interface ComparisonRecommendation {
  type: 'strong' | 'competitive' | 'none_ready';
  text: string;
  primaryInvestorId: string | null;
  primaryInvestorName: string | null;
}

interface CompareResponse {
  profiles: InvestorCompareProfile[];
  decisionMatrix: DecisionMatrixEntry[];
  verdict: ComparisonVerdict;
  recommendation: ComparisonRecommendation;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ComparePage() {
  const { toast } = useToast();
  const [allInvestors, setAllInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [comparing, setComparing] = useState(false);
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);
  const [dimensionsExpanded, setDimensionsExpanded] = useState(false);

  // Fetch all investors on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/investors');
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        setAllInvestors(data);
      } catch {
        toast('Failed to load investors', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const runComparison = useCallback(async () => {
    if (selectedIds.length < 2) {
      toast('Select at least 2 investors', 'warning');
      return;
    }
    setComparing(true);
    setCompareData(null);
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ investor_ids: selectedIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `${res.status}`);
      }
      const data: CompareResponse = await res.json();
      setCompareData(data);
    } catch (err) {
      toast(`Comparison failed: ${err}`, 'error');
    } finally {
      setComparing(false);
    }
  }, [selectedIds, toast]);

  function toggleInvestor(id: string) {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 4) {
        toast('Maximum 4 investors for comparison', 'warning');
        return prev;
      }
      return [...prev, id];
    });
    setCompareData(null);
  }

  function removeInvestor(id: string) {
    setSelectedIds(prev => prev.filter(x => x !== id));
    setCompareData(null);
  }

  const filteredInvestors = allInvestors.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  // Find the winner (highest overall score)
  const winnerId = useMemo(() => {
    if (!compareData || compareData.profiles.length < 2) return null;
    const sorted = [...compareData.profiles].sort((a, b) => b.score.overall - a.score.overall);
    return sorted[0].investor.id;
  }, [compareData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse" />
        <div className="h-12 w-full bg-zinc-800/50 rounded animate-pulse" />
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 bg-zinc-800/30 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/investors" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Investor Comparison Engine</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Select 2-4 investors, then hit Compare for a full decision breakdown
          </p>
        </div>
      </div>

      {/* Selection + Compare button */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Multi-select dropdown */}
        <div className="relative flex-1">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-300 hover:border-zinc-700 transition-colors"
          >
            <span className={selectedIds.length === 0 ? 'text-zinc-600' : ''}>
              {selectedIds.length === 0
                ? 'Select investors to compare...'
                : `${selectedIds.length} investor${selectedIds.length > 1 ? 's' : ''} selected`}
            </span>
            <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute z-20 mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-h-72 overflow-hidden">
                <div className="p-2 border-b border-zinc-800">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search investors..."
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-600"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto max-h-56">
                  {filteredInvestors.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-zinc-600">No investors found</div>
                  ) : (
                    filteredInvestors.map(inv => {
                      const isSelected = selectedIds.includes(inv.id);
                      const disabled = !isSelected && selectedIds.length >= 4;
                      return (
                        <button
                          key={inv.id}
                          onClick={() => { if (!disabled) toggleInvestor(inv.id); }}
                          disabled={disabled}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                            isSelected
                              ? 'bg-blue-600/10 text-blue-400'
                              : disabled
                              ? 'text-zinc-700 cursor-not-allowed'
                              : 'text-zinc-300 hover:bg-zinc-800'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-blue-600 border-blue-600' : 'border-zinc-700'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className="flex-1">{inv.name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            inv.tier === 1 ? 'bg-blue-600/20 text-blue-400' :
                            inv.tier === 2 ? 'bg-purple-600/20 text-purple-400' :
                            'bg-zinc-600/20 text-zinc-500'
                          }`}>T{inv.tier}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Compare button */}
        <button
          onClick={runComparison}
          disabled={selectedIds.length < 2 || comparing}
          className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all flex items-center gap-2 shrink-0 ${
            selectedIds.length >= 2 && !comparing
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          }`}
        >
          {comparing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Comparing...</>
          ) : (
            <><BarChart3 className="w-4 h-4" /> Compare</>
          )}
        </button>
      </div>

      {/* Selected pills */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map(id => {
            const inv = allInvestors.find(i => i.id === id);
            if (!inv) return null;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1 text-sm text-zinc-300"
              >
                {inv.name}
                <button
                  onClick={() => removeInvestor(id)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            );
          })}
          <button
            onClick={() => { setSelectedIds([]); setCompareData(null); }}
            className="text-xs text-zinc-600 hover:text-zinc-400 px-2 py-1 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Empty state */}
      {!compareData && !comparing && (
        <div className="border border-zinc-800 rounded-xl p-12 text-center">
          <BarChart3 className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <div className="text-zinc-500 text-sm">
            {selectedIds.length < 2
              ? 'Select at least 2 investors from the dropdown above, then click Compare.'
              : 'Click Compare to run the full analysis.'}
          </div>
        </div>
      )}

      {/* Loading state */}
      {comparing && (
        <div className="border border-zinc-800 rounded-xl p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-3" />
          <div className="text-zinc-400 text-sm">Analyzing investors across 8 dimensions...</div>
        </div>
      )}

      {/* ================================================================ */}
      {/* RESULTS */}
      {/* ================================================================ */}
      {compareData && compareData.profiles.length >= 2 && (
        <div className="space-y-6">

          {/* ── Recommendation Banner ── */}
          <RecommendationBanner recommendation={compareData.recommendation} />

          {/* ── Comparison Table ── */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-zinc-900/80 border-b border-zinc-800 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium min-w-[160px] bg-zinc-900/80 sticky left-0 z-20 border-r border-zinc-800/50">
                      Metric
                    </th>
                    {compareData.profiles.map(p => (
                      <th key={p.investor.id} className="text-left px-4 py-3 min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/investors/${p.investor.id}`}
                            className="text-sm font-medium text-zinc-200 hover:text-blue-400 transition-colors"
                          >
                            {p.investor.name}
                          </Link>
                          {p.investor.id === winnerId && (
                            <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-800/30">
                  {/* ── Basic Info ── */}
                  <SectionHeader label="BASIC INFO" colSpan={compareData.profiles.length + 1} />

                  <CompareRow label="Type" cells={compareData.profiles.map(p => ({
                    value: TYPE_LABELS[p.investor.type as InvestorType] ?? p.investor.type,
                  }))} />

                  <CompareRow label="Tier" cells={compareData.profiles.map(p => ({
                    value: `Tier ${p.investor.tier}`,
                    className: tierColor(p.investor.tier),
                  }))} />

                  <CompareRow label="Status" cells={compareData.profiles.map(p => ({
                    value: STATUS_LABELS[p.investor.status] ?? p.investor.status,
                    className: statusColor(p.investor.status),
                  }))} />

                  {/* ── Overall Score ── */}
                  <SectionHeader label="SCORING" colSpan={compareData.profiles.length + 1} />

                  <tr className="hover:bg-zinc-900/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-zinc-500 font-medium sticky left-0 bg-zinc-950 border-r border-zinc-800/50">
                      Overall Score
                    </td>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} className="px-4 py-3">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                          p.investor.id === winnerId
                            ? 'bg-amber-500/10 border border-amber-500/30'
                            : 'bg-zinc-800/50'
                        }`}>
                          <span className={`text-lg font-bold ${scoreColor(p.score.overall)}`}>
                            {p.score.overall}
                          </span>
                          <span className="text-[10px] text-zinc-600">/100</span>
                          {p.investor.id === winnerId && (
                            <Trophy className="w-3.5 h-3.5 text-amber-400" />
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* ── Conviction Trajectory ── */}
                  <tr className="hover:bg-zinc-900/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-zinc-500 font-medium sticky left-0 bg-zinc-950 border-r border-zinc-800/50">
                      Conviction Trajectory
                    </td>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <MomentumIcon momentum={p.convictionTrajectory.trend} />
                            <span className={`text-xs font-medium ${momentumColor(p.convictionTrajectory.trend)}`}>
                              {formatMomentum(p.convictionTrajectory.trend)}
                            </span>
                            {p.convictionTrajectory.velocityPerWeek !== 0 && (
                              <span className="text-[10px] text-zinc-600">
                                {p.convictionTrajectory.velocityPerWeek > 0 ? '+' : ''}{p.convictionTrajectory.velocityPerWeek} pts/wk
                              </span>
                            )}
                          </div>
                          {p.convictionTrajectory.predictedTermSheetDate && p.convictionTrajectory.predictedTermSheetDate !== 'now' && (
                            <span className="text-[10px] text-zinc-600">
                              Predicted TS: {p.convictionTrajectory.predictedTermSheetDate}
                            </span>
                          )}
                          {p.convictionTrajectory.predictedTermSheetDate === 'now' && (
                            <span className="text-[10px] text-green-500">Ready for term sheet</span>
                          )}
                          <span className="text-[10px] text-zinc-600">
                            30d prediction: {p.convictionTrajectory.predictedScoreIn30Days}
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* ── Enthusiasm Trend ── */}
                  <tr className="hover:bg-zinc-900/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-zinc-500 font-medium sticky left-0 bg-zinc-950 border-r border-zinc-800/50">
                      Enthusiasm Trend
                    </td>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} className="px-4 py-3">
                        <EnthusiasmTrendDots trend={p.meetingHistory.enthusiasmTrend} />
                      </td>
                    ))}
                  </tr>

                  {/* ── Objections ── */}
                  <tr className="hover:bg-zinc-900/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-zinc-500 font-medium sticky left-0 bg-zinc-950 border-r border-zinc-800/50">
                      Objections
                    </td>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} className="px-4 py-3">
                        {p.objectionProfile.totalCount === 0 ? (
                          <span className="text-xs text-zinc-600">No objections logged</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-zinc-400">{p.objectionProfile.totalCount} total</span>
                              <span className={p.objectionProfile.unresolvedCount > 0 ? 'text-red-400 font-medium' : 'text-green-400'}>
                                {p.objectionProfile.unresolvedCount} unresolved
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="text-zinc-600">
                                Severity: {p.objectionProfile.avgSeverityScore.toFixed(1)}/3
                              </span>
                              <span className="text-zinc-600">
                                Resolved: {p.objectionProfile.resolutionRate}%
                              </span>
                            </div>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* ── Meeting Engagement ── */}
                  <tr className="hover:bg-zinc-900/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-zinc-500 font-medium sticky left-0 bg-zinc-950 border-r border-zinc-800/50">
                      Meeting Engagement
                    </td>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-zinc-300 font-medium">{p.meetingHistory.totalMeetings} meetings</span>
                            {p.meetingHistory.daysSinceLastMeeting !== null && (
                              <span className={`${p.meetingHistory.daysSinceLastMeeting > 30 ? 'text-red-400' : p.meetingHistory.daysSinceLastMeeting > 14 ? 'text-yellow-400' : 'text-green-400'}`}>
                                {p.meetingHistory.daysSinceLastMeeting}d ago
                              </span>
                            )}
                          </div>
                          {Object.keys(p.meetingHistory.meetingTypes).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(p.meetingHistory.meetingTypes).map(([type, count]) => (
                                <span key={type} className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
                                  {MEETING_TYPE_LABELS[type] || type} {count > 1 ? `x${count}` : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* ── Follow-up Health ── */}
                  <tr className="hover:bg-zinc-900/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-zinc-500 font-medium sticky left-0 bg-zinc-950 border-r border-zinc-800/50">
                      Follow-up Health
                    </td>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} className="px-4 py-3">
                        <div className="flex items-center gap-3 text-xs">
                          {p.followupStatus.pendingCount > 0 && (
                            <span className="text-yellow-400">
                              {p.followupStatus.pendingCount} pending
                            </span>
                          )}
                          {p.followupStatus.overdueCount > 0 && (
                            <span className="text-red-400 font-medium">
                              {p.followupStatus.overdueCount} overdue
                            </span>
                          )}
                          {p.followupStatus.completedCount > 0 && (
                            <span className="text-green-400">
                              {p.followupStatus.completedCount} done
                            </span>
                          )}
                          {p.followupStatus.pendingCount === 0 && p.followupStatus.overdueCount === 0 && p.followupStatus.completedCount === 0 && (
                            <span className="text-zinc-600">No follow-ups</span>
                          )}
                        </div>
                        {p.followupStatus.avgConvictionDelta !== 0 && (
                          <div className="text-[10px] text-zinc-600 mt-0.5">
                            Avg impact: {p.followupStatus.avgConvictionDelta > 0 ? '+' : ''}{p.followupStatus.avgConvictionDelta} pts
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* ── Acceleration Status ── */}
                  <tr className="hover:bg-zinc-900/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-zinc-500 font-medium sticky left-0 bg-zinc-950 border-r border-zinc-800/50">
                      Acceleration Status
                    </td>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} className="px-4 py-3">
                        <AccelerationBadge status={p.accelerationStatus} />
                      </td>
                    ))}
                  </tr>

                  {/* ── Recommended Action ── */}
                  <tr className="bg-zinc-900/50 border-t-2 border-zinc-700">
                    <td className="px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider sticky left-0 bg-zinc-900/50 border-r border-zinc-800/50">
                      Next Action
                    </td>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} className="px-4 py-4">
                        <span className="text-xs text-zinc-300 leading-relaxed line-clamp-3">
                          {p.recommendedAction}
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Score Dimension Breakdown (collapsible) ── */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setDimensionsExpanded(!dimensionsExpanded)}
              className="w-full flex items-center justify-between px-5 py-3.5 bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-zinc-500" />
                <span className="text-sm font-medium text-zinc-300">Score Dimension Breakdown</span>
                <span className="text-[10px] text-zinc-600">8 dimensions</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${dimensionsExpanded ? 'rotate-180' : ''}`} />
            </button>

            {dimensionsExpanded && (
              <div className="p-4 border-t border-zinc-800 space-y-3">
                {compareData.decisionMatrix.map(entry => (
                  <DimensionBar
                    key={entry.dimension}
                    dimension={entry.dimension}
                    profiles={compareData.profiles}
                    winnerId={entry.winnerId}
                    scores={entry.scores}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Decision Matrix ── */}
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-zinc-900/50 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-zinc-500" />
                <span className="text-sm font-medium text-zinc-300">Decision Matrix</span>
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <VerdictCard
                icon={<CheckCircle className="w-4 h-4" />}
                title="Most Likely to Close"
                verdict={compareData.verdict.mostLikelyToClose}
                color="green"
              />
              <VerdictCard
                icon={<Zap className="w-4 h-4" />}
                title="Fastest Decision"
                verdict={compareData.verdict.fastestDecision}
                color="blue"
              />
              <VerdictCard
                icon={<Shield className="w-4 h-4" />}
                title="Lowest Risk"
                verdict={compareData.verdict.lowestRisk}
                color="purple"
              />
              <VerdictCard
                icon={<TrendingUp className="w-4 h-4" />}
                title="Best Momentum"
                verdict={compareData.verdict.bestMomentum}
                color="amber"
              />
              <VerdictCard
                icon={<ArrowUpRight className="w-4 h-4" />}
                title="Highest Check Potential"
                verdict={compareData.verdict.highestCheckPotential}
                color="cyan"
              />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function SectionHeader({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr className="bg-zinc-900/30">
      <td
        colSpan={colSpan}
        className="px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider"
      >
        {label}
      </td>
    </tr>
  );
}

interface CellData {
  value: string;
  className?: string;
  wrap?: boolean;
  render?: React.ReactNode;
}

function CompareRow({ label, cells }: { label: string; cells: CellData[] }) {
  return (
    <tr className="hover:bg-zinc-900/20 transition-colors">
      <td className="px-4 py-3 text-xs text-zinc-500 font-medium sticky left-0 bg-zinc-950 border-r border-zinc-800/50">
        {label}
      </td>
      {cells.map((cell, i) => (
        <td
          key={i}
          className={`px-4 py-3 text-sm ${cell.wrap ? 'max-w-[220px]' : ''} ${cell.className || 'text-zinc-300'}`}
        >
          {cell.render ?? (
            <span className={cell.wrap ? 'line-clamp-3' : ''}>{cell.value}</span>
          )}
        </td>
      ))}
    </tr>
  );
}

function RecommendationBanner({ recommendation }: { recommendation: ComparisonRecommendation }) {
  const bgColor = recommendation.type === 'strong'
    ? 'bg-green-900/20 border-green-800/40'
    : recommendation.type === 'competitive'
    ? 'bg-blue-900/20 border-blue-800/40'
    : 'bg-yellow-900/20 border-yellow-800/40';

  const Icon = recommendation.type === 'strong'
    ? CheckCircle
    : recommendation.type === 'competitive'
    ? Target
    : AlertTriangle;

  const iconColor = recommendation.type === 'strong'
    ? 'text-green-400'
    : recommendation.type === 'competitive'
    ? 'text-blue-400'
    : 'text-yellow-400';

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${bgColor}`}>
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
      <div>
        <div className="text-sm font-medium text-zinc-200">{recommendation.text}</div>
      </div>
    </div>
  );
}

function MomentumIcon({ momentum }: { momentum: string }) {
  if (momentum === 'accelerating') return <TrendingUp className="w-3.5 h-3.5 text-green-400" />;
  if (momentum === 'decelerating') return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  if (momentum === 'stalled') return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
  if (momentum === 'steady') return <Minus className="w-3.5 h-3.5 text-yellow-400" />;
  return <Minus className="w-3.5 h-3.5 text-zinc-600" />;
}

function EnthusiasmTrendDots({ trend }: { trend: number[] }) {
  if (trend.length === 0) {
    return <span className="text-xs text-zinc-600">No data</span>;
  }

  const maxDots = 3;
  const dots = trend.slice(-maxDots);

  return (
    <div className="flex items-center gap-1.5">
      {dots.map((score, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <div
            className={`w-3 h-3 rounded-full ${
              score >= 4 ? 'bg-green-500' : score === 3 ? 'bg-yellow-500' : score >= 1 ? 'bg-red-500' : 'bg-zinc-700'
            }`}
          />
          <span className="text-[9px] text-zinc-600">{score}</span>
        </div>
      ))}
      {dots.length >= 2 && (
        <div className="ml-1">
          {dots[dots.length - 1] > dots[0] ? (
            <ArrowUpRight className="w-3 h-3 text-green-400" />
          ) : dots[dots.length - 1] < dots[0] ? (
            <ArrowDownRight className="w-3 h-3 text-red-400" />
          ) : (
            <Minus className="w-3 h-3 text-zinc-600" />
          )}
        </div>
      )}
    </div>
  );
}

function AccelerationBadge({ status }: { status: AccelerationStatusData }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    'Term Sheet Ready': {
      bg: 'bg-green-600/20 border-green-600/30',
      text: 'text-green-400',
      icon: <CheckCircle className="w-3 h-3" />,
    },
    'Active': {
      bg: 'bg-blue-600/20 border-blue-600/30',
      text: 'text-blue-400',
      icon: <Zap className="w-3 h-3" />,
    },
    'At Risk': {
      bg: 'bg-yellow-600/20 border-yellow-600/30',
      text: 'text-yellow-400',
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    'Stalled': {
      bg: 'bg-red-600/20 border-red-600/30',
      text: 'text-red-400',
      icon: <Clock className="w-3 h-3" />,
    },
  };

  const c = config[status.label] || config['Active'];

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium w-fit ${c.bg} ${c.text}`}>
        {c.icon}
        {status.label}
      </span>
      {status.activeTriggers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {status.activeTriggers.map(t => (
            <span key={t} className="text-[9px] text-zinc-600 bg-zinc-800 px-1 py-0.5 rounded">
              {t.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DimensionBar({
  dimension,
  profiles,
  winnerId,
  scores,
}: {
  dimension: string;
  profiles: InvestorCompareProfile[];
  winnerId: string;
  scores: Record<string, number>;
}) {
  const barColors = ['bg-blue-500', 'bg-purple-500', 'bg-cyan-500', 'bg-amber-500'];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400 font-medium">{dimension}</span>
        <span className="text-[10px] text-zinc-600">
          Winner: <span className="text-zinc-400">{profiles.find(p => p.investor.id === winnerId)?.investor.name ?? '---'}</span>
        </span>
      </div>
      <div className="space-y-1">
        {profiles.map((p, idx) => {
          const score = scores[p.investor.id] ?? 0;
          const isWinner = p.investor.id === winnerId;
          return (
            <div key={p.investor.id} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-600 w-20 truncate">{p.investor.name}</span>
              <div className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isWinner ? barColors[idx % barColors.length] : 'bg-zinc-700'
                  }`}
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className={`text-[10px] w-7 text-right font-mono ${
                isWinner ? 'text-zinc-200 font-medium' : 'text-zinc-600'
              }`}>
                {score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VerdictCard({
  icon,
  title,
  verdict,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  verdict: { id: string; name: string; reason: string } | null;
  color: string;
}) {
  if (!verdict) return null;

  const colorMap: Record<string, string> = {
    green: 'border-green-800/30 bg-green-900/10',
    blue: 'border-blue-800/30 bg-blue-900/10',
    purple: 'border-purple-800/30 bg-purple-900/10',
    amber: 'border-amber-800/30 bg-amber-900/10',
    cyan: 'border-cyan-800/30 bg-cyan-900/10',
  };

  const iconColorMap: Record<string, string> = {
    green: 'text-green-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
    cyan: 'text-cyan-400',
  };

  return (
    <div className={`rounded-lg border p-3 ${colorMap[color] ?? colorMap.blue}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={iconColorMap[color] ?? 'text-zinc-400'}>{icon}</span>
        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">{title}</span>
      </div>
      <div className="text-sm font-medium text-zinc-200 mb-1">{verdict.name}</div>
      <div className="text-[10px] text-zinc-500 leading-relaxed">{verdict.reason}</div>
    </div>
  );
}

// ============================================================================
// Color helpers
// ============================================================================

function tierColor(tier: number): string {
  switch (tier) {
    case 1: return 'text-blue-400 font-semibold';
    case 2: return 'text-purple-400 font-semibold';
    default: return 'text-zinc-500';
  }
}

function statusColor(status: string): string {
  if (status === 'term_sheet' || status === 'closed') return 'text-green-400 font-semibold';
  if (status === 'in_dd') return 'text-blue-400 font-medium';
  if (status === 'engaged') return 'text-cyan-400';
  if (status === 'passed' || status === 'dropped') return 'text-red-400';
  return 'text-zinc-300';
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-green-400';
  if (score >= 55) return 'text-blue-400';
  if (score >= 35) return 'text-yellow-400';
  return 'text-red-400';
}

function momentumColor(momentum: string): string {
  if (momentum === 'accelerating') return 'text-green-400';
  if (momentum === 'steady') return 'text-yellow-400';
  if (momentum === 'decelerating') return 'text-red-400';
  if (momentum === 'stalled') return 'text-red-500';
  return 'text-zinc-500';
}

function formatMomentum(momentum: string): string {
  if (momentum === 'accelerating') return 'Accelerating';
  if (momentum === 'steady') return 'Steady';
  if (momentum === 'decelerating') return 'Decelerating';
  if (momentum === 'stalled') return 'Stalled';
  if (momentum === 'insufficient_data') return 'Insufficient data';
  return momentum;
}

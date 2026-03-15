'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useToast } from '@/components/toast';
import type { Investor, InvestorType, InvestorScoreData } from '@/lib/types';
import {
  ChevronDown, X, Trophy, ArrowLeft, TrendingUp, TrendingDown,
  Minus, AlertTriangle, CheckCircle, Clock, Zap, Target, Shield,
  BarChart3, ArrowUpRight, ArrowDownRight, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { STATUS_LABELS, TYPE_LABELS, MEETING_TYPE_LABELS } from '@/lib/constants';
import { labelMuted, labelMuted10, stAccent, stFontSm, stFontXs, stSurface1, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary } from '@/lib/styles';

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

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

interface FollowupStatusData { pendingCount: number; overdueCount: number; completedCount: number; avgConvictionDelta: number; }

interface AccelerationStatusData { label: string; activeTriggers: string[]; pendingActions: number; }

interface InvestorCompareProfile {
  investor: Investor;
  score: InvestorScoreData;
  convictionTrajectory: ConvictionTrajectory;
  objectionProfile: ObjectionProfile;
  meetingHistory: MeetingHistorySummary;
  followupStatus: FollowupStatusData;
  accelerationStatus: AccelerationStatusData;
  recommendedAction: string;
}

interface DecisionMatrixEntry { dimension: string; winnerId: string; winnerName: string; scores: Record<string, number>; }

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
      }}
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
        body: JSON.stringify({ investor_ids: selectedIds }),});
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
      return [...prev, id];});
    setCompareData(null);
  }

  function removeInvestor(id: string) {
    setSelectedIds(prev => prev.filter(x => x !== id));
    setCompareData(null);
  }

  const filteredInvestors = allInvestors.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()));

  // Find the winner (highest overall score)
  const winnerId = useMemo(() => {
    if (!compareData || compareData.profiles.length < 2) return null;
    const sorted = [...compareData.profiles].sort((a, b) => b.score.overall - a.score.overall);
    return sorted[0].investor.id;
  }, [compareData]);

  if (loading) {
    return (
      <div className="page-content space-y-6">
        <div className="p-12 text-center" style={{ borderRadius: 'var(--radius-xl)' }}>
          <BarChart3 className="w-10 h-10 mx-auto mb-3" style={stTextMuted} />
          <div style={{ ...stTextMuted, fontSize: 'var(--font-size-sm)' }}>Loading investors... Select at least 2 to compare.</div>
        </div>
      </div>);
  }

  return (
    <div className="page-content space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/investors"
          className="transition-colors"
          style={{ ...stTextMuted, transition: 'color 150ms ease' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
          <ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="page-title" style={{ fontSize: 'var(--font-size-xl)' }}>
            Investor Comparison Engine</h1>
          <p style={{ ...stTextMuted, fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>Select 2-4 investors, then hit Compare for a full decision breakdown</p>
        </div></div>

      {/* Selection + Compare button */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Multi-select dropdown */}
        <div className="relative flex-1">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center justify-between transition-colors"
            style={{
              background: 'var(--surface-0)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-2) var(--space-4)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-secondary)', }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-default)')}>
            <span style={selectedIds.length === 0 ? stTextMuted : undefined}>
              {selectedIds.length === 0 ? 'Select investors to compare...' : `${selectedIds.length} investor${selectedIds.length > 1 ? 's' : ''} selected`}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} style={stTextMuted} />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div
                className="absolute z-20 mt-1 w-full max-h-72 overflow-hidden"
                style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)' }}>
                <div style={{ padding: 'var(--space-2)', borderBottom: '1px solid var(--border-default)' }}>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search investors..."
                    className="input"
                    autoFocus /></div>
                <div className="overflow-y-auto max-h-56">
                  {filteredInvestors.length === 0 ? (
                    <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                      No investors found</div>
                  ) : (
                    filteredInvestors.map(inv => {
                      const isSelected = selectedIds.includes(inv.id);
                      const disabled = !isSelected && selectedIds.length >= 4;
                      return (
                        <DropdownItem key={inv.id} investor={inv} isSelected={isSelected} disabled={disabled} onToggle={() => { if (!disabled) toggleInvestor(inv.id); }}
                          />);})
                  )}</div></div>
            </>
          )}</div>

        {/* Compare button */}
        <button
          onClick={runComparison}
          disabled={selectedIds.length < 2 || comparing}
          className={`flex items-center gap-2 shrink-0 btn ${
            selectedIds.length >= 2 && !comparing ? 'btn-primary' : ''
          }`}
          style={{
            padding: 'var(--space-2) var(--space-6)',
            borderRadius: 'var(--radius-lg)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 400,
            ...(selectedIds.length >= 2 && !comparing
              ? {}
              : {
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  cursor: 'not-allowed',
                  border: '1px solid transparent',
                }), }}>
          {comparing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Comparing...</>
          ) : (
            <><BarChart3 className="w-4 h-4" /> Compare</>
          )}</button></div>

      {/* Selected pills */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map(id => {
            const inv = allInvestors.find(i => i.id === id);
            if (!inv) return null;
            return (
              <SelectedPill key={id} name={inv.name} onRemove={() => removeInvestor(id)} />);
          })}
          <ClearAllButton onClick={() => { setSelectedIds([]); setCompareData(null); }} /></div>
      )}

      {/* Empty state */}
      {!compareData && !comparing && (
        <div
          className="p-12 text-center"
          style={{ borderRadius: 'var(--radius-xl)' }}>
          <BarChart3 className="w-10 h-10 mx-auto mb-3" style={stTextMuted} />
          <div style={{ ...stTextMuted, fontSize: 'var(--font-size-sm)' }}>
            {selectedIds.length < 2 ? 'Select at least 2 investors from the dropdown above, then click Compare.' : 'Click Compare to run the full analysis.'}
          </div></div>
      )}

      {/* Loading state */}
      {comparing && (
        <div
          className="p-8 text-center"
          style={{ borderRadius: 'var(--radius-xl)' }}>
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" style={stAccent} />
          <div style={{ ...stTextSecondary, fontSize: 'var(--font-size-sm)' }}>Analyzing investors across 8 dimensions...</div>
        </div>
      )}

      {/* ================================================================ */}
      {/* RESULTS */}
      {/* ================================================================ */}
      {compareData && compareData.profiles.length >= 2 && (
        <div className="space-y-6">

          {/* -- Recommendation Banner -- */}
          <RecommendationBanner recommendation={compareData.recommendation} />

          {/* -- Comparison Table -- */}
          <div
            className="overflow-hidden"
            style={{ borderRadius: 'var(--radius-xl)' }}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]" style={stFontSm}>
                <thead
                  className="table-header sticky top-0 z-10"
                  style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-default)' }}>
                  <tr>
                    <th
                      className="text-left sticky left-0 z-20"
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-muted)',
                        fontWeight: 400,
                        minWidth: 160,
                        background: 'var(--surface-1)',
                        borderRight: '1px solid var(--border-subtle)', }}>
                      Metric</th>
                    {compareData.profiles.map(p => (
                      <th key={p.investor.id} className="text-left" style={{ padding: 'var(--space-3) var(--space-4)', minWidth: 200 }}>
                        <div className="flex items-center gap-2">
                          <InvestorNameLink investor={p.investor} />
                          {p.investor.id === winnerId && (
                            <Trophy className="w-4 h-4 shrink-0" style={stTextTertiary} />
                          )}</div></th>
                    ))}</tr></thead>

                <tbody>
                  {/* -- Basic Info -- */}
                  <SectionHeader label="Basic info" colSpan={compareData.profiles.length + 1} />

                  <CompareRow label="Type" cells={compareData.profiles.map(p => ({
                    value: TYPE_LABELS[p.investor.type as InvestorType] ?? p.investor.type,
                  }))} />

                  <CompareRow label="Tier" cells={compareData.profiles.map(p => ({
                    value: `Tier ${p.investor.tier}`,
                    style: tierStyle(p.investor.tier),
                  }))} />

                  <CompareRow label="Status" cells={compareData.profiles.map(p => ({
                    value: STATUS_LABELS[p.investor.status] ?? p.investor.status,
                    style: statusStyle(p.investor.status),
                  }))} />

                  {/* -- Overall Score -- */}
                  <SectionHeader label="SCORING" colSpan={compareData.profiles.length + 1} />

                  <TableRow>
                    <StickyLabel>Overall Score</StickyLabel>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div
                          className="inline-flex items-center gap-2"
                          style={{
                            padding: 'var(--space-1) var(--space-3)',
                            borderRadius: 'var(--radius-lg)',
                            ...(p.investor.id === winnerId
                              ? { background: 'var(--warning-muted)', border: '1px solid var(--warn-30)' }
                              : { background: 'var(--surface-2)' }), }}>
                          <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 300, ...scoreStyle(p.score.overall) }}>
                            {p.score.overall}</span>
                          <span style={labelMuted10}>/100</span>
                          {p.investor.id === winnerId && (
                            <Trophy className="w-3.5 h-3.5" style={stTextTertiary} />
                          )}</div></td>
                    ))}</TableRow>

                  {/* -- Conviction Trajectory -- */}
                  <TableRow>
                    <StickyLabel>Conviction Trajectory</StickyLabel>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <MomentumIcon momentum={p.convictionTrajectory.trend} />
                            <span style={{
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 400,
                              ...momentumStyle(p.convictionTrajectory.trend),}}>
                              {formatMomentum(p.convictionTrajectory.trend)}</span>
                            {p.convictionTrajectory.velocityPerWeek !== 0 && (
                              <span style={labelMuted10}>
                                {p.convictionTrajectory.velocityPerWeek > 0 ? '+' : ''}{p.convictionTrajectory.velocityPerWeek} pts/wk
                              </span>
                            )}</div>
                          {p.convictionTrajectory.predictedTermSheetDate && p.convictionTrajectory.predictedTermSheetDate !== 'now' && (
                            <span style={labelMuted10}>
                              Predicted TS: {p.convictionTrajectory.predictedTermSheetDate}</span>
                          )}
                          {p.convictionTrajectory.predictedTermSheetDate === 'now' && (
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Ready for term sheet</span>
                          )}
                          <span style={labelMuted10}>
                            30d prediction: {p.convictionTrajectory.predictedScoreIn30Days}</span></div></td>
                    ))}</TableRow>

                  {/* -- Enthusiasm Trend -- */}
                  <TableRow>
                    <StickyLabel>Enthusiasm Trend</StickyLabel>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <EnthusiasmTrendDots trend={p.meetingHistory.enthusiasmTrend} /></td>
                    ))}</TableRow>

                  {/* -- Objections -- */}
                  <TableRow>
                    <StickyLabel>Objections</StickyLabel>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        {p.objectionProfile.totalCount === 0 ? (
                          <span style={labelMuted}>No objections logged</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3" style={stFontXs}>
                              <span style={stTextSecondary}>{p.objectionProfile.totalCount} total</span>
                              <span style={{
                                fontWeight: 400,
                                color: p.objectionProfile.unresolvedCount > 0 ? 'var(--danger)' : 'var(--success)',}}>
                                {p.objectionProfile.unresolvedCount} unresolved</span></div>
                            <div className="flex items-center gap-2" style={{ fontSize: '10px' }}>
                              <span style={stTextMuted}>
                                Severity: {p.objectionProfile.avgSeverityScore.toFixed(1)}/3</span>
                              <span style={stTextMuted}>
                                Resolved: {p.objectionProfile.resolutionRate}%</span></div></div>
                        )}</td>
                    ))}</TableRow>

                  {/* -- Meeting Engagement -- */}
                  <TableRow>
                    <StickyLabel>Meeting Engagement</StickyLabel>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3" style={stFontXs}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 400 }}>{p.meetingHistory.totalMeetings} meetings</span>
                            {p.meetingHistory.daysSinceLastMeeting !== null && (
                              <span style={{
                                color: p.meetingHistory.daysSinceLastMeeting > 30
                                  ? 'var(--danger)'
                                  : p.meetingHistory.daysSinceLastMeeting > 14
                                  ? 'var(--warning)'
                                  : 'var(--success)',}}>
                                {p.meetingHistory.daysSinceLastMeeting}d ago</span>
                            )}</div>
                          {Object.keys(p.meetingHistory.meetingTypes).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(p.meetingHistory.meetingTypes).map(([type, count]) => (
                                <span
                                  key={type}
                                  style={{
                                    fontSize: '10px',
                                    background: 'var(--surface-2)',
                                    color: 'var(--text-muted)',
                                    padding: '1px 6px',
                                    borderRadius: 'var(--radius-sm)', }}>
                                  {MEETING_TYPE_LABELS[type] || type} {count > 1 ? `x${count}` : ''}</span>
                              ))}</div>
                          )}</div></td>
                    ))}</TableRow>

                  {/* -- Follow-up Health -- */}
                  <TableRow>
                    <StickyLabel>Follow-up Health</StickyLabel>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div className="flex items-center gap-3" style={stFontXs}>
                          {p.followupStatus.pendingCount > 0 && (
                            <span style={stTextTertiary}>{p.followupStatus.pendingCount} pending</span>
                          )}
                          {p.followupStatus.overdueCount > 0 && (
                            <span style={{ color: 'var(--text-primary)', fontWeight: 400 }}>
                              {p.followupStatus.overdueCount} overdue</span>
                          )}
                          {p.followupStatus.completedCount > 0 && (
                            <span style={stTextSecondary}>{p.followupStatus.completedCount} done</span>
                          )}
                          {p.followupStatus.pendingCount === 0 && p.followupStatus.overdueCount === 0 && p.followupStatus.completedCount === 0 && (
                            <span style={stTextMuted}>No follow-ups</span>
                          )}</div>
                        {p.followupStatus.avgConvictionDelta !== 0 && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
                            Avg impact: {p.followupStatus.avgConvictionDelta > 0 ? '+' : ''}{p.followupStatus.avgConvictionDelta} pts
                          </div>
                        )}</td>
                    ))}</TableRow>

                  {/* -- Acceleration Status -- */}
                  <TableRow>
                    <StickyLabel>Acceleration Status</StickyLabel>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <AccelerationBadge status={p.accelerationStatus} /></td>
                    ))}</TableRow>

                  {/* -- Recommended Action -- */}
                  <tr style={{ background: 'var(--surface-1)', borderTop: '2px solid var(--border-strong)' }}>
                    <td
                      className="sticky left-0"
                      style={{
                        padding: 'var(--space-4)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 400,
                        color: 'var(--text-secondary)',
                        letterSpacing: '0.01em',
                        background: 'var(--surface-1)',
                        borderRight: '1px solid var(--border-subtle)', }}>
                      Next Action</td>
                    {compareData.profiles.map(p => (
                      <td key={p.investor.id} style={{ padding: 'var(--space-4)' }}>
                        <span className="line-clamp-3" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {p.recommendedAction}</span></td>
                    ))}</tr></tbody></table></div></div>

          {/* -- Score Dimension Breakdown (collapsible) -- */}
          <div
            className="overflow-hidden"
            style={{ borderRadius: 'var(--radius-xl)' }}>
            <button
              onClick={() => setDimensionsExpanded(!dimensionsExpanded)}
              className="w-full flex items-center justify-between transition-colors"
              style={{
                padding: 'var(--space-3) var(--space-5)',
                background: 'var(--surface-1)',
                transition: 'background 150ms ease', }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-1)')}>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" style={stTextMuted} />
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  Score Dimension Breakdown</span>
                <span style={labelMuted10}>8 dimensions</span></div>
              <ChevronDown className={`w-4 h-4 transition-transform ${dimensionsExpanded ? 'rotate-180' : ''}`} style={stTextMuted}
                /></button>

            {dimensionsExpanded && (
              <div className="space-y-3" style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-default)' }}>
                {compareData.decisionMatrix.map(entry => (
                  <DimensionBar key={entry.dimension} dimension={entry.dimension} profiles={compareData.profiles} winnerId={entry.winnerId} scores={entry.scores}
                    />
                ))}</div>
            )}</div>

          {/* -- Decision Matrix -- */}
          <div
            className="overflow-hidden"
            style={{ borderRadius: 'var(--radius-xl)' }}>
            <div
              className="flex items-center gap-2"
              style={{
                padding: 'var(--space-3) var(--space-5)',
                background: 'var(--surface-1)',
                borderBottom: '1px solid var(--border-default)', }}>
              <Target className="w-4 h-4" style={stTextMuted} />
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                Decision Matrix</span></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" style={{ padding: 'var(--space-4)' }}>
              <VerdictCard icon={<CheckCircle className="w-4 h-4" />} title="Most Likely to Close" verdict={compareData.verdict.mostLikelyToClose} color="success"
                />
              <VerdictCard icon={<Zap className="w-4 h-4" />} title="Fastest Decision" verdict={compareData.verdict.fastestDecision} color="accent"
                />
              <VerdictCard icon={<Shield className="w-4 h-4" />} title="Lowest Risk" verdict={compareData.verdict.lowestRisk} color="purple"
                />
              <VerdictCard icon={<TrendingUp className="w-4 h-4" />} title="Best Momentum" verdict={compareData.verdict.bestMomentum} color="warning"
                />
              <VerdictCard icon={<ArrowUpRight className="w-4 h-4" />} title="Highest Check Potential" verdict={compareData.verdict.highestCheckPotential} color="cyan"
                /></div></div>
</div>
      )}
    </div>);
}

// ============================================================================
// Sub-components
// ============================================================================

function DropdownItem({
  investor,
  isSelected,
  disabled,
  onToggle,
}: {
  investor: Investor;
  isSelected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className="w-full flex items-center gap-3 text-left transition-colors"
      style={{
        padding: 'var(--space-2) var(--space-4)',
        fontSize: 'var(--font-size-sm)',
        transition: 'background 100ms ease',
        color: isSelected
          ? 'var(--accent)'
          : disabled
          ? 'var(--text-muted)'
          : 'var(--text-secondary)',
        background: isSelected
          ? 'var(--accent-muted)'
          : hovered && !disabled
          ? 'var(--surface-2)'
          : 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer', }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div
        className="w-4 h-4 flex items-center justify-center shrink-0"
        style={{
          borderRadius: 'var(--radius-sm)',
          border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-strong)',
          background: isSelected ? 'var(--accent)' : 'transparent', }}>
        {isSelected && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        )}</div>
      <span className="flex-1">{investor.name}</span>
      <span
        className="badge"
        style={{
          fontSize: '10px',
          ...(investor.tier === 1
            ? { background: 'var(--accent-muted)', color: 'var(--accent)' }
            : investor.tier === 2
            ? { background: 'var(--cat-12)', color: 'var(--chart-4)' }
            : { background: 'var(--surface-2)', color: 'var(--text-muted)' }), }}>
        T{investor.tier}</span>
    </button>);
}

function SelectedPill({ name, onRemove }: { name: string; onRemove: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border-strong)',
        borderRadius: 9999,
        padding: 'var(--space-1) var(--space-3)',
        fontSize: 'var(--font-size-sm)',
        color: 'var(--text-secondary)', }}>
      {name}
      <button
        onClick={onRemove}
        className="transition-colors"
        style={{
          color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
          transition: 'color 150ms ease', }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}>
        <X className="w-3.5 h-3.5" /></button>
    </span>);
}

function ClearAllButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      className="transition-colors"
      style={{
        fontSize: 'var(--font-size-xs)',
        color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
        padding: 'var(--space-1) var(--space-2)',
        transition: 'color 150ms ease', }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      Clear all
    </button>);
}

function InvestorNameLink({ investor }: { investor: Investor }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/investors/${investor.id}`}
      className="transition-colors"
      style={{
        fontSize: 'var(--font-size-sm)',
        fontWeight: 400,
        color: hovered ? 'var(--accent)' : 'var(--text-primary)',
        transition: 'color 150ms ease', }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      {investor.name}
    </Link>);
}

function SectionHeader({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr style={stSurface1}>
      <td colSpan={colSpan} style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '10px', fontWeight: 400, ...stTextMuted, letterSpacing: '0.08em' }}>
        {label}</td>
    </tr>);
}

function TableRow({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      className="table-row transition-colors"
      style={{
        background: hovered ? 'var(--surface-1)' : 'transparent',
        transition: 'background 100ms ease', }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      {children}
    </tr>);
}

function StickyLabel({ children }: { children: React.ReactNode }) {
  return (
    <td className="sticky left-0" style={{ padding: 'var(--space-3) var(--space-4)', ...labelMuted, fontWeight: 400, background: 'var(--surface-0)', borderRight: '1px solid var(--border-subtle)' }}>
      {children}
    </td>);
}

interface CellData { value: string; style?: React.CSSProperties; wrap?: boolean; render?: React.ReactNode; }

function CompareRow({ label, cells }: { label: string; cells: CellData[] }) {
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      className="table-row transition-colors"
      style={{
        background: hovered ? 'var(--surface-1)' : 'transparent',
        transition: 'background 100ms ease', }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <StickyLabel>{label}</StickyLabel>
      {cells.map((cell, i) => (
        <td key={i} className={cell.wrap ? 'max-w-[220px]' : ''} style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-size-sm)', ...stTextSecondary, ...cell.style }}>
          {cell.render ?? (
            <span className={cell.wrap ? 'line-clamp-3' : ''}>{cell.value}</span>
          )}</td>
      ))}
    </tr>);
}

function RecommendationBanner({ recommendation }: { recommendation: ComparisonRecommendation }) {
  const styleMap: Record<string, { bg: string; border: string; iconColor: string }> = {
    strong: {
      bg: 'var(--success-muted)',
      border: 'var(--accent-30)',
      iconColor: 'var(--success)',},
    competitive: {
      bg: 'var(--accent-muted)',
      border: 'var(--accent-muted)',
      iconColor: 'var(--accent)',},
    none_ready: {
      bg: 'var(--warning-muted)',
      border: 'var(--warn-30)',
      iconColor: 'var(--warning)',},};

  const s = styleMap[recommendation.type] ?? styleMap.competitive;

  const Icon = recommendation.type === 'strong'
    ? CheckCircle
    : recommendation.type === 'competitive'
    ? Target
    : AlertTriangle;

  return (
    <div
      className="flex items-start gap-3"
      style={{
        borderRadius: 'var(--radius-xl)',
        border: `1px solid ${s.border}`,
        padding: 'var(--space-4)',
        background: s.bg, }}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: s.iconColor }} />
      <div>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>
          {recommendation.text}</div></div>
    </div>);
}

function MomentumIcon({ momentum }: { momentum: string }) {
  if (momentum === 'accelerating') return <TrendingUp className="w-3.5 h-3.5" style={stTextSecondary} />;
  if (momentum === 'decelerating') return <TrendingDown className="w-3.5 h-3.5" style={stTextPrimary} />;
  if (momentum === 'stalled') return <AlertTriangle className="w-3.5 h-3.5" style={stTextPrimary} />;
  if (momentum === 'steady') return <Minus className="w-3.5 h-3.5" style={stTextTertiary} />;
  return <Minus className="w-3.5 h-3.5" style={stTextMuted} />;
}

function EnthusiasmTrendDots({ trend }: { trend: number[] }) {
  if (trend.length === 0) { return <span style={{ ...stTextMuted, fontSize: 'var(--font-size-xs)' }}>No data</span>; }

  const maxDots = 3;
  const dots = trend.slice(-maxDots);

  return (
    <div className="flex items-center gap-1.5">
      {dots.map((score, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <div
            className="w-3 h-3"
            style={{
              borderRadius: '50%',
              background: score >= 4
                ? 'var(--success)'
                : score === 3
                ? 'var(--warning)'
                : score >= 1
                ? 'var(--danger)'
                : 'var(--border-strong)',
            }} />
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{score}</span></div>
      ))}
      {dots.length >= 2 && (
        <div className="ml-1">
          {dots[dots.length - 1] > dots[0] ? (
            <ArrowUpRight className="w-3 h-3" style={stTextSecondary} />
          ) : dots[dots.length - 1] < dots[0] ? (
            <ArrowDownRight className="w-3 h-3" style={stTextPrimary} />
          ) : (
            <Minus className="w-3 h-3" style={stTextMuted} />
          )}</div>
      )}
    </div>);
}

function AccelerationBadge({ status }: { status: AccelerationStatusData }) {
  const config: Record<string, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
    'Term Sheet Ready': {
      bg: 'var(--success-muted)',
      border: 'var(--accent-30)',
      color: 'var(--text-secondary)',
      icon: <CheckCircle className="w-3 h-3" />,},
    'Active': {
      bg: 'var(--accent-muted)',
      border: 'var(--accent-muted)',
      color: 'var(--accent)',
      icon: <Zap className="w-3 h-3" />,},
    'At Risk': {
      bg: 'var(--warning-muted)',
      border: 'var(--warn-30)',
      color: 'var(--text-tertiary)',
      icon: <AlertTriangle className="w-3 h-3" />,},
    'Stalled': {
      bg: 'var(--danger-muted)',
      border: 'var(--accent-10)',
      color: 'var(--text-primary)',
      icon: <Clock className="w-3 h-3" />,},};

  const c = config[status.label] || config['Active'];

  return (
    <div className="flex flex-col gap-1">
      <span
        className="inline-flex items-center gap-1.5 w-fit"
        style={{
          padding: 'var(--space-1) var(--space-2)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${c.border}`,
          background: c.bg,
          color: c.color,
          fontSize: 'var(--font-size-xs)',
          fontWeight: 400, }}>
        {c.icon}
        {status.label}</span>
      {status.activeTriggers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {status.activeTriggers.map(t => (
            <span
              key={t}
              style={{
                fontSize: '9px',
                color: 'var(--text-muted)',
                background: 'var(--surface-2)',
                padding: '1px 4px',
                borderRadius: 'var(--radius-sm)', }}>
              {t.replace(/_/g, ' ')}</span>
          ))}</div>
      )}
    </div>);
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
  const barColors = ['var(--accent)', 'var(--chart-3)', 'var(--chart-5)', 'var(--text-tertiary)'];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 400 }}>
          {dimension}</span>
        <span style={labelMuted10}>
          Winner: <span style={stTextSecondary}>
            {profiles.find(p => p.investor.id === winnerId)?.investor.name ?? '—'}</span></span></div>
      <div className="space-y-1">
        {profiles.map((p, idx) => {
          const score = scores[p.investor.id] ?? 0;
          const isWinner = p.investor.id === winnerId;
          return (
            <div key={p.investor.id} className="flex items-center gap-2">
              <span className="w-20 truncate" style={labelMuted10}>
                {p.investor.name}</span>
              <div
                className="flex-1 h-3 overflow-hidden"
                style={{ background: 'var(--surface-2)', borderRadius: 9999 }}>
                <div
                  className="h-full"
                  style={{
                    width: `${score}%`,
                    borderRadius: 9999,
                    transition: 'width 300ms ease',
                    background: isWinner ? barColors[idx % barColors.length] : 'var(--border-strong)',
                  }} /></div>
              <span
                className="w-7 text-right font-mono"
                style={{
                  fontSize: '10px',
                  color: isWinner ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: 400, }}>
                {score}</span>
            </div>);
        })}</div>
    </div>);
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

  const colorMap: Record<string, { bg: string; border: string; iconColor: string }> = {
    success: {
      bg: 'var(--success-muted)',
      border: 'var(--accent-25)',
      iconColor: 'var(--success)',},
    accent: {
      bg: 'var(--accent-muted)',
      border: 'var(--accent-muted)',
      iconColor: 'var(--accent)',},
    purple: {
      bg: 'var(--accent-muted)',
      border: 'var(--accent-12)',
      iconColor: 'var(--text-secondary)',},
    warning: {
      bg: 'var(--warning-muted)',
      border: 'var(--warn-25)',
      iconColor: 'var(--warning)',},
    cyan: {
      bg: 'var(--warn-6)',
      border: 'var(--warn-12)',
      iconColor: 'var(--text-tertiary)',},};

  const c = colorMap[color] ?? colorMap.accent;

  return (
    <div
      style={{
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${c.border}`,
        padding: 'var(--space-3)',
        background: c.bg, }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: c.iconColor }}>{icon}</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 400 }}>
          {title}</span></div>
      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
        {verdict.name}</div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
        {verdict.reason}</div>
    </div>);
}

// ============================================================================
// Style helpers (return CSSProperties instead of Tailwind class strings)
// ============================================================================

function tierStyle(tier: number): React.CSSProperties {
  switch (tier) {
    case 1: return { color: 'var(--accent)', fontWeight: 400 };
    case 2: return { color: 'var(--chart-4)', fontWeight: 400 };
    default: return { color: 'var(--text-muted)' };
  }}

function statusStyle(status: string): React.CSSProperties {
  if (status === 'term_sheet' || status === 'closed') return { color: 'var(--text-secondary)', fontWeight: 400 };
  if (status === 'in_dd') return { color: 'var(--accent)', fontWeight: 400 };
  if (status === 'engaged') return { color: 'var(--cat-teal)' };
  if (status === 'passed' || status === 'dropped') return { color: 'var(--text-primary)' };
  return { color: 'var(--text-secondary)' };
}

function scoreStyle(score: number): React.CSSProperties {
  if (score >= 75) return { color: 'var(--text-secondary)' };
  if (score >= 55) return { color: 'var(--accent)' };
  if (score >= 35) return { color: 'var(--text-tertiary)' };
  return { color: 'var(--text-primary)' };
}

function momentumStyle(momentum: string): React.CSSProperties {
  if (momentum === 'accelerating') return { color: 'var(--text-secondary)' };
  if (momentum === 'steady') return { color: 'var(--text-tertiary)' };
  if (momentum === 'decelerating') return { color: 'var(--text-primary)' };
  if (momentum === 'stalled') return { color: 'var(--text-primary)' };
  return { color: 'var(--text-muted)' };
}

function formatMomentum(momentum: string): string {
  if (momentum === 'accelerating') return 'Accelerating';
  if (momentum === 'steady') return 'Steady';
  if (momentum === 'decelerating') return 'Decelerating';
  if (momentum === 'stalled') return 'Stalled';
  if (momentum === 'insufficient_data') return 'Insufficient data';
  return momentum;
}

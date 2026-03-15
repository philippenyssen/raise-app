'use client';

import { useEffect, useState, useMemo, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users, Calendar, AlertTriangle, CheckCircle, MessageSquare,
  ChevronDown, Printer, Target, Shield, Clock,
  TrendingUp, TrendingDown, Minus, Loader2, BookOpen, Building2,
  ArrowLeft, Zap, CircleDot, ExternalLink, Sparkles, Plus,
  ListChecks, MessageCircleQuestion, FolderOpen, ChevronRight, Timer,
} from 'lucide-react';
import type {
  Investor, Meeting, Task, Objection, EngagementSignal,
  IntelligenceBrief, InvestorPartner, InvestorPortfolioCo,
} from '@/lib/types';
import { STATUS_LABELS, TYPE_LABELS } from '@/lib/constants';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@/lib/time';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { useToast } from '@/components/toast';
import { stAccent, stAccentBadge, stAccentBg, stBorderTop, stSurface0, stSurface1, stSurface1Border, stSurface2, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary } from '@/lib/styles';
import { parseJsonSafe } from '@/lib/api-helpers';

// ---------- types for the meeting brief ----------

interface MeetingBrief {
  investor: {
    id: string;
    name: string;
    type: string;
    tier: number;
    status: string;
    enthusiasm: number;
    partner: string;
    fund_size: string;
    check_size_range: string;
    sector_thesis: string;
  };
  narrative_profile: {
    opening_hook: string;
    emphasis: string[];
    tone_guidance: string;
    avoid_topics: string[];
  };
  brief: {
    personalized_opening: string;
    key_talking_points: string[];
    metrics_to_highlight: { metric: string; value: string; why: string }[];
    anticipated_questions_with_answers: { question: string; suggested_answer: string }[];
    previous_meeting_summary: string | null;
    unresolved_items: string[];
    risks_to_watch: string[];
    recommended_ask: string;
  };
  data_room_priority: { category: string; documents: { id: string; title: string; type: string }[] }[];
  playbook_insights: { topic: string; count: number; bestResponse: string | null }[];
  meeting_history: {
    total_meetings: number;
    latest_meeting: { date: string; type: string; enthusiasm: number; next_steps: string; ai_analysis: string } | null;
    unresolved_objections: { text: string; severity: string; topic: string; from_date: string }[];
    enthusiasm_trajectory: { date: string; score: number }[];
  };
  partners: { name: string; title: string; focus_areas: string; relevance: string }[];
  generated_at: string;
}

// ---------- helpers ----------

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  return raw ? parseJsonSafe(raw, fallback) : fallback;
}

function meetingTypeLabel(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const SPEED_STYLE: Record<string, React.CSSProperties> = {
  fast: { color: 'var(--text-secondary)' },
  medium: { color: 'var(--text-tertiary)' },
  slow: { color: 'var(--text-primary)' },};

// ---------- main page ----------

export default function MeetingPrepPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 page-content">
        <div className="skeleton" style={{ height: '28px', width: '200px' }} />
        <div className="skeleton" style={{ height: '16px', width: '350px' }} />
        <div className="skeleton" style={{ height: '44px', borderRadius: 'var(--radius-md)' }} />
        <div className="skeleton" style={{ height: '300px', borderRadius: 'var(--radius-lg)' }} />
      </div>}>
      <MeetingPrepContent />
    </Suspense>);
}

function MeetingPrepContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const preselectedInvestor = searchParams.get('investor') || '';

  // data state
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [selectedId, setSelectedId] = useState<string>(preselectedInvestor);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [briefs, setBriefs] = useState<IntelligenceBrief[]>([]);
  const [partners, setPartners] = useState<InvestorPartner[]>([]);
  const [portfolio, setPortfolio] = useState<InvestorPortfolioCo[]>([]);

  // meeting brief state
  const [meetingBrief, setMeetingBrief] = useState<MeetingBrief | null>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(true);

  // ui state
  const [loading, setLoading] = useState(true);
  const [loadingPrep, setLoadingPrep] = useState(false);
  const [notes, setNotes] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  // load investor list on mount
  useEffect(() => { document.title = 'Raise | Meeting Prep'; }, []);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/investors');
        const data: Investor[] = await res.json();
        setInvestors(data);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  // load investor-specific data when selection changes
  useEffect(() => {
    if (!selectedId) {
      setMeetings([]);
      setTasks([]);
      setBriefs([]);
      setPartners([]);
      setPortfolio([]);
      setNotes('');
      setMeetingBrief(null);
      return;
    }

    setLoadingPrep(true);
    setMeetingBrief(null);

    const safeFetch = (url: string) => fetch(url).then(r => r.ok ? r.json() : []).catch(() => []);
    Promise.all([
      safeFetch(`/api/meetings?investor_id=${selectedId}`),
      safeFetch(`/api/tasks?investor_id=${selectedId}`),
      safeFetch(`/api/intelligence?type=briefs&investor_id=${selectedId}`),
      safeFetch(`/api/intelligence?type=partners&investor_id=${selectedId}`),
      safeFetch(`/api/intelligence?type=portfolio&investor_id=${selectedId}`),
    ]).then(([m, t, b, p, pf]) => {
      setMeetings(Array.isArray(m) ? m : []);
      setTasks(Array.isArray(t) ? t : []);
      setBriefs(Array.isArray(b) ? b : []);
      setPartners(Array.isArray(p) ? p : []);
      setPortfolio(Array.isArray(pf) ? pf : []);
      setLoadingPrep(false);
    }).catch(() => {
      toast('Could not load prep data — select a different investor or refresh', 'error');
      setLoadingPrep(false);});
  }, [selectedId, toast]);

  const investor = useMemo(() => investors.find(i => i.id === selectedId), [investors, selectedId]);

  // ---- generate meeting brief ----
  const generateBrief = useCallback(async () => {
    if (!selectedId) return;
    setGeneratingBrief(true);
    try {
      const res = await fetch('/api/meeting-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ investor_id: selectedId }),});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Could not generate brief — try again');
      }
      const brief: MeetingBrief = await res.json();
      setMeetingBrief(brief);
      setBriefExpanded(true);
      toast('Meeting brief generated');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not generate brief — try again', 'error');
    } finally {
      setGeneratingBrief(false);
    }
  }, [selectedId, toast]);

  // ---- derived intelligence ----
  const allObjections = useMemo(() => {
    const out: (Objection & { meetingDate: string })[] = [];
    meetings.forEach(m => {
      const objs = safeJsonParse<Objection[]>(m.objections, []);
      objs.forEach(o => out.push({ ...o, meetingDate: m.date }));});
    return out;
  }, [meetings]);

  const unresolvedObjections = useMemo(
    () => allObjections.filter(o => o.response_effectiveness !== 'resolved'),
    [allObjections],);

  const latestMeeting = useMemo(() => meetings[0] ?? null, [meetings]);

  const enthusiasmTrend = useMemo(() => {
    if (meetings.length < 2) return null;
    const sorted = [...meetings].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0].enthusiasm_score;
    const last = sorted[sorted.length - 1].enthusiasm_score;
    if (last > first) return 'rising';
    if (last < first) return 'declining';
    return 'stable';
  }, [meetings]);

  const engagementSignals = useMemo(() => {
    if (!latestMeeting) return null;
    return safeJsonParse<EngagementSignal | null>(latestMeeting.engagement_signals, null);
  }, [latestMeeting]);

  const portfolioConflicts = useMemo(
    () => portfolio.filter(p => p.relevance && p.relevance.toLowerCase().includes('conflict')),
    [portfolio],);

  const pendingTasks = useMemo(
    () => tasks.filter(t => t.status === 'pending' || t.status === 'in_progress'),
    [tasks],);

  const nextMeeting = useMemo(() => { const now = Date.now(); return meetings.filter(m => new Date(m.date).getTime() > now).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null; }, [meetings]);
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (!nextMeeting) { setCountdown(''); return; }
    const tick = () => { const diff = new Date(nextMeeting.date).getTime() - Date.now(); if (diff <= 0) { setCountdown('Now'); return; } const d = Math.floor(diff / MS_PER_DAY), h = Math.floor((diff % MS_PER_DAY) / MS_PER_HOUR), m = Math.floor((diff % MS_PER_HOUR) / MS_PER_MINUTE); setCountdown(d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`); };
    tick(); const id = setInterval(tick, MS_PER_MINUTE); return () => clearInterval(id);
  }, [nextMeeting]);
  const topObjections = useMemo(() => { const sev: Record<string, number> = { showstopper: 3, significant: 2, minor: 1 }; return [...unresolvedObjections].sort((a, b) => (sev[b.severity] ?? 0) - (sev[a.severity] ?? 0)).slice(0, 3); }, [unresolvedObjections]);

  // ---- talking points generation ----
  const talkingPoints = useMemo(() => {
    const points: { category: string; text: string; priority: 'high' | 'medium' | 'low' }[] = [];

    if (latestMeeting?.next_steps) {
      points.push({
        category: 'Follow-up',
        text: `Address next steps from ${fmtDate(latestMeeting.date)}: ${latestMeeting.next_steps}`,
        priority: 'high',});
    }

    unresolvedObjections.forEach(o => {
      points.push({
        category: 'Objection to preempt',
        text: `${o.text}${o.severity === 'showstopper' ? ' (SHOWSTOPPER)' : o.severity === 'significant' ? ' (significant)' : ''}`,
        priority: o.severity === 'showstopper' ? 'high' : o.severity === 'significant' ? 'high' : 'medium',});});

    if (engagementSignals) {
      if (engagementSignals.asked_about_process) {
        points.push({ category: 'Positive signal', text: 'They asked about our process/timeline — they are tracking the deal. Reinforce urgency.', priority: 'medium' });
      }
      if (engagementSignals.asked_about_timeline) {
        points.push({ category: 'Positive signal', text: 'They asked about timeline — share updated milestones and closing timeline.', priority: 'medium' });
      }
      if (engagementSignals.requested_followup) {
        points.push({ category: 'Positive signal', text: 'They requested follow-up materials — ensure these have been sent and reference them.', priority: 'high' });
      }
      if (engagementSignals.slides_that_landed?.length > 0) {
        points.push({
          category: 'Build on strength',
          text: `Topics that resonated: ${engagementSignals.slides_that_landed.join(', ')}`,
          priority: 'medium',});
      }
      if (engagementSignals.slides_that_fell_flat?.length > 0) {
        points.push({
          category: 'Improve delivery',
          text: `Topics that fell flat previously: ${engagementSignals.slides_that_fell_flat.join(', ')} — rework these.`,
          priority: 'medium',});
      }
      if (engagementSignals.mentioned_competitors) {
        points.push({ category: 'Competitive intel', text: 'They mentioned competitors — prepare differentiation talking points.', priority: 'high' });
      }}

    if (portfolioConflicts.length > 0) {
      points.push({
        category: 'Risk',
        text: `Portfolio conflict with: ${portfolioConflicts.map(c => c.company).join(', ')} — be prepared to address overlap.`,
        priority: 'high',});
    }

    if (pendingTasks.length > 0) {
      points.push({
        category: 'Open items',
        text: `${pendingTasks.length} open tasks for this investor — ensure all deliverables are ready.`,
        priority: 'medium',});
    }

    if (enthusiasmTrend === 'declining') {
      points.push({
        category: 'Warning',
        text: 'Enthusiasm has been declining across meetings. Focus on re-engagement and new data points.',
        priority: 'high',});
    } else if (enthusiasmTrend === 'rising') {
      points.push({
        category: 'Momentum',
        text: 'Enthusiasm trend is positive. Push for next milestone (DD access, term sheet discussion).',
        priority: 'medium',});
    }

    if (investor?.ic_process) {
      points.push({
        category: 'Process',
        text: `IC process: ${investor.ic_process}. Understand where we are in their pipeline.`,
        priority: 'low',});
    }

    return points;
  }, [latestMeeting, unresolvedObjections, engagementSignals, portfolioConflicts, pendingTasks, enthusiasmTrend, investor]);

  // ---- print handler ----
  function handlePrint() {
    window.print();
  }

  // ---- render ----

  if (loading) {
    return (
      <div className="space-y-6 page-content">
        <div className="skeleton" style={{ height: '28px', width: '220px' }} />
        <div className="skeleton" style={{ height: '48px', borderRadius: 'var(--radius-xl)' }} />
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={{ height: '96px', borderRadius: 'var(--radius-xl)' }} />
          ))}</div>
      </div>);
  }

  return (
    <>
      {/* Print-only stylesheet */}
      <style>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          nav, aside, button, .no-print { display: none !important; }
          .print-card { border: 1px solid #ccc !important; break-inside: avoid; page-break-inside: avoid; margin-bottom: 12px; }
          .print-card * { color: #000 !important; }
          .print-break { page-break-before: always; }
          h1, h2, h3 { color: #000 !important; }
          .print-bg-white { background: #fff !important; }
          textarea { border: 1px solid #ccc !important; background: #f9f9f9 !important; color: #000 !important; }
          .print-section-title { font-size: 14px; font-weight: 400; border-bottom: 2px solid #333; padding-bottom: 4px; margin-bottom: 8px; }
          @page { margin: 1.5cm; }
        }
      `}</style>

      <div ref={printRef} className="page-content space-y-6 print-bg-white">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Link href="/meetings" className="transition-colors no-print" style={stTextMuted}>
              <ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <h1 className="page-title">Meeting Prep</h1>
              <p className="text-sm mt-0.5" style={stTextMuted}>AI-generated brief with talking points, objections to preempt, and data room priorities</p>
            </div></div>
          <div className="flex items-center gap-2">
            {investor && (
              <>
                <GenerateBriefButton generating={generatingBrief} onClick={generateBrief} />
                <PrintButton onClick={handlePrint} />
              </>
            )}</div></div>

        {/* Investor selector */}
        <div className="no-print">
          <label className="text-xs block mb-1.5 font-normal tracking-wider" style={stTextMuted}>Select Investor</label>
          <div className="relative">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full md:w-96 rounded-lg px-4 py-2.5 text-sm focus:outline-none appearance-none cursor-pointer pr-10"
              style={{ background: 'var(--surface-1)', color: 'var(--text-secondary)' }}>
              <option value="">Select investor for this meeting...</option>
              {investors.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.name} -- {TYPE_LABELS[inv.type] || inv.type} (T{inv.tier})</option>
              ))}</select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={stTextMuted}>
              <ChevronDown className="w-4 h-4" /></span></div></div>

        {/* No investor selected — smart suggestions */}
        {!selectedId && !loading && investors.length > 0 && (() => {
          // Prioritize: active investors sorted by tier then enthusiasm descending
          const active = investors.filter(i =>
            !['passed', 'dropped', 'closed', 'identified'].includes(i.status));
          const byPriority = [...active].sort((a, b) => {
            if (a.tier !== b.tier) return a.tier - b.tier;
            return (b.enthusiasm ?? 0) - (a.enthusiasm ?? 0);});
          const suggested = byPriority.slice(0, 6);

          return (
            <div className="space-y-4">
              <div
                className="rounded-xl p-6" style={stSurface1}>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4" style={stAccent} />
                  <h3 className="text-sm font-normal" style={stTextPrimary}>
                    Who are you meeting?</h3></div>
                <p className="text-xs mb-4" style={stTextMuted}>
                  Select an investor above or quick-pick from your active pipeline. AI will generate a personalized brief with talking points, objection prep, and data room priorities.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {suggested.map(inv => {
                    const statusLabel = STATUS_LABELS[inv.status] || inv.status;
                    return (
                      <button
                        key={inv.id}
                        onClick={() => setSelectedId(inv.id)}
                        className="flex items-center gap-3 p-3 rounded-lg text-left transition-colors"
                        style={stSurface0}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'var(--accent-muted)'; }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'var(--surface-0)'; }}>
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-normal"
                          style={stAccentBadge}>
                          T{inv.tier}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-normal truncate" style={stTextPrimary}>
                            {inv.name}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs" style={stTextMuted}>{statusLabel}</span>
                            {(inv.enthusiasm ?? 0) > 0 && (
                              <span className="flex gap-0.5">
                                {[1,2,3,4,5].map(n => (
                                  <span
                                    key={n}
                                    className="w-1.5 h-1.5 rounded-full inline-block"
                                    style={{ background: n <= (inv.enthusiasm ?? 0) ? 'var(--accent)' : 'var(--surface-3)' }} />
                                ))}</span>
                            )}</div></div>
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" style={stTextMuted} />
                      </button>);
                  })}</div>
                {active.length > 6 && (
                  <p className="text-xs mt-3 text-center" style={stTextMuted}>
                    + {active.length - 6} more in pipeline — use the dropdown above to search</p>
                )}</div>
            </div>);
        })()}
        {!selectedId && !loading && investors.length === 0 && (
          <div className="rounded-xl p-12 text-center" style={stSurface1}>
            <Users className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--surface-3)' }} />
            <p className="text-sm mb-3" style={stTextMuted}>No investors in pipeline yet.</p>
            <Link href="/meetings/new" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm" style={{ background: 'var(--accent)', color: 'var(--surface-0)' }}>
              <Plus className="w-4 h-4" /> Schedule a Meeting</Link></div>
        )}

        {/* Loading prep data */}
        {selectedId && loadingPrep && (
          <div className="rounded-xl p-12 text-center">
            <span className="block mx-auto mb-3 w-8 h-8" style={stAccent}>
              <Loader2 className="w-8 h-8 animate-spin" /></span>
            <p className="text-sm" style={stTextMuted}>Loading meeting history, objections, and tasks...</p></div>
        )}

        {/* Prep content */}
        {investor && !loadingPrep && (
          <div className="space-y-5">

            {/* ============ AT-A-GLANCE BAR ============ */}
            {(() => {
              const divider = { borderLeft: '1px solid var(--border-subtle)', paddingLeft: 'var(--space-4)' };
              const trendColor = enthusiasmTrend === 'rising' ? 'var(--success)' : enthusiasmTrend === 'declining' ? 'var(--danger)' : 'var(--text-muted)';
              return (
                <section className="rounded-xl p-4 flex flex-wrap items-center gap-4" style={{ ...stSurface1, border: '1px solid var(--border-subtle)' }}>
                  {countdown && nextMeeting ? (
                    <div className="flex items-center gap-2"><span style={stAccent}><Timer className="w-4 h-4" /></span><div><div className="text-xs" style={stTextMuted}>Next meeting</div><div className="text-sm font-normal" style={stTextPrimary}>{countdown}</div></div></div>
                  ) : meetings.length === 0 ? (
                    <div className="flex items-center gap-2"><span style={stTextMuted}><Calendar className="w-4 h-4" /></span><Link href="/meetings/new" className="text-xs" style={stAccent}>Schedule first meeting</Link></div>
                  ) : null}
                  {enthusiasmTrend && (
                    <div className="flex items-center gap-2" style={divider}>
                      <span style={{ color: trendColor }}>{enthusiasmTrend === 'rising' ? <TrendingUp className="w-4 h-4" /> : enthusiasmTrend === 'declining' ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}</span>
                      <div><div className="text-xs" style={stTextMuted}>Conviction</div><div className="text-sm capitalize" style={{ color: trendColor }}>{enthusiasmTrend}</div></div>
                    </div>
                  )}
                  {topObjections.length > 0 && (
                    <div className="flex items-start gap-2 flex-1 min-w-[200px]" style={divider}>
                      <span style={stTextPrimary}><AlertTriangle className="w-4 h-4 mt-0.5" /></span>
                      <div className="min-w-0"><div className="text-xs mb-1" style={stTextMuted}>Top objections</div>{topObjections.map((o, i) => <div key={i} className="text-xs truncate" style={stTextSecondary}>{o.text}</div>)}</div>
                    </div>
                  )}
                  {!meetingBrief && !generatingBrief && <button onClick={generateBrief} className="ml-auto no-print px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5" style={{ background: 'var(--accent)', color: 'var(--surface-0)' }}><Sparkles className="w-3.5 h-3.5" /> Quick Brief</button>}
                  {generatingBrief && <span className="ml-auto text-xs flex items-center gap-1.5" style={stTextMuted}><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</span>}
                </section>);
            })()}

            {/* ============ CUSTOMIZED MEETING BRIEF (AI-generated) ============ */}
            {meetingBrief && (
              <section className="rounded-xl print-card overflow-hidden" style={{ border: '1px solid var(--accent)', ...stAccentBg }}>
                <button
                  onClick={() => setBriefExpanded(!briefExpanded)}
                  className="w-full p-5 flex items-center justify-between no-print">
                  <h2 className="text-sm font-normal tracking-wider flex items-center gap-2 print-section-title" style={stAccent}>
                    <Sparkles className="w-4 h-4" />
                    Customized Brief for {investor.name} ({TYPE_LABELS[investor.type] || investor.type})</h2>
                  <span style={stAccent}>
                    <ChevronRight className={`w-4 h-4 transition-transform ${briefExpanded ? 'rotate-90' : ''}`} /></span>
                </button>
                {/* Print-only static header */}
                <div className="hidden print:block p-5 pb-0">
                  <h2 className="text-sm font-normal tracking-wider flex items-center gap-2 print-section-title">
                    Customized Brief for {investor.name} ({TYPE_LABELS[investor.type] || investor.type})</h2></div>

                {briefExpanded && (
                  <div className="px-5 pb-5 space-y-5">
                    {/* Opening Hook */}
                    <div>
                      <h3 className="text-xs font-normal tracking-wider mb-2" style={stAccent}>Opening</h3>
                      <p className="text-sm leading-relaxed" style={stTextSecondary}>{meetingBrief.brief.personalized_opening}</p>
                    </div>

                    {/* Narrative Profile */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-xs font-normal tracking-wider mb-2" style={stAccent}>Emphasize</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {meetingBrief.narrative_profile.emphasis.map((e, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-md" style={stAccentBadge}>{e}</span>
                          ))}</div></div>
                      <div>
                        <h3 className="text-xs font-normal tracking-wider mb-2" style={stTextPrimary}>Avoid</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {meetingBrief.narrative_profile.avoid_topics.map((t, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-md" style={{ background: 'var(--danger-muted)', ...stTextPrimary }}>{t}</span>
                          ))}</div></div></div>

                    {/* Key Talking Points */}
                    <div>
                      <h3 className="text-xs font-normal tracking-wider mb-2 flex items-center gap-1.5" style={stAccent}>
                        <ListChecks className="w-3.5 h-3.5" />
                        Key Talking Points</h3>
                      <div className="space-y-2">
                        {meetingBrief.brief.key_talking_points.map((point, i) => (
                          <div key={i} className="flex items-start gap-2.5 text-sm">
                            <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                            <span style={stTextSecondary}>{point}</span></div>
                        ))}</div></div>

                    {/* Key Metrics */}
                    {meetingBrief.brief.metrics_to_highlight.length > 0 && (
                      <div>
                        <h3 className="text-xs font-normal tracking-wider mb-2 flex items-center gap-1.5" style={stAccent}>
                          <Target className="w-3.5 h-3.5" />
                          Key Metrics</h3>
                        <div className="rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead style={stSurface1Border}>
                              <tr>
                                <th className="text-left px-3 py-2 font-normal" style={stTextMuted}>Metric</th>
                                <th className="text-left px-3 py-2 font-normal" style={stTextMuted}>Value</th>
                                <th className="text-left px-3 py-2 font-normal" style={stTextMuted}>Why It Matters</th></tr>
                            </thead>
                            <tbody>
                              {meetingBrief.brief.metrics_to_highlight.map((m, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                  <td className="px-3 py-2 font-normal" style={stTextSecondary}>{m.metric}</td>
                                  <td className="px-3 py-2 font-mono" style={stAccent}>{m.value}</td>
                                  <td className="px-3 py-2" style={stTextTertiary}>{m.why}</td></tr>
                              ))}</tbody></table></div></div>
                    )}

                    {/* Anticipated Questions with Answers */}
                    {meetingBrief.brief.anticipated_questions_with_answers.length > 0 && (
                      <div>
                        <h3 className="text-xs font-normal tracking-wider mb-2 flex items-center gap-1.5" style={stAccent}>
                          <MessageCircleQuestion className="w-3.5 h-3.5" />
                          Anticipated Questions + Suggested Answers</h3>
                        <div className="space-y-3">
                          {meetingBrief.brief.anticipated_questions_with_answers.map((qa, i) => (
                            <div key={i} className="rounded-lg p-3">
                              <p className="text-sm font-normal mb-1.5" style={stTextSecondary}>Q: {qa.question}</p>
                              <p className="text-xs leading-relaxed" style={stTextTertiary}>A: {qa.suggested_answer}</p></div>
                          ))}</div></div>
                    )}

                    {/* Data Room Priority */}
                    {meetingBrief.data_room_priority.length > 0 && (
                      <div>
                        <h3 className="text-xs font-normal tracking-wider mb-2 flex items-center gap-1.5" style={stAccent}>
                          <FolderOpen className="w-3.5 h-3.5" />
                          Data Room Priority</h3>
                        <div className="space-y-1.5">
                          {meetingBrief.data_room_priority.map((dr, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span className="text-xs font-mono w-4" style={stTextMuted}>{i + 1}.</span>
                              <span style={stTextSecondary}>{dr.category}</span>
                              {dr.documents.length > 0 && (
                                <span className="text-xs" style={stTextMuted}>
                                  ({dr.documents.map(d => d.title).join(', ')})</span>
                              )}</div>
                          ))}</div></div>
                    )}

                    {/* Previous Meeting + Unresolved Items */}
                    {meetingBrief.brief.previous_meeting_summary && (
                      <div className="pt-4" style={stBorderTop}>
                        <h3 className="text-xs font-normal tracking-wider mb-2" style={stTextMuted}>Previous Meeting</h3>
                        <p className="text-sm" style={stTextTertiary}>{meetingBrief.brief.previous_meeting_summary}</p></div>
                    )}

                    {meetingBrief.brief.unresolved_items.length > 0 && (
                      <div>
                        <h3 className="text-xs font-normal tracking-wider mb-2" style={stTextTertiary}>Unresolved Items</h3>
                        <div className="space-y-1.5">
                          {meetingBrief.brief.unresolved_items.map((item, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <span className="shrink-0 mt-0.5" style={stTextTertiary}>
                                <AlertTriangle className="w-3.5 h-3.5" /></span>
                              <span style={stTextSecondary}>{item}</span></div>
                          ))}</div></div>
                    )}

                    {/* Risks to Watch */}
                    {meetingBrief.brief.risks_to_watch.length > 0 && (
                      <div>
                        <h3 className="text-xs font-normal tracking-wider mb-2" style={stTextPrimary}>Risks to Watch</h3>
                        <div className="space-y-1.5">
                          {meetingBrief.brief.risks_to_watch.map((risk, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <span className="shrink-0 mt-0.5" style={stTextPrimary}>
                                <Shield className="w-3.5 h-3.5" /></span>
                              <span style={stTextTertiary}>{risk}</span></div>
                          ))}</div></div>
                    )}

                    {/* Recommended Ask */}
                    <div className="pt-4" style={stBorderTop}>
                      <h3 className="text-xs font-normal tracking-wider mb-2" style={stTextSecondary}>Recommended Ask</h3>
                      <p className="text-sm font-normal" style={stTextSecondary}>{meetingBrief.brief.recommended_ask}</p></div>

                    {/* Playbook Insights */}
                    {meetingBrief.playbook_insights.length > 0 && (
                      <div className="pt-4" style={stBorderTop}>
                        <h3 className="text-xs font-normal tracking-wider mb-2" style={stTextTertiary}>Playbook Insights</h3>
                        <div className="space-y-2">
                          {meetingBrief.playbook_insights.map((pi, i) => (
                            <div key={i} className="text-sm">
                              <span className="text-xs px-1.5 py-0.5 rounded mr-2" style={stAccentBadge}>
                                {pi.topic} ({pi.count}x)</span>
                              {pi.bestResponse && (
                                <span className="text-xs" style={stTextTertiary}>Best response: {pi.bestResponse}</span>
                              )}</div>
                          ))}</div></div>
                    )}

                    {/* Tone Guidance */}
                    <div className="pt-4" style={stBorderTop}>
                      <h3 className="text-xs font-normal tracking-wider mb-2" style={stTextMuted}>Tone Guidance</h3>
                      <p className="text-xs italic" style={stTextMuted}>{meetingBrief.narrative_profile.tone_guidance}</p></div>

                    <div className="text-xs text-right" style={stTextMuted}>
                      Generated {fmtDateTime(meetingBrief.generated_at)}</div></div>
                )}</section>
            )}

            {/* ============ INVESTOR PROFILE ============ */}
            <section className="rounded-xl p-5 print-card">
              <h2 className="text-sm font-normal tracking-wider mb-4 flex items-center gap-2 print-section-title" style={stTextTertiary}>
                <span style={stAccent}><Building2 className="w-4 h-4" /></span>
                Investor Profile</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ProfileField label="Name" value={investor.name} bold />
                <ProfileField label="Type" value={TYPE_LABELS[investor.type] || investor.type} />
                <ProfileField label="Tier" value={`Tier ${investor.tier}`} badge badgeStyle={
                  investor.tier === 1 ? { background: 'var(--accent-muted)', color: 'var(--accent)' } :
                  investor.tier === 2 ? { background: 'var(--accent-muted)', color: 'var(--accent)' } :
                  { background: 'var(--surface-3)', color: 'var(--text-tertiary)' }
                } />
                <ProfileField label="Status" value={STATUS_LABELS[investor.status] || investor.status} />
                <ProfileField label="Fund Size" value={investor.fund_size || '—'} />
                <ProfileField label="Check Size" value={investor.check_size_range || '—'} />
                <ProfileField label="Key Partner" value={investor.partner || '—'} />
                <div>
                  <span className="text-xs block mb-0.5" style={stTextMuted}>Enthusiasm</span>
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <div key={n} className="w-2.5 h-2.5 rounded-full" style={{ background: n <= investor.enthusiasm ? 'var(--accent)' : 'var(--surface-2)' }}
                          />
                      ))}</div>
                    <span className="text-xs" style={stTextTertiary}>{investor.enthusiasm}/5</span></div></div>
                <ProfileField label="IC Process" value={investor.ic_process || '—'} />
                <div>
                  <span className="text-xs block mb-0.5" style={stTextMuted}>Speed</span>
                  <span className="text-sm font-normal capitalize" style={SPEED_STYLE[investor.speed] || { color: 'var(--text-tertiary)' }}>
                    {investor.speed || '—'}</span></div></div>
              {investor.sector_thesis && (
                <div className="mt-4 pt-3" style={stBorderTop}>
                  <span className="text-xs" style={stTextMuted}>Sector Thesis: </span>
                  <span className="text-sm" style={stTextSecondary}>{investor.sector_thesis}</span></div>
              )}
              {investor.warm_path && (
                <div className="mt-2">
                  <span className="text-xs" style={stTextMuted}>Warm Path: </span>
                  <span className="text-sm" style={stTextSecondary}>{investor.warm_path}</span></div>
              )}
              {investor.portfolio_conflicts && (
                <div className="mt-2">
                  <span className="text-xs" style={stTextMuted}>Portfolio Conflicts: </span>
                  <span className="text-sm" style={stTextPrimary}>{investor.portfolio_conflicts}</span></div>
              )}
              {investor.notes && (
                <div className="mt-2">
                  <span className="text-xs" style={stTextMuted}>Notes: </span>
                  <span className="text-sm" style={stTextTertiary}>{investor.notes}</span></div>
              )}</section>

            {/* ============ SUGGESTED TALKING POINTS ============ */}
            {talkingPoints.length > 0 && (
              <section className="rounded-xl p-5 print-card">
                <h2 className="text-sm font-normal tracking-wider mb-4 flex items-center gap-2 print-section-title" style={stTextTertiary}>
                  <span style={stTextTertiary}><Zap className="w-4 h-4" /></span>
                  Suggested Talking Points</h2>
                <div className="space-y-2.5">
                  {talkingPoints
                    .sort((a, b) => {
                      const order = { high: 0, medium: 1, low: 2 };
                      return order[a.priority] - order[b.priority];})
                    .map((tp, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <span className="shrink-0 mt-0.5 w-2 h-2 rounded-full" style={{
                        background: tp.priority === 'high' ? 'var(--danger)' :
                          tp.priority === 'medium' ? 'var(--warning)' :
                          'var(--surface-3)',
                      }} />
                      <div className="flex-1">
                        <span className="text-xs font-normal px-1.5 py-0.5 rounded mr-2" style={
                          tp.category === 'Follow-up' ? { background: 'var(--accent-muted)', color: 'var(--accent)' } :
                          tp.category === 'Objection to preempt' ? { background: 'var(--danger-muted)', color: 'var(--text-primary)' } :
                          tp.category === 'Positive signal' ? { background: 'var(--success-muted)', color: 'var(--text-secondary)' } :
                          tp.category === 'Build on strength' ? { background: 'var(--success-muted)', color: 'var(--text-secondary)' } :
                          tp.category === 'Improve delivery' ? { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' } :
                          tp.category === 'Competitive intel' ? { background: 'var(--accent-muted)', color: 'var(--accent)' } :
                          tp.category === 'Risk' ? { background: 'var(--danger-muted)', color: 'var(--text-primary)' } :
                          tp.category === 'Warning' ? { background: 'var(--danger-muted)', color: 'var(--text-primary)' } :
                          tp.category === 'Momentum' ? { background: 'var(--success-muted)', color: 'var(--text-secondary)' } :
                          { background: 'var(--surface-2)', color: 'var(--text-tertiary)' }
                        }>{tp.category}</span>
                        <span style={stTextSecondary}>{tp.text}</span></div></div>
                  ))}</div></section>
            )}

            {/* ============ KEY RISKS ============ */}
            {(portfolioConflicts.length > 0 || unresolvedObjections.length > 0 || investor.portfolio_conflicts || enthusiasmTrend === 'declining') && (
              <section className="rounded-xl p-5 print-card" style={{ background: 'var(--danger-muted)' }}>
                <h2 className="text-sm font-normal tracking-wider mb-4 flex items-center gap-2 print-section-title" style={stTextPrimary}>
                  <AlertTriangle className="w-4 h-4" />
                  Key Risks to Address</h2>
                <div className="space-y-3">
                  {investor.portfolio_conflicts && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="shrink-0 mt-0.5" style={stTextPrimary}>
                        <Shield className="w-4 h-4" /></span>
                      <div>
                        <span className="font-normal" style={stTextSecondary}>Portfolio Conflict: </span>
                        <span style={stTextTertiary}>{investor.portfolio_conflicts}</span></div></div>
                  )}
                  {portfolioConflicts.map((pc, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="shrink-0 mt-0.5" style={stTextTertiary}>
                        <Shield className="w-4 h-4" /></span>
                      <div>
                        <span className="font-normal" style={stTextSecondary}>Portfolio company overlap: </span>
                        <span style={stTextTertiary}>{pc.company} ({pc.sector}) -- {pc.relevance}</span></div></div>
                  ))}
                  {unresolvedObjections.map((o, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="shrink-0 mt-0.5" style={{
                        color: o.severity === 'showstopper' ? 'var(--danger)' :
                          o.severity === 'significant' ? 'var(--warning)' :
                          'var(--text-muted)',}}>
                        <CircleDot className="w-4 h-4" /></span>
                      <div>
                        <span className="font-normal" style={stTextSecondary}>
                          {o.response_effectiveness === 'partial' ? 'Partially addressed' : 'Unresolved'} objection
                          {o.severity === 'showstopper' ? ' (SHOWSTOPPER)' : ''}:
                        </span>{' '}
                        <span style={stTextTertiary}>{o.text}</span>
                        <span className="text-xs ml-2" style={stTextMuted}>from {fmtDate(o.meetingDate)}</span></div></div>
                  ))}
                  {enthusiasmTrend === 'declining' && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="shrink-0 mt-0.5 rotate-180" style={stTextPrimary}>
                        <TrendingUp className="w-4 h-4" /></span>
                      <div>
                        <span className="font-normal" style={stTextSecondary}>Declining enthusiasm: </span>
                        <span style={stTextTertiary}>
                          Enthusiasm score has dropped across meetings. Identify what changed and counter it.</span></div></div>
                  )}</div></section>
            )}

            {/* ============ MEETING HISTORY ============ */}
            <section className="rounded-xl p-5 print-card">
              <h2 className="text-sm font-normal tracking-wider mb-4 flex items-center gap-2 print-section-title" style={stTextTertiary}>
                <span style={stAccent}><Calendar className="w-4 h-4" /></span>
                Meeting History
                <span className="text-xs font-normal ml-1" style={stTextMuted}>({meetings.length} meetings)</span></h2>
              {meetings.length === 0 ? (
                <p className="text-sm" style={stTextMuted}>No previous meetings recorded with this investor.</p>
              ) : (
                <div className="space-y-3">
                  {meetings.map(m => {
                    const objs = safeJsonParse<Objection[]>(m.objections, []);
                    return (
                      <MeetingCard key={m.id} meeting={m} objs={objs} />);
                  })}</div>
              )}</section>

            {/* ============ INTELLIGENCE ============ */}
            {(briefs.length > 0 || partners.length > 0 || portfolio.length > 0) && (
              <section className="rounded-xl p-5 print-card">
                <h2 className="text-sm font-normal tracking-wider mb-4 flex items-center gap-2 print-section-title" style={stTextTertiary}>
                  <span style={stAccent}><BookOpen className="w-4 h-4" /></span>
                  Intelligence</h2>

                {/* Research briefs */}
                {briefs.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-normal tracking-wider mb-2" style={stTextMuted}>Research Briefs</h3>
                    <div className="space-y-2">
                      {briefs.map(b => (
                        <details key={b.id} className="group rounded-lg overflow-hidden">
                          <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm">
                            <span className="text-xs px-1.5 py-0.5 rounded font-normal" style={
                              b.brief_type === 'investor' ? { background: 'var(--accent-muted)', color: 'var(--accent)' } :
                              b.brief_type === 'competitor' ? { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' } :
                              { background: 'var(--surface-2)', color: 'var(--text-tertiary)' }
                            }>{b.brief_type}</span>
                            <span style={stTextSecondary}>{b.subject}</span>
                            <span className="text-xs ml-auto" style={stTextMuted}>{b.updated_at?.split('T')[0]}</span></summary>
                          <div className="px-3 pb-3 text-xs whitespace-pre-wrap leading-relaxed pt-2" style={{ ...stTextTertiary, ...stBorderTop }}>
                            {b.content}</div></details>
                      ))}</div></div>
                )}

                {/* Partner profiles */}
                {partners.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-normal tracking-wider mb-2" style={stTextMuted}>Partner Profiles</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {partners.map(p => (
                        <div key={p.id} className="rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span style={stTextMuted}><Users className="w-3.5 h-3.5" /></span>
                            <span className="text-sm font-normal" style={stTextSecondary}>{p.name}</span></div>
                          {p.title && <p className="text-xs" style={stTextMuted}>{p.title}</p>}
                          {p.focus_areas && <p className="text-xs mt-1" style={stTextTertiary}>Focus: {p.focus_areas}</p>}
                          {p.notable_deals && <p className="text-xs mt-0.5" style={stTextTertiary}>Deals: {p.notable_deals}</p>}
                          {p.relevance_to_us && <p className="text-xs mt-0.5" style={stAccent}>{p.relevance_to_us}</p>}</div>
                      ))}</div></div>
                )}

                {/* Portfolio companies */}
                {portfolio.length > 0 && (
                  <div>
                    <h3 className="text-xs font-normal tracking-wider mb-2" style={stTextMuted}>Portfolio Companies</h3>
                    <div className="rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead style={stSurface1Border}>
                          <tr>
                            <th className="text-left px-3 py-2 font-normal" style={stTextMuted}>Company</th>
                            <th className="text-left px-3 py-2 font-normal" style={stTextMuted}>Sector</th>
                            <th className="text-left px-3 py-2 font-normal" style={stTextMuted}>Stage</th>
                            <th className="text-left px-3 py-2 font-normal" style={stTextMuted}>Relevance</th></tr></thead>
                        <tbody>
                          {portfolio.map(pc => (
                            <tr key={pc.id} style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              background: pc.relevance?.toLowerCase().includes('conflict') ? 'var(--danger-muted)' : undefined,}}>
                              <td className="px-3 py-2 font-normal" style={stTextSecondary}>{pc.company}</td>
                              <td className="px-3 py-2" style={stTextMuted}>{pc.sector}</td>
                              <td className="px-3 py-2" style={stTextMuted}>{pc.stage_invested}</td>
                              <td className="px-3 py-2" style={stTextTertiary}>{pc.relevance || '—'}</td></tr>
                          ))}</tbody></table></div></div>
                )}</section>
            )}

            {/* ============ OPEN TASKS ============ */}
            <section className="rounded-xl p-5 print-card">
              <h2 className="text-sm font-normal tracking-wider mb-4 flex items-center gap-2 print-section-title" style={stTextTertiary}>
                <span style={stTextSecondary}><CheckCircle className="w-4 h-4" /></span>
                Open Tasks
                <span className="text-xs font-normal ml-1" style={stTextMuted}>
                  ({pendingTasks.length} pending)</span></h2>
              {pendingTasks.length === 0 ? (
                <p className="text-sm" style={stTextMuted}>No pending tasks for this investor.</p>
              ) : (
                <div className="space-y-2">
                  {pendingTasks.map(t => (
                    <div key={t.id} className="flex items-start gap-3 text-sm rounded-lg p-3">
                      <span className="shrink-0 mt-1 w-2 h-2 rounded-full" style={{
                        background: t.priority === 'critical' ? 'var(--danger)' :
                          t.priority === 'high' ? 'var(--warning)' :
                          t.priority === 'medium' ? 'var(--warning)' :
                          'var(--surface-3)',
                      }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-normal" style={stTextSecondary}>{t.title}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded" style={
                            t.status === 'in_progress' ? { background: 'var(--accent-muted)', color: 'var(--accent)' } : { background: 'var(--surface-2)', color: 'var(--text-muted)' }
                          }>{t.status === 'in_progress' ? 'In Progress' : 'Pending'}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded" style={
                            t.priority === 'critical' ? { background: 'var(--danger-muted)', color: 'var(--text-primary)' } :
                            t.priority === 'high' ? { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' } :
                            { background: 'var(--surface-2)', color: 'var(--text-muted)' }
                          }>{t.priority}</span></div>
                        {t.description && <p className="text-xs mt-0.5" style={stTextMuted}>{t.description}</p>}
                        <div className="flex gap-3 text-xs mt-1" style={stTextMuted}>
                          {t.due_date && (
                            <span className="flex items-center gap-1" style={{
                              color: new Date(t.due_date) < new Date() ? 'var(--danger)' : undefined,}}>
                              <Clock className="w-3 h-3" />
                              {fmtDate(t.due_date)}
                              {new Date(t.due_date) < new Date() && ' (overdue)'}</span>
                          )}
                          {t.assignee && <span>{t.assignee}</span>}</div></div></div>
                  ))}</div>
              )}</section>

            {/* ============ PRE-MEETING NOTES ============ */}
            <section className="rounded-xl p-5 print-card">
              <h2 className="text-sm font-normal tracking-wider mb-4 flex items-center gap-2 print-section-title" style={stTextTertiary}>
                <span style={stTextTertiary}><MessageSquare className="w-4 h-4" /></span>
                Pre-Meeting Notes</h2>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Jot down your agenda, questions to ask, points to emphasize, materials to bring..."
                rows={6}
                className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none resize-y"
                style={{ background: 'var(--surface-1)', color: 'var(--text-secondary)' }}/></section>

            {/* ============ QUICK LINKS (no-print) ============ */}
            <div className="flex flex-wrap gap-2 no-print">
              <QuickLink href={`/investors/${investor.id}`} icon={<ExternalLink className="w-3 h-3" />} label="Investor Detail" />
              <QuickLink href="/meetings/new" icon={<Calendar className="w-3 h-3" />} label="Log New Meeting" />
              <QuickLink href="/intelligence" icon={<BookOpen className="w-3 h-3" />} label="Intelligence Hub" /></div></div>
        )}</div>
    </>);
}

// ---------- small components ----------

function GenerateBriefButton({ generating, onClick }: { generating: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={generating}
      className="no-print px-4 py-2 rounded-lg text-sm font-normal transition-colors flex items-center gap-2 disabled:opacity-50"
      style={{
        background: hovered ? 'var(--accent)' : 'var(--accent)',
        color: 'var(--surface-0)', }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      {generating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Sparkles className="w-4 h-4" />
      )}
      {generating ? 'Generating...' : 'Generate Brief'}
    </button>);
}

function PrintButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      className="no-print px-4 py-2 rounded-lg text-sm font-normal transition-colors flex items-center gap-2"
      style={{
        background: hovered ? 'var(--surface-3)' : 'var(--surface-2)',
        color: 'var(--text-primary)', }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <Printer className="w-4 h-4" />
      Print
    </button>);
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
      style={{
        background: hovered ? 'var(--surface-3)' : 'var(--surface-2)',
        color: 'var(--text-secondary)', }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      {icon} {label}
    </Link>);
}

function MeetingCard({ meeting: m, objs }: { meeting: Meeting; objs: Objection[] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="rounded-lg p-4 transition-colors"
      style={{
        border: `1px solid ${hovered ? 'var(--border-strong)' : 'var(--border-subtle)'}`, }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-normal" style={stTextSecondary}>{fmtDate(m.date)}</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ ...stSurface2, ...stTextTertiary }}>
              {meetingTypeLabel(m.type)}</span>
            {m.duration_minutes > 0 && (
              <span className="text-xs" style={stTextMuted}>{m.duration_minutes}min</span>
            )}
            {m.attendees && (
              <span className="text-xs" style={stTextMuted}>{m.attendees}</span>
            )}</div></div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-0.5" title={`Enthusiasm: ${m.enthusiasm_score}/5`}>
            {[1,2,3,4,5].map(n => (
              <div key={n} className="w-2 h-2 rounded-full" style={{ background: n <= m.enthusiasm_score ? 'var(--accent)' : 'var(--surface-2)' }}
                />
            ))}</div>
          <span className="text-xs px-2 py-0.5 rounded" style={
            m.status_after === 'engaged' ? { background: 'var(--accent-muted)', color: 'var(--accent)' } :
            m.status_after === 'in_dd' ? { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' } :
            m.status_after === 'term_sheet' ? { background: 'var(--success-muted)', color: 'var(--text-secondary)' } :
            m.status_after === 'passed' ? { background: 'var(--danger-muted)', color: 'var(--text-primary)' } :
            { background: 'var(--surface-2)', color: 'var(--text-tertiary)' }
          }>{STATUS_LABELS[m.status_after] || m.status_after}</span></div></div>

      {m.ai_analysis && (
        <p className="text-xs mt-2 line-clamp-2" style={stTextTertiary}>{m.ai_analysis}</p>
      )}

      {objs.length > 0 && (
        <div className="mt-2">
          <span className="text-xs font-normal" style={stTextMuted}>Objections: </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {objs.map((o, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded" style={
                o.severity === 'showstopper' ? { background: 'var(--danger-muted)', color: 'var(--text-primary)' } :
                o.severity === 'significant' ? { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' } :
                { background: 'var(--surface-2)', color: 'var(--text-muted)' }
              }>
                {o.text.length > 60 ? o.text.slice(0, 60) + '...' : o.text}
                {o.response_effectiveness === 'resolved' ? ' [resolved]' : ''}</span>
            ))}</div></div>
      )}

      {m.next_steps && (
        <div className="mt-2">
          <span className="text-xs font-normal" style={stTextMuted}>Next Steps: </span>
          <span className="text-xs" style={stTextTertiary}>{m.next_steps}</span></div>
      )}
    </div>);
}

function ProfileField({ label, value, bold, badge, badgeStyle }: {
  label: string;
  value: string;
  bold?: boolean;
  badge?: boolean;
  badgeStyle?: React.CSSProperties;
}) {
  return (
    <div>
      <span className="text-xs block mb-0.5" style={stTextMuted}>{label}</span>
      {badge ? (
        <span className="text-xs font-normal px-2 py-0.5 rounded" style={badgeStyle || { background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>
          {value}</span>
      ) : (
        <span className="text-sm" style={bold ? { fontWeight: 400, color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}>{value}</span>
      )}
    </div>);
}

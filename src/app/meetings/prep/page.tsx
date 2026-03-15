'use client';

import { useEffect, useState, useMemo, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users, Calendar, AlertTriangle, CheckCircle, MessageSquare,
  ChevronDown, Printer, Target, Shield, Clock,
  TrendingUp, Star, FileText, Loader2, BookOpen, Building2,
  ArrowLeft, Zap, CircleDot, ExternalLink, Sparkles,
  ListChecks, MessageCircleQuestion, FolderOpen, ChevronRight,
} from 'lucide-react';
import type {
  Investor, Meeting, Task, Objection, EngagementSignal,
  IntelligenceBrief, InvestorPartner, InvestorPortfolioCo,
} from '@/lib/types';
import { useToast } from '@/components/toast';

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
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function meetingTypeLabel(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const STATUS_LABELS: Record<string, string> = {
  identified: 'Identified', contacted: 'Contacted', nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Set', met: 'Met', engaged: 'Engaged',
  in_dd: 'In DD', term_sheet: 'Term Sheet', closed: 'Closed',
  passed: 'Passed', dropped: 'Dropped',
};

const TYPE_LABELS: Record<string, string> = {
  vc: 'VC', growth: 'Growth Equity', sovereign: 'Sovereign Wealth',
  strategic: 'Strategic', debt: 'Debt Provider', family_office: 'Family Office',
};

const SPEED_STYLE: Record<string, React.CSSProperties> = {
  fast: { color: 'var(--text-secondary)' },
  medium: { color: 'var(--text-tertiary)' },
  slow: { color: 'var(--text-primary)' },
};

// ---------- main page ----------

export default function MeetingPrepPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><div className="h-8 w-48 skeleton animate-pulse" style={{ borderRadius: 'var(--radius-md)' }} /></div>}>
      <MeetingPrepContent />
    </Suspense>
  );
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
      toast('Failed to load prep data', 'error');
      setLoadingPrep(false);
    });
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
        body: JSON.stringify({ investor_id: selectedId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate brief');
      }
      const brief: MeetingBrief = await res.json();
      setMeetingBrief(brief);
      setBriefExpanded(true);
      toast('Meeting brief generated');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to generate brief', 'error');
    } finally {
      setGeneratingBrief(false);
    }
  }, [selectedId, toast]);

  // ---- derived intelligence ----
  const allObjections = useMemo(() => {
    const out: (Objection & { meetingDate: string })[] = [];
    meetings.forEach(m => {
      const objs = safeJsonParse<Objection[]>(m.objections, []);
      objs.forEach(o => out.push({ ...o, meetingDate: m.date }));
    });
    return out;
  }, [meetings]);

  const unresolvedObjections = useMemo(
    () => allObjections.filter(o => o.response_effectiveness !== 'resolved'),
    [allObjections],
  );

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
    [portfolio],
  );

  const pendingTasks = useMemo(
    () => tasks.filter(t => t.status === 'pending' || t.status === 'in_progress'),
    [tasks],
  );

  // ---- talking points generation ----
  const talkingPoints = useMemo(() => {
    const points: { category: string; text: string; priority: 'high' | 'medium' | 'low' }[] = [];

    if (latestMeeting?.next_steps) {
      points.push({
        category: 'Follow-up',
        text: `Address next steps from ${formatDate(latestMeeting.date)}: ${latestMeeting.next_steps}`,
        priority: 'high',
      });
    }

    unresolvedObjections.forEach(o => {
      points.push({
        category: 'Objection to preempt',
        text: `${o.text}${o.severity === 'showstopper' ? ' (SHOWSTOPPER)' : o.severity === 'significant' ? ' (significant)' : ''}`,
        priority: o.severity === 'showstopper' ? 'high' : o.severity === 'significant' ? 'high' : 'medium',
      });
    });

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
          priority: 'medium',
        });
      }
      if (engagementSignals.slides_that_fell_flat?.length > 0) {
        points.push({
          category: 'Improve delivery',
          text: `Topics that fell flat previously: ${engagementSignals.slides_that_fell_flat.join(', ')} — rework these.`,
          priority: 'medium',
        });
      }
      if (engagementSignals.mentioned_competitors) {
        points.push({ category: 'Competitive intel', text: 'They mentioned competitors — prepare differentiation talking points.', priority: 'high' });
      }
    }

    if (portfolioConflicts.length > 0) {
      points.push({
        category: 'Risk',
        text: `Portfolio conflict with: ${portfolioConflicts.map(c => c.company).join(', ')} — be prepared to address overlap.`,
        priority: 'high',
      });
    }

    if (pendingTasks.length > 0) {
      points.push({
        category: 'Open items',
        text: `${pendingTasks.length} open tasks for this investor — ensure all deliverables are ready.`,
        priority: 'medium',
      });
    }

    if (enthusiasmTrend === 'declining') {
      points.push({
        category: 'Warning',
        text: 'Enthusiasm has been declining across meetings. Focus on re-engagement and new data points.',
        priority: 'high',
      });
    } else if (enthusiasmTrend === 'rising') {
      points.push({
        category: 'Momentum',
        text: 'Enthusiasm trend is positive. Push for next milestone (DD access, term sheet discussion).',
        priority: 'medium',
      });
    }

    if (investor?.ic_process) {
      points.push({
        category: 'Process',
        text: `IC process: ${investor.ic_process}. Understand where we are in their pipeline.`,
        priority: 'low',
      });
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
      <div className="space-y-6">
        <div className="h-8 w-56 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
        <div className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
          ))}
        </div>
      </div>
    );
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
            <Link href="/meetings" className="transition-colors no-print" style={{ color: 'var(--text-muted)' }}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="page-title">Meeting Prep</h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>AI-generated brief with talking points, objections to preempt, and data room priorities</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {investor && (
              <>
                <GenerateBriefButton generating={generatingBrief} onClick={generateBrief} />
                <PrintButton onClick={handlePrint} />
              </>
            )}
          </div>
        </div>

        {/* Investor selector */}
        <div className="no-print">
          <label className="text-xs block mb-1.5 font-normal  tracking-wider" style={{ color: 'var(--text-muted)' }}>Select Investor</label>
          <div className="relative">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full md:w-96 rounded-lg px-4 py-2.5 text-sm focus:outline-none appearance-none cursor-pointer pr-10"
              style={{
                background: 'var(--surface-1)',
                color: 'var(--text-secondary)',
              }}
            >
              <option value="">Select investor for this meeting...</option>
              {investors.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.name} -- {TYPE_LABELS[inv.type] || inv.type} (T{inv.tier})
                </option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
              <ChevronDown className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* No investor selected — smart suggestions */}
        {!selectedId && !loading && investors.length > 0 && (() => {
          // Prioritize: active investors sorted by tier then enthusiasm descending
          const active = investors.filter(i =>
            !['passed', 'dropped', 'closed', 'identified'].includes(i.status)
          );
          const byPriority = [...active].sort((a, b) => {
            if (a.tier !== b.tier) return a.tier - b.tier;
            return (b.enthusiasm ?? 0) - (a.enthusiasm ?? 0);
          });
          const suggested = byPriority.slice(0, 6);

          return (
            <div className="space-y-4">
              <div
                className="rounded-xl p-6"
                style={{ background: 'var(--surface-1)' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  <h3 className="text-sm font-normal" style={{ color: 'var(--text-primary)' }}>
                    Who are you meeting?
                  </h3>
                </div>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
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
                        style={{
                          background: 'var(--surface-0)',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'var(--accent-muted)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'var(--surface-0)';
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-normal"
                          style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
                        >
                          T{inv.tier}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-normal truncate" style={{ color: 'var(--text-primary)' }}>
                            {inv.name}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{statusLabel}</span>
                            {(inv.enthusiasm ?? 0) > 0 && (
                              <span className="flex gap-0.5">
                                {[1,2,3,4,5].map(n => (
                                  <span
                                    key={n}
                                    className="w-1.5 h-1.5 rounded-full inline-block"
                                    style={{ background: n <= (inv.enthusiasm ?? 0) ? 'var(--accent)' : 'var(--surface-3)' }}
                                  />
                                ))}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                      </button>
                    );
                  })}
                </div>
                {active.length > 6 && (
                  <p className="text-xs mt-3 text-center" style={{ color: 'var(--text-muted)' }}>
                    + {active.length - 6} more in pipeline — use the dropdown above to search
                  </p>
                )}
              </div>
            </div>
          );
        })()}
        {!selectedId && !loading && investors.length === 0 && (
          <div className="rounded-xl p-12 text-center">
            <Users className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--surface-3)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No investors in pipeline yet.</p>
          </div>
        )}

        {/* Loading prep data */}
        {selectedId && loadingPrep && (
          <div className="rounded-xl p-12 text-center">
            <span className="block mx-auto mb-3 w-8 h-8" style={{ color: 'var(--accent)' }}>
              <Loader2 className="w-8 h-8 animate-spin" />
            </span>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading meeting history, objections, and tasks...</p>
          </div>
        )}

        {/* Prep content */}
        {investor && !loadingPrep && (
          <div className="space-y-5">

            {/* ============ CUSTOMIZED MEETING BRIEF (AI-generated) ============ */}
            {meetingBrief && (
              <section className="rounded-xl print-card overflow-hidden" style={{ border: '1px solid var(--accent)', background: 'var(--accent-muted)' }}>
                <button
                  onClick={() => setBriefExpanded(!briefExpanded)}
                  className="w-full p-5 flex items-center justify-between no-print"
                >
                  <h2 className="text-sm font-normal  tracking-wider flex items-center gap-2 print-section-title" style={{ color: 'var(--accent)' }}>
                    <Sparkles className="w-4 h-4" />
                    Customized Brief for {investor.name} ({TYPE_LABELS[investor.type] || investor.type})
                  </h2>
                  <span style={{ color: 'var(--accent)' }}>
                    <ChevronRight className={`w-4 h-4 transition-transform ${briefExpanded ? 'rotate-90' : ''}`} />
                  </span>
                </button>
                {/* Print-only static header */}
                <div className="hidden print:block p-5 pb-0">
                  <h2 className="text-sm font-normal  tracking-wider flex items-center gap-2 print-section-title">
                    Customized Brief for {investor.name} ({TYPE_LABELS[investor.type] || investor.type})
                  </h2>
                </div>

                {briefExpanded && (
                  <div className="px-5 pb-5 space-y-5">
                    {/* Opening Hook */}
                    <div>
                      <h3 className="text-xs font-normal  tracking-wider mb-2" style={{ color: 'var(--accent)' }}>Opening</h3>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{meetingBrief.brief.personalized_opening}</p>
                    </div>

                    {/* Narrative Profile */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-xs font-normal  tracking-wider mb-2" style={{ color: 'var(--accent)' }}>Emphasize</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {meetingBrief.narrative_profile.emphasis.map((e, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-md" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>{e}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xs font-normal  tracking-wider mb-2" style={{ color: 'var(--text-primary)' }}>Avoid</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {meetingBrief.narrative_profile.avoid_topics.map((t, i) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-md" style={{ background: 'var(--danger-muted)', color: 'var(--text-primary)' }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Key Talking Points */}
                    <div>
                      <h3 className="text-xs font-normal  tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                        <ListChecks className="w-3.5 h-3.5" />
                        Key Talking Points
                      </h3>
                      <div className="space-y-2">
                        {meetingBrief.brief.key_talking_points.map((point, i) => (
                          <div key={i} className="flex items-start gap-2.5 text-sm">
                            <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                            <span style={{ color: 'var(--text-secondary)' }}>{point}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Key Metrics */}
                    {meetingBrief.brief.metrics_to_highlight.length > 0 && (
                      <div>
                        <h3 className="text-xs font-normal  tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                          <Target className="w-3.5 h-3.5" />
                          Key Metrics
                        </h3>
                        <div className="rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-subtle)' }}>
                              <tr>
                                <th className="text-left px-3 py-2 font-normal" style={{ color: 'var(--text-muted)' }}>Metric</th>
                                <th className="text-left px-3 py-2 font-normal" style={{ color: 'var(--text-muted)' }}>Value</th>
                                <th className="text-left px-3 py-2 font-normal" style={{ color: 'var(--text-muted)' }}>Why It Matters</th>
                              </tr>
                            </thead>
                            <tbody>
                              {meetingBrief.brief.metrics_to_highlight.map((m, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                  <td className="px-3 py-2 font-normal" style={{ color: 'var(--text-secondary)' }}>{m.metric}</td>
                                  <td className="px-3 py-2 font-mono" style={{ color: 'var(--accent)' }}>{m.value}</td>
                                  <td className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>{m.why}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Anticipated Questions with Answers */}
                    {meetingBrief.brief.anticipated_questions_with_answers.length > 0 && (
                      <div>
                        <h3 className="text-xs font-normal  tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                          <MessageCircleQuestion className="w-3.5 h-3.5" />
                          Anticipated Questions + Suggested Answers
                        </h3>
                        <div className="space-y-3">
                          {meetingBrief.brief.anticipated_questions_with_answers.map((qa, i) => (
                            <div key={i} className="rounded-lg p-3">
                              <p className="text-sm font-normal mb-1.5" style={{ color: 'var(--text-secondary)' }}>Q: {qa.question}</p>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>A: {qa.suggested_answer}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Data Room Priority */}
                    {meetingBrief.data_room_priority.length > 0 && (
                      <div>
                        <h3 className="text-xs font-normal  tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                          <FolderOpen className="w-3.5 h-3.5" />
                          Data Room Priority
                        </h3>
                        <div className="space-y-1.5">
                          {meetingBrief.data_room_priority.map((dr, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span className="text-xs font-mono w-4" style={{ color: 'var(--text-muted)' }}>{i + 1}.</span>
                              <span style={{ color: 'var(--text-secondary)' }}>{dr.category}</span>
                              {dr.documents.length > 0 && (
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                  ({dr.documents.map(d => d.title).join(', ')})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Previous Meeting + Unresolved Items */}
                    {meetingBrief.brief.previous_meeting_summary && (
                      <div className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <h3 className="text-xs font-normal  tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Previous Meeting</h3>
                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{meetingBrief.brief.previous_meeting_summary}</p>
                      </div>
                    )}

                    {meetingBrief.brief.unresolved_items.length > 0 && (
                      <div>
                        <h3 className="text-xs font-normal  tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Unresolved Items</h3>
                        <div className="space-y-1.5">
                          {meetingBrief.brief.unresolved_items.map((item, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <span className="shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </span>
                              <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Risks to Watch */}
                    {meetingBrief.brief.risks_to_watch.length > 0 && (
                      <div>
                        <h3 className="text-xs font-normal  tracking-wider mb-2" style={{ color: 'var(--text-primary)' }}>Risks to Watch</h3>
                        <div className="space-y-1.5">
                          {meetingBrief.brief.risks_to_watch.map((risk, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <span className="shrink-0 mt-0.5" style={{ color: 'var(--text-primary)' }}>
                                <Shield className="w-3.5 h-3.5" />
                              </span>
                              <span style={{ color: 'var(--text-tertiary)' }}>{risk}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommended Ask */}
                    <div className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <h3 className="text-xs font-normal  tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Recommended Ask</h3>
                      <p className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>{meetingBrief.brief.recommended_ask}</p>
                    </div>

                    {/* Playbook Insights */}
                    {meetingBrief.playbook_insights.length > 0 && (
                      <div className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <h3 className="text-xs font-normal  tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Playbook Insights</h3>
                        <div className="space-y-2">
                          {meetingBrief.playbook_insights.map((pi, i) => (
                            <div key={i} className="text-sm">
                              <span className="text-xs px-1.5 py-0.5 rounded mr-2" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                                {pi.topic} ({pi.count}x)
                              </span>
                              {pi.bestResponse && (
                                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Best response: {pi.bestResponse}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tone Guidance */}
                    <div className="pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <h3 className="text-xs font-normal  tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Tone Guidance</h3>
                      <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>{meetingBrief.narrative_profile.tone_guidance}</p>
                    </div>

                    <div className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>
                      Generated {new Date(meetingBrief.generated_at).toLocaleString('en-GB')}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ============ INVESTOR PROFILE ============ */}
            <section className="rounded-xl p-5 print-card">
              <h2 className="text-sm font-normal  tracking-wider mb-4 flex items-center gap-2 print-section-title" style={{ color: 'var(--text-tertiary)' }}>
                <span style={{ color: 'var(--accent)' }}><Building2 className="w-4 h-4" /></span>
                Investor Profile
              </h2>
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
                  <span className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>Enthusiasm</span>
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <div key={n} className="w-2.5 h-2.5 rounded-full" style={{ background: n <= investor.enthusiasm ? 'var(--accent)' : 'var(--surface-2)' }} />
                      ))}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{investor.enthusiasm}/5</span>
                  </div>
                </div>
                <ProfileField label="IC Process" value={investor.ic_process || '—'} />
                <div>
                  <span className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>Speed</span>
                  <span className="text-sm font-normal capitalize" style={SPEED_STYLE[investor.speed] || { color: 'var(--text-tertiary)' }}>
                    {investor.speed || '—'}
                  </span>
                </div>
              </div>
              {investor.sector_thesis && (
                <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Sector Thesis: </span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{investor.sector_thesis}</span>
                </div>
              )}
              {investor.warm_path && (
                <div className="mt-2">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Warm Path: </span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{investor.warm_path}</span>
                </div>
              )}
              {investor.portfolio_conflicts && (
                <div className="mt-2">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Portfolio Conflicts: </span>
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{investor.portfolio_conflicts}</span>
                </div>
              )}
              {investor.notes && (
                <div className="mt-2">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Notes: </span>
                  <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{investor.notes}</span>
                </div>
              )}
            </section>

            {/* ============ SUGGESTED TALKING POINTS ============ */}
            {talkingPoints.length > 0 && (
              <section className="rounded-xl p-5 print-card">
                <h2 className="text-sm font-normal  tracking-wider mb-4 flex items-center gap-2 print-section-title" style={{ color: 'var(--text-tertiary)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}><Zap className="w-4 h-4" /></span>
                  Suggested Talking Points
                </h2>
                <div className="space-y-2.5">
                  {talkingPoints
                    .sort((a, b) => {
                      const order = { high: 0, medium: 1, low: 2 };
                      return order[a.priority] - order[b.priority];
                    })
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
                        <span style={{ color: 'var(--text-secondary)' }}>{tp.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ============ KEY RISKS ============ */}
            {(portfolioConflicts.length > 0 || unresolvedObjections.length > 0 || investor.portfolio_conflicts || enthusiasmTrend === 'declining') && (
              <section className="rounded-xl p-5 print-card" style={{ background: 'var(--danger-muted)' }}>
                <h2 className="text-sm font-normal  tracking-wider mb-4 flex items-center gap-2 print-section-title" style={{ color: 'var(--text-primary)' }}>
                  <AlertTriangle className="w-4 h-4" />
                  Key Risks to Address
                </h2>
                <div className="space-y-3">
                  {investor.portfolio_conflicts && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="shrink-0 mt-0.5" style={{ color: 'var(--text-primary)' }}>
                        <Shield className="w-4 h-4" />
                      </span>
                      <div>
                        <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>Portfolio Conflict: </span>
                        <span style={{ color: 'var(--text-tertiary)' }}>{investor.portfolio_conflicts}</span>
                      </div>
                    </div>
                  )}
                  {portfolioConflicts.map((pc, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        <Shield className="w-4 h-4" />
                      </span>
                      <div>
                        <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>Portfolio company overlap: </span>
                        <span style={{ color: 'var(--text-tertiary)' }}>{pc.company} ({pc.sector}) -- {pc.relevance}</span>
                      </div>
                    </div>
                  ))}
                  {unresolvedObjections.map((o, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="shrink-0 mt-0.5" style={{
                        color: o.severity === 'showstopper' ? 'var(--danger)' :
                          o.severity === 'significant' ? 'var(--warning)' :
                          'var(--text-muted)',
                      }}>
                        <CircleDot className="w-4 h-4" />
                      </span>
                      <div>
                        <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>
                          {o.response_effectiveness === 'partial' ? 'Partially addressed' : 'Unresolved'} objection
                          {o.severity === 'showstopper' ? ' (SHOWSTOPPER)' : ''}:
                        </span>{' '}
                        <span style={{ color: 'var(--text-tertiary)' }}>{o.text}</span>
                        <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>from {formatDate(o.meetingDate)}</span>
                      </div>
                    </div>
                  ))}
                  {enthusiasmTrend === 'declining' && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="shrink-0 mt-0.5 rotate-180" style={{ color: 'var(--text-primary)' }}>
                        <TrendingUp className="w-4 h-4" />
                      </span>
                      <div>
                        <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>Declining enthusiasm: </span>
                        <span style={{ color: 'var(--text-tertiary)' }}>
                          Enthusiasm score has dropped across meetings. Identify what changed and counter it.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ============ MEETING HISTORY ============ */}
            <section className="rounded-xl p-5 print-card">
              <h2 className="text-sm font-normal  tracking-wider mb-4 flex items-center gap-2 print-section-title" style={{ color: 'var(--text-tertiary)' }}>
                <span style={{ color: 'var(--accent)' }}><Calendar className="w-4 h-4" /></span>
                Meeting History
                <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>({meetings.length} meetings)</span>
              </h2>
              {meetings.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No previous meetings recorded with this investor.</p>
              ) : (
                <div className="space-y-3">
                  {meetings.map(m => {
                    const objs = safeJsonParse<Objection[]>(m.objections, []);
                    return (
                      <MeetingCard key={m.id} meeting={m} objs={objs} />
                    );
                  })}
                </div>
              )}
            </section>

            {/* ============ INTELLIGENCE ============ */}
            {(briefs.length > 0 || partners.length > 0 || portfolio.length > 0) && (
              <section className="rounded-xl p-5 print-card">
                <h2 className="text-sm font-normal  tracking-wider mb-4 flex items-center gap-2 print-section-title" style={{ color: 'var(--text-tertiary)' }}>
                  <span style={{ color: 'var(--accent)' }}><BookOpen className="w-4 h-4" /></span>
                  Intelligence
                </h2>

                {/* Research briefs */}
                {briefs.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-normal  tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Research Briefs</h3>
                    <div className="space-y-2">
                      {briefs.map(b => (
                        <details key={b.id} className="group rounded-lg overflow-hidden">
                          <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm">
                            <span className="text-xs px-1.5 py-0.5 rounded font-normal" style={
                              b.brief_type === 'investor' ? { background: 'var(--accent-muted)', color: 'var(--accent)' } :
                              b.brief_type === 'competitor' ? { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' } :
                              { background: 'var(--surface-2)', color: 'var(--text-tertiary)' }
                            }>{b.brief_type}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{b.subject}</span>
                            <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>{b.updated_at?.split('T')[0]}</span>
                          </summary>
                          <div className="px-3 pb-3 text-xs whitespace-pre-wrap leading-relaxed pt-2" style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)' }}>
                            {b.content}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}

                {/* Partner profiles */}
                {partners.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-normal  tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Partner Profiles</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {partners.map(p => (
                        <div key={p.id} className="rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span style={{ color: 'var(--text-muted)' }}><Users className="w-3.5 h-3.5" /></span>
                            <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
                          </div>
                          {p.title && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.title}</p>}
                          {p.focus_areas && <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Focus: {p.focus_areas}</p>}
                          {p.notable_deals && <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Deals: {p.notable_deals}</p>}
                          {p.relevance_to_us && <p className="text-xs mt-0.5" style={{ color: 'var(--accent)' }}>{p.relevance_to_us}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Portfolio companies */}
                {portfolio.length > 0 && (
                  <div>
                    <h3 className="text-xs font-normal  tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Portfolio Companies</h3>
                    <div className="rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-subtle)' }}>
                          <tr>
                            <th className="text-left px-3 py-2 font-normal" style={{ color: 'var(--text-muted)' }}>Company</th>
                            <th className="text-left px-3 py-2 font-normal" style={{ color: 'var(--text-muted)' }}>Sector</th>
                            <th className="text-left px-3 py-2 font-normal" style={{ color: 'var(--text-muted)' }}>Stage</th>
                            <th className="text-left px-3 py-2 font-normal" style={{ color: 'var(--text-muted)' }}>Relevance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {portfolio.map(pc => (
                            <tr key={pc.id} style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              background: pc.relevance?.toLowerCase().includes('conflict') ? 'var(--danger-muted)' : undefined,
                            }}>
                              <td className="px-3 py-2 font-normal" style={{ color: 'var(--text-secondary)' }}>{pc.company}</td>
                              <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{pc.sector}</td>
                              <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{pc.stage_invested}</td>
                              <td className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>{pc.relevance || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ============ OPEN TASKS ============ */}
            <section className="rounded-xl p-5 print-card">
              <h2 className="text-sm font-normal  tracking-wider mb-4 flex items-center gap-2 print-section-title" style={{ color: 'var(--text-tertiary)' }}>
                <span style={{ color: 'var(--text-secondary)' }}><CheckCircle className="w-4 h-4" /></span>
                Open Tasks
                <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>
                  ({pendingTasks.length} pending)
                </span>
              </h2>
              {pendingTasks.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No pending tasks for this investor.</p>
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
                          <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>{t.title}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded" style={
                            t.status === 'in_progress' ? { background: 'var(--accent-muted)', color: 'var(--accent)' } : { background: 'var(--surface-2)', color: 'var(--text-muted)' }
                          }>{t.status === 'in_progress' ? 'In Progress' : 'Pending'}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded" style={
                            t.priority === 'critical' ? { background: 'var(--danger-muted)', color: 'var(--text-primary)' } :
                            t.priority === 'high' ? { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' } :
                            { background: 'var(--surface-2)', color: 'var(--text-muted)' }
                          }>{t.priority}</span>
                        </div>
                        {t.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.description}</p>}
                        <div className="flex gap-3 text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          {t.due_date && (
                            <span className="flex items-center gap-1" style={{
                              color: new Date(t.due_date) < new Date() ? 'var(--danger)' : undefined,
                            }}>
                              <Clock className="w-3 h-3" />
                              {formatDate(t.due_date)}
                              {new Date(t.due_date) < new Date() && ' (overdue)'}
                            </span>
                          )}
                          {t.assignee && <span>{t.assignee}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ============ PRE-MEETING NOTES ============ */}
            <section className="rounded-xl p-5 print-card">
              <h2 className="text-sm font-normal  tracking-wider mb-4 flex items-center gap-2 print-section-title" style={{ color: 'var(--text-tertiary)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}><MessageSquare className="w-4 h-4" /></span>
                Pre-Meeting Notes
              </h2>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Jot down your agenda, questions to ask, points to emphasize, materials to bring..."
                rows={6}
                className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none resize-y"
                style={{
                  background: 'var(--surface-1)',
                  color: 'var(--text-secondary)',
                }}
              />
            </section>

            {/* ============ QUICK LINKS (no-print) ============ */}
            <div className="flex flex-wrap gap-2 no-print">
              <QuickLink href={`/investors/${investor.id}`} icon={<ExternalLink className="w-3 h-3" />} label="Investor Detail" />
              <QuickLink href="/meetings/new" icon={<Calendar className="w-3 h-3" />} label="Log New Meeting" />
              <QuickLink href="/intelligence" icon={<BookOpen className="w-3 h-3" />} label="Intelligence Hub" />
            </div>
          </div>
        )}
      </div>
    </>
  );
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
        color: 'var(--surface-0)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {generating ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Sparkles className="w-4 h-4" />
      )}
      {generating ? 'Generating...' : 'Generate Brief'}
    </button>
  );
}

function PrintButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      className="no-print px-4 py-2 rounded-lg text-sm font-normal transition-colors flex items-center gap-2"
      style={{
        background: hovered ? 'var(--surface-3)' : 'var(--surface-2)',
        color: 'var(--text-primary)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Printer className="w-4 h-4" />
      Print
    </button>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
      style={{
        background: hovered ? 'var(--surface-3)' : 'var(--surface-2)',
        color: 'var(--text-secondary)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {icon} {label}
    </Link>
  );
}

function MeetingCard({ meeting: m, objs }: { meeting: Meeting; objs: Objection[] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="rounded-lg p-4 transition-colors"
      style={{
        border: `1px solid ${hovered ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>{formatDate(m.date)}</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>
              {meetingTypeLabel(m.type)}
            </span>
            {m.duration_minutes > 0 && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.duration_minutes}min</span>
            )}
            {m.attendees && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.attendees}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-0.5" title={`Enthusiasm: ${m.enthusiasm_score}/5`}>
            {[1,2,3,4,5].map(n => (
              <div key={n} className="w-2 h-2 rounded-full" style={{ background: n <= m.enthusiasm_score ? 'var(--accent)' : 'var(--surface-2)' }} />
            ))}
          </div>
          <span className="text-xs px-2 py-0.5 rounded" style={
            m.status_after === 'engaged' ? { background: 'var(--accent-muted)', color: 'var(--accent)' } :
            m.status_after === 'in_dd' ? { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' } :
            m.status_after === 'term_sheet' ? { background: 'var(--success-muted)', color: 'var(--text-secondary)' } :
            m.status_after === 'passed' ? { background: 'var(--danger-muted)', color: 'var(--text-primary)' } :
            { background: 'var(--surface-2)', color: 'var(--text-tertiary)' }
          }>{STATUS_LABELS[m.status_after] || m.status_after}</span>
        </div>
      </div>

      {m.ai_analysis && (
        <p className="text-xs mt-2 line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>{m.ai_analysis}</p>
      )}

      {objs.length > 0 && (
        <div className="mt-2">
          <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Objections: </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {objs.map((o, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded" style={
                o.severity === 'showstopper' ? { background: 'var(--danger-muted)', color: 'var(--text-primary)' } :
                o.severity === 'significant' ? { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' } :
                { background: 'var(--surface-2)', color: 'var(--text-muted)' }
              }>
                {o.text.length > 60 ? o.text.slice(0, 60) + '...' : o.text}
                {o.response_effectiveness === 'resolved' ? ' [resolved]' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {m.next_steps && (
        <div className="mt-2">
          <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>Next Steps: </span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{m.next_steps}</span>
        </div>
      )}
    </div>
  );
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
      <span className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {badge ? (
        <span className="text-xs font-normal px-2 py-0.5 rounded" style={badgeStyle || { background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>
          {value}
        </span>
      ) : (
        <span className="text-sm" style={bold ? { fontWeight: 400, color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}>{value}</span>
      )}
    </div>
  );
}

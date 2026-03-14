'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Users, Calendar, AlertTriangle, CheckCircle, MessageSquare,
  ChevronDown, Printer, Briefcase, Target, Shield, Clock,
  TrendingUp, Star, FileText, Loader2, BookOpen, Building2,
  ArrowLeft, Zap, CircleDot, ExternalLink,
} from 'lucide-react';
import type {
  Investor, Meeting, Task, Objection, EngagementSignal,
  IntelligenceBrief, InvestorPartner, InvestorPortfolioCo,
} from '@/lib/types';
import { useToast } from '@/components/toast';

// ---------- helpers ----------

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function formatDate(iso: string): string {
  if (!iso) return '---';
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

const SPEED_COLORS: Record<string, string> = {
  fast: 'text-green-400',
  medium: 'text-yellow-400',
  slow: 'text-red-400',
};

// ---------- main page ----------

export default function MeetingPrepPage() {
  const { toast } = useToast();

  // data state
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [briefs, setBriefs] = useState<IntelligenceBrief[]>([]);
  const [partners, setPartners] = useState<InvestorPartner[]>([]);
  const [portfolio, setPortfolio] = useState<InvestorPortfolioCo[]>([]);

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
      return;
    }

    setLoadingPrep(true);

    Promise.all([
      fetch(`/api/meetings?investor_id=${selectedId}`).then(r => r.json()),
      fetch(`/api/tasks?investor_id=${selectedId}`).then(r => r.json()),
      fetch(`/api/intelligence?type=briefs&investor_id=${selectedId}`).then(r => r.json()),
      fetch(`/api/intelligence?type=partners&investor_id=${selectedId}`).then(r => r.json()),
      fetch(`/api/intelligence?type=portfolio&investor_id=${selectedId}`).then(r => r.json()),
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

  const allNextSteps = useMemo(
    () => meetings.filter(m => m.next_steps).map(m => ({ date: m.date, steps: m.next_steps })),
    [meetings],
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

    // Follow up on previous next steps
    if (latestMeeting?.next_steps) {
      points.push({
        category: 'Follow-up',
        text: `Address next steps from ${formatDate(latestMeeting.date)}: ${latestMeeting.next_steps}`,
        priority: 'high',
      });
    }

    // Preempt unresolved objections
    unresolvedObjections.forEach(o => {
      points.push({
        category: 'Objection to preempt',
        text: `${o.text}${o.severity === 'showstopper' ? ' (SHOWSTOPPER)' : o.severity === 'significant' ? ' (significant)' : ''}`,
        priority: o.severity === 'showstopper' ? 'high' : o.severity === 'significant' ? 'high' : 'medium',
      });
    });

    // Build on excitement signals
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

    // Portfolio conflicts
    if (portfolioConflicts.length > 0) {
      points.push({
        category: 'Risk',
        text: `Portfolio conflict with: ${portfolioConflicts.map(c => c.company).join(', ')} — be prepared to address overlap.`,
        priority: 'high',
      });
    }

    // Pending tasks
    if (pendingTasks.length > 0) {
      points.push({
        category: 'Open items',
        text: `${pendingTasks.length} open tasks for this investor — ensure all deliverables are ready.`,
        priority: 'medium',
      });
    }

    // Enthusiasm trend
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

    // IC process awareness
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
        <div className="h-8 w-56 bg-zinc-800 rounded animate-pulse" />
        <div className="h-12 bg-zinc-800/50 rounded-xl animate-pulse" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-800/30 rounded-xl animate-pulse" />
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
          body { background: white !important; color: black !important; }
          nav, aside, button, .no-print { display: none !important; }
          .print-card { border: 1px solid #ccc !important; break-inside: avoid; page-break-inside: avoid; margin-bottom: 12px; }
          .print-card * { color: black !important; }
          .print-break { page-break-before: always; }
          h1, h2, h3 { color: black !important; }
          .print-bg-white { background: white !important; }
          textarea { border: 1px solid #ccc !important; background: #f9f9f9 !important; color: black !important; }
          .print-section-title { font-size: 14px; font-weight: 700; border-bottom: 2px solid #333; padding-bottom: 4px; margin-bottom: 8px; }
          @page { margin: 1.5cm; }
        }
      `}</style>

      <div ref={printRef} className="space-y-6 print-bg-white">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Link href="/meetings" className="text-zinc-500 hover:text-zinc-300 transition-colors no-print">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Briefcase className="w-6 h-6 text-blue-400" />
                Meeting Prep
              </h1>
              <p className="text-zinc-500 text-sm mt-0.5">Prepare for your next investor meeting</p>
            </div>
          </div>
          {investor && (
            <button
              onClick={handlePrint}
              className="no-print px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print Prep Sheet
            </button>
          )}
        </div>

        {/* Investor selector */}
        <div className="no-print">
          <label className="text-xs text-zinc-500 block mb-1.5 font-medium uppercase tracking-wider">Select Investor</label>
          <div className="relative">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full md:w-96 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-600 text-zinc-200 appearance-none cursor-pointer pr-10"
            >
              <option value="">Choose an investor...</option>
              {investors.map(inv => (
                <option key={inv.id} value={inv.id}>
                  {inv.name} — {TYPE_LABELS[inv.type] || inv.type} (T{inv.tier})
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* No investor selected */}
        {!selectedId && (
          <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center">
            <Users className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">Select an investor above to generate a meeting prep sheet.</p>
            <p className="text-zinc-600 text-xs mt-1">{investors.length} investors available</p>
          </div>
        )}

        {/* Loading prep data */}
        {selectedId && loadingPrep && (
          <div className="border border-zinc-800 rounded-xl p-12 text-center">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
            <p className="text-zinc-500 text-sm">Loading prep data...</p>
          </div>
        )}

        {/* Prep content */}
        {investor && !loadingPrep && (
          <div className="space-y-5">

            {/* ============ INVESTOR PROFILE ============ */}
            <section className="border border-zinc-800 rounded-xl p-5 print-card">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2 print-section-title">
                <Building2 className="w-4 h-4 text-blue-400" />
                Investor Profile
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ProfileField label="Name" value={investor.name} bold />
                <ProfileField label="Type" value={TYPE_LABELS[investor.type] || investor.type} />
                <ProfileField label="Tier" value={`Tier ${investor.tier}`} badge badgeColor={
                  investor.tier === 1 ? 'bg-blue-600/20 text-blue-400' :
                  investor.tier === 2 ? 'bg-purple-600/20 text-purple-400' :
                  'bg-zinc-700/50 text-zinc-400'
                } />
                <ProfileField label="Status" value={STATUS_LABELS[investor.status] || investor.status} />
                <ProfileField label="Fund Size" value={investor.fund_size || '---'} />
                <ProfileField label="Check Size" value={investor.check_size_range || '---'} />
                <ProfileField label="Key Partner" value={investor.partner || '---'} />
                <div>
                  <span className="text-xs text-zinc-500 block mb-0.5">Enthusiasm</span>
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <div key={n} className={`w-2.5 h-2.5 rounded-full ${n <= investor.enthusiasm ? 'bg-blue-500' : 'bg-zinc-800'}`} />
                      ))}
                    </div>
                    <span className="text-xs text-zinc-400">{investor.enthusiasm}/5</span>
                  </div>
                </div>
                <ProfileField label="IC Process" value={investor.ic_process || '---'} />
                <div>
                  <span className="text-xs text-zinc-500 block mb-0.5">Speed</span>
                  <span className={`text-sm font-medium capitalize ${SPEED_COLORS[investor.speed] || 'text-zinc-400'}`}>
                    {investor.speed || '---'}
                  </span>
                </div>
              </div>
              {investor.sector_thesis && (
                <div className="mt-4 pt-3 border-t border-zinc-800/50">
                  <span className="text-xs text-zinc-500">Sector Thesis: </span>
                  <span className="text-sm text-zinc-300">{investor.sector_thesis}</span>
                </div>
              )}
              {investor.warm_path && (
                <div className="mt-2">
                  <span className="text-xs text-zinc-500">Warm Path: </span>
                  <span className="text-sm text-zinc-300">{investor.warm_path}</span>
                </div>
              )}
              {investor.portfolio_conflicts && (
                <div className="mt-2">
                  <span className="text-xs text-zinc-500">Portfolio Conflicts: </span>
                  <span className="text-sm text-red-400">{investor.portfolio_conflicts}</span>
                </div>
              )}
              {investor.notes && (
                <div className="mt-2">
                  <span className="text-xs text-zinc-500">Notes: </span>
                  <span className="text-sm text-zinc-400">{investor.notes}</span>
                </div>
              )}
            </section>

            {/* ============ SUGGESTED TALKING POINTS ============ */}
            {talkingPoints.length > 0 && (
              <section className="border border-zinc-800 rounded-xl p-5 print-card">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2 print-section-title">
                  <Zap className="w-4 h-4 text-yellow-400" />
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
                      <span className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${
                        tp.priority === 'high' ? 'bg-red-500' :
                        tp.priority === 'medium' ? 'bg-yellow-500' :
                        'bg-zinc-600'
                      }`} />
                      <div className="flex-1">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded mr-2 ${
                          tp.category === 'Follow-up' ? 'bg-blue-900/30 text-blue-400' :
                          tp.category === 'Objection to preempt' ? 'bg-red-900/30 text-red-400' :
                          tp.category === 'Positive signal' ? 'bg-green-900/30 text-green-400' :
                          tp.category === 'Build on strength' ? 'bg-emerald-900/30 text-emerald-400' :
                          tp.category === 'Improve delivery' ? 'bg-orange-900/30 text-orange-400' :
                          tp.category === 'Competitive intel' ? 'bg-purple-900/30 text-purple-400' :
                          tp.category === 'Risk' ? 'bg-red-900/30 text-red-400' :
                          tp.category === 'Warning' ? 'bg-red-900/30 text-red-400' :
                          tp.category === 'Momentum' ? 'bg-green-900/30 text-green-400' :
                          'bg-zinc-800 text-zinc-400'
                        }`}>{tp.category}</span>
                        <span className="text-zinc-300">{tp.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ============ KEY RISKS ============ */}
            {(portfolioConflicts.length > 0 || unresolvedObjections.length > 0 || investor.portfolio_conflicts || enthusiasmTrend === 'declining') && (
              <section className="border border-red-900/30 rounded-xl p-5 bg-red-950/10 print-card">
                <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2 print-section-title">
                  <AlertTriangle className="w-4 h-4" />
                  Key Risks to Address
                </h2>
                <div className="space-y-3">
                  {investor.portfolio_conflicts && (
                    <div className="flex items-start gap-2 text-sm">
                      <Shield className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-zinc-300 font-medium">Portfolio Conflict: </span>
                        <span className="text-zinc-400">{investor.portfolio_conflicts}</span>
                      </div>
                    </div>
                  )}
                  {portfolioConflicts.map((pc, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <Shield className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-zinc-300 font-medium">Portfolio company overlap: </span>
                        <span className="text-zinc-400">{pc.company} ({pc.sector}) — {pc.relevance}</span>
                      </div>
                    </div>
                  ))}
                  {unresolvedObjections.map((o, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CircleDot className={`w-4 h-4 shrink-0 mt-0.5 ${
                        o.severity === 'showstopper' ? 'text-red-400' :
                        o.severity === 'significant' ? 'text-yellow-400' :
                        'text-zinc-500'
                      }`} />
                      <div>
                        <span className="text-zinc-300 font-medium">
                          {o.response_effectiveness === 'partial' ? 'Partially addressed' : 'Unresolved'} objection
                          {o.severity === 'showstopper' ? ' (SHOWSTOPPER)' : ''}:
                        </span>{' '}
                        <span className="text-zinc-400">{o.text}</span>
                        <span className="text-xs text-zinc-600 ml-2">from {formatDate(o.meetingDate)}</span>
                      </div>
                    </div>
                  ))}
                  {enthusiasmTrend === 'declining' && (
                    <div className="flex items-start gap-2 text-sm">
                      <TrendingUp className="w-4 h-4 text-red-400 shrink-0 mt-0.5 rotate-180" />
                      <div>
                        <span className="text-zinc-300 font-medium">Declining enthusiasm: </span>
                        <span className="text-zinc-400">
                          Enthusiasm score has dropped across meetings. Identify what changed and counter it.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ============ MEETING HISTORY ============ */}
            <section className="border border-zinc-800 rounded-xl p-5 print-card">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2 print-section-title">
                <Calendar className="w-4 h-4 text-blue-400" />
                Meeting History
                <span className="text-xs font-normal text-zinc-600 ml-1">({meetings.length} meetings)</span>
              </h2>
              {meetings.length === 0 ? (
                <p className="text-sm text-zinc-600">No previous meetings recorded with this investor.</p>
              ) : (
                <div className="space-y-3">
                  {meetings.map(m => {
                    const objs = safeJsonParse<Objection[]>(m.objections, []);
                    return (
                      <div key={m.id} className="border border-zinc-800/60 rounded-lg p-4 hover:border-zinc-700 transition-colors">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-zinc-200">{formatDate(m.date)}</span>
                              <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                {meetingTypeLabel(m.type)}
                              </span>
                              {m.duration_minutes > 0 && (
                                <span className="text-xs text-zinc-600">{m.duration_minutes}min</span>
                              )}
                              {m.attendees && (
                                <span className="text-xs text-zinc-600">{m.attendees}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex gap-0.5" title={`Enthusiasm: ${m.enthusiasm_score}/5`}>
                              {[1,2,3,4,5].map(n => (
                                <div key={n} className={`w-2 h-2 rounded-full ${n <= m.enthusiasm_score ? 'bg-blue-500' : 'bg-zinc-800'}`} />
                              ))}
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              m.status_after === 'engaged' ? 'bg-purple-900/50 text-purple-400' :
                              m.status_after === 'in_dd' ? 'bg-orange-900/50 text-orange-400' :
                              m.status_after === 'term_sheet' ? 'bg-green-900/50 text-green-400' :
                              m.status_after === 'passed' ? 'bg-red-900/50 text-red-400' :
                              'bg-zinc-800 text-zinc-400'
                            }`}>{STATUS_LABELS[m.status_after] || m.status_after}</span>
                          </div>
                        </div>

                        {m.ai_analysis && (
                          <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{m.ai_analysis}</p>
                        )}

                        {objs.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-zinc-500 font-medium">Objections: </span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {objs.map((o, i) => (
                                <span key={i} className={`text-xs px-2 py-0.5 rounded ${
                                  o.severity === 'showstopper' ? 'bg-red-900/30 text-red-400' :
                                  o.severity === 'significant' ? 'bg-yellow-900/30 text-yellow-400' :
                                  'bg-zinc-800 text-zinc-500'
                                }`}>
                                  {o.text.length > 60 ? o.text.slice(0, 60) + '...' : o.text}
                                  {o.response_effectiveness === 'resolved' ? ' [resolved]' : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {m.next_steps && (
                          <div className="mt-2">
                            <span className="text-xs text-zinc-500 font-medium">Next Steps: </span>
                            <span className="text-xs text-zinc-400">{m.next_steps}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ============ INTELLIGENCE ============ */}
            {(briefs.length > 0 || partners.length > 0 || portfolio.length > 0) && (
              <section className="border border-zinc-800 rounded-xl p-5 print-card">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2 print-section-title">
                  <BookOpen className="w-4 h-4 text-purple-400" />
                  Intelligence
                </h2>

                {/* Research briefs */}
                {briefs.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Research Briefs</h3>
                    <div className="space-y-2">
                      {briefs.map(b => (
                        <details key={b.id} className="group border border-zinc-800/50 rounded-lg overflow-hidden">
                          <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-900/30 text-sm">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              b.brief_type === 'investor' ? 'bg-blue-900/30 text-blue-400' :
                              b.brief_type === 'competitor' ? 'bg-orange-900/30 text-orange-400' :
                              'bg-zinc-800 text-zinc-400'
                            }`}>{b.brief_type}</span>
                            <span className="text-zinc-300">{b.subject}</span>
                            <span className="text-xs text-zinc-600 ml-auto">{b.updated_at?.split('T')[0]}</span>
                          </summary>
                          <div className="px-3 pb-3 text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed border-t border-zinc-800/30 pt-2">
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
                    <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Partner Profiles</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {partners.map(p => (
                        <div key={p.id} className="border border-zinc-800/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Users className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="text-sm font-medium text-zinc-200">{p.name}</span>
                          </div>
                          {p.title && <p className="text-xs text-zinc-500">{p.title}</p>}
                          {p.focus_areas && <p className="text-xs text-zinc-400 mt-1">Focus: {p.focus_areas}</p>}
                          {p.notable_deals && <p className="text-xs text-zinc-400 mt-0.5">Deals: {p.notable_deals}</p>}
                          {p.relevance_to_us && <p className="text-xs text-blue-400 mt-0.5">{p.relevance_to_us}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Portfolio companies */}
                {portfolio.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Portfolio Companies</h3>
                    <div className="border border-zinc-800/50 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-zinc-900/30 border-b border-zinc-800/50">
                          <tr>
                            <th className="text-left px-3 py-2 text-zinc-500 font-medium">Company</th>
                            <th className="text-left px-3 py-2 text-zinc-500 font-medium">Sector</th>
                            <th className="text-left px-3 py-2 text-zinc-500 font-medium">Stage</th>
                            <th className="text-left px-3 py-2 text-zinc-500 font-medium">Relevance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/30">
                          {portfolio.map(pc => (
                            <tr key={pc.id} className={pc.relevance?.toLowerCase().includes('conflict') ? 'bg-red-950/10' : ''}>
                              <td className="px-3 py-2 text-zinc-300 font-medium">{pc.company}</td>
                              <td className="px-3 py-2 text-zinc-500">{pc.sector}</td>
                              <td className="px-3 py-2 text-zinc-500">{pc.stage_invested}</td>
                              <td className="px-3 py-2 text-zinc-400">{pc.relevance || '---'}</td>
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
            <section className="border border-zinc-800 rounded-xl p-5 print-card">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2 print-section-title">
                <CheckCircle className="w-4 h-4 text-green-400" />
                Open Tasks
                <span className="text-xs font-normal text-zinc-600 ml-1">
                  ({pendingTasks.length} pending)
                </span>
              </h2>
              {pendingTasks.length === 0 ? (
                <p className="text-sm text-zinc-600">No pending tasks for this investor.</p>
              ) : (
                <div className="space-y-2">
                  {pendingTasks.map(t => (
                    <div key={t.id} className="flex items-start gap-3 text-sm border border-zinc-800/40 rounded-lg p-3">
                      <span className={`shrink-0 mt-1 w-2 h-2 rounded-full ${
                        t.priority === 'critical' ? 'bg-red-500' :
                        t.priority === 'high' ? 'bg-orange-500' :
                        t.priority === 'medium' ? 'bg-yellow-500' :
                        'bg-zinc-600'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-zinc-200 font-medium">{t.title}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            t.status === 'in_progress' ? 'bg-blue-900/30 text-blue-400' : 'bg-zinc-800 text-zinc-500'
                          }`}>{t.status === 'in_progress' ? 'In Progress' : 'Pending'}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            t.priority === 'critical' ? 'bg-red-900/30 text-red-400' :
                            t.priority === 'high' ? 'bg-orange-900/30 text-orange-400' :
                            'bg-zinc-800 text-zinc-500'
                          }`}>{t.priority}</span>
                        </div>
                        {t.description && <p className="text-xs text-zinc-500 mt-0.5">{t.description}</p>}
                        <div className="flex gap-3 text-xs text-zinc-600 mt-1">
                          {t.due_date && (
                            <span className={`flex items-center gap-1 ${
                              new Date(t.due_date) < new Date() ? 'text-red-400' : ''
                            }`}>
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
            <section className="border border-zinc-800 rounded-xl p-5 print-card">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2 print-section-title">
                <MessageSquare className="w-4 h-4 text-zinc-400" />
                Pre-Meeting Notes
              </h2>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Jot down your agenda, questions to ask, points to emphasize, materials to bring..."
                rows={6}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-600 resize-y"
              />
            </section>

            {/* ============ QUICK LINKS (no-print) ============ */}
            <div className="flex flex-wrap gap-2 no-print">
              <Link
                href={`/investors/${investor.id}`}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> Investor Detail
              </Link>
              <Link
                href="/meetings/new"
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 flex items-center gap-1.5 transition-colors"
              >
                <Calendar className="w-3 h-3" /> Log New Meeting
              </Link>
              <Link
                href="/intelligence"
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-zinc-300 flex items-center gap-1.5 transition-colors"
              >
                <BookOpen className="w-3 h-3" /> Intelligence Hub
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ---------- small components ----------

function ProfileField({ label, value, bold, badge, badgeColor }: {
  label: string;
  value: string;
  bold?: boolean;
  badge?: boolean;
  badgeColor?: string;
}) {
  return (
    <div>
      <span className="text-xs text-zinc-500 block mb-0.5">{label}</span>
      {badge ? (
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${badgeColor || 'bg-zinc-800 text-zinc-400'}`}>
          {value}
        </span>
      ) : (
        <span className={`text-sm ${bold ? 'font-semibold text-zinc-100' : 'text-zinc-300'}`}>{value}</span>
      )}
    </div>
  );
}

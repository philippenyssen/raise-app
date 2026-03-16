'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import {
  SendHorizonal, Clock, CheckCircle2, XCircle, AlertTriangle,
  Mail, MessageSquare, FolderOpen, CalendarPlus, RefreshCw, Milestone,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Users,
  Zap, Timer, Network, ArrowUpRight, ArrowDownRight, Activity,
  PenLine, Copy, Check,
} from 'lucide-react';
import { fmtDateTime } from '@/lib/format';
import { useToast } from '@/components/toast';
import { cardPad4, labelAccent, labelMuted, labelMuted10, labelMutedTight, labelSecondary, stAccent, stTextMuted, stTextPrimary, stTextSecondary } from '@/lib/styles';
import { cachedFetch } from '@/lib/cache';

const filterBtnBase: React.CSSProperties = { borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 400, transition: 'all 150ms ease' };
const convictionBtnBase: React.CSSProperties = { ...filterBtnBase, padding: '0.25rem 0.5rem' };
const filterTabBase: React.CSSProperties = { ...filterBtnBase, padding: '0.375rem 0.75rem' };
import { MS_PER_HOUR, MS_PER_DAY } from '@/lib/time';

const skelItemStyle = { height: '52px', borderRadius: 'var(--radius-md)' } as const;
const completedOutcomeBox = { background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '0.375rem 0.5rem', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' } as const;
const completingFormBox = { background: 'var(--surface-2)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)' } as const;
const draftSubjectBox: React.CSSProperties = { background: 'var(--surface-1)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', fontWeight: 400 };
const draftBodyBox: React.CSSProperties = { background: 'var(--surface-1)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' };
const VEL_CONFIG: Record<string, { color: string; bg: string; icon: typeof ArrowUpRight; label: string }> = {
  accelerating: { color: 'var(--text-secondary)', bg: 'var(--success-muted)', icon: ArrowUpRight, label: 'Rising' },
  decelerating: { color: 'var(--text-primary)', bg: 'var(--danger-muted)', icon: ArrowDownRight, label: 'Falling' },
  stable: { color: 'var(--text-muted)', bg: 'var(--surface-3)', icon: Activity, label: 'Stable' },
  new: { color: 'var(--text-tertiary)', bg: 'var(--warning-muted)', icon: Zap, label: 'New' },
  gone_silent: { color: 'var(--text-primary)', bg: 'var(--danger-muted)', icon: AlertTriangle, label: 'Silent' },
};
const ACCENT_COLOR_MAP: Record<string, string> = {
  red: 'var(--danger)',
  blue: 'var(--accent)',
  zinc: 'var(--text-secondary)',
  green: 'var(--success)',
};
const dangerBadgePill = { marginLeft: '0.375rem', background: 'var(--danger)', color: 'var(--text-primary)', fontSize: 'var(--font-size-xs)', padding: '0 0.25rem', borderRadius: 'var(--radius-full)' } as const;
const cardInnerPad = cardPad4;
const smallDot = { width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent-muted)' } as const;
const footerRow = { padding: '0.375rem var(--space-4)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' as const, alignItems: 'center', background: 'var(--surface-1)' } as const;

interface TimingIntel { optimalDayOfWeek: string; optimalTimeOfDay: string; reasoning: string; }

interface VelocityIntel {
  acceleration: 'accelerating' | 'decelerating' | 'stable' | 'new' | 'gone_silent';
  signal: string;
  daysSinceLastMeeting: number | null;
  recentMeetings: number;
  previousMeetings: number;
}

interface CascadeIntel { cascadeChainLength: number; signal: string; keystoneName: string; totalCascadeProbability: number; }

interface FollowupItem {
  id: string;
  meeting_id: string;
  investor_id: string;
  investor_name: string;
  action_type: string;
  description: string;
  due_at: string;
  status: string;
  outcome: string;
  conviction_delta: number;
  created_at: string;
  completed_at: string | null;
  executed_at: string | null;
  measured_lift: number | null;
  timing: TimingIntel | null;
  velocity: VelocityIntel | null;
  cascade: CascadeIntel | null;
}

const ACTION_TYPE_CONFIG: Record<string, {
  label: string;
  icon: typeof Mail;
  color: string;
  bgColor: string;
}> = {
  thank_you: {
    label: 'Thank-You Note',
    icon: Mail,
    color: 'var(--accent)',
    bgColor: 'var(--accent-muted)',},
  objection_response: {
    label: 'Objection Response',
    icon: MessageSquare,
    color: 'var(--text-primary)',
    bgColor: 'var(--danger-muted)',},
  data_share: {
    label: 'Share Materials',
    icon: FolderOpen,
    color: 'var(--text-secondary)',
    bgColor: 'var(--accent-muted)',},
  schedule_followup: {
    label: 'Schedule Meeting',
    icon: CalendarPlus,
    color: 'var(--text-secondary)',
    bgColor: 'var(--success-muted)',},
  warm_reengagement: {
    label: 'Re-engagement',
    icon: RefreshCw,
    color: 'var(--text-tertiary)',
    bgColor: 'var(--warning-muted)',},
  milestone_update: {
    label: 'Milestone Update',
    icon: Milestone,
    color: 'var(--text-tertiary)',
    bgColor: 'var(--warn-8)',},};

function generateDraft(item: FollowupItem): { subject: string; body: string } {
  const name = item.investor_name;
  const desc = item.description.split('\n')[0]; // First line as context

  const firstName = name.split(/[\s&,]/)[0];
  const templates: Record<string, { subject: string; body: string }> = {
    thank_you: {
      subject: `Following up — ${name}`,
      body: `Dear ${firstName} and team,\n\nThank you for taking the time to meet with us. We valued the discussion and your thoughtful questions.\n\n${desc}\n\nWe're happy to provide any additional materials or context that would be helpful for your evaluation. Please don't hesitate to reach out.\n\nBest regards`,
    },
    objection_response: {
      subject: `Addressing your questions — ${name}`,
      body: `Dear ${firstName} and team,\n\nFollowing up on the points raised during our discussion. We wanted to provide additional context and data:\n\n${desc}\n\nWe've attached the relevant materials that address these questions in more detail. Happy to walk through any of this on a call.\n\nBest regards`,
    },
    data_share: {
      subject: `Materials as discussed — ${name}`,
      body: `Dear ${firstName} and team,\n\nAs discussed, please find the requested materials:\n\n${desc}\n\nLet us know if you need anything else to support your review.\n\nBest regards`,
    },
    schedule_followup: {
      subject: `Next steps — ${name}`,
      body: `Dear ${firstName} and team,\n\nThank you again for the productive conversation. We'd love to continue the dialogue and propose scheduling a follow-up.\n\n${desc}\n\nPlease let us know what times work best for your team and we'll coordinate accordingly.\n\nBest regards`,
    },
    warm_reengagement: {
      subject: `Checking in — ${name}`,
      body: `Dear ${firstName} and team,\n\nHope all is well. Wanted to reconnect following our earlier conversations and share some recent developments.\n\n${desc}\n\nWe've made meaningful progress since we last spoke and would welcome the chance to update you. Are you available for a brief call this week?\n\nBest regards`,
    },
    milestone_update: {
      subject: `Progress update — ${name}`,
      body: `Dear ${firstName} and team,\n\nWanted to share a quick update on our progress since our last interaction:\n\n${desc}\n\nWe believe these developments are relevant to your evaluation and are happy to discuss further at your convenience.\n\nBest regards`,
    },};

  return templates[item.action_type] || templates.milestone_update;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const due = new Date(dateStr);
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / MS_PER_HOUR);
  const diffDays = Math.round(diffMs / MS_PER_DAY);

  if (diffMs < 0) {
    const overdueDays = Math.abs(diffDays);
    if (overdueDays === 0) return 'Due now';
    return `${overdueDays}d overdue`;
  }
  if (diffHours < 1) return 'Due now';
  if (diffHours < 24) return `In ${diffHours}h`;
  if (diffDays === 1) return 'Tomorrow';
  return `In ${diffDays}d`;
}

export default function FollowupsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 page-content">
        <div className="skeleton" style={{ height: '28px', width: '200px' }} />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading your action items...</p>
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={skelItemStyle} />)}
        </div>
      </div>}>
      <FollowupsContent />
    </Suspense>);
}

function FollowupsContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const investorFilter = searchParams.get('investor') || '';
  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'skipped'>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeForm, setCompleteForm] = useState({ outcome: '', conviction_delta: 0 });
  const [overdueExpanded, setOverdueExpanded] = useState(true);
  const [todayExpanded, setTodayExpanded] = useState(true);
  const [upcomingExpanded, setUpcomingExpanded] = useState(true);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ view: 'intelligence' });
      if (filter !== 'all') params.set('status', filter);
      if (investorFilter) params.set('investor_id', investorFilter);
      const res = await cachedFetch(`/api/followups?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (${res.status})`);
      }
      const data = await res.json();
      setFollowups(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Couldn\'t load follow-ups — check your connection and refresh');
    } finally {
      setLoading(false);
    }
  }, [filter, investorFilter]);

  useEffect(() => { document.title = 'Raise | Follow-Ups'; }, []);
  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setExpandedId(null); return; }
      if (e.metaKey || e.ctrlKey || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'r') { e.preventDefault(); fetchFollowups(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fetchFollowups]);

  async function handleComplete(id: string) {
    // Optimistic: remove from list immediately
    const prev = followups;
    setFollowups(f => f.filter(x => x.id !== id));
    setCompletingId(null);
    setCompleteForm({ outcome: '', conviction_delta: 0 });
    toast('Follow-up completed — conviction score updated', 'success');
    try {
      const res = await fetch('/api/followups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: 'completed',
          outcome: completeForm.outcome,
          conviction_delta: completeForm.conviction_delta,
        }),});
      if (!res.ok) throw new Error('Failed');
      fetchFollowups();
    } catch (e) { console.warn('[FOLLOWUP_COMPLETE]', e instanceof Error ? e.message : e); toast('Couldn\'t complete follow-up — restoring', 'error'); setFollowups(prev); }
  }

  async function handleSkip(id: string) {
    if (processingIds.has(id)) return;
    setProcessingIds(prev => new Set(prev).add(id));
    const prev = followups;
    setFollowups(f => f.filter(x => x.id !== id));
    try {
      const res = await fetch('/api/followups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'skipped' }),});
      if (!res.ok) throw new Error('Failed');
      fetchFollowups();
    } catch (e) { console.warn('[FOLLOWUP_SKIP]', e instanceof Error ? e.message : e); toast('Couldn\'t skip follow-up — restoring', 'error'); setFollowups(prev); }
    finally { setProcessingIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  }

  async function handleQuickComplete(id: string) {
    if (processingIds.has(id)) return;
    setProcessingIds(prev => new Set(prev).add(id));
    const prev = followups;
    setFollowups(f => f.filter(x => x.id !== id));
    toast('Follow-up completed', 'success');
    try {
      const res = await fetch('/api/followups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'completed' }),});
      if (!res.ok) throw new Error('Failed');
      fetchFollowups();
    } catch (e) { console.warn('[FOLLOWUP_QUICK]', e instanceof Error ? e.message : e); toast('Couldn\'t complete follow-up — restoring', 'error'); setFollowups(prev); }
    finally { setProcessingIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  }

  // Categorize followups in a single pass (memoized — recomputes only when followups change)
  const now = new Date();
  const { overdue, dueToday, upcoming, later, completed } = useMemo(() => {
    const n = new Date();
    const todayEnd = new Date(n.getFullYear(), n.getMonth(), n.getDate(), 23, 59, 59);
    const in3Days = new Date(n.getTime() + 3 * MS_PER_DAY);
    const o: typeof followups = [], dt: typeof followups = [], u: typeof followups = [], l: typeof followups = [], c: typeof followups = [];
    for (const f of followups) {
      if (f.status === 'completed') { c.push(f); continue; }
      if (f.status !== 'pending') continue;
      const due = new Date(f.due_at);
      if (due < n) o.push(f);
      else if (due <= todayEnd) dt.push(f);
      else if (due <= in3Days) u.push(f);
      else l.push(f);
    }
    return { overdue: o, dueToday: dt, upcoming: u, later: l, completed: c };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followups]);

  // Learning stats — memoized to avoid filter/reduce/sort on every render
  const { completedWithDelta, avgDelta, byType, withMeasuredLift, avgMeasuredLift, bestActionType } = useMemo(() => {
    const cwd = completed.filter(f => f.conviction_delta !== 0);
    const ad = cwd.length > 0
      ? cwd.reduce((acc, f) => acc + f.conviction_delta, 0) / cwd.length
      : 0;
    const bt = completed.reduce<Record<string, { count: number; totalDelta: number }>>((acc, f) => {
      if (!acc[f.action_type]) acc[f.action_type] = { count: 0, totalDelta: 0 };
      acc[f.action_type].count++;
      acc[f.action_type].totalDelta += f.conviction_delta;
      return acc;
    }, {});
    const wml = completed.filter(f => f.measured_lift !== null && f.measured_lift !== undefined);
    const aml = wml.length > 0
      ? wml.reduce((acc, f) => acc + (f.measured_lift || 0), 0) / wml.length
      : null;
    const bat = Object.entries(
      wml.reduce<Record<string, { count: number; totalLift: number }>>((acc, f) => {
        if (!acc[f.action_type]) acc[f.action_type] = { count: 0, totalLift: 0 };
        acc[f.action_type].count++;
        acc[f.action_type].totalLift += f.measured_lift || 0;
        return acc;
      }, {})
    ).sort((a, b) => (b[1].totalLift / b[1].count) - (a[1].totalLift / a[1].count))[0];
    return { completedWithDelta: cwd, avgDelta: ad, byType: bt, withMeasuredLift: wml, avgMeasuredLift: aml, bestActionType: bat };
  }, [completed]);

  function renderFollowupCard(item: FollowupItem, showOverdueIndicator = false) {
    const config = ACTION_TYPE_CONFIG[item.action_type] || ACTION_TYPE_CONFIG.milestone_update;
    const Icon = config.icon;
    const isExpanded = expandedId === item.id;
    const isCompleting = completingId === item.id;
    const isOverdue = item.status === 'pending' && new Date(item.due_at) < now;

    return (
      <div
        key={item.id}
        className="card"
        style={{ padding: 0, borderColor: showOverdueIndicator || isOverdue ? 'var(--fg-6)' : undefined, background: showOverdueIndicator || isOverdue ? 'var(--fg-6)' : undefined, boxShadow: showOverdueIndicator || isOverdue ? '0 none' : undefined }}>
        <div style={cardInnerPad}>
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className="w-8 h-8 flex items-center justify-center shrink-0"
              style={{ borderRadius: '50%', background: isOverdue ? 'var(--danger-muted)' : config.bgColor }}>
              <Icon className="w-4 h-4" style={{ color: isOverdue ? 'var(--danger)' : config.color }} /></div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className="badge"
                  style={{ fontSize: 'var(--font-size-xs)', background: isOverdue ? 'var(--danger-muted)' : config.bgColor, color: isOverdue ? 'var(--text-tertiary)' : config.color }}>
                  {config.label}</span>
                <Link
                  href={`/investors/${item.investor_id}`}
                  style={labelAccent}>
                  {item.investor_name}</Link>
                <span
                  className="flex items-center gap-1"
                  style={{ fontSize: 'var(--font-size-xs)', color: isOverdue ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 400 }}>
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(item.due_at)}</span></div>

              <p
                className={isExpanded ? 'whitespace-pre-line' : 'line-clamp-2'}
                style={labelSecondary}>
                {item.description}</p>

              {item.description.includes('\n') && (
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  style={labelMuted10}
                  className="mt-1 sidebar-link">
                  {isExpanded ? 'Show less' : 'Show more'}</button>
              )}

              {/* Draft preview */}
              {item.status === 'pending' && draftingId !== item.id && (
                <div className="mt-1.5 flex items-center gap-1.5" style={labelMuted}>
                  <Mail className="w-3 h-3" style={{ flexShrink: 0 }} />
                  <span className="truncate">{generateDraft(item).subject}</span></div>
              )}

              {/* Completed outcome */}
              {item.status === 'completed' && item.outcome && (
                <div
                  className="mt-2"
                  style={completedOutcomeBox}>
                  <span style={stTextMuted}>Outcome:</span> {item.outcome}
                  {item.conviction_delta !== 0 && (
                    <span
                      className="inline-flex items-center gap-0.5"
                      style={{ marginLeft: '0.5rem', color: item.conviction_delta > 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {item.conviction_delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {item.conviction_delta > 0 ? '+' : ''}{item.conviction_delta}</span>
                  )}
                  {item.measured_lift !== null && item.measured_lift !== undefined && (
                    <span
                      className="inline-flex items-center gap-0.5"
                      style={{ marginLeft: '0.5rem', color: item.measured_lift > 0 ? 'var(--success)' : item.measured_lift < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                      Measured: {item.measured_lift > 0 ? '+' : ''}{item.measured_lift} enthusiasm</span>
                  )}</div>
              )}

              {/* Completing form */}
              {isCompleting && (
                <div
                  className="mt-3 space-y-2"
                  style={completingFormBox}>
                  <div>
                    <label
                      className="block mb-1"
                      style={labelMuted10}>
                      Outcome (what happened?)</label>
                    <input
                      value={completeForm.outcome}
                      onChange={e => setCompleteForm(f => ({ ...f, outcome: e.target.value }))}
                      placeholder="e.g., Sent thank-you, they responded positively..."
                      className="input" /></div>
                  <div>
                    <label
                      className="block mb-1"
                      style={labelMuted10}>
                      Conviction change (-2 to +2)</label>
                    <div className="flex gap-1">
                      {[-2, -1, 0, 1, 2].map(val => (
                        <button
                          key={val}
                          className="transition-colors"
                          onClick={() => setCompleteForm(f => ({ ...f, conviction_delta: val }))}
                          style={{
                            ...convictionBtnBase,
                            background: completeForm.conviction_delta === val
                              ? val > 0 ? 'var(--success)' : val < 0 ? 'var(--danger)' : 'var(--accent)'
                              : 'var(--surface-3)',
                            color: completeForm.conviction_delta === val
                              ? 'white'
                              : 'var(--text-secondary)', }}
                          onMouseEnter={e => {
                            if (completeForm.conviction_delta !== val) {
                              e.currentTarget.style.background = 'var(--border-strong)';
                            } }}
                          onMouseLeave={e => {
                            if (completeForm.conviction_delta !== val) {
                              e.currentTarget.style.background = 'var(--surface-3)';
                            } }}>
                          {val > 0 ? '+' : ''}{val}</button>
                      ))}</div></div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleComplete(item.id)}
                      className="btn btn-sm btn-accent-hover"
                      style={{ background: 'var(--success)', color: 'var(--text-primary)' }}>
                      Complete</button>
                    <button
                      onClick={() => { setCompletingId(null); setCompleteForm({ outcome: '', conviction_delta: 0 }); }}
                      className="btn btn-sm btn-secondary">
                      Cancel</button></div></div>
              )}</div>

            {/* Actions */}
            {item.status === 'pending' && !isCompleting && (
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setDraftingId(draftingId === item.id ? null : item.id)}
                  className={`p-1.5 ${draftingId === item.id ? '' : 'action-draft'}`}
                  style={{ borderRadius: 'var(--radius-md)', ...(draftingId === item.id ? { color: 'var(--chart-4)', background: 'var(--cat-purple-muted)' } : {}) }}
                  title="Draft message"
                  aria-label="Draft message">
                  <PenLine className="w-4 h-4" /></button>
                <button
                  onClick={() => handleQuickComplete(item.id)}
                  disabled={processingIds.has(item.id)}
                  className="p-1.5 flag-addr"
                  style={{ borderRadius: 'var(--radius-md)', opacity: processingIds.has(item.id) ? 0.4 : 1 }}
                  title="Quick complete"
                  aria-label="Quick complete">
                  <CheckCircle2 className="w-4 h-4" /></button>
                <button
                  onClick={() => { setCompletingId(item.id); setCompleteForm({ outcome: '', conviction_delta: 0 }); }}
                  className="p-1.5 action-outcome"
                  style={{ borderRadius: 'var(--radius-md)' }}
                  title="Complete with outcome"
                  aria-label="Complete with outcome">
                  <TrendingUp className="w-4 h-4" /></button>
                <button
                  onClick={() => handleSkip(item.id)}
                  disabled={processingIds.has(item.id)}
                  className="p-1.5 remove-btn"
                  style={{ borderRadius: 'var(--radius-md)', opacity: processingIds.has(item.id) ? 0.4 : 1 }}
                  title="Skip"
                  aria-label="Skip follow-up">
                  <XCircle className="w-4 h-4" /></button></div>
            )}

            {item.status === 'completed' && (
              <span className="flex items-center gap-1 shrink-0" style={labelSecondary}>
                <CheckCircle2 className="w-3.5 h-3.5" /></span>
            )}

            {item.status === 'skipped' && (
              <span className="flex items-center gap-1 shrink-0" style={labelMuted}>
                <XCircle className="w-3.5 h-3.5" /></span>
            )}</div></div>

        {/* Intelligence strip */}
        {item.status === 'pending' && (item.timing || item.velocity || item.cascade) && (
          <div
            style={footerRow}>
            {/* Optimal timing */}
            {item.timing && (
              <div
                className="flex items-center gap-1.5"
                style={{ fontSize: 'var(--font-size-xs)' }}
                title={item.timing.reasoning}>
                <span
                  className="flex items-center justify-center"
                  style={smallDot}>
                  <Timer className="w-2.5 h-2.5" style={stAccent} /></span>
                <span style={stTextMuted}>Send</span>
                <span style={{ color: 'var(--accent)', fontWeight: 400 }}>
                  {item.timing.optimalDayOfWeek} {item.timing.optimalTimeOfDay}</span></div>
            )}

            {/* Engagement velocity */}
            {item.velocity && (() => {
              const vc = VEL_CONFIG[item.velocity!.acceleration] || VEL_CONFIG.stable;
              const VelIcon = vc.icon;
              return (
                <div
                  className="flex items-center gap-1.5"
                  style={{ fontSize: 'var(--font-size-xs)' }}
                  title={item.velocity!.signal}>
                  <span
                    className="flex items-center justify-center"
                    style={{ width: '16px', height: '16px', borderRadius: '50%', background: vc.bg }}>
                    <VelIcon className="w-2.5 h-2.5" style={{ color: vc.color }} /></span>
                  <span style={stTextMuted}>Velocity</span>
                  <span style={{ color: vc.color, fontWeight: 400 }}>{vc.label}</span>
                  {item.velocity!.daysSinceLastMeeting !== null && (
                    <span style={stTextMuted}>({item.velocity!.daysSinceLastMeeting}d ago)</span>
                  )}
                </div>);
            })()}

            {/* Network cascade */}
            {item.cascade && item.cascade.cascadeChainLength > 0 && (
              <div
                className="flex items-center gap-1.5"
                style={{ fontSize: 'var(--font-size-xs)' }}
                title={item.cascade.signal}>
                <span
                  className="flex items-center justify-center"
                  style={smallDot}>
                  <Network className="w-2.5 h-2.5" style={stTextSecondary} /></span>
                <span style={stTextMuted}>Cascade</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                  {item.cascade.cascadeChainLength} investor{item.cascade.cascadeChainLength !== 1 ? 's' : ''}</span></div>
            )}</div>
        )}

        {/* Draft message panel */}
        {draftingId === item.id && (() => {
          const draft = generateDraft(item);
          return (
            <div
              style={{ borderTop: '1px solid var(--accent-8)', background: 'var(--accent-3)', padding: 'var(--space-4)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
                <span className="flex items-center gap-1.5" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--accent)' }}>
                  <PenLine className="w-3.5 h-3.5" />
                  Draft Message</span>
                <span style={labelMuted10}>
                  Edit before sending</span></div>

              {/* Subject */}
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-1)' }}>
                  <span style={labelMutedTight}>Subject</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(draft.subject);
                      setCopiedField(`subject-${item.id}`);
                      setTimeout(() => setCopiedField(null), 2000); }}
                    className="flex items-center gap-1 p-1"
                    style={{ borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', color: copiedField === `subject-${item.id}` ? 'var(--success)' : 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 150ms ease' }}>
                    {copiedField === `subject-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedField === `subject-${item.id}` ? 'Copied' : 'Copy'}</button></div>
                <div
                  style={draftSubjectBox}>
                  {draft.subject}</div></div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-1)' }}>
                  <span style={labelMutedTight}>Body</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(draft.body);
                      setCopiedField(`body-${item.id}`);
                      setTimeout(() => setCopiedField(null), 2000); }}
                    className="flex items-center gap-1 p-1"
                    style={{ borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', color: copiedField === `body-${item.id}` ? 'var(--success)' : 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 150ms ease' }}>
                    {copiedField === `body-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedField === `body-${item.id}` ? 'Copied' : 'Copy'}</button></div>
                <div
                  style={draftBodyBox}>
                  {draft.body}</div></div>

              {/* Copy all button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
                  setCopiedField(`all-${item.id}`);
                  setTimeout(() => setCopiedField(null), 2000); }}
                className="btn btn-sm mt-3 transition-colors"
                style={{ background: copiedField === `all-${item.id}` ? 'var(--success)' : 'var(--accent-muted)', color: copiedField === `all-${item.id}` ? 'white' : 'var(--accent)', border: 'none', transition: 'all 150ms ease' }}
                onMouseEnter={e => {
                  if (copiedField !== `all-${item.id}`) {
                    e.currentTarget.style.background = 'var(--accent-10)';
                  } }}
                onMouseLeave={e => {
                  if (copiedField !== `all-${item.id}`) {
                    e.currentTarget.style.background = 'var(--accent-muted)';
                  } }}>
                {copiedField === `all-${item.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedField === `all-${item.id}` ? 'Copied to clipboard' : 'Copy full message'}</button>
            </div>);
        })()}

        {/* Due date footer */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '0.5rem var(--space-4)', borderTop: isOverdue ? '1px solid var(--fg-6)' : '1px solid var(--border-subtle)', ...labelMuted }}>
          {isOverdue ? (
            <span style={{ color: 'var(--text-primary)', fontWeight: 400 }}>
              {formatRelativeTime(item.due_at)} — was due {fmtDateTime(item.due_at)}</span>
          ) : (
            <span>Due: {fmtDateTime(item.due_at)}</span>
          )}
          {item.completed_at && <span>Completed: {fmtDateTime(item.completed_at)}</span>}</div>
      </div>);
  }

  function renderSection(
    title: string,
    items: FollowupItem[],
    expanded: boolean,
    setExpanded: (v: boolean) => void,
    accent: 'red' | 'blue' | 'zinc' | 'green' = 'zinc',
    showOverdue = false,
  ) {
    if (items.length === 0) return null;

    const accentColorMap = ACCENT_COLOR_MAP;

    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {accent === 'red' && <AlertTriangle className="w-4 h-4" style={stTextPrimary} />}
            <h2 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: accentColorMap[accent] }}>{title}</h2>
            <span
              style={{ fontSize: 'var(--font-size-xs)', padding: '0.125rem 0.375rem', borderRadius: 'var(--radius-full)', background: accent === 'red' ? 'var(--danger-muted)' : 'var(--surface-3)', color: accent === 'red' ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
              {items.length}</span></div>
          {expanded
            ? <ChevronUp className="w-4 h-4" style={stTextMuted} />
            : <ChevronDown className="w-4 h-4" style={stTextMuted} />
          }</button>
        {expanded && (
          <div className="space-y-2">
            {items.map(item => renderFollowupCard(item, showOverdue))}</div>
        )}
      </div>);
  }

  return (
    <div className="max-w-4xl space-y-6 page-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Follow-ups</h1>
          <p style={{ ...stTextMuted, fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
            Automated follow-up choreography after investor meetings. Track actions, record outcomes, and learn what works.</p>
          {investorFilter && followups.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs px-2 py-1 rounded-md" style={{ background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-10)' }}>
                Filtered: {followups[0]?.investor_name || 'Selected investor'}</span>
              <Link href="/followups" className="text-xs" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
                Show all</Link></div>
          )}</div></div>

      {/* Stats row */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3 card-stagger">
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Overdue</div>
          <div
            className="metric-value mt-1"
            style={{ color: overdue.length > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
            {overdue.length}</div></div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Due Today</div>
          <div
            className="metric-value mt-1"
            style={{ color: dueToday.length > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
            {dueToday.length}</div></div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Completed</div>
          <div className="metric-value mt-1" style={stTextSecondary}>{completed.length}</div></div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Avg Conviction Change</div>
          <div
            className="metric-value mt-1 flex items-center gap-1"
            style={{ color: avgDelta > 0 ? 'var(--success)' : avgDelta < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
            {avgDelta > 0 ? <TrendingUp className="w-5 h-5" /> : avgDelta < 0 ? <TrendingDown className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
            {avgDelta === 0 ? '0' : (avgDelta > 0 ? '+' : '') + avgDelta.toFixed(1)}</div></div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Measured Efficacy</div>
          <div
            className="metric-value mt-1 flex items-center gap-1"
            style={{ color: avgMeasuredLift !== null && avgMeasuredLift > 0 ? 'var(--success)' : avgMeasuredLift !== null && avgMeasuredLift < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
            {avgMeasuredLift !== null ? (
              <>
                {avgMeasuredLift > 0 ? <TrendingUp className="w-5 h-5" /> : avgMeasuredLift < 0 ? <TrendingDown className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                {avgMeasuredLift > 0 ? '+' : ''}{avgMeasuredLift.toFixed(1)}
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Complete follow-ups to track</span>
            )}</div>
          {bestActionType && (
            <div style={{ ...labelMuted, marginTop: 'var(--space-1)' }}>
              Best: {ACTION_TYPE_CONFIG[bestActionType[0]]?.label || bestActionType[0]}</div>
          )}</div></div>

      {/* Filter tabs */}
      <div
        className="flex gap-1"
        style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-1)' }}>
        {(['pending', 'all', 'completed', 'skipped'] as const).map(f => (
          <button
            key={f}
            className={`transition-colors ${filter !== f ? 'filter-inactive' : ''}`}
            onClick={() => setFilter(f)}
            style={{ ...filterTabBase, background: filter === f ? 'var(--surface-3)' : 'transparent', color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && overdue.length > 0 && (
              <span
                style={dangerBadgePill}>
                {overdue.length}</span>
            )}</button>
        ))}</div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card" style={{ padding: 'var(--space-4)' }}>
              <div className="flex items-start gap-3">
                <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="skeleton" style={{ width: '80px', height: '16px', borderRadius: 'var(--radius-sm)' }} />
                    <div className="skeleton" style={{ width: '100px', height: '14px', borderRadius: 'var(--radius-sm)' }} />
                  </div>
                  <div className="skeleton" style={{ width: `${70 - i * 8}%`, height: '14px', borderRadius: 'var(--radius-sm)' }}
                    /></div></div></div>
          ))}</div>
      ) : fetchError ? (
        <div
          className="text-center py-12"
          style={{ borderRadius: 'var(--radius-xl)' }}>
          <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--danger)' }} />
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
            Failed to load follow-ups</h3>
          <p style={{ ...labelMuted, marginBottom: 'var(--space-4)' }}>
            {fetchError}</p>
          <button
            onClick={fetchFollowups}
            className="btn btn-secondary btn-sm inline-flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry</button></div>
      ) : followups.length === 0 ? (
        <EmptyState
          icon={SendHorizonal}
          title="No follow-ups pending"
          description="Follow-ups are created automatically after meetings."
          action={{ label: 'Log a meeting', href: '/meetings/new' }} />
      ) : filter === 'pending' ? (
        <div className="space-y-6">
          {renderSection('Overdue', overdue, overdueExpanded, setOverdueExpanded, 'red', true)}
          {renderSection('Due Today', dueToday, todayExpanded, setTodayExpanded, 'blue')}
          {renderSection('Next 3 Days', upcoming, upcomingExpanded, setUpcomingExpanded, 'zinc')}
          {later.length > 0 && (
            <div>
              <h2 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                Later ({later.length})</h2>
              <div className="space-y-2">
                {later.map(item => renderFollowupCard(item))}</div></div>
          )}</div>
      ) : (
        <div className="space-y-2">
          {[...followups].sort((a, b) => {
            const aOverdue = a.status === 'pending' && new Date(a.due_at) < now ? 1 : 0;
            const bOverdue = b.status === 'pending' && new Date(b.due_at) < now ? 1 : 0;
            return bOverdue - aOverdue;
          }).map(item => renderFollowupCard(item))}</div>
      )}

      {/* Learning section */}
      {completed.length >= 3 && (
        <div
          style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
          <div
            style={{ background: 'var(--accent-muted)', borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-4) var(--space-5)' }}>
            <h2 className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 300 }}>
              <Users className="w-4 h-4" style={{ color: 'var(--chart-4)' }} />
              Follow-up Effectiveness</h2>
            <p style={{ ...labelMuted, marginTop: 'var(--space-1)' }}>
              Which follow-up types drive the most conviction change?</p></div>
          <div style={{ padding: 'var(--space-4)' }}>
            <div className="space-y-2">
              {Object.entries(byType)
                .sort(([, a], [, b]) => (b.totalDelta / b.count) - (a.totalDelta / a.count))
                .map(([type, stats]) => {
                  const config = ACTION_TYPE_CONFIG[type] || ACTION_TYPE_CONFIG.milestone_update;
                  const Icon = config.icon;
                  const avgTypeDelta = stats.totalDelta / stats.count;
                  return (
                    <div key={type} className="flex items-center gap-3 py-2">
                      <div
                        className="w-6 h-6 flex items-center justify-center"
                        style={{ borderRadius: 'var(--radius-sm)', background: config.bgColor }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: config.color }} /></div>
                      <span className="flex-1" style={labelSecondary}>
                        {config.label}</span>
                      <span style={labelMuted}>
                        {stats.count} done</span>
                      <span
                        className="flex items-center gap-0.5"
                        style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: avgTypeDelta > 0 ? 'var(--success)' : avgTypeDelta < 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {avgTypeDelta > 0 ? '+' : ''}{avgTypeDelta.toFixed(1)} avg</span>
                    </div>);
                })}</div></div></div>
      )}
    </div>);
}

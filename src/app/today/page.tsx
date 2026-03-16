'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { cachedFetch } from '@/lib/cache';
import { useToast } from '@/components/toast';
import { fmtDateFull } from '@/lib/format';
import { MS_PER_MINUTE, MS_PER_DAY } from '@/lib/time';
import { useRefreshInterval } from '@/lib/hooks/useRefreshInterval';
import {
  Calendar, Clock, ArrowRight, ChevronRight, RefreshCw,
  Mail, UserPlus, FileText, AlertTriangle, Zap, TrendingUp,
  TrendingDown, Minus, Users, Shield, Target,
  CheckCircle, Sparkles, ArrowUpRight,
} from 'lucide-react';
import { cardPad4, flexColGap2, labelMuted, labelSecondary, labelTertiary, skelCardSm, skelRow, stAccent, stFontSm, stFontXs, stTextMuted, stTextSecondary, stTextTertiary } from '@/lib/styles';

// ---------------------------------------------------------------------------
// Extracted style constants (avoid re-allocation each render)
// ---------------------------------------------------------------------------
const linkCardPad = { padding: 'var(--space-4)', textDecoration: 'none' as const } as const;
const emptyStatePad = { padding: 'var(--space-6)', textAlign: 'center' as const } as const;
const emptyStateIcon = { display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-3)' } as const;
const textBodySm = { ...stFontSm, fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1.4 } as const;
const labelTertiaryLine = { ...labelTertiary, marginTop: 'var(--space-0)', lineHeight: 1.5 } as const;
const flexIcon = { display: 'flex' } as const;
const gridGap3 = { gap: 'var(--space-3)' } as const;
const metricCardPad: React.CSSProperties = { padding: 'var(--space-3) var(--space-4)' };
const metricValue: React.CSSProperties = { fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)', marginTop: 'var(--space-1)' };
const overdueInvLink = { fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 400, textDecoration: 'none' } as const;
const overdueBadge = { fontSize: 'var(--font-size-xs)', padding: 'var(--space-0) var(--space-1)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-1)', color: 'var(--text-tertiary)' } as const;
const overdueDanger = { fontSize: 'var(--font-size-xs)', color: 'var(--danger)', fontWeight: 400 } as const;
const enthusiasmDotBase = { width: '5px', height: '5px', borderRadius: '50%', display: 'inline-block' } as const;
const overdueDesc = { fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-0)' } as const;
const overdueDoneBtn = { background: 'var(--surface-0)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-2)' } as const;
const emptyStateText = { ...stFontSm, color: 'var(--text-secondary)', fontWeight: 400 } as const;
const investorLinkAccent = { color: 'var(--accent)', fontWeight: 400, textDecoration: 'none' } as const;
const fontSmPrimary = { fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' } as const;
const mtSpace0 = { marginTop: 'var(--space-0)' } as const;
const investorLinkXs = { fontSize: 'var(--font-size-xs)', color: 'var(--accent)', textDecoration: 'none' } as const;
const doneButtonStyle: React.CSSProperties = { background: 'var(--success-muted)', color: 'var(--text-secondary)', border: '1px solid var(--accent-8)', fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-2)' };
const skipButtonStyle: React.CSSProperties = { background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-2)' };

// ---------------------------------------------------------------------------
// Types — match the updated /api/briefing response
// ---------------------------------------------------------------------------

interface BriefingMeeting {
  investorId?: string;
  investorName: string;
  time: string;
  type: string;
  prepLink: string;
  captureLink?: string;
  keyPoint: string;
  enthusiasm?: number;
  meetingCount?: number;
}

interface UrgentAction {
  title: string;
  description: string;
  investorName: string | null;
  category: 'followup' | 'outreach' | 'preparation' | 'escalation' | 'meeting';
  link: string;
  timeEstimate: string;
}

interface PipelineSnapshot {
  totalActive: number;
  inDD: number;
  termSheets: number;
  totalTarget: number;
  forecast: string;
}

interface BriefingAlert { type: 'warning' | 'opportunity' | 'risk'; title: string; detail: string; }

interface BriefingData {
  greeting: string;
  todaySummary: string;
  urgentActions: UrgentAction[];
  todayMeetings: BriefingMeeting[];
  pipelineSnapshot: PipelineSnapshot;
  alerts: BriefingAlert[];
  momentum: 'accelerating' | 'steady' | 'decelerating' | 'stalled';
  momentumChange: string;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  followup: Mail,
  outreach: UserPlus,
  preparation: FileText,
  escalation: AlertTriangle,
  meeting: Calendar,};

const CATEGORY_COLORS: Record<string, string> = {
  followup: 'var(--accent)',
  outreach: 'var(--chart-4)',
  preparation: 'var(--cat-teal)',
  escalation: 'var(--danger)',
  meeting: 'var(--warning)',};

const CATEGORY_BG: Record<string, string> = {
  followup: 'var(--accent-muted)',
  outreach: 'var(--cat-purple-muted)',
  preparation: 'var(--cat-teal-muted)',
  escalation: 'var(--danger-muted)',
  meeting: 'var(--warning-muted)',};

const FOLLOWUP_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  thank_you: { label: 'Thank You', color: 'var(--accent)', bg: 'var(--accent-muted)' },
  objection_response: { label: 'Objection', color: 'var(--text-primary)', bg: 'var(--danger-muted)' },
  data_share: { label: 'Share Docs', color: 'var(--chart-4)', bg: 'var(--cat-purple-muted)' },
  schedule_followup: { label: 'Schedule', color: 'var(--text-secondary)', bg: 'var(--success-muted)' },
  warm_reengagement: { label: 'Re-engage', color: 'var(--text-tertiary)', bg: 'var(--warning-muted)' },
  milestone_update: { label: 'Update', color: 'var(--text-tertiary)', bg: 'var(--warn-8)' },
};

const ALERT_STYLES: Record<string, { bg: string; border: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  warning: { bg: 'var(--warning-muted)', border: 'var(--fg-5)', color: 'var(--text-tertiary)', icon: AlertTriangle },
  opportunity: { bg: 'var(--success-muted)', border: 'var(--accent-8)', color: 'var(--text-secondary)', icon: Zap },
  risk: { bg: 'var(--danger-muted)', border: 'var(--fg-6)', color: 'var(--text-primary)', icon: Shield },};

const MOMENTUM_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  accelerating: { color: 'var(--text-secondary)', bg: 'var(--success-muted)', border: 'var(--accent-8)', icon: TrendingUp, label: 'Accelerating' },
  steady: { color: 'var(--text-secondary)', bg: 'var(--surface-2)', border: 'var(--border-default)', icon: Minus, label: 'Steady' },
  decelerating: { color: 'var(--text-tertiary)', bg: 'var(--warning-muted)', border: 'var(--fg-5)', icon: TrendingDown, label: 'Decelerating' },
  stalled: { color: 'var(--text-primary)', bg: 'var(--danger-muted)', border: 'var(--fg-6)', icon: TrendingDown, label: 'Stalled' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 400 }}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;});
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MeetingCard({ meeting }: { meeting: BriefingMeeting }) {
  const timeDisplay = (() => {
    try {
      const d = new Date(meeting.time);
      if (isNaN(d.getTime())) return meeting.time;
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return meeting.time;
    }
  })();

  return (
    <div
      className="card hover-border"
      style={cardPad4}>
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center shrink-0" style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'var(--accent-muted)' }}>
          <span style={{ color: 'var(--accent)', fontSize: 'var(--font-size-xs)', fontWeight: 300, textAlign: 'center', lineHeight: 1.1 }}>
            {timeDisplay}</span></div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ ...stFontSm, fontWeight: 400, color: 'var(--text-primary)' }}>{meeting.investorName}</span>
            <span style={{ ...stFontXs, padding: 'var(--space-0) var(--space-1)', borderRadius: 'var(--radius-sm)', fontWeight: 400, background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>{meeting.type.replace(/_/g, ' ')}</span>
            {(meeting.meetingCount ?? 0) > 1 && (
              <span style={{ ...labelMuted, fontWeight: 400 }}>Meeting #{meeting.meetingCount}</span>
            )}
            {(meeting.enthusiasm ?? 0) > 0 && (
              <span
                className="inline-flex items-center gap-0.5"
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 400,
                  color: (meeting.enthusiasm ?? 0) >= 4 ? 'var(--success)' : (meeting.enthusiasm ?? 0) >= 3 ? 'var(--text-secondary)' : 'var(--danger)',
                }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <span
                    key={n}
                    style={{
                      ...enthusiasmDotBase,
                      background: n <= (meeting.enthusiasm ?? 0)
                        ? (meeting.enthusiasm ?? 0) >= 4 ? 'var(--success)' : (meeting.enthusiasm ?? 0) >= 3 ? 'var(--accent)' : 'var(--text-muted)'
                        : 'var(--border-default)',
                    }} />
                ))}</span>
            )}</div>

          <p style={{ ...labelSecondary, marginTop: 'var(--space-1)', lineHeight: 1.5 }}>{renderMarkdown(meeting.keyPoint)}</p></div>

        <div className="flex gap-1.5 shrink-0">
          <Link
            href={meeting.prepLink}
            className="btn btn-secondary btn-sm">
            Prep</Link>
          <Link
            href={meeting.captureLink || '/meetings/capture'}
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
            Capture</Link></div></div>
    </div>);
}

function ActionCard({ action }: { action: UrgentAction }) {
  const Icon = CATEGORY_ICONS[action.category] || FileText;
  const iconColor = CATEGORY_COLORS[action.category] || 'var(--text-tertiary)';
  const iconBg = CATEGORY_BG[action.category] || 'var(--surface-2)';

  return (
    <div
      className="card hover-border"
      style={cardPad4}>
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center shrink-0" style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)', background: iconBg }}>
          <span style={{ color: iconColor, ...flexIcon }}>
            <Icon className="w-4 h-4" /></span></div>

        <div className="flex-1 min-w-0">
          <p style={textBodySm}>{renderMarkdown(action.title)}</p>
          {action.description && (
            <p style={labelTertiaryLine}>{renderMarkdown(action.description)}</p>
          )}

          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 'var(--space-2)' }}>
            {action.investorName && (
              <span className="flex items-center gap-1" style={{ ...stFontXs, color: 'var(--accent)' }}>
                <span style={flexIcon}><Users className="w-3 h-3" /></span>{action.investorName}</span>
            )}
            <span className="badge badge-zinc" style={{ fontSize: 'var(--font-size-xs)' }}>
              <span style={flexIcon}><Clock className="w-3 h-3" /></span>{action.timeEstimate}</span></div></div>

        <Link
          href={action.link}
          className="btn btn-primary btn-sm shrink-0">
          {action.category === 'followup' && action.investorName
            ? `Write to ${action.investorName.split(' ')[0] || 'them'}`
            : action.category === 'outreach'
            ? 'Start outreach'
            : action.category === 'preparation'
            ? 'Prepare now'
            : action.category === 'escalation'
            ? 'Address now'
            : action.category === 'meeting'
            ? 'Open prep'
            : 'Take action'}
          <span style={flexIcon}><ArrowRight className="w-3 h-3" /></span></Link></div>
    </div>);
}

function AlertCard({ alert }: { alert: BriefingAlert }) {
  const style = ALERT_STYLES[alert.type] ?? ALERT_STYLES.warning;
  const Icon = style.icon;

  // Smart routing based on alert type and content
  const alertContent = (alert.title + ' ' + alert.detail).toLowerCase();
  const alertLink = alert.type === 'opportunity'
    ? (alertContent.includes('term sheet') ? '/pipeline?stage=term_sheet'
      : alertContent.includes('dd') || alertContent.includes('diligence') ? '/pipeline?stage=in_dd'
      : '/pipeline')
    : alert.type === 'risk'
    ? (alertContent.includes('stall') || alertContent.includes('momentum') ? '/dealflow'
      : alertContent.includes('objection') ? '/focus'
      : '/dealflow')
    : '/focus';

  const alertAction = alert.type === 'opportunity'
    ? (alertContent.includes('term sheet') ? 'Review term sheets'
      : alertContent.includes('dd') || alertContent.includes('diligence') ? 'Track DD progress'
      : 'See opportunity')
    : alert.type === 'risk'
    ? (alertContent.includes('stall') || alertContent.includes('momentum') ? 'Re-engage investors'
      : alertContent.includes('objection') ? 'Address objections'
      : 'Mitigate risk')
    : 'Review';

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3) var(--space-4)', }}>
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5" style={{ color: style.color, ...flexIcon }}>
          <Icon className="w-4 h-4" /></span>
        <div className="flex-1 min-w-0">
          <p style={textBodySm}>{renderMarkdown(alert.title)}</p>
          <p style={{ ...labelTertiary, marginTop: 'var(--space-0)' }}>{renderMarkdown(alert.detail)}</p></div>
        <Link
          href={alertLink}
          className="shrink-0 flex items-center gap-1 transition-colors hover-bg-fg6"
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 400,
            color: style.color,
            textDecoration: 'none',
            padding: 'var(--space-1) var(--space-2)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--fg-3)',
            whiteSpace: 'nowrap', }}>
          {alertAction}
          <span style={flexIcon}><ChevronRight className="w-3 h-3" /></span></Link></div>
    </div>);
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

interface RaiseProgress {
  daysElapsed: number;
  targetDays: number;
  daysRemaining: number;
  pct: number;
  isOver: boolean;
}

export default function TodayPage() {
  const { toast } = useToast();
  const [data, setData] = useState<BriefingData | null>(null);
  const [insight, setInsight] = useState<{ title: string; detail: string; priority: string } | null>(null);
  const [raiseProgress, setRaiseProgress] = useState<RaiseProgress | null>(null);
  const [overnight, setOvernight] = useState<{
    statusChanges: { investorId: string; investorName: string; from: string; to: string }[];
    newMeetings: number;
    meetingNames: string[];
    tasksCompleted: number;
    activityFeed: string[];
  } | null>(null);
  const [dueFollowups, setDueFollowups] = useState<{
    id: string; investor_id: string; investor_name: string;
    action_type: string; description: string; due_at: string; status: string;
  }[]>([]);
  const [completingFollowupId, setCompletingFollowupId] = useState<string | null>(null);
  const [readinessAlerts, setReadinessAlerts] = useState<{
    investorId: string; investorName: string; readinessScore: number;
    readinessLevel: string; blockingFactors: string[];
  }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stalenessMinutes, setStalenessMinutes] = useState(0);
  const lastFetchedAt = useRef<number>(Date.now());

  const fetchBriefing = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    let stratRes: Response | null = null;
    let velRes: Response | null = null;
    let pulseRes: Response | null = null;
    let fuRes: Response | null = null;
    let readyRes: Response | null = null;
    try {
      const results = await Promise.all([
        cachedFetch('/api/briefing'),
        cachedFetch('/api/intelligence/strategic').catch(() => null),
        cachedFetch('/api/velocity').catch(() => null),
        cachedFetch('/api/pulse').catch(() => null),
        cachedFetch('/api/followups?status=pending').catch(() => null),
        cachedFetch('/api/readiness').catch(() => null),]);
      const res = results[0]!;
      stratRes = results[1]; velRes = results[2]; pulseRes = results[3]; fuRes = results[4]; readyRes = results[5];
      if (res.ok) {
        setData(await res.json());
        lastFetchedAt.current = Date.now();
        setStalenessMinutes(0);
      } else {
        if (!silent) toast('Couldn\'t load today\'s briefing — try refreshing', 'error');
      }
    } catch (e) {
      console.warn('[TODAY_BRIEFING]', e instanceof Error ? e.message : e);
      if (!silent) toast('Couldn\'t load today\'s briefing — try refreshing', 'error');
    }

    // Process secondary data (fetched in parallel above)
    try {
      if (stratRes?.ok) {
        const stratData = await stratRes.json();
        const rec = stratData.recommendations?.[0];
        if (rec) {
          setInsight({ title: rec.title, detail: rec.rationale ?? rec.action, priority: String(rec.priority) });
        }}
      if (velRes?.ok) {
        const velData = await velRes.json();
        const elapsed = velData.summary?.raise_days_elapsed ?? 0;
        const target = velData.summary?.raise_target_days ?? 60;
        setRaiseProgress({
          daysElapsed: elapsed,
          targetDays: target,
          daysRemaining: Math.max(0, target - elapsed),
          pct: Math.min(100, Math.round((elapsed / target) * 100)),
          isOver: elapsed > target,});
      }
      if (pulseRes?.ok) {
        const pulseData = await pulseRes.json();
        if (pulseData.overnight) {
          setOvernight({
            statusChanges: pulseData.overnight.statusChanges ?? [],
            newMeetings: pulseData.overnight.newMeetings ?? 0,
            meetingNames: pulseData.overnight.meetingNames ?? [],
            tasksCompleted: pulseData.overnight.tasksCompleted ?? 0,
            activityFeed: pulseData.overnight.activityFeed ?? [],});
        }}
      if (fuRes?.ok) {
        const fuData = await fuRes.json();
        const today = new Date().toISOString().split('T')[0];
        const due = (Array.isArray(fuData) ? fuData : []).filter((f: { due_at: string; status: string }) => {
          const dueDate = f.due_at?.split('T')[0];
          return f.status === 'pending' && dueDate && dueDate <= today;});
        setDueFollowups(due);
      }
      if (readyRes?.ok) {
        const readyData = await readyRes.json();
        const stalled = (readyData.investors ?? []).filter((r: { readinessLevel: string; tier: number }) =>
          (r.readinessLevel === 'stalled' || r.readinessLevel === 'cold') && r.tier <= 2
        ).slice(0, 5);
        setReadinessAlerts(stalled);
      }
    } catch (e) {
      console.warn('[TODAY_SECONDARY]', e instanceof Error ? e.message : e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { document.title = 'Raise | Morning Briefing'; }, []);
  const silentRefresh = useCallback(() => fetchBriefing(true), []);
  useRefreshInterval(silentRefresh, 5 * MS_PER_MINUTE);
  useEffect(() => {
    const stalenessInterval = setInterval(() => {
      setStalenessMinutes(Math.floor((Date.now() - lastFetchedAt.current) / MS_PER_MINUTE));
    }, 30000);
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) fetchBriefing(true);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearInterval(stalenessInterval);
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleQuickComplete(id: string) {
    setCompletingFollowupId(id);
    try {
      const res = await fetch('/api/followups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'completed' }),});
      if (!res.ok) throw new Error('Server error');
      setDueFollowups(prev => prev.filter(f => f.id !== id));
      toast('Follow-up completed — engagement data updated', 'success');
    } catch (e) {
      console.warn('[TODAY_COMPLETE]', e instanceof Error ? e.message : e);
      toast('Couldn\'t complete follow-up — try again', 'error');
    }
    setCompletingFollowupId(null);
  }

  async function handleQuickSkip(id: string) {
    setCompletingFollowupId(id);
    try {
      const res = await fetch('/api/followups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'skipped' }),});
      if (!res.ok) throw new Error('Server error');
      setDueFollowups(prev => prev.filter(f => f.id !== id));
      toast('Follow-up skipped', 'success');
    } catch (e) {
      console.warn('[TODAY_SKIP]', e instanceof Error ? e.message : e);
      toast('Couldn\'t skip follow-up — try again', 'error');
    }
    setCompletingFollowupId(null);
  }

  const todayDate = new Date().toISOString().split('T')[0];
  const { overdueFollowups, dueTodayFollowups } = useMemo(() => {
    const overdue: typeof dueFollowups = [];
    const dueToday: typeof dueFollowups = [];
    for (const f of dueFollowups) {
      const d = f.due_at?.split('T')[0];
      if (d && d < todayDate) overdue.push(f);
      else if (d === todayDate) dueToday.push(f);
    }
    return { overdueFollowups: overdue, dueTodayFollowups: dueToday };
  }, [dueFollowups, todayDate]);

  // Loading skeleton
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '860px' }}>
        <div>
          <div className="skeleton" style={{ height: '36px', width: '320px' }} />
          <div className="skeleton" style={{ height: '16px', width: '220px', marginTop: 'var(--space-2)' }} />
          <div className="skeleton" style={{ height: '14px', width: '480px', marginTop: 'var(--space-3)' }} /></div>
        <div>
          <div className="skeleton" style={{ height: '12px', width: '140px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ height: '88px', borderRadius: 'var(--radius-lg)' }} /></div>
        <div>
          <div className="skeleton" style={{ height: '12px', width: '140px', marginBottom: 'var(--space-3)' }} />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ ...skelCardSm, marginBottom: 'var(--space-2)' }}
              />
          ))}</div>
        <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-3)' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '72px', borderRadius: 'var(--radius-lg)' }} />
          ))}</div>
        <div className="skeleton" style={skelRow} />
        <div className="skeleton" style={{ height: '56px', borderRadius: 'var(--radius-lg)' }} />
      </div>);
  }

  if (!data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', maxWidth: '860px' }}>
        <h1 className="page-title">Morning Briefing</h1>
        <div className="text-center" style={{ background: 'var(--danger-muted)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-10)' }}>
          <p style={{ ...stTextSecondary, marginBottom: 'var(--space-4)' }}>Your morning briefing couldn&apos;t load. This usually means a temporary connection issue — try again.</p>
          <button onClick={() => fetchBriefing()} className="btn btn-secondary btn-md">
            Reload Briefing</button></div>
      </div>);
  }

  const momentumConfig = MOMENTUM_CONFIG[data.momentum] ?? MOMENTUM_CONFIG.steady;
  const MomentumIcon = momentumConfig.icon;

  // Derive forecast status from the forecast string
  const forecastLower = data.pipelineSnapshot.forecast.toLowerCase();
  let forecastColor = 'var(--text-secondary)';
  let forecastDotClass = 'status-dot-blue';
  if (forecastLower.startsWith('on track')) {
    forecastColor = 'var(--success)';
    forecastDotClass = 'status-dot-green';
  } else if (forecastLower.startsWith('behind') || forecastLower.startsWith('early')) {
    forecastColor = 'var(--warning)';
    forecastDotClass = 'status-dot-amber';
  } else if (forecastLower.includes('insufficient') || forecastLower.includes('need')) {
    forecastColor = 'var(--danger)';
    forecastDotClass = 'status-dot-red';
  }

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '860px', position: 'relative' }}>

      {refreshing && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--accent)', borderRadius: '1px', animation: 'pulse 1.5s ease-in-out infinite', zIndex: 10 }}
          />
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">
            {data.greeting}</h1>
          <p style={{ ...stFontSm, color: 'var(--text-tertiary)', marginTop: 'var(--space-0)' }}>{fmtDateFull(new Date())}</p>

          <div className="flex items-center gap-2" style={{ marginTop: 'var(--space-1)' }}>
            <span style={{ ...stFontXs, color: stalenessMinutes >= 5 ? 'var(--warning)' : 'var(--text-muted)', transition: 'color 300ms ease' }}>{stalenessMinutes < 1 ? 'Updated just now' : `Updated ${stalenessMinutes}m ago`}</span>
            <button onClick={() => fetchBriefing(true)} disabled={refreshing} aria-label="Refresh briefing" title="Refresh briefing" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', cursor: refreshing ? 'default' : 'pointer', color: stalenessMinutes >= 5 ? 'var(--warning)' : 'var(--text-muted)', opacity: refreshing ? 0.5 : 1, transition: 'color 300ms ease, opacity 150ms ease', padding: 0 }}>
              <span style={{ ...flexIcon, animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
                <RefreshCw className="w-3 h-3" /></span></button></div>

          <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginTop: 'var(--space-3)', lineHeight: 1.6, maxWidth: '640px' }}>{renderMarkdown(data.todaySummary)}</p>
        </div>

        <button
          onClick={() => fetchBriefing(true)}
          className="btn btn-ghost btn-sm shrink-0"
          style={{ opacity: refreshing ? 0.5 : 1 }}
          disabled={refreshing}
          aria-label="Refresh briefing"
          title="Refresh briefing">
          <span style={{ ...flexIcon, animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
            <RefreshCw className="w-3.5 h-3.5" /></span></button></div>

      {/* ----------------------------------------------------------------- */}
      {/* 1.5. Raise Day Counter                                            */}
      {/* ----------------------------------------------------------------- */}
      {raiseProgress && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-lg)', background: 'var(--surface-1)' }}>
          <div className="flex items-center gap-2 shrink-0">
            <span style={{ color: 'var(--accent)', ...flexIcon }}><Target className="w-4 h-4" /></span>
            <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 300, fontVariantNumeric: 'tabular-nums', color: raiseProgress.isOver ? 'var(--danger)' : raiseProgress.pct >= 75 ? 'var(--warning)' : 'var(--text-primary)' }}>Day {raiseProgress.daysElapsed}</span>
            <span style={labelMuted}>of {raiseProgress.targetDays}</span></div>
          <div style={{ flex: 1, height: '6px', background: 'var(--surface-3)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <div style={{ width: `${raiseProgress.pct}%`, height: '100%', borderRadius: 'var(--radius-sm)', background: raiseProgress.isOver ? 'var(--danger)' : raiseProgress.pct >= 75 ? 'var(--warning)' : 'var(--accent)', transition: 'width 600ms ease' }}
              /></div>
          <span style={{ ...stFontXs, fontWeight: 400, fontVariantNumeric: 'tabular-nums', color: raiseProgress.isOver ? 'var(--danger)' : raiseProgress.daysRemaining <= 14 ? 'var(--warning)' : 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{raiseProgress.isOver ? `+${raiseProgress.daysElapsed - raiseProgress.targetDays}d over` : `${raiseProgress.daysRemaining}d left`}</span>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 1.6. Pipeline Pulse (moved above overnight for CEO hierarchy)      */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <div className="section-title">Pipeline Pulse</div>
        <div className="grid grid-cols-2 lg:grid-cols-4" style={gridGap3}>
          <Link href="/pipeline" className="card hover-border" style={linkCardPad}>
            <div className="metric-label">Active</div>
            <div className="metric-value" style={{ fontSize: 'var(--font-size-xl)', marginTop: 'var(--space-1)', color: 'var(--text-primary)' }}>{data.pipelineSnapshot.totalActive}</div></Link>
          <Link href="/pipeline?stage=in_dd" className="card hover-border" style={linkCardPad}>
            <div className="metric-label">In DD</div>
            <div className="metric-value" style={{ fontSize: 'var(--font-size-xl)', marginTop: 'var(--space-1)', color: data.pipelineSnapshot.inDD > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{data.pipelineSnapshot.inDD}</div></Link>
          <Link href="/pipeline?stage=term_sheet" className="card hover-border" style={linkCardPad}>
            <div className="metric-label">Term Sheets</div>
            <div className="metric-value" style={{ fontSize: 'var(--font-size-xl)', marginTop: 'var(--space-1)', color: data.pipelineSnapshot.termSheets > 0 ? 'var(--success)' : 'var(--text-muted)' }}>{data.pipelineSnapshot.termSheets}</div></Link>
          <div className="card" style={cardPad4}>
            <div className="flex items-center gap-1.5">
              <div className={forecastDotClass} style={{ width: '6px', height: '6px' }} />
              <div className="metric-label">Forecast</div></div>
            <p style={{ ...stFontXs, color: forecastColor, marginTop: 'var(--space-1)', lineHeight: 1.4 }}>{data.pipelineSnapshot.forecast}</p></div></div></div>

      {/* ----------------------------------------------------------------- */}
      {/* 1.7. Overnight Changes                                            */}
      {/* ----------------------------------------------------------------- */}
      {overnight && (overnight.statusChanges.length > 0 || overnight.newMeetings > 0 || overnight.tasksCompleted > 0) && (
        <div className="rounded-xl" style={{ background: 'var(--surface-1)', overflow: 'hidden' }}>
          <div className="flex items-center gap-2" style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
            <Zap className="w-3.5 h-3.5" style={{ color: 'var(--chart-4)' }} />
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--chart-4)', letterSpacing: '0.01em' }}>Since Yesterday</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap" style={{ padding: 'var(--space-3) var(--space-4)' }}>
            {overnight.statusChanges.map(sc => (
              <div key={`${sc.investorId}-${sc.from}-${sc.to}`} className="flex items-center gap-1.5" style={stFontXs}>
                <ArrowUpRight className="w-3 h-3" style={stTextSecondary} />
                <Link
                  href={`/investors/${sc.investorId}`}
                  className="investor-link"
                  style={investorLinkAccent}>
                  {sc.investorName}</Link>
                <span style={stTextMuted}>{sc.from.replace(/_/g, ' ')} → {sc.to.replace(/_/g, ' ')}</span></div>
            ))}
            {overnight.newMeetings > 0 && (
              <div className="flex items-center gap-1.5" style={stFontXs}>
                <Calendar className="w-3 h-3" style={stAccent} />
                <span style={stTextSecondary}>{overnight.newMeetings} new meeting{overnight.newMeetings > 1 ? 's' : ''}</span>
              </div>
            )}
            {overnight.tasksCompleted > 0 && (
              <div className="flex items-center gap-1.5" style={stFontXs}>
                <CheckCircle className="w-3 h-3" style={stTextSecondary} />
                <span style={stTextSecondary}>{overnight.tasksCompleted} task{overnight.tasksCompleted > 1 ? 's' : ''} completed</span>
              </div>
            )}</div></div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 1.7. Critical Overdue Follow-ups                                  */}
      {/* ----------------------------------------------------------------- */}
      {overdueFollowups.length > 0 && (
        <div style={{ background: 'var(--danger-muted)', borderLeft: '3px solid var(--danger)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-3)' }}>
            <span style={{ color: 'var(--danger)', ...flexIcon }}><AlertTriangle className="w-4 h-4" /></span>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--danger)', letterSpacing: '0.01em' }}>Critical Overdue</span>
            <span style={{ ...labelMuted, marginLeft: 'auto' }}>{overdueFollowups.length} action{overdueFollowups.length > 1 ? 's' : ''}</span>
          </div>
          <div style={flexColGap2}>
            {overdueFollowups.map(fu => {
              const daysOver = Math.floor((Date.now() - new Date(fu.due_at).getTime()) / MS_PER_DAY);
              const isProcessing = completingFollowupId === fu.id;
              return (
                <div key={fu.id} className="flex items-center gap-3" style={{ padding: 'var(--space-2) 0', opacity: isProcessing ? 0.5 : 1, transition: 'opacity 150ms' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/investors/${fu.investor_id}`} style={overdueInvLink}>{fu.investor_name}</Link>
                      <span style={overdueBadge}>{fu.action_type.replace(/_/g, ' ')}</span>
                      <span style={overdueDanger}>{daysOver}d overdue</span></div>
                    <p className="truncate" style={overdueDesc}>{fu.description}</p>
                  </div>
                  <button onClick={() => handleQuickComplete(fu.id)} disabled={isProcessing} className="btn btn-sm shrink-0" style={overdueDoneBtn}>
                    Mark Done</button>
                </div>);
            })}</div></div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 2. Today's Meetings                                               */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <div className="section-title">Today&apos;s Meetings</div>

        {data.todayMeetings.length > 0 ? (
          <div style={flexColGap2}>
            {data.todayMeetings.map((meeting, idx) => (
              <MeetingCard key={idx} meeting={meeting} />
            ))}</div>
        ) : (
          <div className="card" style={emptyStatePad}>
            <span style={emptyStateIcon}><Calendar className="w-8 h-8" style={stTextMuted} /></span>
            <p style={emptyStateText}>No meetings scheduled today</p>
            <p style={{ ...labelTertiary, marginTop: 'var(--space-1)', lineHeight: 1.5 }}>Use the open calendar to schedule follow-ups with your highest-momentum investors, or work through overdue actions.</p>
            <div className="flex items-center justify-center gap-2" style={{ marginTop: 'var(--space-3)' }}>
              <Link href="/focus" className="btn btn-primary btn-sm">
                Schedule high-momentum follow-ups</Link>
              <Link href="/followups" className="btn btn-secondary btn-sm">
                Clear overdue actions</Link></div></div>
        )}</div>

      {/* ----------------------------------------------------------------- */}
      {/* 3. Priority Actions                                               */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <div className="section-title">Priority Actions</div>

        {data.urgentActions.length > 0 ? (
          <div style={flexColGap2}>
            {data.urgentActions.map((action, idx) => (
              <ActionCard key={idx} action={action} />
            ))}</div>
        ) : (
          <div className="card" style={emptyStatePad}>
            <span style={emptyStateIcon}><CheckCircle className="w-8 h-8" style={stTextSecondary} /></span>
            <p style={emptyStateText}>No urgent actions right now</p>
            <p style={{ ...labelTertiary, marginTop: 'var(--space-1)', lineHeight: 1.5 }}>Good time to advance stalled conversations or prepare materials for upcoming deep dives. Check the{' '}<Link href="/focus" style={{ color: 'var(--accent)', textDecoration: 'none' }}>focus queue</Link>{' '}for investors who need a push.</p>
            <div className="flex items-center justify-center gap-2" style={{ marginTop: 'var(--space-3)' }}>
              <Link href="/pipeline?sort=momentum" className="btn btn-secondary btn-sm">
                Review stalled investors</Link>
              <Link href="/intelligence" className="btn btn-secondary btn-sm">
                Refresh competitive intel</Link></div></div>
        )}</div>

      {/* ----------------------------------------------------------------- */}
      {/* 3.5 Due Follow-ups (inline quick-complete)                        */}
      {/* ----------------------------------------------------------------- */}
      {dueTodayFollowups.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <div className="section-title">Follow-ups Due</div>
            <Link href="/followups" style={{ ...labelMuted, textDecoration: 'underline' }}>
              View all</Link></div>
          <div style={flexColGap2}>
            {dueTodayFollowups.map(fu => {
              const tc = FOLLOWUP_TYPE_CONFIG[fu.action_type] || { label: fu.action_type, color: 'var(--text-tertiary)', bg: 'var(--surface-2)' };
              const isProcessing = completingFollowupId === fu.id;
              return (
                <div key={fu.id} className="card" style={{ padding: 'var(--space-3)', opacity: isProcessing ? 0.5 : 1, transition: 'opacity 150ms' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{ background: tc.bg, color: tc.color, fontWeight: 400 }}>
                      {tc.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={fontSmPrimary}>
                        {fu.description}</p>
                      <div className="flex items-center gap-2" style={mtSpace0}>
                        <Link href={`/investors/${fu.investor_id}`} style={investorLinkXs}>
                          {fu.investor_name}</Link></div></div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleQuickComplete(fu.id)}
                        disabled={isProcessing}
                        className="btn btn-sm"
                        style={doneButtonStyle}>
                        Done</button>
                      <button
                        onClick={() => handleQuickSkip(fu.id)}
                        disabled={isProcessing}
                        className="btn btn-sm"
                        style={skipButtonStyle}>
                        Skip</button></div></div>
                </div>);
            })}</div></div>
      )}

      {/* Pipeline Pulse — moved to earlier section */}

      {/* ----------------------------------------------------------------- */}
      {/* 4.5. This Week Summary                                            */}
      {/* ----------------------------------------------------------------- */}
      {(() => {
        const weekMeetings = data.todayMeetings.length + (overnight?.newMeetings ?? 0);
        const weekStageChanges = overnight?.statusChanges?.length ?? 0;
        const weekTasksDone = overnight?.tasksCompleted ?? 0;
        const weekNewInvestors = overnight?.statusChanges?.filter((sc: { from: string }) => sc.from === 'unknown' || sc.from === 'identified')?.length ?? 0;
        if (weekMeetings + weekStageChanges + weekTasksDone === 0) return null;
        return (
          <div>
            <div className="section-title">This Week</div>
            <div className="grid grid-cols-2 lg:grid-cols-4" style={gridGap3}>
              {[
                { label: 'Meetings', value: weekMeetings, icon: Calendar, color: 'var(--accent)' },
                { label: 'New investors', value: weekNewInvestors, icon: UserPlus, color: 'var(--chart-4)' },
                { label: 'Stage changes', value: weekStageChanges, icon: ArrowRight, color: 'var(--text-secondary)' },
                { label: 'Tasks done', value: weekTasksDone, icon: CheckCircle, color: 'var(--success)' },
              ].map(m => {
                const Icon = m.icon;
                return (
                  <div key={m.label} className="card" style={metricCardPad}>
                    <div className="flex items-center gap-2">
                      <span style={{ color: m.color, ...flexIcon }}><Icon className="w-3.5 h-3.5" /></span>
                      <span style={labelMuted}>{m.label}</span></div>
                    <div className="tabular-nums" style={metricValue}>{m.value}</div>
                  </div>);
              })}
            </div></div>);
      })()}

      {/* ----------------------------------------------------------------- */}
      {/* 5. Alerts                                                         */}
      {/* ----------------------------------------------------------------- */}
      {data.alerts.length > 0 && (
        <div>
          <div className="section-title">Alerts</div>
          <div style={flexColGap2}>
            {data.alerts.map((alert, idx) => (
              <AlertCard key={idx} alert={alert} />
            ))}</div></div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 6. Momentum Indicator                                             */}
      {/* ----------------------------------------------------------------- */}
      <div style={{ background: momentumConfig.bg, border: `1px solid ${momentumConfig.border}`, borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center shrink-0" style={{ width: '36px', height: '36px', borderRadius: '50%', background: momentumConfig.bg, border: `1px solid ${momentumConfig.border}` }}>
            <span style={{ color: momentumConfig.color, ...flexIcon }}>
              <MomentumIcon className="w-5 h-5" /></span></div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: momentumConfig.color }}>
                {momentumConfig.label}</p>
              <span style={{ ...stFontXs, padding: 'var(--space-0) var(--space-1)', borderRadius: 'var(--radius-sm)', background: momentumConfig.bg, border: `1px solid ${momentumConfig.border}`, color: momentumConfig.color, fontWeight: 400 }}>Raise Momentum</span>
            </div>
            <p style={{ ...stFontXs, color: 'var(--text-secondary)', marginTop: 'var(--space-0)', lineHeight: 1.5 }}>{data.momentumChange}</p>
          </div>

          <Link
            href="/dealflow"
            className="btn btn-ghost btn-sm shrink-0 sidebar-link"
            style={stTextTertiary}>
            {data.momentum === 'stalled' ? 'Diagnose' : data.momentum === 'decelerating' ? 'Investigate' : 'View dealflow'}
            <span style={flexIcon}><ChevronRight className="w-3.5 h-3.5" /></span></Link></div></div>

      {/* ----------------------------------------------------------------- */}
      {/* 7. AI Insight                                                      */}
      {/* ----------------------------------------------------------------- */}
      {/* Readiness Alerts — investors that need attention */}
      {readinessAlerts.length > 0 && (
        <div style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', background: 'var(--surface-1)' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--warning)', ...flexIcon }}>
                <Target className="w-4 h-4" /></span>
              <span style={{ ...stFontSm, fontWeight: 400, color: 'var(--text-primary)' }}>
                Readiness alerts</span>
              <span style={{ ...stFontXs, color: 'var(--text-muted)' }}>
                {readinessAlerts.length} investor{readinessAlerts.length !== 1 ? 's' : ''} stalled</span></div>
            <Link href="/dealflow?sort=readiness" className="btn btn-ghost btn-sm shrink-0 investor-link" style={stTextSecondary}>
              View all <span style={flexIcon}><ChevronRight className="w-3.5 h-3.5" /></span></Link></div>
          <div style={flexColGap2}>
            {readinessAlerts.map(r => (
              <Link key={r.investorId} href={`/investors/${r.investorId}`}
                className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors hover-surface-2"
                style={{ textDecoration: 'none' }}>
                <span className="tabular-nums shrink-0" style={{
                  fontSize: 'var(--font-size-sm)', fontWeight: 400,
                  color: r.readinessScore >= 45 ? 'var(--warning)' : 'var(--danger)',
                }}>{r.readinessScore}</span>
                <div className="flex-1 min-w-0">
                  <span style={{ ...stFontSm, fontWeight: 400, color: 'var(--text-primary)' }}>{r.investorName}</span>
                  {r.blockingFactors.length > 0 && (
                    <p className="truncate" style={{ ...stFontXs, color: 'var(--text-tertiary)', ...mtSpace0 }}>
                      {r.blockingFactors[0]}</p>
                  )}
                </div>
                <span style={flexIcon}><ArrowUpRight className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /></span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {insight && (
        <div style={{ background: 'var(--accent-muted)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center shrink-0" style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-md)', background: 'var(--accent-10)' }}>
              <span style={{ color: 'var(--accent)', ...flexIcon }}>
                <Sparkles className="w-4 h-4" /></span></div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-1)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--accent)', letterSpacing: '0.01em' }}>
                  AI Insight</span></div>
              <p style={textBodySm}>{insight.title}</p>
              <p style={{ ...stFontXs, color: 'var(--text-secondary)', marginTop: 'var(--space-1)', lineHeight: 1.5 }}>{insight.detail}</p>
            </div>

            <Link
              href="/intelligence"
              className="btn btn-ghost btn-sm shrink-0 investor-link"
              style={stTextSecondary}>
              See more
              <span style={flexIcon}><ChevronRight className="w-3.5 h-3.5" /></span></Link></div></div>
      )}

      {/* Footer spacer */}
      <div style={{ height: 'var(--space-4)' }} />
    </div>);
}

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import {
  Sunrise, Calendar, Clock, ArrowRight, ChevronRight, RefreshCw,
  Mail, UserPlus, FileText, AlertTriangle, Zap, TrendingUp,
  TrendingDown, Minus, Users, Shield, Target,
  CheckCircle, ExternalLink, Sparkles, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

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

interface BriefingAlert {
  type: 'warning' | 'opportunity' | 'risk';
  title: string;
  detail: string;
}

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
  meeting: Calendar,
};

const CATEGORY_COLORS: Record<string, string> = {
  followup: 'var(--accent)',
  outreach: 'var(--chart-4)',
  preparation: 'var(--cat-teal)',
  escalation: 'var(--danger)',
  meeting: 'var(--warning)',
};

const CATEGORY_BG: Record<string, string> = {
  followup: 'var(--accent-muted)',
  outreach: 'var(--cat-purple-muted)',
  preparation: 'var(--cat-teal-muted)',
  escalation: 'var(--danger-muted)',
  meeting: 'var(--warning-muted)',
};

const ALERT_STYLES: Record<string, { bg: string; border: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  warning: { bg: 'var(--warning-muted)', border: 'rgba(26, 26, 46, 0.05)', color: 'var(--warning)', icon: AlertTriangle },
  opportunity: { bg: 'var(--success-muted)', border: 'rgba(27, 42, 74, 0.08)', color: 'var(--success)', icon: Zap },
  risk: { bg: 'var(--danger-muted)', border: 'rgba(26, 26, 46, 0.06)', color: 'var(--danger)', icon: Shield },
};

const MOMENTUM_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  accelerating: { color: 'var(--success)', bg: 'var(--success-muted)', border: 'rgba(27, 42, 74, 0.08)', icon: TrendingUp, label: 'Accelerating' },
  steady: { color: 'var(--text-secondary)', bg: 'var(--surface-2)', border: 'var(--border-default)', icon: Minus, label: 'Steady' },
  decelerating: { color: 'var(--warning)', bg: 'var(--warning-muted)', border: 'rgba(26, 26, 46, 0.05)', icon: TrendingDown, label: 'Decelerating' },
  stalled: { color: 'var(--danger)', bg: 'var(--danger-muted)', border: 'rgba(26, 26, 46, 0.06)', icon: TrendingDown, label: 'Stalled' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MeetingCard({ meeting }: { meeting: BriefingMeeting }) {
  const [hovered, setHovered] = useState(false);

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
      className="card"
      style={{
        padding: 'var(--space-4)',
        borderColor: hovered ? 'var(--border-default)' : 'var(--border-subtle)',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent-muted)',
          }}
        >
          <span style={{ color: 'var(--accent)', fontSize: 'var(--font-size-xs)', fontWeight: 700, textAlign: 'center', lineHeight: 1.1 }}>
            {timeDisplay}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {meeting.investorName}
            </span>
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 500,
                background: 'var(--surface-2)',
                color: 'var(--text-tertiary)',
                border: '1px solid var(--border-default)',
              }}
            >
              {meeting.type.replace(/_/g, ' ')}
            </span>
            {(meeting.meetingCount ?? 0) > 1 && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                Meeting #{meeting.meetingCount}
              </span>
            )}
            {(meeting.enthusiasm ?? 0) > 0 && (
              <span
                className="inline-flex items-center gap-0.5"
                style={{
                  fontSize: '10px',
                  fontWeight: 500,
                  color: (meeting.enthusiasm ?? 0) >= 4 ? 'var(--success)' : (meeting.enthusiasm ?? 0) >= 3 ? 'var(--text-secondary)' : 'var(--danger)',
                }}
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <span
                    key={n}
                    style={{
                      width: '5px', height: '5px', borderRadius: '50%', display: 'inline-block',
                      background: n <= (meeting.enthusiasm ?? 0)
                        ? (meeting.enthusiasm ?? 0) >= 4 ? 'var(--success)' : (meeting.enthusiasm ?? 0) >= 3 ? 'var(--accent)' : 'var(--text-muted)'
                        : 'var(--border-default)',
                    }}
                  />
                ))}
              </span>
            )}
          </div>

          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
            {renderMarkdown(meeting.keyPoint)}
          </p>
        </div>

        <div className="flex gap-1.5 shrink-0">
          <Link
            href={meeting.prepLink}
            className="btn btn-secondary btn-sm"
          >
            Prep
          </Link>
          <Link
            href={meeting.captureLink || '/meetings/capture'}
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}
          >
            Capture
          </Link>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ action }: { action: UrgentAction }) {
  const [hovered, setHovered] = useState(false);
  const Icon = CATEGORY_ICONS[action.category] || FileText;
  const iconColor = CATEGORY_COLORS[action.category] || 'var(--text-tertiary)';
  const iconBg = CATEGORY_BG[action.category] || 'var(--surface-2)';

  return (
    <div
      className="card"
      style={{
        padding: 'var(--space-4)',
        borderColor: hovered ? 'var(--border-default)' : 'var(--border-subtle)',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-md)',
            background: iconBg,
          }}
        >
          <span style={{ color: iconColor, display: 'flex' }}>
            <Icon className="w-4 h-4" />
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {renderMarkdown(action.title)}
          </p>

          {action.description && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '2px', lineHeight: 1.5 }}>
              {renderMarkdown(action.description)}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: '8px' }}>
            {action.investorName && (
              <span
                className="flex items-center gap-1"
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}
              >
                <span style={{ display: 'flex' }}><Users className="w-3 h-3" /></span>
                {action.investorName}
              </span>
            )}
            <span
              className="badge badge-zinc"
              style={{ fontSize: '10px' }}
            >
              <span style={{ display: 'flex' }}><Clock className="w-3 h-3" /></span>
              {action.timeEstimate}
            </span>
          </div>
        </div>

        <Link
          href={action.link}
          className="btn btn-primary btn-sm shrink-0"
        >
          Do it
          <span style={{ display: 'flex' }}><ArrowRight className="w-3 h-3" /></span>
        </Link>
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: BriefingAlert }) {
  const style = ALERT_STYLES[alert.type] ?? ALERT_STYLES.warning;
  const Icon = style.icon;

  // Smart routing based on alert type and content
  const alertLink = alert.type === 'opportunity' ? '/pipeline'
    : alert.type === 'risk' ? '/dealflow'
    : '/focus';

  const alertAction = alert.type === 'opportunity' ? 'View Pipeline'
    : alert.type === 'risk' ? 'View Dealflow'
    : 'Review';

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-3) var(--space-4)',
      }}
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 mt-0.5" style={{ color: style.color, display: 'flex' }}>
          <Icon className="w-4 h-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
            {renderMarkdown(alert.title)}
          </p>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            {renderMarkdown(alert.detail)}
          </p>
        </div>
        <Link
          href={alertLink}
          className="shrink-0 flex items-center gap-1"
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 500,
            color: style.color,
            textDecoration: 'none',
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(0,0,0,0.03)',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.03)'; }}
        >
          {alertAction}
          <span style={{ display: 'flex' }}><ChevronRight className="w-3 h-3" /></span>
        </Link>
      </div>
    </div>
  );
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stalenessMinutes, setStalenessMinutes] = useState(0);
  const lastFetchedAt = useRef<number>(Date.now());

  const fetchBriefing = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch('/api/briefing');
      if (res.ok) {
        setData(await res.json());
        lastFetchedAt.current = Date.now();
        setStalenessMinutes(0);
      } else {
        if (!silent) toast('Failed to load briefing', 'error');
      }
    } catch {
      if (!silent) toast('Failed to load briefing', 'error');
    }

    // Non-blocking: fetch velocity (for raise day counter), strategic insight, and pulse
    try {
      const [stratRes, velRes, pulseRes, fuRes] = await Promise.all([
        fetch('/api/intelligence/strategic').catch(() => null),
        fetch('/api/velocity').catch(() => null),
        fetch('/api/pulse').catch(() => null),
        fetch('/api/followups?status=pending').catch(() => null),
      ]);
      if (stratRes?.ok) {
        const stratData = await stratRes.json();
        const rec = stratData.recommendations?.[0];
        if (rec) {
          setInsight({ title: rec.title, detail: rec.rationale ?? rec.action, priority: String(rec.priority) });
        }
      }
      if (velRes?.ok) {
        const velData = await velRes.json();
        const elapsed = velData.summary?.raise_days_elapsed ?? 0;
        const target = velData.summary?.raise_target_days ?? 60;
        setRaiseProgress({
          daysElapsed: elapsed,
          targetDays: target,
          daysRemaining: Math.max(0, target - elapsed),
          pct: Math.min(100, Math.round((elapsed / target) * 100)),
          isOver: elapsed > target,
        });
      }
      if (pulseRes?.ok) {
        const pulseData = await pulseRes.json();
        if (pulseData.overnight) {
          setOvernight({
            statusChanges: pulseData.overnight.statusChanges ?? [],
            newMeetings: pulseData.overnight.newMeetings ?? 0,
            meetingNames: pulseData.overnight.meetingNames ?? [],
            tasksCompleted: pulseData.overnight.tasksCompleted ?? 0,
            activityFeed: pulseData.overnight.activityFeed ?? [],
          });
        }
      }
      if (fuRes?.ok) {
        const fuData = await fuRes.json();
        const today = new Date().toISOString().split('T')[0];
        const due = (Array.isArray(fuData) ? fuData : []).filter((f: { due_at: string; status: string }) => {
          const dueDate = f.due_at?.split('T')[0];
          return f.status === 'pending' && dueDate && dueDate <= today;
        });
        setDueFollowups(due);
      }
    } catch {
      // Non-blocking
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBriefing();
    const refreshInterval = setInterval(() => fetchBriefing(true), 5 * 60 * 1000);
    const stalenessInterval = setInterval(() => {
      setStalenessMinutes(Math.floor((Date.now() - lastFetchedAt.current) / 60000));
    }, 30000);
    return () => {
      clearInterval(refreshInterval);
      clearInterval(stalenessInterval);
    };
  }, [fetchBriefing]);

  async function handleQuickComplete(id: string) {
    setCompletingFollowupId(id);
    try {
      await fetch('/api/followups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'completed' }),
      });
      setDueFollowups(prev => prev.filter(f => f.id !== id));
      toast('Follow-up completed', 'success');
    } catch {
      toast('Failed to complete', 'error');
    }
    setCompletingFollowupId(null);
  }

  async function handleQuickSkip(id: string) {
    setCompletingFollowupId(id);
    try {
      await fetch('/api/followups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'skipped' }),
      });
      setDueFollowups(prev => prev.filter(f => f.id !== id));
      toast('Follow-up skipped', 'success');
    } catch {
      toast('Failed to skip', 'error');
    }
    setCompletingFollowupId(null);
  }

  // Loading skeleton
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '860px' }}>
        <div>
          <div className="skeleton" style={{ height: '36px', width: '320px' }} />
          <div className="skeleton" style={{ height: '16px', width: '220px', marginTop: 'var(--space-2)' }} />
          <div className="skeleton" style={{ height: '14px', width: '480px', marginTop: 'var(--space-3)' }} />
        </div>
        <div>
          <div className="skeleton" style={{ height: '12px', width: '140px', marginBottom: 'var(--space-3)' }} />
          <div className="skeleton" style={{ height: '88px', borderRadius: 'var(--radius-lg)' }} />
        </div>
        <div>
          <div className="skeleton" style={{ height: '12px', width: '140px', marginBottom: 'var(--space-3)' }} />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-2)' }} />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-3)' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '72px', borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: '64px', borderRadius: 'var(--radius-lg)' }} />
        <div className="skeleton" style={{ height: '56px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', maxWidth: '860px' }}>
        <h1 className="page-title">Morning Briefing</h1>
        <div
          className="text-center"
          style={{
            border: '1px solid rgba(26, 26, 46, 0.06)',
            background: 'var(--danger-muted)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-10)',
          }}
        >
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>Could not load briefing data.</p>
          <button onClick={() => fetchBriefing()} className="btn btn-secondary btn-md">
            Retry
          </button>
        </div>
      </div>
    );
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
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'var(--accent)',
          borderRadius: '1px',
          animation: 'pulse 1.5s ease-in-out infinite',
          zIndex: 10,
        }} />
      )}

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--surface-2)',
                border: '1px solid rgba(26, 26, 46, 0.05)',
              }}
            >
              <span style={{ color: 'var(--warning)', display: 'flex' }}>
                <Sunrise className="w-5 h-5" />
              </span>
            </div>
            <div>
              <h1
                className="page-title"
                style={{ fontSize: 'var(--font-size-2xl)' }}
              >
                {data.greeting}
              </h1>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2" style={{ marginTop: '6px' }}>
            <span style={{
              fontSize: 'var(--font-size-xs)',
              color: stalenessMinutes >= 5 ? 'var(--warning)' : 'var(--text-muted)',
              transition: 'color 300ms ease',
            }}>
              {stalenessMinutes < 1 ? 'Updated just now' : `Updated ${stalenessMinutes}m ago`}
            </span>
            <button
              onClick={() => fetchBriefing(true)}
              disabled={refreshing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'transparent',
                cursor: refreshing ? 'default' : 'pointer',
                color: stalenessMinutes >= 5 ? 'var(--warning)' : 'var(--text-muted)',
                opacity: refreshing ? 0.5 : 1,
                transition: 'color 300ms ease, opacity 150ms ease',
                padding: 0,
              }}
            >
              <span style={{ display: 'flex', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
                <RefreshCw className="w-3 h-3" />
              </span>
            </button>
          </div>

          <p style={{
            fontSize: 'var(--font-size-base)',
            color: 'var(--text-secondary)',
            marginTop: 'var(--space-3)',
            lineHeight: 1.6,
            maxWidth: '640px',
          }}>
            {renderMarkdown(data.todaySummary)}
          </p>
        </div>

        <button
          onClick={() => fetchBriefing(true)}
          className="btn btn-ghost btn-sm shrink-0"
          style={{ opacity: refreshing ? 0.5 : 1 }}
          disabled={refreshing}
        >
          <span style={{ display: 'flex', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>
            <RefreshCw className="w-3.5 h-3.5" />
          </span>
        </button>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 1.5. Raise Day Counter                                            */}
      {/* ----------------------------------------------------------------- */}
      {raiseProgress && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--surface-1)',
            border: `1px solid ${raiseProgress.isOver ? 'rgba(26, 26, 46, 0.06)' : raiseProgress.pct >= 75 ? 'rgba(26, 26, 46, 0.05)' : 'var(--border-subtle)'}`,
          }}
        >
          <div className="flex items-center gap-2 shrink-0">
            <span style={{ color: 'var(--accent)', display: 'flex' }}><Target className="w-4 h-4" /></span>
            <span style={{
              fontSize: 'var(--font-size-lg)',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: raiseProgress.isOver ? 'var(--danger)' : raiseProgress.pct >= 75 ? 'var(--warning)' : 'var(--text-primary)',
            }}>
              Day {raiseProgress.daysElapsed}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              of {raiseProgress.targetDays}
            </span>
          </div>
          <div style={{ flex: 1, height: '6px', background: 'var(--surface-3)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              width: `${raiseProgress.pct}%`,
              height: '100%',
              borderRadius: '3px',
              background: raiseProgress.isOver ? 'var(--danger)' : raiseProgress.pct >= 75 ? 'var(--warning)' : 'var(--accent)',
              transition: 'width 600ms ease',
            }} />
          </div>
          <span style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: raiseProgress.isOver ? 'var(--danger)' : raiseProgress.daysRemaining <= 14 ? 'var(--warning)' : 'var(--text-tertiary)',
            whiteSpace: 'nowrap',
          }}>
            {raiseProgress.isOver
              ? `+${raiseProgress.daysElapsed - raiseProgress.targetDays}d over`
              : `${raiseProgress.daysRemaining}d left`
            }
          </span>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 1.6. Overnight Changes                                            */}
      {/* ----------------------------------------------------------------- */}
      {overnight && (overnight.statusChanges.length > 0 || overnight.newMeetings > 0 || overnight.tasksCompleted > 0) && (
        <div
          className="rounded-xl"
          style={{
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-1)',
            overflow: 'hidden',
          }}
        >
          <div
            className="flex items-center gap-2"
            style={{
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <Zap className="w-3.5 h-3.5" style={{ color: 'var(--chart-4)' }} />
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--chart-4)', textTransform: 'none', letterSpacing: '0.05em' }}>Since Yesterday</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap" style={{ padding: 'var(--space-3) var(--space-4)' }}>
            {overnight.statusChanges.map((sc, i) => (
              <div key={i} className="flex items-center gap-1.5" style={{ fontSize: 'var(--font-size-xs)' }}>
                <ArrowUpRight className="w-3 h-3" style={{ color: 'var(--success)' }} />
                <Link
                  href={`/investors/${sc.investorId}`}
                  style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                >
                  {sc.investorName}
                </Link>
                <span style={{ color: 'var(--text-muted)' }}>{sc.from.replace(/_/g, ' ')} → {sc.to.replace(/_/g, ' ')}</span>
              </div>
            ))}
            {overnight.newMeetings > 0 && (
              <div className="flex items-center gap-1.5" style={{ fontSize: 'var(--font-size-xs)' }}>
                <Calendar className="w-3 h-3" style={{ color: 'var(--accent)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>{overnight.newMeetings} new meeting{overnight.newMeetings > 1 ? 's' : ''}</span>
              </div>
            )}
            {overnight.tasksCompleted > 0 && (
              <div className="flex items-center gap-1.5" style={{ fontSize: 'var(--font-size-xs)' }}>
                <CheckCircle className="w-3 h-3" style={{ color: 'var(--success)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>{overnight.tasksCompleted} task{overnight.tasksCompleted > 1 ? 's' : ''} completed</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 2. Today's Meetings                                               */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <div className="section-title">Today&apos;s Meetings</div>

        {data.todayMeetings.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {data.todayMeetings.map((meeting, idx) => (
              <MeetingCard key={idx} meeting={meeting} />
            ))}
          </div>
        ) : (
          <div
            className="card"
            style={{
              padding: 'var(--space-6)',
              textAlign: 'center',
            }}
          >
            <span style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
              <Calendar className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
            </span>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              No meetings scheduled today
            </p>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Time to focus on follow-ups?
            </p>
            <div className="flex items-center justify-center gap-2" style={{ marginTop: 'var(--space-3)' }}>
              <Link href="/followups" className="btn btn-secondary btn-sm">
                Follow-ups
              </Link>
              <Link href="/focus" className="btn btn-secondary btn-sm">
                Focus Queue
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 3. Priority Actions                                               */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <div className="section-title">Priority Actions</div>

        {data.urgentActions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {data.urgentActions.map((action, idx) => (
              <ActionCard key={idx} action={action} />
            ))}
          </div>
        ) : (
          <div
            className="card"
            style={{
              padding: 'var(--space-6)',
              textAlign: 'center',
            }}
          >
            <span style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
              <CheckCircle className="w-8 h-8" style={{ color: 'var(--success)' }} />
            </span>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              All caught up!
            </p>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Your pipeline is humming. Check the{' '}
              <Link href="/focus" style={{ color: 'var(--accent)' }}>Focus Queue</Link>
              {' '}for proactive moves.
            </p>
          </div>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 3.5 Due Follow-ups (inline quick-complete)                        */}
      {/* ----------------------------------------------------------------- */}
      {dueFollowups.length > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <div className="section-title">Follow-ups Due</div>
            <Link href="/followups" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textDecoration: 'underline' }}>
              View all
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {dueFollowups.map(fu => {
              const isOverdue = fu.due_at?.split('T')[0] < new Date().toISOString().split('T')[0];
              const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
                thank_you: { label: 'Thank You', color: 'var(--accent)', bg: 'var(--accent-muted)' },
                objection_response: { label: 'Objection', color: 'var(--danger)', bg: 'var(--danger-muted)' },
                data_share: { label: 'Share Docs', color: 'var(--chart-4)', bg: 'var(--cat-purple-muted)' },
                schedule_followup: { label: 'Schedule', color: 'var(--success)', bg: 'var(--success-muted)' },
                warm_reengagement: { label: 'Re-engage', color: 'var(--warning)', bg: 'var(--warning-muted)' },
                milestone_update: { label: 'Update', color: 'var(--warning)', bg: 'rgba(251,146,60,0.12)' },
              };
              const tc = typeConfig[fu.action_type] || { label: fu.action_type, color: 'var(--text-tertiary)', bg: 'var(--surface-2)' };
              const isProcessing = completingFollowupId === fu.id;
              return (
                <div key={fu.id} className="card" style={{ padding: 'var(--space-3)', opacity: isProcessing ? 0.5 : 1, transition: 'opacity 150ms' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{ background: tc.bg, color: tc.color, fontWeight: 500 }}>
                      {tc.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                        {fu.description}
                      </p>
                      <div className="flex items-center gap-2" style={{ marginTop: '2px' }}>
                        <Link href={`/investors/${fu.investor_id}`} style={{ fontSize: '11px', color: 'var(--accent)', textDecoration: 'none' }}>
                          {fu.investor_name}
                        </Link>
                        {isOverdue && (
                          <span style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 600 }}>OVERDUE</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleQuickComplete(fu.id)}
                        disabled={isProcessing}
                        className="btn btn-sm"
                        style={{ background: 'var(--success-muted)', color: 'var(--success)', border: '1px solid rgba(27, 42, 74, 0.08)', fontSize: '11px', padding: '3px 10px' }}
                      >
                        Done
                      </button>
                      <button
                        onClick={() => handleQuickSkip(fu.id)}
                        disabled={isProcessing}
                        className="btn btn-sm"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: '11px', padding: '3px 8px' }}
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 4. Pipeline Pulse                                                 */}
      {/* ----------------------------------------------------------------- */}
      <div>
        <div className="section-title">Pipeline Pulse</div>

        <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-3)' }}>
          <Link
            href="/pipeline"
            className="card"
            style={{ padding: 'var(--space-4)', textDecoration: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
          >
            <div className="metric-label">Active</div>
            <div className="metric-value" style={{ fontSize: 'var(--font-size-xl)', marginTop: '4px', color: 'var(--text-primary)' }}>
              {data.pipelineSnapshot.totalActive}
            </div>
          </Link>

          <Link
            href="/pipeline?stage=in_dd"
            className="card"
            style={{ padding: 'var(--space-4)', textDecoration: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
          >
            <div className="metric-label">In DD</div>
            <div className="metric-value" style={{ fontSize: 'var(--font-size-xl)', marginTop: '4px', color: data.pipelineSnapshot.inDD > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
              {data.pipelineSnapshot.inDD}
            </div>
          </Link>

          <Link
            href="/pipeline?stage=term_sheet"
            className="card"
            style={{ padding: 'var(--space-4)', textDecoration: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
          >
            <div className="metric-label">Term Sheets</div>
            <div className="metric-value" style={{ fontSize: 'var(--font-size-xl)', marginTop: '4px', color: data.pipelineSnapshot.termSheets > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
              {data.pipelineSnapshot.termSheets}
            </div>
          </Link>

          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div className="flex items-center gap-1.5">
              <div className={forecastDotClass} style={{ width: '6px', height: '6px' }} />
              <div className="metric-label">Forecast</div>
            </div>
            <p style={{
              fontSize: 'var(--font-size-xs)',
              color: forecastColor,
              marginTop: '6px',
              lineHeight: 1.4,
            }}>
              {data.pipelineSnapshot.forecast}
            </p>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 5. Alerts                                                         */}
      {/* ----------------------------------------------------------------- */}
      {data.alerts.length > 0 && (
        <div>
          <div className="section-title">Alerts</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {data.alerts.map((alert, idx) => (
              <AlertCard key={idx} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 6. Momentum Indicator                                             */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          background: momentumConfig.bg,
          border: `1px solid ${momentumConfig.border}`,
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: momentumConfig.bg,
              border: `1px solid ${momentumConfig.border}`,
            }}
          >
            <span style={{ color: momentumConfig.color, display: 'flex' }}>
              <MomentumIcon className="w-5 h-5" />
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: momentumConfig.color }}>
                {momentumConfig.label}
              </p>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-sm)',
                  background: momentumConfig.bg,
                  border: `1px solid ${momentumConfig.border}`,
                  color: momentumConfig.color,
                  fontWeight: 500,
                }}
              >
                Raise Momentum
              </span>
            </div>
            <p style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-secondary)',
              marginTop: '2px',
              lineHeight: 1.5,
            }}>
              {data.momentumChange}
            </p>
          </div>

          <Link
            href="/dealflow"
            className="btn btn-ghost btn-sm shrink-0"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            Details
            <span style={{ display: 'flex' }}><ChevronRight className="w-3.5 h-3.5" /></span>
          </Link>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 7. AI Insight                                                      */}
      {/* ----------------------------------------------------------------- */}
      {insight && (
        <div
          style={{
            background: 'rgba(167,139,250,0.08)',
            border: '1px solid rgba(74,74,138,0.12)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex items-center justify-center shrink-0"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(167,139,250,0.15)',
              }}
            >
              <span style={{ color: 'rgba(167,139,250,0.9)', display: 'flex' }}>
                <Sparkles className="w-4 h-4" />
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'rgba(167,139,250,0.9)', textTransform: 'none' as const, letterSpacing: '0.05em' }}>
                  AI Insight
                </span>
              </div>
              <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {insight.title}
              </p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                {insight.detail}
              </p>
            </div>

            <Link
              href="/intelligence"
              className="btn btn-ghost btn-sm shrink-0"
              style={{ color: 'rgba(167,139,250,0.8)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(167,139,250,1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(167,139,250,0.8)')}
            >
              See more
              <span style={{ display: 'flex' }}><ChevronRight className="w-3.5 h-3.5" /></span>
            </Link>
          </div>
        </div>
      )}

      {/* Footer spacer */}
      <div style={{ height: 'var(--space-4)' }} />
    </div>
  );
}

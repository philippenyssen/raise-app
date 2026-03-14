'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import {
  Sunrise, Calendar, Clock, ArrowRight, ChevronRight, RefreshCw,
  Mail, UserPlus, FileText, AlertTriangle, Zap, TrendingUp,
  TrendingDown, Minus, Users, Shield, Target,
  CheckCircle, ExternalLink, Sparkles,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types — match the updated /api/briefing response
// ---------------------------------------------------------------------------

interface BriefingMeeting {
  investorName: string;
  time: string;
  type: string;
  prepLink: string;
  keyPoint: string;
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
  followup: '#60a5fa',
  outreach: '#c084fc',
  preparation: '#2dd4bf',
  escalation: '#f87171',
  meeting: '#fbbf24',
};

const CATEGORY_BG: Record<string, string> = {
  followup: 'var(--accent-muted)',
  outreach: 'rgba(168,85,247,0.12)',
  preparation: 'rgba(20,184,166,0.12)',
  escalation: 'var(--danger-muted)',
  meeting: 'var(--warning-muted)',
};

const ALERT_STYLES: Record<string, { bg: string; border: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  warning: { bg: 'var(--warning-muted)', border: 'rgba(245,158,11,0.25)', color: '#fbbf24', icon: AlertTriangle },
  opportunity: { bg: 'var(--success-muted)', border: 'rgba(34,197,94,0.25)', color: '#4ade80', icon: Zap },
  risk: { bg: 'var(--danger-muted)', border: 'rgba(239,68,68,0.25)', color: '#f87171', icon: Shield },
};

const MOMENTUM_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  accelerating: { color: 'var(--success)', bg: 'var(--success-muted)', border: 'rgba(34,197,94,0.25)', icon: TrendingUp, label: 'Accelerating' },
  steady: { color: 'var(--text-secondary)', bg: 'var(--surface-2)', border: 'var(--border-default)', icon: Minus, label: 'Steady' },
  decelerating: { color: 'var(--warning)', bg: 'var(--warning-muted)', border: 'rgba(245,158,11,0.25)', icon: TrendingDown, label: 'Decelerating' },
  stalled: { color: 'var(--danger)', bg: 'var(--danger-muted)', border: 'rgba(239,68,68,0.25)', icon: TrendingDown, label: 'Stalled' },
};

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
          </div>

          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>
            {meeting.keyPoint}
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
            href="/meetings/capture"
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
            {action.title}
          </p>

          {action.description && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '2px', lineHeight: 1.5 }}>
              {action.description}
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
            {alert.title}
          </p>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            {alert.detail}
          </p>
        </div>
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

    // Non-blocking: fetch velocity (for raise day counter) and strategic insight
    try {
      const [stratRes, velRes] = await Promise.all([
        fetch('/api/intelligence/strategic').catch(() => null),
        fetch('/api/velocity').catch(() => null),
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
            border: '1px solid rgba(239,68,68,0.15)',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', maxWidth: '860px', position: 'relative' }}>

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
                background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(251,191,36,0.1))',
                border: '1px solid rgba(245,158,11,0.2)',
              }}
            >
              <span style={{ color: '#fbbf24', display: 'flex' }}>
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
            {data.todaySummary}
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
            border: `1px solid ${raiseProgress.isOver ? 'rgba(239,68,68,0.25)' : raiseProgress.pct >= 75 ? 'rgba(245,158,11,0.25)' : 'var(--border-subtle)'}`,
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
            background: 'rgba(168,85,247,0.08)',
            border: '1px solid rgba(168,85,247,0.2)',
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
                background: 'rgba(168,85,247,0.15)',
              }}
            >
              <span style={{ color: 'rgba(168,85,247,0.9)', display: 'flex' }}>
                <Sparkles className="w-4 h-4" />
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'rgba(168,85,247,0.9)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
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
              style={{ color: 'rgba(168,85,247,0.8)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(168,85,247,1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(168,85,247,0.8)')}
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

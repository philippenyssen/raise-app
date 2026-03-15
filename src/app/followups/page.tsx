'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  SendHorizonal, Clock, CheckCircle2, XCircle, AlertTriangle,
  Mail, MessageSquare, FolderOpen, CalendarPlus, RefreshCw, Milestone,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Users,
  Zap, Timer, Network, ArrowUpRight, ArrowDownRight, Activity,
  PenLine, Copy, Check,
} from 'lucide-react';

interface TimingIntel {
  optimalDayOfWeek: string;
  optimalTimeOfDay: string;
  reasoning: string;
}

interface VelocityIntel {
  acceleration: 'accelerating' | 'decelerating' | 'stable' | 'new' | 'gone_silent';
  signal: string;
  daysSinceLastMeeting: number | null;
  recentMeetings: number;
  previousMeetings: number;
}

interface CascadeIntel {
  cascadeChainLength: number;
  signal: string;
  keystoneName: string;
  totalCascadeProbability: number;
}

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
    bgColor: 'var(--accent-muted)',
  },
  objection_response: {
    label: 'Objection Response',
    icon: MessageSquare,
    color: 'var(--text-primary)',
    bgColor: 'var(--danger-muted)',
  },
  data_share: {
    label: 'Share Materials',
    icon: FolderOpen,
    color: 'var(--text-secondary)',
    bgColor: 'rgba(27, 42, 74, 0.06)',
  },
  schedule_followup: {
    label: 'Schedule Meeting',
    icon: CalendarPlus,
    color: 'var(--text-secondary)',
    bgColor: 'var(--success-muted)',
  },
  warm_reengagement: {
    label: 'Re-engagement',
    icon: RefreshCw,
    color: 'var(--text-tertiary)',
    bgColor: 'var(--warning-muted)',
  },
  milestone_update: {
    label: 'Milestone Update',
    icon: Milestone,
    color: 'var(--text-tertiary)',
    bgColor: 'rgba(138, 136, 128, 0.08)',
  },
};

function generateDraft(item: FollowupItem): { subject: string; body: string } {
  const name = item.investor_name;
  const desc = item.description.split('\n')[0]; // First line as context

  const templates: Record<string, { subject: string; body: string }> = {
    thank_you: {
      subject: `Following up — ${name}`,
      body: `Dear team,\n\nThank you for taking the time to meet with us. We valued the discussion and your thoughtful questions.\n\n${desc}\n\nWe're happy to provide any additional materials or context that would be helpful for your evaluation. Please don't hesitate to reach out.\n\nBest regards`,
    },
    objection_response: {
      subject: `Addressing your questions — ${name}`,
      body: `Dear team,\n\nFollowing up on the points raised during our discussion. We wanted to provide additional context and data:\n\n${desc}\n\nWe've attached [relevant materials] that address these questions in more detail. Happy to walk through any of this on a call.\n\nBest regards`,
    },
    data_share: {
      subject: `Materials as discussed — ${name}`,
      body: `Dear team,\n\nAs discussed, please find the requested materials:\n\n${desc}\n\n• [Document/Data 1]\n• [Document/Data 2]\n\nLet us know if you need anything else to support your review.\n\nBest regards`,
    },
    schedule_followup: {
      subject: `Next steps — ${name}`,
      body: `Dear team,\n\nThank you again for the productive conversation. We'd love to continue the dialogue and propose scheduling a follow-up.\n\n${desc}\n\nWould any of the following work for your team?\n\n• [Option 1]\n• [Option 2]\n• [Option 3]\n\nHappy to accommodate your schedule.\n\nBest regards`,
    },
    warm_reengagement: {
      subject: `Checking in — ${name}`,
      body: `Dear team,\n\nHope all is well. Wanted to reconnect following our earlier conversations and share some recent developments.\n\n${desc}\n\nWe've made meaningful progress since we last spoke and would welcome the chance to update you. Are you available for a brief call this week?\n\nBest regards`,
    },
    milestone_update: {
      subject: `Progress update — ${name}`,
      body: `Dear team,\n\nWanted to share a quick update on our progress since our last interaction:\n\n${desc}\n\nWe believe these developments are relevant to your evaluation and are happy to discuss further at your convenience.\n\nBest regards`,
    },
  };

  return templates[item.action_type] || templates.milestone_update;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const due = new Date(dateStr);
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

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

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

export default function FollowupsPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><div className="h-8 w-64 skeleton animate-pulse" style={{ borderRadius: 'var(--radius-md)' }} /></div>}>
      <FollowupsContent />
    </Suspense>
  );
}

function FollowupsContent() {
  const searchParams = useSearchParams();
  const investorFilter = searchParams.get('investor') || '';
  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'skipped'>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeForm, setCompleteForm] = useState({ outcome: '', conviction_delta: 0 });
  const [overdueExpanded, setOverdueExpanded] = useState(true);
  const [todayExpanded, setTodayExpanded] = useState(true);
  const [upcomingExpanded, setUpcomingExpanded] = useState(true);
  const [hoveredActionBtn, setHoveredActionBtn] = useState<string | null>(null);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ view: 'intelligence' });
    if (filter !== 'all') params.set('status', filter);
    if (investorFilter) params.set('investor_id', investorFilter);
    const res = await fetch(`/api/followups?${params.toString()}`);
    const data = await res.json();
    setFollowups(data);
    setLoading(false);
  }, [filter, investorFilter]);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  async function handleComplete(id: string) {
    await fetch('/api/followups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        status: 'completed',
        outcome: completeForm.outcome,
        conviction_delta: completeForm.conviction_delta,
      }),
    });
    setCompletingId(null);
    setCompleteForm({ outcome: '', conviction_delta: 0 });
    fetchFollowups();
  }

  async function handleSkip(id: string) {
    await fetch('/api/followups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'skipped' }),
    });
    fetchFollowups();
  }

  async function handleQuickComplete(id: string) {
    await fetch('/api/followups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'completed' }),
    });
    fetchFollowups();
  }

  // Categorize pending followups
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const overdue = followups.filter(f => f.status === 'pending' && new Date(f.due_at) < now);
  const dueToday = followups.filter(f => f.status === 'pending' && new Date(f.due_at) >= now && new Date(f.due_at) <= todayEnd);
  const upcoming = followups.filter(f => f.status === 'pending' && new Date(f.due_at) > todayEnd && new Date(f.due_at) <= in3Days);
  const later = followups.filter(f => f.status === 'pending' && new Date(f.due_at) > in3Days);
  const completed = followups.filter(f => f.status === 'completed');
  const skipped = followups.filter(f => f.status === 'skipped');

  // Learning stats
  const completedWithDelta = completed.filter(f => f.conviction_delta !== 0);
  const avgDelta = completedWithDelta.length > 0
    ? completedWithDelta.reduce((acc, f) => acc + f.conviction_delta, 0) / completedWithDelta.length
    : 0;
  const byType = completed.reduce<Record<string, { count: number; totalDelta: number }>>((acc, f) => {
    if (!acc[f.action_type]) acc[f.action_type] = { count: 0, totalDelta: 0 };
    acc[f.action_type].count++;
    acc[f.action_type].totalDelta += f.conviction_delta;
    return acc;
  }, {});

  // Measured efficacy stats (from actual enthusiasm deltas post-followup)
  const withMeasuredLift = completed.filter(f => f.measured_lift !== null && f.measured_lift !== undefined);
  const avgMeasuredLift = withMeasuredLift.length > 0
    ? withMeasuredLift.reduce((acc, f) => acc + (f.measured_lift || 0), 0) / withMeasuredLift.length
    : null;
  const bestActionType = Object.entries(
    withMeasuredLift.reduce<Record<string, { count: number; totalLift: number }>>((acc, f) => {
      if (!acc[f.action_type]) acc[f.action_type] = { count: 0, totalLift: 0 };
      acc[f.action_type].count++;
      acc[f.action_type].totalLift += f.measured_lift || 0;
      return acc;
    }, {})
  ).sort((a, b) => (b[1].totalLift / b[1].count) - (a[1].totalLift / a[1].count))[0];

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
        style={{
          padding: 0,
          borderColor: showOverdueIndicator || isOverdue ? 'rgba(26, 26, 46, 0.06)' : undefined,
          background: showOverdueIndicator || isOverdue ? 'rgba(26, 26, 46, 0.06)' : undefined,
          boxShadow: showOverdueIndicator || isOverdue ? '0 none' : undefined,
        }}
      >
        <div style={{ padding: 'var(--space-4)' }}>
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className="w-8 h-8 flex items-center justify-center shrink-0"
              style={{
                borderRadius: '50%',
                background: isOverdue ? 'var(--danger-muted)' : config.bgColor,
              }}
            >
              <Icon className="w-4 h-4" style={{ color: isOverdue ? 'var(--danger)' : config.color }} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className="badge"
                  style={{
                    fontSize: '10px',

                    background: isOverdue ? 'var(--danger-muted)' : config.bgColor,
                    color: isOverdue ? 'var(--text-tertiary)' : config.color,
                  }}
                >
                  {config.label}
                </span>
                <Link
                  href={`/investors/${item.investor_id}`}
                  className="transition-colors"
                  style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--accent)'; }}
                >
                  {item.investor_name}
                </Link>
                <span
                  className="flex items-center gap-1"
                  style={{
                    fontSize: '10px',
                    color: isOverdue ? 'var(--danger)' : 'var(--text-muted)',
                    fontWeight: isOverdue ? 500 : undefined,
                  }}
                >
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(item.due_at)}
                </span>
              </div>

              <p
                className={isExpanded ? 'whitespace-pre-line' : 'line-clamp-2'}
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}
              >
                {item.description}
              </p>

              {item.description.includes('\n') && (
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  style={{ fontSize: '10px', color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  className="mt-1 transition-colors"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}

              {/* Completed outcome */}
              {item.status === 'completed' && item.outcome && (
                <div
                  className="mt-2"
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.375rem 0.5rem',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>Outcome:</span> {item.outcome}
                  {item.conviction_delta !== 0 && (
                    <span
                      className="inline-flex items-center gap-0.5"
                      style={{
                        marginLeft: '0.5rem',
                        color: item.conviction_delta > 0 ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      {item.conviction_delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {item.conviction_delta > 0 ? '+' : ''}{item.conviction_delta}
                    </span>
                  )}
                  {item.measured_lift !== null && item.measured_lift !== undefined && (
                    <span
                      className="inline-flex items-center gap-0.5"
                      style={{
                        marginLeft: '0.5rem',
                        color: item.measured_lift > 0 ? 'var(--success)' : item.measured_lift < 0 ? 'var(--danger)' : 'var(--text-muted)',
                      }}
                    >
                      Measured: {item.measured_lift > 0 ? '+' : ''}{item.measured_lift} enthusiasm
                    </span>
                  )}
                </div>
              )}

              {/* Completing form */}
              {isCompleting && (
                <div
                  className="mt-3 space-y-2"
                  style={{
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-3)',
                  }}
                >
                  <div>
                    <label
                      className="block mb-1"
                      style={{ fontSize: '10px', color: 'var(--text-muted)' }}
                    >
                      Outcome (what happened?)
                    </label>
                    <input
                      value={completeForm.outcome}
                      onChange={e => setCompleteForm(f => ({ ...f, outcome: e.target.value }))}
                      placeholder="e.g., Sent thank-you, they responded positively..."
                      className="input"
                    />
                  </div>
                  <div>
                    <label
                      className="block mb-1"
                      style={{ fontSize: '10px', color: 'var(--text-muted)' }}
                    >
                      Conviction change (-2 to +2)
                    </label>
                    <div className="flex gap-1">
                      {[-2, -1, 0, 1, 2].map(val => (
                        <button
                          key={val}
                          className="transition-colors"
                          onClick={() => setCompleteForm(f => ({ ...f, conviction_delta: val }))}
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '10px',
                            fontWeight: 500,
                            transition: 'all 150ms ease',
                            background: completeForm.conviction_delta === val
                              ? val > 0 ? 'var(--success)' : val < 0 ? 'var(--danger)' : 'var(--accent)'
                              : 'var(--surface-3)',
                            color: completeForm.conviction_delta === val
                              ? 'white'
                              : 'var(--text-secondary)',
                          }}
                          onMouseEnter={e => {
                            if (completeForm.conviction_delta !== val) {
                              e.currentTarget.style.background = 'var(--border-strong)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (completeForm.conviction_delta !== val) {
                              e.currentTarget.style.background = 'var(--surface-3)';
                            }
                          }}
                        >
                          {val > 0 ? '+' : ''}{val}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleComplete(item.id)}
                      className="btn btn-sm transition-colors"
                      style={{
                        background: 'var(--success)',
                        color: 'var(--text-primary)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--success)'; }}
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => { setCompletingId(null); setCompleteForm({ outcome: '', conviction_delta: 0 }); }}
                      className="btn btn-sm btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            {item.status === 'pending' && !isCompleting && (
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setDraftingId(draftingId === item.id ? null : item.id)}
                  className="p-1.5 transition-colors"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    color: hoveredActionBtn === `draft-${item.id}` || draftingId === item.id ? 'var(--chart-4)' : 'var(--text-muted)',
                    background: hoveredActionBtn === `draft-${item.id}` || draftingId === item.id ? 'var(--cat-purple-muted)' : 'transparent',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={() => setHoveredActionBtn(`draft-${item.id}`)}
                  onMouseLeave={() => setHoveredActionBtn(null)}
                  title="Draft message"
                >
                  <PenLine className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleQuickComplete(item.id)}
                  className="p-1.5 transition-colors"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    color: hoveredActionBtn === `complete-${item.id}` ? 'var(--success)' : 'var(--text-muted)',
                    background: hoveredActionBtn === `complete-${item.id}` ? 'var(--success-muted)' : 'transparent',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={() => setHoveredActionBtn(`complete-${item.id}`)}
                  onMouseLeave={() => setHoveredActionBtn(null)}
                  title="Quick complete"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setCompletingId(item.id); setCompleteForm({ outcome: '', conviction_delta: 0 }); }}
                  className="p-1.5 transition-colors"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    color: hoveredActionBtn === `outcome-${item.id}` ? 'var(--accent)' : 'var(--text-muted)',
                    background: hoveredActionBtn === `outcome-${item.id}` ? 'var(--accent-muted)' : 'transparent',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={() => setHoveredActionBtn(`outcome-${item.id}`)}
                  onMouseLeave={() => setHoveredActionBtn(null)}
                  title="Complete with outcome"
                >
                  <TrendingUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleSkip(item.id)}
                  className="p-1.5 transition-colors"
                  style={{
                    borderRadius: 'var(--radius-md)',
                    color: hoveredActionBtn === `skip-${item.id}` ? 'var(--danger)' : 'var(--text-muted)',
                    background: hoveredActionBtn === `skip-${item.id}` ? 'var(--danger-muted)' : 'transparent',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={() => setHoveredActionBtn(`skip-${item.id}`)}
                  onMouseLeave={() => setHoveredActionBtn(null)}
                  title="Skip"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            )}

            {item.status === 'completed' && (
              <span className="flex items-center gap-1 shrink-0" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            )}

            {item.status === 'skipped' && (
              <span className="flex items-center gap-1 shrink-0" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                <XCircle className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </div>

        {/* Intelligence strip */}
        {item.status === 'pending' && (item.timing || item.velocity || item.cascade) && (
          <div
            style={{
              padding: '0.375rem var(--space-4)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
              alignItems: 'center',
              background: 'var(--surface-1)',
            }}
          >
            {/* Optimal timing */}
            {item.timing && (
              <div
                className="flex items-center gap-1.5"
                style={{ fontSize: '10px' }}
                title={item.timing.reasoning}
              >
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'var(--accent-muted)',
                  }}
                >
                  <Timer className="w-2.5 h-2.5" style={{ color: 'var(--accent)' }} />
                </span>
                <span style={{ color: 'var(--text-muted)' }}>Send</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  {item.timing.optimalDayOfWeek} {item.timing.optimalTimeOfDay}
                </span>
              </div>
            )}

            {/* Engagement velocity */}
            {item.velocity && (() => {
              const velConfig: Record<string, { color: string; bg: string; icon: typeof ArrowUpRight; label: string }> = {
                accelerating: { color: 'var(--text-secondary)', bg: 'var(--success-muted)', icon: ArrowUpRight, label: 'Rising' },
                decelerating: { color: 'var(--text-primary)', bg: 'var(--danger-muted)', icon: ArrowDownRight, label: 'Falling' },
                stable: { color: 'var(--text-muted)', bg: 'var(--surface-3)', icon: Activity, label: 'Stable' },
                new: { color: 'var(--text-tertiary)', bg: 'var(--warning-muted)', icon: Zap, label: 'New' },
                gone_silent: { color: 'var(--text-primary)', bg: 'var(--danger-muted)', icon: AlertTriangle, label: 'Silent' },
              };
              const vc = velConfig[item.velocity!.acceleration] || velConfig.stable;
              const VelIcon = vc.icon;
              return (
                <div
                  className="flex items-center gap-1.5"
                  style={{ fontSize: '10px' }}
                  title={item.velocity!.signal}
                >
                  <span
                    className="flex items-center justify-center"
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: vc.bg,
                    }}
                  >
                    <VelIcon className="w-2.5 h-2.5" style={{ color: vc.color }} />
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>Velocity</span>
                  <span style={{ color: vc.color, fontWeight: 600 }}>{vc.label}</span>
                  {item.velocity!.daysSinceLastMeeting !== null && (
                    <span style={{ color: 'var(--text-muted)' }}>
                      ({item.velocity!.daysSinceLastMeeting}d ago)
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Network cascade */}
            {item.cascade && item.cascade.cascadeChainLength > 0 && (
              <div
                className="flex items-center gap-1.5"
                style={{ fontSize: '10px' }}
                title={item.cascade.signal}
              >
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: 'rgba(27, 42, 74, 0.06)',
                  }}
                >
                  <Network className="w-2.5 h-2.5" style={{ color: 'var(--text-secondary)' }} />
                </span>
                <span style={{ color: 'var(--text-muted)' }}>Cascade</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {item.cascade.cascadeChainLength} investor{item.cascade.cascadeChainLength !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Draft message panel */}
        {draftingId === item.id && (() => {
          const draft = generateDraft(item);
          return (
            <div
              style={{
                borderTop: '1px solid rgba(27, 42, 74, 0.08)',
                background: 'rgba(27, 42, 74, 0.03)',
                padding: 'var(--space-4)',
              }}
            >
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
                <span className="flex items-center gap-1.5" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--accent)' }}>
                  <PenLine className="w-3.5 h-3.5" />
                  Draft Message
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Edit before sending
                </span>
              </div>

              {/* Subject */}
              <div style={{ marginBottom: 'var(--space-2)' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.01em' }}>Subject</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(draft.subject);
                      setCopiedField(`subject-${item.id}`);
                      setTimeout(() => setCopiedField(null), 2000);
                    }}
                    className="flex items-center gap-1 p-1"
                    style={{
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '10px',
                      color: copiedField === `subject-${item.id}` ? 'var(--success)' : 'var(--text-muted)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'color 150ms ease',
                    }}
                  >
                    {copiedField === `subject-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedField === `subject-${item.id}` ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div
                  style={{
                    background: 'var(--surface-1)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                  }}
                >
                  {draft.subject}
                </div>
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.01em' }}>Body</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(draft.body);
                      setCopiedField(`body-${item.id}`);
                      setTimeout(() => setCopiedField(null), 2000);
                    }}
                    className="flex items-center gap-1 p-1"
                    style={{
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '10px',
                      color: copiedField === `body-${item.id}` ? 'var(--success)' : 'var(--text-muted)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'color 150ms ease',
                    }}
                  >
                    {copiedField === `body-${item.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedField === `body-${item.id}` ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div
                  style={{
                    background: 'var(--surface-1)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-3)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {draft.body}
                </div>
              </div>

              {/* Copy all button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
                  setCopiedField(`all-${item.id}`);
                  setTimeout(() => setCopiedField(null), 2000);
                }}
                className="btn btn-sm mt-3 transition-colors"
                style={{
                  background: copiedField === `all-${item.id}` ? 'var(--success)' : 'var(--accent-muted)',
                  color: copiedField === `all-${item.id}` ? 'white' : 'var(--accent)',
                  border: 'none',
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={e => {
                  if (copiedField !== `all-${item.id}`) {
                    e.currentTarget.style.background = 'rgba(27, 42, 74, 0.10)';
                  }
                }}
                onMouseLeave={e => {
                  if (copiedField !== `all-${item.id}`) {
                    e.currentTarget.style.background = 'var(--accent-muted)';
                  }
                }}
              >
                {copiedField === `all-${item.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedField === `all-${item.id}` ? 'Copied to clipboard' : 'Copy full message'}
              </button>
            </div>
          );
        })()}

        {/* Due date footer */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '0.5rem var(--space-4)',
            borderTop: isOverdue ? '1px solid rgba(26, 26, 46, 0.06)' : '1px solid var(--border-subtle)',
            fontSize: '10px',
            color: 'var(--text-muted)',
          }}
        >
          {isOverdue ? (
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {formatRelativeTime(item.due_at)} — was due {formatDate(item.due_at)}
            </span>
          ) : (
            <span>Due: {formatDate(item.due_at)}</span>
          )}
          {item.completed_at && <span>Completed: {formatDate(item.completed_at)}</span>}
        </div>
      </div>
    );
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

    const accentColorMap: Record<string, string> = {
      red: 'var(--danger)',
      blue: 'var(--accent)',
      zinc: 'var(--text-secondary)',
      green: 'var(--success)',
    };

    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between mb-3"
        >
          <div className="flex items-center gap-2">
            {accent === 'red' && <AlertTriangle className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />}
            <h2 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: accentColorMap[accent] }}>{title}</h2>
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                padding: '0.125rem 0.375rem',
                borderRadius: '9999px',
                background: accent === 'red' ? 'var(--danger-muted)' : 'var(--surface-3)',
                color: accent === 'red' ? 'var(--text-tertiary)' : 'var(--text-secondary)',
              }}
            >
              {items.length}
            </span>
          </div>
          {expanded
            ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          }
        </button>
        {expanded && (
          <div className="space-y-2">
            {items.map(item => renderFollowupCard(item, showOverdue))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6 page-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Follow-ups</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
            Automated follow-up choreography after investor meetings. Track actions, record outcomes, and learn what works.
          </p>
          {investorFilter && followups.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs px-2 py-1 rounded-md" style={{ background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid rgba(27, 42, 74, 0.10)' }}>
                Filtered: {followups[0]?.investor_name || 'Selected investor'}
              </span>
              <Link href="/followups" className="text-xs" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
                Show all
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3 card-stagger">
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Overdue</div>
          <div
            className="metric-value mt-1"
            style={{ color: overdue.length > 0 ? 'var(--danger)' : 'var(--text-muted)' }}
          >
            {overdue.length}
          </div>
        </div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Due Today</div>
          <div
            className="metric-value mt-1"
            style={{ color: dueToday.length > 0 ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            {dueToday.length}
          </div>
        </div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Completed</div>
          <div className="metric-value mt-1" style={{ color: 'var(--text-secondary)' }}>{completed.length}</div>
        </div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Avg Conviction Change</div>
          <div
            className="metric-value mt-1 flex items-center gap-1"
            style={{
              color: avgDelta > 0 ? 'var(--success)' : avgDelta < 0 ? 'var(--danger)' : 'var(--text-muted)',
            }}
          >
            {avgDelta > 0 ? <TrendingUp className="w-5 h-5" /> : avgDelta < 0 ? <TrendingDown className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
            {avgDelta === 0 ? '0' : (avgDelta > 0 ? '+' : '') + avgDelta.toFixed(1)}
          </div>
        </div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Measured Efficacy</div>
          <div
            className="metric-value mt-1 flex items-center gap-1"
            style={{
              color: avgMeasuredLift !== null && avgMeasuredLift > 0 ? 'var(--success)' : avgMeasuredLift !== null && avgMeasuredLift < 0 ? 'var(--danger)' : 'var(--text-muted)',
            }}
          >
            {avgMeasuredLift !== null ? (
              <>
                {avgMeasuredLift > 0 ? <TrendingUp className="w-5 h-5" /> : avgMeasuredLift < 0 ? <TrendingDown className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                {avgMeasuredLift > 0 ? '+' : ''}{avgMeasuredLift.toFixed(1)}
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>No data</span>
            )}
          </div>
          {bestActionType && (
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
              Best: {ACTION_TYPE_CONFIG[bestActionType[0]]?.label || bestActionType[0]}
            </div>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div
        className="flex gap-1"
        style={{
          background: 'var(--surface-1)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-1)',
        }}
      >
        {(['pending', 'all', 'completed', 'skipped'] as const).map(f => (
          <button
            key={f}
            className="transition-colors"
            onClick={() => setFilter(f)}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 500,
              transition: 'all 150ms ease',
              background: filter === f ? 'var(--surface-3)' : 'transparent',
              color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
            onMouseEnter={e => {
              if (filter !== f) {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
            onMouseLeave={e => {
              if (filter !== f) {
                e.currentTarget.style.color = 'var(--text-muted)';
              }
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && overdue.length > 0 && (
              <span
                style={{
                  marginLeft: '0.375rem',
                  background: 'var(--danger)',
                  color: 'var(--text-primary)',
                  fontSize: '9px',
                  padding: '0 0.25rem',
                  borderRadius: '9999px',
                }}
              >
                {overdue.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl animate-pulse" style={{ background: 'var(--surface-1)', height: '72px' }} />
          ))}
        </div>
      ) : followups.length === 0 ? (
        <div
          className="text-center py-12"
          style={{
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <SendHorizonal className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--border-default)' }} />
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
            No follow-ups pending
          </h3>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Follow-ups are created automatically after meetings.{' '}
            <Link
              href="/meetings/new"
              className="transition-colors"
              style={{ color: 'var(--accent)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--accent)'; }}
            >
              Log a meeting
            </Link>
          </p>
        </div>
      ) : filter === 'pending' ? (
        <div className="space-y-6">
          {renderSection('Overdue', overdue, overdueExpanded, setOverdueExpanded, 'red', true)}
          {renderSection('Due Today', dueToday, todayExpanded, setTodayExpanded, 'blue')}
          {renderSection('Next 3 Days', upcoming, upcomingExpanded, setUpcomingExpanded, 'zinc')}
          {later.length > 0 && (
            <div>
              <h2 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                Later ({later.length})
              </h2>
              <div className="space-y-2">
                {later.map(item => renderFollowupCard(item))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {[...followups].sort((a, b) => {
            const aOverdue = a.status === 'pending' && new Date(a.due_at) < now ? 1 : 0;
            const bOverdue = b.status === 'pending' && new Date(b.due_at) < now ? 1 : 0;
            return bOverdue - aOverdue;
          }).map(item => renderFollowupCard(item))}
        </div>
      )}

      {/* Learning section */}
      {completed.length >= 3 && (
        <div
          style={{
              borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              background: 'var(--accent-muted)',
              borderBottom: '1px solid var(--border-subtle)',
              padding: 'var(--space-4) var(--space-5)',
            }}
          >
            <h2 className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>
              <Users className="w-4 h-4" style={{ color: 'var(--chart-4)' }} />
              Follow-up Effectiveness
            </h2>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
              Which follow-up types drive the most conviction change?
            </p>
          </div>
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
                        style={{
                          borderRadius: 'var(--radius-sm)',
                          background: config.bgColor,
                        }}
                      >
                        <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                      </div>
                      <span className="flex-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                        {config.label}
                      </span>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {stats.count} done
                      </span>
                      <span
                        className="flex items-center gap-0.5"
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 500,
                          color: avgTypeDelta > 0 ? 'var(--success)' : avgTypeDelta < 0 ? 'var(--danger)' : 'var(--text-muted)',
                        }}
                      >
                        {avgTypeDelta > 0 ? '+' : ''}{avgTypeDelta.toFixed(1)} avg
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

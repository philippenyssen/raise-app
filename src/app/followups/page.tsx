'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  SendHorizonal, Clock, CheckCircle2, XCircle, AlertTriangle,
  Mail, MessageSquare, FolderOpen, CalendarPlus, RefreshCw, Milestone,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Users,
} from 'lucide-react';

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
}

const ACTION_TYPE_CONFIG: Record<string, { label: string; icon: typeof Mail; color: string; bgColor: string }> = {
  thank_you: { label: 'Thank-You Note', icon: Mail, color: 'text-blue-400', bgColor: 'bg-blue-900/30' },
  objection_response: { label: 'Objection Response', icon: MessageSquare, color: 'text-red-400', bgColor: 'bg-red-900/30' },
  data_share: { label: 'Share Materials', icon: FolderOpen, color: 'text-purple-400', bgColor: 'bg-purple-900/30' },
  schedule_followup: { label: 'Schedule Meeting', icon: CalendarPlus, color: 'text-green-400', bgColor: 'bg-green-900/30' },
  warm_reengagement: { label: 'Re-engagement', icon: RefreshCw, color: 'text-yellow-400', bgColor: 'bg-yellow-900/30' },
  milestone_update: { label: 'Milestone Update', icon: Milestone, color: 'text-orange-400', bgColor: 'bg-orange-900/30' },
};

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
  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'skipped'>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeForm, setCompleteForm] = useState({ outcome: '', conviction_delta: 0 });
  const [overdueExpanded, setOverdueExpanded] = useState(true);
  const [todayExpanded, setTodayExpanded] = useState(true);
  const [upcomingExpanded, setUpcomingExpanded] = useState(true);

  const fetchFollowups = useCallback(async () => {
    setLoading(true);
    const params = filter === 'all' ? '' : `?status=${filter}`;
    const res = await fetch(`/api/followups${params}`);
    const data = await res.json();
    setFollowups(data);
    setLoading(false);
  }, [filter]);

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

  function renderFollowupCard(item: FollowupItem, showOverdueIndicator = false) {
    const config = ACTION_TYPE_CONFIG[item.action_type] || ACTION_TYPE_CONFIG.milestone_update;
    const Icon = config.icon;
    const isExpanded = expandedId === item.id;
    const isCompleting = completingId === item.id;
    const isOverdue = item.status === 'pending' && new Date(item.due_at) < now;

    return (
      <div
        key={item.id}
        className={`rounded-lg border transition-all ${
          showOverdueIndicator || isOverdue
            ? 'border-red-800/50 bg-red-900/5'
            : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
        }`}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              isOverdue ? 'bg-red-900/40' : config.bgColor
            }`}>
              <Icon className={`w-4 h-4 ${isOverdue ? 'text-red-400' : config.color}`} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${
                  isOverdue ? 'bg-red-900/40 text-red-300' : `${config.bgColor} ${config.color}`
                }`}>
                  {config.label}
                </span>
                <Link href={`/investors/${item.investor_id}`} className="text-xs text-blue-400 hover:text-blue-300">
                  {item.investor_name}
                </Link>
                <span className={`text-[10px] flex items-center gap-1 ${
                  isOverdue ? 'text-red-400 font-medium' : 'text-zinc-500'
                }`}>
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(item.due_at)}
                </span>
              </div>

              <p className={`text-xs text-zinc-400 ${isExpanded ? 'whitespace-pre-line' : 'line-clamp-2'}`}>
                {item.description}
              </p>

              {item.description.includes('\n') && (
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="text-[10px] text-zinc-600 hover:text-zinc-400 mt-1"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}

              {/* Completed outcome */}
              {item.status === 'completed' && item.outcome && (
                <div className="mt-2 bg-zinc-800/50 rounded px-2 py-1.5 text-xs text-zinc-400">
                  <span className="text-zinc-500">Outcome:</span> {item.outcome}
                  {item.conviction_delta !== 0 && (
                    <span className={`ml-2 inline-flex items-center gap-0.5 ${
                      item.conviction_delta > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {item.conviction_delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {item.conviction_delta > 0 ? '+' : ''}{item.conviction_delta}
                    </span>
                  )}
                </div>
              )}

              {/* Completing form */}
              {isCompleting && (
                <div className="mt-3 space-y-2 bg-zinc-800/30 rounded-lg p-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">Outcome (what happened?)</label>
                    <input
                      value={completeForm.outcome}
                      onChange={e => setCompleteForm(f => ({ ...f, outcome: e.target.value }))}
                      placeholder="e.g., Sent thank-you, they responded positively..."
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-1">Conviction change (-2 to +2)</label>
                    <div className="flex gap-1">
                      {[-2, -1, 0, 1, 2].map(val => (
                        <button
                          key={val}
                          onClick={() => setCompleteForm(f => ({ ...f, conviction_delta: val }))}
                          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                            completeForm.conviction_delta === val
                              ? val > 0 ? 'bg-green-600 text-white' : val < 0 ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {val > 0 ? '+' : ''}{val}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleComplete(item.id)}
                      className="px-3 py-1.5 rounded text-xs font-medium bg-green-600 hover:bg-green-500 text-white transition-colors"
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => { setCompletingId(null); setCompleteForm({ outcome: '', conviction_delta: 0 }); }}
                      className="px-3 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
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
                  onClick={() => handleQuickComplete(item.id)}
                  className="p-1.5 rounded-md hover:bg-green-900/30 text-zinc-500 hover:text-green-400 transition-colors"
                  title="Quick complete"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setCompletingId(item.id); setCompleteForm({ outcome: '', conviction_delta: 0 }); }}
                  className="p-1.5 rounded-md hover:bg-blue-900/30 text-zinc-500 hover:text-blue-400 transition-colors"
                  title="Complete with outcome"
                >
                  <TrendingUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleSkip(item.id)}
                  className="p-1.5 rounded-md hover:bg-red-900/30 text-zinc-500 hover:text-red-400 transition-colors"
                  title="Skip"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            )}

            {item.status === 'completed' && (
              <span className="text-xs text-green-500 flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            )}

            {item.status === 'skipped' && (
              <span className="text-xs text-zinc-500 flex items-center gap-1 shrink-0">
                <XCircle className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </div>

        {/* Due date footer */}
        <div className="px-4 py-2 border-t border-zinc-800/50 flex items-center justify-between text-[10px] text-zinc-600">
          <span>Due: {formatDate(item.due_at)}</span>
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

    const accentColors = {
      red: 'text-red-400',
      blue: 'text-blue-400',
      zinc: 'text-zinc-400',
      green: 'text-green-400',
    };

    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between mb-3"
        >
          <div className="flex items-center gap-2">
            {accent === 'red' && <AlertTriangle className="w-4 h-4 text-red-400" />}
            <h2 className={`text-sm font-semibold ${accentColors[accent]}`}>{title}</h2>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              accent === 'red' ? 'bg-red-900/40 text-red-300' : 'bg-zinc-800 text-zinc-400'
            }`}>
              {items.length}
            </span>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
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
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <SendHorizonal className="w-6 h-6 text-indigo-400" />
            Follow-ups
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Automated follow-up choreography after investor meetings. Track actions, record outcomes, and learn what works.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase font-medium">Overdue</div>
          <div className={`text-2xl font-bold mt-1 ${overdue.length > 0 ? 'text-red-400' : 'text-zinc-600'}`}>
            {overdue.length}
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase font-medium">Due Today</div>
          <div className={`text-2xl font-bold mt-1 ${dueToday.length > 0 ? 'text-blue-400' : 'text-zinc-600'}`}>
            {dueToday.length}
          </div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase font-medium">Completed</div>
          <div className="text-2xl font-bold mt-1 text-green-400">{completed.length}</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
          <div className="text-[10px] text-zinc-500 uppercase font-medium">Avg Conviction Change</div>
          <div className={`text-2xl font-bold mt-1 flex items-center gap-1 ${
            avgDelta > 0 ? 'text-green-400' : avgDelta < 0 ? 'text-red-400' : 'text-zinc-600'
          }`}>
            {avgDelta > 0 ? <TrendingUp className="w-5 h-5" /> : avgDelta < 0 ? <TrendingDown className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
            {avgDelta === 0 ? '0' : (avgDelta > 0 ? '+' : '') + avgDelta.toFixed(1)}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-zinc-900/50 border border-zinc-800 rounded-lg p-1">
        {(['pending', 'all', 'completed', 'skipped'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filter === f ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && overdue.length > 0 && (
              <span className="ml-1.5 bg-red-600 text-white text-[9px] px-1 rounded-full">{overdue.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500 text-sm">Loading follow-ups...</div>
      ) : followups.length === 0 ? (
        <div className="text-center py-12 border border-zinc-800 rounded-xl">
          <SendHorizonal className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-zinc-400 mb-1">No follow-ups {filter !== 'all' ? `with status "${filter}"` : ''}</h3>
          <p className="text-xs text-zinc-600">
            Follow-ups are auto-generated when you log a meeting.{' '}
            <Link href="/meetings/new" className="text-blue-500 hover:text-blue-400">Log a meeting</Link>
          </p>
        </div>
      ) : filter === 'pending' ? (
        <div className="space-y-6">
          {renderSection('Overdue', overdue, overdueExpanded, setOverdueExpanded, 'red', true)}
          {renderSection('Due Today', dueToday, todayExpanded, setTodayExpanded, 'blue')}
          {renderSection('Next 3 Days', upcoming, upcomingExpanded, setUpcomingExpanded, 'zinc')}
          {later.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-zinc-500 mb-3">Later ({later.length})</h2>
              <div className="space-y-2">
                {later.map(item => renderFollowupCard(item))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {followups.map(item => renderFollowupCard(item))}
        </div>
      )}

      {/* Learning section */}
      {completed.length >= 3 && (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-b border-zinc-800 px-5 py-4">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              Follow-up Effectiveness
            </h2>
            <p className="text-[10px] text-zinc-500 mt-1">
              Which follow-up types drive the most conviction change?
            </p>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {Object.entries(byType)
                .sort(([, a], [, b]) => (b.totalDelta / b.count) - (a.totalDelta / a.count))
                .map(([type, stats]) => {
                  const config = ACTION_TYPE_CONFIG[type] || ACTION_TYPE_CONFIG.milestone_update;
                  const Icon = config.icon;
                  const avgTypeDelta = stats.totalDelta / stats.count;
                  return (
                    <div key={type} className="flex items-center gap-3 py-2">
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${config.bgColor}`}>
                        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                      </div>
                      <span className="text-xs text-zinc-300 flex-1">{config.label}</span>
                      <span className="text-xs text-zinc-500">{stats.count} done</span>
                      <span className={`text-xs font-medium flex items-center gap-0.5 ${
                        avgTypeDelta > 0 ? 'text-green-400' : avgTypeDelta < 0 ? 'text-red-400' : 'text-zinc-500'
                      }`}>
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

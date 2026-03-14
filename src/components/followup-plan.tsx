'use client';

import { useState } from 'react';
import {
  SendHorizonal, Clock, CheckCircle2, XCircle, Mail, MessageSquare,
  FolderOpen, CalendarPlus, RefreshCw, Milestone, ChevronDown, ChevronUp,
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

export default function FollowupPlan({
  followups,
  showInvestorName = false,
}: {
  followups: FollowupItem[];
  showInvestorName?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  if (!followups || followups.length === 0) return null;

  const pending = followups.filter(f => f.status === 'pending' && !completedIds.has(f.id) && !skippedIds.has(f.id));
  const handled = followups.filter(f => f.status !== 'pending' || completedIds.has(f.id) || skippedIds.has(f.id));

  async function handleAction(id: string, action: 'completed' | 'skipped') {
    try {
      await fetch('/api/followups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: action }),
      });
      if (action === 'completed') {
        setCompletedIds(prev => new Set(prev).add(id));
      } else {
        setSkippedIds(prev => new Set(prev).add(id));
      }
    } catch { /* non-blocking */ }
  }

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-gradient-to-r from-indigo-900/20 to-blue-900/20 border-b border-zinc-800 px-5 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <SendHorizonal className="w-5 h-5 text-indigo-400" />
          <h2 className="text-lg font-bold">Follow-up Plan</h2>
          <span className="text-xs text-zinc-500 ml-2">{pending.length} pending</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
      </button>

      {expanded && (
        <div className="divide-y divide-zinc-800/50">
          {/* Timeline */}
          <div className="px-5 py-4">
            <div className="space-y-3">
              {followups.map((item, idx) => {
                const config = ACTION_TYPE_CONFIG[item.action_type] || ACTION_TYPE_CONFIG.milestone_update;
                const Icon = config.icon;
                const isCompleted = completedIds.has(item.id) || item.status === 'completed';
                const isSkipped = skippedIds.has(item.id) || item.status === 'skipped';
                const isDone = isCompleted || isSkipped;
                const isOverdue = !isDone && new Date(item.due_at) < new Date();
                const timeLabel = formatRelativeTime(item.due_at);

                return (
                  <div
                    key={item.id}
                    className={`relative flex gap-3 ${isDone ? 'opacity-50' : ''}`}
                  >
                    {/* Timeline line */}
                    {idx < followups.length - 1 && (
                      <div className="absolute left-[15px] top-[32px] bottom-[-12px] w-px bg-zinc-800" />
                    )}

                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isDone ? 'bg-zinc-800' : isOverdue ? 'bg-red-900/40' : config.bgColor
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : isSkipped ? (
                        <XCircle className="w-4 h-4 text-zinc-500" />
                      ) : (
                        <Icon className={`w-4 h-4 ${isOverdue ? 'text-red-400' : config.color}`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${
                          isDone ? 'bg-zinc-800 text-zinc-500' : isOverdue ? 'bg-red-900/40 text-red-300' : `${config.bgColor} ${config.color}`
                        }`}>
                          {config.label}
                        </span>
                        <span className={`text-[10px] flex items-center gap-1 ${
                          isOverdue ? 'text-red-400 font-medium' : 'text-zinc-500'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {timeLabel}
                        </span>
                        {showInvestorName && (
                          <span className="text-[10px] text-zinc-600">{item.investor_name}</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-2 whitespace-pre-line">
                        {item.description.split('\n')[0]}
                      </p>

                      {/* Action buttons */}
                      {!isDone && (
                        <div className="flex gap-1.5 mt-2">
                          <button
                            onClick={() => handleAction(item.id, 'completed')}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-green-900/20 text-green-400 hover:bg-green-900/40 transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Done
                          </button>
                          <button
                            onClick={() => handleAction(item.id, 'skipped')}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-zinc-800 text-zinc-500 hover:bg-zinc-700 transition-colors"
                          >
                            <XCircle className="w-3 h-3" /> Skip
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary footer */}
          <div className="px-5 py-3 bg-zinc-900/30">
            <span className="text-xs text-zinc-600">
              {pending.length} follow-up{pending.length !== 1 ? 's' : ''} pending
              {handled.length > 0 && ` · ${handled.length} completed/skipped`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

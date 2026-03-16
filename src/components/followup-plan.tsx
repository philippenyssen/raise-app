'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SendHorizonal, Clock, CheckCircle2, XCircle, Mail, MessageSquare, FolderOpen, CalendarPlus, RefreshCw, Milestone, ChevronDown, ChevronUp } from 'lucide-react';

interface FollowupItem { id: string; meeting_id: string; investor_id: string; investor_name: string; action_type: string; description: string; due_at: string; status: string; outcome: string; conviction_delta: number; created_at: string; completed_at: string | null }
interface ActionTypeConfig { label: string; icon: typeof Mail; color: string; bgColor: string }

const ACTION_TYPE_CONFIG: Record<string, ActionTypeConfig> = {
  thank_you: { label: 'Thank-You Note', icon: Mail, color: 'var(--accent)', bgColor: 'var(--accent-muted)' },
  objection_response: { label: 'Objection Response', icon: MessageSquare, color: 'var(--danger)', bgColor: 'var(--danger-muted)' },
  data_share: { label: 'Share Materials', icon: FolderOpen, color: 'var(--accent)', bgColor: 'var(--accent-muted)' },
  schedule_followup: { label: 'Schedule Meeting', icon: CalendarPlus, color: 'var(--success)', bgColor: 'var(--success-muted)' },
  warm_reengagement: { label: 'Re-engagement', icon: RefreshCw, color: 'var(--warning)', bgColor: 'var(--warning-muted)' },
  milestone_update: { label: 'Milestone Update', icon: Milestone, color: 'var(--warning)', bgColor: 'var(--warning-muted)' },};

function formatRelativeTime(dateStr: string): string {
  const diffMs = new Date(dateStr).getTime() - Date.now();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffMs < 0) { const d = Math.abs(diffDays); return d === 0 ? 'Due now' : `${d}d overdue`; }
  if (diffHours < 1) return 'Due now';
  if (diffHours < 24) return `In ${diffHours}h`;
  if (diffDays === 1) return 'Tomorrow';
  return `In ${diffDays}d`;
}

export default function FollowupPlan({ followups, showInvestorName = false }: { followups: FollowupItem[]; showInvestorName?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!followups || followups.length === 0) return null;
  const pending = followups.filter(f => f.status === 'pending' && !completedIds.has(f.id) && !skippedIds.has(f.id));
  const handled = followups.filter(f => f.status !== 'pending' || completedIds.has(f.id) || skippedIds.has(f.id));

  async function handleAction(id: string, action: 'completed' | 'skipped') {
    if (busyId === id) return;
    setBusyId(id);
    try {
      const res = await fetch('/api/followups', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: action }) });
      if (!res.ok) return;
      if (action === 'completed') setCompletedIds(prev => new Set(prev).add(id));
      else setSkippedIds(prev => new Set(prev).add(id));
    } catch (e) { console.warn('[FOLLOWUP_ACTION]', e instanceof Error ? e.message : e); } finally { setBusyId(null); }
  }

  return (
    <div className="rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(to right, var(--accent-muted), var(--accent-muted))', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <SendHorizonal className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h2 className="text-lg font-normal" style={{ color: 'var(--text-primary)' }}>Follow-up Plan</h2>
          <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{pending.length} pending</span></div>
        {expanded ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
      </button>

      {expanded && (
        <div>
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
                const bgColor = isDone ? 'var(--surface-2)' : isOverdue ? 'var(--danger-muted)' : config.bgColor;
                const iconColor = isDone ? undefined : isOverdue ? 'var(--danger)' : config.color;
                const labelColor = isDone ? 'var(--text-muted)' : isOverdue ? 'var(--danger)' : config.color;

                return (
                  <div key={item.id} className={`relative flex gap-3 ${isDone ? 'opacity-50' : ''}`}>
                    {idx < followups.length - 1 && <div className="absolute left-[15px] top-[32px] bottom-[-12px] w-px" style={{ backgroundColor: 'var(--border-subtle)' }} />}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: bgColor }}>
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--success)' }} />
                        : isSkipped ? <XCircle className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        : <Icon className="w-4 h-4" style={{ color: iconColor }} />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs px-1.5 py-0.5 rounded font-normal " style={{ backgroundColor: bgColor, color: labelColor }}>{config.label}</span>
                        <span className="text-xs flex items-center gap-1" style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 400 }}><Clock className="w-3 h-3" />{timeLabel}</span>
                        {showInvestorName && item.investor_id && (
                          <Link href={`/investors/${item.investor_id}`} className="text-xs" style={{ color: 'var(--accent)', textDecoration: 'none' }}
                            onClick={e => e.stopPropagation()}>{item.investor_name}</Link>
                        )}
                        {showInvestorName && !item.investor_id && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.investor_name}</span>}
                      </div>
                      <p className="text-xs line-clamp-2 whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>{item.description.split('\n')[0]}</p>
                      {!isDone && (
                        <div className="flex gap-1.5 mt-2">
                          <button onClick={() => handleAction(item.id, 'completed')} disabled={busyId === item.id} className="btn-surface flex items-center gap-1 px-2 py-1 rounded text-xs font-normal transition-colors" style={{ backgroundColor: 'var(--success-muted)', color: 'var(--success)', opacity: busyId === item.id ? 0.5 : 1 }}><CheckCircle2 className="w-3 h-3" /> Done</button>
                          <button onClick={() => handleAction(item.id, 'skipped')} disabled={busyId === item.id} className="btn-surface flex items-center gap-1 px-2 py-1 rounded text-xs font-normal transition-colors" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)', opacity: busyId === item.id ? 0.5 : 1 }}><XCircle className="w-3 h-3" /> Skip</button>
                        </div>
                      )}</div>
                  </div>);
              })}</div></div>
          <div className="px-5 py-3" style={{ backgroundColor: 'var(--surface-1)', borderTop: '1px solid color-mix(in srgb, var(--border-subtle) 50%, transparent)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{pending.length} follow-up{pending.length !== 1 ? 's' : ''} pending{handled.length > 0 && ` · ${handled.length} completed/skipped`}</span>
          </div></div>
      )}
    </div>);
}

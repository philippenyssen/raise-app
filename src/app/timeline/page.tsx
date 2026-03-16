'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { cachedFetch } from '@/lib/cache';
import {
  CheckCircle2, Circle, Clock, AlertCircle, Plus, Trash2,
  ListTodo, Activity
} from 'lucide-react';
import type { Task, ActivityEvent, TaskStatus, TaskPriority, RaisePhase } from '@/lib/types';
import { useToast } from '@/components/toast';
import Link from 'next/link';
import { stAccent, stTextMuted, stTextPrimary, stTextSecondary } from '@/lib/styles';

const progressTrackBg = { backgroundColor: 'var(--surface-2)' } as const;
const tabCountBadge = { backgroundColor: 'var(--surface-2)', color: 'var(--text-tertiary)' } as const;
const autoGenBadge = { backgroundColor: 'color-mix(in srgb, var(--accent-muted) 20%, transparent)', color: 'var(--accent-muted)' } as const;
const filterSelectStyle = { backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' } as const;
const taskStatusSelect = { backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' } as const;
const eventTypeBadge = { backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' } as const;

function taskRowStyle(status: string, isOverdue: boolean): React.CSSProperties {
  if (status === 'done') return {
    border: '1px solid color-mix(in srgb, var(--border-subtle) 30%, transparent)',
    backgroundColor: 'color-mix(in srgb, var(--surface-1) 20%, transparent)',
    opacity: 0.6,
  };
  if (isOverdue) return {
    border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
    backgroundColor: 'color-mix(in srgb, var(--danger) 5%, transparent)',
    opacity: 1,
  };
  return { border: '1px solid var(--border-subtle)', backgroundColor: 'transparent', opacity: 1 };
}

function statusIconColor(status: string): string {
  if (status === 'done') return 'var(--success)';
  if (status === 'blocked') return 'var(--danger)';
  if (status === 'in_progress') return 'var(--accent)';
  return 'var(--text-muted)';
}

const PHASE_LABELS: Record<RaisePhase, string> = {
  preparation: 'Preparation',
  outreach: 'Outreach',
  management_presentations: 'Mgmt Presentations',
  due_diligence: 'Due Diligence',
  term_sheets: 'Term Sheets',
  negotiation: 'Negotiation',
  closing: 'Closing',};

const PHASE_ORDER: RaisePhase[] = ['preparation', 'outreach', 'management_presentations', 'due_diligence', 'term_sheets', 'negotiation', 'closing'];

const STATUS_ICONS: Record<TaskStatus, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  pending: Circle,
  in_progress: Clock,
  done: CheckCircle2,
  blocked: AlertCircle,
  cancelled: Circle,};

const PRIORITY_STYLES: Record<TaskPriority, React.CSSProperties> = {
  critical: { backgroundColor: 'color-mix(in srgb, var(--danger) 20%, transparent)', color: 'var(--text-primary)' },
  high: { backgroundColor: 'color-mix(in srgb, var(--warning) 20%, transparent)', color: 'var(--text-tertiary)' },
  medium: { backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' },
  low: { backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' },};

type ViewTab = 'tasks' | 'activity';

export default function TimelinePage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<ViewTab>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filterPhase, setFilterPhase] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [taskRes, actRes] = await Promise.all([
      cachedFetch('/api/tasks').then(r => r.json()).catch(() => []),
      cachedFetch('/api/tasks?type=activity&limit=30').then(r => r.json()).catch(() => []),]);
    setTasks(Array.isArray(taskRes) ? taskRes : []);
    setActivity(Array.isArray(actRes) ? actRes : []);
    setLoading(false);
  }, []);

  useEffect(() => { document.title = 'Raise | Timeline & Tasks'; }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showAdd) setShowAdd(false);
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchData(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showAdd, fetchData]);

  async function toggleTask(task: Task) {
    const newStatus = task.status === 'done' ? 'pending' : 'done';
    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, status: newStatus, title: task.title, investor_id: task.investor_id, investor_name: task.investor_name }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      toast(newStatus === 'done' ? 'Task completed' : 'Task reopened');
      fetchData();
    } catch (e) { console.warn('[TIMELINE_TOGGLE]', e instanceof Error ? e.message : e); toast('Couldn\'t update task — try again', 'error'); }
  }

  async function updateTaskStatus(id: string, status: string) {
    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),});
      if (!res.ok) throw new Error('Failed to update');
      toast(`Status updated to ${status.replace(/_/g, ' ')}`);
      fetchData();
    } catch (e) { console.warn('[TIMELINE_STATUS]', e instanceof Error ? e.message : e); toast('Couldn\'t update status — try again', 'error'); }
  }

  async function deleteTaskById(id: string) {
    try {
      const res = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast('Task deleted');
      fetchData();
    } catch (e) { console.warn('[TIMELINE_DELETE]', e instanceof Error ? e.message : e); toast('Couldn\'t delete task — try again', 'error'); }
  }

  async function handleAddTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    fd.forEach((v, k) => { data[k] = v as string; });
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),});
      if (!res.ok) throw new Error('Failed to create');
      toast('Task created');
      setShowAdd(false);
      fetchData();
    } catch (e) { console.warn('[TIMELINE_CREATE]', e instanceof Error ? e.message : e); toast('Couldn\'t create task — check all fields and retry', 'error'); }
    setCreating(false);
  }

  const { filteredTasks, tasksByPhase } = useMemo(() => {
    const ft = tasks.filter(t => {
      if (filterPhase && t.phase !== filterPhase) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      return true;
    });
    const byPhase: Record<string, Task[]> = {};
    for (const t of ft) {
      if (!byPhase[t.phase]) byPhase[t.phase] = [];
      byPhase[t.phase].push(t);
    }
    return { filteredTasks: ft, tasksByPhase: byPhase };
  }, [tasks, filterPhase, filterStatus]);

  // Single-pass task stats
  const { pendingCount, doneCount, criticalCount } = useMemo(() => {
    let pending = 0, done = 0, critical = 0;
    for (const t of tasks) {
      if (t.status === 'pending' || t.status === 'in_progress') pending++;
      if (t.status === 'done') done++;
      if (t.priority === 'critical' && t.status !== 'done') critical++;
    }
    return { pendingCount: pending, doneCount: done, criticalCount: critical };
  }, [tasks]);

  if (loading) {
    return (
      <div className="space-y-6 page-content">
        <div className="skeleton" style={{ height: '28px', width: '200px' }} />
        <div className="space-y-2">
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: '48px', borderRadius: 'var(--radius-md)' }} />)}
        </div>
      </div>);
  }

  return (
    <div className="space-y-6 page-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Timeline & Tasks</h1>
          <p className="text-sm mt-1" style={stTextMuted}>
            {pendingCount} pending, {doneCount} done{criticalCount > 0 ? `, ${criticalCount} critical` : ''}</p></div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 rounded-lg text-sm font-normal flex items-center gap-2 btn-accent-hover"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--surface-0)' }}>
          <Plus className="w-3.5 h-3.5" /> Add Task</button></div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {PHASE_ORDER.slice(0, 4).map(phase => {
          const pTasks = tasks.filter(t => t.phase === phase);
          const pDone = pTasks.filter(t => t.status === 'done').length;
          return (
            <div key={phase} className="rounded-xl p-3">
              <div className="text-xs mb-1" style={stTextMuted}>{PHASE_LABELS[phase]}</div>
              <div className="text-lg font-normal" style={stTextPrimary}>{pDone}/{pTasks.length}</div>
              {pTasks.length > 0 && (
                <div className="w-full h-1.5 rounded-full mt-2" style={progressTrackBg}>
                  <div className="h-full rounded-full" style={{ backgroundColor: 'var(--accent)', width: `${(pDone / pTasks.length) * 100}%` }}
                    /></div>
              )}
            </div>);
        })}</div>

      {/* Add Task Form */}
      {showAdd && (
        <form onSubmit={handleAddTask} className="rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs block mb-1" style={stTextMuted}>Title</label>
              <input name="title" required className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                /></div>
            <div>
              <label className="text-xs block mb-1" style={stTextMuted}>Priority</label>
              <select name="priority" defaultValue="medium" className="w-full rounded-lg px-3 py-2 text-sm" style={filterSelectStyle}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option></select></div>
            <div>
              <label className="text-xs block mb-1" style={stTextMuted}>Phase</label>
              <select name="phase" defaultValue="preparation" className="w-full rounded-lg px-3 py-2 text-sm" style={filterSelectStyle}>
                {PHASE_ORDER.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}</select></div>
            <div>
              <label className="text-xs block mb-1" style={stTextMuted}>Due Date</label>
              <input name="due_date" type="date" className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                /></div>
            <div>
              <label className="text-xs block mb-1" style={stTextMuted}>Assignee</label>
              <input name="assignee" className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                /></div>
            <div>
              <label className="text-xs block mb-1" style={stTextMuted}>Investor</label>
              <input name="investor_name" placeholder="(optional)" className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                /></div></div>
          <div>
            <label className="text-xs block mb-1" style={stTextMuted}>Description</label>
            <input name="description" className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              /></div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-3 py-1.5 rounded-lg text-sm btn-accent-hover"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--surface-0)', opacity: creating ? 0.6 : 1 }}>
              {creating ? 'Creating...' : 'Create'}</button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
              Cancel</button></div></form>
      )}

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => setTab('tasks')}
          className={`px-4 py-2.5 text-sm font-normal flex items-center gap-2 transition-colors ${tab !== 'tasks' ? 'tab-hover' : ''}`}
          style={{
            borderBottom: tab === 'tasks' ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === 'tasks' ? 'var(--text-primary)' : 'var(--text-muted)', }}>
          <ListTodo className="w-3.5 h-3.5" /> Tasks
          <span className="text-xs px-1.5 py-0.5 rounded" style={tabCountBadge}>{tasks.length}</span>
        </button>
        <button
          onClick={() => setTab('activity')}
          className={`px-4 py-2.5 text-sm font-normal flex items-center gap-2 transition-colors ${tab !== 'activity' ? 'tab-hover' : ''}`}
          style={{
            borderBottom: tab === 'activity' ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === 'activity' ? 'var(--text-primary)' : 'var(--text-muted)', }}>
          <Activity className="w-3.5 h-3.5" /> Activity Log
          <span className="text-xs px-1.5 py-0.5 rounded" style={tabCountBadge}>{activity.length}</span>
        </button></div>

      {tab === 'tasks' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterPhase}
              onChange={e => setFilterPhase(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-sm"
              style={filterSelectStyle}>
              <option value="">All Phases</option>
              {PHASE_ORDER.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}</select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-sm"
              style={filterSelectStyle}>
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="blocked">Blocked</option></select>
            {(filterPhase || filterStatus) && (
              <button
                onClick={() => { setFilterPhase(''); setFilterStatus(''); }}
                className="text-xs px-2 tab-hover"
                style={stTextMuted}>
                Clear</button>
            )}</div>

          {/* Tasks grouped by phase */}
          {Object.keys(tasksByPhase).length === 0 ? (
            <div className="rounded-xl p-8 text-center">
              <ListTodo className="w-8 h-8 mx-auto mb-2" style={stTextMuted} />
              <p className="text-sm" style={stTextMuted}>No tasks yet. Add manually or log a meeting — tasks are auto-generated.</p>
            </div>
          ) : (
            Object.entries(tasksByPhase).map(([phase, phaseTasks]) => (
              <div key={phase}>
                <div className="text-xs font-normal tracking-wider px-1 mb-2" style={stTextMuted}>
                  {PHASE_LABELS[phase as RaisePhase]}</div>
                <div className="space-y-1">
                  {phaseTasks.map(task => {
                    const StatusIcon = STATUS_ICONS[task.status as TaskStatus] || Circle;
                    const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${task.status !== 'done' && !isOverdue ? 'task-row-hover' : ''}`}
                        style={taskRowStyle(task.status, !!isOverdue)}>
                        <button onClick={() => toggleTask(task)} className="shrink-0">
                          <StatusIcon
                            className="w-4 h-4"
                            style={{ color: statusIconColor(task.status) }} /></button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm ${task.status === 'done' ? 'line-through' : ''}`}
                              style={{ color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                              {task.title}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={PRIORITY_STYLES[task.priority as TaskPriority]}>
                              {task.priority}</span>
                            {task.auto_generated && (
                              <span className="text-xs px-1.5 py-0.5 rounded" style={autoGenBadge}>auto</span>
                            )}</div>
                          {task.description && (
                            <p className="text-xs mt-0.5 truncate" style={stTextMuted}>{task.description}</p>
                          )}</div>
                        <div className="flex items-center gap-3 shrink-0">
                          {task.investor_name && (
                            <Link
                              href={`/investors/${task.investor_id}`}
                              className="text-xs hover-opacity-link"
                              style={stAccent}>
                              {task.investor_name}</Link>
                          )}
                          {task.due_date && (
                            <span className="text-xs" style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 400 }}>
                              {task.due_date}</span>
                          )}
                          <select
                            value={task.status}
                            onChange={e => updateTaskStatus(task.id, e.target.value)}
                            className="rounded px-1.5 py-0.5 text-xs"
                            style={taskStatusSelect}>
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                            <option value="blocked">Blocked</option></select>
                          <button
                            onClick={() => deleteTaskById(task.id)}
                            className="icon-delete"
                            title="Delete task"
                            aria-label="Delete task">
                            <Trash2 className="w-3 h-3" /></button></div>
                      </div>);
                  })}</div></div>
            ))
          )}</div>
      )}

      {tab === 'activity' && (
        <div className="space-y-1">
          {activity.length === 0 ? (
            <div className="rounded-xl p-8 text-center">
              <Activity className="w-8 h-8 mx-auto mb-2" style={stTextMuted} />
              <p className="text-sm" style={stTextMuted}>No activity yet. Events are logged automatically as you use the platform.</p>
            </div>
          ) : (
            activity.map(event => {
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 px-3 py-2 rounded-lg hover-row-activity">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={stTextSecondary}>{event.subject}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={eventTypeBadge}>
                        {event.event_type.replace(/_/g, ' ')}</span></div>
                    {event.detail && <p className="text-xs mt-0.5" style={stTextMuted}>{event.detail}</p>}
                    <div className="flex items-center gap-2 mt-0.5">
                      {event.investor_name && (
                        <span className="text-xs" style={stAccent}>{event.investor_name}</span>
                      )}
                      <span className="text-xs" style={stTextMuted}>{event.created_at?.split('T')[0]}</span></div></div>
                </div>);})
          )}</div>
      )}
    </div>);
}

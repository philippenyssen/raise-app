'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2, Circle, Clock, AlertCircle, Plus, Trash2,
  ListTodo, Activity, Filter, ChevronDown
} from 'lucide-react';
import type { Task, ActivityEvent, TaskStatus, TaskPriority, RaisePhase } from '@/lib/types';
import { useToast } from '@/components/toast';
import Link from 'next/link';

const PHASE_LABELS: Record<RaisePhase, string> = {
  preparation: 'Preparation',
  outreach: 'Outreach',
  management_presentations: 'Mgmt Presentations',
  due_diligence: 'Due Diligence',
  term_sheets: 'Term Sheets',
  negotiation: 'Negotiation',
  closing: 'Closing',
};

const PHASE_ORDER: RaisePhase[] = ['preparation', 'outreach', 'management_presentations', 'due_diligence', 'term_sheets', 'negotiation', 'closing'];

const STATUS_ICONS: Record<TaskStatus, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  pending: Circle,
  in_progress: Clock,
  done: CheckCircle2,
  blocked: AlertCircle,
  cancelled: Circle,
};

const PRIORITY_STYLES: Record<TaskPriority, React.CSSProperties> = {
  critical: { backgroundColor: 'color-mix(in srgb, var(--danger) 20%, transparent)', color: 'var(--text-primary)' },
  high: { backgroundColor: 'color-mix(in srgb, var(--warning) 20%, transparent)', color: 'var(--text-tertiary)' },
  medium: { backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' },
  low: { backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' },
};

type ViewTab = 'tasks' | 'activity';

export default function TimelinePage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<ViewTab>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filterPhase, setFilterPhase] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [hoverStates, setHoverStates] = useState<Record<string, boolean>>({});

  const setHover = (key: string, val: boolean) => setHoverStates(prev => ({ ...prev, [key]: val }));

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [taskRes, actRes] = await Promise.all([
      fetch('/api/tasks').then(r => r.json()).catch(() => []),
      fetch('/api/tasks?type=activity&limit=30').then(r => r.json()).catch(() => []),
    ]);
    setTasks(Array.isArray(taskRes) ? taskRes : []);
    setActivity(Array.isArray(actRes) ? actRes : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function toggleTask(task: Task) {
    const newStatus = task.status === 'done' ? 'pending' : 'done';
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, status: newStatus, title: task.title, investor_id: task.investor_id, investor_name: task.investor_name }),
    });
    toast(newStatus === 'done' ? 'Task completed' : 'Task reopened');
    fetchData();
  }

  async function updateTaskStatus(id: string, status: string) {
    await fetch('/api/tasks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    fetchData();
  }

  async function deleteTaskById(id: string) {
    await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
    toast('Task deleted');
    fetchData();
  }

  async function handleAddTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    fd.forEach((v, k) => { data[k] = v as string; });
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    toast('Task created');
    setShowAdd(false);
    fetchData();
  }

  const filteredTasks = tasks.filter(t => {
    if (filterPhase && t.phase !== filterPhase) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    return true;
  });

  // Group tasks by phase
  const tasksByPhase = PHASE_ORDER.reduce<Record<string, Task[]>>((acc, phase) => {
    const phaseTasks = filteredTasks.filter(t => t.phase === phase);
    if (phaseTasks.length > 0) acc[phase] = phaseTasks;
    return acc;
  }, {});

  const pendingCount = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const criticalCount = tasks.filter(t => t.priority === 'critical' && t.status !== 'done').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-12 rounded animate-pulse" style={{ backgroundColor: 'color-mix(in srgb, var(--surface-2) 30%, transparent)' }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Timeline & Tasks</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {pendingCount} pending, {doneCount} done{criticalCount > 0 ? `, ${criticalCount} critical` : ''}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          style={{ backgroundColor: hoverStates['addBtn'] ? 'var(--accent)' : 'var(--accent)', color: 'var(--surface-0)', opacity: hoverStates['addBtn'] ? 0.85 : 1 }}
          onMouseEnter={() => setHover('addBtn', true)}
          onMouseLeave={() => setHover('addBtn', false)}
        >
          <Plus className="w-3.5 h-3.5" /> Add Task
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {PHASE_ORDER.slice(0, 4).map(phase => {
          const pTasks = tasks.filter(t => t.phase === phase);
          const pDone = pTasks.filter(t => t.status === 'done').length;
          return (
            <div key={phase} className="rounded-xl p-3" style={{ border: '1px solid var(--border-subtle)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{PHASE_LABELS[phase]}</div>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{pDone}/{pTasks.length}</div>
              {pTasks.length > 0 && (
                <div className="w-full h-1.5 rounded-full mt-2" style={{ backgroundColor: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full" style={{ backgroundColor: 'var(--accent)', width: `${(pDone / pTasks.length) * 100}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Task Form */}
      {showAdd && (
        <form onSubmit={handleAddTask} className="rounded-xl p-4 space-y-3" style={{ border: '1px solid var(--border-subtle)' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Title</label>
              <input name="title" required className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Priority</label>
              <select name="priority" defaultValue="medium" className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Phase</label>
              <select name="phase" defaultValue="preparation" className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                {PHASE_ORDER.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Due Date</label>
              <input name="due_date" type="date" className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Assignee</label>
              <input name="assignee" className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Investor</label>
              <input name="investor_name" placeholder="(optional)" className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }} />
            </div>
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Description</label>
            <input name="description" className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }} />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--surface-0)' }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => setTab('tasks')}
          className="px-4 py-2.5 text-sm font-medium flex items-center gap-2"
          style={{
            borderBottom: tab === 'tasks' ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === 'tasks' ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
          onMouseEnter={(e) => { if (tab !== 'tasks') e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={(e) => { if (tab !== 'tasks') e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <ListTodo className="w-3.5 h-3.5" /> Tasks
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>{tasks.length}</span>
        </button>
        <button
          onClick={() => setTab('activity')}
          className="px-4 py-2.5 text-sm font-medium flex items-center gap-2"
          style={{
            borderBottom: tab === 'activity' ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === 'activity' ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
          onMouseEnter={(e) => { if (tab !== 'activity') e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={(e) => { if (tab !== 'activity') e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <Activity className="w-3.5 h-3.5" /> Activity Log
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>{activity.length}</span>
        </button>
      </div>

      {tab === 'tasks' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterPhase}
              onChange={e => setFilterPhase(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-sm"
              style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              <option value="">All Phases</option>
              {PHASE_ORDER.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-sm"
              style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="blocked">Blocked</option>
            </select>
            {(filterPhase || filterStatus) && (
              <button
                onClick={() => { setFilterPhase(''); setFilterStatus(''); }}
                className="text-xs px-2"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Tasks grouped by phase */}
          {Object.keys(tasksByPhase).length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ border: '1px dashed var(--border-subtle)' }}>
              <ListTodo className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No tasks yet. Add manually or log a meeting — tasks are auto-generated.</p>
            </div>
          ) : (
            Object.entries(tasksByPhase).map(([phase, phaseTasks]) => (
              <div key={phase}>
                <div className="text-xs font-semibold  tracking-wider px-1 mb-2" style={{ color: 'var(--text-muted)' }}>
                  {PHASE_LABELS[phase as RaisePhase]}
                </div>
                <div className="space-y-1">
                  {phaseTasks.map(task => {
                    const StatusIcon = STATUS_ICONS[task.status as TaskStatus] || Circle;
                    const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();
                    const rowKey = `row-${task.id}`;
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
                        style={{
                          border: task.status === 'done'
                            ? '1px solid color-mix(in srgb, var(--border-subtle) 30%, transparent)'
                            : isOverdue
                            ? '1px solid color-mix(in srgb, var(--danger) 30%, transparent)'
                            : `1px solid ${hoverStates[rowKey] ? 'var(--border-default)' : 'var(--border-subtle)'}`,
                          backgroundColor: task.status === 'done'
                            ? 'color-mix(in srgb, var(--surface-1) 20%, transparent)'
                            : isOverdue
                            ? 'color-mix(in srgb, var(--danger) 5%, transparent)'
                            : 'transparent',
                          opacity: task.status === 'done' ? 0.6 : 1,
                        }}
                        onMouseEnter={() => setHover(rowKey, true)}
                        onMouseLeave={() => setHover(rowKey, false)}
                      >
                        <button onClick={() => toggleTask(task)} className="shrink-0">
                          <StatusIcon
                            className="w-4 h-4"
                            style={{
                              color: task.status === 'done' ? 'var(--success)'
                                : task.status === 'blocked' ? 'var(--danger)'
                                : task.status === 'in_progress' ? 'var(--accent)'
                                : 'var(--text-muted)',
                            }}
                          />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm ${task.status === 'done' ? 'line-through' : ''}`}
                              style={{ color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text-secondary)' }}
                            >
                              {task.title}
                            </span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={PRIORITY_STYLES[task.priority as TaskPriority]}>
                              {task.priority}
                            </span>
                            {task.auto_generated && (
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-muted) 20%, transparent)', color: 'var(--accent-muted)' }}>auto</span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{task.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {task.investor_name && (
                            <Link
                              href={`/investors/${task.investor_id}`}
                              className="text-xs"
                              style={{ color: 'var(--accent)' }}
                              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                            >
                              {task.investor_name}
                            </Link>
                          )}
                          {task.due_date && (
                            <span className="text-xs" style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-muted)', fontWeight: isOverdue ? 500 : 400 }}>
                              {task.due_date}
                            </span>
                          )}
                          <select
                            value={task.status}
                            onChange={e => updateTaskStatus(task.id, e.target.value)}
                            className="rounded px-1.5 py-0.5 text-xs"
                            style={{ backgroundColor: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                            <option value="blocked">Blocked</option>
                          </select>
                          <button
                            onClick={() => deleteTaskById(task.id)}
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="space-y-1">
          {activity.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ border: '1px dashed var(--border-subtle)' }}>
              <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No activity yet. Events are logged automatically as you use the platform.</p>
            </div>
          ) : (
            activity.map(event => {
              const evKey = `ev-${event.id}`;
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 px-3 py-2 rounded-lg"
                  style={{ backgroundColor: hoverStates[evKey] ? 'color-mix(in srgb, var(--surface-1) 30%, transparent)' : 'transparent' }}
                  onMouseEnter={() => setHover(evKey, true)}
                  onMouseLeave={() => setHover(evKey, false)}
                >
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{event.subject}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                        {event.event_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {event.detail && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{event.detail}</p>}
                    <div className="flex items-center gap-2 mt-0.5">
                      {event.investor_name && (
                        <span className="text-xs" style={{ color: 'var(--accent)' }}>{event.investor_name}</span>
                      )}
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{event.created_at?.split('T')[0]}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

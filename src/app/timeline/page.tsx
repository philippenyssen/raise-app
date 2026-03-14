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

const STATUS_ICONS: Record<TaskStatus, React.ComponentType<{ className?: string }>> = {
  pending: Circle,
  in_progress: Clock,
  done: CheckCircle2,
  blocked: AlertCircle,
  cancelled: Circle,
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: 'bg-red-900/30 text-red-400',
  high: 'bg-orange-900/30 text-orange-400',
  medium: 'bg-blue-900/30 text-blue-400',
  low: 'bg-zinc-800 text-zinc-500',
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
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-zinc-800/30 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-blue-400" /> Timeline & Tasks
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {pendingCount} pending, {doneCount} done{criticalCount > 0 ? `, ${criticalCount} critical` : ''}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
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
            <div key={phase} className="border border-zinc-800 rounded-xl p-3">
              <div className="text-xs text-zinc-500 mb-1">{PHASE_LABELS[phase]}</div>
              <div className="text-lg font-bold">{pDone}/{pTasks.length}</div>
              {pTasks.length > 0 && (
                <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-2">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(pDone / pTasks.length) * 100}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Task Form */}
      {showAdd && (
        <form onSubmit={handleAddTask} className="border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Title</label>
              <input name="title" required className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600 text-zinc-200" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Priority</label>
              <select name="priority" defaultValue="medium" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200">
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Phase</label>
              <select name="phase" defaultValue="preparation" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200">
                {PHASE_ORDER.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Due Date</label>
              <input name="due_date" type="date" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Assignee</label>
              <input name="assignee" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Investor</label>
              <input name="investor_name" placeholder="(optional)" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200" />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Description</label>
            <input name="description" className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm">Create</button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        <button
          onClick={() => setTab('tasks')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 ${
            tab === 'tasks' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <ListTodo className="w-3.5 h-3.5" /> Tasks
          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{tasks.length}</span>
        </button>
        <button
          onClick={() => setTab('activity')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 ${
            tab === 'activity' ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Activity className="w-3.5 h-3.5" /> Activity Log
          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{activity.length}</span>
        </button>
      </div>

      {tab === 'tasks' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={filterPhase}
              onChange={e => setFilterPhase(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300"
            >
              <option value="">All Phases</option>
              {PHASE_ORDER.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
              <option value="blocked">Blocked</option>
            </select>
            {(filterPhase || filterStatus) && (
              <button onClick={() => { setFilterPhase(''); setFilterStatus(''); }} className="text-xs text-zinc-500 hover:text-zinc-300 px-2">Clear</button>
            )}
          </div>

          {/* Tasks grouped by phase */}
          {Object.keys(tasksByPhase).length === 0 ? (
            <div className="border border-dashed border-zinc-800 rounded-xl p-8 text-center">
              <ListTodo className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-600">No tasks yet. Add manually or log a meeting — tasks are auto-generated.</p>
            </div>
          ) : (
            Object.entries(tasksByPhase).map(([phase, phaseTasks]) => (
              <div key={phase}>
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-1 mb-2">
                  {PHASE_LABELS[phase as RaisePhase]}
                </div>
                <div className="space-y-1">
                  {phaseTasks.map(task => {
                    const StatusIcon = STATUS_ICONS[task.status as TaskStatus] || Circle;
                    const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date();
                    return (
                      <div key={task.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                        task.status === 'done' ? 'border-zinc-800/30 bg-zinc-900/20 opacity-60' :
                        isOverdue ? 'border-red-800/50 bg-red-950/10' :
                        'border-zinc-800 hover:border-zinc-700'
                      }`}>
                        <button onClick={() => toggleTask(task)} className="shrink-0">
                          <StatusIcon className={`w-4 h-4 ${
                            task.status === 'done' ? 'text-green-500' :
                            task.status === 'blocked' ? 'text-red-500' :
                            task.status === 'in_progress' ? 'text-blue-500' :
                            'text-zinc-600'
                          }`} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${task.status === 'done' ? 'line-through text-zinc-600' : 'text-zinc-200'}`}>
                              {task.title}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLORS[task.priority as TaskPriority]}`}>
                              {task.priority}
                            </span>
                            {task.auto_generated && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/20 text-purple-400">auto</span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-xs text-zinc-500 mt-0.5 truncate">{task.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {task.investor_name && (
                            <Link href={`/investors/${task.investor_id}`} className="text-xs text-blue-400 hover:text-blue-300">
                              {task.investor_name}
                            </Link>
                          )}
                          {task.due_date && (
                            <span className={`text-xs ${isOverdue ? 'text-red-400 font-medium' : 'text-zinc-500'}`}>
                              {task.due_date}
                            </span>
                          )}
                          <select
                            value={task.status}
                            onChange={e => updateTaskStatus(task.id, e.target.value)}
                            className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-xs text-zinc-400"
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="done">Done</option>
                            <option value="blocked">Blocked</option>
                          </select>
                          <button onClick={() => deleteTaskById(task.id)} className="text-zinc-600 hover:text-red-400">
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
            <div className="border border-dashed border-zinc-800 rounded-xl p-8 text-center">
              <Activity className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-600">No activity yet. Events are logged automatically as you use the platform.</p>
            </div>
          ) : (
            activity.map(event => (
              <div key={event.id} className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-zinc-900/30">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-blue-500" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-300">{event.subject}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                      {event.event_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {event.detail && <p className="text-xs text-zinc-500 mt-0.5">{event.detail}</p>}
                  <div className="flex items-center gap-2 mt-0.5">
                    {event.investor_name && (
                      <span className="text-xs text-blue-400">{event.investor_name}</span>
                    )}
                    <span className="text-xs text-zinc-600">{event.created_at?.split('T')[0]}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

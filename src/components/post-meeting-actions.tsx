'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, XCircle, ClipboardList, FileWarning, UserCheck,
  ChevronDown, ChevronUp, AlertTriangle, Clock, ArrowRight
} from 'lucide-react';
import { STATUS_LABELS, PRIORITY_BADGE_STYLES } from '@/lib/constants';

interface TaskAction {
  id: string;
  title: string;
  description: string;
  due_date: string;
  priority: string;
  phase: string;
  status: string;
  investor_name: string;
}

interface DocumentFlagAction {
  id: string;
  document_id: string;
  flag_type: string;
  description: string;
  section_hint: string;
  objection_text: string;
  investor_name: string;
  status: string;
}

interface InvestorUpdate {
  enthusiasm: number;
  suggested_status: string;
  previous_status?: string;
  previous_enthusiasm?: number;
}

interface PostMeetingActionsData {
  tasks: TaskAction[];
  document_flags: DocumentFlagAction[];
  investor_updates: InvestorUpdate;
}

const PRIORITY_STYLES = PRIORITY_BADGE_STYLES;

const FLAG_TYPE_LABELS: Record<string, string> = {
  objection_response: 'Objection Response Needed',
  number_update: 'Numbers Need Review',
  section_improvement: 'Section Improvement',
};

const FLAG_TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  objection_response: { bg: 'var(--danger-muted)', color: 'var(--danger)' },
  number_update: { bg: 'var(--warning-muted)', color: 'var(--warning)' },
  section_improvement: { bg: 'var(--accent-muted)', color: 'var(--accent)' },
};

export default function PostMeetingActions({
  data,
  meetingId,
  onActionTaken,
}: {
  data: PostMeetingActionsData;
  meetingId: string;
  onActionTaken?: () => void;
}) {
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [flagsExpanded, setFlagsExpanded] = useState(true);
  const [dismissedTasks, setDismissedTasks] = useState<Set<string>>(new Set());
  const [dismissedFlags, setDismissedFlags] = useState<Set<string>>(new Set());
  const [acceptedTasks, setAcceptedTasks] = useState<Set<string>>(new Set());
  const [acceptedFlags, setAcceptedFlags] = useState<Set<string>>(new Set());
  const [hoveredAcceptTask, setHoveredAcceptTask] = useState<string | null>(null);
  const [hoveredDismissTask, setHoveredDismissTask] = useState<string | null>(null);
  const [hoveredAcceptFlag, setHoveredAcceptFlag] = useState<string | null>(null);
  const [hoveredDismissFlag, setHoveredDismissFlag] = useState<string | null>(null);
  const [hoveredViewTasks, setHoveredViewTasks] = useState(false);
  const [hoveredViewDocs, setHoveredViewDocs] = useState(false);

  const hasActions = data.tasks.length > 0 || data.document_flags.length > 0;

  async function handleTaskAction(taskId: string, operation: 'accept' | 'dismiss') {
    try {
      await fetch(`/api/meetings/${meetingId}/actions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: 'task', action_id: taskId, operation }),
      });
      if (operation === 'dismiss') {
        setDismissedTasks(prev => new Set(prev).add(taskId));
      } else {
        setAcceptedTasks(prev => new Set(prev).add(taskId));
      }
      onActionTaken?.();
    } catch { /* ignore */ }
  }

  async function handleFlagAction(flagId: string, operation: 'accept' | 'dismiss') {
    try {
      await fetch(`/api/meetings/${meetingId}/actions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: 'document_flag', action_id: flagId, operation }),
      });
      if (operation === 'dismiss') {
        setDismissedFlags(prev => new Set(prev).add(flagId));
      } else {
        setAcceptedFlags(prev => new Set(prev).add(flagId));
      }
      onActionTaken?.();
    } catch { /* ignore */ }
  }

  if (!hasActions && !data.investor_updates.suggested_status) {
    return null;
  }

  const statusChanged = data.investor_updates.previous_status &&
    data.investor_updates.previous_status !== data.investor_updates.suggested_status;
  const enthusiasmChanged = data.investor_updates.previous_enthusiasm !== undefined &&
    data.investor_updates.previous_enthusiasm !== data.investor_updates.enthusiasm;

  const visibleTasks = data.tasks.filter(t => !dismissedTasks.has(t.id));
  const visibleFlags = data.document_flags.filter(f => !dismissedFlags.has(f.id));

  const enthusiasmColor = data.investor_updates.enthusiasm >= 4
    ? 'var(--success)'
    : data.investor_updates.enthusiasm >= 3
      ? 'var(--accent)'
      : 'var(--warning)';

  return (
    <div className="rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-4"
        style={{
          background: 'linear-gradient(to right, var(--accent-muted), color-mix(in srgb, var(--accent-muted) 60%, var(--surface-0)))',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
        <h2 className="text-lg font-normal flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <ClipboardList className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          Post-Meeting Actions
        </h2>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {visibleTasks.length} task{visibleTasks.length !== 1 ? 's' : ''} generated, {visibleFlags.length} document flag{visibleFlags.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div>
        {/* Investor Profile Updates */}
        {(statusChanged || enthusiasmChanged) && (
          <div className="px-5 py-4" style={{ borderBottom: '1px solid color-mix(in srgb, var(--border-subtle) 50%, transparent)' }}>
            <h3 className="text-xs font-normal mb-3 flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <UserCheck className="w-3.5 h-3.5" /> Investor profile updated
            </h3>
            <div className="flex flex-wrap gap-3">
              {statusChanged && (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: 'var(--surface-1)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{STATUS_LABELS[data.investor_updates.previous_status!] || data.investor_updates.previous_status}</span>
                  <ArrowRight className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: 'var(--accent)', fontWeight: 400 }}>{STATUS_LABELS[data.investor_updates.suggested_status] || data.investor_updates.suggested_status}</span>
                </div>
              )}
              {enthusiasmChanged && (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: 'var(--surface-1)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Enthusiasm:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{data.investor_updates.previous_enthusiasm}/5</span>
                  <ArrowRight className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ color: enthusiasmColor, fontWeight: 400 }}>
                    {data.investor_updates.enthusiasm}/5
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generated Tasks */}
        {visibleTasks.length > 0 && (
          <div className="px-5 py-4" style={{ borderBottom: '1px solid color-mix(in srgb, var(--border-subtle) 50%, transparent)' }}>
            <button
              onClick={() => setTasksExpanded(!tasksExpanded)}
              className="w-full flex items-center justify-between text-xs font-normal mb-3"
              style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-2">
                <ClipboardList className="w-3.5 h-3.5" /> Generated tasks ({visibleTasks.length})
              </span>
              {tasksExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {tasksExpanded && (
              <div className="space-y-2">
                {visibleTasks.map(task => {
                  const isAccepted = acceptedTasks.has(task.id);
                  const pStyle = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
                  return (
                    <div
                      key={task.id}
                      className="rounded-lg p-3 transition-all"
                      style={{
                        border: isAccepted
                          ? '1px solid color-mix(in srgb, var(--success) 50%, transparent)'
                          : '1px solid var(--border-subtle)',
                        backgroundColor: isAccepted
                          ? 'color-mix(in srgb, var(--success) 10%, transparent)'
                          : 'var(--surface-1)',
                      }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-normal "
                              style={{
                                backgroundColor: pStyle.bg,
                                color: pStyle.color,
                              }}>
                              {task.priority}
                            </span>
                            <span className="text-sm font-normal truncate" style={{ color: 'var(--text-primary)' }}>{task.title}</span>
                          </div>
                          {task.description && (
                            <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{task.description.split('\n')[0]}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Due: {task.due_date}
                            </span>
                            <span className="capitalize">{task.phase.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                        {!isAccepted && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleTaskAction(task.id, 'accept')}
                              onMouseEnter={() => setHoveredAcceptTask(task.id)}
                              onMouseLeave={() => setHoveredAcceptTask(null)}
                              className="p-1.5 rounded-md transition-colors"
                              style={{
                                color: hoveredAcceptTask === task.id ? 'var(--success)' : 'var(--text-muted)',
                                backgroundColor: hoveredAcceptTask === task.id ? 'var(--success-muted)' : 'transparent',
                              }}
                              title="Accept task"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleTaskAction(task.id, 'dismiss')}
                              onMouseEnter={() => setHoveredDismissTask(task.id)}
                              onMouseLeave={() => setHoveredDismissTask(null)}
                              className="p-1.5 rounded-md transition-colors"
                              style={{
                                color: hoveredDismissTask === task.id ? 'var(--danger)' : 'var(--text-muted)',
                                backgroundColor: hoveredDismissTask === task.id ? 'var(--danger-muted)' : 'transparent',
                              }}
                              title="Dismiss task"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {isAccepted && (
                          <span className="text-xs flex items-center gap-1 shrink-0" style={{ color: 'var(--success)' }}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Accepted
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Document Flags */}
        {visibleFlags.length > 0 && (
          <div className="px-5 py-4" style={{ borderBottom: '1px solid color-mix(in srgb, var(--border-subtle) 50%, transparent)' }}>
            <button
              onClick={() => setFlagsExpanded(!flagsExpanded)}
              className="w-full flex items-center justify-between text-xs font-normal mb-3"
              style={{ color: 'var(--text-secondary)' }}>
              <span className="flex items-center gap-2">
                <FileWarning className="w-3.5 h-3.5" /> Document flags ({visibleFlags.length})
              </span>
              {flagsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {flagsExpanded && (
              <div className="space-y-2">
                {visibleFlags.map(flag => {
                  const isAccepted = acceptedFlags.has(flag.id);
                  const fStyle = FLAG_TYPE_STYLES[flag.flag_type] || { bg: 'var(--surface-2)', color: 'var(--text-secondary)' };
                  return (
                    <div
                      key={flag.id}
                      className="rounded-lg p-3 transition-all"
                      style={{
                        border: isAccepted
                          ? '1px solid color-mix(in srgb, var(--success) 50%, transparent)'
                          : '1px solid var(--border-subtle)',
                        backgroundColor: isAccepted
                          ? 'color-mix(in srgb, var(--success) 10%, transparent)'
                          : 'var(--surface-1)',
                      }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-normal"
                              style={{ backgroundColor: fStyle.bg, color: fStyle.color }}>
                              {FLAG_TYPE_LABELS[flag.flag_type] || flag.flag_type}
                            </span>
                            <AlertTriangle className="w-3 h-3" style={{ color: 'color-mix(in srgb, var(--warning) 70%, transparent)' }} />
                          </div>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{flag.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                            <span>Section: {flag.section_hint}</span>
                            {flag.document_id && (
                              <Link
                                href={`/documents/${flag.document_id}`}
                                className="underline transition-colors"
                                style={{ color: 'var(--accent)' }}
                                onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = '0.8'; }}
                                onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}>
                                Open document
                              </Link>
                            )}
                          </div>
                        </div>
                        {!isAccepted && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleFlagAction(flag.id, 'accept')}
                              onMouseEnter={() => setHoveredAcceptFlag(flag.id)}
                              onMouseLeave={() => setHoveredAcceptFlag(null)}
                              className="p-1.5 rounded-md transition-colors"
                              style={{
                                color: hoveredAcceptFlag === flag.id ? 'var(--success)' : 'var(--text-muted)',
                                backgroundColor: hoveredAcceptFlag === flag.id ? 'var(--success-muted)' : 'transparent',
                              }}
                              title="Acknowledge flag"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleFlagAction(flag.id, 'dismiss')}
                              onMouseEnter={() => setHoveredDismissFlag(flag.id)}
                              onMouseLeave={() => setHoveredDismissFlag(null)}
                              className="p-1.5 rounded-md transition-colors"
                              style={{
                                color: hoveredDismissFlag === flag.id ? 'var(--danger)' : 'var(--text-muted)',
                                backgroundColor: hoveredDismissFlag === flag.id ? 'var(--danger-muted)' : 'transparent',
                              }}
                              title="Dismiss flag"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {isAccepted && (
                          <span className="text-xs flex items-center gap-1 shrink-0" style={{ color: 'var(--success)' }}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Noted
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Actions summary footer */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ backgroundColor: 'var(--surface-1)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Tasks and flags are saved automatically. View all in Timeline &amp; Tasks.
          </span>
          <div className="flex gap-2">
            <Link
              href="/timeline"
              className="text-xs transition-colors"
              style={{ color: hoveredViewTasks ? 'color-mix(in srgb, var(--accent) 80%, var(--text-primary))' : 'var(--accent)' }}
              onMouseEnter={() => setHoveredViewTasks(true)}
              onMouseLeave={() => setHoveredViewTasks(false)}
            >
              View Tasks
            </Link>
            <Link
              href="/documents"
              className="text-xs transition-colors"
              style={{ color: hoveredViewDocs ? 'color-mix(in srgb, var(--accent) 80%, var(--text-primary))' : 'var(--accent)' }}
              onMouseEnter={() => setHoveredViewDocs(true)}
              onMouseLeave={() => setHoveredViewDocs(false)}
            >
              View Documents
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, XCircle, ClipboardList, FileWarning, UserCheck,
  ChevronDown, ChevronUp, AlertTriangle, Clock, ArrowRight
} from 'lucide-react';

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

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-900/40 text-red-300 border-red-800/50',
  high: 'bg-orange-900/40 text-orange-300 border-orange-800/50',
  medium: 'bg-blue-900/40 text-blue-300 border-blue-800/50',
  low: 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

const FLAG_TYPE_LABELS: Record<string, string> = {
  objection_response: 'Objection Response Needed',
  number_update: 'Numbers Need Review',
  section_improvement: 'Section Improvement',
};

const FLAG_TYPE_STYLES: Record<string, string> = {
  objection_response: 'bg-red-900/30 text-red-400',
  number_update: 'bg-yellow-900/30 text-yellow-400',
  section_improvement: 'bg-blue-900/30 text-blue-400',
};

const STATUS_LABELS: Record<string, string> = {
  met: 'Met',
  engaged: 'Engaged',
  in_dd: 'In DD',
  term_sheet: 'Term Sheet',
  passed: 'Passed',
  contacted: 'Contacted',
  identified: 'Identified',
  nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Scheduled',
  closed: 'Closed',
  dropped: 'Dropped',
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

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-b border-zinc-800 px-5 py-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-blue-400" />
          Post-Meeting Actions
        </h2>
        <p className="text-xs text-zinc-500 mt-1">
          {visibleTasks.length} task{visibleTasks.length !== 1 ? 's' : ''} generated, {visibleFlags.length} document flag{visibleFlags.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="divide-y divide-zinc-800/50">
        {/* Investor Profile Updates */}
        {(statusChanged || enthusiasmChanged) && (
          <div className="px-5 py-4">
            <h3 className="text-xs font-medium text-zinc-400 mb-3 flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5" /> INVESTOR PROFILE UPDATED
            </h3>
            <div className="flex flex-wrap gap-3">
              {statusChanged && (
                <div className="flex items-center gap-2 bg-zinc-900 rounded-lg px-3 py-2 text-sm">
                  <span className="text-zinc-500">Status:</span>
                  <span className="text-zinc-400">{STATUS_LABELS[data.investor_updates.previous_status!] || data.investor_updates.previous_status}</span>
                  <ArrowRight className="w-3 h-3 text-zinc-600" />
                  <span className="text-blue-400 font-medium">{STATUS_LABELS[data.investor_updates.suggested_status] || data.investor_updates.suggested_status}</span>
                </div>
              )}
              {enthusiasmChanged && (
                <div className="flex items-center gap-2 bg-zinc-900 rounded-lg px-3 py-2 text-sm">
                  <span className="text-zinc-500">Enthusiasm:</span>
                  <span className="text-zinc-400">{data.investor_updates.previous_enthusiasm}/5</span>
                  <ArrowRight className="w-3 h-3 text-zinc-600" />
                  <span className={`font-medium ${data.investor_updates.enthusiasm >= 4 ? 'text-green-400' : data.investor_updates.enthusiasm >= 3 ? 'text-blue-400' : 'text-orange-400'}`}>
                    {data.investor_updates.enthusiasm}/5
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generated Tasks */}
        {visibleTasks.length > 0 && (
          <div className="px-5 py-4">
            <button
              onClick={() => setTasksExpanded(!tasksExpanded)}
              className="w-full flex items-center justify-between text-xs font-medium text-zinc-400 mb-3"
            >
              <span className="flex items-center gap-2">
                <ClipboardList className="w-3.5 h-3.5" /> GENERATED TASKS ({visibleTasks.length})
              </span>
              {tasksExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {tasksExpanded && (
              <div className="space-y-2">
                {visibleTasks.map(task => {
                  const isAccepted = acceptedTasks.has(task.id);
                  return (
                    <div
                      key={task.id}
                      className={`rounded-lg border p-3 transition-all ${
                        isAccepted
                          ? 'border-green-800/50 bg-green-900/10'
                          : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium}`}>
                              {task.priority}
                            </span>
                            <span className="text-sm font-medium text-zinc-200 truncate">{task.title}</span>
                          </div>
                          {task.description && (
                            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{task.description.split('\n')[0]}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-600">
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
                              className="p-1.5 rounded-md hover:bg-green-900/30 text-zinc-500 hover:text-green-400 transition-colors"
                              title="Accept task"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleTaskAction(task.id, 'dismiss')}
                              className="p-1.5 rounded-md hover:bg-red-900/30 text-zinc-500 hover:text-red-400 transition-colors"
                              title="Dismiss task"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {isAccepted && (
                          <span className="text-xs text-green-500 flex items-center gap-1 shrink-0">
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
          <div className="px-5 py-4">
            <button
              onClick={() => setFlagsExpanded(!flagsExpanded)}
              className="w-full flex items-center justify-between text-xs font-medium text-zinc-400 mb-3"
            >
              <span className="flex items-center gap-2">
                <FileWarning className="w-3.5 h-3.5" /> DOCUMENT FLAGS ({visibleFlags.length})
              </span>
              {flagsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {flagsExpanded && (
              <div className="space-y-2">
                {visibleFlags.map(flag => {
                  const isAccepted = acceptedFlags.has(flag.id);
                  return (
                    <div
                      key={flag.id}
                      className={`rounded-lg border p-3 transition-all ${
                        isAccepted
                          ? 'border-green-800/50 bg-green-900/10'
                          : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${FLAG_TYPE_STYLES[flag.flag_type] || 'bg-zinc-800 text-zinc-400'}`}>
                              {FLAG_TYPE_LABELS[flag.flag_type] || flag.flag_type}
                            </span>
                            <AlertTriangle className="w-3 h-3 text-yellow-500/70" />
                          </div>
                          <p className="text-xs text-zinc-400 mt-1">{flag.description}</p>
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-600">
                            <span>Section: {flag.section_hint}</span>
                            {flag.document_id && (
                              <Link
                                href={`/documents/${flag.document_id}`}
                                className="text-blue-500 hover:text-blue-400 underline"
                              >
                                Open document
                              </Link>
                            )}
                          </div>
                        </div>
                        {!isAccepted && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleFlagAction(flag.id, 'accept')}
                              className="p-1.5 rounded-md hover:bg-green-900/30 text-zinc-500 hover:text-green-400 transition-colors"
                              title="Acknowledge flag"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleFlagAction(flag.id, 'dismiss')}
                              className="p-1.5 rounded-md hover:bg-red-900/30 text-zinc-500 hover:text-red-400 transition-colors"
                              title="Dismiss flag"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                        {isAccepted && (
                          <span className="text-xs text-green-500 flex items-center gap-1 shrink-0">
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
        <div className="px-5 py-3 bg-zinc-900/30 flex items-center justify-between">
          <span className="text-xs text-zinc-600">
            Tasks and flags are saved automatically. View all in Timeline &amp; Tasks.
          </span>
          <div className="flex gap-2">
            <Link
              href="/timeline"
              className="text-xs text-blue-500 hover:text-blue-400"
            >
              View Tasks
            </Link>
            <Link
              href="/documents"
              className="text-xs text-blue-500 hover:text-blue-400"
            >
              View Documents
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

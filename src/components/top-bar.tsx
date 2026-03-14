'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Bell, Clock, AlertTriangle, Activity } from 'lucide-react';

interface UpcomingTask {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  investor_name: string;
  status: string;
}

interface ActivityItem {
  id: string;
  event_type: string;
  subject: string;
  investor_name: string;
  created_at: string;
}

export function TopBar() {
  const [tasks, setTasks] = useState<UpcomingTask[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function fetchData() {
    try {
      const [tRes, aRes] = await Promise.all([
        fetch('/api/tasks?type=upcoming&limit=10'),
        fetch('/api/tasks?type=activity&limit=5'),
      ]);
      if (tRes.ok) setTasks(await tRes.json());
      if (aRes.ok) setActivity(await aRes.json());
    } catch { /* ignore */ }
  }

  const now = new Date();
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'done');
  const upcoming = tasks.filter(t => !overdue.includes(t)).slice(0, 5);

  return (
    <div className="flex items-center justify-end px-4 py-2 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-30">
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="relative p-2 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <Bell className="w-4.5 h-4.5" />
          {overdue.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {overdue.length}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-50">
            {/* Overdue */}
            {overdue.length > 0 && (
              <div className="p-3 border-b border-zinc-800">
                <div className="flex items-center gap-2 text-xs font-medium text-red-400 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> OVERDUE ({overdue.length})
                </div>
                {overdue.slice(0, 3).map(t => {
                  const days = Math.ceil((now.getTime() - new Date(t.due_date).getTime()) / 86400000);
                  return (
                    <Link key={t.id} href="/timeline" onClick={() => setOpen(false)}
                      className="block py-1.5 px-2 rounded hover:bg-zinc-800 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-zinc-300">{t.title}</span>
                        <span className="text-red-400 text-xs shrink-0 ml-2">{days}d overdue</span>
                      </div>
                      {t.investor_name && <div className="text-xs text-zinc-600">{t.investor_name}</div>}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Upcoming */}
            <div className="p-3 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 mb-2">
                <Clock className="w-3.5 h-3.5" /> UPCOMING
              </div>
              {upcoming.length === 0 ? (
                <p className="text-xs text-zinc-600 py-1">No upcoming tasks</p>
              ) : (
                upcoming.map(t => (
                  <Link key={t.id} href="/timeline" onClick={() => setOpen(false)}
                    className="block py-1.5 px-2 rounded hover:bg-zinc-800 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-zinc-300">{t.title}</span>
                      {t.due_date && <span className="text-zinc-500 text-xs shrink-0 ml-2">{t.due_date}</span>}
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* Activity */}
            <div className="p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-400 mb-2">
                <Activity className="w-3.5 h-3.5" /> RECENT
              </div>
              {activity.length === 0 ? (
                <p className="text-xs text-zinc-600 py-1">No recent activity</p>
              ) : (
                activity.map(a => (
                  <div key={a.id} className="py-1.5 px-2 text-xs">
                    <div className="text-zinc-400 truncate">{a.subject}</div>
                    <div className="text-zinc-600">{new Date(a.created_at).toLocaleDateString()}</div>
                  </div>
                ))
              )}
            </div>

            <Link href="/timeline" onClick={() => setOpen(false)}
              className="block text-center py-2 text-xs text-blue-400 hover:text-blue-300 border-t border-zinc-800">
              View all tasks & activity
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

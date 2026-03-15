'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Bell, Clock, AlertTriangle, Activity, Search } from 'lucide-react';

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    <div
      className="flex items-center justify-end shrink-0 sticky top-0 z-30"
      style={{
        padding: 'var(--space-2) var(--space-4)',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--surface-0)',
      }}
    >
      {/* Search trigger */}
      <button
        onClick={() => {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
        }}
        className="hidden md:flex items-center gap-2 rounded-md transition-colors"
        style={{
          padding: '5px 10px',
          color: 'var(--text-muted)',
          background: 'var(--surface-1)',
          border: '1px solid var(--border-subtle)',
          fontSize: 'var(--font-size-xs)',
          cursor: 'pointer',
          marginRight: 'var(--space-2)',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
      >
        <Search style={{ width: '12px', height: '12px' }} />
        <span>Search</span>
        <span style={{
          padding: '1px 5px',
          borderRadius: '4px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-subtle)',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}>⌘K</span>
      </button>

      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="relative flex items-center justify-center rounded-md transition-colors"
          style={{
            width: '32px',
            height: '32px',
            color: 'var(--text-tertiary)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <Bell style={{ width: '16px', height: '16px' }} />
          {overdue.length > 0 && (
            <span
              className="absolute flex items-center justify-center rounded-full"
              style={{
                top: '2px',
                right: '2px',
                width: '14px',
                height: '14px',
                background: 'var(--danger)',
                color: 'var(--surface-0)',
                fontSize: '9px',
                fontWeight: 700,
              }}
            >
              {overdue.length}
            </span>
          )}
        </button>

        {open && (
          <div
            className="absolute right-0 top-full mt-2 overflow-hidden animate-slide-down"
            style={{
              width: '340px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            {/* Overdue */}
            {overdue.length > 0 && (
              <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-2 mb-2" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--danger)' }}>
                  <AlertTriangle style={{ width: '13px', height: '13px' }} />
                  Overdue ({overdue.length})
                </div>
                {overdue.slice(0, 3).map(t => {
                  const days = Math.ceil((now.getTime() - new Date(t.due_date).getTime()) / 86400000);
                  return (
                    <Link
                      key={t.id}
                      href="/timeline"
                      onClick={() => setOpen(false)}
                      className="block rounded-md transition-colors"
                      style={{
                        padding: 'var(--space-2)',
                        fontSize: 'var(--font-size-sm)',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate" style={{ color: 'var(--text-primary)' }}>{t.title}</span>
                        <span className="shrink-0 ml-2" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger)' }}>{days}d overdue</span>
                      </div>
                      {t.investor_name && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>{t.investor_name}</div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Upcoming */}
            <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 mb-2" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                <Clock style={{ width: '13px', height: '13px' }} />
                Upcoming
              </div>
              {upcoming.length === 0 ? (
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', padding: 'var(--space-1) 0' }}>No upcoming tasks</p>
              ) : (
                upcoming.map(t => (
                  <Link
                    key={t.id}
                    href="/timeline"
                    onClick={() => setOpen(false)}
                    className="block rounded-md transition-colors"
                    style={{
                      padding: 'var(--space-2)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{t.title}</span>
                      {t.due_date && (
                        <span className="shrink-0 ml-2" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          {timeAgo(t.due_date)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>

            {/* Activity */}
            <div style={{ padding: 'var(--space-3)' }}>
              <div className="flex items-center gap-2 mb-2" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                <Activity style={{ width: '13px', height: '13px' }} />
                Recent
              </div>
              {activity.length === 0 ? (
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', padding: 'var(--space-1) 0' }}>No recent activity</p>
              ) : (
                activity.map(a => (
                  <div
                    key={a.id}
                    style={{ padding: 'var(--space-2)', fontSize: 'var(--font-size-xs)' }}
                  >
                    <div className="truncate" style={{ color: 'var(--text-secondary)' }}>{a.subject}</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '1px' }}>{timeAgo(a.created_at)}</div>
                  </div>
                ))
              )}
            </div>

            <Link
              href="/timeline"
              onClick={() => setOpen(false)}
              className="block text-center transition-colors"
              style={{
                padding: 'var(--space-2)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--accent)',
                borderTop: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              View all tasks & activity
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

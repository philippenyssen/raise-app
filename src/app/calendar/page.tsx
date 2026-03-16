'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { cachedFetch } from '@/lib/cache';
import {
  Calendar, ChevronLeft, ChevronRight, Clock,
  Users, SendHorizonal, CheckSquare, AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { labelMuted, labelTertiary, stFontSm, stFontXs, stTextMuted, stTextSecondary, stTextTertiary, cardPad4, flexColGap2 } from '@/lib/styles';

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------
const pageWrap: React.CSSProperties = { maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6)' };
const headerRow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' };
const titleStyle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-2xl)', fontWeight: 300, color: 'var(--text-primary)' };
const navBtnStyle: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-1) var(--space-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' };
const todayBtnStyle: React.CSSProperties = { ...navBtnStyle, fontSize: 'var(--font-size-xs)', fontWeight: 400, padding: 'var(--space-1) var(--space-3)' };
const summaryCardStyle: React.CSSProperties = { padding: 'var(--space-3) var(--space-4)', background: 'var(--surface-1)', borderRadius: 'var(--radius-md)' };
const summaryValueStyle: React.CSSProperties = { fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)', marginTop: 'var(--space-0)' };
const dayHeaderStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-2) 0', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.08em' };
const eventDotBase: React.CSSProperties = { width: '6px', height: '6px', borderRadius: '50%', display: 'inline-block', flexShrink: 0 };
const tierBadge: React.CSSProperties = { fontSize: '9px', fontWeight: 400, padding: '1px 4px', borderRadius: 'var(--radius-xs)', background: 'var(--surface-2)', color: 'var(--text-muted)', lineHeight: 1.3 };
const refreshBtnStyle: React.CSSProperties = { ...navBtnStyle, gap: 'var(--space-1)', fontSize: 'var(--font-size-xs)' };

const TYPE_COLORS: Record<string, string> = {
  meeting: 'var(--accent)',
  followup: 'var(--warning)',
  task: 'var(--text-tertiary)',
};
const TYPE_LABELS: Record<string, string> = {
  meeting: 'Meeting',
  followup: 'Follow-up',
  task: 'Task',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CalendarEvent {
  id: string;
  date: string;
  type: 'meeting' | 'followup' | 'task';
  title: string;
  investorId: string;
  investorName: string;
  investorTier: number;
  status: string;
  meta: Record<string, string | number | undefined>;
}

interface CalendarSummary {
  totalEvents: number;
  todayCount: number;
  upcomingMeetings: number;
  overdueFollowups: number;
  busyDays: number;
  dateRange: { start: string; end: string };
}

interface CalendarData {
  events: CalendarEvent[];
  byDate: Record<string, CalendarEvent[]>;
  summary: CalendarSummary;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function isSameDay(a: string, b: string): boolean {
  return a === b;
}

function getDaysInMonthGrid(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay();
  const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
  const gridStart = new Date(year, month, 1 + mondayOffset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(addDays(gridStart, i));
  }
  return days;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CalendarPage() {
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [view, setView] = useState<'month' | 'week'>('month');
  const [selectedDate, setSelectedDate] = useState<string>(fmtDate(new Date()));
  const [typeFilter, setTypeFilter] = useState<'all' | 'meeting' | 'followup' | 'task'>('all');

  const today = fmtDate(new Date());

  const fetchData = useCallback(() => {
    setLoading(true);
    const rangeStart = fmtDate(addDays(new Date(viewDate.getFullYear(), viewDate.getMonth(), 1), -7));
    const rangeEnd = fmtDate(addDays(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0), 7));
    cachedFetch(`/api/calendar?start=${rangeStart}&end=${rangeEnd}`, { ttl: 60000 })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('fetch failed')))
      .then((d: CalendarData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [viewDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const monthDays = useMemo(() =>
    getDaysInMonthGrid(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate]
  );

  const weekDays = useMemo(() => {
    const ws = startOfWeek(viewDate);
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [viewDate]);

  const visibleDays = view === 'month' ? monthDays : weekDays;

  const selectedEvents = useMemo(() => {
    if (!data) return [];
    const evts = data.byDate[selectedDate] ?? [];
    if (typeFilter === 'all') return evts;
    return evts.filter(e => e.type === typeFilter);
  }, [data, selectedDate, typeFilter]);

  function prevPeriod() {
    setViewDate(v => view === 'month'
      ? new Date(v.getFullYear(), v.getMonth() - 1, 1)
      : addDays(v, -7)
    );
  }

  function nextPeriod() {
    setViewDate(v => view === 'month'
      ? new Date(v.getFullYear(), v.getMonth() + 1, 1)
      : addDays(v, 7)
    );
  }

  function goToday() {
    setViewDate(new Date());
    setSelectedDate(today);
  }

  // Skeleton
  if (loading && !data) {
    return (
      <div style={pageWrap}>
        <div style={headerRow}>
          <div style={titleStyle}>Calendar</div>
        </div>
        <div className="grid grid-cols-4 gap-3" style={{ marginBottom: 'var(--space-6)' }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '70px', borderRadius: 'var(--radius-md)' }} />)}
        </div>
        <div className="skeleton" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  const summary = data?.summary;
  const currentMonth = viewDate.getMonth();

  return (
    <div style={pageWrap}>
      {/* Header */}
      <div style={headerRow}>
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--text-muted)' }}><Calendar className="w-5 h-5" /></span>
          <h1 style={titleStyle}>Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} style={todayBtnStyle}>Today</button>
          <button onClick={prevPeriod} style={navBtnStyle}><ChevronLeft className="w-4 h-4" /></button>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 400, minWidth: '160px', textAlign: 'center' }}>
            {view === 'month' ? fmtMonthYear(viewDate) : `${fmtDate(weekDays[0])} — ${fmtDate(weekDays[6])}`}
          </span>
          <button onClick={nextPeriod} style={navBtnStyle}><ChevronRight className="w-4 h-4" /></button>
          <div className="flex" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <button onClick={() => setView('month')} style={{ ...todayBtnStyle, border: 'none', borderRadius: 0, background: view === 'month' ? 'var(--accent-muted)' : 'var(--surface-1)', color: view === 'month' ? 'var(--accent)' : 'var(--text-secondary)' }}>Month</button>
            <button onClick={() => setView('week')} style={{ ...todayBtnStyle, border: 'none', borderRadius: 0, borderLeft: '1px solid var(--border-subtle)', background: view === 'week' ? 'var(--accent-muted)' : 'var(--surface-1)', color: view === 'week' ? 'var(--accent)' : 'var(--text-secondary)' }}>Week</button>
          </div>
          <button onClick={fetchData} style={refreshBtnStyle}>
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={summaryCardStyle}>
            <div style={labelMuted}>Today</div>
            <div style={summaryValueStyle}>{summary.todayCount}</div>
            <div style={labelTertiary}>event{summary.todayCount !== 1 ? 's' : ''}</div>
          </div>
          <div style={summaryCardStyle}>
            <div style={labelMuted}>Upcoming Meetings</div>
            <div style={summaryValueStyle}>{summary.upcomingMeetings}</div>
            <div style={labelTertiary}>scheduled</div>
          </div>
          <div style={{ ...summaryCardStyle, borderLeft: summary.overdueFollowups > 0 ? '3px solid var(--warning)' : undefined }}>
            <div style={labelMuted}>Overdue Follow-ups</div>
            <div style={{ ...summaryValueStyle, color: summary.overdueFollowups > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{summary.overdueFollowups}</div>
            <div style={labelTertiary}>need attention</div>
          </div>
          <div style={summaryCardStyle}>
            <div style={labelMuted}>Busy Days</div>
            <div style={summaryValueStyle}>{summary.busyDays}</div>
            <div style={labelTertiary}>3+ events</div>
          </div>
        </div>
      )}

      {/* Calendar grid + detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar grid */}
        <div className="lg:col-span-2" style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          {/* Day headers */}
          <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} style={dayHeaderStyle}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className={`grid grid-cols-7`} style={{ minHeight: view === 'month' ? '420px' : '200px' }}>
            {visibleDays.map((day, idx) => {
              const dateStr = fmtDate(day);
              const isCurrentMonth = day.getMonth() === currentMonth;
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const dayEvents = data?.byDate[dateStr] ?? [];
              const meetingCount = dayEvents.filter(e => e.type === 'meeting').length;
              const followupCount = dayEvents.filter(e => e.type === 'followup').length;
              const taskCount = dayEvents.filter(e => e.type === 'task').length;
              const hasOverdue = dayEvents.some(e => e.type === 'followup' && e.date < today && e.status === 'pending');

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(dateStr)}
                  style={{
                    background: isSelected ? 'var(--accent-muted)' : isToday ? 'var(--surface-2)' : 'transparent',
                    border: 'none',
                    borderRight: (idx % 7 !== 6) ? '1px solid var(--border-subtle)' : undefined,
                    borderBottom: '1px solid var(--border-subtle)',
                    padding: 'var(--space-1) var(--space-2)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    verticalAlign: 'top',
                    minHeight: view === 'month' ? '60px' : '100px',
                    opacity: isCurrentMonth || view === 'week' ? 1 : 0.35,
                    position: 'relative',
                  }}
                >
                  <div style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: isToday ? 400 : 300,
                    color: isToday ? 'var(--accent)' : 'var(--text-secondary)',
                    marginBottom: 'var(--space-0)',
                  }}>
                    {day.getDate()}
                  </div>
                  {dayEvents.length > 0 && (
                    <div className="flex flex-wrap gap-1" style={{ marginTop: '2px' }}>
                      {meetingCount > 0 && <span style={{ ...eventDotBase, background: TYPE_COLORS.meeting }} title={`${meetingCount} meeting${meetingCount > 1 ? 's' : ''}`} />}
                      {followupCount > 0 && <span style={{ ...eventDotBase, background: hasOverdue ? 'var(--danger)' : TYPE_COLORS.followup }} title={`${followupCount} follow-up${followupCount > 1 ? 's' : ''}`} />}
                      {taskCount > 0 && <span style={{ ...eventDotBase, background: TYPE_COLORS.task }} title={`${taskCount} task${taskCount > 1 ? 's' : ''}`} />}
                    </div>
                  )}
                  {view === 'week' && dayEvents.slice(0, 4).map(ev => (
                    <div key={ev.id} style={{
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      marginTop: '2px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      padding: '1px 3px',
                      borderRadius: 'var(--radius-xs)',
                      background: ev.type === 'meeting' ? 'var(--accent-muted)' : ev.type === 'followup' ? 'var(--warning-muted)' : 'var(--surface-3)',
                      borderLeft: `2px solid ${TYPE_COLORS[ev.type]}`,
                    }}>
                      {ev.title.slice(0, 30)}
                    </div>
                  ))}
                  {view === 'week' && dayEvents.length > 4 && (
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>+{dayEvents.length - 4} more</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4" style={{ padding: 'var(--space-2) var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-1"><span style={{ ...eventDotBase, background: TYPE_COLORS.meeting }} /> <span style={stFontXs}>Meeting</span></div>
            <div className="flex items-center gap-1"><span style={{ ...eventDotBase, background: TYPE_COLORS.followup }} /> <span style={stFontXs}>Follow-up</span></div>
            <div className="flex items-center gap-1"><span style={{ ...eventDotBase, background: TYPE_COLORS.task }} /> <span style={stFontXs}>Task</span></div>
            <div className="flex items-center gap-1"><span style={{ ...eventDotBase, background: 'var(--danger)' }} /> <span style={stFontXs}>Overdue</span></div>
          </div>
        </div>

        {/* Detail panel */}
        <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          {/* Panel header */}
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
              <div style={labelTertiary}>{selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}</div>
            </div>
            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
              style={{ fontSize: 'var(--font-size-xs)', background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-0) var(--space-2)', color: 'var(--text-secondary)' }}
            >
              <option value="all">All</option>
              <option value="meeting">Meetings</option>
              <option value="followup">Follow-ups</option>
              <option value="task">Tasks</option>
            </select>
          </div>

          {/* Event list */}
          <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
            {selectedEvents.length === 0 ? (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}><Calendar className="w-6 h-6 mx-auto" /></span>
                <div style={{ ...stFontSm, color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>
                  {selectedDate === today ? 'No events today' : 'No events on this day'}
                </div>
              </div>
            ) : (
              selectedEvents.map(ev => (
                <Link
                  key={ev.id}
                  href={ev.investorId ? `/investors/${ev.investorId}` : '#'}
                  style={{ display: 'block', textDecoration: 'none', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex items-start gap-3">
                    <div style={{ marginTop: '4px' }}>
                      <span style={{ ...eventDotBase, width: '8px', height: '8px', background: ev.date < today && ev.status === 'pending' ? 'var(--danger)' : TYPE_COLORS[ev.type] }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2" style={{ marginBottom: '2px' }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: TYPE_COLORS[ev.type], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {TYPE_LABELS[ev.type]}
                        </span>
                        <span style={tierBadge}>T{ev.investorTier}</span>
                        {ev.date < today && ev.status === 'pending' && (
                          <span style={{ fontSize: '9px', color: 'var(--danger)', fontWeight: 400 }}>OVERDUE</span>
                        )}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 400, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.title}
                      </div>
                      <div style={{ ...labelTertiary, marginTop: '2px' }}>
                        {ev.investorName}
                        {ev.meta.duration && <> · {ev.meta.duration}min</>}
                        {ev.meta.location && <> · {String(ev.meta.location)}</>}
                        {ev.meta.priority && <> · {String(ev.meta.priority)} priority</>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

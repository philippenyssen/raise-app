'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Meeting } from '@/lib/types';
import { Search, Filter, FileSearch, Calendar, Download } from 'lucide-react';

const MEETING_TYPES = ['all', 'intro', 'management_presentation', 'deep_dive', 'site_visit', 'dd_session', 'negotiation', 'social'] as const;
const STATUS_OPTIONS = ['all', 'met', 'engaged', 'in_dd', 'term_sheet', 'passed'] as const;

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'engaged': return 'badge badge-purple';
    case 'in_dd': return 'badge badge-amber';
    case 'term_sheet': return 'badge badge-green';
    case 'passed': return 'badge badge-red';
    default: return 'badge badge-zinc';
  }
}

function getObjectionStyle(severity: string): React.CSSProperties {
  switch (severity) {
    case 'showstopper':
      return { background: 'var(--danger-muted)', color: 'var(--danger)' };
    case 'significant':
      return { background: 'var(--warning-muted)', color: 'var(--warning)' };
    default:
      return { background: 'var(--surface-3)', color: 'var(--text-tertiary)' };
  }
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetch('/api/meetings')
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setMeetings)
      .catch(() => {/* meetings remain empty */});
  }, []);

  const filtered = meetings.filter(m => {
    if (search && !m.investor_name.toLowerCase().includes(search.toLowerCase()) &&
        !(m.raw_notes || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'all' && m.type !== typeFilter) return false;
    if (statusFilter !== 'all' && m.status_after !== statusFilter) return false;
    return true;
  });

  // Stats
  const avgEnthusiasm = meetings.length > 0
    ? (meetings.reduce((s, m) => s + m.enthusiasm_score, 0) / meetings.length).toFixed(1)
    : '0';
  const totalObjections = meetings.reduce((s, m) => {
    try { return s + JSON.parse(m.objections || '[]').length; } catch { return s; }
  }, 0);
  const uniqueInvestors = new Set(meetings.map(m => m.investor_id)).size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{/* text-2xl font-bold tracking-tight */}Meetings</h1>
          <p className="page-subtitle" style={{ fontSize: 'var(--font-size-sm)' }}>
            {meetings.length} meetings with {uniqueInvestors} investors
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/meetings/prep"
            className="btn btn-secondary btn-md"
          >
            <FileSearch className="w-3.5 h-3.5" /> Meeting Prep
          </Link>
          <Link
            href="/meetings/new"
            className="btn btn-primary btn-md"
          >
            + Log Meeting
          </Link>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Total Meetings</div>
          <div className="metric-value" style={{ marginTop: '2px' }}>{meetings.length}</div>
        </div>
        <div className="card" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Avg Enthusiasm</div>
          <div className="metric-value" style={{ marginTop: '2px' }}>
            {avgEnthusiasm}<span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>/5</span>
          </div>
        </div>
        <div className="card" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Objections</div>
          <div className="metric-value" style={{ marginTop: '2px', color: 'var(--warning)' }}>{totalObjections}</div>
        </div>
        <div className="card" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Unique Investors</div>
          <div className="metric-value" style={{ marginTop: '2px' }}>{uniqueInvestors}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search investor or notes..."
            className="input"
            style={{ paddingLeft: 'var(--space-10)' }}
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="input"
          style={{ width: 'auto' }}
        >
          {MEETING_TYPES.map(t => (
            <option key={t} value={t}>{t === 'all' ? 'All types' : t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input"
          style={{ width: 'auto' }}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <a
          href="/api/export?type=meetings"
          download
          className="btn btn-secondary btn-md"
        >
          <Download className="w-3.5 h-3.5" /> CSV
        </a>
      </div>

      {/* Meeting List */}
      {filtered.length === 0 ? (
        <div
          className="card"
          style={{ padding: 'var(--space-8)', textAlign: 'center' }}
        >
          <div className="space-y-3">
            <Calendar className="w-8 h-8 mx-auto" style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-tertiary)' }}>
              {meetings.length === 0 ? 'No meetings yet — log your first investor meeting to start tracking engagement.' : 'No meetings match your filters — try adjusting them.'}
            </p>
            {meetings.length === 0 && (
              <Link href="/meetings/new" style={{ color: 'var(--accent)', fontSize: 'var(--font-size-sm)' }}>
                Log your first meeting debrief
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => {
            const objections = (() => { try { return JSON.parse(m.objections || '[]'); } catch { return []; } })();
            const questions = (() => { try { return JSON.parse(m.questions_asked || '[]'); } catch { return []; } })();
            return (
              <div
                key={m.id}
                className="card"
                style={{ padding: 'var(--space-5)' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Link
                      href={`/investors/${m.investor_id}`}
                      style={{ fontWeight: 500, color: 'var(--text-primary)', transition: 'color 150ms ease' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                    >
                      {m.investor_name}
                    </Link>
                    <div className="flex gap-3 mt-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                      <span>{m.date}</span>
                      <span style={{ textTransform: 'capitalize' }}>{m.type.replace(/_/g, ' ')}</span>
                      <span>{m.duration_minutes}min</span>
                      {m.attendees && <span>{m.attendees}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="enthusiasm-dots">
                      {[1,2,3,4,5].map(n => (
                        <div
                          key={n}
                          className={`enthusiasm-dot ${n <= m.enthusiasm_score ? 'enthusiasm-dot-filled' : 'enthusiasm-dot-empty'}`}
                        />
                      ))}
                    </div>
                    <span className={getStatusBadgeClass(m.status_after)}>
                      {m.status_after.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {m.ai_analysis && (
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                    {m.ai_analysis}
                  </p>
                )}

                <div className="flex gap-4" style={{ fontSize: 'var(--font-size-xs)' }}>
                  {questions.length > 0 && (
                    <span style={{ color: 'var(--text-tertiary)' }}>{questions.length} questions</span>
                  )}
                  {objections.length > 0 && (
                    <span style={{ color: 'var(--danger)', opacity: 0.7 }}>{objections.length} objections</span>
                  )}
                  {m.competitive_intel && (
                    <span style={{ color: 'var(--warning)', opacity: 0.7 }}>Intel captured</span>
                  )}
                  {m.next_steps && (
                    <span style={{ color: 'var(--accent)', opacity: 0.7 }}>Next steps defined</span>
                  )}
                </div>

                {objections.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {objections.map((o: { text: string; severity: string }, i: number) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          ...getObjectionStyle(o.severity),
                        }}
                      >
                        {o.text.length > 50 ? o.text.slice(0, 50) + '...' : o.text}
                      </span>
                    ))}
                  </div>
                )}

                {m.next_steps && (
                  <div
                    className="mt-2"
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--accent)',
                      opacity: 0.6,
                      background: 'var(--accent-muted)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '4px 8px',
                    }}
                  >
                    Next: {m.next_steps}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

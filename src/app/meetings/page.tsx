'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Meeting } from '@/lib/types';
import { Search, Filter, FileSearch, Calendar, Download } from 'lucide-react';

const MEETING_TYPES = ['all', 'intro', 'management_presentation', 'deep_dive', 'site_visit', 'dd_session', 'negotiation', 'social'] as const;
const STATUS_OPTIONS = ['all', 'met', 'engaged', 'in_dd', 'term_sheet', 'passed'] as const;

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetch('/api/meetings').then(r => r.json()).then(setMeetings);
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
          <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {meetings.length} meetings with {uniqueInvestors} investors
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/meetings/prep"
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <FileSearch className="w-3.5 h-3.5" /> Meeting Prep
          </Link>
          <Link
            href="/meetings/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
          >
            + Log Meeting
          </Link>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-zinc-500">Total Meetings</div>
          <div className="text-2xl font-bold mt-0.5">{meetings.length}</div>
        </div>
        <div className="border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-zinc-500">Avg Enthusiasm</div>
          <div className="text-2xl font-bold mt-0.5">{avgEnthusiasm}<span className="text-sm text-zinc-600">/5</span></div>
        </div>
        <div className="border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-zinc-500">Objections</div>
          <div className="text-2xl font-bold mt-0.5 text-orange-400">{totalObjections}</div>
        </div>
        <div className="border border-zinc-800 rounded-lg p-3">
          <div className="text-xs text-zinc-500">Unique Investors</div>
          <div className="text-2xl font-bold mt-0.5">{uniqueInvestors}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search investor or notes..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-blue-600"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
        >
          {MEETING_TYPES.map(t => (
            <option key={t} value={t}>{t === 'all' ? 'All types' : t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <a
          href="/api/export?type=meetings"
          download
          className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <Download className="w-3.5 h-3.5" /> CSV
        </a>
      </div>

      {/* Meeting List */}
      {filtered.length === 0 ? (
        <div className="border border-zinc-800 rounded-xl p-8 text-center space-y-3">
          <Calendar className="w-8 h-8 text-zinc-700 mx-auto" />
          <p className="text-zinc-500">{meetings.length === 0 ? 'No meetings logged yet.' : 'No meetings match your filters.'}</p>
          {meetings.length === 0 && (
            <Link href="/meetings/new" className="text-blue-400 hover:text-blue-300 text-sm">
              Log your first meeting debrief
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => {
            const objections = (() => { try { return JSON.parse(m.objections || '[]'); } catch { return []; } })();
            const questions = (() => { try { return JSON.parse(m.questions_asked || '[]'); } catch { return []; } })();
            return (
              <div key={m.id} className="border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Link href={`/investors/${m.investor_id}`} className="font-medium hover:text-blue-400 transition-colors">
                      {m.investor_name}
                    </Link>
                    <div className="flex gap-3 text-xs text-zinc-500 mt-1">
                      <span>{m.date}</span>
                      <span className="capitalize">{m.type.replace(/_/g, ' ')}</span>
                      <span>{m.duration_minutes}min</span>
                      {m.attendees && <span>{m.attendees}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <div key={n} className={`w-2 h-2 rounded-full ${n <= m.enthusiasm_score ? 'bg-blue-500' : 'bg-zinc-800'}`} />
                      ))}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      m.status_after === 'engaged' ? 'bg-purple-900/50 text-purple-400' :
                      m.status_after === 'in_dd' ? 'bg-orange-900/50 text-orange-400' :
                      m.status_after === 'term_sheet' ? 'bg-green-900/50 text-green-400' :
                      m.status_after === 'passed' ? 'bg-red-900/50 text-red-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>{m.status_after.replace(/_/g, ' ')}</span>
                  </div>
                </div>

                {m.ai_analysis && (
                  <p className="text-sm text-zinc-400 mb-3">{m.ai_analysis}</p>
                )}

                <div className="flex gap-4 text-xs">
                  {questions.length > 0 && (
                    <span className="text-zinc-500">{questions.length} questions</span>
                  )}
                  {objections.length > 0 && (
                    <span className="text-red-400/70">{objections.length} objections</span>
                  )}
                  {m.competitive_intel && (
                    <span className="text-yellow-400/70">Intel captured</span>
                  )}
                  {m.next_steps && (
                    <span className="text-blue-400/70">Next steps defined</span>
                  )}
                </div>

                {objections.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {objections.map((o: { text: string; severity: string }, i: number) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded ${
                        o.severity === 'showstopper' ? 'bg-red-900/30 text-red-400' :
                        o.severity === 'significant' ? 'bg-yellow-900/30 text-yellow-400' :
                        'bg-zinc-800 text-zinc-500'
                      }`}>{o.text.length > 50 ? o.text.slice(0, 50) + '...' : o.text}</span>
                    ))}
                  </div>
                )}

                {m.next_steps && (
                  <div className="mt-2 text-xs text-blue-400/60 bg-blue-900/10 rounded px-2 py-1">
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

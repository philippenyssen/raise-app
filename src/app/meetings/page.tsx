'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Meeting } from '@/lib/types';

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  useEffect(() => {
    fetch('/api/meetings').then(r => r.json()).then(setMeetings);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
          <p className="text-zinc-500 text-sm mt-1">{meetings.length} meetings logged</p>
        </div>
        <Link
          href="/meetings/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
        >
          + Log Meeting
        </Link>
      </div>

      {meetings.length === 0 ? (
        <div className="border border-zinc-800 rounded-xl p-8 text-center space-y-3">
          <p className="text-zinc-500">No meetings logged yet.</p>
          <Link href="/meetings/new" className="text-blue-400 hover:text-blue-300 text-sm">
            Log your first meeting debrief
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map(m => {
            const objections = (() => { try { return JSON.parse(m.objections || '[]'); } catch { return []; } })();
            const questions = (() => { try { return JSON.parse(m.questions_asked || '[]'); } catch { return []; } })();
            return (
              <div key={m.id} className="border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium">{m.investor_name}</h3>
                    <div className="flex gap-3 text-xs text-zinc-500 mt-1">
                      <span>{m.date}</span>
                      <span>{m.type.replace(/_/g, ' ')}</span>
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
                    }`}>{m.status_after}</span>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

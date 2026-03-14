'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Investor } from '@/lib/types';
import PostMeetingActions from '@/components/post-meeting-actions';
import FollowupPlan from '@/components/followup-plan';

export default function NewMeetingPage() {
  const router = useRouter();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    investor_id: '',
    date: new Date().toISOString().split('T')[0],
    type: 'management_presentation',
    attendees: '',
    duration_minutes: 60,
    raw_notes: '',
  });

  useEffect(() => {
    fetch('/api/investors').then(r => r.json()).then(setInvestors);
  }, []);

  const selectedInvestor = investors.find(i => i.id === form.investor_id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.investor_id || !form.raw_notes) return;
    setLoading(true);
    setResult(null);

    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        investor_name: selectedInvestor?.name || 'Unknown',
        analyze: true,
      }),
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  const postMeetingActions = result?.post_meeting_actions as {
    tasks: { id: string; title: string; description: string; due_date: string; priority: string; phase: string; status: string; investor_name: string }[];
    document_flags: { id: string; document_id: string; flag_type: string; description: string; section_hint: string; objection_text: string; investor_name: string; status: string }[];
    investor_updates: { enthusiasm: number; suggested_status: string; previous_status?: string; previous_enthusiasm?: number };
  } | null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Log Meeting Debrief</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Paste your raw notes — AI extracts objections, signals, and patterns, then auto-generates follow-up tasks and document flags.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Investor</label>
            <select
              value={form.investor_id}
              onChange={e => setForm(f => ({ ...f, investor_id: e.target.value }))}
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
            >
              <option value="">Select investor...</option>
              {investors.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.name} (T{inv.tier})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Date</label>
            <input
              type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Meeting Type</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
            >
              <option value="intro">Intro Call</option>
              <option value="management_presentation">Management Presentation</option>
              <option value="deep_dive">Deep Dive</option>
              <option value="site_visit">Site Visit</option>
              <option value="dd_session">DD Session</option>
              <option value="negotiation">Negotiation</option>
              <option value="social">Social / Informal</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 block mb-1">Duration (min)</label>
            <input
              type="number" value={form.duration_minutes}
              onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-zinc-500 block mb-1">Attendees</label>
          <input
            value={form.attendees}
            onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))}
            placeholder="e.g., Katherine Boyle (a16z), John Smith (Associate)"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200"
          />
        </div>

        {/* Investor Quick Profile */}
        {selectedInvestor && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-2">
            <h3 className="text-xs font-medium text-zinc-400">INVESTOR PROFILE</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-zinc-500">Partner:</span> <span className="text-zinc-300">{selectedInvestor.partner || '—'}</span></div>
              <div><span className="text-zinc-500">Thesis:</span> <span className="text-zinc-300">{selectedInvestor.sector_thesis || '—'}</span></div>
              <div><span className="text-zinc-500">Check Size:</span> <span className="text-zinc-300">{selectedInvestor.check_size_range || '—'}</span></div>
              <div><span className="text-zinc-500">Speed:</span> <span className="text-zinc-300">{selectedInvestor.speed}</span></div>
              <div><span className="text-zinc-500">Warm Path:</span> <span className="text-zinc-300">{selectedInvestor.warm_path || '—'}</span></div>
              <div><span className="text-zinc-500">IC Process:</span> <span className="text-zinc-300">{selectedInvestor.ic_process || '—'}</span></div>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-zinc-500 block mb-1">Meeting Notes (raw — AI will structure these)</label>
          <textarea
            value={form.raw_notes}
            onChange={e => setForm(f => ({ ...f, raw_notes: e.target.value }))}
            required
            rows={12}
            placeholder={`Paste your meeting notes here. Include anything you remember:

- What questions did they ask?
- What objections or concerns did they raise?
- Which parts of the pitch seemed to land?
- What was their body language at pricing discussion?
- Did they ask about the process or timeline?
- Any competitive intelligence?
- What are the next steps?
- How enthusiastic were they overall?

The AI will extract structured data from your free-form notes.`}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 font-mono leading-relaxed focus:outline-none focus:border-blue-600"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !form.investor_id || !form.raw_notes}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? 'Analyzing with AI...' : 'Log & Analyze Meeting'}
        </button>
      </form>

      {/* AI Analysis Result */}
      {result && (
        <div className="border border-zinc-800 rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-bold">AI Analysis</h2>

          {!!(result as Record<string, unknown>).ai_analysis && (
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-4">
              <p className="text-sm text-blue-200">{String((result as Record<string, unknown>).ai_analysis)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-medium text-zinc-400 mb-2">ENTHUSIASM</h3>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <div key={n} className={`w-4 h-4 rounded-full ${n <= ((result as Record<string, number>).enthusiasm_score || 0) ? 'bg-blue-500' : 'bg-zinc-800'}`} />
                  ))}
                </div>
                <span className="text-sm text-zinc-400">{(result as Record<string, number>).enthusiasm_score}/5</span>
              </div>
            </div>
            <div>
              <h3 className="text-xs font-medium text-zinc-400 mb-2">SUGGESTED STATUS</h3>
              <span className="text-sm font-medium text-zinc-200">{String((result as Record<string, unknown>).status_after || '—')}</span>
            </div>
          </div>

          {!!result.questions_asked && (
            <div>
              <h3 className="text-xs font-medium text-zinc-400 mb-2">QUESTIONS ASKED</h3>
              <div className="text-sm text-zinc-300">
                {JSON.parse(String(result.questions_asked) || '[]').map((q: { text: string; topic: string }, i: number) => (
                  <div key={i} className="flex gap-2 mb-1">
                    <span className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 shrink-0">{q.topic}</span>
                    <span>{q.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!result.objections && (
            <div>
              <h3 className="text-xs font-medium text-zinc-400 mb-2">OBJECTIONS</h3>
              <div className="text-sm text-zinc-300">
                {JSON.parse(String(result.objections) || '[]').map((o: { text: string; severity: string }, i: number) => (
                  <div key={i} className="flex gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                      o.severity === 'showstopper' ? 'bg-red-900/50 text-red-400' :
                      o.severity === 'significant' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-zinc-800 text-zinc-500'
                    }`}>{o.severity}</span>
                    <span>{o.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => router.push('/meetings')}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm"
            >
              View All Meetings
            </button>
            <button
              onClick={() => { setResult(null); setForm(f => ({ ...f, raw_notes: '', investor_id: '', attendees: '' })); }}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm"
            >
              Log Another
            </button>
          </div>
        </div>
      )}

      {/* Post-Meeting Actions */}
      {result && postMeetingActions && (
        <PostMeetingActions
          data={postMeetingActions}
          meetingId={result.id as string}
        />
      )}

      {/* Follow-up Plan */}
      {result && Array.isArray((result as Record<string, unknown>).followup_plan) && (
        <FollowupPlan
          followups={(result as Record<string, unknown>).followup_plan as {
            id: string; meeting_id: string; investor_id: string; investor_name: string;
            action_type: string; description: string; due_at: string; status: string;
            outcome: string; conviction_delta: number; created_at: string; completed_at: string | null;
          }[]}
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { cachedFetch } from '@/lib/cache';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Investor } from '@/lib/types';
import PostMeetingActions from '@/components/post-meeting-actions';
import FollowupPlan from '@/components/followup-plan';
import { useToast } from '@/components/toast';
import { stAccent, stSurface1, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary } from '@/lib/styles';

function severityBadgeStyle(severity: string): React.CSSProperties {
  return {
    background: severity === 'showstopper' ? 'var(--danger-muted)' : severity === 'significant' ? 'var(--warning-muted)' : 'var(--surface-2)',
    color: severity === 'showstopper' ? 'var(--danger)' : severity === 'significant' ? 'var(--warning)' : 'var(--text-muted)',
  };
}

export default function NewMeetingPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 page-content">
        <div className="skeleton" style={{ height: '28px', width: '200px' }} />
        <div className="skeleton" style={{ height: '16px', width: '300px' }} />
        <div className="skeleton" style={{ height: '44px', borderRadius: 'var(--radius-md)' }} />
        <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-md)' }} />
        <div className="skeleton" style={{ height: '44px', width: '140px', borderRadius: 'var(--radius-md)' }} />
      </div>}>
      <NewMeetingContent />
    </Suspense>);
}

function NewMeetingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const preselectedInvestor = searchParams.get('investor') || '';
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({
    investor_id: preselectedInvestor,
    date: searchParams.get('date') || new Date().toISOString().split('T')[0],
    type: searchParams.get('type') || 'management_presentation',
    attendees: searchParams.get('attendees') || '',
    duration_minutes: Number(searchParams.get('duration')) || 60,
    raw_notes: '',});

  useEffect(() => { document.title = 'Raise | Log Meeting'; }, []);
  useEffect(() => {
    cachedFetch('/api/investors').then(r => r.json()).then(setInvestors).catch(e => console.error('[NEW_MEETING_INVESTORS]', e instanceof Error ? e.message : e));
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Escape' && result) setResult(null);
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); cachedFetch('/api/investors').then(r => r.json()).then(setInvestors).catch(e2 => console.warn('[NEW_MEETING_REFRESH]', e2 instanceof Error ? e2.message : e2)); }
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement | null; if (btn && !btn.disabled) btn.click(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [result]);

  const selectedInvestor = investors.find(i => i.id === form.investor_id);

  const parsedQuestions = useMemo(() => {
    try { return JSON.parse(String(result?.questions_asked || '[]')); } catch { return []; }
  }, [result?.questions_asked]);
  const parsedObjections = useMemo(() => {
    try { return JSON.parse(String(result?.objections || '[]')); } catch { return []; }
  }, [result?.objections]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.investor_id || !form.raw_notes.trim()) return;
    if (form.duration_minutes <= 0) { toast('Duration must be positive', 'error'); return; }
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          investor_name: selectedInvestor?.name || 'Unknown',
          analyze: true,
        }),});
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      setResult(data);
      toast(`Meeting with ${selectedInvestor?.name || 'investor'} logged`);
    } catch (e) {
      console.warn('[NEW_MEETING]', e instanceof Error ? e.message : e);
      toast('Couldn\'t log meeting — check your connection and retry', 'error');
    }
    setLoading(false);
  }

  const postMeetingActions = result?.post_meeting_actions as {
    tasks: { id: string; title: string; description: string; due_date: string; priority: string; phase: string; status: string; investor_name: string }[];
    document_flags: { id: string; document_id: string; flag_type: string; description: string; section_hint: string; objection_text: string; investor_name: string; status: string }[];
    investor_updates: { enthusiasm: number; suggested_status: string; previous_status?: string; previous_enthusiasm?: number };
  } | null;

  return (
    <div className="page-content max-w-3xl space-y-6">
      <div>
        <h1 className="page-title">Log Meeting Debrief</h1>
        <p className="text-sm mt-1" style={stTextMuted}>
          Paste your raw notes. AI extracts objections, buying signals, and next steps, then auto-generates follow-up tasks.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs block mb-1" style={stTextMuted}>Investor</label>
            <select
              value={form.investor_id}
              onChange={e => setForm(f => ({ ...f, investor_id: e.target.value }))}
              required
              autoFocus
              aria-label="Select investor"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
              <option value="">Select investor...</option>
              {investors.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.name} (T{inv.tier})</option>
              ))}</select></div>
          <div>
            <label className="text-xs block mb-1" style={stTextMuted}>Date</label>
            <input
              type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
                /></div>
          <div>
            <label className="text-xs block mb-1" style={stTextMuted}>Meeting Type</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              aria-label="Meeting type"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
              <option value="intro">Intro Call</option>
              <option value="management_presentation">Management Presentation</option>
              <option value="deep_dive">Deep Dive</option>
              <option value="site_visit">Site Visit</option>
              <option value="dd_session">DD Session</option>
              <option value="negotiation">Negotiation</option>
              <option value="social">Social / Informal</option></select></div>
          <div>
            <label className="text-xs block mb-1" style={stTextMuted}>Duration (min)</label>
            <input
              type="number" value={form.duration_minutes}
              onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
                /></div></div>

        <div>
          <label className="text-xs block mb-1" style={stTextMuted}>Attendees</label>
          <input
            value={form.attendees}
            onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))}
            placeholder="e.g., Katherine Boyle (a16z), John Smith (Associate)"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
              /></div>

        {/* Investor Quick Profile */}
        {selectedInvestor && (
          <div className="rounded-lg p-4 space-y-2" style={stSurface1}>
            <h3 className="text-xs font-normal" style={stTextTertiary}>Investor profile</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span style={stTextMuted}>Partner:</span> <span style={stTextSecondary}>{selectedInvestor.partner || '—'}</span></div>
              <div><span style={stTextMuted}>Thesis:</span> <span style={stTextSecondary}>{selectedInvestor.sector_thesis || '—'}</span></div>
              <div><span style={stTextMuted}>Check Size:</span> <span style={stTextSecondary}>{selectedInvestor.check_size_range || '—'}</span></div>
              <div><span style={stTextMuted}>Speed:</span> <span style={stTextSecondary}>{selectedInvestor.speed}</span></div>
              <div><span style={stTextMuted}>Warm Path:</span> <span style={stTextSecondary}>{selectedInvestor.warm_path || '—'}</span></div>
              <div><span style={stTextMuted}>IC Process:</span> <span style={stTextSecondary}>{selectedInvestor.ic_process || '—'}</span></div>
            </div></div>
        )}

        <div>
          <label className="text-xs block mb-1" style={stTextMuted}>Meeting Notes (raw is fine — AI will structure them)</label>
          <textarea
            value={form.raw_notes}
            onChange={e => setForm(f => ({ ...f, raw_notes: e.target.value }))}
            required
            rows={12}
            placeholder={`Dump everything you remember — bullet points, stream of consciousness, voice memo transcript. For example:

- They pushed back hard on valuation, said 39x trailing is rich
- Partner seemed engaged on the defense angle, less on commercial SAR
- Asked who else is in the process — told them competitive but no names
- Wants to see the Excel model before IC
- Body language was positive when we showed the IRIS2 contract
- Next steps: send model + schedule follow-up with their space analyst
- Overall vibe: cautiously interested, maybe 3.5/5`}
            className="w-full rounded-lg px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none"
            style={{ background: 'var(--surface-1)', color: 'var(--text-secondary)' }} /></div>

        <button
          type="submit"
          disabled={loading || !form.investor_id || !form.raw_notes}
          className="px-6 py-3 rounded-lg text-sm font-normal transition-colors disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--surface-0)' }}>
          {loading ? 'Analyzing notes...' : 'Log & Analyze Debrief'}</button></form>

      {/* AI Analysis Result */}
      {result && (
        <div className="rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-normal" style={stTextPrimary}>AI Analysis</h2>

          {!!(result as Record<string, unknown>).ai_analysis && (
            <div className="rounded-lg p-4" style={{ background: 'var(--accent-muted)', border: '1px solid var(--accent)' }}>
              <p className="text-sm" style={stAccent}>{String((result as Record<string, unknown>).ai_analysis)}</p></div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-normal mb-2" style={stTextTertiary}>Enthusiasm</h3>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <div key={n} className="w-4 h-4 rounded-full" style={{ background: n <= ((result as Record<string, number>).enthusiasm_score || 0) ? 'var(--accent)' : 'var(--surface-2)' }}
                      />
                  ))}</div>
                <span className="text-sm" style={stTextTertiary}>{(result as Record<string, number>).enthusiasm_score}/5</span>
              </div></div>
            <div>
              <h3 className="text-xs font-normal mb-2" style={stTextTertiary}>Suggested status</h3>
              <span className="text-sm font-normal" style={stTextSecondary}>{String((result as Record<string, unknown>).status_after || '—')}</span>
            </div></div>

          {!!result.questions_asked && (
            <div>
              <h3 className="text-xs font-normal mb-2" style={stTextTertiary}>Questions asked</h3>
              <div className="text-sm" style={stTextSecondary}>
                {parsedQuestions.map((q: { text: string; topic: string }, i: number) => (
                  <div key={i} className="flex gap-2 mb-1">
                    <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{q.topic}</span>
                    <span>{q.text}</span></div>
                ))}</div></div>
          )}

          {!!result.objections && (
            <div>
              <h3 className="text-xs font-normal mb-2" style={stTextTertiary}>Objections</h3>
              <div className="text-sm" style={stTextSecondary}>
                {parsedObjections.map((o: { text: string; severity: string }, i: number) => (
                  <div key={i} className="flex gap-2 mb-1">
                    <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={severityBadgeStyle(o.severity)}>{o.severity}</span>
                    <span>{o.text}</span></div>
                ))}</div></div>
          )}

          <div className="flex gap-3">
            {form.investor_id && (
              <button
                onClick={() => router.push(`/investors/${form.investor_id}`)}
                className="px-4 py-2 rounded-lg text-sm font-normal transition-colors"
                style={{ background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-10)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-8)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-muted)'; }}>
                View {selectedInvestor?.name || 'Investor'}</button>
            )}
            <button
              onClick={() => router.push('/meetings')}
              className="px-4 py-2 rounded-lg text-sm btn-surface transition-colors"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text-primary)', }}>
              All Meetings</button>
            <button
              onClick={() => { setResult(null); setForm({ investor_id: '', date: new Date().toISOString().split('T')[0], type: 'management_presentation', attendees: '', duration_minutes: 60, raw_notes: '' }); }}
              className="px-4 py-2 rounded-lg text-sm btn-surface transition-colors"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text-primary)', }}>
              Log Another</button></div></div>
      )}

      {/* Post-Meeting Actions */}
      {result && postMeetingActions && (
        <PostMeetingActions
          data={postMeetingActions}
          meetingId={result.id as string} />
      )}

      {/* Follow-up Plan */}
      {result && Array.isArray((result as Record<string, unknown>).followup_plan) && (
        <FollowupPlan
          followups={(result as Record<string, unknown>).followup_plan as {
            id: string; meeting_id: string; investor_id: string; investor_name: string;
            action_type: string; description: string; due_at: string; status: string;
            outcome: string; conviction_delta: number; created_at: string; completed_at: string | null;
          }[]} />
      )}
    </div>);
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Meeting } from '@/lib/types';
import { Search, FileSearch, Calendar, Download, ChevronDown, ChevronRight, Star, CheckCircle2, X, TrendingUp, TrendingDown, Minus, Hash } from 'lucide-react';
import { labelTertiary, stFontSm, stFontXs, stTextMuted, stTextTertiary } from '@/lib/styles';

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
      return { background: 'var(--danger-muted)', color: 'var(--text-primary)' };
    case 'significant':
      return { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' };
    default:
      return { background: 'var(--surface-3)', color: 'var(--text-tertiary)' };
  }
}

function RatingDots({ value, onChange, label }: { value: number | null; onChange?: (v: number) => void; label: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            disabled={!onChange}
            style={{
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: onChange ? 'pointer' : 'default',
              background: 'none',
              border: 'none',
              padding: 0, }}>
            <span style={{
              color: n <= (hovered ?? value ?? 0) ? 'var(--warning)' : 'var(--text-muted)',
              transition: 'color 100ms ease',
            }}>
              <Star className="w-4 h-4" style={{ fill: n <= (hovered ?? value ?? 0) ? 'currentColor' : 'none' }} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface OutcomeFormData {
  outcome_rating: number | null;
  objections_addressed: string[];
  competitive_mentions: string[];
  key_takeaway: string;
  prep_usefulness: number | null;
}

function MeetingOutcomeSection({
  meeting,
  onSaved,
}: {
  meeting: Meeting;
  onSaved: (updated: Meeting) => void;
}) {
  const hasOutcome = meeting.outcome_rating !== null && meeting.outcome_rating !== undefined;
  const [editing, setEditing] = useState(!hasOutcome);
  const [saving, setSaving] = useState(false);
  const [newObjection, setNewObjection] = useState('');
  const [newCompetitor, setNewCompetitor] = useState('');

  const existingObjections: string[] = (() => {
    try { return JSON.parse(meeting.objections_addressed || '[]'); } catch { return []; }
  })();
  const existingMentions: string[] = (() => {
    try { return JSON.parse(meeting.competitive_mentions || '[]'); } catch { return []; }
  })();

  const [form, setForm] = useState<OutcomeFormData>({
    outcome_rating: meeting.outcome_rating ?? null,
    objections_addressed: existingObjections,
    competitive_mentions: existingMentions,
    key_takeaway: meeting.key_takeaway || '',
    prep_usefulness: meeting.prep_usefulness ?? null,
  });

  const addObjection = () => {
    const val = newObjection.trim();
    if (val && !form.objections_addressed.includes(val)) {
      setForm(prev => ({ ...prev, objections_addressed: [...prev.objections_addressed, val] }));
      setNewObjection('');
    }
  };

  const removeObjection = (idx: number) => {
    setForm(prev => ({ ...prev, objections_addressed: prev.objections_addressed.filter((_, i) => i !== idx) }));
  };

  const addCompetitor = () => {
    const val = newCompetitor.trim();
    if (val && !form.competitive_mentions.includes(val)) {
      setForm(prev => ({ ...prev, competitive_mentions: [...prev.competitive_mentions, val] }));
      setNewCompetitor('');
    }
  };

  const removeCompetitor = (idx: number) => {
    setForm(prev => ({ ...prev, competitive_mentions: prev.competitive_mentions.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/meetings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meeting_id: meeting.id,
          outcome_rating: form.outcome_rating,
          objections_addressed: form.objections_addressed,
          competitive_mentions: form.competitive_mentions,
          key_takeaway: form.key_takeaway,
          prep_usefulness: form.prep_usefulness,
        }),
      });
      if (res.ok) {
        onSaved({
          ...meeting,
          outcome_rating: form.outcome_rating,
          objections_addressed: JSON.stringify(form.objections_addressed),
          competitive_mentions: JSON.stringify(form.competitive_mentions),
          key_takeaway: form.key_takeaway,
          prep_usefulness: form.prep_usefulness,
        });
        setEditing(false);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  if (!editing && hasOutcome) {
    return (
      <div
        style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-secondary)' }}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            Outcome Recorded
          </div>
          <button
            onClick={() => setEditing(true)}
            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
            Edit
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={stFontXs}>
          <div>
            <div style={stTextMuted}>Outcome</div>
            <div className="flex gap-0.5 mt-1">
              {[1,2,3,4,5].map(n => (
                <span key={n} style={{ color: n <= (meeting.outcome_rating ?? 0) ? 'var(--warning)' : 'var(--text-muted)' }}>
                  <Star className="w-3 h-3" style={{ fill: n <= (meeting.outcome_rating ?? 0) ? 'currentColor' : 'none' }} />
                </span>
              ))}
            </div>
          </div>
          <div>
            <div style={stTextMuted}>Prep Usefulness</div>
            <div className="flex gap-0.5 mt-1">
              {[1,2,3,4,5].map(n => (
                <span key={n} style={{ color: n <= (meeting.prep_usefulness ?? 0) ? 'var(--accent)' : 'var(--text-muted)' }}>
                  <Star className="w-3 h-3" style={{ fill: n <= (meeting.prep_usefulness ?? 0) ? 'currentColor' : 'none' }} />
                </span>
              ))}
            </div>
          </div>
          <div className="col-span-2">
            <div style={stTextMuted}>Key Takeaway</div>
            <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>{meeting.key_takeaway || '-'}</div>
          </div>
        </div>

        {existingObjections.length > 0 && (
          <div className="mt-2">
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Objections Addressed</div>
            <div className="flex flex-wrap gap-1">
              {existingObjections.map((o: string, i: number) => (
                <span key={i} style={{ fontSize: 'var(--font-size-xs)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--success-muted)', color: 'var(--text-secondary)' }}>
                  {o}
                </span>
              ))}
            </div>
          </div>
        )}

        {existingMentions.length > 0 && (
          <div className="mt-2">
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Competitors Mentioned</div>
            <div className="flex flex-wrap gap-1">
              {existingMentions.map((c: string, i: number) => (
                <span key={i} style={{ fontSize: 'var(--font-size-xs)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-muted)', color: 'var(--text-tertiary)' }}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{ padding: 'var(--space-4)', background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
        Meeting Outcome
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RatingDots
          value={form.outcome_rating}
          onChange={v => setForm(prev => ({ ...prev, outcome_rating: v }))}
          label="How did it go?" />
        <RatingDots
          value={form.prep_usefulness}
          onChange={v => setForm(prev => ({ ...prev, prep_usefulness: v }))}
          label="Prep brief usefulness" />
      </div>

      <div className="mt-3">
        <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
          Key Takeaway
        </label>
        <input
          value={form.key_takeaway}
          onChange={e => setForm(prev => ({ ...prev, key_takeaway: e.target.value }))}
          placeholder="Most important insight from this meeting..."
          className="input" />
      </div>

      <div className="mt-3">
        <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
          Objections Addressed
        </label>
        <div className="flex flex-wrap gap-1 mb-2">
          {form.objections_addressed.map((o, i) => (
            <span
              key={i}
              className="flex items-center gap-1"
              style={{ fontSize: 'var(--font-size-xs)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--success-muted)', color: 'var(--text-secondary)' }}>
              {o}
              <button
                type="button"
                onClick={() => removeObjection(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', display: 'flex' }}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newObjection}
            onChange={e => setNewObjection(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addObjection(); } }}
            placeholder="Add objection handled..."
            className="input"
            style={{ flex: 1 }} />
          <button onClick={addObjection} className="btn btn-secondary btn-md" type="button">Add</button>
        </div>
      </div>

      <div className="mt-3">
        <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
          Competitors Mentioned by Investor
        </label>
        <div className="flex flex-wrap gap-1 mb-2">
          {form.competitive_mentions.map((c, i) => (
            <span
              key={i}
              className="flex items-center gap-1"
              style={{ fontSize: 'var(--font-size-xs)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-muted)', color: 'var(--text-tertiary)' }}>
              {c}
              <button
                type="button"
                onClick={() => removeCompetitor(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', display: 'flex' }}>
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newCompetitor}
            onChange={e => setNewCompetitor(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCompetitor(); } }}
            placeholder="Add competitor name..."
            className="input"
            style={{ flex: 1 }} />
          <button onClick={addCompetitor} className="btn btn-secondary btn-md" type="button">Add</button>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary btn-md">
          {saving ? 'Saving...' : 'Save Outcome'}
        </button>
        {hasOutcome && (
          <button
            onClick={() => setEditing(false)}
            className="btn btn-secondary btn-md">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOutcome, setExpandedOutcome] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/meetings')
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(setMeetings)
      .catch((err) => { console.error('Failed to load meetings:', err); });
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

  // Per-investor engagement intelligence (computed from meetings array)
  const investorStats = meetings.reduce<Record<string, {
    count: number;
    trend: 'up' | 'down' | 'flat' | 'new';
    latestEnthusiasm: number;
    avgEnthusiasm: number;
  }>>((acc, m) => {
    if (!acc[m.investor_id]) {
      acc[m.investor_id] = { count: 0, trend: 'new', latestEnthusiasm: 0, avgEnthusiasm: 0 };
    }
    acc[m.investor_id].count++;
    return acc;
  }, {});

  // Second pass: compute trends (needs chronological order)
  const meetingsByInvestor = meetings.reduce<Record<string, Meeting[]>>((acc, m) => {
    if (!acc[m.investor_id]) acc[m.investor_id] = [];
    acc[m.investor_id].push(m);
    return acc;
  }, {});

  for (const [invId, invMeetings] of Object.entries(meetingsByInvestor)) {
    const sorted = [...invMeetings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latest = sorted[sorted.length - 1];
    const avg = sorted.reduce((s, m) => s + m.enthusiasm_score, 0) / sorted.length;
    investorStats[invId].latestEnthusiasm = latest.enthusiasm_score;
    investorStats[invId].avgEnthusiasm = avg;
    if (sorted.length >= 2) {
      const prev = sorted[sorted.length - 2];
      if (latest.enthusiasm_score > prev.enthusiasm_score) investorStats[invId].trend = 'up';
      else if (latest.enthusiasm_score < prev.enthusiasm_score) investorStats[invId].trend = 'down';
      else investorStats[invId].trend = 'flat';
    }
  }

  const handleOutcomeSaved = (updated: Meeting) => {
    setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m));
  };

  return (
    <div className="page-content space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Meetings</h1>
          <p className="page-subtitle" style={stFontSm}>
            {meetings.length} meetings with {uniqueInvestors} investors
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/meetings/capture"
            className="btn btn-secondary btn-md">
            Quick Capture
          </Link>
          <Link
            href="/meetings/prep"
            className="btn btn-secondary btn-md">
            <FileSearch className="w-3.5 h-3.5" /> Meeting Prep
          </Link>
          <Link
            href="/meetings/new"
            className="btn btn-primary btn-md">
            + Log Meeting
          </Link>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 card-stagger">
        <div className="card-metric">
          <div className="metric-label">Total Meetings</div>
          <div className="metric-value" style={{ marginTop: '2px' }}>{meetings.length}</div>
        </div>
        <div className="card-metric">
          <div className="metric-label">Avg Enthusiasm</div>
          <div className="metric-value" style={{ marginTop: '2px' }}>
            {avgEnthusiasm}<span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>/5</span>
          </div>
        </div>
        <div className="card-metric">
          <div className="metric-label">Objections</div>
          <div className="metric-value" style={{ marginTop: '2px', color: 'var(--text-tertiary)' }}>{totalObjections}</div>
        </div>
        <div className="card-metric">
          <div className="metric-label">Unique Investors</div>
          <div className="metric-value" style={{ marginTop: '2px' }}>{uniqueInvestors}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={stTextTertiary} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search investor or notes..."
            className="input"
            style={{ paddingLeft: 'var(--space-10)' }} />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="input"
          style={{ width: 'auto' }}>
          {MEETING_TYPES.map(t => (
            <option key={t} value={t}>{t === 'all' ? 'All types' : t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input"
          style={{ width: 'auto' }}>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <a
          href="/api/export?type=meetings"
          download
          className="btn btn-secondary btn-md">
          <Download className="w-3.5 h-3.5" /> CSV
        </a>
      </div>

      {/* Meeting List */}
      {filtered.length === 0 ? (
        <div
          className="card"
          style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <div className="space-y-3">
            <Calendar className="w-8 h-8 mx-auto" style={stTextMuted} />
            <p style={stTextTertiary}>
              {meetings.length === 0 ? 'No meetings logged yet. Start by scheduling your first meeting.' : 'No meetings match your filters — try adjusting them.'}
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
            const isOutcomeExpanded = expandedOutcome === m.id;
            const hasOutcome = m.outcome_rating !== null && m.outcome_rating !== undefined;
            const stats = investorStats[m.investor_id];
            const trendConfig = {
              up: { icon: TrendingUp, color: 'var(--text-secondary)', label: 'Rising' },
              down: { icon: TrendingDown, color: 'var(--text-primary)', label: 'Falling' },
              flat: { icon: Minus, color: 'var(--text-muted)', label: 'Flat' },
              new: { icon: Hash, color: 'var(--text-muted)', label: 'First' },
            };
            const trend = stats ? trendConfig[stats.trend] : trendConfig.new;
            const TrendIcon = trend.icon;

            return (
              <div
                key={m.id}
                className="card"
                style={{ padding: 'var(--space-5)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/investors/${m.investor_id}`}
                        className="transition-colors"
                        style={{ fontWeight: 400, color: 'var(--text-primary)', transition: 'color 150ms ease' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}>
                        {m.investor_name}
                      </Link>
                      {stats && stats.count > 1 && (
                        <span
                          className="flex items-center gap-1"
                          style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--surface-2)',
                            color: 'var(--text-muted)', }}>
                          {stats.count} meetings
                        </span>
                      )}
                      {stats && stats.count >= 2 && (
                        <span
                          className="flex items-center gap-0.5"
                          style={{ fontSize: '10px', color: trend.color }}
                          title={`Enthusiasm ${trend.label.toLowerCase()} (avg ${stats.avgEnthusiasm.toFixed(1)})`}>
                          <TrendIcon className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1" style={labelTertiary}>
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

                <div className="flex gap-4" style={stFontXs}>
                  {questions.length > 0 && (
                    <span style={stTextTertiary}>{questions.length} questions</span>
                  )}
                  {objections.length > 0 && (
                    <span style={{ color: 'var(--text-primary)', opacity: 0.7 }}>{objections.length} objections</span>
                  )}
                  {m.competitive_intel && (
                    <span style={{ color: 'var(--text-tertiary)', opacity: 0.7 }}>Intel captured</span>
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
                          ...getObjectionStyle(o.severity), }}>
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
                      padding: '4px 8px', }}>
                    Next: {m.next_steps}
                  </div>
                )}

                {/* Meeting Outcome Toggle */}
                <div className="mt-3" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
                  <button
                    onClick={() => setExpandedOutcome(isOutcomeExpanded ? null : m.id)}
                    className="flex items-center gap-2 w-full"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 400,
                      color: hasOutcome ? 'var(--success)' : 'var(--text-tertiary)', }}
                    onMouseEnter={e => (e.currentTarget.style.color = hasOutcome ? 'var(--success)' : 'var(--text-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = hasOutcome ? 'var(--success)' : 'var(--text-tertiary)')}>
                    {isOutcomeExpanded
                      ? <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronRight className="w-3.5 h-3.5" />
                    }
                    {hasOutcome ? 'Meeting Outcome' : 'Record Outcome'}
                    {hasOutcome && (
                      <span style={{ marginLeft: '4px' }}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>

                  {isOutcomeExpanded && (
                    <div className="mt-3">
                      <MeetingOutcomeSection
                        meeting={m}
                        onSaved={handleOutcomeSaved} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

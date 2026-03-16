'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cachedFetch } from '@/lib/cache';
import Link from 'next/link';
import type { Meeting } from '@/lib/types';
import { Search, FileSearch, Calendar, Download, ChevronDown, ChevronRight, Star, CheckCircle2, X, TrendingUp, TrendingDown, Minus, Hash } from 'lucide-react';
import { fmtDateTime } from '@/lib/format';
import { labelTertiary, stFontSm, stFontXs, stTextMuted, stTextTertiary } from '@/lib/styles';
import { EmptyState } from '@/components/ui/empty-state';
import { CopyButton } from '@/components/copy-button';

const labelMutedMb4 = { fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px' } as const;
const labelBlockMutedMb4 = { fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' } as const;
const ratingBtnBase: React.CSSProperties = { width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', padding: 0 };
const meetingCountBadge = { fontSize: 'var(--font-size-xs)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text-muted)' } as const;
const objectionBadge: React.CSSProperties = { fontSize: 'var(--font-size-xs)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--success-muted)', color: 'var(--text-secondary)' };
const competitorBadge: React.CSSProperties = { fontSize: 'var(--font-size-xs)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-muted)', color: 'var(--text-tertiary)' };
const competitorFormBadge: React.CSSProperties = { fontSize: 'var(--font-size-xs)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-muted)', color: 'var(--text-tertiary)' };
const objectionFormBadge: React.CSSProperties = { fontSize: 'var(--font-size-xs)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--success-muted)', color: 'var(--text-secondary)' };
const removeBtnInline: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', display: 'flex' };
const trendConfig = {
  up: { icon: TrendingUp, color: 'var(--text-secondary)', label: 'Rising' },
  down: { icon: TrendingDown, color: 'var(--text-primary)', label: 'Falling' },
  flat: { icon: Minus, color: 'var(--text-muted)', label: 'Flat' },
  new: { icon: Hash, color: 'var(--text-muted)', label: 'First' },
} as const;

const MEETING_TYPES = ['all', 'intro', 'management_presentation', 'deep_dive', 'site_visit', 'dd_session', 'negotiation', 'social'] as const;
const STATUS_OPTIONS = ['all', 'met', 'engaged', 'in_dd', 'term_sheet', 'passed'] as const;

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'engaged': return 'badge badge-purple';
    case 'in_dd': return 'badge badge-amber';
    case 'term_sheet': return 'badge badge-green';
    case 'passed': return 'badge badge-red';
    default: return 'badge badge-zinc';
  }}

function getObjectionStyle(severity: string): React.CSSProperties {
  switch (severity) {
    case 'showstopper':
      return { background: 'var(--danger-muted)', color: 'var(--text-primary)' };
    case 'significant':
      return { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' };
    default:
      return { background: 'var(--surface-3)', color: 'var(--text-tertiary)' };
  }}

function RatingDots({ value, onChange, label }: { value: number | null; onChange?: (v: number) => void; label: string }) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div>
      <div style={labelMutedMb4}>{label}</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange?.(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            disabled={!onChange}
            aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
            style={{ ...ratingBtnBase, cursor: onChange ? 'pointer' : 'default' }}>
            <span style={{
              color: n <= (hovered ?? value ?? 0) ? 'var(--warning)' : 'var(--text-muted)',
              transition: 'color 100ms ease',}}>
              <Star className="w-4 h-4" style={{ fill: n <= (hovered ?? value ?? 0) ? 'currentColor' : 'none' }} /></span>
          </button>
        ))}</div>
    </div>);
}

interface OutcomeFormData { outcome_rating: number | null; objections_addressed: string[]; competitive_mentions: string[]; key_takeaway: string; prep_usefulness: number | null }

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
  const [saveError, setSaveError] = useState<string | null>(null);
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
    prep_usefulness: meeting.prep_usefulness ?? null,});

  const addObjection = () => {
    const val = newObjection.trim();
    if (val && !form.objections_addressed.includes(val)) {
      setForm(prev => ({ ...prev, objections_addressed: [...prev.objections_addressed, val] }));
      setNewObjection('');
    }};

  const removeObjection = (idx: number) => {
    setForm(prev => ({ ...prev, objections_addressed: prev.objections_addressed.filter((_, i) => i !== idx) }));
  };

  const addCompetitor = () => {
    const val = newCompetitor.trim();
    if (val && !form.competitive_mentions.includes(val)) {
      setForm(prev => ({ ...prev, competitive_mentions: [...prev.competitive_mentions, val] }));
      setNewCompetitor('');
    }};

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
        }),});
      if (res.ok) {
        onSaved({
          ...meeting,
          outcome_rating: form.outcome_rating,
          objections_addressed: JSON.stringify(form.objections_addressed),
          competitive_mentions: JSON.stringify(form.competitive_mentions),
          key_takeaway: form.key_takeaway,
          prep_usefulness: form.prep_usefulness,});
        setEditing(false);
      } else {
        setSaveError('Could not save outcome — check your connection and retry');
      }
    } catch (e) {
      console.warn('[MEETING_OUTCOME]', e instanceof Error ? e.message : e);
      setSaveError('Could not save outcome — check your connection and retry');
    }
    setSaving(false);
  };

  if (!editing && hasOutcome) {
    return (
      <div
        style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-secondary)' }}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            Outcome Recorded</div>
          <button
            onClick={() => setEditing(true)}
            className="hover-underline"
            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Edit</button></div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={stFontXs}>
          <div>
            <div style={stTextMuted}>Outcome</div>
            <div className="flex gap-0.5 mt-1">
              {[1,2,3,4,5].map(n => (
                <span key={n} style={{ color: n <= (meeting.outcome_rating ?? 0) ? 'var(--warning)' : 'var(--text-muted)' }}>
                  <Star className="w-3 h-3" style={{ fill: n <= (meeting.outcome_rating ?? 0) ? 'currentColor' : 'none' }} />
                </span>
              ))}</div></div>
          <div>
            <div style={stTextMuted}>Prep Usefulness</div>
            <div className="flex gap-0.5 mt-1">
              {[1,2,3,4,5].map(n => (
                <span key={n} style={{ color: n <= (meeting.prep_usefulness ?? 0) ? 'var(--accent)' : 'var(--text-muted)' }}>
                  <Star className="w-3 h-3" style={{ fill: n <= (meeting.prep_usefulness ?? 0) ? 'currentColor' : 'none' }} />
                </span>
              ))}</div></div>
          <div className="col-span-2">
            <div style={stTextMuted}>Key Takeaway</div>
            <div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>{meeting.key_takeaway || '-'}</div></div></div>

        {existingObjections.length > 0 && (
          <div className="mt-2">
            <div style={labelMutedMb4}>Objections Addressed</div>
            <div className="flex flex-wrap gap-1">
              {existingObjections.map((o: string, i: number) => (
                <span key={i} style={objectionBadge}>
                  {o}</span>
              ))}</div></div>
        )}

        {existingMentions.length > 0 && (
          <div className="mt-2">
            <div style={labelMutedMb4}>Competitors Mentioned</div>
            <div className="flex flex-wrap gap-1">
              {existingMentions.map((c: string, i: number) => (
                <span key={i} style={competitorBadge}>
                  {c}</span>
              ))}</div></div>
        )}
      </div>);
  }

  return (
    <div
      style={{ padding: 'var(--space-4)', background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)' }}>
      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>
        Meeting Outcome</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RatingDots
          value={form.outcome_rating}
          onChange={v => setForm(prev => ({ ...prev, outcome_rating: v }))}
          label="How did it go?" />
        <RatingDots
          value={form.prep_usefulness}
          onChange={v => setForm(prev => ({ ...prev, prep_usefulness: v }))}
          label="Prep brief usefulness" /></div>

      <div className="mt-3">
        <label style={labelBlockMutedMb4}>
          Key Takeaway</label>
        <input
          value={form.key_takeaway}
          onChange={e => setForm(prev => ({ ...prev, key_takeaway: e.target.value }))}
          placeholder="Most important insight from this meeting..."
          className="input" /></div>

      <div className="mt-3">
        <label style={labelBlockMutedMb4}>
          Objections Addressed</label>
        <div className="flex flex-wrap gap-1 mb-2">
          {form.objections_addressed.map((o, i) => (
            <span
              key={i}
              className="flex items-center gap-1"
              style={objectionFormBadge}>
              {o}
              <button
                type="button"
                onClick={() => removeObjection(i)}
                aria-label="Remove objection"
                style={removeBtnInline}>
                <X className="w-3 h-3" /></button></span>
          ))}</div>
        <div className="flex gap-2">
          <input
            value={newObjection}
            onChange={e => setNewObjection(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addObjection(); } }}
            placeholder="Add objection handled..."
            className="input"
            style={{ flex: 1 }} />
          <button onClick={addObjection} className="btn btn-secondary btn-md" type="button">Add</button></div></div>

      <div className="mt-3">
        <label style={labelBlockMutedMb4}>
          Competitors Mentioned by Investor</label>
        <div className="flex flex-wrap gap-1 mb-2">
          {form.competitive_mentions.map((c, i) => (
            <span
              key={i}
              className="flex items-center gap-1"
              style={competitorFormBadge}>
              {c}
              <button
                type="button"
                onClick={() => removeCompetitor(i)}
                aria-label="Remove competitor"
                style={removeBtnInline}>
                <X className="w-3 h-3" /></button></span>
          ))}</div>
        <div className="flex gap-2">
          <input
            value={newCompetitor}
            onChange={e => setNewCompetitor(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCompetitor(); } }}
            placeholder="Add competitor name..."
            className="input"
            style={{ flex: 1 }} />
          <button onClick={addCompetitor} className="btn btn-secondary btn-md" type="button">Add</button></div></div>

      {saveError && <p style={{ color: 'var(--danger)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--space-2)' }}>{saveError}</p>}
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => { setSaveError(null); handleSave(); }}
          disabled={saving}
          className="btn btn-primary btn-md">
          {saving ? 'Saving...' : 'Save Outcome'}</button>
        {hasOutcome && (
          <button
            onClick={() => setEditing(false)}
            className="btn btn-secondary btn-md">
            Cancel</button>
        )}</div>
    </div>);
}

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOutcome, setExpandedOutcome] = useState<string | null>(null);

  useEffect(() => { document.title = 'Raise | Meetings'; }, []);
  useEffect(() => {
    let active = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    const load = () => cachedFetch('/api/meetings')
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then(d => { if (active) setMeetings(d); })
      .catch(() => { if (active) setMeetings([]); });
    const start = () => { load(); interval = setInterval(load, 60_000); };
    const onVis = () => { if (document.hidden) { if (interval) { clearInterval(interval); interval = null; } } else { start(); } };
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { active = false; if (interval) clearInterval(interval); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return; if (e.key === 'r' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); cachedFetch('/api/meetings').then(r => r.json()).then(setMeetings).catch(() => {}); } if (e.key === 'n' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); router.push('/meetings/new'); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const filtered = useMemo(() => meetings.filter(m => {
    if (search && !m.investor_name.toLowerCase().includes(search.toLowerCase()) &&
        !(m.raw_notes || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'all' && m.type !== typeFilter) return false;
    if (statusFilter !== 'all' && m.status_after !== statusFilter) return false;
    return true;
  }), [meetings, search, typeFilter, statusFilter]);

  // Stats + per-investor engagement intelligence (single memo)
  const { avgEnthusiasm, totalObjections, uniqueInvestors, investorStats, meetingsByInvestor } = useMemo(() => {
    const avg = meetings.length > 0 ? (meetings.reduce((s, m) => s + m.enthusiasm_score, 0) / meetings.length).toFixed(1) : '0';
    let objCount = 0;
    const investorIds = new Set<string>();
    const byInvestor: Record<string, Meeting[]> = {};
    const stats: Record<string, { count: number; trend: 'up' | 'down' | 'flat' | 'new'; latestEnthusiasm: number; avgEnthusiasm: number }> = {};
    for (const m of meetings) {
      try { objCount += JSON.parse(m.objections || '[]').length; } catch (e) { console.warn('[MEETINGS_OBJ_PARSE]', e instanceof Error ? e.message : e); }
      investorIds.add(m.investor_id);
      if (!byInvestor[m.investor_id]) byInvestor[m.investor_id] = [];
      byInvestor[m.investor_id].push(m);
      if (!stats[m.investor_id]) stats[m.investor_id] = { count: 0, trend: 'new', latestEnthusiasm: 0, avgEnthusiasm: 0 };
      stats[m.investor_id].count++;
    }
    for (const [invId, invMeetings] of Object.entries(byInvestor)) {
      const sorted = [...invMeetings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const latest = sorted[sorted.length - 1];
      stats[invId].latestEnthusiasm = latest.enthusiasm_score;
      stats[invId].avgEnthusiasm = sorted.reduce((s, m) => s + m.enthusiasm_score, 0) / sorted.length;
      if (sorted.length >= 2) {
        const prev = sorted[sorted.length - 2];
        if (latest.enthusiasm_score > prev.enthusiasm_score) stats[invId].trend = 'up';
        else if (latest.enthusiasm_score < prev.enthusiasm_score) stats[invId].trend = 'down';
        else stats[invId].trend = 'flat';
      }
    }
    return { avgEnthusiasm: avg, totalObjections: objCount, uniqueInvestors: investorIds.size, investorStats: stats, meetingsByInvestor: byInvestor };
  }, [meetings]);

  const { momentumUp, momentumDown } = useMemo(() => {
    const up = Object.entries(investorStats).filter(([, s]) => s.trend === 'up').map(([id, s]) => ({ id, name: meetingsByInvestor[id]?.[0]?.investor_name || id, score: s.latestEnthusiasm })).sort((a, b) => b.score - a.score).slice(0, 3);
    const down = Object.entries(investorStats).filter(([, s]) => s.trend === 'down').map(([id, s]) => ({ id, name: meetingsByInvestor[id]?.[0]?.investor_name || id, score: s.latestEnthusiasm })).sort((a, b) => a.score - b.score).slice(0, 3);
    return { momentumUp: up, momentumDown: down };
  }, [investorStats, meetingsByInvestor]);

  const handleOutcomeSaved = useCallback((updated: Meeting) => {
    setMeetings(prev => prev.map(m => m.id === updated.id ? updated : m));
  }, []);

  return (
    <div className="page-content space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Meetings</h1>
          <p className="page-subtitle" style={stFontSm}>
            {filtered.length === meetings.length ? `${meetings.length} meetings with ${uniqueInvestors} investors` : `${filtered.length} of ${meetings.length} meetings`}</p></div>
        <div className="flex gap-2">
          <Link
            href="/meetings/capture"
            className="btn btn-secondary btn-md">
            Quick Capture</Link>
          <Link
            href="/meetings/prep"
            className="btn btn-secondary btn-md">
            <FileSearch className="w-3.5 h-3.5" /> Meeting Prep</Link>
          <Link
            href="/meetings/new"
            className="btn btn-primary btn-md">
            + Log Meeting</Link></div></div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 card-stagger">
        <div className="card-metric">
          <div className="metric-label">Total Meetings</div>
          <div className="metric-value" style={{ marginTop: '2px' }}>{meetings.length}</div></div>
        <div className="card-metric">
          <div className="metric-label">Avg Enthusiasm</div>
          <div className="metric-value" style={{ marginTop: '2px' }}>
            {avgEnthusiasm}<span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>/5</span></div></div>
        <div className="card-metric">
          <div className="metric-label">Objections</div>
          <div className="metric-value" style={{ marginTop: '2px', color: 'var(--text-tertiary)' }}>{totalObjections}</div></div>
        <div className="card-metric">
          <div className="metric-label">Unique Investors</div>
          <div className="metric-value" style={{ marginTop: '2px' }}>{uniqueInvestors}</div></div></div>

      {/* Momentum Signals */}
      {momentumUp.length > 0 || momentumDown.length > 0 ? (
          <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            {momentumUp.length > 0 && <span style={{ color: 'var(--success)' }}>Gaining momentum: {momentumUp.map(i => i.name).join(', ')}</span>}
            {momentumDown.length > 0 && <span style={{ color: 'var(--warning)' }}>Cooling: {momentumDown.map(i => i.name).join(', ')}</span>}
          </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={stTextTertiary} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search investor or notes..."
            className="input"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search meetings"
            style={{ paddingLeft: 'var(--space-10)' }} /></div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="input"
          style={{ width: 'auto' }}>
          {MEETING_TYPES.map(t => (
            <option key={t} value={t}>{t === 'all' ? 'All types' : t.replace(/_/g, ' ')}</option>
          ))}</select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input"
          style={{ width: 'auto' }}>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}</option>
          ))}</select>
        <a
          href="/api/export?type=meetings"
          download
          className="btn btn-secondary btn-md">
          <Download className="w-3.5 h-3.5" /> CSV</a></div>

      {/* Meeting List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={meetings.length === 0 ? 'No meetings logged yet' : 'No meetings match your filters'}
          description={meetings.length === 0 ? 'Start by scheduling your first meeting.' : 'Try adjusting your filters.'}
          action={meetings.length === 0 ? { label: 'Log your first meeting', href: '/meetings/new' } : undefined} />
      ) : (
        <div className="space-y-3">
          {filtered.map(m => {
            const objections = (() => { try { return JSON.parse(m.objections || '[]'); } catch { return []; } })();
            const questions = (() => { try { return JSON.parse(m.questions_asked || '[]'); } catch { return []; } })();
            const isOutcomeExpanded = expandedOutcome === m.id;
            const hasOutcome = m.outcome_rating !== null && m.outcome_rating !== undefined;
            const stats = investorStats[m.investor_id];
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
                        className="investor-link"
                        style={{ fontWeight: 400 }}>
                        {m.investor_name}</Link>
                      {stats && stats.count > 1 && (
                        <span
                          className="flex items-center gap-1"
                          style={meetingCountBadge}>
                          {stats.count} meetings</span>
                      )}
                      {stats && stats.count >= 2 && (
                        <span
                          className="flex items-center gap-0.5"
                          style={{ fontSize: 'var(--font-size-xs)', color: trend.color }}
                          title={`Enthusiasm ${trend.label.toLowerCase()} (avg ${stats.avgEnthusiasm.toFixed(1)})`}>
                          <TrendIcon className="w-3 h-3" /></span>
                      )}</div>
                    <div className="flex gap-3 mt-1" style={labelTertiary}>
                      <span>{fmtDateTime(m.date)}</span>
                      <span style={{ textTransform: 'capitalize' }}>{m.type.replace(/_/g, ' ')}</span>
                      <span>{m.duration_minutes}min</span>
                      {m.attendees && <span>{m.attendees}</span>}</div></div>
                  <div className="flex items-center gap-2">
                    <div className="enthusiasm-dots">
                      {[1,2,3,4,5].map(n => (
                        <div
                          key={n}
                          className={`enthusiasm-dot ${n <= m.enthusiasm_score ? 'enthusiasm-dot-filled' : 'enthusiasm-dot-empty'}`}
                            />
                      ))}</div>
                    <span className={getStatusBadgeClass(m.status_after)}>
                      {m.status_after.replace(/_/g, ' ')}</span></div></div>

                {m.ai_analysis && (
                  <div className="flex items-start gap-2" style={{ marginBottom: 'var(--space-3)' }}>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', flex: 1 }}>
                      {m.ai_analysis}</p>
                    <CopyButton text={m.ai_analysis} label="" /></div>
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
                  )}</div>

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
                        {o.text.length > 50 ? o.text.slice(0, 50) + '...' : o.text}</span>
                    ))}</div>
                )}

                {m.next_steps && (
                  <div className="mt-2 flex items-center gap-2" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)', opacity: 0.6, background: 'var(--accent-muted)', borderRadius: 'var(--radius-sm)', padding: '4px 8px' }}>
                    <span style={{ flex: 1 }}>Next: {m.next_steps}</span>
                    <CopyButton text={m.next_steps} label="" style={{ background: 'transparent', opacity: 1 }} /></div>
                )}

                {/* Meeting Outcome Toggle */}
                <div className="mt-3" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
                  <button
                    onClick={() => setExpandedOutcome(isOutcomeExpanded ? null : m.id)}
                    className={`flex items-center gap-2 w-full${hasOutcome ? '' : ' hover-text-secondary'}`}
                    aria-expanded={isOutcomeExpanded}
                    aria-label={hasOutcome ? 'Meeting Outcome' : 'Record Outcome'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'var(--font-size-sm)', fontWeight: 400, color: hasOutcome ? 'var(--success)' : 'var(--text-tertiary)' }}>
                    {isOutcomeExpanded
                      ? <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronRight className="w-3.5 h-3.5" />
                    }
                    {hasOutcome ? 'Meeting Outcome' : 'Record Outcome'}
                    {hasOutcome && (
                      <span style={{ marginLeft: '4px' }}>
                        <CheckCircle2 className="w-3.5 h-3.5" /></span>
                    )}</button>

                  {isOutcomeExpanded && (
                    <div className="mt-3">
                      <MeetingOutcomeSection
                        meeting={m}
                        onSaved={handleOutcomeSaved} /></div>
                  )}</div>
              </div>);
          })}</div>
      )}
    </div>);
}

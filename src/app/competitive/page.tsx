'use client';

import { useEffect, useState, useMemo } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import Link from 'next/link';
import { Shield, ChevronDown, ChevronRight, Calendar, Users, Hash } from 'lucide-react';
import { useToast } from '@/components/toast';
import { cachedFetch } from '@/lib/cache';
import { relativeTime } from '@/lib/time';
import { labelTertiary, stFontSm, stTextMuted, stTextPrimary, stTextTertiary } from '@/lib/styles';

interface CompetitorMeeting { meeting_id: string; investor_name: string; date: string; }

interface CompetitorEntry {
  name: string;
  mention_count: number;
  investors: string[];
  latest_mention: string;
  meetings: CompetitorMeeting[];
}

interface CompetitiveData {
  competitors: CompetitorEntry[];
  total_meetings_scanned: number;
  date_range: { from: string | null; to: string | null };
}

const investorTagStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text-secondary)' };
const compGridRow: React.CSSProperties = { gridTemplateColumns: '32px 1fr 80px 1fr 120px', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer' };
const mtgRowStyle = { fontSize: 'var(--font-size-sm)', padding: 'var(--space-2) var(--space-3)', background: 'var(--surface-0)', borderRadius: 'var(--radius-sm)' } as const;
const mtgDateStyle = { color: 'var(--text-tertiary)', minWidth: '80px' } as const;
const mtgContextLabel: React.CSSProperties = { fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-muted)', marginBottom: 'var(--space-2)', letterSpacing: '0.01em' };
const mtgExpandedCard: React.CSSProperties = { padding: 'var(--space-3) var(--space-4) var(--space-3) var(--space-10)', background: 'var(--surface-1)', borderBottom: '1px solid var(--border-subtle)' };

export default function CompetitivePage() {
  const { toast } = useToast();
  const [data, setData] = useState<CompetitiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    const qs = params.toString();
    cachedFetch(`/api/competitive${qs ? '?' + qs : ''}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((d: CompetitiveData) => { setData(d); setLoading(false); setLoadedAt(new Date().toISOString()); })
      .catch(() => { setData(null); setLoading(false); toast('Couldn\'t load competitive intelligence — try refreshing', 'error'); });
  };

  useEffect(() => { document.title = 'Raise | Competitive Intel'; }, []);
  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchData(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const handleFilter = () => { fetchData(); };

  const { totalMentions, uniqueCompetitors, topCompetitor } = useMemo(() => ({
    totalMentions: data?.competitors.reduce((s, c) => s + c.mention_count, 0) ?? 0,
    uniqueCompetitors: data?.competitors.length ?? 0,
    topCompetitor: data?.competitors[0]?.name ?? '-',
  }), [data?.competitors]);

  return (
    <div className="page-content space-y-6">
      <div>
        <h1 className="page-title">Competitive Intelligence</h1>
        <p className="page-subtitle" style={stFontSm}>
          Competitors mentioned across investor meetings
          {loadedAt && <> &middot; <span style={{ color: 'var(--text-muted)' }}>{relativeTime(loadedAt)}</span></>}</p></div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 card-stagger">
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Total Mentions</div>
          <div className="metric-value" style={{ marginTop: '2px' }}>{totalMentions}</div></div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Unique Competitors</div>
          <div className="metric-value" style={{ marginTop: '2px' }}>{uniqueCompetitors}</div></div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Top Competitor</div>
          <div className="metric-value" style={{ marginTop: '2px', fontSize: 'var(--font-size-lg)' }}>{topCompetitor}</div></div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Meetings Scanned</div>
          <div className="metric-value" style={{ marginTop: '2px' }}>{data?.total_meetings_scanned ?? 0}</div></div></div>

      {/* Date Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>From</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="input"
            style={{ width: '160px' }} /></div>
        <div>
          <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>To</label>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="input"
            style={{ width: '160px' }} /></div>
        <button
          onClick={handleFilter}
          className="btn btn-secondary btn-md">
          Apply Filter</button>
        {(fromDate || toDate) && (
          <button
            onClick={() => { setFromDate(''); setToDate(''); setTimeout(fetchData, 0); }}
            className="btn btn-secondary btn-md"
            style={stTextTertiary}>
            Clear</button>
        )}</div>

      {/* Competitor Table */}
      {loading ? (
        <div className="space-y-3">
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Loading competitive signals...</p>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '48px', borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : !data || data.competitors.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No competitor intelligence yet"
          description="When investors mention competitors during meetings, log them in your debrief notes. This surfaces patterns in how investors compare you."
          action={{ label: 'Log a meeting', href: '/meetings' }} />
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Table Header */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: '32px 1fr 80px 1fr 120px',
              padding: 'var(--space-3) var(--space-4)',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 400,
              color: 'var(--text-muted)',
              letterSpacing: '0.01em', }}>
            <div />
            <div>Competitor</div>
            <div style={{ textAlign: 'center' }}>Mentions</div>
            <div>Investors</div>
            <div>Latest</div></div>

          {/* Table Rows */}
          {data.competitors.map((c) => {
            const isExpanded = expandedRow === c.name;

            return (
              <div key={c.name}>
                <div
                  className="grid items-center hover-row"
                  style={compGridRow}
                  onClick={() => setExpandedRow(isExpanded ? null : c.name)}
                  role="button"
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${c.name} details`}>
                  <div style={stTextMuted}>
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />
                    }</div>
                  <div style={{ fontWeight: 400, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
                    {c.name}</div>
                  <div style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'var(--space-1)',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 400,
                        color: c.mention_count >= 3 ? 'var(--danger)' : c.mention_count >= 2 ? 'var(--warning)' : 'var(--text-secondary)',
                      }}>
                      <span style={{ color: 'inherit' }}><Hash className="w-3 h-3" /></span>
                      {c.mention_count}</span></div>
                  <div className="flex flex-wrap gap-1">
                    {c.investors.map(inv => (
                      <span key={inv} style={investorTagStyle}>{inv}</span>
                    ))}</div>
                  <div style={labelTertiary}>
                    {c.latest_mention}</div></div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div style={mtgExpandedCard}>
                    <div style={mtgContextLabel}>
                      Meeting Context</div>
                    <div className="space-y-2">
                      {c.meetings.map((mtg, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3"
                          style={mtgRowStyle}>
                          <span style={stTextMuted}><Calendar className="w-3.5 h-3.5" /></span>
                          <span style={mtgDateStyle}>{mtg.date}</span>
                          <span style={stTextMuted}><Users className="w-3.5 h-3.5" /></span>
                          <span style={stTextPrimary}>{mtg.investor_name}</span></div>
                      ))}</div></div>
                )}
              </div>);
          })}</div>
      )}
    </div>);
}

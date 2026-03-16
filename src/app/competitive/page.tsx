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

const investorTagStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', padding: 'var(--space-0) var(--space-1)', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text-secondary)' };
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

  // Build investor × competitor cross-reference matrix
  const heatmapData = useMemo(() => {
    if (!data?.competitors.length) return null;
    const allInvestors = new Set<string>();
    const matrix = new Map<string, Map<string, number>>();
    for (const c of data.competitors) {
      const compMap = new Map<string, number>();
      for (const mtg of c.meetings) {
        const inv = mtg.investor_name;
        allInvestors.add(inv);
        compMap.set(inv, (compMap.get(inv) ?? 0) + 1);
      }
      matrix.set(c.name, compMap);
    }
    const investors = [...allInvestors].sort();
    const competitors = data.competitors.map(c => c.name).slice(0, 8);
    if (investors.length < 2 || competitors.length < 2) return null;

    // Find max for color scaling
    let maxMentions = 1;
    for (const [, compMap] of matrix) {
      for (const [, count] of compMap) {
        if (count > maxMentions) maxMentions = count;
      }
    }

    // Identify at-risk investors (mentioned with 2+ competitors)
    const atRiskInvestors: { name: string; competitors: string[]; totalMentions: number }[] = [];
    for (const inv of investors) {
      const comps: string[] = [];
      let total = 0;
      for (const comp of competitors) {
        const count = matrix.get(comp)?.get(inv) ?? 0;
        if (count > 0) { comps.push(comp); total += count; }
      }
      if (comps.length >= 2) atRiskInvestors.push({ name: inv, competitors: comps, totalMentions: total });
    }
    atRiskInvestors.sort((a, b) => b.totalMentions - a.totalMentions);

    return { investors, competitors, matrix, maxMentions, atRiskInvestors };
  }, [data?.competitors]);

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
          <div className="metric-value" style={{ marginTop: 'var(--space-0)' }}>{totalMentions}</div></div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Unique Competitors</div>
          <div className="metric-value" style={{ marginTop: 'var(--space-0)' }}>{uniqueCompetitors}</div></div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Top Competitor</div>
          <div className="metric-value" style={{ marginTop: 'var(--space-0)', fontSize: 'var(--font-size-lg)' }}>{topCompetitor}</div></div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Meetings Scanned</div>
          <div className="metric-value" style={{ marginTop: 'var(--space-0)' }}>{data?.total_meetings_scanned ?? 0}</div></div></div>

      {/* Investor × Competitor Heatmap */}
      {heatmapData && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: 'var(--space-4) var(--space-4) var(--space-2)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-0)' }}>
                  Threat Matrix</h2>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Which investors are evaluating which competitors</p></div>
              {heatmapData.atRiskInvestors.length > 0 && (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger)', fontWeight: 400 }}>
                  {heatmapData.atRiskInvestors.length} investor{heatmapData.atRiskInvestors.length !== 1 ? 's' : ''} comparing alternatives</span>
              )}
            </div>
          </div>
          <div style={{ overflowX: 'auto', padding: '0 var(--space-4) var(--space-4)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 'var(--space-2)', color: 'var(--text-muted)', fontWeight: 400, borderBottom: '1px solid var(--border-subtle)' }}>Investor</th>
                  {heatmapData.competitors.map(comp => (
                    <th key={comp} style={{ textAlign: 'center', padding: 'var(--space-2)', color: 'var(--text-muted)', fontWeight: 400, borderBottom: '1px solid var(--border-subtle)', minWidth: '70px' }}>
                      {comp}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.investors.map(inv => (
                  <tr key={inv}>
                    <td style={{ padding: 'var(--space-2)', color: 'var(--text-primary)', fontWeight: 300, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-subtle)' }}>
                      {inv}</td>
                    {heatmapData.competitors.map(comp => {
                      const count = heatmapData.matrix.get(comp)?.get(inv) ?? 0;
                      const intensity = count > 0 ? Math.max(0.15, count / heatmapData.maxMentions) : 0;
                      return (
                        <td key={comp} style={{
                          textAlign: 'center',
                          padding: 'var(--space-2)',
                          borderBottom: '1px solid var(--border-subtle)',
                          background: count > 0 ? `rgba(var(--danger-rgb, 220, 38, 38), ${intensity * 0.25})` : 'transparent',
                          color: count > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                          fontWeight: count > 0 ? 400 : 300,
                        }}>
                          {count > 0 ? count : '·'}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* At-Risk Investors */}
          {heatmapData.atRiskInvestors.length > 0 && (
            <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                At-risk — evaluating multiple alternatives</div>
              <div className="flex flex-wrap gap-2">
                {heatmapData.atRiskInvestors.map(inv => (
                  <span key={inv.name} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
                    fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 'var(--radius-sm)', background: 'var(--danger-muted)',
                    color: 'var(--text-primary)', fontWeight: 400,
                  }}>
                    {inv.name}
                    <span style={{ color: 'var(--text-muted)' }}>({inv.competitors.length} competitors, {inv.totalMentions} mentions)</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Date Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>From</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="input"
            style={{ width: '160px' }} /></div>
        <div>
          <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>To</label>
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
                  <div className="flex items-center gap-1.5" style={labelTertiary}>
                    {c.latest_mention}
                    {c.latest_mention && (Date.now() - new Date(c.latest_mention).getTime()) < 7 * 864e5 && <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger)', fontWeight: 400 }}>recent</span>}
                  </div></div>

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

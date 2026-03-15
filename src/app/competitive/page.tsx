'use client';

import { useEffect, useState } from 'react';
import { Shield, ChevronDown, ChevronRight, Calendar, Users, Hash } from 'lucide-react';

interface CompetitorMeeting {
  meeting_id: string;
  investor_name: string;
  date: string;
}

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

export default function CompetitivePage() {
  const [data, setData] = useState<CompetitiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    const qs = params.toString();
    fetch(`/api/competitive${qs ? '?' + qs : ''}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((d: CompetitiveData) => { setData(d); setLoading(false); })
      .catch(() => { setLoading(false); });
  };

  useEffect(() => { fetchData(); }, []);

  const handleFilter = () => { fetchData(); };

  const totalMentions = data?.competitors.reduce((s, c) => s + c.mention_count, 0) ?? 0;
  const uniqueCompetitors = data?.competitors.length ?? 0;
  const topCompetitor = data?.competitors[0]?.name ?? '-';

  return (
    <div className="page-content space-y-6">
      <div>
        <h1 className="page-title">Competitive Intelligence</h1>
        <p className="page-subtitle" style={{ fontSize: 'var(--font-size-sm)' }}>
          Competitors mentioned across investor meetings
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 card-stagger">
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Total Mentions</div>
          <div className="metric-value" style={{ marginTop: '2px' }}>{totalMentions}</div>
        </div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Unique Competitors</div>
          <div className="metric-value" style={{ marginTop: '2px' }}>{uniqueCompetitors}</div>
        </div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Top Competitor</div>
          <div className="metric-value" style={{ marginTop: '2px', fontSize: 'var(--font-size-lg)' }}>{topCompetitor}</div>
        </div>
        <div className="card-metric" style={{ padding: 'var(--space-3)' }}>
          <div className="metric-label">Meetings Scanned</div>
          <div className="metric-value" style={{ marginTop: '2px' }}>{data?.total_meetings_scanned ?? 0}</div>
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>From</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="input"
            style={{ width: '160px' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>To</label>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="input"
            style={{ width: '160px' }}
          />
        </div>
        <button
          onClick={handleFilter}
          className="btn btn-secondary btn-md"
        >
          Apply Filter
        </button>
        {(fromDate || toDate) && (
          <button
            onClick={() => { setFromDate(''); setToDate(''); setTimeout(fetchData, 0); }}
            className="btn btn-secondary btn-md"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Competitor Table */}
      {loading ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)' }}>Loading competitive intelligence...</p>
        </div>
      ) : !data || data.competitors.length === 0 ? (
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <div className="space-y-3">
            <Shield className="w-8 h-8 mx-auto" style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-tertiary)' }}>
              No competitive mentions recorded yet. Log meeting outcomes with competitor mentions to populate this view.
            </p>
          </div>
        </div>
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
              fontWeight: 500,
              color: 'var(--text-muted)',
              letterSpacing: '0.01em',
            }}
          >
            <div />
            <div>Competitor</div>
            <div style={{ textAlign: 'center' }}>Mentions</div>
            <div>Investors</div>
            <div>Latest</div>
          </div>

          {/* Table Rows */}
          {data.competitors.map((c) => {
            const isExpanded = expandedRow === c.name;
            const isHovered = hoveredRow === c.name;

            return (
              <div key={c.name}>
                <div
                  className="grid items-center transition-colors"
                  style={{
                    gridTemplateColumns: '32px 1fr 80px 1fr 120px',
                    padding: 'var(--space-3) var(--space-4)',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: isHovered ? 'var(--surface-1)' : 'transparent',
                    transition: 'background 150ms ease',
                  }}
                  onClick={() => setExpandedRow(isExpanded ? null : c.name)}
                  onMouseEnter={() => setHoveredRow(c.name)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <div style={{ color: 'var(--text-muted)' }}>
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />
                    }
                  </div>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
                    {c.name}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        color: c.mention_count >= 3 ? 'var(--danger)' : c.mention_count >= 2 ? 'var(--warning)' : 'var(--text-secondary)',
                      }}
                    >
                      <span style={{ color: 'inherit' }}><Hash className="w-3 h-3" /></span>
                      {c.mention_count}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.investors.map(inv => (
                      <span
                        key={inv}
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface-2)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {inv}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                    {c.latest_mention}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div
                    style={{
                      padding: 'var(--space-3) var(--space-4) var(--space-3) var(--space-10)',
                      background: 'var(--surface-1)',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--text-muted)', marginBottom: 'var(--space-2)', letterSpacing: '0.01em' }}>
                      Meeting Context
                    </div>
                    <div className="space-y-2">
                      {c.meetings.map((mtg, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3"
                          style={{
                            fontSize: 'var(--font-size-sm)',
                            padding: 'var(--space-2) var(--space-3)',
                            background: 'var(--surface-0)',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          <span style={{ color: 'var(--text-muted)' }}><Calendar className="w-3.5 h-3.5" /></span>
                          <span style={{ color: 'var(--text-tertiary)', minWidth: '80px' }}>{mtg.date}</span>
                          <span style={{ color: 'var(--text-muted)' }}><Users className="w-3.5 h-3.5" /></span>
                          <span style={{ color: 'var(--text-primary)' }}>{mtg.investor_name}</span>
                        </div>
                      ))}
                    </div>
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

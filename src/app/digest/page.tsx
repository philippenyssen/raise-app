'use client';

import { useEffect, useState, useCallback } from 'react';
import { cachedFetch } from '@/lib/cache';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Calendar, Users, CheckCircle, Target,
  RefreshCw, FileBarChart, ArrowRight,
} from 'lucide-react';
import { labelMuted, labelTertiary, stFontSm, stFontXs, stTextMuted, stTextSecondary } from '@/lib/styles';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const pageWrap: React.CSSProperties = { maxWidth: '900px', margin: '0 auto', padding: 'var(--space-6)' };
const headerRow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-3)' };
const titleStyle: React.CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 'var(--font-size-2xl)', fontWeight: 300, color: 'var(--text-primary)' };
const navBtn: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-1) var(--space-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' };
const card: React.CSSProperties = { background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 'var(--space-5)', marginBottom: 'var(--space-4)' };
const metricCard: React.CSSProperties = { padding: 'var(--space-3) var(--space-4)', background: 'var(--surface-0)', borderRadius: 'var(--radius-md)', textAlign: 'center' };
const metricVal: React.CSSProperties = { fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)', marginTop: 'var(--space-0)' };
const sectionTitle: React.CSSProperties = { fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' };
const riskDotBase: React.CSSProperties = { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 };
const priorityDot: React.CSSProperties = { ...riskDotBase, marginTop: '5px' };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DigestData {
  weekRange: { start: string; end: string };
  weeksBack: number;
  pipelineSnapshot: Record<string, number>;
  totalActive: number;
  stageChanges: { investorId: string; description: string; date: string }[];
  meetings: {
    count: number; priorCount: number; delta: number; uniqueInvestors: number;
    byType: Record<string, number>;
    top: { investorName: string; type: string; date: string; enthusiasm: number | null }[];
  };
  followups: { total: number; completed: number; completionRate: number; priorRate: number; overdue: number };
  newInvestors: { name: string; tier: number; type: string }[];
  risks: { type: string; investor: string; detail: string; severity: 'high' | 'medium' }[];
  wins: { investorId: string; description: string; date: string }[];
  passes: { investorId: string; description: string; date: string }[];
  metrics: {
    meetings: { current: number; prior: number; delta: number };
    followupRate: { current: number; prior: number; delta: number };
    activeInvestors: { current: number };
    newInvestors: { current: number };
    overdueFollowups: { current: number };
  };
  priorities: { action: string; reason: string; priority: 'critical' | 'high' | 'normal' }[];
}

function DeltaBadge({ delta, suffix = '' }: { delta: number; suffix?: string }) {
  if (delta === 0) return <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}><Minus className="w-3 h-3" /> flat</span>;
  const up = delta > 0;
  return (
    <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: up ? 'var(--success)' : 'var(--danger)' }}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{delta}{suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DigestPage() {
  const [data, setData] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weeksBack, setWeeksBack] = useState(0);

  const fetchDigest = useCallback(() => {
    setLoading(true);
    cachedFetch(`/api/digest?weeks_back=${weeksBack}`, { ttl: 120000 })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('fetch failed')))
      .then((d: DigestData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [weeksBack]);

  useEffect(() => { fetchDigest(); }, [fetchDigest]);

  if (loading && !data) {
    return (
      <div style={pageWrap}>
        <div style={headerRow}><div style={titleStyle}>Weekly Digest</div></div>
        <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-4)' }} />
        <div className="skeleton" style={{ height: '300px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  if (!data) return null;

  const weekLabel = weeksBack === 0 ? 'This Week' : weeksBack === 1 ? 'Last Week' : `${weeksBack} weeks ago`;

  return (
    <div style={pageWrap}>
      {/* Header */}
      <div style={headerRow}>
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--text-muted)' }}><FileBarChart className="w-5 h-5" /></span>
          <h1 style={titleStyle}>Weekly Digest</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeeksBack(w => w + 1)} style={navBtn}><ChevronLeft className="w-4 h-4" /></button>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 400, minWidth: '100px', textAlign: 'center' }}>
            {weekLabel}
          </span>
          <button onClick={() => setWeeksBack(w => Math.max(0, w - 1))} style={navBtn} disabled={weeksBack === 0}><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Date range */}
      <div style={{ ...labelMuted, marginBottom: 'var(--space-4)' }}>
        {data.weekRange.start} — {data.weekRange.end}
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={metricCard}>
          <div style={labelMuted}>Meetings</div>
          <div style={metricVal}>{data.metrics.meetings.current}</div>
          <DeltaBadge delta={data.metrics.meetings.delta} />
        </div>
        <div style={metricCard}>
          <div style={labelMuted}>Follow-up Rate</div>
          <div style={metricVal}>{data.metrics.followupRate.current}%</div>
          <DeltaBadge delta={data.metrics.followupRate.delta} suffix="pp" />
        </div>
        <div style={metricCard}>
          <div style={labelMuted}>Active Pipeline</div>
          <div style={metricVal}>{data.metrics.activeInvestors.current}</div>
          <div style={labelTertiary}>investors</div>
        </div>
        <div style={metricCard}>
          <div style={labelMuted}>New This Week</div>
          <div style={metricVal}>{data.metrics.newInvestors.current}</div>
          <div style={labelTertiary}>added</div>
        </div>
        <div style={{ ...metricCard, borderLeft: data.metrics.overdueFollowups.current > 0 ? '3px solid var(--warning)' : undefined }}>
          <div style={labelMuted}>Overdue</div>
          <div style={{ ...metricVal, color: data.metrics.overdueFollowups.current > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
            {data.metrics.overdueFollowups.current}
          </div>
          <div style={labelTertiary}>follow-ups</div>
        </div>
      </div>

      {/* Pipeline snapshot bar */}
      <div style={card}>
        <div style={sectionTitle}>
          <span style={{ color: 'var(--text-muted)' }}><Users className="w-4 h-4" /></span>
          Pipeline Snapshot
        </div>
        <div className="flex" style={{ height: '24px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', gap: '2px', marginBottom: 'var(--space-3)' }}>
          {['contacted', 'nda_signed', 'meeting_scheduled', 'met', 'engaged', 'in_dd', 'term_sheet', 'closed'].map(s => {
            const count = data.pipelineSnapshot[s] || 0;
            if (count === 0) return null;
            const opacity = ['closed', 'term_sheet'].includes(s) ? 1 : ['in_dd', 'engaged'].includes(s) ? 0.8 : 0.5;
            return (
              <div key={s} style={{
                flex: count,
                background: 'var(--accent)',
                opacity,
                borderRadius: 'var(--radius-xs)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', color: 'var(--surface-0)', fontWeight: 400,
              }} title={`${s.replace(/_/g, ' ')}: ${count}`}>
                {count > 0 && count}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(data.pipelineSnapshot)
            .filter(([s]) => !['passed', 'dropped', 'identified'].includes(s))
            .map(([s, count]) => (
              <span key={s} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {s.replace(/_/g, ' ')}: <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{count}</span>
              </span>
            ))}
        </div>
      </div>

      {/* Two-column: Meetings + Follow-ups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 'var(--space-4)' }}>
        {/* Meetings */}
        <div style={card}>
          <div style={sectionTitle}>
            <span style={{ color: 'var(--text-muted)' }}><Calendar className="w-4 h-4" /></span>
            Meetings ({data.meetings.count})
          </div>
          {data.meetings.top.length > 0 ? (
            <div className="space-y-2">
              {data.meetings.top.map((m, i) => (
                <div key={i} className="flex items-center justify-between" style={{ fontSize: 'var(--font-size-xs)' }}>
                  <div>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 400 }}>{m.investorName}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 'var(--space-1)' }}>({m.type?.replace(/_/g, ' ') || 'meeting'})</span>
                  </div>
                  <span style={labelTertiary}>{m.date}</span>
                </div>
              ))}
              {data.meetings.count > 5 && (
                <div style={{ ...labelTertiary, marginTop: 'var(--space-1)' }}>+{data.meetings.count - 5} more</div>
              )}
            </div>
          ) : (
            <div style={{ ...stFontSm, color: 'var(--text-muted)' }}>No meetings this week</div>
          )}
        </div>

        {/* Follow-ups */}
        <div style={card}>
          <div style={sectionTitle}>
            <span style={{ color: 'var(--text-muted)' }}><CheckCircle className="w-4 h-4" /></span>
            Follow-ups
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div>
              <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: data.followups.completionRate >= 80 ? 'var(--success)' : data.followups.completionRate >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                {data.followups.completionRate}%
              </span>
              <span style={{ ...labelMuted, marginLeft: 'var(--space-1)' }}>completion</span>
            </div>
            <DeltaBadge delta={data.followups.completionRate - data.followups.priorRate} suffix="pp" />
          </div>
          <div className="flex gap-3" style={{ fontSize: 'var(--font-size-xs)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Total: <span style={{ color: 'var(--text-secondary)' }}>{data.followups.total}</span></span>
            <span style={{ color: 'var(--text-muted)' }}>Done: <span style={{ color: 'var(--success)' }}>{data.followups.completed}</span></span>
            {data.followups.overdue > 0 && (
              <span style={{ color: 'var(--warning)' }}>Overdue: {data.followups.overdue}</span>
            )}
          </div>
        </div>
      </div>

      {/* Risks */}
      {data.risks.length > 0 && (
        <div style={{ ...card, borderLeft: '3px solid var(--warning)' }}>
          <div style={sectionTitle}>
            <span style={{ color: 'var(--warning)' }}><AlertTriangle className="w-4 h-4" /></span>
            Risk Alerts ({data.risks.length})
          </div>
          <div className="space-y-2">
            {data.risks.slice(0, 8).map((r, i) => (
              <div key={i} className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-xs)' }}>
                <span style={{ ...riskDotBase, background: r.severity === 'high' ? 'var(--danger)' : 'var(--warning)' }} />
                <span style={{ color: 'var(--text-primary)', fontWeight: 400 }}>{r.investor}</span>
                <span style={{ color: 'var(--text-muted)' }}>— {r.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priorities */}
      {data.priorities.length > 0 && (
        <div style={{ ...card, borderLeft: '3px solid var(--accent)' }}>
          <div style={sectionTitle}>
            <span style={{ color: 'var(--accent)' }}><Target className="w-4 h-4" /></span>
            Priorities for Next Week
          </div>
          <div className="space-y-2">
            {data.priorities.map((p, i) => (
              <div key={i} className="flex items-start gap-2" style={{ fontSize: 'var(--font-size-xs)' }}>
                <span style={{ ...priorityDot, background: p.priority === 'critical' ? 'var(--danger)' : p.priority === 'high' ? 'var(--warning)' : 'var(--accent)' }} />
                <div>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 400 }}>{p.action}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 'var(--space-1)' }}>— {p.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage changes + Wins */}
      {(data.stageChanges.length > 0 || data.wins.length > 0 || data.passes.length > 0) && (
        <div style={card}>
          <div style={sectionTitle}>
            <span style={{ color: 'var(--text-muted)' }}><ArrowRight className="w-4 h-4" /></span>
            Pipeline Movement
          </div>
          {data.wins.length > 0 && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div style={{ ...labelMuted, marginBottom: 'var(--space-1)', color: 'var(--success)' }}>Wins</div>
              {data.wins.map((w, i) => (
                <div key={i} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{w.description} ({w.date})</div>
              ))}
            </div>
          )}
          {data.passes.length > 0 && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div style={{ ...labelMuted, marginBottom: 'var(--space-1)', color: 'var(--danger)' }}>Passes</div>
              {data.passes.map((p, i) => (
                <div key={i} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{p.description} ({p.date})</div>
              ))}
            </div>
          )}
          {data.stageChanges.length > 0 && (
            <div>
              <div style={{ ...labelMuted, marginBottom: 'var(--space-1)' }}>Stage Changes ({data.stageChanges.length})</div>
              {data.stageChanges.slice(0, 10).map((s, i) => (
                <div key={i} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{s.description} ({s.date})</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New investors */}
      {data.newInvestors.length > 0 && (
        <div style={card}>
          <div style={sectionTitle}>
            <span style={{ color: 'var(--text-muted)' }}><Users className="w-4 h-4" /></span>
            New Investors ({data.newInvestors.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {data.newInvestors.map((inv, i) => (
              <span key={i} style={{
                fontSize: 'var(--font-size-xs)',
                padding: 'var(--space-1) var(--space-2)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-2)',
                color: 'var(--text-secondary)',
              }}>
                {inv.name} <span style={{ color: 'var(--text-muted)' }}>T{inv.tier} · {inv.type}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

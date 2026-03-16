'use client';

import { useEffect, useState } from 'react';
import { cachedFetch } from '@/lib/cache';
import {
  BarChart3, TrendingUp, TrendingDown, Target, Clock,
  Users, CheckCircle2, AlertTriangle, ArrowUp, ArrowDown, Minus,
  RefreshCcw,
} from 'lucide-react';

/* ── styles ── */
const headerStyle: React.CSSProperties = { fontSize: 'var(--font-size-2xl)', fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '-0.02em' };
const subtitleStyle: React.CSSProperties = { fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)', fontWeight: 300, marginTop: 'var(--space-1)' };
const cardStyle: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' };
const labelStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', fontWeight: 300, textTransform: 'uppercase' as const, letterSpacing: '0.05em' };
const bigNumStyle: React.CSSProperties = { fontSize: 'var(--font-size-3xl)', fontWeight: 300, fontVariantNumeric: 'tabular-nums' };
const metricNameStyle: React.CSSProperties = { fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: 300 };
const metricValStyle: React.CSSProperties = { fontSize: 'var(--font-size-sm)', fontWeight: 400, fontVariantNumeric: 'tabular-nums' };
const barTrackStyle: React.CSSProperties = { height: '8px', background: 'var(--surface-3)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', position: 'relative' as const };
const trendCellStyle: React.CSSProperties = { textAlign: 'center' as const, padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)', fontVariantNumeric: 'tabular-nums' };

function pctColor(p: number): string {
  if (p >= 70) return 'var(--success)';
  if (p >= 45) return 'var(--accent)';
  if (p >= 25) return 'var(--warning)';
  return 'var(--danger)';
}

function PctBadge({ value }: { value: number }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
      padding: 'var(--space-0) var(--space-2)', borderRadius: 'var(--radius-full)',
      fontSize: 'var(--font-size-xs)', fontWeight: 400,
      background: `color-mix(in srgb, ${pctColor(value)} 15%, transparent)`,
      color: pctColor(value),
    }}>
      {value >= 60 ? <ArrowUp size={10} /> : value >= 40 ? <Minus size={10} /> : <ArrowDown size={10} />}
      P{value}
    </span>
  );
}

function PercentileBar({ value, benchP25, benchP50, benchP75 }: { value: number; benchP25: number; benchP50: number; benchP75: number }) {
  const max = benchP75 * 1.4;
  const pct = (v: number) => Math.min(100, Math.max(0, (v / max) * 100));
  return (
    <div style={{ ...barTrackStyle, marginTop: 'var(--space-1)' }}>
      {/* P25 marker */}
      <div style={{ position: 'absolute', left: `${pct(benchP25)}%`, top: 0, bottom: 0, width: '1px', background: 'var(--border-default)', zIndex: 1 }} />
      {/* P50 marker */}
      <div style={{ position: 'absolute', left: `${pct(benchP50)}%`, top: 0, bottom: 0, width: '2px', background: 'var(--text-tertiary)', zIndex: 1 }} />
      {/* P75 marker */}
      <div style={{ position: 'absolute', left: `${pct(benchP75)}%`, top: 0, bottom: 0, width: '1px', background: 'var(--border-default)', zIndex: 1 }} />
      {/* Your value */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${pct(value)}%`, background: pctColor((value / benchP50) * 50),
        borderRadius: 'var(--radius-sm)', transition: 'width 0.5s ease',
      }} />
    </div>
  );
}

function InsightBadge({ type }: { type: 'strength' | 'weakness' | 'opportunity' }) {
  const colors = {
    strength: { bg: 'var(--success-muted)', color: 'var(--success)' },
    weakness: { bg: 'var(--danger-muted)', color: 'var(--danger)' },
    opportunity: { bg: 'var(--warning-muted)', color: 'var(--warning)' },
  };
  const icons = { strength: TrendingUp, weakness: TrendingDown, opportunity: Target };
  const Icon = icons[type];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
      padding: 'var(--space-0) var(--space-2)', borderRadius: 'var(--radius-full)',
      fontSize: 'var(--font-size-xs)', fontWeight: 400,
      background: colors[type].bg, color: colors[type].color,
      textTransform: 'capitalize' as const,
    }}>
      <Icon size={10} />
      {type}
    </span>
  );
}

interface BenchData {
  overallPercentile: number;
  overallLabel: string;
  raiseMetrics: {
    totalDays: number;
    totalWeeks: number;
    totalInvestors: number;
    meetingsPerWeek: number;
    followupCompletionRate: number;
    pipelineCoverage: number;
    timeToFirstTermSheet: number;
    conversions: Record<string, number>;
    avgDaysInStage: Record<string, number>;
  };
  funnel: Record<string, number>;
  rankings: {
    spaceDef: {
      conversions: Record<string, { value: number; percentile: number; vs: { p25: number; p50: number; p75: number } }>;
      stageTime: Record<string, { value: number; percentile: number; vs: { p25: number; p50: number; p75: number } }>;
      meetingsPerWeek: { value: number; percentile: number; vs: { p25: number; p50: number; p75: number } };
      followupRate: { value: number; percentile: number; vs: { p25: number; p50: number; p75: number } };
      pipelineCoverage: { value: number; percentile: number; vs: { p25: number; p50: number; p75: number } };
      totalProcessDays: { value: number; percentile: number; vs: { p25: number; p50: number; p75: number } };
    };
    general: {
      conversions: Record<string, { value: number; percentile: number; vs: { p25: number; p50: number; p75: number } }>;
      stageTime: Record<string, { value: number; percentile: number; vs: { p25: number; p50: number; p75: number } }>;
      meetingsPerWeek: { value: number; percentile: number; vs: { p25: number; p50: number; p75: number } };
      followupRate: { value: number; percentile: number; vs: { p25: number; p50: number; p75: number } };
      pipelineCoverage: { value: number; percentile: number; vs: { p25: number; p50: number; p75: number } };
      totalProcessDays: { value: number; percentile: number; vs: { p25: number; p50: number; p75: number } };
    };
  };
  weeklyTrend: { week: string; meetings: number; newInvestors: number }[];
  insights: { type: 'strength' | 'weakness' | 'opportunity'; metric: string; detail: string; percentile: number }[];
  generatedAt: string;
}

const CONV_LABELS: Record<string, string> = {
  contact_to_meeting: 'Contact → Meeting',
  meeting_to_engaged: 'Meeting → Engaged',
  engaged_to_dd: 'Engaged → DD',
  dd_to_termsheet: 'DD → Term Sheet',
  termsheet_to_close: 'Term Sheet → Close',
};

const STAGE_LABELS: Record<string, string> = {
  contacted: 'Contacted',
  meeting_scheduled: 'Meeting Scheduled',
  met: 'Met',
  engaged: 'Engaged',
  in_dd: 'In DD',
  term_sheet: 'Term Sheet',
};

export default function BenchmarkingPage() {
  const [data, setData] = useState<BenchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [benchType, setBenchType] = useState<'spaceDef' | 'general'>('spaceDef');

  function fetchData() {
    setLoading(true);
    setError(null);
    cachedFetch('/api/benchmarking', { ttl: 120000 })
      .then(res => { if (!res.ok) throw new Error('Failed to load benchmarks'); return res.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { fetchData(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: '60vh' }}>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>Computing benchmarks...</div>
    </div>
  );

  if (error || !data) return (
    <div className="flex items-center justify-center" style={{ height: '60vh' }}>
      <div style={{ color: 'var(--danger)', fontSize: 'var(--font-size-sm)' }}>{error || 'No data'}</div>
    </div>
  );

  const r = data.rankings[benchType];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <div className="flex items-center gap-3">
            <span style={{ color: 'var(--text-tertiary)' }}><BarChart3 size={22} /></span>
            <h1 style={headerStyle}>Fundraise Benchmarking</h1>
          </div>
          <p style={subtitleStyle}>Your execution velocity vs. sector benchmarks</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex" style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            {(['spaceDef', 'general'] as const).map(t => (
              <button key={t} onClick={() => setBenchType(t)} style={{
                padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-xs)', fontWeight: 300, border: 'none', cursor: 'pointer',
                background: benchType === t ? 'var(--surface-0)' : 'transparent',
                color: benchType === t ? 'var(--text-primary)' : 'var(--text-tertiary)',
                boxShadow: benchType === t ? 'var(--shadow-sm)' : 'none',
              }}>
                {t === 'spaceDef' ? 'Space/Defense' : 'General Tech'}
              </button>
            ))}
          </div>
          <button onClick={fetchData} style={{
            background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-2)', cursor: 'pointer', color: 'var(--text-tertiary)',
          }}>
            <RefreshCcw size={14} />
          </button>
        </div>
      </div>

      {/* Overall Score */}
      <div style={{ ...cardStyle, marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
        <div style={{ textAlign: 'center', minWidth: '120px' }}>
          <div style={{ ...bigNumStyle, color: pctColor(data.overallPercentile) }}>P{data.overallPercentile}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
            {data.overallLabel}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' as const }}>
            {[
              { label: 'Days Active', value: `${data.raiseMetrics.totalDays}d` },
              { label: 'Total Investors', value: data.raiseMetrics.totalInvestors },
              { label: 'Meetings/wk', value: data.raiseMetrics.meetingsPerWeek },
              { label: 'Follow-up Rate', value: `${data.raiseMetrics.followupCompletionRate}%` },
              { label: 'Pipeline Coverage', value: `${data.raiseMetrics.pipelineCoverage}x` },
            ].map(m => (
              <div key={m.label}>
                <div style={labelStyle}>{m.label}</div>
                <div style={{ ...metricValStyle, fontSize: 'var(--font-size-lg)', marginTop: 'var(--space-1)' }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 'var(--space-5)' }}>
        {[
          { label: 'Meeting Velocity', val: `${r.meetingsPerWeek.value}/wk`, pct: r.meetingsPerWeek.percentile, vs: r.meetingsPerWeek.vs },
          { label: 'Follow-up Rate', val: `${r.followupRate.value}%`, pct: r.followupRate.percentile, vs: r.followupRate.vs },
          { label: 'Pipeline Coverage', val: `${r.pipelineCoverage.value}x`, pct: r.pipelineCoverage.percentile, vs: r.pipelineCoverage.vs },
          { label: 'Process Speed', val: `${r.totalProcessDays.value}d`, pct: r.totalProcessDays.percentile, vs: r.totalProcessDays.vs },
        ].map(m => (
          <div key={m.label} style={cardStyle}>
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
              <span style={labelStyle}>{m.label}</span>
              <PctBadge value={m.pct} />
            </div>
            <div style={{ ...metricValStyle, fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-2)' }}>{m.val}</div>
            <PercentileBar value={m.vs.p50 * (m.pct / 50)} benchP25={m.vs.p25} benchP50={m.vs.p50} benchP75={m.vs.p75} />
            <div className="flex justify-between" style={{ marginTop: 'var(--space-1)' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>P25</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>P50</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>P75</span>
            </div>
          </div>
        ))}
      </div>

      {/* Two columns: Conversion Funnel + Stage Time */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 'var(--space-5)' }}>
        {/* Conversion Rates */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
            Conversion Rates vs. Benchmark
          </h3>
          <div className="flex flex-col gap-3">
            {Object.entries(r.conversions).map(([key, d]) => (
              <div key={key}>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-1)' }}>
                  <span style={metricNameStyle}>{CONV_LABELS[key] || key}</span>
                  <div className="flex items-center gap-2">
                    <span style={metricValStyle}>{d.value}%</span>
                    <PctBadge value={d.percentile} />
                  </div>
                </div>
                <PercentileBar value={d.value} benchP25={d.vs.p25} benchP50={d.vs.p50} benchP75={d.vs.p75} />
              </div>
            ))}
          </div>
        </div>

        {/* Stage Time */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
            Avg. Days in Stage (lower is better)
          </h3>
          <div className="flex flex-col gap-3">
            {Object.entries(r.stageTime).map(([key, d]) => (
              <div key={key}>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-1)' }}>
                  <span style={metricNameStyle}>{STAGE_LABELS[key] || key}</span>
                  <div className="flex items-center gap-2">
                    <span style={metricValStyle}>{d.value}d</span>
                    <PctBadge value={d.percentile} />
                  </div>
                </div>
                <PercentileBar value={d.value} benchP25={d.vs.p25} benchP50={d.vs.p50} benchP75={d.vs.p75} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly Activity Trend */}
      <div style={{ ...cardStyle, marginBottom: 'var(--space-5)' }}>
        <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
          Weekly Activity Trend (last 8 weeks)
        </h3>
        <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'flex-end', height: '120px' }}>
          {data.weeklyTrend.map((w, i) => {
            const maxMeetings = Math.max(...data.weeklyTrend.map(t => t.meetings), 1);
            const barH = Math.max(4, (w.meetings / maxMeetings) * 100);
            const isThisWeek = i === data.weeklyTrend.length - 1;
            return (
              <div key={w.week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1)' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{w.meetings}</span>
                <div style={{
                  width: '100%', maxWidth: '40px', height: `${barH}%`, borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                  background: isThisWeek ? 'var(--accent)' : 'var(--surface-3)',
                  transition: 'height 0.3s ease',
                }} />
                <span style={{ fontSize: '10px', color: isThisWeek ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(w.week).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4" style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Benchmark median: {benchType === 'spaceDef' ? '4.0' : '5.5'} meetings/week
          </span>
        </div>
      </div>

      {/* Funnel Visualization */}
      <div style={{ ...cardStyle, marginBottom: 'var(--space-5)' }}>
        <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
          Pipeline Funnel
        </h3>
        <div className="flex flex-col gap-2">
          {[
            { label: 'Total Investors', count: data.funnel.total, color: 'var(--text-tertiary)' },
            { label: 'Contacted', count: data.funnel.contacted, color: 'var(--text-secondary)' },
            { label: 'Met', count: data.funnel.met, color: 'var(--text-secondary)' },
            { label: 'Engaged', count: data.funnel.engaged, color: 'var(--accent)' },
            { label: 'In DD', count: data.funnel.in_dd, color: 'var(--accent)' },
            { label: 'Term Sheet', count: data.funnel.term_sheet, color: 'var(--success)' },
            { label: 'Closed', count: data.funnel.closed, color: 'var(--success)' },
          ].map((step, i) => {
            const maxCount = Math.max(data.funnel.total, 1);
            const widthPct = Math.max(5, (step.count / maxCount) * 100);
            return (
              <div key={step.label} className="flex items-center gap-3">
                <span style={{ ...metricNameStyle, width: '100px', textAlign: 'right' }}>{step.label}</span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    height: '24px', borderRadius: 'var(--radius-sm)',
                    background: `color-mix(in srgb, ${step.color} 20%, transparent)`,
                    width: `${widthPct}%`, transition: 'width 0.5s ease',
                    display: 'flex', alignItems: 'center', paddingLeft: 'var(--space-2)',
                  }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: step.color }}>{step.count}</span>
                  </div>
                </div>
                {i > 0 && data.funnel.total > 0 && (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', width: '40px', textAlign: 'right' }}>
                    {Math.round((step.count / data.funnel.total) * 100)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights */}
      {data.insights.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
            Key Insights
          </h3>
          <div className="flex flex-col gap-3">
            {data.insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3" style={{
                padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                background: 'var(--surface-0)',
                border: `1px solid ${insight.type === 'weakness' ? 'var(--danger-muted)' : insight.type === 'strength' ? 'var(--success-muted)' : 'var(--warning-muted)'}`,
              }}>
                <InsightBadge type={insight.type} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                    {insight.metric}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                    {insight.detail}
                  </div>
                </div>
                <PctBadge value={insight.percentile} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 'var(--space-4)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textAlign: 'center' as const }}>
        Benchmarks based on Series C {benchType === 'spaceDef' ? 'space/defense' : 'general tech'} sector data (PitchBook, AngelList, Cambridge Associates).
        Percentiles are interpolated estimates.
      </div>
    </div>
  );
}

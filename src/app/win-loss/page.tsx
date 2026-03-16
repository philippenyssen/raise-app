'use client';

import { useEffect, useState } from 'react';
import { cachedFetch } from '@/lib/cache';
import {
  TrendingDown, TrendingUp, RefreshCw, Users, Target, AlertTriangle,
  CheckCircle, XCircle, ArrowDown, Clock, Lightbulb, BarChart3,
} from 'lucide-react';
import { labelMuted, stAccent, stFontSm, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary, strengthColor } from '@/lib/styles';
import { fmtDateTime } from '@/lib/format';

const textSmMuted = { fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' } as const;
const textSmTertiary = { fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' } as const;
const textSmPrimary400 = { fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 400 } as const;

// ── Types ─────────────────────────────────────────────────────────────

interface DistinguishingFactor {
  factor: string;
  closedAvg: number;
  passedAvg: number;
  delta: number;
  significance: 'high' | 'medium' | 'low';
}

interface Profile {
  avgScore: number;
  avgEnthusiasm: number;
  avgMeetings: number;
  avgDaysToClose?: number;
  avgDaysToPass?: number;
  commonTiers: string;
  commonTypes: string;
}

interface PassReason { reason: string; count: number; }

interface FunnelStage { stage: string; count: number; dropOff: number; }

interface TypePerf {
  type: string;
  total: number;
  closed: number;
  passed: number;
  dropped: number;
  closeRate: number;
  passRate: number;
}

interface Predictor { signal: string; description: string; strength: 'strong' | 'moderate' | 'weak'; }

interface WinLossData {
  patterns: {
    closedCount: number;
    passedCount: number;
    droppedCount: number;
    distinguishingFactors: DistinguishingFactor[];
    winnerProfile: Profile | null;
    loserProfile: Profile | null;
    insights: string[];
  };
  passReasons: PassReason[];
  timing: {
    avgDaysToClose: number;
    avgDaysToPass: number;
    medianDaysToClose: number;
    medianDaysToPass: number;
  };
  funnel: FunnelStage[];
  typePerformance: TypePerf[];
  predictors: Predictor[];
  recommendations: string[];
  summary: {
    totalInvestors: number;
    active: number;
    closed: number;
    passed: number;
    dropped: number;
    overallCloseRate: number;
    avgClosedMeetings: number;
    avgPassedMeetings: number;
    avgClosedEnthusiasm: number;
    avgPassedEnthusiasm: number;
  };
  generatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  vc: 'VC',
  growth: 'Growth',
  sovereign: 'SWF',
  strategic: 'Strategic',
  debt: 'Debt',
  family_office: 'Family Office',};

// ── Page ──────────────────────────────────────────────────────────────

export default function WinLossPage() {
  const [data, setData] = useState<WinLossData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    cachedFetch('/api/win-loss')
      .then(r => {
        if (!r.ok) throw new Error('Could not load win/loss data — refresh to retry');
        return r.json();})
      .then((d: WinLossData) => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  };

  useEffect(() => { document.title = 'Raise | Win/Loss Analysis'; }, []);
  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchData(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 page-content">
        <div className="skeleton" style={{ height: '28px', width: '220px' }} />
        <div className="skeleton" style={{ height: '16px', width: '350px' }} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-xl)' }} />)}
        </div>
        <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-xl)' }} />
      </div>);
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">Win/Loss Analysis</h1>
        <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
          <span style={stTextPrimary}>Failed to load: {error}</span>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <button onClick={fetchData} className="btn btn-secondary btn-sm">Retry</button></div></div>
      </div>);
  }

  if (!data) return null;

  const { patterns, passReasons, timing, funnel, typePerformance, predictors, recommendations, summary } = data;

  // Funnel max for width calculation
  const funnelMax = Math.max(...funnel.map(f => f.count), 1);

  return (
    <div className="page-content space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Win/Loss Analysis</h1>
          <p className="page-subtitle" style={stFontSm}>
            Patterns from closed and passed investors</p></div>
        <button onClick={fetchData} disabled={loading} className="btn btn-secondary btn-sm" style={{ gap: 'var(--space-2)', opacity: loading ? 0.6 : 1 }}>
          <RefreshCw className="w-3.5 h-3.5" />
          {loading ? 'Refreshing...' : 'Refresh'}</button></div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 card-stagger">
        {[
          { label: 'Total Pipeline', value: summary.totalInvestors, sub: `${summary.active} active`, variant: '' },
          { label: 'Closed', value: summary.closed, sub: `${summary.overallCloseRate}% rate` },
          { label: 'Passed', value: summary.passed, sub: null },
          { label: 'Dropped', value: summary.dropped, sub: null },
          { label: 'Avg Days to Close', value: timing.avgDaysToClose, sub: `Median: ${timing.medianDaysToClose}d`, variant: '' },
          { label: 'Best Type', value: (() => { const best = typePerformance.filter(t => t.total >= 2).sort((a, b) => b.closeRate - a.closeRate)[0]; return best ? (TYPE_LABELS[best.type] || best.type) : '—'; })(), sub: (() => { const best = typePerformance.filter(t => t.total >= 2).sort((a, b) => b.closeRate - a.closeRate)[0]; return best ? `${best.closeRate}% close rate` : null; })() },
        ].map(s => (
          <div
            key={s.label}
            className={`card-metric hover-border ${s.variant}`.trim()}
            style={{
              padding: 'var(--space-3)', }}>
            <div className="metric-label">{s.label}</div>
            <div className="metric-value" style={{ marginTop: '2px' }}>{s.value}</div>
            {s.sub && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>{s.sub}</div>
            )}</div>
        ))}</div>

      {/* Funnel Visualization */}
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-4)' }}>
          <span style={stAccent}><BarChart3 className="w-4 h-4" /></span>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 400, color: 'var(--text-primary)' }}>
            Conversion Funnel</h2></div>
        <div className="space-y-2">
          {funnel.map((stage, i) => {
            const pct = funnelMax > 0 ? (stage.count / funnelMax) * 100 : 0;
            const conversionPct = i > 0 && funnel[i - 1].count > 0
              ? Math.round((stage.count / funnel[i - 1].count) * 100)
              : 100;
            return (
              <div key={stage.stage}>
                <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 400, minWidth: '120px' }}>
                      {stage.stage}</span>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: 400 }}>
                      {stage.count}</span></div>
                  <div className="flex items-center gap-3">
                    {i > 0 && (
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: conversionPct >= 50 ? 'var(--success)' : conversionPct >= 25 ? 'var(--warning)' : 'var(--danger)',
                      }}>
                        {conversionPct}% from prev</span>
                    )}
                    {stage.dropOff > 0 && (
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>
                        {stage.dropOff}% drop-off</span>
                    )}</div></div>
                <div
                  style={{
                    height: '24px',
                    background: 'var(--surface-1)',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    position: 'relative', }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.max(pct, 2)}%`,
                      background: i === funnel.length - 1
                        ? 'var(--success)'
                        : `color-mix(in srgb, var(--accent) ${Math.round(40 + (60 * (funnel.length - i) / funnel.length))}%, transparent)`,
                      borderRadius: 'var(--radius-sm)',
                      transition: 'width 0.6s ease',
                    }} /></div>
                {i < funnel.length - 1 && (
                  <div className="flex justify-center" style={{ marginTop: '2px', marginBottom: '2px' }}>
                    <ArrowDown className="w-3 h-3" style={stTextMuted} /></div>
                )}
              </div>);
          })}</div></div>

      {/* Winner vs Loser Profile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Winner Profile */}
        <div
          className="card"
          style={{ padding: 'var(--space-4)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-3)' }}>
            <span style={stTextSecondary}><CheckCircle className="w-4 h-4" /></span>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 400, color: 'var(--text-primary)' }}>
              Winner Profile</h2>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {summary.closed} investors</span></div>
          {patterns.winnerProfile ? (
            <div className="space-y-2">
              {[
                { label: 'Avg Score', value: `${patterns.winnerProfile.avgScore}/100` },
                { label: 'Avg Enthusiasm', value: `${patterns.winnerProfile.avgEnthusiasm}/5` },
                { label: 'Avg Meetings', value: `${patterns.winnerProfile.avgMeetings}` },
                { label: 'Avg Days to Close', value: `${patterns.winnerProfile.avgDaysToClose}d` },
                { label: 'Common Tiers', value: patterns.winnerProfile.commonTiers },
                { label: 'Common Types', value: patterns.winnerProfile.commonTypes },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between" style={{ padding: 'var(--space-1) 0' }}>
                  <span style={textSmTertiary}>{row.label}</span>
                  <span style={textSmPrimary400}>{row.value}</span>
                </div>
              ))}</div>
          ) : (
            <p style={textSmMuted}>
              No closed deals yet. As investors reach term sheet or closed status, their profiles will appear here with performance insights.</p>
          )}</div>

        {/* Loser Profile */}
        <div
          className="card"
          style={{ padding: 'var(--space-4)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-3)' }}>
            <span style={stTextPrimary}><XCircle className="w-4 h-4" /></span>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 400, color: 'var(--text-primary)' }}>
              Passer Profile</h2>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {summary.passed} investors</span></div>
          {patterns.loserProfile ? (
            <div className="space-y-2">
              {[
                { label: 'Avg Score', value: `${patterns.loserProfile.avgScore}/100` },
                { label: 'Avg Enthusiasm', value: `${patterns.loserProfile.avgEnthusiasm}/5` },
                { label: 'Avg Meetings', value: `${patterns.loserProfile.avgMeetings}` },
                { label: 'Avg Days to Pass', value: `${patterns.loserProfile.avgDaysToPass}d` },
                { label: 'Common Tiers', value: patterns.loserProfile.commonTiers },
                { label: 'Common Types', value: patterns.loserProfile.commonTypes },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between" style={{ padding: 'var(--space-1) 0' }}>
                  <span style={textSmTertiary}>{row.label}</span>
                  <span style={textSmPrimary400}>{row.value}</span>
                </div>
              ))}</div>
          ) : (
            <p style={textSmMuted}>
              No rejections yet. When investors pass, their profile appears here to help identify patterns in what&apos;s not landing.</p>
          )}</div></div>

      {/* Pass Reasons + Key Predictors Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pass Reasons */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-3)' }}>
            <span style={stTextTertiary}><AlertTriangle className="w-4 h-4" /></span>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 400, color: 'var(--text-primary)' }}>
              Pass Reasons</h2></div>
          {passReasons.length > 0 ? (
            <div className="space-y-2">
              {passReasons.map((pr, i) => {
                const maxCount = passReasons[0]?.count || 1;
                const barPct = (pr.count / maxCount) * 100;
                return (
                  <div
                    key={pr.reason}
                    className="hover-surface-2"
                    style={{
                      padding: 'var(--space-2)',
                      borderRadius: 'var(--radius-sm)', }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
                        {pr.reason}</span>
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-secondary)',
                        fontWeight: 400,
                        fontVariantNumeric: 'tabular-nums',}}>
                        {pr.count}x</span></div>
                    <div style={{ height: '4px', background: 'var(--surface-1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barPct}%`, background: 'var(--danger)', borderRadius: '2px', opacity: 0.7 }} />
                    </div>
                  </div>);
              })}</div>
          ) : (
            <p style={textSmMuted}>
              No pass reasons recorded. When you mark an investor as &quot;Passed&quot; in their profile, add a reason — patterns will surface here.</p>
          )}</div>

        {/* Key Predictors */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-3)' }}>
            <span style={stAccent}><Target className="w-4 h-4" /></span>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 400, color: 'var(--text-primary)' }}>
              Key Predictors</h2></div>
          <div className="space-y-3">
            {predictors.map((p, i) => (
              <div
                key={p.signal}
                className="hover-surface-2"
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-1)', }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '2px' }}>
                  <span style={textSmPrimary400}>
                    {p.signal}</span>
                  <span style={{
                    fontSize: 'var(--font-size-xs)',
                    color: strengthColor(p.strength),
                    fontWeight: 400,
                    letterSpacing: '0.01em',}}>
                    {p.strength}</span></div>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', margin: 0 }}>
                  {p.description}</p></div>
            ))}</div></div></div>

      {/* Distinguishing Factors */}
      {patterns.distinguishingFactors.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-3)' }}>
            <span style={stAccent}><TrendingUp className="w-4 h-4" /></span>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 400, color: 'var(--text-primary)' }}>
              Distinguishing Factors</h2>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Winners vs Passers</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Factor', 'Winners Avg', 'Passers Avg', 'Delta', 'Significance'].map(h => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === 'Factor' ? 'left' : 'right',
                        padding: 'var(--space-2) var(--space-3)',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 400,
                        color: 'var(--text-muted)',
                        letterSpacing: '0.01em',
                        borderBottom: '1px solid var(--border-subtle)', }}>
                      {h}</th>
                  ))}</tr></thead>
              <tbody>
                {patterns.distinguishingFactors.map((f, i) => (
                  <tr
                    key={f.factor}
                    className="hover-row">
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 400, borderBottom: '1px solid var(--border-subtle)' }}>
                      {f.factor}</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--border-subtle)' }}>
                      {f.closedAvg}</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--border-subtle)' }}>
                      {f.passedAvg}</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-sm)', color: f.delta > 0 ? 'var(--success)' : f.delta < 0 ? 'var(--danger)' : 'var(--text-muted)', textAlign: 'right', fontWeight: 400, fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--border-subtle)' }}>
                      {f.delta > 0 ? '+' : ''}{f.delta}</td>
                    <td style={{ padding: 'var(--space-2) var(--space-3)', textAlign: 'right', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 400,
                        color: strengthColor(f.significance),
                        letterSpacing: '0.01em',}}>
                        {f.significance}</span></td></tr>
                ))}</tbody></table></div></div>
      )}

      {/* Time Analysis + Investor Type Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Time Analysis */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-3)' }}>
            <span style={stAccent}><Clock className="w-4 h-4" /></span>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 400, color: 'var(--text-primary)' }}>
              Time Analysis</h2></div>
          <div className="space-y-3">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--surface-1)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Avg Days to Close</div>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-secondary)' }}>
                  {timing.avgDaysToClose}</div>
                <div style={labelMuted}>
                  Median: {timing.medianDaysToClose}d</div></div>
              <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--surface-1)', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Avg Days to Pass</div>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)' }}>
                  {timing.avgDaysToPass}</div>
                <div style={labelMuted}>
                  Median: {timing.medianDaysToPass}d</div></div></div>
            <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--surface-1)' }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  Avg Meetings (Winners)</span>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: 400 }}>
                  {summary.avgClosedMeetings}</span></div>
              <div className="flex items-center justify-between" style={{ marginTop: 'var(--space-1)' }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  Avg Meetings (Passers)</span>
                <span style={textSmPrimary400}>
                  {summary.avgPassedMeetings}</span></div>
              <div className="flex items-center justify-between" style={{ marginTop: 'var(--space-1)' }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  Avg Enthusiasm (Winners)</span>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: 400 }}>
                  {summary.avgClosedEnthusiasm}/5</span></div>
              <div className="flex items-center justify-between" style={{ marginTop: 'var(--space-1)' }}>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  Avg Enthusiasm (Passers)</span>
                <span style={textSmPrimary400}>
                  {summary.avgPassedEnthusiasm}/5</span></div></div></div></div>

        {/* Investor Type Performance */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-3)' }}>
            <span style={stAccent}><Users className="w-4 h-4" /></span>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 400, color: 'var(--text-primary)' }}>
              Performance by Type</h2></div>
          {typePerformance.length > 0 ? (
            <div className="space-y-2">
              {typePerformance.map((tp, i) => (
                <div
                  key={tp.type}
                  className="hover-surface-2"
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-1)', }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                    <span style={textSmPrimary400}>
                      {TYPE_LABELS[tp.type] || tp.type}</span>
                    <span style={labelMuted}>
                      {tp.total} total</span></div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <span style={stTextSecondary}><TrendingUp className="w-3 h-3" /></span>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 400 }}>
                        {tp.closeRate}% close</span></div>
                    <div className="flex items-center gap-1">
                      <span style={stTextPrimary}><TrendingDown className="w-3 h-3" /></span>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', fontWeight: 400 }}>
                        {tp.passRate}% pass</span></div>
                    <span style={labelMuted}>
                      {tp.closed}W / {tp.passed}L / {tp.dropped}D</span></div></div>
              ))}</div>
          ) : (
            <p style={textSmMuted}>
              No type data yet. Assign investor types (VC, Growth, SWF, etc.) in investor profiles to unlock performance analysis by type.</p>
          )}</div></div>

      {/* Insights + Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Insights from patterns */}
        {patterns.insights.length > 0 && (
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-3)' }}>
              <span style={stAccent}><TrendingDown className="w-4 h-4" /></span>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 400, color: 'var(--text-primary)' }}>
                Pattern Insights</h2></div>
            <div className="space-y-2">
              {patterns.insights.map((insight, i) => (
                <div
                  key={i}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-1)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-secondary)', }}>
                  {insight}</div>
              ))}</div></div>
        )}

        {/* Recommendations */}
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-3)' }}>
            <span style={stTextTertiary}><Lightbulb className="w-4 h-4" /></span>
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 400, color: 'var(--text-primary)' }}>
              Recommendations</h2></div>
          {recommendations.length > 0 ? (
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="hover-surface-2"
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-1)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--text-secondary)', }}>
                  {rec}</div>
              ))}</div>
          ) : (
            <p style={textSmMuted}>
              Recommendations will appear as more outcomes are recorded</p>
          )}</div></div>

      {/* Footer */}
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textAlign: 'right', paddingTop: 'var(--space-2)' }}>
        Generated {data.generatedAt ? fmtDateTime(data.generatedAt) : '-'}</div>
    </div>);
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Clock, CheckCircle2, XCircle, AlertTriangle,
  TrendingUp, Users, ArrowRight, Zap, Phone, Mail, Target,
} from 'lucide-react';
import { STATUS_LABELS, TYPE_LABELS } from '@/lib/constants';
import { labelMuted, labelSecondary, stTextTertiary, trackingBg, trackingColor, velocityColor } from '@/lib/styles';

interface VelocityInvestor { investor_id: string; investor_name: string; investor_type: string; investor_tier: number; status: string; enthusiasm: number; days_in_process: number; days_in_current_stage: number; projected_close_date: string; days_to_target: number; on_track: boolean; tracking_status: 'on_track' | 'behind' | 'at_risk'; bottleneck: string; velocity_score: number; meeting_count: number; meetings_per_week: number; days_since_last_meeting: number }
interface VelocitySummary { total_active: number; on_track: number; behind: number; at_risk: number; avg_velocity_score: number; avg_days_in_process: number; raise_days_elapsed: number; raise_target_days: number }
interface VelocityData { investors: VelocityInvestor[]; summary: VelocitySummary; generated_at: string }

const STATUS_COLORS: Record<string, string> = {
  contacted: 'var(--text-tertiary)',
  nda_signed: 'var(--text-tertiary)',
  meeting_scheduled: 'var(--text-secondary)',
  met: 'var(--text-secondary)',
  engaged: 'var(--text-primary)',
  in_dd: 'var(--text-primary)',
  term_sheet: 'var(--accent)',
  closed: 'var(--accent)',};

export default function VelocityPage() {
  const [data, setData] = useState<VelocityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  function fetchVelocity() {
    setLoading(true);
    setError(null);
    fetch('/api/velocity')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch velocity data');
        return res.json();})
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { document.title = 'Raise | Close in 60'; }, []);
  useEffect(() => { fetchVelocity(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchVelocity(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 p-6 page-content" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-8)' }}>
          <div className="skeleton" style={{ width: '200px', height: '32px' }} /></div>
        <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 'var(--space-6)' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card skeleton" style={{ height: '100px' }} />
          ))}</div>
        <div className="card skeleton" style={{ height: '400px' }} />
      </div>);
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6 page-content" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <AlertTriangle className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}>
            {error || 'Failed to load velocity data'}</p>
          <button onClick={fetchVelocity} className="btn btn-secondary btn-sm" title="Retry loading velocity data">Retry</button></div>
      </div>);
  }

  const { investors, summary } = data;
  const raiseProgress = Math.min(100, Math.round((summary.raise_days_elapsed / summary.raise_target_days) * 100));

  return (
    <div className="page-content flex-1 p-6" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 className="page-title">Close in 60</h1>
          <p className="page-subtitle">
            {summary.total_active} active deal{summary.total_active !== 1 ? 's' : ''} &middot; {summary.avg_days_in_process}d avg time in process
          </p></div></div>

      {/* Raise Progress Bar */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4) var(--space-5)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
          <div className="flex items-center gap-2">
            <span style={stTextTertiary}>
              <Clock className="w-4 h-4" /></span>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
              Raise Timeline</span></div>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>
            Day {summary.raise_days_elapsed} of {summary.raise_target_days}</span></div>
        <div className="progress-track" style={{ height: '8px', borderRadius: '4px' }}>
          <div
            className="progress-fill"
            style={{
              width: `${raiseProgress}%`,
              background: 'var(--accent)',
              borderRadius: '4px',
            }} /></div>
        <div className="flex items-center justify-between" style={{ marginTop: 'var(--space-1)' }}>
          <span style={labelMuted}>
            Launch</span>
          <span style={labelMuted}>
            {raiseProgress}% elapsed &middot; {Math.max(0, summary.raise_target_days - summary.raise_days_elapsed)}d remaining
          </span>
          <span style={labelMuted}>
            Target Close</span></div></div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 card-stagger" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="grid grid-cols-2 gap-4">
          {/* On Track */}
          <div className="card-metric" style={{ padding: 'var(--space-4)' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-2)' }}>
              <span style={stTextTertiary}>
                <CheckCircle2 className="w-4 h-4" /></span>
              <span className="metric-label">On Track</span></div>
            <div className="metric-value">
              {summary.on_track}</div></div>

          {/* Behind */}
          <div className="card-metric" style={{ padding: 'var(--space-4)' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-2)' }}>
              <span style={stTextTertiary}>
                <AlertTriangle className="w-4 h-4" /></span>
              <span className="metric-label">Behind</span></div>
            <div className="metric-value">
              {summary.behind}</div></div></div>

        <div className="grid grid-cols-2 gap-4">
          {/* At Risk */}
          <div className="card-metric" style={{ padding: 'var(--space-4)', ...(summary.at_risk > 0 && summary.at_risk / Math.max(1, summary.on_track + summary.behind + summary.at_risk) > 0.4 ? { border: '1px solid var(--danger)', background: 'var(--danger-muted)' } : {}) }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-2)' }}>
              <span style={stTextTertiary}>
                <XCircle className="w-4 h-4" /></span>
              <span className="metric-label">At Risk</span></div>
            <div className="metric-value">
              {summary.at_risk}</div>
            {summary.at_risk > 0 && summary.at_risk / Math.max(1, summary.on_track + summary.behind + summary.at_risk) > 0.4 && (
              <div className="text-xs mt-1" style={{ color: 'var(--danger)' }}>
                {Math.round(summary.at_risk / (summary.on_track + summary.behind + summary.at_risk) * 100)}% of pipeline at risk</div>
            )}</div>

          {/* Avg Velocity */}
          <div className="card-metric" style={{ padding: 'var(--space-4)' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-2)' }}>
              <span style={stTextTertiary}>
                <TrendingUp className="w-4 h-4" /></span>
              <span className="metric-label">Avg Velocity</span></div>
            <div className="metric-value">
              {summary.avg_velocity_score}</div></div></div></div>

      {/* Investor Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <span style={stTextTertiary}>
              <Users className="w-4 h-4" /></span>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>
              Deal Velocity Tracker</span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              Sorted by urgency</span></div></div>

        {investors.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
              No active investors in pipeline. Add investors to track velocity.</span></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="table-header">
                  <th style={{ minWidth: '180px' }}>Investor</th>
                  <th style={{ minWidth: '100px' }}>Stage</th>
                  <th style={{ minWidth: '80px', textAlign: 'center' }}>Days In</th>
                  <th style={{ minWidth: '80px', textAlign: 'center' }}>In Stage</th>
                  <th style={{ minWidth: '100px', textAlign: 'center' }}>Proj. Close</th>
                  <th style={{ minWidth: '70px', textAlign: 'center' }}>Status</th>
                  <th style={{ minWidth: '200px' }}>Bottleneck</th>
                  <th style={{ minWidth: '120px' }}>Velocity</th>
                  <th style={{ minWidth: '90px', textAlign: 'center' }}>Action</th></tr></thead>
              <tbody>
                {investors.map((inv) => (
                  <tr
                    key={inv.investor_id}
                    className="table-row transition-colors"
                    style={{
                      background: hoveredRow === inv.investor_id ? 'var(--surface-1)' : 'transparent',
                      cursor: 'pointer', }}
                    onMouseEnter={() => setHoveredRow(inv.investor_id)}
                    onMouseLeave={() => setHoveredRow(null)}>
                    {/* Investor Name */}
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <Link
                        href={`/investors/${inv.investor_id}`}
                        style={{ textDecoration: 'none' }}>
                        <div className="flex items-center gap-2">
                          <span
                            className="tier-badge"
                            style={{ ...(inv.investor_tier <= 2 ? { background: 'var(--accent)', color: 'var(--text-primary)' } : { background: 'var(--surface-3)', color: 'var(--text-secondary)' }), width: '20px', height: '20px', fontSize: 'var(--font-size-xs)', flexShrink: 0 }}>
                            {inv.investor_tier}</span>
                          <div>
                            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>
                              {inv.investor_name}</div>
                            <div style={labelMuted}>
                              {TYPE_LABELS[inv.investor_type] || inv.investor_type}</div></div></div></Link></td>

                    {/* Stage */}
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <div className="flex items-center gap-2">
                        <div
                          className="status-dot"
                          style={{
                            background: STATUS_COLORS[inv.status] || 'var(--text-muted)',
                            boxShadow: `0 0 6px ${STATUS_COLORS[inv.status] || 'var(--text-muted)'}40`,
                          }} />
                        <span style={labelSecondary}>
                          {STATUS_LABELS[inv.status] || inv.status}</span></div></td>

                    {/* Days in Process */}
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                      <span
                        style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, fontVariantNumeric: 'tabular-nums', color: inv.days_in_process > 50 ? 'var(--danger)' : inv.days_in_process > 35 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                        {inv.days_in_process}d</span></td>

                    {/* Days in Stage */}
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                      <span
                        style={{ fontSize: 'var(--font-size-sm)', fontVariantNumeric: 'tabular-nums', color: inv.days_in_current_stage > 21 ? 'var(--danger)' : inv.days_in_current_stage > 14 ? 'var(--warning)' : 'var(--text-tertiary)' }}>
                        {inv.days_in_current_stage}d</span></td>

                    {/* Projected Close */}
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(inv.projected_close_date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}</span></td>

                    {/* On-Track Status */}
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                      <span
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 400, background: trackingBg(inv.tracking_status), color: trackingColor(inv.tracking_status) }}>
                        {inv.tracking_status === 'on_track' ? (
                          <><CheckCircle2 className="w-3 h-3" style={{ marginRight: '4px' }} /> On</>
                        ) : inv.tracking_status === 'behind' ? (
                          <><AlertTriangle className="w-3 h-3" style={{ marginRight: '4px' }} /> Late</>
                        ) : (
                          <><XCircle className="w-3 h-3" style={{ marginRight: '4px' }} /> Risk</>
                        )}</span></td>

                    {/* Bottleneck */}
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <span
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: inv.bottleneck === 'On pace' ? 'var(--text-muted)' : 'var(--warning)',
                          lineHeight: 1.4, }}>
                        {inv.bottleneck}</span></td>

                    {/* Velocity Score Bar */}
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <div className="flex items-center gap-2">
                        <div style={{ flex: 1, height: '6px', background: 'var(--surface-3)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${inv.velocity_score}%`, height: '100%', background: velocityColor(inv.velocity_score), borderRadius: '3px', transition: 'width 500ms ease' }} />
                        </div>
                        <span
                          style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, fontVariantNumeric: 'tabular-nums', color: velocityColor(inv.velocity_score), minWidth: '28px', textAlign: 'right' }}>
                          {inv.velocity_score}</span></div></td>

                    {/* Action */}
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                      {inv.tracking_status === 'at_risk' ? (
                        <Link
                          href={`/meetings/new?investor=${inv.investor_id}`}
                          className="btn btn-sm"
                          onClick={e => e.stopPropagation()}
                          style={{ background: 'var(--danger-muted)', color: 'var(--text-primary)', border: '1px solid var(--fg-6)', fontSize: 'var(--font-size-xs)', padding: '3px 8px', gap: 'var(--space-1)', display: 'inline-flex', alignItems: 'center' }}>
                          <Phone className="w-3 h-3" /> Rescue</Link>
                      ) : inv.tracking_status === 'behind' ? (
                        <Link
                          href={`/followups?investor=${inv.investor_id}`}
                          className="btn btn-sm"
                          onClick={e => e.stopPropagation()}
                          style={{ background: 'var(--warning-muted)', color: 'var(--text-tertiary)', border: '1px solid var(--fg-5)', fontSize: 'var(--font-size-xs)', padding: '3px 8px', gap: 'var(--space-1)', display: 'inline-flex', alignItems: 'center' }}>
                          <Mail className="w-3 h-3" /> Nudge</Link>
                      ) : (
                        <Link
                          href={`/investors/${inv.investor_id}`}
                          className="btn btn-sm"
                          onClick={e => e.stopPropagation()}
                          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', padding: '3px 8px', gap: 'var(--space-1)', display: 'inline-flex', alignItems: 'center' }}>
                          <Target className="w-3 h-3" /> View</Link>
                      )}</td></tr>
                ))}</tbody></table></div>
        )}</div>

      {/* Footer hint */}
      <div
        className="flex items-center justify-center gap-2"
        style={{ marginTop: 'var(--space-6)', padding: 'var(--space-3)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
        <span style={stTextTertiary}>
          <Zap className="w-3 h-3" /></span>
        Velocity scores update in real-time based on meetings, follow-ups, and stage progression
        <span style={{ margin: '0 var(--space-2)', color: 'var(--border-default)' }}>|</span>
        <Link
          href="/pipeline"
          className="flex items-center gap-1"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          View Pipeline
          <ArrowRight className="w-3 h-3" /></Link></div>
    </div>);
}

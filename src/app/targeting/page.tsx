'use client';

import { useEffect, useState } from 'react';
import { cachedFetch } from '@/lib/cache';
import Link from 'next/link';
import {
  Crosshair, Target, TrendingUp, Clock, DollarSign,
  Users, ChevronRight, AlertTriangle, Zap, RefreshCcw,
} from 'lucide-react';
import { STATUS_LABELS } from '@/lib/constants';

/* ── styles ── */
const headerStyle: React.CSSProperties = { fontSize: 'var(--font-size-2xl)', fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '-0.02em' };
const subtitleStyle: React.CSSProperties = { fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)', fontWeight: 300, marginTop: 'var(--space-1)' };
const cardStyle: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)' };
const labelStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', fontWeight: 300, textTransform: 'uppercase' as const, letterSpacing: '0.05em' };
const metricValStyle: React.CSSProperties = { fontSize: 'var(--font-size-xl)', fontWeight: 300, fontVariantNumeric: 'tabular-nums' };
const nameStyle: React.CSSProperties = { fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' };
const detailStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' };
const tierColors: Record<number, string> = { 1: 'var(--accent)', 2: 'var(--text-secondary)', 3: 'var(--text-tertiary)' };
const probColor = (p: number) => p >= 0.5 ? 'var(--success)' : p >= 0.25 ? 'var(--warning)' : 'var(--text-muted)';

interface Summary { targetEquityM: number; closedCapital: number; remainingTarget: number; totalExpectedValue: number; coverageRatio: number; activeCount: number; highProbCount: number; avgDaysToClose: number; }
interface MatrixPoint { id: string; name: string; tier: number; status: string; x: number; y: number; size: number; color: number; enthusiasm: number; score: number; }
interface SeqInvestor { id: string; name: string; tier: number; status: string; checkSize: { mid: number }; daysToClose: number; probability: number; expectedValue: number; cumulativeCapital: number; order: number; score: number; }
interface FomoGroup { tier: number; investors: { name: string; id: string; status: string; checkSize: number; daysToClose: number }[]; tactic: string; }
interface Derisking { id: string; name: string; status: string; tier: number; nextSteps: string[]; }
interface TargetingData { summary: Summary; matrix: MatrixPoint[]; sequence: SeqInvestor[]; fomoGroups: FomoGroup[]; derisking: Derisking[]; generatedAt: string; }

function TierBadge({ tier }: { tier: number }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '20px', height: '20px', borderRadius: 'var(--radius-full)',
      fontSize: '10px', fontWeight: 400,
      background: tier === 1 ? 'var(--accent)' : 'var(--surface-3)',
      color: tier === 1 ? 'var(--surface-0)' : 'var(--text-secondary)',
    }}>
      T{tier}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    identified: { bg: 'var(--surface-3)', color: 'var(--text-muted)' },
    contacted: { bg: 'var(--surface-3)', color: 'var(--text-tertiary)' },
    nda_signed: { bg: 'var(--surface-3)', color: 'var(--text-secondary)' },
    meeting_scheduled: { bg: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--text-secondary)' },
    met: { bg: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--text-secondary)' },
    engaged: { bg: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' },
    in_dd: { bg: 'color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--accent)' },
    term_sheet: { bg: 'var(--success-muted)', color: 'var(--success)' },
  };
  const c = colors[status] || colors.identified;
  return (
    <span style={{
      display: 'inline-block', padding: 'var(--space-0) var(--space-2)',
      borderRadius: 'var(--radius-full)', fontSize: '10px', fontWeight: 400,
      background: c.bg, color: c.color,
    }}>
      {(STATUS_LABELS as Record<string, string>)[status] || status}
    </span>
  );
}

export default function TargetingPage() {
  const [data, setData] = useState<TargetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredBubble, setHoveredBubble] = useState<string | null>(null);

  function fetchData() {
    setLoading(true);
    setError(null);
    cachedFetch('/api/targeting', { ttl: 60000 })
      .then(res => { if (!res.ok) throw new Error('Failed to load targeting data'); return res.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { document.title = 'Raise | Investor Targeting'; fetchData(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: '60vh' }}>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>Computing targeting priorities...</div>
    </div>
  );

  if (error || !data) return (
    <div className="flex items-center justify-center" style={{ height: '60vh' }}>
      <div style={{ color: 'var(--danger)', fontSize: 'var(--font-size-sm)' }}>{error || 'Targeting data unavailable — try refreshing the page'}</div>
    </div>
  );

  const s = data.summary;
  const capitalPct = Math.min(100, Math.round((s.closedCapital / s.targetEquityM) * 100));

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <div className="flex items-center gap-3">
            <span style={{ color: 'var(--text-tertiary)' }}><Crosshair size={22} /></span>
            <h1 style={headerStyle}>Investor Targeting</h1>
          </div>
          <p style={subtitleStyle}>Optimal closing sequence to reach your capital target</p>
        </div>
        <button onClick={fetchData} style={{
          background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
          padding: 'var(--space-2)', cursor: 'pointer', color: 'var(--text-tertiary)',
        }}>
          <RefreshCcw size={14} />
        </button>
      </div>

      {/* Capital Progress */}
      <div style={{ ...cardStyle, marginBottom: 'var(--space-5)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
          <span style={labelStyle}>Capital Progress</span>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
            {s.closedCapital > 0 ? `€${s.closedCapital}M` : '€0'} / €{s.targetEquityM}M
          </span>
        </div>
        <div style={{ height: '12px', background: 'var(--surface-3)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', position: 'relative' as const }}>
          {/* Closed */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${capitalPct}%`, background: 'var(--success)',
            borderRadius: 'var(--radius-sm)', transition: 'width 0.5s ease',
          }} />
          {/* Expected value overlay */}
          <div style={{
            position: 'absolute', left: `${capitalPct}%`, top: 0, bottom: 0,
            width: `${Math.min(100 - capitalPct, (s.totalExpectedValue / s.targetEquityM) * 100)}%`,
            background: 'color-mix(in srgb, var(--accent) 30%, transparent)',
            transition: 'width 0.5s ease',
          }} />
        </div>
        <div className="flex items-center justify-between" style={{ marginTop: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {capitalPct}% closed{s.totalExpectedValue > 0 ? ` · €${s.totalExpectedValue}M expected value in pipeline` : ''}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: s.coverageRatio >= 2 ? 'var(--success)' : 'var(--warning)' }}>
            {s.coverageRatio}x pipeline coverage
          </span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: 'var(--space-5)' }}>
        {[
          { icon: Users, label: 'Active Investors', value: s.activeCount },
          { icon: Target, label: 'High Probability', value: s.highProbCount, sub: '≥40% close rate' },
          { icon: Clock, label: 'Avg. Days to Close', value: `${s.avgDaysToClose}d` },
          { icon: DollarSign, label: 'Remaining Target', value: `€${s.remainingTarget}M` },
        ].map(m => (
          <div key={m.label} style={cardStyle}>
            <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-2)' }}>
              <span style={{ color: 'var(--text-muted)' }}><m.icon size={14} /></span>
              <span style={labelStyle}>{m.label}</span>
            </div>
            <div style={metricValStyle}>{m.value}</div>
            {m.sub && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>{m.sub}</div>}
          </div>
        ))}
      </div>

      {/* Bubble Chart: Days to Close × Check Size */}
      <div style={{ ...cardStyle, marginBottom: 'var(--space-5)' }}>
        <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
          Targeting Matrix
        </h3>
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
          X = days to close (left = faster) · Y = check size · Bubble = probability · Color = tier
        </p>
        <div style={{ position: 'relative' as const, height: '280px', borderLeft: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
          {/* Y-axis label */}
          <span style={{ position: 'absolute', left: '-30px', top: '50%', transform: 'rotate(-90deg)', fontSize: '10px', color: 'var(--text-muted)' }}>Check Size (€M)</span>
          {/* X-axis label */}
          <span style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', fontSize: '10px', color: 'var(--text-muted)' }}>Days to Close →</span>

          {data.matrix.map(point => {
            const maxDays = Math.max(...data.matrix.map(p => p.x), 100);
            const maxCheck = Math.max(...data.matrix.map(p => p.y), 100);
            const xPct = (point.x / maxDays) * 90 + 5;
            const yPct = 95 - (point.y / maxCheck) * 85;
            const bubbleSize = 10 + point.size * 30;
            const isHovered = hoveredBubble === point.id;

            return (
              <Link key={point.id} href={`/investors/${point.id}`} style={{ textDecoration: 'none' }}>
                <div
                  onMouseEnter={() => setHoveredBubble(point.id)}
                  onMouseLeave={() => setHoveredBubble(null)}
                  style={{
                    position: 'absolute',
                    left: `${xPct}%`, top: `${yPct}%`,
                    width: `${bubbleSize}px`, height: `${bubbleSize}px`,
                    borderRadius: '50%',
                    background: `color-mix(in srgb, ${tierColors[point.color] || 'var(--text-muted)'} ${isHovered ? '50%' : '30%'}, transparent)`,
                    border: `2px solid ${tierColors[point.color] || 'var(--text-muted)'}`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    zIndex: isHovered ? 10 : 1,
                  }}
                >
                  {isHovered && (
                    <div style={{
                      position: 'absolute', bottom: `${bubbleSize + 4}px`, left: '50%', transform: 'translateX(-50%)',
                      background: 'var(--surface-1)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-2) var(--space-3)', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-md)', zIndex: 20,
                    }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-primary)' }}>{point.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                        €{point.y}M · {point.x}d · {Math.round(point.size * 100)}% prob
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Optimal Closing Sequence */}
      <div style={{ ...cardStyle, marginBottom: 'var(--space-5)' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-4)' }}>
          <span style={{ color: 'var(--accent)' }}><TrendingUp size={16} /></span>
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>Optimal Closing Sequence</h3>
        </div>
        <div style={{ overflowX: 'auto' as const }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                {['#', 'Investor', 'Stage', 'Check', 'Days', 'Prob.', 'Cumulative', 'Score'].map(h => (
                  <th key={h} style={{ ...labelStyle, padding: 'var(--space-2) var(--space-3)', textAlign: h === '#' ? 'center' : 'left' as const, fontWeight: 300 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.sequence.map(inv => {
                const reachedTarget = inv.cumulativeCapital >= s.targetEquityM;
                return (
                  <tr key={inv.id} style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    background: reachedTarget ? 'color-mix(in srgb, var(--success) 5%, transparent)' : 'transparent',
                  }}>
                    <td style={{ padding: 'var(--space-3)', textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      {inv.order}
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <Link href={`/investors/${inv.id}`} style={{ textDecoration: 'none' }}>
                        <div className="flex items-center gap-2">
                          <TierBadge tier={inv.tier} />
                          <span style={nameStyle}>{inv.name}</span>
                        </div>
                      </Link>
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}><StatusBadge status={inv.status} /></td>
                    <td style={{ padding: 'var(--space-3)', ...detailStyle, fontVariantNumeric: 'tabular-nums' }}>€{inv.checkSize.mid}M</td>
                    <td style={{ padding: 'var(--space-3)', ...detailStyle, fontVariantNumeric: 'tabular-nums' }}>{inv.daysToClose}d</td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: probColor(inv.probability), fontVariantNumeric: 'tabular-nums' }}>
                        {Math.round(inv.probability * 100)}%
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <div className="flex items-center gap-2">
                        <div style={{ flex: 1, height: '4px', background: 'var(--surface-3)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxWidth: '80px' }}>
                          <div style={{
                            height: '100%', borderRadius: 'var(--radius-sm)', transition: 'width 0.3s ease',
                            width: `${Math.min(100, (inv.cumulativeCapital / s.targetEquityM) * 100)}%`,
                            background: reachedTarget ? 'var(--success)' : 'var(--accent)',
                          }} />
                        </div>
                        <span style={{ fontSize: 'var(--font-size-xs)', fontVariantNumeric: 'tabular-nums', color: reachedTarget ? 'var(--success)' : 'var(--text-secondary)' }}>
                          €{inv.cumulativeCapital}M
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-3)', fontSize: 'var(--font-size-xs)', fontVariantNumeric: 'tabular-nums', color: inv.score >= 0.5 ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                      {(inv.score * 100).toFixed(0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two columns: FOMO + De-risking */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 'var(--space-5)' }}>
        {/* FOMO Activation */}
        <div style={cardStyle}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-4)' }}>
            <span style={{ color: 'var(--warning)' }}><Zap size={16} /></span>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>FOMO Activation</h3>
          </div>
          {data.fomoGroups.length === 0 ? (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              No investors at engaged+ stage yet for FOMO tactics. Advance investors past the meeting stage first.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {data.fomoGroups.map(g => (
                <div key={g.tier} style={{ padding: 'var(--space-3)', background: 'var(--surface-0)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-2)' }}>
                    <TierBadge tier={g.tier} />
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                      Tier {g.tier} Pressure Group ({g.investors.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2" style={{ marginBottom: 'var(--space-2)' }}>
                    {g.investors.map(inv => (
                      <Link key={inv.id} href={`/investors/${inv.id}`} style={{ textDecoration: 'none' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)',
                          padding: 'var(--space-0) var(--space-2)', borderRadius: 'var(--radius-full)',
                          fontSize: '10px', fontWeight: 400, background: 'var(--surface-2)', color: 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}>
                          {inv.name}
                          <span style={{ color: 'var(--text-muted)' }}>€{inv.checkSize}M</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.4, margin: 0 }}>{g.tactic}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* De-risking Next Steps */}
        <div style={cardStyle}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-4)' }}>
            <span style={{ color: 'var(--accent)' }}><ChevronRight size={16} /></span>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>De-Risking Playbook</h3>
          </div>
          <div className="flex flex-col gap-3">
            {data.derisking.slice(0, 8).map(inv => (
              <div key={inv.id} style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--surface-0)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-1)' }}>
                  <TierBadge tier={inv.tier} />
                  <Link href={`/investors/${inv.id}`} style={{ textDecoration: 'none' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-primary)' }}>{inv.name}</span>
                  </Link>
                  <StatusBadge status={inv.status} />
                </div>
                <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', listStyle: 'none' }}>
                  {inv.nextSteps.slice(0, 2).map((step, i) => (
                    <li key={i} style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: 1.6, position: 'relative' as const }}>
                      <span style={{ position: 'absolute', left: '-12px', color: 'var(--text-muted)' }}>·</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

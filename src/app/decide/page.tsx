'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Target, ArrowRight, Clock, AlertTriangle, TrendingUp, Copy, Check, RefreshCw, Zap, Users } from 'lucide-react';
import { cachedFetch, invalidateCache } from '@/lib/cache';

const STATUS_LABELS: Record<string, string> = {
  contacted: 'Contacted', nda_signed: 'NDA Signed', meeting_scheduled: 'Meeting Scheduled',
  met: 'Met', engaged: 'Engaged', in_dd: 'In DD', term_sheet: 'Term Sheet',
};

interface Signal { label: string; type: 'positive' | 'warning' | 'neutral' }
interface FocusInvestor {
  id: string; name: string; type: string; tier: number; status: string;
  focusScore: number; signals: Signal[]; action: string; actionRationale: string;
  daysSinceContact: number | null; enthusiasm: number; meetingCount: number;
  pendingFollowups: number; pendingTasks: number;
}

interface DecideData {
  focusRanking: FocusInvestor[];
  narrative: string;
  stats: { totalActive: number; inDD: number; termSheets: number; engaged: number; atRisk: number; totalPipeline: number };
  generatedAt: string;
}

const textPrimary: React.CSSProperties = { color: 'var(--text-primary)' };
const textSecondary: React.CSSProperties = { color: 'var(--text-secondary)' };
const textMuted: React.CSSProperties = { color: 'var(--text-muted)' };

export default function DecidePage() {
  const [data, setData] = useState<DecideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      invalidateCache('/api/decide');
      const res = await cachedFetch('/api/decide');
      if (res.ok) setData(await res.json());
    } catch (e) { console.error('[DECIDE]', e instanceof Error ? e.message : e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { document.title = 'Raise | Focus'; }, []);

  function copyNarrative() {
    if (!data) return;
    navigator.clipboard.writeText(data.narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return `${Math.floor(diff / 3600_000)}h ago`;
  }

  if (loading) {
    return (
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className="skeleton" style={{ height: '32px', width: '200px' }} />
        <div className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-lg)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-lg)' }} />)}
        </div>
        {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-lg)' }} />)}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-content text-center py-16">
        <Target className="w-8 h-8 mx-auto mb-2" style={textMuted} />
        <p style={textSecondary}>Could not load focus ranking.</p>
        <button onClick={fetchData} className="btn btn-primary btn-sm" style={{ marginTop: 'var(--space-3)' }}>Retry</button>
      </div>
    );
  }

  const { focusRanking, narrative, stats, generatedAt } = data;

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Focus</h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
            Where to spend your time to move the raise forward
            {generatedAt && <> &middot; <span>{relativeTime(generatedAt)}</span></>}
          </p>
        </div>
        <button onClick={fetchData} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      {/* 60-Second Narrative */}
      <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', border: '1px solid var(--border-subtle)', position: 'relative' }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ color: 'var(--accent)' }}><Zap className="w-4 h-4" /></span>
          <h2 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, ...textPrimary }}>Raise in 60 seconds</h2>
          <button
            onClick={copyNarrative}
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--font-size-xs)' }}>
            {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
          </button>
        </div>
        <p style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.6, ...textSecondary }}>{narrative}</p>
      </div>

      {/* Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-3)' }}>
        {[
          { label: 'Active Pipeline', value: stats.totalActive, icon: Users },
          { label: 'In Due Diligence', value: stats.inDD, icon: Target },
          { label: 'Term Sheets', value: stats.termSheets, icon: TrendingUp },
          { label: 'At Risk', value: stats.atRisk, icon: AlertTriangle, warn: stats.atRisk > 0 },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
            border: `1px solid ${s.warn ? 'var(--warning)' : 'var(--border-subtle)'}`, textAlign: 'center',
          }}>
            <s.icon className="w-4 h-4 mx-auto mb-1" style={{ color: s.warn ? 'var(--warning)' : 'var(--text-muted)' }} />
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: s.warn ? 'var(--warning)' : 'var(--text-primary)' }}>{s.value}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', ...textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Time Allocation */}
      {focusRanking.length > 0 && (
        <div style={{ background: 'var(--surface-0)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5" style={textMuted} />
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, ...textSecondary }}>Time allocation</span>
          </div>
          <div className="flex flex-wrap gap-3" style={{ fontSize: 'var(--font-size-xs)' }}>
            {focusRanking.length >= 1 && (
              <span style={{ padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                1 hour → {focusRanking[0].name}
              </span>
            )}
            {focusRanking.length >= 3 && (
              <span style={{ padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', ...textSecondary }}>
                Half day → add {focusRanking.slice(1, 3).map(f => f.name).join(', ')}
              </span>
            )}
            {focusRanking.length >= 5 && (
              <span style={{ padding: 'var(--space-1) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', ...textMuted }}>
                Full day → add {focusRanking.slice(3, 5).map(f => f.name).join(', ')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Focus Ranking */}
      <div>
        <h2 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, ...textPrimary, marginBottom: 'var(--space-3)' }}>
          Focus ranking</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {focusRanking.length === 0 ? (
            <div className="text-center py-8" style={textMuted}>
              <Target className="w-6 h-6 mx-auto mb-2" />
              <p style={{ fontSize: 'var(--font-size-sm)' }}>No active investors to rank. Add investors and start engaging.</p>
            </div>
          ) : (
            focusRanking.map((inv, idx) => (
              <div key={inv.id} style={{
                background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
                border: `1px solid ${idx === 0 ? 'var(--accent)' : 'var(--border-subtle)'}`,
                ...(idx === 0 ? { boxShadow: '0 0 0 1px var(--accent-muted)' } : {}),
              }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 'var(--font-size-xs)', fontWeight: 400,
                      background: idx === 0 ? 'var(--accent)' : idx < 3 ? 'var(--surface-3)' : 'var(--surface-2)',
                      color: idx === 0 ? 'white' : 'var(--text-secondary)',
                    }}>#{idx + 1}</div>
                    <div>
                      <Link href={`/investors/${inv.id}`} style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--accent)', textDecoration: 'none' }}>
                        {inv.name}</Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span style={{ fontSize: '10px', ...textMuted }}>{inv.type.toUpperCase()}</span>
                        <span style={{ fontSize: '10px', padding: '0 4px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', ...textMuted }}>T{inv.tier}</span>
                        <span style={{ fontSize: '10px', padding: '0 4px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', ...textSecondary }}>
                          {STATUS_LABELS[inv.status] || inv.status}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 300, color: inv.focusScore >= 50 ? 'var(--success)' : inv.focusScore >= 30 ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {inv.focusScore}</div>
                    <div style={{ fontSize: '10px', ...textMuted }}>focus score</div>
                  </div>
                </div>

                {/* Signals */}
                {inv.signals.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {inv.signals.map((s, i) => (
                      <span key={i} style={{
                        fontSize: '10px', padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                        background: s.type === 'positive' ? 'var(--success-muted)' : s.type === 'warning' ? 'var(--warning-muted)' : 'var(--surface-2)',
                        color: s.type === 'positive' ? 'var(--success)' : s.type === 'warning' ? 'var(--warning)' : 'var(--text-muted)',
                      }}>{s.label}</span>
                    ))}
                  </div>
                )}

                {/* Action */}
                <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--surface-0)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                  <ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
                  <div>
                    <p style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, ...textPrimary }}>{inv.action}</p>
                    <p style={{ fontSize: '10px', ...textMuted, marginTop: '2px' }}>{inv.actionRationale}</p>
                  </div>
                </div>

                {/* Meta stats */}
                <div className="flex gap-4 mt-2" style={{ fontSize: '10px', ...textMuted }}>
                  <span>{inv.meetingCount} meeting{inv.meetingCount !== 1 ? 's' : ''}</span>
                  {inv.daysSinceContact !== null && <span>{inv.daysSinceContact}d since contact</span>}
                  {inv.pendingFollowups > 0 && <span>{inv.pendingFollowups} pending follow-up{inv.pendingFollowups !== 1 ? 's' : ''}</span>}
                  {inv.pendingTasks > 0 && <span>{inv.pendingTasks} pending task{inv.pendingTasks !== 1 ? 's' : ''}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

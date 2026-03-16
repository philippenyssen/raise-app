'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { RefreshCw, RotateCcw, Users, ArrowRight, Clock, Star, TrendingUp } from 'lucide-react';
import { cachedFetch } from '@/lib/cache';
import { MS_PER_MINUTE } from '@/lib/time';
import { useRefreshInterval } from '@/lib/hooks/useRefreshInterval';
import { TYPE_LABELS_SHORT as TYPE_LABELS } from '@/lib/constants';

interface WinBackCandidate {
  id: string;
  name: string;
  type: string;
  tier: number;
  status: 'passed' | 'dropped';
  daysSinceExit: number;
  exitDate: string | null;
  winBackScore: number;
  originalReason: string;
  newEvidence: string[];
  readiness: 'ready' | 'warming' | 'too_early' | 'too_late';
  recommendedAction: string;
  meetingCount: number;
  peakEnthusiasm: number;
  lastEnthusiasm: number;
}

interface WinBackData {
  candidates: WinBackCandidate[];
  summary: { total: number; ready: number; warming: number; tooEarly: number; tooLate: number; avgScore: number };
  context: { activeInvestors: number; inDD: number; termSheets: number; avgEnthusiasm: number };
  generated_at: string;
}

type ReadinessFilter = 'all' | 'ready' | 'warming' | 'too_early' | 'too_late';

const READINESS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  ready: { bg: 'var(--success-muted)', color: 'var(--success)', label: 'Ready' },
  warming: { bg: 'var(--warning-muted)', color: 'var(--warning)', label: 'Warming' },
  too_early: { bg: 'var(--surface-2)', color: 'var(--text-muted)', label: 'Too Early' },
  too_late: { bg: 'var(--danger-muted)', color: 'var(--danger)', label: 'Too Late' },
};

export default function WinBackPage() {
  const [data, setData] = useState<WinBackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReadinessFilter>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await cachedFetch('/api/win-back');
      if (!r.ok) throw new Error(`${r.status}`);
      setData(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { document.title = 'Raise | Win-Back'; }, []);
  useRefreshInterval(fetchData, 5 * MS_PER_MINUTE);

  const filtered = useMemo(() => {
    if (!data) return [];
    return filter === 'all' ? data.candidates : data.candidates.filter(c => c.readiness === filter);
  }, [data, filter]);

  if (loading && !data) {
    return (
      <div className="page-content p-6 max-w-[1200px] mx-auto">
        <h1 className="page-title">Win-Back</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading re-engagement candidates...</p>
        <div className="space-y-3 mt-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-content p-6 max-w-[1200px] mx-auto" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Win-Back</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-0)' }}>
            Re-engage investors who passed or dropped — with the right story at the right time</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          <span style={{ color: 'var(--text-muted)' }}><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></span>
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg p-4 mb-4" style={{ background: 'var(--danger-muted)', border: '1px solid var(--danger)', color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total Exited', value: data.summary.total, color: 'var(--text-secondary)' },
              { label: 'Ready Now', value: data.summary.ready, color: 'var(--success)' },
              { label: 'Warming', value: data.summary.warming, color: 'var(--warning)' },
              { label: 'Too Early', value: data.summary.tooEarly, color: 'var(--text-muted)' },
              { label: 'Too Late', value: data.summary.tooLate, color: 'var(--danger)' },
            ].map(s => (
              <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: 'var(--surface-1)' }}>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                <div className="text-xl font-normal" style={{ color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Context Banner */}
          {(data.context.termSheets > 0 || data.context.inDD > 0) && (
            <div className="rounded-lg p-3 mb-4 flex items-center gap-3" style={{ background: 'var(--accent-muted)', border: '1px solid var(--accent)' }}>
              <span style={{ color: 'var(--accent)' }}><TrendingUp className="w-4 h-4" /></span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Your pipeline has momentum: {data.context.termSheets > 0 ? `${data.context.termSheets} term sheet${data.context.termSheets > 1 ? 's' : ''}` : ''}{data.context.termSheets > 0 && data.context.inDD > 0 ? ', ' : ''}{data.context.inDD > 0 ? `${data.context.inDD} in DD` : ''} — a strong "what's changed" story for re-engagement.
              </span>
            </div>
          )}

          {/* Filter */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Filter:</span>
            {(['all', 'ready', 'warming', 'too_early', 'too_late'] as ReadinessFilter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-2.5 py-1 rounded-md text-xs"
                style={{
                  background: filter === f ? 'var(--surface-3)' : 'transparent',
                  color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: filter === f ? '1px solid var(--border-default)' : '1px solid transparent',
                }}>
                {f === 'all' ? 'All' : f === 'too_early' ? 'Too Early' : f === 'too_late' ? 'Too Late' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Candidates List */}
          {filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map(c => {
                const rc = READINESS_CONFIG[c.readiness] || READINESS_CONFIG.warming;
                return (
                  <Link
                    key={c.id}
                    href={`/investors/${c.id}`}
                    className="table-row block rounded-lg p-4 transition-colors"
                    style={{ background: 'var(--surface-0)', border: '1px solid var(--border-subtle)', textDecoration: 'none' }}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-normal"
                          style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.color}` }}>
                          {c.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-normal text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-normal" style={{ background: rc.bg, color: rc.color }}>{rc.label}</span>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>T{c.tier} · {TYPE_LABELS[c.type] || c.type}</span>
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {c.status === 'passed' ? 'Passed' : 'Dropped'} {c.daysSinceExit}d ago · {c.meetingCount} meeting{c.meetingCount !== 1 ? 's' : ''} · Peak enthusiasm {c.peakEnthusiasm}/5
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-sm tabular-nums font-normal" style={{ color: c.winBackScore >= 50 ? 'var(--success)' : c.winBackScore >= 30 ? 'var(--warning)' : 'var(--text-muted)' }}>
                            {c.winBackScore}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>score</div>
                        </div>
                        <span style={{ color: 'var(--text-muted)' }}><ArrowRight className="w-4 h-4" /></span>
                      </div>
                    </div>

                    {/* Original reason + new evidence */}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {c.originalReason && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Original concern</div>
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {c.originalReason.length > 120 ? c.originalReason.slice(0, 120) + '...' : c.originalReason}
                          </div>
                        </div>
                      )}
                      {c.newEvidence.length > 0 && (
                        <div>
                          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>What&apos;s changed since</div>
                          <div className="flex flex-wrap gap-1.5">
                            {c.newEvidence.map((e, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                                {e}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Recommended action */}
                    <div className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {c.recommendedAction}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              <RotateCcw className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm font-normal" style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                {filter !== 'all' ? `No ${filter.replace('_', ' ')} candidates` : 'No win-back candidates yet'}
              </p>
              <p className="text-xs">
                {filter !== 'all' ? (
                  <button onClick={() => setFilter('all')} style={{ color: 'var(--accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Show all {data.summary.total} candidates
                  </button>
                ) : (
                  <>Investors who pass or drop will appear here as re-engagement candidates.</>
                )}
              </p>
            </div>
          )}

          {/* Footer */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between mt-4" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
              <span>{filtered.length} of {data.summary.total} candidates</span>
              <span>Score factors: timing window, relationship depth, prior enthusiasm, pipeline momentum</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

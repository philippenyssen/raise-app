'use client';

import { useEffect, useState, useCallback } from 'react';
import { cachedFetch } from '@/lib/cache';
import Link from 'next/link';
import { CheckCircle, AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { fmtDateTime } from '@/lib/format';
import { skelCardLg, stSurface2, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary } from '@/lib/styles';

interface ConsistencyValue { document: string; value: string; }

interface ConsistencyCheck { metric: string; values: ConsistencyValue[]; status: 'match' | 'mismatch'; }

interface ConsistencyResult { consistent: boolean; checks: ConsistencyCheck[]; checkedAt: string; }

export default function ConsistencyPage() {
  const [result, setResult] = useState<ConsistencyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConsistency = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await cachedFetch('/api/consistency');
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run consistency check');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { document.title = 'Raise | Consistency Check'; }, []);
  useEffect(() => {
    fetchConsistency();
  }, [fetchConsistency]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchConsistency(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fetchConsistency]);

  const matchCount = result?.checks.filter(c => c.status === 'match').length ?? 0;
  const mismatchCount = result?.checks.filter(c => c.status === 'mismatch').length ?? 0;

  return (
    <div className="page-content space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/documents"
            className="p-2 rounded-lg btn-surface transition-colors"
            style={{
              color: 'var(--text-tertiary)' }}>
            <ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="page-title">Consistency Check</h1>
            <p className="text-sm mt-1" style={stTextMuted}>
              Cross-document metric comparison</p></div></div>
        <button
          onClick={fetchConsistency}
          disabled={loading}
          className="px-4 py-2 disabled:opacity-50 rounded-lg text-sm font-normal btn-surface transition-colors flex items-center gap-2"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text-primary)', }}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Re-check</button></div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="skeleton" style={{ height: '64px', borderRadius: 'var(--radius-xl)' }} />
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={skelCardLg} />
          ))}</div>
      )}

      {/* Error */}
      {error && !loading && (
        <div role="alert" className="rounded-xl p-6 text-center" style={{ border: '1px solid var(--danger-muted)', background: 'var(--danger-muted)' }}>
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" style={stTextPrimary} />
          <p className="font-normal" style={stTextPrimary}>{error}</p>
          <button
            onClick={fetchConsistency}
            className="mt-3 text-sm underline tab-hover"
            style={{ color: 'var(--text-tertiary)' }}>
            Retry</button></div>
      )}

      {/* Results */}
      {result && !loading && !error && (
        <>
          {/* Summary banner */}
          <div
            className="rounded-xl p-4 flex items-center gap-3"
            style={{
              border: `1px solid ${result.consistent ? 'var(--success-muted)' : 'var(--danger-muted)'}`,
              background: result.consistent ? 'var(--success-muted)' : 'var(--danger-muted)', }}>
            {result.consistent ? (
              <CheckCircle className="w-6 h-6 shrink-0" style={stTextSecondary} />
            ) : (
              <AlertTriangle className="w-6 h-6 shrink-0" style={stTextPrimary} />
            )}
            <div className="flex-1">
              <p className="font-normal" style={{ color: result.consistent ? 'var(--success)' : 'var(--danger)' }}>
                {result.consistent
                  ? 'All metrics consistent across documents'
                  : `${mismatchCount} inconsistenc${mismatchCount === 1 ? 'y' : 'ies'} found`}</p>
              <p className="text-xs mt-0.5" style={stTextMuted}>
                {result.checks.length} metric{result.checks.length !== 1 ? 's' : ''} compared
                {matchCount > 0 && ` \u00b7 ${matchCount} matching`}
                {mismatchCount > 0 && ` \u00b7 ${mismatchCount} mismatched`}
                {' \u00b7 '}
                {fmtDateTime(result.checkedAt)}</p></div></div>

          {/* No checks */}
          {result.checks.length === 0 && (
            <div className="rounded-xl p-8 text-center">
              <p style={stTextMuted}>
                No shared metrics found across documents. Add at least 2 documents with overlapping metrics to compare.</p></div>
          )}

          {/* Check cards */}
          <div className="space-y-3">
            {result.checks.map((check, i) => (
              <div
                key={i}
                className="rounded-xl p-4"
                style={{
                  border: `1px solid ${check.status === 'match' ? 'var(--border-default)' : 'var(--danger-muted)'}`,
                  background: check.status === 'match' ? 'var(--surface-1)' : 'var(--danger-muted)',}}>
                <div className="flex items-center gap-2 mb-3">
                  {check.status === 'match' ? (
                    <CheckCircle className="w-4 h-4 shrink-0" style={stTextSecondary} />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" style={stTextPrimary} />
                  )}
                  <span className="font-normal text-sm" style={stTextPrimary}>{check.metric}</span>
                  <span
                    className="text-xs px-2 py-0.5 rounded ml-auto"
                    style={{
                      background: check.status === 'match' ? 'var(--success-muted)' : 'var(--danger-muted)',
                      color: check.status === 'match' ? 'var(--success)' : 'var(--danger)', }}>
                    {check.status}</span></div>
                <div className="space-y-1.5">
                  {check.values.map((v, j) => (
                    <div
                      key={j}
                      className="flex items-center justify-between text-sm px-3 py-2 rounded-lg"
                      style={stSurface2}>
                      <span className="truncate mr-3" style={stTextTertiary}>{v.document}</span>
                      <span
                        className="font-mono shrink-0"
                        style={{ color: check.status === 'mismatch' ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        {v.value}</span></div>
                  ))}</div></div>
            ))}</div>
        </>
      )}
    </div>);
}

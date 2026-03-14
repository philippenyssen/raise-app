'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle, AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

interface ConsistencyValue {
  document: string;
  value: string;
}

interface ConsistencyCheck {
  metric: string;
  values: ConsistencyValue[];
  status: 'match' | 'mismatch';
}

interface ConsistencyResult {
  consistent: boolean;
  checks: ConsistencyCheck[];
  checkedAt: string;
}

export default function ConsistencyPage() {
  const [result, setResult] = useState<ConsistencyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConsistency = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/consistency');
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

  useEffect(() => {
    fetchConsistency();
  }, [fetchConsistency]);

  const matchCount = result?.checks.filter(c => c.status === 'match').length ?? 0;
  const mismatchCount = result?.checks.filter(c => c.status === 'mismatch').length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/documents"
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Consistency Check</h1>
            <p className="text-zinc-500 text-sm mt-1">
              Cross-document metric comparison
            </p>
          </div>
        </div>
        <button
          onClick={fetchConsistency}
          disabled={loading}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Re-check
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="h-16 bg-zinc-800/50 rounded-xl animate-pulse" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-zinc-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="border border-red-900/50 bg-red-950/30 rounded-xl p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 font-medium">{error}</p>
          <button
            onClick={fetchConsistency}
            className="mt-3 text-sm text-zinc-400 hover:text-zinc-200 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {result && !loading && !error && (
        <>
          {/* Summary banner */}
          <div
            className={`rounded-xl p-4 flex items-center gap-3 border ${
              result.consistent
                ? 'border-green-900/50 bg-green-950/20'
                : 'border-red-900/50 bg-red-950/20'
            }`}
          >
            {result.consistent ? (
              <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
            )}
            <div className="flex-1">
              <p className={`font-medium ${result.consistent ? 'text-green-300' : 'text-red-300'}`}>
                {result.consistent
                  ? 'All metrics consistent across documents'
                  : `${mismatchCount} inconsistenc${mismatchCount === 1 ? 'y' : 'ies'} found`}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {result.checks.length} metric{result.checks.length !== 1 ? 's' : ''} compared
                {matchCount > 0 && ` \u00b7 ${matchCount} matching`}
                {mismatchCount > 0 && ` \u00b7 ${mismatchCount} mismatched`}
                {' \u00b7 '}
                {new Date(result.checkedAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* No checks */}
          {result.checks.length === 0 && (
            <div className="border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-zinc-500">
                No shared metrics found across documents. Add at least 2 documents with overlapping metrics to compare.
              </p>
            </div>
          )}

          {/* Check cards */}
          <div className="space-y-3">
            {result.checks.map((check, i) => (
              <div
                key={i}
                className={`border rounded-xl p-4 ${
                  check.status === 'match'
                    ? 'border-zinc-800 bg-zinc-900/30'
                    : 'border-red-900/50 bg-red-950/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  {check.status === 'match' ? (
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span className="font-medium text-sm">{check.metric}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ml-auto ${
                      check.status === 'match'
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-red-900/30 text-red-400'
                    }`}
                  >
                    {check.status}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {check.values.map((v, j) => (
                    <div
                      key={j}
                      className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-zinc-800/40"
                    >
                      <span className="text-zinc-400 truncate mr-3">{v.document}</span>
                      <span
                        className={`font-mono shrink-0 ${
                          check.status === 'mismatch' ? 'text-red-300' : 'text-zinc-200'
                        }`}
                      >
                        {v.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

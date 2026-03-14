'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2, AlertTriangle, XCircle, Shield, RefreshCw,
} from 'lucide-react';

interface IntelligenceCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
}

interface IntelligenceVerification {
  status: 'healthy' | 'degraded' | 'unhealthy';
  summary: string;
  checks: IntelligenceCheck[];
  tableCounts: Record<string, number>;
  contextVersion: number | null;
  contextBuildTimestamp: string | null;
  verifiedAt: string;
}

interface HealthData {
  funnel: {
    contacted: number; meetings: number; engaged: number; in_dd: number;
    term_sheets: number; closed: number; passed: number;
    conversion_rates: Record<string, number>;
    targets: Record<string, number>;
  };
  health: string;
  totalInvestors: number;
  totalMeetings: number;
  avgEnthusiasm: number;
  tierBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
}

const convergenceDimensions = [
  { key: 'story', label: 'Story Convergence', desc: 'Objection patterns stable, all pre-answered' },
  { key: 'materials', label: 'Materials Quality', desc: 'Zero cross-document inconsistencies' },
  { key: 'model', label: 'Model Integrity', desc: 'Survives 3 independent stress tests' },
  { key: 'investors', label: 'Investor Pipeline', desc: 'Tier 1 investors in active diligence' },
  { key: 'objections', label: 'Objection Coverage', desc: 'Every objection has tested response' },
  { key: 'pricing', label: 'Pricing Acceptance', desc: 'Multiple investors accept range' },
  { key: 'terms', label: 'Term Alignment', desc: 'Term sheets comparable and acceptable' },
  { key: 'funnel', label: 'Funnel Health', desc: 'Conversion rates above target' },
  { key: 'timeline', label: 'Timeline', desc: 'On track for planned close date' },
  { key: 'team', label: 'Team Execution', desc: 'Everyone executing without friction' },
];

export default function HealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [convergence, setConvergence] = useState<Record<string, boolean>>({});
  const [intelVerify, setIntelVerify] = useState<IntelligenceVerification | null>(null);
  const [intelLoading, setIntelLoading] = useState(true);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setData);
    fetch('/api/intelligence/verify')
      .then(r => r.json())
      .then(setIntelVerify)
      .catch(() => {})
      .finally(() => setIntelLoading(false));
  }, []);

  const score = Object.values(convergence).filter(Boolean).length;

  if (!data) return <div className="text-zinc-500 animate-pulse">Loading...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Process Health</h1>
        <p className="text-zinc-500 text-sm mt-1">Convergence tracking and process verification</p>
      </div>

      {/* Convergence Score */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-medium text-zinc-400">CONVERGENCE SCORE</h2>
          <div className={`text-4xl font-bold ${
            score >= 8 ? 'text-green-400' : score >= 5 ? 'text-yellow-400' : 'text-red-400'
          }`}>{score}/10</div>
        </div>
        <div className="space-y-3">
          {convergenceDimensions.map(dim => (
            <div key={dim.key} className="flex items-center gap-4">
              <button
                onClick={() => setConvergence(c => ({ ...c, [dim.key]: !c[dim.key] }))}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                  convergence[dim.key]
                    ? 'bg-green-600 border-green-600'
                    : 'border-zinc-700 hover:border-zinc-500'
                }`}
              >
                {convergence[dim.key] && <span className="text-xs">&#10003;</span>}
              </button>
              <div className="flex-1">
                <span className="text-sm font-medium">{dim.label}</span>
                <span className="text-xs text-zinc-600 ml-2">{dim.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4 border-t border-zinc-800">
          <div className="h-3 bg-zinc-900 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                score >= 8 ? 'bg-green-600' : score >= 5 ? 'bg-yellow-600' : 'bg-red-600'
              }`}
              style={{ width: `${score * 10}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-600 mt-1">
            <span>Not ready</span>
            <span>{score >= 8 ? 'Ready for term sheet deadline' : score >= 5 ? 'Getting closer' : 'More work needed'}</span>
          </div>
        </div>
      </div>

      {/* Funnel Details */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">DETAILED FUNNEL METRICS</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(data.funnel.conversion_rates).map(([key, rate]) => {
            const target = data.funnel.targets[key] ?? 50;
            const delta = rate - target;
            return (
              <div key={key} className="bg-zinc-900/50 rounded-lg p-4">
                <div className="text-xs text-zinc-500 mb-2">
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${rate >= target ? 'text-green-400' : rate > 0 ? 'text-yellow-400' : 'text-zinc-600'}`}>
                    {rate}%
                  </span>
                  {rate > 0 && (
                    <span className={`text-xs ${delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {delta >= 0 ? '+' : ''}{delta}pp
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-600 mt-1">target: {target}%</div>
                <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${rate >= target ? 'bg-green-600' : 'bg-yellow-600'}`}
                    style={{ width: `${Math.min(rate, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">INVESTOR STATUS BREAKDOWN</h2>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {Object.entries(data.statusBreakdown).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
            <div key={status} className="bg-zinc-900/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold">{count}</div>
              <div className="text-xs text-zinc-500">{status.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Intelligence Verification Status */}
      <div className="border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-medium text-zinc-400">INTELLIGENCE HEALTH</h2>
          </div>
          {intelVerify && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              intelVerify.status === 'healthy'
                ? 'bg-green-900/20 text-green-400 border-green-700/40'
                : intelVerify.status === 'degraded'
                ? 'bg-yellow-900/20 text-yellow-400 border-yellow-700/40'
                : 'bg-red-900/20 text-red-400 border-red-700/40'
            }`}>
              {intelVerify.status === 'healthy' && <CheckCircle2 className="w-3 h-3" />}
              {intelVerify.status === 'degraded' && <AlertTriangle className="w-3 h-3" />}
              {intelVerify.status === 'unhealthy' && <XCircle className="w-3 h-3" />}
              {intelVerify.status.charAt(0).toUpperCase() + intelVerify.status.slice(1)}
            </div>
          )}
        </div>

        {intelLoading ? (
          <div className="flex items-center gap-2 py-4">
            <RefreshCw className="w-4 h-4 text-zinc-500 animate-spin" />
            <span className="text-sm text-zinc-500">Verifying intelligence systems...</span>
          </div>
        ) : intelVerify ? (
          <div>
            <p className="text-xs text-zinc-500 mb-3">{intelVerify.summary}</p>
            <div className="space-y-1.5">
              {intelVerify.checks.map((check, i) => {
                const statusIcon = check.status === 'pass'
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  : check.status === 'warn'
                  ? <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />;

                return (
                  <div key={i} className="flex items-start gap-2 py-1.5 px-3 rounded-lg bg-zinc-900/50">
                    {statusIcon}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-zinc-300 font-medium">
                        {check.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <p className="text-[10px] text-zinc-500 truncate">{check.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {intelVerify.contextVersion && (
              <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-4 text-[10px] text-zinc-600">
                <span>Context v{intelVerify.contextVersion}</span>
                {intelVerify.contextBuildTimestamp && (
                  <span>Built {new Date(intelVerify.contextBuildTimestamp).toLocaleString()}</span>
                )}
                <span>Verified {new Date(intelVerify.verifiedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-600">Intelligence verification unavailable.</p>
        )}
      </div>

      {/* Key Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Investors" value={data.totalInvestors} />
        <MetricCard label="Total Meetings" value={data.totalMeetings} />
        <MetricCard label="Avg Enthusiasm" value={`${data.avgEnthusiasm}/5`} />
        <MetricCard label="Convergence" value={`${score}/10`} />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-zinc-800 rounded-xl p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

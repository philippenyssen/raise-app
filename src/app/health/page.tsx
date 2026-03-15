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

  if (!data) return (
    <div className="page-content space-y-6">
      <div className="h-8 w-48 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
      <div className="h-5 w-80 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
      {[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)' }} />)}
    </div>
  );

  return (
    <div className="space-y-8 page-content">
      <div>
        <h1 className="page-title">Process Health</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Convergence tracking and process verification</p>
      </div>

      {/* Convergence Score */}
      <div className="rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>Convergence score</h2>
          <div className="text-4xl font-bold" style={{
            color: score >= 8 ? 'var(--success)' : score >= 5 ? 'var(--warning)' : 'var(--danger)'
          }}>{score}/10</div>
        </div>
        <div className="space-y-3">
          {convergenceDimensions.map(dim => (
            <div key={dim.key} className="flex items-center gap-4">
              <button
                onClick={() => setConvergence(c => ({ ...c, [dim.key]: !c[dim.key] }))}
                className="w-5 h-5 rounded flex items-center justify-center transition-colors shrink-0"
                style={{
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  backgroundColor: convergence[dim.key] ? 'var(--success)' : 'transparent',
                  borderColor: convergence[dim.key] ? 'var(--success)' : 'var(--border-default)',
                }}
              >
                {convergence[dim.key] && <span className="text-xs" style={{ color: 'var(--text-primary)' }}>&#10003;</span>}
              </button>
              <div className="flex-1">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{dim.label}</span>
                <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{dim.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border-default)' }}>
          <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-1)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${score * 10}%`,
                backgroundColor: score >= 8 ? 'var(--success)' : score >= 5 ? 'var(--warning)' : 'var(--danger)',
              }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            <span>Not ready</span>
            <span>{score >= 8 ? 'Ready for term sheet deadline' : score >= 5 ? 'Getting closer' : 'More work needed'}</span>
          </div>
        </div>
      </div>

      {/* Funnel Details */}
      <div className="rounded-xl p-6">
        <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-tertiary)' }}>Pipeline conversion rates</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(data.funnel.conversion_rates).map(([key, rate]) => {
            const target = data.funnel.targets[key] ?? 50;
            const delta = rate - target;
            return (
              <div key={key} className="rounded-lg p-4" style={{ backgroundColor: 'var(--surface-1)' }}>
                <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold" style={{
                    color: rate >= target ? 'var(--success)' : rate > 0 ? 'var(--warning)' : 'var(--text-muted)'
                  }}>
                    {rate}%
                  </span>
                  {rate > 0 && (
                    <span className="text-xs" style={{
                      color: delta >= 0 ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {delta >= 0 ? '+' : ''}{delta}pp
                    </span>
                  )}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>target: {target}%</div>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-2)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(rate, 100)}%`,
                      backgroundColor: rate >= target ? 'var(--success)' : 'var(--warning)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="rounded-xl p-6">
        <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-tertiary)' }}>Investor status breakdown</h2>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3 card-stagger">
          {Object.entries(data.statusBreakdown).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
            <div key={status} className="rounded-lg p-3 text-center" style={{ backgroundColor: 'var(--surface-1)' }}>
              <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{count}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{status.replace(/_/g, ' ')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Intelligence Verification Status */}
      <div className="rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>Intelligence health</h2>
          </div>
          {intelVerify && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: intelVerify.status === 'healthy'
                  ? 'var(--success-muted)'
                  : intelVerify.status === 'degraded'
                  ? 'var(--warning-muted)'
                  : 'var(--danger-muted)',
                color: intelVerify.status === 'healthy'
                  ? 'var(--success)'
                  : intelVerify.status === 'degraded'
                  ? 'var(--warning)'
                  : 'var(--danger)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: intelVerify.status === 'healthy'
                  ? 'var(--success)'
                  : intelVerify.status === 'degraded'
                  ? 'var(--warning)'
                  : 'var(--danger)',
              }}
            >
              {intelVerify.status === 'healthy' && <CheckCircle2 className="w-3 h-3" />}
              {intelVerify.status === 'degraded' && <AlertTriangle className="w-3 h-3" />}
              {intelVerify.status === 'unhealthy' && <XCircle className="w-3 h-3" />}
              {intelVerify.status.charAt(0).toUpperCase() + intelVerify.status.slice(1)}
            </div>
          )}
        </div>

        {intelLoading ? (
          <div className="flex items-center gap-2 py-4">
            <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Verifying intelligence systems...</span>
          </div>
        ) : intelVerify ? (
          <div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{intelVerify.summary}</p>
            <div className="space-y-1.5">
              {intelVerify.checks.map((check, i) => {
                const iconStyle = {
                  color: check.status === 'pass'
                    ? 'var(--success)'
                    : check.status === 'warn'
                    ? 'var(--warning)'
                    : 'var(--danger)',
                };
                const statusIcon = check.status === 'pass'
                  ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={iconStyle} />
                  : check.status === 'warn'
                  ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={iconStyle} />
                  : <XCircle className="w-3.5 h-3.5 shrink-0" style={iconStyle} />;

                return (
                  <div key={i} className="flex items-start gap-2 py-1.5 px-3 rounded-lg" style={{ backgroundColor: 'var(--surface-1)' }}>
                    {statusIcon}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {check.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{check.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {intelVerify.contextVersion && (
              <div className="mt-3 pt-3 flex items-center gap-4 text-[10px]" style={{ borderTop: '1px solid var(--border-default)', color: 'var(--text-muted)' }}>
                <span>Context v{intelVerify.contextVersion}</span>
                {intelVerify.contextBuildTimestamp && (
                  <span>Built {new Date(intelVerify.contextBuildTimestamp).toLocaleString()}</span>
                )}
                <span>Verified {new Date(intelVerify.verifiedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Intelligence verification unavailable.</p>
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
    <div className="rounded-xl p-4">
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

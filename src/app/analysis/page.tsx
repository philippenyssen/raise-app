'use client';

import { useState } from 'react';

interface AnalysisData {
  patterns: {
    top_objections: { text: string; count: number; recommendation: string }[];
    story_effectiveness: { landing: string[]; failing: string[]; exciting: string[] };
    pricing_trend: string;
    material_changes: { change: string; priority: string; rationale: string }[];
    overall_assessment: string;
    convergence_signals: string[];
  } | null;
  health: {
    health: string;
    diagnosis: string;
    recommendations: string[];
    risk_factors: string[];
  };
  objections: { text: string; count: number; topic: string }[];
  funnel: Record<string, unknown>;
  meeting_count: number;
  error?: string;
}

function getHealthStyles(health: string): { border: string; background: string; color: string } {
  switch (health) {
    case 'green':
      return {
        border: '1px solid var(--success)',
        background: 'var(--success-muted)',
        color: 'var(--success)',
      };
    case 'red':
      return {
        border: '1px solid var(--danger)',
        background: 'var(--danger-muted)',
        color: 'var(--danger)',
      };
    default:
      return {
        border: '1px solid var(--warning)',
        background: 'var(--warning-muted)',
        color: 'var(--warning)',
      };
  }
}

function getPriorityStyles(priority: string): React.CSSProperties {
  switch (priority) {
    case 'critical':
      return { background: 'var(--danger-muted)', color: 'var(--danger)' };
    case 'high':
      return { background: 'var(--warning-muted)', color: 'var(--warning)' };
    case 'medium':
      return { background: 'var(--warning-muted)', color: 'var(--warning)' };
    default:
      return { background: 'var(--surface-2)', color: 'var(--text-muted)' };
  }
}

export default function AnalysisPage() {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAnalysis() {
    setLoading(true);
    const res = await fetch('/api/analyze');
    setData(await res.json());
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            AI Pattern Analysis
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Claude analyzes your meetings to find what&apos;s working and what needs to change.
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="btn btn-primary btn-md disabled:opacity-50"
        >
          {loading ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>

      {!data && !loading && (
        <div
          className="rounded-xl p-8 text-center space-y-3"
          style={{ border: '1px solid var(--border-default)' }}
        >
          <p style={{ color: 'var(--text-muted)' }}>Click &quot;Run Analysis&quot; to analyze patterns across all logged meetings.</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Requires at least 2 meetings with notes. Uses Claude API.</p>
        </div>
      )}

      {loading && (
        <div
          className="rounded-xl p-8 text-center"
          style={{ border: '1px solid var(--border-default)' }}
        >
          <div className="animate-pulse" style={{ color: 'var(--text-secondary)' }}>
            Analyzing {data?.meeting_count ?? '...'} meetings with Claude...
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>This may take 10-30 seconds</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-6">
          {data.error && (
            <div
              className="rounded-lg p-4 text-sm"
              style={{
                background: 'var(--danger-muted)',
                border: '1px solid var(--danger)',
                color: 'var(--danger)',
              }}
            >
              {data.error}
            </div>
          )}

          {/* Health Status */}
          {(() => {
            const hs = getHealthStyles(data.health.health);
            return (
              <div
                className="rounded-xl p-6"
                style={{ border: hs.border, background: hs.background }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="text-lg font-bold uppercase"
                    style={{ color: hs.color }}
                  >
                    {data.health.health}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Process Health</span>
                </div>
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{data.health.diagnosis}</p>
                {data.health.recommendations.length > 0 && (
                  <div>
                    <h4
                      className="text-xs font-medium mb-2"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      RECOMMENDATIONS
                    </h4>
                    <ul className="space-y-1">
                      {data.health.recommendations.map((r, i) => (
                        <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                          <span className="shrink-0" style={{ color: 'var(--accent)' }}>-</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}

          {data.patterns && (
            <>
              {/* Overall Assessment */}
              <div
                className="rounded-xl p-6"
                style={{ border: '1px solid var(--border-default)' }}
              >
                <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                  OVERALL ASSESSMENT
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {data.patterns.overall_assessment}
                </p>
              </div>

              {/* Story Effectiveness */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl p-5" style={{ border: '1px solid var(--border-default)' }}>
                  <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--success)' }}>
                    LANDING WELL
                  </h3>
                  <ul className="space-y-1.5">
                    {data.patterns.story_effectiveness.landing.map((s, i) => (
                      <li key={i} className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s}</li>
                    ))}
                    {data.patterns.story_effectiveness.landing.length === 0 && (
                      <li className="text-sm" style={{ color: 'var(--text-muted)' }}>No strong signals yet</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-xl p-5" style={{ border: '1px solid var(--border-default)' }}>
                  <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--warning)' }}>
                    GENERATING EXCITEMENT
                  </h3>
                  <ul className="space-y-1.5">
                    {data.patterns.story_effectiveness.exciting.map((s, i) => (
                      <li key={i} className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl p-5" style={{ border: '1px solid var(--border-default)' }}>
                  <h3 className="text-xs font-medium mb-3" style={{ color: 'var(--danger)' }}>
                    FALLING FLAT
                  </h3>
                  <ul className="space-y-1.5">
                    {data.patterns.story_effectiveness.failing.map((s, i) => (
                      <li key={i} className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Top Objections with Recommendations */}
              {data.patterns.top_objections.length > 0 && (
                <div className="rounded-xl p-6" style={{ border: '1px solid var(--border-default)' }}>
                  <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>
                    TOP OBJECTIONS + RECOMMENDED RESPONSES
                  </h2>
                  <div className="space-y-4">
                    {data.patterns.top_objections.map((obj, i) => (
                      <div
                        key={i}
                        className="pl-4"
                        style={{ borderLeft: '2px solid var(--danger)' }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {obj.text}
                          </span>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              background: 'var(--danger-muted)',
                              color: 'var(--danger)',
                            }}
                          >
                            {obj.count}x
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{obj.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Material Changes */}
              {data.patterns.material_changes.length > 0 && (
                <div className="rounded-xl p-6" style={{ border: '1px solid var(--border-default)' }}>
                  <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>
                    RECOMMENDED MATERIAL CHANGES
                  </h2>
                  <div className="space-y-3">
                    {data.patterns.material_changes.map((mc, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                          style={getPriorityStyles(mc.priority)}
                        >
                          {mc.priority}
                        </span>
                        <div>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{mc.change}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{mc.rationale}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Convergence Signals */}
              {data.patterns.convergence_signals.length > 0 && (
                <div
                  className="rounded-xl p-6"
                  style={{
                    border: '1px solid var(--success-muted)',
                    background: 'var(--success-muted)',
                  }}
                >
                  <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--success)' }}>
                    CONVERGENCE SIGNALS
                  </h2>
                  <ul className="space-y-1.5">
                    {data.patterns.convergence_signals.map((s, i) => (
                      <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--text-secondary)' }}>
                        <span className="shrink-0" style={{ color: 'var(--success)' }}>+</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pricing */}
              <div className="rounded-xl p-6" style={{ border: '1px solid var(--border-default)' }}>
                <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  PRICING RECEPTION TREND
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {data.patterns.pricing_trend}
                </p>
              </div>
            </>
          )}

          {/* Raw Objection Data */}
          {data.objections.length > 0 && (
            <div className="rounded-xl p-6" style={{ border: '1px solid var(--border-default)' }}>
              <h2 className="text-sm font-medium mb-4" style={{ color: 'var(--text-secondary)' }}>
                ALL OBJECTIONS (from database)
              </h2>
              <div className="space-y-2">
                {data.objections.map((obj, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--text-secondary)' }}>{obj.text}</span>
                    <div className="flex gap-2 shrink-0">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: 'var(--surface-2)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {obj.topic}
                      </span>
                      <span
                        className="text-xs font-medium"
                        style={{ color: 'var(--danger)' }}
                      >
                        {obj.count}x
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

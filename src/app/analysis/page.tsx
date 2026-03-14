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
          <h1 className="text-2xl font-bold tracking-tight">AI Pattern Analysis</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Claude analyzes your meetings to find what&apos;s working and what needs to change.
          </p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? 'Analyzing...' : 'Run Analysis'}
        </button>
      </div>

      {!data && !loading && (
        <div className="border border-zinc-800 rounded-xl p-8 text-center space-y-3">
          <p className="text-zinc-500">Click &quot;Run Analysis&quot; to analyze patterns across all logged meetings.</p>
          <p className="text-zinc-600 text-xs">Requires at least 2 meetings with notes. Uses Claude API.</p>
        </div>
      )}

      {loading && (
        <div className="border border-zinc-800 rounded-xl p-8 text-center">
          <div className="animate-pulse text-zinc-400">Analyzing {data?.meeting_count ?? '...'} meetings with Claude...</div>
          <p className="text-xs text-zinc-600 mt-2">This may take 10-30 seconds</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-6">
          {data.error && (
            <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4 text-sm text-red-300">
              {data.error}
            </div>
          )}

          {/* Health Status */}
          <div className={`rounded-xl p-6 border ${
            data.health.health === 'green' ? 'border-green-800/30 bg-green-900/10' :
            data.health.health === 'red' ? 'border-red-800/30 bg-red-900/10' :
            'border-yellow-800/30 bg-yellow-900/10'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-lg font-bold uppercase ${
                data.health.health === 'green' ? 'text-green-400' :
                data.health.health === 'red' ? 'text-red-400' : 'text-yellow-400'
              }`}>{data.health.health}</span>
              <span className="text-sm text-zinc-400">Process Health</span>
            </div>
            <p className="text-sm text-zinc-300 mb-4">{data.health.diagnosis}</p>
            {data.health.recommendations.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-zinc-500 mb-2">RECOMMENDATIONS</h4>
                <ul className="space-y-1">
                  {data.health.recommendations.map((r, i) => (
                    <li key={i} className="text-sm text-zinc-400 flex gap-2">
                      <span className="text-blue-500 shrink-0">-</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {data.patterns && (
            <>
              {/* Overall Assessment */}
              <div className="border border-zinc-800 rounded-xl p-6">
                <h2 className="text-sm font-medium text-zinc-400 mb-3">OVERALL ASSESSMENT</h2>
                <p className="text-sm text-zinc-300">{data.patterns.overall_assessment}</p>
              </div>

              {/* Story Effectiveness */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-xs font-medium text-green-400 mb-3">LANDING WELL</h3>
                  <ul className="space-y-1.5">
                    {data.patterns.story_effectiveness.landing.map((s, i) => (
                      <li key={i} className="text-sm text-zinc-400">{s}</li>
                    ))}
                    {data.patterns.story_effectiveness.landing.length === 0 && (
                      <li className="text-sm text-zinc-600">No strong signals yet</li>
                    )}
                  </ul>
                </div>
                <div className="border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-xs font-medium text-yellow-400 mb-3">GENERATING EXCITEMENT</h3>
                  <ul className="space-y-1.5">
                    {data.patterns.story_effectiveness.exciting.map((s, i) => (
                      <li key={i} className="text-sm text-zinc-400">{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="border border-zinc-800 rounded-xl p-5">
                  <h3 className="text-xs font-medium text-red-400 mb-3">FALLING FLAT</h3>
                  <ul className="space-y-1.5">
                    {data.patterns.story_effectiveness.failing.map((s, i) => (
                      <li key={i} className="text-sm text-zinc-400">{s}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Top Objections with Recommendations */}
              {data.patterns.top_objections.length > 0 && (
                <div className="border border-zinc-800 rounded-xl p-6">
                  <h2 className="text-sm font-medium text-zinc-400 mb-4">TOP OBJECTIONS + RECOMMENDED RESPONSES</h2>
                  <div className="space-y-4">
                    {data.patterns.top_objections.map((obj, i) => (
                      <div key={i} className="border-l-2 border-red-800 pl-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-zinc-200">{obj.text}</span>
                          <span className="text-xs bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded">{obj.count}x</span>
                        </div>
                        <p className="text-xs text-zinc-500">{obj.recommendation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Material Changes */}
              {data.patterns.material_changes.length > 0 && (
                <div className="border border-zinc-800 rounded-xl p-6">
                  <h2 className="text-sm font-medium text-zinc-400 mb-4">RECOMMENDED MATERIAL CHANGES</h2>
                  <div className="space-y-3">
                    {data.patterns.material_changes.map((mc, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${
                          mc.priority === 'critical' ? 'bg-red-900/50 text-red-400' :
                          mc.priority === 'high' ? 'bg-orange-900/50 text-orange-400' :
                          mc.priority === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                          'bg-zinc-800 text-zinc-500'
                        }`}>{mc.priority}</span>
                        <div>
                          <p className="text-sm text-zinc-300">{mc.change}</p>
                          <p className="text-xs text-zinc-600 mt-0.5">{mc.rationale}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Convergence Signals */}
              {data.patterns.convergence_signals.length > 0 && (
                <div className="border border-green-800/20 bg-green-900/5 rounded-xl p-6">
                  <h2 className="text-sm font-medium text-green-400 mb-3">CONVERGENCE SIGNALS</h2>
                  <ul className="space-y-1.5">
                    {data.patterns.convergence_signals.map((s, i) => (
                      <li key={i} className="text-sm text-zinc-400 flex gap-2">
                        <span className="text-green-500 shrink-0">+</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pricing */}
              <div className="border border-zinc-800 rounded-xl p-6">
                <h2 className="text-sm font-medium text-zinc-400 mb-2">PRICING RECEPTION TREND</h2>
                <p className="text-sm text-zinc-300">{data.patterns.pricing_trend}</p>
              </div>
            </>
          )}

          {/* Raw Objection Data */}
          {data.objections.length > 0 && (
            <div className="border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-medium text-zinc-400 mb-4">ALL OBJECTIONS (from database)</h2>
              <div className="space-y-2">
                {data.objections.map((obj, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">{obj.text}</span>
                    <div className="flex gap-2 shrink-0">
                      <span className="text-xs bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">{obj.topic}</span>
                      <span className="text-xs text-red-400 font-medium">{obj.count}x</span>
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

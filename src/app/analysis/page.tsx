'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/toast';
import { BarChart3 } from 'lucide-react';
import { stAccent, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary } from '@/lib/styles';

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

function getHealthStyles(health: string): { background: string; color: string } {
  switch (health) {
    case 'green':
      return {
        background: 'var(--success-muted)',
        color: 'var(--text-secondary)',};
    case 'red':
      return {
        background: 'var(--danger-muted)',
        color: 'var(--text-primary)',};
    default:
      return {
        background: 'var(--warning-muted)',
        color: 'var(--text-tertiary)',};
  }}

function getPriorityStyles(priority: string): React.CSSProperties {
  switch (priority) {
    case 'critical':
      return { background: 'var(--danger-muted)', color: 'var(--text-primary)' };
    case 'high':
      return { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' };
    case 'medium':
      return { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' };
    default:
      return { background: 'var(--surface-2)', color: 'var(--text-muted)' };
  }}

export default function AnalysisPage() {
  useEffect(() => { document.title = 'Raise | AI Analysis'; }, []);
  const { toast } = useToast();
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analyze');
      const result = await res.json();
      setData(result);
      if (!result.error) toast('Analysis complete — scroll down to see insights');
    } catch {
      toast('Analysis failed. Ensure you have at least 2 meetings with notes, then retry.', 'error');
      setData({ patterns: null, health: { health: 'red', diagnosis: 'Analysis failed. Please try again.', recommendations: [], risk_factors: [] }, objections: [], funnel: {}, meeting_count: 0, error: 'Failed to run analysis' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault(); runAnalysis();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [runAnalysis]);

  return (
    <div className="space-y-6 page-content">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">AI Pattern Analysis</h1>
          <p className="text-sm mt-1" style={stTextMuted}>
            Claude analyzes your meetings to find what&apos;s working and what needs to change.</p></div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="btn btn-primary btn-md disabled:opacity-50">
          {loading ? 'Analyzing...' : 'Run Analysis'}</button></div>

      {!data && !loading && (
        <div
          className="rounded-xl p-8 text-center space-y-3">
          <BarChart3 className="w-8 h-8 mx-auto" style={stTextMuted} />
          <p style={stTextMuted}>Click &quot;Run Analysis&quot; to analyze patterns across all logged meetings.</p>
          <p className="text-xs" style={stTextMuted}>Requires at least 2 meetings with notes. Uses Claude API.</p></div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-lg)' }} />
          <div className="grid grid-cols-2 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-lg)' }} />)}
          </div>
          <p className="text-xs mt-2" style={stTextMuted}>This may take 10-30 seconds</p></div>
      )}

      {data && !loading && (
        <div className="space-y-6">
          {data.error && (
            <div
              className="rounded-lg p-4 text-sm"
              style={{ background: 'var(--danger-muted)', color: 'var(--text-primary)' }}>
              {data.error}</div>
          )}

          {/* Health Status */}
          {(() => {
            const hs = getHealthStyles(data.health.health);
            return (
              <div
                className="rounded-xl p-6"
                style={{ background: hs.background }}>
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="text-lg font-normal "
                    style={{ color: hs.color }}>
                    {data.health.health}</span>
                  <span className="text-sm" style={stTextSecondary}>Process Health</span></div>
                <p className="text-sm mb-4" style={stTextSecondary}>{data.health.diagnosis}</p>
                {data.health.recommendations.length > 0 && (
                  <div>
                    <h4
                      className="text-xs font-normal mb-2"
                      style={stTextMuted}>
                      RECOMMENDATIONS</h4>
                    <ul className="space-y-1">
                      {data.health.recommendations.map((r, i) => (
                        <li key={i} className="text-sm flex gap-2" style={stTextSecondary}>
                          <span className="shrink-0" style={stAccent}>-</span> {r}</li>
                      ))}</ul></div>
                )}
              </div>);
          })()}

          {data.patterns && (
            <>
              {/* Overall Assessment */}
              <div
                className="rounded-xl p-6"
                style={{  }}>
                <h2 className="text-sm font-normal mb-3" style={stTextSecondary}>
                  OVERALL ASSESSMENT</h2>
                <p className="text-sm" style={stTextSecondary}>
                  {data.patterns.overall_assessment}</p></div>

              {/* Story Effectiveness */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl p-5" style={{  }}>
                  <h3 className="text-xs font-normal mb-3" style={stTextSecondary}>
                    LANDING WELL</h3>
                  <ul className="space-y-1.5">
                    {data.patterns.story_effectiveness.landing.map((s, i) => (
                      <li key={i} className="text-sm" style={stTextSecondary}>{s}</li>
                    ))}
                    {data.patterns.story_effectiveness.landing.length === 0 && (
                      <li className="text-sm" style={stTextMuted}>No strong signals yet</li>
                    )}</ul></div>
                <div className="rounded-xl p-5" style={{  }}>
                  <h3 className="text-xs font-normal mb-3" style={stTextTertiary}>
                    GENERATING EXCITEMENT</h3>
                  <ul className="space-y-1.5">
                    {data.patterns.story_effectiveness.exciting.map((s, i) => (
                      <li key={i} className="text-sm" style={stTextSecondary}>{s}</li>
                    ))}</ul></div>
                <div className="rounded-xl p-5" style={{  }}>
                  <h3 className="text-xs font-normal mb-3" style={stTextPrimary}>
                    FALLING FLAT</h3>
                  <ul className="space-y-1.5">
                    {data.patterns.story_effectiveness.failing.map((s, i) => (
                      <li key={i} className="text-sm" style={stTextSecondary}>{s}</li>
                    ))}</ul></div></div>

              {/* Top Objections with Recommendations */}
              {data.patterns.top_objections.length > 0 && (
                <div className="rounded-xl p-6" style={{  }}>
                  <h2 className="text-sm font-normal mb-4" style={stTextSecondary}>
                    Top objections + recommended responses</h2>
                  <div className="space-y-4">
                    {data.patterns.top_objections.map((obj, i) => (
                      <div
                        key={i}
                        className="pl-4"
                        style={{  }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-normal" style={stTextPrimary}>
                            {obj.text}</span>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--danger-muted)', color: 'var(--text-primary)' }}>
                            {obj.count}x</span></div>
                        <p className="text-xs" style={stTextMuted}>{obj.recommendation}</p></div>
                    ))}</div></div>
              )}

              {/* Material Changes */}
              {data.patterns.material_changes.length > 0 && (
                <div className="rounded-xl p-6" style={{  }}>
                  <h2 className="text-sm font-normal mb-4" style={stTextSecondary}>
                    RECOMMENDED MATERIAL CHANGES</h2>
                  <div className="space-y-3">
                    {data.patterns.material_changes.map((mc, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                          style={getPriorityStyles(mc.priority)}>
                          {mc.priority}</span>
                        <div>
                          <p className="text-sm" style={stTextSecondary}>{mc.change}</p>
                          <p className="text-xs mt-0.5" style={stTextMuted}>{mc.rationale}</p></div></div>
                    ))}</div></div>
              )}

              {/* Convergence Signals */}
              {data.patterns.convergence_signals.length > 0 && (
                <div
                  className="rounded-xl p-6"
                  style={{ background: 'var(--success-muted)' }}>
                  <h2 className="text-sm font-normal mb-3" style={stTextSecondary}>
                    CONVERGENCE SIGNALS</h2>
                  <ul className="space-y-1.5">
                    {data.patterns.convergence_signals.map((s, i) => (
                      <li key={i} className="text-sm flex gap-2" style={stTextSecondary}>
                        <span className="shrink-0" style={stTextSecondary}>+</span> {s}</li>
                    ))}</ul></div>
              )}

              {/* Pricing */}
              <div className="rounded-xl p-6" style={{  }}>
                <h2 className="text-sm font-normal mb-2" style={stTextSecondary}>
                  PRICING RECEPTION TREND</h2>
                <p className="text-sm" style={stTextSecondary}>
                  {data.patterns.pricing_trend}</p></div>
            </>
          )}

          {/* Raw Objection Data */}
          {data.objections.length > 0 && (
            <div className="rounded-xl p-6" style={{  }}>
              <h2 className="text-sm font-normal mb-4" style={stTextSecondary}>
                All objections (from database)</h2>
              <div className="space-y-2">
                {data.objections.map((obj, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span style={stTextSecondary}>{obj.text}</span>
                    <div className="flex gap-2 shrink-0">
                      <span
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                        {obj.topic}</span>
                      <span
                        className="text-xs font-normal"
                        style={stTextPrimary}>
                        {obj.count}x</span></div></div>
                ))}</div></div>
          )}</div>
      )}
    </div>);
}

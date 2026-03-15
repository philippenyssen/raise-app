'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/toast';
import Link from 'next/link';
import {
  Plus, Trash2, ArrowLeft, Scale, Trophy, DollarSign,
  ShieldCheck, AlertTriangle, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import { labelMuted10, scoreBg, scoreColor, stAccent, stAccentBadge, stSurface0, stSurface2, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary } from '@/lib/styles';
import type { TermScenario, TermScenarioResult } from '@/lib/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScenarioResult = TermScenarioResult;

interface CompareResponse { results: ScenarioResult[]; recommendations: { best_for_founders: string; most_capital: string; highest_effective_valuation: string }; generated_at: string }

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const EMPTY_SCENARIO: TermScenario = { investor_name: '', pre_money_valuation: 0, investment_amount: 0, liquidation_preference: 1.0, participation: false, anti_dilution: 'broad', board_seats: 1, pro_rata_rights: true, drag_along_threshold: 66 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatM(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}Bn`;
  if (n >= 1) return `${Math.round(n)}M`;
  return `${n}M`;
}

// Determine if a cell is "best" or "worst" among results for color coding
type CellRating = 'good' | 'bad' | 'neutral';

function ratePref(val: number, allVals: number[]): CellRating {
  const min = Math.min(...allVals), max = Math.max(...allVals);
  if (min === max) return 'neutral';
  if (val === min) return 'good';
  if (val === max) return 'bad';
  return 'neutral';
}

function rateHigherIsBetter(val: number, allVals: number[]): CellRating {
  const min = Math.min(...allVals), max = Math.max(...allVals);
  if (min === max) return 'neutral';
  if (val === max) return 'good';
  if (val === min) return 'bad';
  return 'neutral';
}

function rateLowerIsBetter(val: number, allVals: number[]): CellRating {
  const min = Math.min(...allVals), max = Math.max(...allVals);
  if (min === max) return 'neutral';
  if (val === min) return 'good';
  if (val === max) return 'bad';
  return 'neutral';
}

function cellStyle(rating: CellRating): React.CSSProperties {
  if (rating === 'bad') return { color: 'var(--text-primary)' };
  return { color: 'var(--text-secondary)' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TermComparePage() {
  const { toast } = useToast();
  const [scenarios, setScenarios] = useState<TermScenario[]>([{ ...EMPTY_SCENARIO }]);
  const [results, setResults] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<number[]>([]);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [addHover, setAddHover] = useState(false);
  const [compareHover, setCompareHover] = useState(false);
  const [backHover, setBackHover] = useState(false);
  const [hoveredRemove, setHoveredRemove] = useState<number | null>(null);

  const addScenario = useCallback(() => {
    if (scenarios.length >= 5) {
      toast('Maximum 5 scenarios allowed', 'warning');
      return;
    }
    setScenarios(prev => [...prev, { ...EMPTY_SCENARIO }]);
    setResults(null);
  }, [scenarios.length, toast]);

  const removeScenario = useCallback((idx: number) => {
    setScenarios(prev => prev.filter((_, i) => i !== idx));
    setResults(null);
  }, []);

  const updateScenario = useCallback((idx: number, field: keyof TermScenario, value: string | number | boolean) => {
    setScenarios(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;});
    setResults(null);
  }, []);

  const runComparison = useCallback(async () => {
    // Validate
    const valid = scenarios.filter(s => s.investor_name && s.pre_money_valuation > 0 && s.investment_amount > 0);
    if (valid.length < 2) {
      toast('Add at least 2 complete scenarios to compare', 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/term-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarios: valid }),});
      if (!res.ok) {
        const err = await res.json();
        toast(err.error || 'Comparison failed', 'error');
        return;
      }
      const data: CompareResponse = await res.json();
      setResults(data);
      toast('Comparison complete');
    } catch {
      toast('Failed to run comparison', 'error');
    } finally {
      setLoading(false);
    }
  }, [scenarios, toast]);

  // -------------------------------------------------------------------------
  // Comparison table row definitions
  // -------------------------------------------------------------------------

  const ANTI_DILUTION_LABELS: Record<string, string> = {
    broad: 'Broad-based weighted avg',
    narrow: 'Narrow-based (full ratchet)',
    none: 'None',};

  interface RowDef { label: string; getValue: (r: ScenarioResult) => string; getRating: (r: ScenarioResult, all: ScenarioResult[]) => CellRating }

  const tableRows: RowDef[] = [
    {
      label: 'Pre-Money Valuation',
      getValue: r => `EUR ${formatM(r.pre_money_valuation)}`,
      getRating: (r, all) => rateHigherIsBetter(r.pre_money_valuation, all.map(a => a.pre_money_valuation)),},
    {
      label: 'Investment Amount',
      getValue: r => `EUR ${formatM(r.investment_amount)}`,
      getRating: () => 'neutral',},
    {
      label: 'Post-Money Valuation',
      getValue: r => `EUR ${formatM(r.post_money_valuation)}`,
      getRating: (r, all) => rateHigherIsBetter(r.post_money_valuation, all.map(a => a.post_money_valuation)),},
    {
      label: 'Investor Ownership',
      getValue: r => `${r.ownership_percentage.toFixed(1)}%`,
      getRating: (r, all) => rateLowerIsBetter(r.ownership_percentage, all.map(a => a.ownership_percentage)),},
    {
      label: 'Founder Dilution',
      getValue: r => `${r.dilution_to_founders.toFixed(1)}%`,
      getRating: (r, all) => rateLowerIsBetter(r.dilution_to_founders, all.map(a => a.dilution_to_founders)),},
    {
      label: 'Effective Valuation',
      getValue: r => `EUR ${formatM(r.effective_valuation)}`,
      getRating: (r, all) => rateHigherIsBetter(r.effective_valuation, all.map(a => a.effective_valuation)),},
    {
      label: 'Liquidation Preference',
      getValue: r => `${r.liquidation_preference}x${r.participation ? ' participating' : ' non-part.'}`,
      getRating: (r, all) => ratePref(r.liquidation_preference, all.map(a => a.liquidation_preference)),},
    {
      label: 'Anti-Dilution',
      getValue: r => ANTI_DILUTION_LABELS[r.anti_dilution] || r.anti_dilution,
      getRating: (r, all) => {
        const order = { none: 0, broad: 1, narrow: 2 } as Record<string, number>;
        return rateLowerIsBetter(order[r.anti_dilution] ?? 1, all.map(a => order[a.anti_dilution] ?? 1));
      },},
    {
      label: 'Board Seats',
      getValue: r => `${r.board_seats}`,
      getRating: (r, all) => rateLowerIsBetter(r.board_seats, all.map(a => a.board_seats)),},
    {
      label: 'Pro-Rata Rights',
      getValue: r => r.pro_rata_rights ? 'Yes' : 'No',
      getRating: () => 'neutral',},
    {
      label: 'Drag-Along Threshold',
      getValue: r => `${r.drag_along_threshold}%`,
      getRating: (r, all) => rateHigherIsBetter(r.drag_along_threshold, all.map(a => a.drag_along_threshold)),
    },];

  return (
    <div className="page-content space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/terms"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors"
            style={{
              background: backHover ? 'var(--surface-3)' : 'var(--surface-2)',
              color: 'var(--text-secondary)', }}
            onMouseEnter={() => setBackHover(true)}
            onMouseLeave={() => setBackHover(false)}>
            <ArrowLeft className="w-3.5 h-3.5" />
            Terms</Link>
          <div>
            <h1 className="page-title">
              Term Sheet Economics Engine</h1>
            <p className="text-sm mt-1" style={stTextMuted}>
              Compare offers, model dilution, and identify the best deal structure.</p></div></div></div>

      {/* Scenario Input Forms */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-normal  tracking-wider" style={stTextTertiary}>
            Scenarios ({scenarios.length}/5)</h2>
          <div className="flex items-center gap-2">
            {scenarios.length < 5 && (
              <button
                onClick={addScenario}
                onMouseEnter={() => setAddHover(true)}
                onMouseLeave={() => setAddHover(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-normal transition-colors"
                style={{
                  background: addHover ? 'var(--surface-3)' : 'var(--surface-2)',
                  color: 'var(--text-secondary)', }}>
                <Plus className="w-3.5 h-3.5" />
                Add Scenario</button>
            )}
            <button
              onClick={runComparison}
              disabled={loading || scenarios.filter(s => s.investor_name && s.pre_money_valuation > 0 && s.investment_amount > 0).length < 2}
              onMouseEnter={() => setCompareHover(true)}
              onMouseLeave={() => setCompareHover(false)}
              className="btn btn-primary btn-md text-sm font-normal disabled:opacity-40"
              style={{ background: compareHover && !loading ? 'var(--accent-hover)' : 'var(--accent)' }}>
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
              ) : (
                <><Scale className="w-4 h-4" /> Compare</>
              )}</button></div></div>

        {scenarios.map((scenario, idx) => (
          <div
            key={idx}
            className="rounded-xl p-5"
            style={{ background: 'var(--surface-0)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded flex items-center justify-center text-xs font-normal"
                  style={stAccentBadge}>
                  {idx + 1}</span>
                <span className="text-sm font-normal" style={stTextSecondary}>
                  {scenario.investor_name || `Scenario ${idx + 1}`}</span></div>
              {scenarios.length > 1 && (
                <button
                  onClick={() => removeScenario(idx)}
                  onMouseEnter={() => setHoveredRemove(idx)}
                  onMouseLeave={() => setHoveredRemove(null)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
                  style={{
                    color: hoveredRemove === idx ? 'var(--danger)' : 'var(--text-muted)',
                    background: hoveredRemove === idx ? 'var(--danger-muted)' : 'transparent', }}>
                  <Trash2 className="w-3 h-3" />
                  Remove</button>
              )}</div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <FormField label="Investor Name" required>
                <input
                  className="input"
                  value={scenario.investor_name}
                  onChange={e => updateScenario(idx, 'investor_name', e.target.value)}
                  placeholder="e.g., Sequoia Capital" /></FormField>

              <FormField label="Pre-Money Valuation (EUR M)" required>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={10}
                  value={scenario.pre_money_valuation || ''}
                  onChange={e => updateScenario(idx, 'pre_money_valuation', parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 2000" /></FormField>

              <FormField label="Investment Amount (EUR M)" required>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={10}
                  value={scenario.investment_amount || ''}
                  onChange={e => updateScenario(idx, 'investment_amount', parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 250" /></FormField>

              <FormField label="Liquidation Preference">
                <select
                  className="input"
                  value={scenario.liquidation_preference}
                  onChange={e => updateScenario(idx, 'liquidation_preference', parseFloat(e.target.value))}>
                  <option value={1.0}>1.0x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2.0}>2.0x</option>
                  <option value={3.0}>3.0x</option></select></FormField>

              <FormField label="Participation">
                <select
                  className="input"
                  value={scenario.participation ? 'true' : 'false'}
                  onChange={e => updateScenario(idx, 'participation', e.target.value === 'true')}>
                  <option value="false">Non-Participating</option>
                  <option value="true">Participating</option></select></FormField>

              <FormField label="Anti-Dilution">
                <select
                  className="input"
                  value={scenario.anti_dilution}
                  onChange={e => updateScenario(idx, 'anti_dilution', e.target.value)}>
                  <option value="broad">Broad-based weighted avg</option>
                  <option value="narrow">Narrow-based (full ratchet)</option>
                  <option value="none">None</option></select></FormField>

              <FormField label="Board Seats">
                <select
                  className="input"
                  value={scenario.board_seats}
                  onChange={e => updateScenario(idx, 'board_seats', parseInt(e.target.value))}>
                  <option value={0}>0 (observer only)</option>
                  <option value={1}>1 seat</option>
                  <option value={2}>2 seats</option>
                  <option value={3}>3 seats</option></select></FormField>

              <FormField label="Pro-Rata Rights">
                <select
                  className="input"
                  value={scenario.pro_rata_rights ? 'true' : 'false'}
                  onChange={e => updateScenario(idx, 'pro_rata_rights', e.target.value === 'true')}>
                  <option value="true">Yes</option>
                  <option value="false">No</option></select></FormField>

              <FormField label="Drag-Along Threshold (%)">
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={scenario.drag_along_threshold || ''}
                  onChange={e => updateScenario(idx, 'drag_along_threshold', parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 66" /></FormField></div></div>
        ))}</div>

      {/* Results */}
      {results && results.results.length >= 2 && (
        <>
          {/* Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RecoCard
              icon={<ShieldCheck className="w-5 h-5" style={stTextSecondary} />}
              label="Best for Founders"
              value={results.recommendations.best_for_founders}
              bg="var(--success-muted)"
              border="var(--accent-25)" />
            <RecoCard
              icon={<DollarSign className="w-5 h-5" style={stAccent} />}
              label="Most Capital"
              value={results.recommendations.most_capital}
              bg="var(--accent-muted)"
              border="var(--accent-muted)" />
            <RecoCard
              icon={<Trophy className="w-5 h-5" style={stTextTertiary} />}
              label="Highest Effective Valuation"
              value={results.recommendations.highest_effective_valuation}
              bg="var(--warning-muted)"
              border="var(--warn-25)" /></div>

          {/* Founder Friendly Score Bar */}
          <div
            className="rounded-xl p-5"
            style={stSurface0}>
            <h3 className="text-xs font-normal  tracking-wider mb-4" style={stTextTertiary}>
              Founder-Friendly Score</h3>
            <div className="space-y-3">
              {results.results
                .sort((a, b) => b.founder_friendly_score - a.founder_friendly_score)
                .map(r => (
                  <div key={r.investor_name} className="flex items-center gap-4">
                    <span className="text-sm font-normal w-40 truncate" style={stTextSecondary}>
                      {r.investor_name}</span>
                    <div className="flex-1 h-3 rounded-full overflow-hidden" style={stSurface2}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${r.founder_friendly_score}%`,
                          background: scoreColor(r.founder_friendly_score),
                          transition: 'width 500ms ease',
                        }} /></div>
                    <span
                      className="text-sm font-normal tabular-nums w-16 text-right"
                      style={{ color: scoreColor(r.founder_friendly_score) }}>
                      {r.founder_friendly_score}/100</span></div>
                ))}</div></div>

          {/* Comparison Table */}
          <div className="rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-header">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-normal w-44" style={stTextMuted}>
                    Term</th>
                  {results.results.map(r => (
                    <th key={r.investor_name} className="text-left px-4 py-3 text-xs font-normal min-w-40" style={stTextSecondary}>
                      {r.investor_name}</th>
                  ))}</tr></thead>
              <tbody>
                {tableRows.map(row => (
                  <tr
                    key={row.label}
                    className="transition-colors"
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: hoveredRow === row.label ? 'var(--surface-1)' : 'transparent', }}
                    onMouseEnter={() => setHoveredRow(row.label)}
                    onMouseLeave={() => setHoveredRow(null)}>
                    <td className="px-4 py-2.5 text-xs font-normal" style={stTextMuted}>
                      {row.label}</td>
                    {results.results.map(r => {
                      const rating = row.getRating(r, results.results);
                      return (
                        <td key={r.investor_name} className="px-4 py-2.5 text-xs tabular-nums" style={cellStyle(rating)}>
                          {row.getValue(r)}
                        </td>);
                    })}</tr>
                ))}

                {/* Score row */}
                <tr style={{ background: 'var(--surface-1)', borderTop: '2px solid var(--border-strong)' }}>
                  <td className="px-4 py-3 text-xs font-normal" style={stTextTertiary}>
                    Founder score</td>
                  {results.results.map(r => (
                    <td key={r.investor_name} className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-normal"
                        style={{
                          color: scoreColor(r.founder_friendly_score),
                          background: scoreBg(r.founder_friendly_score), }}>
                        {r.founder_friendly_score}/100</span></td>
                  ))}</tr></tbody></table></div>

          {/* Comparison Notes */}
          {results.results.some(r => r.comparison_notes.length > 0) && (
            <div
              className="rounded-xl p-5"
              style={stSurface0}>
              <h3 className="text-xs font-normal  tracking-wider mb-4" style={stTextTertiary}>
                Key Observations</h3>
              <div className="space-y-3">
                {results.results.filter(r => r.comparison_notes.length > 0).map((r, idx) => {
                  const isExpanded = expandedNotes.includes(idx);
                  const visibleNotes = isExpanded ? r.comparison_notes : r.comparison_notes.slice(0, 2);
                  return (
                    <div key={r.investor_name}>
                      <div className="text-sm font-normal mb-1.5" style={stTextSecondary}>
                        {r.investor_name}</div>
                      <div className="space-y-1">
                        {visibleNotes.map((note, ni) => {
                          const isWarning = note.toLowerCase().includes('punitive') ||
                            note.toLowerCase().includes('aggressive') ||
                            note.toLowerCase().includes('above market') ||
                            note.toLowerCase().includes('participating preferred') ||
                            note.toLowerCase().includes('control');
                          return (
                            <div key={ni} className="flex items-start gap-2 text-xs" style={stTextSecondary}>
                              {isWarning ? (
                                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" style={stTextTertiary} />
                              ) : (
                                <span className="w-1 h-1 rounded-full shrink-0 mt-1.5" style={{ background: 'var(--text-muted)' }}
                                  />
                              )}
                              {note}
                            </div>);
                        })}</div>
                      {r.comparison_notes.length > 2 && (
                        <button
                          onClick={() => setExpandedNotes(prev =>
                            prev.includes(idx) ? prev.filter(x => x !== idx) : [...prev, idx]
                          )}
                          className="text-xs mt-1 flex items-center gap-1"
                          style={stAccent}>
                          {isExpanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> {r.comparison_notes.length - 2} more</>}
                        </button>
                      )}
                    </div>);
                })}</div></div>
          )}

          {/* Ownership Waterfall (text-based) */}
          <div
            className="rounded-xl p-5"
            style={stSurface0}>
            <h3 className="text-xs font-normal  tracking-wider mb-4" style={stTextTertiary}>
              Ownership Waterfall</h3>
            <div className="space-y-4">
              {results.results.map(r => {
                const founderPct = 100 - r.ownership_percentage;
                return (
                  <div key={r.investor_name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-normal" style={stTextSecondary}>
                        {r.investor_name}</span>
                      <span className="text-xs tabular-nums" style={stTextMuted}>
                        Post-money: EUR {formatM(r.post_money_valuation)}</span></div>
                    <div className="flex h-6 rounded-lg overflow-hidden">
                      <div
                        className="flex items-center justify-center text-xs font-normal"
                        style={{
                          width: `${founderPct}%`,
                          background: 'var(--accent-muted)',
                          color: 'var(--accent)',
                          minWidth: founderPct > 10 ? 'auto' : '0', }}>
                        {founderPct >= 15 && `Founders ${founderPct.toFixed(1)}%`}</div>
                      <div
                        className="flex items-center justify-center text-xs font-normal"
                        style={{
                          width: `${r.ownership_percentage}%`,
                          background: 'var(--warning-muted)',
                          color: 'var(--text-tertiary)',
                          minWidth: r.ownership_percentage > 5 ? 'auto' : '0', }}>
                        {r.ownership_percentage >= 8 && `${r.ownership_percentage.toFixed(1)}%`}</div></div>
                    <div className="flex items-center gap-4 mt-1 text-xs" style={stTextMuted}>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm" style={{ background: 'var(--accent-muted)' }} />
                        Founders: {founderPct.toFixed(1)}%</span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm" style={{ background: 'var(--warning-muted)' }} />
                        {r.investor_name}: {r.ownership_percentage.toFixed(1)}%</span></div>
                  </div>);
              })}</div></div>

          {/* Generated timestamp */}
          <div className="text-center py-2" style={labelMuted10}>
            Generated {new Date(results.generated_at).toLocaleString()}</div>
        </>
      )}

      {/* Empty state when no results yet */}
      {!results && scenarios.length >= 2 && scenarios.filter(s => s.investor_name && s.pre_money_valuation > 0 && s.investment_amount > 0).length >= 2 && (
        <div
          className="rounded-xl p-8 text-center"
          style={stTextMuted}>
          <Scale className="w-8 h-8 mx-auto mb-3" style={stTextMuted} />
          <p className="text-sm">Fill in the scenarios above and click <strong>Compare</strong> to see the analysis.</p></div>
      )}
    </div>);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FormField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="label block mb-1" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
        {label}{required && <span style={stTextPrimary}> *</span>}</label>
      {children}
    </div>);
}

function RecoCard({ icon, label, value, bg, border }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
  border: string;
}) {
  return (
    <div
      className="rounded-xl p-4 flex items-center gap-3"
      style={{ background: bg, border: `1px solid ${border}` }}>
      {icon}
      <div>
        <div className="text-xs font-normal" style={stTextMuted}>{label}</div>
        <div className="text-sm font-normal" style={stTextPrimary}>{value}</div></div>
    </div>);
}

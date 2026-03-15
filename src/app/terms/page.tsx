'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/toast';
import { cachedFetch } from '@/lib/cache';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import Link from 'next/link';
import { Scale } from 'lucide-react';
import { scoreColor as getScoreColor, stSurface0, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary } from '@/lib/styles';

interface TermSheet {
  id: string;
  investor: string;
  valuation: string;
  amount: string;
  liq_pref: string;
  anti_dilution: string;
  board_seats: string;
  dividends: string;
  protective_provisions: string;
  option_pool: string;
  exclusivity: string;
  strategic_value: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

const EMPTY_TS = {
  investor: '', valuation: '', amount: '', liq_pref: '1x non-participating',
  anti_dilution: 'Broad-based weighted average', board_seats: '1 + observer',
  dividends: 'None', protective_provisions: 'Standard', option_pool: '',
  exclusivity: '', strategic_value: 3, notes: '',};

const MARKET_STANDARDS: Record<string, string> = {
  liq_pref: '1x non-participating',
  anti_dilution: 'Broad-based weighted average',
  board_seats: '1 investor seat + 1 observer',
  dividends: 'Non-cumulative or none',
  protective_provisions: 'Standard set (new issuance, sale, liquidation)',
  option_pool: '10-15% post-money',};

export default function TermsPage() {
  const { toast } = useToast();
  const [sheets, setSheets] = useState<TermSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_TS);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; investor: string } | null>(null);

  useEffect(() => { fetchSheets(); }, []);

  async function fetchSheets() {
    setLoading(true);
    try {
      const res = await cachedFetch('/api/term-sheets');
      setSheets(await res.json());
    } catch {
      toast('Failed to load term sheets', 'error');
    } finally {
      setLoading(false);
    }}

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editId) {
        const res = await fetch('/api/term-sheets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editId, ...form }),});
        if (!res.ok) throw new Error('Failed');
        toast(`${form.investor} updated`);
      } else {
        const res = await fetch('/api/term-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),});
        if (!res.ok) throw new Error('Failed');
        toast(`${form.investor} term sheet added`);
      }
      setShowForm(false);
      setEditId(null);
      setForm(EMPTY_TS);
      fetchSheets();
    } catch {
      toast('Failed to save term sheet', 'error');
    }}

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/term-sheets?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast('Term sheet deleted', 'warning');
      setDeleteTarget(null);
      fetchSheets();
    } catch {
      toast('Failed to delete term sheet', 'error');
    }}

  function startEdit(ts: TermSheet) {
    setForm({
      investor: ts.investor, valuation: ts.valuation, amount: ts.amount,
      liq_pref: ts.liq_pref, anti_dilution: ts.anti_dilution,
      board_seats: ts.board_seats, dividends: ts.dividends,
      protective_provisions: ts.protective_provisions, option_pool: ts.option_pool,
      exclusivity: ts.exclusivity, strategic_value: ts.strategic_value, notes: ts.notes,});
    setEditId(ts.id);
    setShowForm(true);
  }

  function scoreSheet(ts: TermSheet): { score: number; flags: string[] } {
    const flags: string[] = [];
    let score = 50;
    if (ts.liq_pref.toLowerCase().includes('participating')) { flags.push('Participating preferred - RED FLAG'); score -= 15; }
    if (ts.anti_dilution.toLowerCase().includes('full ratchet')) { flags.push('Full ratchet anti-dilution - RED FLAG'); score -= 15; }
    if (ts.board_seats.includes('2') || ts.board_seats.includes('3')) { flags.push('Multiple board seats - overreach'); score -= 10; }
    if (ts.dividends.toLowerCase().includes('cumulative')) { flags.push('Cumulative dividends - hidden cost'); score -= 10; }
    if (ts.liq_pref === '1x non-participating') score += 10;
    if (ts.anti_dilution === 'Broad-based weighted average') score += 10;
    score += ts.strategic_value * 6;
    return { score: Math.max(0, Math.min(100, score)), flags };
  }

  if (loading) {
    return (
      <div className="space-y-6 page-content">
        <div className="skeleton" style={{ height: '28px', width: '200px' }} />
        <div className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-xl)' }} />
      </div>);
  }

  return (
    <div className="space-y-6 page-content">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Term Sheet Comparison</h1>
          <p className="text-sm mt-1" style={stTextMuted}>
            Compare and score term sheets side-by-side. {sheets.length} received.</p></div>
        <div className="flex items-center gap-2">
          <Link
            href="/term-compare"
            className="btn btn-secondary btn-md text-sm font-normal">
            <Scale className="w-4 h-4" />
            Compare Terms</Link>
          <button
            onClick={() => { setShowForm(!showForm); setEditId(null); setForm(EMPTY_TS); }}
            className="btn btn-primary btn-md text-sm font-normal">
            + Add Term Sheet</button></div></div>

      {/* Market Standards Reference */}
      <div className="rounded-xl p-5" style={stSurface0}>
        <h3 className="text-xs font-normal mb-3" style={stTextTertiary}>Market standards (Series C)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          {Object.entries(MARKET_STANDARDS).map(([key, val]) => (
            <div key={key}>
              <span style={stTextMuted}>{key.replace(/_/g, ' ')}:</span>
              <span className="ml-1" style={stTextSecondary}>{val}</span></div>
          ))}</div></div>

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl p-6 space-y-4" style={stSurface0}>
          <h3 className="text-sm font-normal" style={stTextTertiary}>{editId ? 'Edit' : 'Add'} term sheet</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TsInput label="Investor" value={form.investor} onChange={v => setForm(f => ({ ...f, investor: v }))} required />
            <TsInput label="Pre-Money Valuation" value={form.valuation} onChange={v => setForm(f => ({ ...f, valuation: v }))} placeholder="e.g., 2.0Bn"
              />
            <TsInput label="Investment Amount" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} placeholder="e.g., 250M"
              />
            <TsInput label="Liquidation Preference" value={form.liq_pref} onChange={v => setForm(f => ({ ...f, liq_pref: v }))} />
            <TsInput label="Anti-Dilution" value={form.anti_dilution} onChange={v => setForm(f => ({ ...f, anti_dilution: v }))}/>
            <TsInput label="Board Seats" value={form.board_seats} onChange={v => setForm(f => ({ ...f, board_seats: v }))} />
            <TsInput label="Dividends" value={form.dividends} onChange={v => setForm(f => ({ ...f, dividends: v }))} />
            <TsInput label="Protective Provisions" value={form.protective_provisions} onChange={v => setForm(f => ({ ...f, protective_provisions: v }))}
              />
            <TsInput label="Option Pool" value={form.option_pool} onChange={v => setForm(f => ({ ...f, option_pool: v }))} placeholder="e.g., 12%"
              />
            <TsInput label="Exclusivity" value={form.exclusivity} onChange={v => setForm(f => ({ ...f, exclusivity: v }))} placeholder="e.g., 14 days"
              />
            <div>
              <label className="label block mb-1" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>Strategic Value (1-5)</label>
              <input type="range" min="1" max="5" value={form.strategic_value}
                onChange={e => setForm(f => ({ ...f, strategic_value: Number(e.target.value) }))}
                className="w-full" />
              <div className="text-xs text-center" style={stTextMuted}>{form.strategic_value}/5</div></div></div>
          <TsInput label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary btn-md text-sm font-normal">
              {editId ? 'Update' : 'Add'}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="btn btn-secondary btn-md text-sm">
              Cancel</button></div></form>
      )}

      {/* Comparison Table */}
      {sheets.length > 0 && (
        <div className="rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-header">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-normal w-40" style={stTextMuted}>Term</th>
                {sheets.map(ts => (
                  <th key={ts.id} className="text-left px-4 py-3 text-xs font-normal min-w-48" style={stTextSecondary}>
                    <div className="flex items-center justify-between gap-2">
                      {ts.investor}
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => startEdit(ts)} className="text-xs transition-colors" style={stTextMuted}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>Edit</button>
                        <button onClick={() => setDeleteTarget({ id: ts.id, investor: ts.investor })} className="text-xs transition-colors" style={stTextMuted}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>Del</button></div></div></th>
                ))}
                <th className="text-left px-4 py-3 text-xs font-normal" style={stTextMuted}>Market Standard</th></tr></thead>
            <tbody>
              {([
                ['Valuation', 'valuation'],
                ['Amount', 'amount'],
                ['Liq. Pref', 'liq_pref'],
                ['Anti-Dilution', 'anti_dilution'],
                ['Board Seats', 'board_seats'],
                ['Dividends', 'dividends'],
                ['Protective Provisions', 'protective_provisions'],
                ['Option Pool', 'option_pool'],
                ['Exclusivity', 'exclusivity'],
              ] as const).map(([label, key]) => (
                <tr key={key} className="table-row">
                  <td className="px-4 py-2.5 text-xs" style={stTextMuted}>{label}</td>
                  {sheets.map(ts => {
                    const val = ts[key as keyof TermSheet] as string;
                    const standard = MARKET_STANDARDS[key];
                    const isStandard = standard && val.toLowerCase() === standard.toLowerCase();
                    return (
                      <td key={ts.id} className="px-4 py-2.5 text-xs" style={{ color: isStandard ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {val || '\u2014'}
                      </td>);
                  })}
                  <td className="px-4 py-2.5 text-xs" style={stTextMuted}>{MARKET_STANDARDS[key] || '\u2014'}</td></tr>
              ))}
              {/* Score Row */}
              <tr style={{ background: 'var(--surface-1)', borderTop: '2px solid var(--border-strong)' }}>
                <td className="px-4 py-3 text-xs font-normal" style={stTextTertiary}>Score</td>
                {sheets.map(ts => {
                  const { score, flags } = scoreSheet(ts);
                  return (
                    <td key={ts.id} className="px-4 py-3">
                      <div className="text-lg font-normal" style={{ color: getScoreColor(score) }}>
                        {score}/100</div>
                      {flags.map((f, i) => (
                        <div key={i} className="text-xs mt-1" style={stTextPrimary}>{f}</div>
                      ))}
                    </td>);
                })}
                <td className="px-4 py-3 text-xs" style={stTextMuted}>Benchmark</td></tr>
              {/* Action Row */}
              <tr style={{ background: 'var(--surface-0)', borderTop: '1px solid var(--border-subtle)' }}>
                <td className="px-4 py-3 text-xs font-normal" style={stTextTertiary}>ACTION</td>
                {sheets.map(ts => {
                  const { score, flags } = scoreSheet(ts);
                  const action = score >= 70
                    ? { label: 'Accept & Close', color: 'var(--text-secondary)', bg: 'var(--success-muted)', advice: 'Strong terms. Move to closing.' }
                    : score >= 50
                    ? { label: 'Negotiate', color: 'var(--text-tertiary)', bg: 'var(--warning-muted)', advice: flags.length > 0 ? `Address: ${flags[0].split(' - ')[0]}` : 'Push for better terms on weak points.' }
                    : { label: 'Push Back', color: 'var(--text-primary)', bg: 'var(--danger-muted)', advice: `${flags.length} red flag${flags.length !== 1 ? 's' : ''} — counter-propose standard terms.` };
                  return (
                    <td key={ts.id} className="px-4 py-3">
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: '10px',
                          fontWeight: 400,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: action.bg,
                          color: action.color,
                          marginBottom: '4px', }}>
                        {action.label}</span>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {action.advice}</div>
                    </td>);
                })}
                <td className="px-4 py-3 text-xs" style={stTextMuted}>—</td></tr></tbody></table></div>
      )}

      {sheets.length === 0 && !showForm && (
        <div className="rounded-xl p-8 text-center text-sm" style={stTextMuted}>
          No term sheets yet. Add them as they come in for side-by-side comparison.</div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete term sheet"
        message={`Delete the term sheet from "${deleteTarget?.investor}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)} />
    </div>);
}

function TsInput({ label, value, onChange, required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="label block mb-1" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder}
        className="input" />
    </div>);
}

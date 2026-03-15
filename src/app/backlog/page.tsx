'use client';

import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/toast';
import { cachedFetch } from '@/lib/cache';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Plus, Trash2, DollarSign, ShieldCheck, AlertTriangle, TrendingUp, FileText } from 'lucide-react';
import { stAccent, stSurface1, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary } from '@/lib/styles';

interface Commitment {
  id: string;
  customer: string;
  program: string;
  contract_type: string;
  amount_eur: number;
  start_date: string;
  end_date: string;
  annual_amount: number | null;
  confidence: number;
  status: string;
  source_doc: string;
  notes: string;
  created_at: string;
}

interface Summary {
  total_committed_eur: number;
  probability_weighted_eur: number;
  by_type: Record<string, number>;
  count: number;
}

const TYPE_LABELS: Record<string, string> = {
  firm: 'Firm Contract',
  framework: 'Framework Agreement',
  loi: 'Letter of Intent',
  pipeline: 'Pipeline (Not Signed)',
  recurring: 'Recurring Revenue',};

const CONFIDENCE_COLORS: Record<string, React.CSSProperties> = {
  high: { background: 'var(--success-muted)', color: 'var(--text-secondary)' },
  medium: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  low: { background: 'var(--danger-muted)', color: 'var(--text-primary)' },};

function formatEur(n: number): string {
  if (n >= 1e9) return `€${(n / 1e9).toFixed(1)}Bn`;
  if (n >= 1e6) return `€${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `€${(n / 1e3).toFixed(0)}K`;
  return `€${n.toFixed(0)}`;
}

function confidenceLevel(c: number): string {
  if (c >= 0.8) return 'high';
  if (c >= 0.5) return 'medium';
  return 'low';
}

export default function BacklogPage() {
  const { toast } = useToast();
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer: '', program: '', contract_type: 'firm', amount_eur: '',
    start_date: '', end_date: '', annual_amount: '', confidence: '0.9',
    source_doc: '', notes: '', status: 'active',});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cachedFetch('/api/revenue-commitments');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setCommitments(data.commitments);
      setSummary(data.summary);
    } catch {
      toast('Failed to load backlog', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showAdd) setShowAdd(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showAdd]);

  async function handleAdd() {
    if (!form.customer || !form.amount_eur) { toast('Customer and amount required', 'error'); return; }
    setAdding(true);
    try {
      const res = await fetch('/api/revenue-commitments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount_eur: parseFloat(form.amount_eur) * 1e6,
          annual_amount: form.annual_amount ? parseFloat(form.annual_amount) * 1e6 : null,
          confidence: parseFloat(form.confidence),
        }),});
      if (!res.ok) throw new Error('Failed');
      const created = await res.json();
      toast('Commitment added', 'success');
      setShowAdd(false);
      setForm({ customer: '', program: '', contract_type: 'firm', amount_eur: '', start_date: '', end_date: '', annual_amount: '', confidence: '0.9', source_doc: '', notes: '', status: 'active' });
      setCommitments(prev => [created, ...prev]);
      // Refresh summary in background (no loading spinner)
      cachedFetch('/api/revenue-commitments').then(r => r.ok ? r.json() : null).then(d => { if (d) setSummary(d.summary); }).catch(() => {});
    } catch {
      toast('Failed to add', 'error');
    }
    setAdding(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const targetId = deleteTarget;
      setDeleteTarget(null);
      setCommitments(prev => prev.filter(c => c.id !== targetId));
      const res = await fetch(`/api/revenue-commitments?id=${targetId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast('Deleted', 'warning');
      // Refresh summary in background
      cachedFetch('/api/revenue-commitments').then(r => r.ok ? r.json() : null).then(d => { if (d) setSummary(d.summary); }).catch(() => {});
    } catch {
      toast('Failed to delete', 'error');
    }}

  if (loading) {
    return (
      <div className="space-y-4 page-content">
        <div className="skeleton" style={{ height: '28px', width: '200px' }} />
        <div className="skeleton" style={{ height: '16px', width: '350px' }} />
        {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '64px', borderRadius: 'var(--radius-lg)' }} />)}
      </div>);
  }

  return (
    <div className="page-content space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Revenue Backlog</h1>
          <p className="text-sm mt-1" style={stTextMuted}>
            {summary?.count || 0} commitments &middot; {formatEur(summary?.total_committed_eur || 0)} total &middot; {formatEur(summary?.probability_weighted_eur || 0)} probability-weighted
          </p></div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary btn-md flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Commitment</button></div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-3 card-stagger">
          <div className="rounded-lg p-4" style={stSurface1}>
            <div className="text-xs  font-normal flex items-center gap-1" style={stTextMuted}><DollarSign className="w-3 h-3" /> Total Committed</div>
            <div className="text-2xl font-normal mt-1" style={stTextPrimary}>{formatEur(summary.total_committed_eur)}</div></div>
          <div className="rounded-lg p-4" style={stSurface1}>
            <div className="text-xs  font-normal flex items-center gap-1" style={stTextMuted}><ShieldCheck className="w-3 h-3" /> Probability-Weighted</div>
            <div className="text-2xl font-normal mt-1" style={stTextSecondary}>{formatEur(summary.probability_weighted_eur)}</div>
          </div>
          <div className="rounded-lg p-4" style={stSurface1}>
            <div className="text-xs  font-normal flex items-center gap-1" style={stTextMuted}><TrendingUp className="w-3 h-3" /> Firm Contracts</div>
            <div className="text-2xl font-normal mt-1" style={stAccent}>{formatEur(summary.by_type?.firm || 0)}</div></div>
          <div className="rounded-lg p-4" style={stSurface1}>
            <div className="text-xs  font-normal flex items-center gap-1" style={stTextMuted}><AlertTriangle className="w-3 h-3" /> Pipeline (Unsigned)</div>
            <div className="text-2xl font-normal mt-1" style={stTextTertiary}>{formatEur(summary.by_type?.pipeline || 0)}</div>
          </div></div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="rounded-xl p-4 space-y-3" style={stSurface1}>
          <h3 className="text-sm font-normal" style={stTextPrimary}>Add Revenue Commitment</h3>
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="e.g., ESA, Belgian MoD" value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} className="input" autoFocus
              />
            <input placeholder="e.g., IRIS2 Phase 2" value={form.program} onChange={e => setForm(f => ({ ...f, program: e.target.value }))} className="input"
              />
            <select value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))} className="input">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input type="number" placeholder="Total Amount (€M)" value={form.amount_eur} onChange={e => setForm(f => ({ ...f, amount_eur: e.target.value }))} className="input"
              />
            <input type="number" placeholder="Annual Amount (€M)" value={form.annual_amount} onChange={e => setForm(f => ({ ...f, annual_amount: e.target.value }))} className="input"
              />
            <input type="number" step="0.05" min="0" max="1" placeholder="Confidence (0.9 = signed)" value={form.confidence} onChange={e => setForm(f => ({ ...f, confidence: e.target.value }))} className="input"
              />
            <input type="date" placeholder="Start Date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="input"
              />
            <input type="date" placeholder="End Date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="input"
              />
            <input placeholder="e.g., signed contract, LOI" value={form.source_doc} onChange={e => setForm(f => ({ ...f, source_doc: e.target.value }))} className="input"
              /></div>
          <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input" rows={2}
            />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={adding} className="btn btn-primary btn-md">{adding ? 'Adding...' : 'Add Commitment'}</button>
            <button onClick={() => setShowAdd(false)} className="btn btn-secondary btn-md">Cancel</button></div></div>
      )}

      {/* Commitments table */}
      {commitments.length === 0 ? (
        <div className="rounded-xl p-8 text-center space-y-3">
          <DollarSign className="w-8 h-8 mx-auto" style={stTextMuted} />
          <p style={stTextMuted}>No revenue commitments tracked yet.</p>
          <p className="text-sm" style={stTextTertiary}>Add your contracted backlog to enable auditable drill-down during DD.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Program</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Total (€M)</th>
                <th className="text-right px-4 py-3">Annual (€M)</th>
                <th className="text-center px-4 py-3">Confidence</th>
                <th className="text-left px-4 py-3">Timeline</th>
                <th className="text-left px-4 py-3">Source</th>
                <th className="px-4 py-3"></th></tr></thead>
            <tbody>
              {commitments.map(c => {
                const conf = confidenceLevel(c.confidence);
                return (
                  <tr key={c.id} className="table-row">
                    <td className="px-4 py-3 font-normal" style={stTextPrimary}>{c.customer}</td>
                    <td className="px-4 py-3" style={stTextSecondary}>{c.program || '—'}</td>
                    <td className="px-4 py-3"><span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{TYPE_LABELS[c.contract_type] || c.contract_type}</span></td>
                    <td className="px-4 py-3 text-right font-mono" style={stTextPrimary}>{(c.amount_eur / 1e6).toFixed(0)}</td>
                    <td className="px-4 py-3 text-right font-mono" style={stTextMuted}>{c.annual_amount ? (c.annual_amount / 1e6).toFixed(0) : '—'}</td>
                    <td className="px-4 py-3 text-center"><span className="text-xs px-1.5 py-0.5 rounded font-normal" style={CONFIDENCE_COLORS[conf]}>{(c.confidence * 100).toFixed(0)}%</span></td>
                    <td className="px-4 py-3 text-xs" style={stTextMuted}>{c.start_date && c.end_date ? `${c.start_date.slice(0, 7)} → ${c.end_date.slice(0, 7)}` : c.start_date || '—'}</td>
                    <td className="px-4 py-3 text-xs" style={stTextMuted}>{c.source_doc ? <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{c.source_doc}</span> : '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDeleteTarget(c.id)} className="btn btn-ghost p-1 rounded" style={stTextMuted} aria-label="Delete commitment" title="Delete commitment"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>);
              })}</tbody></table></div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete commitment"
        message="Remove this revenue commitment? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)} />
    </div>);
}

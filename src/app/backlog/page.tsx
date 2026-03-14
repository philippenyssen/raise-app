'use client';

import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Plus, Trash2, DollarSign, ShieldCheck, AlertTriangle, TrendingUp, FileText } from 'lucide-react';

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
  recurring: 'Recurring Revenue',
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-green-900/30 text-green-400',
  medium: 'bg-yellow-900/30 text-yellow-400',
  low: 'bg-red-900/30 text-red-400',
};

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
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer: '', program: '', contract_type: 'firm', amount_eur: '',
    start_date: '', end_date: '', annual_amount: '', confidence: '0.9',
    source_doc: '', notes: '', status: 'active',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/revenue-commitments');
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

  async function handleAdd() {
    if (!form.customer || !form.amount_eur) { toast('Customer and amount required', 'error'); return; }
    try {
      await fetch('/api/revenue-commitments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount_eur: parseFloat(form.amount_eur) * 1e6,
          annual_amount: form.annual_amount ? parseFloat(form.annual_amount) * 1e6 : null,
          confidence: parseFloat(form.confidence),
        }),
      });
      toast('Commitment added', 'success');
      setShowAdd(false);
      setForm({ customer: '', program: '', contract_type: 'firm', amount_eur: '', start_date: '', end_date: '', annual_amount: '', confidence: '0.9', source_doc: '', notes: '', status: 'active' });
      fetchData();
    } catch {
      toast('Failed to add', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/revenue-commitments?id=${deleteTarget}`, { method: 'DELETE' });
      toast('Deleted', 'warning');
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast('Failed to delete', 'error');
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-zinc-800/50 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue Backlog</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {summary?.count || 0} commitments &middot; {formatEur(summary?.total_committed_eur || 0)} total &middot; {formatEur(summary?.probability_weighted_eur || 0)} probability-weighted
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Commitment
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            <div className="text-[10px] text-zinc-500 uppercase font-medium flex items-center gap-1"><DollarSign className="w-3 h-3" /> Total Committed</div>
            <div className="text-2xl font-bold mt-1 text-white">{formatEur(summary.total_committed_eur)}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            <div className="text-[10px] text-zinc-500 uppercase font-medium flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Probability-Weighted</div>
            <div className="text-2xl font-bold mt-1 text-green-400">{formatEur(summary.probability_weighted_eur)}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            <div className="text-[10px] text-zinc-500 uppercase font-medium flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Firm Contracts</div>
            <div className="text-2xl font-bold mt-1 text-blue-400">{formatEur(summary.by_type?.firm || 0)}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            <div className="text-[10px] text-zinc-500 uppercase font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Pipeline (Unsigned)</div>
            <div className="text-2xl font-bold mt-1 text-yellow-400">{formatEur(summary.by_type?.pipeline || 0)}</div>
          </div>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="border border-zinc-800 rounded-xl p-4 space-y-3 bg-zinc-900/50">
          <h3 className="text-sm font-medium">Add Revenue Commitment</h3>
          <div className="grid grid-cols-3 gap-3">
            <input placeholder="Customer" value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" />
            <input placeholder="Program/Contract" value={form.program} onChange={e => setForm(f => ({ ...f, program: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" />
            <select value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="number" placeholder="Total Amount (€M)" value={form.amount_eur} onChange={e => setForm(f => ({ ...f, amount_eur: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" />
            <input type="number" placeholder="Annual Amount (€M)" value={form.annual_amount} onChange={e => setForm(f => ({ ...f, annual_amount: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" />
            <input type="number" step="0.05" min="0" max="1" placeholder="Confidence (0-1)" value={form.confidence} onChange={e => setForm(f => ({ ...f, confidence: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" />
            <input type="date" placeholder="Start Date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" />
            <input type="date" placeholder="End Date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" />
            <input placeholder="Source Document" value={form.source_doc} onChange={e => setForm(f => ({ ...f, source_doc: e.target.value }))} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" />
          </div>
          <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" rows={2} />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium">Save</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm text-zinc-400">Cancel</button>
          </div>
        </div>
      )}

      {/* Commitments table */}
      {commitments.length === 0 ? (
        <div className="border border-zinc-800 rounded-xl p-8 text-center space-y-3">
          <DollarSign className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-zinc-500">No revenue commitments tracked yet.</p>
          <p className="text-zinc-600 text-sm">Add your contracted backlog to enable auditable drill-down during DD.</p>
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Program</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Total (€M)</th>
                <th className="text-right px-4 py-3">Annual (€M)</th>
                <th className="text-center px-4 py-3">Confidence</th>
                <th className="text-left px-4 py-3">Timeline</th>
                <th className="text-left px-4 py-3">Source</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {commitments.map(c => {
                const conf = confidenceLevel(c.confidence);
                return (
                  <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-medium">{c.customer}</td>
                    <td className="px-4 py-3 text-zinc-400">{c.program || '—'}</td>
                    <td className="px-4 py-3"><span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{TYPE_LABELS[c.contract_type] || c.contract_type}</span></td>
                    <td className="px-4 py-3 text-right font-mono">{(c.amount_eur / 1e6).toFixed(0)}</td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-500">{c.annual_amount ? (c.annual_amount / 1e6).toFixed(0) : '—'}</td>
                    <td className="px-4 py-3 text-center"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CONFIDENCE_COLORS[conf]}`}>{(c.confidence * 100).toFixed(0)}%</span></td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{c.start_date && c.end_date ? `${c.start_date.slice(0, 7)} → ${c.end_date.slice(0, 7)}` : c.start_date || '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{c.source_doc ? <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{c.source_doc}</span> : '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDeleteTarget(c.id)} className="text-zinc-600 hover:text-red-400 p-1 rounded hover:bg-zinc-800"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete commitment"
        message="Remove this revenue commitment? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

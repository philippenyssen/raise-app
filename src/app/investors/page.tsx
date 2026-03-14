'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Investor, InvestorStatus, InvestorTier, InvestorType } from '@/lib/types';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';

const STATUS_LABELS: Record<InvestorStatus, string> = {
  identified: 'Identified', contacted: 'Contacted', nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Set', met: 'Met', engaged: 'Engaged',
  in_dd: 'In DD', term_sheet: 'Term Sheet', closed: 'Closed',
  passed: 'Passed', dropped: 'Dropped',
};

const STATUS_COLORS: Record<string, string> = {
  identified: 'bg-zinc-700', contacted: 'bg-zinc-600', nda_signed: 'bg-blue-900',
  meeting_scheduled: 'bg-blue-800', met: 'bg-blue-700', engaged: 'bg-purple-700',
  in_dd: 'bg-orange-700', term_sheet: 'bg-green-700', closed: 'bg-emerald-700',
  passed: 'bg-red-800', dropped: 'bg-zinc-800',
};

const TYPE_LABELS: Record<InvestorType, string> = {
  vc: 'VC', growth: 'Growth', sovereign: 'Sovereign', strategic: 'Strategic',
  debt: 'Debt', family_office: 'Family Office',
};

export default function InvestorsPage() {
  const { toast } = useToast();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ tier?: number; status?: string; type?: string }>({});
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({
    name: '', type: 'vc' as InvestorType, tier: 2 as InvestorTier, partner: '',
    fund_size: '', check_size_range: '', sector_thesis: '', warm_path: '',
    ic_process: '', speed: 'medium' as 'fast' | 'medium' | 'slow',
    portfolio_conflicts: '', notes: '',
  });

  useEffect(() => { fetchInvestors(); }, []);

  async function fetchInvestors() {
    setLoading(true);
    const res = await fetch('/api/investors');
    setInvestors(await res.json());
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      await fetch('/api/investors', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...form }) });
      toast(`${form.name} updated`);
    } else {
      await fetch('/api/investors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      toast(`${form.name} added`);
    }
    setShowForm(false);
    setEditId(null);
    setForm({ name: '', type: 'vc', tier: 2, partner: '', fund_size: '', check_size_range: '', sector_thesis: '', warm_path: '', ic_process: '', speed: 'medium', portfolio_conflicts: '', notes: '' });
    fetchInvestors();
  }

  async function updateStatus(id: string, status: string) {
    await fetch('/api/investors', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    toast(`Status updated to ${STATUS_LABELS[status as InvestorStatus] || status}`);
    fetchInvestors();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/investors?id=${deleteTarget.id}`, { method: 'DELETE' });
    toast('Investor deleted', 'warning');
    setDeleteTarget(null);
    fetchInvestors();
  }

  function startEdit(inv: Investor) {
    setForm({
      name: inv.name, type: inv.type as InvestorType, tier: inv.tier as InvestorTier,
      partner: inv.partner, fund_size: inv.fund_size, check_size_range: inv.check_size_range,
      sector_thesis: inv.sector_thesis, warm_path: inv.warm_path, ic_process: inv.ic_process,
      speed: inv.speed as 'fast' | 'medium' | 'slow',
      portfolio_conflicts: inv.portfolio_conflicts, notes: inv.notes,
    });
    setEditId(inv.id);
    setShowForm(true);
  }

  const filtered = investors.filter(i => {
    if (filter.tier && i.tier !== filter.tier) return false;
    if (filter.status && i.status !== filter.status) return false;
    if (filter.type && i.type !== filter.type) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-zinc-800/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investor CRM</h1>
          <p className="text-zinc-500 text-sm mt-1">{investors.length} investors tracked</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditId(null); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
        >
          + Add Investor
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select value={filter.tier ?? ''} onChange={e => setFilter(f => ({ ...f, tier: e.target.value ? Number(e.target.value) : undefined }))} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300">
          <option value="">All Tiers</option>
          <option value="1">Tier 1</option><option value="2">Tier 2</option>
          <option value="3">Tier 3</option><option value="4">Tier 4</option>
        </select>
        <select value={filter.status ?? ''} onChange={e => setFilter(f => ({ ...f, status: e.target.value || undefined }))} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filter.type ?? ''} onChange={e => setFilter(f => ({ ...f, type: e.target.value || undefined }))} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-300">
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(filter.tier || filter.status || filter.type) && (
          <button onClick={() => setFilter({})} className="text-xs text-zinc-500 hover:text-zinc-300 px-2">Clear</button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="border border-zinc-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-medium text-zinc-400">{editId ? 'EDIT' : 'ADD'} INVESTOR</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
            <Select label="Type" value={form.type} onChange={v => setForm(f => ({ ...f, type: v as InvestorType }))} options={Object.entries(TYPE_LABELS)} />
            <Select label="Tier" value={String(form.tier)} onChange={v => setForm(f => ({ ...f, tier: Number(v) as InvestorTier }))} options={[['1','Tier 1'],['2','Tier 2'],['3','Tier 3'],['4','Tier 4']]} />
            <Input label="Key Partner" value={form.partner} onChange={v => setForm(f => ({ ...f, partner: v }))} />
            <Input label="Fund Size" value={form.fund_size} onChange={v => setForm(f => ({ ...f, fund_size: v }))} />
            <Input label="Check Size Range" value={form.check_size_range} onChange={v => setForm(f => ({ ...f, check_size_range: v }))} />
            <Input label="Warm Path" value={form.warm_path} onChange={v => setForm(f => ({ ...f, warm_path: v }))} />
            <Select label="Speed" value={form.speed} onChange={v => setForm(f => ({ ...f, speed: v as 'fast' | 'medium' | 'slow' }))} options={[['fast','Fast'],['medium','Medium'],['slow','Slow']]} />
            <Input label="IC Process" value={form.ic_process} onChange={v => setForm(f => ({ ...f, ic_process: v }))} />
          </div>
          <Input label="Sector Thesis" value={form.sector_thesis} onChange={v => setForm(f => ({ ...f, sector_thesis: v }))} />
          <Input label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} />
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">
              {editId ? 'Update' : 'Add'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Investor Table */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/50 border-b border-zinc-800">
            <tr>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Investor</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Type</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Tier</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Partner</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Check Size</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Enthusiasm</th>
              <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {filtered.map(inv => (
              <tr key={inv.id} className="hover:bg-zinc-900/30 transition-colors">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/investors/${inv.id}`} className="hover:text-blue-400 transition-colors">
                    {inv.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-400">{TYPE_LABELS[inv.type as InvestorType] ?? inv.type}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    inv.tier === 1 ? 'bg-blue-600/20 text-blue-400' :
                    inv.tier === 2 ? 'bg-purple-600/20 text-purple-400' :
                    inv.tier === 3 ? 'bg-zinc-600/20 text-zinc-400' : 'bg-zinc-800 text-zinc-500'
                  }`}>T{inv.tier}</span>
                </td>
                <td className="px-4 py-3 text-zinc-400">{inv.partner || '---'}</td>
                <td className="px-4 py-3">
                  <select
                    value={inv.status}
                    onChange={e => updateStatus(inv.id, e.target.value)}
                    className={`${STATUS_COLORS[inv.status] || 'bg-zinc-700'} rounded px-2 py-1 text-xs font-medium border-0 cursor-pointer`}
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{inv.check_size_range || '---'}</td>
                <td className="px-4 py-3">
                  {inv.enthusiasm > 0 ? (
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <div key={n} className={`w-2 h-2 rounded-full ${n <= inv.enthusiasm ? 'bg-blue-500' : 'bg-zinc-800'}`} />
                      ))}
                    </div>
                  ) : <span className="text-zinc-600">---</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(inv)} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800">Edit</button>
                    <button onClick={() => setDeleteTarget({ id: inv.id, name: inv.name })} className="text-xs text-zinc-500 hover:text-red-400 px-2 py-1 rounded hover:bg-zinc-800">Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-zinc-600 text-sm">No investors match filters</div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete investor"
        message={`Delete "${deleteTarget?.name}" and all their meetings? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function Input({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="text-xs text-zinc-500 block mb-1">{label}</label>
      <input
        value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600 text-zinc-200"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div>
      <label className="text-xs text-zinc-500 block mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600 text-zinc-200">
        {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  );
}

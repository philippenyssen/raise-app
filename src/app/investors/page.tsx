'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Investor, InvestorStatus, InvestorTier, InvestorType } from '@/lib/types';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Search, Download, GitCompare, Columns3, Clock, Pencil, Trash2 } from 'lucide-react';
import { fmtDate } from '@/lib/format';

const STATUS_LABELS: Record<InvestorStatus, string> = {
  identified: 'Identified', contacted: 'Contacted', nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Set', met: 'Met', engaged: 'Engaged',
  in_dd: 'In DD', term_sheet: 'Term Sheet', closed: 'Closed',
  passed: 'Passed', dropped: 'Dropped',
};

const STATUS_STYLES: Record<string, { background: string; color: string }> = {
  identified: { background: 'var(--surface-3)', color: 'var(--text-secondary)' },
  contacted: { background: 'var(--border-strong)', color: 'var(--text-primary)' },
  nda_signed: { background: 'var(--accent-muted)', color: 'var(--accent)' },
  meeting_scheduled: { background: 'var(--accent-muted)', color: 'var(--accent)' },
  met: { background: 'var(--accent-10)', color: 'var(--accent)' },
  engaged: { background: 'var(--cat-25)', color: 'var(--chart-4)' },
  in_dd: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  term_sheet: { background: 'var(--success-muted)', color: 'var(--text-secondary)' },
  closed: { background: 'var(--accent-muted)', color: 'var(--accent)' },
  passed: { background: 'var(--danger-muted)', color: 'var(--text-primary)' },
  dropped: { background: 'var(--surface-2)', color: 'var(--text-muted)' },
};

const TYPE_LABELS: Record<InvestorType, string> = {
  vc: 'VC', growth: 'Growth', sovereign: 'Sovereign', strategic: 'Strategic',
  debt: 'Debt', family_office: 'Family Office',
};

const COMPLETENESS_FIELDS = ['partner', 'fund_size', 'check_size_range', 'sector_thesis', 'warm_path', 'ic_process', 'portfolio_conflicts'] as const;

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function stalenessStyle(days: number | null): { color: string; label: string } {
  if (days === null) return { color: 'var(--text-muted)', label: 'Never' };
  if (days <= 3) return { color: 'var(--text-secondary)', label: days === 0 ? 'Today' : days === 1 ? '1d ago' : `${days}d ago` };
  if (days <= 7) return { color: 'var(--text-secondary)', label: `${days}d ago` };
  if (days <= 14) return { color: 'var(--text-tertiary)', label: `${days}d ago` };
  return { color: 'var(--text-primary)', label: `${days}d ago` };
}

function computeCompleteness(inv: Investor): number {
  let filled = 0;
  for (const field of COMPLETENESS_FIELDS) {
    const val = inv[field as keyof Investor];
    if (val && typeof val === 'string' && val.trim().length > 0) filled++;
  }
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
}

export default function InvestorsPage() {
  const { toast } = useToast();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ tier?: number; status?: string; type?: string }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', type: 'vc' as InvestorType, tier: 2 as InvestorTier, partner: '',
    fund_size: '', check_size_range: '', sector_thesis: '', warm_path: '',
    ic_process: '', speed: 'medium' as 'fast' | 'medium' | 'slow',
    portfolio_conflicts: '', notes: '',
  });

  useEffect(() => { fetchInvestors(); }, []);

  async function fetchInvestors() {
    setLoading(true);
    try {
      const res = await fetch('/api/investors');
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setInvestors(await res.json());
    } catch {
      toast('Couldn\'t load investors — check your connection and refresh', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const method = editId ? 'PUT' : 'POST';
      const body = editId ? { id: editId, ...form } : form;
      const res = await fetch('/api/investors', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      toast(editId ? `${form.name} updated` : `${form.name} added`);
      setShowForm(false);
      setEditId(null);
      setForm({ name: '', type: 'vc', tier: 2, partner: '', fund_size: '', check_size_range: '', sector_thesis: '', warm_path: '', ic_process: '', speed: 'medium', portfolio_conflicts: '', notes: '' });
      fetchInvestors();
    } catch {
      toast('Failed to save investor', 'error');
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch('/api/investors', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      toast(`Status updated to ${STATUS_LABELS[status as InvestorStatus] || status}`);
      fetchInvestors();
    } catch {
      toast('Failed to update status', 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/investors?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      toast('Investor deleted', 'warning');
      setDeleteTarget(null);
      fetchInvestors();
    } catch {
      toast('Failed to delete investor', 'error');
      setDeleteTarget(null);
    }
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
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!i.name.toLowerCase().includes(q) && !i.partner.toLowerCase().includes(q) && !(i.notes || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  async function bulkUpdateStatus(newStatus: string) {
    try {
      for (const id of selected) {
        const res = await fetch('/api/investors', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: newStatus }) });
        if (!res.ok) throw new Error(`Failed for ${id}`);
      }
      toast(`Updated ${selected.size} investors to ${STATUS_LABELS[newStatus as InvestorStatus] || newStatus}`);
      setSelected(new Set());
      fetchInvestors();
    } catch {
      toast('Some updates failed', 'error');
      fetchInvestors();
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(i => i.id)));
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton" style={{ height: '2rem', width: '12rem' }} />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '3rem' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-content space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Investor CRM</h1>
          <p className="page-subtitle">{investors.length} investors tracked</p>
        </div>
        <div className="flex gap-2">
          <Link href="/pipeline" className="btn btn-secondary btn-md">
            <Columns3 className="w-3.5 h-3.5" /> Pipeline
          </Link>
          <Link href="/compare" className="btn btn-secondary btn-md">
            <GitCompare className="w-3.5 h-3.5" /> Compare
          </Link>
          <a href="/api/export?type=investors" download className="btn btn-secondary btn-md">
            <Download className="w-3.5 h-3.5" /> CSV
          </a>
          <button
            onClick={() => { setShowForm(!showForm); setEditId(null); }}
            className="btn btn-primary btn-md"
          >
            + Add Investor
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Find by name, firm, or deal focus..."
            className="input"
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
        <select
          value={filter.tier ?? ''}
          onChange={e => setFilter(f => ({ ...f, tier: e.target.value ? Number(e.target.value) : undefined }))}
          className="input"
          style={{ width: 'auto' }}
        >
          <option value="">All Tiers</option>
          <option value="1">Tier 1</option><option value="2">Tier 2</option>
          <option value="3">Tier 3</option><option value="4">Tier 4</option>
        </select>
        <select
          value={filter.status ?? ''}
          onChange={e => setFilter(f => ({ ...f, status: e.target.value || undefined }))}
          className="input"
          style={{ width: 'auto' }}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          value={filter.type ?? ''}
          onChange={e => setFilter(f => ({ ...f, type: e.target.value || undefined }))}
          className="input"
          style={{ width: 'auto' }}
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(filter.tier || filter.status || filter.type || searchQuery) && (
          <button
            onClick={() => { setFilter({}); setSearchQuery(''); }}
            className="btn btn-ghost btn-sm"
          >
            Clear
          </button>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selected.size > 0 && (
        <div
          className="flex items-center gap-3"
          style={{
            position: 'fixed',
            bottom: 'var(--space-6)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            background: 'var(--accent-muted)',
            boxShadow: 'var(--shadow-lg), inset 0 0 0 1px var(--accent)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-2) var(--space-4)',
          }}
        >
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent)', fontWeight: 400 }}>
            {selected.size} selected
          </span>
          <button
            onClick={() => bulkUpdateStatus('contacted')}
            className="btn btn-sm btn-primary"
          >
            Mark Contacted
          </button>
          <select
            defaultValue=""
            onChange={e => { if (e.target.value) bulkUpdateStatus(e.target.value); e.target.value = ''; }}
            className="input"
            style={{ width: 'auto', fontSize: 'var(--font-size-xs)', padding: '0.25rem 0.5rem' }}
          >
            <option value="" disabled>Other status...</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={() => setSelected(new Set())} className="btn btn-ghost btn-sm">
            Deselect
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="card-elevated space-y-4"
        >
          <h3 className="section-title">{editId ? 'Edit' : 'Add'} investor</h3>
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
            <button type="submit" className="btn btn-primary btn-md">
              {editId ? 'Update' : 'Add'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="btn btn-secondary btn-md">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Investor Table */}
      <div
        style={{
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: '900px', fontSize: 'var(--font-size-sm)' }}>
          <thead className="table-header">
            <tr>
              <th style={{ width: '2.5rem', padding: 'var(--space-3) var(--space-4)' }}>
                <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll}
                  style={{ accentColor: 'var(--accent)' }} />
              </th>
              <th>Investor</th>
              <th style={{ width: '2rem', padding: 'var(--space-3) var(--space-2)' }} title="Data completeness"></th>
              <th>Type</th>
              <th>Tier</th>
              <th>Partner</th>
              <th>Status</th>
              <th>Check Size</th>
              <th>Last Contact</th>
              <th>Enthusiasm</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => {
              const isHovered = hoveredRow === inv.id;
              const isSelected = selected.has(inv.id);
              return (
                <tr
                  key={inv.id}
                  className="table-row transition-colors"
                  style={{
                    background: isSelected
                      ? 'var(--accent-muted)'
                      : isHovered
                        ? 'var(--surface-2)'
                        : 'transparent',
                    borderLeft: isHovered && !isSelected
                      ? '3px solid var(--accent)'
                      : '3px solid transparent',
                    transition: 'background 100ms ease, border-left 100ms ease',
                  }}
                  onMouseEnter={() => setHoveredRow(inv.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td style={{ width: '2.5rem', padding: 'var(--space-3) var(--space-4)' }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(inv.id)}
                      style={{ accentColor: 'var(--accent)' }} />
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 400, color: 'var(--text-primary)' }}>
                    <Link
                      href={`/investors/${inv.id}`}
                      className="transition-colors"
                      style={{ color: 'inherit', textDecoration: 'none', transition: 'color 150ms' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'inherit')}
                    >
                      {inv.name}
                    </Link>
                  </td>
                  <td style={{ width: '2rem', padding: 'var(--space-3) var(--space-2)' }}>
                    {(() => {
                      const pct = computeCompleteness(inv);
                      const dotColor = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
                      return (
                        <div
                          className="status-dot"
                          style={{ background: dotColor, width: '10px', height: '10px' }}
                          title={`Data completeness: ${pct}%`}
                        />
                      );
                    })()}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)' }}>
                    {TYPE_LABELS[inv.type as InvestorType] ?? inv.type}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span className={`tier-badge ${
                      inv.tier === 1 ? 'tier-1' :
                      inv.tier === 2 ? 'tier-2' :
                      inv.tier === 3 ? 'tier-3' : ''
                    }`} style={
                      inv.tier === 1
                        ? { boxShadow: 'none, none' }
                        : inv.tier === 2
                          ? { boxShadow: 'none, none' }
                          : inv.tier === 3
                            ? { boxShadow: 'none' }
                            : {
                                background: 'var(--surface-2)',
                                color: 'var(--text-muted)',
                              }
                    }>
                      {inv.tier}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)' }}>
                    {inv.partner || '—'}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <select
                      value={inv.status}
                      onChange={e => updateStatus(inv.id, e.target.value)}
                      style={{
                        background: (STATUS_STYLES[inv.status] || STATUS_STYLES.identified).background,
                        color: (STATUS_STYLES[inv.status] || STATUS_STYLES.identified).color,
                        borderRadius: '9999px',
                        padding: '0.2rem 1.5rem 0.2rem 0.625rem',
                        fontSize: 'var(--font-size-xs)',
                        fontWeight: 400,
                        border: '1px solid transparent',
                        cursor: 'pointer',
                        letterSpacing: '0.01em',
                        lineHeight: '1.5',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' stroke='${encodeURIComponent((STATUS_STYLES[inv.status] || STATUS_STYLES.identified).color)}' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.4rem center',
                        backgroundSize: '10px',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                      }}
                    >
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                    {inv.check_size_range || '—'}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    {(() => {
                      const days = daysSince(inv.last_meeting_date);
                      const s = stalenessStyle(days);
                      return (
                        <span
                          className="inline-flex items-center gap-1"
                          style={{ fontSize: 'var(--font-size-xs)', color: s.color, fontWeight: 400 }}
                          title={inv.last_meeting_date ? fmtDate(inv.last_meeting_date) : 'No meetings yet'}
                        >
                          {days !== null && days > 14 && <Clock className="w-3 h-3" />}
                          {s.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    {inv.enthusiasm > 0 ? (
                      <div className="enthusiasm-dots">
                        {[1,2,3,4,5].map(n => (
                          <div key={n} className={`enthusiasm-dot ${n <= inv.enthusiasm ? 'enthusiasm-dot-filled' : 'enthusiasm-dot-empty'}`} />
                        ))}
                      </div>
                    ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div className="flex gap-1" style={{ opacity: isHovered ? 1 : 0.4, transition: 'opacity 150ms' }}>
                      <button
                        onClick={() => startEdit(inv)}
                        className="btn btn-ghost btn-sm"
                        title="Edit investor"
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          padding: '0.3rem 0.5rem',
                          color: hoveredBtn === `edit-${inv.id}` ? 'var(--accent)' : 'var(--text-muted)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                        onMouseEnter={() => setHoveredBtn(`edit-${inv.id}`)}
                        onMouseLeave={() => setHoveredBtn(null)}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: inv.id, name: inv.name })}
                        className="btn btn-ghost btn-sm"
                        title="Delete investor"
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          padding: '0.3rem 0.5rem',
                          color: hoveredBtn === `del-${inv.id}` ? 'var(--danger)' : 'var(--text-muted)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                        onMouseEnter={() => setHoveredBtn(`del-${inv.id}`)}
                        onMouseLeave={() => setHoveredBtn(null)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {filtered.length === 0 && (
          <div style={{
            padding: 'var(--space-8)',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 'var(--font-size-sm)',
          }}>
            {investors.length === 0
              ? 'No investors yet. Click "Add Investor" above or seed your pipeline from the dashboard.'
              : 'No investors match your filters — try adjusting or clearing them'}

          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete investor"
        message={`Permanently delete ${deleteTarget?.name} and all associated meetings, follow-ups, and scoring data? This cannot be undone.`}
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
      <label className="label" style={{ display: 'block' }}>{label}</label>
      <input
        value={value} onChange={e => onChange(e.target.value)} required={required}
        className="input"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div>
      <label className="label" style={{ display: 'block' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="input">
        {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  );
}

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cachedFetch, invalidateCache } from '@/lib/cache';
import type { Investor, InvestorStatus, InvestorTier, InvestorType } from '@/lib/types';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Search, Download, GitCompare, Columns3, Clock, Pencil, Trash2, Calendar, Users } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { fmtDate } from '@/lib/format';
import { STATUS_LABELS, TYPE_LABELS } from '@/lib/constants';
import { stTextMuted } from '@/lib/styles';
import { MS_PER_DAY, relativeTime } from '@/lib/time';

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
  dropped: { background: 'var(--surface-2)', color: 'var(--text-muted)' },};

const presetBtnActive = { background: 'var(--accent)', color: 'var(--surface-0)', border: 'none' } as const;
const presetBtnInactive = { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: 'none' } as const;
const filterChipActive = { cursor: 'pointer' as const, background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent)' } as const;
const filterChipInactive = { cursor: 'pointer' as const, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid transparent' } as const;
const filterSeparator = { width: 1, height: 20, background: 'var(--border-subtle)', alignSelf: 'center' as const } as const;

const COMPLETENESS_FIELDS = ['partner', 'fund_size', 'check_size_range', 'sector_thesis', 'warm_path', 'ic_process', 'portfolio_conflicts'] as const;

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / MS_PER_DAY);
}

function stalenessStyle(days: number | null): { color: string; label: string } {
  if (days === null) return { color: 'var(--text-muted)', label: 'Never' };
  const lbl = days === 0 ? 'Today' : days === 1 ? '1d ago' : days < 14 ? `${days}d ago` : `${Math.floor(days / 7)}w ago`;
  if (days <= 7) return { color: 'var(--success)', label: lbl };
  if (days <= 14) return { color: 'var(--warning)', label: lbl };
  return { color: 'var(--danger)', label: lbl };
}

function computeCompleteness(inv: Investor): number {
  let filled = 0;
  for (const field of COMPLETENESS_FIELDS) {
    const val = inv[field as keyof Investor];
    if (val && typeof val === 'string' && val.trim().length > 0) filled++;
  }
  return Math.round((filled / COMPLETENESS_FIELDS.length) * 100);
}

function completenessDotColor(pct: number): string {
  if (pct >= 80) return 'var(--success)';
  if (pct >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

const TIER_BADGE_STYLES: Record<number, React.CSSProperties> = {
  1: { boxShadow: 'none, none' },
  2: { boxShadow: 'none, none' },
  3: { boxShadow: 'none' },
};
const TIER_BADGE_DEFAULT: React.CSSProperties = { background: 'var(--surface-2)', color: 'var(--text-muted)' };

const rowActionBtn: React.CSSProperties = { fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-2)', color: 'var(--text-muted)', borderRadius: 'var(--radius-sm)' };
const skelLoadingRow = { height: '3rem' } as const;

export default function InvestorsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ tier?: number; status?: string; type?: string; statusPreset: 'active' | 'passed' | 'all' }>({ statusPreset: 'active' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<'name' | 'tier' | 'last_meeting_date' | 'enthusiasm' | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'vc' as InvestorType, tier: 2 as InvestorTier, partner: '',
    fund_size: '', check_size_range: '', sector_thesis: '', warm_path: '',
    ic_process: '', speed: 'medium' as 'fast' | 'medium' | 'slow',
    portfolio_conflicts: '', notes: '',});

  useEffect(() => { document.title = 'Raise | Investor CRM'; }, []);
  useEffect(() => { fetchInvestors(); }, []);
  useEffect(() => { if (showForm) setTimeout(() => { const el = document.querySelector<HTMLInputElement>('#investor-form input'); el?.focus(); }, 50); }, [showForm]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showForm) { setShowForm(false); setEditId(null); }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); fetchInvestors(); }
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !showForm) { e.preventDefault(); setEditId(null); setShowForm(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showForm]);

  async function fetchInvestors() {
    setLoading(true);
    try {
      const res = await cachedFetch('/api/investors');
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setInvestors(await res.json());
      setLoadedAt(new Date().toISOString());
    } catch (e) {
      console.warn('[INVESTOR_FETCH]', e instanceof Error ? e.message : e);
      toast('Couldn\'t load investors — check your connection and refresh', 'error');
    } finally {
      setLoading(false);
    }}

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const method = editId ? 'PUT' : 'POST';
      const body = editId ? { id: editId, ...form } : form;
      const res = await fetch('/api/investors', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      toast(editId ? `${form.name} updated` : `${form.name} added`);
      if (!editId) {
        const created = await res.json();
        if (created?.id) { router.push(`/investors/${created.id}`); return; }
      }
      setShowForm(false);
      setEditId(null);
      setForm({ name: '', type: 'vc', tier: 2, partner: '', fund_size: '', check_size_range: '', sector_thesis: '', warm_path: '', ic_process: '', speed: 'medium', portfolio_conflicts: '', notes: '' });
      fetchInvestors();
    } catch (e) {
      console.warn('[INVESTOR_SAVE]', e instanceof Error ? e.message : e);
      toast('Couldn\'t save — ensure investor name is filled and try again', 'error');
    } finally {
      setSubmitting(false);
    }}

  async function updateStatus(id: string, status: string, previousStatus?: string) {
    // Confirm destructive status changes
    const destructive = ['passed', 'dropped'];
    if (destructive.includes(status) && previousStatus && !destructive.includes(previousStatus)) {
      const inv = investors.find(i => i.id === id);
      const ok = window.confirm(`Move ${inv?.name || 'this investor'} to "${STATUS_LABELS[status as InvestorStatus] || status}"? This removes them from the active pipeline.`);
      if (!ok) return;
    }
    try {
      const res = await fetch('/api/investors', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      invalidateCache('/api/');
      toast(`Status updated to ${STATUS_LABELS[status as InvestorStatus] || status}`);
      fetchInvestors();
    } catch (e) {
      console.warn('[INVESTOR_STATUS]', e instanceof Error ? e.message : e);
      toast('Status update failed — the server may be busy, wait a moment and retry', 'error');
    }}

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/investors?id=${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      toast('Investor deleted', 'warning');
      setDeleteTarget(null);
      fetchInvestors();
    } catch (e) {
      console.warn('[INVESTOR_DELETE]', e instanceof Error ? e.message : e);
      toast('Couldn\'t delete investor — try again in a moment', 'error');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }}

  function startEdit(inv: Investor) {
    setForm({
      name: inv.name, type: inv.type as InvestorType, tier: inv.tier as InvestorTier,
      partner: inv.partner, fund_size: inv.fund_size, check_size_range: inv.check_size_range,
      sector_thesis: inv.sector_thesis, warm_path: inv.warm_path, ic_process: inv.ic_process,
      speed: inv.speed as 'fast' | 'medium' | 'slow',
      portfolio_conflicts: inv.portfolio_conflicts, notes: inv.notes,});
    setEditId(inv.id);
    setShowForm(true);
  }

  const filtered = useMemo(() => investors.filter(i => {
    if (filter.tier && i.tier !== filter.tier) return false;
    if (filter.status && i.status !== filter.status) return false;
    if (filter.type && i.type !== filter.type) return false;
    if (filter.statusPreset === 'active' && (i.status === 'passed' || i.status === 'dropped')) return false;
    if (filter.statusPreset === 'passed' && i.status !== 'passed' && i.status !== 'dropped') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!i.name.toLowerCase().includes(q) && !i.partner.toLowerCase().includes(q) && !(i.notes || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => { if (!sortKey) return 0; const dir = sortAsc ? 1 : -1; if (sortKey === 'name') return dir * a.name.localeCompare(b.name); if (sortKey === 'tier') return dir * (a.tier - b.tier); if (sortKey === 'enthusiasm') return dir * ((a.enthusiasm || 0) - (b.enthusiasm || 0)); return dir * ((a.last_meeting_date || '').localeCompare(b.last_meeting_date || '')); }),
  [investors, filter, searchQuery, sortKey, sortAsc]);

  async function bulkUpdateStatus(newStatus: string) {
    if (bulkUpdating) return;
    setBulkUpdating(true);
    try {
      for (const id of selected) {
        const res = await fetch('/api/investors', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: newStatus }) });
        if (!res.ok) throw new Error(`Failed for ${id}`);
      }
      toast(`Updated ${selected.size} investors to ${STATUS_LABELS[newStatus as InvestorStatus] || newStatus}`);
      setSelected(new Set());
      fetchInvestors();
    } catch (e) {
      console.warn('[INVESTOR_BULK]', e instanceof Error ? e.message : e);
      toast(`Some of ${selected.size} updates failed — refresh to check which ones saved`, 'error');
      fetchInvestors();
    } finally { setBulkUpdating(false); }}

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;});
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(i => i.id)));
    }
  }, [selected.size, filtered]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton" style={{ height: '2rem', width: '12rem' }} />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={skelLoadingRow} />
          ))}</div>
      </div>);
  }

  return (
    <div className="page-content space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Investor CRM</h1>
          <p className="page-subtitle">{filtered.length === investors.length ? `${investors.length} investors tracked` : `${filtered.length} of ${investors.length} investors`}{loadedAt ? ` · Updated ${relativeTime(loadedAt)}` : ''}</p></div>
        <div className="flex gap-2">
          <Link href="/pipeline" className="btn btn-secondary btn-md">
            <Columns3 className="w-3.5 h-3.5" /> Pipeline</Link>
          <Link href="/compare" className="btn btn-secondary btn-md">
            <GitCompare className="w-3.5 h-3.5" /> Compare</Link>
          <button onClick={() => {
            try {
              const hdr = ['Name','Partner','Type','Tier','Status','Check Size','Last Meeting'];
              const rows = filtered.map(i => [i.name,i.partner,i.type,i.tier,STATUS_LABELS[i.status as InvestorStatus]||i.status,i.check_size_range,i.last_meeting_date||''].map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(','));
              const blob = new Blob([hdr.join(',')+'\n'+rows.join('\n')], { type: 'text/csv' });
              Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'investors.csv' }).click();
              toast(`Exported ${filtered.length} investors to CSV`);
            } catch (e) { console.warn('[INVESTOR_CSV]', e instanceof Error ? e.message : e); toast('Couldn\'t export CSV — try again', 'error'); }
          }} className="btn btn-secondary btn-md">
            <Download className="w-3.5 h-3.5" /> CSV</button>
          <button
            onClick={() => { setShowForm(!showForm); setEditId(null); }}
            className="btn btn-primary btn-md">
            + Add Investor</button></div></div>

      {/* Search + Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={stTextMuted} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Find by name, firm, or deal focus..."
            className="input"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search investors"
            style={{ paddingLeft: '2.25rem' }} /></div>
        {(['active', 'passed', 'all'] as const).map(p => (
          <button key={p} onClick={() => setFilter(f => ({ ...f, statusPreset: p, status: undefined }))} className="btn btn-sm"
            style={filter.statusPreset === p ? presetBtnActive : presetBtnInactive}>
            {p === 'active' ? 'Active' : p === 'passed' ? 'Passed' : 'All'}</button>))}
        <span style={filterSeparator} />
        {Object.entries(TYPE_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => setFilter(f => ({ ...f, type: f.type === k ? undefined : k }))} className="badge btn-sm"
            style={filter.type === k ? filterChipActive : filterChipInactive}>
            {v}</button>))}
        <span style={filterSeparator} />
        {[1,2,3].map(t => (
          <button key={t} onClick={() => setFilter(f => ({ ...f, tier: f.tier === t ? undefined : t }))} className="badge btn-sm"
            style={filter.tier === t ? filterChipActive : filterChipInactive}>
            T{t}</button>))}
        {(filter.tier || filter.status || filter.type || filter.statusPreset !== 'active' || searchQuery) && (
          <button onClick={() => { setFilter({ statusPreset: 'active' }); setSearchQuery(''); }} className="btn btn-ghost btn-sm">Clear</button>
        )}</div>

      {/* Floating Bulk Action Bar */}
      {selected.size > 0 && (
        <div
          className="flex items-center gap-3"
          style={{ position: 'fixed', bottom: 'var(--space-6)', left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: 'var(--accent-muted)', boxShadow: 'var(--shadow-lg), inset 0 0 0 1px var(--accent)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-2) var(--space-4)' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent)', fontWeight: 400 }}>
            {selected.size} selected</span>
          <button
            onClick={() => bulkUpdateStatus('contacted')}
            disabled={bulkUpdating}
            className="btn btn-sm btn-primary"
            style={{ opacity: bulkUpdating ? 0.5 : 1 }}>
            {bulkUpdating ? 'Updating...' : 'Mark Contacted'}</button>
          <select
            defaultValue=""
            disabled={bulkUpdating}
            aria-label="Bulk update status"
            onChange={e => { if (e.target.value) bulkUpdateStatus(e.target.value); e.target.value = ''; }}
            className="input"
            style={{ width: 'auto', fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-2)', opacity: bulkUpdating ? 0.5 : 1 }}>
            <option value="" disabled>Other status...</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <button onClick={() => setSelected(new Set())} className="btn btn-ghost btn-sm">
            Deselect</button></div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <form
          id="investor-form"
          onSubmit={handleSubmit}
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setShowForm(false); setEditId(null); } }}
          className="card-elevated space-y-4">
          <h3 className="section-title">{editId ? 'Edit' : 'Add'} investor</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Input label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required autoFocus />{!editId && form.name.length >= 3 && (() => { const q = form.name.toLowerCase(), m = investors.find(i => i.name.toLowerCase().includes(q)); return m ? <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--warning)' }}>Similar investor exists: {m.name}</span> : null; })()}</div>
            <Select label="Type" value={form.type} onChange={v => setForm(f => ({ ...f, type: v as InvestorType }))} options={Object.entries(TYPE_LABELS)}
              />
            <Select label="Tier" value={String(form.tier)} onChange={v => setForm(f => ({ ...f, tier: Number(v) as InvestorTier }))} options={[['1','Tier 1'],['2','Tier 2'],['3','Tier 3'],['4','Tier 4']]}
              />
            <Input label="Key Partner" value={form.partner} onChange={v => setForm(f => ({ ...f, partner: v }))} />
            <Input label="Fund Size" value={form.fund_size} onChange={v => setForm(f => ({ ...f, fund_size: v }))} />
            <Input label="Check Size Range" value={form.check_size_range} onChange={v => setForm(f => ({ ...f, check_size_range: v }))}
              />
            <Input label="Warm Path" value={form.warm_path} onChange={v => setForm(f => ({ ...f, warm_path: v }))} />
            <Select label="Speed" value={form.speed} onChange={v => setForm(f => ({ ...f, speed: v as 'fast' | 'medium' | 'slow' }))} options={[['fast','Fast'],['medium','Medium'],['slow','Slow']]}
              />
            <Input label="IC Process" value={form.ic_process} onChange={v => setForm(f => ({ ...f, ic_process: v }))} /></div>
          <Input label="Sector Thesis" value={form.sector_thesis} onChange={v => setForm(f => ({ ...f, sector_thesis: v }))} />
          <Input label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} />
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="btn btn-primary btn-md disabled:opacity-50">
              {submitting ? 'Saving...' : editId ? 'Update' : 'Add'}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="btn btn-secondary btn-md">
              Cancel</button></div></form>
      )}

      {/* Investor Table */}
      <div
        style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table aria-label="Investors database" style={{ width: '100%', minWidth: '900px', fontSize: 'var(--font-size-sm)' }}>
          <thead className="table-header">
            <tr>
              <th scope="col" style={{ width: '2.5rem', padding: 'var(--space-3) var(--space-4)' }}>
                <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll}
                  aria-label="Select all investors"
                  style={{ accentColor: 'var(--accent)' }} /></th>
              {([['name','Investor'],['',''],['','Type'],['tier','Tier'],['','Partner'],['','Status'],['','Check Size'],['last_meeting_date','Last Contact'],['enthusiasm','Enthusiasm'],['','Actions']] as const).map(([k, label], i) => <th scope="col" key={i} style={k ? { cursor: 'pointer', userSelect: 'none', ...(i === 1 ? { width: '2rem', padding: 'var(--space-3) var(--space-2)' } : {}) } : (i === 1 ? { width: '2rem', padding: 'var(--space-3) var(--space-2)' } : {})} title={i === 1 ? 'Data completeness' : undefined} onClick={k ? () => { if (sortKey === k) setSortAsc(!sortAsc); else { setSortKey(k as typeof sortKey); setSortAsc(k === 'name'); } } : undefined}>{label}{sortKey === k ? (sortAsc ? ' \u25B2' : ' \u25BC') : ''}</th>)}</tr></thead>
          <tbody>
            {filtered.map(inv => {
              const isSelected = selected.has(inv.id);
              return (
                <tr
                  key={inv.id}
                  className="table-row"
                  style={{ background: isSelected ? 'var(--accent-muted)' : undefined }}>
                  <td style={{ width: '2.5rem', padding: 'var(--space-3) var(--space-4)' }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(inv.id)}
                      style={{ accentColor: 'var(--accent)' }} /></td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 400, color: 'var(--text-primary)' }}>
                    <Link
                      href={`/investors/${inv.id}`}
                      className="investor-link"
                      style={{ textDecoration: 'none', transition: 'color 150ms' }}>
                      {inv.name}</Link></td>
                  <td style={{ width: '2rem', padding: 'var(--space-3) var(--space-2)' }}>
                    <div
                      className="status-dot"
                      style={{ background: completenessDotColor(computeCompleteness(inv)), width: '10px', height: '10px' }}
                      title={`Profile ${computeCompleteness(inv)}% complete — add partner name, fund size, check size, and sector thesis to improve`} /></td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)' }}>
                    {TYPE_LABELS[inv.type as InvestorType] ?? inv.type}</td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span className={`tier-badge ${inv.tier <= 3 ? `tier-${inv.tier}` : ''}`}
                      style={TIER_BADGE_STYLES[inv.tier] || TIER_BADGE_DEFAULT}>
                      {inv.tier}</span></td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)' }}>
                    {inv.partner || '—'}</td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <select
                      value={inv.status}
                      aria-label={`Status for ${inv.name}`}
                      onChange={e => updateStatus(inv.id, e.target.value, inv.status)}
                      style={{ background: (STATUS_STYLES[inv.status] || STATUS_STYLES.identified).background, color: (STATUS_STYLES[inv.status] || STATUS_STYLES.identified).color, borderRadius: 'var(--radius-full)', padding: '0.2rem 1.5rem 0.2rem 0.625rem', fontSize: 'var(--font-size-xs)', fontWeight: 400, border: '1px solid transparent', cursor: 'pointer', letterSpacing: '0.01em', lineHeight: '1.5', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' stroke='${encodeURIComponent((STATUS_STYLES[inv.status] || STATUS_STYLES.identified).color)}' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.4rem center', backgroundSize: '10px', appearance: 'none', WebkitAppearance: 'none' }}>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                    {inv.check_size_range || '—'}</td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    {(() => { const d = daysSince(inv.last_meeting_date), s = stalenessStyle(d); return (
                        <span className="inline-flex items-center gap-1"
                          style={{ fontSize: 'var(--font-size-xs)', color: s.color, fontWeight: 400 }}
                          title={inv.last_meeting_date ? fmtDate(inv.last_meeting_date) : 'No meetings yet'}>
                          {d !== null && d > 14 && <Clock className="w-3 h-3" />}{s.label}</span>); })()}</td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    {inv.enthusiasm > 0 ? (
                      <div className="enthusiasm-dots">
                        {[1,2,3,4,5].map(n => (
                          <div key={n} className={`enthusiasm-dot ${n <= inv.enthusiasm ? 'enthusiasm-dot-filled' : 'enthusiasm-dot-empty'}`}
                            />
                        ))}</div>
                    ) : <span style={stTextMuted}>—</span>}</td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div className="row-actions flex gap-1">
                      <button
                        onClick={() => startEdit(inv)}
                        className="btn btn-ghost btn-sm icon-accent"
                        title="Edit investor"
                        aria-label="Edit investor"
                        style={rowActionBtn}>
                        <Pencil className="w-3 h-3" /></button>
                      <Link
                        href={`/meetings/new?investor=${inv.id}`}
                        className="btn btn-ghost btn-sm icon-success"
                        title="Log meeting"
                        aria-label="Log meeting"
                        style={rowActionBtn}>
                        <Calendar className="w-3 h-3" /></Link>
                      <button
                        onClick={() => setDeleteTarget({ id: inv.id, name: inv.name })}
                        className="btn btn-ghost btn-sm icon-delete"
                        title="Delete investor"
                        aria-label="Delete investor"
                        style={rowActionBtn}>
                        <Trash2 className="w-3 h-3" /></button></div></td>
                </tr>);
            })}</tbody></table></div>
        {filtered.length === 0 && (
          <EmptyState
            icon={Users}
            title={investors.length === 0 ? 'No investors yet' : 'No investors match your filters'}
            description={investors.length === 0 ? 'Click "Add Investor" above to start building your pipeline.' : 'Try adjusting or clearing your filters.'} />
        )}</div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete investor"
        message={`Permanently delete ${deleteTarget?.name} and all associated meetings, follow-ups, and scoring data? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)} />
    </div>);
}

function Input({ label, value, onChange, required, autoFocus }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; autoFocus?: boolean }) {
  return (
    <div>
      <label className="label" style={{ display: 'block' }}>{label}</label>
      <input
        value={value} onChange={e => onChange(e.target.value)} required={required} autoFocus={autoFocus}
        className="input" />
    </div>);
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <div>
      <label className="label" style={{ display: 'block' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="input">
        {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
    </div>);
}

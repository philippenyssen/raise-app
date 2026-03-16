'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import { cachedFetch } from '@/lib/cache';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { FileText, Plus, Clock, Edit3, Download, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, ArrowUpDown } from 'lucide-react';
import { fmtDate } from '@/lib/format';
import { DocSummaryRecord as Doc } from '@/lib/types';
import { stAccent, stTextMuted, stTextPrimary, stTextTertiary } from '@/lib/styles';

interface DocFlag {
  id: string;
  document_id: string;
  meeting_id: string;
  investor_id: string;
  investor_name: string;
  flag_type: string;
  description: string;
  section_hint: string;
  objection_text: string;
  status: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  memo: 'Investment Memo',
  deck: 'Presentation Deck',
  one_pager: 'One-Pager',
  exec_brief: 'Executive Brief',
  exec_summary: 'Executive Summary',
  custom: 'Custom Document',};

function formatTypeLabel(type: string): string {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  // Convert UPPER_SNAKE or lower_snake to Title Case
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  draft: { backgroundColor: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  review: { backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' },
  final: { backgroundColor: 'var(--success-muted)', color: 'var(--text-secondary)' },};

const FLAG_TYPE_LABELS: Record<string, string> = {
  objection_response: 'Objection',
  number_update: 'Numbers',
  section_improvement: 'Improve',};

const FLAG_TYPE_STYLE_MAP: Record<string, React.CSSProperties> = {
  objection_response: { backgroundColor: 'color-mix(in srgb, var(--danger) 20%, transparent)', color: 'var(--text-primary)' },
  number_update: { backgroundColor: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  section_improvement: { backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' },};

const DEFAULT_FLAG_STYLE: React.CSSProperties = { backgroundColor: 'var(--surface-2)', color: 'var(--text-tertiary)' };
const flagCardBg: React.CSSProperties = { backgroundColor: 'color-mix(in srgb, var(--surface-1) 50%, transparent)' };

export default function DocumentsPage() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [flags, setFlags] = useState<DocFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showFlags, setShowFlags] = useState(true);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');

  useEffect(() => { document.title = 'Raise | Documents'; }, []);
  useEffect(() => { Promise.all([fetchDocs(), fetchFlags()]); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); Promise.all([fetchDocs(), fetchFlags()]); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  async function fetchDocs() {
    setLoading(true);
    try {
      const res = await cachedFetch('/api/documents');
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setDocs(await res.json());
    } catch (e) {
      console.warn('[DOC_FETCH]', e instanceof Error ? e.message : e);
      toast('Couldn\'t load documents — try refreshing the page', 'error');
    } finally {
      setLoading(false);
    }}

  async function fetchFlags() {
    try {
      const res = await cachedFetch('/api/document-flags?status=open');
      if (res.ok) setFlags(await res.json());
    } catch (e) { console.warn('[DOC_FLAGS]', e instanceof Error ? e.message : e); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    setDeleteTarget(null);
    setDocs(prev => prev.filter(d => d.id !== target.id));
    try {
      const res = await fetch(`/api/documents/${target.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      toast('Document deleted', 'warning');
    } catch (e) {
      console.warn('[DOC_DELETE]', e instanceof Error ? e.message : e);
      toast('Couldn\'t delete document — restoring', 'error');
      fetchDocs();
    } finally {
      setDeleting(false);
    }}

  async function handleFlagAction(flagId: string, action: 'addressed' | 'dismissed') {
    try {
      const res = await fetch('/api/document-flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: flagId, status: action }),});
      if (!res.ok) throw new Error('Server error');
      setFlags(prev => prev.filter(f => f.id !== flagId));
      toast(action === 'addressed' ? 'Flag marked as addressed' : 'Flag dismissed', 'success');
    } catch (e) {
      console.warn('[DOC_FLAG]', e instanceof Error ? e.message : e);
      toast('Couldn\'t update flag — try again', 'error');
    }}

  async function downloadDoc(doc: Doc) {
    let content = doc.content || '';
    if (!content) {
      try {
        const res = await cachedFetch(`/api/documents/${doc.id}`);
        if (res.ok) { const full = await res.json(); content = full.content || ''; }
      } catch (e) { console.warn('[DOC_DOWNLOAD]', e instanceof Error ? e.message : e); }
    }
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sortDocs = (a: Doc, b: Doc) => {
    if (sortBy === 'name') return a.title.localeCompare(b.title);
    const da = new Date(a.updated_at).getTime(), db = new Date(b.updated_at).getTime();
    return sortBy === 'newest' ? db - da : da - db;
  };

  const grouped = useMemo(() => {
    const g = docs.reduce<Record<string, Doc[]>>((acc, doc) => {
      const type = doc.type || 'custom';
      if (!acc[type]) acc[type] = [];
      acc[type].push(doc);
      return acc;
    }, {});
    for (const type in g) g[type].sort(sortDocs);
    return g;
  }, [docs, sortBy]);

  const flagsByDoc = useMemo(() => flags.reduce<Record<string, DocFlag[]>>((acc, flag) => {
    if (flag.document_id) {
      if (!acc[flag.document_id]) acc[flag.document_id] = [];
      acc[flag.document_id].push(flag);
    }
    return acc;
  }, {}), [flags]);

  const generalFlags = useMemo(() => flags.filter(f => !f.document_id), [flags]);

  if (loading) {
    return (
      <div className="space-y-6 page-content">
        <div className="skeleton" style={{ height: '28px', width: '200px' }} />
        {[1,2,3].map(i => (
          <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-xl)' }} />
        ))}
      </div>);
  }

  return (
    <div className="space-y-6 page-content">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Documents</h1>
          <p className="text-sm mt-1" style={stTextMuted}>
            {docs.length} documents
            {flags.length > 0 && (
              <span style={{ color: 'var(--text-tertiary)', marginLeft: '0.5rem' }}>
                {flags.length} open flag{flags.length !== 1 ? 's' : ''}</span>
            )}</p></div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1 text-xs mr-1" style={{ color: 'var(--text-muted)' }}>
            <ArrowUpDown className="w-3 h-3" />
            {(['newest', 'oldest', 'name'] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)}
                className="px-2 py-1 rounded-md"
                style={{ backgroundColor: sortBy === s ? 'var(--surface-3)' : 'transparent', color: sortBy === s ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                {s === 'newest' ? 'Newest' : s === 'oldest' ? 'Oldest' : 'A–Z'}</button>
            ))}
          </div>
          {flags.length > 0 && (
            <button
              onClick={() => setShowFlags(!showFlags)}
              className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
              style={showFlags
                ? { backgroundColor: 'var(--warning-muted)', color: 'var(--text-tertiary)', border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)' }
                : { backgroundColor: 'var(--surface-2)', color: 'var(--text-tertiary)', border: '1px solid transparent' }
              }>
              <AlertTriangle className="w-3.5 h-3.5" /> {flags.length} Flags</button>
          )}
          <Link
            href="/documents/consistency"
            className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
            style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
            <ShieldCheck className="w-3.5 h-3.5" /> Check Alignment</Link>
          <Link
            href="/documents/new"
            className="px-4 py-2 rounded-lg text-sm font-normal transition-colors flex items-center gap-2"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--surface-0)' }}>
          <Plus className="w-4 h-4" /> New Document</Link></div></div>

      {/* Document Flags Banner */}
      {showFlags && flags.length > 0 && (
        <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 5%, transparent)' }}>
          <h3 className="text-sm font-normal flex items-center gap-2" style={stTextTertiary}>
            <AlertTriangle className="w-4 h-4" />
            Open Document Flags from Meetings</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {flags.map(flag => (
              <div key={flag.id} className="flex items-start gap-3 rounded-lg p-3" style={flagCardBg}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-1.5 py-0.5 rounded font-normal" style={FLAG_TYPE_STYLE_MAP[flag.flag_type] || DEFAULT_FLAG_STYLE}>
                      {FLAG_TYPE_LABELS[flag.flag_type] || flag.flag_type}</span>
                    <span className="text-xs" style={stTextMuted}>from {flag.investor_name}</span>
                    <span className="text-xs" style={stTextMuted}>{fmtDate(flag.created_at)}</span></div>
                  <p className="text-xs line-clamp-2" style={stTextTertiary}>{flag.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs" style={stTextMuted}>Section: {flag.section_hint}</span>
                    {flag.document_id && (
                      <Link
                        href={`/documents/${flag.document_id}`}
                        className="text-xs underline hover-opacity-link"
                        style={stAccent}>
                        Open document</Link>
                    )}</div></div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleFlagAction(flag.id, 'addressed')}
                    className="flag-addr p-1.5 rounded-md"
                    title="Mark as addressed"
                    aria-label="Mark as addressed">
                    <CheckCircle2 className="w-4 h-4" /></button>
                  <button
                    onClick={() => handleFlagAction(flag.id, 'dismissed')}
                    className="flag-dism p-1.5 rounded-md"
                    title="Dismiss"
                    aria-label="Dismiss">
                    <XCircle className="w-4 h-4" /></button></div></div>
            ))}</div></div>
      )}

      {docs.length === 0 ? (
        <div className="rounded-xl p-8 text-center space-y-3">
          <FileText className="w-8 h-8 mx-auto" style={stTextMuted} />
          <p style={stTextMuted}>No documents yet. Create your first investment memo, presentation deck, or one-pager to get started.</p>
          <Link
            href="/documents/new"
            className="text-sm hover-opacity-link"
            style={stAccent}>
            Create your first document</Link></div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([type, typeDocs]) => (
            <div key={type}>
              <h2 className="mb-3" style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 400,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.01em',
}}>
                {formatTypeLabel(type)} ({typeDocs.length})</h2>
              <div className="space-y-2">
                {typeDocs.map(doc => {
                  const docFlags = flagsByDoc[doc.id] || [];
                  const docKey = `doc-${doc.id}`;
                  return (
                    <div
                      key={doc.id}
                      className="hover-row rounded-xl p-4 flex items-center justify-between"
                      style={{
                        position: 'relative' as const,
                        backgroundColor: docFlags.length > 0
                          ? 'color-mix(in srgb, var(--warning) 3%, transparent)'
                          : undefined, }}>
                      <Link href={`/documents/${doc.id}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <Edit3 className="w-4 h-4 shrink-0" style={stTextMuted} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-normal truncate" style={stTextPrimary}>{doc.title}</h3>
                              {docFlags.length > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded font-normal shrink-0" style={{ backgroundColor: 'var(--warning-muted)', color: 'var(--text-tertiary)' }}>
                                  {docFlags.length} flag{docFlags.length !== 1 ? 's' : ''}</span>
                              )}</div>
                            <div className="flex items-center gap-3 text-xs mt-0.5" style={stTextMuted}>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {fmtDate(doc.updated_at)}</span>
                              {doc.content && <span>{doc.content.length.toLocaleString()} chars</span>}</div></div></div></Link>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <span className="text-xs px-2 py-0.5 rounded" style={STATUS_STYLES[doc.status] || { backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                          {doc.status}</span>
                        <button
                          onClick={() => downloadDoc(doc)}
                          className="icon-dl p-1 rounded"
                          title="Download as Markdown"
                          aria-label="Download as Markdown">
                          <Download className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => setDeleteTarget({ id: doc.id, title: doc.title })}
                          className="icon-delete text-xs px-2 py-1 rounded"
                          title="Delete document"
                          aria-label="Delete document">
                          Delete</button></div>
                    </div>);
                })}</div></div>
          ))}

          {/* General flags (not tied to a specific document) */}
          {showFlags && generalFlags.length > 0 && (
            <div>
              <h2 className="text-xs font-normal mb-3  flex items-center gap-2" style={stTextTertiary}>
                <AlertTriangle className="w-3 h-3" /> Unmatched Flags ({generalFlags.length})</h2>
              <p className="text-xs mb-3" style={stTextMuted}>
                These flags were generated from meeting objections but no matching document type was found. Consider creating content to address them.
              </p>
              <div className="space-y-2">
                {generalFlags.map(flag => (
                  <div key={flag.id} className="rounded-lg p-3 flex items-start justify-between gap-3" style={flagCardBg}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-1.5 py-0.5 rounded font-normal" style={FLAG_TYPE_STYLE_MAP[flag.flag_type] || DEFAULT_FLAG_STYLE}>
                          {FLAG_TYPE_LABELS[flag.flag_type] || flag.flag_type}</span>
                        <span className="text-xs" style={stTextMuted}>from {flag.investor_name}</span></div>
                      <p className="text-xs" style={stTextTertiary}>{flag.description}</p></div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleFlagAction(flag.id, 'addressed')}
                        className="flag-addr p-1.5 rounded-md"
                        title="Mark as addressed"
                        aria-label="Mark as addressed">
                        <CheckCircle2 className="w-4 h-4" /></button>
                      <button
                        onClick={() => handleFlagAction(flag.id, 'dismissed')}
                        className="flag-dism p-1.5 rounded-md"
                        title="Dismiss"
                        aria-label="Dismiss">
                        <XCircle className="w-4 h-4" /></button></div></div>
                ))}</div></div>
          )}</div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete document"
        message={`Permanently delete "${deleteTarget?.title}" and its entire version history? All content, edits, and associated flags will be removed and cannot be recovered.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)} />
    </div>);
}

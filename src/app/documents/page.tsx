'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { FileText, Plus, Clock, Edit3, Download, ShieldCheck, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
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
  custom: 'Custom Document',
};

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
  final: { backgroundColor: 'var(--success-muted)', color: 'var(--text-secondary)' },
};

const FLAG_TYPE_LABELS: Record<string, string> = {
  objection_response: 'Objection',
  number_update: 'Numbers',
  section_improvement: 'Improve',
};

const FLAG_TYPE_STYLE_MAP: Record<string, React.CSSProperties> = {
  objection_response: { backgroundColor: 'color-mix(in srgb, var(--danger) 20%, transparent)', color: 'var(--text-primary)' },
  number_update: { backgroundColor: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  section_improvement: { backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' },
};

const DEFAULT_FLAG_STYLE: React.CSSProperties = { backgroundColor: 'var(--surface-2)', color: 'var(--text-tertiary)' };

export default function DocumentsPage() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [flags, setFlags] = useState<DocFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [showFlags, setShowFlags] = useState(true);
  const [hoverStates, setHoverStates] = useState<Record<string, boolean>>({});

  const setHover = (key: string, val: boolean) => setHoverStates(prev => ({ ...prev, [key]: val }));

  useEffect(() => { fetchDocs(); fetchFlags(); }, []);

  async function fetchDocs() {
    setLoading(true);
    try {
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setDocs(await res.json());
    } catch {
      toast('Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchFlags() {
    try {
      const res = await fetch('/api/document-flags?status=open');
      if (res.ok) setFlags(await res.json());
    } catch { /* non-blocking */ }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/documents/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      toast('Document deleted', 'warning');
      setDeleteTarget(null);
      fetchDocs();
    } catch {
      toast('Failed to delete document', 'error');
      setDeleteTarget(null);
    }
  }

  async function handleFlagAction(flagId: string, action: 'addressed' | 'dismissed') {
    try {
      await fetch('/api/document-flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: flagId, status: action }),
      });
      setFlags(prev => prev.filter(f => f.id !== flagId));
      toast(action === 'addressed' ? 'Flag marked as addressed' : 'Flag dismissed', 'success');
    } catch {
      toast('Failed to update flag', 'error');
    }
  }

  function downloadDoc(doc: Doc) {
    const blob = new Blob([doc.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Group by type
  const grouped = docs.reduce<Record<string, Doc[]>>((acc, doc) => {
    const type = doc.type || 'custom';
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {});

  // Count flags per document
  const flagsByDoc = flags.reduce<Record<string, DocFlag[]>>((acc, flag) => {
    if (flag.document_id) {
      if (!acc[flag.document_id]) acc[flag.document_id] = [];
      acc[flag.document_id].push(flag);
    }
    return acc;
  }, {});

  // Flags without a specific document
  const generalFlags = flags.filter(f => !f.document_id);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'color-mix(in srgb, var(--surface-2) 50%, transparent)' }}
            />
        ))}
      </div>
    );
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
                {flags.length} open flag{flags.length !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {flags.length > 0 && (
            <button
              onClick={() => setShowFlags(!showFlags)}
              className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
              style={showFlags
                ? { backgroundColor: 'var(--warning-muted)', color: 'var(--text-tertiary)', border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)' }
                : { backgroundColor: hoverStates['flagsBtn'] ? 'var(--surface-3)' : 'var(--surface-2)', color: 'var(--text-tertiary)', border: '1px solid transparent' }
              }
              onMouseEnter={() => setHover('flagsBtn', true)}
              onMouseLeave={() => setHover('flagsBtn', false)}>
              <AlertTriangle className="w-3.5 h-3.5" /> {flags.length} Flags
            </button>
          )}
          <Link
            href="/documents/consistency"
            className="px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
            style={{ backgroundColor: hoverStates['consBtn'] ? 'var(--surface-3)' : 'var(--surface-2)', color: 'var(--text-secondary)' }}
            onMouseEnter={() => setHover('consBtn', true)}
            onMouseLeave={() => setHover('consBtn', false)}>
            <ShieldCheck className="w-3.5 h-3.5" /> Consistency
          </Link>
          <Link
            href="/documents/new"
            className="px-4 py-2 rounded-lg text-sm font-normal transition-colors flex items-center gap-2"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--surface-0)', opacity: hoverStates['newBtn'] ? 0.85 : 1 }}
            onMouseEnter={() => setHover('newBtn', true)}
            onMouseLeave={() => setHover('newBtn', false)}>
          <Plus className="w-4 h-4" /> New Document
        </Link>
        </div>
      </div>

      {/* Document Flags Banner */}
      {showFlags && flags.length > 0 && (
        <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 5%, transparent)' }}>
          <h3 className="text-sm font-normal flex items-center gap-2" style={stTextTertiary}>
            <AlertTriangle className="w-4 h-4" />
            Open Document Flags from Meetings
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {flags.map(flag => (
              <div key={flag.id} className="flex items-start gap-3 rounded-lg p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--surface-1) 50%, transparent)' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-1.5 py-0.5 rounded font-normal" style={FLAG_TYPE_STYLE_MAP[flag.flag_type] || DEFAULT_FLAG_STYLE}>
                      {FLAG_TYPE_LABELS[flag.flag_type] || flag.flag_type}
                    </span>
                    <span className="text-xs" style={stTextMuted}>from {flag.investor_name}</span>
                    <span className="text-xs" style={stTextMuted}>{fmtDate(flag.created_at)}</span>
                  </div>
                  <p className="text-xs line-clamp-2" style={stTextTertiary}>{flag.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs" style={stTextMuted}>Section: {flag.section_hint}</span>
                    {flag.document_id && (
                      <Link
                        href={`/documents/${flag.document_id}`}
                        className="text-xs underline transition-colors"
                        style={stAccent}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
                        Open document
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleFlagAction(flag.id, 'addressed')}
                    className="p-1.5 rounded-md transition-colors"
                    title="Mark as addressed"
                    aria-label="Mark as addressed"
                    style={{ color: hoverStates[`addr-${flag.id}`] ? 'var(--success)' : 'var(--text-muted)', backgroundColor: hoverStates[`addr-${flag.id}`] ? 'var(--success-muted)' : 'transparent' }}
                    onMouseEnter={() => setHover(`addr-${flag.id}`, true)}
                    onMouseLeave={() => setHover(`addr-${flag.id}`, false)}>
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleFlagAction(flag.id, 'dismissed')}
                    className="p-1.5 rounded-md transition-colors"
                    title="Dismiss"
                    aria-label="Dismiss"
                    style={{ color: hoverStates[`dism-${flag.id}`] ? 'var(--danger)' : 'var(--text-muted)', backgroundColor: hoverStates[`dism-${flag.id}`] ? 'color-mix(in srgb, var(--danger) 20%, transparent)' : 'transparent' }}
                    onMouseEnter={() => setHover(`dism-${flag.id}`, true)}
                    onMouseLeave={() => setHover(`dism-${flag.id}`, false)}>
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <div className="rounded-xl p-8 text-center space-y-3">
          <FileText className="w-8 h-8 mx-auto" style={stTextMuted} />
          <p style={stTextMuted}>No documents yet.</p>
          <Link
            href="/documents/new"
            className="text-sm transition-colors"
            style={stAccent}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}>
            Create your first document
          </Link>
        </div>
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
                {formatTypeLabel(type)} ({typeDocs.length})
              </h2>
              <div className="space-y-2">
                {typeDocs.map(doc => {
                  const docFlags = flagsByDoc[doc.id] || [];
                  const docKey = `doc-${doc.id}`;
                  return (
                    <div
                      key={doc.id}
                      className="rounded-xl p-4 transition-colors flex items-center justify-between"
                      style={{
                        position: 'relative' as const,
                        backgroundColor: docFlags.length > 0
                          ? 'color-mix(in srgb, var(--warning) 3%, transparent)'
                          : hoverStates[docKey]
                            ? 'var(--surface-2)'
                            : 'transparent', }}
                      onMouseEnter={() => setHover(docKey, true)}
                      onMouseLeave={() => setHover(docKey, false)}>
                      <Link href={`/documents/${doc.id}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <Edit3 className="w-4 h-4 shrink-0" style={stTextMuted} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-normal truncate" style={stTextPrimary}>{doc.title}</h3>
                              {docFlags.length > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded font-normal shrink-0" style={{ backgroundColor: 'var(--warning-muted)', color: 'var(--text-tertiary)' }}>
                                  {docFlags.length} flag{docFlags.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs mt-0.5" style={stTextMuted}>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {fmtDate(doc.updated_at)}
                              </span>
                              <span>{doc.content.length.toLocaleString()} chars</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <span className="text-xs px-2 py-0.5 rounded" style={STATUS_STYLES[doc.status] || { backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                          {doc.status}
                        </span>
                        <button
                          onClick={() => downloadDoc(doc)}
                          className="p-1 rounded transition-colors"
                          title="Download as Markdown"
                          aria-label="Download as Markdown"
                          style={{ color: hoverStates[`dl-${doc.id}`] ? 'var(--text-secondary)' : 'var(--text-muted)', backgroundColor: hoverStates[`dl-${doc.id}`] ? 'var(--surface-2)' : 'transparent' }}
                          onMouseEnter={() => setHover(`dl-${doc.id}`, true)}
                          onMouseLeave={() => setHover(`dl-${doc.id}`, false)}>
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: doc.id, title: doc.title })}
                          className="text-xs px-2 py-1 rounded transition-colors"
                          style={{ color: hoverStates[`del-${doc.id}`] ? 'var(--danger)' : 'var(--text-muted)', backgroundColor: hoverStates[`del-${doc.id}`] ? 'var(--surface-2)' : 'transparent' }}
                          onMouseEnter={() => setHover(`del-${doc.id}`, true)}
                          onMouseLeave={() => setHover(`del-${doc.id}`, false)}>
                          Del
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* General flags (not tied to a specific document) */}
          {showFlags && generalFlags.length > 0 && (
            <div>
              <h2 className="text-xs font-normal mb-3  flex items-center gap-2" style={stTextTertiary}>
                <AlertTriangle className="w-3 h-3" /> Unmatched Flags ({generalFlags.length})
              </h2>
              <p className="text-xs mb-3" style={stTextMuted}>
                These flags were generated from meeting objections but no matching document type was found. Consider creating content to address them.
              </p>
              <div className="space-y-2">
                {generalFlags.map(flag => (
                  <div key={flag.id} className="rounded-lg p-3 flex items-start justify-between gap-3" style={{ backgroundColor: 'color-mix(in srgb, var(--surface-1) 50%, transparent)' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-1.5 py-0.5 rounded font-normal" style={FLAG_TYPE_STYLE_MAP[flag.flag_type] || DEFAULT_FLAG_STYLE}>
                          {FLAG_TYPE_LABELS[flag.flag_type] || flag.flag_type}
                        </span>
                        <span className="text-xs" style={stTextMuted}>from {flag.investor_name}</span>
                      </div>
                      <p className="text-xs" style={stTextTertiary}>{flag.description}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleFlagAction(flag.id, 'addressed')}
                        className="p-1.5 rounded-md transition-colors"
                        title="Mark as addressed"
                        aria-label="Mark as addressed"
                        style={{ color: hoverStates[`gaddr-${flag.id}`] ? 'var(--success)' : 'var(--text-muted)', backgroundColor: hoverStates[`gaddr-${flag.id}`] ? 'var(--success-muted)' : 'transparent' }}
                        onMouseEnter={() => setHover(`gaddr-${flag.id}`, true)}
                        onMouseLeave={() => setHover(`gaddr-${flag.id}`, false)}>
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleFlagAction(flag.id, 'dismissed')}
                        className="p-1.5 rounded-md transition-colors"
                        title="Dismiss"
                        aria-label="Dismiss"
                        style={{ color: hoverStates[`gdism-${flag.id}`] ? 'var(--danger)' : 'var(--text-muted)', backgroundColor: hoverStates[`gdism-${flag.id}`] ? 'color-mix(in srgb, var(--danger) 20%, transparent)' : 'transparent' }}
                        onMouseEnter={() => setHover(`gdism-${flag.id}`, true)}
                        onMouseLeave={() => setHover(`gdism-${flag.id}`, false)}>
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete document"
        message={`Delete "${deleteTarget?.title}" and all its versions? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

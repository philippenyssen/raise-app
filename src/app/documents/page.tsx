'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { FileText, Plus, Clock, Edit3, Download, ShieldCheck, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface Doc {
  id: string;
  title: string;
  type: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

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
  custom: 'Custom Document',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-900/30 text-yellow-400',
  review: 'bg-blue-900/30 text-blue-400',
  final: 'bg-green-900/30 text-green-400',
};

const FLAG_TYPE_LABELS: Record<string, string> = {
  objection_response: 'Objection',
  number_update: 'Numbers',
  section_improvement: 'Improve',
};

const FLAG_TYPE_STYLES: Record<string, string> = {
  objection_response: 'bg-red-900/30 text-red-400',
  number_update: 'bg-yellow-900/30 text-yellow-400',
  section_improvement: 'bg-blue-900/30 text-blue-400',
};

export default function DocumentsPage() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [flags, setFlags] = useState<DocFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [showFlags, setShowFlags] = useState(true);

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
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-zinc-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {docs.length} documents
            {flags.length > 0 && (
              <span className="text-orange-400 ml-2">
                {flags.length} open flag{flags.length !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {flags.length > 0 && (
            <button
              onClick={() => setShowFlags(!showFlags)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                showFlags ? 'bg-orange-900/30 text-orange-400 border border-orange-800/40' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> {flags.length} Flags
            </button>
          )}
          <Link
            href="/documents/consistency"
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Consistency
          </Link>
          <Link
            href="/documents/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
          <Plus className="w-4 h-4" /> New Document
        </Link>
        </div>
      </div>

      {/* Document Flags Banner */}
      {showFlags && flags.length > 0 && (
        <div className="border border-orange-800/30 bg-orange-900/10 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium text-orange-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Open Document Flags from Meetings
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {flags.map(flag => (
              <div key={flag.id} className="flex items-start gap-3 bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${FLAG_TYPE_STYLES[flag.flag_type] || 'bg-zinc-800 text-zinc-400'}`}>
                      {FLAG_TYPE_LABELS[flag.flag_type] || flag.flag_type}
                    </span>
                    <span className="text-xs text-zinc-500">from {flag.investor_name}</span>
                    <span className="text-xs text-zinc-600">{new Date(flag.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-2">{flag.description}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-zinc-600">Section: {flag.section_hint}</span>
                    {flag.document_id && (
                      <Link
                        href={`/documents/${flag.document_id}`}
                        className="text-[11px] text-blue-500 hover:text-blue-400 underline"
                      >
                        Open document
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleFlagAction(flag.id, 'addressed')}
                    className="p-1.5 rounded-md hover:bg-green-900/30 text-zinc-500 hover:text-green-400 transition-colors"
                    title="Mark as addressed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleFlagAction(flag.id, 'dismissed')}
                    className="p-1.5 rounded-md hover:bg-red-900/30 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Dismiss"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {docs.length === 0 ? (
        <div className="border border-zinc-800 rounded-xl p-8 text-center space-y-3">
          <FileText className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-zinc-500">No documents yet.</p>
          <Link href="/documents/new" className="text-blue-400 hover:text-blue-300 text-sm">
            Create your first document
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([type, typeDocs]) => (
            <div key={type}>
              <h2 className="text-xs font-medium text-zinc-400 mb-3 uppercase">
                {TYPE_LABELS[type] || type} ({typeDocs.length})
              </h2>
              <div className="space-y-2">
                {typeDocs.map(doc => {
                  const docFlags = flagsByDoc[doc.id] || [];
                  return (
                    <div key={doc.id} className={`border rounded-xl p-4 hover:border-zinc-700 transition-colors flex items-center justify-between ${
                      docFlags.length > 0 ? 'border-orange-800/30 bg-orange-900/5' : 'border-zinc-800'
                    }`}>
                      <Link href={`/documents/${doc.id}`} className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <Edit3 className="w-4 h-4 text-zinc-500 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium truncate">{doc.title}</h3>
                              {docFlags.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-900/30 text-orange-400 font-medium shrink-0">
                                  {docFlags.length} flag{docFlags.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(doc.updated_at).toLocaleDateString()}
                              </span>
                              <span>{doc.content.length.toLocaleString()} chars</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[doc.status] || 'bg-zinc-800 text-zinc-500'}`}>
                          {doc.status}
                        </span>
                        <button
                          onClick={() => downloadDoc(doc)}
                          className="text-zinc-600 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition-colors"
                          title="Download as Markdown"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget({ id: doc.id, title: doc.title })}
                          className="text-xs text-zinc-600 hover:text-red-400 px-2 py-1 rounded hover:bg-zinc-800"
                        >
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
              <h2 className="text-xs font-medium text-orange-400 mb-3 uppercase flex items-center gap-2">
                <AlertTriangle className="w-3 h-3" /> Unmatched Flags ({generalFlags.length})
              </h2>
              <p className="text-xs text-zinc-500 mb-3">
                These flags were generated from meeting objections but no matching document type was found. Consider creating content to address them.
              </p>
              <div className="space-y-2">
                {generalFlags.map(flag => (
                  <div key={flag.id} className="border border-orange-800/20 rounded-lg p-3 bg-zinc-900/50 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${FLAG_TYPE_STYLES[flag.flag_type] || 'bg-zinc-800 text-zinc-400'}`}>
                          {FLAG_TYPE_LABELS[flag.flag_type] || flag.flag_type}
                        </span>
                        <span className="text-xs text-zinc-500">from {flag.investor_name}</span>
                      </div>
                      <p className="text-xs text-zinc-400">{flag.description}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleFlagAction(flag.id, 'addressed')}
                        className="p-1.5 rounded-md hover:bg-green-900/30 text-zinc-500 hover:text-green-400 transition-colors"
                        title="Mark as addressed"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleFlagAction(flag.id, 'dismissed')}
                        className="p-1.5 rounded-md hover:bg-red-900/30 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Dismiss"
                      >
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
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

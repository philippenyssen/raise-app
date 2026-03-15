'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import {
  ArrowLeft, Save, Sparkles, CheckCircle, AlertTriangle,
  Clock, History, Eye, Edit3
} from 'lucide-react';
import { DocSummaryRecord as Doc } from '@/lib/types';

interface Version {
  id: string;
  document_id: string;
  content: string;
  version_number: number;
  change_summary: string;
  created_at: string;
}

type AIOperation = 'improve' | 'consistency' | 'weak_arguments' | 'goldman';

export default function DocumentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [doc, setDoc] = useState<Doc | null>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ type: string; data: unknown } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [previewHovered, setPreviewHovered] = useState(false);
  const [historyHovered, setHistoryHovered] = useState(false);
  const [dismissHovered, setDismissHovered] = useState(false);
  const [closeModalHovered, setCloseModalHovered] = useState(false);
  const [applyHovered, setApplyHovered] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${id}`).then(r => {
      if (!r.ok) throw new Error('Failed to load document');
      return r.json();
    }).then(d => {
      setDoc(d);
      setContent(d.content);
      setTitle(d.title);
      setLoading(false);
    }).catch(() => {
      toast('Failed to load document', 'error');
      setLoading(false);
    });
  }, [id, toast]);

  const save = useCallback(async (changeSummary?: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, change_summary: changeSummary || '' }),
      });
      if (!res.ok) throw new Error('Save failed');
      setDirty(false);
      toast('Saved');
      const refreshRes = await fetch(`/api/documents/${id}`);
      if (refreshRes.ok) setDoc(await refreshRes.json());
    } catch {
      toast('Failed to save document', 'error');
    } finally {
      setSaving(false);
    }
  }, [id, title, content, toast]);

  // Keyboard shortcut: Cmd/Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (dirty) save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dirty, save]);

  async function loadVersions() {
    const res = await fetch(`/api/documents/${id}/versions`);
    setVersions(await res.json());
    setShowVersions(true);
  }

  async function restoreVersion(version: Version) {
    setContent(version.content);
    setDirty(true);
    setShowVersions(false);
    toast(`Restored v${version.version_number} — save to keep`, 'info');
  }

  async function updateStatus(status: string) {
    await fetch(`/api/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setDoc(d => d ? { ...d, status } : d);
    toast(`Status: ${status}`);
  }

  async function runAI(operation: AIOperation) {
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch(`/api/documents/${id}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation,
          section: selectedText || undefined,
          instruction: operation === 'improve' ? 'Make more concise, authoritative, and IC-ready' : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast(data.error, 'error');
      } else {
        setAiResult({ type: operation, data: data.result });
        toast('AI analysis complete');
      }
    } catch {
      toast('AI operation failed', 'error');
    }
    setAiLoading(false);
  }

  function applyAIResult() {
    if (!aiResult) return;
    if (aiResult.type === 'improve' || aiResult.type === 'goldman') {
      if (selectedText) {
        setContent(c => c.replace(selectedText, aiResult.data as string));
      } else {
        setContent(aiResult.data as string);
      }
      setDirty(true);
      setAiResult(null);
      toast('Applied AI changes');
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
        <div className="h-[60vh] rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="text-center py-12">
        <p style={{ color: 'var(--text-muted)' }}>Document not found</p>
        <Link href="/documents" className="text-sm mt-2 block" style={{ color: 'var(--accent)' }}>Back to documents</Link>
      </div>
    );
  }

  return (
    <div className="page-content space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/documents" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); setDirty(true); }}
            className="text-xl font-normal bg-transparent border-none focus:outline-none focus:ring-0"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={doc.status}
            onChange={e => updateStatus(e.target.value)}
            className="rounded-lg px-2 py-1 text-xs"
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}
          >
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="final">Final</option>
          </select>
          <button
            onClick={() => setPreview(!preview)}
            className="p-2 rounded-lg text-sm transition-colors"
            title={preview ? 'Edit mode' : 'Preview mode'}
            style={preview ? {
              background: 'var(--accent-muted)',
              color: 'var(--accent)',
            } : {
              background: previewHovered ? 'var(--surface-3)' : 'var(--surface-2)',
              color: 'var(--text-tertiary)',
            }}
            onMouseEnter={() => setPreviewHovered(true)}
            onMouseLeave={() => setPreviewHovered(false)}
          >
            {preview ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={loadVersions}
            className="p-2 rounded-lg transition-colors"
            title="Version history"
            style={{
              background: historyHovered ? 'var(--surface-3)' : 'var(--surface-2)',
              color: 'var(--text-tertiary)',
            }}
            onMouseEnter={() => setHistoryHovered(true)}
            onMouseLeave={() => setHistoryHovered(false)}
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={() => save()}
            disabled={saving || !dirty}
            className="px-3 py-1.5 rounded-lg text-sm font-normal flex items-center gap-1.5 disabled:opacity-50"
            style={{
              background: 'var(--accent)',
              color: 'var(--surface-0)',
            }}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Editor + AI Panel */}
      <div className="flex gap-4">
        {/* Editor */}
        <div className="flex-1 min-w-0">
          {preview ? (
            <div className="rounded-xl p-6 min-h-[60vh] prose prose-invert prose-sm max-w-none">
              <MarkdownPreview content={content} />
            </div>
          ) : (
            <textarea
              value={content}
              onChange={e => { setContent(e.target.value); setDirty(true); }}
              onSelect={e => {
                const target = e.target as HTMLTextAreaElement;
                const selected = target.value.substring(target.selectionStart, target.selectionEnd);
                setSelectedText(selected);
              }}
              className="w-full min-h-[60vh] rounded-xl px-6 py-4 text-sm font-mono leading-relaxed focus:outline-none resize-y"
              placeholder="Start writing..."
              style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-default)'; }}
            />
          )}
          <div className="flex items-center justify-between mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{content.length.toLocaleString()} characters</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last saved: {new Date(doc.updated_at).toLocaleString()}
            </span>
          </div>
        </div>

        {/* AI Panel */}
        <div className="w-72 shrink-0 space-y-3">
          <div className="rounded-xl p-4">
            <h3 className="text-xs font-normal mb-3 flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
              <Sparkles className="w-3.5 h-3.5" /> AI operations
            </h3>
            {selectedText && (
              <div className="text-xs mb-3 p-2 rounded" style={{ color: 'var(--accent)', background: 'var(--accent-muted)' }}>
                {selectedText.length} chars selected — AI will operate on selection
              </div>
            )}
            <div className="space-y-2">
              <AIButton
                label="Improve Section"
                desc="Clarity & concision"
                loading={aiLoading}
                onClick={() => runAI('improve')}
              />
              <AIButton
                label="Goldman Polish"
                desc="Investment banking style"
                loading={aiLoading}
                onClick={() => runAI('goldman')}
              />
              <AIButton
                label="Find Weak Arguments"
                desc="Skeptical IC review"
                loading={aiLoading}
                onClick={() => runAI('weak_arguments')}
              />
              <AIButton
                label="Check Consistency"
                desc="Cross-document numbers"
                loading={aiLoading}
                onClick={() => runAI('consistency')}
              />
            </div>
          </div>

          {/* AI Result */}
          {aiResult && (
            <div className="rounded-xl p-4 max-h-96 overflow-y-auto">
              <h3 className="text-xs font-normal mb-3" style={{ color: 'var(--text-tertiary)' }}>AI result</h3>

              {(aiResult.type === 'improve' || aiResult.type === 'goldman') && (
                <>
                  <pre className="text-xs whitespace-pre-wrap mb-3 max-h-48 overflow-y-auto" style={{ color: 'var(--text-secondary)' }}>
                    {aiResult.data as string}
                  </pre>
                  <button
                    onClick={applyAIResult}
                    className="w-full px-3 py-1.5 rounded-lg text-xs font-normal transition-colors"
                    style={{
                      background: applyHovered ? 'var(--success-muted)' : 'var(--success-muted)',
                      color: 'var(--text-secondary)',
                    }}
                    onMouseEnter={() => setApplyHovered(true)}
                    onMouseLeave={() => setApplyHovered(false)}
                  >
                    <CheckCircle className="w-3 h-3 inline mr-1" /> Apply Changes
                  </button>
                </>
              )}

              {aiResult.type === 'weak_arguments' && (
                <div className="space-y-2">
                  {((aiResult.data as { weaknesses: { claim: string; issue: string; suggestion: string }[] }).weaknesses || []).map((w, i) => (
                    <div key={i} className="text-xs pl-2">
                      <p className="font-normal" style={{ color: 'var(--text-tertiary)' }}>{w.claim}</p>
                      <p className="mt-0.5" style={{ color: 'var(--text-muted)' }}>{w.issue}</p>
                      <p className="mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{w.suggestion}</p>
                    </div>
                  ))}
                </div>
              )}

              {aiResult.type === 'consistency' && (
                <div className="space-y-2">
                  {((aiResult.data as { discrepancies: { location: string; issue: string; suggestion: string }[] }).discrepancies || []).length === 0 ? (
                    <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <CheckCircle className="w-3 h-3" /> No discrepancies found
                    </p>
                  ) : (
                    ((aiResult.data as { discrepancies: { location: string; issue: string; suggestion: string }[] }).discrepancies || []).map((d, i) => (
                      <div key={i} className="text-xs pl-2">
                        <p className="font-normal flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
                          <AlertTriangle className="w-3 h-3" /> {d.location}
                        </p>
                        <p className="mt-0.5" style={{ color: 'var(--text-muted)' }}>{d.issue}</p>
                        <p className="mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{d.suggestion}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              <button
                onClick={() => setAiResult(null)}
                className="w-full mt-3 px-3 py-1 text-xs"
                style={{ color: dismissHovered ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                onMouseEnter={() => setDismissHovered(true)}
                onMouseLeave={() => setDismissHovered(false)}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Version History Modal */}
      {showVersions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--overlay-heavy)' }} onClick={() => setShowVersions(false)}>
          <div className="rounded-xl p-6 max-w-lg w-full max-h-[70vh] overflow-y-auto" style={{ background: 'var(--surface-1)' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-normal mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <History className="w-5 h-5" /> Version History
            </h2>
            {versions.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No versions yet</p>
            ) : (
              <div className="space-y-2">
                {versions.map(v => (
                  <VersionRow key={v.id} version={v} onRestore={restoreVersion} />
                ))}
              </div>
            )}
            <button
              onClick={() => setShowVersions(false)}
              className="mt-4 w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: closeModalHovered ? 'var(--surface-3)' : 'var(--surface-2)',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={() => setCloseModalHovered(true)}
              onMouseLeave={() => setCloseModalHovered(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VersionRow({ version: v, onRestore }: { version: Version; onRestore: (v: Version) => void }) {
  const [hovered, setHovered] = useState(false);
  const [restoreHovered, setRestoreHovered] = useState(false);
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg transition-colors"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div>
        <span className="text-sm font-normal" style={{ color: 'var(--text-primary)' }}>v{v.version_number}</span>
        {v.change_summary && (
          <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>{v.change_summary}</span>
        )}
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {new Date(v.created_at).toLocaleString()} - {v.content.length.toLocaleString()} chars
        </div>
      </div>
      <button
        onClick={() => onRestore(v)}
        className="text-xs px-2 py-1 rounded"
        style={{
          color: 'var(--accent)',
          background: restoreHovered ? 'var(--surface-2)' : 'transparent',
        }}
        onMouseEnter={() => setRestoreHovered(true)}
        onMouseLeave={() => setRestoreHovered(false)}
      >
        Restore
      </button>
    </div>
  );
}

function AIButton({ label, desc, loading, onClick }: { label: string; desc: string; loading: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full text-left px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
      style={{
        background: hovered ? 'var(--surface-2)' : 'var(--surface-1)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{desc}</div>
    </button>
  );
}

function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  function renderInline(text: string): React.ReactNode {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('|')) {
      if (!inTable) { inTable = true; tableRows = []; }
      if (!trimmed.match(/^\|[\s-|]+$/)) {
        tableRows.push(trimmed.split('|').filter(Boolean).map(c => c.trim()));
      }
      return;
    } else if (inTable) {
      inTable = false;
      elements.push(
        <table key={`table-${i}`} className="w-full text-sm my-2" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>{tableRows[0]?.map((h, j) => <th key={j} className="px-2 py-1 text-left text-xs" style={{ border: '1px solid var(--border-strong)', color: 'var(--text-tertiary)' }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {tableRows.slice(1).map((row, ri) => (
              <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="px-2 py-1 text-xs" style={{ border: '1px solid var(--border-default)' }}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      );
      tableRows = [];
    }

    if (trimmed.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-xl font-normal mt-6 mb-2" style={{ color: 'var(--text-primary)' }}>{trimmed.slice(2)}</h1>);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-lg font-normal mt-5 mb-2" style={{ color: 'var(--text-secondary)' }}>{trimmed.slice(3)}</h2>);
    } else if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-normal mt-4 mb-1" style={{ color: 'var(--text-secondary)' }}>{trimmed.slice(4)}</h3>);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <li key={i} className="text-sm ml-4 list-disc" style={{ color: 'var(--text-secondary)' }} dangerouslySetInnerHTML={{ __html: renderInline(trimmed.slice(2)) as string }} />
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      elements.push(
        <li key={i} className="text-sm ml-4 list-decimal" style={{ color: 'var(--text-secondary)' }} dangerouslySetInnerHTML={{ __html: renderInline(trimmed.replace(/^\d+\.\s/, '')) as string }} />
      );
    } else if (trimmed === '') {
      elements.push(<div key={i} className="h-3" />);
    } else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }} dangerouslySetInnerHTML={{ __html: renderInline(trimmed) as string }} />
      );
    }
  });

  return <>{elements}</>;
}

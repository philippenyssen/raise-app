'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import {
  ArrowLeft, Save, Sparkles, CheckCircle, AlertTriangle,
  Clock, History, Eye, Edit3, FileText
} from 'lucide-react';

interface Doc {
  id: string;
  title: string;
  type: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

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

  useEffect(() => {
    fetch(`/api/documents/${id}`).then(r => r.json()).then(d => {
      setDoc(d);
      setContent(d.content);
      setTitle(d.title);
      setLoading(false);
    });
  }, [id]);

  const save = useCallback(async (changeSummary?: string) => {
    setSaving(true);
    await fetch(`/api/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, change_summary: changeSummary || '' }),
    });
    setDirty(false);
    setSaving(false);
    toast('Saved');
    // Refresh doc
    const res = await fetch(`/api/documents/${id}`);
    setDoc(await res.json());
  }, [id, title, content, toast]);

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
        <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse" />
        <div className="h-[60vh] bg-zinc-800/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">Document not found</p>
        <Link href="/documents" className="text-blue-400 text-sm mt-2 block">Back to documents</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/documents" className="text-zinc-500 hover:text-zinc-300">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); setDirty(true); }}
            className="text-xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={doc.status}
            onChange={e => updateStatus(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-300"
          >
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="final">Final</option>
          </select>
          <button
            onClick={() => setPreview(!preview)}
            className={`p-2 rounded-lg text-sm transition-colors ${preview ? 'bg-blue-600/20 text-blue-400' : 'bg-zinc-800 text-zinc-400'}`}
            title={preview ? 'Edit mode' : 'Preview mode'}
          >
            {preview ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={loadVersions}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400"
            title="Version history"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={() => save()}
            disabled={saving || !dirty}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium flex items-center gap-1.5"
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
            <div className="border border-zinc-800 rounded-xl p-6 min-h-[60vh] prose prose-invert prose-sm max-w-none">
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
              className="w-full min-h-[60vh] bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-4 text-sm text-zinc-200 font-mono leading-relaxed focus:outline-none focus:border-blue-600 resize-y"
              placeholder="Start writing..."
            />
          )}
          <div className="flex items-center justify-between mt-2 text-xs text-zinc-600">
            <span>{content.length.toLocaleString()} characters</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last saved: {new Date(doc.updated_at).toLocaleString()}
            </span>
          </div>
        </div>

        {/* AI Panel */}
        <div className="w-72 shrink-0 space-y-3">
          <div className="border border-zinc-800 rounded-xl p-4">
            <h3 className="text-xs font-medium text-zinc-400 mb-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> AI OPERATIONS
            </h3>
            {selectedText && (
              <div className="text-xs text-blue-400 mb-3 p-2 bg-blue-900/10 rounded border border-blue-800/20">
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
            <div className="border border-zinc-800 rounded-xl p-4 max-h-96 overflow-y-auto">
              <h3 className="text-xs font-medium text-zinc-400 mb-3">AI RESULT</h3>

              {(aiResult.type === 'improve' || aiResult.type === 'goldman') && (
                <>
                  <pre className="text-xs text-zinc-300 whitespace-pre-wrap mb-3 max-h-48 overflow-y-auto">
                    {aiResult.data as string}
                  </pre>
                  <button
                    onClick={applyAIResult}
                    className="w-full px-3 py-1.5 bg-green-600/20 text-green-400 border border-green-600/30 rounded-lg text-xs font-medium hover:bg-green-600/30"
                  >
                    <CheckCircle className="w-3 h-3 inline mr-1" /> Apply Changes
                  </button>
                </>
              )}

              {aiResult.type === 'weak_arguments' && (
                <div className="space-y-2">
                  {((aiResult.data as { weaknesses: { claim: string; issue: string; suggestion: string }[] }).weaknesses || []).map((w, i) => (
                    <div key={i} className="text-xs border-l-2 border-yellow-700 pl-2">
                      <p className="text-yellow-400 font-medium">{w.claim}</p>
                      <p className="text-zinc-500 mt-0.5">{w.issue}</p>
                      <p className="text-zinc-400 mt-0.5">{w.suggestion}</p>
                    </div>
                  ))}
                </div>
              )}

              {aiResult.type === 'consistency' && (
                <div className="space-y-2">
                  {((aiResult.data as { discrepancies: { location: string; issue: string; suggestion: string }[] }).discrepancies || []).length === 0 ? (
                    <p className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> No discrepancies found
                    </p>
                  ) : (
                    ((aiResult.data as { discrepancies: { location: string; issue: string; suggestion: string }[] }).discrepancies || []).map((d, i) => (
                      <div key={i} className="text-xs border-l-2 border-red-700 pl-2">
                        <p className="text-red-400 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {d.location}
                        </p>
                        <p className="text-zinc-500 mt-0.5">{d.issue}</p>
                        <p className="text-zinc-400 mt-0.5">{d.suggestion}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              <button
                onClick={() => setAiResult(null)}
                className="w-full mt-3 px-3 py-1 text-xs text-zinc-500 hover:text-zinc-300"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Version History Modal */}
      {showVersions && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowVersions(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <History className="w-5 h-5" /> Version History
            </h2>
            {versions.length === 0 ? (
              <p className="text-sm text-zinc-500">No versions yet</p>
            ) : (
              <div className="space-y-2">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-3 border border-zinc-800 rounded-lg hover:border-zinc-700">
                    <div>
                      <span className="text-sm font-medium">v{v.version_number}</span>
                      {v.change_summary && (
                        <span className="text-xs text-zinc-500 ml-2">{v.change_summary}</span>
                      )}
                      <div className="text-xs text-zinc-600 mt-0.5">
                        {new Date(v.created_at).toLocaleString()} - {v.content.length.toLocaleString()} chars
                      </div>
                    </div>
                    <button
                      onClick={() => restoreVersion(v)}
                      className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-zinc-800"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowVersions(false)}
              className="mt-4 w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AIButton({ label, desc, loading, onClick }: { label: string; desc: string; loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full text-left px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors disabled:opacity-50"
    >
      <div className="text-xs font-medium text-zinc-300">{label}</div>
      <div className="text-[10px] text-zinc-600">{desc}</div>
    </button>
  );
}

function MarkdownPreview({ content }: { content: string }) {
  // Simple markdown rendering — headers, bold, italic, lists, tables
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

    // Table detection
    if (trimmed.startsWith('|')) {
      if (!inTable) { inTable = true; tableRows = []; }
      if (!trimmed.match(/^\|[\s-|]+$/)) { // Skip separator rows
        tableRows.push(trimmed.split('|').filter(Boolean).map(c => c.trim()));
      }
      return;
    } else if (inTable) {
      inTable = false;
      elements.push(
        <table key={`table-${i}`} className="w-full text-sm border-collapse my-2">
          <thead>
            <tr>{tableRows[0]?.map((h, j) => <th key={j} className="border border-zinc-700 px-2 py-1 text-left text-zinc-400 text-xs">{h}</th>)}</tr>
          </thead>
          <tbody>
            {tableRows.slice(1).map((row, ri) => (
              <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="border border-zinc-800 px-2 py-1 text-xs">{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      );
      tableRows = [];
    }

    if (trimmed.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-xl font-bold mt-6 mb-2">{trimmed.slice(2)}</h1>);
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-lg font-bold mt-5 mb-2 text-zinc-200">{trimmed.slice(3)}</h2>);
    } else if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-semibold mt-4 mb-1 text-zinc-300">{trimmed.slice(4)}</h3>);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <li key={i} className="text-sm text-zinc-300 ml-4 list-disc" dangerouslySetInnerHTML={{ __html: renderInline(trimmed.slice(2)) as string }} />
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      elements.push(
        <li key={i} className="text-sm text-zinc-300 ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: renderInline(trimmed.replace(/^\d+\.\s/, '')) as string }} />
      );
    } else if (trimmed === '') {
      elements.push(<div key={i} className="h-3" />);
    } else {
      elements.push(
        <p key={i} className="text-sm text-zinc-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderInline(trimmed) as string }} />
      );
    }
  });

  return <>{elements}</>;
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { cachedFetch } from '@/lib/cache';
import { SplitPane } from '@/components/workspace/split-pane';
import { DocumentViewer } from '@/components/workspace/document-viewer';
import { AIChat } from '@/components/workspace/ai-chat';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { DocSummaryRecord as Doc } from '@/lib/types';
import { FileText, Plus, ChevronRight, Wand2, Loader2 } from 'lucide-react';
import { labelMuted, stAccent, stTextMuted } from '@/lib/styles';

const TYPE_ORDER = ['teaser', 'exec_summary', 'one_pager', 'exec_brief', 'memo', 'deck', 'dd_memo', 'custom'];
const TYPE_LABELS: Record<string, string> = {
  teaser: 'Teaser',
  exec_summary: 'Executive Summary',
  one_pager: 'One-Pager',
  exec_brief: 'Executive Brief',
  memo: 'Investment Memo',
  deck: 'Long-Form Deck',
  dd_memo: 'DD Memo',
  custom: 'Custom',};

export default function WorkspacePage() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [contentHistory, setContentHistory] = useState<string[]>([]);
  const [pendingDoc, setPendingDoc] = useState<Doc | null>(null);

  // Hover states for interactive elements
  const [hoveredDocId, setHoveredDocId] = useState<string | null>(null);
  const [hoveredGenType, setHoveredGenType] = useState<string | null>(null);
  const [chevronHover, setChevronHover] = useState(false);
  const [closedChevronHover, setClosedChevronHover] = useState(false);
  const [newDocHover, setNewDocHover] = useState(false);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await cachedFetch('/api/documents');
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setDocs(await res.json());
    } catch {
      toast('Couldn\'t load documents — try refreshing the page', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { document.title = 'Raise | Workspace'; }, []);
  useEffect(() => { fetchDocs(); }, [fetchDocs]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchDocs(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fetchDocs]);

  const doSelectDoc = useCallback(async (doc: Doc) => {
    setDirty(false);
    setPendingDoc(null);
    // If content already loaded, use it; otherwise fetch full doc
    if (doc.content) {
      setSelectedDoc(doc);
      setEditedContent(doc.content);
    } else {
      try {
        const res = await fetch(`/api/documents/${doc.id}`);
        if (res.ok) {
          const full = await res.json();
          setSelectedDoc(full);
          setEditedContent(full.content || '');
        } else {
          setSelectedDoc({ ...doc, content: '' });
          setEditedContent('');
        }
      } catch {
        setSelectedDoc({ ...doc, content: '' });
        setEditedContent('');
      }
    }
  }, []);

  const selectDoc = useCallback((doc: Doc) => {
    if (dirty && selectedDoc) {
      setPendingDoc(doc);
      return;
    }
    doSelectDoc(doc);
  }, [dirty, selectedDoc, doSelectDoc]);

  const handleContentChange = useCallback((content: string) => {
    setEditedContent(content);
    setDirty(true);
    if (selectedDoc) {
      setSelectedDoc({ ...selectedDoc, content });
    }
  }, [selectedDoc]);

  const handleSave = useCallback(async () => {
    if (!selectedDoc || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent, change_summary: 'Updated via workspace' }),});
      if (!res.ok) throw new Error('Save failed');
      const updated = { ...selectedDoc, content: editedContent, updated_at: new Date().toISOString() };
      setSelectedDoc(updated);
      setDirty(false);
      toast('Document saved');
      fetchDocs();
    } catch {
      toast('Couldn\'t save document — try again', 'error');
    } finally {
      setSaving(false);
    }
  }, [selectedDoc, dirty, editedContent, toast, fetchDocs]);

  const handleApplyAIChange = useCallback((newContent: string) => {
    // Push current content to history before applying AI changes (for undo)
    setContentHistory(prev => [...prev.slice(-19), editedContent]);
    handleContentChange(newContent);
    toast('AI changes applied — review and save. Ctrl+Z to undo.');
  }, [handleContentChange, toast, editedContent]);

  const handleUndo = useCallback(() => {
    if (contentHistory.length === 0) return;
    const previous = contentHistory[contentHistory.length - 1];
    setContentHistory(prev => prev.slice(0, -1));
    handleContentChange(previous);
    toast('Undone');
  }, [contentHistory, handleContentChange, toast]);

  const generateDeliverable = useCallback(async (type: string) => {
    setGenerating(type);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),});
      const data = await res.json();
      if (data.error) {
        toast(data.error, 'error');
      } else {
        toast(`Generated ${TYPE_LABELS[type] || type} — ${data.action}`);
        // Single fetch to refresh and select the generated doc
        const refreshRes = await fetch('/api/documents');
        if (refreshRes.ok) {
          const allDocs: Doc[] = await refreshRes.json();
          setDocs(allDocs);
          const generated = allDocs.find((d: Doc) => d.type === type);
          if (generated) selectDoc(generated);
        }}
    } catch {
      toast('Couldn\'t generate deliverable — check your API key and retry', 'error');
    } finally {
      setGenerating(null);
    }
  }, [toast, fetchDocs, selectDoc]);

  // Keyboard shortcuts: Cmd/Ctrl+S to save, Cmd/Ctrl+Z to undo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }};
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, handleUndo]);

  // Sort docs by type order
  const sortedDocs = [...docs].sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a.type);
    const bi = TYPE_ORDER.indexOf(b.type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);});

  // Group by type
  const grouped = sortedDocs.reduce<Record<string, Doc[]>>((acc, doc) => {
    const type = doc.type || 'custom';
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="space-y-4 page-content">
        <div className="skeleton" style={{ height: '28px', width: '180px' }} />
        <div className="flex gap-4" style={{ height: 'calc(100vh - 10rem)' }}>
          <div className="skeleton" style={{ width: '240px', borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton flex-1" style={{ borderRadius: 'var(--radius-lg)' }} />
        </div>
      </div>);
  }

  return (
    <div className="page-content h-[calc(100vh-4rem)] -mx-6 -my-8 flex">
      {/* Document sidebar */}
      {sidebarOpen && (
        <div
          className="w-56 shrink-0 flex flex-col overflow-hidden"
          style={{ borderRight: '1px solid var(--border-default)', background: 'var(--surface-0)' }}>
          <div
            className="flex items-center justify-between"
            style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border-default)' }}>
            <span
              className=""
              style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-tertiary)' }}>
              Deliverables</span>
            <button
              onClick={() => setSidebarOpen(false)}
              onMouseEnter={() => setChevronHover(true)}
              onMouseLeave={() => setChevronHover(false)}
              style={{
                color: chevronHover ? 'var(--text-tertiary)' : 'var(--text-muted)',
                transition: 'color 150ms ease',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center', }}>
              <ChevronRight className="w-4 h-4 rotate-180" /></button></div>
          <div
            className="flex-1 overflow-y-auto space-y-3"
            style={{ padding: 'var(--space-2)' }}>
            {Object.entries(grouped).map(([type, typeDocs]) => (
              <div key={type}>
                <div
                  className=""
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 400,
                    color: 'var(--text-muted)',
                    padding: '0 var(--space-2)',
                    marginBottom: 'var(--space-1)', }}>
                  {TYPE_LABELS[type] || type}</div>
                {typeDocs.map(doc => {
                  const isSelected = selectedDoc?.id === doc.id;
                  const isHovered = hoveredDocId === doc.id;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => selectDoc(doc)}
                      onMouseEnter={() => setHoveredDocId(doc.id)}
                      onMouseLeave={() => setHoveredDocId(null)}
                      className="w-full text-left"
                      style={{
                        padding: 'var(--space-1) var(--space-2)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-sm)',
                        transition: 'all 150ms ease',
                        background: isSelected
                          ? 'var(--surface-2)'
                          : isHovered
                            ? 'var(--surface-2)'
                            : 'transparent',
                        color: isSelected
                          ? 'var(--text-primary)'
                          : isHovered
                            ? 'var(--text-secondary)'
                            : 'var(--text-tertiary)',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'block',
                        width: '100%', }}>
                      <div className="truncate">{doc.title}</div>
                    </button>);
                })}</div>
            ))}
            {docs.length === 0 && (
              <div className="text-center space-y-2" style={{ padding: 'var(--space-8) 0' }}>
                <FileText
                  className="w-6 h-6 mx-auto"
                  style={stTextMuted} />
                <p style={labelMuted}>
                  No deliverables yet. Generate one below or create a new document.</p></div>
            )}</div>
          {/* Generate section */}
          <div
            className="space-y-1"
            style={{ padding: 'var(--space-2)', borderTop: '1px solid var(--border-default)' }}>
            <div
              className=""
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 400,
                color: 'var(--text-muted)',
                padding: '0 var(--space-2)',
                marginBottom: 'var(--space-1)', }}>
              Generate from Data Room</div>
            {['teaser', 'exec_summary', 'memo', 'deck', 'dd_memo'].map(type => {
              const exists = docs.some(d => d.type === type);
              const isHovered = hoveredGenType === type;
              const isDisabled = generating !== null;
              return (
                <button
                  key={type}
                  onClick={() => generateDeliverable(type)}
                  disabled={isDisabled}
                  onMouseEnter={() => setHoveredGenType(type)}
                  onMouseLeave={() => setHoveredGenType(null)}
                  className="w-full flex items-center gap-2"
                  style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-xs)',
                    color: isHovered && !isDisabled
                      ? 'var(--text-secondary)'
                      : 'var(--text-muted)',
                    background: isHovered && !isDisabled
                      ? 'var(--surface-2)'
                      : 'transparent',
                    transition: 'all 150ms ease',
                    opacity: isDisabled ? 0.5 : 1,
                    border: 'none',
                    cursor: isDisabled ? 'default' : 'pointer', }}>
                  {generating === type ? (
                    <Loader2
                      className="w-3.5 h-3.5 animate-spin"
                      style={stAccent} />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span className="truncate">{exists ? 'Regenerate' : 'Generate'} {TYPE_LABELS[type] || type}</span>
                </button>);
            })}</div>
          <div style={{ padding: 'var(--space-2)', borderTop: '1px solid var(--border-default)' }}>
            <a
              href="/documents/new"
              onMouseEnter={() => setNewDocHover(true)}
              onMouseLeave={() => setNewDocHover(false)}
              className="flex items-center gap-2 transition-colors"
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                color: newDocHover ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                background: newDocHover ? 'var(--surface-2)' : 'transparent',
                transition: 'all 150ms ease',
                textDecoration: 'none', }}>
              <Plus className="w-4 h-4" /> New Document</a></div></div>
      )}

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          onMouseEnter={() => setClosedChevronHover(true)}
          onMouseLeave={() => setClosedChevronHover(false)}
          aria-label="Open document sidebar"
          title="Open sidebar"
          className="w-8 shrink-0 flex items-center justify-center"
          style={{
            borderRight: '1px solid var(--border-default)',
            background: closedChevronHover ? 'var(--surface-2)' : 'transparent',
            transition: 'background 150ms ease',
            border: 'none',
            borderRightStyle: 'solid',
            borderRightWidth: '1px',
            borderRightColor: 'var(--border-default)',
            cursor: 'pointer', }}>
          <ChevronRight className="w-4 h-4" style={stTextMuted} aria-hidden="true" /></button>
      )}

      {/* Split Pane: Document + AI Chat */}
      <div className="flex-1">
        <SplitPane
          left={
            <DocumentViewer
              document={selectedDoc ? { ...selectedDoc, content: editedContent } : null}
              onContentChange={handleContentChange}
              onSave={handleSave}
              saving={saving}
              dirty={dirty} />
          }
          right={
            <AIChat
              documentId={selectedDoc?.id ?? null}
              documentContent={editedContent}
              documentTitle={selectedDoc?.title ?? ''}
              onApplyChange={handleApplyAIChange} />
          }
          defaultSplit={58} /></div>

      <ConfirmModal
        open={!!pendingDoc}
        title="Unsaved changes"
        message="You have unsaved edits to this document. Discard them?"
        confirmLabel="Discard"
        variant="danger"
        onConfirm={() => { if (pendingDoc) doSelectDoc(pendingDoc); }}
        onCancel={() => setPendingDoc(null)} />
    </div>);
}

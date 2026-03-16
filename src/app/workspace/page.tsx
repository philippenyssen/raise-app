'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { cachedFetch } from '@/lib/cache';
import { SplitPane } from '@/components/workspace/split-pane';

const DocumentViewer = dynamic(() => import('@/components/workspace/document-viewer').then(m => ({ default: m.DocumentViewer })), { ssr: false });
const AIChat = dynamic(() => import('@/components/workspace/ai-chat').then(m => ({ default: m.AIChat })), { ssr: false });
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { DocSummaryRecord as Doc } from '@/lib/types';
import { FileText, Plus, ChevronRight, Wand2, Loader2, FilePlus, FileSpreadsheet, Presentation } from 'lucide-react';
import { labelMuted, stAccent, stTextMuted } from '@/lib/styles';
import { EmptyState } from '@/components/ui/empty-state';

const TYPE_ORDER = ['teaser', 'exec_summary', 'one_pager', 'exec_brief', 'memo', 'presentation', 'deck', 'dd_memo', 'model', 'custom'];
const TYPE_LABELS: Record<string, string> = {
  teaser: 'Teaser',
  exec_summary: 'Executive Summary',
  one_pager: 'One-Pager',
  exec_brief: 'Executive Brief',
  memo: 'Investment Memo',
  presentation: 'Presentation',
  deck: 'Long-Form Deck',
  dd_memo: 'DD Memo',
  model: 'Financial Model',
  custom: 'Custom',};

const docBtnBase: React.CSSProperties = { padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', border: 'none', cursor: 'pointer', display: 'block', width: '100%' };
const genBtnBase: React.CSSProperties = { padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-md)', ...labelMuted, border: 'none' };
const typeGroupLabel = { fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-muted)', padding: '0 var(--space-2)', marginBottom: 'var(--space-1)' } as const;
const docBtnActive: React.CSSProperties = { ...docBtnBase, background: 'var(--surface-2)', color: 'var(--text-primary)' };
const genBtnEnabled: React.CSSProperties = { ...genBtnBase, opacity: 1, cursor: 'pointer' };
const genBtnDisabled: React.CSSProperties = { ...genBtnBase, opacity: 0.5, cursor: 'default' };
const sectionDividerStyle: React.CSSProperties = { padding: 'var(--space-2)', borderTop: '1px solid var(--border-default)' };
const closeSidebarBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' };
const sidebarOpenBtnStyle: React.CSSProperties = { background: 'transparent', border: 'none', borderRightStyle: 'solid', borderRightWidth: '1px', borderRightColor: 'var(--border-default)', cursor: 'pointer' };
const newDocLinkStyle: React.CSSProperties = { padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', textDecoration: 'none' };

export default function WorkspacePage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
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
  const [autoSelected, setAutoSelected] = useState(false);
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showNewDocMenu, setShowNewDocMenu] = useState(false);
  const newDocMenuRef = useRef<HTMLDivElement>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await cachedFetch('/api/documents');
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const fetched = await res.json();
      setDocs(fetched);
      return fetched as Doc[];
    } catch (e) {
      console.warn('[WORKSPACE_FETCH]', e instanceof Error ? e.message : e);
      toast('Couldn\'t load documents — try refreshing the page', 'error');
      return [] as Doc[];
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
        const res = await cachedFetch(`/api/documents/${doc.id}`);
        if (res.ok) {
          const full = await res.json();
          setSelectedDoc(full);
          setEditedContent(full.content || '');
        } else {
          setSelectedDoc({ ...doc, content: '' });
          setEditedContent('');
        }
      } catch (e) {
        console.warn('[WORKSPACE_DOC]', e instanceof Error ? e.message : e);
        setSelectedDoc({ ...doc, content: '' });
        setEditedContent('');
      }
    }
  }, []);

  // Auto-select document from URL query parameter (?doc=TYPE)
  useEffect(() => {
    const docType = searchParams.get('doc');
    if (docType && !autoSelected && docs.length > 0 && !selectedDoc) {
      const match = docs.find(d => d.type === docType);
      if (match) {
        setAutoSelected(true);
        doSelectDoc(match);
      }
    }
  }, [docs, searchParams, autoSelected, selectedDoc, doSelectDoc]);

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
    } catch (e) {
      console.warn('[WORKSPACE_SAVE]', e instanceof Error ? e.message : e);
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
        const refreshRes = await cachedFetch('/api/documents');
        if (refreshRes.ok) {
          const allDocs: Doc[] = await refreshRes.json();
          setDocs(allDocs);
          const generated = allDocs.find((d: Doc) => d.type === type);
          if (generated) selectDoc(generated);
        }}
    } catch (e) {
      console.warn('[WORKSPACE_GENERATE]', e instanceof Error ? e.message : e);
      toast('Couldn\'t generate deliverable — check your API key and retry', 'error');
    } finally {
      setGenerating(null);
    }
  }, [toast, fetchDocs, selectDoc]);

  const createNewDocument = useCallback(async (docType: 'custom' | 'presentation' | 'model' = 'custom') => {
    setCreatingDoc(true);
    setShowNewDocMenu(false);
    const defaults: Record<string, { title: string; content: string }> = {
      custom: { title: 'New Document', content: '<h1>New Document</h1>\n<p>Start writing here...</p>' },
      presentation: {
        title: 'New Presentation',
        content: JSON.stringify([
          { id: crypto.randomUUID(), layout: 'title', elements: [
            { id: crypto.randomUUID(), type: 'title', content: 'Presentation Title', x: 5, y: 30, width: 90 },
            { id: crypto.randomUUID(), type: 'subtitle', content: 'Subtitle goes here', x: 5, y: 55, width: 90 },
          ]},
          { id: crypto.randomUUID(), layout: 'title_content', elements: [
            { id: crypto.randomUUID(), type: 'title', content: 'Slide Title', x: 5, y: 5, width: 90 },
            { id: crypto.randomUUID(), type: 'body', content: 'Add your content here...', x: 5, y: 25, width: 90 },
          ]},
        ], null, 2),
      },
      model: {
        title: 'New Spreadsheet',
        content: JSON.stringify({
          A1: { v: 'Label', t: 's', bold: true }, B1: { v: 'Value', t: 's', bold: true },
          A2: { v: 'Revenue', t: 's' }, B2: { v: 0, t: 'n' },
          A3: { v: 'Costs', t: 's' }, B3: { v: 0, t: 'n' },
          A4: { v: 'Profit', t: 's', bold: true }, B4: { v: 0, t: 'n', f: '=B2-B3' },
        }, null, 2),
      },
    };
    const d = defaults[docType];
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: d.title, type: docType, content: d.content }),
      });
      if (!res.ok) throw new Error('Failed to create');
      const doc = await res.json();
      toast('Document created');
      const refreshed = await fetchDocs();
      const created = refreshed.find((dd: Doc) => dd.id === doc.id);
      if (created) selectDoc(created);
    } catch (e) {
      console.warn('[WORKSPACE_CREATE]', e instanceof Error ? e.message : e);
      toast('Failed to create document', 'error');
    } finally {
      setCreatingDoc(false);
    }
  }, [toast, fetchDocs, selectDoc]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!selectedDoc) return;
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Status update failed');
      setSelectedDoc({ ...selectedDoc, status: newStatus });
      toast(`Status: ${newStatus}`);
      fetchDocs();
    } catch (e) {
      console.warn('[WORKSPACE_STATUS]', e instanceof Error ? e.message : e);
      toast('Failed to update status', 'error');
    }
  }, [selectedDoc, toast, fetchDocs]);

  const handleTitleChange = useCallback(async (newTitle: string) => {
    if (!selectedDoc) return;
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!res.ok) throw new Error('Rename failed');
      setSelectedDoc({ ...selectedDoc, title: newTitle });
      toast('Title updated');
      fetchDocs();
    } catch (e) {
      console.warn('[WORKSPACE_RENAME]', e instanceof Error ? e.message : e);
      toast('Failed to rename', 'error');
    }
  }, [selectedDoc, toast, fetchDocs]);

  const handleDelete = useCallback(async () => {
    if (!selectedDoc) return;
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setSelectedDoc(null);
      setEditedContent('');
      setDirty(false);
      setDeleteConfirm(false);
      toast('Document deleted');
      fetchDocs();
    } catch (e) {
      console.warn('[WORKSPACE_DELETE]', e instanceof Error ? e.message : e);
      toast('Failed to delete document', 'error');
    }
  }, [selectedDoc, toast, fetchDocs]);

  // Close new doc menu on outside click
  useEffect(() => {
    if (!showNewDocMenu) return;
    const handler = (e: MouseEvent) => {
      if (newDocMenuRef.current && !newDocMenuRef.current.contains(e.target as Node)) {
        setShowNewDocMenu(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [showNewDocMenu]);

  // Auto-save: debounce 3 seconds after last edit
  useEffect(() => {
    if (!dirty || !selectedDoc || saving) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSave();
    }, 3000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [dirty, editedContent, selectedDoc, saving, handleSave]);

  // Keyboard shortcuts: Cmd/Ctrl+S to save, Cmd/Ctrl+Z to undo, Cmd/Ctrl+N for new doc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, handleUndo]);

  // Sort + group docs by type (memoized)
  const { sortedDocs, grouped } = useMemo(() => {
    const sorted = [...docs].sort((a, b) => {
      const ai = TYPE_ORDER.indexOf(a.type);
      const bi = TYPE_ORDER.indexOf(b.type);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    const groups = sorted.reduce<Record<string, Doc[]>>((acc, doc) => {
      const type = doc.type || 'custom';
      if (!acc[type]) acc[type] = [];
      acc[type].push(doc);
      return acc;
    }, {});
    return { sortedDocs: sorted, grouped: groups };
  }, [docs]);

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
              className="icon-delete"
              aria-label="Close sidebar"
              style={closeSidebarBtnStyle}>
              <ChevronRight className="w-4 h-4 rotate-180" /></button></div>
          <div
            className="flex-1 overflow-y-auto space-y-3"
            style={{ padding: 'var(--space-2)' }}>
            {Object.entries(grouped).map(([type, typeDocs]) => (
              <div key={type}>
                <div style={typeGroupLabel}>
                  {TYPE_LABELS[type] || type}</div>
                {typeDocs.map(doc => {
                  const isSelected = selectedDoc?.id === doc.id;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => selectDoc(doc)}
                      className={`w-full text-left ${isSelected ? '' : 'sidebar-link'}`}
                      style={isSelected ? docBtnActive : docBtnBase}>
                      <div className="flex items-center gap-2">
                        <div className="truncate flex-1">{doc.title}</div>
                        {isSelected && dirty && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--warning)' }} title="Unsaved changes" />}
                      </div>
                    </button>);
                })}</div>
            ))}
            {docs.length === 0 && (
              <EmptyState
                icon={FileText}
                title="No deliverables yet"
                description="Generate one below or create a new document." />
            )}</div>
          {/* Generate section */}
          <div
            className="space-y-1"
            style={sectionDividerStyle}>
            <div style={typeGroupLabel}>
              Generate from Data Room</div>
            {['teaser', 'exec_summary', 'memo', 'deck', 'dd_memo', 'spreadsheet_model'].map(genType => {
              const checkType = genType === 'deck' ? 'presentation' : genType === 'spreadsheet_model' ? 'model' : genType;
              const exists = docs.some(d => d.type === checkType || d.type === genType);
              const isDisabled = generating !== null;
              const label = genType === 'spreadsheet_model' ? 'Financial Model' : TYPE_LABELS[genType] || genType;
              return (
                <button
                  key={genType}
                  onClick={() => generateDeliverable(genType)}
                  disabled={isDisabled}
                  className="w-full flex items-center gap-2 sidebar-link"
                  style={isDisabled ? genBtnDisabled : genBtnEnabled}>
                  {generating === genType ? (
                    <Loader2
                      className="w-3.5 h-3.5 animate-spin"
                      style={stAccent} />
                  ) : (
                    <Wand2 className="w-3.5 h-3.5" />
                  )}
                  <span className="truncate">{exists ? 'Regenerate' : 'Generate'} {label}</span>
                </button>);
            })}</div>
          <div className="space-y-1" style={sectionDividerStyle}>
            <div className="relative" ref={newDocMenuRef}>
              <button
                onClick={() => setShowNewDocMenu(!showNewDocMenu)}
                disabled={creatingDoc}
                className="w-full flex items-center gap-2 sidebar-link"
                style={genBtnEnabled}>
                <FilePlus className="w-3.5 h-3.5" />
                <span className="truncate">New Document</span>
              </button>
              {showNewDocMenu && (
                <div
                  className="absolute z-50"
                  style={{
                    bottom: '100%',
                    left: 0,
                    right: 0,
                    marginBottom: '4px',
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-lg)',
                    overflow: 'hidden',
                  }}>
                  {([
                    { type: 'custom' as const, icon: FileText, label: 'Text Document' },
                    { type: 'presentation' as const, icon: Presentation, label: 'Presentation' },
                    { type: 'model' as const, icon: FileSpreadsheet, label: 'Spreadsheet' },
                  ]).map(({ type, icon: Icon, label }) => (
                    <button
                      key={type}
                      onClick={() => createNewDocument(type)}
                      className="w-full flex items-center gap-2"
                      style={{ padding: 'var(--space-2) var(--space-3)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <a
              href="/context"
              className="flex items-center gap-2 sidebar-link"
              style={newDocLinkStyle}>
              <Plus className="w-4 h-4" /> Generate from Context</a></div></div>
      )}

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open document sidebar"
          title="Open sidebar"
          className="w-8 shrink-0 flex items-center justify-center btn-surface"
          style={sidebarOpenBtnStyle}>
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
              onDelete={() => setDeleteConfirm(true)}
              onTitleChange={handleTitleChange}
              onStatusChange={handleStatusChange}
              saving={saving}
              dirty={dirty} />
          }
          right={
            <AIChat
              documentId={selectedDoc?.id ?? null}
              documentContent={editedContent}
              documentTitle={selectedDoc?.title ?? ''}
              documentType={selectedDoc?.type}
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

      <ConfirmModal
        open={deleteConfirm}
        title="Delete document"
        message={`Delete "${selectedDoc?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(false)} />
    </div>);
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { SplitPane } from '@/components/workspace/split-pane';
import { DocumentViewer } from '@/components/workspace/document-viewer';
import { AIChat } from '@/components/workspace/ai-chat';
import { useToast } from '@/components/toast';
import { FileText, Plus, ChevronRight } from 'lucide-react';

interface Doc {
  id: string;
  title: string;
  type: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const TYPE_ORDER = ['teaser', 'exec_summary', 'one_pager', 'exec_brief', 'memo', 'deck', 'dd_memo', 'custom'];
const TYPE_LABELS: Record<string, string> = {
  teaser: 'Teaser',
  exec_summary: 'Executive Summary',
  one_pager: 'One-Pager',
  exec_brief: 'Executive Brief',
  memo: 'Investment Memo',
  deck: 'Long-Form Deck',
  dd_memo: 'DD Memo',
  custom: 'Custom',
};

export default function WorkspacePage() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fetchDocs = useCallback(async () => {
    const res = await fetch('/api/documents');
    const data = await res.json();
    setDocs(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const selectDoc = useCallback((doc: Doc) => {
    if (dirty && selectedDoc) {
      if (!confirm('You have unsaved changes. Discard them?')) return;
    }
    setSelectedDoc(doc);
    setEditedContent(doc.content);
    setDirty(false);
  }, [dirty, selectedDoc]);

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
    await fetch(`/api/documents/${selectedDoc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editedContent, change_summary: 'Updated via workspace' }),
    });
    const updated = { ...selectedDoc, content: editedContent, updated_at: new Date().toISOString() };
    setSelectedDoc(updated);
    setDirty(false);
    setSaving(false);
    toast('Document saved');
    fetchDocs();
  }, [selectedDoc, dirty, editedContent, toast, fetchDocs]);

  const handleApplyAIChange = useCallback((newContent: string) => {
    handleContentChange(newContent);
    toast('AI changes applied — review and save');
  }, [handleContentChange, toast]);

  // Keyboard shortcut: Cmd/Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  // Sort docs by type order
  const sortedDocs = [...docs].sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a.type);
    const bi = TYPE_ORDER.indexOf(b.type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // Group by type
  const grouped = sortedDocs.reduce<Record<string, Doc[]>>((acc, doc) => {
    const type = doc.type || 'custom';
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-zinc-600 text-sm">Loading workspace...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] -mx-6 -my-8 flex">
      {/* Document sidebar */}
      {sidebarOpen && (
        <div className="w-56 shrink-0 border-r border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase">Deliverables</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {Object.entries(grouped).map(([type, typeDocs]) => (
              <div key={type}>
                <div className="text-[10px] font-medium text-zinc-600 uppercase px-2 mb-1">
                  {TYPE_LABELS[type] || type}
                </div>
                {typeDocs.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => selectDoc(doc)}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedDoc?.id === doc.id
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="truncate">{doc.title}</div>
                  </button>
                ))}
              </div>
            ))}
            {docs.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <FileText className="w-6 h-6 text-zinc-700 mx-auto" />
                <p className="text-xs text-zinc-600">No documents yet</p>
              </div>
            )}
          </div>
          <div className="p-2 border-t border-zinc-800">
            <a
              href="/documents/new"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Document
            </a>
          </div>
        </div>
      )}

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-8 shrink-0 border-r border-zinc-800 flex items-center justify-center hover:bg-zinc-800/50 transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-zinc-600" />
        </button>
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
              dirty={dirty}
            />
          }
          right={
            <AIChat
              documentId={selectedDoc?.id ?? null}
              documentContent={editedContent}
              documentTitle={selectedDoc?.title ?? ''}
              onApplyChange={handleApplyAIChange}
            />
          }
          defaultSplit={58}
        />
      </div>
    </div>
  );
}

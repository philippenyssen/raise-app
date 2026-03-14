'use client';

import { useState, useCallback } from 'react';
import { FileText, Eye, Edit3, Save, Clock, Download } from 'lucide-react';

interface DocumentViewerProps {
  document: {
    id: string;
    title: string;
    type: string;
    content: string;
    status: string;
    updated_at: string;
  } | null;
  onContentChange: (content: string) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
  review: 'bg-blue-900/30 text-blue-400 border-blue-800',
  final: 'bg-green-900/30 text-green-400 border-green-800',
};

const TYPE_LABELS: Record<string, string> = {
  teaser: 'Teaser',
  exec_summary: 'Executive Summary',
  memo: 'Investment Memo',
  deck: 'Long-Form Deck',
  dd_memo: 'DD Memo',
  custom: 'Document',
  one_pager: 'One-Pager',
  exec_brief: 'Executive Brief',
};

export function DocumentViewer({ document, onContentChange, onSave, saving, dirty }: DocumentViewerProps) {
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');

  const renderMarkdown = useCallback((content: string) => {
    // Simple markdown rendering
    return content
      .split('\n')
      .map((line, i) => {
        // Headers
        if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-6 mb-3">{line.slice(2)}</h1>;
        if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-semibold mt-5 mb-2 text-zinc-200">{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-medium mt-4 mb-1.5 text-zinc-300">{line.slice(4)}</h3>;
        if (line.startsWith('#### ')) return <h4 key={i} className="text-base font-medium mt-3 mb-1 text-zinc-400">{line.slice(5)}</h4>;
        // Bold
        const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-zinc-100 font-semibold">$1</strong>');
        // Italic
        const italicLine = boldLine.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // List items
        if (line.startsWith('- ')) return <li key={i} className="ml-4 text-zinc-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: italicLine.slice(2) }} />;
        if (/^\d+\. /.test(line)) return <li key={i} className="ml-4 text-zinc-300 leading-relaxed list-decimal" dangerouslySetInnerHTML={{ __html: italicLine.replace(/^\d+\. /, '') }} />;
        // Table rows
        if (line.startsWith('|')) {
          const cells = line.split('|').filter(c => c.trim());
          if (cells.every(c => /^[\s-:]+$/.test(c))) return <hr key={i} className="border-zinc-800 my-0" />;
          const isHeader = i > 0; // simplified
          return (
            <div key={i} className="flex border-b border-zinc-800/50">
              {cells.map((cell, j) => (
                <div key={j} className={`flex-1 px-3 py-1.5 text-sm ${isHeader ? 'text-zinc-300' : 'text-zinc-400 font-medium'}`}
                  dangerouslySetInnerHTML={{ __html: cell.trim() }}
                />
              ))}
            </div>
          );
        }
        // Blockquote
        if (line.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-blue-600 pl-4 text-zinc-400 italic my-2">{line.slice(2)}</blockquote>;
        // Horizontal rule
        if (line.match(/^---+$/)) return <hr key={i} className="border-zinc-800 my-4" />;
        // Empty line
        if (line.trim() === '') return <div key={i} className="h-3" />;
        // Regular paragraph
        return <p key={i} className="text-zinc-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: italicLine }} />;
      });
  }, []);

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-600">
        <div className="text-center space-y-3">
          <FileText className="w-12 h-12 mx-auto" />
          <p className="text-sm">Select a document to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-zinc-800 px-4 py-2 flex items-center justify-between bg-zinc-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_COLORS[document.status] || 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
            {document.status}
          </span>
          <h2 className="font-medium truncate">{document.title}</h2>
          <span className="text-xs text-zinc-600">{TYPE_LABELS[document.type] || document.type}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-zinc-600 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(document.updated_at).toLocaleString()}
          </span>
          <span className="text-xs text-zinc-600">
            {document.content.length.toLocaleString()} chars
          </span>
          <div className="w-px h-4 bg-zinc-800" />
          <button
            onClick={() => setMode(mode === 'preview' ? 'edit' : 'preview')}
            className={`p-1.5 rounded transition-colors ${
              mode === 'edit' ? 'bg-blue-600/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
            title={mode === 'preview' ? 'Edit' : 'Preview'}
          >
            {mode === 'preview' ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={onSave}
            disabled={!dirty || saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              dirty ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-600'
            }`}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
          </button>
          <button className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors" title="Export">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {mode === 'edit' ? (
          <textarea
            value={document.content}
            onChange={e => onContentChange(e.target.value)}
            className="w-full h-full bg-transparent px-8 py-6 text-sm text-zinc-200 font-mono leading-relaxed focus:outline-none resize-none"
            spellCheck={false}
          />
        ) : (
          <div className="px-8 py-6 max-w-4xl">
            {renderMarkdown(document.content)}
          </div>
        )}
      </div>
    </div>
  );
}

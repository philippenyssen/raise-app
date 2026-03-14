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

  // Safe inline text rendering (no dangerouslySetInnerHTML)
  const renderInline = useCallback((text: string, key: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let idx = 0;

    while (remaining.length > 0) {
      // Bold
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(<span key={`${key}-${idx++}`}>{remaining.slice(0, boldMatch.index)}</span>);
        }
        parts.push(<strong key={`${key}-${idx++}`} className="text-zinc-100 font-semibold">{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
        continue;
      }
      // Italic
      const italicMatch = remaining.match(/\*(.*?)\*/);
      if (italicMatch && italicMatch.index !== undefined) {
        if (italicMatch.index > 0) {
          parts.push(<span key={`${key}-${idx++}`}>{remaining.slice(0, italicMatch.index)}</span>);
        }
        parts.push(<em key={`${key}-${idx++}`}>{italicMatch[1]}</em>);
        remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
        continue;
      }
      // No more matches
      parts.push(<span key={`${key}-${idx++}`}>{remaining}</span>);
      break;
    }
    return parts;
  }, []);

  const renderMarkdown = useCallback((content: string) => {
    return content
      .split('\n')
      .map((line, i) => {
        const k = `line-${i}`;
        // Headers
        if (line.startsWith('# ')) return <h1 key={k} className="text-2xl font-bold mt-6 mb-3">{line.slice(2)}</h1>;
        if (line.startsWith('## ')) return <h2 key={k} className="text-xl font-semibold mt-5 mb-2 text-zinc-200">{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={k} className="text-lg font-medium mt-4 mb-1.5 text-zinc-300">{line.slice(4)}</h3>;
        if (line.startsWith('#### ')) return <h4 key={k} className="text-base font-medium mt-3 mb-1 text-zinc-400">{line.slice(5)}</h4>;
        // List items
        if (line.startsWith('- ')) return <li key={k} className="ml-4 text-zinc-300 leading-relaxed">{renderInline(line.slice(2), k)}</li>;
        if (/^\d+\. /.test(line)) return <li key={k} className="ml-4 text-zinc-300 leading-relaxed list-decimal">{renderInline(line.replace(/^\d+\. /, ''), k)}</li>;
        // Table rows
        if (line.startsWith('|')) {
          const cells = line.split('|').filter(c => c.trim());
          if (cells.every(c => /^[\s-:]+$/.test(c))) return <hr key={k} className="border-zinc-800 my-0" />;
          return (
            <div key={k} className="flex border-b border-zinc-800/50">
              {cells.map((cell, j) => (
                <div key={j} className="flex-1 px-3 py-1.5 text-sm text-zinc-300">{renderInline(cell.trim(), `${k}-${j}`)}</div>
              ))}
            </div>
          );
        }
        // Blockquote
        if (line.startsWith('> ')) return <blockquote key={k} className="border-l-2 border-blue-600 pl-4 text-zinc-400 italic my-2">{line.slice(2)}</blockquote>;
        // Horizontal rule
        if (line.match(/^---+$/)) return <hr key={k} className="border-zinc-800 my-4" />;
        // Empty line
        if (line.trim() === '') return <div key={k} className="h-3" />;
        // Regular paragraph
        return <p key={k} className="text-zinc-300 leading-relaxed">{renderInline(line, k)}</p>;
      });
  }, [renderInline]);

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
          <button
            onClick={() => {
              const blob = new Blob([document.content], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = window.document.createElement('a');
              a.href = url;
              a.download = `${document.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
            title="Export as Markdown"
          >
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

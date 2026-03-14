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

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  draft: { bg: 'var(--warning-muted)', color: 'var(--warning)', border: 'rgba(196, 163, 90, 0.2)' },
  review: { bg: 'var(--accent-muted)', color: 'var(--accent)', border: 'rgba(74, 111, 165, 0.2)' },
  final: { bg: 'var(--success-muted)', color: 'var(--success)', border: 'rgba(74, 158, 110, 0.2)' },
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

  const renderInline = useCallback((text: string, key: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let idx = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(<span key={`${key}-${idx++}`}>{remaining.slice(0, boldMatch.index)}</span>);
        }
        parts.push(<strong key={`${key}-${idx++}`} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
        continue;
      }
      const italicMatch = remaining.match(/\*(.*?)\*/);
      if (italicMatch && italicMatch.index !== undefined) {
        if (italicMatch.index > 0) {
          parts.push(<span key={`${key}-${idx++}`}>{remaining.slice(0, italicMatch.index)}</span>);
        }
        parts.push(<em key={`${key}-${idx++}`}>{italicMatch[1]}</em>);
        remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
        continue;
      }
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
        if (line.startsWith('# ')) return <h1 key={k} style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginTop: 'var(--space-6)', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>{line.slice(2)}</h1>;
        if (line.startsWith('## ')) return <h2 key={k} style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, marginTop: 'var(--space-5)', marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>{line.slice(3)}</h2>;
        if (line.startsWith('### ')) return <h3 key={k} style={{ fontSize: 'var(--font-size-lg)', fontWeight: 500, marginTop: 'var(--space-4)', marginBottom: 'var(--space-1)', color: 'var(--text-secondary)' }}>{line.slice(4)}</h3>;
        if (line.startsWith('#### ')) return <h4 key={k} style={{ fontSize: 'var(--font-size-base)', fontWeight: 500, marginTop: 'var(--space-3)', marginBottom: 'var(--space-1)', color: 'var(--text-tertiary)' }}>{line.slice(5)}</h4>;
        if (line.startsWith('- ')) return <li key={k} style={{ marginLeft: 'var(--space-4)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{renderInline(line.slice(2), k)}</li>;
        if (/^\d+\. /.test(line)) return <li key={k} style={{ marginLeft: 'var(--space-4)', color: 'var(--text-secondary)', lineHeight: 1.7, listStyleType: 'decimal' }}>{renderInline(line.replace(/^\d+\. /, ''), k)}</li>;
        if (line.startsWith('|')) {
          const cells = line.split('|').filter(c => c.trim());
          if (cells.every(c => /^[\s-:]+$/.test(c))) return <hr key={k} style={{ border: 'none', borderBottom: '1px solid var(--border-subtle)', margin: 0 }} />;
          return (
            <div key={k} className="flex" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {cells.map((cell, j) => (
                <div key={j} className="flex-1" style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{renderInline(cell.trim(), `${k}-${j}`)}</div>
              ))}
            </div>
          );
        }
        if (line.startsWith('> ')) return <blockquote key={k} style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 'var(--space-4)', color: 'var(--text-tertiary)', fontStyle: 'italic', margin: 'var(--space-2) 0' }}>{line.slice(2)}</blockquote>;
        if (line.match(/^---+$/)) return <hr key={k} style={{ border: 'none', borderBottom: '1px solid var(--border-subtle)', margin: 'var(--space-4) 0' }} />;
        if (line.trim() === '') return <div key={k} style={{ height: 'var(--space-3)' }} />;
        return <p key={k} style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{renderInline(line, k)}</p>;
      });
  }, [renderInline]);

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
        <div className="text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)' }}>
          <FileText style={{ width: '48px', height: '48px' }} />
          <p style={{ fontSize: 'var(--font-size-sm)' }}>Select a deliverable from the sidebar, or generate one</p>
        </div>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[document.status] || { bg: 'var(--surface-2)', color: 'var(--text-muted)', border: 'var(--border-default)' };

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--surface-0)' }}>
      {/* Toolbar */}
      <div
        className="shrink-0 flex items-center justify-between"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          padding: 'var(--space-2) var(--space-4)',
          background: 'var(--surface-0)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="flex items-center min-w-0" style={{ gap: 'var(--space-3)' }}>
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${statusStyle.border}`,
              background: statusStyle.bg,
              color: statusStyle.color,
            }}
          >
            {document.status}
          </span>
          <h2 className="truncate" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{document.title}</h2>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{TYPE_LABELS[document.type] || document.type}</span>
        </div>
        <div className="flex items-center shrink-0" style={{ gap: 'var(--space-2)' }}>
          <span className="flex items-center" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', gap: '4px' }}>
            <Clock style={{ width: '12px', height: '12px' }} />
            {new Date(document.updated_at).toLocaleString()}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            {document.content.length.toLocaleString()} chars
          </span>
          <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />
          <button
            onClick={() => setMode(mode === 'preview' ? 'edit' : 'preview')}
            className="rounded transition-colors"
            style={{
              padding: '6px',
              background: mode === 'edit' ? 'var(--accent-muted)' : 'transparent',
              color: mode === 'edit' ? 'var(--accent)' : 'var(--text-muted)',
            }}
            onMouseEnter={e => { if (mode !== 'edit') { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; } }}
            onMouseLeave={e => { if (mode !== 'edit') { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; } }}
            title={mode === 'preview' ? 'Edit' : 'Preview'}
          >
            {mode === 'preview' ? <Edit3 style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
          </button>
          <button
            onClick={onSave}
            disabled={!dirty || saving}
            className="btn btn-sm"
            style={{
              background: dirty ? 'var(--accent)' : 'var(--surface-2)',
              color: dirty ? 'white' : 'var(--text-muted)',
              border: dirty ? 'none' : '1px solid var(--border-default)',
            }}
          >
            <Save style={{ width: '14px', height: '14px' }} />
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
            className="rounded transition-colors"
            style={{ padding: '6px', color: 'var(--text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            title="Export as Markdown"
          >
            <Download style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {mode === 'edit' ? (
          <textarea
            value={document.content}
            onChange={e => onContentChange(e.target.value)}
            className="w-full h-full resize-none focus:outline-none"
            style={{
              background: 'transparent',
              padding: 'var(--space-6) var(--space-8)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              lineHeight: 1.7,
            }}
            spellCheck={false}
          />
        ) : (
          <div style={{ padding: 'var(--space-6) var(--space-8)', maxWidth: '56rem' }}>
            {renderMarkdown(document.content)}
          </div>
        )}
      </div>
    </div>
  );
}

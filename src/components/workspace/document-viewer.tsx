'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { FileText, Eye, Edit3, Save, Clock, Download, FileSpreadsheet, Presentation, FileType } from 'lucide-react';
import { labelMuted, textSmSecondary } from '@/lib/styles';

// Dynamically import heavy editor components
const RichTextEditor = dynamic(
  () => import('./rich-text-editor').then(m => ({ default: m.RichTextEditor })),
  { ssr: false, loading: () => <div style={{ padding: 'var(--space-6)', color: 'var(--text-muted)' }}>Loading editor...</div> }
);

const ExcelViewer = dynamic(
  () => import('./excel-viewer').then(m => ({ default: m.ExcelViewer })),
  { ssr: false, loading: () => <div style={{ padding: 'var(--space-6)', color: 'var(--text-muted)' }}>Loading spreadsheet...</div> }
);

const SlideEditor = dynamic(
  () => import('./slide-editor').then(m => ({ default: m.SlideEditor })),
  { ssr: false, loading: () => <div style={{ padding: 'var(--space-6)', color: 'var(--text-muted)' }}>Loading slides...</div> }
);

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

type DocFormat = 'richtext' | 'spreadsheet' | 'slides' | 'markdown';

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  draft: { bg: 'var(--warning-muted)', color: 'var(--warning)', border: 'var(--warn-20)' },
  review: { bg: 'var(--accent-muted)', color: 'var(--accent)', border: 'var(--accent-20)' },
  final: { bg: 'var(--success-muted)', color: 'var(--success)', border: 'var(--accent-20)' },
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
  model: 'Financial Model',
  presentation: 'Presentation',
};

// Determine the best format for a document based on its type and content
function detectFormat(doc: { type: string; content: string }): DocFormat {
  // Explicit spreadsheet types
  if (doc.type === 'model' || doc.type === 'spreadsheet') return 'spreadsheet';

  // Explicit presentation types
  if (doc.type === 'presentation' || doc.type === 'deck') {
    // Check if content is slide JSON
    try {
      const parsed = JSON.parse(doc.content);
      if (Array.isArray(parsed) && parsed[0]?.elements) return 'slides';
      if (parsed.slides) return 'slides';
    } catch { /* not JSON, fall through */ }
  }

  // Check if content looks like cell data (JSON with cell references)
  if (doc.content.startsWith('{')) {
    try {
      const parsed = JSON.parse(doc.content);
      if (parsed.cells || parsed.sheets) return 'spreadsheet';
      // Check for cell reference keys like A1, B2
      const keys = Object.keys(parsed);
      if (keys.length > 0 && keys.some(k => /^[A-Z]+\d+$/.test(k))) return 'spreadsheet';
    } catch { /* not JSON */ }
  }

  // Check if content is slide JSON array
  if (doc.content.startsWith('[')) {
    try {
      const parsed = JSON.parse(doc.content);
      if (Array.isArray(parsed) && parsed[0]?.elements) return 'slides';
    } catch { /* not JSON */ }
  }

  // Default to richtext for all text documents
  return 'richtext';
}

function getExportFormats(format: DocFormat): { ext: string; label: string; icon: typeof FileType }[] {
  switch (format) {
    case 'spreadsheet':
      return [{ ext: 'xlsx', label: 'Excel (.xlsx)', icon: FileSpreadsheet }];
    case 'slides':
      return [{ ext: 'pptx', label: 'PowerPoint (.pptx)', icon: Presentation }];
    case 'richtext':
    case 'markdown':
    default:
      return [{ ext: 'docx', label: 'Word (.docx)', icon: FileType }];
  }
}

export function DocumentViewer({ document, onContentChange, onSave, saving, dirty }: DocumentViewerProps) {
  const [mode, setMode] = useState<'visual' | 'source'>('visual');
  const [exporting, setExporting] = useState(false);

  const format = useMemo(() => document ? detectFormat(document) : 'richtext', [document]);
  const exportFormats = useMemo(() => getExportFormats(format), [format]);

  const handleExport = useCallback(async (ext: string) => {
    if (!document) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/documents/${document.id}/export?format=${ext}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('[EXPORT]', e instanceof Error ? e.message : e);
    } finally {
      setExporting(false);
    }
  }, [document]);

  const handleSpreadsheetCellChange = useCallback((cellRef: string, value: string, formula?: string) => {
    if (!document) return;
    try {
      const data = JSON.parse(document.content);
      const cells = data.cells || data;
      cells[cellRef] = {
        v: formula ? value : (isNaN(Number(value)) ? value : Number(value)),
        ...(formula ? { f: formula } : {}),
        t: isNaN(Number(value)) ? 's' : 'n',
      };
      onContentChange(JSON.stringify(data.cells ? data : cells, null, 2));
    } catch {
      // If content isn't valid JSON, create new cell data
      const cells: Record<string, unknown> = {};
      cells[cellRef] = {
        v: isNaN(Number(value)) ? value : Number(value),
        ...(formula ? { f: formula } : {}),
        t: isNaN(Number(value)) ? 's' : 'n',
      };
      onContentChange(JSON.stringify(cells, null, 2));
    }
  }, [document, onContentChange]);

  const handleSlideChange = useCallback((slides: unknown[]) => {
    onContentChange(JSON.stringify(slides, null, 2));
  }, [onContentChange]);

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

  // Parse content for structured formats
  let spreadsheetCells: Record<string, import('./excel-viewer').CellData> = {};
  let slides: import('./slide-editor').Slide[] = [];

  if (format === 'spreadsheet') {
    try {
      const parsed = JSON.parse(document.content);
      spreadsheetCells = parsed.cells || parsed;
    } catch { /* empty */ }
  } else if (format === 'slides') {
    try {
      const parsed = JSON.parse(document.content);
      slides = Array.isArray(parsed) ? parsed : parsed.slides || [];
    } catch { /* empty */ }
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--surface-0)' }}>
      {/* Toolbar */}
      <div
        className="shrink-0 flex items-center justify-between"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--surface-0)',
          backdropFilter: 'blur(8px)',
          overflow: 'hidden',
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
          <h2 className="truncate" style={{ fontWeight: 400, color: 'var(--text-primary)' }}>
            {document.title}
          </h2>
          <span style={labelMuted}>{TYPE_LABELS[document.type] || document.type}</span>
        </div>
        <div className="flex items-center shrink-0" style={{ gap: 'var(--space-2)' }}>
          <span className="flex items-center" style={{ ...labelMuted, gap: 'var(--space-1)' }}>
            <Clock style={{ width: '12px', height: '12px' }} />
            {new Date(document.updated_at).toLocaleString()}
          </span>

          {/* Format-specific mode toggle */}
          {(format === 'richtext' || format === 'markdown') && (
            <>
              <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />
              <button
                onClick={() => setMode(mode === 'visual' ? 'source' : 'visual')}
                className="rounded transition-colors"
                style={{
                  padding: '6px',
                  background: mode === 'source' ? 'var(--accent-muted)' : 'transparent',
                  color: mode === 'source' ? 'var(--accent)' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  if (mode !== 'source') {
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                  }
                }}
                onMouseLeave={e => {
                  if (mode !== 'source') {
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }
                }}
                title={mode === 'visual' ? 'Source view' : 'Visual editor'}
              >
                {mode === 'visual' ? <Edit3 style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
              </button>
            </>
          )}

          <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />

          {/* Save button */}
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

          {/* Export buttons */}
          {exportFormats.map(({ ext, label, icon: Icon }) => (
            <button
              key={ext}
              onClick={() => handleExport(ext)}
              disabled={exporting}
              className="rounded transition-colors"
              style={{
                padding: '6px 10px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                cursor: exporting ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--text-muted)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              }}
              title={`Export as ${label}`}
            >
              <Download style={{ width: '12px', height: '12px' }} />
              .{ext}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {format === 'spreadsheet' ? (
          <ExcelViewer
            cells={spreadsheetCells}
            onCellChange={handleSpreadsheetCellChange}
          />
        ) : format === 'slides' ? (
          <SlideEditor
            slides={slides}
            onChange={handleSlideChange}
          />
        ) : mode === 'source' ? (
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
          <RichTextEditor
            content={document.content}
            onChange={onContentChange}
          />
        )}
      </div>
    </div>
  );
}

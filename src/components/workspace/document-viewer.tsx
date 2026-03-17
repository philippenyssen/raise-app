'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { FileText, Eye, Edit3, Save, Clock, Download, FileSpreadsheet, Presentation, FileType, History, Trash2, Search, X, Copy, Maximize2, Minimize2, Keyboard, List } from 'lucide-react';
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
  onDelete?: () => void;
  onDuplicate?: () => void;
  onTitleChange?: (title: string) => void;
  onStatusChange?: (status: string) => void;
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

interface DocVersion {
  id: string;
  version_number: number;
  change_summary: string;
  created_at: string;
}

const STATUS_CYCLE = ['draft', 'review', 'final'];

export function DocumentViewer({ document, onContentChange, onSave, onDelete, onDuplicate, onTitleChange, onStatusChange, saving, dirty }: DocumentViewerProps) {
  const [mode, setMode] = useState<'visual' | 'source'>('visual');
  const [exporting, setExporting] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<DocVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [findCount, setFindCount] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [activeSheet, setActiveSheet] = useState<string>('Sheet1');
  const findInputRef = useRef<HTMLInputElement>(null);
  const versionDropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!window.document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setFullscreen(true);
    } else {
      window.document.exitFullscreen?.().catch(() => {});
      setFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      if (!window.document.fullscreenElement) setFullscreen(false);
    };
    window.document.addEventListener('fullscreenchange', handler);
    return () => window.document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+F to open find
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowFind(true);
        setTimeout(() => findInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && showFind) {
        setShowFind(false);
        setFindQuery('');
        setReplaceQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showFind]);

  // Count matches when find query changes
  useEffect(() => {
    if (!findQuery || !document) { setFindCount(0); return; }
    const text = document.content.replace(/<[^>]+>/g, '');
    const regex = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = text.match(regex);
    setFindCount(matches ? matches.length : 0);
  }, [findQuery, document]);

  const handleReplaceAll = useCallback(() => {
    if (!document || !findQuery) return;
    const regex = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const newContent = document.content.replace(regex, replaceQuery);
    onContentChange(newContent);
    setFindCount(0);
  }, [document, findQuery, replaceQuery, onContentChange]);

  // Close version dropdown on outside click
  useEffect(() => {
    if (!showVersions) return;
    const handler = (e: MouseEvent) => {
      if (versionDropdownRef.current && !versionDropdownRef.current.contains(e.target as Node)) {
        setShowVersions(false);
      }
    };
    window.document.addEventListener('mousedown', handler);
    return () => window.document.removeEventListener('mousedown', handler);
  }, [showVersions]);

  const loadVersions = useCallback(async () => {
    if (!document) return;
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/documents/${document.id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } catch { /* ignore */ }
    finally { setLoadingVersions(false); }
  }, [document]);

  const restoreVersion = useCallback(async (versionId: string) => {
    if (!document) return;
    try {
      const res = await fetch(`/api/documents/${document.id}/versions?version_id=${versionId}`);
      if (res.ok) {
        const version = await res.json();
        if (version.content) {
          onContentChange(version.content);
          setShowVersions(false);
        }
      }
    } catch { /* ignore */ }
  }, [document, onContentChange]);

  const format = useMemo(() => document ? detectFormat(document) : 'richtext', [document]);
  const exportFormats = useMemo(() => getExportFormats(format), [format]);

  // Document outline (headings)
  const outline = useMemo(() => {
    if (!document || format !== 'richtext') return [];
    const headingRegex = /<h([1-3])[^>]*>(.*?)<\/h[1-3]>/gi;
    const matches: { level: number; text: string; index: number }[] = [];
    let match;
    while ((match = headingRegex.exec(document.content)) !== null) {
      const text = match[2].replace(/<[^>]+>/g, '').trim();
      if (text) matches.push({ level: parseInt(match[1]), text, index: match.index });
    }
    return matches;
  }, [document, format]);

  // Word/character count
  const docStats = useMemo(() => {
    if (!document) return null;
    if (format === 'spreadsheet') {
      try {
        const parsed = JSON.parse(document.content);
        const cells = parsed.cells || parsed;
        return { label: `${Object.keys(cells).length} cells` };
      } catch { return null; }
    }
    if (format === 'slides') {
      try {
        const parsed = JSON.parse(document.content);
        const slides = Array.isArray(parsed) ? parsed : parsed.slides || [];
        return { label: `${slides.length} slide${slides.length !== 1 ? 's' : ''}` };
      } catch { return null; }
    }
    // Text: strip HTML, count words
    const text = document.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = text ? text.split(' ').length : 0;
    return { label: `${words.toLocaleString()} words` };
  }, [document, format]);

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
        <div className="text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)', maxWidth: '320px' }}>
          <FileText style={{ width: '48px', height: '48px', opacity: 0.5 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>No document selected</p>
            <p style={{ fontSize: 'var(--font-size-xs)' }}>Select a deliverable from the sidebar, or create a new one</p>
          </div>
          <div className="flex flex-wrap justify-center" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            {[
              { icon: FileText, label: 'Document', tip: 'Rich text editor' },
              { icon: FileSpreadsheet, label: 'Spreadsheet', tip: 'Cell-based editor' },
              { icon: Presentation, label: 'Deck', tip: 'Slide editor' },
            ].map(item => (
              <div
                key={item.label}
                className="flex flex-col items-center"
                style={{
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface-1)',
                  width: '90px',
                  gap: '4px',
                  opacity: 0.6,
                }}
              >
                <item.icon style={{ width: '20px', height: '20px' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{item.label}</span>
                <span style={{ fontSize: '9px' }}>{item.tip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[document.status] || { bg: 'var(--surface-2)', color: 'var(--text-muted)', border: 'var(--border-default)' };

  // Parse content for structured formats
  let spreadsheetCells: Record<string, import('./excel-viewer').CellData> = {};
  let allSheets: import('./excel-viewer').SheetData[] = [];
  let slides: import('./slide-editor').Slide[] = [];

  if (format === 'spreadsheet') {
    try {
      const parsed = JSON.parse(document.content);
      if (parsed.sheets && Array.isArray(parsed.sheets)) {
        // Multi-sheet format: { sheets: [{ name, cells }] }
        allSheets = parsed.sheets;
        const current = allSheets.find(s => s.name === activeSheet) || allSheets[0];
        spreadsheetCells = current?.cells || {};
      } else {
        spreadsheetCells = parsed.cells || parsed;
      }
    } catch { /* empty */ }
  } else if (format === 'slides') {
    try {
      const parsed = JSON.parse(document.content);
      slides = Array.isArray(parsed) ? parsed : parsed.slides || [];
    } catch { /* empty */ }
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col" style={{ background: 'var(--surface-0)' }}>
      {/* Toolbar */}
      <div
        className="shrink-0 flex items-center justify-between"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          padding: 'var(--space-1) var(--space-3)',
          background: 'var(--surface-0)',
          backdropFilter: 'blur(8px)',
          minHeight: '40px',
        }}
      >
        <div className="flex items-center min-w-0" style={{ gap: 'var(--space-3)' }}>
          <span
            onClick={() => {
              if (onStatusChange) {
                const currentIdx = STATUS_CYCLE.indexOf(document.status);
                const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
                onStatusChange(nextStatus);
              }
            }}
            style={{
              fontSize: 'var(--font-size-xs)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${statusStyle.border}`,
              background: statusStyle.bg,
              color: statusStyle.color,
              cursor: onStatusChange ? 'pointer' : 'default',
            }}
            title={onStatusChange ? 'Click to change status' : undefined}
          >
            {document.status}
          </span>
          {editingTitle && onTitleChange ? (
            <input
              autoFocus
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onBlur={() => {
                if (titleValue.trim() && titleValue !== document.title) {
                  onTitleChange(titleValue.trim());
                }
                setEditingTitle(false);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (titleValue.trim() && titleValue !== document.title) {
                    onTitleChange(titleValue.trim());
                  }
                  setEditingTitle(false);
                }
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              className="input"
              style={{ fontWeight: 400, padding: '2px 6px', minWidth: '120px', maxWidth: '300px' }}
            />
          ) : (
            <h2
              className="truncate"
              style={{ fontWeight: 400, color: 'var(--text-primary)', cursor: onTitleChange ? 'pointer' : 'default' }}
              onClick={() => {
                if (onTitleChange) {
                  setTitleValue(document.title);
                  setEditingTitle(true);
                }
              }}
              title={onTitleChange ? 'Click to rename' : undefined}
            >
              {document.title}
            </h2>
          )}
          <span style={labelMuted}>{TYPE_LABELS[document.type] || document.type}</span>
        </div>
        <div className="flex items-center shrink-0" style={{ gap: 'var(--space-2)' }}>
          {docStats && (
            <span style={{ ...labelMuted, fontSize: 'var(--font-size-xs)' }}>
              {docStats.label}
            </span>
          )}
          <span className="flex items-center" style={{ ...labelMuted, gap: 'var(--space-1)' }} title={new Date(document.updated_at).toLocaleString()}>
            <Clock style={{ width: '12px', height: '12px' }} />
            {new Date(document.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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

          {/* Version history */}
          <div className="relative" ref={versionDropdownRef}>
            <button
              onClick={() => {
                if (!showVersions) loadVersions();
                setShowVersions(!showVersions);
              }}
              className="rounded transition-colors"
              style={{
                padding: '6px',
                background: showVersions ? 'var(--accent-muted)' : 'transparent',
                color: showVersions ? 'var(--accent)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                if (!showVersions) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                }
              }}
              onMouseLeave={e => {
                if (!showVersions) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }
              }}
              title="Version history"
            >
              <History style={{ width: '16px', height: '16px' }} />
            </button>
            {showVersions && (
              <div
                className="absolute z-50"
                style={{
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  width: '280px',
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  maxHeight: '300px',
                  overflow: 'auto',
                }}
              >
                <div style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Version History
                  </span>
                </div>
                {loadingVersions ? (
                  <div style={{ padding: 'var(--space-4)', textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    Loading...
                  </div>
                ) : versions.length === 0 ? (
                  <div style={{ padding: 'var(--space-4)', textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    No versions saved yet
                  </div>
                ) : (
                  versions.map((v, i) => (
                    <button
                      key={v.id}
                      onClick={() => restoreVersion(v.id)}
                      className="w-full text-left"
                      style={{
                        padding: 'var(--space-2) var(--space-3)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        borderBottom: i < versions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        borderBottomStyle: i < versions.length - 1 ? 'solid' : 'none',
                        borderBottomWidth: i < versions.length - 1 ? '1px' : '0',
                        borderBottomColor: 'var(--border-subtle)',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <div className="flex items-center justify-between" style={{ width: '100%' }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>
                          v{v.version_number}
                          {i === 0 && <span style={{ marginLeft: '4px', color: 'var(--accent)', fontSize: '10px' }}>current</span>}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {new Date(v.created_at).toLocaleDateString()} {new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {v.change_summary && (
                        <span className="truncate" style={{ fontSize: '10px', color: 'var(--text-muted)', maxWidth: '100%' }}>
                          {v.change_summary}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="rounded transition-colors"
            style={{
              padding: '6px',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen
              ? <Minimize2 style={{ width: '14px', height: '14px' }} />
              : <Maximize2 style={{ width: '14px', height: '14px' }} />}
          </button>

          <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />

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

          {/* Outline toggle */}
          {(format === 'richtext' || format === 'markdown') && outline.length > 0 && (
            <button
              onClick={() => setShowOutline(!showOutline)}
              className="rounded transition-colors"
              style={{
                padding: '6px',
                background: showOutline ? 'var(--accent-muted)' : 'transparent',
                color: showOutline ? 'var(--accent)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!showOutline) { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}}
              onMouseLeave={e => { if (!showOutline) { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}}
              title="Document outline"
            >
              <List style={{ width: '14px', height: '14px' }} />
            </button>
          )}

          {/* Find/Replace toggle */}
          {(format === 'richtext' || format === 'markdown') && (
            <button
              onClick={() => {
                setShowFind(!showFind);
                if (!showFind) setTimeout(() => findInputRef.current?.focus(), 50);
              }}
              className="rounded transition-colors"
              style={{
                padding: '6px',
                background: showFind ? 'var(--accent-muted)' : 'transparent',
                color: showFind ? 'var(--accent)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!showFind) { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}}
              onMouseLeave={e => { if (!showFind) { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}}
              title="Find & Replace (Cmd+F)"
            >
              <Search style={{ width: '14px', height: '14px' }} />
            </button>
          )}

          {/* Duplicate button */}
          {onDuplicate && (
            <button
              onClick={onDuplicate}
              className="rounded transition-colors"
              style={{
                padding: '6px',
                background: 'transparent',
                color: 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              title="Duplicate document"
            >
              <Copy style={{ width: '14px', height: '14px' }} />
            </button>
          )}

          {/* Keyboard shortcuts */}
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="rounded transition-colors"
            style={{
              padding: '6px',
              background: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            title="Keyboard shortcuts"
          >
            <Keyboard style={{ width: '14px', height: '14px' }} />
          </button>

          {/* Delete button */}
          {onDelete && (
            <>
              <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)' }} />
              <button
                onClick={onDelete}
                className="rounded transition-colors"
                style={{
                  padding: '6px',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--danger)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--danger-muted, rgba(239,68,68,0.1))';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
                title="Delete document"
              >
                <Trash2 style={{ width: '14px', height: '14px' }} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Find & Replace bar */}
      {showFind && (
        <div
          className="shrink-0 flex items-center gap-2"
          style={{
            padding: 'var(--space-2) var(--space-3)',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--surface-1)',
          }}
        >
          <div className="flex items-center gap-2 flex-1">
            <input
              ref={findInputRef}
              value={findQuery}
              onChange={e => setFindQuery(e.target.value)}
              placeholder="Find..."
              className="input"
              style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px', minWidth: '120px', maxWidth: '200px' }}
              onKeyDown={e => { if (e.key === 'Escape') { setShowFind(false); setFindQuery(''); setReplaceQuery(''); } }}
            />
            {findQuery && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: findCount > 0 ? 'var(--text-muted)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                {findCount} {findCount === 1 ? 'match' : 'matches'}
              </span>
            )}
            <input
              value={replaceQuery}
              onChange={e => setReplaceQuery(e.target.value)}
              placeholder="Replace with..."
              className="input"
              style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px', minWidth: '120px', maxWidth: '200px' }}
              onKeyDown={e => { if (e.key === 'Enter') handleReplaceAll(); }}
            />
            <button
              onClick={handleReplaceAll}
              disabled={!findQuery || findCount === 0}
              className="btn btn-sm"
              style={{ fontSize: 'var(--font-size-xs)', opacity: !findQuery || findCount === 0 ? 0.4 : 1 }}
            >
              Replace All
            </button>
          </div>
          <button
            onClick={() => { setShowFind(false); setFindQuery(''); setReplaceQuery(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
          >
            <X style={{ width: '14px', height: '14px' }} />
          </button>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex">
        {/* Document outline sidebar */}
        {showOutline && outline.length > 0 && (
          <div
            className="shrink-0 overflow-y-auto"
            style={{
              width: '200px',
              borderRight: '1px solid var(--border-subtle)',
              background: 'var(--surface-0)',
              padding: 'var(--space-2)',
            }}
          >
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', padding: 'var(--space-1) var(--space-2)', marginBottom: 'var(--space-1)' }}>
              Outline
            </div>
            {outline.map((item, i) => (
              <button
                key={i}
                className="w-full text-left truncate"
                style={{
                  padding: '4px 8px',
                  paddingLeft: `${8 + (item.level - 1) * 12}px`,
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-secondary)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                title={item.text}
              >
                {item.text}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-hidden">
        {format === 'spreadsheet' ? (
          <ExcelViewer
            cells={spreadsheetCells}
            onCellChange={handleSpreadsheetCellChange}
            allSheets={allSheets.length > 0 ? allSheets : undefined}
            activeSheetName={allSheets.length > 0 ? activeSheet : undefined}
            onSheetChange={setActiveSheet}
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

      {/* Status bar for all formats */}
      {document && (
        <div
          className="shrink-0 flex items-center justify-between"
          style={{
            padding: '2px var(--space-4)',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--surface-1)',
            fontSize: '10px',
            color: 'var(--text-muted)',
            minHeight: '22px',
          }}>
          <div className="flex items-center" style={{ gap: 'var(--space-3)' }}>
            {format === 'richtext' && (() => {
              const words = document.content.replace(/<[^>]+>/g, '').split(/\s+/).filter(Boolean).length;
              const readMin = Math.max(1, Math.ceil(words / 200));
              return (
                <>
                  <span>{words.toLocaleString()} words</span>
                  <span>{document.content.replace(/<[^>]+>/g, '').length.toLocaleString()} chars</span>
                  <span>{readMin} min read</span>
                </>
              );
            })()}
            {format === 'spreadsheet' && (
              <span>{Object.keys(spreadsheetCells).length} cells</span>
            )}
            {format === 'slides' && (
              <span>{slides.length} slide{slides.length !== 1 ? 's' : ''}</span>
            )}
            <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
              {format === 'richtext' ? 'Rich Text' : format === 'spreadsheet' ? 'Spreadsheet' : format === 'slides' ? 'Presentation' : 'Markdown'}
            </span>
          </div>
          <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
            {dirty && (
              <span className="flex items-center" style={{ gap: '3px', color: 'var(--warning)' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--warning)', display: 'inline-block' }} />
                Unsaved
              </span>
            )}
            {saving && (
              <span className="flex items-center" style={{ gap: '3px', color: 'var(--accent)' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'typingBounce 1.5s ease-in-out infinite' }} />
                Saving
              </span>
            )}
            {!dirty && !saving && (
              <span className="flex items-center" style={{ gap: '3px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--success, #22c55e)', display: 'inline-block' }} />
                Saved
              </span>
            )}
          </div>
        </div>
      )}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowShortcuts(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface-1)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-xl)',
              padding: 'var(--space-6)',
              width: '360px',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {[
                ['Cmd + S', 'Save document'],
                ['Cmd + Z', 'Undo'],
                ['Cmd + F', 'Find & Replace'],
                ['Escape', 'Close panel'],
                ['Enter', 'Edit cell (spreadsheet)'],
                ['Tab', 'Next cell (spreadsheet)'],
                ['R', 'Refresh documents'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between" style={{ padding: '4px 0' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{desc}</span>
                  <kbd style={{
                    fontSize: 'var(--font-size-xs)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    fontFamily: 'monospace',
                  }}>{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

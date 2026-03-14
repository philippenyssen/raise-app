'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { FolderOpen, Upload, FileText, Table, Image, Trash2, ChevronDown, ChevronRight, Search } from 'lucide-react';

interface DataRoomFile {
  id: string;
  filename: string;
  category: string;
  mime_type: string;
  size_bytes: number;
  extracted_text: string;
  summary: string;
  uploaded_at: string;
}

const CATEGORIES = [
  { value: 'financial', label: 'Financial', icon: Table, desc: 'Financials, model, cap table, projections' },
  { value: 'legal', label: 'Legal', icon: FileText, desc: 'SHA, contracts, IP schedule, articles' },
  { value: 'commercial', label: 'Commercial', icon: FolderOpen, desc: 'Customer contracts, pipeline, backlog' },
  { value: 'technical', label: 'Technical', icon: Image, desc: 'Architecture, product roadmap, patents' },
  { value: 'team', label: 'Team', icon: FileText, desc: 'Org chart, bios, employment agreements' },
  { value: 'other', label: 'Other', icon: FileText, desc: 'Uncategorized documents' },
];

export default function DataRoomPage() {
  const { toast } = useToast();
  const [files, setFiles] = useState<DataRoomFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteFilename, setPasteFilename] = useState('');
  const [pasteCategory, setPasteCategory] = useState('other');
  const [pasteContent, setPasteContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; filename: string } | null>(null);

  const fetchFiles = useCallback(async () => {
    const res = await fetch('/api/data-room');
    setFiles(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  async function handleFileUpload(fileList: FileList) {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      const category = inferCategory(file.name);
      let text = '';

      // For text-based files, read as text
      const textTypes = ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.rtf', '.tsv'];
      const isTextFile = textTypes.some(ext => file.name.toLowerCase().endsWith(ext));

      if (isTextFile) {
        text = await file.text();
      } else {
        // For binary files (PDF, DOCX, XLSX, etc.), store metadata
        // and upload as base64 for server-side extraction
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        try {
          const extractRes = await fetch('/api/data-room/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              mime_type: file.type,
              base64_content: base64.substring(0, 2000000), // ~1.5MB limit
            }),
          });
          if (extractRes.ok) {
            const extracted = await extractRes.json();
            text = extracted.text || '';
          }
        } catch {
          text = `[Binary file: ${file.name} (${file.type}, ${file.size} bytes). Text extraction not available — upload the text content separately via Paste.]`;
        }
      }

      await fetch('/api/data-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          category,
          mime_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
          extracted_text: text.substring(0, 50000),
        }),
      });
      toast(`Uploaded "${file.name}"`);
    }
    setUploading(false);
    fetchFiles();
  }

  async function handlePasteUpload() {
    if (!pasteFilename.trim() || !pasteContent.trim()) return;
    setUploading(true);
    await fetch('/api/data-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: pasteFilename.trim(),
        category: pasteCategory,
        mime_type: 'text/plain',
        size_bytes: pasteContent.length,
        extracted_text: pasteContent.substring(0, 50000),
      }),
    });
    toast(`Added "${pasteFilename.trim()}"`);
    setPasteFilename('');
    setPasteContent('');
    setPasteCategory('other');
    setPasteMode(false);
    setUploading(false);
    fetchFiles();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/data-room?id=${deleteTarget.id}`, { method: 'DELETE' });
    toast(`Deleted "${deleteTarget.filename}"`, 'warning');
    setDeleteTarget(null);
    fetchFiles();
  }

  function inferCategory(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.match(/financ|model|p&l|cash.?flow|revenue|budget|forecast|cap.?table|balance/)) return 'financial';
    if (lower.match(/contract|agreement|sha|nda|legal|ip|patent|litigation|articles/)) return 'legal';
    if (lower.match(/customer|pipeline|backlog|sales|commercial|crm/)) return 'commercial';
    if (lower.match(/architect|roadmap|technical|patent|product|spec/)) return 'technical';
    if (lower.match(/org.?chart|bio|team|hire|employment|cv|resume/)) return 'team';
    return 'other';
  }

  // Group files by category
  const grouped = files.reduce<Record<string, DataRoomFile[]>>((acc, file) => {
    const cat = file.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(file);
    return acc;
  }, {});

  // Filter by search
  const filteredFiles = searchQuery
    ? files.filter(f => f.filename.toLowerCase().includes(searchQuery.toLowerCase()) || f.extracted_text.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 skeleton" style={{ borderRadius: 'var(--radius-md)' }} />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 skeleton" style={{ borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title" style={{ fontSize: 'var(--font-size-xl)' }}>Data Room</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-1)' }}>
            {files.length} files — source context for all deliverables
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPasteMode(!pasteMode)}
            className="btn btn-md flex items-center gap-2"
            style={pasteMode ? {
              background: 'var(--accent-muted)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-muted)',
            } : {
              background: 'var(--surface-2)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
            }}
          >
            <FileText className="w-4 h-4" /> Paste Text
          </button>
          <label
            className="btn btn-primary btn-md flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4" /> Upload Files
            <input
              type="file"
              multiple
              accept=".txt,.md,.csv,.json,.xml,.html,.pdf,.doc,.docx,.xls,.xlsx,.pptx,.rtf,.tsv"
              className="hidden"
              onChange={e => e.target.files && handleFileUpload(e.target.files)}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search files and content..."
          className="input"
          style={{
            paddingLeft: 'var(--space-10)',
            paddingRight: 'var(--space-4)',
            paddingTop: '0.625rem',
            paddingBottom: '0.625rem',
            borderRadius: 'var(--radius-lg)',
          }}
        />
      </div>

      {/* Paste mode */}
      {pasteMode && (
        <div
          className="card space-y-4"
        >
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
            Paste document content
          </h3>
          <div className="flex gap-3">
            <input
              value={pasteFilename}
              onChange={e => setPasteFilename(e.target.value)}
              placeholder="Document name (e.g., Financial Model Notes.txt)"
              className="input flex-1"
            />
            <select
              value={pasteCategory}
              onChange={e => setPasteCategory(e.target.value)}
              className="input"
              style={{ width: 'auto' }}
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <textarea
            value={pasteContent}
            onChange={e => setPasteContent(e.target.value)}
            placeholder="Paste your document content here..."
            rows={10}
            className="input"
            style={{
              fontFamily: 'var(--font-mono)',
              resize: 'none',
              padding: 'var(--space-3) var(--space-4)',
            }}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPasteMode(false)}
              className="btn btn-ghost btn-md"
            >
              Cancel
            </button>
            <button
              onClick={handlePasteUpload}
              disabled={!pasteFilename.trim() || !pasteContent.trim() || uploading}
              className="btn btn-primary btn-md"
              style={{ opacity: (!pasteFilename.trim() || !pasteContent.trim() || uploading) ? 0.5 : 1 }}
            >
              {uploading ? 'Adding...' : 'Add to Data Room'}
            </button>
          </div>
        </div>
      )}

      {/* Search results */}
      {filteredFiles && (
        <div className="space-y-2">
          <h2 className="section-title">
            Search Results ({filteredFiles.length})
          </h2>
          {filteredFiles.map(file => (
            <FileRow
              key={file.id}
              file={file}
              expanded={expandedFile === file.id}
              onToggle={() => setExpandedFile(expandedFile === file.id ? null : file.id)}
              onDelete={() => setDeleteTarget({ id: file.id, filename: file.filename })}
            />
          ))}
          {filteredFiles.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', padding: 'var(--space-4) 0', textAlign: 'center' }}>
              No files match your search.
            </p>
          )}
        </div>
      )}

      {/* Category overview */}
      {!filteredFiles && (
        <div className="space-y-6">
          {CATEGORIES.map(cat => {
            const catFiles = grouped[cat.value] || [];
            return (
              <div key={cat.value}>
                <div className="flex items-center gap-3 mb-2">
                  <cat.icon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {cat.label}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    {catFiles.length} files
                  </span>
                  <span className="ml-auto" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                    {cat.desc}
                  </span>
                </div>
                {catFiles.length > 0 ? (
                  <div className="space-y-1">
                    {catFiles.map(file => (
                      <FileRow
                        key={file.id}
                        file={file}
                        expanded={expandedFile === file.id}
                        onToggle={() => setExpandedFile(expandedFile === file.id ? null : file.id)}
                        onDelete={() => setDeleteTarget({ id: file.id, filename: file.filename })}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-3)',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                      No {cat.label.toLowerCase()} files yet
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete file"
        message={`Delete "${deleteTarget?.filename}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function FileRow({ file, expanded, onToggle, onDelete }: {
  file: DataRoomFile;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [deleteHovered, setDeleteHovered] = useState(false);

  return (
    <div
      style={{
        border: `1px solid ${hovered ? 'var(--border-default)' : 'var(--border-subtle)'}`,
        borderRadius: 'var(--radius-md)',
        transition: 'border-color 150ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center cursor-pointer" style={{ padding: 'var(--space-3) var(--space-4)' }} onClick={onToggle}>
        {expanded
          ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
        }
        <FileText className="w-4 h-4 shrink-0 ml-2" style={{ color: 'var(--text-tertiary)' }} />
        <span className="truncate ml-3" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
          {file.filename}
        </span>
        <span className="ml-auto shrink-0" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          {formatBytes(file.size_bytes)}
        </span>
        <span className="shrink-0 ml-3" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
          {new Date(file.uploaded_at).toLocaleDateString()}
        </span>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="ml-3 shrink-0"
          style={{
            color: deleteHovered ? 'var(--danger)' : 'var(--text-tertiary)',
            transition: 'color 150ms ease',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
          onMouseEnter={() => setDeleteHovered(true)}
          onMouseLeave={() => setDeleteHovered(false)}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 'var(--space-3) var(--space-4)' }}>
          {file.summary && (
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
              {file.summary}
            </p>
          )}
          <pre
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'pre-wrap',
              maxHeight: '15rem',
              overflowY: 'auto',
              background: 'var(--surface-0)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
            }}
          >
            {file.extracted_text.substring(0, 5000)}
            {file.extracted_text.length > 5000 && '\n\n... (truncated)'}
          </pre>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

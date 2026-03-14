'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/toast';
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

  const fetchFiles = useCallback(async () => {
    const res = await fetch('/api/data-room');
    setFiles(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  async function handleFileUpload(fileList: FileList) {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      // Read file as text
      const text = await file.text();
      const category = inferCategory(file.name);

      await fetch('/api/data-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          category,
          mime_type: file.type,
          size_bytes: file.size,
          extracted_text: text.substring(0, 50000), // Limit to 50KB of text
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

  async function handleDelete(id: string, filename: string) {
    if (!confirm(`Delete "${filename}"?`)) return;
    await fetch(`/api/data-room?id=${id}`, { method: 'DELETE' });
    toast(`Deleted "${filename}"`, 'warning');
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
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-zinc-800/50 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data Room</h1>
          <p className="text-zinc-500 text-sm mt-1">{files.length} files — source context for all deliverables</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPasteMode(!pasteMode)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              pasteMode ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
          >
            <FileText className="w-4 h-4" /> Paste Text
          </button>
          <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" /> Upload Files
            <input
              type="file"
              multiple
              accept=".txt,.md,.csv,.json,.xml,.html"
              className="hidden"
              onChange={e => e.target.files && handleFileUpload(e.target.files)}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search files and content..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-600/50"
        />
      </div>

      {/* Paste mode */}
      {pasteMode && (
        <div className="border border-zinc-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-medium">Paste document content</h3>
          <div className="flex gap-3">
            <input
              value={pasteFilename}
              onChange={e => setPasteFilename(e.target.value)}
              placeholder="Document name (e.g., Financial Model Notes.txt)"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-600/50"
            />
            <select
              value={pasteCategory}
              onChange={e => setPasteCategory(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none"
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <textarea
            value={pasteContent}
            onChange={e => setPasteContent(e.target.value)}
            placeholder="Paste your document content here..."
            rows={10}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-200 font-mono focus:outline-none focus:border-blue-600/50 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setPasteMode(false)} className="px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-300">Cancel</button>
            <button
              onClick={handlePasteUpload}
              disabled={!pasteFilename.trim() || !pasteContent.trim() || uploading}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {uploading ? 'Adding...' : 'Add to Data Room'}
            </button>
          </div>
        </div>
      )}

      {/* Search results */}
      {filteredFiles && (
        <div className="space-y-2">
          <h2 className="text-xs font-medium text-zinc-400 uppercase">
            Search Results ({filteredFiles.length})
          </h2>
          {filteredFiles.map(file => (
            <FileRow
              key={file.id}
              file={file}
              expanded={expandedFile === file.id}
              onToggle={() => setExpandedFile(expandedFile === file.id ? null : file.id)}
              onDelete={() => handleDelete(file.id, file.filename)}
            />
          ))}
          {filteredFiles.length === 0 && (
            <p className="text-zinc-600 text-sm py-4 text-center">No files match your search.</p>
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
                  <cat.icon className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm font-medium">{cat.label}</span>
                  <span className="text-xs text-zinc-600">{catFiles.length} files</span>
                  <span className="text-xs text-zinc-700 ml-auto">{cat.desc}</span>
                </div>
                {catFiles.length > 0 ? (
                  <div className="space-y-1">
                    {catFiles.map(file => (
                      <FileRow
                        key={file.id}
                        file={file}
                        expanded={expandedFile === file.id}
                        onToggle={() => setExpandedFile(expandedFile === file.id ? null : file.id)}
                        onDelete={() => handleDelete(file.id, file.filename)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="border border-zinc-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-zinc-700">No {cat.label.toLowerCase()} files yet</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FileRow({ file, expanded, onToggle, onDelete }: {
  file: DataRoomFile;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors">
      <div className="flex items-center px-4 py-3 cursor-pointer" onClick={onToggle}>
        {expanded ? <ChevronDown className="w-4 h-4 text-zinc-600 shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />}
        <FileText className="w-4 h-4 text-zinc-500 ml-2 shrink-0" />
        <span className="text-sm ml-3 truncate">{file.filename}</span>
        <span className="text-xs text-zinc-600 ml-auto shrink-0">{formatBytes(file.size_bytes)}</span>
        <span className="text-xs text-zinc-700 ml-3 shrink-0">{new Date(file.uploaded_at).toLocaleDateString()}</span>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="ml-3 text-zinc-700 hover:text-red-400 transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3">
          {file.summary && (
            <p className="text-sm text-zinc-400 mb-3">{file.summary}</p>
          )}
          <pre className="text-xs text-zinc-500 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto bg-zinc-900 rounded-lg p-3">
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

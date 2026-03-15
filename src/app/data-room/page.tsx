'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { FolderOpen, Upload, FileText, Table, Image, Trash2, ChevronDown, ChevronRight, Search, Eye, BarChart3, Users, AlertCircle, Send, TrendingUp } from 'lucide-react';

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

interface IntelligenceData {
  document_access_log: Array<{
    investor_name: string;
    investor_id: string;
    document_id: string;
    document_title: string;
    accessed_at: string;
  }>;
  most_requested: Array<{
    document_id: string;
    document_title: string;
    category: string;
    access_count: number;
  }>;
  per_investor_access: Array<{
    investor_id: string;
    investor_name: string;
    status: string;
    tier: number;
    documents_accessed: number;
    accessed_documents: Array<{ document_id: string; document_title: string; category: string }>;
    recommended_documents: Array<{ document_id: string; document_title: string; category: string; reason: string }>;
  }>;
  unreached_investors: Array<{
    investor_id: string;
    investor_name: string;
    status: string;
    tier: number;
    recommended_categories: string[];
  }>;
  total_files: number;
  total_access_events: number;
}

const CATEGORIES = [
  { value: 'financial', label: 'Financial', icon: Table, desc: 'Financials, model, cap table, projections' },
  { value: 'legal', label: 'Legal', icon: FileText, desc: 'SHA, contracts, IP schedule, articles' },
  { value: 'commercial', label: 'Commercial', icon: FolderOpen, desc: 'Customer contracts, pipeline, backlog' },
  { value: 'technical', label: 'Technical', icon: Image, desc: 'Architecture, product roadmap, patents' },
  { value: 'team', label: 'Team', icon: FileText, desc: 'Org chart, bios, employment agreements' },
  { value: 'other', label: 'Other', icon: FileText, desc: 'Uncategorized documents' },
];

const STATUS_LABELS: Record<string, string> = {
  identified: 'Identified',
  contacted: 'Contacted',
  nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Scheduled',
  met: 'Met',
  engaged: 'Engaged',
  in_dd: 'In DD',
  term_sheet: 'Term Sheet',
  closed: 'Closed',
  passed: 'Passed',
  dropped: 'Dropped',
};

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
  const [intelligence, setIntelligence] = useState<IntelligenceData | null>(null);
  const [intelLoading, setIntelLoading] = useState(true);
  const [expandedInvestor, setExpandedInvestor] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    const res = await fetch('/api/data-room');
    setFiles(await res.json());
    setLoading(false);
  }, []);

  const fetchIntelligence = useCallback(async () => {
    try {
      const res = await fetch('/api/data-room/intelligence');
      if (res.ok) {
        setIntelligence(await res.json());
      }
    } catch { /* silently fail */ }
    setIntelLoading(false);
  }, []);

  useEffect(() => { fetchFiles(); fetchIntelligence(); }, [fetchFiles, fetchIntelligence]);

  async function handleLogAccess(investorId: string, documentId: string) {
    await fetch('/api/data-room/intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ investor_id: investorId, document_id: documentId }),
    });
    toast('Access logged');
    fetchIntelligence();
  }

  async function handleFileUpload(fileList: FileList) {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      const category = inferCategory(file.name);
      let text = '';

      const textTypes = ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.rtf', '.tsv'];
      const isTextFile = textTypes.some(ext => file.name.toLowerCase().endsWith(ext));

      if (isTextFile) {
        text = await file.text();
      } else {
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
              base64_content: base64.substring(0, 2000000),
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

  const grouped = files.reduce<Record<string, DataRoomFile[]>>((acc, file) => {
    const cat = file.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(file);
    return acc;
  }, {});

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
    <div className="max-w-5xl space-y-6 page-content">
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
            } : {
              background: 'var(--surface-2)',
              color: 'var(--text-secondary)',
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

      {/* Access Intelligence Section */}
      {!intelLoading && intelligence && (
        <AccessIntelligenceSection
          intelligence={intelligence}
          files={files}
          expandedInvestor={expandedInvestor}
          onToggleInvestor={(id) => setExpandedInvestor(expandedInvestor === id ? null : id)}
          onLogAccess={handleLogAccess}
        />
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

function AccessIntelligenceSection({ intelligence, files, expandedInvestor, onToggleInvestor, onLogAccess }: {
  intelligence: IntelligenceData;
  files: DataRoomFile[];
  expandedInvestor: string | null;
  onToggleInvestor: (id: string) => void;
  onLogAccess: (investorId: string, documentId: string) => void;
}) {
  const hasActivity = intelligence.total_access_events > 0;
  const investorsWithAccess = intelligence.per_investor_access.filter(i => i.documents_accessed > 0);
  const investorsWithRecommendations = intelligence.per_investor_access.filter(i => i.recommended_documents.length > 0);

  return (
    <div className="space-y-6" style={{ marginTop: 'var(--space-8)' }}>
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-6)' }}>
        <div className="flex items-center gap-3 mb-1">
          <span style={{ color: 'var(--text-muted)' }}>
            <Eye className="w-5 h-5" />
          </span>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Access Intelligence
          </h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Track which investors have accessed which documents and get sharing recommendations
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3 card-stagger">
        <StatCard
          label="Total Access Events"
          value={intelligence.total_access_events.toString()}
          icon={<BarChart3 className="w-4 h-4" />}
        />
        <StatCard
          label="Investors with Access"
          value={investorsWithAccess.length.toString()}
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label="Unreached Investors"
          value={intelligence.unreached_investors.length.toString()}
          icon={<AlertCircle className="w-4 h-4" />}
          highlight={intelligence.unreached_investors.length > 0}
        />
        <StatCard
          label="Pending Recommendations"
          value={investorsWithRecommendations.length.toString()}
          icon={<Send className="w-4 h-4" />}
        />
      </div>

      {/* Most Requested Documents */}
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ color: 'var(--text-muted)' }}>
            <TrendingUp className="w-4 h-4" />
          </span>
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Most Requested Documents
          </h3>
        </div>
        {intelligence.most_requested.length > 0 ? (
          <div className="space-y-1">
            {intelligence.most_requested.map((doc, idx) => (
              <MostRequestedRow key={doc.document_id} doc={doc} rank={idx + 1} />
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
            No access events recorded yet. Log document access to see rankings.
          </p>
        )}
      </div>

      {/* Per-Investor Access */}
      <div className="card" style={{ padding: 'var(--space-4)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ color: 'var(--text-muted)' }}>
            <Users className="w-4 h-4" />
          </span>
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Per-Investor Document Access
          </h3>
        </div>
        {intelligence.per_investor_access.length > 0 ? (
          <div className="space-y-1">
            {intelligence.per_investor_access.map(inv => (
              <InvestorAccessRow
                key={inv.investor_id}
                investor={inv}
                expanded={expandedInvestor === inv.investor_id}
                onToggle={() => onToggleInvestor(inv.investor_id)}
                onLogAccess={onLogAccess}
                files={files}
              />
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
            No active investors yet. Add investors in the CRM to see access tracking.
          </p>
        )}
      </div>

      {/* Unreached Investors */}
      {intelligence.unreached_investors.length > 0 && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ color: 'var(--text-tertiary)' }}>
              <AlertCircle className="w-4 h-4" />
            </span>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              Unreached Investors
            </h3>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              Active investors who haven&apos;t accessed any documents
            </span>
          </div>
          <div className="space-y-1">
            {intelligence.unreached_investors.map(inv => (
              <UnreachedInvestorRow key={inv.investor_id} investor={inv} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Access Log */}
      {hasActivity && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span style={{ color: 'var(--text-muted)' }}>
              <Eye className="w-4 h-4" />
            </span>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              Recent Access Log
            </h3>
          </div>
          <div className="space-y-1">
            {intelligence.document_access_log.slice(0, 20).map((entry, idx) => (
              <AccessLogRow key={`${entry.investor_id}-${entry.document_id}-${idx}`} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="card transition-colors"
      style={{
        padding: 'var(--space-3) var(--space-4)',
        borderColor: highlight ? 'var(--warning-muted)' : hovered ? 'var(--border-default)' : undefined,
        transition: 'border-color 150ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: highlight ? 'var(--warning)' : 'var(--text-muted)' }}>{icon}</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: highlight ? 'var(--warning)' : 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  );
}

function MostRequestedRow({ doc, rank }: {
  doc: { document_id: string; document_title: string; category: string; access_count: number };
  rank: number;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flex items-center gap-3 transition-colors"
      style={{
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-md)',
        background: hovered ? 'var(--surface-1)' : 'transparent',
        transition: 'background 150ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{
        fontSize: 'var(--font-size-xs)',
        fontWeight: 600,
        color: rank <= 3 ? 'var(--accent)' : 'var(--text-muted)',
        width: '1.5rem',
        textAlign: 'center',
      }}>
        #{rank}
      </span>
      <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
      <span className="truncate" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
        {doc.document_title}
      </span>
      <span
        style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-muted)',
          background: 'var(--surface-2)',
          padding: '0.125rem var(--space-2)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        {doc.category}
      </span>
      <span className="ml-auto shrink-0" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--text-secondary)' }}>
        {doc.access_count} {doc.access_count === 1 ? 'view' : 'views'}
      </span>
    </div>
  );
}

function InvestorAccessRow({ investor, expanded, onToggle, onLogAccess, files }: {
  investor: IntelligenceData['per_investor_access'][0];
  expanded: boolean;
  onToggle: () => void;
  onLogAccess: (investorId: string, documentId: string) => void;
  files: DataRoomFile[];
}) {
  const [hovered, setHovered] = useState(false);
  const [logDocId, setLogDocId] = useState('');

  const accessedPct = files.length > 0 ? Math.round((investor.documents_accessed / files.length) * 100) : 0;

  return (
    <div
      className="transition-colors"
      style={{
        borderRadius: 'var(--radius-md)',
        transition: 'border-color 150ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="flex items-center gap-3 cursor-pointer"
        style={{ padding: 'var(--space-3) var(--space-4)' }}
        onClick={onToggle}
      >
        {expanded
          ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
          : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
        }
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
          {investor.investor_name}
        </span>
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--text-muted)',
            background: 'var(--surface-2)',
            padding: '0.125rem var(--space-2)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {STATUS_LABELS[investor.status] || investor.status}
        </span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          T{investor.tier}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span style={{ fontSize: 'var(--font-size-xs)', color: investor.documents_accessed > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>
            {investor.documents_accessed} / {files.length} docs ({accessedPct}%)
          </span>
          {investor.recommended_documents.length > 0 && (
            <span style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--accent)',
              background: 'var(--accent-muted)',
              padding: '0.125rem var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 500,
            }}>
              {investor.recommended_documents.length} to share
            </span>
          )}
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 'var(--space-3) var(--space-4)' }}>
          {/* Accessed documents */}
          {investor.accessed_documents.length > 0 && (
            <div className="mb-3">
              <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                Documents Accessed
              </h4>
              <div className="flex flex-wrap gap-2">
                {investor.accessed_documents.map(doc => (
                  <span
                    key={doc.document_id}
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--text-secondary)',
                      background: 'var(--success-muted)',
                      padding: '0.125rem var(--space-2)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    {doc.document_title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommended documents */}
          {investor.recommended_documents.length > 0 && (
            <div className="mb-3">
              <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                Recommended to Share
              </h4>
              <div className="space-y-1">
                {investor.recommended_documents.map(doc => (
                  <RecommendedDocRow
                    key={doc.document_id}
                    doc={doc}
                    investorId={investor.investor_id}
                    onLogAccess={onLogAccess}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Log access manually */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <h4 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              Log Access
            </h4>
            <div className="flex gap-2">
              <select
                value={logDocId}
                onChange={e => setLogDocId(e.target.value)}
                className="input flex-1"
                style={{ fontSize: 'var(--font-size-xs)' }}
              >
                <option value="">Select a document...</option>
                {files
                  .filter(f => !investor.accessed_documents.some(d => d.document_id === f.id))
                  .map(f => (
                    <option key={f.id} value={f.id}>{f.filename}</option>
                  ))}
              </select>
              <button
                className="btn btn-md"
                style={{
                  background: logDocId ? 'var(--accent)' : 'var(--surface-2)',
                  color: logDocId ? 'white' : 'var(--text-muted)',
                  border: `1px solid ${logDocId ? 'var(--accent)' : 'var(--border-default)'}`,
                  fontSize: 'var(--font-size-xs)',
                  opacity: logDocId ? 1 : 0.5,
                  cursor: logDocId ? 'pointer' : 'default',
                }}
                disabled={!logDocId}
                onClick={() => {
                  if (logDocId) {
                    onLogAccess(investor.investor_id, logDocId);
                    setLogDocId('');
                  }
                }}
              >
                Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecommendedDocRow({ doc, investorId, onLogAccess }: {
  doc: { document_id: string; document_title: string; category: string; reason: string };
  investorId: string;
  onLogAccess: (investorId: string, documentId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flex items-center gap-2 transition-colors"
      style={{
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-md)',
        background: hovered ? 'var(--surface-1)' : 'transparent',
        transition: 'background 150ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
      <span className="truncate" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>
        {doc.document_title}
      </span>
      <span style={{
        fontSize: '0.625rem',
        color: 'var(--text-muted)',
        background: 'var(--surface-2)',
        padding: '0 var(--space-1)',
        borderRadius: 'var(--radius-sm)',
      }}>
        {doc.category}
      </span>
      <button
        className="ml-auto shrink-0 btn btn-md"
        style={{
          fontSize: 'var(--font-size-xs)',
          padding: '0.125rem var(--space-2)',
          background: hovered ? 'var(--accent)' : 'var(--accent-muted)',
          color: hovered ? 'white' : 'var(--accent)',
          border: 'none',
          transition: 'all 150ms ease',
        }}
        onClick={() => onLogAccess(investorId, doc.document_id)}
      >
        Mark shared
      </button>
    </div>
  );
}

function UnreachedInvestorRow({ investor }: {
  investor: IntelligenceData['unreached_investors'][0];
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flex items-center gap-3 transition-colors"
      style={{
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-md)',
        background: hovered ? 'var(--surface-1)' : 'transparent',
        transition: 'background 150ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ color: 'var(--text-tertiary)' }}>
        <AlertCircle className="w-3.5 h-3.5" />
      </span>
      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
        {investor.investor_name}
      </span>
      <span style={{
        fontSize: 'var(--font-size-xs)',
        color: 'var(--text-muted)',
        background: 'var(--surface-2)',
        padding: '0.125rem var(--space-2)',
        borderRadius: 'var(--radius-sm)',
      }}>
        {STATUS_LABELS[investor.status] || investor.status}
      </span>
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
        T{investor.tier}
      </span>
      {investor.recommended_categories.length > 0 && (
        <span className="ml-auto" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
          Share: {investor.recommended_categories.join(', ')}
        </span>
      )}
    </div>
  );
}

function AccessLogRow({ entry }: {
  entry: IntelligenceData['document_access_log'][0];
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flex items-center gap-3 transition-colors"
      style={{
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-md)',
        background: hovered ? 'var(--surface-1)' : 'transparent',
        transition: 'background 150ms ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Eye className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)', minWidth: '8rem' }}>
        {entry.investor_name}
      </span>
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>viewed</span>
      <span className="truncate" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
        {entry.document_title}
      </span>
      <span className="ml-auto shrink-0" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
        {new Date(entry.accessed_at).toLocaleDateString()} {new Date(entry.accessed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
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
      className="transition-colors"
      style={{
        borderRadius: 'var(--radius-md)',
        transition: 'all 150ms ease',
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
          className="ml-3 shrink-0 transition-colors"
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

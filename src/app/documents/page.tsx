'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import { FileText, Plus, Clock, Edit3 } from 'lucide-react';

interface Doc {
  id: string;
  title: string;
  type: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  memo: 'Investment Memo',
  deck: 'Presentation Deck',
  one_pager: 'One-Pager',
  exec_brief: 'Executive Brief',
  custom: 'Custom Document',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-900/30 text-yellow-400',
  review: 'bg-blue-900/30 text-blue-400',
  final: 'bg-green-900/30 text-green-400',
};

export default function DocumentsPage() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDocs(); }, []);

  async function fetchDocs() {
    setLoading(true);
    const res = await fetch('/api/documents');
    setDocs(await res.json());
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this document and all its versions?')) return;
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    toast('Document deleted', 'warning');
    fetchDocs();
  }

  // Group by type
  const grouped = docs.reduce<Record<string, Doc[]>>((acc, doc) => {
    const type = doc.type || 'custom';
    if (!acc[type]) acc[type] = [];
    acc[type].push(doc);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-zinc-800/50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-zinc-500 text-sm mt-1">{docs.length} documents</p>
        </div>
        <Link
          href="/documents/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Document
        </Link>
      </div>

      {docs.length === 0 ? (
        <div className="border border-zinc-800 rounded-xl p-8 text-center space-y-3">
          <FileText className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-zinc-500">No documents yet.</p>
          <Link href="/documents/new" className="text-blue-400 hover:text-blue-300 text-sm">
            Create your first document
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([type, typeDocs]) => (
            <div key={type}>
              <h2 className="text-xs font-medium text-zinc-400 mb-3 uppercase">
                {TYPE_LABELS[type] || type} ({typeDocs.length})
              </h2>
              <div className="space-y-2">
                {typeDocs.map(doc => (
                  <div key={doc.id} className="border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors flex items-center justify-between">
                    <Link href={`/documents/${doc.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <Edit3 className="w-4 h-4 text-zinc-500 shrink-0" />
                        <div className="min-w-0">
                          <h3 className="font-medium truncate">{doc.title}</h3>
                          <div className="flex items-center gap-3 text-xs text-zinc-500 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(doc.updated_at).toLocaleDateString()}
                            </span>
                            <span>{doc.content.length.toLocaleString()} chars</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[doc.status] || 'bg-zinc-800 text-zinc-500'}`}>
                        {doc.status}
                      </span>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="text-xs text-zinc-600 hover:text-red-400 px-2 py-1 rounded hover:bg-zinc-800"
                      >
                        Del
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

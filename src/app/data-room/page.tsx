'use client';

import { FolderOpen, Upload, FileText, Table, Image } from 'lucide-react';

export default function DataRoomPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Room</h1>
        <p className="text-zinc-500 text-sm mt-1">Upload source documents that feed all your deliverables</p>
      </div>

      {/* Upload Area */}
      <div className="border-2 border-dashed border-zinc-800 rounded-xl p-12 text-center hover:border-zinc-700 transition-colors cursor-pointer">
        <Upload className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
        <p className="text-zinc-400 text-sm">Drag and drop files here, or click to browse</p>
        <p className="text-zinc-600 text-xs mt-1">PDF, DOCX, XLSX, PPTX, images</p>
      </div>

      {/* Categories */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: Table, label: 'Financial', count: 0, desc: 'Financials, model, cap table, projections' },
          { icon: FileText, label: 'Legal', count: 0, desc: 'SHA, contracts, IP schedule, articles' },
          { icon: FolderOpen, label: 'Commercial', count: 0, desc: 'Customer contracts, pipeline, backlog' },
          { icon: Image, label: 'Technical', count: 0, desc: 'Architecture, product roadmap, patents' },
        ].map(cat => (
          <div key={cat.label} className="border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <cat.icon className="w-5 h-5 text-zinc-500" />
              <span className="font-medium">{cat.label}</span>
              <span className="text-xs text-zinc-600 ml-auto">{cat.count} files</span>
            </div>
            <p className="text-xs text-zinc-600">{cat.desc}</p>
          </div>
        ))}
      </div>

      <div className="border border-zinc-800 rounded-xl p-6 text-center">
        <p className="text-zinc-600 text-sm">Data room functionality coming in Phase 3. Files uploaded here will provide context for all AI-generated deliverables.</p>
      </div>
    </div>
  );
}

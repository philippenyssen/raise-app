'use client';

import { useState, useEffect, useRef } from 'react';
import { FileBarChart, Printer, Loader2, ClipboardList, Users2, BarChart3 } from 'lucide-react';

interface InvestorOption {
  id: string;
  name: string;
  tier: number;
  status: string;
}

export default function ReportsPage() {
  const [investors, setInvestors] = useState<InvestorOption[]>([]);
  const [selectedInvestor, setSelectedInvestor] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportType, setReportType] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch('/api/investors')
      .then(r => r.json())
      .then(data => {
        const list = (Array.isArray(data) ? data : data.investors || []) as InvestorOption[];
        setInvestors(list.filter(i => i.status !== 'passed' && i.status !== 'dropped'));
      })
      .catch(() => {});
  }, []);

  async function generateReport(type: string) {
    setLoading(type);
    setError(null);
    setReportHtml(null);
    setReportType(null);

    try {
      let url = `/api/reports?type=${type}`;
      if (type === 'investor_brief') {
        if (!selectedInvestor) {
          setError('Please select an investor first.');
          setLoading(null);
          return;
        }
        url += `&investor_id=${selectedInvestor}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errData.error || 'Failed to generate report');
      }

      const html = await res.text();
      setReportHtml(html);
      setReportType(type);
      setGeneratedAt(new Date().toLocaleString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(null);
    }
  }

  function handlePrint() {
    if (!iframeRef.current) return;
    const iframeWindow = iframeRef.current.contentWindow;
    if (iframeWindow) {
      iframeWindow.focus();
      iframeWindow.print();
    }
  }

  const reportTypeLabels: Record<string, string> = {
    board: 'Board Update',
    team: 'Weekly Agenda',
    investor_brief: 'Investor Brief',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
            <FileBarChart className="w-5 h-5 text-white" />
          </span>
          Reports
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          Generate structured reports from your fundraise data
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Board Update */}
        <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-900/50">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-8 rounded-lg bg-emerald-900/50 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-emerald-400" />
            </span>
            <h2 className="font-semibold text-sm">Board Update</h2>
          </div>
          <p className="text-zinc-500 text-xs leading-relaxed mb-4">
            Generate a 1-page board update summarizing process health, pipeline funnel, top focus investors, conviction trends, and key risks.
          </p>
          <button
            onClick={() => generateReport('board')}
            disabled={loading !== null}
            className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading === 'board' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading === 'board' ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {/* Weekly Agenda */}
        <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-900/50">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-8 rounded-lg bg-blue-900/50 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-blue-400" />
            </span>
            <h2 className="font-semibold text-sm">Weekly Agenda</h2>
          </div>
          <p className="text-zinc-500 text-xs leading-relaxed mb-4">
            Generate team priorities and action items for this week, including overdue follow-ups, top objections, and tasks due.
          </p>
          <button
            onClick={() => generateReport('team')}
            disabled={loading !== null}
            className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading === 'team' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading === 'team' ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {/* Investor Brief */}
        <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-900/50">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-8 rounded-lg bg-violet-900/50 flex items-center justify-center">
              <Users2 className="w-4 h-4 text-violet-400" />
            </span>
            <h2 className="font-semibold text-sm">Investor Brief</h2>
          </div>
          <p className="text-zinc-500 text-xs leading-relaxed mb-3">
            Generate a detailed brief for a specific investor with profile, score, meetings, objections, and assessment.
          </p>
          <select
            value={selectedInvestor}
            onChange={e => setSelectedInvestor(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-200 mb-3 focus:outline-none focus:border-violet-500"
          >
            <option value="">Select investor...</option>
            {investors.map(inv => (
              <option key={inv.id} value={inv.id}>
                {inv.name} (Tier {inv.tier})
              </option>
            ))}
          </select>
          <button
            onClick={() => generateReport('investor_brief')}
            disabled={loading !== null || !selectedInvestor}
            className="w-full px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading === 'investor_brief' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading === 'investor_brief' ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border border-red-800 bg-red-900/20 rounded-lg p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Report Display */}
      {reportHtml && (
        <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50">
          {/* Report toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-zinc-300">
                {reportTypeLabels[reportType || ''] || 'Report'}
              </span>
              {generatedAt && (
                <span className="text-xs text-zinc-600">
                  Generated {generatedAt}
                </span>
              )}
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save as PDF
            </button>
          </div>

          {/* Iframe to render the HTML report */}
          <iframe
            ref={iframeRef}
            srcDoc={reportHtml}
            className="w-full bg-white"
            style={{ minHeight: '800px', border: 'none' }}
            title="Report Preview"
            onLoad={() => {
              // Auto-resize iframe to fit content
              if (iframeRef.current?.contentDocument) {
                const height = iframeRef.current.contentDocument.documentElement.scrollHeight;
                iframeRef.current.style.height = Math.max(800, height + 40) + 'px';
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

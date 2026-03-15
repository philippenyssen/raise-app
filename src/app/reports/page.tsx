'use client';

import { useState, useEffect, useRef } from 'react';
import { Printer, Loader2, ClipboardList, Users2, BarChart3 } from 'lucide-react';
import { stAccent, stTextMuted, stTextPrimary, stTextSecondary } from '@/lib/styles';

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
  const [hoverStates, setHoverStates] = useState<Record<string, boolean>>({});

  const setHover = (key: string, val: boolean) => setHoverStates(prev => ({ ...prev, [key]: val }));

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
    <div className="space-y-6 page-content">
      {/* Header */}
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="text-sm mt-1" style={stTextMuted}>
          Generate structured reports from your fundraise data
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Board Update */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'color-mix(in srgb, var(--surface-1) 50%, transparent)' }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--success-muted)' }}>
              <BarChart3 className="w-4 h-4" style={stTextSecondary} />
            </span>
            <h2 className="font-normal text-sm" style={stTextPrimary}>Board Update</h2>
          </div>
          <p className="text-xs leading-relaxed mb-4" style={stTextMuted}>
            Generate a 1-page board update summarizing process health, pipeline funnel, top focus investors, conviction trends, and key risks.
          </p>
          <button
            onClick={() => generateReport('board')}
            disabled={loading !== null}
            className="w-full px-4 py-2 rounded-lg text-sm font-normal transition-colors flex items-center justify-center gap-2"
            style={{
              backgroundColor: loading !== null ? 'var(--surface-2)' : (hoverStates['boardBtn'] ? 'var(--success)' : 'var(--success)'),
              color: loading !== null ? 'var(--text-muted)' : 'var(--surface-0)',
              opacity: hoverStates['boardBtn'] && loading === null ? 0.85 : 1, }}
            onMouseEnter={() => setHover('boardBtn', true)}
            onMouseLeave={() => setHover('boardBtn', false)}>
            {loading === 'board' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading === 'board' ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {/* Weekly Agenda */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'color-mix(in srgb, var(--surface-1) 50%, transparent)' }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)' }}>
              <ClipboardList className="w-4 h-4" style={stAccent} />
            </span>
            <h2 className="font-normal text-sm" style={stTextPrimary}>Weekly Agenda</h2>
          </div>
          <p className="text-xs leading-relaxed mb-4" style={stTextMuted}>
            Generate team priorities and action items for this week, including overdue follow-ups, top objections, and tasks due.
          </p>
          <button
            onClick={() => generateReport('team')}
            disabled={loading !== null}
            className="w-full px-4 py-2 rounded-lg text-sm font-normal transition-colors flex items-center justify-center gap-2"
            style={{
              backgroundColor: loading !== null ? 'var(--surface-2)' : 'var(--accent)',
              color: loading !== null ? 'var(--text-muted)' : 'var(--surface-0)',
              opacity: hoverStates['teamBtn'] && loading === null ? 0.85 : 1, }}
            onMouseEnter={() => setHover('teamBtn', true)}
            onMouseLeave={() => setHover('teamBtn', false)}>
            {loading === 'team' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading === 'team' ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {/* Investor Brief */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'color-mix(in srgb, var(--surface-1) 50%, transparent)' }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--accent-muted) 20%, transparent)' }}>
              <Users2 className="w-4 h-4" style={{ color: 'var(--accent-muted)' }} />
            </span>
            <h2 className="font-normal text-sm" style={stTextPrimary}>Investor Brief</h2>
          </div>
          <p className="text-xs leading-relaxed mb-3" style={stTextMuted}>
            Generate a detailed brief for a specific investor with profile, score, meetings, objections, and assessment.
          </p>
          <select
            value={selectedInvestor}
            onChange={e => setSelectedInvestor(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm mb-3 focus:outline-none"
            style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
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
            className="w-full px-4 py-2 rounded-lg text-sm font-normal transition-colors flex items-center justify-center gap-2"
            style={{
              backgroundColor: (loading !== null || !selectedInvestor) ? 'var(--surface-2)' : 'var(--accent-muted)',
              color: (loading !== null || !selectedInvestor) ? 'var(--text-muted)' : 'var(--surface-0)',
              opacity: hoverStates['invBtn'] && loading === null && selectedInvestor ? 0.85 : 1, }}
            onMouseEnter={() => setHover('invBtn', true)}
            onMouseLeave={() => setHover('invBtn', false)}>
            {loading === 'investor_brief' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading === 'investor_brief' ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg p-4 text-sm" style={{ border: '1px solid var(--danger)', backgroundColor: 'var(--danger-muted)', color: 'var(--text-primary)' }}>
          {error}
        </div>
      )}

      {/* Report Display */}
      {reportHtml && (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'color-mix(in srgb, var(--surface-1) 50%, transparent)' }}>
          {/* Report toolbar */}
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3">
              <span className="text-sm font-normal" style={stTextSecondary}>
                {reportTypeLabels[reportType || ''] || 'Report'}
              </span>
              {generatedAt && (
                <span className="text-xs" style={stTextMuted}>
                  Generated {generatedAt}
                </span>
              )}
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-normal transition-colors"
              style={{ backgroundColor: hoverStates['printBtn'] ? 'var(--surface-3)' : 'var(--surface-2)', color: 'var(--text-secondary)' }}
              onMouseEnter={() => setHover('printBtn', true)}
              onMouseLeave={() => setHover('printBtn', false)}>
              <Printer className="w-3.5 h-3.5" />
              Print / Save as PDF
            </button>
          </div>

          {/* Iframe to render the HTML report */}
          <iframe
            ref={iframeRef}
            srcDoc={reportHtml}
            className="w-full"
            style={{ minHeight: '800px', border: 'none', backgroundColor: 'var(--surface-0)' }}
            title="Report Preview"
            onLoad={() => {
              // Auto-resize iframe to fit content
              if (iframeRef.current?.contentDocument) {
                const height = iframeRef.current.contentDocument.documentElement.scrollHeight;
                iframeRef.current.style.height = Math.max(800, height + 40) + 'px';
              }
            }} />
        </div>
      )}
    </div>
  );
}

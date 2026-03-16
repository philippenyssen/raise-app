'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Printer, Loader2, ClipboardList, Users2, BarChart3 } from 'lucide-react';
import { stAccent, stTextMuted, stTextPrimary, stTextSecondary } from '@/lib/styles';
import { cachedFetch } from '@/lib/cache';

const reportCardBg = { backgroundColor: 'color-mix(in srgb, var(--surface-1) 50%, transparent)' } as const;
const selectStyle = { backgroundColor: 'var(--surface-2)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' } as const;
const errorBoxStyle: React.CSSProperties = { border: '1px solid var(--danger)', backgroundColor: 'var(--danger-muted)', color: 'var(--text-primary)' };
const printBtnStyle = { backgroundColor: 'var(--surface-2)', color: 'var(--text-secondary)' } as const;
const boardIconBg: React.CSSProperties = { backgroundColor: 'var(--success-muted)' };
const weeklyIconBg: React.CSSProperties = { backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)' };
const briefIconBg: React.CSSProperties = { backgroundColor: 'color-mix(in srgb, var(--accent-muted) 20%, transparent)' };
const briefIconColor: React.CSSProperties = { color: 'var(--accent-muted)' };
const reportToolbarDivider: React.CSSProperties = { borderBottom: '1px solid var(--border-subtle)' };
const reportIframeStyle: React.CSSProperties = { minHeight: '800px', border: 'none', backgroundColor: 'var(--surface-0)' };

interface InvestorOption { id: string; name: string; tier: number; status: string; }

export default function ReportsPage() {
  const [investors, setInvestors] = useState<InvestorOption[]>([]);
  const [selectedInvestor, setSelectedInvestor] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportType, setReportType] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => { document.title = 'Raise | Reports'; }, []);
  const fetchInvestors = useCallback(() => {
    cachedFetch('/api/investors')
      .then(r => r.json())
      .then(data => {
        const list = (Array.isArray(data) ? data : data.investors || []) as InvestorOption[];
        setInvestors(list.filter(i => i.status !== 'passed' && i.status !== 'dropped'));})
      .catch(e => { console.warn('[REPORTS_INVESTORS]', e instanceof Error ? e.message : e); setError('Couldn\'t load investors — try refreshing the page'); });
  }, []);
  useEffect(() => { fetchInvestors(); }, [fetchInvestors]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault(); fetchInvestors();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fetchInvestors]);

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

      const res = await cachedFetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(e => { console.warn('[REPORTS_PARSE]', e instanceof Error ? e.message : e); return { error: 'Request failed' }; });
        throw new Error(errData.error || 'Report generation failed — check Settings → API Keys, or the service may be temporarily unavailable');
      }

      const html = await res.text();
      setReportHtml(html);
      setReportType(type);
      setGeneratedAt(new Date().toLocaleString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report generation failed — check Settings → API Keys, or the service may be temporarily unavailable');
    } finally {
      setLoading(null);
    }}

  function handlePrint() {
    if (!iframeRef.current) return;
    const iframeWindow = iframeRef.current.contentWindow;
    if (iframeWindow) {
      iframeWindow.focus();
      iframeWindow.print();
    }}

  const investorById = useMemo(() => new Map(investors.map(i => [i.id, i])), [investors]);

  const reportTypeLabels: Record<string, string> = {
    board: 'Board Update',
    team: 'Weekly Agenda',
    investor_brief: 'Investor Brief',};

  return (
    <div className="space-y-6 page-content">
      {/* Header */}
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="text-sm mt-1" style={stTextMuted}>
          Generate board updates, weekly agendas, or investor briefs from your fundraise data</p></div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Board Update */}
        <div className="rounded-xl p-5" style={reportCardBg}>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={boardIconBg}>
              <BarChart3 className="w-4 h-4" style={stTextSecondary} /></span>
            <h2 className="font-normal text-sm" style={stTextPrimary}>Board Update</h2></div>
          <p className="text-xs leading-relaxed mb-4" style={stTextMuted}>
            Generate a 1-page board update summarizing process health, pipeline funnel, top focus investors, conviction trends, and key risks.
          </p>
          <button
            onClick={() => generateReport('board')}
            disabled={loading !== null}
            className="w-full px-4 py-2 rounded-lg text-sm font-normal flex items-center justify-center gap-2 btn-accent-hover"
            style={{
              backgroundColor: loading !== null ? 'var(--surface-2)' : 'var(--success)',
              color: loading !== null ? 'var(--text-muted)' : 'var(--surface-0)', }}>
            {loading === 'board' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading === 'board' ? 'Generating...' : 'Generate'}</button></div>

        {/* Weekly Agenda */}
        <div className="rounded-xl p-5" style={reportCardBg}>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={weeklyIconBg}>
              <ClipboardList className="w-4 h-4" style={stAccent} /></span>
            <h2 className="font-normal text-sm" style={stTextPrimary}>Weekly Agenda</h2></div>
          <p className="text-xs leading-relaxed mb-4" style={stTextMuted}>
            Generate team priorities and action items for this week, including overdue follow-ups, top objections, and tasks due.
          </p>
          <button
            onClick={() => generateReport('team')}
            disabled={loading !== null}
            className="w-full px-4 py-2 rounded-lg text-sm font-normal flex items-center justify-center gap-2 btn-accent-hover"
            style={{
              backgroundColor: loading !== null ? 'var(--surface-2)' : 'var(--accent)',
              color: loading !== null ? 'var(--text-muted)' : 'var(--surface-0)', }}>
            {loading === 'team' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading === 'team' ? 'Generating...' : 'Generate'}</button></div>

        {/* Investor Brief */}
        <div className="rounded-xl p-5" style={reportCardBg}>
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={briefIconBg}>
              <Users2 className="w-4 h-4" style={briefIconColor} /></span>
            <h2 className="font-normal text-sm" style={stTextPrimary}>Investor Brief</h2></div>
          <p className="text-xs leading-relaxed mb-3" style={stTextMuted}>
            Generate a detailed brief for a specific investor with profile, score, meetings, objections, and assessment.</p>
          <select
            value={selectedInvestor}
            onChange={e => setSelectedInvestor(e.target.value)}
            aria-label="Select investor for brief"
            className="w-full px-3 py-2 rounded-lg text-sm mb-3 focus:outline-none"
            style={selectStyle}>
            <option value="">Investor name...</option>
            {investors.map(inv => (
              <option key={inv.id} value={inv.id}>
                {inv.name} (Tier {inv.tier})</option>
            ))}</select>
          <button
            onClick={() => generateReport('investor_brief')}
            disabled={loading !== null || !selectedInvestor}
            className="w-full px-4 py-2 rounded-lg text-sm font-normal flex items-center justify-center gap-2 btn-accent-hover"
            style={{
              backgroundColor: (loading !== null || !selectedInvestor) ? 'var(--surface-2)' : 'var(--accent-muted)',
              color: (loading !== null || !selectedInvestor) ? 'var(--text-muted)' : 'var(--surface-0)', }}>
            {loading === 'investor_brief' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading === 'investor_brief' ? 'Generating brief...' : selectedInvestor ? 'Generate brief' : 'Select investor above'}</button></div></div>

      {/* Error */}
      {error && (
        <div role="alert" className="rounded-lg p-4 text-sm" style={errorBoxStyle}>
          {error}</div>
      )}

      {/* Report Display */}
      {reportHtml && (
        <div className="rounded-xl overflow-hidden" style={reportCardBg}>
          {/* Report toolbar */}
          <div className="flex items-center justify-between px-5 py-3" style={reportToolbarDivider}>
            <div className="flex items-center gap-3">
              <span className="text-sm font-normal" style={stTextSecondary}>
                {reportTypeLabels[reportType || ''] || 'Report'}</span>
              {generatedAt && (
                <span className="text-xs" style={stTextMuted}>
                  Generated {generatedAt}</span>
              )}</div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-normal btn-surface"
              style={printBtnStyle}>
              <Printer className="w-3.5 h-3.5" />
              Print / Save as PDF</button></div>

          {/* Iframe to render the HTML report */}
          <iframe
            ref={iframeRef}
            srcDoc={reportHtml}
            className="w-full"
            style={reportIframeStyle}
            title="Report Preview"
            onLoad={() => {
              // Auto-resize iframe to fit content
              if (iframeRef.current?.contentDocument) {
                const height = iframeRef.current.contentDocument.documentElement.scrollHeight;
                iframeRef.current.style.height = Math.max(800, height + 40) + 'px';
              }
            }} /></div>
      )}
    </div>);
}

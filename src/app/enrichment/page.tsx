'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Database, Search, RefreshCw, Loader2, CheckCircle2, XCircle,
  ChevronDown, ChevronRight, Shield, Globe, Building2,
  Users, Briefcase, FileSearch, Zap, BarChart3, Clock, AlertTriangle,
  Play, Settings, Layers,
} from 'lucide-react';
import { useToast } from '@/components/toast';
import { fmtDateTime } from '@/lib/format';
import { labelMuted, labelTertiary, stFontSm, stFontXs, stTextMuted, icon14, icon12 } from '@/lib/styles';

const flexCenterGap2 = { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' } as const;
const investorRowGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 'var(--space-2)', alignItems: 'center', padding: 'var(--space-2) var(--space-4)' };
const enrichBtnBase: React.CSSProperties = { background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-20)', fontSize: 'var(--font-size-xs)', padding: '4px 10px' };
const fieldTagStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-2)', color: 'var(--text-tertiary)' };
const investorLinkStyle: React.CSSProperties = { fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 400, textDecoration: 'none' };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderInfo { id: string; name: string; type: 'free' | 'freemium' | 'paid'; description: string; fields_provided: string[]; requires_api_key: boolean; api_key_env?: string; configured: boolean }

interface InvestorOption { id: string; name: string; tier: number; status: string; type: string }

interface EnrichmentJobRow { id: string; investor_id: string; investor_name: string; sources: string; status: string; results_count: number; errors: string; started_at: string; completed_at: string | null; created_at: string }

interface EnrichmentStats { total_records: number; total_investors_enriched: number; total_jobs: number; records_by_source: { source_id: string; cnt: number }[]; records_by_category: { category: string; cnt: number }[]; avg_confidence: number; stale_count: number }

interface EnrichResult { job_id: string; status: string; total_fields: number; sources_succeeded: number; sources_failed: number; duration_ms: number; errors: string[] }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_TYPE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  free: { bg: 'var(--success-muted)', color: 'var(--text-secondary)', border: 'var(--accent-20)' },
  freemium: { bg: 'var(--accent-muted)', color: 'var(--accent)', border: 'var(--accent-5)' },
  paid: { bg: 'var(--warning-muted)', color: 'var(--text-tertiary)', border: 'var(--warn-20)' },};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  identity: Building2,
  financials: BarChart3,
  strategy: Briefcase,
  people: Users,
  portfolio: Layers,
  process: Settings,
  contact: Globe,
  regulatory: Shield,
  corporate: Building2,
  media: FileSearch,
  relationships: Users,};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EnrichmentPage() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [investors, setInvestors] = useState<InvestorOption[]>([]);
  const [jobs, setJobs] = useState<EnrichmentJobRow[]>([]);
  const [stats, setStats] = useState<EnrichmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [enriching, setEnriching] = useState<string | null>(null); // investor_id being enriched
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<EnrichResult | null>(null);
  const [tab, setTab] = useState<'enrich' | 'sources' | 'history'>('enrich');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    let failures = 0;
    const safeFetch = async (url: string, fallback: unknown = []) => {
      try { const r = await fetch(url); if (!r.ok) { failures++; return fallback; } return r.json(); } catch (e) { console.warn('[ENRICH_FETCH]', e instanceof Error ? e.message : e); failures++; return fallback; }
    };
    const [provRes, invRes, jobRes, statsRes] = await Promise.all([
      safeFetch('/api/enrichment?action=providers'),
      safeFetch('/api/investors'),
      safeFetch('/api/enrichment?action=jobs'),
      safeFetch('/api/enrichment?action=stats', null),]);
    if (failures >= 3) setFetchError(true);
    setProviders(Array.isArray(provRes) ? provRes : []);
    const invList = Array.isArray(invRes) ? invRes : invRes?.investors || [];
    setInvestors(invList.filter((i: InvestorOption) => i.status !== 'passed' && i.status !== 'dropped'));
    setJobs(Array.isArray(jobRes) ? jobRes : []);
    setStats(statsRes);
    setLoading(false);
  }, []);

  useEffect(() => { document.title = 'Raise | Data Enrichment'; }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchData(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fetchData]);

  async function enrichSingle(investorId: string) {
    setEnriching(investorId);
    setLastResult(null);
    try {
      const res = await fetch('/api/enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enrich',
          investor_id: investorId,
          sources: selectedSources.size > 0 ? [...selectedSources] : undefined,
          auto_apply: true,
        }),});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enrichment failed');

      setLastResult(data);
      toast(`Enriched: ${data.total_fields} fields from ${data.sources_succeeded} sources`, 'success');
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Enrichment failed — check your API key in settings', 'error');
    } finally {
      setEnriching(null);
    }}

  async function enrichBulk() {
    setBulkEnriching(true);
    setLastResult(null);
    try {
      const ids = investors.map(i => i.id);
      const res = await fetch('/api/enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_enrich',
          investor_ids: ids,
          sources: selectedSources.size > 0 ? [...selectedSources] : undefined,
          auto_apply: true,
        }),});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk enrichment failed');

      const totalFields = data.results?.reduce((s: number, r: { fields: number }) => s + r.fields, 0) || 0;
      toast(`Bulk enriched ${data.total} investors (${totalFields} total fields)`, 'success');
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bulk enrichment failed — check your API key in settings', 'error');
    } finally {
      setBulkEnriching(false);
    }}

  function toggleSource(id: string) {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;});
  }

  const configuredCount = providers.filter(p => p.configured).length;
  const freeCount = providers.filter(p => p.type === 'free' && p.configured).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className="skeleton" style={{ height: '32px', width: '200px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }}>
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-lg)' }} />)}
        </div>
        <div className="skeleton" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
      </div>);
  }

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {fetchError && (
        <div className="rounded-lg p-4" style={{ background: 'var(--danger-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            Enrichment data failed to load. If this persists, check Settings for API credentials.</span>
          <button onClick={fetchData} className="btn btn-secondary btn-sm">Retry</button></div>
      )}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Data Enrichment</h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
            {configuredCount} sources active ({freeCount} free) &middot; {investors.length} investors in pipeline</p></div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            onClick={enrichBulk}
            disabled={bulkEnriching || investors.length === 0}
            className="btn btn-primary btn-md"
            style={{ opacity: bulkEnriching || investors.length === 0 ? 0.4 : 1 }}>
            {bulkEnriching ? <Loader2 style={icon14} className="animate-spin" /> : <Zap style={icon14} />}
            {bulkEnriching ? 'Enriching All...' : 'Enrich All Investors'}</button></div></div>

      {/* Stats Row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
          <StatCard label="Records" value={stats.total_records.toLocaleString()} icon={<Database style={icon14} />}
            />
          <StatCard label="Investors Enriched" value={String(stats.total_investors_enriched)} icon={<Users style={icon14} />}
            />
          <StatCard label="Jobs Run" value={String(stats.total_jobs)} icon={<RefreshCw style={icon14} />}
            />
          <StatCard label="Avg Confidence" value={`${(stats.avg_confidence * 100).toFixed(0)}%`} icon={<Shield style={icon14} />}
            />
          <StatCard label="Stale Records" value={String(stats.stale_count)} icon={<AlertTriangle style={icon14} />} accent={stats.stale_count > 0 ? 'var(--warning)' : undefined}
            /></div>
      )}

      {/* Tabs */}
      <div role="tablist" style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--border-default)' }}>
        {(['enrich', 'sources', 'history'] as const).map(t => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 400,
              borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)', }}>
            {t === 'enrich' && <Search style={icon14} />}
            {t === 'sources' && <Settings style={icon14} />}
            {t === 'history' && <Clock style={icon14} />}
            {t === 'enrich' ? 'Enrich' : t === 'sources' ? `Sources (${configuredCount}/${providers.length})` : `History (${jobs.length})`}
          </button>
        ))}</div>

      {/* Last Result Banner */}
      {lastResult && (
        <div className="card" style={{
          background: lastResult.status === 'completed' ? 'var(--success-muted)' : lastResult.status === 'partial' ? 'var(--warning-muted)' : 'var(--danger-muted)',
          padding: 'var(--space-3) var(--space-4)',}}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={flexCenterGap2}>
              {lastResult.status === 'completed' ? <CheckCircle2 style={{ width: '16px', height: '16px', color: 'var(--text-secondary)' }} /> :
               lastResult.status === 'partial' ? <AlertTriangle style={{ width: '16px', height: '16px', color: 'var(--text-tertiary)' }} /> :
               <XCircle style={{ width: '16px', height: '16px', color: 'var(--text-primary)' }} />}
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 400 }}>
                {lastResult.total_fields} fields enriched from {lastResult.sources_succeeded} sources</span>
              <span style={labelMuted}>
                ({lastResult.duration_ms}ms)</span></div>
            <button onClick={() => setLastResult(null)} aria-label="Dismiss result" title="Dismiss" style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
              <XCircle style={icon14} /></button></div>
          {lastResult.errors.length > 0 && (
            <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
              {lastResult.errors.map((e, i) => <div key={i}>{e}</div>)}</div>
          )}</div>
      )}

      {/* Enrich Tab */}
      {tab === 'enrich' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Investor List */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-header" style={{ padding: 'var(--space-3) var(--space-4)', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 'var(--space-2)' }}>
              <span>Investor</span>
              <span>Type</span>
              <span>Tier</span>
              <span>Status</span>
              <span style={{ textAlign: 'right' }}>Actions</span></div>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {investors.length === 0 ? (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  No investors in pipeline yet. <Link href="/investors" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Add investors</Link> to start enriching their profiles with background intelligence.</div>
              ) : (
                investors.map(inv => (
                  <div
                    key={inv.id}
                    className="table-row"
                    style={investorRowGrid}>
                    <Link
                      href={`/investors/${inv.id}`}
                      style={investorLinkStyle}>
                      {inv.name}</Link>
                    <span style={labelTertiary}>{inv.type}</span>
                    <span className="tier-badge" data-tier={inv.tier} style={stFontXs}>T{inv.tier}</span>
                    <span style={labelTertiary}>{inv.status}</span>
                    <button
                      onClick={() => enrichSingle(inv.id)}
                      disabled={enriching === inv.id || bulkEnriching}
                      className="btn btn-sm"
                      style={{ ...enrichBtnBase, opacity: enriching === inv.id || bulkEnriching ? 0.4 : 1 }}>
                      {enriching === inv.id ? <Loader2 style={icon12} className="animate-spin" /> : <Play style={icon12} />}
                      {enriching === inv.id ? 'Enriching...' : 'Enrich'}</button></div>
                ))
              )}</div></div></div>
      )}

      {/* Sources Tab */}
      {tab === 'sources' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {providers.map(provider => {
            const typeStyle = SOURCE_TYPE_STYLES[provider.type] || SOURCE_TYPE_STYLES.free;
            const isSelected = selectedSources.size === 0 || selectedSources.has(provider.id);
            const isExpanded = expandedProvider === provider.id;

            return (
              <div key={provider.id} className="card" style={{ padding: 0, overflow: 'hidden', opacity: provider.configured ? 1 : 0.6 }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-4)',
                    cursor: 'pointer', }}
                  onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => { e.stopPropagation(); toggleSource(provider.id); }}
                      style={{ accentColor: 'var(--accent)' }}
                      disabled={!provider.configured} />
                    <div>
                      <div style={flexCenterGap2}>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>
                          {provider.name}</span>
                        <span style={{
                          fontSize: 'var(--font-size-xs)',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-sm)',
                          background: typeStyle.bg,
                          color: typeStyle.color,
                          border: `1px solid ${typeStyle.border}`,}}>
                          {provider.type}</span>
                        {provider.configured ? (
                          <CheckCircle2 style={{ ...icon12, color: 'var(--text-secondary)' }} />
                        ) : (
                          <XCircle style={{ ...icon12, color: 'var(--text-muted)' }} />
                        )}</div>
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {provider.description.slice(0, 120)}{provider.description.length > 120 ? '...' : ''}</p></div></div>
                  <div style={flexCenterGap2}>
                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                      {provider.fields_provided.map(f => {
                        const Icon = CATEGORY_ICONS[f] || Globe;
                        return (
                          <span key={f} title={f} style={stTextMuted}>
                            <Icon style={icon12} />
                          </span>);
                      })}</div>
                    {isExpanded ? <ChevronDown style={{ ...icon14, color: 'var(--text-muted)' }} /> :
                      <ChevronRight style={{ ...icon14, color: 'var(--text-muted)' }} />}</div></div>

                {isExpanded && (
                  <div style={{
                    padding: 'var(--space-3) var(--space-4)',
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--surface-1)',}}>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {provider.description}</p>
                    <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      <span style={labelMuted}>Provides:</span>
                      {provider.fields_provided.map(f => (
                        <span key={f} style={fieldTagStyle}>
                          {f}</span>
                      ))}</div>
                    {provider.requires_api_key && !provider.configured && (
                      <div style={{
                        marginTop: 'var(--space-3)',
                        padding: 'var(--space-2) var(--space-3)',
                        background: 'var(--warning-muted)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-tertiary)',}}>
                        Requires API key: set <code style={{ background: 'var(--surface-3)', padding: '0 4px', borderRadius: '3px' }}>{provider.api_key_env}</code> in your environment
                      </div>
                    )}</div>
                )}
              </div>);
          })}</div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {jobs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
              <Database style={{ width: '32px', height: '32px', margin: '0 auto var(--space-3)' }} />
              <p style={stFontSm}>No enrichment data yet. Select an investor above and click Enrich to gather background intelligence from 9 sources.</p>
            </div>
          ) : (
            jobs.map(job => {
              let sources: string[] = [];
              let errors: string[] = [];
              try { sources = JSON.parse(job.sources || '[]'); } catch (e) { console.warn('[ENRICH_SOURCES]', e instanceof Error ? e.message : e); }
              try { errors = JSON.parse(job.errors || '[]'); } catch (e) { console.warn('[ENRICH_ERRORS]', e instanceof Error ? e.message : e); }
              return (
                <div key={job.id} className="card" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      {job.status === 'completed' ? <CheckCircle2 style={{ ...icon14, color: 'var(--text-secondary)' }} /> :
                       job.status === 'running' ? <Loader2 style={{ ...icon14, color: 'var(--accent)' }} className="animate-spin" /> :
                       job.status === 'failed' ? <XCircle style={{ ...icon14, color: 'var(--text-primary)' }} /> :
                       <AlertTriangle style={{ ...icon14, color: 'var(--text-tertiary)' }} />}
                      <div>
                        <Link
                          href={`/investors/${job.investor_id}`}
                          style={investorLinkStyle}>
                          {job.investor_name}</Link>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {job.results_count} fields &middot; {sources.length > 0 ? `${sources.length} sources` : 'all sources'}
                        </div></div></div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={labelMuted}>
                        {job.completed_at ? fmtDateTime(job.completed_at) : 'Running...'}</span>
                      {errors.length > 0 && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', marginTop: '2px' }}>
                          {errors.length} error{errors.length !== 1 ? 's' : ''}</div>
                      )}</div></div>
                </div>);})
          )}</div>
      )}
    </div>);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="card" style={{ padding: 'var(--space-3) var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
        <span style={{ color: accent || 'var(--text-muted)' }}>{icon}</span>
        <span style={labelMuted}>{label}</span></div>
      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: accent || 'var(--text-primary)' }}>
        {value}</div>
    </div>);
}

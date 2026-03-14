'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Database, Search, RefreshCw, Loader2, CheckCircle2, XCircle,
  ChevronDown, ChevronRight, ExternalLink, Shield, Globe, Building2,
  Users, Briefcase, FileSearch, Zap, BarChart3, Clock, AlertTriangle,
  Play, Settings, Layers,
} from 'lucide-react';
import { useToast } from '@/components/toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderInfo {
  id: string;
  name: string;
  type: 'free' | 'freemium' | 'paid';
  description: string;
  fields_provided: string[];
  requires_api_key: boolean;
  api_key_env?: string;
  configured: boolean;
}

interface InvestorOption {
  id: string;
  name: string;
  tier: number;
  status: string;
  type: string;
}

interface EnrichmentJobRow {
  id: string;
  investor_id: string;
  investor_name: string;
  sources: string;
  status: string;
  results_count: number;
  errors: string;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

interface EnrichmentStats {
  total_records: number;
  total_investors_enriched: number;
  total_jobs: number;
  records_by_source: { source_id: string; cnt: number }[];
  records_by_category: { category: string; cnt: number }[];
  avg_confidence: number;
  stale_count: number;
}

interface EnrichResult {
  job_id: string;
  status: string;
  total_fields: number;
  sources_succeeded: number;
  sources_failed: number;
  duration_ms: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_TYPE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  free: { bg: 'var(--success-muted)', color: 'var(--text-secondary)', border: 'rgba(27, 42, 74, 0.2)' },
  freemium: { bg: 'var(--accent-muted)', color: 'var(--accent)', border: 'rgba(27, 42, 74, 0.05)' },
  paid: { bg: 'var(--warning-muted)', color: 'var(--text-tertiary)', border: 'rgba(138, 136, 128, 0.2)' },
};

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
  relationships: Users,
};

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
  const [enriching, setEnriching] = useState<string | null>(null); // investor_id being enriched
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<EnrichResult | null>(null);
  const [tab, setTab] = useState<'enrich' | 'sources' | 'history'>('enrich');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [provRes, invRes, jobRes, statsRes] = await Promise.all([
      fetch('/api/enrichment?action=providers').then(r => r.json()).catch(() => []),
      fetch('/api/investors').then(r => r.json()).catch(() => []),
      fetch('/api/enrichment?action=jobs').then(r => r.json()).catch(() => []),
      fetch('/api/enrichment?action=stats').then(r => r.json()).catch(() => null),
    ]);
    setProviders(Array.isArray(provRes) ? provRes : []);
    const invList = Array.isArray(invRes) ? invRes : invRes?.investors || [];
    setInvestors(invList.filter((i: InvestorOption) => i.status !== 'passed' && i.status !== 'dropped'));
    setJobs(Array.isArray(jobRes) ? jobRes : []);
    setStats(statsRes);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enrichment failed');

      setLastResult(data);
      toast(`Enriched: ${data.total_fields} fields from ${data.sources_succeeded} sources`, 'success');
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Enrichment failed', 'error');
    } finally {
      setEnriching(null);
    }
  }

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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk enrichment failed');

      const totalFields = data.results?.reduce((s: number, r: { fields: number }) => s + r.fields, 0) || 0;
      toast(`Bulk enriched ${data.total} investors (${totalFields} total fields)`, 'success');
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bulk enrichment failed', 'error');
    } finally {
      setBulkEnriching(false);
    }
  }

  function toggleSource(id: string) {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
      </div>
    );
  }

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Data Enrichment</h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>
            {configuredCount} sources active ({freeCount} free) &middot; {investors.length} investors in pipeline
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            onClick={enrichBulk}
            disabled={bulkEnriching || investors.length === 0}
            className="btn btn-primary"
            style={{ opacity: bulkEnriching || investors.length === 0 ? 0.4 : 1 }}
          >
            {bulkEnriching ? <Loader2 style={{ width: '14px', height: '14px' }} className="animate-spin" /> : <Zap style={{ width: '14px', height: '14px' }} />}
            {bulkEnriching ? 'Enriching All...' : 'Enrich All Investors'}
          </button>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
          <StatCard label="Records" value={stats.total_records.toLocaleString()} icon={<Database style={{ width: '14px', height: '14px' }} />} />
          <StatCard label="Investors Enriched" value={String(stats.total_investors_enriched)} icon={<Users style={{ width: '14px', height: '14px' }} />} />
          <StatCard label="Jobs Run" value={String(stats.total_jobs)} icon={<RefreshCw style={{ width: '14px', height: '14px' }} />} />
          <StatCard label="Avg Confidence" value={`${(stats.avg_confidence * 100).toFixed(0)}%`} icon={<Shield style={{ width: '14px', height: '14px' }} />} />
          <StatCard label="Stale Records" value={String(stats.stale_count)} icon={<AlertTriangle style={{ width: '14px', height: '14px' }} />} accent={stats.stale_count > 0 ? 'var(--warning)' : undefined} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--border-default)' }}>
        {(['enrich', 'sources', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
              borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
              color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            }}
          >
            {t === 'enrich' && <Search style={{ width: '14px', height: '14px' }} />}
            {t === 'sources' && <Settings style={{ width: '14px', height: '14px' }} />}
            {t === 'history' && <Clock style={{ width: '14px', height: '14px' }} />}
            {t === 'enrich' ? 'Enrich' : t === 'sources' ? `Sources (${configuredCount}/${providers.length})` : `History (${jobs.length})`}
          </button>
        ))}
      </div>

      {/* Last Result Banner */}
      {lastResult && (
        <div className="card" style={{
          background: lastResult.status === 'completed' ? 'var(--success-muted)' : lastResult.status === 'partial' ? 'var(--warning-muted)' : 'var(--danger-muted)',
          border: `1px solid ${lastResult.status === 'completed' ? 'rgba(27, 42, 74, 0.06)' : lastResult.status === 'partial' ? 'rgba(26, 26, 46, 0.05)' : 'rgba(26, 26, 46, 0.06)'}`,
          padding: 'var(--space-3) var(--space-4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {lastResult.status === 'completed' ? <CheckCircle2 style={{ width: '16px', height: '16px', color: 'var(--text-secondary)' }} /> :
               lastResult.status === 'partial' ? <AlertTriangle style={{ width: '16px', height: '16px', color: 'var(--text-tertiary)' }} /> :
               <XCircle style={{ width: '16px', height: '16px', color: 'var(--text-primary)' }} />}
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 500 }}>
                {lastResult.total_fields} fields enriched from {lastResult.sources_succeeded} sources
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                ({lastResult.duration_ms}ms)
              </span>
            </div>
            <button onClick={() => setLastResult(null)} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>
              <XCircle style={{ width: '14px', height: '14px' }} />
            </button>
          </div>
          {lastResult.errors.length > 0 && (
            <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
              {lastResult.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
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
              <span style={{ textAlign: 'right' }}>Actions</span>
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {investors.length === 0 ? (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  No investors in pipeline. Add investors first.
                </div>
              ) : (
                investors.map(inv => (
                  <div
                    key={inv.id}
                    className="table-row"
                    style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 'var(--space-2)', alignItems: 'center', padding: 'var(--space-2) var(--space-4)' }}
                  >
                    <Link
                      href={`/investors/${inv.id}`}
                      style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 500, textDecoration: 'none' }}
                    >
                      {inv.name}
                    </Link>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{inv.type}</span>
                    <span className="tier-badge" data-tier={inv.tier} style={{ fontSize: 'var(--font-size-xs)' }}>T{inv.tier}</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{inv.status}</span>
                    <button
                      onClick={() => enrichSingle(inv.id)}
                      disabled={enriching === inv.id || bulkEnriching}
                      className="btn btn-sm"
                      style={{
                        background: 'var(--accent-muted)',
                        color: 'var(--accent)',
                        border: '1px solid rgba(27, 42, 74, 0.2)',
                        opacity: enriching === inv.id || bulkEnriching ? 0.4 : 1,
                        fontSize: 'var(--font-size-xs)',
                        padding: '4px 10px',
                      }}
                    >
                      {enriching === inv.id ? <Loader2 style={{ width: '12px', height: '12px' }} className="animate-spin" /> : <Play style={{ width: '12px', height: '12px' }} />}
                      {enriching === inv.id ? 'Enriching...' : 'Enrich'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
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
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => { e.stopPropagation(); toggleSource(provider.id); }}
                      style={{ accentColor: 'var(--accent)' }}
                      disabled={!provider.configured}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {provider.name}
                        </span>
                        <span style={{
                          fontSize: 'var(--font-size-xs)',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-sm)',
                          background: typeStyle.bg,
                          color: typeStyle.color,
                          border: `1px solid ${typeStyle.border}`,
                        }}>
                          {provider.type}
                        </span>
                        {provider.configured ? (
                          <CheckCircle2 style={{ width: '12px', height: '12px', color: 'var(--text-secondary)' }} />
                        ) : (
                          <XCircle style={{ width: '12px', height: '12px', color: 'var(--text-muted)' }} />
                        )}
                      </div>
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {provider.description.slice(0, 120)}{provider.description.length > 120 ? '...' : ''}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                      {provider.fields_provided.map(f => {
                        const Icon = CATEGORY_ICONS[f] || Globe;
                        return (
                          <span key={f} title={f} style={{ color: 'var(--text-muted)' }}>
                            <Icon style={{ width: '12px', height: '12px' }} />
                          </span>
                        );
                      })}
                    </div>
                    {isExpanded ? <ChevronDown style={{ width: '14px', height: '14px', color: 'var(--text-muted)' }} /> :
                      <ChevronRight style={{ width: '14px', height: '14px', color: 'var(--text-muted)' }} />}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{
                    padding: 'var(--space-3) var(--space-4)',
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--surface-1)',
                  }}>
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {provider.description}
                    </p>
                    <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Provides:</span>
                      {provider.fields_provided.map(f => (
                        <span key={f} style={{
                          fontSize: 'var(--font-size-xs)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface-2)',
                          color: 'var(--text-tertiary)',
                          border: '1px solid var(--border-subtle)',
                        }}>
                          {f}
                        </span>
                      ))}
                    </div>
                    {provider.requires_api_key && !provider.configured && (
                      <div style={{
                        marginTop: 'var(--space-3)',
                        padding: 'var(--space-2) var(--space-3)',
                        background: 'var(--warning-muted)',
                        border: '1px solid rgba(26, 26, 46, 0.05)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-tertiary)',
                      }}>
                        Requires API key: set <code style={{ background: 'var(--surface-3)', padding: '0 4px', borderRadius: '3px' }}>{provider.api_key_env}</code> in your environment
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {jobs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-muted)' }}>
              <Database style={{ width: '32px', height: '32px', margin: '0 auto var(--space-3)' }} />
              <p style={{ fontSize: 'var(--font-size-sm)' }}>No enrichment data yet. Select an investor above and click Enrich to gather background intelligence from 9 sources.</p>
            </div>
          ) : (
            jobs.map(job => {
              let sources: string[] = [];
              let errors: string[] = [];
              try { sources = JSON.parse(job.sources || '[]'); } catch { /* use default */ }
              try { errors = JSON.parse(job.errors || '[]'); } catch { /* use default */ }
              return (
                <div key={job.id} className="card" style={{ padding: 'var(--space-3) var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      {job.status === 'completed' ? <CheckCircle2 style={{ width: '14px', height: '14px', color: 'var(--text-secondary)' }} /> :
                       job.status === 'running' ? <Loader2 style={{ width: '14px', height: '14px', color: 'var(--accent)' }} className="animate-spin" /> :
                       job.status === 'failed' ? <XCircle style={{ width: '14px', height: '14px', color: 'var(--text-primary)' }} /> :
                       <AlertTriangle style={{ width: '14px', height: '14px', color: 'var(--text-tertiary)' }} />}
                      <div>
                        <Link
                          href={`/investors/${job.investor_id}`}
                          style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 500, textDecoration: 'none' }}
                        >
                          {job.investor_name}
                        </Link>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {job.results_count} fields &middot; {sources.length > 0 ? `${sources.length} sources` : 'all sources'}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {job.completed_at ? new Date(job.completed_at).toLocaleString() : 'Running...'}
                      </span>
                      {errors.length > 0 && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', marginTop: '2px' }}>
                          {errors.length} error{errors.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: string }) {
  return (
    <div className="card" style={{ padding: 'var(--space-3) var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
        <span style={{ color: accent || 'var(--text-muted)' }}>{icon}</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: accent || 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

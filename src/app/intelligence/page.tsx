'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Globe, TrendingUp, Shield, Search, Plus, Trash2, RefreshCw,
  Building2, DollarSign, Target, ChevronDown, ChevronRight, Loader2, BookOpen,
  Users, Radar, BarChart3
} from 'lucide-react';
import type { MarketDeal, Competitor, IntelligenceBrief } from '@/lib/types';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import Link from 'next/link';
import { stAccent, stBorderTop, stSurface1, stSurface2, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary } from '@/lib/styles';

type Tab = 'deals' | 'competitors' | 'briefs';

const THREAT_STYLES: Record<string, { background: string; color: string }> = {
  critical: { background: 'var(--danger-muted)', color: 'var(--text-primary)' },
  high: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  medium: { background: 'var(--warn-8)', color: 'var(--text-tertiary)' },
  low: { background: 'var(--success-muted)', color: 'var(--text-secondary)' },
};

const BRIEF_TYPE_STYLES: Record<string, { background: string; color: string }> = {
  investor: { background: 'var(--accent-muted)', color: 'var(--accent)' },
  competitor: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  market: { background: 'var(--cat-12)', color: 'var(--chart-4)' },
};

export default function IntelligencePage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('deals');
  const [deals, setDeals] = useState<MarketDeal[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [briefs, setBriefs] = useState<IntelligenceBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [showAddComp, setShowAddComp] = useState(false);
  const [expandedBrief, setExpandedBrief] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);
  const [researchInput, setResearchInput] = useState('');
  const [researchType, setResearchType] = useState<'investor' | 'competitor' | 'market'>('investor');
  const [hoveredDealRow, setHoveredDealRow] = useState<string | null>(null);
  const [hoveredDeleteBtn, setHoveredDeleteBtn] = useState<string | null>(null);
  const [hoveredCompCard, setHoveredCompCard] = useState<string | null>(null);
  const [hoveredBriefRow, setHoveredBriefRow] = useState<string | null>(null);
  const [hoveredResearchBtn, setHoveredResearchBtn] = useState(false);
  const [hoveredAddBtn, setHoveredAddBtn] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/intelligence?type=all');
      const data = await res.json();
      setDeals(data.deals || []);
      setCompetitors(data.competitors || []);
      setBriefs(data.briefs || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleResearch() {
    if (!researchInput.trim()) return;
    setResearching(true);
    try {
      const res = await fetch('/api/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: researchType === 'investor' ? 'research_investor' :
                  researchType === 'competitor' ? 'research_competitor' : 'research_market',
          name: researchInput.trim(),
          sector: researchInput.trim(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast(`Research complete: ${researchInput}`, 'success');
      setResearchInput('');
      fetchAll();
      setTab('briefs');
    } catch (err) {
      toast(`Research failed: ${err}`, 'error');
    }
    setResearching(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/intelligence?type=${deleteTarget.type}&id=${deleteTarget.id}`, { method: 'DELETE' });
    toast(`Deleted ${deleteTarget.name}`, 'warning');
    setDeleteTarget(null);
    fetchAll();
  }

  async function handleAddDeal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    fd.forEach((v, k) => { data[k] = v as string; });
    await fetch('/api/intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_deal', data }),
    });
    toast('Deal added');
    setShowAddDeal(false);
    fetchAll();
  }

  async function handleAddCompetitor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    fd.forEach((v, k) => { data[k] = v as string; });
    await fetch('/api/intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_competitor', data }),
    });
    toast('Competitor added');
    setShowAddComp(false);
    fetchAll();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 skeleton" style={stSurface2} />
        <div className="h-20 skeleton rounded-xl" style={{ background: 'var(--surface-2)', opacity: 0.5 }} />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 skeleton rounded" style={{ background: 'var(--surface-2)', opacity: 0.3 }} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 page-content">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Globe className="w-6 h-6" style={stAccent} /> Market Intelligence
        </h1>
        <p className="text-sm mt-1" style={stTextMuted}>
          {deals.length} deals tracked, {competitors.length} competitors, {briefs.length} research briefs
        </p>
      </div>

      {/* AI Research Bar */}
      <div
        className="rounded-xl p-4"
        style={stSurface1}>
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-4 h-4" style={stAccent} />
          <span className="text-xs font-normal" style={stTextTertiary}>AI Research</span>
        </div>
        <div className="flex gap-2">
          <select
            value={researchType}
            onChange={e => setResearchType(e.target.value as 'investor' | 'competitor' | 'market')}
            className="input"
            style={{ width: 'auto', padding: '0.5rem 0.75rem' }}>
            <option value="investor">Research Investor</option>
            <option value="competitor">Research Competitor</option>
            <option value="market">Research Market Deals</option>
          </select>
          <input
            value={researchInput}
            onChange={e => setResearchInput(e.target.value)}
            placeholder={
              researchType === 'investor' ? 'e.g. Andreessen Horowitz, General Catalyst...' :
              researchType === 'competitor' ? 'e.g. ICEYE, Rocket Lab, Planet Labs...' :
              'e.g. Space/Defense, Satellite, Deep Tech...'
            }
            className="input flex-1"
            onKeyDown={e => { if (e.key === 'Enter') handleResearch(); }} />
          <button
            onClick={handleResearch}
            disabled={researching || !researchInput.trim()}
            onMouseEnter={() => setHoveredResearchBtn(true)}
            onMouseLeave={() => setHoveredResearchBtn(false)}
            className="px-4 py-2 rounded-lg text-sm font-normal flex items-center gap-2 transition-colors"
            style={{
              background: researching || !researchInput.trim()
                ? 'var(--surface-3)'
                : hoveredResearchBtn ? 'var(--accent-hover)' : 'var(--accent)',
              color: researching || !researchInput.trim()
                ? 'var(--text-muted)'
                : 'white',
              transition: 'all 150ms ease', }}
>
            {researching ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Researching...</> : <><RefreshCw className="w-3.5 h-3.5" /> Research</>}
          </button>
        </div>
        <p className="text-xs mt-2" style={stTextMuted}>
          AI will generate a comprehensive research dossier and auto-populate relevant data tables.
        </p>
      </div>

      {/* Recent Research Section */}
      <RecentResearchSection briefs={briefs} />

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border-default)' }}>
        {([
          { key: 'deals' as Tab, label: 'Market Deals', icon: DollarSign, count: deals.length },
          { key: 'competitors' as Tab, label: 'Competitors', icon: Shield, count: competitors.length },
          { key: 'briefs' as Tab, label: 'Research Briefs', icon: BookOpen, count: briefs.length },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm font-normal flex items-center gap-2"
            style={{
              borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`,
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'color 150ms ease', }}
>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'deals' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddDeal(!showAddDeal)}
              onMouseEnter={() => setHoveredAddBtn(true)}
              onMouseLeave={() => setHoveredAddBtn(false)}
              className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
              style={{
                background: hoveredAddBtn ? 'var(--surface-3)' : 'var(--surface-2)',
                transition: 'background 150ms ease', }}
>
              <Plus className="w-3.5 h-3.5" /> Add Deal
            </button>
          </div>

          {showAddDeal && (
            <form
              onSubmit={handleAddDeal}
              className="rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField name="company" label="Company" required />
                <FormField name="round" label="Round" placeholder="Series C" />
                <FormField name="amount" label="Amount" placeholder="$250M" />
                <FormField name="valuation" label="Valuation" placeholder="$2Bn" />
                <FormField name="lead_investors" label="Lead Investor(s)" />
                <FormField name="date" label="Date" placeholder="2026-03" />
                <FormField name="sector" label="Sector" placeholder="Space/Defense" />
                <FormField name="equity_story" label="Equity Story" />
                <FormField name="source" label="Source" placeholder="TechCrunch, PitchBook..." />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm">Add</button>
                <button type="button" onClick={() => setShowAddDeal(false)} className="btn btn-secondary btn-sm">Cancel</button>
              </div>
            </form>
          )}

          {deals.length === 0 ? (
            <EmptyState message="No market deals tracked yet. Add manually or use AI Research to scan the market." />
          ) : (
            <div className="rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="table-header">
                  <tr>
                    <th>Company</th>
                    <th>Round</th>
                    <th>Amount</th>
                    <th>Valuation</th>
                    <th>Lead</th>
                    <th>Date</th>
                    <th>Sector</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map(d => (
                    <tr
                      key={d.id}
                      className="table-row transition-colors"
                      style={{ background: hoveredDealRow === d.id ? 'var(--surface-1)' : 'transparent' }}
                      onMouseEnter={() => setHoveredDealRow(d.id)}
                      onMouseLeave={() => setHoveredDealRow(null)}>
                      <td style={{ fontWeight: 400, color: 'var(--text-primary)' }}>{d.company}</td>
                      <td style={stTextTertiary}>{d.round}</td>
                      <td style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{d.amount}</td>
                      <td style={stAccent}>{d.valuation}</td>
                      <td className="max-w-40 truncate" style={stTextTertiary}>{d.lead_investors}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>{d.date}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>{d.sector}</td>
                      <td>
                        <button
                          onClick={() => setDeleteTarget({ type: 'deal', id: d.id, name: d.company })}
                          onMouseEnter={() => setHoveredDeleteBtn(`deal-${d.id}`)}
                          onMouseLeave={() => setHoveredDeleteBtn(null)}
                          className="transition-colors"
                          style={{
                            color: hoveredDeleteBtn === `deal-${d.id}` ? 'var(--danger)' : 'var(--text-muted)',
                            transition: 'color 150ms ease', }}
>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'competitors' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddComp(!showAddComp)}
              onMouseEnter={() => setHoveredAddBtn(true)}
              onMouseLeave={() => setHoveredAddBtn(false)}
              className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
              style={{
                background: hoveredAddBtn ? 'var(--surface-3)' : 'var(--surface-2)',
                transition: 'background 150ms ease', }}
>
              <Plus className="w-3.5 h-3.5" /> Add Competitor
            </button>
          </div>

          {showAddComp && (
            <form
              onSubmit={handleAddCompetitor}
              className="rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FormField name="name" label="Company Name" required />
                <FormField name="sector" label="Sector" />
                <FormField name="hq" label="HQ" />
                <FormField name="last_round" label="Last Round" />
                <FormField name="last_valuation" label="Last Valuation" />
                <FormField name="total_raised" label="Total Raised" />
                <FormField name="revenue" label="Revenue" />
                <FormField name="employees" label="Employees" />
                <FormField name="key_investors" label="Key Investors" />
              </div>
              <FormField name="positioning" label="Positioning" />
              <FormField name="our_advantage" label="Our Advantage" />
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm">Add</button>
                <button type="button" onClick={() => setShowAddComp(false)} className="btn btn-secondary btn-sm">Cancel</button>
              </div>
            </form>
          )}

          {competitors.length === 0 ? (
            <EmptyState message="No competitors tracked yet. Add manually or use AI Research." />
          ) : (
            <div className="space-y-3">
              {competitors.map(c => {
                const threatStyle = THREAT_STYLES[c.threat_level || 'low'] || THREAT_STYLES.low;
                return (
                  <div
                    key={c.id}
                    className="card transition-colors"
                    style={{
                      borderColor: hoveredCompCard === c.id ? 'var(--border-strong)' : undefined,
                      transition: 'border-color 150ms ease', }}
                    onMouseEnter={() => setHoveredCompCard(c.id)}
                    onMouseLeave={() => setHoveredCompCard(null)}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5" style={stTextMuted} />
                        <div>
                          <h3 className="font-normal" style={stTextPrimary}>{c.name}</h3>
                          <div className="flex gap-2 mt-1">
                            <span className="text-xs" style={stTextMuted}>{c.sector}</span>
                            {c.hq && <span className="text-xs" style={stTextMuted}>{c.hq}</span>}
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{ background: threatStyle.background, color: threatStyle.color }}>
                              {c.threat_level}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setDeleteTarget({ type: 'competitor', id: c.id, name: c.name })}
                        onMouseEnter={() => setHoveredDeleteBtn(`comp-${c.id}`)}
                        onMouseLeave={() => setHoveredDeleteBtn(null)}
                        className="transition-colors"
                        style={{
                          color: hoveredDeleteBtn === `comp-${c.id}` ? 'var(--danger)' : 'var(--text-muted)',
                          transition: 'color 150ms ease', }}
>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
                      {c.revenue && <div><span style={stTextMuted}>Revenue:</span> <span style={stTextSecondary}>{c.revenue}</span></div>}
                      {c.last_valuation && <div><span style={stTextMuted}>Valuation:</span> <span style={stAccent}>{c.last_valuation}</span></div>}
                      {c.total_raised && <div><span style={stTextMuted}>Raised:</span> <span style={stTextSecondary}>{c.total_raised}</span></div>}
                      {c.employees && <div><span style={stTextMuted}>Employees:</span> <span style={stTextSecondary}>{c.employees}</span></div>}
                    </div>
                    {c.positioning && <p className="text-xs mt-2 line-clamp-2" style={stTextMuted}>{c.positioning}</p>}
                    {c.our_advantage && (
                      <div className="mt-2 text-xs">
                        <span className="font-normal" style={stTextSecondary}>Our advantage:</span>
                        <span className="ml-1" style={stTextTertiary}>{c.our_advantage}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'briefs' && (
        <div className="space-y-3">
          {briefs.length === 0 ? (
            <EmptyState message="No research briefs yet. Use the AI Research bar above to generate intelligence." />
          ) : (
            briefs.map(b => {
              const briefStyle = BRIEF_TYPE_STYLES[b.brief_type] || { background: 'var(--surface-2)', color: 'var(--text-tertiary)' };
              return (
                <div key={b.id} className="rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedBrief(expandedBrief === b.id ? null : b.id)}
                    className="w-full flex items-center justify-between px-4 py-3"
                    style={{
                      background: hoveredBriefRow === b.id ? 'var(--surface-1)' : 'transparent',
                      transition: 'background 150ms ease', }}
                    onMouseEnter={() => setHoveredBriefRow(b.id)}
                    onMouseLeave={() => setHoveredBriefRow(null)}>
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded font-normal"
                        style={{ background: briefStyle.background, color: briefStyle.color }}>
                        {b.brief_type}
                      </span>
                      <span className="font-normal text-sm" style={stTextPrimary}>{b.subject}</span>
                      <span className="text-xs" style={stTextMuted}>{b.updated_at?.split('T')[0]}</span>
                      {b.investor_id && (
                        <span className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <Link
                            href={`/investors/${b.investor_id}`}
                            style={{ color: 'var(--accent)', fontSize: 'var(--font-size-xs)', textDecoration: 'none' }}>
                            View
                          </Link>
                          <Link
                            href={`/meetings/new?investor=${b.investor_id}`}
                            style={{
                              fontSize: '10px', fontWeight: 400, padding: '2px 6px',
                              borderRadius: 'var(--radius-sm)', textDecoration: 'none',
                              background: 'var(--accent-muted)', color: 'var(--accent)', }}
>
                            Schedule
                          </Link>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'brief', id: b.id, name: b.subject }); }}
                        onMouseEnter={() => setHoveredDeleteBtn(`brief-${b.id}`)}
                        onMouseLeave={() => setHoveredDeleteBtn(null)}
                        className="p-1 transition-colors"
                        style={{
                          color: hoveredDeleteBtn === `brief-${b.id}` ? 'var(--danger)' : 'var(--text-muted)',
                          transition: 'color 150ms ease', }}
>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {expandedBrief === b.id
                        ? <ChevronDown className="w-4 h-4" style={stTextMuted} />
                        : <ChevronRight className="w-4 h-4" style={stTextMuted} />
                      }
                    </div>
                  </button>
                  {expandedBrief === b.id && (
                    <div className="px-4 pb-4" style={stBorderTop}>
                      <div
                        className="prose prose-invert prose-sm max-w-none mt-3 whitespace-pre-wrap text-sm leading-relaxed"
                        style={stTextSecondary}>
                        {b.content}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 card-stagger">
        <StatCard icon={TrendingUp} label="Avg. Round Size" value={avgRoundSize(deals)} />
        <StatCard icon={DollarSign} label="Avg. Valuation" value={avgValuation(deals)} />
        <StatCard icon={Shield} label="High Threats" value={competitors.filter(c => c.threat_level === 'high' || c.threat_level === 'critical').length}
          />
        <StatCard icon={Target} label="Sector Coverage" value={new Set(deals.map(d => d.sector).filter(Boolean)).size + ' sectors'}
          />
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.type}`}
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

const RECENT_BRIEF_ICONS: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  investor: Users,
  competitor: Shield,
  market: BarChart3,
  company: Building2,
  deal: DollarSign,
};

function RecentResearchSection({ briefs }: { briefs: IntelligenceBrief[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const recentBriefs = briefs.slice(0, 10);

  if (recentBriefs.length === 0) return null;

  return (
    <div
      className="rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-default)' }}>
        <Radar className="w-4 h-4" style={stAccent} />
        <h2 className="text-xs font-normal  tracking-wider" style={stTextTertiary}>
          Recent Research
        </h2>
        <span
          className="text-xs px-1.5 py-0.5 rounded ml-1"
          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
          {recentBriefs.length}
        </span>
      </div>
      <div>
        {recentBriefs.map(brief => {
          const Icon = RECENT_BRIEF_ICONS[brief.brief_type] || Globe;
          const briefTypeStyle = BRIEF_TYPE_STYLES[brief.brief_type] || { background: 'var(--surface-2)', color: 'var(--text-tertiary)' };
          const isExpanded = expandedId === brief.id;
          const snippet = brief.content.length > 120 ? brief.content.slice(0, 120) + '...' : brief.content;

          return (
            <div key={brief.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : brief.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                style={{
                  background: hoveredId === brief.id ? 'var(--surface-1)' : 'transparent',
                  transition: 'background 150ms ease', }}
                onMouseEnter={() => setHoveredId(brief.id)}
                onMouseLeave={() => setHoveredId(null)}>
                <span style={{ color: briefTypeStyle.color }}>
                  <Icon className="w-4 h-4" />
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded font-normal shrink-0"
                  style={{ background: briefTypeStyle.background, color: briefTypeStyle.color }}>
                  {brief.brief_type}
                </span>
                <span className="text-sm font-normal truncate" style={stTextPrimary}>
                  {brief.subject}
                </span>
                <span className="text-xs shrink-0 ml-auto" style={stTextMuted}>
                  {brief.updated_at ? brief.updated_at.split('T')[0] : ''}
                </span>
                {!isExpanded && (
                  <span className="text-xs truncate max-w-xs hidden md:inline" style={stTextMuted}>
                    {snippet}
                  </span>
                )}
                <span style={stTextMuted}>
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5" />
                    : <ChevronRight className="w-3.5 h-3.5" />
                  }
                </span>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 pt-1" style={stBorderTop}>
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={stTextSecondary}>
                    {brief.content}
                  </div>
                  {brief.investor_id && (
                    <div className="mt-2 flex items-center gap-3">
                      <Link
                        href={`/investors/${brief.investor_id}`}
                        className="text-xs flex items-center gap-1"
                        style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                        View Profile
                      </Link>
                      <Link
                        href={`/meetings/new?investor=${brief.investor_id}`}
                        className="text-xs flex items-center gap-1"
                        style={{
                          padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--accent-muted)', color: 'var(--accent)',
                          textDecoration: 'none',
                          fontWeight: 400, }}
>
                        Schedule Meeting
                      </Link>
                      <Link
                        href={`/followups?investor=${brief.investor_id}`}
                        className="text-xs flex items-center gap-1"
                        style={{
                          padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface-2)', color: 'var(--text-secondary)',
                          textDecoration: 'none',
                          fontWeight: 400, }}
>
                        Follow-up
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormField({ name, label, placeholder, required }: { name: string; label: string; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-xs block mb-1" style={stTextMuted}>{label}</label>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        className="input" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl p-8 text-center"
      style={{ border: '1px dashed var(--border-default)' }}>
      <Globe className="w-8 h-8 mx-auto mb-2" style={stTextMuted} />
      <p className="text-sm" style={stTextMuted}>{message}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value: string | number }) {
  return (
    <div className="card-metric">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5" style={stTextMuted} />
        <span className="metric-label">{label}</span>
      </div>
      <div className="metric-value" style={{ marginTop: '2px' }}>{value}</div>
    </div>
  );
}

function avgRoundSize(deals: MarketDeal[]): string {
  const amounts = deals.map(d => {
    const m = d.amount.match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  }).filter(n => n > 0);
  if (amounts.length === 0) return '—';
  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  return `$${Math.round(avg)}M`;
}

function avgValuation(deals: MarketDeal[]): string {
  const vals = deals.map(d => {
    const m = d.valuation.match(/[\d.]+/);
    if (!m) return 0;
    const n = parseFloat(m[0]);
    return d.valuation.toLowerCase().includes('b') ? n * 1000 : n;
  }).filter(n => n > 0);
  if (vals.length === 0) return '—';
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return avg >= 1000 ? `$${(avg / 1000).toFixed(1)}Bn` : `$${Math.round(avg)}M`;
}

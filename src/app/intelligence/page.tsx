'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Globe, TrendingUp, Shield, Search, Plus, Trash2, RefreshCw,
  Building2, DollarSign, Target, ChevronDown, ChevronRight, Loader2, BookOpen
} from 'lucide-react';
import type { MarketDeal, Competitor, IntelligenceBrief } from '@/lib/types';
import { useToast } from '@/components/toast';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import Link from 'next/link';

type Tab = 'deals' | 'competitors' | 'briefs';

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
        <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse" />
        <div className="h-20 bg-zinc-800/50 rounded-xl animate-pulse" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-zinc-800/30 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Globe className="w-6 h-6 text-blue-400" /> Market Intelligence
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          {deals.length} deals tracked, {competitors.length} competitors, {briefs.length} research briefs
        </p>
      </div>

      {/* AI Research Bar */}
      <div className="border border-zinc-800 rounded-xl p-4 bg-zinc-900/50">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-medium text-zinc-400">AI RESEARCH</span>
        </div>
        <div className="flex gap-2">
          <select
            value={researchType}
            onChange={e => setResearchType(e.target.value as 'investor' | 'competitor' | 'market')}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
          >
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
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-600"
            onKeyDown={e => { if (e.key === 'Enter') handleResearch(); }}
          />
          <button
            onClick={handleResearch}
            disabled={researching || !researchInput.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {researching ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Researching...</> : <><RefreshCw className="w-3.5 h-3.5" /> Research</>}
          </button>
        </div>
        <p className="text-xs text-zinc-600 mt-2">
          AI will generate a comprehensive research dossier and auto-populate relevant data tables.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {([
          { key: 'deals' as Tab, label: 'Market Deals', icon: DollarSign, count: deals.length },
          { key: 'competitors' as Tab, label: 'Competitors', icon: Shield, count: competitors.length },
          { key: 'briefs' as Tab, label: 'Research Briefs', icon: BookOpen, count: briefs.length },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              tab === t.key ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'deals' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddDeal(!showAddDeal)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Deal
            </button>
          </div>

          {showAddDeal && (
            <form onSubmit={handleAddDeal} className="border border-zinc-800 rounded-xl p-4 space-y-3">
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
                <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm">Add</button>
                <button type="button" onClick={() => setShowAddDeal(false)} className="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          )}

          {deals.length === 0 ? (
            <EmptyState message="No market deals tracked yet. Add manually or use AI Research to scan the market." />
          ) : (
            <div className="border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/50 border-b border-zinc-800">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Company</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Round</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Amount</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Valuation</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Lead</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Sector</th>
                    <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {deals.map(d => (
                    <tr key={d.id} className="hover:bg-zinc-900/30">
                      <td className="px-4 py-2.5 font-medium">{d.company}</td>
                      <td className="px-4 py-2.5 text-zinc-400">{d.round}</td>
                      <td className="px-4 py-2.5 text-emerald-400 font-medium">{d.amount}</td>
                      <td className="px-4 py-2.5 text-blue-400">{d.valuation}</td>
                      <td className="px-4 py-2.5 text-zinc-400 max-w-40 truncate">{d.lead_investors}</td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs">{d.date}</td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs">{d.sector}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => setDeleteTarget({ type: 'deal', id: d.id, name: d.company })} className="text-zinc-600 hover:text-red-400">
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
            <button onClick={() => setShowAddComp(!showAddComp)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Competitor
            </button>
          </div>

          {showAddComp && (
            <form onSubmit={handleAddCompetitor} className="border border-zinc-800 rounded-xl p-4 space-y-3">
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
                <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm">Add</button>
                <button type="button" onClick={() => setShowAddComp(false)} className="px-3 py-1.5 bg-zinc-800 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          )}

          {competitors.length === 0 ? (
            <EmptyState message="No competitors tracked yet. Add manually or use AI Research." />
          ) : (
            <div className="space-y-3">
              {competitors.map(c => (
                <div key={c.id} className="border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-zinc-500" />
                      <div>
                        <h3 className="font-medium">{c.name}</h3>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs text-zinc-500">{c.sector}</span>
                          {c.hq && <span className="text-xs text-zinc-600">{c.hq}</span>}
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            c.threat_level === 'critical' ? 'bg-red-900/30 text-red-400' :
                            c.threat_level === 'high' ? 'bg-orange-900/30 text-orange-400' :
                            c.threat_level === 'medium' ? 'bg-yellow-900/30 text-yellow-400' :
                            'bg-green-900/30 text-green-400'
                          }`}>{c.threat_level}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setDeleteTarget({ type: 'competitor', id: c.id, name: c.name })} className="text-zinc-600 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
                    {c.revenue && <div><span className="text-zinc-500">Revenue:</span> <span className="text-zinc-300">{c.revenue}</span></div>}
                    {c.last_valuation && <div><span className="text-zinc-500">Valuation:</span> <span className="text-blue-400">{c.last_valuation}</span></div>}
                    {c.total_raised && <div><span className="text-zinc-500">Raised:</span> <span className="text-zinc-300">{c.total_raised}</span></div>}
                    {c.employees && <div><span className="text-zinc-500">Employees:</span> <span className="text-zinc-300">{c.employees}</span></div>}
                  </div>
                  {c.positioning && <p className="text-xs text-zinc-500 mt-2 line-clamp-2">{c.positioning}</p>}
                  {c.our_advantage && (
                    <div className="mt-2 text-xs">
                      <span className="text-emerald-500 font-medium">Our advantage:</span>
                      <span className="text-zinc-400 ml-1">{c.our_advantage}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'briefs' && (
        <div className="space-y-3">
          {briefs.length === 0 ? (
            <EmptyState message="No research briefs yet. Use the AI Research bar above to generate intelligence." />
          ) : (
            briefs.map(b => (
              <div key={b.id} className="border border-zinc-800 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedBrief(expandedBrief === b.id ? null : b.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-900/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      b.brief_type === 'investor' ? 'bg-blue-900/30 text-blue-400' :
                      b.brief_type === 'competitor' ? 'bg-orange-900/30 text-orange-400' :
                      b.brief_type === 'market' ? 'bg-purple-900/30 text-purple-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>{b.brief_type}</span>
                    <span className="font-medium text-sm">{b.subject}</span>
                    <span className="text-xs text-zinc-600">{b.updated_at?.split('T')[0]}</span>
                    {b.investor_id && (
                      <Link href={`/investors/${b.investor_id}`} className="text-xs text-blue-400 hover:text-blue-300" onClick={e => e.stopPropagation()}>
                        View Investor
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'brief', id: b.id, name: b.subject }); }} className="text-zinc-600 hover:text-red-400 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {expandedBrief === b.id ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                  </div>
                </button>
                {expandedBrief === b.id && (
                  <div className="px-4 pb-4 border-t border-zinc-800/50">
                    <div className="prose prose-invert prose-sm max-w-none mt-3 text-zinc-300 whitespace-pre-wrap text-sm leading-relaxed">
                      {b.content}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Avg. Round Size" value={avgRoundSize(deals)} />
        <StatCard icon={DollarSign} label="Avg. Valuation" value={avgValuation(deals)} />
        <StatCard icon={Shield} label="High Threats" value={competitors.filter(c => c.threat_level === 'high' || c.threat_level === 'critical').length} />
        <StatCard icon={Target} label="Sector Coverage" value={new Set(deals.map(d => d.sector).filter(Boolean)).size + ' sectors'} />
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.type}`}
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function FormField({ name, label, placeholder, required }: { name: string; label: string; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="text-xs text-zinc-500 block mb-1">{label}</label>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600 text-zinc-200"
      />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-zinc-800 rounded-xl p-8 text-center">
      <Globe className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
      <p className="text-sm text-zinc-600">{message}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="border border-zinc-800 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function avgRoundSize(deals: MarketDeal[]): string {
  const amounts = deals.map(d => {
    const m = d.amount.match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  }).filter(n => n > 0);
  if (amounts.length === 0) return '---';
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
  if (vals.length === 0) return '---';
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return avg >= 1000 ? `$${(avg / 1000).toFixed(1)}Bn` : `$${Math.round(avg)}M`;
}

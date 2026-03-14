'use client';

import { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/components/toast';
import type { Investor, Meeting, InvestorPartner, InvestorPortfolioCo, InvestorType } from '@/lib/types';
import { ChevronDown, X, Trophy, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const TYPE_LABELS: Record<InvestorType, string> = {
  vc: 'VC', growth: 'Growth', sovereign: 'Sovereign', strategic: 'Strategic',
  debt: 'Debt', family_office: 'Family Office',
};

const STATUS_LABELS: Record<string, string> = {
  identified: 'Identified', contacted: 'Contacted', nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Set', met: 'Met', engaged: 'Engaged',
  in_dd: 'In DD', term_sheet: 'Term Sheet', closed: 'Closed',
  passed: 'Passed', dropped: 'Dropped',
};

interface InvestorData {
  investor: Investor;
  meetings: Meeting[];
  partners: InvestorPartner[];
  portfolio: InvestorPortfolioCo[];
}

export default function ComparePage() {
  const { toast } = useToast();
  const [allInvestors, setAllInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [investorData, setInvestorData] = useState<Map<string, InvestorData>>(new Map());
  const [loadingData, setLoadingData] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch all investors on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/investors');
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        setAllInvestors(data);
      } catch {
        toast('Failed to load investors', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Fetch detailed data when selection changes
  useEffect(() => {
    async function fetchDetails() {
      const newIds = selectedIds.filter(id => !investorData.has(id));
      if (newIds.length === 0) return;

      setLoadingData(true);
      const newData = new Map(investorData);

      await Promise.all(newIds.map(async (id) => {
        try {
          const [meetingsRes, partnersRes, portfolioRes] = await Promise.all([
            fetch(`/api/meetings?investor_id=${id}`),
            fetch(`/api/intelligence?type=partners&investor_id=${id}`),
            fetch(`/api/intelligence?type=portfolio&investor_id=${id}`),
          ]);

          const investor = allInvestors.find(i => i.id === id)!;
          const meetings = await meetingsRes.json();
          const partners = await partnersRes.json();
          const portfolio = await portfolioRes.json();

          newData.set(id, { investor, meetings, partners, portfolio });
        } catch {
          // If intelligence endpoints fail (e.g. no data), use empty arrays
          const investor = allInvestors.find(i => i.id === id)!;
          newData.set(id, { investor, meetings: [], partners: [], portfolio: [] });
        }
      }));

      setInvestorData(newData);
      setLoadingData(false);
    }

    if (selectedIds.length > 0 && allInvestors.length > 0) {
      fetchDetails();
    }
  }, [selectedIds, allInvestors]);

  function toggleInvestor(id: string) {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 5) {
        toast('Maximum 5 investors for comparison', 'warning');
        return prev;
      }
      return [...prev, id];
    });
  }

  function removeInvestor(id: string) {
    setSelectedIds(prev => prev.filter(x => x !== id));
  }

  // Get the ordered data for selected investors
  const selected = useMemo(() => {
    return selectedIds
      .map(id => investorData.get(id))
      .filter((d): d is InvestorData => !!d);
  }, [selectedIds, investorData]);

  // Compute recommendation
  const recommendationId = useMemo(() => {
    if (selected.length < 2) return null;

    let bestId: string | null = null;
    let bestScore = -Infinity;

    for (const d of selected) {
      const inv = d.investor;
      // Score: higher tier = better (invert: tier 1 = 4 pts, tier 4 = 1 pt)
      const tierScore = (5 - inv.tier) * 3;
      // Enthusiasm: direct 1-5
      const enthScore = (inv.enthusiasm || 0) * 2;
      // Speed: fast=3, medium=2, slow=1
      const speedScore = inv.speed === 'fast' ? 3 : inv.speed === 'medium' ? 2 : 1;
      // Fewer conflicts = better
      const conflictPenalty = inv.portfolio_conflicts?.trim()
        ? (inv.portfolio_conflicts.toLowerCase() === 'none' ? 0 : -2)
        : 0;

      const total = tierScore + enthScore + speedScore + conflictPenalty;
      if (total > bestScore) {
        bestScore = total;
        bestId = inv.id;
      }
    }

    return bestId;
  }, [selected]);

  const filteredInvestors = allInvestors.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse" />
        <div className="h-12 w-full bg-zinc-800/50 rounded animate-pulse" />
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 bg-zinc-800/30 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/investors" className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Compare Investors</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Select 2-5 investors to compare side-by-side
          </p>
        </div>
      </div>

      {/* Multi-select dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full md:w-96 flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm text-zinc-300 hover:border-zinc-700 transition-colors"
        >
          <span className={selectedIds.length === 0 ? 'text-zinc-600' : ''}>
            {selectedIds.length === 0
              ? 'Select investors to compare...'
              : `${selectedIds.length} investor${selectedIds.length > 1 ? 's' : ''} selected`}
          </span>
          <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
            <div className="absolute z-20 mt-1 w-full md:w-96 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl max-h-72 overflow-hidden">
              <div className="p-2 border-b border-zinc-800">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search investors..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-600"
                  autoFocus
                />
              </div>
              <div className="overflow-y-auto max-h-56">
                {filteredInvestors.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-zinc-600">No investors found</div>
                ) : (
                  filteredInvestors.map(inv => {
                    const isSelected = selectedIds.includes(inv.id);
                    const disabled = !isSelected && selectedIds.length >= 5;
                    return (
                      <button
                        key={inv.id}
                        onClick={() => { if (!disabled) toggleInvestor(inv.id); }}
                        disabled={disabled}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-600/10 text-blue-400'
                            : disabled
                            ? 'text-zinc-700 cursor-not-allowed'
                            : 'text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-blue-600 border-blue-600' : 'border-zinc-700'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="flex-1">{inv.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          inv.tier === 1 ? 'bg-blue-600/20 text-blue-400' :
                          inv.tier === 2 ? 'bg-purple-600/20 text-purple-400' :
                          'bg-zinc-600/20 text-zinc-500'
                        }`}>T{inv.tier}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        {/* Selected pills */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedIds.map(id => {
              const inv = allInvestors.find(i => i.id === id);
              if (!inv) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1 text-sm text-zinc-300"
                >
                  {inv.name}
                  <button
                    onClick={() => removeInvestor(id)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              );
            })}
            {selectedIds.length > 0 && (
              <button
                onClick={() => setSelectedIds([])}
                className="text-xs text-zinc-600 hover:text-zinc-400 px-2 py-1 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {selected.length === 0 && !loadingData && (
        <div className="border border-zinc-800 rounded-xl p-12 text-center">
          <div className="text-zinc-600 text-sm">
            Select at least 2 investors from the dropdown above to see a side-by-side comparison.
          </div>
        </div>
      )}

      {/* Loading state */}
      {loadingData && selected.length < selectedIds.length && (
        <div className="border border-zinc-800 rounded-xl p-8 text-center">
          <div className="text-zinc-500 text-sm animate-pulse">Loading investor data...</div>
        </div>
      )}

      {/* Comparison table */}
      {selected.length >= 2 && (
        <div className="border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              {/* Sticky header with investor names */}
              <thead className="bg-zinc-900/80 border-b border-zinc-800 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium min-w-[160px] bg-zinc-900/80 sticky left-0 z-20 border-r border-zinc-800/50">
                    Metric
                  </th>
                  {selected.map(d => (
                    <th key={d.investor.id} className="text-left px-4 py-3 min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/investors/${d.investor.id}`}
                          className="text-sm font-medium text-zinc-200 hover:text-blue-400 transition-colors"
                        >
                          {d.investor.name}
                        </Link>
                        {d.investor.id === recommendationId && (
                          <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-800/30">
                {/* ── Basic Info ── */}
                <SectionHeader label="BASIC INFO" colSpan={selected.length + 1} />

                <CompareRow label="Type" cells={selected.map(d => ({
                  value: TYPE_LABELS[d.investor.type as InvestorType] ?? d.investor.type,
                }))} />

                <CompareRow label="Tier" cells={selected.map(d => ({
                  value: `Tier ${d.investor.tier}`,
                  className: tierColor(d.investor.tier),
                }))} />

                <CompareRow label="Status" cells={selected.map(d => ({
                  value: STATUS_LABELS[d.investor.status] ?? d.investor.status,
                }))} />

                <CompareRow label="Fund Size" cells={selected.map(d => ({
                  value: d.investor.fund_size || '---',
                }))} />

                <CompareRow label="Check Size" cells={selected.map(d => ({
                  value: d.investor.check_size_range || '---',
                }))} />

                <CompareRow label="Partner" cells={selected.map(d => ({
                  value: d.investor.partner || '---',
                }))} />

                <CompareRow label="Enthusiasm" cells={selected.map(d => ({
                  value: d.investor.enthusiasm > 0 ? `${d.investor.enthusiasm}/5` : '---',
                  className: enthusiasmColor(d.investor.enthusiasm),
                  render: d.investor.enthusiasm > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(n => (
                          <div
                            key={n}
                            className={`w-2 h-2 rounded-full ${
                              n <= d.investor.enthusiasm
                                ? d.investor.enthusiasm >= 4 ? 'bg-green-500'
                                : d.investor.enthusiasm === 3 ? 'bg-yellow-500'
                                : 'bg-red-500'
                                : 'bg-zinc-800'
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-xs ${enthusiasmColor(d.investor.enthusiasm)}`}>
                        {d.investor.enthusiasm}/5
                      </span>
                    </div>
                  ) : undefined,
                }))} />

                {/* ── Process ── */}
                <SectionHeader label="PROCESS" colSpan={selected.length + 1} />

                <CompareRow label="Speed" cells={selected.map(d => ({
                  value: d.investor.speed ? d.investor.speed.charAt(0).toUpperCase() + d.investor.speed.slice(1) : '---',
                  className: speedColor(d.investor.speed),
                }))} />

                <CompareRow label="IC Process" cells={selected.map(d => ({
                  value: d.investor.ic_process || '---',
                  wrap: true,
                }))} />

                <CompareRow label="Warm Path" cells={selected.map(d => ({
                  value: d.investor.warm_path || '---',
                  wrap: true,
                }))} />

                <CompareRow label="Sector Thesis" cells={selected.map(d => ({
                  value: d.investor.sector_thesis || '---',
                  wrap: true,
                }))} />

                <CompareRow label="Portfolio Conflicts" cells={selected.map(d => ({
                  value: d.investor.portfolio_conflicts || 'None identified',
                  className: d.investor.portfolio_conflicts && d.investor.portfolio_conflicts.toLowerCase() !== 'none'
                    ? 'text-red-400'
                    : 'text-green-400',
                  wrap: true,
                }))} />

                {/* ── Activity ── */}
                <SectionHeader label="ACTIVITY & DEPTH" colSpan={selected.length + 1} />

                <CompareRow label="Meeting Count" cells={selected.map(d => ({
                  value: String(d.meetings.length),
                }))} />

                <CompareRow label="Last Meeting" cells={selected.map(d => {
                  if (d.meetings.length === 0) return { value: '---' };
                  const sorted = [...d.meetings].sort((a, b) => b.date.localeCompare(a.date));
                  return { value: sorted[0].date };
                })} />

                <CompareRow label="Avg Enthusiasm" cells={selected.map(d => {
                  if (d.meetings.length === 0) return { value: '---' };
                  const scores = d.meetings.filter(m => m.enthusiasm_score > 0).map(m => m.enthusiasm_score);
                  if (scores.length === 0) return { value: '---' };
                  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                  return {
                    value: avg.toFixed(1),
                    className: enthusiasmColor(Math.round(avg)),
                  };
                })} />

                <CompareRow label="Partners Profiled" cells={selected.map(d => ({
                  value: String(d.partners.length),
                }))} />

                <CompareRow label="Portfolio Cos" cells={selected.map(d => ({
                  value: String(d.portfolio.length),
                }))} />

                {/* ── Recommendation ── */}
                <tr className="bg-zinc-900/50 border-t-2 border-zinc-700">
                  <td className="px-4 py-4 text-xs font-semibold text-zinc-400 uppercase tracking-wider sticky left-0 bg-zinc-900/50 border-r border-zinc-800/50">
                    Recommendation
                  </td>
                  {selected.map(d => (
                    <td key={d.investor.id} className="px-4 py-4">
                      {d.investor.id === recommendationId ? (
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-amber-400" />
                          <span className="text-sm font-semibold text-amber-400">Best Fit</span>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600">---</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single investor warning */}
      {selected.length === 1 && (
        <div className="border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-500 text-sm">Select at least one more investor to start comparing.</p>
        </div>
      )}
    </div>
  );
}

// ── Helper components ──

function SectionHeader({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr className="bg-zinc-900/30">
      <td
        colSpan={colSpan}
        className="px-4 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider"
      >
        {label}
      </td>
    </tr>
  );
}

interface CellData {
  value: string;
  className?: string;
  wrap?: boolean;
  render?: React.ReactNode;
}

function CompareRow({ label, cells }: { label: string; cells: CellData[] }) {
  return (
    <tr className="hover:bg-zinc-900/20 transition-colors">
      <td className="px-4 py-3 text-xs text-zinc-500 font-medium sticky left-0 bg-zinc-950 border-r border-zinc-800/50">
        {label}
      </td>
      {cells.map((cell, i) => (
        <td
          key={i}
          className={`px-4 py-3 text-sm ${cell.wrap ? 'max-w-[220px]' : ''} ${
            cell.className || 'text-zinc-300'
          }`}
        >
          {cell.render ?? (
            <span className={cell.wrap ? 'line-clamp-3' : ''}>{cell.value}</span>
          )}
        </td>
      ))}
    </tr>
  );
}

// ── Color helpers ──

function tierColor(tier: number): string {
  switch (tier) {
    case 1: return 'text-blue-400 font-semibold';
    case 2: return 'text-purple-400 font-semibold';
    case 3:
    case 4:
    default: return 'text-zinc-500';
  }
}

function enthusiasmColor(score: number): string {
  if (score >= 4) return 'text-green-400';
  if (score === 3) return 'text-yellow-400';
  if (score >= 1) return 'text-red-400';
  return 'text-zinc-600';
}

function speedColor(speed: string): string {
  switch (speed) {
    case 'fast': return 'text-green-400 font-medium';
    case 'medium': return 'text-yellow-400';
    case 'slow': return 'text-red-400';
    default: return 'text-zinc-500';
  }
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Calculator, TrendingUp, Scale, ChevronRight,
  ArrowRight, AlertTriangle, CheckCircle, Minus,
} from 'lucide-react';
import { cachedFetch } from '@/lib/cache';
import { stAccent, stAccentBadge, stSurface1, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary, stBorderTop, stSurface0 } from '@/lib/styles';

// --- Types ---

interface TermSheet {
  id: string;
  investor: string;
  valuation: string;
  amount: string;
  liq_pref: string;
  anti_dilution: string;
  board_seats: string;
  dividends: string;
  protective_provisions: string;
  option_pool: string;
  exclusivity: string;
  strategic_value: number;
  notes: string;
  created_at: string;
}

interface Investor {
  id: string;
  name: string;
  tier: number;
  type: string;
  status: string;
  check_size_range: string | null;
  enthusiasm: number;
}

// --- Helpers ---

function parseValuation(v: string): number | null {
  if (!v) return null;
  const cleaned = v.replace(/[€$£,\s]/g, '').toLowerCase();
  const match = cleaned.match(/([\d.]+)\s*(bn?|mn?|k)?/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (isNaN(num)) return null;
  const unit = match[2] || '';
  if (unit.startsWith('b')) return num * 1e9;
  if (unit.startsWith('m')) return num * 1e6;
  if (unit.startsWith('k')) return num * 1e3;
  return num;
}

function parseAmount(v: string): number | null {
  return parseValuation(v);
}

function fmt(n: number, decimals = 1): string {
  if (n >= 1e9) return `€${(n / 1e9).toFixed(decimals)}Bn`;
  if (n >= 1e6) return `€${(n / 1e6).toFixed(decimals)}M`;
  if (n >= 1e3) return `€${(n / 1e3).toFixed(decimals)}K`;
  return `€${n.toFixed(0)}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function parseLiqPref(lp: string): { multiple: number; participating: boolean } {
  const match = lp.match(/([\d.]+)x/i);
  const multiple = match ? parseFloat(match[1]) : 1;
  const participating = /participating/i.test(lp) && !/non-participating/i.test(lp);
  return { multiple, participating };
}

// --- Dilution Calculator ---

interface DilutionScenario {
  label: string;
  preMoney: number;
  raiseAmount: number;
  optionPoolPct: number;
}

function computeDilution(scenario: DilutionScenario, founderOwnershipPre: number) {
  const { preMoney, raiseAmount, optionPoolPct } = scenario;
  const postMoney = preMoney + raiseAmount;
  const newInvestorPct = raiseAmount / postMoney;
  const optionPoolDilution = optionPoolPct / 100;
  const founderDilutionFactor = (1 - newInvestorPct) * (1 - optionPoolDilution);
  const founderOwnershipPost = founderOwnershipPre * founderDilutionFactor;
  return {
    postMoney,
    newInvestorPct,
    founderOwnershipPost,
    founderDilutionPct: 1 - (founderOwnershipPost / founderOwnershipPre),
  };
}

// --- Exit Payoff ---

function computeExitPayoff(
  exitValuation: number,
  investorOwnershipPct: number,
  investmentAmount: number,
  liqPref: { multiple: number; participating: boolean },
) {
  const liqPrefAmount = investmentAmount * liqPref.multiple;
  const proRataShare = exitValuation * investorOwnershipPct;

  if (liqPref.participating) {
    // Participating: gets pref + pro-rata on remainder
    const remainder = Math.max(0, exitValuation - liqPrefAmount);
    return liqPrefAmount + remainder * investorOwnershipPct;
  } else {
    // Non-participating: chooses better of pref or pro-rata
    return Math.max(liqPrefAmount, proRataShare);
  }
}

// --- Component ---

export default function DealMechanicsPage() {
  const [sheets, setSheets] = useState<TermSheet[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [founderOwnership, setFounderOwnership] = useState(16.5); // Pre-round founder %

  useEffect(() => { document.title = 'Raise | Deal Mechanics'; }, []);
  useEffect(() => {
    Promise.all([
      cachedFetch('/api/term-sheets').then(r => r.json()),
      cachedFetch('/api/investors').then(r => r.json()),
    ]).then(([ts, inv]) => {
      setSheets(ts);
      setInvestors(inv);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Parse term sheets into analyzable scenarios
  const scenarios = useMemo(() => {
    return sheets.map(ts => {
      const preMoney = parseValuation(ts.valuation);
      const amount = parseAmount(ts.amount);
      const optionPool = ts.option_pool ? parseFloat(ts.option_pool) || 12 : 12;
      const liqPref = parseLiqPref(ts.liq_pref);
      return { ...ts, preMoney, amount, optionPool, liqPref };
    }).filter(s => s.preMoney && s.amount);
  }, [sheets]);

  // Match investors to term sheets
  const investorMap = useMemo(() => {
    const m = new Map<string, Investor>();
    investors.forEach(inv => m.set(inv.name.toLowerCase(), inv));
    return m;
  }, [investors]);

  // Exit scenarios for payoff analysis
  const exitMultiples = [0.5, 1.0, 2.0, 4.0, 8.0, 12.0];

  if (loading) {
    return (
      <div className="space-y-6 page-content">
        <div className="skeleton" style={{ height: '28px', width: '240px' }} />
        <div className="skeleton" style={{ height: '16px', width: '400px' }} />
        <div className="skeleton" style={{ height: '300px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-8 page-content">
      {/* Header */}
      <div>
        <h1 className="text-xl font-normal" style={stTextPrimary}>Deal Mechanics</h1>
        <p className="text-sm mt-1" style={stTextMuted}>
          Dilution modeling, term sheet comparison, and exit payoff analysis. Every deal decision in one place.
        </p>
      </div>

      {/* Founder Ownership Input */}
      <section className="rounded-xl p-5" style={{ border: '1px solid var(--border-subtle)' }}>
        <h2 className="text-sm font-normal tracking-wider mb-3 flex items-center gap-2" style={stTextTertiary}>
          <span style={stAccent}><Calculator className="w-4 h-4" /></span>
          Founder Parameters
        </h2>
        <div className="flex items-center gap-4">
          <label className="text-xs" style={stTextMuted}>Pre-round founder ownership (%)</label>
          <input
            type="number"
            value={founderOwnership}
            onChange={e => setFounderOwnership(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
            className="input w-24 text-sm text-center"
            step={0.1}
            min={0}
            max={100}
          />
        </div>
      </section>

      {scenarios.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ border: '1px solid var(--border-subtle)' }}>
          <span style={stTextMuted}><Scale className="w-8 h-8 mx-auto mb-3" /></span>
          <h3 className="text-sm font-normal mb-1" style={stTextPrimary}>No term sheets to analyze</h3>
          <p className="text-xs" style={stTextMuted}>
            Add term sheets with valuation and amount to see dilution modeling, exit payoffs, and comparison analysis.
          </p>
        </div>
      ) : (
        <>
          {/* ============ DILUTION COMPARISON TABLE ============ */}
          <section className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="p-5 pb-3">
              <h2 className="text-sm font-normal tracking-wider flex items-center gap-2" style={stTextTertiary}>
                <span style={stAccent}><TrendingUp className="w-4 h-4" /></span>
                Dilution Comparison
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" aria-label="Dilution comparison across term sheets">
                <thead>
                  <tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="text-left px-4 py-2.5 font-normal" style={stTextMuted}>Investor</th>
                    <th className="text-right px-4 py-2.5 font-normal" style={stTextMuted}>Pre-Money</th>
                    <th className="text-right px-4 py-2.5 font-normal" style={stTextMuted}>Raise</th>
                    <th className="text-right px-4 py-2.5 font-normal" style={stTextMuted}>Post-Money</th>
                    <th className="text-right px-4 py-2.5 font-normal" style={stTextMuted}>New Investor %</th>
                    <th className="text-right px-4 py-2.5 font-normal" style={stTextMuted}>Founder After</th>
                    <th className="text-right px-4 py-2.5 font-normal" style={stTextMuted}>Dilution</th>
                    <th className="text-right px-4 py-2.5 font-normal" style={stTextMuted}>Liq Pref</th>
                    <th className="text-center px-4 py-2.5 font-normal" style={stTextMuted}>Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map(s => {
                    const d = computeDilution(
                      { label: s.investor, preMoney: s.preMoney!, raiseAmount: s.amount!, optionPoolPct: s.optionPool },
                      founderOwnership / 100
                    );
                    const inv = investorMap.get(s.investor.toLowerCase());
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="px-4 py-2.5 font-normal" style={stTextSecondary}>{s.investor}</td>
                        <td className="px-4 py-2.5 text-right font-mono" style={stTextSecondary}>{fmt(s.preMoney!)}</td>
                        <td className="px-4 py-2.5 text-right font-mono" style={stAccent}>{fmt(s.amount!)}</td>
                        <td className="px-4 py-2.5 text-right font-mono" style={stTextSecondary}>{fmt(d.postMoney)}</td>
                        <td className="px-4 py-2.5 text-right font-mono" style={stTextSecondary}>{pct(d.newInvestorPct)}</td>
                        <td className="px-4 py-2.5 text-right font-mono" style={stTextPrimary}>{pct(d.founderOwnershipPost)}</td>
                        <td className="px-4 py-2.5 text-right font-mono" style={{ color: d.founderDilutionPct > 0.2 ? 'var(--danger)' : 'var(--warning)' }}>
                          -{pct(d.founderDilutionPct)}
                        </td>
                        <td className="px-4 py-2.5 text-right" style={stTextTertiary}>
                          {s.liqPref.multiple}x {s.liqPref.participating ? 'part.' : 'non-part.'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {inv ? (
                            <span className="px-1.5 py-0.5 rounded text-xs" style={
                              inv.tier === 1 ? { background: 'var(--accent-muted)', color: 'var(--accent)' } :
                              inv.tier === 2 ? { background: 'var(--warning-muted)', color: 'var(--text-secondary)' } :
                              { background: 'var(--surface-2)', color: 'var(--text-tertiary)' }
                            }>T{inv.tier}</span>
                          ) : <span style={stTextMuted}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* ============ EXIT PAYOFF MATRIX ============ */}
          <section className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="p-5 pb-3">
              <h2 className="text-sm font-normal tracking-wider flex items-center gap-2" style={stTextTertiary}>
                <span style={stAccent}><Scale className="w-4 h-4" /></span>
                Exit Payoff Matrix
              </h2>
              <p className="text-xs mt-1" style={stTextMuted}>
                What each investor receives at different exit valuations, factoring in liquidation preferences.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" aria-label="Exit payoff matrix">
                <thead>
                  <tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="text-left px-4 py-2.5 font-normal" style={stTextMuted}>Investor</th>
                    {exitMultiples.map(m => (
                      <th key={m} className="text-right px-3 py-2.5 font-normal" style={stTextMuted}>
                        {m}x exit
                      </th>
                    ))}
                    <th className="text-right px-4 py-2.5 font-normal" style={stTextMuted}>MOIC @ 4x</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map(s => {
                    const d = computeDilution(
                      { label: s.investor, preMoney: s.preMoney!, raiseAmount: s.amount!, optionPoolPct: s.optionPool },
                      founderOwnership / 100
                    );
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td className="px-4 py-2.5 font-normal" style={stTextSecondary}>{s.investor}</td>
                        {exitMultiples.map(m => {
                          const exitVal = d.postMoney * m;
                          const payoff = computeExitPayoff(exitVal, d.newInvestorPct, s.amount!, s.liqPref);
                          const moic = payoff / s.amount!;
                          return (
                            <td key={m} className="px-3 py-2.5 text-right font-mono" style={{
                              color: moic < 1 ? 'var(--danger)' : moic > 3 ? 'var(--success)' : 'var(--text-secondary)',
                            }}>
                              {fmt(payoff)}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2.5 text-right font-mono font-normal" style={stAccent}>
                          {(computeExitPayoff(d.postMoney * 4, d.newInvestorPct, s.amount!, s.liqPref) / s.amount!).toFixed(1)}x
                        </td>
                      </tr>
                    );
                  })}
                  {/* Founder row */}
                  <tr style={{ borderTop: '2px solid var(--border-strong)', background: 'var(--surface-1)' }}>
                    <td className="px-4 py-2.5 font-normal" style={stTextPrimary}>Founder</td>
                    {exitMultiples.map(m => {
                      // Use first scenario's post-money as baseline
                      const s0 = scenarios[0];
                      const d0 = computeDilution(
                        { label: s0.investor, preMoney: s0.preMoney!, raiseAmount: s0.amount!, optionPoolPct: s0.optionPool },
                        founderOwnership / 100
                      );
                      const exitVal = d0.postMoney * m;
                      const founderValue = exitVal * d0.founderOwnershipPost;
                      return (
                        <td key={m} className="px-3 py-2.5 text-right font-mono" style={{
                          color: founderValue < 1e6 ? 'var(--danger)' : 'var(--text-primary)',
                        }}>
                          {fmt(founderValue)}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 text-right font-mono" style={stTextPrimary}>—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ============ TERM SHEET VERDICT CARDS ============ */}
          <section className="rounded-xl p-5" style={{ border: '1px solid var(--border-subtle)' }}>
            <h2 className="text-sm font-normal tracking-wider mb-4 flex items-center gap-2" style={stTextTertiary}>
              <span style={stAccent}><CheckCircle className="w-4 h-4" /></span>
              Decision Framework
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scenarios.map(s => {
                const d = computeDilution(
                  { label: s.investor, preMoney: s.preMoney!, raiseAmount: s.amount!, optionPoolPct: s.optionPool },
                  founderOwnership / 100
                );
                const inv = investorMap.get(s.investor.toLowerCase());
                const moic4x = computeExitPayoff(d.postMoney * 4, d.newInvestorPct, s.amount!, s.liqPref) / s.amount!;
                const isExpensive = d.founderDilutionPct > 0.25;
                const isParticipating = s.liqPref.participating;
                const highLiqPref = s.liqPref.multiple > 1;

                const signals: { icon: typeof CheckCircle; label: string; positive: boolean }[] = [];
                if (inv && inv.tier === 1) signals.push({ icon: CheckCircle, label: 'Tier 1 investor', positive: true });
                if (inv && inv.enthusiasm >= 4) signals.push({ icon: CheckCircle, label: `Enthusiasm ${inv.enthusiasm}/5`, positive: true });
                if (!isExpensive) signals.push({ icon: CheckCircle, label: `Moderate dilution (${pct(d.founderDilutionPct)})`, positive: true });
                if (isExpensive) signals.push({ icon: AlertTriangle, label: `Heavy dilution (${pct(d.founderDilutionPct)})`, positive: false });
                if (isParticipating) signals.push({ icon: AlertTriangle, label: 'Participating liquidation preference', positive: false });
                if (highLiqPref) signals.push({ icon: AlertTriangle, label: `${s.liqPref.multiple}x liquidation preference`, positive: false });
                if (moic4x > 3.5) signals.push({ icon: CheckCircle, label: `Strong investor alignment (${moic4x.toFixed(1)}x @ 4x exit)`, positive: true });
                if (s.strategic_value >= 4) signals.push({ icon: CheckCircle, label: `High strategic value (${s.strategic_value}/5)`, positive: true });

                const positiveCount = signals.filter(s => s.positive).length;
                const negativeCount = signals.filter(s => !s.positive).length;

                return (
                  <div key={s.id} className="rounded-lg p-4" style={{ ...stSurface1, border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-normal" style={stTextPrimary}>{s.investor}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs" style={
                        positiveCount > negativeCount ? { background: 'var(--success-muted)', color: 'var(--success)' } :
                        positiveCount === negativeCount ? { background: 'var(--warning-muted)', color: 'var(--warning)' } :
                        { background: 'var(--danger-muted)', color: 'var(--danger)' }
                      }>
                        {positiveCount > negativeCount ? 'Favorable' : positiveCount === negativeCount ? 'Neutral' : 'Caution'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <div className="text-xs" style={stTextMuted}>Pre-Money</div>
                        <div className="text-sm font-mono" style={stTextSecondary}>{fmt(s.preMoney!)}</div>
                      </div>
                      <div>
                        <div className="text-xs" style={stTextMuted}>Raise</div>
                        <div className="text-sm font-mono" style={stAccent}>{fmt(s.amount!)}</div>
                      </div>
                      <div>
                        <div className="text-xs" style={stTextMuted}>Founder After</div>
                        <div className="text-sm font-mono" style={stTextPrimary}>{pct(d.founderOwnershipPost)}</div>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {signals.map((sig, i) => {
                        const Icon = sig.icon;
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span style={{ color: sig.positive ? 'var(--success)' : 'var(--danger)' }}>
                              <Icon className="w-3.5 h-3.5" />
                            </span>
                            <span style={sig.positive ? stTextSecondary : stTextPrimary}>{sig.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ============ VALUATION SENSITIVITY ============ */}
          <section className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="p-5 pb-3">
              <h2 className="text-sm font-normal tracking-wider flex items-center gap-2" style={stTextTertiary}>
                <span style={stAccent}><ArrowRight className="w-4 h-4" /></span>
                Valuation Sensitivity
              </h2>
              <p className="text-xs mt-1" style={stTextMuted}>
                How founder ownership changes at different pre-money valuations for each term sheet&apos;s raise amount.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" aria-label="Valuation sensitivity">
                <thead>
                  <tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th className="text-left px-4 py-2.5 font-normal" style={stTextMuted}>Investor</th>
                    {[0.7, 0.85, 1.0, 1.15, 1.3, 1.5].map(mult => (
                      <th key={mult} className="text-right px-3 py-2.5 font-normal" style={mult === 1.0 ? stAccent : stTextMuted}>
                        {mult === 1.0 ? 'Current' : `${mult > 1 ? '+' : ''}${((mult - 1) * 100).toFixed(0)}%`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="px-4 py-2.5 font-normal" style={stTextSecondary}>{s.investor}</td>
                      {[0.7, 0.85, 1.0, 1.15, 1.3, 1.5].map(mult => {
                        const adjPre = s.preMoney! * mult;
                        const d = computeDilution(
                          { label: s.investor, preMoney: adjPre, raiseAmount: s.amount!, optionPoolPct: s.optionPool },
                          founderOwnership / 100
                        );
                        return (
                          <td key={mult} className="px-3 py-2.5 text-right font-mono" style={
                            mult === 1.0 ? { ...stAccent, fontWeight: 400 } :
                            d.founderDilutionPct > 0.25 ? { color: 'var(--danger)' } :
                            stTextSecondary
                          }>
                            {pct(d.founderOwnershipPost)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

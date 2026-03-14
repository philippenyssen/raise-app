'use client';

import { useState } from 'react';

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
}

const EMPTY_TS: Omit<TermSheet, 'id'> = {
  investor: '', valuation: '', amount: '', liq_pref: '1x non-participating',
  anti_dilution: 'Broad-based weighted average', board_seats: '1 + observer',
  dividends: 'None', protective_provisions: 'Standard', option_pool: '',
  exclusivity: '', strategic_value: 3, notes: '',
};

const MARKET_STANDARDS: Record<string, string> = {
  liq_pref: '1x non-participating',
  anti_dilution: 'Broad-based weighted average',
  board_seats: '1 investor seat + 1 observer',
  dividends: 'Non-cumulative or none',
  protective_provisions: 'Standard set (new issuance, sale, liquidation)',
  option_pool: '10-15% post-money',
};

export default function TermsPage() {
  const [sheets, setSheets] = useState<TermSheet[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<TermSheet, 'id'>>(EMPTY_TS);

  function addSheet(e: React.FormEvent) {
    e.preventDefault();
    setSheets(s => [...s, { ...form, id: crypto.randomUUID() }]);
    setForm(EMPTY_TS);
    setShowForm(false);
  }

  function removeSheet(id: string) {
    setSheets(s => s.filter(ts => ts.id !== id));
  }

  function scoreSheet(ts: TermSheet): { score: number; flags: string[] } {
    const flags: string[] = [];
    let score = 50; // base

    // Valuation scoring (simplified)
    if (ts.liq_pref.toLowerCase().includes('participating')) { flags.push('Participating preferred - RED FLAG'); score -= 15; }
    if (ts.anti_dilution.toLowerCase().includes('full ratchet')) { flags.push('Full ratchet anti-dilution - RED FLAG'); score -= 15; }
    if (ts.board_seats.includes('2') || ts.board_seats.includes('3')) { flags.push('Multiple board seats - overreach'); score -= 10; }
    if (ts.dividends.toLowerCase().includes('cumulative')) { flags.push('Cumulative dividends - hidden cost'); score -= 10; }
    if (ts.liq_pref === '1x non-participating') score += 10;
    if (ts.anti_dilution === 'Broad-based weighted average') score += 10;
    score += ts.strategic_value * 6; // 0-30 points for strategic value

    return { score: Math.max(0, Math.min(100, score)), flags };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Term Sheet Comparison</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Compare and score term sheets side-by-side. {sheets.length} received.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
        >
          + Add Term Sheet
        </button>
      </div>

      {/* Market Standards Reference */}
      <div className="border border-zinc-800 rounded-xl p-5">
        <h3 className="text-xs font-medium text-zinc-400 mb-3">MARKET STANDARDS (Series C)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          {Object.entries(MARKET_STANDARDS).map(([key, val]) => (
            <div key={key}>
              <span className="text-zinc-500">{key.replace(/_/g, ' ')}:</span>
              <span className="text-zinc-300 ml-1">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={addSheet} className="border border-zinc-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-medium text-zinc-400">ADD TERM SHEET</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TsInput label="Investor" value={form.investor} onChange={v => setForm(f => ({ ...f, investor: v }))} required />
            <TsInput label="Pre-Money Valuation" value={form.valuation} onChange={v => setForm(f => ({ ...f, valuation: v }))} placeholder="e.g., 2.0Bn" />
            <TsInput label="Investment Amount" value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v }))} placeholder="e.g., 250M" />
            <TsInput label="Liquidation Preference" value={form.liq_pref} onChange={v => setForm(f => ({ ...f, liq_pref: v }))} />
            <TsInput label="Anti-Dilution" value={form.anti_dilution} onChange={v => setForm(f => ({ ...f, anti_dilution: v }))} />
            <TsInput label="Board Seats" value={form.board_seats} onChange={v => setForm(f => ({ ...f, board_seats: v }))} />
            <TsInput label="Dividends" value={form.dividends} onChange={v => setForm(f => ({ ...f, dividends: v }))} />
            <TsInput label="Protective Provisions" value={form.protective_provisions} onChange={v => setForm(f => ({ ...f, protective_provisions: v }))} />
            <TsInput label="Option Pool" value={form.option_pool} onChange={v => setForm(f => ({ ...f, option_pool: v }))} placeholder="e.g., 12%" />
            <TsInput label="Exclusivity" value={form.exclusivity} onChange={v => setForm(f => ({ ...f, exclusivity: v }))} placeholder="e.g., 14 days" />
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Strategic Value (1-5)</label>
              <input type="range" min="1" max="5" value={form.strategic_value}
                onChange={e => setForm(f => ({ ...f, strategic_value: Number(e.target.value) }))}
                className="w-full" />
              <div className="text-xs text-zinc-500 text-center">{form.strategic_value}/5</div>
            </div>
          </div>
          <TsInput label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} />
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium">Add</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Comparison */}
      {sheets.length > 0 && (
        <div className="border border-zinc-800 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/50 border-b border-zinc-800">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium w-40">Term</th>
                {sheets.map(ts => (
                  <th key={ts.id} className="text-left px-4 py-3 text-xs text-zinc-300 font-medium min-w-48">
                    <div className="flex items-center justify-between">
                      {ts.investor}
                      <button onClick={() => removeSheet(ts.id)} className="text-zinc-600 hover:text-red-400 ml-2">&times;</button>
                    </div>
                  </th>
                ))}
                <th className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">Market Standard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {[
                ['Valuation', 'valuation'],
                ['Amount', 'amount'],
                ['Liq. Pref', 'liq_pref'],
                ['Anti-Dilution', 'anti_dilution'],
                ['Board Seats', 'board_seats'],
                ['Dividends', 'dividends'],
                ['Protective Provisions', 'protective_provisions'],
                ['Option Pool', 'option_pool'],
                ['Exclusivity', 'exclusivity'],
              ].map(([label, key]) => (
                <tr key={key} className="hover:bg-zinc-900/30">
                  <td className="px-4 py-2.5 text-zinc-500 text-xs">{label}</td>
                  {sheets.map(ts => {
                    const val = (ts as unknown as Record<string, unknown>)[key] as string;
                    const standard = MARKET_STANDARDS[key];
                    const isStandard = standard && val.toLowerCase() === standard.toLowerCase();
                    return (
                      <td key={ts.id} className={`px-4 py-2.5 text-xs ${isStandard ? 'text-green-400' : 'text-zinc-300'}`}>
                        {val || '—'}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 text-xs text-zinc-600">{MARKET_STANDARDS[key] || '—'}</td>
                </tr>
              ))}
              {/* Score Row */}
              <tr className="bg-zinc-900/30 border-t-2 border-zinc-700">
                <td className="px-4 py-3 text-xs font-medium text-zinc-400">SCORE</td>
                {sheets.map(ts => {
                  const { score, flags } = scoreSheet(ts);
                  return (
                    <td key={ts.id} className="px-4 py-3">
                      <div className={`text-lg font-bold ${score >= 70 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {score}/100
                      </div>
                      {flags.map((f, i) => (
                        <div key={i} className="text-xs text-red-400 mt-1">{f}</div>
                      ))}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-xs text-zinc-600">Benchmark</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {sheets.length === 0 && !showForm && (
        <div className="border border-zinc-800 rounded-xl p-8 text-center text-zinc-600 text-sm">
          No term sheets yet. Add them as they come in for side-by-side comparison.
        </div>
      )}
    </div>
  );
}

function TsInput({ label, value, onChange, required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs text-zinc-500 block mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600 text-zinc-200" />
    </div>
  );
}

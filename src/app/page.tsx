'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';

interface HealthData {
  funnel: {
    contacted: number;
    meetings: number;
    engaged: number;
    in_dd: number;
    term_sheets: number;
    closed: number;
    passed: number;
    conversion_rates: Record<string, number>;
    targets: Record<string, number>;
  };
  health: 'green' | 'yellow' | 'red';
  totalInvestors: number;
  totalMeetings: number;
  avgEnthusiasm: number;
  tierBreakdown: Record<string, number>;
  topObjections: { text: string; count: number }[];
}

export default function Dashboard() {
  const { toast } = useToast();
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const res = await fetch('/api/health');
    setData(await res.json());
    setLoading(false);
  }

  async function seedData() {
    setSeeding(true);
    const res = await fetch('/api/seed', { method: 'POST' });
    const result = await res.json();
    if (result.ok) {
      toast(`Seeded ${result.seeded} investors`);
    } else {
      toast(`Seed failed: ${result.error}`, 'error');
    }
    await fetchData();
    setSeeding(false);
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-zinc-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-zinc-800/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const healthColor = { green: 'text-green-400', yellow: 'text-yellow-400', red: 'text-red-400' }[data.health];
  const healthBg = { green: 'bg-green-400/10 border-green-400/20', yellow: 'bg-yellow-400/10 border-yellow-400/20', red: 'bg-red-400/10 border-red-400/20' }[data.health];

  const funnelStages = [
    { label: 'Contacted', value: data.funnel.contacted, color: 'bg-zinc-600' },
    { label: 'Meetings', value: data.funnel.meetings, color: 'bg-blue-600' },
    { label: 'Engaged', value: data.funnel.engaged, color: 'bg-purple-600' },
    { label: 'In DD', value: data.funnel.in_dd, color: 'bg-orange-600' },
    { label: 'Term Sheets', value: data.funnel.term_sheets, color: 'bg-green-600' },
    { label: 'Closed', value: data.funnel.closed, color: 'bg-emerald-600' },
  ];

  const maxFunnel = Math.max(...funnelStages.map(s => s.value), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Series C Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">Aerospacelab --- Process Orchestrator</p>
        </div>
        <div className={`px-4 py-2 rounded-lg border ${healthBg}`}>
          <span className={`text-sm font-medium ${healthColor} uppercase`}>
            {data.health}
          </span>
        </div>
      </div>

      {/* Empty State */}
      {data.totalInvestors === 0 && (
        <div className="border border-zinc-800 rounded-xl p-8 text-center space-y-4">
          <h2 className="text-lg font-semibold">Initialize Your Fundraise</h2>
          <p className="text-zinc-500 text-sm max-w-md mx-auto">
            Seed the database with ASL Series C investor targets and configuration, or add investors manually.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={seedData}
              disabled={seeding}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {seeding ? 'Seeding...' : 'Seed ASL Data'}
            </button>
            <Link
              href="/investors"
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
            >
              Add Manually
            </Link>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      {data.totalInvestors > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Investors" value={data.totalInvestors} sub="in universe" />
            <MetricCard label="Meetings" value={data.totalMeetings} sub="completed" />
            <MetricCard label="Enthusiasm" value={data.avgEnthusiasm.toFixed(1)} sub="avg score /5" />
            <MetricCard label="Term Sheets" value={data.funnel.term_sheets} sub="received" />
          </div>

          {/* Funnel */}
          <div className="border border-zinc-800 rounded-xl p-6">
            <h2 className="text-sm font-medium text-zinc-400 mb-4">INVESTOR FUNNEL</h2>
            <div className="space-y-3">
              {funnelStages.map(stage => (
                <div key={stage.label} className="flex items-center gap-4">
                  <span className="text-xs text-zinc-500 w-24 text-right">{stage.label}</span>
                  <div className="flex-1 bg-zinc-900 rounded-full h-6 overflow-hidden">
                    <div
                      className={`${stage.color} h-full rounded-full transition-all duration-500 flex items-center px-3`}
                      style={{ width: `${Math.max((stage.value / maxFunnel) * 100, stage.value > 0 ? 8 : 0)}%` }}
                    >
                      {stage.value > 0 && <span className="text-xs font-medium">{stage.value}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {data.funnel.passed > 0 && (
                <div className="flex items-center gap-4">
                  <span className="text-xs text-zinc-500 w-24 text-right">Passed</span>
                  <div className="flex-1 bg-zinc-900 rounded-full h-6 overflow-hidden">
                    <div
                      className="bg-red-600/50 h-full rounded-full flex items-center px-3"
                      style={{ width: `${Math.max((data.funnel.passed / maxFunnel) * 100, 8)}%` }}
                    >
                      <span className="text-xs font-medium">{data.funnel.passed}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Conversion Rates */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(data.funnel.conversion_rates).map(([key, rate]) => {
              const target = data.funnel.targets[key] ?? 50;
              const ok = rate >= target;
              return (
                <div key={key} className="border border-zinc-800 rounded-xl p-4">
                  <div className="text-xs text-zinc-500 mb-1">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </div>
                  <div className={`text-2xl font-bold ${ok ? 'text-green-400' : rate > 0 ? 'text-yellow-400' : 'text-zinc-600'}`}>
                    {rate}%
                  </div>
                  <div className="text-xs text-zinc-600">target: {target}%</div>
                </div>
              );
            })}
          </div>

          {/* Tier Breakdown + Top Objections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-medium text-zinc-400 mb-4">INVESTOR TIERS</h2>
              <div className="space-y-2">
                {Object.entries(data.tierBreakdown).map(([tier, count]) => (
                  <div key={tier} className="flex justify-between text-sm">
                    <span className="text-zinc-400">{tier.replace('tier', 'Tier ')}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-medium text-zinc-400 mb-4">TOP OBJECTIONS</h2>
              {data.topObjections.length === 0 ? (
                <p className="text-sm text-zinc-600">No objections recorded yet. Log meeting debriefs to track patterns.</p>
              ) : (
                <div className="space-y-2">
                  {data.topObjections.map((obj, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-zinc-400 truncate mr-2">{obj.text}</span>
                      <span className="font-medium text-red-400 shrink-0">{obj.count}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/meetings/new" className="border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 text-center transition-colors">
              <div className="text-sm font-medium">Log Meeting</div>
              <div className="text-xs text-zinc-500 mt-1">Capture debrief</div>
            </Link>
            <Link href="/investors" className="border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 text-center transition-colors">
              <div className="text-sm font-medium">Manage CRM</div>
              <div className="text-xs text-zinc-500 mt-1">Update statuses</div>
            </Link>
            <Link href="/analysis" className="border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 text-center transition-colors">
              <div className="text-sm font-medium">AI Analysis</div>
              <div className="text-xs text-zinc-500 mt-1">Pattern detection</div>
            </Link>
            <Link href="/health" className="border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 text-center transition-colors">
              <div className="text-sm font-medium">Process Health</div>
              <div className="text-xs text-zinc-500 mt-1">Convergence score</div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="border border-zinc-800 rounded-xl p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      <div className="text-xs text-zinc-600 mt-0.5">{sub}</div>
    </div>
  );
}

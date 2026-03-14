'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import { FileText, Sparkles, FolderOpen, Table, ArrowRight, ClipboardList, Activity } from 'lucide-react';

interface DocSummary {
  id: string;
  title: string;
  type: string;
  status: string;
  updated_at: string;
}

interface UpcomingTask {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  investor_name: string;
  phase: string;
}

interface ActivityItem {
  id: string;
  event_type: string;
  subject: string;
  detail: string;
  investor_name: string;
  created_at: string;
}

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
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [dataRoomCount, setDataRoomCount] = useState(0);
  const [tasks, setTasks] = useState<UpcomingTask[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [healthRes, docsRes, drRes, tasksRes, actRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/documents'),
        fetch('/api/data-room'),
        fetch('/api/tasks?type=upcoming&limit=5'),
        fetch('/api/tasks?type=activity&limit=5'),
      ]);
      if (healthRes.ok) setData(await healthRes.json());
      if (docsRes.ok) setDocs(await docsRes.json());
      if (drRes.ok) setDataRoomCount((await drRes.json()).length);
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (actRes.ok) setActivity(await actRes.json());
    } catch {
      toast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Deliverables Quick Access */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/workspace" className="group border border-zinc-800 hover:border-blue-600/40 rounded-xl p-4 transition-colors">
          <Sparkles className="w-5 h-5 text-blue-400 mb-2" />
          <div className="text-sm font-medium">Workspace</div>
          <div className="text-xs text-zinc-500 mt-1">
            {docs.length > 0 ? `${docs.length} document${docs.length !== 1 ? 's' : ''}` : 'Create deliverables'}
          </div>
          <div className="text-xs text-blue-400 mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Open <ArrowRight className="w-3 h-3" />
          </div>
        </Link>
        <Link href="/data-room" className="group border border-zinc-800 hover:border-blue-600/40 rounded-xl p-4 transition-colors">
          <FolderOpen className="w-5 h-5 text-purple-400 mb-2" />
          <div className="text-sm font-medium">Data Room</div>
          <div className="text-xs text-zinc-500 mt-1">
            {dataRoomCount > 0 ? `${dataRoomCount} file${dataRoomCount !== 1 ? 's' : ''} uploaded` : 'Upload source materials'}
          </div>
          <div className="text-xs text-blue-400 mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Open <ArrowRight className="w-3 h-3" />
          </div>
        </Link>
        <Link href="/model" className="group border border-zinc-800 hover:border-blue-600/40 rounded-xl p-4 transition-colors">
          <Table className="w-5 h-5 text-green-400 mb-2" />
          <div className="text-sm font-medium">Financial Model</div>
          <div className="text-xs text-zinc-500 mt-1">Build & refine with AI</div>
          <div className="text-xs text-blue-400 mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Open <ArrowRight className="w-3 h-3" />
          </div>
        </Link>
        <Link href="/documents" className="group border border-zinc-800 hover:border-blue-600/40 rounded-xl p-4 transition-colors">
          <FileText className="w-5 h-5 text-orange-400 mb-2" />
          <div className="text-sm font-medium">Documents</div>
          <div className="text-xs text-zinc-500 mt-1">
            {docs.length > 0 ? `${docs.filter(d => d.status === 'draft').length} drafts` : 'Version history'}
          </div>
          <div className="text-xs text-blue-400 mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Open <ArrowRight className="w-3 h-3" />
          </div>
        </Link>
      </div>

      {/* Recent Documents */}
      {docs.length > 0 && (
        <div className="border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-zinc-400 uppercase">Recent Documents</h2>
            <Link href="/workspace" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              Open Workspace <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {docs.slice(0, 5).map(doc => (
              <Link key={doc.id} href="/workspace" className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-zinc-600 shrink-0" />
                  <span className="text-sm truncate">{doc.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    doc.status === 'final' ? 'bg-green-900/30 text-green-400 border-green-800' :
                    doc.status === 'review' ? 'bg-blue-900/30 text-blue-400 border-blue-800' :
                    'bg-yellow-900/30 text-yellow-400 border-yellow-800'
                  }`}>{doc.status}</span>
                </div>
                <span className="text-xs text-zinc-600 shrink-0">{new Date(doc.updated_at).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

          {/* Upcoming Tasks + Recent Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-zinc-400 uppercase flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" /> Upcoming Tasks
                </h2>
                <Link href="/timeline" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  All tasks <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {tasks.length === 0 ? (
                <p className="text-sm text-zinc-600">No upcoming tasks</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map(t => {
                    const overdue = t.due_date && new Date(t.due_date) < new Date();
                    const prioColor = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-zinc-500' }[t.priority] || 'text-zinc-500';
                    return (
                      <div key={t.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-zinc-800/50">
                        <div className="min-w-0">
                          <div className="text-sm truncate">{t.title}</div>
                          {t.investor_name && <div className="text-xs text-zinc-600 truncate">{t.investor_name}</div>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] ${prioColor}`}>{t.priority}</span>
                          {t.due_date && (
                            <span className={`text-[10px] ${overdue ? 'text-red-400' : 'text-zinc-500'}`}>
                              {new Date(t.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-zinc-400 uppercase flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Recent Activity
                </h2>
                <Link href="/timeline" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  Full log <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {activity.length === 0 ? (
                <p className="text-sm text-zinc-600">No activity recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {activity.map(a => (
                    <div key={a.id} className="py-1.5 px-2 rounded hover:bg-zinc-800/50">
                      <div className="text-sm truncate">{a.subject}</div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                        <span>{a.event_type.replace(/_/g, ' ')}</span>
                        <span>{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
            <Link href="/timeline" className="border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 text-center transition-colors">
              <div className="text-sm font-medium">Timeline</div>
              <div className="text-xs text-zinc-500 mt-1">Tasks & workflow</div>
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

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import {
  FileText, Sparkles, FolderOpen, Table, ArrowRight, ClipboardList,
  Activity, Download, Columns3, Target, Timer, ShieldCheck,
  RefreshCw, Zap, TrendingUp, TrendingDown, Minus, AlertTriangle,
  ChevronRight, Clock, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface FocusItem {
  investorId: string;
  investorName: string;
  investorType: string;
  investorTier: number;
  status: string;
  focusScore: number;
  recommendedAction: string;
  timeEstimate: string;
}

interface DataQualityData {
  overallCompleteness: number;
  fieldCompleteness: { field: string; category: string; filled: number; total: number; pct: number }[];
  worstInvestors: { id: string; name: string; completeness: number; missingFields: string[] }[];
  bestInvestors: { id: string; name: string; completeness: number }[];
  intelligenceReadiness: number;
  recommendations: string[];
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

// Pulse types
interface PulseData {
  overnight: {
    statusChanges: { investorId: string; investorName: string; from: string; to: string; changedAt: string }[];
    newMeetings: number;
    meetingNames: string[];
    tasksCompleted: number;
    newTasks: number;
    newAccelerations: number;
    activityFeed: string[];
  };
  criticalPath: {
    topFocus: {
      investorId: string;
      investorName: string;
      tier: number;
      status: string;
      focusScore: number;
      recommendedAction: string;
      timeEstimate: string;
      momentum: string;
      momentumArrow: string;
      enthusiasm: number;
    }[];
    topAccelerations: {
      id: string;
      investorId: string;
      investorName: string;
      triggerType: string;
      actionType: string;
      description: string;
      urgency: string;
      expectedLift: number;
      confidence: string;
    }[];
  };
  convictionPulse: {
    avgEnthusiasm: number;
    accelerating: number;
    steady: number;
    decelerating: number;
    stalled: number;
    alerts: {
      investorId: string;
      investorName: string;
      previousScore: number;
      currentScore: number;
      drop: number;
    }[];
  };
  processHealth: {
    funnel: Record<string, number>;
    overdueFollowups: number;
    openDocumentFlags: number;
    dataQualityPct: number;
    activeInvestors: number;
    totalMeetings: number;
    meetingsThisWeek: number;
    health: 'green' | 'yellow' | 'red';
  };
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { toast } = useToast();
  const [data, setData] = useState<HealthData | null>(null);
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [dataRoomCount, setDataRoomCount] = useState(0);
  const [tasks, setTasks] = useState<UpcomingTask[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [dataQuality, setDataQuality] = useState<DataQualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [healthRes, pulseRes, docsRes, drRes, tasksRes, actRes, dqRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/pulse'),
        fetch('/api/documents'),
        fetch('/api/data-room'),
        fetch('/api/tasks?type=upcoming&limit=5'),
        fetch('/api/tasks?type=activity&limit=5'),
        fetch('/api/data-quality'),
      ]);
      if (healthRes.ok) setData(await healthRes.json());
      if (pulseRes.ok) setPulse(await pulseRes.json());
      if (docsRes.ok) setDocs(await docsRes.json());
      if (drRes.ok) setDataRoomCount((await drRes.json()).length);
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (actRes.ok) setActivity(await actRes.json());
      if (dqRes.ok) setDataQuality(await dqRes.json());
      setLastRefresh(new Date());
    } catch {
      if (!silent) toast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => fetchData(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function seedData() {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const result = await res.json();
      if (result.ok) {
        toast(`Seeded ${result.seeded} investors`);
      } else {
        toast(`Seed failed: ${result.error}`, 'error');
      }
    } catch (err) {
      toast(`Seed failed: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
    }
    await fetchData();
    setSeeding(false);
  }

  async function executeAcceleration(id: string) {
    try {
      const res = await fetch('/api/acceleration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'executed' }),
      });
      if (res.ok) {
        toast('Action marked as executed');
        fetchData(true);
      }
    } catch {
      toast('Failed to execute action', 'error');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-zinc-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-zinc-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-40 bg-zinc-800/50 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-32 bg-zinc-800/50 rounded-xl animate-pulse" />
          <div className="h-32 bg-zinc-800/50 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Series C Dashboard</h1>
      <div className="border border-red-800/30 bg-red-900/10 rounded-xl p-8 text-center space-y-3">
        <p className="text-zinc-400">Could not load dashboard data.</p>
        <button onClick={() => fetchData()} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">
          Retry
        </button>
      </div>
    </div>
  );

  // Derived data
  const ph = pulse?.processHealth;
  const cp = pulse?.criticalPath;
  const cv = pulse?.convictionPulse;
  const ov = pulse?.overnight;

  const funnelStages = [
    { label: 'Contacted', value: data.funnel.contacted, color: 'bg-zinc-600' },
    { label: 'Meetings', value: data.funnel.meetings, color: 'bg-blue-600' },
    { label: 'Engaged', value: data.funnel.engaged, color: 'bg-purple-600' },
    { label: 'In DD', value: data.funnel.in_dd, color: 'bg-orange-600' },
    { label: 'Term Sheets', value: data.funnel.term_sheets, color: 'bg-green-600' },
    { label: 'Closed', value: data.funnel.closed, color: 'bg-emerald-600' },
  ];

  return (
    <div className="space-y-6">
      {/* ================================================================ */}
      {/* HEADER                                                           */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Series C Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Aerospacelab --- Process Orchestrator
            {lastRefresh && (
              <span className="ml-2 text-zinc-600">
                Last updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs transition-colors">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <div className="absolute right-0 mt-1 w-44 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 hidden group-hover:block z-10">
              {['investors', 'meetings', 'tasks', 'pipeline', 'activity'].map(t => (
                <a key={t} href={`/api/export?type=${t}`} download
                  className="block px-3 py-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 capitalize">
                  {t} CSV
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================ */}
      {/* EMPTY STATE                                                      */}
      {/* ================================================================ */}
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

      {data.totalInvestors > 0 && (
        <>
          {/* ================================================================ */}
          {/* PULSE STRIP - 4 compact metric cards                             */}
          {/* ================================================================ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <PulseCard
              label="Active Investors"
              value={ph?.activeInvestors ?? data.totalInvestors}
              sub={`${data.totalInvestors} total`}
              color="blue"
            />
            <PulseCard
              label="This Week"
              value={ph?.meetingsThisWeek ?? 0}
              sub="meetings"
              color={ph?.meetingsThisWeek && ph.meetingsThisWeek > 0 ? 'green' : 'zinc'}
            />
            <PulseCard
              label="Follow-ups Due"
              value={ph?.overdueFollowups ?? 0}
              sub="overdue"
              color={ph && ph.overdueFollowups > 2 ? 'red' : ph && ph.overdueFollowups > 0 ? 'yellow' : 'green'}
            />
            <PulseCard
              label="Data Quality"
              value={`${ph?.dataQualityPct ?? dataQuality?.overallCompleteness ?? 0}%`}
              sub="completeness"
              color={
                (ph?.dataQualityPct ?? 0) >= 80 ? 'green' :
                (ph?.dataQualityPct ?? 0) >= 50 ? 'yellow' : 'red'
              }
            />
          </div>

          {/* ================================================================ */}
          {/* TOP FOCUS TODAY                                                   */}
          {/* ================================================================ */}
          {cp && cp.topFocus.length > 0 && (
            <div className="border border-blue-800/30 bg-blue-900/5 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-blue-400 uppercase flex items-center gap-2">
                  <Target className="w-4 h-4" /> Top Focus Today
                </h2>
                <Link href="/focus" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  Full priority queue <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {cp.topFocus.map((item, i) => {
                  const scoreColor = item.focusScore >= 70 ? 'text-green-400' : item.focusScore >= 50 ? 'text-yellow-400' : 'text-red-400';
                  const tierColor = item.tier === 1 ? 'text-amber-400' : 'text-zinc-500';
                  const MomentumIcon = item.momentum === 'accelerating' ? TrendingUp
                    : item.momentum === 'decelerating' ? TrendingDown
                    : item.momentum === 'stalled' ? ArrowDownRight
                    : Minus;
                  const momentumColor = item.momentum === 'accelerating' ? 'text-green-400'
                    : item.momentum === 'decelerating' ? 'text-orange-400'
                    : item.momentum === 'stalled' ? 'text-red-400'
                    : 'text-zinc-500';
                  return (
                    <div key={item.investorId} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors">
                      <span className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'
                      }`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/investors/${item.investorId}`} className="text-sm font-medium hover:text-blue-400 transition-colors truncate">
                            {item.investorName}
                          </Link>
                          <span className={`text-[9px] ${tierColor}`}>T{item.tier}</span>
                          <MomentumIcon className={`w-3.5 h-3.5 ${momentumColor}`} />
                        </div>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">{item.recommendedAction}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                          <Timer className="w-3 h-3" /> {item.timeEstimate}
                        </span>
                        <span className={`text-sm font-bold tabular-nums ${scoreColor}`}>{item.focusScore}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* OVERNIGHT + CONVICTION (side by side)                            */}
          {/* ================================================================ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Overnight Activity */}
            <div className="border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-medium text-zinc-400 uppercase flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4" /> Last 24 Hours
              </h2>
              {ov ? (
                <div className="space-y-2.5">
                  {ov.activityFeed.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <span className="text-sm text-zinc-300">{item}</span>
                    </div>
                  ))}
                  {ov.statusChanges.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-zinc-800/50">
                      <div className="text-[10px] text-zinc-500 uppercase mb-1.5">Stage Movements</div>
                      {ov.statusChanges.slice(0, 3).map((sc, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <ArrowUpRight className="w-3 h-3 text-green-400 shrink-0" />
                          <span className="text-xs text-zinc-400">
                            <span className="text-zinc-200 font-medium">{sc.investorName}</span>
                            {' '}{sc.from !== 'unknown' ? `${formatStage(sc.from)} \u2192 ` : ''}{formatStage(sc.to)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {ov.meetingNames.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-zinc-800/50">
                      <div className="text-[10px] text-zinc-500 uppercase mb-1">Meetings Logged</div>
                      <div className="text-xs text-zinc-400">{ov.meetingNames.join(', ')}</div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-zinc-600">Loading overnight data...</p>
              )}
            </div>

            {/* Conviction Radar */}
            <div className="border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-medium text-zinc-400 uppercase flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4" /> Conviction Radar
              </h2>
              {cv ? (
                <div className="space-y-4">
                  {/* Avg enthusiasm */}
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="text-2xl font-bold tabular-nums">{cv.avgEnthusiasm.toFixed(1)}<span className="text-sm text-zinc-500 font-normal">/5</span></div>
                      <div className="text-[10px] text-zinc-500">Avg Enthusiasm</div>
                    </div>
                  </div>

                  {/* Momentum distribution bar */}
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase mb-1.5">Momentum Distribution</div>
                    <div className="flex gap-0.5 h-6 rounded-md overflow-hidden">
                      {cv.accelerating > 0 && (
                        <MomentumBar count={cv.accelerating} total={cv.accelerating + cv.steady + cv.decelerating + cv.stalled}
                          color="bg-green-500" label="Accelerating" />
                      )}
                      {cv.steady > 0 && (
                        <MomentumBar count={cv.steady} total={cv.accelerating + cv.steady + cv.decelerating + cv.stalled}
                          color="bg-blue-500" label="Steady" />
                      )}
                      {cv.decelerating > 0 && (
                        <MomentumBar count={cv.decelerating} total={cv.accelerating + cv.steady + cv.decelerating + cv.stalled}
                          color="bg-orange-500" label="Decelerating" />
                      )}
                      {cv.stalled > 0 && (
                        <MomentumBar count={cv.stalled} total={cv.accelerating + cv.steady + cv.decelerating + cv.stalled}
                          color="bg-red-500" label="Stalled" />
                      )}
                    </div>
                    <div className="flex gap-3 mt-1.5 flex-wrap">
                      {cv.accelerating > 0 && <MomentumLabel count={cv.accelerating} label="Accelerating" color="text-green-400" />}
                      {cv.steady > 0 && <MomentumLabel count={cv.steady} label="Steady" color="text-blue-400" />}
                      {cv.decelerating > 0 && <MomentumLabel count={cv.decelerating} label="Decelerating" color="text-orange-400" />}
                      {cv.stalled > 0 && <MomentumLabel count={cv.stalled} label="Stalled" color="text-red-400" />}
                    </div>
                  </div>

                  {/* Alerts */}
                  {cv.alerts.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-zinc-800/50">
                      <div className="text-[10px] text-red-400 uppercase mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Enthusiasm Drops
                      </div>
                      {cv.alerts.map((alert, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                          <Link href={`/investors/${alert.investorId}`} className="text-xs text-zinc-300 hover:text-blue-400">
                            {alert.investorName}
                          </Link>
                          <span className="text-xs text-red-400 font-medium tabular-nums">
                            {alert.previousScore} {'\u2192'} {alert.currentScore}
                            <span className="text-red-500 ml-1">(-{alert.drop})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-zinc-600">Loading conviction data...</p>
              )}
            </div>
          </div>

          {/* ================================================================ */}
          {/* ACCELERATION ALERTS                                              */}
          {/* ================================================================ */}
          {cp && cp.topAccelerations.length > 0 && (
            <div className="border border-amber-800/30 bg-amber-900/5 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-amber-400 uppercase flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Acceleration Alerts
                </h2>
                <Link href="/acceleration" className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                  All actions <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {cp.topAccelerations.map((accel) => {
                  const urgencyColor = accel.urgency === 'immediate'
                    ? 'bg-red-500/20 text-red-400 border-red-800'
                    : accel.urgency === '48h'
                    ? 'bg-orange-500/20 text-orange-400 border-orange-800'
                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-800';
                  const triggerLabel = accel.triggerType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  return (
                    <div key={accel.id} className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors">
                      <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Link href={`/investors/${accel.investorId}`} className="text-sm font-medium hover:text-blue-400 transition-colors">
                            {accel.investorName}
                          </Link>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${urgencyColor}`}>
                            {accel.urgency === 'immediate' ? 'NOW' : accel.urgency.toUpperCase()}
                          </span>
                          <span className="text-[9px] text-zinc-600">{triggerLabel}</span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">{accel.description}</p>
                      </div>
                      <button
                        onClick={() => executeAcceleration(accel.id)}
                        className="shrink-0 px-3 py-1.5 text-[10px] font-medium bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 rounded-md border border-amber-700/30 transition-colors flex items-center gap-1"
                      >
                        Execute <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* PIPELINE FUNNEL (compact)                                        */}
          {/* ================================================================ */}
          <div className="border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-zinc-400 uppercase">Pipeline</h2>
              <Link href="/pipeline" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                Pipeline view <Columns3 className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex flex-col items-center space-y-1.5">
              {funnelStages.map((stage, i) => {
                const widthPct = Math.max(100 - (i * 13), 25);
                return (
                  <div key={stage.label} className="w-full flex items-center justify-center" style={{ maxWidth: `${widthPct}%` }}>
                    <div className={`${stage.color} w-full rounded-md h-9 flex items-center justify-between px-4 transition-all duration-500`}>
                      <span className="text-xs font-medium text-white/90">{stage.label}</span>
                      <span className="text-sm font-bold">{stage.value}</span>
                    </div>
                  </div>
                );
              })}
              {data.funnel.passed > 0 && (
                <div className="w-full flex items-center justify-center mt-2 pt-2 border-t border-zinc-800" style={{ maxWidth: '50%' }}>
                  <div className="bg-red-600/30 border border-red-800 w-full rounded-md h-7 flex items-center justify-between px-4">
                    <span className="text-xs text-red-400">Passed</span>
                    <span className="text-sm font-bold text-red-400">{data.funnel.passed}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================================================================ */}
          {/* DELIVERABLES QUICK ACCESS                                        */}
          {/* ================================================================ */}
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

          {/* ================================================================ */}
          {/* DATA QUALITY (compact)                                           */}
          {/* ================================================================ */}
          {dataQuality && (
            <div className="border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-zinc-400 uppercase flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Data Quality
                </h2>
                <Link href="/investors" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  Fix gaps <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Overall Completeness</div>
                    <div className={`text-2xl font-bold tabular-nums ${
                      dataQuality.overallCompleteness >= 80 ? 'text-emerald-400' :
                      dataQuality.overallCompleteness >= 50 ? 'text-yellow-400' : 'text-red-400'
                    }`}>{dataQuality.overallCompleteness}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Intelligence Readiness</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            dataQuality.intelligenceReadiness >= 80 ? 'bg-emerald-500' :
                            dataQuality.intelligenceReadiness >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${dataQuality.intelligenceReadiness}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-zinc-400 tabular-nums">{dataQuality.intelligenceReadiness}%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-zinc-500 mb-1">Field Coverage</div>
                  {dataQuality.fieldCompleteness
                    .filter(f => f.field !== 'name' && f.field !== 'type' && f.field !== 'tier' && f.field !== 'status')
                    .map(f => (
                    <div key={f.field} className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500 w-20 truncate">{f.field.replace(/_/g, ' ')}</span>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            f.pct >= 80 ? 'bg-emerald-500' : f.pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${f.pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-600 tabular-nums w-8 text-right">{f.pct}%</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs text-zinc-500 mb-1">Recommendations</div>
                  {dataQuality.recommendations.slice(0, 3).map((rec, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <span className="text-[11px] text-zinc-400 leading-snug">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* UPCOMING TASKS + RECENT ACTIVITY                                 */}
          {/* ================================================================ */}
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

          {/* ================================================================ */}
          {/* QUICK ACTIONS                                                    */}
          {/* ================================================================ */}
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
            <Link href="/pipeline" className="border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 text-center transition-colors">
              <div className="text-sm font-medium">Pipeline</div>
              <div className="text-xs text-zinc-500 mt-1">Kanban board</div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PulseCard({ label, value, sub, color }: {
  label: string;
  value: string | number;
  sub: string;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'zinc';
}) {
  const borderColor = {
    blue: 'border-blue-800/40',
    green: 'border-green-800/40',
    yellow: 'border-yellow-800/40',
    red: 'border-red-800/40',
    zinc: 'border-zinc-800',
  }[color];

  const bgColor = {
    blue: 'bg-blue-900/10',
    green: 'bg-green-900/10',
    yellow: 'bg-yellow-900/10',
    red: 'bg-red-900/10',
    zinc: 'bg-zinc-900/10',
  }[color];

  const valueColor = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    zinc: 'text-zinc-300',
  }[color];

  return (
    <div className={`border ${borderColor} ${bgColor} rounded-xl p-3.5`}>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-0.5 tabular-nums ${valueColor}`}>{value}</div>
      <div className="text-[10px] text-zinc-600 mt-0.5">{sub}</div>
    </div>
  );
}

function MomentumBar({ count, total, color, label }: {
  count: number; total: number; color: string; label: string;
}) {
  const pct = total > 0 ? Math.max((count / total) * 100, 4) : 0;
  return (
    <div
      className={`${color} relative group cursor-default transition-all`}
      style={{ width: `${pct}%` }}
      title={`${label}: ${count}`}
    >
      {pct >= 15 && (
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/80">
          {count}
        </span>
      )}
    </div>
  );
}

function MomentumLabel({ count, label, color }: {
  count: number; label: string; color: string;
}) {
  return (
    <span className={`text-[10px] ${color} flex items-center gap-1`}>
      <span className="font-bold">{count}</span> {label}
    </span>
  );
}

function formatStage(stage: string): string {
  const labels: Record<string, string> = {
    identified: 'Identified', contacted: 'Contacted', nda_signed: 'NDA Signed',
    meeting_scheduled: 'Meeting Set', met: 'Met', engaged: 'Engaged',
    in_dd: 'In DD', term_sheet: 'Term Sheet', closed: 'Closed',
    passed: 'Passed', dropped: 'Dropped',
  };
  return labels[stage] || stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

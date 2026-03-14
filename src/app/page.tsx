'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import {
  FileText, Sparkles, FolderOpen, Table, ArrowRight, ClipboardList,
  Activity, Download, Columns3, Target, Timer, ShieldCheck,
  RefreshCw, Zap, TrendingUp, TrendingDown, Minus, AlertTriangle,
  ChevronRight, Clock, ArrowUpRight, ArrowDownRight, ShieldAlert,
  UserMinus, CalendarClock, Flame, Gauge, CheckCircle2, Mail,
  Calendar, MessageSquare, UserPlus, ArrowUp,
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

interface StressTestSummary {
  target: number;
  forecast: { best: number; base: number; worst: number };
  closeProbability: number;
  onTrack: boolean;
  healthStatus: 'green' | 'yellow' | 'red';
  healthMessage: string;
}

interface ScoreReversalItem {
  investorId: string;
  investorName: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  previousDate: string;
  currentDate: string;
  severity: 'critical' | 'warning' | 'notable';
}

interface StaleInvestorItem {
  investorId: string;
  investorName: string;
  tier: number;
  daysSinceLastMeeting: number | null;
  acceleration: 'gone_silent' | 'decelerating';
  signal: string;
}

interface AtRiskData {
  scoreReversals: ScoreReversalItem[];
  staleInvestors: StaleInvestorItem[];
}

interface DealHeatInvestor {
  id: string;
  name: string;
  type: string;
  tier: number;
  status: string;
  dealHeat: { heat: number; label: 'hot' | 'warm' | 'cool' | 'cold' | 'frozen'; drivers: string[] };
  enthusiasm: number;
  lastMeeting: string | null;
}

interface DealHeatResponse {
  investors: DealHeatInvestor[];
  counts: { hot: number; warm: number; cool: number; cold: number; frozen: number; total: number };
  generated_at: string;
}

interface FollowupItem {
  id: string;
  meeting_id: string;
  investor_id: string;
  investor_name: string;
  action_type: string;
  description: string;
  due_at: string;
  status: string;
  completed_at: string | null;
}

interface VelocityInvestor {
  investor_id: string;
  investor_name: string;
  status: string;
  days_in_process: number;
  meetings_per_week: number;
  velocity_score: number;
  tracking_status: 'on_track' | 'behind' | 'at_risk';
}

interface VelocityResponse {
  investors: VelocityInvestor[];
  summary: {
    total_active: number;
    on_track: number;
    behind: number;
    at_risk: number;
    avg_velocity_score: number;
    avg_days_in_process: number;
    raise_days_elapsed: number;
    raise_target_days: number;
  };
  generated_at: string;
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
      trajectoryNote?: string;
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
  const [stressTest, setStressTest] = useState<StressTestSummary | null>(null);
  const [atRisk, setAtRisk] = useState<AtRiskData | null>(null);
  const [dealHeat, setDealHeat] = useState<DealHeatResponse | null>(null);
  const [pendingFollowups, setPendingFollowups] = useState<FollowupItem[]>([]);
  const [velocity, setVelocity] = useState<VelocityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [healthRes, pulseRes, docsRes, drRes, tasksRes, actRes, dqRes, stRes, arRes, dhRes, fuRes, velRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/pulse'),
        fetch('/api/documents'),
        fetch('/api/data-room'),
        fetch('/api/tasks?type=upcoming&limit=5'),
        fetch('/api/tasks?type=activity&limit=10'),
        fetch('/api/data-quality'),
        fetch('/api/stress-test'),
        fetch('/api/at-risk'),
        fetch('/api/deal-heat'),
        fetch('/api/followups?view=pending'),
        fetch('/api/velocity'),
      ]);
      if (healthRes.ok) setData(await healthRes.json());
      if (pulseRes.ok) setPulse(await pulseRes.json());
      if (docsRes.ok) setDocs(await docsRes.json());
      if (drRes.ok) setDataRoomCount((await drRes.json()).length);
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (actRes.ok) setActivity(await actRes.json());
      if (dqRes.ok) setDataQuality(await dqRes.json());
      if (stRes.ok) setStressTest(await stRes.json());
      if (arRes.ok) setAtRisk(await arRes.json());
      if (dhRes.ok) setDealHeat(await dhRes.json());
      if (fuRes.ok) setPendingFollowups(await fuRes.json());
      if (velRes.ok) setVelocity(await velRes.json());
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div>
          <div className="skeleton" style={{ height: '32px', width: '200px' }} />
          <div className="skeleton" style={{ height: '16px', width: '280px', marginTop: 'var(--space-2)' }} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 'var(--space-3)' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '88px', borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: '140px', borderRadius: 'var(--radius-lg)' }} />
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 'var(--space-4)' }}>
          <div className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-lg)' }} />
          <div className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-lg)' }} />
        </div>
      </div>
    );
  }

  if (!data) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      <h1 className="page-title">Dashboard</h1>
      <div
        className="text-center"
        style={{
          border: '1px solid rgba(196,90,90,0.15)',
          background: 'var(--danger-muted)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-10)',
        }}
      >
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>Could not load dashboard data.</p>
        <button onClick={() => fetchData()} className="btn btn-secondary btn-md">
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

  const identifiedCount = data.totalInvestors - data.funnel.contacted - (data.funnel.passed ?? 0);
  const funnelStages = [
    { label: 'Identified', value: identifiedCount > 0 ? identifiedCount : 0, bg: 'var(--text-muted)' },
    { label: 'Contacted', value: data.funnel.contacted, bg: 'var(--text-tertiary)' },
    { label: 'Meetings', value: data.funnel.meetings, bg: 'var(--accent)' },
    { label: 'Engaged', value: data.funnel.engaged, bg: '#8b6ef5' },
    { label: 'In DD', value: data.funnel.in_dd, bg: '#e08050' },
    { label: 'Term Sheets', value: data.funnel.term_sheets, bg: 'var(--success)' },
    { label: 'Closed', value: data.funnel.closed, bg: '#4a9e6e' },
  ];

  return (
    <div className="space-y-6 page-content">
      {/* ================================================================ */}
      {/* HEADER                                                           */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Your raise at a glance
            {lastRefresh && (
              <span style={{ marginLeft: 'var(--space-3)', color: 'var(--text-muted)' }}>
                Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <div className="relative group">
            <button className="btn btn-secondary btn-sm">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <div
              className="absolute right-0 mt-1 py-1 hidden group-hover:block z-10"
              style={{
                width: '176px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {['investors', 'meetings', 'tasks', 'pipeline', 'activity'].map(t => (
                <a
                  key={t}
                  href={`/api/export?type=${t}`}
                  download
                  className="block capitalize transition-colors"
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                >
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
        <div
          className="text-center"
          style={{
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-12) var(--space-8)',
            background: 'var(--surface-1)',
          }}
        >
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>Initialize Your Fundraise</h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', maxWidth: '28rem', margin: 'var(--space-3) auto var(--space-6)' }}>
            Seed the database with ASL Series C investor targets and configuration, or add investors manually.
          </p>
          <div className="flex justify-center" style={{ gap: 'var(--space-3)' }}>
            <button
              onClick={seedData}
              disabled={seeding}
              className="btn btn-primary btn-md disabled:opacity-50"
            >
              {seeding ? 'Seeding...' : 'Seed ASL Data'}
            </button>
            <Link href="/investors" className="btn btn-secondary btn-md">
              Add Manually
            </Link>
          </div>
        </div>
      )}

      {data.totalInvestors > 0 && (
        <>
          {/* ================================================================ */}
          {/* RAISE PROGRESS HERO                                              */}
          {/* ================================================================ */}
          {stressTest ? (() => {
            const pct = Math.min(100, Math.round((stressTest.forecast.base / stressTest.target) * 100));
            const amountColor = stressTest.healthStatus === 'green'
              ? 'var(--success)'
              : stressTest.healthStatus === 'yellow'
                ? 'var(--warning)'
                : 'var(--danger)';
            return (
              <Link href="/stress-test" style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-xl)',
                    padding: 'var(--space-6)',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(74, 111, 165, 0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                >
                  {/* Top accent gradient line */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: `linear-gradient(90deg, ${amountColor} 0%, transparent ${Math.max(pct, 5)}%, transparent 100%)`,
                    borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
                  }} />
                  <div className="flex items-baseline gap-3" style={{ marginBottom: 'var(--space-4)' }}>
                    <span style={{
                      fontSize: 'var(--font-size-3xl)',
                      fontWeight: 700,
                      color: amountColor,
                      lineHeight: 1,
                      letterSpacing: '-0.02em',
                    }}>
                      €{Math.round(stressTest.forecast.base)}M
                    </span>
                    <span style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--text-muted)',
                    }}>
                      of €{stressTest.target}M target
                    </span>
                  </div>

                  <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-5)' }}>
                    <div style={{
                      flex: 1,
                      height: '8px',
                      borderRadius: '4px',
                      background: 'var(--surface-3)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        borderRadius: '4px',
                        background: amountColor,
                        transition: 'width 0.4s ease',
                        boxShadow: 'none',
                      }} />
                    </div>
                    {velocity?.summary?.raise_days_elapsed != null && velocity?.summary?.raise_target_days != null && (
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        fontWeight: 500,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border-subtle)',
                      }}>
                        Day {velocity.summary.raise_days_elapsed} of {velocity.summary.raise_target_days}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>
                        Best Case
                      </div>
                      <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        €{Math.round(stressTest.forecast.best)}M
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>
                        Close Probability
                      </div>
                      <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {stressTest.closeProbability}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>
                        On Track Status
                      </div>
                      <div style={{
                        fontSize: 'var(--font-size-lg)',
                        fontWeight: 600,
                        color: stressTest.onTrack ? 'var(--success)' : 'var(--danger)',
                      }}>
                        {stressTest.onTrack ? 'On Track' : 'Off Track'}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })() : (
            <div style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
            }}>
              <div className="skeleton" style={{ height: '48px', width: '220px', marginBottom: 'var(--space-4)', borderRadius: 'var(--radius-md)' }} />
              <div className="skeleton" style={{ height: '8px', width: '100%', marginBottom: 'var(--space-5)', borderRadius: '4px' }} />
              <div className="grid grid-cols-3 gap-4">
                <div className="skeleton" style={{ height: '40px', borderRadius: 'var(--radius-md)' }} />
                <div className="skeleton" style={{ height: '40px', borderRadius: 'var(--radius-md)' }} />
                <div className="skeleton" style={{ height: '40px', borderRadius: 'var(--radius-md)' }} />
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* PULSE STRIP - 4 compact metric cards                             */}
          {/* ================================================================ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 card-stagger">
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
          {/* PIPELINE VELOCITY STRIP                                          */}
          {/* ================================================================ */}
          {velocity && (
            <VelocityStrip velocity={velocity} />
          )}

          {/* ================================================================ */}
          {/* CLOSE FORECAST WIDGET                                            */}
          {/* ================================================================ */}
          {stressTest && (
            <Link href="/stress-test" className="block group">
              <div
                className="rounded-xl p-5 transition-colors"
                style={{
                  border: `1px solid ${
                    stressTest.healthStatus === 'green'
                      ? 'rgba(74,158,110,0.25)'
                      : stressTest.healthStatus === 'yellow'
                      ? 'rgba(196,163,90,0.25)'
                      : 'rgba(196,90,90,0.25)'
                  }`,
                  background: stressTest.healthStatus === 'green'
                    ? 'rgba(74,158,110,0.03)'
                    : stressTest.healthStatus === 'yellow'
                    ? 'rgba(196,163,90,0.03)'
                    : 'rgba(196,90,90,0.03)',
                }}
                onMouseEnter={e => {
                  const borderColor = stressTest.healthStatus === 'green'
                    ? 'rgba(74,158,110,0.4)'
                    : stressTest.healthStatus === 'yellow'
                    ? 'rgba(196,163,90,0.4)'
                    : 'rgba(196,90,90,0.4)';
                  (e.currentTarget as HTMLElement).style.borderColor = borderColor;
                }}
                onMouseLeave={e => {
                  const borderColor = stressTest.healthStatus === 'green'
                    ? 'rgba(74,158,110,0.25)'
                    : stressTest.healthStatus === 'yellow'
                    ? 'rgba(196,163,90,0.25)'
                    : 'rgba(196,90,90,0.25)';
                  (e.currentTarget as HTMLElement).style.borderColor = borderColor;
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2
                    className="uppercase flex items-center gap-2"
                    style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}
                  >
                    <ShieldAlert className="w-4 h-4" /> Close Forecast
                  </h2>
                  <span
                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}
                  >
                    Full stress test <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target</div>
                    <div
                      className="tabular-nums mt-0.5"
                      style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)' }}
                    >
                      EUR {stressTest.target >= 1000 ? `${(stressTest.target / 1000).toFixed(1).replace(/\.0$/, '')}Bn` : `${stressTest.target}M`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Forecast (Base)</div>
                    <div
                      className="tabular-nums mt-0.5"
                      style={{
                        fontSize: 'var(--font-size-xl)',
                        fontWeight: 700,
                        color: stressTest.forecast.base >= stressTest.target ? 'var(--success)' : 'var(--warning)',
                      }}
                    >
                      EUR {stressTest.forecast.base >= 1000 ? `${(stressTest.forecast.base / 1000).toFixed(1).replace(/\.0$/, '')}Bn` : `${Math.round(stressTest.forecast.base)}M`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Probability</div>
                    <div
                      className="tabular-nums mt-0.5"
                      style={{
                        fontSize: 'var(--font-size-xl)',
                        fontWeight: 700,
                        color: stressTest.closeProbability >= 60
                          ? 'var(--success)'
                          : stressTest.closeProbability >= 30
                          ? 'var(--warning)'
                          : 'var(--danger)',
                      }}
                    >
                      {stressTest.closeProbability}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</div>
                    <div
                      className="rounded-md inline-block mt-1 px-2.5 py-1"
                      style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 600,
                        background: stressTest.healthStatus === 'green'
                          ? 'var(--success-muted)'
                          : stressTest.healthStatus === 'yellow'
                          ? 'var(--warning-muted)'
                          : 'var(--danger-muted)',
                        color: stressTest.healthStatus === 'green'
                          ? 'var(--success)'
                          : stressTest.healthStatus === 'yellow'
                          ? 'var(--warning)'
                          : 'var(--danger)',
                        border: `1px solid ${
                          stressTest.healthStatus === 'green'
                            ? 'rgba(74,158,110,0.2)'
                            : stressTest.healthStatus === 'yellow'
                            ? 'rgba(196,163,90,0.2)'
                            : 'rgba(196,90,90,0.2)'
                        }`,
                      }}
                    >
                      {stressTest.onTrack ? 'On Track' : stressTest.healthStatus === 'red' ? 'Critical' : 'At Risk'}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* ================================================================ */}
          {/* AT RISK DEALS                                                     */}
          {/* ================================================================ */}
          {atRisk && (atRisk.scoreReversals.length > 0 || atRisk.staleInvestors.length > 0) && (
            <div
              className="rounded-xl p-5"
              style={{ border: '1px solid rgba(196,90,90,0.2)', background: 'rgba(196,90,90,0.03)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="uppercase flex items-center gap-2"
                  style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--danger)' }}
                >
                  <ShieldAlert className="w-4 h-4" /> At Risk
                </h2>
                <span
                  className="px-2 py-0.5 rounded-md tabular-nums"
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    background: 'var(--danger-muted)',
                    color: 'var(--danger)',
                    border: '1px solid rgba(196,90,90,0.2)',
                  }}
                >
                  {atRisk.scoreReversals.length + atRisk.staleInvestors.length} deal{atRisk.scoreReversals.length + atRisk.staleInvestors.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2">
                {/* Score Reversals */}
                {atRisk.scoreReversals.map((rev) => {
                  const isCritical = rev.severity === 'critical';
                  const sevLabel = rev.severity === 'critical' ? 'CRITICAL' : rev.severity === 'warning' ? 'WARNING' : 'NOTABLE';
                  const sevBg = isCritical ? 'var(--danger-muted)' : 'var(--warning-muted)';
                  const sevColor = isCritical ? 'var(--danger)' : 'var(--warning)';
                  const sevBorder = isCritical ? 'rgba(196,90,90,0.3)' : 'rgba(196,163,90,0.3)';
                  return (
                    <div
                      key={`rev-${rev.investorId}`}
                      className="flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <span className="mt-0.5 shrink-0" style={{ color: sevColor }}>
                        <TrendingDown className="w-4 h-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Link
                            href={`/investors/${rev.investorId}`}
                            className="transition-colors truncate"
                            style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                          >
                            {rev.investorName}
                          </Link>
                          <span
                            className="px-1.5 py-0.5 rounded shrink-0"
                            style={{
                              fontSize: '9px',
                              background: sevBg,
                              color: sevColor,
                              border: `1px solid ${sevBorder}`,
                            }}
                          >
                            {sevLabel}
                          </span>
                        </div>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                          Score dropped{' '}
                          <span className="tabular-nums" style={{ fontWeight: 600, color: 'var(--danger)' }}>
                            {rev.previousScore} {'\u2192'} {rev.currentScore}
                          </span>
                          <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>({rev.delta})</span>
                        </p>
                      </div>
                      <Link
                        href={`/investors/${rev.investorId}`}
                        className="shrink-0 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1"
                        style={{
                          fontSize: '10px',
                          fontWeight: 500,
                          background: 'var(--danger-muted)',
                          color: 'var(--danger)',
                          border: '1px solid rgba(196,90,90,0.2)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(196,90,90,0.2)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--danger-muted)'; }}
                      >
                        Schedule follow-up <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  );
                })}

                {/* Stale T1/T2 Investors */}
                {atRisk.staleInvestors.map((inv) => {
                  const isSilent = inv.acceleration === 'gone_silent';
                  return (
                    <div
                      key={`stale-${inv.investorId}`}
                      className="flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <span className="mt-0.5 shrink-0" style={{ color: isSilent ? 'var(--danger)' : 'var(--warning)' }}>
                        {isSilent ? <UserMinus className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Link
                            href={`/investors/${inv.investorId}`}
                            className="transition-colors truncate"
                            style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                          >
                            {inv.investorName}
                          </Link>
                          <span style={{ fontSize: '9px', color: inv.tier === 1 ? '#d4be82' : 'var(--text-muted)' }}>T{inv.tier}</span>
                          <span
                            className="px-1.5 py-0.5 rounded shrink-0"
                            style={{
                              fontSize: '9px',
                              background: isSilent ? 'var(--danger-muted)' : 'var(--warning-muted)',
                              color: isSilent ? 'var(--danger)' : 'var(--warning)',
                              border: `1px solid ${isSilent ? 'rgba(196,90,90,0.3)' : 'rgba(196,163,90,0.3)'}`,
                            }}
                          >
                            {isSilent ? 'SILENT' : 'SLOWING'}
                          </span>
                        </div>
                        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                          {inv.daysSinceLastMeeting !== null
                            ? `No contact in ${inv.daysSinceLastMeeting} days`
                            : inv.signal}
                        </p>
                      </div>
                      <Link
                        href={`/investors/${inv.investorId}`}
                        className="shrink-0 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1"
                        style={{
                          fontSize: '10px',
                          fontWeight: 500,
                          background: isSilent ? 'var(--danger-muted)' : 'var(--warning-muted)',
                          color: isSilent ? 'var(--danger)' : 'var(--warning)',
                          border: `1px solid ${isSilent ? 'rgba(196,90,90,0.2)' : 'rgba(196,163,90,0.2)'}`,
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.background = isSilent ? 'rgba(196,90,90,0.2)' : 'rgba(196,163,90,0.2)';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = isSilent ? 'var(--danger-muted)' : 'var(--warning-muted)';
                        }}
                      >
                        Schedule follow-up <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* TOP FOCUS TODAY                                                   */}
          {/* ================================================================ */}
          {cp && cp.topFocus.length > 0 && (
            <div
              className="rounded-xl p-5"
              style={{ border: '1px solid rgba(74,111,165,0.2)', background: 'rgba(74,111,165,0.03)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="uppercase flex items-center gap-2"
                  style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--accent)' }}
                >
                  <Target className="w-4 h-4" /> Top Focus Today
                </h2>
                <Link
                  href="/focus"
                  className="flex items-center gap-1"
                  style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#6a8fc0'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                >
                  Full priority queue <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {cp.topFocus.map((item, i) => {
                  const scoreColor = item.focusScore >= 70 ? 'var(--success)' : item.focusScore >= 50 ? 'var(--warning)' : 'var(--danger)';
                  const tierColor = item.tier === 1 ? '#d4be82' : 'var(--text-muted)';
                  const MomentumIcon = item.momentum === 'accelerating' ? TrendingUp
                    : item.momentum === 'decelerating' ? TrendingDown
                    : item.momentum === 'stalled' ? ArrowDownRight
                    : Minus;
                  const momentumColor = item.momentum === 'accelerating' ? 'var(--success)'
                    : item.momentum === 'decelerating' ? '#a58a5a'
                    : item.momentum === 'stalled' ? 'var(--danger)'
                    : 'var(--text-muted)';
                  return (
                    <div
                      key={item.investorId}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <span
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 700,
                          background: i === 0 ? 'var(--accent)' : 'var(--surface-3)',
                          color: i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/investors/${item.investorId}`}
                            className="truncate transition-colors"
                            style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                          >
                            {item.investorName}
                          </Link>
                          <span style={{ fontSize: '9px', color: tierColor }}>T{item.tier}</span>
                          <MomentumIcon className="w-3.5 h-3.5" style={{ color: momentumColor }} />
                        </div>
                        <p className="truncate mt-0.5" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{item.recommendedAction}</p>
                        {item.trajectoryNote && (
                          <p
                            className="mt-0.5"
                            style={{
                              fontSize: '10px',
                              color: item.trajectoryNote.includes('Accelerating') ? 'var(--success)' : '#a58a5a',
                            }}
                          >
                            {item.trajectoryNote}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="flex items-center gap-1" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          <Timer className="w-3 h-3" /> {item.timeEstimate}
                        </span>
                        <span className="tabular-nums" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: scoreColor }}>{item.focusScore}</span>
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
            <div className="rounded-xl p-5" style={{ border: '1px solid var(--border-default)' }}>
              <h2
                className="uppercase flex items-center gap-2 mb-3"
                style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}
              >
                <Clock className="w-4 h-4" /> Last 24 Hours
              </h2>
              {ov ? (
                <div className="space-y-2.5">
                  {ov.activityFeed.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--accent)' }} />
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>{item}</span>
                    </div>
                  ))}
                  {ov.statusChanges.length > 0 && (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <div className="mb-1.5" style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Stage Movements</div>
                      {ov.statusChanges.slice(0, 3).map((sc, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <ArrowUpRight className="w-3 h-3 shrink-0" style={{ color: 'var(--success)' }} />
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{sc.investorName}</span>
                            {' '}{sc.from !== 'unknown' ? `${formatStage(sc.from)} \u2192 ` : ''}{formatStage(sc.to)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {ov.meetingNames.length > 0 && (
                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <div className="mb-1" style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Meetings Logged</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{ov.meetingNames.join(', ')}</div>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Loading overnight data...</p>
              )}
            </div>

            {/* Conviction Radar */}
            <div className="rounded-xl p-5" style={{ border: '1px solid var(--border-default)' }}>
              <h2
                className="uppercase flex items-center gap-2 mb-3"
                style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}
              >
                <Activity className="w-4 h-4" /> Conviction Radar
              </h2>
              {cv ? (
                <div className="space-y-4">
                  {/* Avg enthusiasm */}
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="tabular-nums" style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>
                        {cv.avgEnthusiasm.toFixed(1)}
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: 400 }}>/5</span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Avg Enthusiasm</div>
                    </div>
                  </div>

                  {/* Momentum distribution bar */}
                  <div>
                    <div className="mb-1.5" style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Momentum Distribution</div>
                    <div className="flex gap-0.5 h-6 rounded-md overflow-hidden">
                      {cv.accelerating > 0 && (
                        <MomentumBar count={cv.accelerating} total={cv.accelerating + cv.steady + cv.decelerating + cv.stalled}
                          bg="var(--success)" label="Accelerating" />
                      )}
                      {cv.steady > 0 && (
                        <MomentumBar count={cv.steady} total={cv.accelerating + cv.steady + cv.decelerating + cv.stalled}
                          bg="var(--accent)" label="Steady" />
                      )}
                      {cv.decelerating > 0 && (
                        <MomentumBar count={cv.decelerating} total={cv.accelerating + cv.steady + cv.decelerating + cv.stalled}
                          bg="#a58a5a" label="Decelerating" />
                      )}
                      {cv.stalled > 0 && (
                        <MomentumBar count={cv.stalled} total={cv.accelerating + cv.steady + cv.decelerating + cv.stalled}
                          bg="var(--danger)" label="Stalled" />
                      )}
                    </div>
                    <div className="flex gap-3 mt-1.5 flex-wrap">
                      {cv.accelerating > 0 && <MomentumLabel count={cv.accelerating} label="Accelerating" color="var(--success)" />}
                      {cv.steady > 0 && <MomentumLabel count={cv.steady} label="Steady" color="var(--accent)" />}
                      {cv.decelerating > 0 && <MomentumLabel count={cv.decelerating} label="Decelerating" color="#a58a5a" />}
                      {cv.stalled > 0 && <MomentumLabel count={cv.stalled} label="Stalled" color="var(--danger)" />}
                    </div>
                  </div>

                  {/* Alerts */}
                  {cv.alerts.length > 0 && (
                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <div className="mb-1.5 flex items-center gap-1" style={{ fontSize: '10px', color: 'var(--danger)', textTransform: 'uppercase' }}>
                        <AlertTriangle className="w-3 h-3" /> Enthusiasm Drops
                      </div>
                      {cv.alerts.map((alert, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                          <Link
                            href={`/investors/${alert.investorId}`}
                            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                          >
                            {alert.investorName}
                          </Link>
                          <span className="tabular-nums" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger)', fontWeight: 500 }}>
                            {alert.previousScore} {'\u2192'} {alert.currentScore}
                            <span style={{ color: 'var(--danger)', marginLeft: '4px' }}>(-{alert.drop})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Loading conviction data...</p>
              )}
            </div>
          </div>

          {/* ================================================================ */}
          {/* ACCELERATION ALERTS                                              */}
          {/* ================================================================ */}
          {cp && cp.topAccelerations.length > 0 && (
            <div
              className="rounded-xl p-5"
              style={{ border: '1px solid rgba(196,163,90,0.2)', background: 'rgba(196,163,90,0.03)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="uppercase flex items-center gap-2"
                  style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--warning)' }}
                >
                  <Zap className="w-4 h-4" /> Acceleration Alerts
                </h2>
                <Link
                  href="/focus"
                  className="flex items-center gap-1"
                  style={{ fontSize: 'var(--font-size-xs)', color: 'var(--warning)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#d4be82'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--warning)'; }}
                >
                  All actions <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {cp.topAccelerations.map((accel) => {
                  const urgencyStyles = accel.urgency === 'immediate'
                    ? { background: 'var(--danger-muted)', color: 'var(--danger)', borderColor: 'rgba(196,90,90,0.3)' }
                    : accel.urgency === '48h'
                    ? { background: 'rgba(249,115,22,0.12)', color: '#a58a5a', borderColor: 'rgba(249,115,22,0.3)' }
                    : { background: 'var(--warning-muted)', color: 'var(--warning)', borderColor: 'rgba(196,163,90,0.3)' };
                  const triggerLabel = accel.triggerType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  return (
                    <div
                      key={accel.id}
                      className="flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <Zap className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Link
                            href={`/investors/${accel.investorId}`}
                            className="transition-colors"
                            style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                          >
                            {accel.investorName}
                          </Link>
                          <span
                            className="px-1.5 py-0.5 rounded"
                            style={{
                              fontSize: '9px',
                              background: urgencyStyles.background,
                              color: urgencyStyles.color,
                              border: `1px solid ${urgencyStyles.borderColor}`,
                            }}
                          >
                            {accel.urgency === 'immediate' ? 'NOW' : accel.urgency.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{triggerLabel}</span>
                        </div>
                        <p className="leading-relaxed" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{accel.description}</p>
                      </div>
                      <button
                        onClick={() => executeAcceleration(accel.id)}
                        className="shrink-0 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1"
                        style={{
                          fontSize: '10px',
                          fontWeight: 500,
                          background: 'rgba(196,163,90,0.12)',
                          color: '#d4be82',
                          border: '1px solid rgba(196,163,90,0.2)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(196,163,90,0.25)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(196,163,90,0.12)'; }}
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
          {/* HOT DEALS + UPCOMING FOLLOW-UPS (side by side)                   */}
          {/* ================================================================ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Hot Deals */}
            <div className="rounded-xl p-5" style={{ border: '1px solid rgba(249,115,22,0.2)', background: 'rgba(249,115,22,0.02)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="uppercase flex items-center gap-2"
                  style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: '#a58a5a' }}
                >
                  <Flame className="w-4 h-4" /> Hot Deals
                </h2>
                <Link
                  href="/dealflow"
                  className="flex items-center gap-1"
                  style={{ fontSize: 'var(--font-size-xs)', color: '#a58a5a' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#d4be82'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#a58a5a'; }}
                >
                  All deals <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {dealHeat && dealHeat.investors.length > 0 ? (
                <div className="space-y-1.5">
                  {dealHeat.investors.slice(0, 5).map((inv) => (
                    <HotDealRow key={inv.id} investor={inv} />
                  ))}
                </div>
              ) : (
                <div style={{ padding: 'var(--space-2) 0' }}>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>No active deals scored yet</p>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)', opacity: 0.7 }}>Log meetings to generate deal heat scores</p>
                </div>
              )}
            </div>

            {/* Upcoming Follow-ups */}
            <div className="rounded-xl p-5" style={{ border: '1px solid rgba(74,111,165,0.2)', background: 'rgba(74,111,165,0.02)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="uppercase flex items-center gap-2"
                  style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--accent)' }}
                >
                  <CheckCircle2 className="w-4 h-4" /> Upcoming Follow-ups
                </h2>
                <Link
                  href="/followups"
                  className="flex items-center gap-1"
                  style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#6a8fc0'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                >
                  All follow-ups <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {pendingFollowups.length > 0 ? (
                <div className="space-y-1.5">
                  {pendingFollowups.slice(0, 5).map((fu) => (
                    <FollowupRow key={fu.id} followup={fu} onComplete={(id) => {
                      setPendingFollowups(prev => prev.filter(f => f.id !== id));
                      fetch('/api/followups', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'completed' }) });
                    }} />
                  ))}
                </div>
              ) : (
                <div style={{ padding: 'var(--space-2) 0' }}>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>No pending follow-ups</p>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)', opacity: 0.7 }}>Follow-ups are created after meeting debriefs</p>
                </div>
              )}
            </div>
          </div>

          {/* ================================================================ */}
          {/* PIPELINE FUNNEL (compact)                                        */}
          {/* ================================================================ */}
          <div className="rounded-xl p-5" style={{ border: '1px solid var(--border-default)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="uppercase" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}>Pipeline</h2>
              <Link
                href="/pipeline"
                className="flex items-center gap-1"
                style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#6a8fc0'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              >
                Pipeline view <Columns3 className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex flex-col items-center space-y-1.5">
              {funnelStages.map((stage, i) => {
                const widthPct = Math.max(100 - (i * 13), 25);
                return (
                  <div key={stage.label} className="w-full flex items-center justify-center" style={{ maxWidth: `${widthPct}%` }}>
                    <div
                      className="w-full rounded-md h-9 flex items-center justify-between px-4 transition-all duration-500"
                      style={{ background: stage.bg }}
                    >
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>{stage.label}</span>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>{stage.value}</span>
                    </div>
                  </div>
                );
              })}
              {data.funnel.passed > 0 && (
                <div className="w-full flex items-center justify-center mt-2 pt-2" style={{ maxWidth: '50%', borderTop: '1px solid var(--border-default)' }}>
                  <div
                    className="w-full rounded-md h-7 flex items-center justify-between px-4"
                    style={{
                      background: 'var(--danger-muted)',
                      border: '1px solid rgba(196,90,90,0.3)',
                    }}
                  >
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger)' }}>Passed</span>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--danger)' }}>{data.funnel.passed}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================================================================ */}
          {/* DELIVERABLES QUICK ACCESS                                        */}
          {/* ================================================================ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href="/workspace"
              className="group rounded-xl p-4 transition-colors"
              style={{ border: '1px solid var(--border-default)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,111,165,0.3)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
            >
              <Sparkles className="w-5 h-5 mb-2" style={{ color: 'var(--accent)' }} />
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Workspace</div>
              <div className="mt-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {docs.length > 0 ? `${docs.length} document${docs.length !== 1 ? 's' : ''}` : 'Create deliverables'}
              </div>
              <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
                Open <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
            <Link
              href="/data-room"
              className="group rounded-xl p-4 transition-colors"
              style={{ border: '1px solid var(--border-default)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,111,165,0.3)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
            >
              <FolderOpen className="w-5 h-5 mb-2" style={{ color: '#6a8fc0' }} />
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Data Room</div>
              <div className="mt-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {dataRoomCount > 0 ? `${dataRoomCount} file${dataRoomCount !== 1 ? 's' : ''} uploaded` : 'Upload source materials'}
              </div>
              <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
                Open <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
            <Link
              href="/model"
              className="group rounded-xl p-4 transition-colors"
              style={{ border: '1px solid var(--border-default)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,111,165,0.3)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
            >
              <Table className="w-5 h-5 mb-2" style={{ color: 'var(--success)' }} />
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Financial Model</div>
              <div className="mt-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Build & refine with AI</div>
              <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
                Open <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
            <Link
              href="/documents"
              className="group rounded-xl p-4 transition-colors"
              style={{ border: '1px solid var(--border-default)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(74,111,165,0.3)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
            >
              <FileText className="w-5 h-5 mb-2" style={{ color: '#a58a5a' }} />
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>Documents</div>
              <div className="mt-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {docs.length > 0 ? `${docs.filter(d => d.status === 'draft').length} drafts` : 'Version history'}
              </div>
              <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
                Open <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          </div>

          {/* ================================================================ */}
          {/* DATA QUALITY (compact)                                           */}
          {/* ================================================================ */}
          {dataQuality && (
            <div className="rounded-xl p-5" style={{ border: '1px solid var(--border-default)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="uppercase flex items-center gap-2"
                  style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}
                >
                  <ShieldCheck className="w-4 h-4" /> Data Quality
                </h2>
                <Link
                  href="/investors"
                  className="flex items-center gap-1"
                  style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#6a8fc0'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                >
                  Fix gaps <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <div>
                    <div className="mb-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Overall Completeness</div>
                    <div
                      className="tabular-nums"
                      style={{
                        fontSize: 'var(--font-size-2xl)',
                        fontWeight: 700,
                        color: dataQuality.overallCompleteness >= 80 ? 'var(--success)'
                          : dataQuality.overallCompleteness >= 50 ? 'var(--warning)' : 'var(--danger)',
                      }}
                    >{dataQuality.overallCompleteness}%</div>
                  </div>
                  <div>
                    <div className="mb-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Intelligence Readiness</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${dataQuality.intelligenceReadiness}%`,
                            background: dataQuality.intelligenceReadiness >= 80 ? 'var(--success)'
                              : dataQuality.intelligenceReadiness >= 50 ? 'var(--warning)' : 'var(--danger)',
                          }}
                        />
                      </div>
                      <span className="tabular-nums" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--text-secondary)' }}>{dataQuality.intelligenceReadiness}%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="mb-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Field Coverage</div>
                  {dataQuality.fieldCompleteness
                    .filter(f => f.field !== 'name' && f.field !== 'type' && f.field !== 'tier' && f.field !== 'status')
                    .map(f => (
                    <div key={f.field} className="flex items-center gap-2">
                      <span className="w-20 truncate" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{f.field.replace(/_/g, ' ')}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${f.pct}%`,
                            background: f.pct >= 80 ? 'var(--success)' : f.pct >= 50 ? 'var(--warning)' : 'var(--danger)',
                          }}
                        />
                      </div>
                      <span className="tabular-nums w-8 text-right" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{f.pct}%</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <div className="mb-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Recommendations</div>
                  {dataQuality.recommendations.slice(0, 3).map((rec, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--accent)' }} />
                      <span className="leading-snug" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{rec}</span>
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
            <div className="rounded-xl p-5" style={{ border: '1px solid var(--border-default)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="uppercase flex items-center gap-2"
                  style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}
                >
                  <ClipboardList className="w-4 h-4" /> Upcoming Tasks
                </h2>
                <Link
                  href="/timeline"
                  className="flex items-center gap-1"
                  style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#6a8fc0'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                >
                  All tasks <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {tasks.length === 0 ? (
                <div style={{ padding: 'var(--space-2) 0' }}>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>No upcoming tasks</p>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)', opacity: 0.7 }}>Tasks are generated from meetings and AI analysis</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map(t => {
                    const overdue = t.due_date && new Date(t.due_date) < new Date();
                    const prioColor = { critical: 'var(--danger)', high: '#a58a5a', medium: 'var(--warning)', low: 'var(--text-muted)' }[t.priority] || 'var(--text-muted)';
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between py-1.5 px-2 rounded"
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <div className="min-w-0">
                          <div className="truncate" style={{ fontSize: 'var(--font-size-sm)' }}>{t.title}</div>
                          {t.investor_name && <div className="truncate" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{t.investor_name}</div>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span style={{ fontSize: '10px', color: prioColor }}>{t.priority}</span>
                          {t.due_date && (
                            <span style={{ fontSize: '10px', color: overdue ? 'var(--danger)' : 'var(--text-muted)' }}>
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

            <div className="rounded-xl p-5" style={{ border: '1px solid var(--border-default)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2
                  className="uppercase flex items-center gap-2"
                  style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}
                >
                  <Activity className="w-4 h-4" /> Recent Activity
                </h2>
                <Link
                  href="/timeline"
                  className="flex items-center gap-1"
                  style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#6a8fc0'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                >
                  Full log <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {activity.length === 0 ? (
                <div style={{ padding: 'var(--space-2) 0' }}>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>No activity recorded yet</p>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)', opacity: 0.7 }}>Activity logs from meetings, status changes, and tasks</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {activity.slice(0, 10).map(a => (
                    <ActivityRow key={a.id} activity={a} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ================================================================ */}
          {/* CONTEXTUAL QUICK ACTIONS                                         */}
          {/* ================================================================ */}
          {(() => {
            const overdueFollowups = pendingFollowups.filter(f => {
              const dueDate = f.due_at?.split('T')[0];
              return dueDate && dueDate < new Date().toISOString().split('T')[0];
            });
            const atRiskCount = (atRisk?.scoreReversals?.length ?? 0) + (atRisk?.staleInvestors?.length ?? 0);
            const overdueTasks = tasks.filter(t => {
              const due = t.due_date?.split('T')[0];
              return due && due < new Date().toISOString().split('T')[0] && t.priority !== 'low';
            });
            const completeness = dataQuality?.overallCompleteness ?? 100;

            const actions: { href: string; label: string; sub: string; color: string; borderColor: string; count?: number }[] = [];

            if (overdueFollowups.length > 0) {
              actions.push({ href: '/followups', label: 'Overdue Follow-ups', sub: `${overdueFollowups.length} past due — respond today`, color: 'var(--danger)', borderColor: 'rgba(196,90,90,0.3)', count: overdueFollowups.length });
            }
            if (atRiskCount > 0) {
              actions.push({ href: '/dealflow', label: 'At-Risk Investors', sub: `${atRiskCount} losing momentum — intervene now`, color: 'var(--warning)', borderColor: 'rgba(196,163,90,0.3)', count: atRiskCount });
            }
            if (overdueTasks.length > 0) {
              actions.push({ href: '/focus', label: 'Blocked Tasks', sub: `${overdueTasks.length} overdue — unblock pipeline`, color: 'var(--danger)', borderColor: 'rgba(196,90,90,0.2)', count: overdueTasks.length });
            }
            if (completeness < 70) {
              actions.push({ href: '/investors', label: 'Data Gaps', sub: `CRM ${completeness}% complete — fill key fields`, color: 'var(--accent)', borderColor: 'rgba(74,111,165,0.2)' });
            }

            // Always include core quick nav (fill to 4)
            if (actions.length < 4) actions.push({ href: '/meetings/new', label: 'Log Meeting', sub: 'Capture a debrief', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' });
            if (actions.length < 4) actions.push({ href: '/pipeline', label: 'Pipeline', sub: 'Kanban board', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' });
            if (actions.length < 4) actions.push({ href: '/intelligence', label: 'AI Analysis', sub: 'Pattern detection', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' });
            if (actions.length < 4) actions.push({ href: '/investors', label: 'Manage CRM', sub: 'Update statuses', color: 'var(--text-secondary)', borderColor: 'var(--border-default)' });

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {actions.slice(0, 4).map((a) => (
                  <Link
                    key={a.href + a.label}
                    href={a.href}
                    className="rounded-xl p-4 transition-colors relative"
                    style={{ border: `1px solid ${a.borderColor}`, textDecoration: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = a.borderColor; }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: a.color }}>{a.label}</span>
                      {a.count && (
                        <span style={{
                          fontSize: '10px', fontWeight: 700,
                          background: a.color === 'var(--danger)' ? 'var(--danger-muted)' : 'var(--warning-muted)',
                          color: a.color,
                          padding: '1px 6px', borderRadius: '9px',
                        }}>
                          {a.count}
                        </span>
                      )}
                    </div>
                    <div className="mt-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{a.sub}</div>
                  </Link>
                ))}
              </div>
            );
          })()}
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
  const accentColor = {
    blue: 'var(--accent)',
    green: 'var(--success)',
    yellow: 'var(--warning)',
    red: 'var(--danger)',
    zinc: 'var(--text-tertiary)',
  }[color];

  return (
    <div
      className="transition-all duration-150"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border-subtle)',
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4) var(--space-5)',
      }}
    >
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: 'var(--text-primary)', marginTop: 'var(--space-1)' }}>{value}</div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-1)' }}>{sub}</div>
    </div>
  );
}

function MomentumBar({ count, total, bg, label }: {
  count: number; total: number; bg: string; label: string;
}) {
  const pct = total > 0 ? Math.max((count / total) * 100, 4) : 0;
  return (
    <div
      className="relative group cursor-default transition-all"
      style={{ width: `${pct}%`, background: bg }}
      title={`${label}: ${count}`}
    >
      {pct >= 15 && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}
        >
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
    <span className="flex items-center gap-1" style={{ fontSize: '10px', color }}>
      <span style={{ fontWeight: 700 }}>{count}</span> {label}
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

function VelocityStrip({ velocity }: { velocity: VelocityResponse }) {
  const s = velocity.summary;
  const progressPct = Math.min(100, Math.round((s.raise_days_elapsed / s.raise_target_days) * 100));
  const daysRemaining = Math.max(0, s.raise_target_days - s.raise_days_elapsed);
  const isOverTarget = s.raise_days_elapsed > s.raise_target_days;

  const totalMeetings = velocity.investors.reduce((sum, inv) => {
    const mpw = inv.meetings_per_week;
    return sum + mpw;
  }, 0);
  const avgMeetingsPerWeek = velocity.investors.length > 0
    ? Math.round((totalMeetings / velocity.investors.length) * 10) / 10
    : 0;

  const trendUp = s.avg_velocity_score >= 50;

  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        border: `1px solid ${isOverTarget ? 'rgba(196,90,90,0.25)' : 'rgba(74,111,165,0.2)'}`,
        background: isOverTarget ? 'rgba(196,90,90,0.03)' : 'rgba(74,111,165,0.02)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h2
            className="uppercase flex items-center gap-2"
            style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}
          >
            <Gauge className="w-4 h-4" /> Pipeline Velocity
          </h2>
          <Link
            href="/dealflow"
            className="flex items-center gap-1 transition-opacity"
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--accent)',
              opacity: hovered ? 1 : 0,
            }}
          >
            Details <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Days Elapsed</div>
            <div
              className="tabular-nums mt-0.5"
              style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 700,
                color: isOverTarget ? 'var(--danger)' : 'var(--text-primary)',
              }}
            >
              {s.raise_days_elapsed}
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: 400 }}>
                /{s.raise_target_days}d
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Mtgs/Week</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="tabular-nums"
                style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)' }}
              >
                {avgMeetingsPerWeek}
              </span>
              <span style={{ color: trendUp ? 'var(--success)' : 'var(--danger)' }}>
                {trendUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Velocity Score</div>
            <div
              className="tabular-nums mt-0.5"
              style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 700,
                color: s.avg_velocity_score >= 60 ? 'var(--success)' : s.avg_velocity_score >= 40 ? 'var(--warning)' : 'var(--danger)',
              }}
            >
              {s.avg_velocity_score}
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: 400 }}>/100</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {isOverTarget ? 'Over Target By' : 'Days Remaining'}
            </div>
            <div
              className="tabular-nums mt-0.5"
              style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 700,
                color: isOverTarget ? 'var(--danger)' : daysRemaining <= 14 ? 'var(--warning)' : 'var(--success)',
              }}
            >
              {isOverTarget ? `+${s.raise_days_elapsed - s.raise_target_days}` : daysRemaining}d
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: '4px', background: 'var(--surface-3)' }}>
        <div
          className="h-full transition-all duration-700"
          style={{
            width: `${progressPct}%`,
            background: isOverTarget
              ? 'var(--danger)'
              : progressPct >= 75
              ? 'var(--warning)'
              : 'var(--accent)',
            borderRadius: progressPct < 100 ? '0 2px 2px 0' : undefined,
          }}
        />
      </div>

      {/* Tracking breakdown mini bar */}
      <div className="px-5 py-2 flex items-center gap-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <span className="flex items-center gap-1" style={{ fontSize: '10px', color: 'var(--success)' }}>
          <span style={{ fontWeight: 700 }}>{s.on_track}</span> on track
        </span>
        <span className="flex items-center gap-1" style={{ fontSize: '10px', color: 'var(--warning)' }}>
          <span style={{ fontWeight: 700 }}>{s.behind}</span> behind
        </span>
        <span className="flex items-center gap-1" style={{ fontSize: '10px', color: 'var(--danger)' }}>
          <span style={{ fontWeight: 700 }}>{s.at_risk}</span> at risk
        </span>
      </div>
    </div>
  );
}

function HotDealRow({ investor }: { investor: DealHeatInvestor }) {
  const [hovered, setHovered] = useState(false);

  const heatColor =
    investor.dealHeat.label === 'hot' ? '#c45a5a' :
    investor.dealHeat.label === 'warm' ? '#a58a5a' :
    investor.dealHeat.label === 'cool' ? 'var(--accent)' :
    investor.dealHeat.label === 'cold' ? 'var(--text-tertiary)' : 'var(--text-muted)';

  const heatBg =
    investor.dealHeat.label === 'hot' ? 'rgba(196,90,90,0.12)' :
    investor.dealHeat.label === 'warm' ? 'rgba(249,115,22,0.12)' :
    investor.dealHeat.label === 'cool' ? 'rgba(74,111,165,0.12)' :
    'var(--surface-3)';

  const heatBorder =
    investor.dealHeat.label === 'hot' ? 'rgba(196,90,90,0.3)' :
    investor.dealHeat.label === 'warm' ? 'rgba(249,115,22,0.3)' :
    investor.dealHeat.label === 'cool' ? 'rgba(74,111,165,0.3)' :
    'var(--border-subtle)';

  return (
    <div
      className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors"
      style={{ background: hovered ? 'var(--surface-3)' : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/investors/${investor.id}`}
            className="truncate transition-colors"
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
              color: hovered ? 'var(--accent)' : 'var(--text-primary)',
            }}
          >
            {investor.name}
          </Link>
          <span style={{ fontSize: '9px', color: investor.tier === 1 ? '#d4be82' : 'var(--text-muted)' }}>
            T{investor.tier}
          </span>
        </div>
        <div className="mt-0.5" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          {formatStage(investor.status)}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="tabular-nums"
          style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: heatColor }}
        >
          {investor.dealHeat.heat}
        </span>
        <Link
          href={`/meetings/new?investor=${investor.id}`}
          onClick={e => e.stopPropagation()}
          style={{
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            background: heatBg,
            color: heatColor,
            border: `1px solid ${heatBorder}`,
            textDecoration: 'none',
          }}
        >
          Schedule
        </Link>
      </div>
    </div>
  );
}

function FollowupRow({ followup, onComplete }: { followup: FollowupItem; onComplete?: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const [completing, setCompleting] = useState(false);

  const now = new Date();
  const dueDate = new Date(followup.due_at);
  const isOverdue = dueDate < now;
  const daysUntil = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const actionLabel: Record<string, string> = {
    thank_you: 'Thank You',
    objection_response: 'Objection Response',
    data_share: 'Data Share',
    schedule_followup: 'Schedule Follow-up',
    warm_reengagement: 'Re-engagement',
    milestone_update: 'Milestone Update',
  };

  const ActionIcon =
    followup.action_type === 'thank_you' ? Mail :
    followup.action_type === 'schedule_followup' ? Calendar :
    followup.action_type === 'data_share' ? FileText :
    MessageSquare;

  return (
    <div
      className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors"
      style={{ background: hovered ? 'var(--surface-3)' : 'transparent', opacity: completing ? 0.5 : 1, transition: 'all 150ms ease' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {onComplete && (
        <button
          onClick={() => { setCompleting(true); onComplete(followup.id); }}
          className="w-5 h-5 rounded flex items-center justify-center shrink-0"
          style={{
            border: '2px solid var(--border-default)',
            background: 'transparent',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--success)'; e.currentTarget.style.background = 'var(--success-muted)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'transparent'; }}
          title="Mark done"
        >
          {completing && <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--success)' }} />}
        </button>
      )}
      <span className="shrink-0" style={{ color: isOverdue ? 'var(--danger)' : 'var(--accent)' }}>
        <ActionIcon className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/investors/${followup.investor_id}`}
            className="truncate transition-colors"
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
              color: hovered ? 'var(--accent)' : 'var(--text-primary)',
            }}
          >
            {followup.investor_name || 'Unknown'}
          </Link>
          <span
            className="px-1.5 py-0.5 rounded shrink-0"
            style={{
              fontSize: '9px',
              background: 'var(--surface-3)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {actionLabel[followup.action_type] || followup.action_type.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="truncate mt-0.5" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
          {followup.description}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <div className="text-right">
          <div
            className="tabular-nums"
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 500,
              color: isOverdue ? 'var(--danger)' : daysUntil <= 1 ? 'var(--warning)' : 'var(--text-muted)',
            }}
          >
            {isOverdue
              ? `${Math.abs(daysUntil)}d overdue`
              : daysUntil === 0
              ? 'Today'
              : daysUntil === 1
              ? 'Tomorrow'
              : `${daysUntil}d`}
          </div>
        </div>
        <Link
          href={`/followups?investor=${followup.investor_id}`}
          onClick={e => e.stopPropagation()}
          style={{
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            background: isOverdue ? 'var(--danger-muted)' : 'var(--accent-muted)',
            color: isOverdue ? 'var(--danger)' : 'var(--accent)',
            border: `1px solid ${isOverdue ? 'rgba(196,90,90,0.25)' : 'rgba(74,111,165,0.25)'}`,
            textDecoration: 'none',
          }}
        >
          Act
        </Link>
      </div>
    </div>
  );
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const [hovered, setHovered] = useState(false);

  const eventIcons: Record<string, typeof Activity> = {
    meeting_logged: Calendar,
    status_changed: ArrowUp,
    followup_completed: CheckCircle2,
    investor_added: UserPlus,
    followup_created: Mail,
    meeting_created: Calendar,
  };

  const eventColors: Record<string, string> = {
    meeting_logged: 'var(--accent)',
    status_changed: 'var(--success)',
    followup_completed: 'var(--success)',
    investor_added: '#6a8fc0',
    followup_created: 'var(--warning)',
    meeting_created: 'var(--accent)',
  };

  const Icon = eventIcons[activity.event_type] || Activity;
  const iconColor = eventColors[activity.event_type] || 'var(--text-muted)';

  const timeAgo = formatTimeAgo(activity.created_at);

  return (
    <div
      className="flex items-start gap-2.5 py-1.5 px-2 rounded transition-colors"
      style={{ background: hovered ? 'var(--surface-3)' : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="mt-0.5 shrink-0" style={{ color: iconColor }}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ fontSize: 'var(--font-size-sm)' }}>{activity.subject}</div>
        <div className="flex items-center gap-2" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {activity.investor_name && (
            <span style={{ color: 'var(--text-secondary)' }}>{activity.investor_name}</span>
          )}
          <span>{activity.event_type.replace(/_/g, ' ')}</span>
          <span>{timeAgo}</span>
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.round(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.round(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

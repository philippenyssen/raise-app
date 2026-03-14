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
      </div>
    );
  }

  if (!data) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      <h1 className="page-title">Dashboard</h1>
      <div
        className="text-center"
        style={{
          border: '1px solid var(--border-default)',
          background: 'var(--surface-1)',
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
    { label: 'Identified', value: identifiedCount > 0 ? identifiedCount : 0 },
    { label: 'Contacted', value: data.funnel.contacted },
    { label: 'Meetings', value: data.funnel.meetings },
    { label: 'Engaged', value: data.funnel.engaged },
    { label: 'In DD', value: data.funnel.in_dd },
    { label: 'Term Sheets', value: data.funnel.term_sheets },
    { label: 'Closed', value: data.funnel.closed },
  ];

  return (
    <div className="space-y-8 page-content">
      {/* Header */}
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
                background: 'var(--surface-1)',
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
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                >
                  {t} CSV
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
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
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 400, color: 'var(--text-primary)' }}>Initialize Your Fundraise</h2>
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
          {/* Raise Progress */}
          {stressTest ? (() => {
            const pct = Math.min(100, Math.round((stressTest.forecast.base / stressTest.target) * 100));
            return (
              <Link href="/stress-test" style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  className="transition-colors"
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xl)',
                    padding: 'var(--space-6)',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
                >
                  <div className="flex items-baseline gap-3" style={{ marginBottom: 'var(--space-4)' }}>
                    <span style={{
                      fontSize: 'var(--font-size-3xl)',
                      fontWeight: 300,
                      color: 'var(--text-primary)',
                      lineHeight: 1,
                      letterSpacing: '-0.02em',
                      fontFamily: 'var(--font-cormorant), Georgia, serif',
                    }}>
                      €{Math.round(stressTest.forecast.base)}M
                    </span>
                    <span style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--text-tertiary)',
                    }}>
                      of €{stressTest.target}M target
                    </span>
                  </div>

                  <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-5)' }}>
                    <div style={{
                      flex: 1,
                      height: '4px',
                      borderRadius: '2px',
                      background: 'var(--surface-3)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        borderRadius: '2px',
                        background: 'var(--accent)',
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    {velocity?.summary?.raise_days_elapsed != null && velocity?.summary?.raise_target_days != null && (
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-tertiary)',
                        whiteSpace: 'nowrap',
                        fontWeight: 400,
                      }}>
                        Day {velocity.summary.raise_days_elapsed} of {velocity.summary.raise_target_days}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                        Best case
                      </div>
                      <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 300, color: 'var(--text-primary)' }}>
                        €{Math.round(stressTest.forecast.best)}M
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                        Close probability
                      </div>
                      <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 300, color: 'var(--text-primary)' }}>
                        {stressTest.closeProbability}%
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                        Status
                      </div>
                      <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 300, color: 'var(--text-primary)' }}>
                        {stressTest.onTrack ? 'On track' : 'Needs attention'}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })() : (
            <div style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
            }}>
              <div className="skeleton" style={{ height: '48px', width: '220px', marginBottom: 'var(--space-4)', borderRadius: 'var(--radius-md)' }} />
              <div className="skeleton" style={{ height: '4px', width: '100%', marginBottom: 'var(--space-5)', borderRadius: '2px' }} />
              <div className="grid grid-cols-3 gap-4">
                <div className="skeleton" style={{ height: '40px', borderRadius: 'var(--radius-md)' }} />
                <div className="skeleton" style={{ height: '40px', borderRadius: 'var(--radius-md)' }} />
                <div className="skeleton" style={{ height: '40px', borderRadius: 'var(--radius-md)' }} />
              </div>
            </div>
          )}

          {/* Pulse Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 card-stagger">
            <PulseCard label="Active investors" value={ph?.activeInvestors ?? data.totalInvestors} sub={`${data.totalInvestors} total`} />
            <PulseCard label="This week" value={ph?.meetingsThisWeek ?? 0} sub="meetings" />
            <PulseCard label="Follow-ups due" value={ph?.overdueFollowups ?? 0} sub="overdue" />
            <PulseCard label="Data quality" value={`${ph?.dataQualityPct ?? dataQuality?.overallCompleteness ?? 0}%`} sub="completeness" />
          </div>

          {/* Pipeline Velocity */}
          {velocity && (
            <VelocityStrip velocity={velocity} />
          )}

          {/* Close Forecast */}
          {stressTest && (
            <Link href="/stress-test" className="block group">
              <div
                className="transition-colors"
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-xl)',
                  padding: 'var(--space-5)',
                  transition: 'border-color 0.2s ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h2
                    className="flex items-center gap-2"
                    style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}
                  >
                    <ShieldAlert className="w-4 h-4" /> Close forecast
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
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Target</div>
                    <div className="tabular-nums mt-0.5" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)' }}>
                      EUR {stressTest.target >= 1000 ? `${(stressTest.target / 1000).toFixed(1).replace(/\.0$/, '')}Bn` : `${stressTest.target}M`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Forecast (base)</div>
                    <div className="tabular-nums mt-0.5" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)' }}>
                      EUR {stressTest.forecast.base >= 1000 ? `${(stressTest.forecast.base / 1000).toFixed(1).replace(/\.0$/, '')}Bn` : `${Math.round(stressTest.forecast.base)}M`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Probability</div>
                    <div className="tabular-nums mt-0.5" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)' }}>
                      {stressTest.closeProbability}%
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Status</div>
                    <div className="mt-1" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>
                      {stressTest.onTrack ? 'On track' : stressTest.healthStatus === 'red' ? 'Needs attention' : 'Monitor'}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* At Risk Deals */}
          {atRisk && (atRisk.scoreReversals.length > 0 || atRisk.staleInvestors.length > 0) && (
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  <ShieldAlert className="w-4 h-4" /> At risk
                </h2>
                <span className="tabular-nums" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                  {atRisk.scoreReversals.length + atRisk.staleInvestors.length} deal{atRisk.scoreReversals.length + atRisk.staleInvestors.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2">
                {atRisk.scoreReversals.map((rev) => (
                  <div
                    key={`rev-${rev.investorId}`}
                    className="flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors"
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                      <TrendingDown className="w-4 h-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link
                          href={`/investors/${rev.investorId}`}
                          className="transition-colors truncate"
                          style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                        >
                          {rev.investorName}
                        </Link>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                          {rev.severity}
                        </span>
                      </div>
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                        Score {rev.previousScore} → {rev.currentScore} ({rev.delta})
                      </p>
                    </div>
                    <Link
                      href={`/investors/${rev.investorId}`}
                      className="shrink-0 btn btn-secondary btn-sm flex items-center gap-1"
                    >
                      Follow up <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}

                {atRisk.staleInvestors.map((inv) => (
                  <div
                    key={`stale-${inv.investorId}`}
                    className="flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors"
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                      {inv.acceleration === 'gone_silent' ? <UserMinus className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link
                          href={`/investors/${inv.investorId}`}
                          className="transition-colors truncate"
                          style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400 }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                        >
                          {inv.investorName}
                        </Link>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>T{inv.tier}</span>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                          {inv.acceleration === 'gone_silent' ? 'Silent' : 'Slowing'}
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
                      className="shrink-0 btn btn-secondary btn-sm flex items-center gap-1"
                    >
                      Follow up <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Focus Today */}
          {cp && cp.topFocus.length > 0 && (
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  <Target className="w-4 h-4" /> Top focus today
                </h2>
                <Link
                  href="/focus"
                  className="flex items-center gap-1"
                  style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}
                >
                  Full priority queue <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {cp.topFocus.map((item, i) => {
                  const MomentumIcon = item.momentum === 'accelerating' ? TrendingUp
                    : item.momentum === 'decelerating' ? TrendingDown
                    : item.momentum === 'stalled' ? ArrowDownRight
                    : Minus;
                  return (
                    <div
                      key={item.investorId}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <span
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 500,
                          background: i === 0 ? 'var(--accent)' : 'var(--surface-3)',
                          color: i === 0 ? '#fafaf8' : 'var(--text-secondary)',
                        }}
                      >{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/investors/${item.investorId}`}
                            className="truncate transition-colors"
                            style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                          >
                            {item.investorName}
                          </Link>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>T{item.tier}</span>
                          <MomentumIcon className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                        <p className="truncate mt-0.5" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{item.recommendedAction}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                          <Timer className="w-3 h-3" /> {item.timeEstimate}
                        </span>
                        <span className="tabular-nums" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>{item.focusScore}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Overnight + Conviction */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
              <h2 className="flex items-center gap-2 mb-3" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                <Clock className="w-4 h-4" /> Last 24 hours
              </h2>
              {ov ? (
                <div className="space-y-2.5">
                  {ov.activityFeed.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full mt-2 shrink-0" style={{ background: 'var(--accent)' }} />
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>{item}</span>
                    </div>
                  ))}
                  {ov.statusChanges.length > 0 && (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <div className="mb-1.5" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Stage movements</div>
                      {ov.statusChanges.slice(0, 3).map((sc, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <ArrowUpRight className="w-3 h-3 shrink-0" style={{ color: 'var(--accent)' }} />
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 400 }}>{sc.investorName}</span>
                            {' '}{sc.from !== 'unknown' ? `${formatStage(sc.from)} → ` : ''}{formatStage(sc.to)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {ov.meetingNames.length > 0 && (
                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <div className="mb-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Meetings logged</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{ov.meetingNames.join(', ')}</div>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Loading overnight data...</p>
              )}
            </div>

            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
              <h2 className="flex items-center gap-2 mb-3" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                <Activity className="w-4 h-4" /> Conviction radar
              </h2>
              {cv ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="metric-value">
                        {cv.avgEnthusiasm.toFixed(1)}
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: 300 }}>/5</span>
                      </div>
                      <div className="metric-label">Avg enthusiasm</div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Momentum distribution</div>
                    <div className="flex gap-0.5 h-5 rounded overflow-hidden">
                      {cv.accelerating > 0 && <MomentumBar count={cv.accelerating} total={cv.accelerating + cv.steady + cv.decelerating + cv.stalled} opacity={1} label="Accelerating" />}
                      {cv.steady > 0 && <MomentumBar count={cv.steady} total={cv.accelerating + cv.steady + cv.decelerating + cv.stalled} opacity={0.6} label="Steady" />}
                      {cv.decelerating > 0 && <MomentumBar count={cv.decelerating} total={cv.accelerating + cv.steady + cv.decelerating + cv.stalled} opacity={0.35} label="Decelerating" />}
                      {cv.stalled > 0 && <MomentumBar count={cv.stalled} total={cv.accelerating + cv.steady + cv.decelerating + cv.stalled} opacity={0.15} label="Stalled" />}
                    </div>
                    <div className="flex gap-3 mt-1.5 flex-wrap">
                      {cv.accelerating > 0 && <MomentumLabel count={cv.accelerating} label="Accelerating" />}
                      {cv.steady > 0 && <MomentumLabel count={cv.steady} label="Steady" />}
                      {cv.decelerating > 0 && <MomentumLabel count={cv.decelerating} label="Decelerating" />}
                      {cv.stalled > 0 && <MomentumLabel count={cv.stalled} label="Stalled" />}
                    </div>
                  </div>

                  {cv.alerts.length > 0 && (
                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <div className="mb-1.5 flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                        <AlertTriangle className="w-3 h-3" /> Enthusiasm drops
                      </div>
                      {cv.alerts.map((alert, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                          <Link
                            href={`/investors/${alert.investorId}`}
                            className="transition-colors"
                            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                          >
                            {alert.investorName}
                          </Link>
                          <span className="tabular-nums" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                            {alert.previousScore} → {alert.currentScore} ({-alert.drop})
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

          {/* Acceleration Alerts */}
          {cp && cp.topAccelerations.length > 0 && (
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  <Zap className="w-4 h-4" /> Acceleration alerts
                </h2>
                <Link href="/focus" className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
                  All actions <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {cp.topAccelerations.map((accel) => {
                  const triggerLabel = accel.triggerType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  return (
                    <div
                      key={accel.id}
                      className="flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <Zap className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Link
                            href={`/investors/${accel.investorId}`}
                            className="transition-colors"
                            style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = ''; }}
                          >
                            {accel.investorName}
                          </Link>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                            {accel.urgency === 'immediate' ? 'Now' : accel.urgency}
                          </span>
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{triggerLabel}</span>
                        </div>
                        <p className="leading-relaxed" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{accel.description}</p>
                      </div>
                      <button
                        onClick={() => executeAcceleration(accel.id)}
                        className="shrink-0 btn btn-secondary btn-sm flex items-center gap-1"
                      >
                        Execute <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hot Deals + Follow-ups */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  <Flame className="w-4 h-4" /> Hot deals
                </h2>
                <Link href="/dealflow" className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
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

            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  <CheckCircle2 className="w-4 h-4" /> Upcoming follow-ups
                </h2>
                <Link href="/followups" className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
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

          {/* Pipeline */}
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>Pipeline</h2>
              <Link href="/pipeline" className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
                Pipeline view <Columns3 className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex flex-col items-center space-y-1.5">
              {funnelStages.map((stage, i) => {
                const widthPct = Math.max(100 - (i * 13), 25);
                const opacity = 1 - (i * 0.08);
                return (
                  <div key={stage.label} className="w-full flex items-center justify-center" style={{ maxWidth: `${widthPct}%` }}>
                    <div
                      className="w-full rounded-md h-9 flex items-center justify-between px-4"
                      style={{ background: `rgba(27, 42, 74, ${Math.max(opacity * 0.12, 0.04)})` }}
                    >
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-secondary)' }}>{stage.label}</span>
                      <span className="tabular-nums" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>{stage.value}</span>
                    </div>
                  </div>
                );
              })}
              {data.funnel.passed > 0 && (
                <div className="w-full flex items-center justify-center mt-2 pt-2" style={{ maxWidth: '50%', borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="w-full rounded-md h-7 flex items-center justify-between px-4" style={{ background: 'var(--surface-2)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Passed</span>
                    <span className="tabular-nums" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>{data.funnel.passed}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Deliverables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { href: '/workspace', Icon: Sparkles, label: 'Workspace', sub: docs.length > 0 ? `${docs.length} document${docs.length !== 1 ? 's' : ''}` : 'Create deliverables' },
              { href: '/data-room', Icon: FolderOpen, label: 'Data Room', sub: dataRoomCount > 0 ? `${dataRoomCount} file${dataRoomCount !== 1 ? 's' : ''} uploaded` : 'Upload source materials' },
              { href: '/model', Icon: Table, label: 'Financial Model', sub: 'Build & refine with AI' },
              { href: '/documents', Icon: FileText, label: 'Documents', sub: docs.length > 0 ? `${docs.filter(d => d.status === 'draft').length} drafts` : 'Version history' },
            ].map(({ href, Icon, label, sub }) => (
              <Link
                key={href}
                href={href}
                className="group rounded-xl p-4 transition-colors"
                style={{ border: '1px solid var(--border-subtle)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
              >
                <Icon className="w-5 h-5 mb-2" style={{ color: 'var(--text-tertiary)' }} />
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>{label}</div>
                <div className="mt-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{sub}</div>
                <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
                  Open <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>

          {/* Data Quality */}
          {dataQuality && (
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  <ShieldCheck className="w-4 h-4" /> Data quality
                </h2>
                <Link href="/investors" className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
                  Fix gaps <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <div>
                    <div className="metric-label mb-1">Overall completeness</div>
                    <div className="metric-value">{dataQuality.overallCompleteness}%</div>
                  </div>
                  <div>
                    <div className="metric-label mb-1">Intelligence readiness</div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${dataQuality.intelligenceReadiness}%`, background: 'var(--accent)' }} />
                      </div>
                      <span className="tabular-nums" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-secondary)' }}>{dataQuality.intelligenceReadiness}%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="mb-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Field coverage</div>
                  {dataQuality.fieldCompleteness
                    .filter(f => f.field !== 'name' && f.field !== 'type' && f.field !== 'tier' && f.field !== 'status')
                    .map(f => (
                    <div key={f.field} className="flex items-center gap-2">
                      <span className="w-20 truncate" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{f.field.replace(/_/g, ' ')}</span>
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                        <div className="h-full rounded-full" style={{ width: `${f.pct}%`, background: 'var(--accent)' }} />
                      </div>
                      <span className="tabular-nums w-8 text-right" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{f.pct}%</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <div className="mb-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Recommendations</div>
                  {dataQuality.recommendations.slice(0, 3).map((rec, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--accent)' }} />
                      <span className="leading-snug" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tasks + Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  <ClipboardList className="w-4 h-4" /> Upcoming tasks
                </h2>
                <Link href="/timeline" className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
                  All tasks <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {tasks.length === 0 ? (
                <div style={{ padding: 'var(--space-2) 0' }}>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>No upcoming tasks</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map(t => {
                    const overdue = t.due_date && new Date(t.due_date) < new Date();
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between py-1.5 px-2 rounded transition-colors"
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <div className="min-w-0">
                          <div className="truncate" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>{t.title}</div>
                          {t.investor_name && <div className="truncate" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{t.investor_name}</div>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{t.priority}</span>
                          {t.due_date && (
                            <span style={{ fontSize: 'var(--font-size-xs)', color: overdue ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: overdue ? 400 : 300 }}>
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

            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
                  <Activity className="w-4 h-4" /> Recent activity
                </h2>
                <Link href="/timeline" className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
                  Full log <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {activity.length === 0 ? (
                <div style={{ padding: 'var(--space-2) 0' }}>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>No activity recorded yet</p>
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

          {/* Quick Actions */}
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

            const actions: { href: string; label: string; sub: string; count?: number }[] = [];

            if (overdueFollowups.length > 0) {
              actions.push({ href: '/followups', label: 'Overdue follow-ups', sub: `${overdueFollowups.length} past due`, count: overdueFollowups.length });
            }
            if (atRiskCount > 0) {
              actions.push({ href: '/dealflow', label: 'At-risk investors', sub: `${atRiskCount} losing momentum`, count: atRiskCount });
            }
            if (overdueTasks.length > 0) {
              actions.push({ href: '/focus', label: 'Blocked tasks', sub: `${overdueTasks.length} overdue`, count: overdueTasks.length });
            }
            if (completeness < 70) {
              actions.push({ href: '/investors', label: 'Data gaps', sub: `CRM ${completeness}% complete` });
            }
            if (actions.length < 4) actions.push({ href: '/meetings/new', label: 'Log meeting', sub: 'Capture a debrief' });
            if (actions.length < 4) actions.push({ href: '/pipeline', label: 'Pipeline', sub: 'Kanban board' });
            if (actions.length < 4) actions.push({ href: '/intelligence', label: 'AI analysis', sub: 'Pattern detection' });
            if (actions.length < 4) actions.push({ href: '/investors', label: 'Manage CRM', sub: 'Update statuses' });

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {actions.slice(0, 4).map((a) => (
                  <Link
                    key={a.href + a.label}
                    href={a.href}
                    className="rounded-xl p-4 transition-colors"
                    style={{ border: '1px solid var(--border-subtle)', textDecoration: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>{a.label}</span>
                      {a.count && (
                        <span className="tabular-nums" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
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
// Sub-components — monochrome
// ---------------------------------------------------------------------------

function PulseCard({ label, value, sub }: {
  label: string;
  value: string | number;
  sub: string;
  color?: string;
}) {
  return (
    <div
      className="transition-colors"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4) var(--space-5)',
        transition: 'border-color 0.2s ease',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
    >
      <div className="metric-label" style={{ marginBottom: 'var(--space-1)' }}>{label}</div>
      <div className="metric-value">{value}</div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: '2px' }}>{sub}</div>
    </div>
  );
}

function MomentumBar({ count, total, opacity, label }: {
  count: number; total: number; opacity: number; label: string;
}) {
  const pct = total > 0 ? Math.max((count / total) * 100, 4) : 0;
  return (
    <div
      className="relative group cursor-default"
      style={{ width: `${pct}%`, background: `rgba(27, 42, 74, ${opacity})`, borderRadius: '2px' }}
      title={`${label}: ${count}`}
    >
      {pct >= 15 && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontSize: '9px', fontWeight: 500, color: opacity > 0.5 ? '#fafaf8' : 'var(--text-secondary)' }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function MomentumLabel({ count, label }: {
  count: number; label: string;
}) {
  return (
    <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
      <span style={{ fontWeight: 500 }}>{count}</span> {label}
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

  const totalMeetings = velocity.investors.reduce((sum, inv) => sum + inv.meetings_per_week, 0);
  const avgMeetingsPerWeek = velocity.investors.length > 0
    ? Math.round((totalMeetings / velocity.investors.length) * 10) / 10
    : 0;

  const trendUp = s.avg_velocity_score >= 50;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ border: '1px solid var(--border-subtle)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>
            <Gauge className="w-4 h-4" /> Pipeline velocity
          </h2>
          <Link
            href="/dealflow"
            className="flex items-center gap-1 transition-opacity"
            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)', opacity: hovered ? 1 : 0 }}
          >
            Details <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Days elapsed</div>
            <div className="tabular-nums mt-0.5" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)' }}>
              {s.raise_days_elapsed}
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: 300 }}>/{s.raise_target_days}d</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Avg mtgs/week</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="tabular-nums" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)' }}>{avgMeetingsPerWeek}</span>
              <span style={{ color: 'var(--text-tertiary)' }}>
                {trendUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Velocity score</div>
            <div className="tabular-nums mt-0.5" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)' }}>
              {s.avg_velocity_score}
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: 300 }}>/100</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
              {isOverTarget ? 'Over target by' : 'Days remaining'}
            </div>
            <div className="tabular-nums mt-0.5" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)' }}>
              {isOverTarget ? `+${s.raise_days_elapsed - s.raise_target_days}` : daysRemaining}d
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: '3px', background: 'var(--surface-3)' }}>
        <div
          className="h-full transition-all duration-700"
          style={{
            width: `${progressPct}%`,
            background: 'var(--accent)',
            borderRadius: progressPct < 100 ? '0 1px 1px 0' : undefined,
          }}
        />
      </div>

      <div className="px-5 py-2 flex items-center gap-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
          <span style={{ fontWeight: 500 }}>{s.on_track}</span> on track
        </span>
        <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
          <span style={{ fontWeight: 500 }}>{s.behind}</span> behind
        </span>
        <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          <span style={{ fontWeight: 500 }}>{s.at_risk}</span> at risk
        </span>
      </div>
    </div>
  );
}

function HotDealRow({ investor }: { investor: DealHeatInvestor }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors"
      style={{ background: hovered ? 'var(--surface-2)' : 'transparent' }}
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
              fontWeight: 400,
              color: hovered ? 'var(--accent)' : 'var(--text-primary)',
            }}
          >
            {investor.name}
          </Link>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>T{investor.tier}</span>
        </div>
        <div className="mt-0.5" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          {formatStage(investor.status)}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="tabular-nums" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>
          {investor.dealHeat.heat}
        </span>
        <Link
          href={`/meetings/new?investor=${investor.id}`}
          onClick={e => e.stopPropagation()}
          className="btn btn-secondary btn-sm"
          style={{ textDecoration: 'none', fontSize: 'var(--font-size-xs)' }}
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
      style={{ background: hovered ? 'var(--surface-2)' : 'transparent', opacity: completing ? 0.5 : 1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {onComplete && (
        <button
          onClick={() => { setCompleting(true); onComplete(followup.id); }}
          className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors"
          style={{
            border: '1.5px solid var(--border-default)',
            background: 'transparent',
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-muted)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'transparent'; }}
          title="Mark done"
        >
          {completing && <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--accent)' }} />}
        </button>
      )}
      <span className="shrink-0" style={{ color: 'var(--text-tertiary)' }}>
        <ActionIcon className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/investors/${followup.investor_id}`}
            className="truncate transition-colors"
            style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: hovered ? 'var(--accent)' : 'var(--text-primary)' }}
          >
            {followup.investor_name || 'Unknown'}
          </Link>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
            {actionLabel[followup.action_type] || followup.action_type.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="truncate mt-0.5" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
          {followup.description}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <div className="text-right">
          <div className="tabular-nums" style={{ fontSize: 'var(--font-size-xs)', color: isOverdue ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: isOverdue ? 400 : 300 }}>
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
          className="btn btn-secondary btn-sm"
          style={{ textDecoration: 'none', fontSize: 'var(--font-size-xs)' }}
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

  const Icon = eventIcons[activity.event_type] || Activity;
  const timeAgo = formatTimeAgo(activity.created_at);

  return (
    <div
      className="flex items-start gap-2.5 py-1.5 px-2 rounded transition-colors"
      style={{ background: hovered ? 'var(--surface-2)' : 'transparent' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="mt-0.5 shrink-0" style={{ color: 'var(--text-tertiary)' }}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>{activity.subject}</div>
        <div className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
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

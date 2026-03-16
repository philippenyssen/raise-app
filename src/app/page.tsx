'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/toast';
import { fmtDateShort } from '@/lib/format';
import { cachedFetch } from '@/lib/cache';
import { MS_PER_MINUTE, relativeTime } from '@/lib/time';
import { useRefreshInterval } from '@/lib/hooks/useRefreshInterval';
import {
  FileText, Sparkles, ArrowRight,
  Activity, Download, Columns3, Target, Timer,
  RefreshCw, Zap, TrendingUp, TrendingDown, Minus, AlertTriangle,
  ChevronRight, Clock, ArrowUpRight, ArrowDownRight, ShieldAlert,
  UserMinus, CalendarClock, Flame, Gauge, CheckCircle2, Mail,
  Calendar, MessageSquare, ClipboardList, ShieldCheck,
} from 'lucide-react';
import { DealHeatInvestor } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/constants';
import { labelAccent, labelMuted, labelSecondary, labelSmMuted, labelTertiary, stAccent, stBorderTop, stSurface1, stSurface2, stTextMuted, stTextSecondary, stTextTertiary as textTertiary, textSmSecondary } from '@/lib/styles';

const textSmPrimary = { fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' } as const;
const textSmLink = { fontSize: 'var(--font-size-sm)', fontWeight: 400 } as const;
const metricXlPrimary = { fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)' } as const;
const metricLgPrimary = { fontSize: 'var(--font-size-lg)', fontWeight: 300, color: 'var(--text-primary)' } as const;
const labelXsTertiary4 = { fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' } as const;
const unitSmMuted = { fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontWeight: 300 } as const;

const skelWrap = { display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' } as const;
const skelTitle = { height: '32px', width: '200px' } as const;
const skelSubtitle = { height: '16px', width: '280px', marginTop: 'var(--space-2)' } as const;
const skelGrid = { gap: 'var(--space-3)' } as const;
const skelCard = { height: '88px', borderRadius: 'var(--radius-lg)' } as const;
const skelBanner = { height: '140px', borderRadius: 'var(--radius-lg)' } as const;

function scoreColor(v: number): string {
  return v >= 70 ? 'var(--success)' : v >= 45 ? 'var(--warning)' : 'var(--danger)';
}

function timeColor(daysOrWeeks: number, lowThresh: number, highThresh: number): string {
  return daysOrWeeks <= lowThresh ? 'var(--danger)' : daysOrWeeks <= highThresh ? 'var(--warning)' : 'var(--text-muted)';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  gapInvestors?: { id: string; name: string; intervention: string; impactDelta: number }[];
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

interface AtRiskData { scoreReversals: ScoreReversalItem[]; staleInvestors: StaleInvestorItem[]; }

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

interface BottleneckInvestor {
  id: string;
  name: string;
  tier: number;
  daysInStage: number;
  expectedDays: number;
  overdueFactor: number;
  enthusiasm: number;
  daysSinceLastMeeting: number;
  hasOverdueFollowups: boolean;
  suggestedAction: string;
}

interface StageBottleneck {
  stage: string;
  totalInvestors: number;
  stuckCount: number;
  avgDaysInStage: number;
  expectedDays: number;
  stuckInvestors: BottleneckInvestor[];
}

interface BottleneckResponse {
  bottlenecks: StageBottleneck[];
  summary: {
    totalActive: number;
    totalStuck: number;
    stuckPct: number;
    worstStage: string | null;
    worstStageCount: number;
  };
  generated_at: string;
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
  committedCapital?: number;
  committedInvestorCount?: number;
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

const cardPadding: React.CSSProperties = { borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)' };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<HealthData | null>(null);
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [tasks, setTasks] = useState<UpcomingTask[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [dataQuality, setDataQuality] = useState<DataQualityData | null>(null);
  const [stressTest, setStressTest] = useState<StressTestSummary | null>(null);
  const [atRisk, setAtRisk] = useState<AtRiskData | null>(null);
  const [dealHeat, setDealHeat] = useState<DealHeatResponse | null>(null);
  const [pendingFollowups, setPendingFollowups] = useState<FollowupItem[]>([]);
  const [velocity, setVelocity] = useState<VelocityResponse | null>(null);
  const [bottlenecks, setBottlenecks] = useState<BottleneckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [sectionErrors, setSectionErrors] = useState<Record<string, boolean>>({});
  const [focusMode, setFocusMode] = useState(true);
  const [narrativeBrief, setNarrativeBrief] = useState<string | null>(null);

  const safeFetch = useCallback(async <T,>(
    key: string, url: string, setter: (v: T) => void,
    silent: boolean, transform?: (res: Response) => Promise<T>,
  ) => {
    try {
      const res = await cachedFetch(url, { skipCache: silent });
      if (!res.ok) throw new Error(`${res.status}`);
      const val = transform ? await transform(res) : await res.json();
      setter(val as T);
      setSectionErrors(prev => {
        if (!prev[key]) return prev;
        const next = { ...prev }; delete next[key]; return next;});
    } catch (e) {
      console.warn(`[DASH_${key.toUpperCase()}]`, e instanceof Error ? e.message : e);
      setSectionErrors(prev => ({ ...prev, [key]: true }));
    }
  }, []);

  const fetchSection = useCallback((key: string, silent = false) => {
    const map: Record<string, () => Promise<void>> = {
      health: () => safeFetch('health', '/api/health', setData, silent),
      pulse: () => safeFetch('pulse', '/api/pulse', setPulse, silent),
      tasks: () => safeFetch('tasks', '/api/tasks?type=upcoming&limit=5', setTasks, silent),
      activity: () => safeFetch('activity', '/api/tasks?type=activity&limit=10', setActivity, silent),
      dataQuality: () => safeFetch('dataQuality', '/api/data-quality', setDataQuality, silent),
      stressTest: () => safeFetch('stressTest', '/api/stress-test', setStressTest, silent),
      atRisk: () => safeFetch('atRisk', '/api/at-risk', setAtRisk, silent),
      dealHeat: () => safeFetch('dealHeat', '/api/deal-heat', setDealHeat, silent),
      followups: () => safeFetch('followups', '/api/followups?view=pending', setPendingFollowups, silent),
      velocity: () => safeFetch('velocity', '/api/velocity', setVelocity, silent),
      bottlenecks: () => safeFetch('bottlenecks', '/api/bottlenecks', setBottlenecks, silent),
      briefing: () => safeFetch<{ todaySummary?: string }>('briefing', '/api/briefing', (d) => { if (d && typeof d === 'object' && 'todaySummary' in d) setNarrativeBrief((d as { todaySummary?: string }).todaySummary ?? null); }, silent),};
    return map[key]?.() ?? Promise.resolve();
  }, [safeFetch]);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    // Critical path: load essential data first (health + pulse + stressTest)
    const critical = ['health', 'pulse', 'stressTest'];
    const secondary = ['tasks','activity','dataQuality','atRisk','dealHeat','followups','velocity','bottlenecks','briefing'];
    await Promise.allSettled(critical.map(k => fetchSection(k, silent)));
    setLoading(false); // Unblock render after critical data loads
    // Load remaining sections in background — each renders as it arrives
    await Promise.allSettled(secondary.map(k => fetchSection(k, silent)));
    setLastRefresh(new Date()); setRefreshing(false);
  }, [fetchSection]);

  useEffect(() => { document.title = 'Raise | Dashboard'; }, []);
  const refreshData = useCallback(() => fetchData(true), [fetchData]);
  useRefreshInterval(refreshData, 5 * MS_PER_MINUTE);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        const first = pulse?.criticalPath?.topAccelerations?.[0];
        if (first) executeAcceleration(first.id);
      }
      if (!e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { if (e.key === 'n') router.push('/meetings/new'); if (e.key === 'r') { e.preventDefault(); fetchData(true); } }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pulse, fetchData]);

  async function seedData() {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
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
        body: JSON.stringify({ id, status: 'executed' }),});
      if (res.ok) {
        toast('Action marked as executed');
        fetchData(true);
      }
    } catch (e) {
      console.warn('[DASH_ACCEL]', e instanceof Error ? e.message : e);
      toast('Couldn\'t mark action as executed — try again', 'error');
    }}

  // Derived data — must be before any early return to avoid conditional hook calls
  const ph = pulse?.processHealth;
  const cp = pulse?.criticalPath;
  const cv = pulse?.convictionPulse;
  const ov = pulse?.overnight;

  const meetingStreak = useMemo(() => { const days = new Set(activity.filter(a => a.event_type === 'meeting').map(a => a.created_at?.split('T')[0])); if (days.size === 0) return 0; let s = 0; for (const d = new Date(); s < 365; d.setDate(d.getDate() - 1)) { if (days.has(d.toISOString().split('T')[0])) s++; else if (s > 0) break; else if (s === 0 && d.getTime() < Date.now() - 366 * 864e5) break; } return s; }, [activity]);
  const identifiedCount = data ? data.totalInvestors - data.funnel.contacted - (data.funnel.passed ?? 0) : 0;

  // Phase detection: adapt the dashboard to where the user is in the fundraise
  const fundraisePhase = useMemo(() => {
    if (!data || data.totalInvestors === 0) return 'empty' as const;
    const hasContacted = data.funnel.contacted > 0;
    const hasMeetings = data.totalMeetings > 0;
    const hasDD = data.funnel.in_dd > 0;
    const hasTermSheets = data.funnel.term_sheets > 0;
    if (hasTermSheets) return 'closing' as const;
    if (hasDD) return 'diligence' as const;
    if (hasMeetings) return 'active' as const;
    if (hasContacted) return 'outreach' as const;
    return 'setup' as const;
  }, [data]);

  const setupChecklist = useMemo(() => {
    if (!data) return [];
    const dqDone = (dataQuality?.overallCompleteness ?? 0) >= 50;
    return [
      { label: 'Add target investors', done: data.totalInvestors > 0, link: '/investors', detail: `${data.totalInvestors} investor${data.totalInvestors !== 1 ? 's' : ''} added` },
      { label: 'Enrich investor profiles', done: dqDone, link: '/investors', detail: dqDone ? `${Math.round(dataQuality?.overallCompleteness ?? 0)}% complete` : 'Add partner names, check sizes, thesis fit' },
      { label: 'Prepare data room', done: false, link: '/data-room', detail: 'Upload deck, financials, and key documents' },
      { label: 'Begin outreach', done: data.funnel.contacted > 0, link: '/pipeline', detail: data.funnel.contacted > 0 ? `${data.funnel.contacted} contacted` : 'Move investors to "Contacted" in the pipeline' },
      { label: 'Schedule first meeting', done: data.totalMeetings > 0, link: '/calendar', detail: data.totalMeetings > 0 ? `${data.totalMeetings} meeting${data.totalMeetings !== 1 ? 's' : ''} logged` : 'Log your first investor meeting' },
    ];
  }, [data, dataQuality]);
  const funnelStages = data ? [
    { label: 'Identified', value: identifiedCount > 0 ? identifiedCount : 0 },
    { label: 'Contacted', value: data.funnel.contacted },
    { label: 'Meetings', value: data.funnel.meetings },
    { label: 'Engaged', value: data.funnel.engaged },
    { label: 'In DD', value: data.funnel.in_dd },
    { label: 'Term Sheets', value: data.funnel.term_sheets },
    { label: 'Closed', value: data.funnel.closed },
  ] : [];

  // Memoize health score computation (7 derived values)
  const healthScoreMemo = useMemo(() => {
    const velScore = velocity ? Math.min(100, Math.round(velocity.summary.avg_velocity_score)) : 0;
    const convRate = data && data.funnel.contacted > 0 ? Math.min(100, Math.round(((data.funnel.term_sheets + data.funnel.closed) / data.funnel.contacted) * 100 * 5)) : 0;
    const heatScore = dealHeat ? Math.min(100, Math.round((dealHeat.counts.hot * 100 + dealHeat.counts.warm * 70 + dealHeat.counts.cool * 40) / Math.max(dealHeat.counts.total, 1))) : 0;
    const totalFollowups = pendingFollowups.length;
    const overdueCount = pendingFollowups.filter(f => f.due_at && f.due_at.split('T')[0] < new Date().toISOString().split('T')[0]).length;
    const fuRate = totalFollowups > 0 ? Math.round(((totalFollowups - overdueCount) / totalFollowups) * 100) : 100;
    const dqScore = dataQuality?.overallCompleteness ?? (ph?.dataQualityPct ?? 0);
    const hs = Math.round(velScore * 0.30 + convRate * 0.25 + heatScore * 0.20 + fuRate * 0.15 + dqScore * 0.10);
    return { healthScore: hs, scoreClr: scoreColor(hs), velScore, convRate, heatScore, fuRate, dqScore };
  }, [velocity, data, dealHeat, pendingFollowups, dataQuality, ph]);

  // Memoize watching investors (tier 1 active, top 5)
  const watchingInvestors = useMemo(
    () => dealHeat?.investors.filter(i => i.tier === 1 && !['passed','dropped'].includes(i.status)).slice(0, 5) ?? [],
    [dealHeat]
  );

  if (loading) {
    return (
      <div style={skelWrap}>
        <div>
          <div className="skeleton" style={skelTitle} />
          <div className="skeleton" style={skelSubtitle} /></div>
        <div className="grid grid-cols-2 lg:grid-cols-4" style={skelGrid}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={skelCard} />
          ))}</div>
        <div className="skeleton" style={skelBanner} />
      </div>);
  }

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
                Updated {relativeTime(lastRefresh)}</span>
            )}</p></div>
        <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
          <button onClick={() => setFocusMode(f => !f)} className="btn btn-secondary btn-sm" title={focusMode ? 'Show all sections' : 'Show essential sections only'}>
            <Target className="w-3.5 h-3.5" /> {focusMode ? 'Show All' : 'Compact'}</button>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="btn btn-secondary btn-sm">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'} <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>(R)</span></button>
          <div className="relative group">
            <button className="btn btn-secondary btn-sm">
              <Download className="w-3.5 h-3.5" /> Export</button>
            <div
              className="absolute right-0 mt-1 py-1 hidden group-hover:block z-10"
              style={{
                width: '176px',
                background: 'var(--surface-1)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)', }}>
              {['investors', 'meetings', 'tasks', 'pipeline', 'activity'].map(t => (
                <a
                  key={t}
                  href={`/api/export?type=${t}`}
                  download
                  className="block capitalize transition-colors hover-surface-2"
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-secondary)', }}>
                  {t} CSV</a>
              ))}</div></div></div></div>

      {/* AI Narrative Brief — strategic synthesis at a glance */}
      {narrativeBrief && (
        <div
          style={{
            background: 'var(--surface-1)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-5) var(--space-6)',
            borderLeft: '3px solid var(--accent)',
          }}>
          <div className="flex items-start gap-3">
            <span className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }}>
              <Sparkles className="w-4 h-4" /></span>
            <p style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-primary)',
              fontWeight: 300,
              lineHeight: 1.6,
              margin: 0,
            }}>{narrativeBrief}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {data && data.totalInvestors === 0 && (
        <div
          className="text-center"
          style={{ borderRadius: 'var(--radius-xl)', padding: 'var(--space-12) var(--space-8)', background: 'var(--surface-1)' }}>
          <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 400, color: 'var(--text-primary)' }}>Initialize Your Fundraise</h2>
          <p style={{ ...textSmSecondary, maxWidth: '28rem', margin: 'var(--space-3) auto var(--space-6)' }}>
            Seed the database with ASL Series C investor targets and configuration, or add investors manually.</p>
          <div className="flex justify-center" style={{ gap: 'var(--space-3)' }}>
            <button
              onClick={seedData}
              disabled={seeding}
              className="btn btn-primary btn-md disabled:opacity-50">
              {seeding ? 'Seeding...' : 'Seed ASL Data'}</button>
            <Link href="/investors" className="btn btn-secondary btn-md">
              Add Manually</Link></div></div>
      )}

      {(!data || data.totalInvestors > 0) && (
        <>
          {/* Setup Phase Guide — shows when fundraise hasn't started active outreach yet */}
          {(fundraisePhase === 'setup' || fundraisePhase === 'outreach') && (
            <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)' }}>
              <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-4)' }}>
                <span style={{ color: 'var(--accent)' }}><ClipboardList className="w-5 h-5" /></span>
                <div>
                  <div style={textSmPrimary}>Getting Started</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>
                    {fundraisePhase === 'setup' ? 'Set up your pipeline, then start outreach' : 'Great — outreach started. Next: schedule meetings.'}
                  </div>
                </div>
                <div className="ml-auto" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {setupChecklist.filter(s => s.done).length}/{setupChecklist.length} complete
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {setupChecklist.map((step, i) => (
                  <Link
                    key={i}
                    href={step.link}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      background: step.done ? 'var(--surface-0)' : 'var(--surface-2)',
                      border: step.done ? '1px solid var(--border-subtle)' : '1px solid var(--border-default)',
                      textDecoration: 'none',
                      opacity: step.done ? 0.7 : 1,
                    }}>
                    <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: step.done ? 'var(--accent)' : 'var(--surface-3)', color: step.done ? 'var(--surface-0)' : 'var(--text-muted)', fontSize: 'var(--font-size-xs)', fontWeight: 400, flexShrink: 0 }}>
                      {step.done ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: step.done ? 300 : 400, color: step.done ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: step.done ? 'line-through' : 'none' }}>{step.label}</div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 1 }}>{step.detail}</div>
                    </div>
                    {!step.done && <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Fundraise Health Score — only shown once active outreach begins */}
          {fundraisePhase !== 'setup' && fundraisePhase !== 'outreach' && (() => {
            const { healthScore, scoreClr, velScore, convRate, heatScore, fuRate, dqScore } = healthScoreMemo;
            return (
              <div className="flex items-center gap-5" style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-4) var(--space-6)' }}>
                <div style={{ position: 'relative', width: 56, height: 56 }} title="Composite fundraise health (velocity 30%, conversion 25%, heat 20%, follow-ups 15%, data quality 10%)">
                  <svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="none" stroke="var(--surface-3)" strokeWidth="4" /><circle cx="28" cy="28" r="24" fill="none" stroke={scoreClr} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${healthScore * 1.508} 151`} transform="rotate(-90 28 28)" style={{ transition: 'stroke-dasharray 0.6s ease' }} /></svg>
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--font-size-lg)', fontWeight: 300, color: scoreClr, fontVariantNumeric: 'tabular-nums' }}>{healthScore}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div style={textSmPrimary}>Fundraise Health</div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>{healthScore >= 70 ? 'Strong momentum across the board' : healthScore >= 45 ? 'Some areas need attention' : 'Multiple areas require immediate focus'}</div>
                </div>
                <div className="flex gap-4">
                  {[{ l: 'Velocity', v: velScore, t: 'Average pipeline velocity score (0-100)' }, { l: 'Conversion', v: convRate, t: 'Term sheet + closed / total contacted, scaled' }, { l: 'Heat', v: heatScore, t: 'Weighted investor engagement temperature' }, { l: 'Follow-ups', v: fuRate, t: 'Percentage of follow-ups completed on time' }, { l: 'Data', v: dqScore, t: 'Overall data completeness across investor profiles' }].map(m => (
                    <div key={m.l} className="text-center" style={{ minWidth: 48 }} title={m.t}>
                      <div style={labelTertiary}>{m.l}</div>
                      <div className="tabular-nums" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 300, color: scoreColor(m.v), marginTop: 2 }}>{m.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Raise Progress */}
          {stressTest ? (() => {
            const pct = Math.min(100, Math.round((stressTest.forecast.base / stressTest.target) * 100));
            return (
              <Link href="/stress-test" style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  className="transition-colors"
                  style={{
                    background: 'var(--surface-1)',
                    borderRadius: 'var(--radius-xl)',
                    padding: 'var(--space-6)',
                    cursor: 'pointer', }}>
                  <div className="flex items-baseline gap-3" style={{ marginBottom: 'var(--space-4)' }}>
                    <span style={{
                      fontSize: 'var(--font-size-3xl)',
                      fontWeight: 300,
                      color: 'var(--text-primary)',
                      lineHeight: 1,
                      letterSpacing: '-0.02em',
                      fontFamily: 'var(--font-cormorant), Georgia, serif',}}>
                      €{Math.round(stressTest.forecast.base)}M</span>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>
                      of €{stressTest.target}M target</span></div>

                  <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-5)' }}>
                    <div style={{
                      flex: 1,
                      height: '4px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-3)',
                      overflow: 'hidden',}}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent)',
                        transition: 'width 0.4s ease',
                      }} /></div>
                    {velocity?.summary?.raise_days_elapsed != null && velocity?.summary?.raise_target_days != null && (
                      <span title="Days until target close date" style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-tertiary)',
                        whiteSpace: 'nowrap',
                        fontWeight: 400,}}>
                        Day {velocity.summary.raise_days_elapsed} of {velocity.summary.raise_target_days}</span>
                    )}
                    {velocity?.summary?.raise_target_days != null && velocity?.summary?.raise_days_elapsed != null && (() => {
                      const daysLeft = velocity.summary.raise_target_days - velocity.summary.raise_days_elapsed;
                      const weeksLeft = Math.ceil(daysLeft / 7);
                      return daysLeft > 0 ? <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: timeColor(weeksLeft, 4, 8) }}>{weeksLeft}w left</span> : null;
                    })()}</div>

                  {/* Committed Capital */}
                  {data?.committedCapital != null && data.committedCapital > 0 && (
                    <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-4)' }}>
                      <div style={{ flex: 1, height: '4px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-3)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, Math.round((data.committedCapital / stressTest.target) * 100))}%`, height: '100%', borderRadius: 'var(--radius-sm)', background: 'var(--success)', transition: 'width 0.4s ease' }} /></div>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--success)', whiteSpace: 'nowrap', fontWeight: 400 }}>
                        €{Math.round(data.committedCapital)}M committed</span>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        ({data.committedInvestorCount} investor{data.committedInvestorCount !== 1 ? 's' : ''})</span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div style={labelXsTertiary4}>
                        Best case</div>
                      <div style={metricLgPrimary}>
                        €{Math.round(stressTest.forecast.best)}M</div></div>
                    <div>
                      <div style={labelXsTertiary4}>
                        Close probability</div>
                      <div style={metricLgPrimary}>
                        {stressTest.closeProbability}%</div></div>
                    <div>
                      <div style={labelXsTertiary4}>
                        Gap</div>
                      <div style={metricLgPrimary}>
                        {stressTest.forecast.base >= stressTest.target ? 'Covered' : `€${Math.round(stressTest.target - stressTest.forecast.base)}M`}</div></div></div></div>
              </Link>);
          })() : sectionErrors.stressTest ? (
            <SectionError label="Raise progress" onRetry={() => fetchSection('stressTest')} />
          ) : (
            <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)' }}>
              <div className="skeleton" style={{ height: '48px', width: '220px', marginBottom: 'var(--space-4)', borderRadius: 'var(--radius-md)' }}
                />
              <div className="skeleton" style={{ height: '4px', width: '100%', marginBottom: 'var(--space-5)', borderRadius: 'var(--radius-sm)' }}
                />
              <div className="grid grid-cols-3 gap-4">
                <div className="skeleton" style={{ height: '40px', borderRadius: 'var(--radius-md)' }} />
                <div className="skeleton" style={{ height: '40px', borderRadius: 'var(--radius-md)' }} />
                <div className="skeleton" style={{ height: '40px', borderRadius: 'var(--radius-md)' }} /></div></div>
          )}

          {/* Pulse Strip — hidden in setup/outreach when all zeros */}
          {sectionErrors.health && !data && <SectionError label="Health metrics" onRetry={() => fetchSection('health')} />}
          {fundraisePhase !== 'setup' && fundraisePhase !== 'outreach' && (
          <div key={lastRefresh?.getTime()} className="grid grid-cols-2 lg:grid-cols-5 gap-3 card-stagger data-refreshed">
            <PulseCard label="Active investors" value={ph?.activeInvestors ?? data?.totalInvestors ?? 0} sub={`${data?.totalInvestors ?? 0} total`}
              />
            <PulseCard label="This week" value={ph?.meetingsThisWeek ?? 0} sub="meetings" />
            <PulseCard label="Meeting streak" value={meetingStreak} sub={`day${meetingStreak === 1 ? '' : 's'}`} />
            <PulseCard label="Follow-ups due" value={ph?.overdueFollowups ?? 0} sub="overdue" />
            <PulseCard label="Deal heat" value={`${healthScoreMemo.heatScore}%`} sub={`${dealHeat?.counts.hot ?? 0} hot`}
              /></div>
          )}

          {/* Pipeline Velocity */}
          {!focusMode && (velocity ? (
            <VelocityStrip velocity={velocity} />
          ) : sectionErrors.velocity ? (
            <SectionError label="Pipeline velocity" onRetry={() => fetchSection('velocity')} />
          ) : null)}

          {/* ── Detail Sections ───────────────────────────────── */}
          {!focusMode && (bottlenecks?.summary?.totalStuck || atRisk || cp) && (
            <div className="section-divider" />
          )}

          {/* Pipeline Bottlenecks — where investors are stuck */}
          {!focusMode && bottlenecks && bottlenecks.summary.totalStuck > 0 && (
            <div style={{ ...cardPadding, borderLeft: '3px solid var(--warning)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Pipeline bottlenecks</h2>
                <span className="tabular-nums" style={labelTertiary}>
                  {bottlenecks.summary.totalStuck} stuck / {bottlenecks.summary.totalActive} active</span></div>

              <div className="space-y-3">
                {bottlenecks.bottlenecks.filter(b => b.stuckCount > 0).map(b => (
                  <div key={b.stage}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>
                          {STATUS_LABELS[b.stage as keyof typeof STATUS_LABELS] ?? b.stage.replace(/_/g, ' ')}</span>
                        <span className="tabular-nums" style={{
                          fontSize: 'var(--font-size-xs)',
                          color: b.avgDaysInStage > b.expectedDays * 2 ? 'var(--danger)' : 'var(--warning)',
                        }}>avg {b.avgDaysInStage}d / {b.expectedDays}d expected</span>
                      </div>
                      <span className="tabular-nums" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--danger)' }}>
                        {b.stuckCount} stuck</span>
                    </div>
                    <div className="space-y-1">
                      {b.stuckInvestors.slice(0, 3).map(inv => (
                        <Link key={inv.id} href={`/investors/${inv.id}`}
                          className="flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors hover-surface-2"
                          style={{ textDecoration: 'none' }}>
                          <span style={labelTertiary}>T{inv.tier}</span>
                          <span className="flex-1 min-w-0 truncate" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 300 }}>
                            {inv.name}</span>
                          <span className="truncate hidden sm:block" style={{ ...labelSecondary, maxWidth: '220px' }}>
                            {inv.suggestedAction}</span>
                          <span className="tabular-nums shrink-0" style={{
                            fontSize: 'var(--font-size-xs)',
                            color: inv.overdueFactor > 3 ? 'var(--danger)' : 'var(--warning)',
                          }}>{inv.daysInStage}d</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gap Closers — top investors to accelerate */}
          {!focusMode && stressTest?.gapInvestors && stressTest.gapInvestors.length > 0 && !stressTest.onTrack && (
            <div style={{ ...cardPadding, borderLeft: '3px solid var(--warning)' }}>
              <h2 className="section-title flex items-center gap-2 mb-2">
                <Target className="w-4 h-4" /> Close the gap</h2>
              <div className="space-y-1">
                {stressTest.gapInvestors.slice(0, 3).map(g => (
                  <Link key={g.id} href={`/investors/${g.id}`} className="flex items-center justify-between py-1.5 transition-colors rounded px-2 hover-surface-2"
                    style={{ fontSize: 'var(--font-size-sm)' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 400 }}>{g.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>{g.intervention}</span>
                    <span style={{ color: 'var(--success)', fontWeight: 400, fontSize: 'var(--font-size-xs)' }}>+€{g.impactDelta}M</span>
                  </Link>))}</div></div>
          )}

          {/* Watching — Tier 1 active investors */}
          {!focusMode && dealHeat && watchingInvestors.length > 0 && (() => {
            return (
              <div className="flex gap-3 overflow-x-auto" style={{ padding: 'var(--space-1) 0' }}>
                {watchingInvestors.map(w => {
                  const daysSince = w.lastMeeting ? Math.round((Date.now() - new Date(w.lastMeeting).getTime()) / 864e5) : null;
                  return (
                    <Link key={w.id} href={`/investors/${w.id}`} className="flex items-center gap-2 shrink-0 transition-colors hover-surface-2" style={{ padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-lg)', background: 'var(--surface-1)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-primary)' }}>{w.name}</span>
                      <span style={labelMuted}>{STATUS_LABELS[w.status as keyof typeof STATUS_LABELS] ?? w.status}</span>
                      {daysSince !== null && <span style={{ fontSize: 'var(--font-size-xs)', color: daysSince > 14 ? 'var(--danger)' : 'var(--text-muted)' }}>{daysSince}d</span>}
                    </Link>);
                })}
              </div>);
          })()}

          {/* At Risk Deals */}
          {sectionErrors.atRisk && !atRisk && <SectionError label="At-risk deals" onRetry={() => fetchSection('atRisk')} />}
          {atRisk && (atRisk.scoreReversals.length > 0 || atRisk.staleInvestors.length > 0) && (
            <div style={cardPadding}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" /> At risk</h2>
                <span className="tabular-nums" style={labelTertiary}>
                  {atRisk.scoreReversals.length + atRisk.staleInvestors.length} deal{atRisk.scoreReversals.length + atRisk.staleInvestors.length !== 1 ? 's' : ''}
                </span></div>

              <div className="space-y-2">
                {atRisk.scoreReversals.map((rev) => (
                  <div
                    key={`rev-${rev.investorId}`}
                    className="flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors hover-surface-2">
                    <span className="mt-0.5 shrink-0" style={textTertiary}>
                      <TrendingDown className="w-4 h-4" /></span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link
                          href={`/investors/${rev.investorId}`}
                          className="transition-colors truncate investor-link"
                          style={textSmLink}>
                          {rev.investorName}</Link>
                        <span style={labelTertiary}>
                          {rev.severity}</span></div>
                      <p style={labelSecondary}>
                        Score {rev.previousScore} → {rev.currentScore} ({rev.delta})</p></div>
                    <Link
                      href={`/investors/${rev.investorId}`}
                      className="shrink-0 btn btn-secondary btn-sm flex items-center gap-1">
                      Follow up <ChevronRight className="w-3 h-3" /></Link></div>
                ))}

                {atRisk.staleInvestors.map((inv) => (
                  <div
                    key={`stale-${inv.investorId}`}
                    className="flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors hover-surface-2">
                    <span className="mt-0.5 shrink-0" style={textTertiary}>
                      {inv.acceleration === 'gone_silent' ? <UserMinus className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link
                          href={`/investors/${inv.investorId}`}
                          className="transition-colors truncate investor-link"
                          style={textSmLink}>
                          {inv.investorName}</Link>
                        <span style={labelTertiary}>T{inv.tier}</span>
                        <span style={labelTertiary}>
                          {inv.acceleration === 'gone_silent' ? 'Silent' : 'Slowing'}</span></div>
                      <p style={labelSecondary}>
                        {inv.daysSinceLastMeeting !== null
                          ? `No contact in ${inv.daysSinceLastMeeting} days`
                          : inv.signal}</p></div>
                    <Link
                      href={`/investors/${inv.investorId}`}
                      className="shrink-0 btn btn-secondary btn-sm flex items-center gap-1">
                      Follow up <ChevronRight className="w-3 h-3" /></Link></div>
                ))}</div></div>
          )}

          {/* Top Focus Today */}
          {sectionErrors.pulse && !pulse && <SectionError label="Pulse data" onRetry={() => fetchSection('pulse')} />}
          {cp && cp.topFocus.length > 0 && (
            <div style={cardPadding}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title flex items-center gap-2">
                  <Target className="w-4 h-4" /> Top focus today</h2>
                <Link
                  href="/decide"
                  className="flex items-center gap-1"
                  style={labelAccent}>
                  Full priority queue <ArrowRight className="w-3 h-3" /></Link></div>
              <div className="space-y-2">
                {cp.topFocus.map((item, i) => {
                  const MomentumIcon = item.momentum === 'accelerating' ? TrendingUp
                    : item.momentum === 'decelerating' ? TrendingDown
                    : item.momentum === 'stalled' ? ArrowDownRight
                    : Minus;
                  return (
                    <div
                      key={item.investorId}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors hover-surface-2">
                      <span
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 400,
                          background: i === 0 ? 'var(--accent)' : 'var(--surface-3)',
                          color: i === 0 ? 'var(--surface-0)' : 'var(--text-secondary)', }}
>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/investors/${item.investorId}`}
                            className="truncate transition-colors investor-link"
                            style={textSmLink}>
                            {item.investorName}</Link>
                          <span style={labelTertiary}>T{item.tier}</span>
                          <MomentumIcon className="w-3.5 h-3.5" style={textTertiary} /></div>
                        <p className="truncate mt-0.5" style={labelSecondary}>{item.recommendedAction}</p></div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="flex items-center gap-1" style={labelTertiary}>
                          <Timer className="w-3 h-3" /> {item.timeEstimate}</span>
                        <span className="tabular-nums" style={textSmPrimary}>{item.focusScore}</span>
                      </div>
                    </div>);
                })}</div></div>
          )}

          {/* Overnight + Conviction */}
          {!focusMode && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div style={cardPadding}>
              <h2 className="section-title flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4" /> Last 24 hours</h2>
              {ov ? (
                <div className="space-y-2.5">
                  {ov.activityFeed.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="w-1 h-1 rounded-full mt-2 shrink-0" style={{ background: 'var(--accent)' }} />
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>{item}</span></div>
                  ))}
                  {ov.statusChanges.length > 0 && (
                    <div className="mt-3 pt-3" style={stBorderTop}>
                      <div className="mb-1.5" style={labelTertiary}>Stage movements</div>
                      {ov.statusChanges.slice(0, 3).map((sc, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <ArrowUpRight className="w-3 h-3 shrink-0" style={stAccent} />
                          <span style={labelSecondary}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 400 }}>{sc.investorName}</span>
                            {' '}{sc.from !== 'unknown' ? `${formatStage(sc.from)} → ` : ''}{formatStage(sc.to)}</span></div>
                      ))}</div>
                  )}
                  {ov.meetingNames.length > 0 && (
                    <div className="mt-2 pt-2" style={stBorderTop}>
                      <div className="mb-1" style={labelTertiary}>Meetings logged</div>
                      <div style={labelSecondary}>{ov.meetingNames.join(', ')}</div></div>
                  )}</div>
              ) : (
                <p style={labelSmMuted}>Loading overnight data...</p>
              )}</div>

            <div style={cardPadding}>
              <h2 className="section-title flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4" /> Conviction radar</h2>
              {cv ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="metric-value">
                        {cv.avgEnthusiasm.toFixed(1)}
                        <span style={unitSmMuted}>/5</span>
                      </div>
                      <div className="metric-label">Avg enthusiasm</div></div></div>

                  <div>
                    <div className="mb-1.5" style={labelTertiary}>Momentum distribution</div>
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
                      {cv.stalled > 0 && <MomentumLabel count={cv.stalled} label="Stalled" />}</div></div>

                  {cv.alerts.length > 0 && (
                    <div className="mt-2 pt-2" style={stBorderTop}>
                      <div className="mb-1.5 flex items-center gap-1" style={labelSecondary}>
                        <AlertTriangle className="w-3 h-3" /> Enthusiasm drops</div>
                      {cv.alerts.map((alert, i) => (
                        <div key={i} className="flex items-center justify-between py-1">
                          <Link
                            href={`/investors/${alert.investorId}`}
                            className="transition-colors investor-link"
                            style={{ fontSize: 'var(--font-size-xs)' }}>
                            {alert.investorName}</Link>
                          <span className="tabular-nums" style={labelSecondary}>
                            {alert.previousScore} → {alert.currentScore} ({-alert.drop})</span></div>
                      ))}</div>
                  )}</div>
              ) : (
                <p style={labelSmMuted}>Loading conviction data...</p>
              )}</div></div>}

          {/* Acceleration Alerts */}
          {!focusMode && cp && cp.topAccelerations.length > 0 && (
            <div style={cardPadding}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Acceleration alerts</h2>
                <Link href="/decide" className="flex items-center gap-1" style={labelAccent}>
                  All actions <ArrowRight className="w-3 h-3" /></Link></div>
              <div className="space-y-2">
                {cp.topAccelerations.map((accel) => {
                  const triggerLabel = accel.triggerType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  return (
                    <div
                      key={accel.id}
                      className="flex items-start gap-3 py-2.5 px-3 rounded-lg transition-colors hover-surface-2">
                      <Zap className="w-4 h-4 shrink-0 mt-0.5" style={textTertiary} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Link
                            href={`/investors/${accel.investorId}`}
                            className="transition-colors investor-link"
                            style={textSmLink}>
                            {accel.investorName}</Link>
                          <span style={labelTertiary}>
                            {accel.urgency === 'immediate' ? 'Now' : accel.urgency}</span>
                          <span style={labelMuted}>{triggerLabel}</span></div>
                        <p className="leading-relaxed" style={labelSecondary}>{accel.description}</p></div>
                      <button
                        onClick={() => executeAcceleration(accel.id)}
                        className="shrink-0 btn btn-secondary btn-sm flex items-center gap-1"
                        title="⌘E">
                        Execute <ChevronRight className="w-3 h-3" /></button>
                    </div>);
                })}</div></div>
          )}

          {/* Upcoming follow-ups — always visible (critical actions) */}
          {pendingFollowups.length > 0 && (
            <div style={cardPadding}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Upcoming follow-ups</h2>
                <Link href="/followups" className="flex items-center gap-1" style={labelAccent}>
                  All follow-ups <ArrowRight className="w-3 h-3" /></Link></div>
              <div className="space-y-1.5">
                {pendingFollowups.slice(0, 5).map((fu) => (
                  <FollowupRow key={fu.id} followup={fu} onComplete={async (id) => {
                    const prev = pendingFollowups;
                    setPendingFollowups(p => p.filter(f => f.id !== id));
                    try {
                      const res = await fetch('/api/followups', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'completed' }) });
                      if (!res.ok) throw new Error(`${res.status}`);
                    } catch (e) { console.error('[FOLLOWUP_COMPLETE]', e instanceof Error ? e.message : e); setPendingFollowups(prev); }
                  }} />
                ))}</div></div>
          )}
          {sectionErrors.followups && pendingFollowups.length === 0 && (
            <SectionError label="Follow-ups" onRetry={() => fetchSection('followups')} />
          )}

          {/* Hot Deals — detail section */}
          {!focusMode && <><div className="section-divider" />
            <div style={cardPadding}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title flex items-center gap-2">
                  <Flame className="w-4 h-4" /> Hot deals</h2>
                <Link href="/dealflow" className="flex items-center gap-1" style={labelAccent}>
                  All deals <ArrowRight className="w-3 h-3" /></Link></div>
              {sectionErrors.dealHeat && !dealHeat ? (
                <SectionError label="Deal heat" onRetry={() => fetchSection('dealHeat')} />
              ) : dealHeat && dealHeat.investors.length > 0 ? (
                <div className="space-y-1.5">
                  {dealHeat.investors.slice(0, 5).map((inv) => (
                    <HotDealRow key={inv.id} investor={inv} />
                  ))}</div>
              ) : (
                <div style={{ padding: 'var(--space-2) 0' }}>
                  <p style={labelSmMuted}>No active deals scored yet</p>
                  <p style={{ ...labelMuted, marginTop: 'var(--space-1)', opacity: 0.7 }}>Log meetings to generate deal heat scores</p>
                </div>
              )}</div></>}

          {/* Pipeline */}
          {!focusMode && <div style={cardPadding}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Pipeline</h2>
              <Link href="/pipeline" className="flex items-center gap-1" style={labelAccent}>
                Pipeline view <Columns3 className="w-3 h-3" /></Link></div>
            {sectionErrors.health && funnelStages.length === 0 ? (
              <SectionError label="Pipeline data" onRetry={() => fetchSection('health')} />
            ) : (
            <div className="flex flex-col items-center space-y-1">
              {funnelStages.map((stage, i) => {
                const widthPct = Math.max(100 - (i * 13), 25);
                const opacity = 1 - (i * 0.08);
                const prevValue = i > 0 ? funnelStages[i - 1].value : 0;
                const convPct = prevValue > 0 ? Math.round((stage.value / prevValue) * 100) : null;
                return (
                  <div key={stage.label} className="w-full flex flex-col items-center">
                    {convPct !== null && stage.value > 0 && (
                      <div className="tabular-nums" style={{ ...labelMuted, marginBottom: 1 }}>{convPct}%</div>
                    )}
                    <div className="w-full flex items-center justify-center" style={{ maxWidth: `${widthPct}%` }}>
                      <div
                        className="w-full rounded-md h-9 flex items-center justify-between px-4"
                        style={{ background: `rgba(27, 42, 74, ${Math.max(opacity * 0.12, 0.04)})` }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-secondary)' }}>{stage.label}</span>
                        <span className="tabular-nums" style={textSmPrimary}>{stage.value}</span>
                      </div>
                    </div>
                  </div>);
              })}
              {(data?.funnel?.passed ?? 0) > 0 && (
                <div className="w-full flex items-center justify-center mt-2 pt-2" style={{ maxWidth: '50%', borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="w-full rounded-md h-7 flex items-center justify-between px-4" style={stSurface2}>
                    <span style={labelTertiary}>Passed</span>
                    <span className="tabular-nums" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-secondary)' }}>{data?.funnel?.passed ?? 0}</span>
                  </div></div>
              )}</div>
            )}
            {data && data.funnel.contacted > 0 && (() => {
              const wins = (data.funnel.term_sheets ?? 0) + (data.funnel.closed ?? 0);
              const rate = Math.round((wins / data.funnel.contacted) * 100);
              const color = rate >= 10 ? 'var(--success)' : rate >= 5 ? 'var(--warning)' : 'var(--danger)';
              return (
                <div className="flex items-center justify-between mt-3 px-1" style={labelSecondary}>
                  <span className="flex items-center gap-1"><Target className="w-3 h-3" /> Win Rate</span>
                  <span className="tabular-nums" style={{ color }}>{rate}% <span style={stTextMuted}>({wins}/{data.funnel.contacted})</span></span>
                </div>);
            })()}</div>}

          {/* Deliverables section removed — sidebar covers all navigation */}

          {/* Tasks + Activity */}
          {!focusMode && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div style={cardPadding}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" /> Upcoming tasks</h2>
                <Link href="/decide" className="flex items-center gap-1" style={labelAccent}>
                  All tasks <ArrowRight className="w-3 h-3" /></Link></div>
              {sectionErrors.tasks && tasks.length === 0 ? (
                <SectionError label="Tasks" onRetry={() => fetchSection('tasks')} />
              ) : tasks.length > 0 ? (
                <div className="space-y-1.5">
                  {tasks.slice(0, 5).map(task => {
                    const due = task.due_date?.split('T')[0];
                    const isOverdue = due && due < new Date().toISOString().split('T')[0];
                    return (
                      <div key={task.id} className="flex items-start gap-2.5 py-2 px-3 rounded-lg transition-colors hover-surface-2">
                        <span className="mt-0.5 w-2 h-2 rounded-full shrink-0" style={{
                          background: task.priority === 'high' ? 'var(--danger)' : task.priority === 'medium' ? 'var(--warning)' : 'var(--text-muted)'
                        }} />
                        <div className="flex-1 min-w-0">
                          <div className="truncate" style={textSmPrimary}>{task.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.investor_name && <span style={labelTertiary}>{task.investor_name}</span>}
                            {due && <span className="tabular-nums" style={{
                              fontSize: 'var(--font-size-xs)',
                              color: isOverdue ? 'var(--danger)' : 'var(--text-muted)',
                              fontWeight: isOverdue ? 400 : 300,
                            }}>{isOverdue ? 'Overdue' : fmtDateShort(due)}</span>}
                          </div>
                        </div>
                      </div>);
                  })}
                </div>
              ) : (
                <p style={labelSmMuted}>No upcoming tasks</p>
              )}</div>

            <div style={cardPadding}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Recent activity</h2>
                <Link href="/today" className="flex items-center gap-1" style={labelAccent}>
                  Full view <ArrowRight className="w-3 h-3" /></Link></div>
              {sectionErrors.activity && activity.length === 0 ? (
                <SectionError label="Activity" onRetry={() => fetchSection('activity')} />
              ) : activity.length > 0 ? (
                <div className="space-y-1.5">
                  {activity.slice(0, 6).map(item => (
                    <div key={item.id} className="flex items-start gap-2.5 py-1.5">
                      <span className="w-1 h-1 rounded-full mt-2 shrink-0" style={{ background: 'var(--accent)' }} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 300 }}>
                          {item.subject}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.investor_name && <span style={labelTertiary}>{item.investor_name}</span>}
                          <span style={labelMuted}>{relativeTime(new Date(item.created_at))}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={labelSmMuted}>No recent activity</p>
              )}</div>
          </div>}

          {/* Data Quality */}
          {!focusMode && dataQuality && (
            <div style={cardPadding}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Data quality</h2>
                <span className="tabular-nums" style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 400,
                  color: scoreColor(dataQuality.overallCompleteness),
                }}>{dataQuality.overallCompleteness}%</span></div>

              <div className="mb-3" style={{ height: '4px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-3)' }}>
                <div style={{
                  width: `${dataQuality.overallCompleteness}%`,
                  height: '100%',
                  borderRadius: 'var(--radius-sm)',
                  background: scoreColor(dataQuality.overallCompleteness),
                  transition: 'width 0.4s ease',
                }} /></div>

              {dataQuality.worstInvestors.length > 0 && (
                <div className="mb-2">
                  <div className="mb-1" style={labelTertiary}>Needs attention</div>
                  <div className="space-y-1">
                    {dataQuality.worstInvestors.slice(0, 3).map(inv => (
                      <Link key={inv.id} href={`/investors/${inv.id}`}
                        className="flex items-center justify-between py-1 px-2 rounded transition-colors hover-surface-2"
                        style={{ textDecoration: 'none' }}>
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 300 }}>{inv.name}</span>
                        <span className="tabular-nums" style={{ fontSize: 'var(--font-size-xs)', color: scoreColor(inv.completeness) }}>{inv.completeness}%</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {dataQuality.recommendations.length > 0 && (
                <div className="mt-2 pt-2" style={stBorderTop}>
                  {dataQuality.recommendations.slice(0, 2).map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 py-1">
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
                      <span style={labelSecondary}>{rec}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          {(() => {
            const overdueFollowups = pendingFollowups.filter(f => {
              const dueDate = f.due_at?.split('T')[0];
              return dueDate && dueDate < new Date().toISOString().split('T')[0];});
            const atRiskCount = (atRisk?.scoreReversals?.length ?? 0) + (atRisk?.staleInvestors?.length ?? 0);
            const overdueTasks = tasks.filter(t => {
              const due = t.due_date?.split('T')[0];
              return due && due < new Date().toISOString().split('T')[0] && t.priority !== 'low';});
            const completeness = dataQuality?.overallCompleteness ?? 100;

            const actions: { href: string; label: string; sub: string; count?: number }[] = [];

            if (overdueFollowups.length > 0) {
              actions.push({ href: '/followups', label: 'Overdue follow-ups', sub: `${overdueFollowups.length} past due`, count: overdueFollowups.length });
            }
            if (atRiskCount > 0) {
              actions.push({ href: '/dealflow', label: 'At-risk investors', sub: `${atRiskCount} losing momentum`, count: atRiskCount });
            }
            if (overdueTasks.length > 0) {
              actions.push({ href: '/decide', label: 'Blocked tasks', sub: `${overdueTasks.length} overdue`, count: overdueTasks.length });
            }
            if (stressTest && stressTest.closeProbability < 50) {
              actions.push({ href: '/stress-test', label: 'Close at risk', sub: `${stressTest.closeProbability}% probability` });
            }
            if (completeness < 70) {
              actions.push({ href: '/investors', label: 'Data gaps', sub: `CRM ${completeness}% complete` });
            }
            if (actions.length < 4) actions.push({ href: '/meetings/new', label: 'Log meeting (N)', sub: 'Capture a debrief' });
            if (actions.length < 4) actions.push({ href: '/pipeline', label: 'Pipeline', sub: 'Kanban board' });
            if (actions.length < 4) actions.push({ href: '/strategic', label: 'AI analysis', sub: 'Pattern detection' });
            if (actions.length < 4) actions.push({ href: '/investors', label: 'Manage CRM', sub: 'Update statuses' });

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {actions.slice(0, 4).map((a) => (
                  <Link
                    key={a.href + a.label}
                    href={a.href}
                    className="rounded-xl p-4 transition-colors"
                    style={{ textDecoration: 'none' }}>
                    <div className="flex items-center gap-2">
                      <span style={textSmPrimary}>{a.label}</span>
                      {a.count && (
                        <span className="tabular-nums" style={labelTertiary}>
                          {a.count}</span>
                      )}</div>
                    <div className="mt-1" style={labelMuted}>{a.sub}</div></Link>
                ))}
              </div>);
          })()}
        </>
      )}
    </div>);
}

// ---------------------------------------------------------------------------
// Sub-components — monochrome
// ---------------------------------------------------------------------------

function SectionError({ label, onRetry }: { label: string; onRetry: () => void }) {
  const [r, setR] = useState(false);
  return (
    <div className="flex items-center justify-between py-2.5 px-4 rounded-lg" style={stSurface1}>
      <span style={textSmSecondary}>{label} unavailable</span>
      <button disabled={r} className="btn btn-secondary btn-sm"
        onClick={async () => { setR(true); try { await onRetry(); } catch (e) { console.warn('[RETRY]', e instanceof Error ? e.message : e); } finally { setR(false); } }}>
        <RefreshCw className={`w-3 h-3 ${r ? 'animate-spin' : ''}`} /> {r ? 'Retrying' : 'Retry'}</button>
    </div>);
}

function PulseCard({ label, value, sub }: {
  label: string;
  value: string | number;
  sub: string;
  color?: string;
}) {
  return (
    <div
      className="transition-colors"
      style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4) var(--space-5)' }}>
      <div className="metric-label" style={{ marginBottom: 'var(--space-1)' }}>{label}</div>
      <div className="metric-value">{value}</div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-0)' }}>{sub}</div>
    </div>);
}

function MomentumBar({ count, total, opacity, label }: {
  count: number; total: number; opacity: number; label: string;
}) {
  const pct = total > 0 ? Math.max((count / total) * 100, 4) : 0;
  return (
    <div
      className="relative group cursor-default"
      style={{ width: `${pct}%`, background: `rgba(27, 42, 74, ${opacity})`, borderRadius: 'var(--radius-sm)' }}
      title={`${label}: ${count}`}>
      {pct >= 15 && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: opacity > 0.5 ? 'var(--surface-0)' : 'var(--text-secondary)' }}>
          {count}</span>
      )}
    </div>);
}

function MomentumLabel({ count, label }: {
  count: number; label: string;
}) {
  return (
    <span className="flex items-center gap-1" style={labelSecondary}>
      <span style={{ fontWeight: 400 }}>{count}</span> {label}
    </span>);
}

function formatStage(stage: string): string {
  return STATUS_LABELS[stage] || stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function Sparkline({ data, width = 80, height = 24 }: { data: number[]; width?: number; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 2) - 1}`).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>);
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
  const sparkData = (() => {
    const sorted = [...velocity.investors].sort((a, b) => b.days_in_process - a.days_in_process);
    if (sorted.length < 2) return [];
    const binCount = 7;
    const binSize = Math.max(1, Math.ceil(sorted.length / binCount));
    const bins: number[] = [];
    for (let i = 0; i < binCount; i++) {
      const slice = sorted.slice(i * binSize, (i + 1) * binSize);
      if (slice.length) bins.push(slice.reduce((s, v) => s + v.velocity_score, 0) / slice.length);
    }
    return bins;
  })();
  return (
    <div className="group rounded-xl overflow-hidden transition-all">
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title flex items-center gap-2">
            <Gauge className="w-4 h-4" /> Pipeline velocity</h2>
          <Link
            href="/dealflow"
            className="flex items-center gap-1 transition-opacity opacity-0 group-hover:opacity-100"
            style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)' }}>
            Details <ArrowRight className="w-3 h-3" /></Link></div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
          <div>
            <div style={labelTertiary}>Days elapsed</div>
            <div className="tabular-nums mt-0.5" style={metricXlPrimary}>
              {s.raise_days_elapsed}
              <span style={unitSmMuted}>/{s.raise_target_days}d</span>
            </div></div>
          <div>
            <div style={labelTertiary}>Avg mtgs/week</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="tabular-nums" style={metricXlPrimary}>{avgMeetingsPerWeek}</span>
              <span style={textTertiary}>
                {trendUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}</span></div></div>
          <div>
            <div style={labelTertiary}>Velocity score</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="tabular-nums" style={metricXlPrimary}>
                {s.avg_velocity_score}
                <span style={unitSmMuted}>/100</span></span>
              {sparkData.length > 1 && <Sparkline data={sparkData} />}</div></div>
          <div>
            <div style={labelTertiary}>
              {isOverTarget ? 'Over target by' : 'Days remaining'}</div>
            <div className="tabular-nums mt-0.5" style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: isOverTarget ? 'var(--danger)' : daysRemaining < 30 ? 'var(--danger)' : daysRemaining < 60 ? 'var(--warning)' : 'var(--success)' }}>
              {isOverTarget ? `+${s.raise_days_elapsed - s.raise_target_days}` : daysRemaining}d</div></div></div></div>

      <div style={{ height: '3px', background: 'var(--surface-3)' }}>
        <div
          className="h-full transition-all duration-700"
          style={{
            width: `${progressPct}%`,
            background: 'var(--accent)',
            borderRadius: progressPct < 100 ? '0 1px 1px 0' : undefined,
          }} /></div>

      <div className="px-5 py-2 flex items-center gap-4" style={stBorderTop}>
        <span className="flex items-center gap-1" style={labelSecondary}>
          <span style={{ fontWeight: 400 }}>{s.on_track}</span> on track</span>
        <span className="flex items-center gap-1" style={labelTertiary}>
          <span style={{ fontWeight: 400 }}>{s.behind}</span> behind</span>
        <span className="flex items-center gap-1" style={labelMuted}>
          <span style={{ fontWeight: 400 }}>{s.at_risk}</span> at risk</span></div>
    </div>);
}

function HotDealRow({ investor }: { investor: DealHeatInvestor }) {
  const daysSilent = investor.lastMeeting ? Math.floor((Date.now() - new Date(investor.lastMeeting).getTime()) / 864e5) : null;
  return (
    <div
      className="table-row flex items-center gap-3 py-2 px-3 rounded-lg transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/investors/${investor.id}`}
            className="truncate transition-colors investor-link"
            style={textSmLink}>
            {investor.name}</Link>
          <span style={labelTertiary}>T{investor.tier}</span></div>
        <div className="mt-0.5 flex items-center gap-2" style={labelMuted}>
          <span>{formatStage(investor.status)}</span>
          {daysSilent !== null && daysSilent >= 7 && <span style={{ color: daysSilent >= 14 ? 'var(--danger)' : 'var(--warning)', fontSize: 'var(--font-size-xs)' }}>{daysSilent}d silent</span>}</div></div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="tabular-nums" style={textSmPrimary}>
          {investor.dealHeat.heat}</span>
        <Link
          href={`/meetings/new?investor=${investor.id}`}
          onClick={e => e.stopPropagation()}
          className="btn btn-secondary btn-sm"
          style={{ textDecoration: 'none', fontSize: 'var(--font-size-xs)' }}>
          Schedule</Link></div>
    </div>);
}

const ACTION_LABELS: Record<string, string> = {
  thank_you: 'Thank You',
  objection_response: 'Objection Response',
  data_share: 'Data Share',
  schedule_followup: 'Schedule Follow-up',
  warm_reengagement: 'Re-engagement',
  milestone_update: 'Milestone Update',
};

function FollowupRow({ followup, onComplete }: { followup: FollowupItem; onComplete?: (id: string) => void }) {
  const [completing, setCompleting] = useState(false);

  const now = new Date();
  const dueDate = new Date(followup.due_at);
  const isOverdue = dueDate < now;
  const daysUntil = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const ActionIcon = followup.action_type === 'thank_you' ? Mail :
    followup.action_type === 'schedule_followup' ? Calendar :
    followup.action_type === 'data_share' ? FileText :
    MessageSquare;

  return (
    <div
      className="table-row flex items-center gap-3 py-2 px-3 rounded-lg transition-colors"
      style={{ opacity: completing ? 0.5 : 1 }}>
      {onComplete && (
        <button
          onClick={() => { setCompleting(true); onComplete(followup.id); }}
          className="w-5 h-5 rounded flex items-center justify-center shrink-0 check-complete"
          title="Mark done">
          {completing && <CheckCircle2 className="w-3 h-3" style={stAccent} />}</button>
      )}
      <span className="shrink-0" style={textTertiary}>
        <ActionIcon className="w-4 h-4" /></span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/investors/${followup.investor_id}`}
            className="truncate transition-colors investor-link"
            style={textSmLink}>
            {followup.investor_name || 'Unknown'}</Link>
          <span style={labelTertiary}>
            {ACTION_LABELS[followup.action_type] || followup.action_type.replace(/_/g, ' ')}</span></div>
        <p className="truncate mt-0.5" style={labelSecondary}>
          {followup.description}</p></div>
      <div className="shrink-0 flex items-center gap-2">
        <div className="text-right">
          <div className="tabular-nums" style={{ fontSize: 'var(--font-size-xs)', color: isOverdue ? 'var(--danger)' : daysUntil <= 1 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: isOverdue || daysUntil <= 1 ? 400 : 300 }}>
            {isOverdue
              ? `${Math.abs(daysUntil)}d overdue`
              : daysUntil === 0
              ? 'Today'
              : daysUntil === 1
              ? 'Tomorrow'
              : `${daysUntil}d`}</div></div>
        <Link
          href={`/followups?investor=${followup.investor_id}`}
          onClick={e => e.stopPropagation()}
          className="btn btn-secondary btn-sm"
          style={{ textDecoration: 'none', fontSize: 'var(--font-size-xs)' }}>
          Act</Link></div>
    </div>);
}


'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Investor, Meeting, InvestorPartner, InvestorPortfolioCo, IntelligenceBrief, InvestorStatus, Task, InvestorScoreData } from '@/lib/types';
import {
  ArrowLeft, Calendar, TrendingUp, AlertTriangle,
  Clock, Target, Users, Zap, Briefcase, UserCheck, BookOpen,
  RefreshCw, Loader2, Trash2, ClipboardList, Check, FileSearch,
  Gauge, ArrowUpRight, ArrowRight, ArrowDownRight, Minus, ShieldAlert, Lightbulb,
  Activity, AlertCircle, Database, ChevronDown, ChevronRight, ExternalLink,
  Flame, Phone, Mail, SendHorizonal, CheckCircle2, XCircle,
  Pencil, Save, X, Sparkles, Shield, ListChecks,
} from 'lucide-react';
import { useToast } from '@/components/toast';
import { fmtDateShort, fmtDate } from '@/lib/format';
import { STATUS_LABELS, OUTCOME_CONFIG } from '@/lib/constants';
import { labelMuted, labelSecondary, scoreBorderColor, scoreColor4 as scoreColor, skelCardLg, stAccent, stAccentBadge, stBorderTop, stSurface1, stSurface2, stTextMuted as textMuted, stTextPrimary as textPrimary, stTextSecondary as textSecondary, stTextTertiary as textTertiary } from '@/lib/styles';
import { cachedFetch, invalidateCache } from '@/lib/cache';
import { MS_PER_DAY } from '@/lib/time';

const selectCompact = { width: 'auto', padding: 'var(--space-0) var(--space-2)', fontSize: 'var(--font-size-xs)' } as const;
const pipeDivider = { color: 'var(--border-default)' } as const;
const vDivider = { background: 'var(--border-default)' } as const;
const PRIORITY_COLORS: Record<string, string> = { critical: 'var(--danger)', high: 'var(--warning)', medium: 'var(--warning)', low: 'var(--text-muted)' };
const EVENT_TYPE_COLORS: Record<string, string> = { meeting: 'var(--accent)', followup: 'var(--warning)', objection: 'var(--danger)', score: 'var(--success)' };
const ctaLinkBtnStyle: React.CSSProperties = { background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-25)', fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-2)', gap: 'var(--space-1)', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' };
const scoreDotSuccess: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 };
const scoreDotWarning: React.CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', flexShrink: 0 };

const STATUS_COLORS: Record<string, string> = {
  identified: 'var(--surface-3)',
  contacted: 'var(--surface-2)',
  nda_signed: 'var(--accent-muted)',
  meeting_scheduled: 'var(--accent-muted)',
  met: 'var(--accent)',
  engaged: 'var(--accent)',
  in_dd: 'var(--warning)',
  term_sheet: 'var(--success)',
  closed: 'var(--success)',
  passed: 'var(--danger)',
  dropped: 'var(--surface-3)',};

interface ConvictionTrajectoryData {
  dataPoints: { date: string; score: number; enthusiasm: number }[];
  trend: 'accelerating' | 'steady' | 'decelerating' | 'insufficient_data';
  velocityPerWeek: number;
  predictedScoreIn30Days: number;
  predictedTermSheetDate: string | null;
  confidenceLevel: 'high' | 'medium' | 'low';
}

interface EnrichmentRecord {
  id: string;
  investor_id: string;
  source_id: string;
  field_name: string;
  field_value: string;
  category: string;
  confidence: number;
  source_url: string;
  fetched_at: string;
  stale_after: string;
  created_at: string;
}

interface EnrichmentProviderStatus {
  id: string;
  name: string;
  type: 'free' | 'freemium' | 'paid';
  configured: boolean;
  has_data: boolean;
  field_count: number;
  last_fetched: string | null;
  last_error: string | null;
  status: 'success' | 'failed' | 'pending' | 'unconfigured';
}

interface EnrichmentStatus {
  investor_id: string;
  last_enriched: string | null;
  total_fields: number;
  field_coverage: number;
  categories_covered: number;
  categories_total: number;
  fields_by_category: Record<string, number>;
  avg_confidence: number;
  stale_count: number;
  providers: EnrichmentProviderStatus[];
  last_job: {
    id: string;
    status: string;
    results_count: number;
    started_at: string;
    completed_at: string | null;
  } | null;
}

function severityStyle(severity: string): { background: string; color: string } {
  if (severity === 'showstopper') return { background: 'var(--danger-muted)', color: 'var(--danger)' };
  if (severity === 'significant') return { background: 'var(--warning-muted)', color: 'var(--warning)' };
  return { background: 'var(--surface-2)', color: 'var(--text-muted)' };
}

type IntelTab = 'overview' | 'partners' | 'portfolio' | 'research' | 'tasks' | 'enrichment' | 'timeline';

export default function InvestorDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const id = params.id as string;
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [partners, setPartners] = useState<InvestorPartner[]>([]);
  const [portfolio, setPortfolio] = useState<InvestorPortfolioCo[]>([]);
  const [briefs, setBriefs] = useState<IntelligenceBrief[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [score, setScore] = useState<InvestorScoreData | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [trajectory, setTrajectory] = useState<ConvictionTrajectoryData | null>(null);
  const [enrichmentRecords, setEnrichmentRecords] = useState<EnrichmentRecord[]>([]);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [enrichmentStatus, setEnrichmentStatus] = useState<EnrichmentStatus | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);
  const [intelTab, setIntelTab] = useState<IntelTab>('overview');
  const [dealIntel, setDealIntel] = useState<{
    heat: number; heatLabel: string; trackingStatus: string; bottleneck: string; daysInProcess: number; velocityScore: number;
  } | null>(null);
  const [followups, setFollowups] = useState<{
    id: string; action_type: string; description: string; due_at: string; status: string; investor_name: string;
  }[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string; partner: string; tier: number; status: string;
    check_size_range: string; sector_thesis: string; notes: string;
  }>({ name: '', partner: '', tier: 1, status: 'identified', check_size_range: '', sector_thesis: '', notes: '' });
  const [composing, setComposing] = useState(false);
  const [aiBrief, setAiBrief] = useState<{
    firm_context: string;
    interaction_summary: string;
    open_objections: { objection: string; recommended_response: string; priority: string }[];
    talking_points: string[];
    risk_factors: string[];
    opportunities: string[];
    suggested_meeting_arc: string;
    generatedAt: string;
  } | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefExpanded, setBriefExpanded] = useState(true);
  const [composeType, setComposeType] = useState<string>('follow_up');
  const [composeDraft, setComposeDraft] = useState<{ subject: string; body: string; tone: string; callToAction: string } | null>(null);
  const [prediction, setPrediction] = useState<{
    prediction: { closeProbability: number; estimatedDaysToClose: number; estimatedCloseDate: string; confidence: string; scoreTrend: string };
    outcomes: { outcome: string; probability: number; label: string; timeframe: string }[];
    risks: { factor: string; severity: 'high' | 'medium' | 'low'; detail: string }[];
    nextSteps: { action: string; priority: 'critical' | 'high' | 'normal'; rationale: string }[];
    context: { daysInStage: number; expectedDaysInStage: number; stageOverdue: boolean; totalMeetings: number; recentMeetings: number; unresolvedObjections: number; peerComparison: { avgPeerEnthusiasm: number; relativePosition: string } | null };
  } | null>(null);
  const [calibration, setCalibration] = useState<{
    totalPredictions: number; resolvedPredictions: number; brierScore: number;
    biasDirection: 'over_confident' | 'under_confident' | 'calibrated' | 'insufficient_data';
    byStatus: { status: string; avgPredicted: number; actualRate: number; count: number }[];
  } | null>(null);

  const handleCompose = useCallback(async (type?: string) => {
    setComposing(true);
    setComposeDraft(null);
    const msgType = type || composeType;
    setComposeType(msgType);
    try {
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ investorId: id, messageType: msgType }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setComposeDraft(data.draft);
    } catch (e) {
      toast('Failed to generate draft — check AI configuration', 'error');
      console.warn('[COMPOSE]', e instanceof Error ? e.message : e);
    }
    setComposing(false);
  }, [id, composeType, toast]);

  const fetchScore = useCallback(async () => {
    setScoreLoading(true);
    const [scoreRes, trajRes, predRes, calRes] = await Promise.all([
      cachedFetch(`/api/investors/${id}/score`).catch(e => { console.warn('[INVESTOR_SCORE]', e instanceof Error ? e.message : e); return null; }),
      cachedFetch(`/api/investors/${id}/trajectory`).catch(e => { console.warn('[INVESTOR_TRAJECTORY]', e instanceof Error ? e.message : e); return null; }),
      cachedFetch(`/api/investors/${id}/predict`).catch(e => { console.warn('[INVESTOR_PREDICT]', e instanceof Error ? e.message : e); return null; }),
      cachedFetch('/api/calibration').catch(e => { console.warn('[CALIBRATION]', e instanceof Error ? e.message : e); return null; }),
    ]);
    if (scoreRes?.ok) { setScore(await scoreRes.json()); }
    if (trajRes?.ok) { setTrajectory(await trajRes.json()); }
    if (predRes?.ok) { setPrediction(await predRes.json()); }
    if (calRes?.ok) { setCalibration(await calRes.json()); }
    setScoreLoading(false);
  }, [id]);

  const fetchEnrichment = useCallback(async () => {
    setEnrichmentLoading(true);
    try {
      const res = await cachedFetch(`/api/enrichment?action=records&investor_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setEnrichmentRecords(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.warn('[INVESTOR_ENRICHMENT]', e instanceof Error ? e.message : e); }
    setEnrichmentLoading(false);
  }, [id]);

  const fetchEnrichmentStatus = useCallback(async () => {
    try {
      const res = await cachedFetch(`/api/enrichment?action=status&investor_id=${id}`);
      if (res.ok) {
        setEnrichmentStatus(await res.json());
      }
    } catch (e) { console.warn('[INVESTOR_ENRICH_STATUS]', e instanceof Error ? e.message : e); }
  }, [id]);

  const triggerEnrichment = useCallback(async () => {
    setEnriching(true);
    try {
      const res = await fetch('/api/enrichment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enrich', investor_id: id, auto_apply: true }),});
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast(`Enrichment complete: ${data.total_fields} fields from ${data.sources_succeeded} sources`, 'success');
      await Promise.all([fetchEnrichment(), fetchEnrichmentStatus()]);
    } catch (err) {
      toast(`Enrichment failed: ${err instanceof Error ? err.message : err}`, 'error');
    } finally {
      setEnriching(false);
    }
  }, [id, toast, fetchEnrichment, fetchEnrichmentStatus]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, mtgRes, partRes, portRes, briefRes, taskRes] = await Promise.all([
        cachedFetch(`/api/investors?id=${id}`).then(r => r.json()),
        cachedFetch(`/api/meetings?investor_id=${id}`).then(r => r.json()),
        cachedFetch(`/api/intelligence?type=partners&investor_id=${id}`).then(r => r.json()).catch(() => []),
        cachedFetch(`/api/intelligence?type=portfolio&investor_id=${id}`).then(r => r.json()).catch(() => []),
        cachedFetch(`/api/intelligence?type=briefs&investor_id=${id}`).then(r => r.json()).catch(() => []),
        cachedFetch(`/api/tasks?investor_id=${id}`).then(r => r.json()).catch(() => []),]);
      setInvestor(invRes);
      setMeetings(mtgRes);
      setPartners(Array.isArray(partRes) ? partRes : []);
      setPortfolio(Array.isArray(portRes) ? portRes : []);
      setBriefs(Array.isArray(briefRes) ? briefRes : []);
      setTasks(Array.isArray(taskRes) ? taskRes : []);
    } catch (e) { console.warn('[INVESTOR_DATA]', e instanceof Error ? e.message : e); }
    setLoading(false);
  }, [id]);

  useEffect(() => { document.title = 'Raise | Investor Detail'; }, []);
  useEffect(() => {
    fetchData(); fetchScore(); fetchEnrichment(); fetchEnrichmentStatus();
    // Non-blocking follow-ups fetch
    cachedFetch(`/api/followups?investor_id=${id}&status=pending`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setFollowups(Array.isArray(data) ? data : []))
      .catch(e => console.error('[INVESTOR_FOLLOWUPS]', e instanceof Error ? e.message : e));
    // Non-blocking deal intelligence fetch
    Promise.all([
      cachedFetch('/api/deal-heat').then(r => r.ok ? r.json() : null).catch(() => null),
      cachedFetch('/api/velocity').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([dhData, velData]) => {
      const dhInv = dhData?.investors?.find((i: { id: string }) => i.id === id);
      const velInv = velData?.investors?.find((i: { investor_id: string }) => i.investor_id === id);
      if (dhInv || velInv) {
        setDealIntel({
          heat: dhInv?.dealHeat?.heat ?? 0,
          heatLabel: dhInv?.dealHeat?.label ?? 'unknown',
          trackingStatus: velInv?.tracking_status ?? 'unknown',
          bottleneck: velInv?.bottleneck ?? '',
          daysInProcess: velInv?.days_in_process ?? 0,
          velocityScore: velInv?.velocity_score ?? 0,});
      }});
  }, [fetchData, fetchScore, fetchEnrichment, fetchEnrichmentStatus, id]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault(); fetchData(); fetchScore();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fetchData, fetchScore]);

  async function handleResearch() {
    if (!investor) return;
    setResearching(true);
    try {
      const res = await fetch('/api/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'research_investor',
          name: investor.name,
          investor_id: id,
          context: `Type: ${investor.type}, Fund size: ${investor.fund_size}, Key partner: ${investor.partner}, Thesis: ${investor.sector_thesis}`,
        }),});
      if (!res.ok) throw new Error(await res.text());
      toast('Research complete', 'success');
      fetchData();
      setIntelTab('research');
    } catch (err) {
      toast(`Research failed: ${err}`, 'error');
    }
    setResearching(false);
  }

  async function generateAiBrief() {
    if (briefLoading) return;
    setBriefLoading(true);
    try {
      const res = await fetch(`/api/investors/${id}/brief`);
      if (!res.ok) throw new Error('Failed to generate brief');
      const data = await res.json();
      setAiBrief(data);
      setBriefExpanded(true);
    } catch (err) {
      toast('Couldn\'t generate AI brief — try again', 'error');
    }
    setBriefLoading(false);
  }

  async function deleteIntelItem(type: string, itemId: string) {
    try {
      const res = await fetch(`/api/intelligence?type=${type}&id=${itemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      fetchData();
    } catch (e) {
      console.warn('[DETAIL_INTEL_DEL]', e instanceof Error ? e.message : e);
      toast('Couldn\'t delete intel item — try again', 'error');
    }}

  function startEdit() {
    if (!investor) return;
    setEditForm({
      name: investor.name || '',
      partner: investor.partner || '',
      tier: investor.tier || 1,
      status: investor.status || 'identified',
      check_size_range: investor.check_size_range || '',
      sector_thesis: investor.sector_thesis || '',
      notes: investor.notes || '',});
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function saveEdit() {
    if (!investor) return;
    setSaving(true);
    try {
      const res = await fetch('/api/investors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: investor.id,
          name: editForm.name,
          partner: editForm.partner,
          tier: editForm.tier,
          status: editForm.status,
          check_size_range: editForm.check_size_range,
          sector_thesis: editForm.sector_thesis,
          notes: editForm.notes,
        }),});
      if (!res.ok) throw new Error(await res.text());
      setInvestor(prev => prev ? {
        ...prev,
        name: editForm.name,
        partner: editForm.partner,
        tier: editForm.tier as 1 | 2 | 3 | 4,
        status: editForm.status as InvestorStatus,
        check_size_range: editForm.check_size_range,
        sector_thesis: editForm.sector_thesis,
        notes: editForm.notes,
      } : prev);
      setEditing(false);
      toast('Investor updated', 'success');
    } catch (err) {
      toast(`Save failed: ${err}`, 'error');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="space-y-6 page-content">
        <div className="skeleton" style={{ height: '28px', width: '200px' }} />
        <div className="skeleton" style={skelCardLg} />
        <div className="skeleton" style={{ height: '250px', borderRadius: 'var(--radius-xl)' }} />
      </div>);
  }

  if (!investor) {
    return (
      <div className="text-center py-12">
        <p style={textMuted}>Investor not found or has been removed.</p>
        <Link
          href="/investors"
          className="text-sm mt-2 block transition-colors btn-accent-hover"
          style={stAccent}>
          Back to Pipeline</Link>
      </div>);
  }

  const { allObjections, allQuestions, enthusiasmTrend, latestEnthusiasm } = useMemo(() => {
    const objs: { text: string; severity: string; topic: string; date: string }[] = [];
    const qs: { text: string; topic: string; date: string }[] = [];
    meetings.forEach(m => {
      try {
        const parsed = JSON.parse(m.objections || '[]');
        parsed.forEach((o: { text: string; severity: string; topic: string }) => { objs.push({ ...o, date: m.date }); });
      } catch (e) { console.warn('[INVESTOR_OBJECTIONS]', e instanceof Error ? e.message : e); }
      try {
        const parsed = JSON.parse(m.questions_asked || '[]');
        parsed.forEach((q: { text: string; topic: string }) => { qs.push({ ...q, date: m.date }); });
      } catch (e) { console.warn('[INVESTOR_QUESTIONS]', e instanceof Error ? e.message : e); }});
    const trend = [...meetings].sort((a, b) => a.date.localeCompare(b.date)).map(m => ({ date: m.date, score: m.enthusiasm_score }));
    const latest = trend.length > 0 ? trend[trend.length - 1].score : 0;
    return { allObjections: objs, allQuestions: qs, enthusiasmTrend: trend, latestEnthusiasm: latest };
  }, [meetings]);
  const overdueFollowups = useMemo(() => followups.filter(f => new Date(f.due_at) < new Date()).length, [followups]);
  const activeTasks = useMemo(() => tasks.filter(t => t.status !== 'done').length, [tasks]);
  const { pendingFollowupItems, overdueItems } = useMemo(() => {
    const overdue: typeof followups = [];
    const upcoming: typeof followups = [];
    for (const f of followups) {
      if (new Date(f.due_at) < new Date()) overdue.push(f);
      else upcoming.push(f);
    }
    return { pendingFollowupItems: [...overdue, ...upcoming].slice(0, 5), overdueItems: overdue };
  }, [followups]);
  const timelineEvents = useMemo(() => {
    const events: { date: string; type: string; icon: typeof Calendar; desc: string }[] = [];
    meetings.forEach(m => {
      events.push({ date: m.date, type: 'meeting', icon: Calendar, desc: `${m.type.replace(/_/g, ' ')} — ${m.duration_minutes}min${m.ai_analysis ? ': ' + m.ai_analysis.slice(0, 80) : ''}` });
    });
    followups.forEach(f => {
      events.push({ date: f.due_at.split('T')[0], type: 'followup', icon: Mail, desc: `${f.action_type.replace(/_/g, ' ')}: ${f.description.slice(0, 80)}${f.status === 'pending' ? ' (pending)' : ''}` });
    });
    allObjections.forEach(o => {
      events.push({ date: o.date, type: 'objection', icon: AlertTriangle, desc: `[${o.severity}] ${o.text.slice(0, 80)}` });
    });
    if (trajectory?.dataPoints) {
      trajectory.dataPoints.forEach((dp, i) => {
        if (i > 0) {
          const prev = trajectory.dataPoints[i - 1];
          const delta = dp.score - prev.score;
          if (Math.abs(delta) >= 0.5) events.push({ date: dp.date.split('T')[0], type: 'score', icon: TrendingUp, desc: `Score ${delta > 0 ? '+' : ''}${delta.toFixed(1)} (${prev.score.toFixed(1)} → ${dp.score.toFixed(1)})` });
        }});
    }
    events.sort((a, b) => b.date.localeCompare(a.date));
    return events;
  }, [meetings, followups, allObjections, trajectory]);

  return (
    <div className="page-content space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/investors"
            className="flex items-center gap-1 text-sm mb-3 sidebar-link"
            style={textMuted}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to CRM</Link>
          {editing ? (
            <input
              className="input"
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, maxWidth: '400px' }} />
          ) : (
            <h1 className="page-title">{investor.name}</h1>
          )}
          <div className="flex items-center gap-3 mt-2">
            {editing ? (
              <select
                value={editForm.tier}
                onChange={e => setEditForm(f => ({ ...f, tier: Number(e.target.value) }))}
                aria-label="Investor tier"
                className="input"
                style={selectCompact}>
                {[1, 2, 3, 4].map(t => (
                  <option key={t} value={t}>Tier {t}</option>
                ))}</select>
            ) : (
              <span
                className="px-2 py-0.5 rounded text-xs font-normal"
                style={{
                  background: investor.tier === 1 ? 'var(--accent-muted)' :
                    investor.tier === 2 ? 'var(--accent-muted)' :
                    'var(--surface-2)',
                  color: investor.tier === 1 ? 'var(--accent)' :
                    investor.tier === 2 ? 'var(--accent)' :
                    'var(--text-tertiary)', }}
>Tier {investor.tier}</span>
            )}
            {editing ? (
              <select
                value={editForm.status}
                onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                aria-label="Investor status"
                className="input"
                style={selectCompact}>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}</select>
            ) : (
              <select
                value={investor.status}
                aria-label="Quick update investor status"
                onChange={async (e) => {
                  const newStatus = e.target.value;
                  try {
                    const res = await fetch('/api/investors', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: newStatus }) });
                    if (!res.ok) throw new Error('Failed');
                    setInvestor(prev => prev ? { ...prev, status: newStatus as InvestorStatus } : prev);
                    invalidateCache('/api/');
                    toast(`Status updated to ${STATUS_LABELS[newStatus as InvestorStatus] || newStatus}`);
                  } catch (e) { console.warn('[DETAIL_STATUS]', e instanceof Error ? e.message : e); toast('Couldn\'t update investor status — refresh and try again', 'error'); }
                }}
                className="px-2 py-0.5 rounded text-xs font-normal border-none cursor-pointer focus:outline-none"
                style={{
                  backgroundColor: STATUS_COLORS[investor.status],
                  color: 'var(--text-primary)', }}>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val} style={{ background: 'var(--surface-0)', color: 'var(--text-secondary)' }}>{label}</option>
                ))}</select>
            )}
            <span className="text-xs capitalize" style={textMuted}>{investor.type.replace(/_/g, ' ')}</span></div></div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="btn btn-primary btn-md flex items-center gap-2">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? 'Saving...' : 'Save'}</button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="btn btn-ghost btn-md flex items-center gap-2">
                <X className="w-3.5 h-3.5" /> Cancel</button>
            </>
          ) : (
            <button
              onClick={startEdit}
              className="px-3 py-2 rounded-lg text-sm font-normal transition-colors flex items-center gap-2 btn-surface"
              style={{ ...stSurface2, ...textPrimary }}>
              <Pencil className="w-3.5 h-3.5" /> Edit</button>
          )}
          <Link
            href={`/meetings/prep?investor=${id}`}
            className="px-3 py-2 rounded-lg text-sm font-normal transition-colors flex items-center gap-2 btn-surface"
            style={{ ...stSurface2, ...textPrimary }}>
            <FileSearch className="w-3.5 h-3.5" /> Prep Meeting</Link>
          <button
            onClick={handleResearch}
            disabled={researching}
            className="px-3 py-2 rounded-lg text-sm font-normal transition-colors flex items-center gap-2 btn-surface"
            style={{
              background: 'var(--surface-2)',
              color: researching ? 'var(--text-muted)' : 'var(--text-primary)', }}>
            {researching ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Researching...</> : <><RefreshCw className="w-3.5 h-3.5" /> Research</>}
          </button>
          <button
            onClick={() => handleCompose('follow_up')}
            disabled={composing}
            className="px-3 py-2 rounded-lg text-sm font-normal transition-colors flex items-center gap-2 btn-surface"
            style={{ ...stSurface2, ...textPrimary }}>
            {composing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Composing...</> : <><SendHorizonal className="w-3.5 h-3.5" /> Compose</>}
          </button>
          <Link
            href="/pipeline"
            className="px-3 py-2 rounded-lg text-sm font-normal transition-colors flex items-center gap-2 btn-surface"
            style={{ ...stSurface2, ...textPrimary }}>
            <Target className="w-3.5 h-3.5" /> Pipeline</Link>
          <Link
            href={`/meetings/new?investor=${id}`}
            className="px-4 py-2 rounded-lg text-sm font-normal transition-colors btn-accent-hover"
            style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}>
            + Log Meeting</Link>
          <Link
            href={`/meetings/prep?investor=${id}`}
            className="px-4 py-2 rounded-lg text-sm font-normal transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            Prep Meeting</Link>
          <Link
            href={`/followups?investor=${id}`}
            className="px-3 py-2 rounded-lg text-sm font-normal transition-colors flex items-center gap-1.5"
            style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
            <SendHorizonal className="w-3.5 h-3.5" /> Follow-ups</Link></div></div>

      {/* Quick Context Strip */}
      {investor && (
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          {meetings.length > 0 ? (
            <span>Last meeting: {fmtDate(meetings[0].date)} ({meetings[0].type.replace(/_/g, ' ')})</span>
          ) : (
            <span>No meetings yet</span>
          )}
          {(() => { const pending = followups.filter(f => f.status === 'pending'); if (!pending.length) return null; const next = pending.sort((a, b) => a.due_at.localeCompare(b.due_at))[0]; const d = Math.ceil((new Date(next.due_at).getTime() - Date.now()) / 864e5); return <span style={{ color: d < 0 ? 'var(--danger)' : d <= 2 ? 'var(--warning)' : 'var(--text-muted)' }}>Next follow-up: {d < 0 ? `${-d}d overdue` : d === 0 ? 'today' : `in ${d}d`}</span>; })()}
          {meetings.length > 0 && (() => { const d = Math.floor((Date.now() - new Date(meetings[0].date).getTime()) / 864e5); return d >= 7 ? <span style={{ color: d >= 14 ? 'var(--danger)' : 'var(--warning)' }}>{d}d since last contact</span> : null; })()}
          {latestEnthusiasm > 0 && <span>Enthusiasm: {latestEnthusiasm}/10</span>}
        </div>
      )}

      {/* Suggested Actions */}
      {investor && (() => {
        const suggestions: string[] = [];
        const lastMeeting = meetings.length > 0 ? meetings.sort((a, b) => b.date.localeCompare(a.date))[0] : null;
        const daysSinceContact = lastMeeting ? Math.floor((Date.now() - new Date(lastMeeting.date).getTime()) / MS_PER_DAY) : null;
        if (daysSinceContact !== null && daysSinceContact >= 5) suggestions.push(`Schedule follow-up meeting (last contact ${daysSinceContact} days ago)`);
        else if (daysSinceContact === null && !['identified'].includes(investor.status)) suggestions.push('Log your first meeting to start tracking momentum');
        const unresolvedObjs = allObjections.filter(o => o.severity === 'showstopper' || o.severity === 'significant');
        if (unresolvedObjs.length > 0) suggestions.push(`Address ${unresolvedObjs.length} unresolved objection${unresolvedObjs.length > 1 ? 's' : ''} before next meeting`);
        if (overdueFollowups > 0) suggestions.push(`Complete ${overdueFollowups} overdue follow-up${overdueFollowups > 1 ? 's' : ''}`);
        if (['identified', 'contacted'].includes(investor.status) && meetings.length === 0) suggestions.push('Send intro materials and request first meeting');
        if (investor.status === 'met' && meetings.length >= 2) suggestions.push('Move to Engaged — multiple meetings completed');
        if (suggestions.length === 0) return null;
        return (
          <div style={{ background: 'var(--accent-muted)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-3) var(--space-4)' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-2)' }}>
              <span style={{ color: 'var(--accent)', display: 'flex' }}><Lightbulb className="w-3.5 h-3.5" /></span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--accent)' }}>Suggested Actions</span></div>
            <div className="space-y-1">
              {suggestions.slice(0, 3).map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--accent)' }} />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{s}</span></div>
              ))}</div></div>);
      })()}

      {/* Predictive Close Timeline */}
      {prediction && investor?.status !== 'passed' && investor?.status !== 'dropped' && investor?.status !== 'closed' && (
        <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2 mb-4">
            <span style={{ color: 'var(--accent)' }}><Target className="w-4 h-4" /></span>
            <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>
              Close Prediction</h3>
            <span style={{ fontSize: 'var(--font-size-xs)', padding: '1px 6px', borderRadius: 'var(--radius-sm)', background: prediction.prediction.confidence === 'high' ? 'var(--success-muted)' : prediction.prediction.confidence === 'medium' ? 'var(--warning-muted)' : 'var(--surface-3)', color: prediction.prediction.confidence === 'high' ? 'var(--success)' : prediction.prediction.confidence === 'medium' ? 'var(--warning)' : 'var(--text-muted)' }}>
              {prediction.prediction.confidence} confidence</span>
          </div>

          {/* Probability + timeline */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div style={{ padding: 'var(--space-3)', background: 'var(--surface-0)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: prediction.prediction.closeProbability >= 50 ? 'var(--success)' : prediction.prediction.closeProbability >= 25 ? 'var(--warning)' : 'var(--text-muted)' }}>
                {prediction.prediction.closeProbability}%</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>close probability</div>
            </div>
            <div style={{ padding: 'var(--space-3)', background: 'var(--surface-0)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: 'var(--text-primary)' }}>
                {prediction.prediction.estimatedDaysToClose}d</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>est. to close</div>
            </div>
            <div style={{ padding: 'var(--space-3)', background: 'var(--surface-0)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>
                {prediction.prediction.estimatedCloseDate}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>target date</div>
            </div>
          </div>

          {/* Outcome distribution bar */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>Outcome distribution</div>
            <div className="flex" style={{ height: '8px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', gap: '2px' }}>
              {prediction.outcomes.map(o => (
                <div key={o.outcome} style={{
                  flex: o.probability,
                  background: o.outcome === 'close' ? 'var(--success)' : o.outcome === 'stall' ? 'var(--warning)' : 'var(--danger)',
                  borderRadius: 'var(--radius-xs)',
                }} title={`${o.label}: ${o.probability}%`} />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {prediction.outcomes.map(o => (
                <span key={o.outcome} style={{ fontSize: '10px', color: o.outcome === 'close' ? 'var(--success)' : o.outcome === 'stall' ? 'var(--warning)' : 'var(--danger)' }}>
                  {o.label} {o.probability}%</span>
              ))}
            </div>
          </div>

          {/* Risks */}
          {prediction.risks.length > 0 && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Risk factors</div>
              <div className="space-y-1">
                {prediction.risks.slice(0, 4).map((r, i) => (
                  <div key={i} className="flex items-center gap-2" style={{ fontSize: 'var(--font-size-xs)' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: r.severity === 'high' ? 'var(--danger)' : r.severity === 'medium' ? 'var(--warning)' : 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{r.factor}</span>
                    <span style={{ color: 'var(--text-muted)' }}>— {r.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model accuracy */}
          {calibration && calibration.biasDirection !== 'insufficient_data' && (
            <div style={{ padding: 'var(--space-2) var(--space-3)', background: 'var(--surface-0)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Model accuracy: {Math.round((1 - calibration.brierScore) * 100)}% &middot; {calibration.resolvedPredictions} resolved prediction{calibration.resolvedPredictions !== 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: '10px', padding: '0 4px', borderRadius: 'var(--radius-sm)',
                background: calibration.biasDirection === 'calibrated' ? 'var(--success-muted)' : 'var(--warning-muted)',
                color: calibration.biasDirection === 'calibrated' ? 'var(--success)' : 'var(--warning)' }}>
                {calibration.biasDirection === 'calibrated' ? 'well-calibrated' : calibration.biasDirection === 'over_confident' ? 'tends optimistic' : 'tends conservative'}
              </span>
            </div>
          )}

          {/* Next steps */}
          {prediction.nextSteps.length > 0 && (
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Recommended actions</div>
              <div className="space-y-1">
                {prediction.nextSteps.slice(0, 3).map((s, i) => (
                  <div key={i} className="flex items-start gap-2" style={{ fontSize: 'var(--font-size-xs)' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', marginTop: '4px', background: s.priority === 'critical' ? 'var(--danger)' : s.priority === 'high' ? 'var(--warning)' : 'var(--accent)', flexShrink: 0 }} />
                    <div>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 400 }}>{s.action}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 'var(--space-1)' }}>— {s.rationale}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compose Panel */}
      {(composeDraft || composing) && (
        <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span style={{ color: 'var(--accent)' }}><SendHorizonal className="w-4 h-4" /></span>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>
                AI Draft</h3>
              <select
                value={composeType}
                onChange={e => handleCompose(e.target.value)}
                aria-label="Message type"
                className="input"
                style={{ ...selectCompact, background: 'var(--surface-2)' }}>
                <option value="follow_up">Follow-up</option>
                <option value="meeting_request">Meeting request</option>
                <option value="materials_share">Share materials</option>
                <option value="objection_response">Address objection</option>
                <option value="status_update">Status update</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCompose()}
                disabled={composing}
                className="btn btn-secondary btn-sm flex items-center gap-1">
                {composing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Regenerate</button>
              <button
                onClick={() => { setComposeDraft(null); }}
                className="btn btn-ghost btn-sm">
                <X className="w-3 h-3" /></button>
            </div>
          </div>

          {composing && !composeDraft && (
            <div className="flex items-center gap-3 py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                Generating context-aware draft...</span>
            </div>
          )}

          {composeDraft && (
            <div className="space-y-3">
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>Subject</div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)', background: 'var(--surface-0)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)' }}>
                  {composeDraft.subject}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-1)' }}>Body</div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', background: 'var(--surface-0)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                  {composeDraft.body}</div>
              </div>
              <div className="flex items-center gap-4 pt-1">
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Tone: <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>{composeDraft.tone}</span></span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  CTA: <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>{composeDraft.callToAction}</span></span>
                <button
                  onClick={() => { navigator.clipboard.writeText(`Subject: ${composeDraft.subject}\n\n${composeDraft.body}`); toast('Copied to clipboard'); }}
                  className="ml-auto btn btn-secondary btn-sm flex items-center gap-1">
                  <ClipboardList className="w-3 h-3" /> Copy</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data Quality Banner */}
      {investor && (() => {
        const checkFields = [
          { field: 'partner', label: 'partner' },
          { field: 'fund_size', label: 'fund size' },
          { field: 'check_size_range', label: 'check size' },
          { field: 'sector_thesis', label: 'sector thesis' },
          { field: 'warm_path', label: 'warm path' },
          { field: 'ic_process', label: 'IC process' },
          { field: 'portfolio_conflicts', label: 'portfolio conflicts' },];
        const missing = checkFields.filter(f => {
          const val = (investor as unknown as Record<string, unknown>)[f.field];
          return !val || (typeof val === 'string' && val.trim() === '');});
        const completeness = Math.round(((checkFields.length - missing.length) / checkFields.length) * 100);
        if (completeness >= 80) return null;
        return (
          <div
            className="flex items-start gap-3 rounded-xl px-4 py-3"
            style={{ background: 'var(--warning-muted)' }}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={textTertiary} />
            <div className="min-w-0">
              <div className="text-sm font-normal" style={textTertiary}>
                Profile {completeness}% complete — fill missing fields to improve scoring accuracy</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {missing.map(f => (
                  <button key={f.field} onClick={() => { setEditing(true); setTimeout(() => document.querySelector<HTMLInputElement>(`[data-field="${f.field}"]`)?.focus(), 100); }} className="text-xs px-1.5 py-0.5 rounded cursor-pointer border-none" style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}>Missing: {f.label}</button>
                ))}</div></div>
          </div>);
      })()}

      {/* Deal Intelligence Strip */}
      {dealIntel && (
        <div
          className="flex items-center gap-4 flex-wrap rounded-xl px-4 py-3"
          style={{
            border: `1px solid ${
              dealIntel.heatLabel === 'hot' ? 'var(--fg-6)' :
              dealIntel.heatLabel === 'warm' ? 'var(--fg-5)' :
              'var(--border-subtle)'
            }`,
            background: dealIntel.heatLabel === 'hot' ? 'var(--fg-6)' :
              dealIntel.heatLabel === 'warm' ? 'var(--fg-5)' :
              'var(--surface-1)', }}>
          {/* Heat */}
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5" style={{
              color: dealIntel.heatLabel === 'hot' ? 'var(--text-primary)' :
                dealIntel.heatLabel === 'warm' ? 'var(--text-secondary)' :
                'var(--text-muted)'
            }} />
            <span style={{
              fontSize: 'var(--font-size-sm)', fontWeight: 300, fontVariantNumeric: 'tabular-nums',
              color: dealIntel.heatLabel === 'hot' ? 'var(--text-primary)' :
                dealIntel.heatLabel === 'warm' ? 'var(--text-secondary)' :
                'var(--text-secondary)'}}>
              {dealIntel.heat}</span>
            <span style={{
              fontSize: 'var(--font-size-xs)', fontWeight: 400,
              color: dealIntel.heatLabel === 'hot' ? 'var(--text-primary)' :
                dealIntel.heatLabel === 'warm' ? 'var(--text-secondary)' :
                'var(--text-muted)'}}>
              {dealIntel.heatLabel}</span></div>

          <span style={pipeDivider}>|</span>

          {/* Tracking */}
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: dealIntel.trackingStatus === 'on_track' ? 'var(--success)' :
                  dealIntel.trackingStatus === 'behind' ? 'var(--warning)' : 'var(--danger)'
              }} />
            <span style={labelSecondary}>
              {dealIntel.trackingStatus === 'on_track' ? 'On Track' :
                dealIntel.trackingStatus === 'behind' ? 'Behind' : 'At Risk'}</span></div>

          <span style={pipeDivider}>|</span>

          {/* Days + Velocity */}
          <span style={labelMuted}>
            {dealIntel.daysInProcess > 0 ? `${dealIntel.daysInProcess}d in process` : 'New'} · Velocity {dealIntel.velocityScore}
          </span>

          {/* Bottleneck */}
          {dealIntel.bottleneck && (
            <>
              <span style={pipeDivider}>|</span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                {dealIntel.bottleneck}</span>
            </>
          )}

          {/* Quick action */}
          <div className="ml-auto">
            {dealIntel.trackingStatus === 'at_risk' ? (
              <Link
                href={`/meetings/new?investor=${id}`}
                className="flex items-center gap-1"
                style={{
                  fontSize: 'var(--font-size-xs)', fontWeight: 400, padding: 'var(--space-1) var(--space-2)',
                  borderRadius: 'var(--radius-sm)', textDecoration: 'none',
                  background: 'var(--danger-muted)', color: 'var(--text-primary)',
                  border: '1px solid var(--fg-6)', }}>
                <Phone className="w-3 h-3" /> Rescue</Link>
            ) : dealIntel.trackingStatus === 'behind' ? (
              <Link
                href={`/followups?investor=${id}`}
                className="flex items-center gap-1"
                style={{
                  fontSize: 'var(--font-size-xs)', fontWeight: 400, padding: 'var(--space-1) var(--space-2)',
                  borderRadius: 'var(--radius-sm)', textDecoration: 'none',
                  background: 'var(--warning-muted)', color: 'var(--text-tertiary)',
                  border: '1px solid var(--fg-5)', }}>
                <Mail className="w-3 h-3" /> Nudge</Link>
            ) : null}</div></div>
      )}

      {/* AI Tactical Brief */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => aiBrief ? setBriefExpanded(!briefExpanded) : generateAiBrief()}
          disabled={briefLoading}
          className="w-full px-5 py-3 flex items-center justify-between"
          style={{ background: aiBrief ? 'var(--accent-muted)' : 'var(--surface-1)' }}>
          <span className="text-sm font-normal flex items-center gap-2" style={{ color: aiBrief ? 'var(--accent)' : 'var(--text-secondary)' }}>
            {briefLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {briefLoading ? 'Generating tactical brief...' : aiBrief ? 'AI Tactical Brief' : 'Generate AI Tactical Brief'}
          </span>
          {aiBrief && <ChevronRight className={`w-4 h-4 transition-transform ${briefExpanded ? 'rotate-90' : ''}`} style={{ color: 'var(--accent)' }} />}
        </button>
        {aiBrief && briefExpanded && (
          <div className="px-5 pb-5 space-y-4" style={{ background: 'var(--surface-0)' }}>
            {/* Firm Context */}
            <div className="pt-3">
              <h3 className="text-xs font-normal tracking-wider mb-1.5" style={{ color: 'var(--accent)' }}>Context</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{aiBrief.firm_context}</p>
            </div>
            {/* Interaction Summary */}
            {aiBrief.interaction_summary && (
              <div>
                <h3 className="text-xs font-normal tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Interaction History</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{aiBrief.interaction_summary}</p>
              </div>
            )}
            {/* Talking Points */}
            {aiBrief.talking_points.length > 0 && (
              <div>
                <h3 className="text-xs font-normal tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
                  <ListChecks className="w-3.5 h-3.5" /> Talking Points</h3>
                <div className="space-y-1.5">
                  {aiBrief.talking_points.map((tp, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{tp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Open Objections */}
            {aiBrief.open_objections.length > 0 && (
              <div>
                <h3 className="text-xs font-normal tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <AlertTriangle className="w-3.5 h-3.5" /> Open Objections</h3>
                <div className="space-y-2">
                  {aiBrief.open_objections.map((obj, i) => (
                    <div key={i} className="rounded-lg p-2.5" style={{ background: 'var(--surface-1)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>{obj.objection}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{
                          background: obj.priority === 'must_address' ? 'var(--danger-muted)' : 'var(--warning-muted)',
                          color: 'var(--text-secondary)',
                        }}>{obj.priority.replace('_', ' ')}</span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{obj.recommended_response}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Risk & Opportunities grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiBrief.risk_factors.length > 0 && (
                <div>
                  <h3 className="text-xs font-normal tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                    <Shield className="w-3.5 h-3.5" /> Risks</h3>
                  <div className="space-y-1">
                    {aiBrief.risk_factors.map((r, i) => (
                      <p key={i} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{r}</p>
                    ))}
                  </div>
                </div>
              )}
              {aiBrief.opportunities.length > 0 && (
                <div>
                  <h3 className="text-xs font-normal tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
                    <Zap className="w-3.5 h-3.5" /> Opportunities</h3>
                  <div className="space-y-1">
                    {aiBrief.opportunities.map((o, i) => (
                      <p key={i} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{o}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Meeting Arc */}
            {aiBrief.suggested_meeting_arc && (
              <div className="pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <h3 className="text-xs font-normal tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>Suggested Meeting Arc</h3>
                <p className="text-xs italic leading-relaxed" style={{ color: 'var(--text-muted)' }}>{aiBrief.suggested_meeting_arc}</p>
              </div>
            )}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Generated {new Date(aiBrief.generatedAt).toLocaleString()}</span>
              <button onClick={generateAiBrief} disabled={briefLoading} className="btn btn-ghost btn-sm flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Regenerate
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pending Actions — inline follow-ups */}
      {pendingFollowupItems.length > 0 && (() => {
        const now = new Date();
        async function quickComplete(fId: string) {
          try {
            const res = await fetch('/api/followups', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: fId, status: 'completed' }),});
            if (!res.ok) throw new Error('Failed');
            setFollowups(prev => prev.filter(f => f.id !== fId));
          } catch (e) { console.warn('[DETAIL_FU_DONE]', e instanceof Error ? e.message : e); toast('Couldn\'t complete follow-up — try again', 'error'); }
        }

        async function quickSkip(fId: string) {
          try {
            const res = await fetch('/api/followups', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: fId, status: 'skipped' }),});
            if (!res.ok) throw new Error('Failed');
            setFollowups(prev => prev.filter(f => f.id !== fId));
          } catch (e) { console.warn('[DETAIL_FU_SKIP]', e instanceof Error ? e.message : e); toast('Couldn\'t skip follow-up — try again', 'error'); }
        }

        return (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: overdueItems.length > 0 ? 'var(--fg-6)' : undefined }}>
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-1)' }}>
              <div className="flex items-center gap-2">
                <SendHorizonal className="w-3.5 h-3.5" style={{ color: overdueItems.length > 0 ? 'var(--danger)' : 'var(--accent)' }}
                  />
                <span className="text-xs font-normal tracking-wider" style={textTertiary}>
                  Pending Actions</span>
                {overdueItems.length > 0 && (
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)', fontWeight: 400,
                      padding: 'var(--space-0) var(--space-1)', borderRadius: 'var(--radius-full)',
                      background: 'var(--danger)', color: 'var(--text-primary)', }}>
                    {overdueItems.length} overdue</span>
                )}</div>
              {followups.length > 5 && (
                <Link
                  href={`/followups?investor=${id}`}
                  className="investor-link"
                  style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)', textDecoration: 'none' }}>
                  View all {followups.length}</Link>
              )}</div>
            <div style={{ padding: 'var(--space-2) var(--space-4)' }}>
              {pendingFollowupItems.map(f => {
                const isOverdue = new Date(f.due_at) < now;
                const diffMs = new Date(f.due_at).getTime() - now.getTime();
                const diffDays = Math.round(diffMs / MS_PER_DAY);
                const timeLabel = isOverdue
                  ? `${Math.abs(diffDays)}d overdue`
                  : diffDays === 0 ? 'Due today'
                  : diffDays === 1 ? 'Tomorrow'
                  : `In ${diffDays}d`;

                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 py-2"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        background: isOverdue ? 'var(--danger-muted)' : 'var(--surface-2)',
                        color: isOverdue ? 'var(--danger)' : 'var(--text-muted)',
                        fontWeight: 400,
                        fontSize: 'var(--font-size-xs)', }}>
                      {timeLabel}</span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded shrink-0 capitalize"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                      {f.action_type.replace(/_/g, ' ')}</span>
                    <span
                      className="flex-1 text-sm truncate"
                      style={textSecondary}
                      title={f.description}>
                      {f.description.split('\n')[0]}</span>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => quickComplete(f.id)}
                        className="p-1 rounded icon-complete"
                        title="Mark done">
                        <CheckCircle2 className="w-3.5 h-3.5" /></button>
                      <button
                        onClick={() => quickSkip(f.id)}
                        className="p-1 rounded icon-skip"
                        title="Skip">
                        <XCircle className="w-3.5 h-3.5" /></button></div>
                  </div>);
              })}</div>
          </div>);
      })()}

      {/* Profile + Process Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-normal flex items-center gap-2" style={textTertiary}>
            <Users className="w-3.5 h-3.5" /> Profile</h2>
          <div className="space-y-2 text-sm">
            {editing ? (
              <EditRow label="Partner" value={editForm.partner} onChange={v => setEditForm(f => ({ ...f, partner: v }))} />
            ) : (
              <div className="flex justify-between">
                <span style={textMuted}>Partner</span>
                <span className="text-right max-w-[60%] flex items-center gap-1" style={textSecondary}>{investor.partner || '—'}{investor.partner && <button onClick={() => { navigator.clipboard.writeText(investor.partner); toast('Copied'); }} title="Copy partner name" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}><ClipboardList className="w-3 h-3" /></button>}</span>
              </div>
            )}
            <Row label="Fund Size" value={investor.fund_size} />
            {editing ? (
              <EditRow label="Check Size" value={editForm.check_size_range} onChange={v => setEditForm(f => ({ ...f, check_size_range: v }))}
                />
            ) : (
              <Row label="Check Size" value={investor.check_size_range} />
            )}
            <Row label="Committed" value={investor.committed_amount ? `€${investor.committed_amount}M` : '—'} />
            {editing ? (
              <EditRow label="Thesis" value={editForm.sector_thesis} onChange={v => setEditForm(f => ({ ...f, sector_thesis: v }))}
                />
            ) : (
              <Row label="Thesis" value={investor.sector_thesis} />
            )}</div></div>
        <div className="rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-normal flex items-center gap-2" style={textTertiary}>
            <Target className="w-3.5 h-3.5" /> Process</h2>
          <div className="space-y-2 text-sm">
            <Row label="Warm Path" value={investor.warm_path} />
            <Row label="IC Process" value={investor.ic_process} />
            <Row label="Speed" value={investor.speed} />
            <Row label="Conflicts" value={investor.portfolio_conflicts} /></div></div></div>

      {/* Enrichment Status */}
      <EnrichmentStatusCard
        status={enrichmentStatus}
        enriching={enriching}
        onEnrich={triggerEnrichment}
        onRefreshStale={async () => {
          setEnriching(true);
          try {
            const res = await fetch('/api/enrichment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'refresh_stale', investor_id: id, auto_apply: true }),
            });
            if (res.ok) {
              const data = await res.json();
              toast(`Refreshed ${data.stale_sources_refreshed?.length || 0} source(s), ${data.new_fields || 0} fields updated`);
              invalidateCache(`/api/enrichment?action=status&investor_id=${id}`);
              invalidateCache(`/api/enrichment?action=records&investor_id=${id}`);
              const statusRes = await cachedFetch(`/api/enrichment?action=status&investor_id=${id}`, { skipCache: true });
              if (statusRes.ok) setEnrichmentStatus(await statusRes.json());
              const recRes = await cachedFetch(`/api/enrichment?action=records&investor_id=${id}`, { skipCache: true });
              if (recRes.ok) setEnrichmentRecords(await recRes.json());
            } else { toast('Failed to refresh stale data', 'error'); }
          } catch { toast('Failed to refresh stale data', 'error'); }
          setEnriching(false);
        }} />

      {/* Intelligence Score */}
      {score && <InvestorScorePanel score={score} loading={scoreLoading} onRefresh={fetchScore} investorId={id} />}
      {scoreLoading && !score && (
        <div className="rounded-xl p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin" style={textMuted} />
            <span className="text-sm" style={textMuted}>Scoring investor across 11 dimensions...</span></div></div>
      )}

      {/* Conviction Trajectory */}
      {trajectory && trajectory.dataPoints.length > 0 && (
        <ConvictionTrajectoryPanel trajectory={trajectory} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <StatCard icon={TrendingUp} label="Enthusiasm" value={`${latestEnthusiasm}/5`} sub="latest reading" />
        <StatCard icon={Calendar} label="Meetings" value={meetings.length} sub="logged" />
        <StatCard icon={SendHorizonal} label="Follow-ups" value={followups.length} sub={overdueFollowups > 0 ? `${overdueFollowups} overdue` : 'pending'} highlight={overdueFollowups > 0}
          />
        <StatCard icon={AlertTriangle} label="Objections" value={allObjections.length} sub="unresolved" />
        <StatCard icon={UserCheck} label="Partners" value={partners.length} sub="profiled" />
        <StatCard icon={Briefcase} label="Portfolio" value={portfolio.length} sub="tracked" /></div>

      {/* Intelligence Tabs */}
      <div className="rounded-xl overflow-hidden">
        <div className="flex" style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--surface-1)' }}>
          {([
            { key: 'overview' as IntelTab, label: 'Meetings', icon: Clock },
            { key: 'partners' as IntelTab, label: `Partners (${partners.length})`, icon: UserCheck },
            { key: 'portfolio' as IntelTab, label: `Portfolio (${portfolio.length})`, icon: Briefcase },
            { key: 'tasks' as IntelTab, label: `Tasks (${activeTasks})`, icon: ClipboardList },
            { key: 'enrichment' as IntelTab, label: `Enriched (${enrichmentRecords.length})`, icon: Database },
            { key: 'research' as IntelTab, label: `Research (${briefs.length})`, icon: BookOpen },
            { key: 'timeline' as IntelTab, label: 'Timeline', icon: Activity },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setIntelTab(t.key)}
              className={`px-4 py-2.5 text-sm font-normal transition-colors flex items-center gap-2 ${intelTab !== t.key ? 'sidebar-link' : ''}`}
              style={{
                borderBottom: intelTab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                color: intelTab === t.key ? 'var(--text-primary)' : 'var(--text-muted)', }}>
              <t.icon className="w-3.5 h-3.5" />
              {t.label}</button>
          ))}</div>

        <div className="p-5">
          {/* Meetings Tab */}
          {intelTab === 'overview' && (
            <div>
              {/* Enthusiasm Trend */}
              {enthusiasmTrend.length > 1 && (
                <div className="mb-6">
                  <h3 className="text-xs font-normal mb-3 flex items-center gap-2" style={textTertiary}>
                    <Zap className="w-3.5 h-3.5" /> Enthusiasm trend</h3>
                  <div className="flex items-end gap-2 h-20">
                    {enthusiasmTrend.map((point, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t"
                          style={{
                            height: `${(point.score / 5) * 100}%`,
                            background: point.score >= 4 ? 'var(--success)' : point.score >= 3 ? 'var(--accent)' : point.score >= 2 ? 'var(--warning)' : 'var(--danger)',
                          }} />
                        <span className="text-xs" style={textMuted}>{point.date.slice(5)}</span></div>
                    ))}</div></div>
              )}

              {/* Meeting History */}
              <h3 className="text-xs font-normal mb-3 flex items-center gap-2" style={textTertiary}>
                <Clock className="w-3.5 h-3.5" /> Meeting history</h3>
              {meetings.length === 0 ? (
                <p className="text-sm" style={textMuted}>No meetings logged yet.{' '}<Link href={`/meetings/new?investor=${investor.id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>Log a meeting</Link>{' '}to start tracking engagement and generate AI-powered follow-ups.</p>
              ) : (
                <div className="space-y-4">
                  {meetings.map(m => {
                    const objs = (() => { try { return JSON.parse(m.objections || '[]'); } catch { return []; } })();
                    return (
                      <div key={m.id} className="pb-2">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-normal" style={textPrimary}>{m.date}</span>
                          <span className="text-xs" style={textMuted}>{m.type.replace(/_/g, ' ')}</span>
                          <span className="text-xs" style={textMuted}>{m.duration_minutes}min</span>
                          <div className="flex gap-0.5 ml-auto">
                            {[1,2,3,4,5].map(n => (
                              <div
                                key={n}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: n <= m.enthusiasm_score ? 'var(--accent)' : 'var(--surface-2)' }} />
                            ))}</div></div>
                        {m.ai_analysis && <p className="text-sm mb-2" style={textTertiary}>{m.ai_analysis}</p>}
                        {m.next_steps && <p className="text-xs" style={{ color: 'var(--accent)', opacity: 0.7 }}>Next: {m.next_steps}</p>}
                        {objs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {objs.map((o: { text: string; severity: string }, i: number) => (
                              <span
                                key={i}
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={severityStyle(o.severity)}
                              >{o.text.length > 40 ? o.text.slice(0, 40) + '...' : o.text}</span>
                            ))}</div>
                        )}
                      </div>);
                  })}</div>
              )}

              {/* Objection Summary */}
              {allObjections.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-normal mb-3 flex items-center gap-2" style={textTertiary}>
                    <AlertTriangle className="w-3.5 h-3.5" /> All objections</h3>
                  <div className="space-y-2">
                    {allObjections.map((o, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded shrink-0"
                          style={severityStyle(o.severity)}
                        >{o.severity}</span>
                        <span className="flex-1" style={textSecondary}>{o.text}</span>
                        <span className="text-xs shrink-0" style={textMuted}>{o.date}</span></div>
                    ))}</div></div>
              )}</div>
          )}

          {/* Partners Tab */}
          {intelTab === 'partners' && (
            <div>
              {partners.length === 0 ? (
                <EmptyTabState icon={UserCheck} message="No partner profiles yet. Run research to pull key decision-makers." actionLabel={`Research ${investor.name}`} onAction={handleResearch} loading={researching}
                  />
              ) : (
                <div className="space-y-4">
                  {partners.map(p => (
                    <div key={p.id} className="rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div>
                            <h4 className="font-normal" style={textPrimary}>{p.name}</h4>
                            <p className="text-xs" style={textMuted}>{p.title}</p></div>
                          {p.source && <span className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--accent-muted)', color: 'var(--accent)', fontWeight: 300 }}>{p.source.replace(/_/g, ' ')}</span>}
                        </div>
                        <DeleteBtn onClick={() => deleteIntelItem('partner', p.id)} /></div>
                      <div className="mt-2 space-y-1 text-xs" style={textTertiary}>
                        {([['Focus', p.focus_areas], ['Deals', p.notable_deals], ['Boards', p.board_seats], ['Background', p.background]] as const).map(([label, val]) =>
                          val ? <p key={label}><span style={textMuted}>{label}:</span> {val}</p> : null
                        )}
                        {p.relevance_to_us && <p style={stAccent}><span style={textMuted}>Relevance:</span> {p.relevance_to_us}</p>}
                      </div></div>
                  ))}</div>
              )}</div>
          )}

          {/* Portfolio Tab */}
          {intelTab === 'portfolio' && (
            <div>
              {portfolio.length === 0 ? (
                <EmptyTabState icon={Briefcase} message="No portfolio companies tracked. Run research to identify conflicts and overlap." actionLabel={`Research ${investor.name}`} onAction={handleResearch} loading={researching}
                  />
              ) : (
                <div className="rounded-lg overflow-hidden">
                  <table className="w-full text-sm" aria-label="Portfolio companies">
                    <thead style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-default)' }}>
                      <tr>
                        {['Company', 'Sector', 'Stage', 'Amount', 'Date', 'Status', 'Source'].map(h => (
                          <th scope="col" key={h} className="text-left px-4 py-2 text-xs font-normal" style={textMuted}>{h}</th>
                        ))}
                        <th scope="col" className="w-8"></th></tr></thead>
                    <tbody>
                      {portfolio.map(co => (
                        <tr
                          key={co.id}
                          className="hover-row"
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td className="px-4 py-2 font-normal" style={textPrimary}>{co.company}</td>
                          <td className="px-4 py-2 text-xs" style={textTertiary}>{co.sector}</td>
                          <td className="px-4 py-2 text-xs" style={textTertiary}>{co.stage_invested}</td>
                          <td className="px-4 py-2 text-xs" style={textSecondary}>{co.amount}</td>
                          <td className="px-4 py-2 text-xs" style={textMuted}>{co.date}</td>
                          <td className="px-4 py-2">
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{
                                background: co.status === 'active' ? 'var(--success-muted)' :
                                  co.status === 'exited' ? 'var(--accent-muted)' :
                                  'var(--danger-muted)',
                                color: co.status === 'active' ? 'var(--success)' :
                                  co.status === 'exited' ? 'var(--accent)' :
                                  'var(--danger)', }}
>{co.status}</span></td>
                          <td className="px-4 py-2 text-xs" style={textMuted}>{co.source ? co.source.replace(/_/g, ' ') : <span style={{ opacity: 0.4 }}>manual</span>}</td>
                          <td className="px-4 py-2">
                            <DeleteBtn onClick={() => deleteIntelItem('portfolio', co.id)} small /></td></tr>
                      ))}</tbody></table></div>
              )}</div>
          )}

          {/* Tasks Tab */}
          {intelTab === 'tasks' && (
            <div>
              {tasks.length === 0 ? (
                <p className="text-sm text-center py-6" style={textMuted}>No tasks yet. Tasks are auto-generated when you{' '}<Link href={`/meetings/new?investor=${investor.id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>log a meeting debrief</Link>.</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map(t => {
                    const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';
                    const prioColor = PRIORITY_COLORS[t.priority] || 'var(--text-muted)';
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg"
                        style={{ opacity: t.status === 'done' ? 0.5 : 1 }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            disabled={togglingTaskId === t.id}
                            onClick={async () => {
                              if (togglingTaskId) return;
                              setTogglingTaskId(t.id);
                              const newStatus = t.status === 'done' ? 'pending' : 'done';
                              try {
                                const res = await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, status: newStatus, title: t.title, investor_id: id, investor_name: investor?.name }) });
                                if (!res.ok) throw new Error('Failed');
                                fetchData();
                              } catch (e) { console.warn('[DETAIL_TASK]', e instanceof Error ? e.message : e); toast('Couldn\'t toggle task — refresh and try again', 'error'); } finally { setTogglingTaskId(null); } }}
                            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors ${t.status !== 'done' ? 'hover-border' : ''}`}
                            style={{
                              background: t.status === 'done' ? 'var(--success)' : 'transparent',
                              border: t.status === 'done' ? '2px solid var(--success)' : '2px solid var(--border-default)',
                              color: 'var(--text-primary)', }}>
                            {t.status === 'done' && <Check className="w-3 h-3" />}</button>
                          <div className="min-w-0">
                            <div className={`text-sm truncate ${t.status === 'done' ? 'line-through' : ''}`} style={textPrimary}>{t.title}</div>
                            {t.description && <div className="text-xs truncate" style={textMuted}>{t.description}</div>}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs" style={{ color: prioColor }}>{t.priority}</span>
                          <span className="text-xs" style={textMuted}>{t.phase}</span>
                          {t.due_date && <span className="text-xs" style={{ color: overdue ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 400 }}>{t.due_date}</span>}
                        </div>
                      </div>);
                  })}</div>
              )}</div>
          )}

          {/* Enriched Intelligence Tab */}
          {intelTab === 'enrichment' && (
            <EnrichmentPanel
              records={enrichmentRecords}
              loading={enrichmentLoading}
              expandedCategories={expandedCategories}
              onToggleCategory={(cat: string) => {
                setExpandedCategories(prev => {
                  const next = new Set(prev);
                  if (next.has(cat)) next.delete(cat); else next.add(cat);
                  return next;
                }); }}
              onRefresh={fetchEnrichment} />
          )}

          {/* Research Tab */}
          {intelTab === 'research' && (
            <div>
              {briefs.length === 0 ? (
                <EmptyTabState icon={BookOpen} message="No research briefs yet. Run AI research to pull fund strategy, recent deals, and thesis alignment." actionLabel={`Research ${investor.name}`} onAction={handleResearch} loading={researching}
                  />
              ) : (
                <div className="space-y-4">
                  {briefs.map(b => (
                    <div key={b.id} className="rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded font-normal" style={stAccentBadge}>{b.brief_type}</span>
                          <span className="text-xs" style={textMuted}>{b.updated_at?.split('T')[0]}</span></div>
                        <DeleteBtn onClick={() => deleteIntelItem('brief', b.id)} /></div>
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed" style={textSecondary}>
                        {b.content}</div></div>
                  ))}</div>
              )}</div>
          )}

          {intelTab === 'timeline' && (() => {
            const iconColor = EVENT_TYPE_COLORS;
            return (
              <div>
                {timelineEvents.length === 0 ? (
                  <p className="text-sm py-6 text-center" style={textMuted}>No interactions recorded yet. Meetings, follow-ups, and score changes will appear here.</p>
                ) : (
                  <div className="space-y-0">
                    {timelineEvents.map((ev, i) => (
                      <div key={i} className="flex gap-4 py-2.5" style={{ borderBottom: i < timelineEvents.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                        <span className="text-xs shrink-0 w-20 pt-0.5 tabular-nums" style={textMuted}>{ev.date}</span>
                        <span className="shrink-0 pt-0.5" style={{ color: iconColor[ev.type] || 'var(--text-muted)' }}><ev.icon className="w-3.5 h-3.5" /></span>
                        <span className="text-sm" style={textSecondary}>{ev.desc}</span></div>
                    ))}</div>
                )}
              </div>);
          })()}</div></div>

      {/* Notes */}
      {(investor.notes || editing) && (
        <div className="rounded-xl p-5">
          <h2 className="text-xs font-normal mb-2" style={textTertiary}>Notes</h2>
          {editing ? (
            <textarea
              className="input"
              value={editForm.notes}
              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              rows={5}
              style={{ resize: 'vertical', lineHeight: 1.6 }} />
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{investor.notes}</p>
          )}</div>
      )}
    </div>);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span style={textMuted}>{label}</span>
      <span className="text-right max-w-[60%]" style={textSecondary}>{value || '—'}</span>
    </div>);
}

function EditRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0" style={textMuted}>{label}</span>
      <input
        className="input"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ maxWidth: '60%', textAlign: 'right' }} />
    </div>);
}

function EmptyTabState({ icon: Icon, message, actionLabel, onAction, loading }: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
  actionLabel: string;
  onAction: () => void;
  loading?: boolean;
}) {
  return (
    <div className="text-center py-6">
      <span className="block mx-auto mb-2 w-8" style={textMuted}><Icon className="w-8 h-8" /></span>
      <p className="text-sm mb-3" style={textMuted}>{message}</p>
      <button
        onClick={onAction}
        disabled={loading}
        className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 mx-auto transition-colors btn-accent-hover"
        style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}>
        {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Researching...</> : <><RefreshCw className="w-3.5 h-3.5" /> {actionLabel}</>}
      </button>
    </div>);
}

function DeleteBtn({ onClick, small }: { onClick: () => void; small?: boolean }) {
  return (
    <button
      aria-label="Delete item"
      onClick={onClick}
      className="icon-delete">
      <Trash2 className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
    </button>);
}

function StatCard({ icon: Icon, label, value, sub, highlight }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; sub: string; highlight?: boolean }) {
  const mutedOrDanger = highlight ? 'var(--danger)' : 'var(--text-muted)';
  return (
    <div className="rounded-xl p-4" style={{ background: highlight ? 'var(--fg-6)' : undefined }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: mutedOrDanger }}><Icon className="w-3.5 h-3.5" /></span>
        <span className="text-xs truncate" style={{ color: mutedOrDanger }}>{label}</span>
      </div>
      <div className="text-2xl font-normal" style={{ color: highlight ? 'var(--danger)' : 'var(--text-primary)' }}>{value}</div>
      <div className="text-xs" style={{ color: mutedOrDanger }}>{sub}</div>
    </div>);
}

// ---------------------------------------------------------------------------
// Intelligence Score Panel
// ---------------------------------------------------------------------------

const MOMENTUM_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  accelerating: { label: 'Accelerating', icon: ArrowUpRight, color: 'var(--text-secondary)' },
  steady: { label: 'Steady', icon: ArrowRight, color: 'var(--accent)' },
  decelerating: { label: 'Decelerating', icon: ArrowDownRight, color: 'var(--text-tertiary)' },
  stalled: { label: 'Stalled', icon: Minus, color: 'var(--text-primary)' },};

function signalBadge(sig: 'strong' | 'moderate' | 'weak' | 'unknown'): { bg: string; color: string } {
  const config = {
    strong: { bg: 'var(--success-muted)', color: 'var(--text-secondary)' },
    moderate: { bg: 'var(--accent-muted)', color: 'var(--accent)' },
    weak: { bg: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
    unknown: { bg: 'var(--surface-2)', color: 'var(--text-muted)' },};
  return config[sig];
}

function InvestorScorePanel({ score, loading, onRefresh, investorId }: { score: InvestorScoreData; loading: boolean; onRefresh: () => void; investorId: string }) {
  const outcomeConf = OUTCOME_CONFIG[score.predictedOutcome] || OUTCOME_CONFIG.possible;
  const momentumConf = MOMENTUM_CONFIG[score.momentum] || MOMENTUM_CONFIG.steady;
  const MomentumIcon = momentumConf.icon;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${scoreBorderColor(score.overall)}` }}>
      {/* Header row: overall score + momentum + predicted outcome */}
      <div className="p-5" style={stSurface1}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4" style={textTertiary} />
            <h2 className="text-xs font-normal tracking-wider" style={textTertiary}>Intelligence Score</h2></div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="sidebar-link"
            style={textMuted}
            title="Refresh score">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button></div>

        <div className="flex items-center gap-6">
          {/* Overall score -- large number */}
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-normal tabular-nums" style={{ color: scoreColor(score.overall) }}>{score.overall}</span>
            <span className="text-lg" style={textMuted}>/100</span></div>

          {/* Divider */}
          <div className="w-px h-14" style={vDivider} />

          {/* Momentum + Outcome */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span style={{ color: momentumConf.color }}><MomentumIcon className="w-4 h-4" /></span>
              <span className="text-sm font-normal" style={{ color: momentumConf.color }}>{momentumConf.label}</span></div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-normal"
                style={{ background: outcomeConf.bg, color: outcomeConf.color }}>
                {outcomeConf.label}</span></div></div>

          {/* Next best action */}
          <div className="flex-[2] min-w-0">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" style={textTertiary} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-normal mb-0.5" style={textMuted}>Next Action</div>
                <div className="flex items-center gap-2">
                  <p className="text-sm leading-snug flex-1" style={textSecondary}>{score.nextBestAction}</p>
                  <Link
                    href={(() => {
                      const t = score.nextBestAction.toLowerCase();
                      if (/meeting|call|schedule|present/.test(t)) return `/meetings/new?investor=${investorId}`;
                      if (/follow.?up|send|share|email|outreach/.test(t)) return `/followups?investor=${investorId}`;
                      if (/prep|brief|research/.test(t)) return `/meetings/prep?investor=${investorId}`;
                      if (/doc|data.?room|material|deck/.test(t)) return '/data-room';
                      if (/objection|concern|address/.test(t)) return '/objections';
                      return `/meetings/new?investor=${investorId}`;
                    })()}
                    className="btn btn-sm shrink-0"
                    style={ctaLinkBtnStyle}>
                    Do it <ArrowRight className="w-3 h-3" /></Link></div></div></div></div></div></div>

      {/* Score Summary: top & bottom dimensions */}
      {score.dimensions.length > 1 && (() => {
        const sorted = [...score.dimensions].sort((a, b) => b.score - a.score);
        const top = sorted[0], bottom = sorted[sorted.length - 1];
        return (
          <div className="px-5 py-3 flex gap-6" style={{ borderTop: '1px solid var(--border-default)', background: 'var(--white-4)' }}>
            <div className="flex items-center gap-1.5 min-w-0 flex-1"><span style={scoreDotSuccess} /><span className="truncate" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>Strongest: {top.name} ({top.score})</span></div>
            <div className="flex items-center gap-1.5 min-w-0 flex-1"><span style={scoreDotWarning} /><span className="truncate" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>Weakest: {bottom.name} ({bottom.score})</span></div>
          </div>);
      })()}

      {/* Dimension bars */}
      <div className="p-5" style={{ borderTop: '1px solid var(--border-default)' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {score.dimensions.map((dim) => {
            const badge = signalBadge(dim.signal);
            return (
              <div key={dim.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-normal" style={textSecondary}>{dim.name}</span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: badge.bg, color: badge.color }}>
                      {dim.signal}</span></div>
                  <span className="text-xs font-normal tabular-nums" style={{ color: scoreColor(dim.score) }}>{dim.score}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={stSurface2}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${dim.score}%`, background: scoreColor(dim.score) }} /></div>
                <p className="text-xs leading-snug truncate" title={dim.evidence} style={textMuted}>
                  {dim.evidence}</p>
              </div>);
          })}</div></div>

      {/* Risks */}
      {score.risks.length > 0 && (
        <div className="p-5" style={{ borderTop: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-3.5 h-3.5" style={textPrimary} />
            <h3 className="text-xs font-normal " style={textTertiary}>Identified Risks</h3></div>
          <div className="space-y-1.5">
            {score.risks.map((risk, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--danger)' }} />
                <p className="text-xs leading-snug" style={textTertiary}>{risk}</p></div>
            ))}</div></div>
      )}
    </div>);
}

// ---------------------------------------------------------------------------
// Conviction Trajectory Panel
// ---------------------------------------------------------------------------

const TREND_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  accelerating: { label: 'Accelerating', color: 'var(--text-secondary)', bg: 'var(--success-muted)' },
  steady: { label: 'Steady', color: 'var(--accent)', bg: 'var(--accent-muted)' },
  decelerating: { label: 'Decelerating', color: 'var(--text-tertiary)', bg: 'var(--warning-muted)' },
  insufficient_data: { label: 'Insufficient Data', color: 'var(--text-tertiary)', bg: 'var(--surface-2)' },};

const CONFIDENCE_CONFIG: Record<string, { label: string; dots: number }> = {
  high: { label: 'High confidence', dots: 3 },
  medium: { label: 'Medium confidence', dots: 2 },
  low: { label: 'Low confidence', dots: 1 },};

function ConvictionTrajectoryPanel({ trajectory }: { trajectory: ConvictionTrajectoryData }) {
  const trend = TREND_CONFIG[trajectory.trend] || TREND_CONFIG.insufficient_data;
  const confidence = CONFIDENCE_CONFIG[trajectory.confidenceLevel] || CONFIDENCE_CONFIG.low;
  const points = trajectory.dataPoints;

  // Sparkline chart dimensions
  const chartWidth = 280;
  const chartHeight = 48;
  const padding = 4;

  // Build sparkline path
  const scores = points.map(p => p.score);
  const minScore = Math.min(...scores, 0);
  const maxScore = Math.max(...scores, 100);
  const range = maxScore - minScore || 1;

  const sparklinePoints = points.map((p, i) => {
    const x = padding + (i / Math.max(points.length - 1, 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((p.score - minScore) / range) * (chartHeight - padding * 2);
    return { x, y, score: p.score, date: p.date };});

  const trendLineColor = trajectory.trend === 'accelerating' ? 'var(--accent)' :
    trajectory.trend === 'decelerating' ? 'var(--warning)' : 'var(--accent)';

  return (
    <div className="rounded-xl overflow-hidden">
      <div className="p-5" style={stSurface1}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4" style={textTertiary} />
          <h2 className="text-xs font-normal tracking-wider" style={textTertiary}>Conviction Trajectory</h2></div>

        <div className="flex items-center gap-6 flex-wrap">
          {/* Sparkline */}
          <div className="shrink-0">
            <svg width={chartWidth} height={chartHeight} className="overflow-visible">
              {/* Grid lines */}
              {[25, 50, 75].map(v => {
                const y = chartHeight - padding - ((v - minScore) / range) * (chartHeight - padding * 2);
                return (
                  <line key={v} x1={padding} y1={y} x2={chartWidth - padding} y2={y}
                    stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="3,3" />);
              })}

              {/* Trend line */}
              {sparklinePoints.length >= 2 && (
                <polyline
                  points={sparklinePoints.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={trendLineColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round" />
              )}

              {/* Data points */}
              {sparklinePoints.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3"
                  fill={trendLineColor} stroke="var(--surface-0)" strokeWidth="1.5">
                  <title>{p.date}: {p.score}/100</title></circle>
              ))}</svg></div>

          {/* Divider */}
          <div className="w-px h-12 hidden md:block" style={vDivider} />

          {/* Trend + Velocity */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-normal"
                style={{ background: trend.bg, color: trend.color }}>
                {trend.label}</span>
              <div className="flex gap-0.5" title={confidence.label}>
                {[1, 2, 3].map(n => (
                  <div
                    key={n}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: n <= confidence.dots ? 'var(--text-tertiary)' : 'var(--surface-2)' }} />
                ))}</div></div>
            <div className="flex items-center gap-3">
              <span
                className="text-sm font-normal tabular-nums"
                style={{ color: trajectory.velocityPerWeek > 0 ? 'var(--success)' : trajectory.velocityPerWeek < 0 ? 'var(--warning)' : 'var(--text-tertiary)' }}>
                {trajectory.velocityPerWeek > 0 ? '+' : ''}{trajectory.velocityPerWeek} pts/week</span></div></div>

          {/* Divider */}
          <div className="w-px h-12 hidden md:block" style={vDivider} />

          {/* Prediction */}
          <div className="space-y-1.5 min-w-0">
            <div className="text-xs font-normal " style={textMuted}>30-Day Prediction</div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-normal tabular-nums" style={{ color: scoreColor(trajectory.predictedScoreIn30Days) }}>
                {trajectory.predictedScoreIn30Days}</span>
              <span className="text-xs" style={textMuted}>/100</span></div>
            {trajectory.predictedTermSheetDate && (
              <div className="text-xs">
                {trajectory.predictedTermSheetDate === 'now' ? (
                  <span style={textSecondary}>Term sheet range reached</span>
                ) : (
                  <span style={stAccent}>
                    Term sheet by ~{fmtDateShort(trajectory.predictedTermSheetDate)}</span>
                )}</div>
            )}
            {!trajectory.predictedTermSheetDate && trajectory.trend !== 'insufficient_data' && (
              <div className="text-xs" style={textMuted}>
                {trajectory.velocityPerWeek <= 0 ? 'At risk of stalling' : 'Tracking -- more data needed'}</div>
            )}</div></div></div>
    </div>);
}

// ---------------------------------------------------------------------------
// Enrichment Status Card
// ---------------------------------------------------------------------------

const PROVIDER_STATUS_ICON: Record<string, { color: string; label: string }> = {
  success: { color: 'var(--success)', label: 'Data found' },
  failed: { color: 'var(--danger)', label: 'Failed' },
  pending: { color: 'var(--text-muted)', label: 'Not yet run' },
  unconfigured: { color: 'var(--text-muted)', label: 'No API key' },};

function EnrichmentStatusCard({
  status,
  enriching,
  onEnrich,
  onRefreshStale,
}: {
  status: EnrichmentStatus | null;
  enriching: boolean;
  onEnrich: () => void;
  onRefreshStale?: () => void;
}) {
  const [showProviders, setShowProviders] = useState(false);

  const hasData = status && status.total_fields > 0;
  const coveragePct = status?.field_coverage ?? 0;
  const coverageColor = coveragePct >= 60 ? 'var(--success)' : coveragePct >= 30 ? 'var(--warning)' : 'var(--text-muted)';

  return (
    <div className="rounded-xl p-5" style={stSurface1}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span style={textMuted}><Database className="w-4 h-4" /></span>
          <span className="text-xs font-normal" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>Data Enrichment</span>
        </div>
        <button
          onClick={onEnrich}
          disabled={enriching}
          className={`px-3 py-1.5 rounded-lg text-xs font-normal flex items-center gap-1.5 transition-colors ${enriching ? '' : 'btn-primary'}`}
          style={{
            background: enriching ? 'var(--surface-2)' : 'var(--accent)',
            color: enriching ? 'var(--text-muted)' : 'var(--text-primary)',
            cursor: enriching ? 'not-allowed' : 'pointer',
            transition: 'background 150ms ease',
            border: 'none', }}>
          {enriching
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Enriching...</>
            : <><RefreshCw className="w-3 h-3" /> {hasData ? 'Re-enrich' : 'Enrich'}</>
          }</button></div>

      {!status ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" style={textMuted} />
          <span className="text-xs" style={textMuted}>Loading status...</span></div>
      ) : !hasData ? (
        <div className="text-center py-3">
          <p className="text-sm" style={textMuted}>
            No enrichment data yet. Run enrichment to pull identity, financials, strategy, and more from 9 public sources.</p>
        </div>
      ) : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            {([
              ['Last enriched', status.last_enriched ? fmtDateShort(status.last_enriched) : 'Never', textPrimary],
              ['Fields found', status.total_fields, textPrimary],
              ['Avg confidence', `${status.avg_confidence}%`, textPrimary],
              ['Category coverage', `${status.categories_covered}/${status.categories_total} (${coveragePct}%)`, { color: coverageColor }],
            ] as const).map(([label, value, style]) => (
              <div key={label}>
                <div className="text-xs" style={textMuted}>{label}</div>
                <div className="text-sm font-light" style={style}>{value}</div></div>
            ))}</div>

          {/* Coverage bar */}
          <div className="mb-4">
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 4, background: 'var(--surface-3)' }}>
              <div
                className="rounded-full transition-all"
                style={{
                  width: `${coveragePct}%`,
                  height: '100%',
                  background: coverageColor,
                  transition: 'width 300ms ease',
                }} /></div></div>

          {/* Stale warning + refresh */}
          {status.stale_count > 0 && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 mb-4"
              style={{ background: 'var(--warning-muted)' }}>
              <AlertTriangle className="w-3 h-3 shrink-0" style={textTertiary} />
              <span className="text-xs flex-1" style={textTertiary}>
                {status.stale_count} field{status.stale_count !== 1 ? 's are' : ' is'} stale and may need refreshing</span>
              {onRefreshStale && (
                <button
                  className="btn btn-secondary btn-sm flex items-center gap-1"
                  disabled={enriching}
                  onClick={onRefreshStale}
                  style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
                  {enriching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Refresh</button>
              )}
            </div>
          )}

          {/* Provider toggle */}
          <button
            onClick={() => setShowProviders(!showProviders)}
            className="flex items-center gap-1.5 text-xs sidebar-link w-full"
            style={{ color: 'var(--text-muted)' }}>
            {showProviders ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {status.providers.length} providers ({status.providers.filter(p => p.status === 'success').length} with data)</button>

          {/* Provider details */}
          {showProviders && (
            <div className="mt-3 space-y-1">
              {status.providers.map(p => {
                const st = PROVIDER_STATUS_ICON[p.status] || PROVIDER_STATUS_ICON.pending;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover-surface-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {p.status === 'success' ? (
                        <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: st.color }} />
                      ) : p.status === 'failed' ? (
                        <XCircle className="w-3 h-3 shrink-0" style={{ color: st.color }} />
                      ) : (
                        <span className="w-3 h-3 shrink-0 flex items-center justify-center">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: st.color }} /></span>
                      )}
                      <span className="text-xs truncate" style={textSecondary}>{p.name}</span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded shrink-0"
                        style={{
                          background: p.type === 'free' ? 'var(--success-muted)' : p.type === 'freemium' ? 'var(--accent-muted)' : 'var(--warning-muted)',
                          color: 'var(--text-muted)',
                          fontSize: 'var(--font-size-xs)', }}>
                        {p.type}</span></div>
                    <div className="flex items-center gap-3 shrink-0">
                      {p.field_count > 0 && (
                        <span className="text-xs" style={textMuted}>{p.field_count} fields</span>
                      )}
                      {p.last_error && (
                        <span className="text-xs truncate max-w-[120px]" style={{ color: 'var(--danger)' }} title={p.last_error}>
                          {p.last_error.length > 20 ? p.last_error.slice(0, 20) + '...' : p.last_error}</span>
                      )}
                      <span className="text-xs" style={textMuted}>
                        {p.last_fetched ? fmtDateShort(p.last_fetched) : st.label}</span></div>
                  </div>);
              })}</div>
          )}
        </>
      )}
    </div>);
}

// ---------------------------------------------------------------------------
// Enriched Intelligence Panel
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  identity: 'Identity',
  financials: 'Financials',
  strategy: 'Strategy',
  people: 'People',
  portfolio: 'Portfolio',
  process: 'Process',
  contact: 'Contact',
  regulatory: 'Regulatory',
  corporate: 'Corporate',
  media: 'Media',
  relationships: 'Relationships',};

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  identity: { bg: 'var(--surface-2)', color: 'var(--text-tertiary)' },
  financials: { bg: 'var(--success-muted)', color: 'var(--text-secondary)' },
  strategy: { bg: 'var(--accent-muted)', color: 'var(--accent)' },
  people: { bg: 'var(--cat-12)', color: 'var(--chart-4)' },
  portfolio: { bg: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  process: { bg: 'var(--accent-muted)', color: 'var(--accent)' },
  contact: { bg: 'var(--surface-2)', color: 'var(--text-tertiary)' },
  regulatory: { bg: 'var(--danger-muted)', color: 'var(--text-primary)' },
  corporate: { bg: 'var(--surface-2)', color: 'var(--text-tertiary)' },
  media: { bg: 'var(--cat-12)', color: 'var(--chart-4)' },
  relationships: { bg: 'var(--accent-muted)', color: 'var(--accent)' },};

function confidenceStyle(confidence: number): { color: string; bg: string } {
  if (confidence >= 0.8) return { color: 'var(--success)', bg: 'var(--success-muted)' };
  if (confidence >= 0.6) return { color: 'var(--accent)', bg: 'var(--accent-muted)' };
  if (confidence >= 0.4) return { color: 'var(--warning)', bg: 'var(--warning-muted)' };
  return { color: 'var(--danger)', bg: 'var(--danger-muted)' };
}

function EnrichmentPanel({
  records,
  loading,
  expandedCategories,
  onToggleCategory,
  onRefresh,
}: {
  records: EnrichmentRecord[];
  loading: boolean;
  expandedCategories: Set<string>;
  onToggleCategory: (cat: string) => void;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 py-6 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" style={textMuted} />
        <span className="text-sm" style={textMuted}>Loading enrichment data...</span>
      </div>);
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-6">
        <Database className="w-8 h-8 mx-auto mb-2" style={textMuted} />
        <p className="text-sm mb-3" style={textMuted}>No enrichment data yet. Run research to pull financials, strategy, people, and more.</p>
        <button
          onClick={onRefresh}
          className="btn-primary px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 mx-auto transition-colors"
          style={{
            background: 'var(--accent)',
            color: 'var(--text-primary)',
            border: 'none', }}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>);
  }

  // Group records by category
  const grouped: Record<string, EnrichmentRecord[]> = {};
  for (const rec of records) {
    const cat = rec.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(rec);
  }

  // Sort categories by number of records (largest first)
  const sortedCategories = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);

  // Extract key profile fields for quick-view card
  const findField = (field: string) => records.find(r => r.field_name === field)?.field_value;
  const profileFields = [
    { label: 'AUM', value: findField('aum') || findField('assets_under_management') },
    { label: 'Fund Count', value: findField('fund_count') || findField('number_of_funds') },
    { label: 'Thesis', value: findField('investment_thesis') || findField('thesis') || findField('strategy') },
    { label: 'Jurisdiction', value: findField('jurisdiction') || findField('hq_country') || findField('country') },
    { label: 'Founded', value: findField('founded') || findField('incorporation_date') || findField('year_founded') },
    { label: 'Website', value: findField('website') || findField('website_url') },
  ].filter(f => f.value);
  const keyPeople = records.filter(r => r.category === 'people' && r.confidence >= 0.5).slice(0, 4);
  const recentDeals = records.filter(r => r.category === 'portfolio' || r.field_name?.includes('investment') || r.field_name?.includes('deal')).slice(0, 3);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5" style={textTertiary} />
          <span className="text-xs font-normal " style={textTertiary}>
            {records.length} enriched fields across {sortedCategories.length} categories</span></div>
        <button
          onClick={onRefresh}
          className="sidebar-link text-xs flex items-center gap-1 transition-colors"
          style={{
            color: 'var(--text-muted)',
            background: 'transparent', }}>
          <RefreshCw className="w-3 h-3" /> Refresh</button></div>

      {/* Quick Profile Card */}
      {profileFields.length > 0 && (
        <div className="rounded-lg p-4 mb-3" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
          <div className="text-xs font-normal mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.03em' }}>PROFILE SNAPSHOT</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            {profileFields.map(f => (
              <div key={f.label}>
                <div className="text-xs" style={textMuted}>{f.label}</div>
                <div className="text-sm truncate" style={textPrimary} title={f.value}>
                  {f.label === 'Website' && f.value ? (
                    <a href={f.value.startsWith('http') ? f.value : `https://${f.value}`} target="_blank" rel="noopener noreferrer" style={stAccent} onClick={e => e.stopPropagation()}>{f.value.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
                  ) : (f.value!.length > 80 ? f.value!.slice(0, 80) + '...' : f.value)}</div>
              </div>
            ))}
          </div>
          {keyPeople.length > 0 && (
            <div className="pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div className="text-xs mb-1.5" style={textMuted}>Key People</div>
              <div className="flex flex-wrap gap-2">
                {keyPeople.map(p => (
                  <span key={p.id} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
                    {p.field_value.length > 50 ? p.field_value.slice(0, 50) + '...' : p.field_value}
                  </span>
                ))}
              </div>
            </div>
          )}
          {recentDeals.length > 0 && (
            <div className="pt-2 mt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div className="text-xs mb-1.5" style={textMuted}>Recent Activity</div>
              {recentDeals.map(d => (
                <div key={d.id} className="text-xs mb-1" style={textSecondary}>
                  {d.field_value.length > 100 ? d.field_value.slice(0, 100) + '...' : d.field_value}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sortedCategories.map(cat => {
        const catRecords = grouped[cat];
        const isExpanded = expandedCategories.has(cat);
        const catLabel = CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
        const catColor = CATEGORY_COLORS[cat] || { bg: 'var(--surface-2)', color: 'var(--text-tertiary)' };
        const avgConfidence = catRecords.reduce((sum, r) => sum + r.confidence, 0) / catRecords.length;

        return (
          <div key={cat} className="rounded-lg overflow-hidden">
            <button
              onClick={() => onToggleCategory(cat)}
              className="w-full flex items-center justify-between px-4 py-3 hover-row"
              style={{ background: isExpanded ? 'var(--surface-1)' : 'transparent' }}>
              <div className="flex items-center gap-3">
                <span
                  className="text-xs px-2 py-0.5 rounded font-normal"
                  style={{ background: catColor.bg, color: catColor.color }}>
                  {catLabel}</span>
                <span className="text-xs" style={textMuted}>{catRecords.length} field{catRecords.length !== 1 ? 's' : ''}</span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: confidenceStyle(avgConfidence).bg, color: confidenceStyle(avgConfidence).color }}>
                  {Math.round(avgConfidence * 100)}% avg confidence</span></div>
              <div style={textMuted}>
                {isExpanded
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronRight className="w-4 h-4" />
                }</div></button>

            {isExpanded && (
              <div style={stBorderTop}>
                {catRecords.map(rec => (
                  <div
                    key={rec.id}
                    className="hover-row flex items-start gap-3 px-4 py-2.5 transition-colors"
                    style={{
                      borderBottom: '1px solid var(--border-subtle)', }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-normal" style={textSecondary}>
                          {rec.field_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-normal"
                          style={{ background: confidenceStyle(rec.confidence).bg, color: confidenceStyle(rec.confidence).color }}>
                          {Math.round(rec.confidence * 100)}%</span></div>
                      <p className="text-sm break-words" style={textPrimary}>
                        {rec.field_value.length > 300 ? rec.field_value.slice(0, 300) + '...' : rec.field_value}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs" style={textMuted}>
                          Source: {rec.source_id}</span>
                        <span className="text-xs" style={textMuted}>
                          Updated: {rec.fetched_at ? fmtDate(rec.fetched_at) : '—'}</span>
                        {rec.source_url && (
                          <a
                            href={rec.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs flex items-center gap-0.5"
                            style={stAccent}
                            onClick={e => e.stopPropagation()}>
                            <ExternalLink className="w-2.5 h-2.5" /> Link</a>
                        )}</div></div></div>
                ))}</div>
            )}
          </div>);
      })}
    </div>);
}

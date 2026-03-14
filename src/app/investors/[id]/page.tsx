'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Investor, Meeting, InvestorPartner, InvestorPortfolioCo, IntelligenceBrief, InvestorStatus, Task } from '@/lib/types';
import {
  ArrowLeft, Calendar, TrendingUp, AlertTriangle,
  Clock, Target, Users, Zap, Briefcase, UserCheck, BookOpen,
  RefreshCw, Loader2, Trash2, ClipboardList, Check, FileSearch,
  Gauge, ArrowUpRight, ArrowRight, ArrowDownRight, Minus, ShieldAlert, Lightbulb,
  Activity, AlertCircle, Database, ChevronDown, ChevronRight, ExternalLink
} from 'lucide-react';
import { useToast } from '@/components/toast';

const STATUS_LABELS: Record<InvestorStatus, string> = {
  identified: 'Identified', contacted: 'Contacted', nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Set', met: 'Met', engaged: 'Engaged',
  in_dd: 'In DD', term_sheet: 'Term Sheet', closed: 'Closed',
  passed: 'Passed', dropped: 'Dropped',
};

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
  dropped: 'var(--surface-3)',
};

interface ScoreDimension {
  name: string;
  score: number;
  signal: 'strong' | 'moderate' | 'weak' | 'unknown';
  evidence: string;
}

interface InvestorScoreData {
  overall: number;
  dimensions: ScoreDimension[];
  momentum: 'accelerating' | 'steady' | 'decelerating' | 'stalled';
  predictedOutcome: 'likely_close' | 'possible' | 'long_shot' | 'unlikely';
  nextBestAction: string;
  risks: string[];
  lastUpdated: string;
}

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

type IntelTab = 'overview' | 'partners' | 'portfolio' | 'research' | 'tasks' | 'enrichment';

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
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [intelTab, setIntelTab] = useState<IntelTab>('overview');

  const fetchScore = useCallback(async () => {
    setScoreLoading(true);
    try {
      const res = await fetch(`/api/investors/${id}/score`);
      if (res.ok) {
        const data = await res.json();
        setScore(data);
      }
    } catch { /* ignore score errors */ }
    setScoreLoading(false);
    // Fetch trajectory after score (score may create a snapshot)
    try {
      const trajRes = await fetch(`/api/investors/${id}/trajectory`);
      if (trajRes.ok) {
        setTrajectory(await trajRes.json());
      }
    } catch { /* ignore trajectory errors */ }
  }, [id]);

  const fetchEnrichment = useCallback(async () => {
    setEnrichmentLoading(true);
    try {
      const res = await fetch(`/api/enrichment?action=records&investor_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setEnrichmentRecords(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore enrichment errors */ }
    setEnrichmentLoading(false);
  }, [id]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, mtgRes, partRes, portRes, briefRes, taskRes] = await Promise.all([
        fetch(`/api/investors?id=${id}`).then(r => r.json()),
        fetch(`/api/meetings?investor_id=${id}`).then(r => r.json()),
        fetch(`/api/intelligence?type=partners&investor_id=${id}`).then(r => r.json()).catch(() => []),
        fetch(`/api/intelligence?type=portfolio&investor_id=${id}`).then(r => r.json()).catch(() => []),
        fetch(`/api/intelligence?type=briefs&investor_id=${id}`).then(r => r.json()).catch(() => []),
        fetch(`/api/tasks?investor_id=${id}`).then(r => r.json()).catch(() => []),
      ]);
      setInvestor(invRes);
      setMeetings(mtgRes);
      setPartners(Array.isArray(partRes) ? partRes : []);
      setPortfolio(Array.isArray(portRes) ? portRes : []);
      setBriefs(Array.isArray(briefRes) ? briefRes : []);
      setTasks(Array.isArray(taskRes) ? taskRes : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); fetchScore(); fetchEnrichment(); }, [fetchData, fetchScore, fetchEnrichment]);

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
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast('Research complete', 'success');
      fetchData();
      setIntelTab('research');
    } catch (err) {
      toast(`Research failed: ${err}`, 'error');
    }
    setResearching(false);
  }

  async function deleteIntelItem(type: string, itemId: string) {
    try {
      const res = await fetch(`/api/intelligence?type=${type}&id=${itemId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      fetchData();
    } catch {
      toast('Failed to delete item', 'error');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded animate-pulse" style={{ background: 'var(--surface-2)' }} />
        <div className="h-32 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)' }} />
        <div className="h-64 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)' }} />
      </div>
    );
  }

  if (!investor) {
    return (
      <div className="text-center py-12">
        <p style={{ color: 'var(--text-muted)' }}>Investor not found or has been removed.</p>
        <Link
          href="/investors"
          className="text-sm mt-2 block"
          style={{ color: 'var(--accent)' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Back to Pipeline
        </Link>
      </div>
    );
  }

  const allObjections: { text: string; severity: string; topic: string; date: string }[] = [];
  const allQuestions: { text: string; topic: string; date: string }[] = [];
  meetings.forEach(m => {
    try {
      const objs = JSON.parse(m.objections || '[]');
      objs.forEach((o: { text: string; severity: string; topic: string }) => { allObjections.push({ ...o, date: m.date }); });
    } catch { /* skip */ }
    try {
      const qs = JSON.parse(m.questions_asked || '[]');
      qs.forEach((q: { text: string; topic: string }) => { allQuestions.push({ ...q, date: m.date }); });
    } catch { /* skip */ }
  });

  const enthusiasmTrend = meetings
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(m => ({ date: m.date, score: m.enthusiasm_score }));
  const latestEnthusiasm = enthusiasmTrend.length > 0 ? enthusiasmTrend[enthusiasmTrend.length - 1].score : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/investors"
            className="flex items-center gap-1 text-sm mb-3"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to CRM
          </Link>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{investor.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                background: investor.tier === 1 ? 'var(--accent-muted)' :
                  investor.tier === 2 ? 'var(--accent-muted)' :
                  'var(--surface-2)',
                color: investor.tier === 1 ? 'var(--accent)' :
                  investor.tier === 2 ? 'var(--accent)' :
                  'var(--text-tertiary)',
              }}
            >Tier {investor.tier}</span>
            <select
              value={investor.status}
              onChange={async (e) => {
                const newStatus = e.target.value;
                await fetch('/api/investors', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: newStatus }) });
                setInvestor(prev => prev ? { ...prev, status: newStatus as InvestorStatus } : prev);
                toast(`Status updated to ${STATUS_LABELS[newStatus as InvestorStatus] || newStatus}`);
              }}
              className="px-2 py-0.5 rounded text-xs font-medium border-none cursor-pointer focus:outline-none"
              style={{
                backgroundColor: STATUS_COLORS[investor.status],
                color: 'var(--text-primary)',
              }}
            >
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val} style={{ background: 'var(--surface-0)', color: 'var(--text-secondary)' }}>{label}</option>
              ))}
            </select>
            <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{investor.type.replace(/_/g, ' ')}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/meetings/prep?investor=${id}`}
            className="px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            style={{ background: 'var(--surface-2)', color: 'var(--text-primary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-2)')}
          >
            <FileSearch className="w-3.5 h-3.5" /> Prep Meeting
          </Link>
          <button
            onClick={handleResearch}
            disabled={researching}
            className="px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            style={{
              background: researching ? 'var(--surface-2)' : 'var(--surface-2)',
              color: researching ? 'var(--text-muted)' : 'var(--text-primary)',
            }}
            onMouseEnter={e => { if (!researching) e.currentTarget.style.background = 'var(--surface-3)'; }}
            onMouseLeave={e => { if (!researching) e.currentTarget.style.background = 'var(--surface-2)'; }}
          >
            {researching ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Researching...</> : <><RefreshCw className="w-3.5 h-3.5" /> Research</>}
          </button>
          <Link
            href="/meetings/new"
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            + Log Meeting
          </Link>
        </div>
      </div>

      {/* Data Quality Banner */}
      {investor && (() => {
        const checkFields = [
          { field: 'partner', label: 'partner' },
          { field: 'fund_size', label: 'fund size' },
          { field: 'check_size_range', label: 'check size' },
          { field: 'sector_thesis', label: 'sector thesis' },
          { field: 'warm_path', label: 'warm path' },
          { field: 'ic_process', label: 'IC process' },
          { field: 'portfolio_conflicts', label: 'portfolio conflicts' },
        ];
        const missing = checkFields.filter(f => {
          const val = (investor as unknown as Record<string, unknown>)[f.field];
          return !val || (typeof val === 'string' && val.trim() === '');
        });
        const completeness = Math.round(((checkFields.length - missing.length) / checkFields.length) * 100);
        if (completeness >= 80) return null;
        return (
          <div
            className="flex items-start gap-3 rounded-xl px-4 py-3"
            style={{ border: '1px solid var(--warning-muted)', background: 'var(--warning-muted)' }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
            <div className="min-w-0">
              <div className="text-sm font-medium" style={{ color: 'var(--warning)' }}>
                Profile {completeness}% complete — fill missing fields to improve scoring accuracy
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--warning)', opacity: 0.7 }}>
                Missing: {missing.map(f => f.label).join(', ')}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Profile + Process Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl p-5 space-y-3" style={{ border: '1px solid var(--border-default)' }}>
          <h2 className="text-xs font-medium flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
            <Users className="w-3.5 h-3.5" /> PROFILE
          </h2>
          <div className="space-y-2 text-sm">
            <Row label="Partner" value={investor.partner} />
            <Row label="Fund Size" value={investor.fund_size} />
            <Row label="Check Size" value={investor.check_size_range} />
            <Row label="Thesis" value={investor.sector_thesis} />
          </div>
        </div>
        <div className="rounded-xl p-5 space-y-3" style={{ border: '1px solid var(--border-default)' }}>
          <h2 className="text-xs font-medium flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
            <Target className="w-3.5 h-3.5" /> PROCESS
          </h2>
          <div className="space-y-2 text-sm">
            <Row label="Warm Path" value={investor.warm_path} />
            <Row label="IC Process" value={investor.ic_process} />
            <Row label="Speed" value={investor.speed} />
            <Row label="Conflicts" value={investor.portfolio_conflicts} />
          </div>
        </div>
      </div>

      {/* Intelligence Score */}
      {score && <InvestorScorePanel score={score} loading={scoreLoading} onRefresh={fetchScore} />}
      {scoreLoading && !score && (
        <div className="rounded-xl p-6" style={{ border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Scoring investor across 11 dimensions...</span>
          </div>
        </div>
      )}

      {/* Conviction Trajectory */}
      {trajectory && trajectory.dataPoints.length > 0 && (
        <ConvictionTrajectoryPanel trajectory={trajectory} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={TrendingUp} label="Enthusiasm" value={`${latestEnthusiasm}/5`} sub="latest reading" />
        <StatCard icon={Calendar} label="Meetings" value={meetings.length} sub="logged" />
        <StatCard icon={AlertTriangle} label="Objections" value={allObjections.length} sub="unresolved" />
        <StatCard icon={UserCheck} label="Partners" value={partners.length} sub="profiled" />
        <StatCard icon={Briefcase} label="Portfolio Cos" value={portfolio.length} sub="tracked" />
      </div>

      {/* Intelligence Tabs */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
        <div className="flex" style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--surface-1)' }}>
          {([
            { key: 'overview' as IntelTab, label: 'Meetings', icon: Clock },
            { key: 'partners' as IntelTab, label: `Partners (${partners.length})`, icon: UserCheck },
            { key: 'portfolio' as IntelTab, label: `Portfolio (${portfolio.length})`, icon: Briefcase },
            { key: 'tasks' as IntelTab, label: `Tasks (${tasks.filter(t => t.status !== 'done').length})`, icon: ClipboardList },
            { key: 'enrichment' as IntelTab, label: `Enriched (${enrichmentRecords.length})`, icon: Database },
            { key: 'research' as IntelTab, label: `Research (${briefs.length})`, icon: BookOpen },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setIntelTab(t.key)}
              className="px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2"
              style={{
                borderBottom: intelTab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                color: intelTab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
              onMouseEnter={e => { if (intelTab !== t.key) e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { if (intelTab !== t.key) e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Meetings Tab */}
          {intelTab === 'overview' && (
            <div>
              {/* Enthusiasm Trend */}
              {enthusiasmTrend.length > 1 && (
                <div className="mb-6">
                  <h3 className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                    <Zap className="w-3.5 h-3.5" /> ENTHUSIASM TREND
                  </h3>
                  <div className="flex items-end gap-2 h-20">
                    {enthusiasmTrend.map((point, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t"
                          style={{
                            height: `${(point.score / 5) * 100}%`,
                            background: point.score >= 4 ? 'var(--success)' : point.score >= 3 ? 'var(--accent)' : point.score >= 2 ? 'var(--warning)' : 'var(--danger)',
                          }}
                        />
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{point.date.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meeting History */}
              <h3 className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                <Clock className="w-3.5 h-3.5" /> MEETING HISTORY
              </h3>
              {meetings.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No meetings logged yet. Log your first meeting to start tracking engagement.</p>
              ) : (
                <div className="space-y-4">
                  {meetings.map(m => {
                    const objs = (() => { try { return JSON.parse(m.objections || '[]'); } catch { return []; } })();
                    return (
                      <div key={m.id} className="pl-4 pb-2" style={{ borderLeft: '2px solid var(--border-default)' }}>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{m.date}</span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.type.replace(/_/g, ' ')}</span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.duration_minutes}min</span>
                          <div className="flex gap-0.5 ml-auto">
                            {[1,2,3,4,5].map(n => (
                              <div
                                key={n}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: n <= m.enthusiasm_score ? 'var(--accent)' : 'var(--surface-2)' }}
                              />
                            ))}
                          </div>
                        </div>
                        {m.ai_analysis && <p className="text-sm mb-2" style={{ color: 'var(--text-tertiary)' }}>{m.ai_analysis}</p>}
                        {m.next_steps && <p className="text-xs" style={{ color: 'var(--accent)', opacity: 0.7 }}>Next: {m.next_steps}</p>}
                        {objs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {objs.map((o: { text: string; severity: string }, i: number) => (
                              <span
                                key={i}
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{
                                  background: o.severity === 'showstopper' ? 'var(--danger-muted)' :
                                    o.severity === 'significant' ? 'var(--warning-muted)' :
                                    'var(--surface-2)',
                                  color: o.severity === 'showstopper' ? 'var(--danger)' :
                                    o.severity === 'significant' ? 'var(--warning)' :
                                    'var(--text-muted)',
                                }}
                              >{o.text.length > 40 ? o.text.slice(0, 40) + '...' : o.text}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Objection Summary */}
              {allObjections.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                    <AlertTriangle className="w-3.5 h-3.5" /> ALL OBJECTIONS
                  </h3>
                  <div className="space-y-2">
                    {allObjections.map((o, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded shrink-0"
                          style={{
                            background: o.severity === 'showstopper' ? 'var(--danger-muted)' :
                              o.severity === 'significant' ? 'var(--warning-muted)' :
                              'var(--surface-2)',
                            color: o.severity === 'showstopper' ? 'var(--danger)' :
                              o.severity === 'significant' ? 'var(--warning)' :
                              'var(--text-muted)',
                          }}
                        >{o.severity}</span>
                        <span className="flex-1" style={{ color: 'var(--text-secondary)' }}>{o.text}</span>
                        <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{o.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Partners Tab */}
          {intelTab === 'partners' && (
            <div>
              {partners.length === 0 ? (
                <div className="text-center py-6">
                  <UserCheck className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>No partner profiles yet. Run research to pull key decision-makers.</p>
                  <button
                    onClick={handleResearch}
                    disabled={researching}
                    className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 mx-auto"
                    style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Research {investor.name}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {partners.map(p => (
                    <div key={p.id} className="rounded-lg p-4" style={{ border: '1px solid var(--border-default)' }}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.name}</h4>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.title}</p>
                        </div>
                        <button
                          onClick={() => deleteIntelItem('partner', p.id)}
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 space-y-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {p.focus_areas && <p><span style={{ color: 'var(--text-muted)' }}>Focus:</span> {p.focus_areas}</p>}
                        {p.notable_deals && <p><span style={{ color: 'var(--text-muted)' }}>Deals:</span> {p.notable_deals}</p>}
                        {p.board_seats && <p><span style={{ color: 'var(--text-muted)' }}>Boards:</span> {p.board_seats}</p>}
                        {p.background && <p><span style={{ color: 'var(--text-muted)' }}>Background:</span> {p.background}</p>}
                        {p.relevance_to_us && <p style={{ color: 'var(--accent)' }}><span style={{ color: 'var(--text-muted)' }}>Relevance:</span> {p.relevance_to_us}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Portfolio Tab */}
          {intelTab === 'portfolio' && (
            <div>
              {portfolio.length === 0 ? (
                <div className="text-center py-6">
                  <Briefcase className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>No portfolio companies tracked. Run research to identify conflicts and overlap.</p>
                  <button
                    onClick={handleResearch}
                    disabled={researching}
                    className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 mx-auto"
                    style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Research {investor.name}
                  </button>
                </div>
              ) : (
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
                  <table className="w-full text-sm">
                    <thead style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border-default)' }}>
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Company</th>
                        <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Sector</th>
                        <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Stage</th>
                        <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Amount</th>
                        <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Date</th>
                        <th className="text-left px-4 py-2 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Status</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.map(co => (
                        <tr
                          key={co.id}
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-1)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td className="px-4 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{co.company}</td>
                          <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{co.sector}</td>
                          <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{co.stage_invested}</td>
                          <td className="px-4 py-2 text-xs" style={{ color: 'var(--success)' }}>{co.amount}</td>
                          <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>{co.date}</td>
                          <td className="px-4 py-2">
                            <span
                              className="text-xs px-1.5 py-0.5 rounded"
                              style={{
                                background: co.status === 'active' ? 'var(--success-muted)' :
                                  co.status === 'exited' ? 'var(--accent-muted)' :
                                  'var(--danger-muted)',
                                color: co.status === 'active' ? 'var(--success)' :
                                  co.status === 'exited' ? 'var(--accent)' :
                                  'var(--danger)',
                              }}
                            >{co.status}</span>
                          </td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => deleteIntelItem('portfolio', co.id)}
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tasks Tab */}
          {intelTab === 'tasks' && (
            <div>
              {tasks.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No tasks yet. Tasks are auto-generated from meeting debriefs — log a meeting to get started.</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map(t => {
                    const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';
                    const prioColor = { critical: 'var(--danger)', high: 'var(--warning)', medium: 'var(--warning)', low: 'var(--text-muted)' }[t.priority] || 'var(--text-muted)';
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg"
                        style={{
                          border: `1px solid ${t.status === 'done' ? 'var(--border-subtle)' : 'var(--border-default)'}`,
                          opacity: t.status === 'done' ? 0.5 : 1,
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={async () => {
                              const newStatus = t.status === 'done' ? 'pending' : 'done';
                              await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, status: newStatus, title: t.title, investor_id: id, investor_name: investor?.name }) });
                              fetchData();
                            }}
                            className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                            style={{
                              background: t.status === 'done' ? 'var(--success)' : 'transparent',
                              border: t.status === 'done' ? '2px solid var(--success)' : '2px solid var(--border-default)',
                              color: 'var(--text-primary)',
                            }}
                            onMouseEnter={e => { if (t.status !== 'done') e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
                            onMouseLeave={e => { if (t.status !== 'done') e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                          >
                            {t.status === 'done' && <Check className="w-3 h-3" />}
                          </button>
                          <div className="min-w-0">
                            <div className={`text-sm truncate ${t.status === 'done' ? 'line-through' : ''}`} style={{ color: 'var(--text-primary)' }}>{t.title}</div>
                            {t.description && <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{t.description}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px]" style={{ color: prioColor }}>{t.priority}</span>
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.phase}</span>
                          {t.due_date && <span className="text-[10px]" style={{ color: overdue ? 'var(--danger)' : 'var(--text-muted)', fontWeight: overdue ? 500 : 400 }}>{t.due_date}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
                });
              }}
              onRefresh={fetchEnrichment}
            />
          )}

          {/* Research Tab */}
          {intelTab === 'research' && (
            <div>
              {briefs.length === 0 ? (
                <div className="text-center py-6">
                  <BookOpen className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>No research briefs yet. Run AI research to pull fund strategy, recent deals, and thesis alignment.</p>
                  <button
                    onClick={handleResearch}
                    disabled={researching}
                    className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 mx-auto"
                    style={{ background: 'var(--accent)', color: 'var(--text-primary)' }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    {researching ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Researching...</> : <><RefreshCw className="w-3.5 h-3.5" /> Research {investor.name}</>}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {briefs.map(b => (
                    <div key={b.id} className="rounded-lg p-4" style={{ border: '1px solid var(--border-default)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>{b.brief_type}</span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.updated_at?.split('T')[0]}</span>
                        </div>
                        <button
                          onClick={() => deleteIntelItem('brief', b.id)}
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {b.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {investor.notes && (
        <div className="rounded-xl p-5" style={{ border: '1px solid var(--border-default)' }}>
          <h2 className="text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>NOTES</h2>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{investor.notes}</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-right max-w-[60%]" style={{ color: 'var(--text-secondary)' }}>{value || '---'}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-xl p-4" style={{ border: '1px solid var(--border-default)' }}>
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: 'var(--text-muted)' }}><Icon className="w-3.5 h-3.5" /></span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intelligence Score Panel
// ---------------------------------------------------------------------------

const OUTCOME_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  likely_close: { label: 'Likely Close', color: 'var(--success)', bg: 'var(--success-muted)' },
  possible: { label: 'Possible', color: 'var(--accent)', bg: 'var(--accent-muted)' },
  long_shot: { label: 'Long Shot', color: 'var(--warning)', bg: 'var(--warning-muted)' },
  unlikely: { label: 'Unlikely', color: 'var(--danger)', bg: 'var(--danger-muted)' },
};

const MOMENTUM_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  accelerating: { label: 'Accelerating', icon: ArrowUpRight, color: 'var(--success)' },
  steady: { label: 'Steady', icon: ArrowRight, color: 'var(--accent)' },
  decelerating: { label: 'Decelerating', icon: ArrowDownRight, color: 'var(--warning)' },
  stalled: { label: 'Stalled', icon: Minus, color: 'var(--danger)' },
};

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--success)';
  if (score >= 50) return 'var(--accent)';
  if (score >= 30) return 'var(--warning)';
  return 'var(--danger)';
}

function scoreBarColor(score: number): string {
  if (score >= 70) return 'var(--success)';
  if (score >= 50) return 'var(--accent)';
  if (score >= 30) return 'var(--warning)';
  return 'var(--danger)';
}

function scoreBorderColor(score: number): string {
  if (score >= 70) return 'var(--success-muted)';
  if (score >= 50) return 'var(--accent-muted)';
  if (score >= 30) return 'var(--warning-muted)';
  return 'var(--danger-muted)';
}

function signalBadge(sig: 'strong' | 'moderate' | 'weak' | 'unknown'): { bg: string; color: string } {
  const config = {
    strong: { bg: 'var(--success-muted)', color: 'var(--success)' },
    moderate: { bg: 'var(--accent-muted)', color: 'var(--accent)' },
    weak: { bg: 'var(--warning-muted)', color: 'var(--warning)' },
    unknown: { bg: 'var(--surface-2)', color: 'var(--text-muted)' },
  };
  return config[sig];
}

function InvestorScorePanel({ score, loading, onRefresh }: { score: InvestorScoreData; loading: boolean; onRefresh: () => void }) {
  const outcomeConf = OUTCOME_CONFIG[score.predictedOutcome] || OUTCOME_CONFIG.possible;
  const momentumConf = MOMENTUM_CONFIG[score.momentum] || MOMENTUM_CONFIG.steady;
  const MomentumIcon = momentumConf.icon;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${scoreBorderColor(score.overall)}` }}>
      {/* Header row: overall score + momentum + predicted outcome */}
      <div className="p-5" style={{ background: 'var(--surface-1)' }}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Intelligence Score</h2>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Refresh score"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-6">
          {/* Overall score -- large number */}
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold tabular-nums" style={{ color: scoreColor(score.overall) }}>{score.overall}</span>
            <span className="text-lg" style={{ color: 'var(--text-muted)' }}>/100</span>
          </div>

          {/* Divider */}
          <div className="w-px h-14" style={{ background: 'var(--border-default)' }} />

          {/* Momentum + Outcome */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span style={{ color: momentumConf.color }}><MomentumIcon className="w-4 h-4" /></span>
              <span className="text-sm font-medium" style={{ color: momentumConf.color }}>{momentumConf.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: outcomeConf.bg, color: outcomeConf.color }}
              >
                {outcomeConf.label}
              </span>
            </div>
          </div>

          {/* Next best action */}
          <div className="flex-[2] min-w-0">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
              <div className="min-w-0">
                <div className="text-[10px] font-medium uppercase mb-0.5" style={{ color: 'var(--text-muted)' }}>Next Action</div>
                <p className="text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>{score.nextBestAction}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dimension bars */}
      <div className="p-5" style={{ borderTop: '1px solid var(--border-default)' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {score.dimensions.map((dim) => {
            const badge = signalBadge(dim.signal);
            return (
              <div key={dim.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{dim.name}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {dim.signal}
                    </span>
                  </div>
                  <span className="text-xs font-bold tabular-nums" style={{ color: scoreColor(dim.score) }}>{dim.score}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${dim.score}%`, background: scoreBarColor(dim.score) }}
                  />
                </div>
                <p className="text-[11px] leading-snug truncate" title={dim.evidence} style={{ color: 'var(--text-muted)' }}>
                  {dim.evidence}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Risks */}
      {score.risks.length > 0 && (
        <div className="p-5" style={{ borderTop: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-3.5 h-3.5" style={{ color: 'var(--danger)' }} />
            <h3 className="text-xs font-medium uppercase" style={{ color: 'var(--text-tertiary)' }}>Identified Risks</h3>
          </div>
          <div className="space-y-1.5">
            {score.risks.map((risk, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ background: 'var(--danger)' }} />
                <p className="text-xs leading-snug" style={{ color: 'var(--text-tertiary)' }}>{risk}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conviction Trajectory Panel
// ---------------------------------------------------------------------------

const TREND_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  accelerating: { label: 'Accelerating', color: 'var(--success)', bg: 'var(--success-muted)' },
  steady: { label: 'Steady', color: 'var(--accent)', bg: 'var(--accent-muted)' },
  decelerating: { label: 'Decelerating', color: 'var(--warning)', bg: 'var(--warning-muted)' },
  insufficient_data: { label: 'Insufficient Data', color: 'var(--text-tertiary)', bg: 'var(--surface-2)' },
};

const CONFIDENCE_CONFIG: Record<string, { label: string; dots: number }> = {
  high: { label: 'High confidence', dots: 3 },
  medium: { label: 'Medium confidence', dots: 2 },
  low: { label: 'Low confidence', dots: 1 },
};

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
    return { x, y, score: p.score, date: p.date };
  });

  const trendLineColor = trajectory.trend === 'accelerating' ? '#34d399' :
    trajectory.trend === 'decelerating' ? '#fbbf24' : '#60a5fa';

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
      <div className="p-5" style={{ background: 'var(--surface-1)' }}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Conviction Trajectory</h2>
        </div>

        <div className="flex items-center gap-6 flex-wrap">
          {/* Sparkline */}
          <div className="shrink-0">
            <svg width={chartWidth} height={chartHeight} className="overflow-visible">
              {/* Grid lines */}
              {[25, 50, 75].map(v => {
                const y = chartHeight - padding - ((v - minScore) / range) * (chartHeight - padding * 2);
                return (
                  <line key={v} x1={padding} y1={y} x2={chartWidth - padding} y2={y}
                    stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="3,3" />
                );
              })}

              {/* Trend line */}
              {sparklinePoints.length >= 2 && (
                <polyline
                  points={sparklinePoints.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={trendLineColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points */}
              {sparklinePoints.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3"
                  fill={trendLineColor} stroke="var(--surface-0)" strokeWidth="1.5">
                  <title>{p.date}: {p.score}/100</title>
                </circle>
              ))}
            </svg>
          </div>

          {/* Divider */}
          <div className="w-px h-12 hidden md:block" style={{ background: 'var(--border-default)' }} />

          {/* Trend + Velocity */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: trend.bg, color: trend.color }}
              >
                {trend.label}
              </span>
              <div className="flex gap-0.5" title={confidence.label}>
                {[1, 2, 3].map(n => (
                  <div
                    key={n}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: n <= confidence.dots ? 'var(--text-tertiary)' : 'var(--surface-2)' }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="text-sm font-medium tabular-nums"
                style={{ color: trajectory.velocityPerWeek > 0 ? 'var(--success)' : trajectory.velocityPerWeek < 0 ? 'var(--warning)' : 'var(--text-tertiary)' }}
              >
                {trajectory.velocityPerWeek > 0 ? '+' : ''}{trajectory.velocityPerWeek} pts/week
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-12 hidden md:block" style={{ background: 'var(--border-default)' }} />

          {/* Prediction */}
          <div className="space-y-1.5 min-w-0">
            <div className="text-[10px] font-medium uppercase" style={{ color: 'var(--text-muted)' }}>30-Day Prediction</div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold tabular-nums" style={{ color: scoreColor(trajectory.predictedScoreIn30Days) }}>
                {trajectory.predictedScoreIn30Days}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/100</span>
            </div>
            {trajectory.predictedTermSheetDate && (
              <div className="text-xs">
                {trajectory.predictedTermSheetDate === 'now' ? (
                  <span style={{ color: 'var(--success)' }}>Term sheet range reached</span>
                ) : (
                  <span style={{ color: 'var(--accent)' }}>
                    Term sheet by ~{new Date(trajectory.predictedTermSheetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            )}
            {!trajectory.predictedTermSheetDate && trajectory.trend !== 'insufficient_data' && (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {trajectory.velocityPerWeek <= 0 ? 'At risk of stalling' : 'Tracking -- more data needed'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
  relationships: 'Relationships',
};

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  identity: { bg: 'var(--surface-2)', color: 'var(--text-tertiary)' },
  financials: { bg: 'var(--success-muted)', color: 'var(--success)' },
  strategy: { bg: 'var(--accent-muted)', color: 'var(--accent)' },
  people: { bg: 'rgba(168, 85, 247, 0.12)', color: '#c084fc' },
  portfolio: { bg: 'var(--warning-muted)', color: 'var(--warning)' },
  process: { bg: 'var(--accent-muted)', color: 'var(--accent)' },
  contact: { bg: 'var(--surface-2)', color: 'var(--text-tertiary)' },
  regulatory: { bg: 'var(--danger-muted)', color: 'var(--danger)' },
  corporate: { bg: 'var(--surface-2)', color: 'var(--text-tertiary)' },
  media: { bg: 'rgba(168, 85, 247, 0.12)', color: '#c084fc' },
  relationships: { bg: 'var(--accent-muted)', color: 'var(--accent)' },
};

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'var(--success)';
  if (confidence >= 0.6) return 'var(--accent)';
  if (confidence >= 0.4) return 'var(--warning)';
  return 'var(--danger)';
}

function confidenceBg(confidence: number): string {
  if (confidence >= 0.8) return 'var(--success-muted)';
  if (confidence >= 0.6) return 'var(--accent-muted)';
  if (confidence >= 0.4) return 'var(--warning-muted)';
  return 'var(--danger-muted)';
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
  const [hoveredRefresh, setHoveredRefresh] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-6 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading enrichment data...</span>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-6">
        <Database className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>No enrichment data yet. Run research to pull financials, strategy, people, and more.</p>
        <button
          onClick={onRefresh}
          onMouseEnter={() => setHoveredRefresh(true)}
          onMouseLeave={() => setHoveredRefresh(false)}
          className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 mx-auto"
          style={{
            background: hoveredRefresh ? 'var(--accent-hover)' : 'var(--accent)',
            color: 'white',
            transition: 'background 150ms ease',
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>
    );
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-xs font-medium uppercase" style={{ color: 'var(--text-tertiary)' }}>
            {records.length} enriched fields across {sortedCategories.length} categories
          </span>
        </div>
        <button
          onClick={onRefresh}
          onMouseEnter={() => setHoveredRefresh(true)}
          onMouseLeave={() => setHoveredRefresh(false)}
          className="text-xs flex items-center gap-1"
          style={{
            color: hoveredRefresh ? 'var(--text-secondary)' : 'var(--text-muted)',
            transition: 'color 150ms ease',
          }}
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {sortedCategories.map(cat => {
        const catRecords = grouped[cat];
        const isExpanded = expandedCategories.has(cat);
        const catLabel = CATEGORY_LABELS[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
        const catColor = CATEGORY_COLORS[cat] || { bg: 'var(--surface-2)', color: 'var(--text-tertiary)' };
        const avgConfidence = catRecords.reduce((sum, r) => sum + r.confidence, 0) / catRecords.length;

        return (
          <div key={cat} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
            <button
              onClick={() => onToggleCategory(cat)}
              className="w-full flex items-center justify-between px-4 py-3"
              style={{ background: isExpanded ? 'var(--surface-1)' : 'transparent', transition: 'background 150ms ease' }}
              onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--surface-1)'; }}
              onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ background: catColor.bg, color: catColor.color }}
                >
                  {catLabel}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{catRecords.length} field{catRecords.length !== 1 ? 's' : ''}</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: confidenceBg(avgConfidence), color: confidenceColor(avgConfidence) }}
                >
                  {Math.round(avgConfidence * 100)}% avg confidence
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                {isExpanded
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronRight className="w-4 h-4" />
                }
              </div>
            </button>

            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                {catRecords.map(rec => (
                  <div
                    key={rec.id}
                    className="flex items-start gap-3 px-4 py-2.5"
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: hoveredRow === rec.id ? 'var(--surface-1)' : 'transparent',
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={() => setHoveredRow(rec.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                          {rec.field_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: confidenceBg(rec.confidence), color: confidenceColor(rec.confidence) }}
                        >
                          {Math.round(rec.confidence * 100)}%
                        </span>
                      </div>
                      <p className="text-sm break-words" style={{ color: 'var(--text-primary)' }}>
                        {rec.field_value.length > 300 ? rec.field_value.slice(0, 300) + '...' : rec.field_value}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          Source: {rec.source_id}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          Updated: {rec.fetched_at ? new Date(rec.fetched_at).toLocaleDateString() : '---'}
                        </span>
                        {rec.source_url && (
                          <a
                            href={rec.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] flex items-center gap-0.5"
                            style={{ color: 'var(--accent)' }}
                            onClick={e => e.stopPropagation()}
                          >
                            <ExternalLink className="w-2.5 h-2.5" /> Link
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

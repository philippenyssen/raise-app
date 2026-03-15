'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { cachedFetch } from '@/lib/cache';
import { useToast } from '@/components/toast';
import { CopyButton } from '@/components/copy-button';
import {
  MessageCircleWarning, ChevronDown, ChevronRight, Shield, AlertTriangle,
  CheckCircle2, Edit3, Save, X, TrendingUp, TrendingDown, Minus,
  Target, User, BarChart3, ArrowUpRight, ArrowDownRight, Clock, Zap,
  ThumbsUp, ThumbsDown, Activity, Calendar, ExternalLink,
} from 'lucide-react';
import { fmtDate } from '@/lib/format';
import {
  stTextMuted, stTextTertiary, stTextSecondary, stTextPrimary, stAccent, stFontXs,
  stSurface0, stSurface1, stSurface2, stSurface1Border, stBgSuccess, stBgDanger,
  stBgMuted, stAccentBg, stBorderTop, stBorderSubtle, labelMuted10,
} from '@/lib/styles';

interface ObjectionRecord {
  id: string;
  objection_text: string;
  objection_topic: string;
  investor_id: string | null;
  investor_name: string | null;
  meeting_id: string | null;
  response_text: string;
  effectiveness: 'effective' | 'partially_effective' | 'ineffective' | 'unknown';
  next_meeting_enthusiasm_delta: number;
  created_at: string;
  updated_at: string;
}

interface TopicGroup {
  topic: string;
  objections: ObjectionRecord[];
  count: number;
  best_response: ObjectionRecord | null;
  effectiveness_distribution: {
    effective: number;
    partially_effective: number;
    ineffective: number;
    unknown: number;
  };
}

interface PlaybookData {
  playbook: TopicGroup[];
  top_objections: { objection_text: string; objection_topic: string; count: number; has_effective_response: boolean }[];
  unresolved: { objection_text: string; objection_topic: string; count: number; has_effective_response: boolean }[];
  investors: { id: string; name: string }[];
  total_objections: number;
  topics_count: number;
}

interface ResponseEffectivenessEntry {
  response_text: string;
  objection_topic: string;
  objection_text: string;
  investor_name: string | null;
  times_used: number;
  positive_outcomes: number;
  negative_outcomes: number;
  neutral_outcomes: number;
  effectiveness_score: number;
  avg_enthusiasm_delta: number;
  created_at: string;
}

interface TopicEffectiveness {
  topic: string;
  total_raised: number;
  positive_outcomes: number;
  negative_outcomes: number;
  neutral_outcomes: number;
  effectiveness_score: number;
  resolution_rate: number;
  first_seen: string;
  last_seen: string;
  trend: 'improving' | 'declining' | 'stable';
  best_response: string | null;
  worst_response: string | null;
}

interface EffectivenessData {
  topic_effectiveness: TopicEffectiveness[];
  response_leaderboard: ResponseEffectivenessEntry[];
  worst_responses: ResponseEffectivenessEntry[];
  evolution: {
    emergingObjections: { topic: string; firstSeen: string; growthRate: number; currentCount: number }[];
    resolvedObjections: { topic: string; peakCount: number; resolvedDate: string; effectiveResponse: string }[];
    persistentObjections: { topic: string; count: number; duration: number; avgEnthusiasmImpact: number }[];
    objectionHeatMap: { topic: string; week: string; count: number }[];
  };
  summary: {
    total_objections: number;
    total_resolved: number;
    total_effective: number;
    total_ineffective: number;
    overall_resolution_rate: number;
    overall_effectiveness_rate: number;
    topics_count: number;
    responses_count: number;
  };
}

type Tab = 'playbook' | 'effectiveness';

function topicTheme(bg: string, color: string, border: string, dot: string) {
  return { bg: { background: bg }, text: { color }, border: { borderColor: border }, dotColor: dot, textColor: color };
}

const TOPIC_COLORS: Record<string, ReturnType<typeof topicTheme>> = {
  valuation:   topicTheme('var(--accent-8)',  'var(--accent)',         'var(--accent-15)', 'var(--accent)'),
  competition: topicTheme('var(--accent-muted)', 'var(--text-secondary)', 'var(--accent-12)', 'var(--text-secondary)'),
  team:        topicTheme('var(--warn-8)',    'var(--text-tertiary)',  'var(--warn-15)',    'var(--text-tertiary)'),
  execution:   topicTheme('var(--accent-10)', 'var(--accent)',         'var(--accent-20)', 'var(--accent)'),
  financial:   topicTheme('var(--accent-5)',  'var(--text-secondary)', 'var(--accent-10)', 'var(--text-secondary)'),
  market:      topicTheme('var(--accent-8)',  'var(--accent)',         'var(--accent-15)', 'var(--accent)'),
  technical:   topicTheme('var(--warn-6)',    'var(--text-tertiary)',  'var(--warn-12)',    'var(--text-tertiary)'),
  risk:        topicTheme('var(--fg-8)',      'var(--text-primary)',   'var(--fg-15)',      'var(--text-primary)'),
  timing:      topicTheme('var(--warn-8)',    'var(--text-tertiary)',  'var(--warn-15)',    'var(--text-tertiary)'),
  structure:   topicTheme('var(--accent-4)',  'var(--text-secondary)', 'var(--accent-8)',   'var(--text-secondary)'),};

const DEFAULT_TOPIC_COLOR = {
  bg: { background: 'var(--surface-2)' } as React.CSSProperties,
  text: { color: 'var(--text-secondary)' } as React.CSSProperties,
  border: { borderColor: 'var(--border-default)' } as React.CSSProperties,
  dotColor: 'var(--text-secondary)',
  textColor: 'var(--text-secondary)',};

const EFFECTIVENESS_BADGE: Record<string, { style: React.CSSProperties; label: string }> = {
  effective: { style: { background: 'var(--success-muted)', color: 'var(--text-secondary)' }, label: 'Effective' },
  partially_effective: { style: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' }, label: 'Partial' },
  ineffective: { style: { background: 'var(--danger-muted)', color: 'var(--text-primary)' }, label: 'Ineffective' },
  unknown: { style: { background: 'var(--surface-2)', color: 'var(--text-muted)' }, label: 'Unknown' },};

function getTopicColor(topic: string) {
  return TOPIC_COLORS[topic] || DEFAULT_TOPIC_COLOR;
}

function BestResponseCard({ response }: { response: ObjectionRecord }) {
  return (
    <div className="mx-4 mt-3 p-3 rounded-lg" style={{ background: 'var(--success-muted)', border: '1px solid var(--accent-20)' }}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5" style={stTextSecondary} />
          <span className="text-xs font-normal" style={stTextSecondary}>Best Response</span>
          {response.investor_name && (
            <span className="text-xs" style={stTextMuted}>
              (worked with {response.investor_name})</span>
          )}</div>
        <CopyButton text={response.response_text} /></div>
      <p className="text-sm leading-relaxed" style={stTextSecondary}>
        {response.response_text}</p>
    </div>);
}

export default function ObjectionsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('playbook');
  const [data, setData] = useState<PlaybookData | null>(null);
  const [effectivenessData, setEffectivenessData] = useState<EffectivenessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEffectiveness, setLoadingEffectiveness] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editResponse, setEditResponse] = useState('');
  const [editEffectiveness, setEditEffectiveness] = useState('unknown');
  const [saving, setSaving] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState('');
  const [investorObjections, setInvestorObjections] = useState<ObjectionRecord[]>([]);
  const [loadingInvestor, setLoadingInvestor] = useState(false);
  const [expandedLeaderboard, setExpandedLeaderboard] = useState<Set<number>>(new Set());
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cachedFetch('/api/objections');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setData(json);
    } catch { toast('Couldn\'t load objections — try refreshing the page', 'error'); }
    setLoading(false);
  }, []);

  const loadEffectivenessData = useCallback(async () => {
    setLoadingEffectiveness(true);
    try {
      const res = await fetch('/api/objections/effectiveness');
      const json = await res.json();
      setEffectivenessData(json);
    } catch { /* ignore */ }
    setLoadingEffectiveness(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (tab === 'effectiveness' && !effectivenessData) {
      loadEffectivenessData();
    }
  }, [tab, effectivenessData, loadEffectivenessData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingId) setEditingId(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editingId]);

  function toggleTopic(topic: string) {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;});
  }

  function startEdit(obj: ObjectionRecord) {
    setEditingId(obj.id);
    setEditResponse(obj.response_text);
    setEditEffectiveness(obj.effectiveness);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/objections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, response_text: editResponse, effectiveness: editEffectiveness }),});
      if (!res.ok) throw new Error('Failed to save');
      if (editEffectiveness === 'effective') toast('Objection resolved!', 'success');
      setEditingId(null);
      loadData();
      if (effectivenessData) loadEffectivenessData();
    } catch { toast('Couldn\'t save response — check your connection and retry', 'error'); }
    setSaving(false);
  }

  async function loadInvestorObjections(investorId: string) {
    if (!investorId) {
      setInvestorObjections([]);
      return;
    }
    setLoadingInvestor(true);
    try {
      const res = await fetch(`/api/objections?view=investor&investor_id=${investorId}`);
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setInvestorObjections(json);
    } catch { toast('Couldn\'t load investor objections — try refreshing', 'error'); }
    setLoadingInvestor(false);
  }

  function EffectivenessBar({ dist }: { dist: TopicGroup['effectiveness_distribution'] }) {
    const total = dist.effective + dist.partially_effective + dist.ineffective + dist.unknown;
    if (total === 0) return <div className="h-2 rounded-full" style={stSurface2} />;
    const pct = (n: number) => Math.round((n / total) * 100);
    return (
      <div className="flex h-2 rounded-full overflow-hidden" style={stSurface2}>
        {dist.effective > 0 && (
          <div style={{ width: `${pct(dist.effective)}%`, background: 'var(--success)' }} />
        )}
        {dist.partially_effective > 0 && (
          <div style={{ width: `${pct(dist.partially_effective)}%`, background: 'var(--warning)' }} />
        )}
        {dist.ineffective > 0 && (
          <div style={{ width: `${pct(dist.ineffective)}%`, background: 'var(--danger)' }} />
        )}
        {dist.unknown > 0 && (
          <div style={{ width: `${pct(dist.unknown)}%`, background: 'var(--text-muted)' }} />
        )}
      </div>);
  }

  function DeltaIcon({ delta }: { delta: number }) {
    if (delta > 0) return <TrendingUp className="w-3 h-3" style={stTextSecondary} />;
    if (delta < 0) return <TrendingDown className="w-3 h-3" style={stTextPrimary} />;
    return <Minus className="w-3 h-3" style={stTextMuted} />;
  }

  function ScoreBar({ score, size = 'sm' }: { score: number; size?: 'sm' | 'md' }) {
    const color = score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--warning)' : 'var(--danger)';
    const height = size === 'md' ? 'h-2.5' : 'h-1.5';
    return (
      <div className={`flex-1 ${height} rounded-full overflow-hidden`} style={stSurface2}>
        <div style={{ width: `${score}%`, background: color, height: '100%', transition: 'width 300ms ease' }} />
      </div>);
  }

  function TrendBadge({ trend }: { trend: 'improving' | 'declining' | 'stable' }) {
    const config = {
      improving: { icon: ArrowUpRight, color: 'var(--text-secondary)', bg: 'var(--success-muted)', label: 'Improving' },
      declining: { icon: ArrowDownRight, color: 'var(--text-primary)', bg: 'var(--danger-muted)', label: 'Declining' },
      stable: { icon: Minus, color: 'var(--text-muted)', bg: 'var(--surface-2)', label: 'Stable' },
    }[trend];
    const Icon = config.icon;
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs" style={{ background: config.bg, color: config.color }}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>);
  }

  if (loading) {
    return (
      <div className="space-y-6 page-content">
        <div>
          <h1 className="page-title">Objection Playbook</h1>
          <div className="skeleton mt-1" style={{ height: '16px', width: '250px' }} /></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-xl)' }} />
          ))}</div>
      </div>);
  }

  if (!data) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div className="loading-spinner" />
    </div>);

  const { playbook, unresolved, total_objections, investors } = data;

  return (
    <div className="space-y-6 page-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Objection Playbook</h1>
          <p className="text-sm mt-1" style={stTextMuted}>
            {total_objections} objection{total_objections !== 1 ? 's' : ''} tracked across {playbook.length} topic{playbook.length !== 1 ? 's' : ''}
          </p></div>
        <button
          onClick={() => { loadData(); if (effectivenessData) loadEffectivenessData(); }}
          className="btn btn-secondary btn-sm">
          Refresh</button></div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: '1px solid var(--border-default)' }}>
        {([
          { key: 'playbook' as Tab, label: 'Playbook', icon: Shield },
          { key: 'effectiveness' as Tab, label: 'Response Effectiveness', icon: BarChart3 },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2.5 text-sm font-normal flex items-center gap-2"
            style={{
              borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`,
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'color 150ms ease', }}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}</button>
        ))}</div>

      {/* Playbook Tab */}
      {tab === 'playbook' && (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main content -- 3 cols */}
          <div className="xl:col-span-3 space-y-4">
            {playbook.length === 0 ? (
              <div className="rounded-xl p-12 text-center space-y-3" style={stSurface0}>
                <MessageCircleWarning className="w-10 h-10 mx-auto" style={{ color: 'var(--border-default)' }} />
                <p style={stTextMuted}>No objections tracked yet.</p>
                <p className="text-xs" style={stTextMuted}>
                  Log meetings with AI analysis enabled to automatically capture investor objections.</p></div>
            ) : (
              playbook.map((group) => {
                const color = getTopicColor(group.topic);
                const isExpanded = expandedTopics.has(group.topic);

                return (
                  <div key={group.topic} id={`topic-${group.topic}`} className="rounded-xl overflow-hidden" style={{ ...color.border }}>
                    {/* Topic header */}
                    <button
                      onClick={() => toggleTopic(group.topic)}
                      className="w-full flex items-center justify-between p-4 transition-all"
                      style={{ ...color.bg }}>
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" style={color.text} />
                        ) : (
                          <ChevronRight className="w-4 h-4" style={color.text} />
                        )}
                        <span className="text-sm font-normal  tracking-wide" style={color.text}>
                          {group.topic}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ ...stTextMuted, background: 'var(--fg-80)' }}>
                          {group.count} objection{group.count !== 1 ? 's' : ''}</span></div>
                      <div className="flex items-center gap-4">
                        <div className="w-32">
                          <EffectivenessBar dist={group.effectiveness_distribution} /></div>
                        <div className="flex gap-2" style={labelMuted10}>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={stBgSuccess} />
                            {group.effectiveness_distribution.effective}</span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--warning)' }} />
                            {group.effectiveness_distribution.partially_effective}</span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={stBgDanger} />
                            {group.effectiveness_distribution.ineffective}</span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={stBgMuted} />
                            {group.effectiveness_distribution.unknown}</span></div></div></button>

                    {/* Best response highlight */}
                    {isExpanded && group.best_response && (
                      <BestResponseCard response={group.best_response} />
                    )}

                    {/* Individual objections */}
                    {isExpanded && (
                      <div className="p-4 space-y-3">
                        {group.objections.map((obj) => (
                          <div key={obj.id} className="rounded-lg p-3 space-y-2" style={stSurface1}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 space-y-1">
                                <p className="text-sm" style={stTextPrimary}>{obj.objection_text}</p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {obj.investor_name && obj.investor_id && (
                                    <Link
                                      href={`/investors/${obj.investor_id}`}
                                      className="flex items-center gap-1 text-xs transition-colors"
                                      style={{ ...stAccent, textDecoration: 'none' }}
                                      onClick={e => e.stopPropagation()}
                                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}>
                                      <User className="w-3 h-3" />
                                      {obj.investor_name}</Link>
                                  )}
                                  {obj.investor_name && !obj.investor_id && (
                                    <span className="flex items-center gap-1 text-xs" style={stTextMuted}>
                                      <User className="w-3 h-3" />
                                      {obj.investor_name}</span>
                                  )}
                                  <span className="text-xs" style={stTextMuted}>
                                    {fmtDate(obj.created_at)}</span>
                                  <span
                                    className="text-xs px-1.5 py-0.5 rounded"
                                    style={EFFECTIVENESS_BADGE[obj.effectiveness]?.style}>
                                    {EFFECTIVENESS_BADGE[obj.effectiveness]?.label}</span>
                                  {obj.next_meeting_enthusiasm_delta !== 0 && (
                                    <span className="flex items-center gap-1 text-xs">
                                      <DeltaIcon delta={obj.next_meeting_enthusiasm_delta} />
                                      <span style={{ color: obj.next_meeting_enthusiasm_delta > 0 ? 'var(--success)' : 'var(--danger)' }}>
                                        {obj.next_meeting_enthusiasm_delta > 0 ? '+' : ''}{obj.next_meeting_enthusiasm_delta}
                                      </span></span>
                                  )}</div></div>
                              {editingId !== obj.id && (
                                <button
                                  onClick={() => startEdit(obj)}
                                  className="p-1.5 rounded transition-colors shrink-0" style={stTextMuted}
                                  title="Edit response">
                                  <Edit3 className="w-3.5 h-3.5" /></button>
                              )}</div>

                            {/* Response display or edit */}
                            {editingId === obj.id ? (
                              <div className="space-y-2 pt-1">
                                <textarea
                                  value={editResponse}
                                  onChange={e => setEditResponse(e.target.value)}
                                  rows={3}
                                  placeholder="What response worked or would work for this objection?"
                                  className="input"/>
                                <div className="flex items-center gap-3">
                                  <select
                                    value={editEffectiveness}
                                    onChange={e => setEditEffectiveness(e.target.value)}
                                    className="input"
                                    style={{ width: 'auto', ...stFontXs, padding: '0.375rem 0.5rem' }}>
                                    <option value="unknown">Unknown</option>
                                    <option value="effective">Effective</option>
                                    <option value="partially_effective">Partially Effective</option>
                                    <option value="ineffective">Ineffective</option></select>
                                  <button
                                    onClick={() => saveEdit(obj.id)}
                                    disabled={saving}
                                    className="btn btn-primary btn-sm">
                                    <Save className="w-3 h-3" />
                                    {saving ? 'Saving...' : 'Save'}</button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="btn btn-ghost btn-sm">
                                    <X className="w-3.5 h-3.5" /></button></div></div>
                            ) : obj.response_text ? (
                              <div className="pt-1" style={stBorderTop}>
                                <p className="text-xs mb-0.5" style={stTextMuted}>Response:</p>
                                <p className="text-sm leading-relaxed" style={stTextTertiary}>{obj.response_text}</p></div>
                            ) : null}</div>
                        ))}</div>
                    )}
                  </div>);})
            )}</div>

          {/* Sidebar -- 1 col */}
          <div className="space-y-4">
            {/* Top Unresolved */}
            <div className="rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={stTextTertiary} />
                <h3 className="text-xs font-normal  tracking-wide" style={stTextTertiary}>Top Unresolved</h3></div>
              {unresolved.length === 0 ? (
                <p className="text-xs" style={stTextMuted}>All objections have effective responses.</p>
              ) : (
                <div className="space-y-2">
                  {unresolved.map((obj, i) => {
                    const color = getTopicColor(obj.objection_topic);
                    return (
                      <div key={i} className="p-2 rounded-lg space-y-1" style={stSurface1}>
                        <p className="text-xs line-clamp-2" style={stTextSecondary}>{obj.objection_text}</p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="px-1.5 py-0.5 rounded"
                              style={{ fontSize: 'var(--font-size-xs)', ...color.bg, ...color.text }}>
                              {obj.objection_topic}</span>
                            <span style={labelMuted10}>{obj.count}x raised</span></div>
                          <button
                            className="transition-colors"
                            onClick={() => {
                              setExpandedTopics(prev => new Set([...prev, obj.objection_topic]));
                              document.getElementById(`topic-${obj.objection_topic}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 400,
                              color: 'var(--accent)',
                              padding: '1px 4px',
                              borderRadius: 'var(--radius-sm)',
                              whiteSpace: 'nowrap', }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}>
                            Fix →</button></div>
                      </div>);
                  })}</div>
              )}</div>

            {/* Effectiveness summary */}
            <div className="rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" style={stAccent} />
                <h3 className="text-xs font-normal  tracking-wide" style={stTextTertiary}>Coverage</h3></div>
              {playbook.length === 0 ? (
                <p className="text-xs" style={stTextMuted}>No data yet.</p>
              ) : (
                <div className="space-y-2">
                  {playbook.map((group) => {
                    const total = group.count;
                    const resolved = group.effectiveness_distribution.effective + group.effectiveness_distribution.partially_effective;
                    const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;
                    const color = getTopicColor(group.topic);
                    const barColor = pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
                    return (
                      <div key={group.topic} className="flex items-center gap-2">
                        <span className="w-20 truncate" style={{ fontSize: 'var(--font-size-xs)', ...color.text }}>{group.topic}</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={stSurface2}>
                          <div
                            style={{ width: `${pct}%`, background: barColor, height: '100%' }}/></div>
                        <span className="w-8 text-right" style={labelMuted10}>{pct}%</span>
                      </div>);
                  })}</div>
              )}</div>

            {/* Meeting Prep */}
            <div className="rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" style={stTextTertiary} />
                <h3 className="text-xs font-normal  tracking-wide" style={stTextTertiary}>Meeting Prep</h3></div>
              <p className="text-xs" style={stTextMuted}>Select an investor to see their objection history and what worked with similar investors.</p>
              <select
                value={selectedInvestor}
                onChange={e => {
                  setSelectedInvestor(e.target.value);
                  loadInvestorObjections(e.target.value); }}
                className="input"
                style={{ ...stFontXs, padding: '0.375rem 0.5rem' }}>
                <option value="">Select investor...</option>
                {investors.map(inv => (
                  <option key={inv.id} value={inv.id}>{inv.name}</option>
                ))}</select>

              {loadingInvestor && (
                <div className="skeleton" style={{ height: '16px', width: '160px' }} />
              )}

              {selectedInvestor && !loadingInvestor && investorObjections.length === 0 && (
                <p className="text-xs" style={stTextMuted}>No objections recorded for this investor.</p>
              )}

              {selectedInvestor && !loadingInvestor && investorObjections.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className=" tracking-wide" style={labelMuted10}>
                      {investorObjections.length} objection{investorObjections.length !== 1 ? 's' : ''} from this investor</p>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/meetings/prep?investor=${selectedInvestor}`}
                        className="flex items-center gap-1 transition-colors"
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 400,
                          color: 'var(--accent)',
                          textDecoration: 'none',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--accent-muted)', }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-8)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-muted)'; }}>
                        <Calendar className="w-3 h-3" />
                        Prep</Link>
                      <Link
                        href={`/investors/${selectedInvestor}`}
                        className="flex items-center gap-1 transition-colors"
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 400,
                          color: 'var(--text-muted)',
                          textDecoration: 'none',
                          padding: '2px 6px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface-2)', }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}>
                        <ExternalLink className="w-3 h-3" />
                        Profile</Link></div></div>
                  {investorObjections.map((obj) => {
                    const color = getTopicColor(obj.objection_topic);
                    const effBadge = EFFECTIVENESS_BADGE[obj.effectiveness];
                    return (
                      <div key={obj.id} className="p-2 rounded-lg space-y-1" style={stSurface1}>
                        <p className="text-xs line-clamp-2" style={stTextSecondary}>{obj.objection_text}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="px-1 py-0.5 rounded"
                            style={{ fontSize: 'var(--font-size-xs)', ...color.bg, ...color.text }}>
                            {obj.objection_topic}</span>
                          <span
                            className="px-1 py-0.5 rounded"
                            style={{ fontSize: 'var(--font-size-xs)', ...effBadge.style }}>
                            {effBadge.label}</span></div>
                        {obj.response_text && (
                          <p className="leading-relaxed mt-1" style={labelMuted10}>
                            Response: {obj.response_text}</p>
                        )}
                      </div>);
                  })}

                  {/* Show what worked with similar objection topics */}
                  {(() => {
                    const investorTopics = [...new Set(investorObjections.map(o => o.objection_topic))];
                    const bestFromPlaybook = playbook
                      .filter(g => investorTopics.includes(g.topic) && g.best_response)
                      .map(g => ({ topic: g.topic, response: g.best_response! }));

                    if (bestFromPlaybook.length === 0) return null;

                    return (
                      <div className="mt-3 pt-3 space-y-2" style={stBorderTop}>
                        <p className=" tracking-wide flex items-center gap-1" style={labelMuted10}>
                          <CheckCircle2 className="w-3 h-3" style={stTextSecondary} />
                          What worked with similar investors</p>
                        {bestFromPlaybook.map(({ topic, response }) => {
                          const color = getTopicColor(topic);
                          return (
                            <div key={topic} className="p-2 rounded-lg space-y-1" style={{ background: 'var(--success-muted)', border: '1px solid var(--accent-15)' }}>
                              <span
                                className="px-1 py-0.5 rounded"
                                style={{ fontSize: 'var(--font-size-xs)', ...color.bg, ...color.text }}>
                                {topic}</span>
                              <p className="text-xs leading-relaxed" style={stTextTertiary}>{response.response_text}</p>
                              {response.investor_name && (
                                <p style={labelMuted10}>
                                  Worked with {response.investor_name}</p>
                              )}
                            </div>);
                        })}
                      </div>);
                  })()}</div>
              )}</div></div></div>
      )}

      {/* Response Effectiveness Tab */}
      {tab === 'effectiveness' && (
        <EffectivenessTab
          data={effectivenessData}
          loading={loadingEffectiveness}
          expandedLeaderboard={expandedLeaderboard}
          setExpandedLeaderboard={setExpandedLeaderboard}
          hoveredRow={hoveredRow}
          setHoveredRow={setHoveredRow}
          ScoreBar={ScoreBar}
          TrendBadge={TrendBadge}
          getTopicColor={getTopicColor}/>
      )}
    </div>);
}

// ─────────────────────────────────────────────
// Effectiveness Tab Component
// ─────────────────────────────────────────────

function EffectivenessTab({
  data,
  loading,
  expandedLeaderboard,
  setExpandedLeaderboard,
  hoveredRow,
  setHoveredRow,
  ScoreBar,
  TrendBadge,
  getTopicColor: getColor,
}: {
  data: EffectivenessData | null;
  loading: boolean;
  expandedLeaderboard: Set<number>;
  setExpandedLeaderboard: React.Dispatch<React.SetStateAction<Set<number>>>;
  hoveredRow: string | null;
  setHoveredRow: React.Dispatch<React.SetStateAction<string | null>>;
  ScoreBar: React.ComponentType<{ score: number; size?: 'sm' | 'md' }>;
  TrendBadge: React.ComponentType<{ trend: 'improving' | 'declining' | 'stable' }>;
  getTopicColor: typeof getTopicColorFn;
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton" style={{ height: '96px', borderRadius: 'var(--radius-xl)' }} />
        ))}
      </div>);
  }

  if (!data) {
    return (
      <div className="rounded-xl p-12 text-center space-y-3" style={stSurface0}>
        <BarChart3 className="w-10 h-10 mx-auto" style={{ color: 'var(--border-default)' }} />
        <p style={stTextMuted}>No effectiveness data available.</p>
      </div>);
  }

  const { topic_effectiveness, response_leaderboard, worst_responses, evolution, summary } = data;

  function toggleLeaderboardItem(idx: number) {
    setExpandedLeaderboard(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;});
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-4" style={stSurface1}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ ...stAccentBg }}>
              <Activity className="w-3.5 h-3.5" style={stAccent} /></span>
            <p className="text-xs  tracking-wide" style={stTextMuted}>Total Tracked</p></div>
          <p className="text-2xl font-normal" style={stTextPrimary}>{summary.total_objections}</p>
          <p className="text-xs mt-1" style={stTextMuted}>{summary.topics_count} topics, {summary.responses_count} responses</p>
        </div>

        <div className="rounded-xl p-4" style={stSurface1}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--success-muted)' }}>
              <CheckCircle2 className="w-3.5 h-3.5" style={stTextSecondary} /></span>
            <p className="text-xs  tracking-wide" style={stTextMuted}>Resolution Rate</p></div>
          <p className="text-2xl font-normal" style={stTextPrimary}>{summary.overall_resolution_rate}%</p>
          <p className="text-xs mt-1" style={stTextMuted}>{summary.total_resolved} of {summary.total_objections} resolved</p>
        </div>

        <div className="rounded-xl p-4" style={stSurface1}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--success-muted)' }}>
              <ThumbsUp className="w-3.5 h-3.5" style={stTextSecondary} /></span>
            <p className="text-xs  tracking-wide" style={stTextMuted}>Effective</p></div>
          <p className="text-2xl font-normal" style={stTextSecondary}>{summary.total_effective}</p>
          <p className="text-xs mt-1" style={stTextMuted}>{summary.overall_effectiveness_rate}% of all objections</p></div>

        <div className="rounded-xl p-4" style={stSurface1}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--danger-muted)' }}>
              <ThumbsDown className="w-3.5 h-3.5" style={stTextPrimary} /></span>
            <p className="text-xs  tracking-wide" style={stTextMuted}>Ineffective</p></div>
          <p className="text-2xl font-normal" style={stTextPrimary}>{summary.total_ineffective}</p>
          <p className="text-xs mt-1" style={stTextMuted}>Responses that need rework</p></div></div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main content -- 2 cols */}
        <div className="xl:col-span-2 space-y-6">
          {/* Topic Effectiveness Rankings */}
          <div className="rounded-xl overflow-hidden">
            <div className="p-4 flex items-center gap-2" style={stSurface1Border}>
              <Target className="w-4 h-4" style={stAccent} />
              <h3 className="text-sm font-normal" style={stTextPrimary}>Effectiveness by Topic</h3></div>
            <div className="divide-y" style={stBorderSubtle}>
              {topic_effectiveness.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm" style={stTextMuted}>No topic data available yet.</p></div>
              ) : (
                topic_effectiveness.map((te) => {
                  const color = getColor(te.topic);
                  return (
                    <div
                      key={te.topic}
                      className="p-4 space-y-3 transition-colors"
                      style={{
                        background: hoveredRow === `topic-${te.topic}` ? 'var(--surface-1)' : 'transparent',
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 100ms ease', }}
                      onMouseEnter={() => setHoveredRow(`topic-${te.topic}`)}
                      onMouseLeave={() => setHoveredRow(null)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className="text-xs font-normal  tracking-wide px-2 py-1 rounded"
                            style={{ ...color.bg, ...color.text }}>
                            {te.topic}</span>
                          <span className="text-xs" style={stTextMuted}>
                            {te.total_raised} raised</span></div>
                        <div className="flex items-center gap-3">
                          <TrendBadge trend={te.trend} />
                          <span className="text-sm font-normal" style={{ color: te.effectiveness_score >= 50 ? 'var(--success)' : te.effectiveness_score >= 25 ? 'var(--warning)' : 'var(--danger)' }}>
                            {te.effectiveness_score}%</span></div></div>

                      <div className="flex items-center gap-3">
                        <ScoreBar score={te.effectiveness_score} size="md" /></div>

                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={stBgSuccess} />
                          <span className="text-xs" style={stTextMuted}>{te.positive_outcomes} positive</span></div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={stBgDanger} />
                          <span className="text-xs" style={stTextMuted}>{te.negative_outcomes} negative</span></div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={stBgMuted} />
                          <span className="text-xs" style={stTextMuted}>{te.neutral_outcomes} neutral</span></div>
                        <span className="text-xs" style={stTextMuted}>|</span>
                        <span className="text-xs" style={stTextMuted}>
                          Resolution: {te.resolution_rate}%</span></div>

                      {/* Timeline */}
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3" style={stTextMuted} />
                        <span className="text-xs" style={stTextMuted}>
                          First seen {fmtDate(te.first_seen)} &mdash; Last seen {fmtDate(te.last_seen)}</span></div>

                      {/* Best / worst response */}
                      {te.best_response && (
                        <div className="p-2 rounded-lg" style={{ background: 'var(--success-muted)', border: '1px solid var(--accent-15)' }}>
                          <div className="flex items-center gap-1 mb-1">
                            <ThumbsUp className="w-3 h-3" style={stTextSecondary} />
                            <span className="text-xs font-normal" style={stTextSecondary}>Best response</span></div>
                          <p className="text-xs leading-relaxed line-clamp-2" style={stTextSecondary}>{te.best_response}</p></div>
                      )}
                      {te.worst_response && (
                        <div className="p-2 rounded-lg" style={{ background: 'var(--danger-muted)', border: '1px solid var(--accent-8)' }}>
                          <div className="flex items-center gap-1 mb-1">
                            <ThumbsDown className="w-3 h-3" style={stTextPrimary} />
                            <span className="text-xs font-normal" style={stTextPrimary}>Worst response</span></div>
                          <p className="text-xs leading-relaxed line-clamp-2" style={stTextSecondary}>{te.worst_response}</p>
                        </div>
                      )}
                    </div>);})
              )}</div></div>

          {/* Response Leaderboard */}
          <div className="rounded-xl overflow-hidden">
            <div className="p-4 flex items-center gap-2" style={stSurface1Border}>
              <Zap className="w-4 h-4" style={stTextSecondary} />
              <h3 className="text-sm font-normal" style={stTextPrimary}>Top Performing Responses</h3>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ ...stSurface2, ...stTextMuted }}>
                {response_leaderboard.length}</span></div>
            {response_leaderboard.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm" style={stTextMuted}>No responses with outcome data yet.</p></div>
            ) : (
              <div>
                {response_leaderboard.slice(0, 10).map((entry, idx) => {
                  const color = getColor(entry.objection_topic);
                  const isExpanded = expandedLeaderboard.has(idx);
                  return (
                    <div
                      key={idx}
                      className="border-b last:border-b-0" style={stBorderSubtle}>
                      <button
                        onClick={() => toggleLeaderboardItem(idx)}
                        className="w-full p-3 flex items-center gap-3 text-left transition-colors"
                        style={{
                          background: hoveredRow === `leader-${idx}` ? 'var(--surface-1)' : 'transparent',
                          transition: 'background 100ms ease', }}
                        onMouseEnter={() => setHoveredRow(`leader-${idx}`)}
                        onMouseLeave={() => setHoveredRow(null)}>
                        <span className="text-xs font-normal w-6 text-center" style={stTextMuted}>
                          #{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate" style={stTextPrimary}>{entry.response_text}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="px-1 py-0.5 rounded" style={{ fontSize: 'var(--font-size-xs)', ...color.bg, ...color.text }}>
                              {entry.objection_topic}</span>
                            {entry.investor_name && (
                              <span style={labelMuted10}>
                                {entry.investor_name}</span>
                            )}
                            <span style={labelMuted10}>
                              Used {entry.times_used}x</span></div></div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className="text-sm font-normal"
                            style={{ color: entry.effectiveness_score >= 50 ? 'var(--success)' : entry.effectiveness_score >= 25 ? 'var(--warning)' : 'var(--danger)' }}>
                            {entry.effectiveness_score}%</span>
                          <span className="flex items-center gap-1 text-xs" style={{ color: entry.avg_enthusiasm_delta >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {entry.avg_enthusiasm_delta >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {entry.avg_enthusiasm_delta >= 0 ? '+' : ''}{entry.avg_enthusiasm_delta}</span>
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" style={stTextMuted} />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" style={stTextMuted} />
                          )}</div></button>
                      {isExpanded && (
                        <div className="px-3 pb-3 pl-12 space-y-2">
                          <div className="p-3 rounded-lg space-y-2" style={stSurface1}>
                            <p className="text-xs" style={stTextMuted}>Objection:</p>
                            <p className="text-sm" style={stTextSecondary}>{entry.objection_text}</p>
                            <p className="text-xs mt-2" style={stTextMuted}>Full response:</p>
                            <p className="text-sm leading-relaxed" style={stTextPrimary}>{entry.response_text}</p>
                            <div className="flex items-center justify-between pt-2" style={stBorderTop}>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full" style={stBgSuccess} />
                                  <span className="text-xs" style={stTextMuted}>{entry.positive_outcomes} positive</span></div>
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full" style={stBgDanger} />
                                  <span className="text-xs" style={stTextMuted}>{entry.negative_outcomes} negative</span></div>
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full" style={stBgMuted} />
                                  <span className="text-xs" style={stTextMuted}>{entry.neutral_outcomes} neutral</span></div>
                              </div>
                              <CopyButton text={entry.response_text} /></div></div></div>
                      )}
                    </div>);
                })}</div>
            )}</div>

          {/* Worst Performing Responses */}
          {worst_responses.length > 0 && worst_responses.some(r => r.effectiveness_score < 50) && (
            <div className="rounded-xl overflow-hidden">
              <div className="p-4 flex items-center gap-2" style={{ background: 'var(--danger-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                <AlertTriangle className="w-4 h-4" style={stTextPrimary} />
                <h3 className="text-sm font-normal" style={stTextPrimary}>Responses Needing Rework</h3></div>
              <div>
                {worst_responses.filter(r => r.effectiveness_score < 50).slice(0, 5).map((entry, idx) => {
                  const color = getColor(entry.objection_topic);
                  return (
                    <div
                      key={idx}
                      className="p-3 space-y-2 transition-colors"
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: hoveredRow === `worst-${idx}` ? 'var(--surface-1)' : 'transparent',
                        transition: 'background 100ms ease', }}
                      onMouseEnter={() => setHoveredRow(`worst-${idx}`)}
                      onMouseLeave={() => setHoveredRow(null)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-1 py-0.5 rounded" style={{ fontSize: 'var(--font-size-xs)', ...color.bg, ...color.text }}>
                            {entry.objection_topic}</span>
                          <span className="text-xs" style={stTextMuted}>Used {entry.times_used}x</span></div>
                        <span className="text-sm font-normal" style={stTextPrimary}>
                          {entry.effectiveness_score}%</span></div>
                      <p className="text-xs" style={stTextMuted}>Objection: {entry.objection_text}</p>
                      <p className="text-sm" style={stTextSecondary}>{entry.response_text}</p>
                      <div className="flex items-center gap-1 text-xs" style={stTextPrimary}>
                        <TrendingDown className="w-3 h-3" />
                        <span>Avg delta: {entry.avg_enthusiasm_delta >= 0 ? '+' : ''}{entry.avg_enthusiasm_delta}</span></div>
                    </div>);
                })}</div></div>
          )}</div>

        {/* Sidebar -- 1 col */}
        <div className="space-y-4">
          {/* Objection Evolution */}
          {evolution.emergingObjections.length > 0 && (
            <div className="rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={stTextTertiary} />
                <h3 className="text-xs font-normal  tracking-wide" style={stTextTertiary}>Emerging</h3></div>
              <div className="space-y-2">
                {evolution.emergingObjections.map((obj, i) => {
                  const color = getColor(obj.topic);
                  return (
                    <div key={i} className="p-2 rounded-lg space-y-1" style={stSurface1}>
                      <div className="flex items-center justify-between">
                        <span className="px-1.5 py-0.5 rounded" style={{ fontSize: 'var(--font-size-xs)', ...color.bg, ...color.text }}>
                          {obj.topic}</span>
                        <span className="text-xs font-normal" style={stTextTertiary}>
                          {obj.currentCount}x</span></div>
                      <p className="text-xs" style={stTextMuted}>
                        Since {fmtDate(obj.firstSeen)} &middot; {obj.growthRate}/wk</p>
                    </div>);
                })}</div></div>
          )}

          {/* Resolved Objections */}
          {evolution.resolvedObjections.length > 0 && (
            <div className="rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" style={stTextSecondary} />
                <h3 className="text-xs font-normal  tracking-wide" style={stTextTertiary}>Resolved</h3></div>
              <div className="space-y-2">
                {evolution.resolvedObjections.map((obj, i) => {
                  const color = getColor(obj.topic);
                  return (
                    <div key={i} className="p-2 rounded-lg space-y-1" style={stSurface1}>
                      <div className="flex items-center justify-between">
                        <span className="px-1.5 py-0.5 rounded" style={{ fontSize: 'var(--font-size-xs)', ...color.bg, ...color.text }}>
                          {obj.topic}</span>
                        <span className="text-xs" style={stTextSecondary}>
                          Resolved</span></div>
                      <p className="text-xs" style={stTextMuted}>
                        Peak: {obj.peakCount}/wk &middot; Last: {fmtDate(obj.resolvedDate)}</p>
                      {obj.effectiveResponse && (
                        <p className="text-xs leading-relaxed line-clamp-2" style={stTextTertiary}>
                          {obj.effectiveResponse}</p>
                      )}
                    </div>);
                })}</div></div>
          )}

          {/* Persistent Objections */}
          {evolution.persistentObjections.length > 0 && (
            <div className="rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={stTextPrimary} />
                <h3 className="text-xs font-normal  tracking-wide" style={stTextTertiary}>Persistent</h3></div>
              <div className="space-y-2">
                {evolution.persistentObjections.map((obj, i) => {
                  const color = getColor(obj.topic);
                  return (
                    <div key={i} className="p-2 rounded-lg space-y-1" style={stSurface1}>
                      <div className="flex items-center justify-between">
                        <span className="px-1.5 py-0.5 rounded" style={{ fontSize: 'var(--font-size-xs)', ...color.bg, ...color.text }}>
                          {obj.topic}</span>
                        <span className="text-xs font-normal" style={stTextPrimary}>
                          {obj.count}x over {Math.round(obj.duration)}wk</span></div>
                      {obj.avgEnthusiasmImpact > 0 && (
                        <p className="text-xs" style={stTextPrimary}>
                          Enthusiasm impact: -{obj.avgEnthusiasmImpact}</p>
                      )}
                    </div>);
                })}</div></div>
          )}

          {/* Heat Map (simplified week view) */}
          {evolution.objectionHeatMap.length > 0 && (
            <div className="rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" style={stAccent} />
                <h3 className="text-xs font-normal  tracking-wide" style={stTextTertiary}>Activity by Week</h3></div>
              {(() => {
                // Group by week, show last 8 weeks max
                const weekMap = new Map<string, number>();
                for (const entry of evolution.objectionHeatMap) {
                  weekMap.set(entry.week, (weekMap.get(entry.week) || 0) + entry.count);
                }
                const weeks = Array.from(weekMap.entries())
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .slice(-8);

                if (weeks.length === 0) return null;

                const maxCount = Math.max(...weeks.map(([, c]) => c));

                return (
                  <div className="space-y-1">
                    {weeks.map(([week, count]) => {
                      const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                      return (
                        <div key={week} className="flex items-center gap-2">
                          <span className="w-14 text-right shrink-0" style={labelMuted10}>
                            {week}</span>
                          <div className="flex-1 h-3 rounded overflow-hidden" style={stSurface2}>
                            <div
                              className="h-full rounded"
                              style={{ width: `${pct}%`, background: 'var(--accent)', transition: 'width 300ms ease' }} /></div>
                          <span className="w-6 text-right" style={labelMuted10}>
                            {count}</span>
                        </div>);
                    })}
                  </div>);
              })()}</div>
          )}

          {/* Resolution Rate by Topic */}
          <div className="rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" style={stAccent} />
              <h3 className="text-xs font-normal  tracking-wide" style={stTextTertiary}>Resolution Rate</h3></div>
            {topic_effectiveness.length === 0 ? (
              <p className="text-xs" style={stTextMuted}>No data yet.</p>
            ) : (
              <div className="space-y-2">
                {topic_effectiveness
                  .sort((a, b) => b.resolution_rate - a.resolution_rate)
                  .map((te) => {
                    const color = getColor(te.topic);
                    const barColor = te.resolution_rate >= 75 ? 'var(--success)' : te.resolution_rate >= 50 ? 'var(--warning)' : 'var(--danger)';
                    return (
                      <div key={te.topic} className="flex items-center gap-2">
                        <span className="w-20 truncate" style={{ fontSize: 'var(--font-size-xs)', ...color.text }}>{te.topic}</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={stSurface2}>
                          <div style={{ width: `${te.resolution_rate}%`, background: barColor, height: '100%' }} /></div>
                        <span className="w-8 text-right" style={labelMuted10}>{te.resolution_rate}%</span>
                      </div>);
                  })}</div>
            )}</div></div></div>
    </div>);
}

// Helper alias for type compatibility in the EffectivenessTab component
const getTopicColorFn = getTopicColor;

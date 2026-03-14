'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  MessageCircleWarning, ChevronDown, ChevronRight, Shield, AlertTriangle,
  CheckCircle2, HelpCircle, Edit3, Save, X, TrendingUp, TrendingDown, Minus,
  Target, User
} from 'lucide-react';

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

const TOPIC_COLORS: Record<string, { bg: React.CSSProperties; text: React.CSSProperties; border: React.CSSProperties; dotColor: string; textColor: string }> = {
  valuation: {
    bg: { background: 'rgba(147, 51, 234, 0.15)' },
    text: { color: '#c084fc' },
    border: { borderColor: 'rgba(126, 34, 206, 0.35)' },
    dotColor: '#c084fc',
    textColor: '#c084fc',
  },
  competition: {
    bg: { background: 'rgba(234, 88, 12, 0.15)' },
    text: { color: '#fb923c' },
    border: { borderColor: 'rgba(194, 65, 12, 0.35)' },
    dotColor: '#fb923c',
    textColor: '#fb923c',
  },
  team: {
    bg: { background: 'rgba(6, 182, 212, 0.15)' },
    text: { color: '#22d3ee' },
    border: { borderColor: 'rgba(14, 116, 144, 0.35)' },
    dotColor: '#22d3ee',
    textColor: '#22d3ee',
  },
  execution: {
    bg: { background: 'rgba(202, 138, 4, 0.15)' },
    text: { color: '#facc15' },
    border: { borderColor: 'rgba(161, 98, 7, 0.35)' },
    dotColor: '#facc15',
    textColor: '#facc15',
  },
  financial: {
    bg: { background: 'rgba(22, 163, 74, 0.15)' },
    text: { color: '#4ade80' },
    border: { borderColor: 'rgba(21, 128, 61, 0.35)' },
    dotColor: '#4ade80',
    textColor: '#4ade80',
  },
  market: {
    bg: { background: 'rgba(37, 99, 235, 0.15)' },
    text: { color: '#60a5fa' },
    border: { borderColor: 'rgba(30, 64, 175, 0.35)' },
    dotColor: '#60a5fa',
    textColor: '#60a5fa',
  },
  technical: {
    bg: { background: 'rgba(79, 70, 229, 0.15)' },
    text: { color: '#818cf8' },
    border: { borderColor: 'rgba(55, 48, 163, 0.35)' },
    dotColor: '#818cf8',
    textColor: '#818cf8',
  },
  risk: {
    bg: { background: 'rgba(220, 38, 38, 0.15)' },
    text: { color: '#f87171' },
    border: { borderColor: 'rgba(153, 27, 27, 0.35)' },
    dotColor: '#f87171',
    textColor: '#f87171',
  },
  timing: {
    bg: { background: 'rgba(217, 119, 6, 0.15)' },
    text: { color: '#fbbf24' },
    border: { borderColor: 'rgba(146, 64, 14, 0.35)' },
    dotColor: '#fbbf24',
    textColor: '#fbbf24',
  },
  structure: {
    bg: { background: 'rgba(13, 148, 136, 0.15)' },
    text: { color: '#2dd4bf' },
    border: { borderColor: 'rgba(15, 118, 110, 0.35)' },
    dotColor: '#2dd4bf',
    textColor: '#2dd4bf',
  },
};

const DEFAULT_TOPIC_COLOR = {
  bg: { background: 'var(--surface-2)' } as React.CSSProperties,
  text: { color: 'var(--text-secondary)' } as React.CSSProperties,
  border: { borderColor: 'var(--border-default)' } as React.CSSProperties,
  dotColor: 'var(--text-secondary)',
  textColor: 'var(--text-secondary)',
};

const SEVERITY_BADGE: Record<string, React.CSSProperties> = {
  showstopper: { background: 'var(--danger-muted)', color: 'var(--danger)' },
  significant: { background: 'var(--warning-muted)', color: 'var(--warning)' },
  minor: { background: 'var(--surface-2)', color: 'var(--text-muted)' },
};

const EFFECTIVENESS_BADGE: Record<string, { style: React.CSSProperties; label: string }> = {
  effective: { style: { background: 'var(--success-muted)', color: 'var(--success)' }, label: 'Effective' },
  partially_effective: { style: { background: 'var(--warning-muted)', color: 'var(--warning)' }, label: 'Partial' },
  ineffective: { style: { background: 'var(--danger-muted)', color: 'var(--danger)' }, label: 'Ineffective' },
  unknown: { style: { background: 'var(--surface-2)', color: 'var(--text-muted)' }, label: 'Unknown' },
};

function getTopicColor(topic: string) {
  return TOPIC_COLORS[topic] || DEFAULT_TOPIC_COLOR;
}

export default function ObjectionsPage() {
  const [data, setData] = useState<PlaybookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editResponse, setEditResponse] = useState('');
  const [editEffectiveness, setEditEffectiveness] = useState('unknown');
  const [saving, setSaving] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState('');
  const [investorObjections, setInvestorObjections] = useState<ObjectionRecord[]>([]);
  const [loadingInvestor, setLoadingInvestor] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/objections');
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleTopic(topic: string) {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  }

  function startEdit(obj: ObjectionRecord) {
    setEditingId(obj.id);
    setEditResponse(obj.response_text);
    setEditEffectiveness(obj.effectiveness);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    await fetch('/api/objections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, response_text: editResponse, effectiveness: editEffectiveness }),
    });
    setEditingId(null);
    setSaving(false);
    loadData();
  }

  async function loadInvestorObjections(investorId: string) {
    if (!investorId) {
      setInvestorObjections([]);
      return;
    }
    setLoadingInvestor(true);
    const res = await fetch(`/api/objections?view=investor&investor_id=${investorId}`);
    const json = await res.json();
    setInvestorObjections(json);
    setLoadingInvestor(false);
  }

  function EffectivenessBar({ dist }: { dist: TopicGroup['effectiveness_distribution'] }) {
    const total = dist.effective + dist.partially_effective + dist.ineffective + dist.unknown;
    if (total === 0) return <div className="h-2 rounded-full" style={{ background: 'var(--surface-2)' }} />;
    const pct = (n: number) => Math.round((n / total) * 100);
    return (
      <div className="flex h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
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
      </div>
    );
  }

  function DeltaIcon({ delta }: { delta: number }) {
    if (delta > 0) return <TrendingUp className="w-3 h-3" style={{ color: 'var(--success)' }} />;
    if (delta < 0) return <TrendingDown className="w-3 h-3" style={{ color: 'var(--danger)' }} />;
    return <Minus className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Objection Playbook</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-xl animate-pulse" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { playbook, unresolved, total_objections, investors } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#d97706' }}>
              <MessageCircleWarning className="w-4.5 h-4.5" style={{ color: '#ffffff' }} />
            </span>
            Objection Playbook
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {total_objections} objection{total_objections !== 1 ? 's' : ''} tracked across {playbook.length} topic{playbook.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={loadData}
          className="btn btn-secondary btn-sm"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main content — 3 cols */}
        <div className="xl:col-span-3 space-y-4">
          {playbook.length === 0 ? (
            <div className="rounded-xl p-12 text-center space-y-3" style={{ border: '1px solid var(--border-subtle)', background: 'var(--surface-0)' }}>
              <MessageCircleWarning className="w-10 h-10 mx-auto" style={{ color: 'var(--border-default)' }} />
              <p style={{ color: 'var(--text-muted)' }}>No objections tracked yet.</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Log meetings with AI analysis enabled to automatically capture investor objections.
              </p>
            </div>
          ) : (
            playbook.map((group) => {
              const color = getTopicColor(group.topic);
              const isExpanded = expandedTopics.has(group.topic);

              return (
                <div key={group.topic} className="rounded-xl overflow-hidden" style={{ border: '1px solid', ...color.border }}>
                  {/* Topic header */}
                  <button
                    onClick={() => toggleTopic(group.topic)}
                    className="w-full flex items-center justify-between p-4 transition-all"
                    style={{ ...color.bg }}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" style={color.text} />
                      ) : (
                        <ChevronRight className="w-4 h-4" style={color.text} />
                      )}
                      <span className="text-sm font-semibold uppercase tracking-wide" style={color.text}>
                        {group.topic}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: 'var(--text-muted)', background: 'rgba(24, 24, 28, 0.8)' }}>
                        {group.count} objection{group.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32">
                        <EffectivenessBar dist={group.effectiveness_distribution} />
                      </div>
                      <div className="flex gap-2" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--success)' }} />
                          {group.effectiveness_distribution.effective}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--warning)' }} />
                          {group.effectiveness_distribution.partially_effective}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--danger)' }} />
                          {group.effectiveness_distribution.ineffective}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--text-muted)' }} />
                          {group.effectiveness_distribution.unknown}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Best response highlight */}
                  {isExpanded && group.best_response && (
                    <div className="mx-4 mt-3 p-3 rounded-lg" style={{ background: 'var(--success-muted)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
                        <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>Best Response</span>
                        {group.best_response.investor_name && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            (worked with {group.best_response.investor_name})
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {group.best_response.response_text}
                      </p>
                    </div>
                  )}

                  {/* Individual objections */}
                  {isExpanded && (
                    <div className="p-4 space-y-3">
                      {group.objections.map((obj) => (
                        <div key={obj.id} className="rounded-lg p-3 space-y-2" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 space-y-1">
                              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{obj.objection_text}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {obj.investor_name && (
                                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                                    <User className="w-3 h-3" />
                                    {obj.investor_name}
                                  </span>
                                )}
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                  {new Date(obj.created_at).toLocaleDateString()}
                                </span>
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={EFFECTIVENESS_BADGE[obj.effectiveness]?.style}
                                >
                                  {EFFECTIVENESS_BADGE[obj.effectiveness]?.label}
                                </span>
                                {obj.next_meeting_enthusiasm_delta !== 0 && (
                                  <span className="flex items-center gap-1 text-xs">
                                    <DeltaIcon delta={obj.next_meeting_enthusiasm_delta} />
                                    <span style={{ color: obj.next_meeting_enthusiasm_delta > 0 ? 'var(--success)' : 'var(--danger)' }}>
                                      {obj.next_meeting_enthusiasm_delta > 0 ? '+' : ''}{obj.next_meeting_enthusiasm_delta}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                            {editingId !== obj.id && (
                              <button
                                onClick={() => startEdit(obj)}
                                className="p-1.5 rounded transition-colors shrink-0"
                                style={{ color: 'var(--text-muted)' }}
                                title="Edit response"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Response display or edit */}
                          {editingId === obj.id ? (
                            <div className="space-y-2 pt-1">
                              <textarea
                                value={editResponse}
                                onChange={e => setEditResponse(e.target.value)}
                                rows={3}
                                placeholder="What response worked or would work for this objection?"
                                className="input"
                              />
                              <div className="flex items-center gap-3">
                                <select
                                  value={editEffectiveness}
                                  onChange={e => setEditEffectiveness(e.target.value)}
                                  className="input"
                                  style={{ width: 'auto', fontSize: 'var(--font-size-xs)', padding: '0.375rem 0.5rem' }}
                                >
                                  <option value="unknown">Unknown</option>
                                  <option value="effective">Effective</option>
                                  <option value="partially_effective">Partially Effective</option>
                                  <option value="ineffective">Ineffective</option>
                                </select>
                                <button
                                  onClick={() => saveEdit(obj.id)}
                                  disabled={saving}
                                  className="btn btn-primary btn-sm"
                                >
                                  <Save className="w-3 h-3" />
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="btn btn-ghost btn-sm"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : obj.response_text ? (
                            <div className="pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                              <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Response:</p>
                              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{obj.response_text}</p>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar — 1 col */}
        <div className="space-y-4">
          {/* Top Unresolved */}
          <div className="rounded-xl p-4 space-y-3" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--warning)' }} />
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Top Unresolved</h3>
            </div>
            {unresolved.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>All objections have effective responses.</p>
            ) : (
              <div className="space-y-2">
                {unresolved.map((obj, i) => {
                  const color = getTopicColor(obj.objection_topic);
                  return (
                    <div key={i} className="p-2 rounded-lg space-y-1" style={{ background: 'var(--surface-1)' }}>
                      <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{obj.objection_text}</p>
                      <div className="flex items-center gap-2">
                        <span
                          className="px-1.5 py-0.5 rounded"
                          style={{ fontSize: '10px', ...color.bg, ...color.text }}
                        >
                          {obj.objection_topic}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{obj.count}x raised</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Effectiveness summary */}
          <div className="rounded-xl p-4 space-y-3" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Coverage</h3>
            </div>
            {playbook.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No data yet.</p>
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
                      <span className="w-20 truncate" style={{ fontSize: '10px', ...color.text }}>{group.topic}</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                        <div
                          style={{ width: `${pct}%`, background: barColor, height: '100%' }}
                        />
                      </div>
                      <span className="w-8 text-right" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Meeting Prep */}
          <div className="rounded-xl p-4 space-y-3" style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Meeting Prep</h3>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Select an investor to see their objection history and what worked with similar investors.</p>
            <select
              value={selectedInvestor}
              onChange={e => {
                setSelectedInvestor(e.target.value);
                loadInvestorObjections(e.target.value);
              }}
              className="input"
              style={{ fontSize: 'var(--font-size-xs)', padding: '0.375rem 0.5rem' }}
            >
              <option value="">Select investor...</option>
              {investors.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.name}</option>
              ))}
            </select>

            {loadingInvestor && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</p>
            )}

            {selectedInvestor && !loadingInvestor && investorObjections.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No objections recorded for this investor.</p>
            )}

            {selectedInvestor && !loadingInvestor && investorObjections.length > 0 && (
              <div className="space-y-2">
                <p className="uppercase tracking-wide" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {investorObjections.length} objection{investorObjections.length !== 1 ? 's' : ''} from this investor
                </p>
                {investorObjections.map((obj) => {
                  const color = getTopicColor(obj.objection_topic);
                  const effBadge = EFFECTIVENESS_BADGE[obj.effectiveness];
                  return (
                    <div key={obj.id} className="p-2 rounded-lg space-y-1" style={{ background: 'var(--surface-1)' }}>
                      <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{obj.objection_text}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="px-1 py-0.5 rounded"
                          style={{ fontSize: '10px', ...color.bg, ...color.text }}
                        >
                          {obj.objection_topic}
                        </span>
                        <span
                          className="px-1 py-0.5 rounded"
                          style={{ fontSize: '10px', ...effBadge.style }}
                        >
                          {effBadge.label}
                        </span>
                      </div>
                      {obj.response_text && (
                        <p className="leading-relaxed mt-1" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          Response: {obj.response_text}
                        </p>
                      )}
                    </div>
                  );
                })}

                {/* Show what worked with similar objection topics */}
                {(() => {
                  const investorTopics = [...new Set(investorObjections.map(o => o.objection_topic))];
                  const bestFromPlaybook = playbook
                    .filter(g => investorTopics.includes(g.topic) && g.best_response)
                    .map(g => ({ topic: g.topic, response: g.best_response! }));

                  if (bestFromPlaybook.length === 0) return null;

                  return (
                    <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <p className="uppercase tracking-wide flex items-center gap-1" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--success)' }} />
                        What worked with similar investors
                      </p>
                      {bestFromPlaybook.map(({ topic, response }) => {
                        const color = getTopicColor(topic);
                        return (
                          <div key={topic} className="p-2 rounded-lg space-y-1" style={{ background: 'var(--success-muted)', border: '1px solid rgba(34, 197, 94, 0.15)' }}>
                            <span
                              className="px-1 py-0.5 rounded"
                              style={{ fontSize: '10px', ...color.bg, ...color.text }}
                            >
                              {topic}
                            </span>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{response.response_text}</p>
                            {response.investor_name && (
                              <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                Worked with {response.investor_name}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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

const TOPIC_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  valuation: { bg: 'bg-purple-900/30', text: 'text-purple-400', border: 'border-purple-800/50' },
  competition: { bg: 'bg-orange-900/30', text: 'text-orange-400', border: 'border-orange-800/50' },
  team: { bg: 'bg-cyan-900/30', text: 'text-cyan-400', border: 'border-cyan-800/50' },
  execution: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-800/50' },
  financial: { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-800/50' },
  market: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-800/50' },
  technical: { bg: 'bg-indigo-900/30', text: 'text-indigo-400', border: 'border-indigo-800/50' },
  risk: { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-800/50' },
  timing: { bg: 'bg-amber-900/30', text: 'text-amber-400', border: 'border-amber-800/50' },
  structure: { bg: 'bg-teal-900/30', text: 'text-teal-400', border: 'border-teal-800/50' },
};

const SEVERITY_BADGE: Record<string, { bg: string; text: string }> = {
  showstopper: { bg: 'bg-red-900/50', text: 'text-red-400' },
  significant: { bg: 'bg-yellow-900/50', text: 'text-yellow-400' },
  minor: { bg: 'bg-zinc-800', text: 'text-zinc-500' },
};

const EFFECTIVENESS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  effective: { bg: 'bg-green-900/50', text: 'text-green-400', label: 'Effective' },
  partially_effective: { bg: 'bg-yellow-900/50', text: 'text-yellow-400', label: 'Partial' },
  ineffective: { bg: 'bg-red-900/50', text: 'text-red-400', label: 'Ineffective' },
  unknown: { bg: 'bg-zinc-800', text: 'text-zinc-500', label: 'Unknown' },
};

function getTopicColor(topic: string) {
  return TOPIC_COLORS[topic] || { bg: 'bg-zinc-800/50', text: 'text-zinc-400', border: 'border-zinc-700/50' };
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
    if (total === 0) return <div className="h-2 bg-zinc-800 rounded-full" />;
    const pct = (n: number) => Math.round((n / total) * 100);
    return (
      <div className="flex h-2 rounded-full overflow-hidden bg-zinc-800">
        {dist.effective > 0 && (
          <div className="bg-green-500" style={{ width: `${pct(dist.effective)}%` }} />
        )}
        {dist.partially_effective > 0 && (
          <div className="bg-yellow-500" style={{ width: `${pct(dist.partially_effective)}%` }} />
        )}
        {dist.ineffective > 0 && (
          <div className="bg-red-500" style={{ width: `${pct(dist.ineffective)}%` }} />
        )}
        {dist.unknown > 0 && (
          <div className="bg-zinc-600" style={{ width: `${pct(dist.unknown)}%` }} />
        )}
      </div>
    );
  }

  function DeltaIcon({ delta }: { delta: number }) {
    if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
    if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-zinc-600" />;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Objection Playbook</h1>
          <p className="text-zinc-500 text-sm mt-1">Loading...</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-zinc-900/50 border border-zinc-800 rounded-xl animate-pulse" />
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
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <span className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
              <MessageCircleWarning className="w-4.5 h-4.5 text-white" />
            </span>
            Objection Playbook
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            {total_objections} objection{total_objections !== 1 ? 's' : ''} tracked across {playbook.length} topic{playbook.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main content — 3 cols */}
        <div className="xl:col-span-3 space-y-4">
          {playbook.length === 0 ? (
            <div className="border border-zinc-800 rounded-xl p-12 text-center space-y-3">
              <MessageCircleWarning className="w-10 h-10 text-zinc-700 mx-auto" />
              <p className="text-zinc-500">No objections tracked yet.</p>
              <p className="text-zinc-600 text-xs">
                Log meetings with AI analysis enabled to automatically capture investor objections.
              </p>
            </div>
          ) : (
            playbook.map((group) => {
              const color = getTopicColor(group.topic);
              const isExpanded = expandedTopics.has(group.topic);

              return (
                <div key={group.topic} className={`border ${color.border} rounded-xl overflow-hidden`}>
                  {/* Topic header */}
                  <button
                    onClick={() => toggleTopic(group.topic)}
                    className={`w-full flex items-center justify-between p-4 ${color.bg} hover:brightness-110 transition-all`}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className={`w-4 h-4 ${color.text}`} />
                      ) : (
                        <ChevronRight className={`w-4 h-4 ${color.text}`} />
                      )}
                      <span className={`text-sm font-semibold uppercase tracking-wide ${color.text}`}>
                        {group.topic}
                      </span>
                      <span className="text-xs text-zinc-500 bg-zinc-800/80 px-2 py-0.5 rounded-full">
                        {group.count} objection{group.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32">
                        <EffectivenessBar dist={group.effectiveness_distribution} />
                      </div>
                      <div className="flex gap-2 text-[10px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          {group.effectiveness_distribution.effective}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-yellow-500" />
                          {group.effectiveness_distribution.partially_effective}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          {group.effectiveness_distribution.ineffective}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-zinc-600" />
                          {group.effectiveness_distribution.unknown}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Best response highlight */}
                  {isExpanded && group.best_response && (
                    <div className="mx-4 mt-3 p-3 bg-green-900/10 border border-green-800/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-xs font-medium text-green-400">Best Response</span>
                        {group.best_response.investor_name && (
                          <span className="text-xs text-zinc-500">
                            (worked with {group.best_response.investor_name})
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed">
                        {group.best_response.response_text}
                      </p>
                    </div>
                  )}

                  {/* Individual objections */}
                  {isExpanded && (
                    <div className="p-4 space-y-3">
                      {group.objections.map((obj) => (
                        <div key={obj.id} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 space-y-1">
                              <p className="text-sm text-zinc-200">{obj.objection_text}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {obj.investor_name && (
                                  <span className="flex items-center gap-1 text-xs text-zinc-500">
                                    <User className="w-3 h-3" />
                                    {obj.investor_name}
                                  </span>
                                )}
                                <span className="text-xs text-zinc-600">
                                  {new Date(obj.created_at).toLocaleDateString()}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${EFFECTIVENESS_BADGE[obj.effectiveness]?.bg} ${EFFECTIVENESS_BADGE[obj.effectiveness]?.text}`}>
                                  {EFFECTIVENESS_BADGE[obj.effectiveness]?.label}
                                </span>
                                {obj.next_meeting_enthusiasm_delta !== 0 && (
                                  <span className="flex items-center gap-1 text-xs">
                                    <DeltaIcon delta={obj.next_meeting_enthusiasm_delta} />
                                    <span className={obj.next_meeting_enthusiasm_delta > 0 ? 'text-green-400' : 'text-red-400'}>
                                      {obj.next_meeting_enthusiasm_delta > 0 ? '+' : ''}{obj.next_meeting_enthusiasm_delta}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                            {editingId !== obj.id && (
                              <button
                                onClick={() => startEdit(obj)}
                                className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors shrink-0"
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
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-blue-600"
                              />
                              <div className="flex items-center gap-3">
                                <select
                                  value={editEffectiveness}
                                  onChange={e => setEditEffectiveness(e.target.value)}
                                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-200"
                                >
                                  <option value="unknown">Unknown</option>
                                  <option value="effective">Effective</option>
                                  <option value="partially_effective">Partially Effective</option>
                                  <option value="ineffective">Ineffective</option>
                                </select>
                                <button
                                  onClick={() => saveEdit(obj.id)}
                                  disabled={saving}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs font-medium transition-colors"
                                >
                                  <Save className="w-3 h-3" />
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : obj.response_text ? (
                            <div className="pt-1 border-t border-zinc-800/50">
                              <p className="text-xs text-zinc-500 mb-0.5">Response:</p>
                              <p className="text-sm text-zinc-400 leading-relaxed">{obj.response_text}</p>
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
          <div className="border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Top Unresolved</h3>
            </div>
            {unresolved.length === 0 ? (
              <p className="text-xs text-zinc-600">All objections have effective responses.</p>
            ) : (
              <div className="space-y-2">
                {unresolved.map((obj, i) => (
                  <div key={i} className="p-2 bg-zinc-900/50 rounded-lg space-y-1">
                    <p className="text-xs text-zinc-300 line-clamp-2">{obj.objection_text}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${getTopicColor(obj.objection_topic).bg} ${getTopicColor(obj.objection_topic).text}`}>
                        {obj.objection_topic}
                      </span>
                      <span className="text-[10px] text-zinc-600">{obj.count}x raised</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Effectiveness summary */}
          <div className="border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Coverage</h3>
            </div>
            {playbook.length === 0 ? (
              <p className="text-xs text-zinc-600">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {playbook.map((group) => {
                  const total = group.count;
                  const resolved = group.effectiveness_distribution.effective + group.effectiveness_distribution.partially_effective;
                  const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;
                  const color = getTopicColor(group.topic);
                  return (
                    <div key={group.topic} className="flex items-center gap-2">
                      <span className={`text-[10px] w-20 truncate ${color.text}`}>{group.topic}</span>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-600 w-8 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Meeting Prep */}
          <div className="border border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-violet-400" />
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Meeting Prep</h3>
            </div>
            <p className="text-xs text-zinc-600">Select an investor to see their objection history and what worked with similar investors.</p>
            <select
              value={selectedInvestor}
              onChange={e => {
                setSelectedInvestor(e.target.value);
                loadInvestorObjections(e.target.value);
              }}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200"
            >
              <option value="">Select investor...</option>
              {investors.map(inv => (
                <option key={inv.id} value={inv.id}>{inv.name}</option>
              ))}
            </select>

            {loadingInvestor && (
              <p className="text-xs text-zinc-500">Loading...</p>
            )}

            {selectedInvestor && !loadingInvestor && investorObjections.length === 0 && (
              <p className="text-xs text-zinc-600">No objections recorded for this investor.</p>
            )}

            {selectedInvestor && !loadingInvestor && investorObjections.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">
                  {investorObjections.length} objection{investorObjections.length !== 1 ? 's' : ''} from this investor
                </p>
                {investorObjections.map((obj) => {
                  const color = getTopicColor(obj.objection_topic);
                  const effBadge = EFFECTIVENESS_BADGE[obj.effectiveness];
                  return (
                    <div key={obj.id} className="p-2 bg-zinc-900/50 rounded-lg space-y-1">
                      <p className="text-xs text-zinc-300 line-clamp-2">{obj.objection_text}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] px-1 py-0.5 rounded ${color.bg} ${color.text}`}>
                          {obj.objection_topic}
                        </span>
                        <span className={`text-[10px] px-1 py-0.5 rounded ${effBadge.bg} ${effBadge.text}`}>
                          {effBadge.label}
                        </span>
                      </div>
                      {obj.response_text && (
                        <p className="text-[10px] text-zinc-500 leading-relaxed mt-1">
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
                    <div className="mt-3 pt-3 border-t border-zinc-800/50 space-y-2">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wide flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        What worked with similar investors
                      </p>
                      {bestFromPlaybook.map(({ topic, response }) => {
                        const color = getTopicColor(topic);
                        return (
                          <div key={topic} className="p-2 bg-green-900/5 border border-green-800/20 rounded-lg space-y-1">
                            <span className={`text-[10px] px-1 py-0.5 rounded ${color.bg} ${color.text}`}>
                              {topic}
                            </span>
                            <p className="text-xs text-zinc-400 leading-relaxed">{response.response_text}</p>
                            {response.investor_name && (
                              <p className="text-[10px] text-zinc-600">
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

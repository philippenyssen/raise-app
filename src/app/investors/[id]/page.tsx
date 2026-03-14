'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Investor, Meeting, InvestorPartner, InvestorPortfolioCo, IntelligenceBrief, InvestorStatus, Task } from '@/lib/types';
import {
  ArrowLeft, Calendar, TrendingUp, AlertTriangle,
  Clock, Target, Users, Zap, Briefcase, UserCheck, BookOpen,
  RefreshCw, Loader2, Trash2, ClipboardList, Check, FileSearch,
  Gauge, ArrowUpRight, ArrowRight, ArrowDownRight, Minus, ShieldAlert, Lightbulb
} from 'lucide-react';
import { useToast } from '@/components/toast';

const STATUS_LABELS: Record<InvestorStatus, string> = {
  identified: 'Identified', contacted: 'Contacted', nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Set', met: 'Met', engaged: 'Engaged',
  in_dd: 'In DD', term_sheet: 'Term Sheet', closed: 'Closed',
  passed: 'Passed', dropped: 'Dropped',
};

const STATUS_COLORS: Record<string, string> = {
  identified: 'bg-zinc-700', contacted: 'bg-zinc-600', nda_signed: 'bg-blue-900',
  meeting_scheduled: 'bg-blue-800', met: 'bg-blue-700', engaged: 'bg-purple-700',
  in_dd: 'bg-orange-700', term_sheet: 'bg-green-700', closed: 'bg-emerald-700',
  passed: 'bg-red-800', dropped: 'bg-zinc-800',
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

type IntelTab = 'overview' | 'partners' | 'portfolio' | 'research' | 'tasks';

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

  useEffect(() => { fetchData(); fetchScore(); }, [fetchData, fetchScore]);

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
        <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
        <div className="h-32 bg-zinc-800/50 rounded-xl animate-pulse" />
        <div className="h-64 bg-zinc-800/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!investor) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-500">Investor not found</p>
        <Link href="/investors" className="text-blue-400 hover:text-blue-300 text-sm mt-2 block">Back to CRM</Link>
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
          <Link href="/investors" className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 text-sm mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to CRM
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{investor.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              investor.tier === 1 ? 'bg-blue-600/20 text-blue-400' :
              investor.tier === 2 ? 'bg-purple-600/20 text-purple-400' :
              'bg-zinc-600/20 text-zinc-400'
            }`}>Tier {investor.tier}</span>
            <select
              value={investor.status}
              onChange={async (e) => {
                const newStatus = e.target.value;
                await fetch('/api/investors', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: newStatus }) });
                setInvestor(prev => prev ? { ...prev, status: newStatus as InvestorStatus } : prev);
                toast(`Status updated to ${STATUS_LABELS[newStatus as InvestorStatus] || newStatus}`);
              }}
              className={`${STATUS_COLORS[investor.status]} px-2 py-0.5 rounded text-xs font-medium bg-opacity-80 border-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500`}
            >
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val} className="bg-zinc-900 text-zinc-300">{label}</option>
              ))}
            </select>
            <span className="text-xs text-zinc-500 capitalize">{investor.type.replace(/_/g, ' ')}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/meetings/prep?investor=${id}`}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <FileSearch className="w-3.5 h-3.5" /> Prep
          </Link>
          <button
            onClick={handleResearch}
            disabled={researching}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {researching ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Researching...</> : <><RefreshCw className="w-3.5 h-3.5" /> Research</>}
          </button>
          <Link
            href="/meetings/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
          >
            + Log Meeting
          </Link>
        </div>
      </div>

      {/* Profile + Process Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-zinc-800 rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-medium text-zinc-400 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> PROFILE
          </h2>
          <div className="space-y-2 text-sm">
            <Row label="Partner" value={investor.partner} />
            <Row label="Fund Size" value={investor.fund_size} />
            <Row label="Check Size" value={investor.check_size_range} />
            <Row label="Thesis" value={investor.sector_thesis} />
          </div>
        </div>
        <div className="border border-zinc-800 rounded-xl p-5 space-y-3">
          <h2 className="text-xs font-medium text-zinc-400 flex items-center gap-2">
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
        <div className="border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
            <span className="text-sm text-zinc-500">Computing intelligence score...</span>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={TrendingUp} label="Enthusiasm" value={`${latestEnthusiasm}/5`} sub="latest" />
        <StatCard icon={Calendar} label="Meetings" value={meetings.length} sub="total" />
        <StatCard icon={AlertTriangle} label="Objections" value={allObjections.length} sub="raised" />
        <StatCard icon={UserCheck} label="Partners" value={partners.length} sub="profiled" />
        <StatCard icon={Briefcase} label="Portfolio" value={portfolio.length} sub="companies" />
      </div>

      {/* Intelligence Tabs */}
      <div className="border border-zinc-800 rounded-xl overflow-hidden">
        <div className="flex border-b border-zinc-800 bg-zinc-900/30">
          {([
            { key: 'overview' as IntelTab, label: 'Meetings', icon: Clock },
            { key: 'partners' as IntelTab, label: `Partners (${partners.length})`, icon: UserCheck },
            { key: 'portfolio' as IntelTab, label: `Portfolio (${portfolio.length})`, icon: Briefcase },
            { key: 'tasks' as IntelTab, label: `Tasks (${tasks.filter(t => t.status !== 'done').length})`, icon: ClipboardList },
            { key: 'research' as IntelTab, label: `Research (${briefs.length})`, icon: BookOpen },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setIntelTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                intelTab === t.key ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
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
                  <h3 className="text-xs font-medium text-zinc-400 mb-3 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5" /> ENTHUSIASM TREND
                  </h3>
                  <div className="flex items-end gap-2 h-20">
                    {enthusiasmTrend.map((point, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className={`w-full rounded-t ${
                            point.score >= 4 ? 'bg-green-600' : point.score >= 3 ? 'bg-blue-600' : point.score >= 2 ? 'bg-yellow-600' : 'bg-red-600'
                          }`}
                          style={{ height: `${(point.score / 5) * 100}%` }}
                        />
                        <span className="text-[10px] text-zinc-600">{point.date.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meeting History */}
              <h3 className="text-xs font-medium text-zinc-400 mb-3 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" /> MEETING HISTORY
              </h3>
              {meetings.length === 0 ? (
                <p className="text-sm text-zinc-600">No meetings logged yet.</p>
              ) : (
                <div className="space-y-4">
                  {meetings.map(m => {
                    const objs = (() => { try { return JSON.parse(m.objections || '[]'); } catch { return []; } })();
                    return (
                      <div key={m.id} className="border-l-2 border-zinc-800 pl-4 pb-2">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-medium">{m.date}</span>
                          <span className="text-xs text-zinc-500">{m.type.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-zinc-600">{m.duration_minutes}min</span>
                          <div className="flex gap-0.5 ml-auto">
                            {[1,2,3,4,5].map(n => (
                              <div key={n} className={`w-1.5 h-1.5 rounded-full ${n <= m.enthusiasm_score ? 'bg-blue-500' : 'bg-zinc-800'}`} />
                            ))}
                          </div>
                        </div>
                        {m.ai_analysis && <p className="text-sm text-zinc-400 mb-2">{m.ai_analysis}</p>}
                        {m.next_steps && <p className="text-xs text-blue-400/70">Next: {m.next_steps}</p>}
                        {objs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {objs.map((o: { text: string; severity: string }, i: number) => (
                              <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${
                                o.severity === 'showstopper' ? 'bg-red-900/30 text-red-400' :
                                o.severity === 'significant' ? 'bg-yellow-900/30 text-yellow-400' :
                                'bg-zinc-800 text-zinc-500'
                              }`}>{o.text.length > 40 ? o.text.slice(0, 40) + '...' : o.text}</span>
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
                  <h3 className="text-xs font-medium text-zinc-400 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" /> ALL OBJECTIONS
                  </h3>
                  <div className="space-y-2">
                    {allObjections.map((o, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                          o.severity === 'showstopper' ? 'bg-red-900/50 text-red-400' :
                          o.severity === 'significant' ? 'bg-yellow-900/50 text-yellow-400' :
                          'bg-zinc-800 text-zinc-500'
                        }`}>{o.severity}</span>
                        <span className="text-zinc-300 flex-1">{o.text}</span>
                        <span className="text-xs text-zinc-600 shrink-0">{o.date}</span>
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
                  <UserCheck className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-sm text-zinc-600 mb-3">No partner profiles yet.</p>
                  <button onClick={handleResearch} disabled={researching} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm flex items-center gap-2 mx-auto">
                    <RefreshCw className="w-3.5 h-3.5" /> Research {investor.name}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {partners.map(p => (
                    <div key={p.id} className="border border-zinc-800 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{p.name}</h4>
                          <p className="text-xs text-zinc-500">{p.title}</p>
                        </div>
                        <button onClick={() => deleteIntelItem('partner', p.id)} className="text-zinc-600 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-zinc-400">
                        {p.focus_areas && <p><span className="text-zinc-500">Focus:</span> {p.focus_areas}</p>}
                        {p.notable_deals && <p><span className="text-zinc-500">Deals:</span> {p.notable_deals}</p>}
                        {p.board_seats && <p><span className="text-zinc-500">Boards:</span> {p.board_seats}</p>}
                        {p.background && <p><span className="text-zinc-500">Background:</span> {p.background}</p>}
                        {p.relevance_to_us && <p className="text-blue-400"><span className="text-zinc-500">Relevance:</span> {p.relevance_to_us}</p>}
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
                  <Briefcase className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-sm text-zinc-600 mb-3">No portfolio companies tracked.</p>
                  <button onClick={handleResearch} disabled={researching} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm flex items-center gap-2 mx-auto">
                    <RefreshCw className="w-3.5 h-3.5" /> Research {investor.name}
                  </button>
                </div>
              ) : (
                <div className="border border-zinc-800 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-900/50 border-b border-zinc-800">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">Company</th>
                        <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">Sector</th>
                        <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">Stage</th>
                        <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">Amount</th>
                        <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">Date</th>
                        <th className="text-left px-4 py-2 text-xs text-zinc-500 font-medium">Status</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {portfolio.map(co => (
                        <tr key={co.id} className="hover:bg-zinc-900/30">
                          <td className="px-4 py-2 font-medium">{co.company}</td>
                          <td className="px-4 py-2 text-zinc-400 text-xs">{co.sector}</td>
                          <td className="px-4 py-2 text-zinc-400 text-xs">{co.stage_invested}</td>
                          <td className="px-4 py-2 text-emerald-400 text-xs">{co.amount}</td>
                          <td className="px-4 py-2 text-zinc-500 text-xs">{co.date}</td>
                          <td className="px-4 py-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              co.status === 'active' ? 'bg-green-900/30 text-green-400' :
                              co.status === 'exited' ? 'bg-blue-900/30 text-blue-400' :
                              'bg-red-900/30 text-red-400'
                            }`}>{co.status}</span>
                          </td>
                          <td className="px-4 py-2">
                            <button onClick={() => deleteIntelItem('portfolio', co.id)} className="text-zinc-600 hover:text-red-400">
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
                <p className="text-sm text-zinc-600 text-center py-6">No tasks for this investor yet. Tasks are auto-generated when you log meetings.</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map(t => {
                    const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';
                    const prioColor = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-yellow-400', low: 'text-zinc-500' }[t.priority] || 'text-zinc-500';
                    return (
                      <div key={t.id} className={`flex items-center justify-between py-2 px-3 rounded-lg border ${t.status === 'done' ? 'border-zinc-800/50 opacity-50' : 'border-zinc-800'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={async () => {
                              const newStatus = t.status === 'done' ? 'pending' : 'done';
                              await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, status: newStatus, title: t.title, investor_id: id, investor_name: investor?.name }) });
                              fetchData();
                            }}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${t.status === 'done' ? 'bg-green-600 border-green-600' : 'border-zinc-700 hover:border-zinc-500'}`}
                          >
                            {t.status === 'done' && <Check className="w-3 h-3" />}
                          </button>
                          <div className="min-w-0">
                            <div className={`text-sm truncate ${t.status === 'done' ? 'line-through' : ''}`}>{t.title}</div>
                            {t.description && <div className="text-xs text-zinc-600 truncate">{t.description}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-[10px] ${prioColor}`}>{t.priority}</span>
                          <span className="text-[10px] text-zinc-600">{t.phase}</span>
                          {t.due_date && <span className={`text-[10px] ${overdue ? 'text-red-400 font-medium' : 'text-zinc-500'}`}>{t.due_date}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Research Tab */}
          {intelTab === 'research' && (
            <div>
              {briefs.length === 0 ? (
                <div className="text-center py-6">
                  <BookOpen className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-sm text-zinc-600 mb-3">No research briefs yet.</p>
                  <button onClick={handleResearch} disabled={researching} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm flex items-center gap-2 mx-auto">
                    {researching ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Researching...</> : <><RefreshCw className="w-3.5 h-3.5" /> Research {investor.name}</>}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {briefs.map(b => (
                    <div key={b.id} className="border border-zinc-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 font-medium">{b.brief_type}</span>
                          <span className="text-xs text-zinc-600">{b.updated_at?.split('T')[0]}</span>
                        </div>
                        <button onClick={() => deleteIntelItem('brief', b.id)} className="text-zinc-600 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="prose prose-invert prose-sm max-w-none text-zinc-300 whitespace-pre-wrap text-sm leading-relaxed">
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
        <div className="border border-zinc-800 rounded-xl p-5">
          <h2 className="text-xs font-medium text-zinc-400 mb-2">NOTES</h2>
          <p className="text-sm text-zinc-400">{investor.notes}</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-300 text-right max-w-[60%]">{value || '---'}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; sub: string }) {
  return (
    <div className="border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-zinc-600">{sub}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intelligence Score Panel
// ---------------------------------------------------------------------------

const OUTCOME_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  likely_close: { label: 'Likely Close', color: 'text-emerald-400', bg: 'bg-emerald-900/30' },
  possible: { label: 'Possible', color: 'text-blue-400', bg: 'bg-blue-900/30' },
  long_shot: { label: 'Long Shot', color: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  unlikely: { label: 'Unlikely', color: 'text-red-400', bg: 'bg-red-900/30' },
};

const MOMENTUM_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  accelerating: { label: 'Accelerating', icon: ArrowUpRight, color: 'text-emerald-400' },
  steady: { label: 'Steady', icon: ArrowRight, color: 'text-blue-400' },
  decelerating: { label: 'Decelerating', icon: ArrowDownRight, color: 'text-yellow-400' },
  stalled: { label: 'Stalled', icon: Minus, color: 'text-red-400' },
};

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 50) return 'text-blue-400';
  if (score >= 30) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBarColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 50) return 'bg-blue-500';
  if (score >= 30) return 'bg-yellow-500';
  return 'bg-red-500';
}

function scoreBorderColor(score: number): string {
  if (score >= 70) return 'border-emerald-500/30';
  if (score >= 50) return 'border-blue-500/30';
  if (score >= 30) return 'border-yellow-500/30';
  return 'border-red-500/30';
}

function signalBadge(sig: 'strong' | 'moderate' | 'weak' | 'unknown') {
  const config = {
    strong: 'bg-emerald-900/30 text-emerald-400',
    moderate: 'bg-blue-900/30 text-blue-400',
    weak: 'bg-yellow-900/30 text-yellow-400',
    unknown: 'bg-zinc-800 text-zinc-500',
  };
  return config[sig];
}

function InvestorScorePanel({ score, loading, onRefresh }: { score: InvestorScoreData; loading: boolean; onRefresh: () => void }) {
  const outcomeConf = OUTCOME_CONFIG[score.predictedOutcome] || OUTCOME_CONFIG.possible;
  const momentumConf = MOMENTUM_CONFIG[score.momentum] || MOMENTUM_CONFIG.steady;
  const MomentumIcon = momentumConf.icon;

  return (
    <div className={`border rounded-xl overflow-hidden ${scoreBorderColor(score.overall)}`}>
      {/* Header row: overall score + momentum + predicted outcome */}
      <div className="p-5 bg-zinc-900/30">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-zinc-400" />
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Intelligence Score</h2>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Refresh score"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-6">
          {/* Overall score — large number */}
          <div className="flex items-baseline gap-1">
            <span className={`text-5xl font-bold tabular-nums ${scoreColor(score.overall)}`}>{score.overall}</span>
            <span className="text-lg text-zinc-600">/100</span>
          </div>

          {/* Divider */}
          <div className="w-px h-14 bg-zinc-800" />

          {/* Momentum + Outcome */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <MomentumIcon className={`w-4 h-4 ${momentumConf.color}`} />
              <span className={`text-sm font-medium ${momentumConf.color}`}>{momentumConf.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${outcomeConf.bg} ${outcomeConf.color}`}>
                {outcomeConf.label}
              </span>
            </div>
          </div>

          {/* Next best action */}
          <div className="flex-[2] min-w-0">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-[10px] font-medium text-zinc-500 uppercase mb-0.5">Next Action</div>
                <p className="text-sm text-zinc-300 leading-snug">{score.nextBestAction}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dimension bars */}
      <div className="border-t border-zinc-800 p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          {score.dimensions.map((dim) => (
            <div key={dim.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-300">{dim.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${signalBadge(dim.signal)}`}>
                    {dim.signal}
                  </span>
                </div>
                <span className={`text-xs font-bold tabular-nums ${scoreColor(dim.score)}`}>{dim.score}</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(dim.score)}`}
                  style={{ width: `${dim.score}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-500 leading-snug truncate" title={dim.evidence}>
                {dim.evidence}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Risks */}
      {score.risks.length > 0 && (
        <div className="border-t border-zinc-800 p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
            <h3 className="text-xs font-medium text-zinc-400 uppercase">Identified Risks</h3>
          </div>
          <div className="space-y-1.5">
            {score.risks.map((risk, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-red-500 mt-1.5 shrink-0" />
                <p className="text-xs text-zinc-400 leading-snug">{risk}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

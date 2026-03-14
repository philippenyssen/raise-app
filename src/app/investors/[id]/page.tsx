'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Investor, Meeting, InvestorStatus } from '@/lib/types';
import {
  ArrowLeft, Calendar, MessageSquare, TrendingUp, AlertTriangle,
  Clock, Target, Users, Zap
} from 'lucide-react';

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

export default function InvestorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/investors?id=${id}`).then(r => r.json()),
      fetch(`/api/meetings?investor_id=${id}`).then(r => r.json()),
    ]).then(([inv, mtgs]) => {
      setInvestor(inv);
      setMeetings(mtgs);
      setLoading(false);
    });
  }, [id]);

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
        <Link href="/investors" className="text-blue-400 hover:text-blue-300 text-sm mt-2 block">
          Back to CRM
        </Link>
      </div>
    );
  }

  // Parse objections across all meetings
  const allObjections: { text: string; severity: string; topic: string; date: string }[] = [];
  const allQuestions: { text: string; topic: string; date: string }[] = [];
  meetings.forEach(m => {
    try {
      const objs = JSON.parse(m.objections || '[]');
      objs.forEach((o: { text: string; severity: string; topic: string }) => {
        allObjections.push({ ...o, date: m.date });
      });
    } catch { /* skip */ }
    try {
      const qs = JSON.parse(m.questions_asked || '[]');
      qs.forEach((q: { text: string; topic: string }) => {
        allQuestions.push({ ...q, date: m.date });
      });
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
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to CRM
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{investor.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              investor.tier === 1 ? 'bg-blue-600/20 text-blue-400' :
              investor.tier === 2 ? 'bg-purple-600/20 text-purple-400' :
              'bg-zinc-600/20 text-zinc-400'
            }`}>Tier {investor.tier}</span>
            <span className={`${STATUS_COLORS[investor.status]} px-2 py-0.5 rounded text-xs font-medium`}>
              {STATUS_LABELS[investor.status as InvestorStatus] || investor.status}
            </span>
            <span className="text-xs text-zinc-500 capitalize">{investor.type}</span>
          </div>
        </div>
        <Link
          href="/meetings/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
        >
          + Log Meeting
        </Link>
      </div>

      {/* Profile Grid */}
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

      {/* Enthusiasm + Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Enthusiasm" value={`${latestEnthusiasm}/5`} sub="latest" />
        <StatCard icon={Calendar} label="Meetings" value={meetings.length} sub="total" />
        <StatCard icon={AlertTriangle} label="Objections" value={allObjections.length} sub="raised" />
        <StatCard icon={MessageSquare} label="Questions" value={allQuestions.length} sub="asked" />
      </div>

      {/* Enthusiasm Trend */}
      {enthusiasmTrend.length > 1 && (
        <div className="border border-zinc-800 rounded-xl p-5">
          <h2 className="text-xs font-medium text-zinc-400 mb-4 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5" /> ENTHUSIASM TREND
          </h2>
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
      <div className="border border-zinc-800 rounded-xl p-5">
        <h2 className="text-xs font-medium text-zinc-400 mb-4 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" /> MEETING HISTORY
        </h2>
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
                  {m.ai_analysis && (
                    <p className="text-sm text-zinc-400 mb-2">{m.ai_analysis}</p>
                  )}
                  {m.next_steps && (
                    <p className="text-xs text-blue-400/70">Next: {m.next_steps}</p>
                  )}
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
      </div>

      {/* Objection Summary */}
      {allObjections.length > 0 && (
        <div className="border border-zinc-800 rounded-xl p-5">
          <h2 className="text-xs font-medium text-zinc-400 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" /> ALL OBJECTIONS
          </h2>
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

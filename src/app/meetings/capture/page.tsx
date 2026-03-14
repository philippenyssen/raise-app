'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Timer, ChevronDown, ChevronUp, ArrowRight, CheckCircle2,
  AlertTriangle, MessageCircle, Shield, Crosshair, ExternalLink,
  Loader2, Sparkles, Clock,
} from 'lucide-react';
import type { Investor } from '@/lib/types';
import PostMeetingActions from '@/components/post-meeting-actions';
import FollowupPlan from '@/components/followup-plan';

const ENTHUSIASM_LABELS = ['Cold', 'Lukewarm', 'Interested', 'Excited', 'All-in'];

const AI_THINKING_MESSAGES = [
  'Extracting objections and signals...',
  'Identifying competitive intelligence...',
  'Mapping engagement patterns...',
  'Generating follow-up choreography...',
  'Analyzing sentiment and enthusiasm...',
  'Cross-referencing investor history...',
];

export default function QuickCapturePage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: 'var(--space-8)' }}>
        <div className="skeleton" style={{ height: '32px', width: '200px', marginBottom: 'var(--space-4)' }} />
        <div className="skeleton" style={{ height: '16px', width: '300px', marginBottom: 'var(--space-8)' }} />
        <div className="skeleton" style={{ height: '44px', marginBottom: 'var(--space-5)' }} />
        <div className="skeleton" style={{ height: '280px', marginBottom: 'var(--space-5)' }} />
        <div className="skeleton" style={{ height: '48px' }} />
      </div>
    }>
      <QuickCaptureInner />
    </Suspense>
  );
}

function QuickCaptureInner() {
  const searchParams = useSearchParams();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [investors, setInvestors] = useState<Investor[]>([]);
  const [investorId, setInvestorId] = useState(searchParams.get('investor') || searchParams.get('investor_id') || '');
  const [rawNotes, setRawNotes] = useState('');
  const [enthusiasm, setEnthusiasm] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [meetingType, setMeetingType] = useState('management_presentation');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 16));

  const [loading, setLoading] = useState(false);
  const [thinkingMsg, setThinkingMsg] = useState(0);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const [submitHovered, setSubmitHovered] = useState(false);
  const [detailsHovered, setDetailsHovered] = useState(false);
  const [viewMeetingHovered, setViewMeetingHovered] = useState(false);
  const [newCaptureHovered, setNewCaptureHovered] = useState(false);

  useEffect(() => {
    fetch('/api/investors').then(r => r.json()).then(setInvestors);
  }, []);

  useEffect(() => {
    if (textareaRef.current && !result) {
      textareaRef.current.focus();
    }
  }, [result]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setThinkingMsg(m => (m + 1) % AI_THINKING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [loading]);

  const selectedInvestor = investors.find(i => i.id === investorId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!investorId || !rawNotes.trim()) return;
    setLoading(true);
    setResult(null);
    setThinkingMsg(0);

    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investor_id: investorId,
          investor_name: selectedInvestor?.name || 'Unknown',
          raw_notes: rawNotes,
          date: meetingDate.split('T')[0],
          type: meetingType,
          duration_minutes: durationMinutes,
          attendees: '',
          analyze: true,
        }),
      });
      const data = await res.json();
      if (enthusiasm > 0) {
        data.enthusiasm_score = enthusiasm;
      }
      setResult(data);
    } catch {
      // Non-blocking
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setRawNotes('');
    setEnthusiasm(0);
    setInvestorId('');
    setShowDetails(false);
    setMeetingType('management_presentation');
    setDurationMinutes(60);
    setMeetingDate(new Date().toISOString().slice(0, 16));
  }

  const postMeetingActions = result?.post_meeting_actions as {
    tasks: { id: string; title: string; description: string; due_date: string; priority: string; phase: string; status: string; investor_name: string }[];
    document_flags: { id: string; document_id: string; flag_type: string; description: string; section_hint: string; objection_text: string; investor_name: string; status: string }[];
    investor_updates: { enthusiasm: number; suggested_status: string; previous_status?: string; previous_enthusiasm?: number };
  } | null;

  // --- RESULTS VIEW ---
  if (result) {
    const questions = (() => {
      try { return JSON.parse(String(result.questions_asked || '[]')); } catch { return []; }
    })();
    const objections = (() => {
      try { return JSON.parse(String(result.objections || '[]')); } catch { return []; }
    })();
    const engagementSignals = (() => {
      try { return JSON.parse(String(result.engagement_signals || '{}')); } catch { return {}; }
    })();
    const competitiveIntel = String(result.competitive_intel || '');

    return (
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        {/* Success header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'var(--success-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'var(--success)' }}><CheckCircle2 className="w-5 h-5" /></span>
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: 'var(--font-size-xl)' }}>Captured & Processed</h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)', marginTop: '2px' }}>
              Meeting with {selectedInvestor?.name || 'investor'} analyzed
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* AI Summary */}
          {!!result.ai_analysis && (
            <div className="card" style={{ background: 'var(--accent-muted)', borderColor: 'var(--accent)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                <span style={{ color: 'var(--accent)', marginTop: '2px' }}><Sparkles className="w-4 h-4" /></span>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {String(result.ai_analysis)}
                </p>
              </div>
            </div>
          )}

          {/* Enthusiasm + Status row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="card">
              <p className="section-title" style={{ marginBottom: 'var(--space-2)' }}>Enthusiasm</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <div key={n} style={{
                      width: '12px', height: '12px', borderRadius: '50%',
                      background: n <= ((result.enthusiasm_score as number) || 0) ? 'var(--accent)' : 'var(--border-default)',
                      transition: 'all 150ms ease',
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  {(result.enthusiasm_score as number) || 0}/5
                </span>
              </div>
            </div>
            <div className="card">
              <p className="section-title" style={{ marginBottom: 'var(--space-2)' }}>Suggested Status</p>
              <span className="badge badge-blue" style={{ fontSize: 'var(--font-size-sm)' }}>
                {String(result.status_after || 'met').replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Questions */}
          {questions.length > 0 && (
            <div className="card">
              <p className="section-title">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <MessageCircle className="w-3.5 h-3.5" /> Questions Asked ({questions.length})
                </span>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {questions.map((q: { text: string; topic: string }, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                    <span className="badge badge-zinc" style={{ flexShrink: 0, marginTop: '2px' }}>{q.topic}</span>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{q.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Objections */}
          {objections.length > 0 && (
            <div className="card">
              <p className="section-title">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <AlertTriangle className="w-3.5 h-3.5" /> Objections ({objections.length})
                </span>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {objections.map((o: { text: string; severity: string }, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                    <span className={`badge ${o.severity === 'showstopper' ? 'badge-red' : o.severity === 'significant' ? 'badge-amber' : 'badge-zinc'}`}
                      style={{ flexShrink: 0, marginTop: '2px' }}>
                      {o.severity}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{o.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Engagement Signals */}
          {Object.keys(engagementSignals).length > 0 && (
            <div className="card">
              <p className="section-title">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Crosshair className="w-3.5 h-3.5" /> Engagement Signals
                </span>
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                {engagementSignals.asked_about_process !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: engagementSignals.asked_about_process ? 'var(--success)' : 'var(--border-default)',
                    }} />
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>Asked about process</span>
                  </div>
                )}
                {engagementSignals.asked_about_timeline !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: engagementSignals.asked_about_timeline ? 'var(--success)' : 'var(--border-default)',
                    }} />
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>Asked about timeline</span>
                  </div>
                )}
                {engagementSignals.requested_followup !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: engagementSignals.requested_followup ? 'var(--success)' : 'var(--border-default)',
                    }} />
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>Requested follow-up</span>
                  </div>
                )}
                {engagementSignals.mentioned_competitors !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: engagementSignals.mentioned_competitors ? 'var(--warning)' : 'var(--border-default)',
                    }} />
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>Mentioned competitors</span>
                  </div>
                )}
                {engagementSignals.body_language_at_pricing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: engagementSignals.body_language_at_pricing === 'positive' ? 'var(--success)'
                        : engagementSignals.body_language_at_pricing === 'negative' ? 'var(--danger)' : 'var(--warning)',
                    }} />
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                      Pricing reaction: {engagementSignals.body_language_at_pricing}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Competitive Intel */}
          {competitiveIntel && (
            <div className="card">
              <p className="section-title">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Shield className="w-3.5 h-3.5" /> Competitive Intelligence
                </span>
              </p>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {competitiveIntel}
              </p>
            </div>
          )}

          {/* Post-Meeting Actions */}
          {postMeetingActions && (
            <PostMeetingActions
              data={postMeetingActions}
              meetingId={result.id as string}
            />
          )}

          {/* Follow-up Plan */}
          {Array.isArray(result.followup_plan) && (
            <FollowupPlan
              followups={result.followup_plan as {
                id: string; meeting_id: string; investor_id: string; investor_name: string;
                action_type: string; description: string; due_at: string; status: string;
                outcome: string; conviction_delta: number; created_at: string; completed_at: string | null;
              }[]}
            />
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
            {investorId && (
              <Link
                href={`/investors/${investorId}`}
                className="btn btn-md"
                style={{
                  background: viewMeetingHovered ? 'var(--accent-hover)' : 'var(--accent)',
                  color: 'white',
                  border: '1px solid transparent',
                  textDecoration: 'none',
                  gap: 'var(--space-2)',
                }}
                onMouseEnter={() => setViewMeetingHovered(true)}
                onMouseLeave={() => setViewMeetingHovered(false)}
              >
                <ExternalLink className="w-3.5 h-3.5" /> View {selectedInvestor?.name || 'Investor'}
              </Link>
            )}
            <button
              onClick={handleReset}
              className="btn btn-md"
              style={{
                background: newCaptureHovered ? 'var(--surface-3)' : 'var(--surface-2)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderColor: newCaptureHovered ? 'var(--border-strong)' : 'var(--border-default)',
              }}
              onMouseEnter={() => setNewCaptureHovered(true)}
              onMouseLeave={() => setNewCaptureHovered(false)}
            >
              Capture Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- CAPTURE FORM ---
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: 'var(--accent)' }}><Timer className="w-5 h-5" /></span>
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: 'var(--font-size-xl)' }}>Quick Capture</h1>
            <p className="page-subtitle">Capture while it&apos;s fresh — AI handles the rest</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {/* Investor selector */}
        <div>
          <label className="label" style={{ display: 'block' }}>Investor</label>
          <select
            value={investorId}
            onChange={e => setInvestorId(e.target.value)}
            required
            className="input"
            style={{ cursor: 'pointer' }}
          >
            <option value="">Select investor...</option>
            {investors.map(inv => (
              <option key={inv.id} value={inv.id}>{inv.name} (T{inv.tier})</option>
            ))}
          </select>
        </div>

        {/* Investor quick profile */}
        {selectedInvestor && (
          <div className="card" style={{ padding: 'var(--space-3) var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)' }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Partner</span>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{selectedInvestor.partner || '---'}</p>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Check Size</span>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{selectedInvestor.check_size_range || '---'}</p>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Status</span>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{selectedInvestor.status.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </div>
        )}

        {/* The big text area */}
        <div>
          <textarea
            ref={textareaRef}
            value={rawNotes}
            onChange={e => setRawNotes(e.target.value)}
            required
            rows={14}
            placeholder="What happened? What did they say? Any objections? What's the vibe?"
            className="input"
            style={{
              fontSize: 'var(--font-size-md)',
              lineHeight: 1.8,
              padding: 'var(--space-5)',
              resize: 'vertical',
              minHeight: '280px',
              fontFamily: 'var(--font-sans), system-ui, sans-serif',
              letterSpacing: '-0.01em',
            }}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 'var(--space-1)',
            padding: '0 var(--space-1)',
          }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              Brain dump everything — AI will structure it
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {rawNotes.length > 0 ? `${rawNotes.split(/\s+/).filter(Boolean).length} words` : ''}
            </span>
          </div>
        </div>

        {/* Quick-rate bar */}
        <div>
          <label className="label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>How enthusiastic were they?</label>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map(level => (
              <button
                key={level}
                type="button"
                onClick={() => setEnthusiasm(level === enthusiasm ? 0 : level)}
                style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 'var(--font-size-lg)', fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  border: enthusiasm === level ? '2px solid var(--accent)' : '2px solid var(--border-default)',
                  background: enthusiasm === level ? 'var(--accent-muted)' : 'var(--surface-1)',
                  color: enthusiasm === level ? 'var(--accent)' : 'var(--text-tertiary)',
                  transform: enthusiasm === level ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                {level}
              </button>
            ))}
            {enthusiasm > 0 && (
              <span style={{
                fontSize: 'var(--font-size-sm)', color: 'var(--accent)',
                fontWeight: 500, marginLeft: 'var(--space-2)',
                animation: 'fade-in 200ms ease forwards',
              }}>
                {ENTHUSIASM_LABELS[enthusiasm - 1]}
              </span>
            )}
          </div>
        </div>

        {/* Optional details (collapsible) */}
        <div>
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="btn btn-md"
            style={{
              background: detailsHovered ? 'var(--surface-3)' : 'transparent',
              color: 'var(--text-tertiary)',
              border: '1px solid var(--border-subtle)',
              borderColor: detailsHovered ? 'var(--border-default)' : 'var(--border-subtle)',
              width: '100%',
              justifyContent: 'space-between',
            }}
            onMouseEnter={() => setDetailsHovered(true)}
            onMouseLeave={() => setDetailsHovered(false)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Clock className="w-3.5 h-3.5" />
              Optional details
            </span>
            {showDetails
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />
            }
          </button>

          {showDetails && (
            <div className="animate-slide-down" style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)',
              marginTop: 'var(--space-3)',
              padding: 'var(--space-4)',
              background: 'var(--surface-1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div>
                <label className="label" style={{ display: 'block' }}>Meeting type</label>
                <select
                  value={meetingType}
                  onChange={e => setMeetingType(e.target.value)}
                  className="input"
                  style={{ cursor: 'pointer' }}
                >
                  <option value="intro">Intro Call</option>
                  <option value="management_presentation">Management Presentation</option>
                  <option value="deep_dive">Deep Dive</option>
                  <option value="site_visit">Site Visit</option>
                  <option value="dd_session">DD Session</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="social">Social / Informal</option>
                </select>
              </div>
              <div>
                <label className="label" style={{ display: 'block' }}>Duration (min)</label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(Number(e.target.value))}
                  min={5}
                  max={480}
                  className="input"
                />
              </div>
              <div>
                <label className="label" style={{ display: 'block' }}>Date & time</label>
                <input
                  type="datetime-local"
                  value={meetingDate}
                  onChange={e => setMeetingDate(e.target.value)}
                  className="input"
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading || !investorId || !rawNotes.trim()}
          className="btn btn-lg"
          style={{
            background: loading ? 'var(--surface-3)' : submitHovered ? 'var(--accent-hover)' : 'var(--accent)',
            color: loading ? 'var(--text-tertiary)' : 'white',
            border: '1px solid transparent',
            padding: 'var(--space-4) var(--space-6)',
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            width: '100%',
            opacity: (!investorId || !rawNotes.trim()) && !loading ? 0.5 : 1,
            cursor: loading || !investorId || !rawNotes.trim() ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={() => setSubmitHovered(true)}
          onMouseLeave={() => setSubmitHovered(false)}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <Loader2 className="w-5 h-5" style={{ animation: 'spin 1s linear infinite' }} />
              {AI_THINKING_MESSAGES[thinkingMsg]}
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', justifyContent: 'center' }}>
              <Sparkles className="w-5 h-5" />
              Process & Save
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </button>
      </form>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

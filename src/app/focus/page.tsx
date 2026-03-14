'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import {
  Target, Clock, AlertTriangle, Zap, ChevronRight, RefreshCw,
  Calendar, CheckCircle, ArrowUpRight, TrendingDown, Timer, Users,
  Rocket, Shield, XCircle, ChevronDown, Play, Ban, BarChart3,
  Star, Eye, Flame, Flag, MessageSquare,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreDimensionData {
  name: string;
  score: number;
  signal: 'strong' | 'moderate' | 'weak' | 'unknown';
  evidence: string;
}

interface FocusItem {
  investorId: string;
  investorName: string;
  investorType: string;
  investorTier: number;
  status: string;
  enthusiasm: number;
  focusScore: number;
  components: {
    investorScore: number;
    urgency: number;
    momentumRisk: number;
    opportunitySize: number;
    actionReadiness: number;
  };
  scoringDimensions?: ScoreDimensionData[];
  recommendedAction: string;
  timeEstimate: string;
  expectedImpact: string;
  riskIfIgnored: string;
  daysSinceLastMeeting: number | null;
  lastMeetingDate: string | null;
  lastMeetingType: string | null;
  momentum: string;
  pendingTaskCount: number;
  openFlagCount: number;
  unresolvedObjections: string[];
  topObjectionTopic: string | null;
}

interface FocusData {
  priorityQueue: FocusItem[];
  quickWins: FocusItem[];
  staleAlerts: FocusItem[];
  weeklyBudget: {
    totalHoursRecommended: number;
    meetingsRecommended: number;
    followUpsRecommended: number;
    investorCount: number;
  };
  generatedAt: string;
}

interface AccelerationItem {
  id: string;
  investorId: string;
  investorName: string;
  investorTier: number;
  investorType: string;
  status: string;
  enthusiasm: number;
  score: number;
  momentum: string;
  triggerType: string;
  actionType: string;
  description: string;
  expectedLift: number;
  confidence: string;
  timeEstimate: string;
  urgency: string;
  triggerEvidence: string;
}

interface InvestorSummary {
  investorId: string;
  investorName: string;
  investorTier: number;
  investorType: string;
  status: string;
  enthusiasm: number;
  score: number;
  momentum: string;
  reason: string;
}

interface AccelerationData {
  summary: { immediate: number; this_week: number; total: number };
  accelerations: AccelerationItem[];
  termSheetReady: InvestorSummary[];
  atRisk: InvestorSummary[];
  deprioritize: InvestorSummary[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers — style objects using design tokens
// ---------------------------------------------------------------------------

const TYPE_STYLES: Record<string, React.CSSProperties> = {
  vc: { background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid rgba(74,111,165,0.25)' },
  growth: { background: 'var(--cat-purple-muted)', color: 'var(--chart-4)', border: '1px solid rgba(74,74,138,0.15)' },
  sovereign: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)', border: '1px solid rgba(26, 26, 46, 0.05)' },
  strategic: { background: 'var(--cat-teal-muted)', color: 'var(--cat-teal)', border: '1px solid rgba(45,122,106,0.15)' },
  debt: { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' },
  family_office: { background: 'rgba(26, 26, 46, 0.06)', color: 'var(--text-primary)', border: '1px solid rgba(26, 26, 46, 0.06)' },
};

const TYPE_LABELS: Record<string, string> = {
  vc: 'VC', growth: 'Growth', sovereign: 'SWF', strategic: 'Strategic',
  debt: 'Debt', family_office: 'Family',
};

const STATUS_LABELS: Record<string, string> = {
  identified: 'Identified', contacted: 'Contacted', nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Set', met: 'Met', engaged: 'Engaged',
  in_dd: 'In DD', term_sheet: 'Term Sheet', closed: 'Closed',
};

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  identified: { background: 'var(--surface-2)', color: 'var(--text-tertiary)', border: '1px solid var(--border-default)' },
  contacted: { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' },
  nda_signed: { background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid rgba(74,111,165,0.25)' },
  meeting_scheduled: { background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid rgba(74,111,165,0.25)' },
  met: { background: 'var(--cat-purple-muted)', color: 'var(--chart-4)', border: '1px solid rgba(74,74,138,0.15)' },
  engaged: { background: 'var(--cat-purple-muted)', color: 'var(--cat-purple)', border: '1px solid rgba(74,74,138,0.12)' },
  in_dd: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)', border: '1px solid rgba(26, 26, 46, 0.05)' },
  term_sheet: { background: 'var(--success-muted)', color: 'var(--text-secondary)', border: '1px solid rgba(27, 42, 74, 0.08)' },
};

const MOMENTUM_STYLE: Record<string, React.CSSProperties> = {
  accelerating: { color: 'var(--text-secondary)' },
  steady: { color: 'var(--text-tertiary)' },
  decelerating: { color: 'var(--text-tertiary)' },
  stalled: { color: 'var(--text-primary)' },
};

const MOMENTUM_LABELS: Record<string, string> = {
  accelerating: 'Accelerating',
  steady: 'Steady',
  decelerating: 'Decelerating',
  stalled: 'Stalled',
};

const TRIGGER_STYLES: Record<string, React.CSSProperties> = {
  momentum_cliff: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)', border: '1px solid rgba(26, 26, 46, 0.05)' },
  stall_risk: { background: 'var(--danger-muted)', color: 'var(--text-primary)', border: '1px solid rgba(26, 26, 46, 0.06)' },
  window_closing: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)', border: '1px solid rgba(26, 26, 46, 0.05)' },
  catalyst_match: { background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid rgba(74,111,165,0.25)' },
  competitive_pressure: { background: 'var(--cat-purple-muted)', color: 'var(--chart-4)', border: '1px solid rgba(74,74,138,0.15)' },
  term_sheet_ready: { background: 'var(--success-muted)', color: 'var(--text-secondary)', border: '1px solid rgba(27, 42, 74, 0.08)' },
};

const TRIGGER_LABELS: Record<string, string> = {
  momentum_cliff: 'Momentum Cliff',
  stall_risk: 'Stall Risk',
  window_closing: 'Window Closing',
  catalyst_match: 'Catalyst Match',
  competitive_pressure: 'Competitive Pressure',
  term_sheet_ready: 'Term Sheet Ready',
};

const CONFIDENCE_STYLES: Record<string, React.CSSProperties> = {
  high: { background: 'var(--success-muted)', color: 'var(--text-secondary)', border: '1px solid rgba(27, 42, 74, 0.08)' },
  medium: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)', border: '1px solid rgba(26, 26, 46, 0.05)' },
  low: { background: 'var(--surface-2)', color: 'var(--text-tertiary)', border: '1px solid var(--border-default)' },
};

const URGENCY_STYLE: Record<string, React.CSSProperties> = {
  immediate: { color: 'var(--text-primary)' },
  '48h': { color: 'var(--text-secondary)' },
  this_week: { color: 'var(--text-tertiary)' },
  next_week: { color: 'var(--text-tertiary)' },
};

function focusScoreColor(score: number): string {
  if (score >= 70) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

function focusScoreBgStyle(score: number): React.CSSProperties {
  if (score >= 70) return { background: 'var(--success-muted)', border: '1px solid rgba(27, 42, 74, 0.06)' };
  if (score >= 50) return { background: 'var(--warning-muted)', border: '1px solid rgba(26, 26, 46, 0.05)' };
  return { background: 'var(--danger-muted)', border: '1px solid rgba(26, 26, 46, 0.06)' };
}

function EnthusiasmDots({ value }: { value: number }) {
  return (
    <div className="enthusiasm-dots">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className="enthusiasm-dot"
          style={{
            background: i <= value
              ? (value >= 4 ? 'var(--success)' : value >= 3 ? 'var(--warning)' : 'var(--danger)')
              : 'var(--border-default)',
          }}
        />
      ))}
    </div>
  );
}

function TierBadge({ tier }: { tier: number }) {
  const tierClass = tier <= 3 ? `tier-badge tier-${tier}` : 'tier-badge tier-3';
  return (
    <span className={tierClass}>
      {tier}
    </span>
  );
}

// Shared inline badge style helper
function inlineBadgeStyle(styleObj: React.CSSProperties): React.CSSProperties {
  return {
    fontSize: 'var(--font-size-xs)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 500,
    lineHeight: 1.5,
    whiteSpace: 'nowrap' as const,
    ...styleObj,
  };
}

// ---------------------------------------------------------------------------
// Scoring Breakdown Component
// ---------------------------------------------------------------------------

const DIMENSION_SHORT_LABELS: Record<string, string> = {
  'Engagement': 'ENG',
  'Thesis Fit': 'FIT',
  'Check Size Fit': 'CHK',
  'Speed Match': 'SPD',
  'Conflict Risk': 'CON',
  'Warm Path': 'WRM',
  'Meeting Quality': 'MTG',
  'Momentum': 'MOM',
  'Network Effect': 'NET',
  'Forecast Alignment': 'FCT',
  'Engagement Velocity': 'VEL',
};

function dimensionColor(score: number, sig: string): string {
  if (sig === 'unknown') return 'var(--text-muted)';
  if (score >= 70) return 'var(--success)';
  if (score >= 40) return 'var(--warning)';
  return 'var(--danger)';
}

function dimensionBg(score: number, sig: string): string {
  if (sig === 'unknown') return 'var(--surface-2)';
  if (score >= 70) return 'var(--success-muted)';
  if (score >= 40) return 'var(--warning-muted)';
  return 'var(--danger-muted)';
}

function ScoringBreakdown({ dimensions }: { dimensions: ScoreDimensionData[] }) {
  const [expanded, setExpanded] = useState(false);

  const known = dimensions.filter(d => d.signal !== 'unknown');
  const sorted = [...known].sort((a, b) => b.score - a.score);
  const topDimensions = sorted.slice(0, 3);
  const weakest = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  return (
    <div style={{ marginTop: '10px' }}>
      {/* Compact bar visualization */}
      <div className="flex items-center gap-1">
        <button
          onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
          className="flex items-center gap-1.5 shrink-0"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <span style={{ color: 'var(--text-muted)' }}>
            <BarChart3 className="w-3 h-3" />
          </span>
          <ChevronDown
            className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
            style={{ color: 'var(--text-muted)' }}
          />
        </button>
        <div className="flex items-center gap-0.5 flex-1">
          {dimensions.map(d => (
            <div
              key={d.name}
              title={`${d.name}: ${d.score}/100 — ${d.evidence}`}
              style={{
                flex: 1,
                height: '6px',
                borderRadius: '3px',
                background: dimensionBg(d.score, d.signal),
                position: 'relative',
                overflow: 'hidden',
                maxWidth: '32px',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${d.signal === 'unknown' ? 0 : d.score}%`,
                  background: dimensionColor(d.score, d.signal),
                  borderRadius: '3px',
                  opacity: 0.85,
                  transition: 'width 300ms ease',
                }}
              />
            </div>
          ))}
        </div>
        {/* Inline top strengths summary */}
        {!expanded && topDimensions.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0" style={{ marginLeft: '4px' }}>
            {topDimensions.slice(0, 2).map(d => (
              <span
                key={d.name}
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  color: dimensionColor(d.score, d.signal),
                  background: dimensionBg(d.score, d.signal),
                  padding: '1px 4px',
                  borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'nowrap',
                }}
              >
                {DIMENSION_SHORT_LABELS[d.name] || d.name.slice(0, 3).toUpperCase()} {d.score}
              </span>
            ))}
            {weakest && weakest.score < 40 && (
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  color: dimensionColor(weakest.score, weakest.signal),
                  background: dimensionBg(weakest.score, weakest.signal),
                  padding: '1px 4px',
                  borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'nowrap',
                }}
              >
                {DIMENSION_SHORT_LABELS[weakest.name] || weakest.name.slice(0, 3).toUpperCase()} {weakest.score}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="mt-2 space-y-2"
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3)',
          }}
        >
          {/* Full dimension grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-3 gap-y-2">
            {dimensions.map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-0.5">
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'none', letterSpacing: '0.04em' }}>
                    {d.name}
                  </span>
                  <span
                    className="tabular-nums"
                    style={{ fontSize: '10px', fontWeight: 700, color: dimensionColor(d.score, d.signal) }}
                  >
                    {d.signal === 'unknown' ? '--' : d.score}
                  </span>
                </div>
                <div
                  style={{
                    height: '4px',
                    borderRadius: '2px',
                    background: dimensionBg(d.score, d.signal),
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${d.signal === 'unknown' ? 0 : d.score}%`,
                      background: dimensionColor(d.score, d.signal),
                      borderRadius: '2px',
                      opacity: 0.85,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Strengths */}
          {topDimensions.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-2)' }}>
              <div className="flex items-center gap-1 mb-1">
                <span style={{ color: 'var(--text-secondary)' }}><Star className="w-3 h-3" /></span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'none', letterSpacing: '0.06em' }}>
                  Strengths
                </span>
              </div>
              <div className="space-y-1">
                {topDimensions.map(d => (
                  <div key={d.name} className="flex items-start gap-1.5">
                    <span style={{ fontSize: '10px', fontWeight: 700, color: dimensionColor(d.score, d.signal), minWidth: '20px' }} className="tabular-nums shrink-0">
                      {d.score}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {d.name}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {d.evidence}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weakest */}
          {weakest && weakest.score < 70 && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-2)' }}>
              <div className="flex items-center gap-1 mb-1">
                <span style={{ color: 'var(--text-tertiary)' }}><Eye className="w-3 h-3" /></span>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'none', letterSpacing: '0.06em' }}>
                  Needs Attention
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <span style={{ fontSize: '10px', fontWeight: 700, color: dimensionColor(weakest.score, weakest.signal), minWidth: '20px' }} className="tabular-nums shrink-0">
                  {weakest.score}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {weakest.name}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {weakest.evidence}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Focus Components (existing)
// ---------------------------------------------------------------------------

function PriorityQueueItem({ item, rank }: { item: FocusItem; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const cardStyle: React.CSSProperties = {
    border: `1px solid ${rank <= 3 ? 'var(--border-default)' : 'var(--border-subtle)'}`,
    borderRadius: 'var(--radius-lg)',
    background: rank <= 3 ? 'var(--surface-1)' : 'var(--surface-0)',
    transition: 'all 200ms ease',
    ...(expanded ? { boxShadow: '0 0 0 1px var(--border-default)' } : {}),
  };

  const rankStyle: React.CSSProperties = rank <= 3
    ? { background: 'var(--accent)', color: 'var(--text-primary)' }
    : { background: 'var(--surface-2)', color: 'var(--text-tertiary)' };

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Main row */}
        <div className="flex items-start gap-3">
          {/* Rank number */}
          <div
            className="w-8 h-8 flex items-center justify-center shrink-0"
            style={{
              ...rankStyle,
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
            }}
          >
            {rank}
          </div>

          {/* Investor info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/investors/${item.investorId}`}
                onClick={e => e.stopPropagation()}
                className="transition-colors"
                style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              >
                {item.investorName}
              </Link>
              <span style={inlineBadgeStyle(TYPE_STYLES[item.investorType] ?? TYPE_STYLES.vc)}>
                {TYPE_LABELS[item.investorType] ?? item.investorType}
              </span>
              <TierBadge tier={item.investorTier} />
              <span style={inlineBadgeStyle(STATUS_STYLES[item.status] ?? STATUS_STYLES.identified)}>
                {STATUS_LABELS[item.status] ?? item.status}
              </span>
            </div>

            {/* Recommended action */}
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4, marginTop: '6px' }}>
              {item.recommendedAction}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-4 flex-wrap" style={{ marginTop: '8px' }}>
              {/* Deal heat — composite of focus score + momentum */}
              {(() => {
                const momentumBonus = item.momentum === 'accelerating' ? 15 : item.momentum === 'steady' ? 0 : item.momentum === 'decelerating' ? -10 : -20;
                const heat = Math.min(100, Math.max(0, item.focusScore + momentumBonus));
                const heatColor = heat >= 70 ? 'var(--danger)' : heat >= 45 ? 'var(--warning)' : 'var(--text-muted)';
                return (
                  <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: heatColor, fontWeight: 600 }} title={`Deal heat: ${heat}/100`}>
                    <Flame className="w-3 h-3" />
                    {heat}
                  </span>
                );
              })()}

              {/* Last meeting type + days ago */}
              <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                <Calendar className="w-3 h-3" />
                {item.daysSinceLastMeeting !== null
                  ? <>
                      {item.lastMeetingType && (
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {item.lastMeetingType.replace(/_/g, ' ')}
                        </span>
                      )}
                      {' '}{item.daysSinceLastMeeting}d ago
                    </>
                  : 'No meetings'}
              </span>

              {/* Momentum */}
              <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', ...(MOMENTUM_STYLE[item.momentum] ?? {}) }}>
                {item.momentum === 'decelerating' || item.momentum === 'stalled'
                  ? <TrendingDown className="w-3 h-3" />
                  : <ArrowUpRight className="w-3 h-3" />
                }
                {MOMENTUM_LABELS[item.momentum]}
              </span>

              {/* Enthusiasm */}
              <div className="flex items-center gap-1.5">
                <EnthusiasmDots value={item.enthusiasm} />
              </div>

              {/* Time estimate */}
              <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                <Timer className="w-3 h-3" />
                {item.timeEstimate}
              </span>

              {/* Pending tasks */}
              {item.pendingTaskCount > 0 && (
                <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                  <AlertTriangle className="w-3 h-3" />
                  {item.pendingTaskCount} task{item.pendingTaskCount !== 1 ? 's' : ''}
                </span>
              )}

              {/* Open flags */}
              {item.openFlagCount > 0 && (
                <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>
                  <Flag className="w-3 h-3" />
                  {item.openFlagCount} flag{item.openFlagCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Top objection — the #1 blocker for this deal */}
            {item.topObjectionTopic && (
              <div className="flex items-center gap-1.5" style={{ marginTop: '6px' }}>
                <span style={{ color: 'var(--text-tertiary)' }}><MessageSquare className="w-3 h-3" /></span>
                <span style={{
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
                  fontWeight: 500,
                  fontStyle: 'italic',
                }}>
                  Blocker: {item.topObjectionTopic}
                </span>
              </div>
            )}

            {/* 11-Dimension Scoring Breakdown */}
            {item.scoringDimensions && item.scoringDimensions.length > 0 && (
              <ScoringBreakdown dimensions={item.scoringDimensions} />
            )}
          </div>

          {/* Focus score + quick actions */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div
              className="flex flex-col items-center px-3 py-2"
              style={{
                ...focusScoreBgStyle(item.focusScore),
                borderRadius: 'var(--radius-md)',
              }}
            >
              <span
                className="tabular-nums"
                style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: focusScoreColor(item.focusScore) }}
              >
                {item.focusScore}
              </span>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'none', letterSpacing: '0.08em' }}>Focus</span>
            </div>
            {/* Quick action buttons — always visible for top 3, on hover for rest */}
            {(rank <= 3 || hovered) && (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <Link
                  href={`/meetings/new?investor=${item.investorId}`}
                  title="Schedule meeting"
                  className="flex items-center justify-center"
                  style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-md)', background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid rgba(74,111,165,0.2)', transition: 'all 150ms ease' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-muted)'; e.currentTarget.style.color = 'var(--accent)'; }}
                >
                  <Calendar className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href={`/meetings/prep?investor=${item.investorId}`}
                  title="Prep meeting"
                  className="flex items-center justify-center"
                  style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-md)', background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', transition: 'all 150ms ease' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-muted)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <Zap className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Impact + Risk row */}
        <div className="flex items-start gap-4 ml-11" style={{ marginTop: '10px' }}>
          <p className="flex-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', opacity: 0.85, lineHeight: 1.6 }}>
            {item.expectedImpact}
          </p>
          <p className="flex-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', opacity: 0.75, lineHeight: 1.6 }}>
            {item.riskIfIgnored}
          </p>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 py-3 ml-11 space-y-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {/* Score breakdown */}
          <div>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'none', letterSpacing: '0.08em', marginBottom: '8px' }}>Score Breakdown</p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'Investor Score', value: item.components.investorScore, weight: '30%' },
                { label: 'Urgency', value: item.components.urgency, weight: '25%' },
                { label: 'Momentum Risk', value: item.components.momentumRisk, weight: '20%' },
                { label: 'Opportunity Size', value: item.components.opportunitySize, weight: '15%' },
                { label: 'Action Readiness', value: item.components.actionReadiness, weight: '10%' },
              ].map(comp => (
                <div key={comp.label} className="text-center">
                  <div className="tabular-nums" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: focusScoreColor(comp.value) }}>{comp.value}</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>{comp.label}</div>
                  <div style={{ fontSize: '8px', color: 'var(--text-muted)' }}>{comp.weight}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Unresolved objections */}
          {item.unresolvedObjections.length > 0 && (
            <div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'none', letterSpacing: '0.08em', marginBottom: '4px' }}>Unresolved Objections</p>
              <div className="space-y-1">
                {item.unresolvedObjections.map((obj, i) => (
                  <div key={i} className="flex items-start gap-1.5" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', opacity: 0.85 }}>
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    {obj}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Link
              href={`/meetings/new?investor=${item.investorId}`}
              className="btn btn-primary btn-sm"
              onClick={e => e.stopPropagation()}
            >
              Schedule Meeting
            </Link>
            <Link
              href={`/investors/${item.investorId}`}
              className="btn btn-secondary btn-sm"
              onClick={e => e.stopPropagation()}
            >
              Open Investor
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickWinCard({ item }: { item: FocusItem }) {
  return (
    <div
      className="card"
      style={{ padding: 'var(--space-4)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
        <Link
          href={`/investors/${item.investorId}`}
          className="transition-colors"
          style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
        >
          {item.investorName}
        </Link>
        <TierBadge tier={item.investorTier} />
      </div>
      {item.unresolvedObjections.length > 0 ? (
        <>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Blocker:</p>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', opacity: 0.85, marginBottom: '8px' }}>{item.unresolvedObjections[0]}</p>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Resolution:</p>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', opacity: 0.85 }}>{item.recommendedAction.substring(0, 120)}</p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Opportunity:</p>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>{item.recommendedAction.substring(0, 120)}</p>
        </>
      )}
      <div className="flex items-center justify-between" style={{ marginTop: '12px' }}>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            <Timer className="w-3 h-3" /> {item.timeEstimate}
          </span>
          <span style={{ fontSize: '10px', color: focusScoreColor(item.focusScore) }}>
            Score: {item.focusScore}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/meetings/new?investor=${item.investorId}`}
            className="btn btn-primary"
            style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}
          >
            Schedule
          </Link>
          <Link
            href={`/investors/${item.investorId}`}
            className="btn btn-secondary"
            style={{ fontSize: '10px', padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}
          >
            Open
          </Link>
        </div>
      </div>
    </div>
  );
}

function StaleAlertCard({ item, onReengage }: { item: FocusItem; onReengage: (item: FocusItem) => void }) {
  return (
    <div
      style={{
        border: '1px solid rgba(26, 26, 46, 0.06)',
        background: 'var(--danger-muted)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--text-primary)' }} />
          <Link
            href={`/investors/${item.investorId}`}
            className="transition-colors"
            style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          >
            {item.investorName}
          </Link>
          <span style={inlineBadgeStyle(STATUS_STYLES[item.status] ?? STATUS_STYLES.identified)}>
            {STATUS_LABELS[item.status]}
          </span>
        </div>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', fontWeight: 700 }}>
          {item.daysSinceLastMeeting !== null ? `${item.daysSinceLastMeeting}d` : '--'}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Last enthusiasm:</span>
        <EnthusiasmDots value={item.enthusiasm} />
        <span style={{ fontSize: 'var(--font-size-xs)', ...(MOMENTUM_STYLE[item.momentum] ?? {}) }}>
          {MOMENTUM_LABELS[item.momentum]}
        </span>
      </div>
      <button
        onClick={() => onReengage(item)}
        className="btn btn-danger btn-sm w-full"
        style={{ opacity: 0.9 }}
      >
        Create Re-engagement Task
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Acceleration Components
// ---------------------------------------------------------------------------

function AccelerationCard({
  item,
  onExecute,
  executing,
}: {
  item: AccelerationItem;
  onExecute: (item: AccelerationItem) => void;
  executing: boolean;
}) {
  return (
    <div
      className="card"
      style={{ padding: 'var(--space-4)' }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Header: investor name + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Link
              href={`/investors/${item.investorId}`}
              className="transition-colors"
              style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            >
              {item.investorName}
            </Link>
            <TierBadge tier={item.investorTier} />
            <span style={inlineBadgeStyle(TRIGGER_STYLES[item.triggerType] ?? TRIGGER_STYLES.stall_risk)}>
              {TRIGGER_LABELS[item.triggerType] ?? item.triggerType}
            </span>
            <span style={inlineBadgeStyle(CONFIDENCE_STYLES[item.confidence] ?? CONFIDENCE_STYLES.medium)}>
              {item.confidence} confidence
            </span>
          </div>

          {/* Description */}
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '8px' }}>
            {item.description}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              <Timer className="w-3 h-3" />
              {item.timeEstimate}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', opacity: 0.85 }}>
              +{item.expectedLift} pts expected
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, ...(URGENCY_STYLE[item.urgency] ?? { color: 'var(--text-tertiary)' }) }}>
              {item.urgency === 'immediate' ? 'Act now' : item.urgency === '48h' ? 'Within 48h' : item.urgency === 'this_week' ? 'This week' : 'Next week'}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {item.triggerEvidence}
            </span>
          </div>
        </div>

        {/* Execute button */}
        <button
          onClick={() => onExecute(item)}
          disabled={executing}
          className="btn btn-primary btn-sm shrink-0 flex items-center gap-1.5"
          style={executing ? { background: 'var(--surface-2)', color: 'var(--text-muted)', cursor: 'default' } : {}}
        >
          <Play className="w-3 h-3" />
          {executing ? 'Done' : 'Execute'}
        </button>
      </div>
    </div>
  );
}

function TermSheetReadyCard({ investor }: { investor: InvestorSummary }) {
  return (
    <div
      style={{
        border: '1px solid rgba(27, 42, 74, 0.08)',
        background: 'var(--success-muted)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Rocket className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
        <Link
          href={`/investors/${investor.investorId}`}
          className="transition-colors"
          style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
        >
          {investor.investorName}
        </Link>
        <TierBadge tier={investor.investorTier} />
        <span style={inlineBadgeStyle(STATUS_STYLES[investor.status] ?? STATUS_STYLES.identified)}>
          {STATUS_LABELS[investor.status] ?? investor.status}
        </span>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          Score: <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{investor.score}</span>/100
        </span>
        <span style={{ fontSize: 'var(--font-size-xs)', ...(MOMENTUM_STYLE[investor.momentum] ?? {}) }}>
          {MOMENTUM_LABELS[investor.momentum]}
        </span>
        <EnthusiasmDots value={investor.enthusiasm} />
      </div>
      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{investor.reason}</p>
      <div className="flex items-center gap-2" style={{ marginTop: '10px' }}>
        <Link
          href={`/meetings/prep?investor=${investor.investorId}`}
          className="btn btn-primary btn-sm flex-1"
          style={{ fontSize: '11px' }}
        >
          Prep Meeting
        </Link>
        <Link
          href={`/investors/${investor.investorId}`}
          className="btn btn-secondary btn-sm flex-1"
          style={{ fontSize: '11px' }}
        >
          View Deal
        </Link>
      </div>
    </div>
  );
}

function AtRiskCard({ investor }: { investor: InvestorSummary }) {
  return (
    <div
      style={{
        border: '1px solid rgba(26, 26, 46, 0.06)',
        background: 'var(--danger-muted)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-4)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-3.5 h-3.5" style={{ color: 'var(--text-primary)' }} />
        <Link
          href={`/investors/${investor.investorId}`}
          className="transition-colors"
          style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
        >
          {investor.investorName}
        </Link>
        <TierBadge tier={investor.investorTier} />
      </div>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          Score: <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{investor.score}</span>/100
        </span>
        <span style={{ fontSize: 'var(--font-size-xs)', ...(MOMENTUM_STYLE[investor.momentum] ?? {}) }}>
          {MOMENTUM_LABELS[investor.momentum]}
        </span>
        <EnthusiasmDots value={investor.enthusiasm} />
      </div>
      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>{investor.reason}</p>
      <div className="flex items-center gap-2" style={{ marginTop: '10px' }}>
        <Link
          href={`/meetings/new?investor=${investor.investorId}`}
          className="btn btn-sm flex-1 flex items-center justify-center gap-1"
          style={{ fontSize: '11px', background: 'rgba(26, 26, 46, 0.06)', color: 'var(--text-primary)', border: '1px solid rgba(26, 26, 46, 0.06)' }}
        >
          Re-engage
        </Link>
        <Link
          href={`/investors/${investor.investorId}`}
          className="btn btn-secondary btn-sm flex-1"
          style={{ fontSize: '11px' }}
        >
          View Deal
        </Link>
      </div>
    </div>
  );
}

function DeprioritizeSection({ investors }: { investors: InvestorSummary[] }) {
  const [expanded, setExpanded] = useState(false);

  if (investors.length === 0) return null;

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left transition-colors"
        style={{ background: 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-1)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <div className="flex items-center gap-2">
          <Ban className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'none', letterSpacing: '0.08em' }}>
            Deprioritize ({investors.length})
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
      </button>
      {expanded && (
        <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {investors.map(inv => (
            <div key={inv.investorId} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <XCircle className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                <Link
                  href={`/investors/${inv.investorId}`}
                  className="transition-colors"
                  style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  {inv.investorName}
                </Link>
                <TierBadge tier={inv.investorTier} />
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{inv.reason}</span>
            </div>
          ))}
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
            Park these for now. Redirect time to higher-conviction conversations.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FocusPage() {
  const { toast } = useToast();
  const [data, setData] = useState<FocusData | null>(null);
  const [accelData, setAccelData] = useState<AccelerationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accelLoading, setAccelLoading] = useState(true);
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setAccelLoading(true);
    try {
      const [focusRes, accelRes] = await Promise.all([
        fetch('/api/focus'),
        fetch('/api/acceleration'),
      ]);
      if (focusRes.ok) setData(await focusRes.json());
      if (accelRes.ok) setAccelData(await accelRes.json());
    } catch (err) {
      toast('Failed to load focus data', 'error');
      console.error(err);
    } finally {
      setLoading(false);
      setAccelLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleReengage(item: FocusItem) {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Re-engage ${item.investorName} — ${item.daysSinceLastMeeting ?? '?'}d since last contact`,
          description: `Process is ${item.momentum}. Last enthusiasm: ${item.enthusiasm}/5.\n\nRecommended: ${item.recommendedAction}`,
          assignee: '',
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'pending',
          priority: 'critical',
          phase: 'outreach',
          investor_id: item.investorId,
          investor_name: item.investorName,
          auto_generated: true,
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      toast(`Re-engagement task created for ${item.investorName}`);
    } catch {
      toast('Failed to create task', 'error');
    }
  }

  async function handleExecuteAcceleration(item: AccelerationItem) {
    try {
      const res = await fetch('/api/acceleration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          status: 'executed',
        }),
      });
      if (!res.ok) throw new Error('Failed to mark action as executed');
      setExecutedIds(prev => new Set(prev).add(item.id));
      toast(`Action executed for ${item.investorName}`);
    } catch {
      toast('Failed to update action', 'error');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton" style={{ height: '32px', width: '192px' }} />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '128px', borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
    );
  }

  if (!data || data.priorityQueue.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">CEO Focus</h1>
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-tertiary)' }}>No investors in the pipeline yet.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>Add investors and log meetings to build your daily priority queue.</p>
          <Link href="/investors" className="btn btn-primary btn-md" style={{ marginTop: '12px', display: 'inline-flex' }}>
            Go to Pipeline
          </Link>
        </div>
      </div>
    );
  }

  const { priorityQueue, quickWins, staleAlerts, weeklyBudget } = data;

  // Group acceleration items by urgency
  const immediateActions = accelData?.accelerations.filter(a => a.urgency === 'immediate' && !executedIds.has(a.id)) ?? [];
  const thisWeekActions = accelData?.accelerations.filter(a => (a.urgency === '48h' || a.urgency === 'this_week') && !executedIds.has(a.id)) ?? [];
  const hasAccelerationData = accelData && accelData.accelerations.length > 0;

  return (
    <div className="page-content space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">CEO Focus</h1>
          <p className="page-subtitle">
            Investors ranked by urgency and opportunity — {weeklyBudget.totalHoursRecommended}h recommended this week
          </p>
        </div>
        <button
          onClick={fetchData}
          className="btn btn-secondary btn-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Weekly Budget Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 card-stagger">
        <div className="card-metric" style={{ padding: 'var(--space-4)' }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
            <Clock className="w-3.5 h-3.5" /> Total Time
          </div>
          <div className="metric-value">{weeklyBudget.totalHoursRecommended}h</div>
          <div className="metric-label" style={{ marginTop: '2px' }}>recommended this week</div>
        </div>
        <div className="card-metric" style={{ padding: 'var(--space-4)' }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
            <Calendar className="w-3.5 h-3.5" /> Meetings
          </div>
          <div className="metric-value">{weeklyBudget.meetingsRecommended}</div>
          <div className="metric-label" style={{ marginTop: '2px' }}>calls & meetings</div>
        </div>
        <div className="card-metric metric-success" style={{ padding: 'var(--space-4)' }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
            <CheckCircle className="w-3.5 h-3.5" /> Follow-ups
          </div>
          <div className="metric-value">{weeklyBudget.followUpsRecommended}</div>
          <div className="metric-label" style={{ marginTop: '2px' }}>prep & outreach</div>
        </div>
        <div className="card-metric metric-warning" style={{ padding: 'var(--space-4)' }}>
          <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
            <Rocket className="w-3.5 h-3.5" /> Acceleration
          </div>
          <div className="metric-value">{accelData?.summary.total ?? 0}</div>
          <div className="metric-label" style={{ marginTop: '2px' }}>
            {accelData?.summary.immediate ?? 0} immediate
          </div>
        </div>
      </div>

      {/* Deal Acceleration Engine */}
      {hasAccelerationData && (
        <div className="space-y-4">
          <h2 className="section-title flex items-center gap-2">
            <Rocket className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Deal Acceleration Engine
          </h2>

          {/* Term Sheet Ready */}
          {accelData.termSheetReady.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 mb-2" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'none', letterSpacing: '0.08em' }}>
                <CheckCircle className="w-3.5 h-3.5" /> Term Sheet Ready ({accelData.termSheetReady.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {accelData.termSheetReady.map(inv => (
                  <TermSheetReadyCard key={inv.investorId} investor={inv} />
                ))}
              </div>
            </div>
          )}

          {/* Immediate Actions */}
          {immediateActions.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 mb-2" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--text-primary)', textTransform: 'none', letterSpacing: '0.08em' }}>
                <AlertTriangle className="w-3.5 h-3.5" /> Immediate ({immediateActions.length})
              </h3>
              <div className="space-y-2">
                {immediateActions.map(item => (
                  <AccelerationCard
                    key={item.id}
                    item={item}
                    onExecute={handleExecuteAcceleration}
                    executing={executedIds.has(item.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* This Week Actions */}
          {thisWeekActions.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 mb-2" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'none', letterSpacing: '0.08em' }}>
                <Clock className="w-3.5 h-3.5" /> This Week ({thisWeekActions.length})
              </h3>
              <div className="space-y-2">
                {thisWeekActions.map(item => (
                  <AccelerationCard
                    key={item.id}
                    item={item}
                    onExecute={handleExecuteAcceleration}
                    executing={executedIds.has(item.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* At Risk */}
          {accelData.atRisk.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 mb-2" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--text-primary)', textTransform: 'none', letterSpacing: '0.08em' }}>
                <Shield className="w-3.5 h-3.5" /> At Risk ({accelData.atRisk.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {accelData.atRisk.map(inv => (
                  <AtRiskCard key={inv.investorId} investor={inv} />
                ))}
              </div>
            </div>
          )}

          {/* Deprioritize */}
          <DeprioritizeSection investors={accelData.deprioritize} />
        </div>
      )}

      {/* Main content: Priority Queue + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Queue */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="section-title flex items-center gap-2">
            <Target className="w-4 h-4" /> Priority Queue
          </h2>
          <div className="space-y-2">
            {priorityQueue.map((item, i) => (
              <PriorityQueueItem key={item.investorId} item={item} rank={i + 1} />
            ))}
          </div>
        </div>

        {/* Sidebar: Quick Wins + Stale Alerts */}
        <div className="space-y-6">
          {/* Quick Wins */}
          {quickWins.length > 0 && (
            <div>
              <h2 className="section-title flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} /> Quick Wins
              </h2>
              <div className="space-y-2">
                {quickWins.map(item => (
                  <QuickWinCard key={item.investorId} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Stale Alerts */}
          {staleAlerts.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 mb-3" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--text-primary)', textTransform: 'none', letterSpacing: '0.08em' }}>
                <AlertTriangle className="w-4 h-4" /> Stale Alerts
              </h2>
              <div className="space-y-2">
                {staleAlerts.map(item => (
                  <StaleAlertCard key={item.investorId} item={item} onReengage={handleReengage} />
                ))}
              </div>
            </div>
          )}

          {/* If no quick wins or stale alerts */}
          {quickWins.length === 0 && staleAlerts.length === 0 && (
            <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
              <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-secondary)' }} />
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>All caught up</p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>No quick wins or stale conversations to flag right now.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

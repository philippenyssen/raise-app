'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { cachedFetch } from '@/lib/cache';
import Link from 'next/link';
import { useToast } from '@/components/toast';
import { EmptyState } from '@/components/ui/empty-state';
import { MS_PER_DAY, relativeTime } from '@/lib/time';
import { STATUS_LABELS, PIPELINE_STATUS_STYLES, MOMENTUM_STYLES, MOMENTUM_LABELS, TRIGGER_STYLES, TRIGGER_LABELS, CONFIDENCE_STYLES, URGENCY_STYLE, TYPE_LABELS_SHORT as TYPE_LABELS } from '@/lib/constants';
import {
  AccelerationItem, AccelerationInvestorSummary as InvestorSummary, AccelerationData,
  ScoreDimension,
} from '@/lib/types';
import {
  Target, Clock, AlertTriangle, Zap, RefreshCw,
  Calendar, CheckCircle, ArrowUpRight, TrendingDown, Timer,
  Rocket, Shield, XCircle, ChevronDown, Play, Ban, BarChart3,
  Star, Eye, Flame, Flag, MessageSquare, Sparkles,
} from 'lucide-react';
import { cardPad4, dimensionBg, dimensionColor, inlineBadgeStyle, labelMuted, labelMuted10, labelMutedTight, labelMutedWide, labelSecondary, labelTertiary, scoreBgStyle as focusScoreBgStyle, scoreColor as focusScoreColor, skelCardSm, stAccent, stBorderTop, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary, INVESTOR_TYPE_STYLES } from '@/lib/styles';
import { TierBadge, EnthusiasmDots } from '@/components/shared';
const mt10 = { marginTop: 'var(--space-3)' } as const;
const dimLabel = { ...labelMutedTight, fontWeight: 400 } as const;
const objItemStyle = { fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', opacity: 0.85 } as const;
const dimScoreStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', fontWeight: 300, minWidth: '20px' };
const dimNameStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 400 };
const iconBoxBase = { width: '28px', height: '28px', borderRadius: 'var(--radius-md)' } as const;
const iconBoxAccent: React.CSSProperties = { ...iconBoxBase, background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-8)' };
const iconBoxSurface: React.CSSProperties = { ...iconBoxBase, background: 'var(--surface-2)', color: 'var(--text-secondary)' };
const alertCardBase = { borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' } as const;
const alertCardSuccess: React.CSSProperties = { ...alertCardBase, background: 'var(--success-muted)' };
const alertCardDanger: React.CSSProperties = { ...alertCardBase, background: 'var(--danger-muted)' };
const impactTextStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', opacity: 0.85, lineHeight: 1.6 };
const riskTextStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', opacity: 0.75, lineHeight: 1.6 };
const metricLabelMt: React.CSSProperties = { marginTop: 'var(--space-0)' };
const SCORE_COMPONENTS: readonly { label: string; key: 'investorScore' | 'urgency' | 'momentumRisk' | 'opportunitySize' | 'actionReadiness'; weight: string }[] = [
  { label: 'Investor Score', key: 'investorScore', weight: '30%' },
  { label: 'Urgency', key: 'urgency', weight: '25%' },
  { label: 'Momentum Risk', key: 'momentumRisk', weight: '20%' },
  { label: 'Opportunity Size', key: 'opportunitySize', weight: '15%' },
  { label: 'Action Readiness', key: 'actionReadiness', weight: '10%' },
];

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
  scoringDimensions?: ScoreDimension[];
  recommendedAction: string;
  timeEstimate: string;
  expectedImpact: string;
  riskIfIgnored: string;
  whyNow?: string;
  topDriver?: string;
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
  'Engagement Velocity': 'VEL',};

function ScoringBreakdown({ dimensions }: { dimensions: ScoreDimension[] }) {
  const [expanded, setExpanded] = useState(false);

  const { sorted, topDimensions, weakest } = useMemo(() => {
    const known = dimensions.filter(d => d.signal !== 'unknown');
    const s = [...known].sort((a, b) => b.score - a.score);
    return { sorted: s, topDimensions: s.slice(0, 3), weakest: s.length > 0 ? s[s.length - 1] : null };
  }, [dimensions]);

  return (
    <div style={mt10}>
      {/* Compact bar visualization */}
      <div className="flex items-center gap-1">
        <button
          onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
          aria-expanded={expanded}
          aria-label="Toggle scoring breakdown"
          className="flex items-center gap-1.5 shrink-0"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <span style={stTextMuted}><BarChart3 className="w-3 h-3" /></span>
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} style={stTextMuted} /></button>
        <div className="flex items-center gap-0.5 flex-1">
          {dimensions.map(d => (
            <div
              key={d.name}
              title={`${d.name}: ${d.score}/100 — ${d.evidence}`}
              style={{
                flex: 1,
                height: '6px',
                borderRadius: 'var(--radius-sm)',
                background: dimensionBg(d.score, d.signal),
                position: 'relative',
                overflow: 'hidden',
                maxWidth: '32px', }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${d.signal === 'unknown' ? 0 : d.score}%`,
                  background: dimensionColor(d.score, d.signal),
                  borderRadius: 'var(--radius-sm)',
                  opacity: 0.85,
                  transition: 'width 300ms ease',
                }} /></div>
          ))}</div>
        {/* Inline top strengths summary */}
        {!expanded && topDimensions.length > 0 && (
          <div className="flex items-center gap-1.5 shrink-0" style={{ marginLeft: 'var(--space-1)' }}>
            {topDimensions.slice(0, 2).map(d => (
              <span
                key={d.name}
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 400,
                  color: dimensionColor(d.score, d.signal),
                  background: dimensionBg(d.score, d.signal),
                  padding: 'var(--space-0) var(--space-1)',
                  borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'nowrap', }}>
                {DIMENSION_SHORT_LABELS[d.name] || d.name.slice(0, 3).toUpperCase()} {d.score}</span>
            ))}
            {weakest && weakest.score < 40 && (
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 400,
                  color: dimensionColor(weakest.score, weakest.signal),
                  background: dimensionBg(weakest.score, weakest.signal),
                  padding: 'var(--space-0) var(--space-1)',
                  borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'nowrap', }}>
                {DIMENSION_SHORT_LABELS[weakest.name] || weakest.name.slice(0, 3).toUpperCase()} {weakest.score}</span>
            )}</div>
        )}</div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="mt-2 space-y-2"
          onClick={e => e.stopPropagation()}
          style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
          {/* Full dimension grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-x-3 gap-y-2">
            {dimensions.map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-0.5">
                  <span style={dimLabel}>
                    {d.name}</span>
                  <span
                    className="tabular-nums"
                    style={{ ...dimScoreStyle, color: dimensionColor(d.score, d.signal) }}>
                    {d.signal === 'unknown' ? '--' : d.score}</span></div>
                <div
                  style={{
                    height: '4px',
                    borderRadius: 'var(--radius-sm)',
                    background: dimensionBg(d.score, d.signal),
                    position: 'relative',
                    overflow: 'hidden', }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${d.signal === 'unknown' ? 0 : d.score}%`,
                      background: dimensionColor(d.score, d.signal),
                      borderRadius: 'var(--radius-sm)',
                      opacity: 0.85,
                    }} /></div></div>
            ))}</div>

          {/* Strengths */}
          {topDimensions.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-2)' }}>
              <div className="flex items-center gap-1 mb-1">
                <span style={stTextSecondary}><Star className="w-3 h-3" /></span>
                <span style={dimLabel}>
                  Strengths</span></div>
              <div className="space-y-1">
                {topDimensions.map(d => (
                  <div key={d.name} className="flex items-start gap-1.5">
                    <span style={{ ...dimScoreStyle, color: dimensionColor(d.score, d.signal), minWidth: '20px' }} className="tabular-nums shrink-0">
                      {d.score}</span>
                    <span style={dimNameStyle}>
                      {d.name}</span>
                    <span style={labelMuted10}>
                      {d.evidence}</span></div>
                ))}</div></div>
          )}

          {/* Weakest */}
          {weakest && weakest.score < 70 && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-2)' }}>
              <div className="flex items-center gap-1 mb-1">
                <span style={stTextTertiary}><Eye className="w-3 h-3" /></span>
                <span style={dimLabel}>
                  Needs Attention</span></div>
              <div className="flex items-start gap-1.5">
                <span style={{ ...dimScoreStyle, color: dimensionColor(weakest.score, weakest.signal), minWidth: '20px' }} className="tabular-nums shrink-0">
                  {weakest.score}</span>
                <span style={dimNameStyle}>
                  {weakest.name}</span>
                <span style={labelMuted10}>
                  {weakest.evidence}</span></div></div>
          )}</div>
      )}
    </div>);
}

// ---------------------------------------------------------------------------
// Focus Components (existing)
// ---------------------------------------------------------------------------

function PriorityQueueItem({ item, rank }: { item: FocusItem; rank: number }) {
  const [expanded, setExpanded] = useState(false);

  const cardStyle: React.CSSProperties = {
    borderRadius: 'var(--radius-lg)',
    background: rank <= 3 ? 'var(--surface-1)' : 'var(--surface-0)',
    transition: 'all 200ms ease',
    ...(expanded ? { boxShadow: '0 0 0 1px var(--border-default)' } : {}),};

  const rankStyle: React.CSSProperties = rank <= 3
    ? { background: 'var(--accent)', color: 'var(--text-primary)' }
    : { background: 'var(--surface-2)', color: 'var(--text-tertiary)' };

  return (
    <div
      className="hover-border"
      style={cardStyle}>
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}>
        {/* Main row */}
        <div className="flex items-start gap-3">
          {/* Rank number */}
          <div
            className="w-8 h-8 flex items-center justify-center shrink-0"
            style={{
              ...rankStyle,
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 300, }}>
            {rank}</div>

          {/* Investor info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/investors/${item.investorId}`}
                onClick={e => e.stopPropagation()}
                className="investor-link"
                style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400 }}>
                {item.investorName}</Link>
              <span style={inlineBadgeStyle(INVESTOR_TYPE_STYLES[item.investorType] ?? INVESTOR_TYPE_STYLES.vc)}>
                {TYPE_LABELS[item.investorType] ?? item.investorType}</span>
              <TierBadge tier={item.investorTier} />
              <span style={inlineBadgeStyle(PIPELINE_STATUS_STYLES[item.status] ?? PIPELINE_STATUS_STYLES.identified)}>
                {STATUS_LABELS[item.status] ?? item.status}</span></div>

            {/* Why Now — intelligence explanation */}
            {item.whyNow && (
              <div className="flex items-start gap-1.5" style={{ marginTop: 'var(--space-1)' }}>
                <span style={{ color: 'var(--accent)', display: 'flex', marginTop: '2px', flexShrink: 0 }}><Sparkles className="w-3 h-3" /></span>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)', fontWeight: 400, lineHeight: 1.5, fontStyle: 'italic' }}>
                  {item.whyNow}</p></div>
            )}

            {/* Recommended action */}
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 400, lineHeight: 1.4, marginTop: 'var(--space-1)' }}>
              {item.recommendedAction}</p>

            {/* Meta row */}
            <div className="flex items-center gap-4 flex-wrap" style={{ marginTop: 'var(--space-2)' }}>
              {/* Deal heat — composite of focus score + momentum */}
              {(() => {
                const momentumBonus = item.momentum === 'accelerating' ? 15 : item.momentum === 'steady' ? 0 : item.momentum === 'decelerating' ? -10 : -20;
                const heat = Math.min(100, Math.max(0, item.focusScore + momentumBonus));
                const heatColor = heat >= 70 ? 'var(--danger)' : heat >= 45 ? 'var(--warning)' : 'var(--text-muted)';
                return (
                  <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: heatColor, fontWeight: 400 }} title={`Deal heat: ${heat}/100`}>
                    <Flame className="w-3 h-3" />
                    {heat}
                  </span>);
              })()}

              {/* Last meeting type + days ago */}
              <span className="flex items-center gap-1" style={labelMuted}>
                <Calendar className="w-3 h-3" />
                {item.daysSinceLastMeeting !== null
                  ? <>
                      {item.lastMeetingType && (
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                          {item.lastMeetingType.replace(/_/g, ' ')}</span>
                      )}
                      {' '}{item.daysSinceLastMeeting}d ago
                    </>
                  : 'No meetings'}</span>

              {/* Momentum */}
              <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', ...(MOMENTUM_STYLES[item.momentum] ?? {}) }}>
                {item.momentum === 'decelerating' || item.momentum === 'stalled'
                  ? <TrendingDown className="w-3 h-3" />
                  : <ArrowUpRight className="w-3 h-3" />
                }
                {MOMENTUM_LABELS[item.momentum]}</span>

              {/* Enthusiasm */}
              <div className="flex items-center gap-1.5">
                <EnthusiasmDots value={item.enthusiasm} /></div>

              {/* Time estimate */}
              <span className="flex items-center gap-1" style={labelMuted}>
                <Timer className="w-3 h-3" />
                {item.timeEstimate}</span>

              {/* Pending tasks */}
              {item.pendingTaskCount > 0 && (
                <span className="flex items-center gap-1" style={labelTertiary}>
                  <AlertTriangle className="w-3 h-3" />
                  {item.pendingTaskCount} task{item.pendingTaskCount !== 1 ? 's' : ''}</span>
              )}

              {/* Open flags */}
              {item.openFlagCount > 0 && (
                <span className="flex items-center gap-1" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)' }}>
                  <Flag className="w-3 h-3" />
                  {item.openFlagCount} flag{item.openFlagCount !== 1 ? 's' : ''}</span>
              )}</div>

            {/* Top objection — the #1 blocker for this deal */}
            {item.topObjectionTopic && (
              <div className="flex items-center gap-1.5" style={{ marginTop: 'var(--space-1)' }}>
                <span style={stTextTertiary}><MessageSquare className="w-3 h-3" /></span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', fontWeight: 400, fontStyle: 'italic' }}>
                  Blocker: {item.topObjectionTopic}</span></div>
            )}

            {/* 11-Dimension Scoring Breakdown */}
            {item.scoringDimensions && item.scoringDimensions.length > 0 && (
              <ScoringBreakdown dimensions={item.scoringDimensions} />
            )}</div>

          {/* Focus score + quick actions */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div
              className="flex flex-col items-center px-3 py-2"
              style={{
                ...focusScoreBgStyle(item.focusScore),
                borderRadius: 'var(--radius-md)', }}>
              <span
                className="tabular-nums"
                style={{ fontSize: 'var(--font-size-xl)', fontWeight: 300, color: focusScoreColor(item.focusScore) }}>
                {item.focusScore}</span>
              <span style={labelMutedWide}>Focus</span></div>
            {/* Quick action buttons — always visible for top 3, on hover for rest */}
              <div className={`flex items-center gap-1${rank > 3 ? ' hover-show-actions' : ''}`} onClick={e => e.stopPropagation()}>
                <Link
                  href={`/meetings/new?investor=${item.investorId}`}
                  title="Schedule meeting"
                  className="flex items-center justify-center hover-accent-fill"
                  style={iconBoxAccent}>
                  <Calendar className="w-3.5 h-3.5" /></Link>
                <Link
                  href={`/meetings/prep?investor=${item.investorId}`}
                  title="Prep meeting"
                  className="flex items-center justify-center hover-accent-subtle"
                  style={iconBoxSurface}>
                  <Zap className="w-3.5 h-3.5" /></Link></div></div></div>

        {/* Impact + Risk row */}
        <div className="flex items-start gap-4 ml-11" style={mt10}>
          <p className="flex-1" style={impactTextStyle}>
            {item.expectedImpact}</p>
          <p className="flex-1" style={riskTextStyle}>
            {item.riskIfIgnored}</p></div></div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 py-3 ml-11 space-y-3" style={stBorderTop}>
          {/* Score breakdown */}
          <div>
            <p style={{ ...labelMutedWide, marginBottom: 'var(--space-2)' }}>Score Breakdown</p>
            <div className="grid grid-cols-5 gap-2">
              {SCORE_COMPONENTS.map(comp => {
                const isDriver = item.topDriver === comp.key;
                return (
                  <div key={comp.key} className="text-center" style={isDriver ? { background: 'var(--accent-muted)', borderRadius: 'var(--radius-md)', padding: 'var(--space-1)' } : { padding: 'var(--space-1)' }}>
                    <div className="tabular-nums" style={{ fontSize: 'var(--font-size-sm)', fontWeight: isDriver ? 400 : 300, color: isDriver ? 'var(--accent)' : focusScoreColor(item.components[comp.key]) }}>{item.components[comp.key]}</div>
                    <div style={{ ...labelMuted, marginTop: 'var(--space-0)', ...(isDriver ? { color: 'var(--accent)' } : {}) }}>{comp.label}{isDriver ? ' *' : ''}</div>
                    <div style={labelMuted}>{comp.weight}</div></div>
                );
              })}</div>
            {item.topDriver && (
              <p style={{ ...labelMuted, marginTop: 'var(--space-1)', fontStyle: 'italic' }}>* Primary driver of this ranking</p>
            )}</div>

          {/* Unresolved objections */}
          {item.unresolvedObjections.length > 0 && (
            <div>
              <p style={{ ...labelMutedWide, marginBottom: 'var(--space-1)' }}>Unresolved Objections</p>
              <div className="space-y-1">
                {item.unresolvedObjections.map((obj) => (
                  <div key={obj} className="flex items-start gap-1.5" style={objItemStyle}>
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                    {obj}</div>
                ))}</div></div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Link
              href={`/meetings/new?investor=${item.investorId}`}
              className="btn btn-primary btn-sm"
              onClick={e => e.stopPropagation()}>
              Schedule Meeting</Link>
            <Link
              href={`/investors/${item.investorId}`}
              className="btn btn-secondary btn-sm"
              onClick={e => e.stopPropagation()}>
              Open Investor</Link></div></div>
      )}
    </div>);
}

function QuickWinCard({ item }: { item: FocusItem }) {
  return (
    <div
      className="card"
      style={cardPad4}>
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-3.5 h-3.5" style={stTextTertiary} />
        <Link
          href={`/investors/${item.investorId}`}
          className="investor-link"
          style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400 }}>
          {item.investorName}</Link>
        <TierBadge tier={item.investorTier} /></div>
      {item.unresolvedObjections.length > 0 ? (
        <>
          <p style={{ ...labelMuted, marginBottom: 'var(--space-1)' }}>Blocker:</p>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', opacity: 0.85, marginBottom: 'var(--space-2)' }}>{item.unresolvedObjections[0]}</p>
          <p style={{ ...labelMuted, marginBottom: 'var(--space-1)' }}>Resolution:</p>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', opacity: 0.85 }} title={item.recommendedAction}>{item.recommendedAction.length > 140 ? item.recommendedAction.substring(0, 137) + '...' : item.recommendedAction}</p>
        </>
      ) : (
        <>
          <p style={{ ...labelMuted, marginBottom: 'var(--space-1)' }}>Opportunity:</p>
          <p style={labelSecondary} title={item.recommendedAction}>{item.recommendedAction.length > 140 ? item.recommendedAction.substring(0, 137) + '...' : item.recommendedAction}</p>
        </>
      )}
      <div className="flex items-center justify-between" style={{ marginTop: 'var(--space-3)' }}>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1" style={labelMuted10}>
            <Timer className="w-3 h-3" /> {item.timeEstimate}</span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: focusScoreColor(item.focusScore) }}>
            Score: {item.focusScore}</span></div>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/meetings/new?investor=${item.investorId}`}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-0) var(--space-2)', borderRadius: 'var(--radius-sm)' }}>
            Schedule</Link>
          <Link
            href={`/investors/${item.investorId}`}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-0) var(--space-2)', borderRadius: 'var(--radius-sm)' }}>
            Open</Link></div></div>
    </div>);
}

function StaleAlertCard({ item, onReengage, pending }: { item: FocusItem; onReengage: (item: FocusItem) => void; pending?: boolean }) {
  return (
    <div
      style={alertCardDanger}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" style={stTextPrimary} />
          <Link
            href={`/investors/${item.investorId}`}
            className="investor-link"
            style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400 }}>
            {item.investorName}</Link>
          <span style={inlineBadgeStyle(PIPELINE_STATUS_STYLES[item.status] ?? PIPELINE_STATUS_STYLES.identified)}>
            {STATUS_LABELS[item.status]}</span></div>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', fontWeight: 300 }}>
          {item.daysSinceLastMeeting !== null ? `${item.daysSinceLastMeeting}d` : '--'}</span></div>
      <div className="flex items-center gap-3 mb-3">
        <span style={labelMuted}>Last enthusiasm:</span>
        <EnthusiasmDots value={item.enthusiasm} />
        <span style={{ fontSize: 'var(--font-size-xs)', ...(MOMENTUM_STYLES[item.momentum] ?? {}) }}>
          {MOMENTUM_LABELS[item.momentum]}</span></div>
      <button
        onClick={() => onReengage(item)}
        disabled={pending}
        className="btn btn-danger btn-sm w-full"
        style={pending ? { opacity: 0.5, cursor: 'default' } : { opacity: 0.9 }}>
        {pending ? 'Creating...' : 'Create Re-engagement Task'}</button>
    </div>);
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
      style={cardPad4}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Header: investor name + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Link
              href={`/investors/${item.investorId}`}
              className="investor-link"
              style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400 }}>
              {item.investorName}</Link>
            <TierBadge tier={item.investorTier} />
            <span style={inlineBadgeStyle(TRIGGER_STYLES[item.triggerType] ?? TRIGGER_STYLES.stall_risk)}>
              {TRIGGER_LABELS[item.triggerType] ?? item.triggerType}</span>
            <span style={inlineBadgeStyle(CONFIDENCE_STYLES[item.confidence] ?? CONFIDENCE_STYLES.medium)}>
              {item.confidence} confidence</span></div>

          {/* Description */}
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-2)' }}>
            {item.description}</p>

          {/* Meta row */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1" style={labelMuted}>
              <Timer className="w-3 h-3" />
              {item.timeEstimate}</span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', opacity: 0.85 }}>
              +{item.expectedLift} pts expected</span>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, ...(URGENCY_STYLE[item.urgency] ?? { color: 'var(--text-tertiary)' }) }}>
              {item.urgency === 'immediate' ? 'Act now' : item.urgency === '48h' ? 'Within 48h' : item.urgency === 'this_week' ? 'This week' : 'Next week'}
            </span>
            <span style={labelMuted10}>
              {item.triggerEvidence}</span></div></div>

        {/* Execute button */}
        <button
          onClick={() => onExecute(item)}
          disabled={executing}
          className="btn btn-primary btn-sm shrink-0 flex items-center gap-1.5"
          style={executing ? { background: 'var(--surface-2)', color: 'var(--text-muted)', cursor: 'default' } : {}}>
          <Play className="w-3 h-3" />
          {executing ? 'Done' : 'Execute'}
        </button></div>
    </div>);
}

function TermSheetReadyCard({ investor }: { investor: InvestorSummary }) {
  return (
    <div
      style={alertCardSuccess}>
      <div className="flex items-center gap-2 mb-2">
        <Rocket className="w-3.5 h-3.5" style={stTextSecondary} />
        <Link
          href={`/investors/${investor.investorId}`}
          className="investor-link"
          style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400 }}>
          {investor.investorName}</Link>
        <TierBadge tier={investor.investorTier} />
        <span style={inlineBadgeStyle(PIPELINE_STATUS_STYLES[investor.status] ?? PIPELINE_STATUS_STYLES.identified)}>
          {STATUS_LABELS[investor.status] ?? investor.status}</span></div>
      <div className="flex items-center gap-3 mb-2">
        <span style={labelMuted}>
          Score: <span style={{ color: 'var(--text-secondary)', fontWeight: 300 }}>{investor.score}</span>/100</span>
        <span style={{ fontSize: 'var(--font-size-xs)', ...(MOMENTUM_STYLES[investor.momentum] ?? {}) }}>
          {MOMENTUM_LABELS[investor.momentum]}</span>
        <EnthusiasmDots value={investor.enthusiasm} /></div>
      <p style={labelTertiary}>{investor.reason}</p>
      <div className="flex items-center gap-2" style={mt10}>
        <Link
          href={`/meetings/prep?investor=${investor.investorId}`}
          className="btn btn-primary btn-sm flex-1"
          style={{ fontSize: 'var(--font-size-xs)' }}>
          Prep Meeting</Link>
        <Link
          href={`/investors/${investor.investorId}`}
          className="btn btn-secondary btn-sm flex-1"
          style={{ fontSize: 'var(--font-size-xs)' }}>
          View Deal</Link></div>
    </div>);
}

function AtRiskCard({ investor }: { investor: InvestorSummary }) {
  return (
    <div
      style={alertCardDanger}>
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-3.5 h-3.5" style={stTextPrimary} />
        <Link
          href={`/investors/${investor.investorId}`}
          className="investor-link"
          style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400 }}>
          {investor.investorName}</Link>
        <TierBadge tier={investor.investorTier} /></div>
      <div className="flex items-center gap-3 mb-2">
        <span style={labelMuted}>
          Score: <span style={{ color: 'var(--text-primary)', fontWeight: 300 }}>{investor.score}</span>/100</span>
        <span style={{ fontSize: 'var(--font-size-xs)', ...(MOMENTUM_STYLES[investor.momentum] ?? {}) }}>
          {MOMENTUM_LABELS[investor.momentum]}</span>
        <EnthusiasmDots value={investor.enthusiasm} /></div>
      <p style={labelTertiary}>{investor.reason}</p>
      <div className="flex items-center gap-2" style={mt10}>
        <Link
          href={`/meetings/new?investor=${investor.investorId}`}
          className="btn btn-sm flex-1 flex items-center justify-center gap-1"
          style={{ fontSize: 'var(--font-size-xs)', background: 'var(--fg-6)', color: 'var(--text-primary)', border: '1px solid var(--fg-6)' }}>
          Re-engage</Link>
        <Link
          href={`/investors/${investor.investorId}`}
          className="btn btn-secondary btn-sm flex-1"
          style={{ fontSize: 'var(--font-size-xs)' }}>
          View Deal</Link></div>
    </div>);
}

function DeprioritizeSection({ investors }: { investors: InvestorSummary[] }) {
  const [expanded, setExpanded] = useState(false);

  if (investors.length === 0) return null;

  return (
    <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left hover-row"
        style={{ background: 'transparent' }}>
        <div className="flex items-center gap-2">
          <Ban className="w-3.5 h-3.5" style={stTextMuted} />
          <span style={{ ...labelMutedWide, fontWeight: 400 }}>
            Deprioritize ({investors.length})</span></div>
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} style={stTextMuted} /></button>
      {expanded && (
        <div className="p-3 space-y-2" style={stBorderTop}>
          {investors.map(inv => (
            <div key={inv.investorId} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <XCircle className="w-3 h-3" style={stTextMuted} />
                <Link
                  href={`/investors/${inv.investorId}`}
                  className="investor-link"
                  style={labelTertiary}>
                  {inv.investorName}</Link>
                <TierBadge tier={inv.investorTier} /></div>
              <span style={labelMuted10}>{inv.reason}</span></div>
          ))}
          <p style={{ ...labelMuted, marginTop: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
            Park these for now. Redirect time to higher-conviction conversations.</p></div>
      )}
    </div>);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FocusPage() {
  const { toast } = useToast();
  const [data, setData] = useState<FocusData | null>(null);
  const [accelData, setAccelData] = useState<AccelerationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setAccelLoading] = useState(true);
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setAccelLoading(true);
    try {
      const [focusRes, accelRes] = await Promise.all([
        cachedFetch('/api/focus'),
        cachedFetch('/api/acceleration'),]);
      if (focusRes.ok) { setData(await focusRes.json()); setLoadedAt(new Date().toISOString()); }
      if (accelRes.ok) setAccelData(await accelRes.json());
    } catch (e) {
      console.warn('[FOCUS_FETCH]', e instanceof Error ? e.message : e);
      toast('Couldn\'t load focus data — try refreshing the page', 'error');
    } finally {
      setLoading(false);
      setAccelLoading(false);
    }
  }, [toast]);

  useEffect(() => { document.title = 'Raise | CEO Focus'; }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchData(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fetchData]);

  async function handleReengage(item: FocusItem) {
    const key = `reengage-${item.investorId}`;
    if (pendingIds.has(key)) return;
    setPendingIds(prev => new Set(prev).add(key));
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Re-engage ${item.investorName}${item.daysSinceLastMeeting != null ? ` — ${item.daysSinceLastMeeting}d since last contact` : ''}`,
          description: `Process is ${item.momentum}. Last enthusiasm: ${item.enthusiasm}/5.\n\nRecommended: ${item.recommendedAction}`,
          assignee: '',
          due_date: new Date(Date.now() + 2 * MS_PER_DAY).toISOString().split('T')[0],
          status: 'pending',
          priority: 'critical',
          phase: 'outreach',
          investor_id: item.investorId,
          investor_name: item.investorName,
          auto_generated: true,
        }),});
      if (!res.ok) throw new Error('Failed to create task');
      toast(`Re-engagement task created for ${item.investorName}`);
    } catch (e) {
      console.warn('[FOCUS_TASK]', e instanceof Error ? e.message : e);
      toast('Couldn\'t create task — check your connection and retry', 'error');
    } finally {
      setPendingIds(prev => { const next = new Set(prev); next.delete(key); return next; });
    }}

  async function handleExecuteAcceleration(item: AccelerationItem) {
    if (pendingIds.has(item.id)) return;
    setPendingIds(prev => new Set(prev).add(item.id));
    try {
      const res = await fetch('/api/acceleration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          status: 'executed',
        }),});
      if (!res.ok) throw new Error('Failed to mark action as executed');
      setExecutedIds(prev => new Set(prev).add(item.id));
      toast(`Action executed for ${item.investorName}`);
    } catch (e) {
      console.warn('[FOCUS_ACCEL]', e instanceof Error ? e.message : e);
      toast('Couldn\'t update action — check your connection and retry', 'error');
    } finally {
      setPendingIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
    }}

  // Group acceleration items by urgency — must be before early returns (React hooks ordering)
  const { immediateActions, thisWeekActions } = useMemo(() => {
    const accels = accelData?.accelerations ?? [];
    const immediate: typeof accels = [];
    const week: typeof accels = [];
    for (const a of accels) {
      if (executedIds.has(a.id)) continue;
      if (a.urgency === 'immediate') immediate.push(a);
      else if (a.urgency === '48h' || a.urgency === 'this_week') week.push(a);
    }
    return { immediateActions: immediate, thisWeekActions: week };
  }, [accelData?.accelerations, executedIds]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton" style={{ height: '32px', width: '192px' }} />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ranking investors by priority...</p>
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton" style={skelCardSm} />
          ))}</div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '128px', borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>);
  }

  if (!data || data.priorityQueue.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">CEO Focus</h1>
        <EmptyState
          icon={Target}
          title="Your daily priority queue is empty"
          description="The focus queue ranks investors by urgency, momentum risk, and opportunity size. Add investors and log meetings to generate your prioritized action list."
          action={{ label: 'Add investors to your pipeline', href: '/investors' }} />
      </div>);
  }

  const { priorityQueue, quickWins, staleAlerts, weeklyBudget } = data;
  const hasAccelerationData = accelData && accelData.accelerations.length > 0;

  return (
    <div className="page-content space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">CEO Focus</h1>
          <p className="page-subtitle">
            Investors ranked by urgency and opportunity — {weeklyBudget.totalHoursRecommended}h recommended this week{loadedAt ? ` · Updated ${relativeTime(loadedAt)}` : ''}</p></div>
        <button
          onClick={fetchData}
          className="btn btn-secondary btn-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh</button></div>

      {/* Weekly Budget Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 card-stagger">
        <div className="card-metric" style={cardPad4}>
          <div className="flex items-center gap-2 mb-1" style={labelMuted}>
            <Clock className="w-3.5 h-3.5" /> Total Time</div>
          <div className="metric-value">{weeklyBudget.totalHoursRecommended}h</div>
          <div className="metric-label" style={metricLabelMt}>recommended this week</div></div>
        <div className="card-metric" style={cardPad4}>
          <div className="flex items-center gap-2 mb-1" style={labelMuted}>
            <Calendar className="w-3.5 h-3.5" /> Meetings</div>
          <div className="metric-value">{weeklyBudget.meetingsRecommended}</div>
          <div className="metric-label" style={metricLabelMt}>calls & meetings</div></div>
        <div className="card-metric" style={cardPad4}>
          <div className="flex items-center gap-2 mb-1" style={labelMuted}>
            <CheckCircle className="w-3.5 h-3.5" /> Follow-ups</div>
          <div className="metric-value">{weeklyBudget.followUpsRecommended}</div>
          <div className="metric-label" style={metricLabelMt}>prep & outreach</div></div>
        <div className="card-metric" style={cardPad4}>
          <div className="flex items-center gap-2 mb-1" style={labelMuted}>
            <Rocket className="w-3.5 h-3.5" /> Acceleration</div>
          <div className="metric-value">{accelData?.summary.total ?? 0}</div>
          <div className="metric-label" style={metricLabelMt}>
            {accelData?.summary.immediate ?? 0} immediate</div></div></div>

      {/* Deal Acceleration Engine */}
      {hasAccelerationData && (
        <div className="space-y-4">
          <h2 className="section-title flex items-center gap-2">
            <Rocket className="w-4 h-4" style={stAccent} /> Deal Acceleration Engine</h2>

          {/* Term Sheet Ready */}
          {accelData.termSheetReady.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 mb-2" style={{ ...labelMutedWide, fontWeight: 400, color: 'var(--text-secondary)' }}>
                <CheckCircle className="w-3.5 h-3.5" /> Term Sheet Ready ({accelData.termSheetReady.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {accelData.termSheetReady.map(inv => (
                  <TermSheetReadyCard key={inv.investorId} investor={inv} />
                ))}</div></div>
          )}

          {/* Immediate Actions */}
          {immediateActions.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 mb-2" style={{ ...labelMutedWide, fontWeight: 400, color: 'var(--text-primary)' }}>
                <AlertTriangle className="w-3.5 h-3.5" /> Immediate ({immediateActions.length})</h3>
              <div className="space-y-2">
                {immediateActions.map(item => (
                  <AccelerationCard
                    key={item.id}
                    item={item}
                    onExecute={handleExecuteAcceleration}
                    executing={executedIds.has(item.id) || pendingIds.has(item.id)} />
                ))}</div></div>
          )}

          {/* This Week Actions */}
          {thisWeekActions.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 mb-2" style={{ ...labelMutedWide, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                <Clock className="w-3.5 h-3.5" /> This Week ({thisWeekActions.length})</h3>
              <div className="space-y-2">
                {thisWeekActions.map(item => (
                  <AccelerationCard
                    key={item.id}
                    item={item}
                    onExecute={handleExecuteAcceleration}
                    executing={executedIds.has(item.id) || pendingIds.has(item.id)} />
                ))}</div></div>
          )}

          {/* At Risk */}
          {accelData.atRisk.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 mb-2" style={{ ...labelMutedWide, fontWeight: 400, color: 'var(--text-primary)' }}>
                <Shield className="w-3.5 h-3.5" /> At Risk ({accelData.atRisk.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {accelData.atRisk.map(inv => (
                  <AtRiskCard key={inv.investorId} investor={inv} />
                ))}</div></div>
          )}

          {/* Deprioritize */}
          <DeprioritizeSection investors={accelData.deprioritize} /></div>
      )}

      {/* Main content: Priority Queue + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Queue */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="section-title flex items-center gap-2">
            <Target className="w-4 h-4" /> Priority Queue</h2>
          <div className="space-y-2">
            {priorityQueue.map((item, i) => (
              <PriorityQueueItem key={item.investorId} item={item} rank={i + 1} />
            ))}</div></div>

        {/* Sidebar: Quick Wins + Stale Alerts */}
        <div className="space-y-6">
          {/* Quick Wins */}
          {quickWins.length > 0 && (
            <div>
              <h2 className="section-title flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4" style={stTextTertiary} /> Quick Wins</h2>
              <div className="space-y-2">
                {quickWins.map(item => (
                  <QuickWinCard key={item.investorId} item={item} />
                ))}</div></div>
          )}

          {/* Stale Alerts */}
          {staleAlerts.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 mb-3" style={{ ...labelMutedWide, fontWeight: 400, color: 'var(--text-primary)' }}>
                <AlertTriangle className="w-4 h-4" /> Stale Alerts</h2>
              <div className="space-y-2">
                {staleAlerts.map(item => (
                  <StaleAlertCard key={item.investorId} item={item} onReengage={handleReengage} pending={pendingIds.has(`reengage-${item.investorId}`)} />
                ))}</div></div>
          )}

          {/* If no quick wins or stale alerts */}
          {quickWins.length === 0 && staleAlerts.length === 0 && (
            <EmptyState icon={CheckCircle} title="All caught up" description="No quick wins or stale conversations to flag right now." />
          )}</div></div>
    </div>);
}

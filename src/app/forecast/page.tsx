'use client';

import { useEffect, useMemo, useState } from 'react';
import { cachedFetch } from '@/lib/cache';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';
import {
  BarChart3, TrendingUp, AlertTriangle, Shield, Clock,
  CheckCircle2, Target, ArrowRight, Users, Zap, ToggleLeft, ToggleRight, RotateCcw,
  Calendar, ExternalLink,
} from 'lucide-react';
import { STATUS_LABELS as STAGE_LABELS } from '@/lib/constants';
import { fmtDate, fmtDateShort } from '@/lib/format';
import { relativeTime } from '@/lib/time';
import { cellPad, confidenceBg, confidenceColor, labelMuted, labelMuted10, labelSecondary, labelTertiary, maxWidthCenter, cellCenter, stAccent, stFontSm, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary } from '@/lib/styles';

const mbSpace3 = { marginBottom: 'var(--space-3)' } as const;
const mbSpace6 = { marginBottom: 'var(--space-6)' } as const;
const padSpace5 = { padding: 'var(--space-5)' } as const;
const fontSmPrimary = { ...stFontSm, fontWeight: 400, color: 'var(--text-primary)' } as const;
const cellPad34 = cellPad;
const progressTrack = { flex: 1, height: '6px', background: 'var(--surface-3)', borderRadius: '3px', overflow: 'hidden' } as const;
const critPathItem = { display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)' } as const;
const critPathBadge = { width: '18px', height: '18px', borderRadius: '50%', background: 'var(--warning-muted)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--font-size-xs)', fontWeight: 300, flexShrink: 0 } as const;
const critPathLink = { fontSize: 'var(--font-size-xs)', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none', display: 'block' } as const;
const critPathAction = { width: '24px', height: '24px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-muted)', color: 'var(--text-tertiary)', textDecoration: 'none' } as const;
const confGroupName = { fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' } as const;
const confGroupStage = { ...labelMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 } as const;
const tierBadgeBase: React.CSSProperties = { width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--font-size-xs)', fontWeight: 300, flexShrink: 0 };
const tierHighStyle: React.CSSProperties = { ...tierBadgeBase, background: 'var(--accent)', color: 'var(--text-primary)' };
const tierLowStyle: React.CSSProperties = { ...tierBadgeBase, background: 'var(--surface-3)', color: 'var(--text-secondary)' };
const scenarioAmount: React.CSSProperties = { fontSize: 'var(--font-size-2xl)', fontWeight: 300, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', marginBottom: 'var(--space-1)' };
const scenarioFooter: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-2)' };
const distBarTrack: React.CSSProperties = { height: '6px', background: 'var(--surface-3)', borderRadius: '3px', overflow: 'hidden' };

const DIST_CONFIG = [
  { label: 'High', key: 'high' as const, color: 'var(--text-secondary)', bg: 'var(--success-muted)' },
  { label: 'Medium', key: 'medium' as const, color: 'var(--text-tertiary)', bg: 'var(--warning-muted)' },
  { label: 'Low', key: 'low' as const, color: 'var(--text-primary)', bg: 'var(--danger-muted)' },
] as const;

const CONF_GROUP_CONFIG = [
  { label: 'High Confidence', key: 'high' as const, color: 'var(--text-secondary)', bg: 'var(--success-muted)', icon: CheckCircle2 },
  { label: 'Medium Confidence', key: 'medium' as const, color: 'var(--text-tertiary)', bg: 'var(--warning-muted)', icon: Clock },
  { label: 'Low Confidence', key: 'low' as const, color: 'var(--text-primary)', bg: 'var(--danger-muted)', icon: AlertTriangle },
] as const;

const riskFactorBox: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'var(--danger-muted)', borderRadius: 'var(--radius-sm)', textDecoration: 'none' } as const;
const riskIconStyle: React.CSSProperties = { color: 'var(--text-primary)', marginTop: '2px', flexShrink: 0 } as const;
const riskTextStyle: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 } as const;
const riskArrowStyle: React.CSSProperties = { color: 'var(--text-primary)', marginTop: '2px', flexShrink: 0, opacity: 0.6 } as const;

interface InvestorForecast { investorId: string; investorName: string; currentStage: string; tier: number; daysInStage: number; predictedDaysToClose: number; predictedCloseDate: string; confidence: 'high' | 'medium' | 'low'; reasoning: string }

interface RaiseForecast { forecasts: InvestorForecast[]; expectedCloseDate: string; expectedAmount: number; confidence: 'high' | 'medium' | 'low'; criticalPathInvestors: string[]; riskFactors: string[] }

interface Scenario { label: string; description: string; amount: number; investorCount: number; closeDate: string }

interface ForecastData { forecast: RaiseForecast; raiseTarget: number; currency: string; companyName: string; roundType: string; amounts: { committed: number; expected: number; bestCase: number; worstCase: number }; distribution: { high: number; medium: number; low: number }; scenarios: { best: Scenario; base: Scenario; worst: Scenario }; generated_at: string }

function formatAmount(value: number, currency: string): string {
  const sym = currency === 'USD' ? '$' : currency === 'GBP' ? '\u00a3' : '\u20ac';
  if (value >= 1_000_000_000) return `${sym}${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `${sym}${(value / 1_000).toFixed(0)}K`;
  return `${sym}${value}`;
}

function tierCapital(tier: number): number {
  if (tier === 1) return 50_000_000;
  if (tier === 2) return 25_000_000;
  if (tier === 3) return 10_000_000;
  return 5_000_000;
}

export default function ForecastPage() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  function fetchForecast() {
    setLoading(true);
    setError(null);
    cachedFetch('/api/forecast')
      .then(res => {
        if (!res.ok) throw new Error('Unable to load forecast — add investors to your pipeline, then refresh');
        return res.json();})
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { document.title = 'Raise | Forecast'; }, []);
  useEffect(() => { fetchForecast(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchForecast(); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const hasExclusions = excludedIds.size > 0;
  const whatIf = useMemo(() => {
    if (!data || !hasExclusions) return null;
    let committedAmt = 0, highAmt = 0, medAmt = 0, bestCaseAmt = 0;
    let highCount = 0, medCount = 0, lowCount = 0, excludedCapital = 0;
    for (const f of data.forecast.forecasts) {
      if (excludedIds.has(f.investorId)) { excludedCapital += tierCapital(f.tier); continue; }
      const cap = tierCapital(f.tier);
      bestCaseAmt += cap;
      if (f.currentStage === 'term_sheet' || f.currentStage === 'closed') committedAmt += cap;
      if (f.confidence === 'high') { highAmt += cap; highCount++; }
      else if (f.confidence === 'medium') { medAmt += cap; medCount++; }
      else if (f.confidence === 'low') { lowCount++; }
    }
    return {
      expected: committedAmt + highAmt + medAmt * 0.5, bestCase: bestCaseAmt, committed: committedAmt,
      excludedCapital, excludedCount: excludedIds.size,
      high: highCount, medium: medCount, low: lowCount,};
  }, [data, hasExclusions, excludedIds]);

  if (loading) {
    return (
      <div className="flex-1 p-6 page-content" style={maxWidthCenter}>
        <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-8)' }}>
          <div className="skeleton" style={{ width: '200px', height: '32px' }} /></div>
        <p className="text-xs" style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>Calculating close probabilities and timelines...</p>
        <div className="card skeleton" style={{ height: '120px', marginBottom: 'var(--space-6)' }} />
        <div className="grid grid-cols-3 gap-4" style={mbSpace6}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card skeleton" style={{ height: '140px' }} />
          ))}</div>
        <div className="card skeleton" style={{ height: '400px' }} />
      </div>);
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6 page-content" style={maxWidthCenter}>
        <EmptyState
          icon={AlertTriangle}
          title="Unable to load forecast"
          description={error || 'Add investors to your pipeline, then refresh.'}
          action={{ label: 'Retry', onClick: fetchForecast }} />
      </div>);
  }

  const { forecast, raiseTarget, currency, amounts, distribution, scenarios } = data;

  const effectiveExpected = whatIf ? whatIf.expected : amounts.expected;
  const effectiveCommitted = whatIf ? whatIf.committed : amounts.committed;

  const totalActive = forecast.forecasts.length;
  const targetDisplay = raiseTarget > 0 ? formatAmount(raiseTarget, currency) : 'Not set';
  const progressPct = raiseTarget > 0 ? Math.min(100, Math.round((effectiveExpected / raiseTarget) * 100)) : 0;
  const committedPct = raiseTarget > 0 ? Math.min(100, Math.round((effectiveCommitted / raiseTarget) * 100)) : 0;

  const { highConfInvestors, medConfInvestors, lowConfInvestors, sortedByDate, maxDaysToClose } = useMemo(() => {
    const high: typeof forecast.forecasts = [];
    const med: typeof forecast.forecasts = [];
    const low: typeof forecast.forecasts = [];
    let maxDays = 1;
    for (const f of forecast.forecasts) {
      if (f.confidence === 'high') high.push(f);
      else if (f.confidence === 'medium') med.push(f);
      else low.push(f);
      if (f.predictedDaysToClose > maxDays) maxDays = f.predictedDaysToClose;
    }
    const sorted = [...forecast.forecasts].sort(
      (a, b) => new Date(a.predictedCloseDate).getTime() - new Date(b.predictedCloseDate).getTime());
    return { highConfInvestors: high, medConfInvestors: med, lowConfInvestors: low, sortedByDate: sorted, maxDaysToClose: maxDays };
  }, [forecast.forecasts]);

  return (
    <div className="page-content flex-1 p-6" style={maxWidthCenter}>
      {/* Header */}
      <div className="flex items-center justify-between" style={mbSpace6}>
        <div>
          <h1 className="page-title">Raise Forecast</h1>
          <p className="page-subtitle">
            {totalActive} active investor{totalActive !== 1 ? 's' : ''} &middot; Expected close {fmtDate(forecast.expectedCloseDate)}
            {data.generated_at && <> &middot; <span style={stTextMuted}>{relativeTime(data.generated_at)}</span></>}
          </p></div>
        <div className="flex items-center gap-2">
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 400,
              background: confidenceBg(forecast.confidence),
              color: confidenceColor(forecast.confidence),
              letterSpacing: '0.01em', }}>
            <Shield className="w-3 h-3" />
            {forecast.confidence} confidence</span></div></div>

      {/* Raise Target Progress */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)' }}>
        <div className="flex items-center justify-between" style={mbSpace3}>
          <div className="flex items-center gap-2">
            <span style={stAccent}><Target className="w-4 h-4" /></span>
            <span style={fontSmPrimary}>
              Raise Target Progress</span></div>
          <div className="flex items-center gap-4">
            <span style={labelMuted}>
              Target: {targetDisplay}</span></div></div>

        {/* Progress bar with committed + expected */}
        <div style={{ position: 'relative', marginBottom: 'var(--space-3)' }}>
          <div style={{ width: '100%', height: '28px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${progressPct}%`, background: 'var(--accent-muted)', borderRadius: 'var(--radius-md)', transition: 'width 600ms ease' }} />
            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${committedPct}%`, background: 'var(--accent)', borderRadius: 'var(--radius-md)', transition: 'width 600ms ease' }} />
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 'var(--font-size-sm)', fontWeight: 300, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {formatAmount(effectiveExpected, currency)} / {targetDisplay}</div></div></div>

        {/* Legend */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent)' }} />
            <span style={labelTertiary}>
              Committed: {formatAmount(effectiveCommitted, currency)}</span></div>
          <div className="flex items-center gap-2">
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent-muted)' }} />
            <span style={labelTertiary}>
              Expected (weighted): {formatAmount(effectiveExpected, currency)}</span></div>
          {hasExclusions && whatIf && (
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                -{formatAmount(whatIf.excludedCapital, currency)} ({whatIf.excludedCount} excluded)</span></div>
          )}
          <div className="flex items-center gap-2" style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
              {progressPct}% of target</span></div></div></div>

      {/* Scenario Cards */}
      <div className="grid grid-cols-3 gap-4" style={mbSpace6}>
        {(['worst', 'base', 'best'] as const).map((key) => {
          const s = scenarios[key];
          const iconColor = key === 'best' ? 'var(--text-secondary)' : key === 'base' ? 'var(--text-secondary)' : 'var(--text-tertiary)';
          const Icon = key === 'best' ? TrendingUp : key === 'base' ? BarChart3 : AlertTriangle;
          return (
            <div
              key={key}
              className="card hover-row"
              style={padSpace5}>
              <div className="flex items-center gap-2" style={mbSpace3}>
                <span style={{ color: iconColor }}>
                  <Icon className="w-4 h-4" /></span>
                <span style={fontSmPrimary}>
                  {s.label}</span></div>
              <div style={scenarioAmount}>
                {formatAmount(s.amount, currency)}</div>
              <div style={{ ...labelMuted, marginBottom: 'var(--space-2)' }}>
                {s.description}</div>
              <div style={scenarioFooter}>
                <span>{s.investorCount} investor{s.investorCount !== 1 ? 's' : ''}</span>
                <span>{fmtDateShort(s.closeDate)}</span></div>
            </div>);
        })}</div>

      <div className="grid grid-cols-3 gap-4" style={mbSpace6}>
        {/* Confidence Distribution */}
        <div className="card" style={padSpace5}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-4)' }}>
            <span style={stTextTertiary}><Shield className="w-4 h-4" /></span>
            <span style={fontSmPrimary}>
              Confidence Distribution</span></div>
          {DIST_CONFIG.map(({ label, key, color, bg }) => {
            const count = distribution[key];
            return (
            <div key={label} style={mbSpace3}>
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-1)' }}>
                <span style={labelSecondary}>{label}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color, fontVariantNumeric: 'tabular-nums' }}>
                  {count}</span></div>
              <div style={distBarTrack}>
                <div
                  style={{
                    width: totalActive > 0 ? `${(count / totalActive) * 100}%` : '0%',
                    height: '100%',
                    background: bg,
                    borderRadius: '3px',
                    transition: 'width 400ms ease',
                    border: `1px solid ${color}`,
                  }} /></div></div>
          ); })}</div>

        {/* Critical Path */}
        <div className="card" style={padSpace5}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-4)' }}>
            <span style={stTextTertiary}><Zap className="w-4 h-4" /></span>
            <span style={fontSmPrimary}>
              Critical Path</span></div>
          <p style={{ ...labelMuted, marginBottom: 'var(--space-3)' }}>
            Investors whose delay would delay the raise</p>
          {forecast.criticalPathInvestors.length === 0 ? (
            <span style={labelMuted}>No bottlenecks — all investors progressing on schedule</span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {forecast.criticalPathInvestors.map((name, i) => {
                const inv = forecast.forecasts.find(f => f.investorName === name);
                return (
                  <div
                    key={name}
                    style={critPathItem}>
                    <span style={critPathBadge}>
                      {i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        href={inv ? `/investors/${inv.investorId}` : '#'}
                        style={critPathLink}
                        className="investor-link">
                        {name}</Link>
                      {inv && (
                        <div style={labelMuted10}>
                          {STAGE_LABELS[inv.currentStage] || inv.currentStage} &middot; ~{inv.predictedDaysToClose}d</div>
                      )}</div>
                    {inv && (
                      <Link
                        href={`/meetings/new?investor=${inv.investorId}`}
                        title="Schedule meeting"
                        className="flex items-center justify-center shrink-0 hover-bg-fg5"
                        style={critPathAction}>
                        <Calendar className="w-3 h-3" /></Link>
                    )}
                  </div>);
              })}</div>
          )}</div>

        {/* Risk Factors */}
        <div className="card" style={padSpace5}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-4)' }}>
            <span style={stTextPrimary}><AlertTriangle className="w-4 h-4" /></span>
            <span style={fontSmPrimary}>
              Risk Factors</span></div>
          {forecast.riskFactors.length === 0 ? (
            <div className="flex items-center gap-2" style={{ padding: 'var(--space-3)', background: 'var(--success-muted)', borderRadius: 'var(--radius-sm)' }}>
              <span style={stTextSecondary}><CheckCircle2 className="w-3.5 h-3.5" /></span>
              <span style={labelSecondary}>On track — no major risk factors identified</span></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {forecast.riskFactors.map((risk, i) => {
                // Smart routing: derive the best action page from risk content
                const riskLower = risk.toLowerCase();
                const riskLink = riskLower.includes('meeting') || riskLower.includes('stall') ? '/focus'
                  : riskLower.includes('objection') || riskLower.includes('concern') ? '/objections'
                  : riskLower.includes('follow') || riskLower.includes('overdue') ? '/followups'
                  : riskLower.includes('pipeline') || riskLower.includes('funnel') ? '/pipeline'
                  : '/dealflow';
                return (
                  <Link
                    key={i}
                    href={riskLink}
                    className="hover-bg-fg6"
                    style={riskFactorBox}>
                    <span style={riskIconStyle}>
                      <AlertTriangle className="w-3 h-3" /></span>
                    <span style={riskTextStyle}>
                      {risk}</span>
                    <span style={riskArrowStyle}>
                      <ExternalLink className="w-3 h-3" /></span>
                  </Link>);
              })}</div>
          )}</div></div>

      {/* Investor Timeline */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-6)' }}>
        <div
          style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <span style={stTextTertiary}><Clock className="w-4 h-4" /></span>
            <span style={fontSmPrimary}>
              Investor Timeline</span>
            <span style={{ ...labelMuted, marginLeft: 'auto' }}>
              {hasExclusions ? (
                <button
                  onClick={() => setExcludedIds(new Set())}
                  className="flex items-center gap-1 hover-opacity-70"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 400, fontSize: 'var(--font-size-xs)' }}>
                  <RotateCcw className="w-3 h-3" /> Reset what-if</button>
              ) : (
                'Click the toggle icons to exclude investors and see the impact'
              )}</span></div></div>

        {sortedByDate.length === 0 ? (
          <EmptyState icon={Calendar} title="No forecasts yet" description="Add investors to forecast close dates, spot bottlenecks, and stress-test your timeline." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="table-header">
                  <th style={{ minWidth: '40px', textAlign: 'center', width: '40px' }}></th>
                  <th style={{ minWidth: '180px' }}>Investor</th>
                  <th style={{ minWidth: '80px', textAlign: 'right' }}>Est. Capital</th>
                  <th style={{ minWidth: '100px' }}>Stage</th>
                  <th style={{ minWidth: '80px', textAlign: 'center' }}>Days in Stage</th>
                  <th style={{ minWidth: '100px', textAlign: 'center' }}>Predicted Close</th>
                  <th style={{ minWidth: '80px', textAlign: 'center' }}>Days Left</th>
                  <th style={{ minWidth: '80px', textAlign: 'center' }}>Confidence</th>
                  <th style={{ minWidth: '180px' }}>Timeline</th></tr></thead>
              <tbody>
                {sortedByDate.map((inv) => {
                  const isCritical = forecast.criticalPathInvestors.includes(inv.investorName);
                  const isExcluded = excludedIds.has(inv.investorId);
                  const estCapital = tierCapital(inv.tier);
                  return (
                    <tr
                      key={inv.investorId}
                      className="table-row"
                      style={{
                        cursor: 'pointer',
                        opacity: isExcluded ? 0.4 : 1,
                        transition: 'opacity 200ms ease', }}>
                      {/* What-if toggle */}
                      <td style={{ padding: 'var(--space-3) var(--space-2)', textAlign: 'center' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExcludedIds(prev => {
                              const next = new Set(prev);
                              if (next.has(inv.investorId)) next.delete(inv.investorId);
                              else next.add(inv.investorId);
                              return next;
                            }); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          aria-label={isExcluded ? 'Include investor in forecast' : 'Exclude investor from forecast'}
                          title={isExcluded ? 'Include in forecast' : 'Exclude from forecast (what-if)'}>
                          {isExcluded ? (
                            <span style={stTextMuted}><ToggleLeft className="w-5 h-5" /></span>
                          ) : (
                            <span style={stAccent}><ToggleRight className="w-5 h-5" /></span>
                          )}</button></td>

                      {/* Investor */}
                      <td style={cellPad34}>
                        <Link href={`/investors/${inv.investorId}`} style={{ textDecoration: 'none' }}>
                          <div className="flex items-center gap-2">
                            <span style={inv.tier <= 2 ? tierHighStyle : tierLowStyle}>
                              {inv.tier}</span>
                            <div>
                              <div className="flex items-center gap-1">
                                <span style={fontSmPrimary}>
                                  {inv.investorName}</span>
                                {isCritical && (
                                  <span style={stTextTertiary}>
                                    <Zap className="w-3 h-3" /></span>
                                )}</div></div></div></Link></td>

                      {/* Estimated Capital */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                        <span
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 400,
                            color: isExcluded ? 'var(--text-muted)' : 'var(--text-secondary)',
                            fontVariantNumeric: 'tabular-nums',
                            textDecoration: isExcluded ? 'line-through' : 'none', }}>
                          {formatAmount(estCapital, currency)}</span></td>

                      {/* Stage */}
                      <td style={cellPad34}>
                        <span style={labelSecondary}>
                          {STAGE_LABELS[inv.currentStage] || inv.currentStage}</span></td>

                      {/* Days in Stage */}
                      <td style={cellCenter}>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontVariantNumeric: 'tabular-nums', fontWeight: 400, color: inv.daysInStage > 30 ? 'var(--danger)' : inv.daysInStage > 14 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                          {inv.daysInStage}d</span></td>

                      {/* Predicted Close */}
                      <td style={cellCenter}>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtDateShort(inv.predictedCloseDate)}</span></td>

                      {/* Days Left */}
                      <td style={cellCenter}>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontVariantNumeric: 'tabular-nums', fontWeight: 400, color: inv.predictedDaysToClose > 60 ? 'var(--danger)' : inv.predictedDaysToClose > 30 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                          {inv.predictedDaysToClose}d</span></td>

                      {/* Confidence */}
                      <td style={cellCenter}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-xs)', fontWeight: 400, background: confidenceBg(inv.confidence), color: confidenceColor(inv.confidence) }}>
                          {inv.confidence}</span></td>

                      <td style={cellPad34}>
                        <div className="flex items-center gap-2">
                          <div style={progressTrack}>
                            <div style={{ width: maxDaysToClose > 0 ? `${Math.max(4, (inv.predictedDaysToClose / maxDaysToClose) * 100)}%` : '0%', height: '100%', background: confidenceColor(inv.confidence), borderRadius: '3px', transition: 'width 400ms ease', opacity: 0.7 }} />
                          </div>
                          <span style={{ ...labelMuted, minWidth: '32px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {inv.predictedDaysToClose}d</span></div></td>
                    </tr>);
                })}</tbody></table></div>
        )}</div>

      {/* Confidence Groups */}
      <div className="grid grid-cols-3 gap-4" style={mbSpace6}>
        {CONF_GROUP_CONFIG.map(({ label, key, color, bg, icon: Icon }) => {
          const investors = key === 'high' ? highConfInvestors : key === 'medium' ? medConfInvestors : lowConfInvestors;
          return (
          <div key={label} className="card" style={{ padding: 'var(--space-4)' }}>
            <div className="flex items-center gap-2" style={mbSpace3}>
              <span style={{ color }}>
                <Icon className="w-4 h-4" /></span>
              <span style={fontSmPrimary}>
                {label}</span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 400,
                  color,
                  fontVariantNumeric: 'tabular-nums', }}>
                {investors.length}</span></div>
            {investors.length === 0 ? (
              <span style={labelMuted}>
                No investors at this level</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                {investors.map(inv => (
                  <Link
                    key={inv.investorId}
                    href={`/investors/${inv.investorId}`}
                    className="hover-brighten"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: 'var(--radius-sm)',
                      background: bg,
                      textDecoration: 'none', }}>
                    <span style={confGroupName}>
                      {inv.investorName}</span>
                    <span style={confGroupStage}>
                      {STAGE_LABELS[inv.currentStage] || inv.currentStage}</span></Link>
                ))}</div>
            )}</div>
        ); })}</div>

      {/* Footer */}
      <div
        className="flex items-center justify-center gap-2"
        style={{
          marginTop: 'var(--space-6)',
          padding: 'var(--space-3)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-muted)', }}>
        <span style={stTextTertiary}>
          <Users className="w-3 h-3" /></span>
        Forecast updates in real-time based on pipeline stage, tier, enthusiasm, and historical conversion
        <span style={{ margin: '0 var(--space-2)', color: 'var(--border-default)' }}>|</span>
        <Link
          href="/velocity"
          className="flex items-center gap-1"
          style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          View Velocity
          <ArrowRight className="w-3 h-3" /></Link></div>
    </div>);
}

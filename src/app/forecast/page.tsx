'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3, TrendingUp, AlertTriangle, Shield, Clock,
  CheckCircle2, Target, ArrowRight, Users, Zap, ToggleLeft, ToggleRight, RotateCcw,
  Calendar, ExternalLink,
} from 'lucide-react';
import { STATUS_LABELS as STAGE_LABELS } from '@/lib/constants';
import { fmtDate, fmtDateShort } from '@/lib/format';
import { relativeTime } from '@/lib/time';
import { confidenceBg, confidenceColor, labelMuted, labelMuted10, stAccent, stFontSm, stFontXs, stTextMuted, stTextPrimary, stTextSecondary, stTextTertiary } from '@/lib/styles';

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
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredScenario, setHoveredScenario] = useState<string | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  function fetchForecast() {
    setLoading(true);
    setError(null);
    fetch('/api/forecast')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch forecast data');
        return res.json();})
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { fetchForecast(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); fetchForecast(); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const hasExclusions = excludedIds.size > 0;
  const whatIf = useMemo(() => {
    if (!data || !hasExclusions) return null;
    const included = data.forecast.forecasts.filter(f => !excludedIds.has(f.investorId));
    const committed = included.filter(f => f.currentStage === 'term_sheet' || f.currentStage === 'closed');
    const high = included.filter(f => f.confidence === 'high');
    const med = included.filter(f => f.confidence === 'medium');
    const committedAmt = committed.reduce((s, i) => s + tierCapital(i.tier), 0);
    const expectedAmt = high.reduce((s, i) => s + tierCapital(i.tier), 0) + med.reduce((s, i) => s + tierCapital(i.tier), 0) * 0.5;
    const bestCaseAmt = included.reduce((s, i) => s + tierCapital(i.tier), 0);
    const excludedCapital = [...excludedIds].reduce((s, id) => {
      const inv = data.forecast.forecasts.find(f => f.investorId === id);
      return s + (inv ? tierCapital(inv.tier) : 0);
    }, 0);
    return {
      expected: committedAmt + expectedAmt, bestCase: bestCaseAmt, committed: committedAmt,
      excludedCapital, excludedCount: excludedIds.size,
      high: high.length, medium: med.length,
      low: included.filter(f => f.confidence === 'low').length,};
  }, [data, hasExclusions, excludedIds]);

  if (loading) {
    return (
      <div className="flex-1 p-6 page-content" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-8)' }}>
          <div className="skeleton" style={{ width: '200px', height: '32px' }} /></div>
        <div className="card skeleton" style={{ height: '120px', marginBottom: 'var(--space-6)' }} />
        <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 'var(--space-6)' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card skeleton" style={{ height: '140px' }} />
          ))}</div>
        <div className="card skeleton" style={{ height: '400px' }} />
      </div>);
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6 page-content" style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <AlertTriangle className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}>
            {error || 'Forecast data could not be loaded. Ensure investors are added to the pipeline, then try again.'}</p>
          <button onClick={fetchForecast} className="btn btn-secondary btn-sm">Retry</button></div>
      </div>);
  }

  const { forecast, raiseTarget, currency, amounts, distribution, scenarios } = data;

  const effectiveExpected = whatIf ? whatIf.expected : amounts.expected;
  const effectiveCommitted = whatIf ? whatIf.committed : amounts.committed;

  const totalActive = forecast.forecasts.length;
  const targetDisplay = raiseTarget > 0 ? formatAmount(raiseTarget, currency) : 'Not set';
  const progressPct = raiseTarget > 0 ? Math.min(100, Math.round((effectiveExpected / raiseTarget) * 100)) : 0;
  const committedPct = raiseTarget > 0 ? Math.min(100, Math.round((effectiveCommitted / raiseTarget) * 100)) : 0;

  const highConfInvestors = forecast.forecasts.filter(f => f.confidence === 'high');
  const medConfInvestors = forecast.forecasts.filter(f => f.confidence === 'medium');
  const lowConfInvestors = forecast.forecasts.filter(f => f.confidence === 'low');

  const sortedByDate = [...forecast.forecasts].sort(
    (a, b) => new Date(a.predictedCloseDate).getTime() - new Date(b.predictedCloseDate).getTime());

  const maxDaysToClose = Math.max(...forecast.forecasts.map(f => f.predictedDaysToClose), 1);

  return (
    <div className="page-content flex-1 p-6" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-6)' }}>
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
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 400,
              background: confidenceBg(forecast.confidence),
              color: confidenceColor(forecast.confidence),
              letterSpacing: '0.01em', }}>
            <Shield className="w-3 h-3" />
            {forecast.confidence} confidence</span></div></div>

      {/* Raise Target Progress */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
          <div className="flex items-center gap-2">
            <span style={stAccent}><Target className="w-4 h-4" /></span>
            <span style={{ ...stFontSm, fontWeight: 400, color: 'var(--text-primary)' }}>
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
            <span style={{ ...stFontXs, ...stTextTertiary }}>
              Committed: {formatAmount(effectiveCommitted, currency)}</span></div>
          <div className="flex items-center gap-2">
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--accent-muted)' }} />
            <span style={{ ...stFontXs, ...stTextTertiary }}>
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
      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 'var(--space-6)' }}>
        {(['worst', 'base', 'best'] as const).map((key) => {
          const s = scenarios[key];
          const isHovered = hoveredScenario === key;
          const iconColor = key === 'best' ? 'var(--text-secondary)' : key === 'base' ? 'var(--text-secondary)' : 'var(--text-tertiary)';
          const Icon = key === 'best' ? TrendingUp : key === 'base' ? BarChart3 : AlertTriangle;
          return (
            <div
              key={key}
              className="card transition-colors"
              style={{
                padding: 'var(--space-5)',
                background: isHovered ? 'var(--surface-1)' : 'var(--surface-0)',
                transition: 'background 150ms ease', }}
              onMouseEnter={() => setHoveredScenario(key)}
              onMouseLeave={() => setHoveredScenario(null)}>
              <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-3)' }}>
                <span style={{ color: iconColor }}>
                  <Icon className="w-4 h-4" /></span>
                <span style={{ ...stFontSm, fontWeight: 400, color: 'var(--text-primary)' }}>
                  {s.label}</span></div>
              <div
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 300,
                  color: 'var(--text-primary)',
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: 'var(--space-1)', }}>
                {formatAmount(s.amount, currency)}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
                {s.description}</div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-tertiary)',
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: 'var(--space-2)',
                  marginTop: 'var(--space-2)', }}>
                <span>{s.investorCount} investor{s.investorCount !== 1 ? 's' : ''}</span>
                <span>{fmtDateShort(s.closeDate)}</span></div>
            </div>);
        })}</div>

      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 'var(--space-6)' }}>
        {/* Confidence Distribution */}
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-4)' }}>
            <span style={stTextTertiary}><Shield className="w-4 h-4" /></span>
            <span style={{ ...stFontSm, fontWeight: 400, color: 'var(--text-primary)' }}>
              Confidence Distribution</span></div>
          {[
            { label: 'High', count: distribution.high, color: 'var(--text-secondary)', bg: 'var(--success-muted)' },
            { label: 'Medium', count: distribution.medium, color: 'var(--text-tertiary)', bg: 'var(--warning-muted)' },
            { label: 'Low', count: distribution.low, color: 'var(--text-primary)', bg: 'var(--danger-muted)' },
          ].map(({ label, count, color, bg }) => (
            <div key={label} style={{ marginBottom: 'var(--space-3)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-1)' }}>
                <span style={{ ...stFontXs, ...stTextSecondary }}>{label}</span>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color, fontVariantNumeric: 'tabular-nums' }}>
                  {count}</span></div>
              <div style={{ height: '6px', background: 'var(--surface-3)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: totalActive > 0 ? `${(count / totalActive) * 100}%` : '0%',
                    height: '100%',
                    background: bg,
                    borderRadius: '3px',
                    transition: 'width 400ms ease',
                    border: `1px solid ${color}`,
                  }} /></div></div>
          ))}</div>

        {/* Critical Path */}
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-4)' }}>
            <span style={stTextTertiary}><Zap className="w-4 h-4" /></span>
            <span style={{ ...stFontSm, fontWeight: 400, color: 'var(--text-primary)' }}>
              Critical Path</span></div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
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
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-2) var(--space-3)',
                      background: 'var(--surface-1)',
                      borderRadius: 'var(--radius-sm)', }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--warning-muted)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 300, flexShrink: 0 }}>
                      {i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        href={inv ? `/investors/${inv.investorId}` : '#'}
                        style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none', display: 'block' }}
                        className="transition-colors"
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}>
                        {name}</Link>
                      {inv && (
                        <div style={labelMuted10}>
                          {STAGE_LABELS[inv.currentStage] || inv.currentStage} &middot; ~{inv.predictedDaysToClose}d</div>
                      )}</div>
                    {inv && (
                      <Link
                        href={`/meetings/new?investor=${inv.investorId}`}
                        title="Schedule meeting"
                        className="flex items-center justify-center shrink-0 transition-colors"
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--warning-muted)',
                          color: 'var(--text-tertiary)',
                          textDecoration: 'none', }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--fg-5)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--warning-muted)'; }}>
                        <Calendar className="w-3 h-3" /></Link>
                    )}
                  </div>);
              })}</div>
          )}</div>

        {/* Risk Factors */}
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-4)' }}>
            <span style={stTextPrimary}><AlertTriangle className="w-4 h-4" /></span>
            <span style={{ ...stFontSm, fontWeight: 400, color: 'var(--text-primary)' }}>
              Risk Factors</span></div>
          {forecast.riskFactors.length === 0 ? (
            <div className="flex items-center gap-2" style={{ padding: 'var(--space-3)', background: 'var(--success-muted)', borderRadius: 'var(--radius-sm)' }}>
              <span style={stTextSecondary}><CheckCircle2 className="w-3.5 h-3.5" /></span>
              <span style={{ ...stFontXs, ...stTextSecondary }}>On track — no major risk factors identified</span></div>
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
                    className="transition-colors"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-2) var(--space-3)',
                      background: 'var(--danger-muted)',
                      borderRadius: 'var(--radius-sm)',
                      textDecoration: 'none',
                      transition: 'background 150ms ease', }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--fg-6)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--danger-muted)'; }}>
                    <span style={{ color: 'var(--text-primary)', marginTop: '2px', flexShrink: 0 }}>
                      <AlertTriangle className="w-3 h-3" /></span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>
                      {risk}</span>
                    <span style={{ color: 'var(--text-primary)', marginTop: '2px', flexShrink: 0, opacity: 0.6 }}>
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
            <span style={{ ...stFontSm, fontWeight: 400, color: 'var(--text-primary)' }}>
              Investor Timeline</span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {hasExclusions ? (
                <button
                  onClick={() => setExcludedIds(new Set())}
                  className="flex items-center gap-1 transition-opacity"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 400, fontSize: 'var(--font-size-xs)' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                  <RotateCcw className="w-3 h-3" /> Reset what-if</button>
              ) : (
                'Click toggles to model what-if scenarios'
              )}</span></div></div>

        {sortedByDate.length === 0 ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
              Add investors to see your raise trajectory, timing gaps, and close probabilities.</span></div>
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
                      className="table-row transition-colors"
                      style={{
                        background: hoveredRow === inv.investorId ? 'var(--surface-1)' : 'transparent',
                        cursor: 'pointer',
                        opacity: isExcluded ? 0.4 : 1,
                        transition: 'opacity 200ms ease', }}
                      onMouseEnter={() => setHoveredRow(inv.investorId)}
                      onMouseLeave={() => setHoveredRow(null)}>
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
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Link href={`/investors/${inv.investorId}`} style={{ textDecoration: 'none' }}>
                          <div className="flex items-center gap-2">
                            <span
                              style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                fontWeight: 300,
                                flexShrink: 0,
                                ...(inv.tier === 1
                                  ? { background: 'var(--accent)', color: 'var(--text-primary)' }
                                  : inv.tier === 2
                                    ? { background: 'var(--accent)', color: 'var(--text-primary)' }
                                    : { background: 'var(--surface-3)', color: 'var(--text-secondary)' }),}}>
                              {inv.tier}</span>
                            <div>
                              <div className="flex items-center gap-1">
                                <span style={{ ...stFontSm, fontWeight: 400, color: 'var(--text-primary)' }}>
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
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <span style={{ ...stFontXs, ...stTextSecondary }}>
                          {STAGE_LABELS[inv.currentStage] || inv.currentStage}</span></td>

                      {/* Days in Stage */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontVariantNumeric: 'tabular-nums', fontWeight: 400, color: inv.daysInStage > 30 ? 'var(--danger)' : inv.daysInStage > 14 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                          {inv.daysInStage}d</span></td>

                      {/* Predicted Close */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtDateShort(inv.predictedCloseDate)}</span></td>

                      {/* Days Left */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontVariantNumeric: 'tabular-nums', fontWeight: 400, color: inv.predictedDaysToClose > 60 ? 'var(--danger)' : inv.predictedDaysToClose > 30 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                          {inv.predictedDaysToClose}d</span></td>

                      {/* Confidence */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '9999px', fontSize: 'var(--font-size-xs)', fontWeight: 400, background: confidenceBg(inv.confidence), color: confidenceColor(inv.confidence) }}>
                          {inv.confidence}</span></td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div className="flex items-center gap-2">
                          <div style={{ flex: 1, height: '6px', background: 'var(--surface-3)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: maxDaysToClose > 0 ? `${Math.max(4, (inv.predictedDaysToClose / maxDaysToClose) * 100)}%` : '0%', height: '100%', background: confidenceColor(inv.confidence), borderRadius: '3px', transition: 'width 400ms ease', opacity: 0.7 }} />
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', minWidth: '32px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {inv.predictedDaysToClose}d</span></div></td>
                    </tr>);
                })}</tbody></table></div>
        )}</div>

      {/* Confidence Groups */}
      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 'var(--space-6)' }}>
        {[
          { label: 'High Confidence', investors: highConfInvestors, color: 'var(--text-secondary)', bg: 'var(--success-muted)', icon: CheckCircle2 },
          { label: 'Medium Confidence', investors: medConfInvestors, color: 'var(--text-tertiary)', bg: 'var(--warning-muted)', icon: Clock },
          { label: 'Low Confidence', investors: lowConfInvestors, color: 'var(--text-primary)', bg: 'var(--danger-muted)', icon: AlertTriangle },
        ].map(({ label, investors, color, bg, icon: Icon }) => (
          <div key={label} className="card" style={{ padding: 'var(--space-4)' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-3)' }}>
              <span style={{ color }}>
                <Icon className="w-4 h-4" /></span>
              <span style={{ ...stFontSm, fontWeight: 400, color: 'var(--text-primary)' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {investors.map(inv => (
                  <Link
                    key={inv.investorId}
                    href={`/investors/${inv.investorId}`}
                    className="transition-colors"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: 'var(--radius-sm)',
                      background: bg,
                      textDecoration: 'none',
                      transition: 'filter 150ms ease', }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'none'; }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                      {inv.investorName}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {STAGE_LABELS[inv.currentStage] || inv.currentStage}</span></Link>
                ))}</div>
            )}</div>
        ))}</div>

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

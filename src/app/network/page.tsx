'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  RefreshCw, AlertTriangle, ArrowRight, Crown,
  TrendingUp, Users, Link2, ChevronDown, ChevronUp, Calendar,
} from 'lucide-react';
import { STATUS_LABELS } from '@/lib/constants';
import { labelMuted, labelSecondary, probColor, stAccent, stFontSm, stSurface1, stTextMuted, stTextPrimary, stTextTertiary } from '@/lib/styles';

interface CascadeLink { investorId: string; investorName: string; probability: number; cumulativeProbability: number; status: string; tier: number; checkSize: string; capitalM: number; expectedCapitalM: number }

interface CascadeData { keystoneId: string; keystoneName: string; keystoneTier: number; keystoneStatus: string; keystoneEnthusiasm: number; keystoneCheckSize: string; keystoneCapitalM: number; cascadeChain: CascadeLink[]; chainLength: number; totalCascadeProbability: number; totalCascadeCapitalM: number; expectedCascadeCapitalM: number; networkBottleneck: { investorId: string; investorName: string; impactIfPass: number } | null; signal: string }

interface NetworkData { cascades: CascadeData[]; summary: { totalExpectedCapitalM: number; totalInvestorsConnected: number; avgChainLength: number; keystoneCount: number; strongestChain: { name: string; capitalM: number } | null; weakestChain: { name: string; capitalM: number } | null }; bottleneckAlert: { keystoneName: string; bottleneckName: string; impactIfPass: number; capitalAtRiskM: number } | null; generatedAt: string }

function formatCapital(m: number): string {
  if (m === 0) return '--';
  if (m >= 1000) return `${(m / 1000).toFixed(1)}B`;
  if (m >= 1) return `${Math.round(m)}M`;
  return `${Math.round(m * 1000)}K`;
}

function tierLabel(tier: number): string {
  if (tier === 1) return 'T1';
  if (tier === 2) return 'T2';
  return 'T3';
}

function enthusiasmDots(level: number): string {
  return Array.from({ length: 5 }, (_, i) => i < level ? '\u2B24' : '\u25CB').join(' ');
}

export default function NetworkPage() {
  const [data, setData] = useState<NetworkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/network');
      if (!res.ok) throw new Error('Failed to fetch network data');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin" style={stTextMuted} />
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Computing network cascades...</span></div>
      </div>);
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="card p-6 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" style={stTextPrimary} />
          <div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 400 }}>Failed to load network data</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>{error}</p></div>
          <button className="btn-secondary ml-auto" onClick={fetchData} title="Retry loading network data">Retry</button></div>
      </div>);
  }

  if (!data || data.cascades.length === 0) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="page-title">Investor Network</h1></div>
        <div className="card p-8 flex flex-col items-center gap-3" style={{ textAlign: 'center' }}>
          <span style={stTextMuted}><Link2 className="w-8 h-8" /></span>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            No network cascades detected. Add investors and log meetings to build cascade effects.</p>
          <Link
            href="/investors"
            className="btn btn-primary btn-sm"
            style={{ marginTop: '4px' }}>
            Go to Investors</Link></div>
      </div>);
  }

  const { cascades, summary, bottleneckAlert } = data;

  return (
    <div className="p-6 page-content" style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div>
            <h1 className="page-title">Investor Network</h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: '2px' }}>
              Cascade effects from keystone investors</p></div></div>
        <div className="flex items-center gap-3">
          <div style={{ padding: 'var(--space-2) var(--space-4)', background: 'var(--accent-muted)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)', fontWeight: 400 }}>
              Expected Capital</span>
            <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 300, color: 'var(--text-primary)', marginTop: '2px' }}>
              {summary.totalExpectedCapitalM > 0 ? `\u20AC${formatCapital(summary.totalExpectedCapitalM)}` : '--'}</p></div>
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={fetchData}
            style={stFontSm}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh</button></div></div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 card-stagger">
        {[
          { label: 'Keystones', value: String(summary.keystoneCount), icon: Crown },
          { label: 'Connected Investors', value: String(summary.totalInvestorsConnected), icon: Users },
          { label: 'Avg Chain Length', value: String(summary.avgChainLength), icon: Link2 },
          { label: 'Strongest Chain', value: summary.strongestChain ? `${summary.strongestChain.name}` : '--', icon: TrendingUp },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <span style={stTextMuted}><stat.icon className="w-3.5 h-3.5" /></span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', letterSpacing: '0.01em' }}>
                {stat.label}</span></div>
            <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 400, color: 'var(--text-primary)' }}>
              {stat.value}</p></div>
        ))}</div>

      {/* Bottleneck Alert */}
      {bottleneckAlert && (
        <div
          className="card p-4 mb-6 flex items-start gap-3"
          style={{ background: 'var(--warning-muted)' }}>
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={stTextTertiary} />
          <div className="flex-1">
            <p style={{ fontWeight: 400, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
              Bottleneck Alert</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
              If <strong>{bottleneckAlert.bottleneckName}</strong> passes, it would collapse{' '}
              <strong>{bottleneckAlert.keystoneName}</strong>&apos;s cascade chain.{' '}
              {bottleneckAlert.capitalAtRiskM > 0 && (
                <span>
                  Up to <strong>{'\u20AC'}{formatCapital(bottleneckAlert.capitalAtRiskM)}</strong> in expected capital at risk.
                </span>
              )}</p>
            <div className="flex items-center gap-2 mt-3">
              <Link
                href={`/dealflow?search=${encodeURIComponent(bottleneckAlert.bottleneckName)}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-normal transition-colors"
                style={{ background: 'var(--fg-5)', color: 'var(--text-tertiary)', border: '1px solid var(--fg-5)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--fg-5)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--fg-5)'; }}>
                <Calendar className="w-3 h-3" />
                Engage {bottleneckAlert.bottleneckName}</Link></div></div></div>
      )}

      {/* Keystone Cards */}
      <div className="flex flex-col gap-4">
        {cascades.map((cascade) => {
          const isExpanded = expandedCards.has(cascade.keystoneId);
          const isHovered = hoveredCard === cascade.keystoneId;

          return (
            <div
              key={cascade.keystoneId}
              className="card transition-colors"
              style={{ transition: 'all 0.15s ease' }}
              onMouseEnter={() => setHoveredCard(cascade.keystoneId)}
              onMouseLeave={() => setHoveredCard(null)}>
              {/* Card Header */}
              <button
                className="w-full flex items-center justify-between p-4"
                onClick={() => toggleCard(cascade.keystoneId)}
                style={{ cursor: 'pointer', background: 'transparent', border: 'none', textAlign: 'left' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--accent-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,}}>
                    <Crown className="w-4 h-4" style={stAccent} /></div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/investors/${cascade.keystoneId}`}
                        onClick={e => e.stopPropagation()}
                        className="transition-colors"
                        style={{ fontWeight: 400, color: 'var(--text-primary)', fontSize: 'var(--font-size-base)', textDecoration: 'none' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}>
                        {cascade.keystoneName}</Link>
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-2)',
                        color: 'var(--text-muted)',
                        fontWeight: 400,}}>
                        {tierLabel(cascade.keystoneTier)}</span>
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-2)',
                        color: 'var(--text-secondary)',}}>
                        {STATUS_LABELS[cascade.keystoneStatus] || cascade.keystoneStatus}</span></div>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {cascade.signal}</p></div></div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  <div style={{ textAlign: 'right' }}>
                    <p style={labelMuted}>Cascade Capital</p>
                    <p style={{ fontSize: 'var(--font-size-base)', fontWeight: 400, color: 'var(--text-primary)' }}>
                      {cascade.expectedCascadeCapitalM > 0 ? `\u20AC${formatCapital(cascade.expectedCascadeCapitalM)}` : '--'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={labelMuted}>Chain</p>
                    <p style={{ fontSize: 'var(--font-size-base)', fontWeight: 400, color: 'var(--text-primary)' }}>
                      {cascade.chainLength}</p></div>
                  <span style={stTextMuted}>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span></div></button>

              {/* Expanded: Cascade Chain */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 'var(--space-4)' }}>
                  {/* Keystone Info Row */}
                  <div className="flex items-center gap-2 mb-4">
                    <span style={labelMuted}>Enthusiasm:</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent)', letterSpacing: '2px' }}>
                      {enthusiasmDots(cascade.keystoneEnthusiasm)}</span>
                    {cascade.keystoneCheckSize && (
                      <>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--border-default)', margin: '0 4px' }}>|</span>
                        <span style={labelMuted}>
                          Check: {cascade.keystoneCheckSize}</span>
                      </>
                    )}
                    {cascade.totalCascadeCapitalM > 0 && (
                      <>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--border-default)', margin: '0 4px' }}>|</span>
                        <span style={labelMuted}>
                          Total Potential: {'\u20AC'}{formatCapital(cascade.totalCascadeCapitalM)}</span>
                      </>
                    )}</div>

                  {/* Cascade Chain Visualization */}
                  {cascade.cascadeChain.length > 0 ? (
                    <div className="flex flex-col gap-0">
                      {cascade.cascadeChain.map((link, idx) => {
                        const isBottleneck = cascade.networkBottleneck?.investorId === link.investorId;
                        const isLinkHovered = hoveredLink === link.investorId;

                        return (
                          <div key={link.investorId}>
                            {/* Arrow connector */}
                            <div className="flex items-center gap-2 py-1" style={{ paddingLeft: '16px' }}>
                              <div style={{
                                width: '2px',
                                height: '16px',
                                background: 'var(--border-default)',
                                marginLeft: '7px',
                              }} />
                              <ArrowRight className="w-3 h-3" style={{ color: 'var(--text-muted)', marginLeft: '-10px' }} />
                              <span style={{
                                fontSize: 'var(--font-size-xs)',
                                color: probColor(link.probability),
                                fontWeight: 400,
                                fontVariantNumeric: 'tabular-nums',}}>
                                {Math.round(link.probability * 100)}%</span></div>

                            {/* Investor Row */}
                            <div
                              className="flex items-center justify-between rounded-md p-3 transition-colors"
                              style={{
                                marginLeft: '24px',
                                background: isLinkHovered ? 'var(--surface-2)' : 'var(--surface-1)',
                                ...(isBottleneck ? { background: 'var(--warning-muted)' } : {}),
                                transition: 'all 0.15s ease', }}
                              onMouseEnter={() => setHoveredLink(link.investorId)}
                              onMouseLeave={() => setHoveredLink(null)}>
                              <div className="flex items-center gap-3 min-w-0">
                                <div style={{
                                  width: '8px',
                                  height: '8px',
                                  borderRadius: '50%',
                                  background: probColor(link.probability),
                                  flexShrink: 0,
                                }} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Link
                                      href={`/investors/${link.investorId}`}
                                      className="transition-colors"
                                      style={{
                                        fontWeight: 400,
                                        color: 'var(--text-primary)',
                                        fontSize: 'var(--font-size-sm)',
                                        textDecoration: 'none', }}
                                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; }}
                                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}>
                                      {link.investorName}</Link>
                                    <span style={{
                                      fontSize: '10px',
                                      padding: '0 4px',
                                      borderRadius: 'var(--radius-sm)',
                                      background: 'var(--surface-2)',
                                      color: 'var(--text-muted)',}}>
                                      {tierLabel(link.tier)}</span>
                                    <span style={{
                                      fontSize: '10px',
                                      padding: '0 4px',
                                      borderRadius: 'var(--radius-sm)',
                                      background: 'var(--surface-2)',
                                      color: 'var(--text-secondary)',}}>
                                      {STATUS_LABELS[link.status] || link.status}</span>
                                    {isBottleneck && (
                                      <span style={{
                                        fontSize: '10px',
                                        padding: '0 4px',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'var(--warning-muted)',
                                        color: 'var(--text-tertiary)',
                                        fontWeight: 400,}}>
                                        BOTTLENECK</span>
                                    )}</div>
                                  {link.checkSize && (
                                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                                      Check: {link.checkSize}</span>
                                  )}</div></div>
                              <div className="flex items-center gap-4 shrink-0">
                                <div style={{ textAlign: 'right' }}>
                                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', }}>Prob</p>
                                  <p style={{
                                    fontSize: 'var(--font-size-sm)',
                                    fontWeight: 400,
                                    color: probColor(link.probability),
                                    fontVariantNumeric: 'tabular-nums',}}>
                                    {Math.round(link.probability * 100)}%</p></div>
                                {link.capitalM > 0 && (
                                  <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', }}>Expected</p>
                                    <p style={{
                                      fontSize: 'var(--font-size-sm)',
                                      fontWeight: 400,
                                      color: 'var(--text-primary)',
                                      fontVariantNumeric: 'tabular-nums',}}>
                                      {'\u20AC'}{formatCapital(link.expectedCapitalM)}</p></div>
                                )}
                                {idx < cascade.cascadeChain.length - 1 && (
                                  <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', }}>Cumulative</p>
                                    <p style={{
                                      fontSize: 'var(--font-size-sm)',
                                      fontWeight: 400,
                                      color: 'var(--text-tertiary)',
                                      fontVariantNumeric: 'tabular-nums',}}>
                                      {Math.round(link.cumulativeProbability * 100)}%</p></div>
                                )}</div></div>
                          </div>);
                      })}</div>
                  ) : (
                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', padding: 'var(--space-3)' }}>
                      No downstream investors in cascade chain.</p>
                  )}

                  {/* Bottleneck detail */}
                  {cascade.networkBottleneck && (
                    <div
                      className="mt-4 p-3 rounded-md flex items-start gap-2"
                      style={{ background: 'var(--warning-muted)' }}>
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={stTextTertiary} />
                      <div className="flex-1">
                        <p style={labelSecondary}>
                          <strong>{cascade.networkBottleneck.investorName}</strong> is the bottleneck.{' '}
                          If they pass, chain probability impact: <strong>{Math.round(Math.abs(cascade.networkBottleneck.impactIfPass) * 100)}%</strong>.
                        </p>
                        <Link
                          href={`/investors/${cascade.networkBottleneck.investorId}`}
                          className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded text-xs font-normal transition-colors"
                          style={{ background: 'var(--fg-5)', color: 'var(--text-tertiary)', border: '1px solid var(--fg-5)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--fg-5)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'var(--fg-5)'; }}>
                          Prioritize Engagement
                          <ArrowRight className="w-3 h-3" /></Link></div></div>
                  )}</div>
              )}
            </div>);
        })}</div>

      {/* Network Summary Footer */}
      <div
        className="card p-4 mt-6"
        style={stSurface1}>
        <div className="flex items-center gap-2 mb-3">
          <span style={stTextMuted}><TrendingUp className="w-4 h-4" /></span>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 400, color: 'var(--text-primary)' }}>
            Network Summary</span></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', letterSpacing: '0.01em' }}>
              Strongest Chain</p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 400, marginTop: '2px' }}>
              {summary.strongestChain
                ? `${summary.strongestChain.name} (\u20AC${formatCapital(summary.strongestChain.capitalM)})`
                : '--'}</p></div>
          <div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', letterSpacing: '0.01em' }}>
              Weakest Chain</p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', fontWeight: 400, marginTop: '2px' }}>
              {summary.weakestChain
                ? `${summary.weakestChain.name} (\u20AC${formatCapital(summary.weakestChain.capitalM)})`
                : '--'}</p></div>
          <div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', letterSpacing: '0.01em' }}>
              Total Raise Forecast</p>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent)', fontWeight: 400, marginTop: '2px' }}>
              {summary.totalExpectedCapitalM > 0 ? `\u20AC${formatCapital(summary.totalExpectedCapitalM)}` : '--'}</p></div></div>
      </div>
    </div>);
}

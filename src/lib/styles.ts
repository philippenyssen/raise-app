import type React from 'react';

// Score color: 70/50 → success / warning / danger
export function scoreColor(score: number): string {
  if (score >= 70) return 'var(--success)';
  if (score >= 50) return 'var(--warning)';
  return 'var(--danger)';
}

// Score bg: 70/50 → muted variants
export function scoreBg(score: number): string {
  if (score >= 70) return 'var(--success-muted)';
  if (score >= 50) return 'var(--warning-muted)';
  return 'var(--danger-muted)';
}

// Score bg as CSSProperties
export function scoreBgStyle(score: number): React.CSSProperties {
  if (score >= 70) return { background: 'var(--success-muted)' };
  if (score >= 50) return { background: 'var(--warning-muted)' };
  return { background: 'var(--danger-muted)' };
}

// 4-tier: 70/50/30 → success / accent / warning / danger
export function scoreColor4(score: number): string {
  if (score >= 70) return 'var(--success)';
  if (score >= 50) return 'var(--accent)';
  if (score >= 30) return 'var(--warning)';
  return 'var(--danger)';
}

// 4-tier border: 70/50/30 → muted colors
export function scoreBorderColor(score: number): string {
  if (score >= 70) return 'var(--success-muted)';
  if (score >= 50) return 'var(--accent-muted)';
  if (score >= 30) return 'var(--warning-muted)';
  return 'var(--danger-muted)';
}

// Gauge: 70/40 with optional invert
export function gaugeColor(score: number, invert = false): string {
  if (invert) {
    if (score >= 0.5) return 'var(--danger)';
    if (score >= 0.25) return 'var(--warning)';
    return 'var(--success)';
  }
  if (score >= 70) return 'var(--success)';
  if (score >= 40) return 'var(--warning)';
  return 'var(--danger)';
}

// Dimension color: 70/40 with unknown signal
export function dimensionColor(score: number, sig: string): string {
  if (sig === 'unknown') return 'var(--text-muted)';
  if (score >= 70) return 'var(--success)';
  if (score >= 40) return 'var(--warning)';
  return 'var(--danger)';
}

// Dimension bg: 70/40 with unknown signal
export function dimensionBg(score: number, sig: string): string {
  if (sig === 'unknown') return 'var(--surface-2)';
  if (score >= 70) return 'var(--success-muted)';
  if (score >= 40) return 'var(--warning-muted)';
  return 'var(--danger-muted)';
}

// Momentum heatmap cell style (71/51/31/1 thresholds)
export function scoreColorStyle(score: number): React.CSSProperties {
  if (score >= 71) return { background: 'var(--accent-85)', color: 'var(--surface-0)' };
  if (score >= 51) return { background: 'var(--accent-55)', color: 'var(--surface-0)' };
  if (score >= 31) return { background: 'var(--warn-40)', color: 'var(--text-primary)' };
  if (score >= 1)  return { background: 'var(--fg-15)', color: 'var(--text-secondary)' };
  return { background: 'var(--fg-6)', color: 'var(--text-muted)' };
}

// Text style constants
export const stTextMuted: React.CSSProperties = { color: 'var(--text-muted)' };
export const stTextTertiary: React.CSSProperties = { color: 'var(--text-tertiary)' };
export const stTextSecondary: React.CSSProperties = { color: 'var(--text-secondary)' };
export const stTextPrimary: React.CSSProperties = { color: 'var(--text-primary)' };

// Accent color
export const stAccent: React.CSSProperties = { color: 'var(--accent)' };

// Font-size constants
export const stFontXs: React.CSSProperties = { fontSize: 'var(--font-size-xs)' } as const;
export const stFontSm: React.CSSProperties = { fontSize: 'var(--font-size-sm)' } as const;
export const textSmSecondary = { fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' } as const;

// Background constants
export const stSurface0: React.CSSProperties = { background: 'var(--surface-0)' } as const;
export const stSurface1: React.CSSProperties = { background: 'var(--surface-1)' } as const;
export const stSurface2: React.CSSProperties = { background: 'var(--surface-2)' } as const;
export const stBgSuccess: React.CSSProperties = { background: 'var(--success)' } as const;
export const stBgDanger: React.CSSProperties = { background: 'var(--danger)' } as const;
export const stBgMuted: React.CSSProperties = { background: 'var(--text-muted)' } as const;
export const stAccentBg: React.CSSProperties = { background: 'var(--accent-muted)' } as const;

// Border constants
export const stBorderTop: React.CSSProperties = { borderTop: '1px solid var(--border-subtle)' } as const;
export const stBorderSubtle: React.CSSProperties = { borderColor: 'var(--border-subtle)' } as const;

// Combined style constants
export const stAccentBadge: React.CSSProperties = { background: 'var(--accent-muted)', color: 'var(--accent)' } as const;
export const stSurface1Border: React.CSSProperties = { background: 'var(--surface-1)', borderBottom: '1px solid var(--border-subtle)' } as const;
export const labelMuted10: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' } as const;
export const labelSmMuted: React.CSSProperties = { fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' } as const;

// Label style constants (font-size-xs + color)
export const labelTertiary: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' };
export const labelSecondary: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' };
export const labelAccent: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--accent)' };
export const labelMuted: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' };

// Probability color: 0.6/0.3 thresholds on 0-1 scale
export function probColor(prob: number): string {
  if (prob >= 0.6) return 'var(--success)';
  if (prob >= 0.3) return 'var(--warning)';
  return 'var(--danger)';
}

// Velocity color (neutral)
export function velocityColor(_score: number): string {
  return 'var(--text-primary)';
}

// Tracking status color (neutral)
export function trackingColor(_status: string): string {
  return 'var(--text-secondary)';
}

// Tracking status background (neutral)
export function trackingBg(_status: string): string {
  return 'var(--surface-2)';
}

// Delta color: positive / negative / zero
export function deltaColor(delta: number): string {
  if (delta > 0) return 'var(--success)';
  if (delta < 0) return 'var(--danger)';
  return 'var(--text-muted)';
}

// Confidence color: high / medium / low
export function confidenceColor(c: 'high' | 'medium' | 'low'): string {
  if (c === 'high') return 'var(--success)';
  if (c === 'medium') return 'var(--warning)';
  return 'var(--danger)';
}

// Confidence background: high / medium / low
export function confidenceBg(c: 'high' | 'medium' | 'low'): string {
  if (c === 'high') return 'var(--success-muted)';
  if (c === 'medium') return 'var(--warning-muted)';
  return 'var(--danger-muted)';
}

// Intensity color: 70/40/0 thresholds
export function getIntensityColor(intensity: number): string {
  if (intensity >= 70) return 'var(--danger)';
  if (intensity >= 40) return 'var(--warning)';
  if (intensity > 0) return 'var(--accent)';
  return 'var(--text-muted)';
}

// Health color: 90/70 thresholds
export function getHealthColor(rate: number): string {
  if (rate >= 90) return 'var(--success)';
  if (rate >= 70) return 'var(--warning)';
  return 'var(--danger)';
}

// Health background: 90/70 thresholds
export function getHealthBg(rate: number): string {
  if (rate >= 90) return 'var(--success-muted)';
  if (rate >= 70) return 'var(--warning-muted)';
  return 'var(--danger-muted)';
}

// Icon size constants
export const icon14: React.CSSProperties = { width: '14px', height: '14px' } as const;
export const icon12: React.CSSProperties = { width: '12px', height: '12px' } as const;

// Layout helpers
export const maxWidthCenter: React.CSSProperties = { maxWidth: '1400px', margin: '0 auto' } as const;
export const flexColGap2: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' } as const;

// Table cell alignment
export const cellCenter: React.CSSProperties = { padding: 'var(--space-3) var(--space-4)', textAlign: 'center' } as const;

// Card padding (shared across today, focus, acceleration, win-loss)
export const cardPad4: React.CSSProperties = { padding: 'var(--space-4)' } as const;
export const textSmMuted: React.CSSProperties = { fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' } as const;

// Shared badge base styles
export const badgeSmall: React.CSSProperties = { padding: '0.125rem 0.375rem', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 400 } as const;


// Investor type badge styles (shared across pipeline, acceleration, focus pages)
export const INVESTOR_TYPE_STYLES: Record<string, React.CSSProperties> = {
  vc: { background: 'var(--accent-muted)', color: 'var(--accent)' },
  growth: { background: 'var(--cat-purple-muted)', color: 'var(--chart-4)' },
  sovereign: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  strategic: { background: 'var(--cat-teal-muted)', color: 'var(--cat-teal)' },
  debt: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
  family_office: { background: 'var(--fg-6)', color: 'var(--text-primary)' },
};

export function inlineBadgeStyle(styleObj: React.CSSProperties): React.CSSProperties {
  return {
    fontSize: 'var(--font-size-xs)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 400,
    lineHeight: 1.5,
    whiteSpace: 'nowrap' as const,
    ...styleObj,
  };
}

// Strength/significance color: strong/moderate/weak or high/medium/low
export function strengthColor(s: 'strong' | 'moderate' | 'weak' | 'high' | 'medium' | 'low'): string {
  if (s === 'strong' || s === 'high') return 'var(--success)';
  if (s === 'moderate' || s === 'medium') return 'var(--warning)';
  return 'var(--text-muted)';
}

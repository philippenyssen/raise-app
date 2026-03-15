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

// Label style constants (font-size-xs + color)
export const labelTertiary: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' };
export const labelSecondary: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' };
export const labelAccent: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--accent)' };
export const labelMuted: React.CSSProperties = { fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' };

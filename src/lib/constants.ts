import type React from 'react';
import type { InvestorStatus, InvestorType, MeetingType } from './types';

export const STATUS_LABELS: Record<InvestorStatus | string, string> = {
  identified: 'Identified',
  contacted: 'Contacted',
  nda_signed: 'NDA Signed',
  meeting_scheduled: 'Meeting Set',
  met: 'Met',
  engaged: 'Engaged',
  in_dd: 'In DD',
  term_sheet: 'Term Sheet',
  closed: 'Closed',
  passed: 'Passed',
  dropped: 'Dropped',
};

export const TYPE_LABELS: Record<InvestorType | string, string> = {
  vc: 'VC',
  growth: 'Growth Equity',
  sovereign: 'Sovereign Wealth',
  strategic: 'Strategic',
  debt: 'Debt Provider',
  family_office: 'Family Office',
};

export const MEETING_TYPE_LABELS: Record<MeetingType | string, string> = {
  intro: 'Intro',
  management_presentation: 'Mgmt Presentation',
  deep_dive: 'Deep Dive',
  site_visit: 'Site Visit',
  dd_session: 'DD Session',
  negotiation: 'Negotiation',
  social: 'Social',
};

export const PIPELINE_STATUS_STYLES: Record<string, { background: string; color: string }> = {
  identified: { background: 'var(--surface-2)', color: 'var(--text-tertiary)' },
  contacted: { background: 'var(--surface-2)', color: 'var(--text-secondary)' },
  nda_signed: { background: 'var(--accent-muted)', color: 'var(--accent)' },
  meeting_scheduled: { background: 'var(--accent-muted)', color: 'var(--accent)' },
  met: { background: 'var(--cat-purple-muted)', color: 'var(--chart-4)' },
  engaged: { background: 'var(--cat-purple-muted)', color: 'var(--cat-purple)' },
  in_dd: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  term_sheet: { background: 'var(--success-muted)', color: 'var(--text-secondary)' },
};

export const MOMENTUM_STYLES: Record<string, { color: string }> = {
  accelerating: { color: 'var(--text-secondary)' },
  steady: { color: 'var(--text-tertiary)' },
  decelerating: { color: 'var(--text-tertiary)' },
  stalled: { color: 'var(--text-primary)' },
};

export const MOMENTUM_LABELS: Record<string, string> = {
  accelerating: 'Accelerating',
  steady: 'Steady',
  decelerating: 'Decelerating',
  stalled: 'Stalled',
};

export const OUTCOME_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  likely_close: { label: 'Likely Close', color: 'var(--text-secondary)', bg: 'var(--success-muted)' },
  possible: { label: 'Possible', color: 'var(--accent)', bg: 'var(--accent-muted)' },
  long_shot: { label: 'Long Shot', color: 'var(--text-tertiary)', bg: 'var(--warning-muted)' },
  unlikely: { label: 'Unlikely', color: 'var(--text-primary)', bg: 'var(--danger-muted)' },
};

export const TRIGGER_STYLES: Record<string, React.CSSProperties> = {
  momentum_cliff: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  stall_risk: { background: 'var(--danger-muted)', color: 'var(--text-primary)' },
  window_closing: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  catalyst_match: { background: 'var(--accent-muted)', color: 'var(--accent)' },
  competitive_pressure: { background: 'var(--cat-purple-muted)', color: 'var(--chart-4)' },
  term_sheet_ready: { background: 'var(--success-muted)', color: 'var(--text-secondary)' },
};

export const TRIGGER_LABELS: Record<string, string> = {
  momentum_cliff: 'Momentum Cliff',
  stall_risk: 'Stall Risk',
  window_closing: 'Window Closing',
  catalyst_match: 'Catalyst Match',
  competitive_pressure: 'Competitive Pressure',
  term_sheet_ready: 'Term Sheet Ready',
};

export const CONFIDENCE_STYLES: Record<string, React.CSSProperties> = {
  high: { background: 'var(--success-muted)', color: 'var(--text-secondary)' },
  medium: { background: 'var(--warning-muted)', color: 'var(--text-tertiary)' },
  low: { background: 'var(--surface-2)', color: 'var(--text-tertiary)' },
};

export const URGENCY_STYLE: Record<string, React.CSSProperties> = {
  immediate: { color: 'var(--text-primary)' },
  '48h': { color: 'var(--text-secondary)' },
  this_week: { color: 'var(--text-tertiary)' },
  next_week: { color: 'var(--text-tertiary)' },
};

export const PRIORITY_BADGE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  critical: { bg: 'var(--danger-muted)', color: 'var(--danger)', border: 'color-mix(in srgb, var(--danger) 50%, transparent)' },
  high: { bg: 'var(--warning-muted)', color: 'var(--warning)', border: 'color-mix(in srgb, var(--warning) 50%, transparent)' },
  medium: { bg: 'var(--accent-muted)', color: 'var(--accent)', border: 'color-mix(in srgb, var(--accent) 50%, transparent)' },
  low: { bg: 'var(--surface-2)', color: 'var(--text-secondary)', border: 'var(--border-subtle)' },
};

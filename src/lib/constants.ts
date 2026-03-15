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

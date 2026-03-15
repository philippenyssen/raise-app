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

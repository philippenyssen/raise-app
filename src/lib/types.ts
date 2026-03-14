export type InvestorTier = 1 | 2 | 3 | 4;
export type InvestorType = 'vc' | 'growth' | 'sovereign' | 'strategic' | 'debt' | 'family_office';
export type InvestorStatus = 'identified' | 'contacted' | 'nda_signed' | 'meeting_scheduled' | 'met' | 'engaged' | 'in_dd' | 'term_sheet' | 'closed' | 'passed' | 'dropped';
export type ProcessHealth = 'green' | 'yellow' | 'red';
export type MeetingType = 'intro' | 'management_presentation' | 'deep_dive' | 'site_visit' | 'dd_session' | 'negotiation' | 'social';

export interface Investor {
  id: string;
  name: string;
  type: InvestorType;
  tier: InvestorTier;
  status: InvestorStatus;
  partner: string;
  fund_size: string;
  check_size_range: string;
  sector_thesis: string;
  warm_path: string;
  ic_process: string;
  speed: 'fast' | 'medium' | 'slow';
  portfolio_conflicts: string;
  notes: string;
  enthusiasm: number; // 1-5
  created_at: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  investor_id: string;
  investor_name: string;
  date: string;
  type: MeetingType;
  attendees: string;
  duration_minutes: number;
  raw_notes: string;
  // AI-extracted structured data
  questions_asked: string; // JSON array
  objections: string; // JSON array
  engagement_signals: string; // JSON object
  competitive_intel: string;
  next_steps: string;
  enthusiasm_score: number; // 1-5
  status_after: string;
  ai_analysis: string;
  created_at: string;
}

export interface Objection {
  text: string;
  severity: 'showstopper' | 'significant' | 'minor';
  topic: string;
  addressed: boolean;
  response_effectiveness: 'resolved' | 'partial' | 'unresolved';
}

export interface EngagementSignal {
  enthusiasm: number;
  asked_about_process: boolean;
  asked_about_timeline: boolean;
  requested_followup: boolean;
  mentioned_competitors: boolean;
  body_language_at_pricing: 'positive' | 'neutral' | 'negative';
  slides_that_landed: string[];
  slides_that_fell_flat: string[];
}

export interface FunnelMetrics {
  contacted: number;
  nda_signed: number;
  meetings: number;
  engaged: number;
  in_dd: number;
  term_sheets: number;
  closed: number;
  passed: number;
  conversion_rates: {
    contact_to_meeting: number;
    meeting_to_engaged: number;
    engaged_to_dd: number;
    dd_to_term_sheet: number;
  };
  targets: {
    contact_to_meeting: number;
    meeting_to_engaged: number;
    engaged_to_dd: number;
    dd_to_term_sheet: number;
  };
}

export interface ConvergenceScore {
  story: boolean;
  materials: boolean;
  model: boolean;
  investors: boolean;
  objections: boolean;
  pricing: boolean;
  terms: boolean;
  funnel: boolean;
  timeline: boolean;
  team: boolean;
  score: number; // out of 10
}

export interface PatternAnalysis {
  top_objections: { text: string; count: number; percentage: number }[];
  top_strengths: { text: string; count: number }[];
  avg_enthusiasm: number;
  pricing_reception: 'positive' | 'neutral' | 'negative';
  conversion_trend: 'improving' | 'stable' | 'declining';
  material_changes_needed: string[];
  overall_health: ProcessHealth;
}

export interface RaiseConfig {
  company_name: string;
  equity_amount: string;
  debt_amount: string;
  pre_money: string;
  post_money: string;
  target_close: string;
  three_beliefs: string[];
  one_paragraph_pitch: string;
}

// Intelligence types

export interface MarketDeal {
  id: string;
  company: string;
  round: string; // Series A, B, C, etc.
  amount: string;
  valuation: string;
  lead_investors: string;
  other_investors: string;
  date: string;
  sector: string;
  sub_sector: string;
  equity_story: string;
  relevance: string; // how it compares to our raise
  source: string;
  created_at: string;
  updated_at: string;
}

export interface InvestorPartner {
  id: string;
  investor_id: string;
  name: string;
  title: string;
  focus_areas: string;
  notable_deals: string;
  board_seats: string;
  linkedin: string;
  background: string;
  relevance_to_us: string;
  created_at: string;
  updated_at: string;
}

export interface InvestorPortfolioCo {
  id: string;
  investor_id: string;
  company: string;
  sector: string;
  stage_invested: string;
  amount: string;
  date: string;
  status: 'active' | 'exited' | 'written_off';
  relevance: string; // overlap/conflict/synergy with us
  created_at: string;
}

export interface Competitor {
  id: string;
  name: string;
  sector: string;
  hq: string;
  last_round: string;
  last_valuation: string;
  total_raised: string;
  key_investors: string;
  revenue: string;
  employees: string;
  positioning: string;
  strengths: string;
  weaknesses: string;
  threat_level: 'low' | 'medium' | 'high' | 'critical';
  our_advantage: string;
  created_at: string;
  updated_at: string;
}

// Workflow & Timeline types

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked' | 'cancelled';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type RaisePhase = 'preparation' | 'outreach' | 'management_presentations' | 'due_diligence' | 'term_sheets' | 'negotiation' | 'closing';

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  due_date: string;
  status: TaskStatus;
  priority: TaskPriority;
  phase: RaisePhase;
  investor_id: string;
  investor_name: string;
  auto_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityEvent {
  id: string;
  event_type: 'meeting_logged' | 'status_changed' | 'document_created' | 'document_updated' | 'task_completed' | 'term_sheet_received' | 'research_completed' | 'data_room_uploaded' | 'note_added';
  subject: string;
  detail: string;
  investor_id: string;
  investor_name: string;
  created_at: string;
}

export interface IntelligenceBrief {
  id: string;
  subject: string; // name of investor/company/topic
  brief_type: 'investor' | 'company' | 'market' | 'competitor' | 'deal';
  content: string; // markdown research brief
  sources: string; // JSON array of source references
  investor_id?: string; // FK if investor research
  created_at: string;
  updated_at: string;
}

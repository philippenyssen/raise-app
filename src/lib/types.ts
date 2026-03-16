export type InvestorTier = 1 | 2 | 3 | 4;
export type InvestorType = 'vc' | 'growth' | 'sovereign' | 'strategic' | 'debt' | 'family_office';
export type InvestorStatus = 'identified' | 'contacted' | 'nda_signed' | 'meeting_scheduled' | 'met' | 'engaged' | 'in_dd' | 'term_sheet' | 'closed' | 'passed' | 'dropped';
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
  last_meeting_date?: string | null;
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
  // Post-meeting outcome feedback
  outcome_rating: number | null; // 1-5
  objections_addressed: string; // JSON array of strings
  competitive_mentions: string; // JSON array of strings
  key_takeaway: string;
  prep_usefulness: number | null; // 1-5
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
  pricing_reception: 'positive' | 'neutral' | 'negative' | 'not_discussed';
  slides_that_landed: string[];
  slides_that_fell_flat: string[];
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
  source?: string;
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
  source?: string;
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
  event_type: 'meeting_logged' | 'status_changed' | 'document_created' | 'document_updated' | 'task_completed' | 'term_sheet_received' | 'research_completed' | 'data_room_uploaded' | 'note_added' | 'acceleration_executed' | 'objection_resolved';
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

export type FollowupActionType = 'thank_you' | 'objection_response' | 'data_share' | 'schedule_followup' | 'warm_reengagement' | 'milestone_update';
export type FollowupStatus = 'pending' | 'completed' | 'skipped';

export interface FollowupAction {
  id: string;
  meeting_id: string;
  investor_id: string;
  investor_name: string;
  action_type: FollowupActionType;
  description: string;
  due_at: string;
  status: FollowupStatus;
  outcome: string;
  conviction_delta: number;
  created_at: string;
  completed_at: string | null;
  executed_at: string | null;
  measured_lift: number | null;
}

export type DocumentFlagType = 'objection_response' | 'number_update' | 'section_improvement';
export type DocumentFlagStatus = 'open' | 'addressed' | 'dismissed';

export interface DocumentFlag {
  id: string;
  document_id: string;
  meeting_id: string;
  investor_id: string;
  investor_name: string;
  flag_type: DocumentFlagType;
  description: string;
  section_hint: string;
  objection_text: string;
  status: DocumentFlagStatus;
  created_at: string;
}

export interface PostMeetingActions {
  tasks: Task[];
  document_flags: DocumentFlag[];
  investor_updates: {
    enthusiasm: number;
    suggested_status: string;
    previous_status?: string;
    previous_enthusiasm?: number;
  };
}

export interface AccelerationItem {
  id: string;
  investorId: string;
  investorName: string;
  investorTier: number;
  investorType: string;
  status: string;
  enthusiasm: number;
  score: number;
  momentum: string;
  triggerType: string;
  actionType: string;
  description: string;
  expectedLift: number;
  confidence: string;
  timeEstimate: string;
  urgency: string;
  triggerEvidence: string;
}

export interface AccelerationInvestorSummary {
  investorId: string;
  investorName: string;
  investorTier: number;
  investorType: string;
  status: string;
  enthusiasm: number;
  score: number;
  momentum: string;
  reason: string;
}

export interface AccelerationData {
  summary: { immediate: number; this_week: number; total: number };
  accelerations: AccelerationItem[];
  termSheetReady: AccelerationInvestorSummary[];
  atRisk: AccelerationInvestorSummary[];
  deprioritize: AccelerationInvestorSummary[];
  generatedAt: string;
}

export interface DocSummaryRecord {
  id: string;
  title: string;
  type: string;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ScoreDimension {
  name: string;
  score: number;
  signal: 'strong' | 'moderate' | 'weak' | 'unknown';
  evidence: string;
}

export interface InvestorScoreData {
  overall: number;
  dimensions: ScoreDimension[];
  momentum: 'accelerating' | 'steady' | 'decelerating' | 'stalled';
  predictedOutcome: 'likely_close' | 'possible' | 'long_shot' | 'unlikely';
  nextBestAction: string;
  risks: string[];
  lastUpdated: string;
}

export interface DealHeatInvestor {
  id: string;
  name: string;
  type: string;
  tier: number;
  status: string;
  dealHeat: { heat: number; label: 'hot' | 'warm' | 'cool' | 'cold' | 'frozen'; drivers: string[] };
  enthusiasm: number;
  lastMeeting: string | null;
}

// Stress-test / forecast shared types

export interface StressTestInvestorForecast {
  id: string;
  name: string;
  tier: number;
  type: string;
  status: string;
  enthusiasm: number;
  momentum: string;
  checkSizeRange: string;
  expectedCheck: number;
  closeProbability: number;
  expectedValue: number;
  predictedCloseDate: string | null;
  bottleneck: string;
}

export interface GapInvestor {
  id: string;
  name: string;
  tier: number;
  status: string;
  currentExpected: number;
  potentialExpected: number;
  intervention: string;
  timeCost: string;
  impactDelta: number;
}

export interface RiskItem { description: string; probability: string; impact: string; mitigation: string; }

// Term-compare shared types

export interface TermScenario {
  investor_name: string;
  pre_money_valuation: number;
  investment_amount: number;
  liquidation_preference: number;
  participation: boolean;
  anti_dilution: 'broad' | 'narrow' | 'none';
  board_seats: number;
  pro_rata_rights: boolean;
  drag_along_threshold: number;
}

export interface TermScenarioResult {
  investor_name: string;
  pre_money_valuation: number;
  investment_amount: number;
  post_money_valuation: number;
  ownership_percentage: number;
  dilution_to_founders: number;
  effective_valuation: number;
  founder_friendly_score: number;
  liquidation_preference: number;
  participation: boolean;
  anti_dilution: 'broad' | 'narrow' | 'none';
  board_seats: number;
  pro_rata_rights: boolean;
  drag_along_threshold: number;
  comparison_notes: string[];
}

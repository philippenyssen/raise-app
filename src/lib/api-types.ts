export interface InvestorRow {
  id: string;
  name: string;
  type: string;
  tier: number;
  status: string;
  enthusiasm: number;
  check_size_range: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface MeetingRow {
  id: string;
  investor_id: string;
  investor_name: string;
  date: string;
  type: string;
  enthusiasm_score: number;
  status_after: string;
  created_at: string;
}

export interface ActivityRow {
  id: string;
  event_type: string;
  subject: string;
  detail: string;
  investor_id: string;
  investor_name: string;
  created_at: string;
}

export interface TaskRow {
  id: string;
  investor_id: string;
  status: string;
  updated_at: string;
  created_at: string;
}

export interface FollowupRow {
  id: string;
  investor_id: string;
  status: string;
  due_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface ObjectionRow {
  investor_id: string;
  objection_topic: string;
  objection_text: string;
}

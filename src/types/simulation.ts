export type AccountStatus = 'Normal' | 'Watch' | 'Flagged';

export interface MessageLog {
  id: string;
  account_id: string;
  follower_id: string;
  message_text: string;
  link_url: string | null;
  timestamp: string; // ISO 8601 string
  device_id: string;
  location: string;
  is_simulated_attack?: boolean;
}

export interface SimulatedAccount {
  account_id: string;
  handle: string;
  display_name: string;
  platform?: string;
  category: string;
  follower_count: number;
  normal_hours_start: number; // 0-23
  normal_hours_end: number;   // 0-23
  trusted_device_id: string;
  home_location: string;
}

export type SignalId =
  | 'bulk_similarity'
  | 'suspicious_links'
  | 'unusual_hours'
  | 'new_device_location';

export interface SignalBreakdown {
  id: SignalId;
  label: string;
  description: string;
  points: number;
  max_points: number;
  triggered: boolean;
  evidence: string;
}

export interface MessageFlagDetail {
  message_id: string;
  reasons: string[];
  has_suspicious_link: boolean;
  has_unusual_hour: boolean;
  has_new_device_or_location: boolean;
  is_part_of_bulk_burst: boolean;
}

export interface AccountEvaluation {
  account: SimulatedAccount;
  messages: MessageLog[];
  suspicion_score: number;
  status: AccountStatus;
  signals: SignalBreakdown[];
  message_flags: Record<string, MessageFlagDetail>;
  reasons: string[];
  latest_device_id: string;
  latest_location: string;
  last_activity: string;
}

export interface AlertRecord {
  id: string;
  timestamp: string;
  account_id: string;
  handle: string;
  score: number;
  status: AccountStatus;
  reason: string;
  owner_alert: string;
  follower_alert: string;
  sample_message_text: string;
  sample_link_url: string | null;
}

export interface DetectionConfig {
  bulkMinMessages: number;     // Default N = 4
  bulkWindowMinutes: number;   // Default 15 minutes
  similarityThreshold: number; // Default 0.72 (72%)
  watchThreshold: number;      // Default 35
  flagThreshold: number;       // Default 65 (alert threshold)
}

export interface LoginEvent {
  id: string;
  account_id: string;
  handle: string;
  login_mode: 'new_account_id' | 'existing_account_login';
  device_id: string;
  location: string;
  timestamp: string;
  suspicious: boolean;
  findings: string[];
  score_after_login: number;
  status_after_login: AccountStatus;
}

export interface OutboundWebhook {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  created_at: string;
  last_status?: string;
  last_dispatched_at?: string;
}

export interface AiAccountAnalysis {
  account_id: string;
  analyzed_at: string;
  ai_risk_score: number;
  phishing_category: string;
  automated_bot_likelihood: 'Low' | 'Medium' | 'High';
  summary_en: string;
  summary_tanglish: string;
  recommended_action: string;
}

export interface DashboardStatePayload {
  accounts: SimulatedAccount[];
  logs: MessageLog[];
  loginEvents: LoginEvent[];
  alerts: AlertRecord[];
  config: DetectionConfig;
  outboundWebhooks: OutboundWebhook[];
  aiAnalyses: Record<string, AiAccountAnalysis>;
  ingestApiKey: string;
}

export type NavSection =
  | 'overview'
  | 'login'
  | 'integrations'
  | 'import'
  | 'logs'
  | 'alerts'
  | 'rules';

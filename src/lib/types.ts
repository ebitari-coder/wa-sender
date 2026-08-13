export type CampaignStatus = "draft" | "scheduled" | "sending" | "completed" | "stopped" | "failed";
export type RecipientStatus = "pending" | "sending" | "success" | "failed";

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  message: string;
  interval_secs: number;
  status: CampaignStatus;
  total_count: number;
  success_count: number;
  failed_count: number;
  unsent_count: number;
  has_attachment: number;
  scheduled_for: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Recipient {
  id: string;
  campaign_id: string;
  number: string;
  status: RecipientStatus;
  error: string | null;
  sent_at: string | null;
}

export interface Attachment {
  id: string;
  campaign_id: string;
  kind: "image" | "video" | "document" | "contact";
  name: string;
  url: string;
  size: number;
  mime: string | null;
}

export interface Template {
  id: string;
  user_id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string | null;
}

export interface ProgressSnapshot {
  campaignId: string;
  status: "sending" | "completed" | "stopped" | "failed";
  total: number;
  sent: number;
  success: number;
  failed: number;
  unsent: number;
  percent: number;
  currentNumber: string | null;
  startedAt: string;
  completedAt: string | null;
}

import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";

export type CampaignStatus = "draft" | "scheduled" | "sending" | "completed" | "stopped" | "failed";
export type RecipientStatus = "pending" | "sending" | "success" | "failed";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

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

export function uid(): string {
  return randomUUID().replaceAll("-", "");
}

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function otpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newId(prefix: string): string {
  return `${prefix}_${uid()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

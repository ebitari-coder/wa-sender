import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { nowIso, type Attachment, type Campaign, type Recipient, type Template } from "@/lib/ids";
import { newCampaignId, progressFor } from "@/lib/sender";

export interface CreateCampaignInput {
  userId: string;
  name: string;
  message: string;
  intervalSecs: number;
  numbers: string[];
  scheduleFor?: string | null;
  attachments?: { kind: "image" | "video" | "document" | "contact"; name: string; url: string; size: number; mime: string | null }[];
}

export interface CampaignWithAttachments extends Campaign {
  attachments: Campaign["has_attachment"][];
}

export function createCampaign(input: CreateCampaignInput): Campaign {
  const id = newCampaignId();
  const isScheduled = !!input.scheduleFor && new Date(input.scheduleFor).getTime() > Date.now();
  const status = isScheduled ? "scheduled" : "draft";
  const insertCampaign = db.prepare(
    `INSERT INTO campaigns (id, user_id, name, message, interval_secs, status, total_count, unsent_count, has_attachment, scheduled_for, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertRecipient = db.prepare(
    "INSERT INTO recipients (id, campaign_id, number, status) VALUES (?, ?, ?, 'pending')",
  );
  const insertAttachment = db.prepare(
    "INSERT INTO attachments (id, campaign_id, kind, name, url, size, mime) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  db.transaction(() => {
    insertCampaign.run(
      id,
      input.userId,
      input.name.trim(),
      input.message,
      Math.max(1, Math.round(input.intervalSecs)),
      status,
      input.numbers.length,
      input.numbers.length,
      input.attachments && input.attachments.length > 0 ? 1 : 0,
      isScheduled ? new Date(input.scheduleFor!).toISOString() : null,
      nowIso(),
    );
    input.numbers.forEach((number, i) => {
      insertRecipient.run(id + "_r" + i, id, number);
    });
    (input.attachments ?? []).forEach((a, i) => {
      insertAttachment.run(id + "_a" + i, id, a.kind, a.name, a.url, a.size, a.mime);
    });
  })();

  return db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as Campaign;
}

export function listCampaigns(userId: string, limit = 50): Campaign[] {
  return db
    .prepare("SELECT * FROM campaigns WHERE user_id = ? ORDER BY created_at DESC LIMIT ?")
    .all(userId, limit) as Campaign[];
}

export function getCampaign(userId: string, id: string): Campaign | null {
  return (db.prepare("SELECT * FROM campaigns WHERE id = ? AND user_id = ?").get(id, userId) as Campaign) ?? null;
}

export function getCampaignAnyUser(id: string): Campaign | null {
  return (db.prepare("SELECT * FROM campaigns WHERE id = ?").get(id) as Campaign) ?? null;
}

export function deleteCampaign(userId: string, id: string): boolean {
  const res = db.prepare("DELETE FROM campaigns WHERE id = ? AND user_id = ?").run(id, userId);
  return res.changes > 0;
}

export function cancelSchedule(userId: string, id: string): boolean {
  const res = db
    .prepare(
      `UPDATE campaigns SET status = 'draft', scheduled_for = NULL
       WHERE id = ? AND user_id = ? AND status = 'scheduled'`,
    )
    .run(id, userId);
  return res.changes > 0;
}

export function reschedule(userId: string, id: string, scheduleFor: string): boolean {
  const res = db
    .prepare(
      `UPDATE campaigns SET status = 'scheduled', scheduled_for = ?
       WHERE id = ? AND user_id = ? AND status = 'scheduled'`,
    )
    .run(new Date(scheduleFor).toISOString(), id, userId);
  return res.changes > 0;
}

export function getRecipients(
  campaignId: string,
  status?: string,
  limit = 500,
): Recipient[] {
  if (status) {
    return db
      .prepare(
        "SELECT * FROM recipients WHERE campaign_id = ? AND status = ? ORDER BY rowid ASC LIMIT ?",
      )
      .all(campaignId, status, limit) as Recipient[];
  }
  return db.prepare("SELECT * FROM recipients WHERE campaign_id = ? ORDER BY rowid ASC LIMIT ?").all(campaignId, limit) as Recipient[];
}

export function countRecipients(campaignId: string, status?: string): number {
  if (status) {
    const row = db
      .prepare("SELECT COUNT(*) AS n FROM recipients WHERE campaign_id = ? AND status = ?")
      .get(campaignId, status) as { n: number };
    return row.n;
  }
  const row = db.prepare("SELECT COUNT(*) AS n FROM recipients WHERE campaign_id = ?").get(campaignId) as {
    n: number;
  };
  return row.n;
}

export function getAttachments(campaignId: string): Attachment[] {
  return db
    .prepare("SELECT * FROM attachments WHERE campaign_id = ?")
    .all(campaignId) as Attachment[];
}

export function campaignProgress(campaignId: string) {
  return progressFor(campaignId);
}

// ---------- Templates ----------

export function listTemplates(userId: string): Template[] {
  return db
    .prepare("SELECT * FROM templates WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as Template[];
}

export function createTemplate(userId: string, name: string, content: string): Template {
  const id = "tmp_" + randomUUID().replaceAll("-", "");
  db.prepare(
    "INSERT INTO templates (id, user_id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(id, userId, name, content, nowIso(), nowIso());
  return db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as Template;
}

export function updateTemplate(userId: string, id: string, name: string, content: string): Template | null {
  const res = db
    .prepare("UPDATE templates SET name = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .run(name, content, nowIso(), id, userId);
  if (res.changes === 0) return null;
  return db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as Template;
}

export function deleteTemplate(userId: string, id: string): boolean {
  return db.prepare("DELETE FROM templates WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}

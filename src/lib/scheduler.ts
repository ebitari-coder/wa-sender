import "server-only";
import { db } from "@/lib/db";

export function findDueCampaigns(): { id: string; name: string; scheduled_for: string }[] {
  return db
    .prepare(
      `SELECT id, name, scheduled_for FROM campaigns
       WHERE status = 'scheduled' AND scheduled_for IS NOT NULL AND scheduled_for <= ?
       ORDER BY scheduled_for ASC`,
    )
    .all(new Date().toISOString()) as { id: string; name: string; scheduled_for: string }[];
}

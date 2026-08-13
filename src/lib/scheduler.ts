import "server-only";
import { db } from "@/lib/db";

const CHECK_INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS ?? 15_000);

let timer: NodeJS.Timeout | null = null;

export function findDueCampaigns(): { id: string; name: string; scheduled_for: string }[] {
  return db
    .prepare(
      `SELECT id, name, scheduled_for FROM campaigns
       WHERE status = 'scheduled' AND scheduled_for IS NOT NULL AND scheduled_for <= ?
       ORDER BY scheduled_for ASC`,
    )
    .all(new Date().toISOString()) as { id: string; name: string; scheduled_for: string }[];
}

export async function startScheduler(): Promise<void> {
  if (timer) return;

  const { startCampaign } = await import("@/lib/sender");

  timer = setInterval(() => {
    for (const campaign of findDueCampaigns()) {
      void startCampaign(campaign.id).then((res) => {
        if (res.ok) {
          console.info(`[scheduler] Started scheduled campaign "${campaign.name}" (${campaign.id})`);
        } else {
          console.warn(`[scheduler] Failed to start "${campaign.name}": ${res.reason}`);
        }
      });
    }
  }, CHECK_INTERVAL_MS);

  timer.unref?.();
}

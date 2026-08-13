import { NextResponse } from "next/server";
import { db } from "@/lib/db";

async function handleCheck() {
  if (process.env.ENABLE_CRON_SCHEDULER !== "true") {
    return NextResponse.json({ ok: true, skipped: true, reason: "disabled" });
  }

  const due = db
    .prepare(
      `SELECT id, name, scheduled_for FROM campaigns
       WHERE status = 'scheduled' AND scheduled_for IS NOT NULL AND scheduled_for <= ?
       ORDER BY scheduled_for ASC`,
    )
    .all(new Date().toISOString()) as { id: string; name: string; scheduled_for: string }[];

  if (due.length === 0) {
    return NextResponse.json({ ok: true, started: 0 });
  }

  const { startCampaign } = await import("@/lib/sender");
  const results: { id: string; name: string; ok: boolean; reason?: string }[] = [];

  for (const campaign of due) {
    const res = await startCampaign(campaign.id);
    results.push({ id: campaign.id, name: campaign.name, ok: res.ok, reason: res.reason });
    if (res.ok) {
      console.info(`[cron-scheduler] Started "${campaign.name}" (${campaign.id})`);
    } else {
      console.warn(`[cron-scheduler] Failed "${campaign.name}": ${res.reason}`);
    }
  }

  return NextResponse.json({ ok: true, started: results.filter((r) => r.ok).length, results });
}

export async function GET() {
  return handleCheck();
}

export async function POST() {
  return handleCheck();
}

export const dynamic = "force-dynamic";

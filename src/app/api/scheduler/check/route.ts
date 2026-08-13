import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

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

  const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL
      : "http://localhost:8080";

  const results: { id: string; name: string; ok: boolean; error?: string }[] = [];

  for (const campaign of due) {
    try {
      const res = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.CRON_SECRET ? { "x-cron-secret": process.env.CRON_SECRET } : {}),
        },
      });
      const ok = res.ok;
      const body = ok ? {} : await res.json().catch(() => ({}));
      results.push({ id: campaign.id, name: campaign.name, ok, error: body.error });
      if (ok) {
        console.info(`[cron-scheduler] Started "${campaign.name}" (${campaign.id})`);
      } else {
        console.warn(`[cron-scheduler] Failed "${campaign.name}": ${body.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ id: campaign.id, name: campaign.name, ok: false, error: msg });
      console.warn(`[cron-scheduler] Error "${campaign.name}": ${msg}`);
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

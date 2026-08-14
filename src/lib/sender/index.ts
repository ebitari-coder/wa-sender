import "server-only";
import { db } from "@/lib/db";
import { newId, nowIso } from "@/lib/ids";
import { publish, type ProgressSnapshot } from "@/lib/sender/events";
import { randomDelay, sleep, type SendTarget } from "@/lib/sender/types";
import { getLatest } from "@/lib/sender/events";

const running = new Map<string, { stop: () => void }>();

let _manager: any = null;

function getManager(): any {
  if (!_manager) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@/lib/sender/baileys");
    _manager = mod.baileysManager;
  }
  return _manager;
}

export function getRunningCampaignIds(): string[] {
  return [...running.keys()];
}

export function isCampaignRunning(campaignId: string): boolean {
  return running.has(campaignId);
}

interface RecipientRow {
  id: string;
  number: string;
}

interface AttachmentRow {
  id: string;
  kind: string;
  name: string;
  url: string;
}

function recomputeCounts(campaignId: string) {
  const stats = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) AS success,
        COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) AS failed,
        COALESCE(SUM(CASE WHEN status IN ('pending','sending') THEN 1 ELSE 0 END), 0) AS unsent
       FROM recipients WHERE campaign_id = ?`,
    )
    .get(campaignId) as { total: number; success: number; failed: number; unsent: number };

  db.prepare(
    `UPDATE campaigns SET
       total_count = ?, success_count = ?, failed_count = ?, unsent_count = ?
     WHERE id = ?`,
  ).run(stats.total, stats.success, stats.failed, stats.unsent, campaignId);
  return stats;
}

function snapshot(campaignId: string, status: ProgressSnapshot["status"]): ProgressSnapshot {
  const c = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId) as
    | { started_at: string | null; completed_at: string | null }
    | undefined;
  const stats = recomputeCounts(campaignId);
  return {
    campaignId,
    status,
    total: stats.total,
    sent: stats.success + stats.failed,
    success: stats.success,
    failed: stats.failed,
    unsent: stats.unsent,
    percent: stats.total === 0 ? 0 : Math.round(((stats.success + stats.failed) / stats.total) * 100),
    currentNumber: null,
    startedAt: c?.started_at ?? nowIso(),
    completedAt: c?.completed_at ?? null,
  };
}

function markStaleCampaigns() {
  db.prepare(
    `UPDATE campaigns SET status = 'stopped', completed_at = COALESCE(completed_at, datetime('now'))
     WHERE status = 'sending'`,
  ).run();
  recomputeForAll();
}

function recomputeForAll() {
  for (const c of db.prepare("SELECT id FROM campaigns WHERE status IN ('sending','completed','stopped','failed')").all() as { id: string }[]) {
    recomputeCounts(c.id);
  }
}

function isStaleSendError(msg: string): boolean {
  return (
    msg.includes("detached Frame") ||
    msg.includes("Target closed") ||
    msg.includes("Session closed") ||
    msg.includes("Browser page reloaded") ||
    msg.includes("WhatsApp browser page is unavailable") ||
    msg.includes("Browser page is closed") ||
    msg.includes("WhatsApp not ready") ||
    msg.includes("Send failed: t: t")
  );
}

export async function startCampaign(campaignId: string): Promise<{ ok: boolean; reason?: string }> {
  if (running.has(campaignId)) {
    return { ok: false, reason: "Campaign is already sending" };
  }

  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId) as
    | { status: string; unsent_count: number }
    | undefined;
  if (!campaign) return { ok: false, reason: "Campaign not found" };
  if (campaign.status === "completed" && campaign.unsent_count === 0) {
    return { ok: false, reason: "Campaign already completed" };
  }

  const manager = getManager();
  const connect = await manager.connect().catch(() => ({ ready: false, reason: "connect failed" }));

  if (connect.ready === false) {
    // WebJS connects asynchronously (QR may be needed). Block the run until
    // the account is linked so every message is really delivered.
    db.prepare(
      `UPDATE campaigns SET status='failed', completed_at = datetime('now') WHERE id = ?`,
    ).run(campaignId);
    recomputeCounts(campaignId);
    publish(snapshot(campaignId, "failed"));
    return { ok: false, reason: connect.reason ?? "WhatsApp is not connected. Scan the QR code first." };
  }

  let stopRequested = false;
  const controller = { stop: () => (stopRequested = true) };
  running.set(campaignId, controller);

  db.prepare(
    `UPDATE campaigns SET status='sending', started_at = COALESCE(started_at, datetime('now')), completed_at = NULL WHERE id = ?`,
  ).run(campaignId);

  publish(snapshot(campaignId, "sending"));

  void runLoop(campaignId, manager, () => stopRequested).finally(() => {
    running.delete(campaignId);
  });

  return { ok: true };
}

async function runLoop(
  campaignId: string,
  manager: any,
  isStopped: () => boolean,
): Promise<void> {
  const attachments = db
    .prepare("SELECT * FROM attachments WHERE campaign_id = ?")
    .all(campaignId) as AttachmentRow[];

  const pending = db
    .prepare("SELECT id, number FROM recipients WHERE campaign_id = ? AND status = 'pending' ORDER BY rowid ASC")
    .all(campaignId) as RecipientRow[];

  const campaign = db.prepare("SELECT message, interval_secs FROM campaigns WHERE id = ?").get(campaignId) as {
    message: string;
    interval_secs: number;
  };

  for (const recipient of pending) {
    if (isStopped()) break;

    db.prepare("UPDATE recipients SET status = 'sending' WHERE id = ?").run(recipient.id);

    const target: SendTarget = {
      number: recipient.number,
      text: campaign.message,
      attachmentPath: attachments[0]?.url ?? null,
      attachmentType: (attachments[0]?.kind as SendTarget["attachmentType"]) ?? null,
    };

    const snap = snapshot(campaignId, "sending");
    snap.currentNumber = recipient.number;
    publish(snap);

    const delay = randomDelay(campaign.interval_secs);
    await sleep(delay);

    let sent = false;
    let lastError = "";

    for (let attempt = 1; attempt <= 2 && !sent; attempt++) {
      if (isStopped()) break;
      try {
        await manager.send(target);
        sent = true;
      } catch (err) {
        lastError = err instanceof Error ? err.message || err.toString() : typeof err === "string" ? err : JSON.stringify(err) || String(err);
        console.error(`[sender] Send failed for ${recipient.number} (attempt ${attempt}): ${lastError}`);

        if (attempt === 1 && isStaleSendError(lastError)) {
          console.log(`[sender] Reconnecting before retry for ${recipient.number}...`);
          try {
            await manager.disconnect();
            await sleep(1000);
            const reconnect = await manager.connect();
            if (reconnect.ready) {
              console.log(`[sender] Reconnected, retrying send for ${recipient.number}`);
              continue;
            } else {
              console.error(`[sender] Reconnect failed: ${reconnect.reason}`);
            }
          } catch (reconnectErr) {
            console.error(`[sender] Reconnect error:`, reconnectErr);
          }
        }
      }
    }

    if (sent) {
      db.prepare(
        "UPDATE recipients SET status='success', error=NULL, sent_at = datetime('now') WHERE id = ?",
      ).run(recipient.id);
    } else {
      db.prepare("UPDATE recipients SET status='failed', error = ?, sent_at = datetime('now') WHERE id = ?").run(
        lastError.slice(0, 500),
        recipient.id,
      );
    }

    if (isStopped()) break;
  }

  const finalStatus: ProgressSnapshot["status"] = isStopped() ? "stopped" : "completed";
  db.prepare(
    `UPDATE campaigns SET status=?, completed_at = datetime('now') WHERE id = ?`,
  ).run(finalStatus, campaignId);

  publish(snapshot(campaignId, finalStatus));

  // Send the HTML status report to the emails configured in REPORT_EMAILS.
  const { sendCampaignReport } = await import("@/lib/report");
  void sendCampaignReport(campaignId).catch((err) =>
    console.error(`[sender] report error for ${campaignId}`, err),
  );
}

export function stopCampaign(campaignId: string): boolean {
  const controller = running.get(campaignId);
  if (!controller) return false;
  controller.stop();
  return true;
}

export function resumeStaleCampaigns() {
  markStaleCampaigns();
}

export function progressFor(campaignId: string): ProgressSnapshot | null {
  return getLatest(campaignId);
}

export function retryFailed(campaignId: string): number {
  const failed = db
    .prepare("SELECT id FROM recipients WHERE campaign_id = ? AND status = 'failed'")
    .all(campaignId) as { id: string }[];
  const setFailed = db.prepare("UPDATE recipients SET status='pending', error=NULL, sent_at=NULL WHERE id = ?");
  const tx = db.transaction(() => {
    for (const r of failed) setFailed.run(r.id);
  });
  tx();
  db.prepare(
    "UPDATE campaigns SET status='draft', failed_count = 0, unsent_count = (SELECT COUNT(*) FROM recipients WHERE campaign_id=? AND status='pending') WHERE id = ?",
  ).run(campaignId, campaignId);
  return failed.length;
}

/** Used only by a worker/init path so crash-recovery is safe. */
export function initSender() {
  markStaleCampaigns();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { baileysManager } = require("@/lib/sender/baileys");
  if (baileysManager.hasPersistedSession()) {
    baileysManager.restoreFromDb();
    console.info("[wa-sender] Restored WhatsApp session from database");
  }
}

export function newCampaignId(): string {
  return newId("cmp");
}

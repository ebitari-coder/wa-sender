import "server-only";
import { db } from "@/lib/db";
import { sendHtmlEmail } from "@/lib/email";
import { formatDateTime } from "@/lib/format";

interface ReportRow {
  id: string;
  user_id: string;
  name: string;
  status: string;
  message: string;
  interval_secs: number;
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

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export async function sendCampaignReport(campaignId: string): Promise<void> {
  const campaign = db.prepare("SELECT * FROM campaigns WHERE id = ?").get(campaignId) as
    | ReportRow
    | undefined;
  if (!campaign) return;

  const recipients = process.env.REPORT_EMAILS?.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e));

  if (!recipients || recipients.length === 0) {
    console.info(`[report] No REPORT_EMAILS configured — skipping report for "${campaign.name}"`);
    return;
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(campaign.user_id) as
    | { full_name: string | null; email: string; phone: string | null }
    | undefined;

  const failed = db
    .prepare(
      "SELECT number, error FROM recipients WHERE campaign_id = ? AND status = 'failed' ORDER BY sent_at DESC LIMIT 50",
    )
    .all(campaignId) as { number: string; error: string | null }[];

  const percent =
    campaign.total_count === 0
      ? 0
      : Math.round(((campaign.success_count + campaign.failed_count) / campaign.total_count) * 100);

  const senderName = user?.full_name || "WA Sender user";
  const senderPhone = user?.phone || "—";
  const senderEmail = user?.email || "—";

  const failedRows = failed
    .map(
      (f) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0eeea;font-family:monospace;font-size:12px;">${esc(f.number)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0eeea;font-size:12px;color:#b91c1c;">${esc(f.error || "Delivery failed")}</td>
      </tr>`,
    )
    .join("");

  const statusColor =
    campaign.status === "completed"
      ? "#059669"
      : campaign.status === "sending"
        ? "#0284c7"
        : campaign.status === "failed"
          ? "#dc2626"
          : "#d97706";

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ef;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:#128c7e;padding:20px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="color:#ffffff;font-size:18px;font-weight:700;">WA Sender</div>
                    <div style="color:#b9ece4;font-size:12px;">Power City Oke Ira Campus</div>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background:#ffffff;color:${statusColor};font-size:12px;font-weight:700;padding:6px 14px;border-radius:999px;">${esc(statusLabel(campaign.status))}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px;">
              <h2 style="margin:0 0 4px;color:#3f352d;font-size:20px;">${esc(campaign.name)}</h2>
              <p style="margin:0 0 20px;color:#8a7f73;font-size:13px;">Campaign status report &middot; ${esc(formatDateTime(campaign.completed_at || campaign.created_at))}</p>

              <h3 style="margin:0 0 10px;color:#54463c;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Sender</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0eeea;border-radius:12px;margin-bottom:24px;">
                <tr><td style="padding:10px 14px;width:140px;font-size:12px;color:#8a7f73;">Full name</td><td style="padding:10px 14px;font-size:13px;font-weight:600;color:#2d2a26;">${esc(senderName)}</td></tr>
                <tr><td style="padding:10px 14px;font-size:12px;color:#8a7f73;">Phone number</td><td style="padding:10px 14px;font-size:13px;font-weight:600;color:#2d2a26;font-family:monospace;">${esc(senderPhone)}</td></tr>
                <tr><td style="padding:10px 14px;font-size:12px;color:#8a7f73;">Email</td><td style="padding:10px 14px;font-size:13px;font-weight:600;color:#2d2a26;">${esc(senderEmail)}</td></tr>
              </table>

              <h3 style="margin:0 0 10px;color:#54463c;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Delivery status</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:6px;margin-bottom:20px;">
                <tr>
                  <td align="center" style="background:#f5f3ef;border-radius:12px;padding:14px 8px;">
                    <div style="font-size:24px;font-weight:800;color:#2d2a26;">${campaign.total_count}</div>
                    <div style="font-size:11px;color:#8a7f73;">Total</div>
                  </td>
                  <td align="center" style="background:#ecfdf5;border-radius:12px;padding:14px 8px;">
                    <div style="font-size:24px;font-weight:800;color:#059669;">${campaign.success_count}</div>
                    <div style="font-size:11px;color:#6b7280;">Sent</div>
                  </td>
                  <td align="center" style="background:#fef2f2;border-radius:12px;padding:14px 8px;">
                    <div style="font-size:24px;font-weight:800;color:#dc2626;">${campaign.failed_count}</div>
                    <div style="font-size:11px;color:#6b7280;">Failed</div>
                  </td>
                  <td align="center" style="background:#fffbeb;border-radius:12px;padding:14px 8px;">
                    <div style="font-size:24px;font-weight:800;color:#d97706;">${campaign.unsent_count}</div>
                    <div style="font-size:11px;color:#6b7280;">Unsent</div>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#128c7e;height:8px;border-radius:6px;overflow:hidden;">
                    <table width="${Math.min(100, Math.max(2, percent))}%" cellpadding="0" cellspacing="0">
                      <tr><td style="background:#25d366;height:8px;"></td></tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="padding-top:6px;font-size:11px;color:#8a7f73;text-align:right;">${percent}% delivered</td></tr>
              </table>

              <h3 style="margin:0 0 10px;color:#54463c;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Timeline</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0eeea;border-radius:12px;margin-bottom:24px;">
                <tr><td style="padding:10px 14px;width:140px;font-size:12px;color:#8a7f73;">Created</td><td style="padding:10px 14px;font-size:13px;color:#2d2a26;">${esc(formatDateTime(campaign.created_at))}</td></tr>
                <tr><td style="padding:10px 14px;font-size:12px;color:#8a7f73;">Started</td><td style="padding:10px 14px;font-size:13px;color:#2d2a26;">${esc(formatDateTime(campaign.started_at))}</td></tr>
                <tr><td style="padding:10px 14px;font-size:12px;color:#8a7f73;">Completed</td><td style="padding:10px 14px;font-size:13px;color:#2d2a26;">${esc(formatDateTime(campaign.completed_at))}</td></tr>
                <tr><td style="padding:10px 14px;font-size:12px;color:#8a7f73;">Interval</td><td style="padding:10px 14px;font-size:13px;color:#2d2a26;">${campaign.interval_secs}s random between messages</td></tr>
                <tr><td style="padding:10px 14px;font-size:12px;color:#8a7f73;">Attachment</td><td style="padding:10px 14px;font-size:13px;color:#2d2a26;">${campaign.has_attachment ? "Yes" : "No"}</td></tr>
              </table>

              <h3 style="margin:0 0 10px;color:#54463c;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Message</h3>
              <div style="background:#f5f3ef;border-radius:12px;padding:14px 16px;font-size:13px;color:#2d2a26;line-height:1.6;margin-bottom:24px;white-space:pre-wrap;">${esc(campaign.message)}</div>

              ${
                failed.length > 0
                  ? `<h3 style="margin:0 0 10px;color:#54463c;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Failed numbers (${failed.length}${campaign.failed_count > 50 ? " of " + campaign.failed_count : ""})</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f0eeea;border-radius:12px;margin-bottom:24px;border-collapse:collapse;">
                    <tr>
                      <th align="left" style="padding:8px 12px;border-bottom:2px solid #e5e0da;font-size:11px;color:#8a7f73;text-transform:uppercase;">Number</th>
                      <th align="left" style="padding:8px 12px;border-bottom:2px solid #e5e0da;font-size:11px;color:#8a7f73;text-transform:uppercase;">Error</th>
                    </tr>
                    ${failedRows}
                  </table>`
                  : ""
              }

              <div style="border-top:1px solid #f0eeea;padding-top:16px;text-align:center;color:#a39a8f;font-size:11px;">
                Sent automatically by <b>WA Sender</b> — Power City Oke Ira Campus bulk messaging tool.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const prefix = process.env.REPORT_SUBJECT_PREFIX?.trim();
  const subject = `${prefix ? prefix + " " : ""}[WA Sender] ${statusLabel(campaign.status)} — ${campaign.name} (${campaign.success_count}/${campaign.total_count} sent)`;

  for (const to of recipients) {
    try {
      const ok = await sendHtmlEmail(to, subject, html);
      console.info(`[report] ${ok ? "Sent" : "FAILED to send"} report to ${to} for "${campaign.name}"`);
    } catch (err) {
      console.error(`[report] Error sending to ${to}`, err);
    }
  }
}

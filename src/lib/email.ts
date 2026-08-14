import "server-only";
import { db } from "@/lib/db";
import { hashToken, minutesFromNow, newId, nowIso } from "@/lib/ids";

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

export interface OtpDispatch {
  ok: boolean;
  delivered: boolean;
  email?: string;
  otp?: string;
}

async function sendViaMailtrap(to: string, subject: string, text: string, html: string): Promise<boolean> {
  const token = process.env.MAILTRAP_API_TOKEN;
  const fromEmail = process.env.MAILTRAP_FROM_EMAIL ?? "hello@pciokeiracampus.name.ng";
  const fromName = process.env.MAILTRAP_FROM_NAME ?? "WA Sender";
  if (!token) return false;
  try {
    const res = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { email: fromEmail, name: fromName },
        to: [{ email: to }],
        subject,
        text,
        html,
        category: "WA Sender OTP",
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] Mailtrap API error:", res.status, body);
    }
    return res.ok;
  } catch (err) {
    console.error("[email] Mailtrap API failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function sendHtmlEmail(to: string, subject: string, html: string): Promise<boolean> {
  return sendViaMailtrap(to, subject, "", html);
}

export async function sendOtp(email: string): Promise<OtpDispatch> {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const hashed = hashToken(otp);

  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
    | { id: string }
    | undefined;
  const userId = user?.id ?? newId("usr");

  db.transaction(() => {
    if (!user) {
      db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run(userId, email);
    }
    db.prepare("DELETE FROM otp_codes WHERE user_id = ?").run(userId);
    db.prepare(
      "INSERT INTO otp_codes (id, user_id, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    ).run(newId("otp"), userId, hashed, minutesFromNow(OTP_TTL_MINUTES), nowIso());
  })();

  const subject = "Your WA Sender access code";
  const text = `Your WA Sender login code is: ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`;
  const html = `<div style="font-family:Arial,sans-serif;padding:24px"><h2 style="color:#128C7E">WA Sender — Power City Oke Ira Campus</h2><p>Your access code is:</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#128C7E">${otp}</p><p>It expires in ${OTP_TTL_MINUTES} minutes. If you did not request this, ignore this email.</p></div>`;

  const delivered = await sendViaMailtrap(email, subject, text, html);

  console.info(`[auth] OTP for ${email}${delivered ? " emailed" : " (email not configured, dev display)"}`);
  if (!delivered) {
    console.info(`[auth] DEV OTP for ${email}: ${otp}`);
  }

  return { ok: true, delivered, email, ...(delivered ? {} : { otp }) };
}

export async function verifyOtp(email: string, otp: string): Promise<string | null> {
  const user = db.prepare("SELECT id, email FROM users WHERE email = ?").get(email) as
    | { id: string; email: string }
    | undefined;
  if (!user) return null;

  const row = db
    .prepare(
      "SELECT id, code_hash, attempts, expires_at FROM otp_codes WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(user.id) as { id: string; code_hash: string; attempts: number; expires_at: string } | undefined;
  if (!row) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM otp_codes WHERE id = ?").run(row.id);
    return null;
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    db.prepare("DELETE FROM otp_codes WHERE id = ?").run(row.id);
    return null;
  }

  if (hashToken(otp.trim()) !== row.code_hash) {
    db.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    return null;
  }

  db.prepare("DELETE FROM otp_codes WHERE id = ?").run(row.id);
  return user.id;
}

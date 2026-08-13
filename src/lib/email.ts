import "server-only";
import nodemailer from "nodemailer";
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

function transporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "1",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    tls: { rejectUnauthorized: false },
  });
}

async function sendViaResend(to: string, otp: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Power City WA Sender <onboarding@resend.dev>";
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: "Your WA Sender access code",
      text: `Your WA Sender login code is: ${otp}\n\nIt expires in ${OTP_TTL_MINUTES} minutes. If you did not request this, ignore this email.`,
      html: `<div style="font-family:Arial;padding:24px"><h2 style="color:#6b5b4f">WA Sender — Power City Oke Ira Campus</h2><p>Your access code is:</p><p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#128C7E">${otp}</p><p>It expires in ${OTP_TTL_MINUTES} minutes. If you did not request this, ignore this email.</p></div>`,
    }),
  });
  return res.ok;
}

export async function sendHtmlEmail(to: string, subject: string, html: string): Promise<boolean> {
  const smtp = transporter();
  if (smtp && process.env.SMTP_FROM) {
    try {
      await smtp.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
      return true;
    } catch (err) {
      console.error("[email] SMTP failed", err);
    }
  }

  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Power City WA Sender <onboarding@resend.dev>";
  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, html }),
      });
      return res.ok;
    } catch (err) {
      console.error("[email] Resend failed", err);
    }
  }
  return false;
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

  const smtp = transporter();
  let delivered = false;

  if (smtp && process.env.SMTP_FROM) {
    try {
      await smtp.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: "Your WA Sender access code",
        text: `Your WA Sender login code is: ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`,
        html: `<p>Your <b>WA Sender</b> access code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:bold">${otp}</p><p>Expires in ${OTP_TTL_MINUTES} minutes.</p>`,
      });
      delivered = true;
    } catch {
      /* fall through to Resend */
    }
  }

  if (!delivered) {
    const resendOk = await sendViaResend(email, otp).catch(() => false);
    delivered = resendOk;
  }

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

import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hashToken, newId, newToken } from "@/lib/ids";
import type { User } from "@/lib/ids";

export const SESSION_COOKIE = "wa_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string): Promise<string> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    hashToken(token),
    userId,
    expiresAt,
  );
  return token;
}

export async function destroySession(token: string): Promise<void> {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(hashToken(token));
}

export async function getUserFromToken(token: string): Promise<User | null> {
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.full_name, u.phone, u.created_at FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), new Date().toISOString()) as User | undefined;
  return row ?? null;
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserFromToken(token);
}

export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

export function requireUserId(userId: string | null | undefined): asserts userId is string {
  if (!userId) {
    const error = new Error("Unauthorized") as Error & { status: number };
    error.status = 401;
    throw error;
  }
}

export function createUserId(): string {
  return newId("usr");
}

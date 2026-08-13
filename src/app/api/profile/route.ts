import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, requireUserId } from "@/lib/auth";
import { normalizeNumber } from "@/lib/numbers";

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  requireUserId(user?.id ?? null);

  const body = await req.json().catch(() => ({}));
  const fullName = String(body.full_name ?? "").trim().slice(0, 80);
  const phoneRaw = String(body.phone ?? "").trim();
  const phone = phoneRaw ? (normalizeNumber(phoneRaw) ?? null) : null;

  if (phoneRaw && !phone) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  db.prepare("UPDATE users SET full_name = ?, phone = ? WHERE id = ?").run(
    fullName || null,
    phone,
    user!.id,
  );

  const updated = db
    .prepare("SELECT id, email, full_name, phone, created_at FROM users WHERE id = ?")
    .get(user!.id);
  return NextResponse.json({ user: updated });
}

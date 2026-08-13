import { NextResponse } from "next/server";
import { getCurrentUserId, requireUserId } from "@/lib/auth";
import { baileysManager } from "@/lib/sender/baileys";

export async function POST() {
  const userId = await getCurrentUserId();
  requireUserId(userId);

  if (baileysManager.state === "ready") {
    return NextResponse.json({ ok: true, state: "ready" });
  }
  if (baileysManager.state === "connecting" || baileysManager.state === "qr") {
    return NextResponse.json({ ok: true, state: baileysManager.state });
  }

  baileysManager.connect().catch((err) => {
    console.error("[api/connect] connect error:", err);
  });

  return NextResponse.json({ ok: true, state: "connecting" });
}

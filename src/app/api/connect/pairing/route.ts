import { NextResponse } from "next/server";
import { getCurrentUserId, requireUserId } from "@/lib/auth";
import { baileysManager } from "@/lib/sender/baileys";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  requireUserId(userId);

  const body = await req.json().catch(() => ({}));
  const phone = String(body.phoneNumber ?? "").trim();

  if (!phone || !/^\d{6,15}$/.test(phone)) {
    return NextResponse.json(
      { error: "Enter a valid phone number (6–15 digits, no +, spaces, or dashes)." },
      { status: 400 },
    );
  }

  if (baileysManager.state !== "qr") {
    return NextResponse.json(
      { error: "A QR code session is not active. Wait for the QR to appear, then try again." },
      { status: 400 },
    );
  }

  const code = await baileysManager.requestPairing(phone);

  if (!code) {
    return NextResponse.json(
      { error: "Failed to generate pairing code. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, pairingCode: code });
}

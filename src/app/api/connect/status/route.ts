import { NextResponse } from "next/server";
import { getCurrentUserId, requireUserId } from "@/lib/auth";
import { baileysManager, type WaConnectionState } from "@/lib/sender/baileys";

export async function GET() {
  const userId = await getCurrentUserId();
  requireUserId(userId);

  const state: WaConnectionState = baileysManager.state;
  const available = true;
  const hasPersistedSession = baileysManager.hasPersistedSession();

  return NextResponse.json({
    mode: "baileys",
    realMode: true,
    available,
    packageInstalled: true,
    state,
    reason: baileysManager.reason,
    readyInfo: baileysManager.readyInfo,
    hasPersistedSession,
    qr: baileysManager.qr,
    pairingCode: baileysManager.pairingCode,
  });
}

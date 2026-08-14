import "server-only";
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { sleep, type SendTarget, type SenderDriver } from "@/lib/sender/types";

const SESSION_DIR = process.env.WA_SESSION_DIR ?? path.join(process.cwd(), "data", "wa-session");

export type WaConnectionState =
  | "unavailable"
  | "disconnected"
  | "qr"
  | "connecting"
  | "ready"
  | "failed";

class BaileysManager extends EventEmitter {
  private sock: ReturnType<typeof makeWASocket> | null = null;
  state: WaConnectionState = "unavailable";
  reason = "";
  qr: string | null = null;
  pairingCode: string | null = null;
  readyInfo: { number?: string; name?: string } | null = null;
  private sessionId: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectAttempts = 0;
  private readonly maxConnectAttempts = 5;
  private pendingPairingPhone: string | null = null;

  private authDir(): string {
    return path.join(SESSION_DIR, "baileys_auth");
  }

  private persistSession(number: string, name: string): void {
    try {
      db.prepare(
        "UPDATE wa_sessions SET status = 'disconnected', disconnected_at = datetime('now') WHERE status = 'connected'"
      ).run();

      const id = newId("was");
      db.prepare(
        "INSERT INTO wa_sessions (id, phone_number, push_name, status) VALUES (?, ?, ?, 'connected')"
      ).run(id, number, name);
      this.sessionId = id;
      console.log(`[baileys] Session persisted: ${id}`);
    } catch (err) {
      console.error("[baileys] Failed to persist session:", err);
    }
  }

  private updateSessionStatus(status: "connected" | "disconnected"): void {
    if (!this.sessionId) return;
    try {
      if (status === "disconnected") {
        db.prepare(
          "UPDATE wa_sessions SET status = 'disconnected', disconnected_at = datetime('now') WHERE id = ?"
        ).run(this.sessionId);
      } else {
        db.prepare(
          "UPDATE wa_sessions SET status = 'connected', disconnected_at = NULL WHERE id = ?"
        ).run(this.sessionId);
      }
    } catch (err) {
      console.error(`[baileys] Failed to update session status:`, err);
    }
  }

  hasPersistedSession(): boolean {
    try {
      const connected = db.prepare(
        "SELECT id FROM wa_sessions WHERE status = 'connected' LIMIT 1"
      ).get() as { id: string } | undefined;
      if (connected) return true;

      const authFilesExist = fs.existsSync(path.join(this.authDir(), "creds.json"));
      if (!authFilesExist) return false;

      const latest = db.prepare(
        "SELECT id FROM wa_sessions ORDER BY connected_at DESC LIMIT 1"
      ).get() as { id: string } | undefined;
      return !!latest;
    } catch {
      return false;
    }
  }

  restoreFromDb(): boolean {
    try {
      let row = db.prepare(
        "SELECT id, phone_number, push_name FROM wa_sessions WHERE status = 'connected' ORDER BY connected_at DESC LIMIT 1"
      ).get() as { id: string; phone_number: string; push_name: string | null } | undefined;

      if (!row) {
        const authFilesExist = fs.existsSync(path.join(this.authDir(), "creds.json"));
        if (authFilesExist) {
          row = db.prepare(
            "SELECT id, phone_number, push_name FROM wa_sessions ORDER BY connected_at DESC LIMIT 1"
          ).get() as { id: string; phone_number: string; push_name: string | null } | undefined;
        }
      }

      if (row) {
        this.sessionId = row.id;
        this.readyInfo = { number: row.phone_number, name: row.push_name ?? undefined };
        this.state = "disconnected";
        this.reason = "";
        console.log(`[baileys] Found persisted session: ${row.id} (${row.phone_number})`);
        this.emit("state");
        return true;
      }
    } catch (err) {
      console.error("[baileys] Failed to restore session:", err);
    }
    return false;
  }

  async requestPairing(phoneNumber: string): Promise<string | null> {
    const clean = phoneNumber.replace(/\D/g, "");
    if (clean.length < 6 || clean.length > 15) {
      console.error("[baileys] Invalid phone number for pairing:", phoneNumber);
      return null;
    }
    if (!this.sock || this.state !== "qr") {
      console.error("[baileys] Cannot request pairing: not in QR state");
      return null;
    }
    this.pendingPairingPhone = clean;
    try {
      const code = await this.sock.requestPairingCode(clean);
      this.pairingCode = code;
      console.log(`[baileys] Pairing code for ${clean}: ${code}`);
      this.emit("state");
      return code;
    } catch (err) {
      console.error("[baileys] requestPairingCode failed:", err);
      return null;
    }
  }

  async connect(): Promise<{ ready: boolean; reason?: string }> {
    if (this.state === "ready") {
      return { ready: true };
    }
    if (this.state === "connecting") {
      return { ready: false, reason: "already connecting" };
    }

    // Clean up any existing connection
    if (this.sock) {
      try { this.sock.end(undefined); } catch {}
      this.sock = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.state = "connecting";
    this.reason = "";
    this.qr = null;
    this.pairingCode = null;
    this.pendingPairingPhone = null;
    this.emit("state");

    try {
      fs.mkdirSync(this.authDir(), { recursive: true });

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir());
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, undefined as any),
        },
        printQRInTerminal: false,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        retryRequestDelayMs: 3000,
        connectTimeoutMs: 60_000,
        maxMsgRetryCount: 3,
        browser: ["WA Sender", "Chrome", "1.0.0"],
        emitOwnEvents: true,
        fireInitQueries: true,
        transactionOpts: { maxCommitRetries: 3, delayBetweenTriesMs: 3000 },
        patchMessageBeforeSending: (message: any) => {
          // Ensure messages are properly formatted
          return message;
        },
      });

      this.sock.ev.on("creds.update", saveCreds);

      this.sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.state = "qr";
          // Request pairing code for mobile users who can't scan QR
          const phoneToUse = this.pendingPairingPhone ?? "123456";
          this.sock?.requestPairingCode?.(phoneToUse).then((code: string) => {
            this.pairingCode = code;
            console.log(`[baileys] Pairing code: ${code}`);
            this.emit("state");
          }).catch(() => {});
          // Also show QR for desktop users
          QRCode.toDataURL(qr, { width: 512, margin: 2 })
            .then((dataUrl) => {
              this.qr = dataUrl;
              this.emit("state");
            })
            .catch(() => {
              this.qr = qr;
              this.emit("state");
            });
          return;
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const error = lastDisconnect?.error as Boom;
          const isConflict = error?.data?.type === "replaced" || statusCode === 440;

          console.log(`[baileys] Connection closed: ${statusCode}, conflict: ${isConflict}`);

          // Conflict means another session replaced us — don't reconnect immediately
          // Let the user manually reconnect or wait longer
          if (isConflict) {
            console.log("[baileys] Session conflict — another WhatsApp Web session is active");
            this.state = "disconnected";
            this.reason = "Another WhatsApp session is active. Close other sessions and reconnect.";
            this.emit("state");
            return;
          }

          // Logged out permanently
          if (statusCode === DisconnectReason.loggedOut) {
            this.state = "failed";
            this.reason = "Logged out from WhatsApp";
            this.qr = null;
            this.updateSessionStatus("disconnected");
            this.emit("state");
            return;
          }

          // Other transient errors — reconnect with backoff
          this.state = "disconnected";
          this.reason = "Reconnecting...";
          this.emit("state");
          this.scheduleReconnect();
          return;
        }

        if (connection === "open") {
          this.state = "ready";
          this.connectAttempts = 0;
          this.qr = null;
          this.pairingCode = null;

          const number = this.sock?.user?.id?.replace(/:.*@/, "@").split("@")[0];
          const name = this.sock?.user?.name;

          if (number) {
            this.readyInfo = { number, name };
            this.persistSession(number, name ?? "Unknown");
          }

          console.log(`[baileys] Connected: ${name || "Unknown"} (+${number || "Unknown"})`);
          this.emit("state");
        }
      });

      // Give it a moment to connect
      await sleep(1000);

      if (this.state === "connecting") {
        // Still connecting — waiting for QR or connection
        return { ready: false, reason: "initializing" };
      }

      return { ready: this.state === "ready" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[baileys] Connect failed:", msg);
      this.state = "failed";
      this.reason = msg;
      this.emit("state");
      return { ready: false, reason: msg };
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.connectAttempts >= this.maxConnectAttempts) {
      console.log("[baileys] Max reconnect attempts reached");
      this.state = "disconnected";
      this.reason = "Connection lost. Click Connect to retry.";
      this.emit("state");
      return;
    }

    // Longer delays to avoid conflict loops
    const delays = [5000, 15000, 30000, 60000, 120000];
    const delay = delays[Math.min(this.connectAttempts, delays.length - 1)];
    this.connectAttempts++;
    console.log(`[baileys] Reconnecting in ${delay}ms (attempt ${this.connectAttempts}/${this.maxConnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, delay);
    this.reconnectTimer.unref?.();
  }

  async send(target: SendTarget): Promise<void> {
    if (!this.sock || this.state !== "ready") {
      throw new Error("WhatsApp is not connected");
    }

    const jid = jidNormalizedUser(target.number.replace(/^\+/, "") + "@c.us");

    if (target.attachmentPath && fs.existsSync(target.attachmentPath)) {
      const ext = path.extname(target.attachmentPath).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".gif": "image/gif", ".webp": "image/webp", ".mp4": "video/mp4",
        ".pdf": "application/pdf", ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
      const mimeType = mimeMap[ext] ?? "application/octet-stream";
      const buffer = fs.readFileSync(target.attachmentPath);

      await this.sock.sendMessage(jid, {
        document: buffer,
        fileName: path.basename(target.attachmentPath),
        mimetype: mimeType,
        caption: target.text || undefined,
      });
    } else {
      await this.sock.sendMessage(jid, { text: target.text });
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {}
    }
    this.sock = null;
    this.state = "disconnected";
    this.updateSessionStatus("disconnected");
    this.emit("state");
  }
}

export const baileysManager = new BaileysManager();

export class BaileysDriver implements SenderDriver {
  isAvailable(): boolean {
    return true;
  }

  availabilityReason(): string {
    return baileysManager.reason;
  }

  async connect(): Promise<{ ready: boolean; reason?: string }> {
    return baileysManager.connect();
  }

  async send(target: SendTarget): Promise<void> {
    return baileysManager.send(target);
  }

  async disconnect(): Promise<void> {
    return baileysManager.disconnect();
  }
}

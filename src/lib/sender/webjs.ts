import "server-only";
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { sleep } from "@/lib/sender/types";
import type { SendTarget, SenderDriver } from "@/lib/sender/types";

type WebJS = typeof import("whatsapp-web.js");

type WaEvents = {
  qr: [qr: string];
  authenticated: [];
  ready: [];
  disconnected: [reason: string];
  auth_failure: [message: string];
};

type WaClient = {
  info: { wid: { user: string }; pushname?: string } | null;
  on<E extends keyof WaEvents>(event: E, listener: (...args: WaEvents[E]) => void): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  sendMessage(to: string, content: unknown, options?: unknown): Promise<unknown>;
  pupPage: { isClosed(): boolean; url(): string };
};

const SESSION_DIR = process.env.WA_SESSION_DIR ?? path.join(process.cwd(), "data", "wa-session");
const CACHE_DIR = path.join(process.cwd(), ".wwebjs_cache");

function clearWebCache(): void {
  try {
    if (fs.existsSync(CACHE_DIR)) {
      fs.rmSync(CACHE_DIR, { recursive: true, force: true });
    }
  } catch {}
}

function ensureCacheDir(): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  } catch {}
}

export type WaConnectionState =
  | "unavailable"
  | "disconnected"
  | "qr"
  | "connecting"
  | "ready"
  | "failed";

function cleanLockFiles(): void {
  const locks = ["SingletonLock", "SingletonCookie", "SingletonSocket"];
  for (const lock of locks) {
    try {
      fs.unlinkSync(path.join(SESSION_DIR, "session", lock));
    } catch {}
  }
}

function isLockError(msg: string): boolean {
  return msg.includes("browser is already running") || msg.includes("userDataDir") || msg.includes("SingletonLock");
}

function isDetachedFrameError(msg: string): boolean {
  return (
    msg.includes("detached Frame") ||
    msg.includes("Target closed") ||
    msg.includes("Session closed")
  );
}

function isMinifiedError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // whatsapp-web.js minified errors have single-letter name and message
  // (e.g. "t: t") with no useful stack trace pointing to our code
  const name = err.name || "";
  const message = err.message || "";
  return (
    name.length <= 2 &&
    message.length <= 2 &&
    name === message &&
    !message.includes(" ")
  );
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const parts = [err.name, err.message].filter(Boolean);
    // whatsapp-web.js often throws minified errors where message is just a
    // single letter. Pull extra context from non-standard enumerable properties.
    for (const key of Object.keys(err)) {
      const val = (err as unknown as Record<string, unknown>)[key];
      if (val != null && typeof val === "object") {
        try {
          parts.push(`${key}=${JSON.stringify(val)}`);
        } catch {}
      } else if (val != null && typeof val === "string" && val !== err.message) {
        parts.push(`${key}=${val}`);
      }
    }
    if (parts.length <= 1 && err.stack) parts.push(err.stack.split("\n").slice(0, 3).join(" | "));
    return parts.join(": ") || String(err);
  }
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

class WebJsManager extends EventEmitter {
  private client: WaClient | null = null;
  private loading: Promise<WebJS | null> | null = null;
  private initializing: boolean = false;
  state: WaConnectionState = "unavailable";
  reason = "";
  qr: string | null = null;
  readyInfo: { number?: string; name?: string } | null = null;
  private connectAttempts = 0;
  private readonly maxConnectAttempts = 2;
  private sessionId: string | null = null;
  private readyAt = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private webjs(): Promise<WebJS | null> {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const mod = await import("whatsapp-web.js");
        return mod;
      } catch {
        this.reason = "whatsapp-web.js is not installed. Run `npm install whatsapp-web.js` and restart.";
        return null;
      }
    })();
    return this.loading;
  }

  private persistSession(number: string, name: string): void {
    try {
      // Mark any existing connected session as disconnected
      db.prepare(
        "UPDATE wa_sessions SET status = 'disconnected', disconnected_at = datetime('now') WHERE status = 'connected'"
      ).run();

      // Insert new session
      const id = newId("was");
      db.prepare(
        "INSERT INTO wa_sessions (id, phone_number, push_name, status) VALUES (?, ?, ?, 'connected')"
      ).run(id, number, name);
      this.sessionId = id;
      console.log(`[wa] Session persisted to database: ${id}`);
    } catch (err) {
      console.error("[wa] Failed to persist session:", err);
    }
  }

  private clearSession(): void {
    if (this.sessionId) {
      try {
        db.prepare(
          "UPDATE wa_sessions SET status = 'disconnected', disconnected_at = datetime('now') WHERE id = ?"
        ).run(this.sessionId);
        console.log(`[wa] Session marked as disconnected: ${this.sessionId}`);
      } catch (err) {
        console.error("[wa] Failed to clear session:", err);
      }
      this.sessionId = null;
    }
  }

  private updateSessionStatus(status: "connected" | "disconnected"): void {
    if (this.sessionId) {
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
        console.error(`[wa] Failed to update session status to ${status}:`, err);
      }
    }
  }

  private startHealthCheck(): void {
    this.stopHealthCheck();
    // Check every 30 seconds if the WhatsApp connection is still alive
    this.healthCheckTimer = setInterval(() => {
      if (this.state !== "ready" || !this.client) return;
      
      try {
        if (this.client.pupPage.isClosed()) {
          console.warn("[wa] Health check: browser page is closed, silently restarting...");
          this.silentRestart("Browser page closed");
        }
      } catch {
        console.warn("[wa] Health check: failed to check page status, silently restarting...");
        this.silentRestart("Health check failed");
      }
    }, 30_000);
    this.healthCheckTimer.unref?.();
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Silently restart the browser and restore from LocalAuth session on disk.
   * Unlike handleDisconnection(), this does NOT mark the session as invalid —
   * the LocalAuth data is still valid, just the browser process died.
   */
  private silentRestart(reason: string): void {
    console.log(`[wa] Silent restart triggered: ${reason}`);
    
    const dead = this.client;
    this.client = null;
    this.initializing = false;
    if (dead) {
      try { void dead.destroy(); } catch {}
    }
    
    this.stopHealthCheck();
    
    // Immediately try to reconnect using persisted session
    // LocalAuth will restore from disk without QR scan
    this.state = "connecting";
    this.reason = "";
    this.emit("state");
    
    this.connectAttempts = 0;
    this.connect().then((res) => {
      if (res.ready) {
        console.log("[wa] Silent restart: reconnected successfully");
      } else {
        console.warn(`[wa] Silent restart: connect returned ${res.reason}, will retry...`);
        // Schedule a retry with backoff
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.connectAttempts >= this.maxConnectAttempts) {
      console.log("[wa] Max reconnect attempts reached");
      return;
    }
    
    const delay = Math.min(5000 * Math.pow(2, this.connectAttempts), 60_000);
    console.log(`[wa] Reconnect in ${delay}ms (attempt ${this.connectAttempts + 1}/${this.maxConnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.state !== "disconnected") return;
      
      this.connectAttempts++;
      this.connect().then((res) => {
        if (res.ready || res.reason === "initializing") {
          console.log("[wa] Reconnect successful");
          this.connectAttempts = 0;
        } else {
          console.warn(`[wa] Reconnect failed: ${res.reason}`);
          this.scheduleReconnect();
        }
      });
    }, delay);
    this.reconnectTimer.unref?.();
  }

  /**
   * Handle a true disconnection — only called when the session is truly invalid
   * (auth_failure) or when the user explicitly disconnects.
   */
  private handleDisconnection(reason: string): void {
    if (this.state === "disconnected" || this.state === "connecting") return;
    
    this.state = "disconnected";
    this.reason = reason ?? "Disconnected";
    this.qr = null;
    this.initializing = false;
    
    this.updateSessionStatus("disconnected");
    
    const dead = this.client;
    this.client = null;
    if (dead) {
      try { void dead.destroy(); } catch {}
    }
    
    this.stopHealthCheck();
    this.emit("state");
    
    console.log(`[wa] Disconnected: ${reason}`);
  }

  hasPersistedSession(): boolean {
    try {
      // First check for an explicitly connected session
      const connected = db.prepare(
        "SELECT id FROM wa_sessions WHERE status = 'connected' LIMIT 1"
      ).get() as { id: string } | undefined;
      if (connected) return true;

      // Fall back to the most recent session — the LocalAuth data on disk may
      // still be valid even though we marked it disconnected during a previous
      // server shutdown / campaign disconnect.
      const sessionOnDisk = fs.existsSync(
        path.join(SESSION_DIR, "session", "Default", "IndexedDB", "https_web.whatsapp.com_0.indexeddb.leveldb"),
      );
      if (!sessionOnDisk) return false;

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
      // Prefer an explicitly connected session
      let row = db.prepare(
        "SELECT id, phone_number, push_name FROM wa_sessions WHERE status = 'connected' ORDER BY connected_at DESC LIMIT 1"
      ).get() as { id: string; phone_number: string; push_name: string | null } | undefined;

      // Fall back to the most recent session if LocalAuth data is on disk
      if (!row) {
        const sessionOnDisk = fs.existsSync(
          path.join(SESSION_DIR, "session", "Default", "IndexedDB", "https_web.whatsapp.com_0.indexeddb.leveldb"),
        );
        if (sessionOnDisk) {
          row = db.prepare(
            "SELECT id, phone_number, push_name FROM wa_sessions ORDER BY connected_at DESC LIMIT 1"
          ).get() as { id: string; phone_number: string; push_name: string | null } | undefined;
        }
      }

      if (row) {
        this.sessionId = row.id;
        this.readyInfo = { number: row.phone_number, name: row.push_name ?? undefined };
        // Don't connect yet — just record that a session exists on disk.
        // The browser will only launch when the user clicks "Connect" or
        // when a campaign actually needs to send.
        this.state = "disconnected";
        this.reason = "";
        console.log(`[wa] Found persisted session: ${row.id} (${row.phone_number}) — waiting for explicit connect`);
        this.emit("state");
        return true;
      }
    } catch (err) {
      console.error("[wa] Failed to restore session from database:", err);
    }
    return false;
  }

  async connect(): Promise<{ ready: boolean; reason?: string }> {
    const mod = await this.webjs();
    if (!mod) return { ready: false, reason: this.reason };
    if (this.client?.info?.wid) return { ready: true };

    if (this.initializing) {
      console.log("[wa] Already initializing, waiting...");
      return { ready: false, reason: "initializing" };
    }

    if (this.client) {
      this.state = "connecting";
      this.emit("state");
      return { ready: false, reason: "still connecting" };
    }

    this.initializing = true;

    try {
      fsMkdir(SESSION_DIR);
    } catch {}

    this.state = "connecting";
    this.emit("state");

    // Only clear cache if there's no existing session data
    // LocalAuth stores session in the Chrome profile's IndexedDB
    const sessionExists = fs.existsSync(path.join(SESSION_DIR, "session", "Default", "IndexedDB", "https_web.whatsapp.com_0.indexeddb.leveldb"));
    if (!sessionExists) {
      console.log("[wa] No existing session found, clearing cache");
      clearWebCache();
    } else {
      console.log("[wa] Existing session found, restoring...");
    }
    ensureCacheDir();

    const { Client, LocalAuth } = mod;
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
      puppeteer: {
        headless: false,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-blink-features=AutomationControlled",
          "--disable-extensions",
          "--disable-default-apps",
          "--disable-popup-blocking",
          "--disable-translate",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-infobars",
          "--window-size=1280,900",
          "--start-maximized",
          "--disable-features=site-per-process",
          "--disable-web-security",
          "--allow-running-insecure-content",
        ],
      },
      authTimeoutMs: 300000, // 5 minutes for auth (time to scan QR)
      takeoverOnConflict: true,
    });

    this.client.on("qr", async (qr: string) => {
      this.state = "qr";
      console.log(`[wa] QR event received (len=${qr.length}) prefix=${qr.slice(0, 80)}`);
      
      // Always generate QR from the raw string using QRCode library for reliability
      try {
        this.qr = await QRCode.toDataURL(qr, {
          width: 512,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#000000", light: "#ffffff" },
        });
        console.log(`[wa] Generated QR code data URL (${this.qr.length} chars)`);
      } catch (err) {
        console.error("[wa] QR generation error:", err);
        // Fallback to raw string if QRCode generation fails
        this.qr = qr;
      }
      
      this.emit("state");
    });

    this.client.on("authenticated", () => {
      console.log("[wa] Authentication successful, session saved");
      this.state = "connecting";
      this.emit("state");
    });

    this.client.on("ready", () => {
      this.state = "ready";
      this.connectAttempts = 0;
      this.initializing = false;
      this.readyAt = Date.now();
      const number = this.client?.info?.wid?.user;
      const name = this.client?.info?.pushname;
      this.readyInfo = number ? { number, name } : null;
      console.log(`[wa] WhatsApp ready: ${name || "Unknown"} (+${number || "Unknown"})`);
      if (number) {
        this.persistSession(number, name ?? "Unknown");
      }
      this.startHealthCheck();
      this.emit("state");
    });

    this.client.on("disconnected", (reason: string) => {
      console.log(`[wa] WhatsApp disconnected: ${reason}`);
      // Most disconnects are transient (network, browser crash, etc.)
      // The LocalAuth session on disk is still valid — silently restart
      this.silentRestart(reason);
    });

    this.client.on("auth_failure", (msg: string) => {
      this.state = "failed";
      this.reason = msg ?? "Authentication failed";
      this.initializing = false;
      this.clearSession();
      this.emit("state");
    });

    try {
      console.log("[wa] Starting client initialization...");
      await this.client.initialize();
      console.log("[wa] Client initialization completed");
      this.initializing = false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[wa] initialize failed:", msg);
      this.initializing = false;
      
      if (isLockError(msg) && this.connectAttempts < this.maxConnectAttempts) {
        this.connectAttempts++;
        console.log(`[wa] Lock file error detected, cleaning up and retrying (attempt ${this.connectAttempts})`);
        cleanLockFiles();
        this.client = null;
        return this.connect();
      }

      this.client = null;
      this.state = "failed";
      this.reason = isLockError(msg) 
        ? "Browser session conflict. Please retry in a moment." 
        : msg;
      this.emit("state");
      return { ready: false, reason: this.reason };
    }
    return { ready: false, reason: "initializing" };
  }

  async send(target: SendTarget): Promise<void> {
    if (!this.client || !this.client.info?.wid) throw new Error("WhatsApp is not connected");

    // Check Puppeteer page health before attempting send
    try {
      if (this.client.pupPage.isClosed()) {
        throw new Error("Browser page is closed");
      }
      const url = this.client.pupPage.url();
      if (!url.includes("web.whatsapp.com")) {
        throw new Error(`Browser page navigated away: ${url}`);
      }
    } catch (err) {
      this.silentRestart("Browser page unavailable");
      throw new Error("WhatsApp browser page is unavailable, reconnecting...");
    }

    // Probe WhatsApp's actual internal state. The Puppeteer page may be alive
    // but WhatsApp's internal socket/module state can be broken — this is what
    // causes the "t: t" minified errors. Check the socket state and WWebJS
    // availability before attempting a real send.
    try {
      const healthy = await (this.client.pupPage as any).evaluate(() => {
        const state = (window as any).require?.("WAWebSocketModel")?.Socket?.state;
        const wwebjs = typeof (window as any).WWebJS !== "undefined";
        return { state, wwebjs };
      });
      if (healthy.state !== "CONNECTED") {
        throw new Error(`WhatsApp socket state: ${healthy.state ?? "unknown"}`);
      }
      if (!healthy.wwebjs) {
        throw new Error("WWebJS not injected");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // If the page evaluate itself failed, the page is dead
      if (msg.includes("detached") || msg.includes("closed") || msg.includes("Target")) {
        this.silentRestart("Browser page unavailable");
        throw new Error("WhatsApp browser page is unavailable, reconnecting...");
      }
      // Internal state broken — page is alive but WA is not functional
      throw new Error(`WhatsApp not ready: ${msg}`);
    }

    // Warmup delay: after the 'ready' event, WhatsApp's internal stores
    // may not be fully hydrated. This prevents the "t: t" minified errors
    // caused by race conditions between store initialization and message sending.
    const timeSinceReady = Date.now() - this.readyAt;
    if (timeSinceReady < 5000) {
      const warmupDelay = 5000 - timeSinceReady;
      console.log(`[wa] Warmup delay: ${warmupDelay}ms`);
      await sleep(warmupDelay);
    }

    const number = `${target.number.replace(/^\+/, "")}@c.us`;
    try {
      if (target.attachmentPath) {
        const mod = await this.webjs();
        if (!mod) throw new Error("whatsapp-web.js is not available");
        const media = mod.MessageMedia.fromFilePath(target.attachmentPath);
        await this.client.sendMessage(number, media, { caption: target.text });
      } else {
        await this.client.sendMessage(number, target.text);
      }
    } catch (err) {
      const msg = toErrorMessage(err);
      console.error(`[wa] sendMessage error for ${number}:`, msg);

      // Detect dead page: detached frame means the Puppeteer page is truly gone.
      const isDeadPage = isDetachedFrameError(msg);
      if (isDeadPage) {
        console.error("[wa] Dead browser page detected, restarting silently...");
        this.silentRestart("Browser page reloaded");
      }
      throw new Error(`Send failed: ${msg}`);
    }
  }

  async disconnect(): Promise<void> {
    this.stopHealthCheck();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      try {
        await this.client.destroy();
      } catch {}
    }
    this.client = null;
    this.state = "disconnected";
    this.updateSessionStatus("disconnected");
    this.emit("state");
  }
}

function fsMkdir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export const webJsManager = new WebJsManager();

export class WebJsDriver implements SenderDriver {
  isAvailable(): boolean {
    return true;
  }

  availabilityReason(): string {
    return webJsManager.reason;
  }

  async connect(): Promise<{ ready: boolean; reason?: string }> {
    return webJsManager.connect();
  }

  async send(target: SendTarget): Promise<void> {
    return webJsManager.send(target);
  }

  async disconnect(): Promise<void> {
    return webJsManager.disconnect();
  }
}

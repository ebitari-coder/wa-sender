import "server-only";

export interface SendTarget {
  number: string;
  text: string;
  attachmentPath?: string | null;
  attachmentType?: "image" | "video" | "document" | "contact" | null;
}

export interface SenderDriver {
  /** Returns true if the driver is available/configured in this environment. */
  isAvailable(): boolean;
  /** Human-readable reason when unavailable. */
  availabilityReason(): string;
  /** Ensure the underlying connection is ready before sending. */
  connect(): Promise<{ ready: boolean; reason?: string }>;
  send(target: SendTarget): Promise<void>;
  disconnect(): Promise<void>;
}

export function randomDelay(baseSeconds: number): number {
  const min = Math.max(0.5, baseSeconds * 0.4);
  const max = Math.max(min + 0.5, baseSeconds * 1.4);
  const ms = (min + Math.random() * (max - min)) * 1000;
  return ms;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

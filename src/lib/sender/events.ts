import "server-only";

export interface ProgressSnapshot {
  campaignId: string;
  status: "sending" | "completed" | "stopped" | "failed";
  total: number;
  sent: number;
  success: number;
  failed: number;
  unsent: number;
  percent: number;
  currentNumber: string | null;
  startedAt: string;
  completedAt: string | null;
}

type Subscriber = (snapshot: ProgressSnapshot) => void;

const subscribers = new Map<string, Set<Subscriber>>();
const latest = new Map<string, ProgressSnapshot>();

export function subscribe(campaignId: string, fn: Subscriber): () => void {
  let set = subscribers.get(campaignId);
  if (!set) {
    set = new Set();
    subscribers.set(campaignId, set);
  }
  set.add(fn);
  return () => {
    set?.delete(fn);
  };
}

export function publish(snapshot: ProgressSnapshot) {
  latest.set(snapshot.campaignId, snapshot);
  for (const fn of subscribers.get(snapshot.campaignId) ?? []) {
    try {
      fn(snapshot);
    } catch {
      /* noop */
    }
  }
}

export function getLatest(campaignId: string): ProgressSnapshot | null {
  return latest.get(campaignId) ?? null;
}

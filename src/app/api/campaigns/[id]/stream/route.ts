import { getCurrentUserId, requireUserId } from "@/lib/auth";
import { getCampaign } from "@/lib/campaigns";
import { getLatest, subscribe } from "@/lib/sender/events";
import { progressFor } from "@/lib/sender";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  requireUserId(userId);
  const { id } = await ctx.params;

  const campaign = getCampaign(userId, id);
  if (!campaign) {
    return new Response("Campaign not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let cancelled = false;
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* stream closed */
        }
      };

      const initial = getLatest(id) ?? progressFor(id);
      if (initial) send(initial);

      const unsubscribe = subscribe(id, send);

      heartbeat = setInterval(() => {
        if (cancelled) return;
        const snap = getLatest(id) ?? progressFor(id);
        if (snap) send(snap);
      }, 3000);

      _req.signal.addEventListener("abort", () => {
        cancelled = true;
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

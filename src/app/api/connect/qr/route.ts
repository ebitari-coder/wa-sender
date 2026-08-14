import { getCurrentUserId, requireUserId } from "@/lib/auth";
import { baileysManager } from "@/lib/sender/baileys";

export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
  const userId = await getCurrentUserId();
  requireUserId(userId);

  const encoder = new TextEncoder();
  let cancelled = false;
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          /* closed */
        }
      };

      const emit = () => {
        send({
          state: baileysManager.state,
          qr: baileysManager.qr,
          pairingCode: baileysManager.pairingCode,
          reason: baileysManager.reason,
          readyInfo: baileysManager.readyInfo,
        });
        if (baileysManager.state === "ready") {
          unsubscribe();
          if (heartbeat) clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            /* closed */
          }
        }
      };

      const unsubscribe = () => {
        baileysManager.removeListener("state", emit);
      };
      baileysManager.on("state", emit);

      emit();

      if (baileysManager.state === "unavailable" || baileysManager.state === "disconnected" || baileysManager.state === "failed") {
        void baileysManager.connect().catch((err) => {
          console.error("[connect] connect() rejected:", err);
        });
      } else if (baileysManager.state === "qr") {
        baileysManager.emit("state");
      }

      heartbeat = setInterval(emit, 5000);

      _req.signal.addEventListener("abort", () => {
        cancelled = true;
        unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* closed */
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

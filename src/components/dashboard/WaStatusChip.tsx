"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

interface WaStatus {
  mode: string;
  realMode: boolean;
  available: boolean;
  packageInstalled: boolean;
  state: string;
  reason: string;
  readyInfo: { number?: string; name?: string } | null;
}

const META: Record<string, { label: string; dot: string; text: string }> = {
  ready: { label: "WhatsApp connected", dot: "bg-emerald-500", text: "text-emerald-700" },
  qr: { label: "Scan QR to connect", dot: "bg-amber-500", text: "text-amber-700" },
  connecting: { label: "Connecting…", dot: "bg-sky-500 animate-pulse-soft", text: "text-sky-700" },
  disconnected: { label: "Disconnected", dot: "bg-stone-400", text: "text-stone-600" },
  failed: { label: "Connection failed", dot: "bg-red-500", text: "text-red-700" },
  unavailable: { label: "Checking…", dot: "bg-stone-300", text: "text-stone-500" },
};

export default function WaStatusChip() {
  const [status, setStatus] = useState<WaStatus | null>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch("/api/connect/status");
        if (res.ok) {
          const data = (await res.json()) as WaStatus;
          if (alive) setStatus(data);
        }
      } catch {
        /* keep last known state */
      }
    }
    void tick();
    const iv = setInterval(tick, 8000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  const st = status;
  const meta = META[st?.state ?? "unavailable"] ?? META.unavailable;
  const ready = st?.state === "ready";

  return (
    <Link
      href="/dashboard/connect"
      title={st?.reason || meta.label}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors hover:bg-stone-100 ${meta.text} ${
        ready ? "border-emerald-200 bg-emerald-50" : "border-stone-200 bg-white"
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
      <span className="max-w-36 truncate">
        {ready && st?.readyInfo?.number ? `+${st.readyInfo.number}` : meta.label}
      </span>
      <Icon name="chevron" className="h-3 w-3 -rotate-90 opacity-50" />
    </Link>
  );
}

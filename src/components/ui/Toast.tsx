"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export function useToast() {
  return useCallback((message: string, kind: ToastKind = "info") => {
    window.dispatchEvent(new CustomEvent("toast", { detail: { message, kind } }));
  }, []);
}

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const handler = (e: Event) => {
      const { message, kind } = (e as CustomEvent).detail as { message: string; kind: ToastKind };
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, kind }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    };
    window.addEventListener("toast", handler);
    return () => window.removeEventListener("toast", handler);
  }, []);

  const icons: Record<ToastKind, string> = {
    success: "M20 6 9 17l-5-5",
    error: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
    info: "M12 8h.01M12 12v4",
  };
  const colors: Record<ToastKind, string> = {
    success: "bg-emerald-600",
    error: "bg-red-600",
    info: "bg-stone-800",
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg animate-slide-up ${colors[t.kind]}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={icons[t.kind]} />
          </svg>
          <span className="leading-snug">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

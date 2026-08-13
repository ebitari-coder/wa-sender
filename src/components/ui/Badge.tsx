import type { ReactNode } from "react";

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "green" | "red" | "amber" | "blue" | "brand";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-stone-100 text-stone-600",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    red: "bg-red-50 text-red-700 ring-red-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
    blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
    brand: "bg-brand/10 text-brand-dark",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-accent ${className}`}
    />
  );
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-stone-100 ${className}`}>
      <div
        className="h-full rounded-full bg-accent transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-12 text-center">
      {icon && <div className="text-stone-400">{icon}</div>}
      <p className="text-sm font-medium text-stone-700">{title}</p>
      {hint && <p className="max-w-xs text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

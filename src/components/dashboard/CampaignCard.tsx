"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Campaign } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/ui/Toast";

export function statusMeta(status: Campaign["status"]) {
  switch (status) {
    case "completed":
      return { label: "Completed", tone: "green" as const, icon: "check" as const };
    case "sending":
      return { label: "Sending", tone: "blue" as const, icon: "send" as const };
    case "scheduled":
      return { label: "Scheduled", tone: "amber" as const, icon: "clock" as const };
    case "stopped":
      return { label: "Stopped", tone: "amber" as const, icon: "stop" as const };
    case "failed":
      return { label: "Failed", tone: "red" as const, icon: "x" as const };
    default:
      return { label: "Draft", tone: "neutral" as const, icon: "doc" as const };
  }
}

export default function CampaignCard({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const toast = useToast();
  const meta = statusMeta(campaign.status);
  const isScheduled = campaign.status === "scheduled";
  const isDone = ["completed", "stopped", "failed"].includes(campaign.status);

  async function retry() {
    const res = await fetch(`/api/campaigns/${campaign.id}/retry`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return toast(data.error ?? "Retry failed", "error");
    toast(`Requeued ${data.retried} failed message(s).`, "success");
    router.refresh();
  }

  async function cancelSchedule() {
    const res = await fetch(`/api/campaigns/${campaign.id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error ?? "Could not cancel", "error");
    toast("Schedule cancelled. Campaign moved to drafts.", "success");
    router.refresh();
  }

  return (
    <Link
      href={`/dashboard/campaigns/${campaign.id}`}
      className="block rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-stone-900">{campaign.name}</h3>
            <Badge tone={meta.tone}>
              <Icon name={meta.icon} className="h-3 w-3" />
              {meta.label}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-stone-400">
            {formatDateTime(campaign.created_at)}
            {campaign.scheduled_for && isScheduled
              ? ` · sends ${formatDateTime(campaign.scheduled_for)}`
              : ""}
          </p>
        </div>
        {campaign.has_attachment === 1 && (
          <Icon name="image" className="h-4 w-4 shrink-0 text-stone-400" />
        )}
      </div>

      {!isScheduled && (
        <div className="mt-3 flex items-center gap-4 text-xs font-medium text-stone-500">
          <span className="inline-flex items-center gap-1 text-stone-600">
            <Icon name="users" className="h-3.5 w-3.5" />
            {campaign.total_count}
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <Icon name="check" className="h-3.5 w-3.5" />
            {campaign.success_count}
          </span>
          <span className="inline-flex items-center gap-1 text-red-500">
            <Icon name="x" className="h-3.5 w-3.5" />
            {campaign.failed_count}
          </span>
          {campaign.status === "sending" && (
            <span className="inline-flex items-center gap-1 text-sky-600">
              <Icon name="send" className="h-3.5 w-3.5 animate-pulse-soft" />
              sending…
            </span>
          )}
        </div>
      )}

      {(isScheduled || isDone) && (
        <div className="mt-3 flex items-center gap-2" onClick={(e) => e.preventDefault()}>
          {isScheduled && (
            <>
              <button
                onClick={() => void cancelSchedule()}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-stone-200 px-2.5 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
              >
                <Icon name="x" className="h-3 w-3" />
                Cancel
              </button>
              <Link
                href={`/dashboard/campaigns/${campaign.id}/schedule`}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-stone-200 px-2.5 text-[11px] font-medium text-accent hover:bg-accent/5"
              >
                <Icon name="calendar" className="h-3 w-3" />
                Reschedule
              </Link>
            </>
          )}
          {isDone && campaign.failed_count > 0 && (
            <button
              onClick={() => void retry()}
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-stone-200 px-2.5 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
            >
              <Icon name="retry" className="h-3 w-3" />
              Retry {campaign.failed_count} failed
            </button>
          )}
          <span className="text-[11px] text-stone-400">View details</span>
        </div>
      )}
    </Link>
  );
}

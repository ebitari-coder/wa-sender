"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Attachment, Campaign, Recipient } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, ProgressBar, Spinner } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { statusMeta } from "@/components/dashboard/CampaignCard";
import { renderWhatsApp } from "@/components/dashboard/messageFormat";
import { formatDateTime } from "@/lib/format";

interface Counts {
  total: number;
  pending: number;
  sending: number;
  success: number;
  failed: number;
}

type Tab = "unsent" | "success" | "failed" | "all";

const MAX_LIST = 500;

export default function CampaignDetail({
  campaign: initial,
  initialCounts,
  initialRecipients,
  attachments,
}: {
  campaign: Campaign;
  initialCounts: Counts;
  initialRecipients: Recipient[];
  attachments: Attachment[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [campaign, setCampaign] = useState(initial);
  const [counts, setCounts] = useState(initialCounts);
  const [recipients, setRecipients] = useState(initialRecipients);
  const [tab, setTab] = useState<Tab>("unsent");
  const [busy, setBusy] = useState(false);
  const [liveNumber, setLiveNumber] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const meta = statusMeta(campaign.status);
  const percent =
    counts.total === 0 ? 0 : Math.round(((counts.success + counts.failed) / counts.total) * 100);
  const isSending = campaign.status === "sending";

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${campaign.id}/recipients?limit=${MAX_LIST}`);
    const data = await res.json();
    if (data.recipients) setRecipients(data.recipients);
  }, [campaign.id]);

  useEffect(() => {
    // Live SSE progress
    const es = new EventSource(`/api/campaigns/${campaign.id}/stream`);
    es.onmessage = (ev) => {
      const snap = JSON.parse(ev.data);
      setLiveNumber(snap.currentNumber);
      setCounts(() => ({
        total: snap.total,
        pending: snap.unsent,
        sending: 0,
        success: snap.success,
        failed: snap.failed,
      }));
      if (snap.status !== "sending") {
        setCampaign((prev) => ({ ...prev, status: snap.status, completed_at: snap.completedAt }));
        setLiveNumber(null);
      }      void refresh();
    };
    return () => es.close();
  }, [campaign.id, refresh]);

  useEffect(() => {
    if (listRef.current && isSending) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [recipients.length, isSending]);

  async function start() {
    setBusy(true);
    const res = await fetch(`/api/campaigns/${campaign.id}/send`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast(data.error ?? "Could not start.", "error");
      return;
    }
    toast("Campaign started.", "success");
    setCampaign((prev) => ({ ...prev, status: "sending" }));
  }

  async function stop() {
    setBusy(true);
    await fetch(`/api/campaigns/${campaign.id}/stop`, { method: "POST" });
    setBusy(false);
    toast("Stopping after the current message…", "info");
  }

  async function retryFailed() {
    setBusy(true);
    const res = await fetch(`/api/campaigns/${campaign.id}/retry`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return toast(data.error ?? "Retry failed", "error");
    toast(`Requeued ${data.retried} message(s).`, "success");
    router.refresh();
  }

  async function del() {
    if (!confirm("Delete this campaign and all its records?")) return;
    const res = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
    if (!res.ok) return toast("Could not delete.", "error");
    toast("Campaign deleted.", "success");
    router.push("/dashboard/history");
    router.refresh();
  }

  async function cancelSchedule() {
    const res = await fetch(`/api/campaigns/${campaign.id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    if (res.ok) {
      toast("Schedule cancelled.", "success");
      router.refresh();
    }
  }

  const filtered = recipients.filter((r) => {
    if (tab === "success") return r.status === "success";
    if (tab === "failed") return r.status === "failed";
    if (tab === "unsent") return r.status === "pending" || r.status === "sending";
    return true;
  });

  const tabCounts: Record<Tab, number> = {
    all: counts.total,
    unsent: counts.pending,
    success: counts.success,
    failed: counts.failed,
  };

  const showStart =
    (campaign.status === "draft" || campaign.status === "stopped" || campaign.status === "failed") &&
    counts.pending > 0;

  const showStop = isSending;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/history"
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-stone-400 hover:text-accent"
          >
            <Icon name="chevron" className="h-3.5 w-3.5 -rotate-90" />
            Back to history
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-brand-deep">{campaign.name}</h1>
            <Badge tone={meta.tone}>
              <Icon name={meta.icon} className="h-3 w-3" />
              {meta.label}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-stone-400">
            Created {formatDateTime(campaign.created_at)}
            {campaign.scheduled_for && campaign.status === "scheduled"
              ? ` · scheduled for ${formatDateTime(campaign.scheduled_for)}`
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {campaign.status === "scheduled" && (
            <Button size="sm" variant="outline" onClick={() => void cancelSchedule()}>
              <Icon name="x" className="h-3.5 w-3.5" />
              Cancel schedule
            </Button>
          )}
          {showStart && (
            <Button size="sm" variant="whatsapp" loading={busy} onClick={() => void start()}>
              <Icon name="send" className="h-3.5 w-3.5" />
              Start sending
            </Button>
          )}
          {showStop && (
            <Button size="sm" variant="danger" loading={busy} onClick={() => void stop()}>
              <Icon name="stop" className="h-3.5 w-3.5" />
              Stop
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => window.open(`/api/campaigns/${campaign.id}/export`, "_blank")}>
            <Icon name="download" className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void del()}>
            <Icon name="trash" className="h-3.5 w-3.5 text-red-500" />
          </Button>
        </div>
      </div>

      {isSending && (
        <div className="flex items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-800">
          <span className="h-2 w-2 animate-pulse-soft rounded-full bg-sky-500" />
          Please do not refresh the page while messages are sending.
          {liveNumber && (
            <span className="ml-1 truncate font-mono">
              — now sending <b>{liveNumber}</b>
            </span>
          )}
        </div>
      )}

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-stone-900">
                {counts.success + counts.failed}
                <span className="text-base font-medium text-stone-400"> / {counts.total}</span>
              </p>
              <p className="text-xs text-stone-400">messages processed</p>
            </div>
            <p className="text-lg font-bold text-accent">{percent}%</p>
          </div>
          <ProgressBar value={percent} />

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Sent", value: counts.success, cls: "text-emerald-600" },
              { label: "Failed", value: counts.failed, cls: "text-red-500" },
              { label: "Pending", value: counts.pending, cls: "text-amber-600" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-stone-50 p-3 text-center ring-1 ring-stone-100">
                <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
                <p className="text-[11px] font-medium text-stone-500">{s.label}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={
            <div className="flex overflow-x-auto no-scrollbar">
              {(["unsent", "success", "failed", "all"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`mr-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    tab === t ? "bg-accent text-white" : "text-stone-500 hover:bg-stone-100"
                  }`}
                >
                  {t} · {tabCounts[t]}
                </button>
              ))}
            </div>
          }
          action={
            campaign.failed_count > 0 && counts.failed > 0 ? (
              <Button size="sm" variant="outline" loading={busy} onClick={() => void retryFailed()}>
                <Icon name="retry" className="h-3.5 w-3.5" />
                Retry
              </Button>
            ) : undefined
          }
        />
        <div ref={listRef} className="max-h-[24rem] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-stone-400">
              {tab === "failed"
                ? "No failed messages. "
                : tab === "success"
                  ? "No sent messages yet. "
                  : "Nothing to show. "}
              {isSending ? "Messages are on the way…" : "No recipients in this view."}
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {filtered.slice(0, MAX_LIST).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${
                      r.status === "success"
                        ? "bg-emerald-500"
                        : r.status === "failed"
                          ? "bg-red-400"
                          : r.status === "sending"
                            ? "bg-sky-400 animate-pulse-soft"
                            : "bg-stone-300"
                    }`}
                  >
                    <Icon
                      name={
                        r.status === "success"
                          ? "check"
                          : r.status === "failed"
                            ? "x"
                            : r.status === "sending"
                              ? "send"
                              : "phone"
                      }
                      className="h-3.5 w-3.5"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-medium text-stone-700">{r.number}</p>
                    {r.error && <p className="truncate text-[11px] text-red-400">{r.error}</p>}
                  </div>
                  <span className="text-[10px] text-stone-400">
                    {r.sent_at ? formatDateTime(r.sent_at) : r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Icon name="chat" className="h-4 w-4 text-accent" />
              Message
            </span>
          }
        />
        <CardBody>
          <div className="rounded-xl bg-stone-50 p-4 ring-1 ring-stone-100">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-800">
              {renderWhatsApp(campaign.message)}
            </p>
            {attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-600 ring-1 ring-stone-200"
                  >
                    <Icon name={a.kind === "image" ? "image" : a.kind === "video" ? "video" : a.kind === "contact" ? "contact" : "doc"} className="h-3.5 w-3.5" />
                    {a.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-stone-400">
            Sending interval: <b className="text-stone-600">{campaign.interval_secs}s</b> random per message
            {isSending && (
              <span className="ml-2 inline-flex items-center gap-1 text-sky-600">
                <Spinner className="h-3 w-3" /> live
              </span>
            )}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

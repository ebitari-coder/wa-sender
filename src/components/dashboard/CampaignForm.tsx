"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input, Label, StepBadge } from "@/components/ui/Field";
import Icon from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import MessageEditor from "@/components/dashboard/MessageEditor";
import NumberInput from "@/components/dashboard/NumberInput";
import type { Attachment, Template } from "@/lib/types";

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CampaignForm({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState("");
  const [numbers, setNumbers] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [intervalSecs, setIntervalSecs] = useState(12);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"now" | "later">("now");
  const [scheduleAt, setScheduleAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function addFiles(files: File[]) {
    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > 16 * 1024 * 1024) {
          toast("Files must be smaller than 16MB.", "error");
          continue;
        }
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          toast(data.error ?? "Upload failed.", "error");
          continue;
        }
        setAttachments((prev) => [...prev, data.attachment]);
        toast(`${file.name} attached.`, "success");
      }
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function insertTemplate(t: Template) {
    setMessage(t.content);
    toast(`Template "${t.name}" applied.`, "success");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) return toast("Give the campaign a name.", "error");
    if (numbers.length === 0) return toast("Add at least one phone number.", "error");
    if (!message.trim()) return toast("Write a message to send.", "error");
    if (mode === "later" && !scheduleAt) return toast("Pick a date and time to schedule.", "error");
    if (mode === "later" && new Date(scheduleAt).getTime() <= Date.now()) {
      return toast("Schedule time must be in the future.", "error");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          message,
          intervalSecs,
          numbers,
          scheduleFor: mode === "later" ? new Date(scheduleAt).toISOString() : null,
          attachments: attachments.map((a) => ({ kind: a.kind, name: a.name, url: a.url, size: a.size, mime: a.mime })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "Could not create the campaign.", "error");
        return;
      }

      if (mode === "later") {
        toast(`Campaign scheduled for ${new Date(scheduleAt).toLocaleString()}.`, "success");
        router.push("/dashboard/history");
      } else {
        toast("Campaign created. Starting send…", "success");
        router.push(`/dashboard/campaigns/${data.campaign.id}`);
      }
      router.refresh();
    } catch {
      toast("Network error. Try again.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* 1. Name */}
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <StepBadge n={1} /> Campaign name
            </span>
          }
          subtitle="A short label to identify this broadcast."
        />
        <CardBody>
          <Input
            placeholder="e.g. Sunday Service Reminder"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
        </CardBody>
      </Card>

      {/* 2. Send to */}
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <StepBadge n={2} /> Send to
            </span>
          }
          subtitle="Add the numbers your message will go to."
        />
        <CardBody>
          <NumberInput numbers={numbers} onChange={setNumbers} />
        </CardBody>
      </Card>

      {/* 3. Message */}
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <StepBadge n={3} /> Message content
            </span>
          }
          action={
            templates.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  const t = templates.find((x) => x.id === e.target.value);
                  if (t) insertTemplate(t);
                }}
                className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-xs font-medium text-stone-600"
              >
                <option value="">Use a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )
          }
        />
        <CardBody>
          <MessageEditor
            value={message}
            onChange={setMessage}
            attachments={attachments}
            onAddFiles={(f) => void addFiles(f)}
            onRemoveAttachment={removeAttachment}
            uploading={uploading}
          />
        </CardBody>
      </Card>

      {/* 4. Interval */}
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <StepBadge n={4} /> Sending time interval
            </span>
          }
          subtitle="To protect the security of your account, messages are sent randomly within this interval."
        />
        <CardBody>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-32">
              <Label htmlFor="interval">Interval (seconds)</Label>
              <Input
                id="interval"
                type="number"
                min={1}
                max={600}
                value={intervalSecs}
                onChange={(e) => setIntervalSecs(Math.max(1, Number(e.target.value)))}
              />
            </div>
            <div className="rounded-xl bg-stone-50 px-4 py-3 text-xs text-stone-500 ring-1 ring-stone-100">
              Each message waits a random <b>{Math.max(0, Math.round(intervalSecs * 0.4))}s–{Math.round(intervalSecs * 1.4)}s</b>{" "}
              before the next one.
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Icon name="calendar" className="h-4 w-4 text-accent" />
              When to send
            </span>
          }
        />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("now")}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                mode === "now" ? "border-accent bg-accent/5" : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${mode === "now" ? "border-accent bg-accent" : "border-stone-300"}`}>
                  {mode === "now" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span className="text-sm font-semibold text-stone-800">Send now</span>
              </div>
              <p className="mt-1 pl-7 text-xs text-stone-500">Start sending as soon as you create it.</p>
            </button>

            <button
              type="button"
              onClick={() => setMode("later")}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                mode === "later" ? "border-accent bg-accent/5" : "border-stone-200 bg-white hover:border-stone-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${mode === "later" ? "border-accent bg-accent" : "border-stone-300"}`}>
                  {mode === "later" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                <span className="text-sm font-semibold text-stone-800">Schedule</span>
              </div>
              <p className="mt-1 pl-7 text-xs text-stone-500">Send automatically at a chosen date &amp; time.</p>
            </button>
          </div>

          {mode === "later" && (
            <div className="mt-4 animate-slide-up sm:max-w-xs">
              <Label htmlFor="scheduleAt">Date &amp; time</Label>
              <Input
                id="scheduleAt"
                type="datetime-local"
                min={toLocalInputValue(new Date().toISOString())}
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
            </div>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="submit"
          size="lg"
          fullWidth={false}
          loading={submitting}
          variant="whatsapp"
          className="sm:min-w-56"
        >
          <Icon name="send" className="h-5 w-5" />
          {mode === "later" ? "Schedule campaign" : "Create & send"}
        </Button>
        <p className="text-xs text-stone-400">
          {numbers.length} recipient{numbers.length === 1 ? "" : "s"} · {message.length} characters ·
          estimated{" "}
          {Math.max(1, numbers.length) * (intervalSecs || 1)}s+
        </p>
      </div>
    </form>
  );
}

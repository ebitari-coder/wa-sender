"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input, Label } from "@/components/ui/Field";
import Icon from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ReschedulePage({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return toast("Pick a new date and time.", "error");
    if (new Date(value).getTime() <= Date.now()) return toast("Pick a future time.", "error");

    setBusy(true);
    const res = await fetch(`/api/campaigns/${id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reschedule", scheduleFor: new Date(value).toISOString() }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return toast(data.error ?? "Could not reschedule.", "error");
    toast("Campaign rescheduled.", "success");
    router.push("/dashboard/history");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-deep">Reschedule campaign</h1>
        <p className="text-sm text-stone-500">Pick a new date and time for this broadcast.</p>
      </div>
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Icon name="calendar" className="h-4 w-4 text-accent" />
              New send time
            </span>
          }
        />
        <CardBody>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="scheduleAt">Date &amp; time</Label>
              <Input
                id="scheduleAt"
                type="datetime-local"
                min={toLocalInputValue(new Date().toISOString())}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <Button type="submit" fullWidth loading={busy}>
              Save new schedule
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

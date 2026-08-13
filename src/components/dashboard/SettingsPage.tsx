"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Template } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Field";
import Icon from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { renderWhatsApp } from "@/components/dashboard/messageFormat";

export default function SettingsPage({
  templates,
  email,
  fullName,
  phone,
}: {
  templates: Template[];
  email: string;
  fullName: string | null;
  phone: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<"templates" | "data" | "account">("templates");
  const [list, setList] = useState<Template[]>(templates);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState<Template | null>(null);
  const [busy, setBusy] = useState(false);
  const [senderName, setSenderName] = useState(fullName ?? "");
  const [senderPhone, setSenderPhone] = useState(phone ?? "");

  const profileIncomplete = !fullName || !phone;

  // Force account tab if profile is incomplete
  useEffect(() => {
    if (profileIncomplete) setTab("account");
  }, [profileIncomplete]);

  // If profile is incomplete and WhatsApp is connected, auto-fill phone
  useEffect(() => {
    if (phone) return;
    fetch("/api/connect/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.readyInfo?.number && !senderPhone) {
          setSenderPhone("+" + data.readyInfo.number);
        }
      })
      .catch(() => {});
  }, [phone, senderPhone]);

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return toast("Name and content are required.", "error");
    setBusy(true);
    const url = editing ? `/api/templates/${editing.id}` : "/api/templates";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return toast(data.error ?? "Could not save template.", "error");
    toast(editing ? "Template updated." : "Template saved.", "success");
    setName("");
    setContent("");
    setEditing(null);
    refreshTemplates();
  }

  const refreshTemplates = useCallback(async () => {
    const res = await fetch("/api/templates");
    const data = await res.json();
    if (data.templates) setList(data.templates);
  }, []);

  function edit(t: Template) {
    setEditing(t);
    setName(t.name);
    setContent(t.content);
    setTab("templates");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (!res.ok) return toast("Could not delete.", "error");
    toast("Template deleted.", "success");
    refreshTemplates();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast("Signed out.", "info");
    router.push("/login");
    router.refresh();
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: senderName, phone: senderPhone }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return toast(data.error ?? "Could not save profile.", "error");
    toast("Profile updated. This appears on campaign reports.", "success");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-deep">Settings</h1>
        <p className="text-sm text-stone-500">Templates, data and your account.</p>
      </div>

      {profileIncomplete && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-100">
          <p className="font-semibold">Please complete your profile</p>
          <p className="mt-1 text-xs">
            Your full name and phone number are required for campaign reports.
            {senderPhone && !phone && " We pre-filled your phone from your WhatsApp connection."}
          </p>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1 no-scrollbar">
        {(
          [
            { key: "templates", label: "Template management", icon: "book" },
            { key: "data", label: "Data & export", icon: "download" },
            { key: "account", label: "Account", icon: "users" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              tab === t.key ? "bg-white text-accent shadow-sm" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            <Icon name={t.icon} className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "templates" && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <CardHeader
              title={editing ? `Edit "${editing.name}"` : "New template"}
              subtitle="Reusable messages for recurring broadcasts."
            />
            <CardBody>
              <form onSubmit={saveTemplate} className="space-y-3">
                <div>
                  <Label htmlFor="tplName">Template name</Label>
                  <Input
                    id="tplName"
                    placeholder="e.g. Sunday Reminder"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="tplContent">Message</Label>
                  <Textarea
                    id="tplContent"
                    rows={4}
                    placeholder="*Reminder:* Service is at *6:00 PM* today."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" loading={busy}>
                    {editing ? "Save changes" : "Save template"}
                  </Button>
                  {editing && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditing(null);
                        setName("");
                        setContent("");
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardBody>
          </Card>

          <div className="space-y-3">
            {list.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-10 text-center text-sm text-stone-500">
                No templates yet. Save one to reuse it in any campaign.
              </div>
            ) : (
              list.map((t) => (
                <Card key={t.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-stone-800">{t.name}</h3>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => edit(t)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-accent"
                        aria-label="Edit template"
                      >
                        <Icon name="settings" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => void remove(t.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-red-500"
                        aria-label="Delete template"
                      >
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-stone-500">
                    {renderWhatsApp(t.content)}
                  </p>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "data" && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Icon name="download" className="h-4 w-4 text-accent" />
                  Export data
                </span>
              }
              subtitle="Download your broadcasting records."
            />
            <CardBody className="space-y-3">
              <p className="text-xs text-stone-500">
                Every campaign result (phone numbers, status, errors and timestamps) can be exported
                to Excel for your records.
              </p>
              <Button variant="outline" onClick={() => window.open("/api/export/all", "_blank")}>
                <Icon name="download" className="h-4 w-4" />
                Export all campaigns (.xlsx)
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Icon name="info" className="h-4 w-4 text-accent" />
                  About
                </span>
              }
            />
            <CardBody className="space-y-2 text-xs text-stone-500">
              <p>
                <b className="text-stone-700">WA Sender</b> is the official bulk messaging tool for
                <b className="text-stone-700"> Power City Oke Ira Campus</b>.
              </p>
              <p>Data is stored locally in an SQLite database on this server.</p>
              <p>
                To send real WhatsApp messages, open the <b className="text-stone-700">Connect</b>{" "}
                page and scan the QR code with your WhatsApp phone.
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === "account" && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <CardHeader
              title="Sender profile"
              subtitle="Shown on every campaign status email (reports)."
            />
            <CardBody>
              <form onSubmit={saveProfile} className="space-y-3">
                <div>
                  <Label htmlFor="senderName">Full name</Label>
                  <Input
                    id="senderName"
                    placeholder="e.g. Pastor John Oke"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="senderPhone">Phone number</Label>
                  <Input
                    id="senderPhone"
                    placeholder="e.g. +2348012345678"
                    inputMode="tel"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="senderEmail">Email</Label>
                  <Input id="senderEmail" value={email} readOnly className="bg-stone-50 text-stone-500" />
                </div>
                <Button type="submit" loading={busy}>
                  Save profile
                </Button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Account" subtitle="Security details for this ministry tool." />
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-stone-50 p-4 ring-1 ring-stone-100">
                <div>
                  <p className="text-sm font-semibold text-stone-800">Security</p>
                  <p className="text-xs text-stone-500">
                    You receive a fresh 6-digit access code by email every time you sign in.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  Protected
                </span>
              </div>
              <div className="rounded-xl bg-stone-50 p-4 ring-1 ring-stone-100">
                <p className="text-sm font-semibold text-stone-800">Status reports</p>
                <p className="text-xs text-stone-500">
                  When a campaign finishes, a report is emailed to the addresses set in{" "}
                  <code className="font-mono">REPORT_EMAILS</code> (see{" "}
                  <code className="font-mono">.env</code>).
                </p>
              </div>
              <Button variant="danger" onClick={() => void logout()}>
                <Icon name="logout" className="h-4 w-4" />
                Sign out
              </Button>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

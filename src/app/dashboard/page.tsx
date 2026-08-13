import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listCampaigns } from "@/lib/campaigns";
import Icon from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import CampaignCard from "@/components/dashboard/CampaignCard";
import WaStatusChip from "@/components/dashboard/WaStatusChip";
import { timeAgo } from "@/lib/format";
import { baileysManager } from "@/lib/sender/baileys";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const campaigns = listCampaigns(user!.id, 10);

  // Use full_name, then WhatsApp push name, then email prefix
  const waName = baileysManager.readyInfo?.name;
  const firstName = user!.full_name?.trim().split(/\s+/)[0]
    || waName?.trim().split(/\s+/)[0]
    || user!.email.split("@")[0];
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const stats = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status='sending' THEN 1 ELSE 0 END),0) AS sending,
        COALESCE(SUM(success_count),0) AS success,
        COALESCE(SUM(failed_count),0) AS failed,
        COALESCE(SUM(CASE WHEN status='scheduled' AND scheduled_for > ? THEN 1 ELSE 0 END),0) AS upcoming
       FROM campaigns WHERE user_id = ?`,
    )
    .get(new Date().toISOString(), user!.id) as {
    total: number;
    sending: number;
    success: number;
    failed: number;
    upcoming: number;
  };

  const upcoming = campaigns.filter(
    (c) => c.status === "scheduled" && c.scheduled_for && new Date(c.scheduled_for) > new Date(),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-deep">
            Welcome back, {firstName}
          </h1>
          <p className="text-sm text-stone-500">
            {today} — let&apos;s reach your community today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WaStatusChip />
          <Link
            href="/dashboard/create"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-accent-dark active:scale-[0.98]"
          >
            <Icon name="plus" className="h-4 w-4" />
            New Campaign
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Campaigns", value: stats.total, icon: "grid" as const, tone: "text-accent bg-accent/10" },
          { label: "Messages sent", value: stats.success, icon: "send" as const, tone: "text-emerald-600 bg-emerald-50" },
          { label: "Upcoming", value: stats.upcoming, icon: "calendar" as const, tone: "text-amber-600 bg-amber-50" },
          { label: "Failed", value: stats.failed, icon: "x" as const, tone: "text-red-600 bg-red-50" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${s.tone}`}>
              <Icon name={s.icon} className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold text-stone-900">{s.value}</p>
            <p className="text-xs font-medium text-stone-500">{s.label}</p>
          </Card>
        ))}
      </div>

      {upcoming.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-3.5">
            <Icon name="calendar" className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-stone-800">Scheduled for later</h3>
          </div>
          <ul className="divide-y divide-stone-100">
            {upcoming.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <Link href={`/dashboard/campaigns/${c.id}`} className="truncate text-sm font-medium text-stone-800 hover:text-accent">
                    {c.name}
                  </Link>
                  <p className="text-xs text-stone-400">{c.total_count} recipients</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="amber">
                    <Icon name="clock" className="h-3 w-3" />
                    {c.scheduled_for ? timeAgo(c.scheduled_for) : ""}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">Recent campaigns</h2>
          <Link href="/dashboard/history" className="text-xs font-semibold text-accent hover:underline">
            View all
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Icon name="chat" className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-800">No campaigns yet</p>
              <p className="mt-1 max-w-xs text-xs text-stone-500">
                Create your first bulk message to your congregation.
              </p>
            </div>
            <Link
              href="/dashboard/create"
              className="mt-2 inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark"
            >
              <Icon name="plus" className="h-4 w-4" />
              Create campaign
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listCampaigns } from "@/lib/campaigns";
import CampaignCard from "@/components/dashboard/CampaignCard";
import Icon from "@/components/ui/Icon";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  const campaigns = listCampaigns(user!.id, 200);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-deep">History</h1>
          <p className="text-sm text-stone-500">Every campaign you&apos;ve created — past and upcoming.</p>
        </div>
        <Link
          href="/dashboard/create"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark"
        >
          <Icon name="plus" className="h-4 w-4" />
          New campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Icon name="history" className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-800">No campaigns yet</p>
            <p className="mt-1 text-xs text-stone-500">
              Your broadcasts will appear here once you create them.
            </p>
          </div>
          <Link
            href="/dashboard/create"
            className="mt-1 inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark"
          >
            <Icon name="plus" className="h-4 w-4" />
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  );
}

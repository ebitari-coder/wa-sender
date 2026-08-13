import { getCurrentUser } from "@/lib/auth";
import { listTemplates } from "@/lib/campaigns";
import CampaignForm from "@/components/dashboard/CampaignForm";

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const user = await getCurrentUser();
  const templates = listTemplates(user!.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-deep">Create campaign</h1>
        <p className="text-sm text-stone-500">
          Reach your congregation with a single WhatsApp broadcast.
        </p>
      </div>
      <CampaignForm templates={templates} />
    </div>
  );
}

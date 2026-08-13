import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign, getAttachments, getRecipients } from "@/lib/campaigns";
import { countRecipients } from "@/lib/campaigns";
import CampaignDetail from "@/components/dashboard/CampaignDetail";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const campaign = getCampaign(user!.id, id);
  if (!campaign) notFound();

  const counts = {
    total: countRecipients(id),
    pending: countRecipients(id, "pending"),
    sending: countRecipients(id, "sending"),
    success: countRecipients(id, "success"),
    failed: countRecipients(id, "failed"),
  };
  const recipients = getRecipients(id, undefined, 2000);
  const attachments = getAttachments(id);

  return (
    <CampaignDetail
      campaign={campaign}
      initialCounts={counts}
      initialRecipients={recipients}
      attachments={attachments}
    />
  );
}

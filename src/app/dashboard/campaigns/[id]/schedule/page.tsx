import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCampaign } from "@/lib/campaigns";
import ReschedulePage from "@/components/dashboard/ReschedulePage";

export const dynamic = "force-dynamic";

export default async function RescheduleRoute({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const campaign = getCampaign(user!.id, id);
  if (!campaign || campaign.status !== "scheduled") notFound();
  return <ReschedulePage id={id} />;
}

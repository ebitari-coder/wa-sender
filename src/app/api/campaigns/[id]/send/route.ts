import { NextResponse } from "next/server";
import { getCurrentUserId, requireUserId } from "@/lib/auth";
import { getCampaign } from "@/lib/campaigns";
import { startCampaign } from "@/lib/sender";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  requireUserId(userId);
  const { id } = await ctx.params;

  const campaign = getCampaign(userId, id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const result = await startCampaign(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason ?? "Could not start sending." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

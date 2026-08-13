import { NextResponse } from "next/server";
import { getCurrentUserId, requireUserId } from "@/lib/auth";
import { getCampaign, getRecipients } from "@/lib/campaigns";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  requireUserId(userId);
  const { id } = await ctx.params;

  const campaign = getCampaign(userId, id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const limit = Math.min(2000, Number(url.searchParams.get("limit") ?? 500));

  const recipients = getRecipients(id, status, limit);
  return NextResponse.json({ recipients });
}

import { NextResponse } from "next/server";
import { getCurrentUserId, requireUserId } from "@/lib/auth";
import { deleteCampaign, getCampaign, getAttachments } from "@/lib/campaigns";
import { countRecipients } from "@/lib/campaigns";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  requireUserId(userId);
  const { id } = await ctx.params;

  const campaign = getCampaign(userId, id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const attachments = getAttachments(id);
  const counts = {
    pending: countRecipients(id, "pending"),
    sending: countRecipients(id, "sending"),
    success: countRecipients(id, "success"),
    failed: countRecipients(id, "failed"),
    total: countRecipients(id),
  };

  return NextResponse.json({ campaign, attachments, counts });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  requireUserId(userId);
  const { id } = await ctx.params;

  const ok = deleteCampaign(userId, id);
  if (!ok) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

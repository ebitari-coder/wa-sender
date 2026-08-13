import { NextResponse } from "next/server";
import { getCurrentUserId, requireUserId } from "@/lib/auth";
import { cancelSchedule, getCampaign, reschedule } from "@/lib/campaigns";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  requireUserId(userId);
  const { id } = await ctx.params;

  const campaign = getCampaign(userId, id);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");

  if (action === "cancel") {
    const ok = cancelSchedule(userId, id);
    if (!ok) {
      return NextResponse.json({ error: "This campaign cannot be cancelled." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "reschedule") {
    const scheduleFor = String(body.scheduleFor ?? "");
    if (!scheduleFor || Number.isNaN(new Date(scheduleFor).getTime())) {
      return NextResponse.json({ error: "Invalid schedule time." }, { status: 400 });
    }
    const ok = reschedule(userId, id, scheduleFor);
    if (!ok) {
      return NextResponse.json({ error: "This campaign cannot be rescheduled." }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

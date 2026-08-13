import { NextResponse } from "next/server";
import { getCurrentUserId, requireUserId } from "@/lib/auth";
import { createCampaign, listCampaigns } from "@/lib/campaigns";
import { extractNumbers } from "@/lib/numbers";

export async function GET() {
  const userId = await getCurrentUserId();
  requireUserId(userId);
  const campaigns = listCampaigns(userId);
  return NextResponse.json({ campaigns });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  requireUserId(userId);

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const message = String(body.message ?? "").trim();
    const intervalSecs = Math.max(1, Math.round(Number(body.intervalSecs ?? 5)));
    const rawNumbers = Array.isArray(body.numbers) ? body.numbers : [];
    const scheduleFor = body.scheduleFor ? String(body.scheduleFor) : null;
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    if (!name) {
      return NextResponse.json({ error: "Campaign name is required." }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ error: "Message content is required." }, { status: 400 });
    }
    if (rawNumbers.length === 0) {
      return NextResponse.json({ error: "Add at least one phone number." }, { status: 400 });
    }

    const numbers = extractNumbers(rawNumbers.join("\n"));
    if (numbers.length === 0) {
      return NextResponse.json({ error: "No valid phone numbers found." }, { status: 400 });
    }
    if (numbers.length !== rawNumbers.length) {
      return NextResponse.json(
        {
          error: `${rawNumbers.length - numbers.length} invalid or duplicate number(s) were removed. ${numbers.length} valid number(s) remain.`,
        },
        { status: 400 },
      );
    }

    if (scheduleFor && Number.isNaN(new Date(scheduleFor).getTime())) {
      return NextResponse.json({ error: "Invalid schedule time." }, { status: 400 });
    }

    const campaign = createCampaign({
      userId,
      name,
      message,
      intervalSecs,
      numbers,
      scheduleFor,
      attachments: attachments.map((a: { kind: string; name?: string; url?: string; size?: number; mime?: string | null }) => ({
        kind: a.kind as "image" | "video" | "document" | "contact",
        name: String(a.name ?? "attachment"),
        url: String(a.url ?? ""),
        size: Number(a.size ?? 0),
        mime: a.mime ? String(a.mime) : null,
      })),
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err) {
    console.error("[campaigns/create]", err);
    return NextResponse.json({ error: "Could not create the campaign." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getCurrentUserId, requireUserId } from "@/lib/auth";
import { createTemplate, listTemplates } from "@/lib/campaigns";

export async function GET() {
  const userId = await getCurrentUserId();
  requireUserId(userId);
  return NextResponse.json({ templates: listTemplates(userId) });
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  requireUserId(userId);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const content = String(body.content ?? "");

  if (!name || !content) {
    return NextResponse.json({ error: "Template name and content are required." }, { status: 400 });
  }

  const template = createTemplate(userId, name, content);
  return NextResponse.json({ template }, { status: 201 });
}

import { NextResponse } from "next/server";
import { getCurrentUserId, requireUserId } from "@/lib/auth";
import { deleteTemplate, updateTemplate } from "@/lib/campaigns";

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  requireUserId(userId);
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const content = String(body.content ?? "");

  if (!name || !content) {
    return NextResponse.json({ error: "Template name and content are required." }, { status: 400 });
  }

  const template = updateTemplate(userId, id, name, content);
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  return NextResponse.json({ template });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  requireUserId(userId);
  const { id } = await ctx.params;
  const ok = deleteTemplate(userId, id);
  if (!ok) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

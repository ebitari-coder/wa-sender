import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { getCurrentUserId, requireUserId } from "@/lib/auth";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId();
  requireUserId(userId);
  const { id } = await ctx.params;

  const att = db.prepare("SELECT * FROM attachments WHERE url = ?").get(`/api/files/${id}`) as
    | { name: string; mime: string | null }
    | undefined;

  if (!att) return new Response("Not found", { status: 404 });

  const ext = path.extname(att.name);
  const fullPath = path.join(UPLOAD_DIR, `${id}${ext.toLowerCase()}`);
  if (!fs.existsSync(fullPath)) return new Response("Not found", { status: 404 });

  const buf = fs.readFileSync(fullPath);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": att.mime ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${att.name.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

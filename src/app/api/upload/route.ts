import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getCurrentUserId, requireUserId } from "@/lib/auth";
import { newId } from "@/lib/ids";

const MAX_FILE_BYTES = 16 * 1024 * 1024;
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");

function inferKind(mime: string, name: string): "image" | "video" | "document" | "contact" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (name.toLowerCase().endsWith(".vcf")) return "contact";
  return "document";
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  requireUserId(userId);

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Files must be smaller than 16MB." },
        { status: 413 },
      );
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const id = newId("att");
    const safeName = file.name.replace(/[^\w.\- ]+/g, "").slice(0, 100) || "file";
    const ext = path.extname(safeName).slice(0, 10).toLowerCase();
    const filename = `${id}${ext}`;
    const fullPath = path.join(/* turbopackIgnore: true */ UPLOAD_DIR, filename);

    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(fullPath, buf);

    const kind = inferKind(file.type, safeName);

    return NextResponse.json({
      attachment: {
        id,
        kind,
        name: safeName,
        url: `/api/files/${id}`,
        size: file.size,
        mime: file.type || null,
      },
    });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

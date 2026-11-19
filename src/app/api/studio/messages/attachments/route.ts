import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth";

// Night build: inbox attachments (PDFs and mood board images). Files are
// stored with the photographer's other uploads and linked from the message.
const OK_EXT = new Set(["pdf", "jpg", "jpeg", "png", "webp", "gif"]);
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received" }, { status: 400 });
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!OK_EXT.has(ext)) return NextResponse.json({ error: "Attach a PDF or an image (JPG, PNG, WebP, GIF)" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over the 15 MB limit" }, { status: 400 });
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || `attachment.${ext}`;
  const stored = `${Date.now()}-${randomBytes(4).toString("hex")}-${safe}`;
  const dir = path.join(process.cwd(), "public", "uploads", "inbox", user.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ name: file.name, url: `/uploads/inbox/${user.id}/${stored}`, size: file.size, mime: file.type });
}

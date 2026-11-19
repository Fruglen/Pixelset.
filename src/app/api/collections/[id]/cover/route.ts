import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile, rm } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

// Phase 5B: a cover image uploaded separately from the photo grid. Accepts
// JPEG/PNG/WEBP and animated GIF (stored untouched so the animation plays).

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.collection.findFirst({ where: { id, userId: user.id } });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const collection = await owned(params.id);
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image" }, { status: 400 });
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    return NextResponse.json({ error: "Cover must be a JPEG, PNG, WEBP or GIF image" }, { status: 400 });
  }
  const limit = file.type === "image/gif" ? 85 : 100;
  if (file.size > limit * 1024 * 1024) {
    return NextResponse.json({ error: `Cover images are limited to ${limit} MB` }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  let animated = false;
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buf, { animated: true }).metadata();
    animated = (meta.pages ?? 1) > 1;
  } catch {
    return NextResponse.json({ error: "That file is not a readable image" }, { status: 400 });
  }
  const dir = path.join(process.cwd(), "public", "uploads", collection.id);
  await mkdir(dir, { recursive: true });
  const ext = file.type === "image/gif" ? "gif" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const name = `cover-${randomBytes(5).toString("hex")}.${ext}`;
  await writeFile(path.join(dir, name), buf);
  if (collection.coverImageUrl.startsWith(`/uploads/${collection.id}/cover-`)) {
    await rm(path.join(process.cwd(), "public", collection.coverImageUrl), { force: true });
  }
  const url = `/uploads/${collection.id}/${name}`;
  await db.collection.update({ where: { id: collection.id }, data: { coverImageUrl: url } });
  return NextResponse.json({ ok: true, url, animated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const collection = await owned(params.id);
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (collection.coverImageUrl.startsWith(`/uploads/${collection.id}/cover-`)) {
    await rm(path.join(process.cwd(), "public", collection.coverImageUrl), { force: true });
  }
  await db.collection.update({ where: { id: collection.id }, data: { coverImageUrl: "" } });
  return NextResponse.json({ ok: true });
}

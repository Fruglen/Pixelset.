import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";

export const runtime = "nodejs";

// Saves an edited canvas export back into the photo's collection as a NEW photo
// (the original is never touched). Body: { photoId, dataUrl, label }.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = permissionError("upload");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const body = await req.json();
  const photo = await db.photo.findFirst({
    where: { id: String(body.photoId ?? ""), collection: { userId: user.id } },
  });
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
  const match = dataUrl.match(/^data:image\/(jpeg|png);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 30 * 1024 * 1024) {
    return NextResponse.json({ error: "Edited image is too large" }, { status: 413 });
  }

  const sharp = (await import("sharp")).default;
  let width: number | null = null;
  let height: number | null = null;
  let jpeg: Buffer = buffer;
  try {
    const img = sharp(buffer);
    const meta = await img.metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
    jpeg = await img.jpeg({ quality: 90 }).toBuffer();
  } catch {
    return NextResponse.json({ error: "Could not process the image" }, { status: 400 });
  }

  const base = photo.filename.replace(/\.[a-z0-9]+$/i, "");
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : "edited";
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "edited";
  const filename = `${base}-${safeLabel}-${Date.now().toString(36)}.jpg`;

  const dir = path.join(process.cwd(), "public", "uploads", photo.collectionId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), jpeg);

  const count = await db.photo.count({ where: { setId: photo.setId } });
  const created = await db.photo.create({
    data: {
      collectionId: photo.collectionId,
      setId: photo.setId,
      filename,
      url: `/uploads/${photo.collectionId}/${filename}`,
      isExternal: false,
      width,
      height,
      order: count,
    },
  });

  return NextResponse.json({ id: created.id, url: created.url, filename: created.filename });
}

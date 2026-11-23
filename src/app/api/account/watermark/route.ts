import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { applyWatermark, watermarkFromUser } from "@/lib/watermark";
import { deleteStored, saveStoredBuffer } from "@/lib/storage";

export const runtime = "nodejs";

// Phase 5B: upload your own watermark file (PNG with transparency works best),
// and GET ?preview=1 renders the current design onto a sample image.

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
    return NextResponse.json({ error: "Upload a PNG, JPEG, WEBP or SVG watermark" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Watermark files are limited to 10 MB" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const sharp = (await import("sharp")).default;
  let png: Buffer;
  try {
    png = await sharp(buf).png().toBuffer();
  } catch {
    return NextResponse.json({ error: "That file is not a readable image" }, { status: 400 });
  }
  const name = `${user.id}-${randomBytes(4).toString("hex")}.png`;
  const url = await saveStoredBuffer(`uploads/watermarks/${name}`, png, "image/png");
  if (user.watermarkImageUrl.includes("/uploads/watermarks/")) {
    await deleteStored(user.watermarkImageUrl);
  }
  await db.user.update({ where: { id: user.id }, data: { watermarkImageUrl: url, watermarkMode: "image" } });
  return NextResponse.json({ ok: true, url });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const s = watermarkFromUser({
    ...user,
    watermarkMode: sp.get("mode") || user.watermarkMode,
    watermarkText: sp.get("text") ?? user.watermarkText,
    watermarkPosition: sp.get("position") || user.watermarkPosition,
    watermarkOpacity: Number(sp.get("opacity")) || user.watermarkOpacity,
    watermarkScale: Number(sp.get("scale")) || user.watermarkScale,
  });
  const sharp = (await import("sharp")).default;
  const sample = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a7357"/><stop offset="0.55" stop-color="#c9b79c"/><stop offset="1" stop-color="#3d3528"/></linearGradient></defs><rect width="1200" height="800" fill="url(#g)"/><circle cx="820" cy="300" r="170" fill="#f1ece1" opacity="0.5"/></svg>`
    )
  )
    .jpeg()
    .toBuffer();
  const out = await applyWatermark(sample, s, 900);
  return new NextResponse(new Uint8Array(out), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
}

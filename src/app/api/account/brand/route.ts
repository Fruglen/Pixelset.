import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import sharp from "sharp";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { validHex } from "@/lib/brand";
import { FONT_PAIRINGS } from "@/lib/design";

// Phase 5B platform: the single brand source (logo, colours, heading font).
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const data: Record<string, string> = {};
  for (const k of ["brandColor", "brandAccent"] as const) {
    if (typeof body[k] === "string") {
      const v = body[k].trim();
      if (v && !validHex(v)) return NextResponse.json({ error: "Colours must be hex values like #8a7357" }, { status: 400 });
      data[k] = v;
    }
  }
  if (typeof body.brandFont === "string") {
    if (body.brandFont && !FONT_PAIRINGS.some((f) => f.id === body.brandFont)) {
      return NextResponse.json({ error: "Unknown font" }, { status: 400 });
    }
    data.brandFont = body.brandFont;
  }
  if (body.removeLogo === true) data.brandLogoUrl = "";
  await db.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ ok: true });
}

// Logo upload: PNG, JPEG, WEBP or SVG up to 5 MB.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "Choose a logo file" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Logo must be under 5 MB" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const isSvg = /svg/.test(file.type) || /\.svg$/i.test(file.name);
  let ext = "png";
  if (isSvg) {
    const text = buf.toString("utf8");
    if (!/<svg[\s>]/i.test(text) || /<script|on\w+=/i.test(text)) return NextResponse.json({ error: "That SVG is not allowed" }, { status: 400 });
    ext = "svg";
  } else {
    try {
      const meta = await sharp(buf).metadata();
      if (!meta.format || !["png", "jpeg", "webp"].includes(meta.format)) throw new Error("format");
      ext = meta.format === "jpeg" ? "jpg" : meta.format;
    } catch {
      return NextResponse.json({ error: "Logo must be a PNG, JPEG, WEBP or SVG image" }, { status: 400 });
    }
  }
  const dir = path.join(process.cwd(), "public", "uploads", "brand");
  await mkdir(dir, { recursive: true });
  const name = `${user.id}-${randomBytes(4).toString("hex")}.${ext}`;
  await writeFile(path.join(dir, name), buf);
  const url = `/uploads/brand/${name}`;
  await db.user.update({ where: { id: user.id }, data: { brandLogoUrl: url } });
  return NextResponse.json({ ok: true, url });
}

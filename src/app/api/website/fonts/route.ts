import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { googleFontFamilies } from "@/lib/fonts";
import { siteExt, updateSiteExt, type CustomFont } from "@/lib/site-ext";
import { WEBSITE_LIMITS, planFor, tierLabel } from "@/lib/plans";

export const runtime = "nodejs";

// Night build (Website): the font library API.
// GET    ?q=  search the Google Fonts catalogue + list uploaded fonts
// POST        upload a font file (woff, woff2, ttf, otf), max 20 per site
// PATCH       set the heading/body family overrides
// DELETE ?id= remove an uploaded font

const FONT_TYPES: Record<string, { ext: string; format: string }> = {
  "font/woff2": { ext: "woff2", format: "woff2" },
  "font/woff": { ext: "woff", format: "woff" },
  "font/ttf": { ext: "ttf", format: "truetype" },
  "font/otf": { ext: "otf", format: "opentype" },
  "application/x-font-woff2": { ext: "woff2", format: "woff2" },
  "application/x-font-woff": { ext: "woff", format: "woff" },
  "application/x-font-ttf": { ext: "ttf", format: "truetype" },
  "application/x-font-otf": { ext: "otf", format: "opentype" },
};
const MAX_CUSTOM_FONTS = 20;

async function ownWebsite(userId: string) {
  return db.website.findUnique({ where: { userId } });
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const website = await ownWebsite(user.id);
  if (!website) return NextResponse.json({ error: "No website yet" }, { status: 404 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const { families, live } = await googleFontFamilies();
  const matched = q ? families.filter((f) => f.toLowerCase().includes(q)) : families;
  const ext = siteExt(website);
  return NextResponse.json({
    families: matched.slice(0, 60),
    total: families.length,
    live,
    custom: ext.customFonts,
    display: ext.fontDisplay,
    body: ext.fontBody,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const website = await ownWebsite(user.id);
  if (!website) return NextResponse.json({ error: "No website yet" }, { status: 404 });
  // Night build (Pricing lane): custom font uploads are a Website Pro unlock.
  {
    const plan = await planFor(user.id);
    if (!WEBSITE_LIMITS[plan.website].customFonts) {
      return NextResponse.json(
        { error: `Custom font uploads need the Website Pro plan (your plan is ${tierLabel("website", plan.website)}). Upgrade in Settings > Plan.` },
        { status: 403 },
      );
    }
  }
  const ext = siteExt(website);
  if (ext.customFonts.length >= MAX_CUSTOM_FONTS) {
    return NextResponse.json({ error: `You can upload up to ${MAX_CUSTOM_FONTS} fonts` }, { status: 400 });
  }
  const form = await req.formData();
  const file = form.get("file");
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a font file" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Give the font a family name" }, { status: 400 });
  const byExt = Object.values(FONT_TYPES).find((t) => file.name.toLowerCase().endsWith(`.${t.ext}`));
  const kind = FONT_TYPES[file.type] ?? byExt;
  if (!kind) return NextResponse.json({ error: "Font files must be .woff, .woff2, .ttf or .otf" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Font files can be up to 5 MB" }, { status: 400 });
  if (ext.customFonts.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: "A font with that name is already uploaded" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const dirName = `site-${user.id}`;
  const dir = path.join(process.cwd(), "public", "uploads", dirName);
  await mkdir(dir, { recursive: true });
  const filename = `font-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${kind.ext}`;
  await writeFile(path.join(dir, filename), buf);
  const media = await db.siteMedia.create({
    data: { userId: user.id, kind: "FONT", url: `/uploads/${dirName}/${filename}`, filename: file.name, mime: file.type || `font/${kind.ext}`, size: file.size },
  });
  const font: CustomFont = { id: media.id, name, url: media.url, format: kind.format, mediaId: media.id };
  try {
    await updateSiteExt(website.id, { customFonts: [...ext.customFonts, font] });
  } catch {
    return NextResponse.json({ error: "Font storage is waiting on a database update. Try again shortly." }, { status: 503 });
  }
  return NextResponse.json({ font });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const website = await ownWebsite(user.id);
  if (!website) return NextResponse.json({ error: "No website yet" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const patch: { fontDisplay?: string; fontBody?: string } = {};
  if (typeof body.display === "string") patch.fontDisplay = body.display.trim().slice(0, 120);
  if (typeof body.body === "string") patch.fontBody = body.body.trim().slice(0, 120);
  try {
    await updateSiteExt(website.id, patch);
  } catch {
    return NextResponse.json({ error: "Font settings are waiting on a database update. Try again shortly." }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const website = await ownWebsite(user.id);
  if (!website) return NextResponse.json({ error: "No website yet" }, { status: 404 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const ext = siteExt(website);
  const font = ext.customFonts.find((f) => f.id === id);
  if (!font) return NextResponse.json({ error: "Font not found" }, { status: 404 });
  const remaining = ext.customFonts.filter((f) => f.id !== id);
  const patch: Parameters<typeof updateSiteExt>[1] = { customFonts: remaining };
  if (ext.fontDisplay === font.name) patch.fontDisplay = "";
  if (ext.fontBody === font.name) patch.fontBody = "";
  try {
    await updateSiteExt(website.id, patch);
  } catch {
    return NextResponse.json({ error: "Font settings are waiting on a database update. Try again shortly." }, { status: 503 });
  }
  const media = await db.siteMedia.findFirst({ where: { id: font.mediaId, userId: user.id } });
  if (media) {
    await db.siteMedia.delete({ where: { id: media.id } });
    await unlink(path.join(process.cwd(), "public", media.url)).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}

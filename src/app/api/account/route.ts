import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.businessName === "string") data.businessName = body.businessName.trim();
  if (typeof body.watermarkText === "string") data.watermarkText = body.watermarkText.trim();
  if (typeof body.mailFrom === "string") data.mailFrom = body.mailFrom.trim();
  // Phase 5B account level gallery settings
  if (typeof body.timezone === "string" && body.timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: body.timezone });
      data.timezone = body.timezone;
    } catch {
      return NextResponse.json({ error: "Unknown timezone" }, { status: 400 });
    }
  }
  if (typeof body.locale === "string" && ["auto", "en", "es", "pt"].includes(body.locale)) data.locale = body.locale;
  if (typeof body.galleryGaId === "string") {
    const ga = body.galleryGaId.trim();
    if (ga && !/^(G|UA)-[A-Z0-9-]{4,}$/i.test(ga)) return NextResponse.json({ error: "Google Analytics ID looks like G-XXXXXXX" }, { status: 400 });
    data.galleryGaId = ga;
  }
  if (body.onboarded === true) data.onboardedAt = new Date(); // Phase 5B: first run wizard finished
  if (typeof body.galleryHomeTitle === "string") data.galleryHomeTitle = body.galleryHomeTitle.trim();
  // Phase 5B platform: account default preset for new collections
  if (typeof body.galleryDefaultPresetId === "string") {
    if (body.galleryDefaultPresetId) {
      const preset = await db.preset.findFirst({ where: { id: body.galleryDefaultPresetId, userId: user.id } });
      if (!preset) return NextResponse.json({ error: "Preset not found" }, { status: 400 });
    }
    data.galleryDefaultPresetId = body.galleryDefaultPresetId;
  }
  if ("galleryHomeSlug" in body) {
    const raw = typeof body.galleryHomeSlug === "string" ? body.galleryHomeSlug : "";
    const slug = raw.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (slug) {
      const clash = await db.user.findFirst({ where: { galleryHomeSlug: slug, NOT: { id: user.id } } });
      if (clash) return NextResponse.json({ error: "That homepage address is taken" }, { status: 409 });
    }
    data.galleryHomeSlug = slug || null;
  }
  // Phase 5B platform: preview rendition size and JPEG quality
  if (typeof body.previewSize === "number") {
    if (![1024, 1600, 2048, 2560, 3200].includes(body.previewSize)) return NextResponse.json({ error: "Unknown preview size" }, { status: 400 });
    data.previewSize = body.previewSize;
  }
  if (typeof body.previewQuality === "number") data.previewQuality = Math.min(95, Math.max(60, Math.round(body.previewQuality)));
  if (typeof body.watermarkMode === "string" && ["text", "image"].includes(body.watermarkMode)) data.watermarkMode = body.watermarkMode;
  if (typeof body.watermarkPosition === "string") data.watermarkPosition = body.watermarkPosition;
  if (typeof body.watermarkOpacity === "number") data.watermarkOpacity = Math.min(100, Math.max(5, Math.round(body.watermarkOpacity)));
  if (typeof body.watermarkScale === "number") data.watermarkScale = Math.min(90, Math.max(5, Math.round(body.watermarkScale)));
  if (typeof body.watermarkSizes === "string") {
    data.watermarkSizes = body.watermarkSizes
      .split(",")
      .filter((x: string) => ["high3600", "web2048", "web1024", "web640"].includes(x))
      .join(",");
  }

  if (typeof body.newPassword === "string" && body.newPassword) {
    if (typeof body.currentPassword !== "string" || !verifyPassword(body.currentPassword, user.passwordHash)) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    if (body.newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }
    data.passwordHash = hashPassword(body.newPassword);
  }

  await db.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ ok: true });
}

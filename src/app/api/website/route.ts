import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { createWebsiteForUser } from "@/lib/site-service";
import { SITE_PALETTES, SITE_FONT_THEMES, HEADER_STYLES, SPACING_OPTIONS, BUTTON_SHAPES, ARROW_STYLES } from "@/lib/website";
import { templateById } from "@/lib/templates";
import { updateSiteExt, ANIMATION_STYLES, ANIMATION_SPEEDS, type SiteExt } from "@/lib/site-ext";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.website.findUnique({ where: { userId: user.id } });
  if (existing) return NextResponse.json({ error: "You already have a website" }, { status: 400 });

  const body = await req.json();
  const templateId = typeof body.templateId === "string" && templateById(body.templateId) ? body.templateId : "vienna";
  const logoText = typeof body.logoText === "string" && body.logoText.trim() ? body.logoText.trim() : user.businessName || user.name;
  const slug = typeof body.slug === "string" && body.slug.trim() ? body.slug : logoText;

  const website = await createWebsiteForUser(user.id, { slug, templateId, logoText });
  return NextResponse.json({ id: website.id, slug: website.slug });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) return NextResponse.json({ error: "No website" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.slug === "string" && body.slug.trim()) {
    const slug = slugify(body.slug);
    if (!slug) return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    if (slug !== website.slug) {
      const taken = await db.website.findUnique({ where: { slug } });
      if (taken) return NextResponse.json({ error: "That address is already taken" }, { status: 400 });
      data.slug = slug;
    }
  }

  for (const key of ["logoText", "logoUrl", "tagline", "footerText", "socialInstagram", "socialFacebook", "socialPinterest"] as const) {
    if (typeof body[key] === "string") data[key] = body[key].trim();
  }
  if (typeof body.published === "boolean") data.published = body.published;
  if (typeof body.palette === "string" && SITE_PALETTES.some((p) => p.id === body.palette)) data.palette = body.palette;
  if (typeof body.fontTheme === "string" && SITE_FONT_THEMES.some((f) => f.id === body.fontTheme)) data.fontTheme = body.fontTheme;
  if (typeof body.headerStyle === "string" && HEADER_STYLES.some((h) => h.id === body.headerStyle)) data.headerStyle = body.headerStyle;
  if (typeof body.spacing === "string" && SPACING_OPTIONS.some((o) => o.id === body.spacing)) data.spacing = body.spacing;
  if (typeof body.buttonShape === "string" && BUTTON_SHAPES.some((o) => o.id === body.buttonShape)) data.buttonShape = body.buttonShape;
  if (typeof body.arrowStyle === "string" && ARROW_STYLES.some((o) => o.id === body.arrowStyle)) data.arrowStyle = body.arrowStyle;

  // Night build: extended settings (tracking, cookie banner, animation,
  // site password, font overrides) live in their own columns.
  const ext: Partial<SiteExt> = {};
  if (typeof body.gaId === "string") ext.gaId = body.gaId.trim();
  if (typeof body.fbPixelId === "string") ext.fbPixelId = body.fbPixelId.trim();
  if (typeof body.cookieBannerEnabled === "boolean") ext.cookieBannerEnabled = body.cookieBannerEnabled;
  if (typeof body.cookieBannerText === "string") ext.cookieBannerText = body.cookieBannerText.trim().slice(0, 300);
  if (typeof body.animationStyle === "string" && ANIMATION_STYLES.some((a) => a.id === body.animationStyle)) ext.animationStyle = body.animationStyle;
  if (typeof body.animationSpeed === "string" && ANIMATION_SPEEDS.some((a) => a.id === body.animationSpeed)) ext.animationSpeed = body.animationSpeed;
  if (typeof body.sitePassword === "string") ext.sitePassword = body.sitePassword.trim().slice(0, 100);
  if (typeof body.fontDisplay === "string") ext.fontDisplay = body.fontDisplay.trim().slice(0, 120);
  if (typeof body.fontBody === "string") ext.fontBody = body.fontBody.trim().slice(0, 120);
  if (Object.keys(ext).length > 0) {
    try {
      await updateSiteExt(website.id, ext);
    } catch {
      return NextResponse.json(
        { error: "These settings are waiting on a database update that is still being applied. Try again shortly." },
        { status: 503 }
      );
    }
  }

  const updated = await db.website.update({ where: { id: website.id }, data });
  return NextResponse.json({ ok: true, slug: updated.slug });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) return NextResponse.json({ error: "No website" }, { status: 404 });
  await db.website.delete({ where: { id: website.id } });
  return NextResponse.json({ ok: true });
}

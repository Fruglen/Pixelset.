import { db } from "./db";
import { getCurrentUser } from "./auth";
import type { CSSProperties } from "react";
import { sitePaletteById, siteFontById } from "./website";

export async function getSiteBySlug(slug: string) {
  const website = await db.website.findUnique({
    where: { slug },
    include: {
      pages: { orderBy: { order: "asc" } },
      user: { select: { id: true, name: true, businessName: true } },
    },
  });
  if (!website) return null;
  const user = await getCurrentUser();
  const isOwner = !!user && user.id === website.userId;
  if (!website.published && !isOwner) return null;
  return { website, isOwner };
}

export type SiteWithPages = NonNullable<Awaited<ReturnType<typeof getSiteBySlug>>>["website"];

export function siteThemeStyle(website: { palette: string; fontTheme: string }): CSSProperties {
  const palette = sitePaletteById(website.palette);
  const font = siteFontById(website.fontTheme);
  return {
    "--s-bg": palette.bg,
    "--s-text": palette.text,
    "--s-accent": palette.accent,
    "--s-muted": palette.muted,
    "--s-subtle": palette.subtle,
    "--s-display": font.display,
    "--s-body": font.body,
    "--s-display-weight": font.displayWeight,
    "--s-display-tracking": font.displayTracking,
    "--s-display-transform": font.displayTransform,
  } as CSSProperties;
}

// Resolve a block link: internal links ("/pricing") are prefixed with the
// site's base path; absolute URLs pass through.
export function siteHref(basePath: string, link: string): string {
  const trimmed = (link || "").trim();
  if (!trimmed) return basePath;
  if (/^(https?:|mailto:|tel:)/.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed === "/" ? basePath : `${basePath}${trimmed}`;
  return `${basePath}/${trimmed}`;
}

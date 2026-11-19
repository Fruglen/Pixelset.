import { db } from "./db";
import { getCurrentUser } from "./auth";
import type { CSSProperties } from "react";
import { cookies, headers } from "next/headers";
import { liveView, type SnapshotPage } from "./site-publish";
import { sitePaletteById, siteFontById, spacingById, buttonShapeById, arrowById } from "./website";
import { resolveSiteFonts } from "./fonts";

export const DRAFT_COOKIE = "pxs_site_draft";
export const HOST_ROUTED_HEADER = "x-pixelset-site-host";

// Load a public site. Visitors (and the owner by default) see the PUBLISHED
// snapshot; the owner sees the draft when draft preview is switched on.
// When the request arrived on a subdomain or verified custom domain the
// middleware sets HOST_ROUTED_HEADER and links are built without /site/<slug>.
export async function getSiteBySlug(slug: string) {
  const row = await db.website.findUnique({
    where: { slug },
    include: {
      pages: { orderBy: { order: "asc" } },
      user: { select: { id: true, name: true, businessName: true, brandLogoUrl: true } },
    },
  });
  if (!row) return null;
  const user = await getCurrentUser();
  const isOwner = !!user && user.id === row.userId;
  if (!row.published && !isOwner) return null;
  const draftMode = isOwner && cookies().get(DRAFT_COOKIE)?.value === "1";
  const hostRouted = headers().get(HOST_ROUTED_HEADER) === "1";
  // Phase 5B platform: subdirectory hosting. A reverse proxy on the
  // photographer's own domain (for example yourstudio.com/photos) forwards to
  // this site and sends X-Forwarded-Prefix: /photos; links are then built under
  // that prefix so the site works inside the existing domain's path.
  const prefix = forwardedPrefix(headers().get("x-forwarded-prefix"));
  const basePath = prefix || (hostRouted ? "" : `/site/${row.slug}`);
  if (draftMode) {
    return { website: { ...row, logoUrl: row.logoUrl || row.user.brandLogoUrl, pages: row.pages as SnapshotPage[] }, isOwner, draftMode, basePath };
  }
  const live = liveView(row, row.pages);
  // Phase 5B platform: the account brand logo is the fallback when the site sets none.
  return { website: { ...live.website, logoUrl: live.website.logoUrl || row.user.brandLogoUrl, pages: live.pages }, isOwner, draftMode, basePath };
}

export function forwardedPrefix(raw: string | null | undefined): string {
  const v = (raw || "").trim().replace(/\/+$/, "");
  return /^(\/[a-zA-Z0-9._~-]+){1,4}$/.test(v) ? v : "";
}

export type SiteWithPages = NonNullable<Awaited<ReturnType<typeof getSiteBySlug>>>["website"];

// CSS variables for one palette (used site wide and for per-block overrides).
export function paletteVars(id: string): CSSProperties {
  const palette = sitePaletteById(id);
  return {
    "--s-bg": palette.bg,
    "--s-text": palette.text,
    "--s-accent": palette.accent,
    "--s-muted": palette.muted,
    "--s-subtle": palette.subtle,
  } as CSSProperties;
}

export function siteThemeStyle(website: { palette: string; fontTheme: string; spacing?: string; buttonShape?: string; arrowStyle?: string } & Record<string, unknown>): CSSProperties {
  const font = siteFontById(website.fontTheme);
  const spacing = spacingById(website.spacing ?? "regular");
  const arrow = arrowById(website.arrowStyle ?? "none");
  // Night build: font library picks and uploaded fonts override the theme.
  const fonts = resolveSiteFonts(website);
  return {
    ...paletteVars(website.palette),
    "--s-pad": spacing.pad,
    "--s-pad-md": spacing.padMd,
    "--s-radius": buttonShapeById(website.buttonShape ?? "square").radius,
    "--s-arrow": arrow.glyph ? `"${arrow.glyph}"` : '""',
    "--s-display": fonts.displayCss,
    "--s-body": fonts.bodyCss,
    "--s-display-weight": font.displayWeight,
    "--s-display-tracking": font.displayTracking,
    "--s-display-transform": font.displayTransform,
  } as CSSProperties;
}

// Resolve a block link: internal links ("/pricing") are prefixed with the
// site's base path; absolute URLs pass through.
export function siteHref(basePath: string, link: string): string {
  const trimmed = (link || "").trim();
  if (!trimmed) return basePath || "/";
  if (trimmed.startsWith("#")) return trimmed;
  if (/^(https?:|mailto:|tel:)/.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed === "/" ? basePath || "/" : `${basePath}${trimmed}`;
  return `${basePath}/${trimmed}`;
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveRedirectTarget } from "@/lib/site-redirects";
import { normalizeDomain, siteRootDomain } from "@/lib/site-domains";

export const dynamic = "force-dynamic";

// Internal lookup used by src/middleware.ts (edge middleware cannot use
// Prisma). Given the request host + path it answers:
//  - redirect: a literal 301 for a matching site redirect
//  - rewrite: serve /site/<slug><path> for a free subdomain or verified custom domain
//  - none: let the request through untouched
export async function GET(req: NextRequest) {
  const host = normalizeDomain(req.nextUrl.searchParams.get("host") || "");
  const path = req.nextUrl.searchParams.get("path") || "/";
  const mode = req.nextUrl.searchParams.get("mode") || "host"; // host | path

  let website: { id: string; slug: string; published: boolean } | null = null;
  let sitePath = path;
  let hostRouted = false;

  if (mode === "path") {
    const m = path.match(/^\/site\/([^/]+)(\/.*)?$/);
    if (!m) return NextResponse.json({ action: "none" });
    website = await db.website.findUnique({ where: { slug: m[1] }, select: { id: true, slug: true, published: true } });
    sitePath = m[2] || "/";
  } else {
    const root = siteRootDomain();
    if (host.endsWith(`.${root}`)) {
      const sub = host.slice(0, -(root.length + 1));
      if (sub && !sub.includes(".") && !["www", "app"].includes(sub)) {
        website = await db.website.findUnique({ where: { slug: sub }, select: { id: true, slug: true, published: true } });
      }
    } else if (host) {
      const candidates = [host, host.startsWith("www.") ? host.slice(4) : `www.${host}`];
      const rows = await db.website.findMany({
        where: { domainStatus: "VERIFIED", customDomain: { not: "" } },
        select: { id: true, slug: true, published: true, customDomain: true },
      });
      website = rows.find((r) => candidates.includes(normalizeDomain(r.customDomain))) ?? null;
    }
    hostRouted = !!website;
  }

  // Phase 5B platform: a verified gallery custom domain serves the gallery
  // homepage at its root (collections stay at /g/<slug>, a shared path).
  if (!website && mode === "host" && host && (path === "/" || path === "")) {
    const candidates = [host, host.startsWith("www.") ? host.slice(4) : `www.${host}`];
    const owner = await db.user.findFirst({
      where: { galleryDomain: { in: candidates }, galleryDomainStatus: "VERIFIED", galleryHomeSlug: { not: null } },
      select: { galleryHomeSlug: true },
    });
    if (owner?.galleryHomeSlug) return NextResponse.json({ action: "rewrite", path: `/gh/${owner.galleryHomeSlug}` });
  }
  if (!website) return NextResponse.json({ action: "none" });

  if (sitePath !== "/" && !sitePath.endsWith("/sitemap.xml")) {
    const redirect = await resolveRedirectTarget(website.id, sitePath);
    if (redirect) {
      const base = hostRouted ? "" : `/site/${website.slug}`;
      const location = /^https?:/i.test(redirect.toPath)
        ? redirect.toPath
        : `${base}${redirect.toPath === "/" ? "" : redirect.toPath}` || "/";
      return NextResponse.json({ action: "redirect", status: 301, location });
    }
  }

  if (hostRouted) {
    return NextResponse.json({ action: "rewrite", path: `/site/${website.slug}${sitePath === "/" ? "" : sitePath}` });
  }
  return NextResponse.json({ action: "none" });
}

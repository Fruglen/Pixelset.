import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { liveView } from "@/lib/site-publish";
import { subdomainUrl } from "@/lib/site-domains";
import { forwardedPrefix } from "@/lib/site-data";

// Per-site sitemap: /site/<slug>/sitemap.xml
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const website = await db.website.findUnique({
    where: { slug: params.slug },
    include: {
      pages: { orderBy: { order: "asc" } },
      posts: { where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } },
    },
  });
  if (!website || !website.published) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Base URL: verified custom domain, else the free subdomain when host
  // routing is configured (SITE_ROOT_DOMAIN), else the path based address.
  const origin = req.nextUrl.origin;
  // Phase 5B platform: behind a subdirectory reverse proxy the sitemap lists the
  // public addresses (X-Forwarded-Host + X-Forwarded-Prefix).
  const fwdPrefix = forwardedPrefix(req.headers.get("x-forwarded-prefix"));
  const fwdHost = (req.headers.get("x-forwarded-host") || "").split(",")[0].trim();
  const base = fwdPrefix && /^[a-z0-9.-]+(:\d+)?$/i.test(fwdHost)
    ? `https://${fwdHost}${fwdPrefix}`
    : website.customDomain && website.domainStatus === "VERIFIED"
      ? `https://${website.customDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`
      : process.env.SITE_ROOT_DOMAIN
        ? subdomainUrl(website.slug)
        : `${origin}/site/${website.slug}`;

  // Only the PUBLISHED version of the site is listed.
  const live = liveView(website, website.pages);
  const lastmod = website.publishedAt ?? website.updatedAt;
  const urls: { loc: string; lastmod: Date }[] = [];
  for (const page of live.pages.filter((p) => p.visible)) {
    urls.push({ loc: page.slug ? `${base}/${page.slug}` : base, lastmod });
  }
  for (const post of website.posts) {
    urls.push({ loc: `${base}/blog/${post.slug}`, lastmod: post.updatedAt });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc.replace(/&/g, "&amp;")}</loc>
    <lastmod>${u.lastmod.toISOString().slice(0, 10)}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new NextResponse(xml, { headers: { "Content-Type": "application/xml" } });
}

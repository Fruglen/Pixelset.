import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Per-site sitemap: /site/<slug>/sitemap.xml
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const website = await db.website.findUnique({
    where: { slug: params.slug },
    include: {
      pages: { where: { visible: true }, orderBy: { order: "asc" } },
      posts: { where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } },
    },
  });
  if (!website || !website.published) {
    return new NextResponse("Not found", { status: 404 });
  }

  const origin = req.nextUrl.origin;
  const base = website.customDomain
    ? `https://${website.customDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`
    : `${origin}/site/${website.slug}`;

  const urls: { loc: string; lastmod: Date }[] = [];
  for (const page of website.pages) {
    urls.push({ loc: page.slug ? `${base}/${page.slug}` : base, lastmod: page.updatedAt });
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

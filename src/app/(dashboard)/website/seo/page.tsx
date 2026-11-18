import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseBlocks, collectImages } from "@/lib/blocks";
import { SeoClient } from "./seo-client";

export const dynamic = "force-dynamic";

export default async function WebsiteSeoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const website = await db.website.findUnique({
    where: { userId: user.id },
    include: { pages: { orderBy: { order: "asc" } }, redirects: { orderBy: { createdAt: "desc" } } },
  });
  if (!website) redirect("/website");

  const pages = website.pages.map((p) => {
    const blocks = parseBlocks(p.blocks);
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      type: p.type,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      blocks,
      images: collectImages(blocks),
    };
  });

  return (
    <SeoClient
      siteSlug={website.slug}
      logoText={website.logoText}
      pages={pages}
      redirects={website.redirects.map((r) => ({ id: r.id, fromPath: r.fromPath, toPath: r.toPath }))}
    />
  );
}

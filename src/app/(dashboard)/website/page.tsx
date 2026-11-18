import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseBlocks } from "@/lib/blocks";
import { TEMPLATES } from "@/lib/templates";
import { SITE_PALETTES } from "@/lib/website";
import { CreateWebsite, PagesList } from "./website-client";

export const dynamic = "force-dynamic";

export default async function WebsitePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const website = await db.website.findUnique({
    where: { userId: user.id },
    include: { pages: { orderBy: { order: "asc" } } },
  });

  if (!website) {
    const templates = TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      tagline: t.tagline,
      desc: t.desc,
      palette: SITE_PALETTES.find((p) => p.id === t.palette) ?? SITE_PALETTES[0],
    }));
    return (
      <CreateWebsite
        templates={templates}
        defaultName={user.businessName || user.name}
      />
    );
  }

  const pages = website.pages.map((p) => ({
    id: p.id,
    type: p.type,
    title: p.title,
    slug: p.slug,
    visible: p.visible,
    blockCount: parseBlocks(p.blocks).length,
  }));

  return <PagesList pages={pages} siteSlug={website.slug} />;
}

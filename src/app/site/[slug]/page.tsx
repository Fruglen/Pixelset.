import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteBySlug } from "@/lib/site-data";
import { SiteShell, SitePageBlocks } from "@/components/site/page-shell";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const site = await getSiteBySlug(params.slug);
  if (!site) return { title: "Site not found" };
  const home = site.website.pages.find((p) => p.type === "HOME");
  return {
    title: home?.seoTitle || site.website.logoText || site.website.slug,
    description: home?.seoDescription || site.website.tagline || undefined,
  };
}

export default async function SiteHomePage({ params }: { params: { slug: string } }) {
  const site = await getSiteBySlug(params.slug);
  if (!site) notFound();
  const { website, isOwner } = site;
  const home = website.pages.find((p) => p.type === "HOME") ?? website.pages[0];
  if (!home) notFound();

  return (
    <SiteShell website={website} isOwner={isOwner} activeSlug="">
      <SitePageBlocks website={website} page={home} />
    </SiteShell>
  );
}

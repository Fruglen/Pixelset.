import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSiteBySlug } from "@/lib/site-data";
import { SiteShell, SitePageBlocks } from "@/components/site/page-shell";
import { siteExt } from "@/lib/site-ext";
import { readSiteGate } from "@/lib/site-gate";
import { GateScreen } from "@/components/site/gate-screen";

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
  const { website, isOwner, draftMode, basePath } = site;
  const home = website.pages.find((p) => p.type === "HOME") ?? website.pages[0];
  if (!home) notFound();

  // Night build: password gates (owner is never gated).
  if (!isOwner) {
    const ext = siteExt(website);
    const gate = readSiteGate(website.id);
    if (ext.sitePassword && !gate.site) {
      return <GateScreen website={website} label="This site is private" />;
    }
    const homePassword = String((home as unknown as Record<string, unknown>).password ?? "");
    if (homePassword && !gate.site && !gate.pages.includes(home.id)) {
      return <GateScreen website={website} pageId={home.id} label="This page is private" />;
    }
  }

  return (
    <SiteShell website={website} isOwner={isOwner} draftMode={draftMode} basePath={basePath} activeSlug="">
      <SitePageBlocks website={website} page={home} basePath={basePath} />
    </SiteShell>
  );
}

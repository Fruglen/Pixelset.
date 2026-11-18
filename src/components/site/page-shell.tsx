import { parseBlocks } from "@/lib/blocks";
import { siteThemeStyle } from "@/lib/site-data";
import { SiteHeader, SiteFooter, OwnerPreviewBanner } from "./chrome";
import { RenderBlocks, SiteCtx } from "./blocks";
import type { SiteWithPages } from "@/lib/site-data";

export function SiteShell({
  website,
  isOwner,
  activeSlug,
  children,
}: {
  website: SiteWithPages;
  isOwner: boolean;
  activeSlug: string;
  children: React.ReactNode;
}) {
  const navPages = website.pages.map((p) => ({ title: p.title, slug: p.slug, visible: p.visible }));
  return (
    <div className="site-root" style={siteThemeStyle(website)}>
      {isOwner ? <OwnerPreviewBanner published={website.published} /> : null}
      <SiteHeader site={website} pages={navPages} activeSlug={activeSlug} />
      <main className="flex-1">{children}</main>
      <SiteFooter site={website} pages={navPages} />
    </div>
  );
}

export function SitePageBlocks({ website, page }: { website: SiteWithPages; page: { blocks: string } }) {
  const ctx: SiteCtx = {
    websiteId: website.id,
    userId: website.userId,
    siteSlug: website.slug,
    basePath: `/site/${website.slug}`,
  };
  return <RenderBlocks blocks={parseBlocks(page.blocks)} ctx={ctx} />;
}

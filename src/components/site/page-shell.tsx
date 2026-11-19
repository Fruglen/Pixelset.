import Script from "next/script";
import { parseBlocks } from "@/lib/blocks";
import { siteThemeStyle } from "@/lib/site-data";
import { SiteHeader, SiteFooter, OwnerPreviewBanner } from "./chrome";
import { RenderBlocks, SiteCtx } from "./blocks";
import type { SiteWithPages } from "@/lib/site-data";
import { onePageNav } from "@/lib/templates";
import { siteExt, ANIMATION_SPEEDS } from "@/lib/site-ext";
import { resolveSiteFonts, googleFontsHref, fontFaceCss } from "@/lib/fonts";
import { CookieBanner } from "./cookie-banner";

export function SiteShell({
  website,
  isOwner,
  draftMode = false,
  basePath,
  activeSlug,
  children,
}: {
  website: SiteWithPages;
  isOwner: boolean;
  draftMode?: boolean;
  basePath: string;
  activeSlug: string;
  children: React.ReactNode;
}) {
  // One page templates navigate by in-page anchors on the home page.
  const anchors = onePageNav(website.template, website.pages);
  const navPages = anchors ?? website.pages.map((p) => ({ title: p.title, slug: p.slug, visible: p.visible }));
  // Night build: extended settings drive tracking, the cookie banner, the
  // entrance animation and the font library picks on public pages.
  const ext = siteExt(website);
  const fonts = resolveSiteFonts(website);
  const gaId = /^[A-Za-z0-9-]{4,40}$/.test(ext.gaId) ? ext.gaId : "";
  const pixelId = /^\d{5,25}$/.test(ext.fbPixelId) ? ext.fbPixelId : "";
  const animSpeed = ANIMATION_SPEEDS.find((s) => s.id === ext.animationSpeed)?.seconds ?? 0.7;
  const themeStyle = siteThemeStyle(website) as Record<string, string>;
  if (ext.animationStyle !== "none") themeStyle["--s-anim-speed"] = `${animSpeed}s`;
  return (
    <div className="site-root" style={themeStyle} data-anim={ext.animationStyle !== "none" ? ext.animationStyle : undefined}>
      {fonts.googleFamilies.length > 0 ? (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={googleFontsHref(fonts.googleFamilies)} />
        </>
      ) : null}
      {fonts.faces.length > 0 ? <style>{fontFaceCss(fonts.faces)}</style> : null}
      {gaId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
          <Script id="pxs-ga" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${gaId}');`}
          </Script>
        </>
      ) : null}
      {pixelId ? (
        <Script id="pxs-fbpixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js'); fbq('init', '${pixelId}'); fbq('track', 'PageView');`}
        </Script>
      ) : null}
      {isOwner ? <OwnerPreviewBanner published={website.published} draftMode={draftMode} slug={website.slug} /> : null}
      <SiteHeader site={website} pages={navPages} activeSlug={activeSlug} basePath={basePath} />
      <main className="flex-1">{children}</main>
      <SiteFooter site={website} pages={navPages} basePath={basePath} />
      {ext.cookieBannerEnabled && !isOwner ? <CookieBanner siteSlug={website.slug} text={ext.cookieBannerText} /> : null}
    </div>
  );
}

export function SitePageBlocks({ website, page, basePath }: { website: SiteWithPages; page: { blocks: string }; basePath: string }) {
  const ctx: SiteCtx = {
    websiteId: website.id,
    userId: website.userId,
    siteSlug: website.slug,
    basePath,
    instagramToken: website.instagramToken,
  };
  return <RenderBlocks blocks={parseBlocks(page.blocks)} ctx={ctx} />;
}

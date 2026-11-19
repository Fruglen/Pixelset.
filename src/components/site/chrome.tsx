import Link from "next/link";

interface NavPage {
  title: string;
  slug: string;
  visible: boolean;
}

interface ChromeSite {
  slug: string;
  logoText: string;
  logoUrl: string;
  tagline: string;
  headerStyle: string;
  footerText: string;
  socialInstagram: string;
  socialFacebook: string;
  socialPinterest: string;
  customDomain: string;
}

function Logo({ site, basePath, large }: { site: ChromeSite; basePath: string; large?: boolean }) {
  return (
    <Link href={basePath || "/"} className="inline-block">
      {site.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={site.logoUrl} alt={site.logoText || "Logo"} className={large ? "h-14" : "h-9"} />
      ) : (
        <span className={`site-display ${large ? "text-3xl md:text-4xl" : "text-xl md:text-2xl"}`}>{site.logoText || "Studio"}</span>
      )}
    </Link>
  );
}

function NavLinks({ pages, basePath, activeSlug, className }: { pages: NavPage[]; basePath: string; activeSlug: string; className?: string }) {
  return (
    <nav className={className}>
      {pages.filter((p) => p.visible).map((p) => (
        <Link
          key={p.slug || "home"}
          href={p.slug.startsWith("#") ? `${basePath}/${p.slug}` : p.slug ? `${basePath}/${p.slug}` : basePath || "/"}
          className={`site-nav-link ${p.slug === activeSlug ? "active" : ""}`}
        >
          {p.title}
        </Link>
      ))}
    </nav>
  );
}

export function SiteHeader({ site, pages, activeSlug, basePath }: { site: ChromeSite; pages: NavPage[]; activeSlug: string; basePath: string }) {
  const style = site.headerStyle;

  if (style === "center" || style === "stacked") {
    return (
      <header className={`px-6 ${style === "stacked" ? "py-10" : "py-6"} text-center border-b`} style={{ borderColor: "color-mix(in srgb, var(--s-text) 12%, transparent)" }}>
        <Logo site={site} basePath={basePath} large={style === "stacked"} />
        {site.tagline ? <p className="site-subtle text-xs tracking-[0.2em] uppercase mt-2">{site.tagline}</p> : null}
        <NavLinks pages={pages} basePath={basePath} activeSlug={activeSlug} className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-5" />
      </header>
    );
  }

  // left | minimal
  return (
    <header
      className={`px-6 md:px-10 ${style === "minimal" ? "py-4" : "py-6"} flex items-center justify-between gap-6 border-b`}
      style={{ borderColor: "color-mix(in srgb, var(--s-text) 12%, transparent)" }}
    >
      <Logo site={site} basePath={basePath} />
      <NavLinks pages={pages} basePath={basePath} activeSlug={activeSlug} className="flex flex-wrap justify-end gap-x-5 gap-y-2" />
    </header>
  );
}

export function SiteFooter({ site, pages, basePath }: { site: ChromeSite; pages: NavPage[]; basePath: string }) {
  const socials = [
    { label: "Instagram", url: site.socialInstagram },
    { label: "Facebook", url: site.socialFacebook },
    { label: "Pinterest", url: site.socialPinterest },
  ].filter((s) => s.url);

  return (
    <footer className="mt-auto px-6 py-10 text-center border-t" style={{ borderColor: "color-mix(in srgb, var(--s-text) 12%, transparent)" }}>
      <NavLinks pages={pages} basePath={basePath} activeSlug="__none__" className="flex flex-wrap justify-center gap-x-5 gap-y-2 mb-4" />
      {socials.length ? (
        <div className="flex justify-center gap-5 mb-4">
          {socials.map((s) => (
            <a key={s.label} href={s.url} target="_blank" rel="noreferrer" className="site-nav-link">
              {s.label}
            </a>
          ))}
        </div>
      ) : null}
      <p className="site-subtle text-xs">
        {site.footerText || `© ${new Date().getFullYear()} ${site.logoText}`}
        {site.customDomain ? <span className="block mt-1">{site.customDomain}</span> : null}
      </p>
      <p className="site-subtle text-[11px] mt-3 opacity-70">Built with Pixora</p>
    </footer>
  );
}

export function OwnerPreviewBanner({ published, draftMode, slug }: { published: boolean; draftMode: boolean; slug: string }) {
  const toggle = `/api/website/preview?mode=${draftMode ? "live" : "draft"}&slug=${encodeURIComponent(slug)}`;
  return (
    <div className={`${draftMode ? "bg-amber-600" : "bg-neutral-900"} text-white text-center text-xs py-2 px-4`}>
      {draftMode
        ? "Draft preview, visitors do not see these changes until you publish them (Website, Publish changes). "
        : published
          ? "Owner preview, this is your live, published site. "
          : "Owner preview, your site is offline. Only you can see it (Website, Settings to put it online). "}
      <a href={toggle} className="underline ml-1">{draftMode ? "View the live site" : "Preview the draft"}</a>
    </div>
  );
}

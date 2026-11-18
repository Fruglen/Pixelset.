/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { db } from "@/lib/db";
import { Block } from "@/lib/blocks";
import { siteHref } from "@/lib/site-data";
import { formatDate, isExpired } from "@/lib/utils";
import { Slideshow, ContactForm, BookingForm, NewsletterForm } from "./site-client";

export interface SiteCtx {
  websiteId: string;
  userId: string;
  siteSlug: string;
  basePath: string;
}

// --- prop coercion helpers --------------------------------------------------
const s = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const num = (v: unknown, d: number) => {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const flag = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const items = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];
const lines = (v: unknown): string[] =>
  s(v)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const WIDTHS: Record<string, string> = {
  narrow: "max-w-2xl",
  regular: "max-w-4xl",
  wide: "max-w-6xl",
  full: "max-w-none px-0",
};
const HEIGHTS: Record<string, string> = {
  full: "h-[88vh] min-h-[480px]",
  tall: "h-[70vh] min-h-[420px]",
  medium: "h-[52vh] min-h-[340px]",
  short: "h-[36vh] min-h-[240px]",
};
const ALIGNS: Record<string, string> = { left: "text-left", center: "text-center", right: "text-right" };
const COLS: Record<string, string> = { "1": "md:grid-cols-1", "2": "md:grid-cols-2", "3": "md:grid-cols-3", "4": "md:grid-cols-4" };

function videoEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

function Section({ children, width = "wide", pad = true }: { children: React.ReactNode; width?: string; pad?: boolean }) {
  return (
    <section className={pad ? "px-6 py-10 md:py-14" : ""}>
      <div className={`mx-auto ${WIDTHS[width] ?? WIDTHS.wide}`}>{children}</div>
    </section>
  );
}

function Stars({ count }: { count: number }) {
  return <span className="site-accent tracking-widest">{"★".repeat(count)}{"☆".repeat(Math.max(0, 5 - count))}</span>;
}

function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className={`leading-relaxed ${className ?? ""} ${i > 0 ? "mt-4" : ""}`}>
            {p}
          </p>
        ))}
    </>
  );
}

// --- the renderer -----------------------------------------------------------

export async function RenderBlock({ block, ctx }: { block: Block; ctx: SiteCtx }) {
  const p = block.props;

  switch (block.type) {
    case "hero": {
      const image = s(p.image);
      const align = s(p.align, "center");
      return (
        <section className={`relative ${HEIGHTS[s(p.height, "tall")] ?? HEIGHTS.tall}`}>
          {image ? <img src={image} alt={s(p.imageAlt)} className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 site-muted-bg" />}
          {flag(p.overlay, true) && image ? <div className="absolute inset-0 bg-black/35" /> : null}
          <div className={`relative h-full flex flex-col justify-center px-8 md:px-16 ${align === "center" ? "items-center text-center" : align === "right" ? "items-end text-right" : "items-start text-left"}`}>
            <div className={image ? "text-white" : ""}>
              {s(p.kicker) ? <p className="text-xs tracking-[0.3em] uppercase mb-4 opacity-90">{s(p.kicker)}</p> : null}
              <h1 className="site-display text-4xl md:text-6xl max-w-3xl">{s(p.heading)}</h1>
              {s(p.subheading) ? <p className="mt-4 max-w-xl text-base md:text-lg opacity-90">{s(p.subheading)}</p> : null}
              {s(p.buttonLabel) ? (
                <Link href={siteHref(ctx.basePath, s(p.buttonLink))} className="site-btn mt-8" style={image ? { background: "#fff", color: "#1a1a1a" } : undefined}>
                  {s(p.buttonLabel)}
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      );
    }

    case "heroSplit": {
      const image = s(p.image);
      const imageFirst = s(p.side, "left") === "left";
      const imageEl = image ? <img src={image} alt={s(p.imageAlt)} className="w-full h-[46vh] md:h-[72vh] object-cover" /> : <div className="w-full h-[46vh] md:h-[72vh] site-muted-bg" />;
      const textEl = (
        <div className="flex flex-col justify-center px-8 md:px-14 py-12">
          {s(p.kicker) ? <p className="text-xs tracking-[0.3em] uppercase site-subtle mb-4">{s(p.kicker)}</p> : null}
          <h1 className="site-display text-3xl md:text-5xl">{s(p.heading)}</h1>
          {s(p.subheading) ? <p className="mt-4 site-subtle max-w-md leading-relaxed">{s(p.subheading)}</p> : null}
          {s(p.buttonLabel) ? (
            <div className="mt-8">
              <Link href={siteHref(ctx.basePath, s(p.buttonLink))} className="site-btn">{s(p.buttonLabel)}</Link>
            </div>
          ) : null}
        </div>
      );
      return (
        <section className="grid md:grid-cols-2">
          {imageFirst ? (<>{imageEl}{textEl}</>) : (<>{textEl}{imageEl}</>)}
        </section>
      );
    }

    case "slideshow": {
      const slides = items(p.slides).map((sl) => ({ image: s(sl.image), imageAlt: s(sl.imageAlt), caption: s(sl.caption) })).filter((sl) => sl.image);
      return <Slideshow slides={slides} heading={s(p.heading)} heightClass={HEIGHTS[s(p.height, "tall")] ?? HEIGHTS.tall} />;
    }

    case "heading":
      return (
        <Section width="regular">
          <div className={ALIGNS[s(p.align, "center")] ?? "text-center"}>
            {s(p.kicker) ? <p className="text-xs tracking-[0.3em] uppercase site-accent mb-3">{s(p.kicker)}</p> : null}
            <h2 className="site-display text-3xl md:text-4xl">{s(p.heading)}</h2>
            {s(p.intro) ? <p className="site-subtle mt-4 max-w-2xl mx-auto leading-relaxed">{s(p.intro)}</p> : null}
          </div>
        </Section>
      );

    case "text":
      return (
        <Section width={s(p.width, "narrow")}>
          <div className={ALIGNS[s(p.align, "left")] ?? "text-left"}>
            <Paragraphs text={s(p.body)} />
          </div>
        </Section>
      );

    case "quote":
      return (
        <Section width="regular">
          <blockquote className="text-center">
            <p className="site-display text-2xl md:text-3xl leading-snug">&ldquo;{s(p.quote)}&rdquo;</p>
            {s(p.attribution) ? <footer className="site-subtle text-xs tracking-[0.2em] uppercase mt-4">- {s(p.attribution)}</footer> : null}
          </blockquote>
        </Section>
      );

    case "columnsText":
      return (
        <Section>
          <div className={`grid gap-8 ${COLS[s(p.cols, "2")] ?? COLS["2"]}`}>
            {items(p.items).map((it, i) => (
              <div key={i}>
                <h3 className="site-display text-xl mb-2">{s(it.title)}</h3>
                <Paragraphs text={s(it.body)} className="site-subtle text-sm" />
              </div>
            ))}
          </div>
        </Section>
      );

    case "list":
      return (
        <Section width="regular">
          {s(p.heading) ? <h3 className="site-display text-2xl mb-6 text-center">{s(p.heading)}</h3> : null}
          <ul className={`grid gap-x-10 gap-y-3 ${COLS[s(p.cols, "2")] ?? COLS["2"]}`}>
            {items(p.items).map((it, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="site-accent mt-0.5">✓</span>
                <span>{s(it.text)}</span>
              </li>
            ))}
          </ul>
        </Section>
      );

    case "imageFull": {
      const w = s(p.width, "wide");
      return (
        <Section width={w} pad={w !== "full"}>
          {s(p.image) ? <img src={s(p.image)} alt={s(p.imageAlt)} className="w-full" /> : null}
          {s(p.caption) ? <p className="site-subtle text-xs tracking-wide text-center mt-3 px-6">{s(p.caption)}</p> : null}
        </Section>
      );
    }

    case "imageText": {
      const imageFirst = s(p.side, "left") === "left";
      const imageEl = s(p.image) ? <img src={s(p.image)} alt={s(p.imageAlt)} className="w-full object-cover aspect-[4/5]" /> : <div className="w-full aspect-[4/5] site-muted-bg" />;
      const textEl = (
        <div className="flex flex-col justify-center">
          {s(p.kicker) ? <p className="text-xs tracking-[0.3em] uppercase site-accent mb-3">{s(p.kicker)}</p> : null}
          <h2 className="site-display text-2xl md:text-3xl mb-4">{s(p.heading)}</h2>
          <Paragraphs text={s(p.body)} className="site-subtle" />
          {s(p.buttonLabel) ? (
            <div className="mt-6">
              <Link href={siteHref(ctx.basePath, s(p.buttonLink))} className="site-btn site-btn-outline">{s(p.buttonLabel)}</Link>
            </div>
          ) : null}
        </div>
      );
      return (
        <Section>
          <div className="grid md:grid-cols-2 gap-10 items-center">
            {imageFirst ? (<>{imageEl}{textEl}</>) : (<>{textEl}{imageEl}</>)}
          </div>
        </Section>
      );
    }

    case "imageGrid": {
      const im = items(p.images).filter((it) => s(it.url));
      const cols = im.length <= 2 ? "md:grid-cols-2" : im.length === 3 ? "md:grid-cols-3" : "md:grid-cols-4";
      return (
        <Section>
          <div className={`grid grid-cols-2 ${cols} gap-4`}>
            {im.map((it, i) => (
              <figure key={i}>
                <img src={s(it.url)} alt={s(it.alt)} className="w-full aspect-[4/5] object-cover" />
                {s(it.caption) ? <figcaption className="site-subtle text-xs mt-2 text-center">{s(it.caption)}</figcaption> : null}
              </figure>
            ))}
          </div>
        </Section>
      );
    }

    case "video": {
      const embed = videoEmbedUrl(s(p.url));
      return (
        <Section width={s(p.width, "regular")}>
          {embed ? (
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe src={embed} className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={s(p.caption) || "Video"} />
            </div>
          ) : (
            <div className="site-muted-bg aspect-video flex items-center justify-center site-subtle text-sm">Add a YouTube or Vimeo URL</div>
          )}
          {s(p.caption) ? <p className="site-subtle text-xs text-center mt-3">{s(p.caption)}</p> : null}
        </Section>
      );
    }

    case "galleryGrid": {
      const im = items(p.images).filter((it) => s(it.url));
      return (
        <Section width="wide" pad={flag(p.gap, true)}>
          <div className={`grid grid-cols-2 ${COLS[s(p.cols, "3")] ?? COLS["3"]} ${flag(p.gap, true) ? "gap-4" : "gap-0"}`}>
            {im.map((it, i) => (
              <img key={i} src={s(it.url)} alt={s(it.alt)} className="w-full aspect-square object-cover" />
            ))}
          </div>
        </Section>
      );
    }

    case "galleryMasonry": {
      const im = items(p.images).filter((it) => s(it.url));
      const cols = num(p.cols, 3);
      return (
        <Section>
          <div style={{ columnCount: cols, columnGap: "1rem" }}>
            {im.map((it, i) => (
              <img key={i} src={s(it.url)} alt={s(it.alt)} className="w-full mb-4 break-inside-avoid" style={{ breakInside: "avoid" }} />
            ))}
          </div>
        </Section>
      );
    }

    case "carousel": {
      const im = items(p.images).filter((it) => s(it.url));
      return (
        <section className="py-10">
          <div className="flex gap-4 overflow-x-auto px-6 pb-3" style={{ scrollSnapType: "x mandatory" }}>
            {im.map((it, i) => (
              <img key={i} src={s(it.url)} alt={s(it.alt)} className="h-64 md:h-80 w-auto flex-none object-cover" style={{ scrollSnapAlign: "start" }} />
            ))}
          </div>
        </section>
      );
    }

    case "collectionEmbed": {
      const slug = s(p.collectionSlug);
      if (!slug) return null;
      const collection = await db.collection.findFirst({
        where: { slug, userId: ctx.userId },
        include: { photos: { where: { isPrivate: false }, orderBy: { order: "asc" }, include: { set: { select: { clientExclusive: true } } } } },
      });
      if (!collection) return null;
      const photos = collection.photos.filter((ph) => !ph.set.clientExclusive).slice(0, num(p.count, 6));
      if (photos.length === 0) return null;
      return (
        <Section>
          <div className={`grid grid-cols-2 ${COLS[s(p.cols, "3")] ?? COLS["3"]} gap-4`}>
            {photos.map((ph) => (
              <img key={ph.id} src={ph.url} alt={`${collection.name} photograph`} className="w-full aspect-[4/5] object-cover" />
            ))}
          </div>
          {flag(p.link, true) ? (
            <p className="text-center mt-6">
              <Link href={`/g/${collection.slug}`} className="site-nav-link">View the full gallery: {collection.name} →</Link>
            </p>
          ) : null}
        </Section>
      );
    }

    case "beforeAfter":
      return (
        <Section>
          <div className="grid grid-cols-2 gap-4">
            {s(p.imageA) ? <img src={s(p.imageA)} alt={s(p.imageAAlt)} className="w-full aspect-[4/5] object-cover" /> : null}
            {s(p.imageB) ? <img src={s(p.imageB)} alt={s(p.imageBAlt)} className="w-full aspect-[4/5] object-cover" /> : null}
          </div>
          {s(p.caption) ? <p className="site-subtle text-xs text-center mt-3">{s(p.caption)}</p> : null}
        </Section>
      );

    case "pricingPackages":
      return (
        <Section>
          <div className={`grid gap-6 ${COLS[s(p.cols, "3")] ?? COLS["3"]}`}>
            {items(p.packages).map((pkg, i) => (
              <div key={i} className={`border p-8 flex flex-col ${flag(pkg.featured, false) ? "border-2" : ""}`} style={{ borderColor: flag(pkg.featured, false) ? "var(--s-accent)" : "color-mix(in srgb, var(--s-text) 18%, transparent)" }}>
                {flag(pkg.featured, false) ? <p className="text-[10px] tracking-[0.25em] uppercase site-accent mb-2">Most loved</p> : null}
                <h3 className="site-display text-xl">{s(pkg.name)}</h3>
                <p className="mt-3"><span className="site-display text-3xl">{s(pkg.price)}</span>{s(pkg.unit) ? <span className="site-subtle text-sm"> · {s(pkg.unit)}</span> : null}</p>
                <ul className="mt-5 space-y-2 text-sm site-subtle flex-1">
                  {lines(pkg.features).map((f, j) => (
                    <li key={j} className="flex gap-2"><span className="site-accent">-</span>{f}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      );

    case "pricingTable": {
      const cols = lines(p.columns);
      return (
        <Section width="regular">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-3 pr-4 font-normal site-subtle text-xs uppercase tracking-wider">&nbsp;</th>
                  {cols.map((c, i) => (
                    <th key={i} className="site-display text-base py-3 px-4 text-center font-normal">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items(p.rows).map((row, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "color-mix(in srgb, var(--s-text) 12%, transparent)" }}>
                    <td className="py-3 pr-4">{s(row.feature)}</td>
                    {s(row.values).split(",").map((v, j) => (
                      <td key={j} className="py-3 px-4 text-center site-subtle">{v.trim() === "✓" ? <span className="site-accent">✓</span> : v.trim()}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {s(p.note) ? <p className="site-subtle text-xs mt-4 text-center">{s(p.note)}</p> : null}
        </Section>
      );
    }

    case "services":
      return (
        <Section>
          <div className={`grid gap-8 ${COLS[s(p.cols, "3")] ?? COLS["3"]}`}>
            {items(p.items).map((it, i) => (
              <div key={i}>
                {s(it.image) ? <img src={s(it.image)} alt={s(it.imageAlt)} className="w-full aspect-[4/3] object-cover mb-4" /> : null}
                <h3 className="site-display text-lg mb-2">{s(it.title)}</h3>
                <Paragraphs text={s(it.body)} className="site-subtle text-sm" />
              </div>
            ))}
          </div>
        </Section>
      );

    case "experienceTimeline":
      return (
        <Section width="narrow">
          <ol className="space-y-10">
            {items(p.items).map((it, i) => (
              <li key={i} className="flex gap-6">
                <span className="site-display site-accent text-2xl w-12 flex-none">{s(it.marker)}</span>
                <div>
                  <h3 className="site-display text-lg mb-1">{s(it.title)}</h3>
                  <Paragraphs text={s(it.body)} className="site-subtle text-sm" />
                </div>
              </li>
            ))}
          </ol>
        </Section>
      );

    case "stats":
      return (
        <Section width="regular">
          <div className="flex flex-wrap justify-center gap-x-16 gap-y-8 text-center">
            {items(p.items).map((it, i) => (
              <div key={i}>
                <p className="site-display text-4xl site-accent">{s(it.value)}</p>
                <p className="site-subtle text-xs tracking-[0.2em] uppercase mt-2">{s(it.label)}</p>
              </div>
            ))}
          </div>
        </Section>
      );

    case "team":
      return (
        <Section>
          <div className={`grid gap-8 ${COLS[s(p.cols, "3")] ?? COLS["3"]}`}>
            {items(p.items).map((it, i) => (
              <div key={i} className="text-center">
                {s(it.image) ? <img src={s(it.image)} alt={s(it.imageAlt)} className="w-40 h-40 rounded-full object-cover mx-auto mb-4" /> : null}
                <h3 className="site-display text-lg">{s(it.name)}</h3>
                <p className="site-accent text-xs tracking-[0.2em] uppercase mt-1">{s(it.role)}</p>
                <Paragraphs text={s(it.bio)} className="site-subtle text-sm mt-2" />
              </div>
            ))}
          </div>
        </Section>
      );

    case "faq":
      return (
        <Section width="narrow">
          {s(p.heading) ? <h3 className="site-display text-2xl mb-6 text-center">{s(p.heading)}</h3> : null}
          <div className="divide-y" style={{ borderColor: "color-mix(in srgb, var(--s-text) 12%, transparent)" }}>
            {items(p.items).map((it, i) => (
              <details key={i} className="py-4 group">
                <summary className="cursor-pointer list-none flex justify-between items-center gap-4">
                  <span className="font-medium">{s(it.q)}</span>
                  <span className="site-accent group-open:rotate-45 transition-transform">+</span>
                </summary>
                <Paragraphs text={s(it.a)} className="site-subtle text-sm mt-3" />
              </details>
            ))}
          </div>
        </Section>
      );

    case "logos":
      return (
        <Section width="regular">
          {s(p.heading) ? <p className="site-subtle text-xs tracking-[0.3em] uppercase text-center mb-5">{s(p.heading)}</p> : null}
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
            {lines(p.names).map((nme, i) => (
              <span key={i} className="site-display text-lg opacity-60">{nme}</span>
            ))}
          </div>
        </Section>
      );

    case "cta":
      return (
        <section className={`px-6 py-14 md:py-20 ${flag(p.tinted, true) ? "site-muted-bg" : ""}`}>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="site-display text-3xl md:text-4xl">{s(p.heading)}</h2>
            {s(p.body) ? <p className="site-subtle mt-4">{s(p.body)}</p> : null}
            {s(p.buttonLabel) ? (
              <Link href={siteHref(ctx.basePath, s(p.buttonLink))} className="site-btn mt-8">{s(p.buttonLabel)}</Link>
            ) : null}
          </div>
        </section>
      );

    case "testimonials":
      return (
        <Section>
          <div className={`grid gap-8 ${COLS[s(p.cols, "2")] ?? COLS["2"]}`}>
            {items(p.items).map((it, i) => (
              <blockquote key={i} className="site-muted-bg p-8">
                <p className="site-display text-lg leading-relaxed">&ldquo;{s(it.quote)}&rdquo;</p>
                <footer className="mt-4 text-xs tracking-[0.15em] uppercase site-subtle">
                  {s(it.name)}{s(it.detail) ? ` · ${s(it.detail)}` : ""}
                </footer>
              </blockquote>
            ))}
          </div>
        </Section>
      );

    case "testimonialSingle":
      return (
        <Section width="regular">
          <div className="text-center">
            {s(p.image) ? <img src={s(p.image)} alt={s(p.imageAlt)} className="w-24 h-24 rounded-full object-cover mx-auto mb-6" /> : null}
            <p className="site-display text-2xl md:text-3xl leading-snug">&ldquo;{s(p.quote)}&rdquo;</p>
            <p className="mt-5 text-xs tracking-[0.2em] uppercase site-subtle">
              {s(p.name)}{s(p.detail) ? ` · ${s(p.detail)}` : ""}
            </p>
          </div>
        </Section>
      );

    case "reviewsWall":
      return (
        <Section>
          <div className="grid gap-6 md:grid-cols-2">
            {items(p.items).map((it, i) => (
              <div key={i} className="border p-6" style={{ borderColor: "color-mix(in srgb, var(--s-text) 15%, transparent)" }}>
                <Stars count={num(it.stars, 5)} />
                <p className="mt-3 leading-relaxed">&ldquo;{s(it.quote)}&rdquo;</p>
                <p className="mt-3 text-xs site-subtle">
                  {s(it.name)}{s(it.source) ? `, via ${s(it.source)}` : ""}
                </p>
              </div>
            ))}
          </div>
        </Section>
      );

    case "instagram": {
      const im = items(p.images).filter((it) => s(it.url));
      return (
        <Section>
          {s(p.handle) ? (
            <p className="text-center mb-5">
              <a href={s(p.url) || "#"} target="_blank" rel="noreferrer" className="site-nav-link">{s(p.handle)} on Instagram</a>
            </p>
          ) : null}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-1">
            {im.slice(0, 6).map((it, i) => (
              <img key={i} src={s(it.url)} alt={s(it.alt)} className="w-full aspect-square object-cover" />
            ))}
          </div>
        </Section>
      );
    }

    case "contactForm":
      return (
        <Section width="regular">
          {s(p.heading) ? <h2 className="site-display text-3xl text-center mb-3">{s(p.heading)}</h2> : null}
          {s(p.intro) ? <p className="site-subtle text-center mb-8 max-w-xl mx-auto">{s(p.intro)}</p> : null}
          <ContactForm siteSlug={ctx.siteSlug} askPhone={flag(p.phone, false)} askSubject={flag(p.subject, true)} buttonLabel={s(p.buttonLabel, "Send message")} success={s(p.success, "Thank you, message received.")} />
        </Section>
      );

    case "bookingEmbed":
      return (
        <Section width="regular">
          <div className="site-muted-bg px-6 py-10 md:px-12">
            {s(p.heading) ? <h2 className="site-display text-2xl text-center mb-3">{s(p.heading)}</h2> : null}
            {s(p.intro) ? <p className="site-subtle text-center mb-8 max-w-xl mx-auto">{s(p.intro)}</p> : null}
            <BookingForm siteSlug={ctx.siteSlug} sessionTypes={lines(p.sessionTypes)} buttonLabel={s(p.buttonLabel, "Request booking")} success={s(p.success, "Request received.")} />
          </div>
        </Section>
      );

    case "newsletter":
      return (
        <section className="site-muted-bg px-6 py-12">
          <div className="max-w-xl mx-auto text-center">
            <h3 className="site-display text-2xl">{s(p.heading, "Join the mailing list")}</h3>
            {s(p.subtext) ? <p className="site-subtle text-sm mt-2 mb-5">{s(p.subtext)}</p> : null}
            <NewsletterForm siteSlug={ctx.siteSlug} buttonLabel={s(p.buttonLabel, "Subscribe")} />
          </div>
        </section>
      );

    case "blogList": {
      const posts = await db.blogPost.findMany({
        where: { websiteId: ctx.websiteId, status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: num(p.count, 3),
      });
      if (posts.length === 0) return null;
      const list = s(p.layout, "grid") === "list";
      return (
        <Section>
          {s(p.heading) ? <h2 className="site-display text-3xl text-center mb-8">{s(p.heading)}</h2> : null}
          {list ? (
            <div className="max-w-3xl mx-auto divide-y" style={{ borderColor: "color-mix(in srgb, var(--s-text) 12%, transparent)" }}>
              {posts.map((post) => (
                <Link key={post.id} href={`${ctx.basePath}/blog/${post.slug}`} className="flex gap-6 py-6 group items-center">
                  {post.coverUrl ? <img src={post.coverUrl} alt={post.coverAlt} className="w-32 h-24 object-cover flex-none" /> : null}
                  <div>
                    <p className="site-subtle text-xs tracking-[0.2em] uppercase">{formatDate(post.publishedAt)}</p>
                    <h3 className="site-display text-xl mt-1 group-hover:underline">{post.title}</h3>
                    {post.excerpt ? <p className="site-subtle text-sm mt-1 line-clamp-2">{post.excerpt}</p> : null}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-3">
              {posts.map((post) => (
                <Link key={post.id} href={`${ctx.basePath}/blog/${post.slug}`} className="group">
                  {post.coverUrl ? (
                    <img src={post.coverUrl} alt={post.coverAlt} className="w-full aspect-[4/3] object-cover mb-4" />
                  ) : (
                    <div className="w-full aspect-[4/3] site-muted-bg mb-4" />
                  )}
                  <p className="site-subtle text-xs tracking-[0.2em] uppercase">{formatDate(post.publishedAt)}</p>
                  <h3 className="site-display text-xl mt-1 group-hover:underline">{post.title}</h3>
                  {post.excerpt ? <p className="site-subtle text-sm mt-2 line-clamp-3">{post.excerpt}</p> : null}
                </Link>
              ))}
            </div>
          )}
        </Section>
      );
    }

    case "clientGalleries": {
      const collections = await db.collection.findMany({
        where: { userId: ctx.userId, status: "PUBLISHED" },
        include: { photos: { where: { isPrivate: false }, orderBy: { order: "asc" }, take: 12 } },
        orderBy: { eventDate: "desc" },
      });
      const live = collections.filter((c) => !isExpired(c.expiresAt));
      return (
        <Section>
          {s(p.heading) ? <h2 className="site-display text-3xl text-center mb-3">{s(p.heading)}</h2> : null}
          {s(p.intro) ? <p className="site-subtle text-center mb-10 max-w-xl mx-auto">{s(p.intro)}</p> : null}
          {live.length === 0 ? (
            <p className="site-subtle text-center">No galleries are currently online. Check back soon, or write to us.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {live.map((c) => {
                const cover = c.photos.find((ph) => ph.id === c.coverPhotoId) ?? c.photos[0];
                return (
                  <Link key={c.id} href={`/g/${c.slug}`} className="group">
                    {flag(p.showCovers, true) && cover ? (
                      <img src={cover.url} alt={`${c.name} gallery cover`} className="w-full aspect-[4/3] object-cover mb-3" />
                    ) : (
                      <div className="w-full aspect-[4/3] site-muted-bg mb-3 flex items-center justify-center site-display text-xl">{c.name.slice(0, 1)}</div>
                    )}
                    <h3 className="site-display text-lg group-hover:underline">{c.name}</h3>
                    <p className="site-subtle text-xs mt-1">
                      {c.eventDate ? formatDate(c.eventDate) : ""}
                      {c.password ? " · password protected" : ""}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </Section>
      );
    }

    case "map":
      return (
        <Section width="regular">
          <div className="grid md:grid-cols-2 gap-0 border" style={{ borderColor: "color-mix(in srgb, var(--s-text) 15%, transparent)" }}>
            <div className="site-muted-bg aspect-[4/3] relative overflow-hidden">
              <svg viewBox="0 0 400 300" className="absolute inset-0 w-full h-full" aria-hidden>
                <rect width="400" height="300" fill="var(--s-muted)" />
                <path d="M0 80 Q 120 60 200 90 T 400 70" stroke="var(--s-subtle)" strokeWidth="6" fill="none" opacity="0.35" />
                <path d="M60 0 Q 80 120 50 300" stroke="var(--s-subtle)" strokeWidth="4" fill="none" opacity="0.3" />
                <path d="M0 190 Q 150 170 260 200 T 400 180" stroke="var(--s-subtle)" strokeWidth="8" fill="none" opacity="0.3" />
                <path d="M300 0 Q 290 150 330 300" stroke="var(--s-subtle)" strokeWidth="4" fill="none" opacity="0.3" />
                <circle cx="200" cy="150" r="10" fill="var(--s-accent)" />
                <circle cx="200" cy="150" r="20" fill="var(--s-accent)" opacity="0.25" />
              </svg>
            </div>
            <div className="p-8 flex flex-col justify-center">
              <h3 className="site-display text-xl mb-2">{s(p.heading, "The studio")}</h3>
              <p className="text-sm">{s(p.address)}</p>
              {s(p.details) ? <Paragraphs text={s(p.details)} className="site-subtle text-sm mt-3" /> : null}
            </div>
          </div>
        </Section>
      );

    case "socialLinks":
      return (
        <Section width="regular">
          <div className="flex flex-wrap justify-center gap-6">
            {items(p.items).map((it, i) => (
              <a key={i} href={s(it.url) || "#"} target="_blank" rel="noreferrer" className="site-nav-link">
                {s(it.label)}
              </a>
            ))}
          </div>
        </Section>
      );

    case "divider": {
      const style = s(p.style, "line");
      return (
        <div className="px-6 py-6">
          {style === "dots" ? (
            <p className="text-center site-subtle tracking-[0.8em]">· · ·</p>
          ) : style === "flourish" ? (
            <p className="text-center site-accent text-lg">❧</p>
          ) : (
            <hr className="max-w-xs mx-auto" style={{ borderColor: "color-mix(in srgb, var(--s-text) 20%, transparent)" }} />
          )}
        </div>
      );
    }

    case "spacer": {
      const size = s(p.size, "medium");
      return <div className={size === "small" ? "h-6" : size === "large" ? "h-28" : "h-14"} />;
    }

    case "button": {
      const variant = s(p.variant, "solid");
      return (
        <Section width="regular">
          <div className={ALIGNS[s(p.align, "center")] ?? "text-center"}>
            {variant === "text" ? (
              <Link href={siteHref(ctx.basePath, s(p.link))} className="site-nav-link underline">{s(p.label)}</Link>
            ) : (
              <Link href={siteHref(ctx.basePath, s(p.link))} className={`site-btn ${variant === "outline" ? "site-btn-outline" : ""}`}>{s(p.label)}</Link>
            )}
          </div>
        </Section>
      );
    }

    default:
      return null;
  }
}

export function RenderBlocks({ blocks, ctx }: { blocks: Block[]; ctx: SiteCtx }) {
  return (
    <>
      {blocks.map((block) => (
        <RenderBlock key={block.id} block={block} ctx={ctx} />
      ))}
    </>
  );
}

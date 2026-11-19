/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { db } from "@/lib/db";
import { Block } from "@/lib/blocks";
import { siteHref } from "@/lib/site-data";
import { formatDate, isExpired } from "@/lib/utils";
import { Slideshow, ContactForm, BookingForm, NewsletterForm } from "./site-client";
import { MiniSessionSlots } from "@/components/mini-session-slots";
import { rt } from "./rich-text";
import { GalleryFinder } from "./site-client";
import { SiteBooking } from "./site-booking";
import { FreeformBlock } from "./freeform";
import { loadSiteBooking } from "@/lib/site-booking";
import { fetchInstagramFeed, instagramTokenFor } from "@/lib/instagram";
import { sanitizeEmbed } from "@/lib/embed";
import { parseDeviceLayouts } from "@/lib/blocks";
import { paletteVars } from "@/lib/site-data";
import { sitePaletteById } from "@/lib/website";

export interface SiteCtx {
  websiteId: string;
  userId: string;
  siteSlug: string;
  basePath: string;
  instagramToken?: string;
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
    <section className={pad ? "site-section" : ""}>
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
            {rt(p)}
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
              {s(p.kicker) ? <p className="text-xs tracking-[0.3em] uppercase mb-4 opacity-90">{rt(s(p.kicker))}</p> : null}
              <h1 className="site-display text-4xl md:text-6xl max-w-3xl">{rt(s(p.heading))}</h1>
              {s(p.subheading) ? <p className="mt-4 max-w-xl text-base md:text-lg opacity-90">{rt(s(p.subheading))}</p> : null}
              {s(p.buttonLabel) ? (
                <Link href={siteHref(ctx.basePath, s(p.buttonLink))} className="site-btn mt-8" style={image ? { background: "#fff", color: "#1a1a1a" } : undefined}>
                  {rt(s(p.buttonLabel))}
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
          {s(p.kicker) ? <p className="text-xs tracking-[0.3em] uppercase site-subtle mb-4">{rt(s(p.kicker))}</p> : null}
          <h1 className="site-display text-3xl md:text-5xl">{rt(s(p.heading))}</h1>
          {s(p.subheading) ? <p className="mt-4 site-subtle max-w-md leading-relaxed">{rt(s(p.subheading))}</p> : null}
          {s(p.buttonLabel) ? (
            <div className="mt-8">
              <Link href={siteHref(ctx.basePath, s(p.buttonLink))} className="site-btn">{rt(s(p.buttonLabel))}</Link>
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
            {s(p.kicker) ? <p className="text-xs tracking-[0.3em] uppercase site-accent mb-3">{rt(s(p.kicker))}</p> : null}
            <h2 className="site-display text-3xl md:text-4xl">{rt(s(p.heading))}</h2>
            {s(p.intro) ? <p className="site-subtle mt-4 max-w-2xl mx-auto leading-relaxed">{rt(s(p.intro))}</p> : null}
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
            <p className="site-display text-2xl md:text-3xl leading-snug">&ldquo;{rt(s(p.quote))}&rdquo;</p>
            {s(p.attribution) ? <footer className="site-subtle text-xs tracking-[0.2em] uppercase mt-4">- {rt(s(p.attribution))}</footer> : null}
          </blockquote>
        </Section>
      );

    case "columnsText":
      return (
        <Section>
          <div className={`grid gap-8 ${COLS[s(p.cols, "2")] ?? COLS["2"]}`}>
            {items(p.items).map((it, i) => (
              <div key={i}>
                <h3 className="site-display text-xl mb-2">{rt(s(it.title))}</h3>
                <Paragraphs text={s(it.body)} className="site-subtle text-sm" />
              </div>
            ))}
          </div>
        </Section>
      );

    case "list":
      return (
        <Section width="regular">
          {s(p.heading) ? <h3 className="site-display text-2xl mb-6 text-center">{rt(s(p.heading))}</h3> : null}
          <ul className={`grid gap-x-10 gap-y-3 ${COLS[s(p.cols, "2")] ?? COLS["2"]}`}>
            {items(p.items).map((it, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="site-accent mt-0.5">✓</span>
                <span>{rt(s(it.text))}</span>
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
          {s(p.caption) ? <p className="site-subtle text-xs tracking-wide text-center mt-3 px-6">{rt(s(p.caption))}</p> : null}
        </Section>
      );
    }

    case "imageText": {
      const imageFirst = s(p.side, "left") === "left";
      const imageEl = s(p.image) ? <img src={s(p.image)} alt={s(p.imageAlt)} className="w-full object-cover aspect-[4/5]" /> : <div className="w-full aspect-[4/5] site-muted-bg" />;
      const textEl = (
        <div className="flex flex-col justify-center">
          {s(p.kicker) ? <p className="text-xs tracking-[0.3em] uppercase site-accent mb-3">{rt(s(p.kicker))}</p> : null}
          <h2 className="site-display text-2xl md:text-3xl mb-4">{rt(s(p.heading))}</h2>
          <Paragraphs text={s(p.body)} className="site-subtle" />
          {s(p.buttonLabel) ? (
            <div className="mt-6">
              <Link href={siteHref(ctx.basePath, s(p.buttonLink))} className="site-btn site-btn-outline">{rt(s(p.buttonLabel))}</Link>
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
                {s(it.caption) ? <figcaption className="site-subtle text-xs mt-2 text-center">{rt(s(it.caption))}</figcaption> : null}
              </figure>
            ))}
          </div>
        </Section>
      );
    }

    case "video": {
      const url = s(p.url);
      const embed = videoEmbedUrl(url);
      const file = !embed && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
      const auto = flag(p.autoplay, false);
      return (
        <Section width={s(p.width, "regular")}>
          {embed ? (
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe src={embed} className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={s(p.caption) || "Video"} />
            </div>
          ) : file ? (
            <video
              src={url}
              poster={s(p.poster) || undefined}
              className="w-full"
              controls={!auto}
              autoPlay={auto}
              muted={auto}
              loop={auto}
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="site-muted-bg aspect-video flex items-center justify-center site-subtle text-sm">Add a YouTube or Vimeo link, or upload a video</div>
          )}
          {s(p.caption) ? <p className="site-subtle text-xs text-center mt-3">{rt(s(p.caption))}</p> : null}
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
          {s(p.caption) ? <p className="site-subtle text-xs text-center mt-3">{rt(s(p.caption))}</p> : null}
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
          {s(p.note) ? <p className="site-subtle text-xs mt-4 text-center">{rt(s(p.note))}</p> : null}
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
                <h3 className="site-display text-lg mb-2">{rt(s(it.title))}</h3>
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
                <span className="site-display site-accent text-2xl w-12 flex-none">{rt(s(it.marker))}</span>
                <div>
                  <h3 className="site-display text-lg mb-1">{rt(s(it.title))}</h3>
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
                <p className="site-display text-4xl site-accent">{rt(s(it.value))}</p>
                <p className="site-subtle text-xs tracking-[0.2em] uppercase mt-2">{rt(s(it.label))}</p>
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
                <h3 className="site-display text-lg">{rt(s(it.name))}</h3>
                <p className="site-accent text-xs tracking-[0.2em] uppercase mt-1">{rt(s(it.role))}</p>
                <Paragraphs text={s(it.bio)} className="site-subtle text-sm mt-2" />
              </div>
            ))}
          </div>
        </Section>
      );

    case "faq":
      return (
        <Section width="narrow">
          {s(p.heading) ? <h3 className="site-display text-2xl mb-6 text-center">{rt(s(p.heading))}</h3> : null}
          <div className="divide-y" style={{ borderColor: "color-mix(in srgb, var(--s-text) 12%, transparent)" }}>
            {items(p.items).map((it, i) => (
              <details key={i} className="py-4 group">
                <summary className="cursor-pointer list-none flex justify-between items-center gap-4">
                  <span className="font-medium">{rt(s(it.q))}</span>
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
          {s(p.heading) ? <p className="site-subtle text-xs tracking-[0.3em] uppercase text-center mb-5">{rt(s(p.heading))}</p> : null}
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
            {lines(p.names).map((nme, i) => (
              <span key={i} className="site-display text-lg opacity-60">{nme}</span>
            ))}
          </div>
        </Section>
      );

    case "cta":
      return (
        <section className={`site-section ${flag(p.tinted, true) ? "site-muted-bg" : ""}`}>
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="site-display text-3xl md:text-4xl">{rt(s(p.heading))}</h2>
            {s(p.body) ? <p className="site-subtle mt-4">{rt(s(p.body))}</p> : null}
            {s(p.buttonLabel) ? (
              <Link href={siteHref(ctx.basePath, s(p.buttonLink))} className="site-btn mt-8">{rt(s(p.buttonLabel))}</Link>
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
                <p className="site-display text-lg leading-relaxed">&ldquo;{rt(s(it.quote))}&rdquo;</p>
                <footer className="mt-4 text-xs tracking-[0.15em] uppercase site-subtle">
                  {rt(s(it.name))}{s(it.detail) ? ` · ${rt(s(it.detail))}` : ""}
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
            <p className="site-display text-2xl md:text-3xl leading-snug">&ldquo;{rt(s(p.quote))}&rdquo;</p>
            <p className="mt-5 text-xs tracking-[0.2em] uppercase site-subtle">
              {rt(s(p.name))}{s(p.detail) ? ` · ${rt(s(p.detail))}` : ""}
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
                <p className="mt-3 leading-relaxed">&ldquo;{rt(s(it.quote))}&rdquo;</p>
                <p className="mt-3 text-xs site-subtle">
                  {rt(s(it.name))}{s(it.source) ? `, via ${rt(s(it.source))}` : ""}
                </p>
              </div>
            ))}
          </div>
        </Section>
      );

    case "instagram": {
      const manual = items(p.images).filter((it) => s(it.url)).map((it) => ({ url: s(it.url), alt: s(it.alt), link: s(p.url) }));
      const count = Math.min(24, num(p.count, 6));
      let shown = manual;
      let handle = s(p.handle);
      let profile = s(p.url);
      const token = s(p.source, "live") === "live" ? instagramTokenFor({ instagramToken: ctx.instagramToken }) : "";
      if (token) {
        const feed = await fetchInstagramFeed(token, count);
        if (feed.connected && feed.posts.length) {
          shown = feed.posts.map((post) => ({ url: post.imageUrl, alt: post.caption.slice(0, 120) || "Instagram post", link: post.permalink }));
          handle = handle || (feed.username ? `@${feed.username}` : "");
          profile = profile || (feed.username ? `https://instagram.com/${feed.username}` : "");
        }
      }
      return (
        <Section>
          {handle ? (
            <p className="text-center mb-5">
              <a href={profile || "#"} target="_blank" rel="noreferrer" className="site-nav-link">{rt(handle)} on Instagram</a>
            </p>
          ) : null}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-1">
            {shown.slice(0, count).map((it, i) => (
              <a key={i} href={it.link || profile || "#"} target="_blank" rel="noreferrer">
                <img src={it.url} alt={it.alt} className="w-full aspect-square object-cover hover:opacity-80 transition-opacity" />
              </a>
            ))}
          </div>
        </Section>
      );
    }

    case "bookingCalendar": {
      const ids = Array.isArray(p.sessionTypeIds) ? (p.sessionTypeIds as unknown[]).map(String) : [];
      const data = await loadSiteBooking(ctx.userId, ids);
      return (
        <Section width="regular">
          {s(p.heading) ? <h2 className="site-display text-3xl text-center mb-3">{rt(s(p.heading))}</h2> : null}
          {s(p.intro) ? <p className="site-subtle text-center mb-8 max-w-xl mx-auto">{rt(s(p.intro))}</p> : null}
          {data ? (
            <SiteBooking data={data} layout={s(p.layout, "cards")} />
          ) : (
            <p className="site-subtle text-center">Online booking is not set up yet. Please use the contact form and we will find a time together.</p>
          )}
        </Section>
      );
    }

    case "freeform":
      return <FreeformBlock props={p} basePath={ctx.basePath} />;

    case "contactForm":
      return (
        <Section width="regular">
          {s(p.heading) ? <h2 className="site-display text-3xl text-center mb-3">{rt(s(p.heading))}</h2> : null}
          {s(p.intro) ? <p className="site-subtle text-center mb-8 max-w-xl mx-auto">{rt(s(p.intro))}</p> : null}
          <ContactForm siteSlug={ctx.siteSlug} askPhone={flag(p.phone, false)} askSubject={flag(p.subject, true)} buttonLabel={s(p.buttonLabel, "Send message")} success={s(p.success, "Thank you, message received.")} />
        </Section>
      );

    case "bookingEmbed":
      return (
        <Section width="regular">
          <div className="site-muted-bg px-6 py-10 md:px-12">
            {s(p.heading) ? <h2 className="site-display text-2xl text-center mb-3">{rt(s(p.heading))}</h2> : null}
            {s(p.intro) ? <p className="site-subtle text-center mb-8 max-w-xl mx-auto">{rt(s(p.intro))}</p> : null}
            <BookingForm siteSlug={ctx.siteSlug} sessionTypes={lines(p.sessionTypes)} buttonLabel={s(p.buttonLabel, "Request booking")} success={s(p.success, "Request received.")} />
          </div>
        </Section>
      );

    case "miniSession":
      return (
        <Section width="regular">
          {s(p.heading) ? <h2 className="site-display text-3xl text-center mb-3">{s(p.heading)}</h2> : null}
          {s(p.intro) ? <p className="site-subtle text-center mb-8 max-w-xl mx-auto">{s(p.intro)}</p> : null}
          <MiniSessionSlots userId={ctx.userId} nameFilter={s(p.miniName).trim()} showHeader={flag(p.showDetails, true)} />
        </Section>
      );

    case "newsletter":
      return (
        <section className="site-muted-bg site-section">
          <div className="max-w-xl mx-auto text-center">
            <h3 className="site-display text-2xl">{rt(s(p.heading, "Join the mailing list"))}</h3>
            {s(p.subtext) ? <p className="site-subtle text-sm mt-2 mb-5">{rt(s(p.subtext))}</p> : null}
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
          {s(p.heading) ? <h2 className="site-display text-3xl text-center mb-8">{rt(s(p.heading))}</h2> : null}
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
      // Auto synced: queried at render time, so newly published galleries
      // appear without editing the page. Each card links to /g/<slug>, which
      // enforces that gallery's own password, email registration or
      // pre-release sign up.
      const which = s(p.which, "all");
      const statuses = flag(p.showPrerelease, false) ? ["PUBLISHED", "PRERELEASE"] : ["PUBLISHED"];
      const chosen = lines(p.slugs);
      const sort = s(p.sort, "eventDate");
      const collections = await db.collection.findMany({
        where: {
          userId: ctx.userId,
          status: { in: statuses },
          ...(which === "homepage" ? { showOnHomepage: true } : {}),
          ...(which === "chosen" ? { slug: { in: chosen.length ? chosen : ["__none__"] } } : {}),
        },
        include: { photos: { where: { isPrivate: false }, orderBy: { order: "asc" }, take: 12 } },
        orderBy: sort === "name" ? { name: "asc" } : sort === "created" ? { createdAt: "desc" } : { eventDate: "desc" },
      });
      const live = collections.filter((c) => !isExpired(c.expiresAt)).slice(0, Math.min(200, num(p.count, 24)));
      const list = live.map((c) => {
        const cover = c.photos.find((ph) => ph.id === c.coverPhotoId) ?? c.photos[0];
        const gates: string[] = [];
        if (c.status === "PRERELEASE") gates.push("coming soon, register for launch");
        if (c.password) gates.push("password protected");
        if (c.emailRegistration) gates.push("email sign in");
        return {
          id: c.id,
          name: c.name,
          href: `/g/${c.slug}`,
          cover: flag(p.showCovers, true) ? c.coverImageUrl || cover?.url || "" : "",
          date: c.eventDate ? formatDate(c.eventDate) : "",
          gates,
        };
      });
      return (
        <Section>
          {s(p.heading) ? <h2 className="site-display text-3xl text-center mb-3">{rt(s(p.heading))}</h2> : null}
          {s(p.intro) ? <p className="site-subtle text-center mb-10 max-w-xl mx-auto">{rt(s(p.intro))}</p> : null}
          {list.length === 0 ? (
            <p className="site-subtle text-center">No galleries are currently online. Check back soon, or write to us.</p>
          ) : (
            <GalleryFinder galleries={list} cols={s(p.cols, "3")} search={flag(p.search, true) && list.length > 3} />
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
              <h3 className="site-display text-xl mb-2">{rt(s(p.heading, "The studio"))}</h3>
              <p className="text-sm">{rt(s(p.address))}</p>
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
                {rt(s(it.label))}
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
              <Link href={siteHref(ctx.basePath, s(p.link))} className="site-nav-link underline site-arrow">{rt(s(p.label))}</Link>
            ) : (
              <Link href={siteHref(ctx.basePath, s(p.link))} className={`site-btn ${variant === "outline" ? "site-btn-outline" : ""}`}>{rt(s(p.label))}</Link>
            )}
          </div>
        </Section>
      );
    }

    case "embed": {
      // Night build (Website): custom embed code, sanitised server side to
      // https iframes only (scripts and other tags never reach the page).
      const embeds = sanitizeEmbed(s(p.code));
      if (embeds.length === 0) return null;
      const ratio = s(p.ratio, "16:9");
      const aspect = ratio === "4:3" ? "4 / 3" : ratio === "1:1" ? "1 / 1" : "16 / 9";
      return (
        <Section width={s(p.width, "wide")}>
          <div className="space-y-6">
            {embeds.map((e, i) =>
              ratio === "fixed" ? (
                <div key={i} className="flex justify-center overflow-x-auto">
                  <iframe
                    src={e.src}
                    title={s(p.title) || e.title}
                    width={e.width ?? 800}
                    height={e.height ?? 450}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    style={{ border: 0, maxWidth: "100%" }}
                  />
                </div>
              ) : (
                <div key={i} className="relative w-full overflow-hidden" style={{ aspectRatio: aspect }}>
                  <iframe
                    src={e.src}
                    title={s(p.title) || e.title}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                    style={{ border: 0 }}
                  />
                </div>
              )
            )}
          </div>
        </Section>
      );
    }

    case "linkList": {
      // Night build (Website): bio link list for link-in-bio pages.
      const links = items(p.links).filter((l) => s(l.label) && s(l.url));
      const style = s(p.style, "pill");
      return (
        <Section width="narrow">
          <div className="mx-auto max-w-md text-center">
            {s(p.avatar) ? (
              <img src={s(p.avatar)} alt={s(p.avatarAlt)} className="mx-auto h-24 w-24 rounded-full object-cover" />
            ) : null}
            {s(p.heading) ? <h1 className="site-display text-3xl mt-5">{rt(s(p.heading))}</h1> : null}
            {s(p.subtext) ? <p className="site-subtle mt-2 leading-relaxed">{rt(s(p.subtext))}</p> : null}
            <div className="mt-8 space-y-3">
              {links.map((l, i) =>
                style === "cards" ? (
                  <a
                    key={i}
                    href={siteHref(ctx.basePath, s(l.url))}
                    {...(s(l.url).startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="block border px-5 py-4 text-left transition-opacity hover:opacity-80"
                    style={{ borderColor: "color-mix(in srgb, var(--s-text) 18%, transparent)", borderRadius: "var(--s-radius, 2px)" }}
                  >
                    <span className="block font-medium">{rt(s(l.label))}</span>
                    {s(l.note) ? <span className="site-subtle block text-sm mt-0.5">{rt(s(l.note))}</span> : null}
                  </a>
                ) : (
                  <a
                    key={i}
                    href={siteHref(ctx.basePath, s(l.url))}
                    {...(s(l.url).startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="site-btn w-full"
                  >
                    {rt(s(l.label))}
                  </a>
                )
              )}
            </div>
          </div>
        </Section>
      );
    }

    default:
      return null;
  }
}

// Phase 5B: every block can carry its own palette, an anchor id, a width and
// a minimum height (set from the editor's block settings and resize handles).
// Night build: per device overrides (props._dev) switch width and minimum
// height at the tablet and mobile breakpoints, or hide the block there.
function BlockFrame({ block, children }: { block: Block; children: React.ReactNode }) {
  const p = block.props;
  const palette = s(p._palette);
  const anchor = s(p._anchor).replace(/[^a-zA-Z0-9_-]/g, "");
  const width = Math.min(100, Math.max(20, num(p._width, 100)));
  const minHeight = Math.max(0, Math.min(2000, Number(p._minHeight) || 0));
  const dev = parseDeviceLayouts(p._dev);
  const hasDev = !!(dev.tablet || dev.mobile);
  if (!palette && !anchor && width === 100 && !minHeight && !hasDev) return <>{children}</>;
  const style: React.CSSProperties = {};
  if (palette) {
    Object.assign(style, paletteVars(palette), { background: sitePaletteById(palette).bg, color: sitePaletteById(palette).text });
  }
  const t = dev.tablet;
  const m = dev.mobile;
  const anyMinHeight = minHeight || t?.minHeight || m?.minHeight;
  if (anyMinHeight) {
    Object.assign(style, {
      "--bmh": `${minHeight}px`,
      ...(t?.minHeight ? { "--bmh-t": `${t.minHeight}px` } : {}),
      ...(m?.minHeight ? { "--bmh-m": `${m.minHeight}px` } : {}),
    });
  }
  const classes = [
    "blk-frame",
    anchor ? "scroll-mt-6" : "",
    anyMinHeight ? "has-bmh" : "",
    t?.hidden ? "dev-hide-tablet" : "",
    m?.hidden ? "dev-hide-mobile" : "",
  ].filter(Boolean).join(" ");
  const innerStyle: React.CSSProperties = {
    "--bw": `${width}%`,
    ...(t?.width ? { "--bw-t": `${t.width}%` } : {}),
    ...(m?.width ? { "--bw-m": `${m.width}%` } : {}),
  } as React.CSSProperties;
  const needsInner = width < 100 || t?.width || m?.width;
  return (
    <div id={anchor || undefined} style={style} className={classes}>
      {needsInner ? <div className="blk-inner" style={innerStyle}>{children}</div> : children}
    </div>
  );
}

export function RenderBlocks({ blocks, ctx }: { blocks: Block[]; ctx: SiteCtx }) {
  return (
    <>
      {blocks.map((block) => (
        <BlockFrame key={block.id} block={block}>
          <RenderBlock block={block} ctx={ctx} />
        </BlockFrame>
      ))}
    </>
  );
}

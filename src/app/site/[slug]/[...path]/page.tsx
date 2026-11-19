/* eslint-disable @next/next/no-img-element */
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSiteBySlug } from "@/lib/site-data";
import { SiteShell, SitePageBlocks } from "@/components/site/page-shell";
import { formatDate } from "@/lib/utils";
import { findRedirect } from "@/lib/site-redirects";
import { siteExt } from "@/lib/site-ext";
import { readSiteGate } from "@/lib/site-gate";
import { GateScreen } from "@/components/site/gate-screen";

export const dynamic = "force-dynamic";

async function resolve(slug: string, path: string[]) {
  const site = await getSiteBySlug(slug);
  if (!site) return null;
  const joined = `/${path.join("/")}`;

  // 301 redirects are answered by src/middleware.ts with a literal 301. This
  // fallback only runs if the middleware lookup was unavailable.
  const redirect = await findRedirect(site.website.id, joined);
  if (redirect) {
    const target = redirect.toPath.startsWith("http") ? redirect.toPath : `${site.basePath}${redirect.toPath === "/" ? "" : redirect.toPath}` || "/";
    return { kind: "redirect" as const, target };
  }

  // Blog post: /blog/<postSlug>
  if (path.length === 2 && path[0] === "blog") {
    const post = await db.blogPost.findUnique({
      where: { websiteId_slug: { websiteId: site.website.id, slug: path[1] } },
    });
    if (post && (post.status === "PUBLISHED" || site.isOwner)) {
      return { kind: "post" as const, site, post };
    }
    return null;
  }

  if (path.length !== 1) return null;
  const page = site.website.pages.find((p) => p.slug === path[0]);
  if (!page) return null;
  return { kind: "page" as const, site, page };
}

export async function generateMetadata({ params }: { params: { slug: string; path: string[] } }): Promise<Metadata> {
  const res = await resolve(params.slug, params.path);
  if (!res || res.kind === "redirect") return {};
  const siteName = res.site.website.logoText || res.site.website.slug;
  if (res.kind === "post") {
    return {
      title: res.post.seoTitle || `${res.post.title}, ${siteName}`,
      description: res.post.seoDescription || res.post.excerpt || undefined,
    };
  }
  return {
    title: res.page.seoTitle || `${res.page.title}, ${siteName}`,
    description: res.page.seoDescription || undefined,
  };
}

function PostBody({ body }: { body: string }) {
  const chunks = body.split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean);
  return (
    <div className="space-y-5">
      {chunks.map((chunk, i) => {
        if (chunk.startsWith("## ")) {
          return <h2 key={i} className="site-display text-2xl mt-8">{chunk.slice(3)}</h2>;
        }
        if (chunk.startsWith("> ")) {
          return (
            <blockquote key={i} className="border-l-2 pl-4 site-display text-xl" style={{ borderColor: "var(--s-accent)" }}>
              {chunk.replace(/^> ?/gm, "")}
            </blockquote>
          );
        }
        return <p key={i} className="leading-relaxed">{chunk}</p>;
      })}
    </div>
  );
}

export default async function SiteSubPage({ params }: { params: { slug: string; path: string[] } }) {
  const res = await resolve(params.slug, params.path);
  if (!res) notFound();
  if (res.kind === "redirect") permanentRedirect(res.target);

  const { website, isOwner, draftMode, basePath } = res.site;

  // Night build: password gates (owner is never gated). A site unlock also
  // opens its pages; a page password only opens that page.
  if (!isOwner) {
    const ext = siteExt(website);
    const gate = readSiteGate(website.id);
    if (ext.sitePassword && !gate.site) {
      return <GateScreen website={website} label="This site is private" />;
    }
    if (res.kind === "page") {
      const pagePassword = String((res.page as unknown as Record<string, unknown>).password ?? "");
      if (pagePassword && !gate.site && !gate.pages.includes(res.page.id)) {
        return <GateScreen website={website} pageId={res.page.id} label="This page is private" />;
      }
    }
  }

  if (res.kind === "post") {
    const post = res.post;
    return (
      <SiteShell website={website} isOwner={isOwner} draftMode={draftMode} basePath={basePath} activeSlug="blog">
        <article className="px-6 py-12">
          <div className="max-w-2xl mx-auto">
            {post.status !== "PUBLISHED" ? (
              <p className="text-xs uppercase tracking-widest site-accent mb-4">Draft, only you can see this</p>
            ) : null}
            <p className="site-subtle text-xs tracking-[0.25em] uppercase">{formatDate(post.publishedAt ?? post.createdAt)}</p>
            <h1 className="site-display text-3xl md:text-5xl mt-3">{post.title}</h1>
            {post.excerpt ? <p className="site-subtle mt-4 text-lg">{post.excerpt}</p> : null}
            {post.coverUrl ? <img src={post.coverUrl} alt={post.coverAlt} className="w-full my-8" /> : <div className="my-8" />}
            <PostBody body={post.body} />
            <p className="mt-12">
              <Link href={`${basePath}/blog`} className="site-nav-link">← Back to the journal</Link>
            </p>
          </div>
        </article>
      </SiteShell>
    );
  }

  return (
    <SiteShell website={website} isOwner={isOwner} draftMode={draftMode} basePath={basePath} activeSlug={res.page.slug}>
      <SitePageBlocks website={website} page={res.page} basePath={basePath} />
    </SiteShell>
  );
}

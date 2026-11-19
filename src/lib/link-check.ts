import { stat } from "fs/promises";
import path from "path";
import { db } from "./db";
import { parseBlocks } from "./blocks";
import { b2Enabled, headSize, keyFromStoredUrl } from "./storage";

// Phase 5B platform: broken link checker for the website (SEO tab). Walks every
// block of every page and the body of every blog post, collects links and
// images, and tests each one for real: internal paths are resolved against the
// site's pages, posts, redirects, uploaded files and public app routes;
// external URLs get a live HEAD (falling back to GET) request with a timeout.

export interface LinkResult {
  url: string;
  kind: "link" | "image";
  where: string; // page or post title
  ok: boolean;
  status: string; // "200", "404", "timeout", "missing page" ...
}

const LINK_KEY = /(link|url|href|src|image|cover|poster|logo)$/i;
const IMAGE_KEY = /(image|url|src|cover|poster|logo)$/i;

function walk(value: unknown, key: string, out: { url: string; kind: "link" | "image" }[]) {
  if (typeof value === "string") {
    const v = value.trim();
    if (!v || !LINK_KEY.test(key)) return;
    if (!/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(v)) return;
    const isImage = IMAGE_KEY.test(key) && !/link$/i.test(key) && /\.(jpe?g|png|gif|webp|svg|avif)(\?|$)|\/uploads\/|^\/api\/(placeholder|wm|preview)/i.test(v);
    out.push({ url: v, kind: isImage ? "image" : "link" });
    return;
  }
  if (Array.isArray(value)) value.forEach((v) => walk(v, key, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, k, out);
}

function linksInText(text: string): string[] {
  const out = new Set<string>();
  for (const m of Array.from(text.matchAll(/\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g))) out.add(m[1]);
  for (const m of Array.from(text.matchAll(/href=["']([^"']+)["']/g))) out.add(m[1]);
  for (const m of Array.from(text.matchAll(/(?<![("'=])\bhttps?:\/\/[^\s<>"')\]]+/g))) out.add(m[0]);
  return Array.from(out);
}

async function checkExternal(url: string): Promise<{ ok: boolean; status: string }> {
  const attempt = async (method: "HEAD" | "GET") => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(url, { method, redirect: "follow", signal: ctrl.signal, headers: { "user-agent": "PixoraLinkChecker/1.0" } });
      return res.status;
    } finally {
      clearTimeout(t);
    }
  };
  try {
    let status = await attempt("HEAD");
    if (status === 405 || status === 403 || status === 501) status = await attempt("GET");
    return { ok: status < 400, status: String(status) };
  } catch (e) {
    const msg = (e as Error).name === "AbortError" ? "timeout" : "unreachable";
    return { ok: false, status: msg };
  }
}

export async function checkWebsiteLinks(websiteId: string, origin = ""): Promise<{ checked: number; broken: number; results: LinkResult[] }> {
  const site = await db.website.findUnique({
    where: { id: websiteId },
    include: { pages: true, posts: true, redirects: true },
  });
  if (!site) return { checked: 0, broken: 0, results: [] };
  const pageSlugs = new Set(site.pages.map((p) => p.slug.replace(/^\/+|\/+$/g, "").toLowerCase()));
  const postSlugs = new Set(site.posts.filter((p) => p.status === "PUBLISHED").map((p) => p.slug.toLowerCase()));
  const redirectFrom = new Set(site.redirects.map((r) => r.fromPath.replace(/\/+$/, "").toLowerCase()));

  const found: { url: string; kind: "link" | "image"; where: string }[] = [];
  for (const p of site.pages) {
    const out: { url: string; kind: "link" | "image" }[] = [];
    for (const b of parseBlocks(p.blocks)) walk(b.props, "", out);
    found.push(...out.map((o) => ({ ...o, where: p.title })));
  }
  for (const post of site.posts) {
    for (const u of linksInText(post.body)) found.push({ url: u, kind: "link", where: `Blog: ${post.title}` });
    if (post.coverUrl) found.push({ url: post.coverUrl, kind: "image", where: `Blog: ${post.title}` });
  }

  const cache = new Map<string, { ok: boolean; status: string }>();
  async function check(url: string): Promise<{ ok: boolean; status: string }> {
    if (cache.has(url)) return cache.get(url)!;
    let r: { ok: boolean; status: string };
    if (/^(mailto:|tel:|#)/i.test(url)) r = { ok: true, status: "skipped" };
    else if (/^https?:\/\//i.test(url)) r = await checkExternal(url);
    else r = await checkInternal(url);
    cache.set(url, r);
    return r;
  }
  async function checkInternal(raw: string): Promise<{ ok: boolean; status: string }> {
    const p = raw.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
    const lower = p.toLowerCase();
    if (lower.startsWith("/uploads/") || lower.startsWith("/media/")) {
      const key = keyFromStoredUrl(decodeURIComponent(p));
      try {
        await stat(path.join(process.cwd(), "public", key ?? decodeURIComponent(p)));
        return { ok: true, status: "file" };
      } catch {}
      if (key && b2Enabled() && (await headSize(key)) !== null) return { ok: true, status: "file" };
      return { ok: false, status: "missing file" };
    }
    const g = lower.match(/^\/g\/([^/]+)/);
    if (g) return (await db.collection.findUnique({ where: { slug: g[1] } })) ? { ok: true, status: "gallery" } : { ok: false, status: "missing gallery" };
    const book = lower.match(/^\/book\/([^/]+)/);
    if (book) return (await db.studioProfile.findUnique({ where: { bookingSlug: book[1] } })) ? { ok: true, status: "booking page" } : { ok: false, status: "missing booking page" };
    const own = lower.replace(new RegExp(`^/site/${site!.slug}`), "") || "/";
    if (redirectFrom.has(own)) return { ok: true, status: "redirect" };
    const slug = own.replace(/^\/+/, "");
    if (pageSlugs.has(slug)) return { ok: true, status: "page" };
    const blog = slug.match(/^blog\/([^/]+)$/);
    if (blog) return postSlugs.has(blog[1]) ? { ok: true, status: "post" } : { ok: false, status: "missing post" };
    // Anything else under the app (images from /api/placeholder, /pay, /gh ...) is fetched for real.
    if (origin && !/^\/site\//.test(lower)) {
      const r = await checkExternal(`${origin}${raw}`);
      return r.ok ? { ok: true, status: `app ${r.status}` } : { ok: false, status: r.status === "404" ? "missing page" : r.status };
    }
    return { ok: false, status: "missing page" };
  }

  const results: LinkResult[] = [];
  const queue = [...found];
  // a few requests in parallel keeps the check quick without hammering hosts
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        const r = await check(item.url);
        results.push({ ...item, ...r });
      }
    })
  );
  results.sort((a, b) => Number(a.ok) - Number(b.ok) || a.where.localeCompare(b.where));
  return { checked: results.length, broken: results.filter((r) => !r.ok).length, results };
}

import { NextRequest, NextResponse } from "next/server";

// Phase 5B website routing (owned by the Website section):
//  1. Literal 301 responses for website redirects (/site/<slug>/<old-path>).
//  2. Host based routing: <slug>.<SITE_ROOT_DOMAIN> and VERIFIED custom
//     domains are rewritten to /site/<slug>/... with clean URLs.
// Edge middleware cannot run Prisma, so it asks /api/site/route (cached briefly).

const SHARED_PATHS = /^\/(_next|api|uploads|g|book|pay|sign|quote|d|app|login|signup|favicon\.ico|robots\.txt)(\/|$)/;
const cache = new Map<string, { exp: number; data: RouteAnswer }>();
type RouteAnswer = { action: "none" | "redirect" | "rewrite"; location?: string; path?: string; status?: number };

function isAppHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.startsWith("[") || h.endsWith(".local")) return true;
  const root = (process.env.SITE_ROOT_DOMAIN || "mypixelset.com").toLowerCase();
  if (h === root || h === `www.${root}` || h === `app.${root}`) return true;
  const extra = (process.env.APP_HOSTS || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  return extra.includes(h);
}

async function ask(req: NextRequest, params: Record<string, string>): Promise<RouteAnswer> {
  const key = JSON.stringify(params);
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.data;
  const port = req.nextUrl.port || (req.nextUrl.protocol === "https:" ? "443" : "80");
  const origin = process.env.INTERNAL_ORIGIN || `http://127.0.0.1:${port}`;
  try {
    const res = await fetch(`${origin}/api/site/route?${new URLSearchParams(params)}`, { cache: "no-store" });
    const data = (await res.json()) as RouteAnswer;
    if (cache.size > 500) cache.clear();
    cache.set(key, { exp: Date.now() + 10_000, data });
    return data;
  } catch {
    return { action: "none" };
  }
}

export async function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").replace(/:\d+$/, "");
  const path = req.nextUrl.pathname;

  if (isAppHost(host)) {
    if (/^\/site\/[^/]+\/.+/.test(path) && !path.endsWith("/sitemap.xml")) {
      const ans = await ask(req, { mode: "path", path });
      if (ans.action === "redirect" && ans.location) {
        const to = new URL(ans.location, req.url);
        if (!/^https?:/i.test(ans.location)) to.search = req.nextUrl.search;
        return NextResponse.redirect(to, 301);
      }
    }
    return NextResponse.next();
  }

  if (SHARED_PATHS.test(path)) return NextResponse.next();
  const ans = await ask(req, { mode: "host", host, path });
  if (ans.action === "redirect" && ans.location) {
    const to = /^https?:/i.test(ans.location) ? new URL(ans.location) : new URL(`${ans.location}${req.nextUrl.search}`, `${req.nextUrl.protocol}//${req.headers.get("host")}`);
    return NextResponse.redirect(to, 301);
  }
  if (ans.action === "rewrite" && ans.path) {
    const url = req.nextUrl.clone();
    url.pathname = ans.path;
    const headers = new Headers(req.headers);
    headers.set("x-pixelset-site-host", "1");
    return NextResponse.rewrite(url, { request: { headers } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

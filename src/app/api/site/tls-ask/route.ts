import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeDomain, siteRootDomain } from "@/lib/site-domains";

export const dynamic = "force-dynamic";

// On-demand TLS permission check (Caddy "on_demand_tls { ask ... }").
// Returns 200 only for hosts this app will actually serve: a free subdomain
// of an existing website, or a VERIFIED custom domain. Anything else is 404,
// so the TLS host never requests certificates for random names.
export async function GET(req: NextRequest) {
  const domain = normalizeDomain(req.nextUrl.searchParams.get("domain") || "");
  if (!domain) return new NextResponse("missing domain", { status: 400 });
  const root = siteRootDomain();
  if (domain === root || domain === `www.${root}` || domain === `app.${root}`) return new NextResponse("ok");
  if (domain.endsWith(`.${root}`)) {
    const sub = domain.slice(0, -(root.length + 1));
    const site = sub.includes(".") ? null : await db.website.findUnique({ where: { slug: sub }, select: { id: true } });
    return site ? new NextResponse("ok") : new NextResponse("unknown subdomain", { status: 404 });
  }
  const rows = await db.website.findMany({ where: { domainStatus: "VERIFIED" }, select: { customDomain: true } });
  const bare = domain.startsWith("www.") ? domain.slice(4) : domain;
  const ok = rows.some((r) => {
    const d = normalizeDomain(r.customDomain);
    return d === domain || d === bare || d === `www.${bare}`;
  });
  return ok ? new NextResponse("ok") : new NextResponse("domain not verified", { status: 404 });
}

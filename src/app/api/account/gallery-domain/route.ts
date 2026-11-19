import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { checkDomainDns, isValidDomain, normalizeDomain } from "@/lib/site-domains";
import { galleryDomainToken } from "@/lib/gallery-domain";
import { GALLERY_LIMITS, parsePlan, tierLabel } from "@/lib/plans";

// Phase 5B platform: connect a custom domain to the gallery homepage. The
// photographer points a CNAME at SITE_CNAME_TARGET (or adds the TXT record);
// a real DNS lookup verifies it and only VERIFIED domains are routed.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const domain = normalizeDomain(typeof body.domain === "string" ? body.domain : user.galleryDomain);
  if (!domain) {
    await db.user.update({ where: { id: user.id }, data: { galleryDomain: "", galleryDomainStatus: "NONE", galleryDomainNote: "" } });
    return NextResponse.json({ ok: true, status: "NONE" });
  }
  const plan = parsePlan(user.plan);
  if (!GALLERY_LIMITS[plan.gallery].customDomain) {
    return NextResponse.json({ error: `A gallery custom domain needs Client Gallery Basic or higher (your plan is ${tierLabel("gallery", plan.gallery)}).` }, { status: 403 });
  }
  if (!isValidDomain(domain)) return NextResponse.json({ error: "Enter a domain like galleries.yourstudio.com" }, { status: 400 });
  const site = await db.website.findFirst({ where: { customDomain: domain } });
  const clash = await db.user.findFirst({ where: { galleryDomain: domain, NOT: { id: user.id } } });
  if (site || clash) return NextResponse.json({ error: "That domain is already connected elsewhere" }, { status: 409 });
  const check = await checkDomainDns(domain, galleryDomainToken(user.id));
  const status = check.verified ? "VERIFIED" : "PENDING";
  await db.user.update({ where: { id: user.id }, data: { galleryDomain: domain, galleryDomainStatus: status, galleryDomainNote: check.note } });
  return NextResponse.json({ ok: true, status, note: check.note });
}

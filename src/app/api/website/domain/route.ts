import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { db } from "@/lib/db";
import { checkDomainDns, isValidDomain, newDomainToken, normalizeDomain } from "@/lib/site-domains";
import { WEBSITE_LIMITS, planFor, tierLabel } from "@/lib/plans";

async function own() {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.website.findUnique({ where: { userId: user.id } });
}

// POST { action: "connect", domain } | { action: "verify" } | { action: "remove" }
export async function POST(req: NextRequest) {
  const website = await own();
  if (!website) return NextResponse.json({ error: "No website" }, { status: 404 });
  const denied = await permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  if (body.action === "remove") {
    await db.website.update({
      where: { id: website.id },
      data: { customDomain: "", domainStatus: "NONE", domainToken: "", domainCheckedAt: null, domainNote: "" },
    });
    return NextResponse.json({ ok: true, status: "NONE" });
  }

  let domain = website.customDomain;
  let token = website.domainToken;
  if (body.action === "connect") {
    // Night build (Pricing lane): a custom domain needs Website Plus or Pro.
    const plan = await planFor(website.userId);
    if (!WEBSITE_LIMITS[plan.website].customDomain) {
      return NextResponse.json(
        { error: `A custom domain needs the Website Plus plan or higher (your plan is ${tierLabel("website", plan.website)}). Upgrade in Settings > Plan.` },
        { status: 403 },
      );
    }
    domain = normalizeDomain(String(body.domain ?? ""));
    if (!isValidDomain(domain)) return NextResponse.json({ error: "Enter a domain like www.yourstudio.com" }, { status: 400 });
    const taken = await db.website.findFirst({ where: { customDomain: domain, id: { not: website.id } } });
    if (taken) return NextResponse.json({ error: "That domain is connected to another site" }, { status: 400 });
    if (domain !== website.customDomain || !token) token = newDomainToken();
  }
  if (!domain) return NextResponse.json({ error: "Add a domain first" }, { status: 400 });

  const check = await checkDomainDns(domain, token);
  const status = check.verified ? "VERIFIED" : body.action === "connect" ? "PENDING" : website.domainStatus === "VERIFIED" ? "FAILED" : "PENDING";
  const updated = await db.website.update({
    where: { id: website.id },
    data: { customDomain: domain, domainToken: token, domainStatus: status, domainCheckedAt: new Date(), domainNote: check.note },
  });
  return NextResponse.json({
    ok: true,
    domain: updated.customDomain,
    status: updated.domainStatus,
    note: updated.domainNote,
    token: updated.domainToken,
    records: { cname: check.cname, a: check.a, txt: check.txt },
  });
}

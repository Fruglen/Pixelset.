import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { createWebsiteForUser } from "@/lib/site-service";
import { DEFAULT_BILLING, serializePlan } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const { name, businessName, email, password } = await req.json();
  if (typeof email !== "string" || typeof password !== "string" || typeof name !== "string") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  const normalized = email.toLowerCase().trim();
  const existing = await db.user.findUnique({ where: { email: normalized } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }
  const user = await db.user.create({
    data: {
      email: normalized,
      name: name.trim(),
      businessName: typeof businessName === "string" ? businessName.trim() : "",
      watermarkText: typeof businessName === "string" && businessName.trim() ? businessName.trim() : name.trim(),
      passwordHash: hashPassword(password),
      // Night build (Pricing lane): new accounts start on the Free plans, so
      // the researched caps and paywall unlocks are real from day one. The
      // seeded demo account keeps its top tiers.
      plan: serializePlan({ gallery: "free", website: "free", studio: "free", billing: DEFAULT_BILLING, security: { ipAllowlist: [] } }),
    },
  });
  // Phase 5B platform: sign up issues a free subdomain right away. A starter
  // website (default template, published) reserves <slug>.<SITE_ROOT_DOMAIN>,
  // which the host based routing in src/middleware.ts serves. The website setup
  // checklist then asks the photographer to pick their template.
  let subdomain = "";
  try {
    const label = (typeof businessName === "string" && businessName.trim()) || name.trim();
    const site = await createWebsiteForUser(user.id, { slug: label, templateId: "vienna", logoText: label });
    subdomain = site.slug;
    await db.website.update({ where: { id: site.id }, data: { templateChosen: false } });
  } catch {
    // the account still works without a site; the Website area offers to create one
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true, subdomain });
}

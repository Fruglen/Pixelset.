import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { planSwitchAllowed } from "@/lib/billing";
import { GALLERY_TIERS, STUDIO_TIERS, WEBSITE_TIERS, parsePlan, serializePlan } from "@/lib/plans";

// Phase 5B platform: switch the simulated plan for demos and testing. No
// charge is made, so in production this is refused unless the operator sets
// ALLOW_PLAN_SWITCH=1. Paid tiers otherwise come only from verified Stripe
// Checkout (see lib/billing.ts).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ plan: parsePlan(user.plan) });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!planSwitchAllowed()) {
    return NextResponse.json({ error: "Plan changes are not available on this server." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const plan = parsePlan(user.plan);
  if (GALLERY_TIERS.includes(body.gallery)) plan.gallery = body.gallery;
  if (WEBSITE_TIERS.includes(body.website)) plan.website = body.website;
  if (STUDIO_TIERS.includes(body.studio)) plan.studio = body.studio;
  await db.user.update({ where: { id: user.id }, data: { plan: serializePlan(plan) } });
  return NextResponse.json({ ok: true, plan });
}

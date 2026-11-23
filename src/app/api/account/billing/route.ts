import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import {
  cancelSubscription,
  getBillingState,
  previewChange,
  reactivateSubscription,
  setAddOn,
  setAutoRenew,
  setVolume,
  stripeBillingConnected,
  subscribeOrChange,
  TierSet,
  UnpaidChangeError,
} from "@/lib/billing";
import {
  GALLERY_TIERS,
  STUDIO_TIERS,
  WEBSITE_TIERS,
  addOnsMonthlyCents,
  planSetPriceCents,
} from "@/lib/plans";

// Night build (Pricing lane): plan subscription billing. Parked by the
// owner's order: without STRIPE_SECRET_KEY, subscribing is refused and tiers
// do not change; with a key, subscriptions go through real Stripe Checkout.

function tierSet(body: Record<string, unknown>, fallback: TierSet): TierSet {
  return {
    gallery: GALLERY_TIERS.includes(body.gallery as never) ? (body.gallery as TierSet["gallery"]) : fallback.gallery,
    website: WEBSITE_TIERS.includes(body.website as never) ? (body.website as TierSet["website"]) : fallback.website,
    studio: STUDIO_TIERS.includes(body.studio as never) ? (body.studio as TierSet["studio"]) : fallback.studio,
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await getBillingState(user.id);
  if (!state) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  return NextResponse.json({
    tiers: { gallery: state.gallery, website: state.website, studio: state.studio },
    billing: state.billing,
    priceCents: planSetPriceCents(state, state.billing.cycle),
    addOnsMonthlyCents: addOnsMonthlyCents(state.billing),
    stripeConnected: stripeBillingConnected(),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  try {
    if (action === "preview" || action === "subscribe") {
      const state = await getBillingState(user.id);
      if (!state) return NextResponse.json({ error: "Account not found" }, { status: 404 });
      const target = tierSet(body, state);
      const cycle = body.cycle === "monthly" ? "monthly" : "annual";
      if (action === "preview") {
        return NextResponse.json({ preview: previewChange(state, target, cycle) });
      }
      if (!stripeBillingConnected()) {
        return NextResponse.json({ error: "Payments are not enabled on this server." }, { status: 503 });
      }
      const origin = req.nextUrl.origin;
      const result = await subscribeOrChange(user.id, target, cycle, origin);
      return NextResponse.json({ ok: true, url: result.url, simulated: result.simulated ?? false });
    }
    if (action === "cancel") {
      await cancelSubscription(user.id);
      return NextResponse.json({ ok: true });
    }
    if (action === "reactivate") {
      await reactivateSubscription(user.id);
      return NextResponse.json({ ok: true });
    }
    if (action === "autoRenew") {
      await setAutoRenew(user.id, body.value === true);
      return NextResponse.json({ ok: true });
    }
    if (action === "volume") {
      const v = body.value;
      if (v !== "" && v !== "volume2" && v !== "volume5" && v !== "volume10") {
        return NextResponse.json({ error: "Unknown volume plan" }, { status: 400 });
      }
      await setVolume(user.id, v);
      return NextResponse.json({ ok: true });
    }
    if (action === "addon") {
      const key = body.key;
      if (key !== "editor" && key !== "extraVideoHours" && key !== "extraCampaignBlocks") {
        return NextResponse.json({ error: "Unknown add-on" }, { status: 400 });
      }
      await setAddOn(user.id, key, (body.value as boolean | number) ?? false);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    if (e instanceof UnpaidChangeError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Billing action failed" }, { status: 400 });
  }
}

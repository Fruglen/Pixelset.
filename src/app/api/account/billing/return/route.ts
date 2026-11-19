import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { activateStripeCheckout } from "@/lib/billing";

// Stripe Checkout success return for plan subscriptions: verify the session
// with Stripe, activate the pending plan change, then send the photographer
// back to Settings > Plan.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";
  if (!user || !sessionId) {
    return NextResponse.redirect(new URL("/settings/plan?billing=failed", req.nextUrl.origin));
  }
  const ok = await activateStripeCheckout(user.id, sessionId).catch(() => false);
  return NextResponse.redirect(
    new URL(`/settings/plan?billing=${ok ? "active" : "failed"}`, req.nextUrl.origin),
  );
}

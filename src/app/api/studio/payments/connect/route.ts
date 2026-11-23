import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { stripeConnectUrl } from "@/lib/processors";

// Night build: begin Stripe Connect onboarding for the photographer's own
// Stripe account. Answers honestly when the platform client id is not set.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("settings");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const url = stripeConnectUrl(randomBytes(12).toString("hex"), `${origin}/api/studio/payments/connect/callback`);
  if (!url) {
    return NextResponse.json(
      { error: "Stripe Connect is not configured on this server (STRIPE_PLATFORM_CLIENT_ID is not set). You can still paste an existing account ID in Settings." },
      { status: 409 }
    );
  }
  return NextResponse.redirect(url);
}

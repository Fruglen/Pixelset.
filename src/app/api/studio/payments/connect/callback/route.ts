import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { db } from "@/lib/db";
import { stripeConnectExchange } from "@/lib/processors";
import { clearOAuthStateCookie, consumeOAuthState } from "@/lib/oauth-state";

// Stripe Connect OAuth return: exchange the code and store the account id.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  if (!user) return NextResponse.redirect(`${origin}/login`);
  const back = (note: "failed" | "connected") => {
    const res = NextResponse.redirect(`${origin}/studio/settings?stripe=${note}`);
    clearOAuthStateCookie(res, "stripe");
    return res;
  };
  // This callback replaces the account that receives the studio's payouts.
  if (await permissionError("settings")) return back("failed");
  // GLE-137: only a flow this user started here may write the payout account.
  if (!consumeOAuthState(req, "stripe", user.id)) return back("failed");
  const code = new URL(req.url).searchParams.get("code") || "";
  const out = code ? await stripeConnectExchange(code) : { error: "No code returned" };
  if ("error" in out) return back("failed");
  await db.studioProfile.update({
    where: { userId: user.id },
    data: { stripeConnected: true, stripeAccount: out.accountId },
  });
  return back("connected");
}

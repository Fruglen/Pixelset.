import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { db } from "@/lib/db";
import { stripeConnectExchange } from "@/lib/processors";

// Stripe Connect OAuth return: exchange the code and store the account id.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  if (!user) return NextResponse.redirect(`${origin}/login`);
  // This callback replaces the account that receives the studio's payouts.
  if (await permissionError("settings")) return NextResponse.redirect(`${origin}/studio/settings?stripe=failed`);
  const code = new URL(req.url).searchParams.get("code") || "";
  const out = code ? await stripeConnectExchange(code) : { error: "No code returned" };
  if ("error" in out) return NextResponse.redirect(`${origin}/studio/settings?stripe=failed`);
  await db.studioProfile.update({
    where: { userId: user.id },
    data: { stripeConnected: true, stripeAccount: out.accountId },
  });
  return NextResponse.redirect(`${origin}/studio/settings?stripe=connected`);
}

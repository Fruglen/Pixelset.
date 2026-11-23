import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { getStudioProfile } from "@/lib/studio";
import { exchangeGoogleCode, googleEmailFor, syncAllBookingsToGoogle } from "@/lib/google-calendar";
import { clearOAuthStateCookie, consumeOAuthState } from "@/lib/oauth-state";

// Google OAuth callback: store the refresh token + account email on the
// studio profile, switch two way sync on, and run the first sync (existing
// bookings pushed, personal busy time read back).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const back = (note: string) => {
    const res = NextResponse.redirect(new URL(`/studio/settings?google=${note}`, req.url));
    clearOAuthStateCookie(res, "google");
    return res;
  };
  if (await permissionError("settings")) return back("error");

  // GLE-137: only a flow this user started here may connect a calendar.
  if (!consumeOAuthState(req, "google", user.id)) return back("error");
  const code = req.nextUrl.searchParams.get("code") ?? "";
  if (!code) return back("error");

  const out = await exchangeGoogleCode(code);
  if ("error" in out) return back("error");

  const profile = await getStudioProfile(user.id);
  const email = out.accessToken ? await googleEmailFor(out.accessToken) : "";
  await db.studioProfile.update({
    where: { id: profile.id },
    data: {
      // Google only returns a refresh token on a fresh consent; keep the old
      // one if this connect somehow came back without it.
      googleRefreshToken: out.refreshToken || profile.googleRefreshToken,
      googleEmail: email || profile.googleEmail,
      googleCalendarSync: true,
    },
  });
  await syncAllBookingsToGoogle(user.id);
  return back("connected");
}

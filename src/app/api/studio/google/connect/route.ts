import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { googleConnectUrl, googleOAuthConfigured } from "@/lib/google-calendar";
import { createOAuthState, setOAuthStateCookie } from "@/lib/oauth-state";

// Start the Google Calendar OAuth flow. When the server has no Google
// credentials configured the photographer is sent back to settings with an
// honest not-configured note instead of a dead Google error page.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (await permissionError("settings")) return NextResponse.redirect(new URL("/studio/settings?google=error", req.url));
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/studio/settings?google=not-configured", req.url));
  }
  const state = createOAuthState();
  const url = googleConnectUrl(state);
  if (!url) return NextResponse.redirect(new URL("/studio/settings?google=not-configured", req.url));
  const res = NextResponse.redirect(url);
  setOAuthStateCookie(res, "google", state, user.id);
  return res;
}

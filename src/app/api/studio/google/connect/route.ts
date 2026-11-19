import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { googleConnectUrl, googleOAuthConfigured } from "@/lib/google-calendar";

// Start the Google Calendar OAuth flow. When the server has no Google
// credentials configured the photographer is sent back to settings with an
// honest not-configured note instead of a dead Google error page.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/studio/settings?google=not-configured", req.url));
  }
  const url = googleConnectUrl(user.id);
  if (!url) return NextResponse.redirect(new URL("/studio/settings?google=not-configured", req.url));
  return NextResponse.redirect(url);
}

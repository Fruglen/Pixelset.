import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DRAFT_COOKIE } from "@/lib/site-data";

// Switch the owner's browser between draft preview and the live site.
// GET /api/website/preview?mode=draft|live&slug=<site>&to=/site/<slug>/page
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") === "live" ? "live" : "draft";
  const user = await getCurrentUser();
  const website = user ? await db.website.findUnique({ where: { userId: user.id } }) : null;
  const requested = req.nextUrl.searchParams.get("to") || "";
  const fallback = website ? `/site/${website.slug}` : "/website";
  const to = requested.startsWith("/site/") ? requested : fallback;
  const res = NextResponse.redirect(new URL(to, req.url));
  if (mode === "draft" && website) {
    res.cookies.set(DRAFT_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8 });
  } else {
    res.cookies.delete(DRAFT_COOKIE);
  }
  return res;
}

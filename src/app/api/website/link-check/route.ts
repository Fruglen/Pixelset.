import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { checkWebsiteLinks } from "@/lib/link-check";

export const dynamic = "force-dynamic";

// Phase 5B platform: run the broken link check for the signed in user's site.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const site = await db.website.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!site) return NextResponse.json({ error: "No website" }, { status: 404 });
  // internal app paths are requested from this same server
  const port = req.nextUrl.port || (req.nextUrl.protocol === "https:" ? "443" : "80");
  const origin = process.env.INTERNAL_ORIGIN || `http://127.0.0.1:${port}`;
  return NextResponse.json(await checkWebsiteLinks(site.id, origin));
}

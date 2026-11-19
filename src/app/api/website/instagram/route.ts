import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchInstagramFeed, instagramSource, instagramTokenFor } from "@/lib/instagram";

async function own() {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.website.findUnique({ where: { userId: user.id } });
}

// GET: connection status (never returns the token itself).
export async function GET() {
  const website = await own();
  if (!website) return NextResponse.json({ error: "No website" }, { status: 404 });
  const source = instagramSource(website);
  if (source === "none") return NextResponse.json({ connected: false, source, username: "", posts: 0, error: "" });
  const feed = await fetchInstagramFeed(instagramTokenFor(website), 12);
  return NextResponse.json({ connected: feed.connected, source, username: feed.username, posts: feed.posts.length, error: feed.error });
}

// POST { token } saves an account token; { token: "" } disconnects.
export async function POST(req: NextRequest) {
  const website = await own();
  if (!website) return NextResponse.json({ error: "No website" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (token) {
    const feed = await fetchInstagramFeed(token, 6);
    if (!feed.connected) return NextResponse.json({ error: `Instagram rejected the token: ${feed.error || "unknown error"}` }, { status: 400 });
    await db.website.update({ where: { id: website.id }, data: { instagramToken: token } });
    return NextResponse.json({ connected: true, username: feed.username, posts: feed.posts.length });
  }
  await db.website.update({ where: { id: website.id }, data: { instagramToken: "" } });
  return NextResponse.json({ connected: false });
}

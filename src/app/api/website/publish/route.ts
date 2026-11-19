import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { discardDraft, draftStatus, publishSite } from "@/lib/site-publish";

async function own() {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.website.findUnique({ where: { userId: user.id } });
}

// GET: what the draft changes compared with the live site.
export async function GET() {
  const website = await own();
  if (!website) return NextResponse.json({ error: "No website" }, { status: 404 });
  return NextResponse.json(await draftStatus(website.id));
}

// POST { action: "publish" | "discard" }
export async function POST(req: NextRequest) {
  const website = await own();
  if (!website) return NextResponse.json({ error: "No website" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (body.action === "discard") {
    const ok = await discardDraft(website.id);
    if (!ok) return NextResponse.json({ error: "Nothing has been published yet, so there is nothing to revert to" }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await draftStatus(website.id)) });
  }
  await publishSite(website.id);
  return NextResponse.json({ ok: true, ...(await draftStatus(website.id)) });
}

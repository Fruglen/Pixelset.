import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { siteExt } from "@/lib/site-ext";
import { readSiteGate, writeSiteGate } from "@/lib/site-gate";

export const runtime = "nodejs";

// Night build (Website): unlock a password protected site or page.
// Body: { slug, password, pageId? }. On success the signed gate cookie is
// set and the client reloads. Passwords never leave the server.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = String(body.slug ?? "");
  const password = String(body.password ?? "");
  const pageId = String(body.pageId ?? "");
  if (!slug || !password) return NextResponse.json({ error: "Enter the password" }, { status: 400 });

  const website = await db.website.findUnique({ where: { slug } });
  if (!website) return NextResponse.json({ error: "Site not found" }, { status: 404 });
  const state = readSiteGate(website.id);

  if (pageId) {
    const page = await db.sitePage.findFirst({ where: { id: pageId, websiteId: website.id } });
    const pagePassword = String((page as unknown as Record<string, unknown> | null)?.password ?? "");
    if (!page || !pagePassword) return NextResponse.json({ error: "This page is not password protected" }, { status: 400 });
    if (password !== pagePassword) return NextResponse.json({ error: "That password is not right" }, { status: 403 });
    if (!state.pages.includes(pageId)) state.pages.push(pageId);
    writeSiteGate(website.id, state);
    return NextResponse.json({ ok: true });
  }

  const ext = siteExt(website);
  if (!ext.sitePassword) return NextResponse.json({ error: "This site is not password protected" }, { status: 400 });
  if (password !== ext.sitePassword) return NextResponse.json({ error: "That password is not right" }, { status: 403 });
  state.site = true;
  writeSiteGate(website.id, state);
  return NextResponse.json({ ok: true });
}

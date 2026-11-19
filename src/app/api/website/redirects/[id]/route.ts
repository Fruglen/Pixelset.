import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) return NextResponse.json({ error: "No website" }, { status: 404 });
  await db.siteRedirect.deleteMany({ where: { id: params.id, websiteId: website.id } });
  return NextResponse.json({ ok: true });
}

// Edit a redirect's target.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) return NextResponse.json({ error: "No website" }, { status: 404 });
  const redirect = await db.siteRedirect.findFirst({ where: { id: params.id, websiteId: website.id } });
  if (!redirect) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const raw = typeof body.toPath === "string" ? body.toPath.trim() : "";
  if (!raw) return NextResponse.json({ error: "Target is required" }, { status: 400 });
  const toPath = /^https?:\/\//i.test(raw) ? raw : (`/${raw.replace(/^\/+/, "")}`.replace(/\/+$/, "") || "/");
  const { createsLoop } = await import("@/lib/site-redirects");
  if (await createsLoop(website.id, redirect.fromPath, toPath)) {
    return NextResponse.json({ error: "That redirect would create a loop with an existing redirect" }, { status: 400 });
  }
  await db.siteRedirect.update({ where: { id: redirect.id }, data: { toPath } });
  return NextResponse.json({ ok: true });
}

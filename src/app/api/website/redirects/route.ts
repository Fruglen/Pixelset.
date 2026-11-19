import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

import { normalizeRedirectPath, createsLoop } from "@/lib/site-redirects";

function normalizeTarget(p: string): string {
  const t = p.trim();
  if (/^https?:\/\//i.test(t)) return t;
  let out = t.split("#")[0];
  if (!out.startsWith("/")) out = `/${out}`;
  return out.replace(/\/+$/, "") || "/";
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const website = await db.website.findUnique({ where: { userId: user.id } });
  if (!website) return NextResponse.json({ error: "No website" }, { status: 404 });

  const body = await req.json();
  if (typeof body.fromPath !== "string" || typeof body.toPath !== "string" || !body.fromPath.trim() || !body.toPath.trim()) {
    return NextResponse.json({ error: "Both paths are required" }, { status: 400 });
  }
  const fromPath = normalizeRedirectPath(body.fromPath);
  const toPath = normalizeTarget(body.toPath);
  if (fromPath === "/") return NextResponse.json({ error: "The home page can't be redirected" }, { status: 400 });
  if (fromPath === normalizeRedirectPath(toPath) && !/^https?:/i.test(toPath)) return NextResponse.json({ error: "Paths must differ" }, { status: 400 });
  if (await createsLoop(website.id, fromPath, toPath)) {
    return NextResponse.json({ error: "That redirect would create a loop with an existing redirect" }, { status: 400 });
  }

  const existing = await db.siteRedirect.findUnique({ where: { websiteId_fromPath: { websiteId: website.id, fromPath } } });
  if (existing) return NextResponse.json({ error: "A redirect from that path already exists" }, { status: 400 });

  const redirect = await db.siteRedirect.create({ data: { websiteId: website.id, fromPath, toPath } });
  return NextResponse.json({ id: redirect.id });
}

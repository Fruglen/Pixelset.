import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function normalizePath(p: string): string {
  let out = p.trim();
  if (!out.startsWith("/")) out = `/${out}`;
  out = out.replace(/\/+$/, "") || "/";
  return out;
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
  const fromPath = normalizePath(body.fromPath);
  const toPath = body.toPath.trim().startsWith("http") ? body.toPath.trim() : normalizePath(body.toPath);
  if (fromPath === toPath) return NextResponse.json({ error: "Paths must differ" }, { status: 400 });

  const existing = await db.siteRedirect.findUnique({ where: { websiteId_fromPath: { websiteId: website.id, fromPath } } });
  if (existing) return NextResponse.json({ error: "A redirect from that path already exists" }, { status: 400 });

  const redirect = await db.siteRedirect.create({ data: { websiteId: website.id, fromPath, toPath } });
  return NextResponse.json({ id: redirect.id });
}

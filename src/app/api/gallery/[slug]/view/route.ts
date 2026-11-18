import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readGalleryAccess, ensureClientKey } from "@/lib/gallery-auth";
import { logActivity } from "@/lib/activity";

export async function POST(_req: NextRequest, { params }: { params: { slug: string } }) {
  const collection = await db.collection.findUnique({ where: { slug: params.slug } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  ensureClientKey();
  const access = readGalleryAccess(collection.id);
  await logActivity(collection.id, "VIEW", "Gallery opened", access.email);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { rm } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const media = await db.siteMedia.findFirst({ where: { id: params.id, userId: user.id } });
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (media.url.startsWith(`/uploads/site-${user.id}/`)) {
    await rm(path.join(process.cwd(), "public", media.url), { force: true }).catch(() => undefined);
  }
  await db.siteMedia.delete({ where: { id: media.id } });
  return NextResponse.json({ ok: true });
}

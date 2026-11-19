import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteStored } from "@/lib/storage";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const media = await db.siteMedia.findFirst({ where: { id: params.id, userId: user.id } });
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (media.url.includes(`/uploads/site-${user.id}/`)) {
    await deleteStored(media.url);
  }
  await db.siteMedia.delete({ where: { id: media.id } });
  return NextResponse.json({ ok: true });
}

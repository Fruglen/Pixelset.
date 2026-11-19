import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readGalleryAccess } from "@/lib/gallery-auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const list = await db.favoriteList.findUnique({ where: { id: params.id } });
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = readGalleryAccess(list.collectionId);
  if (!access.email || access.email !== list.clientEmail) {
    return NextResponse.json({ error: "This list belongs to another client" }, { status: 403 });
  }
  if (list.submittedAt) {
    return NextResponse.json({ error: "This list was already sent to the photographer" }, { status: 400 });
  }
  const { photoId, note } = await req.json();
  const favorite = await db.favorite.findFirst({ where: { listId: list.id, photoId } });
  if (!favorite) return NextResponse.json({ error: "Photo is not in this list" }, { status: 404 });
  await db.favorite.update({
    where: { id: favorite.id },
    data: { note: typeof note === "string" ? note.slice(0, 500) : "" },
  });
  return NextResponse.json({ ok: true });
}

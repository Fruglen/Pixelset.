import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readGalleryAccess } from "@/lib/gallery-auth";
import { logActivity } from "@/lib/activity";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const list = await db.favoriteList.findUnique({
    where: { id: params.id },
    include: { favorites: true },
  });
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const col = await db.collection.findUnique({ where: { id: list.collectionId }, select: { favoritesEnabled: true } });
  if (!col?.favoritesEnabled) return NextResponse.json({ error: "Favorites are turned off for this gallery" }, { status: 403 });
  if (list.submittedAt) return NextResponse.json({ error: `“${list.name}” was already sent to the photographer. Ask them to reopen it to make changes.` }, { status: 400 });
  const access = readGalleryAccess(list.collectionId);
  if (!access.email || access.email !== list.clientEmail) {
    return NextResponse.json({ error: "This list belongs to another client" }, { status: 403 });
  }

  const { photoId } = await req.json();
  const photo = await db.photo.findFirst({
    where: { id: photoId, collectionId: list.collectionId },
  });
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  const existing = list.favorites.find((f) => f.photoId === photo.id);
  if (existing) {
    await db.favorite.delete({ where: { id: existing.id } });
    await logActivity(list.collectionId, "UNFAVORITE", `${photo.filename} removed from “${list.name}”`, access.email);
    return NextResponse.json({ favorited: false });
  }

  if (list.selectionLimit !== null && list.favorites.length >= list.selectionLimit) {
    return NextResponse.json(
      { error: `“${list.name}” allows at most ${list.selectionLimit} selections.` },
      { status: 400 }
    );
  }

  await db.favorite.create({ data: { listId: list.id, photoId: photo.id } });
  await logActivity(list.collectionId, "FAVORITE", `${photo.filename} added to “${list.name}”`, access.email);
  return NextResponse.json({ favorited: true });
}

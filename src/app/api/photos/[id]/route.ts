import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { deleteStored, isStoredUrl } from "@/lib/storage";

async function ownedPhoto(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.photo.findFirst({ where: { id, collection: { userId: user.id } } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const photo = await ownedPhoto(params.id);
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.isPrivate === "boolean") data.isPrivate = body.isPrivate;
  if (typeof body.order === "number") data.order = body.order;
  // Phase 5B quick actions
  if (typeof body.starred === "boolean") data.starred = body.starred;
  if (typeof body.watermarkMode === "string" && ["on", "off", "inherit"].includes(body.watermarkMode)) data.watermarkMode = body.watermarkMode;
  if (typeof body.filename === "string" && body.filename.trim()) {
    const ext = photo.filename.match(/\.[a-z0-9]+$/i)?.[0] ?? "";
    let next = body.filename.trim().replace(/[^a-zA-Z0-9._ -]+/g, "_").slice(0, 120);
    if (ext && !next.toLowerCase().endsWith(ext.toLowerCase())) next += ext;
    data.filename = next;
  }
  if (typeof body.setId === "string" && body.setId !== photo.setId) {
    const set = await db.photoSet.findFirst({
      where: { id: body.setId, collectionId: photo.collectionId },
    });
    if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });
    data.setId = set.id;
  }
  await db.photo.update({ where: { id: photo.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const photo = await ownedPhoto(params.id);
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.photo.delete({ where: { id: photo.id } });
  if (!photo.isExternal && isStoredUrl(photo.url)) {
    await deleteStored(photo.url);
  }
  if (photo.posterUrl && isStoredUrl(photo.posterUrl)) {
    await deleteStored(photo.posterUrl);
  }
  // Clear cover reference if this photo was the cover
  await db.collection.updateMany({
    where: { id: photo.collectionId, coverPhotoId: photo.id },
    data: { coverPhotoId: null },
  });
  return NextResponse.json({ ok: true });
}

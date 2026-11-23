import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readGalleryAccess, withOwnedList, writeGalleryAccess } from "@/lib/gallery-auth";
import { needsEmailVerification } from "@/lib/gallery-verify";
import { logActivity } from "@/lib/activity";
import { upsertContact } from "@/lib/contact-sync";

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const collection = await db.collection.findUnique({ where: { slug: params.slug } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!collection.favoritesEnabled) {
    return NextResponse.json({ error: "Favorites are turned off for this gallery" }, { status: 403 });
  }
  const access = readGalleryAccess(collection.id);
  if (!access.email) {
    return NextResponse.json({ error: "Identify yourself first (email required)" }, { status: 401 });
  }
  // GLE-122: nobody adds lists under a client's address without proving it.
  if (await needsEmailVerification(collection.id, access)) {
    return NextResponse.json({ error: "Confirm your email to use these favorites", needsVerification: true }, { status: 403 });
  }
  const body = await req.json();
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "My Favorites";
  const selectionLimit =
    body.selectionLimit === null || body.selectionLimit === undefined
      ? null
      : Number(body.selectionLimit) || null;

  const list = await db.favoriteList.create({
    data: {
      collectionId: collection.id,
      clientEmail: access.email,
      clientName: access.name,
      name,
      selectionLimit,
    },
  });
  writeGalleryAccess(collection.id, withOwnedList(access, list.id));
  await upsertContact(collection.userId, access.email, access.name, "GALLERY", { tag: "gallery client", makeClient: true });
  await logActivity(collection.id, "LIST_CREATED", `Favorite list “${name}” created`, access.email);
  return NextResponse.json({ id: list.id });
}

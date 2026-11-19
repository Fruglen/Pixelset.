import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";
import { slugify } from "@/lib/utils";
import { saveStoredBuffer } from "@/lib/storage";

export const runtime = "nodejs";

// Saves an edited canvas export back into the photo's collection as a NEW photo
// (the original is never touched). Body: { photoId, dataUrl, label }.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await permissionError("upload");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const body = await req.json();
  const photo = await db.photo.findFirst({
    where: { id: String(body.photoId ?? ""), collection: { userId: user.id } },
  });
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  // Phase 5B: export destination. Default is the original's own set; any
  // collection and set the photographer owns, a new set, or a new gallery.
  let destCollectionId = photo.collectionId;
  let destSetId: string = photo.setId;
  let destinationLabel = "";
  const newCollectionName = typeof body.newCollectionName === "string" ? body.newCollectionName.trim().slice(0, 120) : "";
  const wantCollection = typeof body.destCollectionId === "string" ? body.destCollectionId : "";
  const wantSet = typeof body.destSetId === "string" ? body.destSetId : "";
  const newSetName = typeof body.newSetName === "string" ? body.newSetName.trim().slice(0, 80) : "";
  if (newCollectionName) {
    const base = slugify(newCollectionName) || "edits";
    let slug = base;
    let n = 1;
    while (await db.collection.findUnique({ where: { slug } })) slug = `${base}-${++n}`;
    const created = await db.collection.create({
      data: { userId: user.id, name: newCollectionName, slug, sets: { create: [{ name: "Highlights", order: 0 }] } },
      include: { sets: true },
    });
    destCollectionId = created.id;
    destSetId = created.sets[0].id;
    destinationLabel = `${created.name}, Highlights`;
  } else if (wantCollection) {
    const col = await db.collection.findFirst({
      where: { id: wantCollection, userId: user.id },
      include: { sets: { orderBy: { order: "asc" } } },
    });
    if (!col) return NextResponse.json({ error: "Destination gallery not found" }, { status: 404 });
    destCollectionId = col.id;
    if (newSetName) {
      const set = await db.photoSet.create({ data: { collectionId: col.id, name: newSetName, order: col.sets.length } });
      destSetId = set.id;
      destinationLabel = `${col.name}, ${set.name}`;
    } else if (wantSet) {
      const set = col.sets.find((x) => x.id === wantSet);
      if (!set) return NextResponse.json({ error: "Destination set not found in that gallery" }, { status: 404 });
      destSetId = set.id;
      destinationLabel = `${col.name}, ${set.name}`;
    } else {
      const first =
        col.sets[0] ?? (await db.photoSet.create({ data: { collectionId: col.id, name: "Highlights", order: 0 } }));
      destSetId = first.id;
      destinationLabel = `${col.name}, ${first.name}`;
    }
  } else {
    // Default destination: the original photo's own set. Label it properly
    // (this used to return an empty destination string).
    const homeCol = await db.collection.findUnique({ where: { id: photo.collectionId }, select: { name: true } });
    const homeSet = await db.photoSet.findUnique({ where: { id: photo.setId }, select: { name: true } });
    destinationLabel =
      homeCol && homeSet ? `${homeCol.name}, ${homeSet.name}` : "Same set as the original";
  }

  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
  const match = dataUrl.match(/^data:image\/(jpeg|png);base64,(.+)$/);
  if (!match) return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 30 * 1024 * 1024) {
    return NextResponse.json({ error: "Edited image is too large" }, { status: 413 });
  }

  const sharp = (await import("sharp")).default;
  let width: number | null = null;
  let height: number | null = null;
  let jpeg: Buffer = buffer;
  try {
    const img = sharp(buffer);
    const meta = await img.metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
    jpeg = await img.jpeg({ quality: 90 }).toBuffer();
  } catch {
    return NextResponse.json({ error: "Could not process the image" }, { status: 400 });
  }

  const base = photo.filename.replace(/\.[a-z0-9]+$/i, "");
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : "edited";
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "edited";
  const filename = `${base}-${safeLabel}-${Date.now().toString(36)}.jpg`;

  const url = await saveStoredBuffer(`uploads/${destCollectionId}/${filename}`, jpeg, "image/jpeg");

  const count = await db.photo.count({ where: { setId: destSetId } });
  const created = await db.photo.create({
    data: {
      collectionId: destCollectionId,
      setId: destSetId,
      filename,
      url,
      isExternal: false,
      width,
      height,
      order: count,
    },
  });

  return NextResponse.json({
    id: created.id,
    url: created.url,
    filename: created.filename,
    collectionId: destCollectionId,
    destination: destinationLabel,
  });
}

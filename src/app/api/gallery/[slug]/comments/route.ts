import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readGalleryAccess } from "@/lib/gallery-auth";
import { logActivity } from "@/lib/activity";
import { formatTimecode } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const collection = await db.collection.findUnique({ where: { slug: params.slug } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = readGalleryAccess(collection.id);
  if (!access.email) {
    return NextResponse.json({ error: "Identify yourself first (email required)" }, { status: 401 });
  }
  const { photoId, body, timecodeSec } = await req.json();
  if (typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Comment required" }, { status: 400 });
  }
  const photo = await db.photo.findFirst({ where: { id: photoId, collectionId: collection.id } });
  if (!photo) return NextResponse.json({ error: "Photo not found" }, { status: 404 });

  // Fix batch 2026-11-20: a comment on a video can be pinned to a timecode.
  let timecode: number | null = null;
  if (timecodeSec !== undefined && timecodeSec !== null) {
    const t = Number(timecodeSec);
    if (photo.mediaType !== "VIDEO") return NextResponse.json({ error: "Only video comments take a timecode" }, { status: 400 });
    if (!Number.isFinite(t) || t < 0 || (photo.durationSec && t > photo.durationSec + 1)) {
      return NextResponse.json({ error: "That timecode is outside the video" }, { status: 400 });
    }
    timecode = Math.round(t * 10) / 10;
  }

  const comment = await db.comment.create({
    data: {
      collectionId: collection.id,
      photoId: photo.id,
      authorEmail: access.email,
      authorName: access.name,
      body: body.trim().slice(0, 1000),
      timecodeSec: timecode,
    },
  });
  const at = timecode !== null ? ` at ${formatTimecode(timecode)}` : "";
  await logActivity(collection.id, "COMMENT", `Comment on ${photo.filename}${at}: “${body.trim().slice(0, 80)}”`, access.email);
  return NextResponse.json({ id: comment.id, authorName: access.name || access.email, timecodeSec: timecode });
}

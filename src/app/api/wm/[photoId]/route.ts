import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { watermarkFromUser, watermarkedPreview } from "@/lib/watermark";
import { clampQuality, renditionWidth } from "@/lib/previews";
import { ensureRawPreview } from "@/lib/raw-preview";
import { canViewPhotoRendition, isFullyPublicPhoto } from "@/lib/media-access";

export const runtime = "nodejs";

// Phase 5B: watermarked preview rendition. The watermark is composited into
// the image server side (cached), so the preview a client receives already
// carries it. Width is clamped to sensible preview sizes.
// Phase 5B platform: width and JPEG quality follow Settings, Gallery, Preview quality.

export async function GET(req: NextRequest, { params }: { params: { photoId: string } }) {
  const photo = await db.photo.findUnique({
    where: { id: params.photoId },
    include: { set: true, collection: { include: { accessGroups: true, user: true } } },
  });
  // GLE-116: same response for missing and denied, so IDs cannot be probed.
  const qs = req.nextUrl.searchParams.get("qs") ?? "";
  if (!photo || photo.mediaType === "VIDEO" || !(await canViewPhotoRendition(photo, qs))) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const asked = Number(req.nextUrl.searchParams.get("w")) || 1600;
  const width = renditionWidth(asked, photo.collection.user.previewSize);
  const quality = clampQuality(photo.collection.user.previewQuality);
  const s = watermarkFromUser(photo.collection.user);
  let src = photo.mediaType === "RAW" ? photo.posterUrl : photo.url;
  // RAW uploaded before embedded JPEG extraction: build its preview now.
  if (photo.mediaType === "RAW" && !src) src = await ensureRawPreview(photo);
  if (!src) return NextResponse.json({ error: "No preview" }, { status: 404 });
  const out = await watermarkedPreview({ id: photo.id, url: src, isExternal: photo.isExternal && photo.mediaType === "IMAGE" }, s, width, quality);
  if (!out) return NextResponse.json({ error: "Could not render the preview" }, { status: 502 });
  return new NextResponse(new Uint8Array(out), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": isFullyPublicPhoto(photo) ? "private, max-age=600" : "private, no-store", "X-Preview-Width": String(width), "X-Preview-Quality": String(quality) },
  });
}

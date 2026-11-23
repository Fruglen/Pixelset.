import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { photoWatermarked } from "@/lib/watermark";
import { clampQuality, previewRendition, renditionCached, renditionWidth } from "@/lib/previews";
import { ensureRawPreview } from "@/lib/raw-preview";
import { canViewPhotoRendition, isFullyPublicPhoto } from "@/lib/media-access";

export const runtime = "nodejs";

// Phase 5B platform: sized preview rendition at the photographer's chosen
// preview size and quality. Watermarked photos are never served clean here,
// they go to the watermark route; GIFs keep their animation (original file).
export async function GET(req: NextRequest, { params }: { params: { photoId: string } }) {
  const photo = await db.photo.findUnique({
    where: { id: params.photoId },
    include: {
      set: true,
      collection: { include: { accessGroups: true, user: { select: { previewSize: true, previewQuality: true } } } },
    },
  });
  const qs = req.nextUrl.searchParams.get("qs") ?? "";
  // GLE-116: same response for missing and denied, so IDs cannot be probed.
  if (!photo || photo.mediaType === "VIDEO" || !(await canViewPhotoRendition(photo, qs))) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const asked = Number(req.nextUrl.searchParams.get("w")) || 1600;
  if (photoWatermarked(photo.collection.watermark, photo.watermarkMode)) {
    const wmTarget = new URL(`/api/wm/${photo.id}?w=${asked}`, req.url);
    if (qs) wmTarget.searchParams.set("qs", qs);
    return NextResponse.redirect(wmTarget, { status: 302, headers: { "Cache-Control": "no-store" } });
  }
  let src = photo.mediaType === "RAW" ? photo.posterUrl : photo.url;
  // RAW uploaded before embedded JPEG extraction: build its preview now.
  if (photo.mediaType === "RAW" && !src) src = await ensureRawPreview(photo);
  if (!src) return NextResponse.json({ error: "No preview" }, { status: 404 });
  if (/\.gif$/i.test(src)) {
    // GLE-115: /media checks entitlement, so a Quick Share token must survive the redirect.
    const target = new URL(src, req.url);
    if (qs) target.searchParams.set("qs", qs);
    return NextResponse.redirect(target, { status: 302, headers: { "Cache-Control": "no-store" } });
  }
  const user = photo.collection.user;
  const width = renditionWidth(asked, user.previewSize);
  const quality = clampQuality(user.previewQuality);
  const cached = await renditionCached(photo.id, width, quality);
  const out = await previewRendition({ id: photo.id, url: src, isExternal: photo.isExternal && photo.mediaType === "IMAGE" }, width, quality);
  if (!out) return NextResponse.json({ error: "Could not render the preview" }, { status: 502 });
  return new NextResponse(new Uint8Array(out), {
    headers: {
      "Content-Type": "image/jpeg",
      // GLE-116: shared caching only for fully public photos.
      "Cache-Control": isFullyPublicPhoto(photo) ? "public, max-age=86400" : "private, no-store",
      "X-Preview-Width": String(width),
      "X-Preview-Quality": String(quality),
      "X-Preview-Cache": cached ? "hit" : "miss",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { photoWatermarked } from "@/lib/watermark";
import { clampQuality, previewRendition, renditionCached, renditionWidth } from "@/lib/previews";

export const runtime = "nodejs";

// Phase 5B platform: sized preview rendition at the photographer's chosen
// preview size and quality. Watermarked photos are never served clean here,
// they go to the watermark route; GIFs keep their animation (original file).
export async function GET(req: NextRequest, { params }: { params: { photoId: string } }) {
  const photo = await db.photo.findUnique({
    where: { id: params.photoId },
    include: { collection: { include: { user: { select: { previewSize: true, previewQuality: true } } } } },
  });
  if (!photo || photo.mediaType === "VIDEO") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const asked = Number(req.nextUrl.searchParams.get("w")) || 1600;
  if (photoWatermarked(photo.collection.watermark, photo.watermarkMode)) {
    return NextResponse.redirect(new URL(`/api/wm/${photo.id}?w=${asked}`, req.url), 302);
  }
  const src = photo.mediaType === "RAW" ? photo.posterUrl : photo.url;
  if (!src) return NextResponse.json({ error: "No preview" }, { status: 404 });
  if (/\.gif$/i.test(src)) return NextResponse.redirect(new URL(src, req.url), 302);
  const user = photo.collection.user;
  const width = renditionWidth(asked, user.previewSize);
  const quality = clampQuality(user.previewQuality);
  const cached = await renditionCached(photo.id, width, quality);
  const out = await previewRendition({ id: photo.id, url: src, isExternal: photo.isExternal && photo.mediaType === "IMAGE" }, width, quality);
  if (!out) return NextResponse.json({ error: "Could not render the preview" }, { status: 502 });
  return new NextResponse(new Uint8Array(out), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400",
      "X-Preview-Width": String(width),
      "X-Preview-Quality": String(quality),
      "X-Preview-Cache": cached ? "hit" : "miss",
    },
  });
}

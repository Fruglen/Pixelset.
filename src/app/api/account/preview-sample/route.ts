import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { loadPhotoBytes } from "@/lib/watermark";
import { clampPreviewSize, clampQuality } from "@/lib/previews";

export const runtime = "nodejs";

// Phase 5B platform: render one of the photographer's own photos at a preview
// size and quality, so Settings, Gallery can show the result and its file size
// before saving. GET ?size=2048&quality=85 returns the JPEG with X-Bytes.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const size = clampPreviewSize(Number(req.nextUrl.searchParams.get("size")));
  const quality = clampQuality(Number(req.nextUrl.searchParams.get("quality")));
  const photo = await db.photo.findFirst({
    where: { collection: { userId: user.id }, mediaType: "IMAGE", NOT: { url: { endsWith: ".gif" } } },
    orderBy: { createdAt: "desc" },
  });
  const sharp = (await import("sharp")).default;
  let src = photo ? await loadPhotoBytes(photo.url, photo.isExternal) : null;
  if (!src) {
    src = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 140, g: 120, b: 95 } } }).jpeg().toBuffer();
  }
  const out = await sharp(src, { limitInputPixels: 300_000_000 })
    .rotate()
    .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true, chromaSubsampling: quality >= 90 ? "4:4:4" : "4:2:0" })
    .toBuffer();
  const meta = await sharp(out).metadata();
  return new NextResponse(new Uint8Array(out), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-store",
      "X-Bytes": String(out.length),
      "X-Dimensions": `${meta.width}x${meta.height}`,
      "X-Source": photo ? photo.filename : "sample",
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isStoredUrl, readStoredBytes } from "@/lib/storage";

export const runtime = "nodejs";

// Square PNG app icon generated from the collection cover (center-cropped via
// sharp). Falls back to an accent-color monogram when no cover exists.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const app = await db.mobileApp.findUnique({
    where: { slug: params.slug },
    include: { collection: { include: { photos: { orderBy: { order: "asc" } } } } },
  });
  if (!app || !app.enabled) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const size = Math.min(1024, Math.max(48, Number(req.nextUrl.searchParams.get("size")) || 512));
  const collection = app.collection;
  const cover =
    (collection.coverPhotoId
      ? collection.photos.find((p) => p.id === collection.coverPhotoId)
      : undefined) ?? collection.photos[0];

  const sharp = (await import("sharp")).default;

  let source: Buffer | null = null;
  if (cover) {
    if (!cover.isExternal && isStoredUrl(cover.url)) {
      source = await readStoredBytes(cover.url);
    } else {
      try {
        const res = await fetch(cover.url);
        if (res.ok) source = Buffer.from(await res.arrayBuffer());
      } catch {}
    }
  }

  let png: Buffer;
  if (source) {
    png = await sharp(source).resize(size, size, { fit: "cover" }).png().toBuffer();
  } else {
    const letter = (app.appName[0] ?? "P").toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="100%" height="100%" fill="${app.accentColor}"/>
      <text x="50%" y="54%" font-family="Georgia, serif" font-size="${size * 0.5}" fill="rgba(255,255,255,0.92)"
        text-anchor="middle" dominant-baseline="middle">${letter}</text>
    </svg>`;
    png = await sharp(Buffer.from(svg)).png().toBuffer();
  }

  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
  });
}

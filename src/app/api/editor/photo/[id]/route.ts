import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isStoredUrl, readStoredBytes } from "@/lib/storage";

export const runtime = "nodejs";

// Serves the raw photo bytes same-origin so the canvas editor never taints -
// external (add-by-URL) photos are proxied through here. Owner only.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const photo = await db.photo.findFirst({
    where: { id: params.id, collection: { userId: user.id } },
  });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Night build: RAW photos are edited through their JPEG preview; the RAW
  // original itself is never touched (saving produces a JPEG copy).
  const srcUrl = photo.mediaType === "RAW" ? photo.posterUrl : photo.url;
  if (!srcUrl) return NextResponse.json({ error: "This RAW file has no preview to edit" }, { status: 400 });
  let buffer: Buffer;
  if (!photo.isExternal && isStoredUrl(srcUrl)) {
    const stored = await readStoredBytes(srcUrl);
    if (!stored) return NextResponse.json({ error: "File unavailable" }, { status: 404 });
    buffer = stored;
  } else {
    try {
      const res = await fetch(srcUrl);
      if (!res.ok) throw new Error();
      buffer = Buffer.from(await res.arrayBuffer());
    } catch {
      return NextResponse.json({ error: "Could not fetch the photo" }, { status: 502 });
    }
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=60" },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentTypeFor } from "@/lib/media";
import { isStoredUrl, readStoredBytes } from "@/lib/storage";

export const runtime = "nodejs";

// Digital-download fulfillment: secure link from the order confirmation,
// expires 7 days after purchase (Pixieset behavior).
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const item = await db.orderItem.findUnique({
    where: { downloadToken: params.token },
    include: { order: true },
  });
  if (!item || !item.downloadExpires) {
    return NextResponse.json({ error: "Unknown download link" }, { status: 404 });
  }
  if (item.order.status === "CANCELLED") {
    return NextResponse.json({ error: "This order was cancelled" }, { status: 410 });
  }
  if (item.downloadExpires.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This download link has expired (links are valid for 7 days). Contact the photographer to resend it." },
      { status: 410 }
    );
  }

  const photo = item.photoId ? await db.photo.findUnique({ where: { id: item.photoId } }) : null;
  const url = photo?.url ?? item.photoUrl;
  if (!url) return NextResponse.json({ error: "File unavailable" }, { status: 404 });

  let buffer: Buffer;
  if (isStoredUrl(url)) {
    const stored = await readStoredBytes(url);
    if (!stored) return NextResponse.json({ error: "File unavailable" }, { status: 404 });
    buffer = stored;
  } else {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      buffer = Buffer.from(await res.arrayBuffer());
    } catch {
      // External reference (e.g. a Picflow-hosted photo) that can't be proxied
      // right now: deliver the external URL directly instead of failing.
      return NextResponse.redirect(url);
    }
  }

  const name = item.photoName || "photo.jpg";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentTypeFor(name),
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}

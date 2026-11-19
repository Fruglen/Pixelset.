import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { analyzePhoto, loadPhotoBytes } from "@/lib/photo-analysis";

export const runtime = "nodejs";

// Night build (Photo Editor): "Styles learned from your past galleries".
// Finds edited copies the editor saved next to their originals, measures
// what changed (brightness, contrast, saturation, colour cast) with the
// same on device analysis, and averages it into a personal preset the
// editor offers as "Your style". No machine learning claims: it is a
// measured average of the photographer's own past edits.
const COPY_RE = /^(.+)-([a-z0-9][a-z0-9-]*)-([a-z0-9]{5,})\.jpe?g$/i;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const photos = await db.photo.findMany({
    where: { collection: { userId: user.id }, mediaType: "IMAGE" },
    select: { id: true, collectionId: true, filename: true, url: true, isExternal: true, mediaType: true, posterUrl: true },
    orderBy: { createdAt: "desc" },
    take: 800,
  });
  const byCollection = new Map<string, typeof photos>();
  for (const p of photos) {
    const list = byCollection.get(p.collectionId) ?? [];
    list.push(p);
    byCollection.set(p.collectionId, list);
  }
  type PhotoRow = (typeof photos)[number];
  const pairs: { orig: PhotoRow; copy: PhotoRow }[] = [];
  const lists: PhotoRow[][] = [];
  byCollection.forEach((list) => lists.push(list));
  for (const list of lists) {
    for (const p of list) {
      const m = p.filename.match(COPY_RE);
      if (!m) continue;
      const base = m[1];
      const orig = list.find((o: PhotoRow) => o.id !== p.id && new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.(jpe?g|png|webp)$`, "i").test(o.filename) && !COPY_RE.test(o.filename));
      if (orig) pairs.push({ orig, copy: p });
      if (pairs.length >= 24) break;
    }
    if (pairs.length >= 24) break;
  }
  if (pairs.length === 0) {
    return NextResponse.json({ pairs: 0, adjust: null });
  }
  const acc = { brightness: 0, contrast: 0, saturation: 0, warmth: 0 };
  let used = 0;
  for (const { orig, copy } of pairs) {
    const [ob, cb] = await Promise.all([loadPhotoBytes(orig), loadPhotoBytes(copy)]);
    if (!ob || !cb) continue;
    const [os, cs] = await Promise.all([analyzePhoto(ob), analyzePhoto(cb)]);
    if (!os || !cs) continue;
    acc.brightness += os.brightness > 0.03 ? (cs.brightness / os.brightness) * 100 : 100;
    acc.contrast += os.contrast > 0.02 ? (cs.contrast / os.contrast) * 100 : 100;
    acc.saturation += 100 + (cs.saturation - os.saturation) * 100;
    acc.warmth += (cs.warmthCast - os.warmthCast) * 130;
    used++;
  }
  if (used === 0) return NextResponse.json({ pairs: 0, adjust: null });
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));
  return NextResponse.json({
    pairs: used,
    adjust: {
      brightness: clamp(acc.brightness / used, 50, 150),
      contrast: clamp(acc.contrast / used, 50, 150),
      saturation: clamp(acc.saturation / used, 0, 200),
      warmth: clamp(acc.warmth / used, -50, 50),
      sepia: 0,
      grayscale: 0,
    },
  });
}

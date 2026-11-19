import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { analyzePhoto, hashDistance, loadPhotoBytes, scorePhoto, verdictFor } from "@/lib/photo-analysis";

export const runtime = "nodejs";

// Night build (Photo Editor): on device culling analysis for one collection.
// Scores every editable photo (sharpness, exposure, contrast, colour),
// groups near duplicates by perceptual hash, and names the best frame of
// each group. Nothing is changed in the gallery; starring happens through
// /api/editor/cull-apply only when the photographer confirms.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const collection = await db.collection.findFirst({
    where: { id: String(body.collectionId ?? ""), userId: user.id },
    include: {
      photos: {
        where: { OR: [{ mediaType: "IMAGE" }, { mediaType: "RAW", posterUrl: { not: "" } }] },
        orderBy: { order: "asc" },
        select: { id: true, url: true, filename: true, isExternal: true, mediaType: true, posterUrl: true, starred: true, setId: true },
      },
    },
  });
  if (!collection) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  if (collection.photos.length === 0) return NextResponse.json({ error: "No editable photos in this collection" }, { status: 400 });
  if (collection.photos.length > 400) return NextResponse.json({ error: "Culling works on up to 400 photos at a time" }, { status: 400 });

  type Row = {
    id: string; filename: string; url: string; mediaType: string; starred: boolean;
    brightness: number; contrast: number; saturation: number; warmthCast: number; sharpness: number;
    score: number; verdict: string; group: number; groupBest: boolean; issues: string[];
  };
  const rows: (Row & { hash: string })[] = [];
  let sharpMin = Infinity, sharpMax = -Infinity;
  const statsList: { p: (typeof collection.photos)[number]; st: NonNullable<Awaited<ReturnType<typeof analyzePhoto>>> }[] = [];
  for (const p of collection.photos) {
    const bytes = await loadPhotoBytes(p);
    if (!bytes) continue;
    const st = await analyzePhoto(bytes);
    if (!st) continue;
    statsList.push({ p, st });
    sharpMin = Math.min(sharpMin, st.sharpness);
    sharpMax = Math.max(sharpMax, st.sharpness);
  }
  for (const { p, st } of statsList) {
    const score = scorePhoto(st, sharpMin, sharpMax);
    const issues: string[] = [];
    if (st.brightness < 0.3) issues.push("dark");
    if (st.brightness > 0.72) issues.push("bright");
    if (st.contrast < 0.11) issues.push("flat");
    if (Math.abs(st.warmthCast) > 0.16) issues.push(st.warmthCast > 0 ? "warm cast" : "cool cast");
    rows.push({
      id: p.id, filename: p.filename, url: p.mediaType === "RAW" ? p.posterUrl : p.url, mediaType: p.mediaType, starred: p.starred,
      brightness: +st.brightness.toFixed(3), contrast: +st.contrast.toFixed(3), saturation: +st.saturation.toFixed(3),
      warmthCast: +st.warmthCast.toFixed(3), sharpness: +st.sharpness.toFixed(3),
      score, verdict: verdictFor(score), group: -1, groupBest: false, issues, hash: st.hash,
    });
  }

  // Duplicate groups: near identical hashes chain together; best score wins.
  let groupCount = 0;
  for (const row of rows) {
    if (row.group >= 0) continue;
    const members = rows.filter((r) => r.group < 0 && hashDistance(r.hash, row.hash) <= 14);
    if (members.length > 1) {
      const g = groupCount++;
      let best = members[0];
      for (const m of members) {
        m.group = g;
        if (m.score > best.score) best = m;
      }
      best.groupBest = true;
    }
  }
  for (const row of rows) if (row.group < 0) row.group = groupCount++;
  const out = rows.map(({ hash: _hash, ...rest }) => rest);
  return NextResponse.json({ photos: out, groups: groupCount, analysed: out.length });
}

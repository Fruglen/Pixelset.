import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { extractImageUrls, filenameFor } from "@/lib/picflow";

export const runtime = "nodejs";

// Phase 5A, Picflow gallery linking. Fetches a public gallery page, extracts
// the image URLs it references (img tags, srcset, and JSON blobs in the page),
// and creates photos in a chosen set as EXTERNAL references. No image file is
// ever downloaded or copied into Pixelset storage.

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const collection = await db.collection.findFirst({ where: { id: params.id, userId: user.id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const sync = body.sync === true;
  let sourceUrl = typeof body.url === "string" ? body.url.trim() : "";
  let setId = typeof body.setId === "string" ? body.setId : "";

  let set = setId
    ? await db.photoSet.findFirst({ where: { id: setId, collectionId: collection.id } })
    : null;

  if (sync) {
    if (!set || !set.externalSource) {
      return NextResponse.json({ error: "This set is not linked to an external gallery" }, { status: 400 });
    }
    sourceUrl = set.externalSource;
  } else {
    if (!/^https?:\/\//.test(sourceUrl)) {
      return NextResponse.json({ error: "Paste a full gallery URL (https://…)" }, { status: 400 });
    }
    if (setId && !set) return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  // Fetch the public gallery page. Never fake success: fetch problems and
  // empty extractions are reported exactly.
  let html: string;
  try {
    const res = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Pixelset gallery link)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `The gallery page could not be fetched (HTTP ${res.status})` },
        { status: 502 }
      );
    }
    html = await res.text();
  } catch (e) {
    return NextResponse.json(
      { error: `The gallery page could not be fetched: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }

  const urls = extractImageUrls(html, sourceUrl).slice(0, 500);
  if (urls.length === 0) {
    return NextResponse.json(
      { error: "No image URLs were found on that page. Make sure the gallery is public and the link is the gallery page itself." },
      { status: 422 }
    );
  }

  // Create the target set on first link when none was chosen
  if (!set) {
    const maxOrder = await db.photoSet.aggregate({
      where: { collectionId: collection.id },
      _max: { order: true },
    });
    set = await db.photoSet.create({
      data: {
        collectionId: collection.id,
        name: typeof body.newSetName === "string" && body.newSetName.trim() ? body.newSetName.trim().slice(0, 80) : "Picflow Gallery",
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
  }

  // Dedupe by URL against every photo already in the collection. Sync never
  // deletes anything; it only adds URLs not seen before.
  const existing = await db.photo.findMany({
    where: { collectionId: collection.id },
    select: { url: true },
  });
  const known = new Set(existing.map((p) => p.url));

  const maxPhotoOrder = await db.photo.aggregate({ where: { setId: set.id }, _max: { order: true } });
  let order = (maxPhotoOrder._max.order ?? -1) + 1;

  let added = 0;
  for (const url of urls) {
    if (known.has(url)) continue;
    known.add(url);
    await db.photo.create({
      data: {
        collectionId: collection.id,
        setId: set.id,
        filename: filenameFor(url),
        url,
        isExternal: true,
        mediaType: "IMAGE",
        order: order++,
      },
    });
    added++;
  }

  await db.photoSet.update({
    where: { id: set.id },
    data: { externalSource: sourceUrl, externalSyncedAt: new Date() },
  });

  return NextResponse.json({ ok: true, setId: set.id, found: urls.length, added, skipped: urls.length - added });
}

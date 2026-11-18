import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readGalleryAccess, ensureClientKey } from "@/lib/gallery-auth";
import { logActivity } from "@/lib/activity";
import { DOWNLOAD_SIZES } from "@/lib/design";
import { isExpired } from "@/lib/utils";
import { contentTypeFor } from "@/lib/media";

export const runtime = "nodejs";

type PhotoRec = {
  id: string;
  url: string;
  filename: string;
  isExternal: boolean;
  isPrivate: boolean;
  setId: string;
  mediaType: string;
};

async function photoBytes(photo: PhotoRec, px: number | null): Promise<Buffer | null> {
  let buffer: Buffer;
  if (!photo.isExternal && photo.url.startsWith("/uploads/")) {
    try {
      buffer = await readFile(path.join(process.cwd(), "public", photo.url));
    } catch {
      return null;
    }
  } else {
    try {
      const res = await fetch(photo.url);
      if (!res.ok) return null;
      buffer = Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  // Videos and RAW files always download as the original file; only images
  // are resized.
  if (px !== null && photo.mediaType === "IMAGE") {
    try {
      const sharp = (await import("sharp")).default;
      buffer = await sharp(buffer)
        .resize({ width: px, height: px, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch {
      // If resizing fails (e.g. unsupported format), serve as-is.
    }
  }
  return buffer;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const slug = sp.get("slug") || "";
  const sizeId = sp.get("size") || "original";
  const pin = sp.get("pin") || "";
  const qsToken = sp.get("qs") || "";
  const photoId = sp.get("photo");
  const all = sp.get("all") === "1";

  const collection = await db.collection.findUnique({
    where: { slug },
    include: { sets: true },
  });
  if (!collection) return NextResponse.json({ error: "Gallery not found" }, { status: 404 });

  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === collection.userId;
  const access = readGalleryAccess(collection.id);

  // Quick-share token check
  let quickPhotoIds: string[] | null = null;
  if (qsToken) {
    const qs = await db.quickShare.findUnique({ where: { token: qsToken } });
    if (qs && qs.collectionId === collection.id) {
      quickPhotoIds = qs.photoIds.split(",").filter(Boolean);
    }
  }

  // Access gates
  if (!isOwner && !quickPhotoIds) {
    if (collection.status !== "PUBLISHED" || isExpired(collection.expiresAt)) {
      return NextResponse.json({ error: "This gallery is not available" }, { status: 403 });
    }
    if (collection.password && !access.pw) {
      return NextResponse.json({ error: "Gallery is password protected" }, { status: 403 });
    }
  }

  if (!collection.downloadEnabled) {
    return NextResponse.json({ error: "Downloads are disabled for this gallery" }, { status: 403 });
  }
  if (!all && !collection.allowSingle) {
    return NextResponse.json({ error: "Single photo downloads are disabled" }, { status: 403 });
  }
  if (all && !collection.allowZip) {
    return NextResponse.json({ error: "Download All is disabled" }, { status: 403 });
  }

  // Size must be one the photographer offers. Video and RAW singles ignore the
  // size entirely (they always serve the original file), so the check is
  // deferred for them below.
  const offered = collection.downloadSizes.split(",").filter(Boolean);
  const sizeDef = DOWNLOAD_SIZES.find((s) => s.id === sizeId);
  const px = sizeDef?.px ?? null;

  // PIN check (owner bypasses)
  if (collection.pinEnabled && !isOwner) {
    if (!pin || pin !== collection.downloadPin) {
      return NextResponse.json({ error: "Incorrect download PIN" }, { status: 401 });
    }
    if (collection.pinUseLimit !== null && collection.pinUseCount >= collection.pinUseLimit) {
      return NextResponse.json(
        { error: "This download PIN has reached its use limit" },
        { status: 403 }
      );
    }
  }

  const clientKey = access.email || ensureClientKey();

  // Visible photos (exclusive sets only when unlocked; private only for owner)
  const unlockedSetIds = new Set(access.sets);
  const visibleSetIds = new Set(
    collection.sets
      .filter((s) => !s.clientExclusive || isOwner || unlockedSetIds.has(s.id))
      .map((s) => s.id)
  );

  if (!all) {
    // ----- Single photo -----
    if (!photoId) return NextResponse.json({ error: "Photo required" }, { status: 400 });
    const photo = await db.photo.findFirst({
      where: { id: photoId, collectionId: collection.id },
    });
    if (
      !photo ||
      (!isOwner && photo.isPrivate) ||
      !visibleSetIds.has(photo.setId) ||
      (quickPhotoIds && !quickPhotoIds.includes(photo.id))
    ) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    if (photo.mediaType === "IMAGE" && !offered.includes(sizeId)) {
      return NextResponse.json({ error: "That size is not offered" }, { status: 400 });
    }
    if (photo.mediaType === "VIDEO" && !collection.videoDownloadEnabled && !isOwner) {
      return NextResponse.json({ error: "Video downloads are disabled for this gallery" }, { status: 403 });
    }

    // Free-download cap: distinct photos downloaded by this client
    if (collection.freeDownloadCap !== null && !isOwner) {
      const logs = await db.downloadLog.findMany({
        where: { collectionId: collection.id, clientKey },
        select: { photoId: true },
      });
      const distinct = new Set(logs.map((l) => l.photoId).filter(Boolean));
      if (!distinct.has(photo.id) && distinct.size >= collection.freeDownloadCap) {
        return NextResponse.json(
          { error: `Free download limit reached (${collection.freeDownloadCap} photos).` },
          { status: 403 }
        );
      }
    }

    const bytes = await photoBytes(photo as PhotoRec, px);
    if (!bytes) return NextResponse.json({ error: "Could not fetch the photo file" }, { status: 502 });

    if (!isOwner) {
      if (collection.pinEnabled) {
        await db.collection.update({
          where: { id: collection.id },
          data: { pinUseCount: { increment: 1 } },
        });
      }
      await db.downloadLog.create({
        data: { collectionId: collection.id, photoId: photo.id, clientKey, size: sizeId },
      });
      await logActivity(
        collection.id,
        "DOWNLOAD",
        `${photo.filename} (${sizeDef?.label ?? sizeId})`,
        access.email
      );
    }

    const resized = px !== null && photo.mediaType === "IMAGE";
    const name = resized ? photo.filename.replace(/(\.[a-z0-9]+)?$/i, ".jpg") : photo.filename;
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": resized ? "image/jpeg" : contentTypeFor(photo.filename),
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  }

  if (!offered.includes(sizeId)) {
    return NextResponse.json({ error: "That size is not offered" }, { status: 400 });
  }

  // ----- Download All (ZIP) -----
  const photos = (await db.photo.findMany({
    where: { collectionId: collection.id },
    orderBy: { order: "asc" },
  })) as PhotoRec[];
  const downloadable = photos.filter(
    (p) =>
      visibleSetIds.has(p.setId) &&
      (isOwner || !p.isPrivate) &&
      (!quickPhotoIds || quickPhotoIds.includes(p.id)) &&
      // Videos follow their own master download switch in the ZIP too
      (p.mediaType !== "VIDEO" || collection.videoDownloadEnabled || isOwner)
  );
  if (downloadable.length === 0) {
    return NextResponse.json({ error: "No downloadable photos" }, { status: 404 });
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const misses: string[] = [];
  for (const photo of downloadable) {
    const bytes = await photoBytes(photo, px);
    if (bytes) {
      const resized = px !== null && photo.mediaType === "IMAGE";
      const name = resized ? photo.filename.replace(/(\.[a-z0-9]+)?$/i, ".jpg") : photo.filename;
      zip.file(name, bytes);
    } else {
      misses.push(photo.filename);
    }
  }
  if (misses.length > 0) {
    zip.file(
      "_missing-files.txt",
      `These photos could not be fetched at download time:\n${misses.join("\n")}\n`
    );
  }
  const archive = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });

  if (!isOwner) {
    if (collection.pinEnabled) {
      await db.collection.update({
        where: { id: collection.id },
        data: { pinUseCount: { increment: 1 } },
      });
    }
    await db.downloadLog.create({
      data: { collectionId: collection.id, photoId: "", clientKey, size: `zip:${sizeId}` },
    });
    await logActivity(
      collection.id,
      "DOWNLOAD_ALL",
      `${downloadable.length} photos as ZIP (${sizeDef?.label ?? sizeId})`,
      access.email
    );
  }

  return new NextResponse(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${collection.slug}.zip"`,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readGalleryAccess, ensureClientKey } from "@/lib/gallery-auth";
import { logActivity } from "@/lib/activity";
import { DOWNLOAD_SIZES } from "@/lib/design";
import { isExpired, isMobileUserAgent } from "@/lib/utils";
import { contentTypeFor } from "@/lib/media";
import { watermarkFromUser } from "@/lib/watermark";
import { buildZip, renderDownload, runDownloadJob, splitParts, type DownloadPhoto, type RenderOpts } from "@/lib/zip";
import { GALLERY_LIMITS, parsePlan } from "@/lib/plans";
import { clearFailures, rateLimitKey, recordFailure, retryAfterSeconds, tooManyAttempts } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Gallery downloads: single files, Download All (optionally split into parts,
// or prepared in the background and delivered by an emailed link), and
// favorite list ZIPs. Every rule from Collection Settings is enforced here.

function err(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const slug = sp.get("slug") || "";
  let sizeId = sp.get("size") || "original";
  const pin = sp.get("pin") || "";
  const qsToken = sp.get("qs") || "";
  const photoId = sp.get("photo");
  const listId = sp.get("list") || "";
  const all = sp.get("all") === "1" || !!listId;
  const partParam = sp.get("part");
  const wantManifest = sp.get("manifest") === "1";
  const emailDelivery = sp.get("email") === "1";

  const collection = await db.collection.findUnique({
    where: { slug },
    include: { sets: true, user: true },
  });
  if (!collection) return err("Gallery not found", 404);

  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === collection.userId;
  const access = readGalleryAccess(collection.id);
  const group = access.group ? await db.accessGroup.findFirst({ where: { id: access.group, collectionId: collection.id } }) : null;

  let quickPhotoIds: string[] | null = null;
  if (qsToken) {
    const qs = await db.quickShare.findUnique({ where: { token: qsToken } });
    if (qs && qs.collectionId === collection.id) quickPhotoIds = qs.photoIds.split(",").filter(Boolean);
  }

  if (!isOwner && !quickPhotoIds) {
    if (collection.status !== "PUBLISHED" || isExpired(collection.expiresAt)) return err("This gallery is not available", 403);
    if (collection.password && !access.pw) return err("Gallery is password protected", 403);
  }

  if (!collection.downloadEnabled && !isOwner) return err("Downloads are disabled for this gallery", 403);
  if (group && !group.canDownload && !isOwner) return err(`Downloads are not included for ${group.name}`, 403);
  if (!all && !collection.allowSingle && !isOwner) return err("Single photo downloads are disabled", 403);
  if (all && !listId && !collection.allowZip && !isOwner) return err("Download All is disabled", 403);
  if (listId && !collection.favoritesEnabled && !isOwner) return err("Favorites are turned off for this gallery", 403);

  // Full gallery ZIPs are a desktop feature (researched behaviour): explain on phones.
  // Phase 5B platform: the emailed link is the phone friendly route, so it is always allowed.
  if (all && !emailDelivery && collection.desktopOnlyZip && !isOwner && isMobileUserAgent(req.headers.get("user-agent"))) {
    return err(
      "Download All is available on a computer. On this phone, open a photo and use Download to save it to your camera roll, or ask for the download link by email.",
      403,
      { desktopOnly: true }
    );
  }

  // Restrict downloads to clients only: registered email plus PIN.
  if (collection.clientOnlyDownloads && !isOwner && !access.email) {
    return err("Downloads are for registered clients. Enter your email first.", 401, { needsEmail: true });
  }

  const offered = collection.downloadSizes.split(",").filter(Boolean);
  const groupSizes = group ? group.downloadSizes.split(",").filter(Boolean) : null;
  if (groupSizes && !isOwner && !groupSizes.includes(sizeId)) {
    if (groupSizes.length === 0) return err(`Downloads are not included for ${group!.name}`, 403);
    sizeId = groupSizes[0];
  }

  // Plan cap: free Client Gallery plans download at most 3600px.
  const plan = parsePlan(collection.user.plan);
  const capPx = GALLERY_LIMITS[plan.gallery].maxDownloadPx;
  let sizeDef = DOWNLOAD_SIZES.find((s) => s.id === sizeId);
  if (capPx && sizeId === "original") {
    sizeId = "high3600";
    sizeDef = DOWNLOAD_SIZES.find((s) => s.id === "high3600");
  }
  const px = sizeDef?.px ?? null;

  let pinUnlocked = false;
  if ((collection.pinEnabled || collection.clientOnlyDownloads) && collection.downloadPin && !isOwner) {
    // GLE-118: only a PIN actually submitted counts. The first click carries no
    // PIN and must not burn an attempt. No await between check and record.
    if (!pin) return err("Incorrect download PIN", 401);
    const pinKey = rateLimitKey("download-pin", req.headers, collection.id);
    const retryAfter = retryAfterSeconds(pinKey);
    if (retryAfter > 0) return tooManyAttempts(retryAfter);
    if (pin !== collection.downloadPin) {
      recordFailure(pinKey);
      return err("Incorrect download PIN", 401);
    }
    clearFailures(pinKey);
    if (collection.pinUseLimit !== null && collection.pinUseCount >= collection.pinUseLimit) {
      return err("This download PIN has reached its use limit", 403);
    }
    pinUnlocked = true;
  }

  const clientKey = access.email || ensureClientKey();
  const unlockedSetIds = new Set(access.sets);
  const groupSetIds = group ? group.setIds.split(",").filter(Boolean) : [];
  const visibleSetIds = new Set(
    collection.sets
      .filter((s) => !s.clientExclusive || isOwner || unlockedSetIds.has(s.id))
      .filter((s) => isOwner || !group || groupSetIds.length === 0 || groupSetIds.includes(s.id))
      .map((s) => s.id)
  );

  // Watermark on web sizes (photographer's choice); PIN-unlocked and owner downloads stay clean.
  const wmSizes = collection.user.watermarkSizes.split(",");
  const renderOpts: RenderOpts = {
    px,
    watermark: !isOwner && !pinUnlocked && wmSizes.includes(sizeId) ? watermarkFromUser(collection.user) : null,
    collectionWatermark: collection.watermark,
  };

  async function chargePin() {
    if (collection!.pinEnabled && !isOwner) {
      await db.collection.update({ where: { id: collection!.id }, data: { pinUseCount: { increment: 1 } } });
    }
  }

  if (!all) {
    if (!photoId) return err("Photo required", 400);
    const photo = await db.photo.findFirst({ where: { id: photoId, collectionId: collection.id } });
    if (!photo || (!isOwner && photo.isPrivate) || !visibleSetIds.has(photo.setId) || (quickPhotoIds && !quickPhotoIds.includes(photo.id))) {
      return err("Photo not found", 404);
    }
    if (!isOwner && photo.mediaType === "IMAGE" && !offered.includes(sizeId) && !(capPx && sizeId === "high3600" && offered.includes("original"))) {
      return err("That size is not offered", 400);
    }
    if (photo.mediaType === "VIDEO" && !collection.videoDownloadEnabled && !isOwner) return err("Video downloads are disabled for this gallery", 403);

    if (collection.freeDownloadCap !== null && !isOwner) {
      const logs = await db.downloadLog.findMany({ where: { collectionId: collection.id, clientKey }, select: { photoId: true } });
      const distinct = new Set(logs.map((l) => l.photoId).filter(Boolean));
      if (!distinct.has(photo.id) && distinct.size >= collection.freeDownloadCap) {
        return err(`Free download limit reached (${collection.freeDownloadCap} photos).`, 403);
      }
    }

    const r = await renderDownload(photo as DownloadPhoto, renderOpts);
    if (!r) return err("Could not fetch the photo file", 502);

    if (!isOwner) {
      await chargePin();
      await db.downloadLog.create({ data: { collectionId: collection.id, photoId: photo.id, clientKey, size: sizeId } });
      await logActivity(collection.id, "DOWNLOAD", `${photo.filename} (${sizeDef?.label ?? sizeId})`, access.email);
    }
    return new NextResponse(new Uint8Array(r.bytes), {
      headers: {
        "Content-Type": r.type || contentTypeFor(r.name),
        "Content-Disposition": `attachment; filename="${r.name}"`,
      },
    });
  }

  if (!offered.includes(sizeId) && !(capPx && sizeId === "high3600" && offered.includes("original"))) {
    return err("That size is not offered", 400);
  }

  // ----- Download All / favorite list ZIP -----
  let photos = (await db.photo.findMany({
    where: { collectionId: collection.id },
    orderBy: [{ setId: "asc" }, { order: "asc" }],
  })) as DownloadPhoto[];
  let label = collection.slug;
  if (listId) {
    const list = await db.favoriteList.findFirst({ where: { id: listId, collectionId: collection.id }, include: { favorites: true } });
    if (!list) return err("Favorite list not found", 404);
    if (!isOwner && list.clientEmail !== access.email) return err("This list belongs to another client", 403);
    const inList = new Set(list.favorites.map((f) => f.photoId));
    photos = photos.filter((p) => inList.has(p.id));
    label = `${collection.slug}-${list.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  }
  const downloadable = photos.filter(
    (p) =>
      visibleSetIds.has(p.setId) &&
      (isOwner || !p.isPrivate) &&
      (!quickPhotoIds || quickPhotoIds.includes(p.id)) &&
      (p.mediaType !== "VIDEO" || collection.videoDownloadEnabled || isOwner)
  );
  if (downloadable.length === 0) return err("No downloadable photos", 404);

  // Free download cap: every photo inside a ZIP counts against the cap.
  if (collection.freeDownloadCap !== null && !isOwner) {
    const logs = await db.downloadLog.findMany({ where: { collectionId: collection.id, clientKey }, select: { photoId: true } });
    const distinct = new Set(logs.map((l) => l.photoId).filter(Boolean));
    const fresh = downloadable.filter((p) => !distinct.has(p.id)).length;
    const remaining = Math.max(0, collection.freeDownloadCap - distinct.size);
    if (fresh > remaining) {
      return err(
        `This gallery allows ${collection.freeDownloadCap} free downloads per client. You have ${remaining} left, and this ZIP holds ${fresh} new photo${fresh === 1 ? "" : "s"}. Download individual photos instead.`,
        403
      );
    }
  }

  const parts = splitParts(downloadable, collection.zipPartSize);
  if (wantManifest) {
    return NextResponse.json({ total: downloadable.length, parts: parts.map((p, i) => ({ part: i + 1, files: p.length })) });
  }

  // Background build + emailed link.
  if (emailDelivery) {
    const to = (sp.get("to") || access.email || "").toLowerCase().trim();
    if (!to.includes("@")) return err("Enter the email address the download link should go to", 400, { needsEmail: true });
    const job = await db.downloadJob.create({
      data: {
        collectionId: collection.id,
        token: randomBytes(16).toString("hex"),
        email: to,
        size: sizeId,
        photoIds: downloadable.map((p) => p.id).join(","),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });
    if (!isOwner) {
      await chargePin();
      await db.downloadLog.createMany({ data: downloadable.map((p) => ({ collectionId: collection.id, photoId: p.id, clientKey, size: `zip:${sizeId}` })) });
    }
    // Build after responding; the server keeps running the job.
    setTimeout(() => {
      runDownloadJob(job.id).catch(() => {});
    }, 10);
    return NextResponse.json({ ok: true, queued: true, token: job.token, link: `/d/${job.token}`, email: to });
  }

  const partIndex = partParam ? Math.max(1, Math.min(parts.length, Number(partParam) || 1)) : 1;
  if (parts.length > 1 && !partParam) {
    return err(`This download is split into ${parts.length} ZIP files. Choose a part.`, 409, {
      parts: parts.map((p, i) => ({ part: i + 1, files: p.length })),
    });
  }
  const chosen = parts[partIndex - 1];
  const { archive, count } = await buildZip(chosen, renderOpts);

  if (!isOwner) {
    if (partIndex === 1) await chargePin();
    await db.downloadLog.createMany({ data: chosen.map((p) => ({ collectionId: collection.id, photoId: p.id, clientKey, size: `zip:${sizeId}` })) });
    await logActivity(
      collection.id,
      "DOWNLOAD_ALL",
      `${count} ${listId ? "favorites" : "photos"} as ZIP${parts.length > 1 ? ` (part ${partIndex} of ${parts.length})` : ""} (${sizeDef?.label ?? sizeId})`,
      access.email
    );
  }
  const name = parts.length > 1 ? `${label}-part-${partIndex}-of-${parts.length}.zip` : `${label}.zip`;
  return new NextResponse(new Uint8Array(archive), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"` },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { normalizeLang } from "@/lib/gallery-i18n";
import { rm } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { slugify, generatePin, endOfDay } from "@/lib/utils";
import { permissionError } from "@/lib/team";
import { deletePrefix } from "@/lib/storage";

async function ownedCollection(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const collection = await db.collection.findFirst({ where: { id, userId: user.id } });
  return collection;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const collection = await ownedCollection(params.id);
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.slug === "string" && body.slug.trim()) {
    const next = slugify(body.slug);
    if (next !== collection.slug) {
      const clash = await db.collection.findUnique({ where: { slug: next } });
      if (clash && clash.id !== collection.id) {
        return NextResponse.json({ error: "That URL is already in use" }, { status: 409 });
      }
      data.slug = next;
    }
  }
  if ("eventDate" in body) {
    data.eventDate = body.eventDate ? new Date(`${body.eventDate}T12:00:00`) : null;
  }
  if (typeof body.status === "string" && ["DRAFT", "PRERELEASE", "PUBLISHED"].includes(body.status)) {
    data.status = body.status;
    if (body.status === "PUBLISHED" && !collection.publishedAt) data.publishedAt = new Date();
  }
  if ("folderId" in body) data.folderId = body.folderId || null;

  // Design
  for (const key of ["coverStyle", "fontPairing", "palette", "gridStyle", "thumbSize", "gridSpacing", "coverVideoUrl", "coverImageUrl", "navStyle", "language"]) {
    if (typeof body[key] === "string") data[key] = body[key];
  }
  // Fix batch 2026-11-20: only supported gallery languages are stored
  if (typeof body.language === "string") data.language = normalizeLang(body.language);
  // Phase 5B gallery switches
  for (const key of ["coverAnimation", "seoIndexing", "showOnHomepage", "clientOnlyDownloads", "emailedDownloadAll", "desktopOnlyZip", "favoritesEnabled", "socialSharing", "campaignOptIn", "galleryAssist", "starred"]) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }
  if (typeof body.zipPartSize === "number") data.zipPartSize = Math.min(2000, Math.max(10, Math.round(body.zipPartSize)));
  if ("coverPhotoId" in body) data.coverPhotoId = body.coverPhotoId || null;
  if (typeof body.focalX === "number") data.focalX = Math.min(1, Math.max(0, body.focalX));
  if (typeof body.focalY === "number") data.focalY = Math.min(1, Math.max(0, body.focalY));

  // Privacy
  if (typeof body.password === "string") data.password = body.password;
  for (const key of ["emailRegistration", "watermark", "downloadEnabled", "pinEnabled", "allowSingle", "allowZip", "videoDownloadEnabled", "expiryReminder"]) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }

  // Download
  if ("pinUseLimit" in body) data.pinUseLimit = body.pinUseLimit === null ? null : Number(body.pinUseLimit) || null;
  if ("freeDownloadCap" in body) data.freeDownloadCap = body.freeDownloadCap === null ? null : Number(body.freeDownloadCap) || null;
  if (typeof body.downloadSizes === "string" && body.downloadSizes) data.downloadSizes = body.downloadSizes;

  // Auto-generate PIN when enabling and none exists
  const pinTurningOn = data.pinEnabled === true || (collection.pinEnabled && data.pinEnabled !== false);
  if (pinTurningOn && !collection.downloadPin) {
    data.downloadPin = generatePin();
  }

  // Expiry, hides at 11:59pm local on the chosen date
  if ("expiresAt" in body) {
    const owner = await db.user.findUnique({ where: { id: collection.userId }, select: { timezone: true } });
    data.expiresAt = body.expiresAt ? endOfDay(body.expiresAt, owner?.timezone || undefined) : null;
    // A new expiry date re-arms the automated reminder.
    if (String(data.expiresAt) !== String(collection.expiresAt)) data.expiryReminderSentAt = null;
  }
  if (typeof body.expiryReminderDays === "number") data.expiryReminderDays = Math.min(60, Math.max(0, Math.round(body.expiryReminderDays)));

  // Store + slideshow (Phase 4)
  for (const key of ["storeEnabled", "slideshowEnabled"]) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }
  if (typeof body.slideshowMusicUrl === "string") data.slideshowMusicUrl = body.slideshowMusicUrl.trim();
  if ("priceSheetId" in body) {
    if (!body.priceSheetId) {
      data.priceSheetId = null;
    } else {
      const sheet = await db.priceSheet.findFirst({
        where: { id: String(body.priceSheetId), userId: collection.userId },
      });
      if (!sheet) return NextResponse.json({ error: "Unknown price sheet" }, { status: 400 });
      data.priceSheetId = sheet.id;
    }
  }

  const updated = await db.collection.update({ where: { id: collection.id }, data });
  return NextResponse.json({ ok: true, slug: updated.slug, downloadPin: updated.downloadPin });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const collection = await ownedCollection(params.id);
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await permissionError("delete");
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });
  await db.collection.delete({ where: { id: collection.id } });
  // Remove uploaded files for this collection (local disk and B2)
  try {
    await rm(path.join(process.cwd(), "public", "uploads", collection.id), {
      recursive: true,
      force: true,
    });
  } catch {}
  await deletePrefix(`uploads/${collection.id}/`).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

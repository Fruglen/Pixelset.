import { mkdir, rename, stat, rm, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { db } from "./db";
import { warmRenditions } from "./previews";
import { makeRawPreviewFromFile } from "./raw-preview";
import {
  makeVideoPoster,
  mediaTypeFor,
  probeVideoDuration,
  probeVideoSize,
  transcodeToMp4,
  uploadLimitBytes,
  fileExt,
} from "./media";
import { GALLERY_LIMITS, effectiveGalleryLimits, planFor, videoHoursUsed } from "./plans";
import { b2Enabled, deleteKey, getBytes, getBytesRange, getToFile, headSize, presignGet, putFile, storedUrlFor } from "./storage";

// Phase 5B: one upload pipeline for every entry point (dashboard multipart,
// chunked/resumable background uploads, the Lightroom plugin API, the mobile
// camera upload screen). Enforces format/size limits and plan caps, then
// writes the Photo row.

export function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "photo.jpg";
}

export function uploadsDir(collectionId: string) {
  return path.join(process.cwd(), "public", "uploads", collectionId);
}

export interface UploadOutcome {
  ok: boolean;
  photoId?: string;
  error?: string;
}

/**
 * Validate an incoming file before any bytes are stored. Returns an error
 * string when the file must be rejected.
 */
export async function precheckUpload(userId: string, name: string, mime: string, size: number): Promise<string | null> {
  const mediaType = mediaTypeFor(name, mime);
  if (!mediaType) return `${name}: unsupported file type`;
  const limit = uploadLimitBytes(name, mediaType);
  if (size > limit) {
    return `${name}: ${(size / 1024 / 1024).toFixed(1)} MB is over the ${Math.round(limit / 1024 / 1024)} MB limit for ${fileExt(name).toUpperCase() || mediaType} files`;
  }
  // Night build (Pricing lane): the video allowance includes any extra
  // video hours bought as an add-on (effectiveGalleryLimits merges them).
  const { limits: caps } = await effectiveGalleryLimits(userId);
  if (mediaType === "RAW" && !caps.raw) return `${name}: RAW uploads need the Client Gallery Pro plan or higher`;
  if (mediaType === "VIDEO") {
    if (caps.videoHours <= 0) return `${name}: video uploads need the Client Gallery Plus plan or higher`;
    const used = await videoHoursUsed(userId);
    if (used >= caps.videoHours) {
      return `${name}: your ${caps.videoHours} hour video allowance is used up (${used.toFixed(2)} h stored)`;
    }
  }
  return null;
}

/**
 * Move an already-written temp file into the collection and create the Photo.
 * `tmpPath` must be on the same filesystem as public/uploads.
 */
export async function ingestFile(opts: {
  userId: string;
  collectionId: string;
  setId: string;
  tmpPath: string;
  originalName: string;
  mime: string;
}): Promise<UploadOutcome> {
  const { userId, collectionId, setId, tmpPath, originalName, mime } = opts;
  const mediaType = mediaTypeFor(originalName, mime);
  if (!mediaType) {
    await rm(tmpPath, { force: true });
    return { ok: false, error: `${originalName}: unsupported file type` };
  }
  const size = (await stat(tmpPath)).size;
  const pre = await precheckUpload(userId, originalName, mime, size);
  if (pre) {
    await rm(tmpPath, { force: true });
    return { ok: false, error: pre };
  }

  const dir = uploadsDir(collectionId);
  await mkdir(dir, { recursive: true });
  const base = safeName(originalName || "photo.jpg");
  let stored = `${randomBytes(6).toString("hex")}-${base}`;
  let storedPath = path.join(dir, stored);
  await rename(tmpPath, storedPath);

  let width: number | null = null;
  let height: number | null = null;
  let durationSec: number | null = null;
  let posterUrl = "";
  let sidecar = ""; // poster / RAW preview filename alongside `stored`

  if (mediaType === "IMAGE") {
    try {
      const sharp = (await import("sharp")).default;
      const meta = await sharp(storedPath).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {}
  } else if (mediaType === "VIDEO") {
    if (fileExt(base) === "avi") {
      // Browsers cannot play AVI: keep the original for download, play an MP4 copy.
      const mp4 = stored.replace(/\.avi$/i, "") + "-play.mp4";
      if (await transcodeToMp4(storedPath, path.join(dir, mp4))) {
        await rm(storedPath, { force: true });
        stored = mp4;
        storedPath = path.join(dir, mp4);
      }
    }
    durationSec = await probeVideoDuration(storedPath);
    const vsize = await probeVideoSize(storedPath);
    width = vsize?.width ?? null;
    height = vsize?.height ?? null;
    const plan = await planFor(userId);
    const caps = GALLERY_LIMITS[plan.gallery];
    const longEdge = Math.max(width ?? 0, height ?? 0);
    if (longEdge > 4096 || (!caps.video4k && longEdge > 1920)) {
      await rm(storedPath, { force: true });
      return {
        ok: false,
        error:
          longEdge > 4096
            ? `${originalName}: videos are accepted up to 4K (4096 px), this one is ${width}x${height}`
            : `${originalName}: 4K video needs the Client Gallery Pro plan or higher`,
      };
    }
    const posterStored = `${stored.replace(/\.[^.]+$/, "")}-poster.jpg`;
    if (await makeVideoPoster(storedPath, path.join(dir, posterStored))) {
      sidecar = posterStored;
      posterUrl = `/uploads/${collectionId}/${posterStored}`;
    }
  } else if (mediaType === "RAW") {
    const previewStored = `${stored.replace(/\.[^.]+$/, "")}-preview.jpg`;
    const dims = await makeRawPreviewFromFile(storedPath, path.join(dir, previewStored));
    if (dims) {
      sidecar = previewStored;
      posterUrl = `/uploads/${collectionId}/${previewStored}`;
      width = dims.width;
      height = dims.height;
    }
  }

  // Final storage: with B2 configured the processed file (and its poster /
  // preview sidecar) is streamed into the bucket and the local copies are
  // removed; the Photo row then points at /media/<key>, served immediately.
  let url = `/uploads/${collectionId}/${stored}`;
  if (b2Enabled()) {
    const key = `uploads/${collectionId}/${stored}`;
    try {
      await putFile(key, storedPath);
      if (sidecar) {
        const sideKey = `uploads/${collectionId}/${sidecar}`;
        await putFile(sideKey, path.join(dir, sidecar));
        posterUrl = storedUrlFor(sideKey);
        await rm(path.join(dir, sidecar), { force: true });
      }
      url = storedUrlFor(key);
      await rm(storedPath, { force: true });
    } catch {
      // Bucket write failed: keep the local file and the legacy URL so the
      // upload still succeeds (it will serve after the next restart).
    }
  }

  const maxOrder = await db.photo.aggregate({ where: { setId }, _max: { order: true } });
  const photo = await db.photo.create({
    data: {
      collectionId,
      setId,
      filename: base,
      url,
      isExternal: false,
      width,
      height,
      mediaType,
      durationSec,
      posterUrl,
      fileSize: size,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  // Fix batch 2026-11-20: generate the 640/1024/2048 preview renditions now, in the background.
  if (mediaType === "IMAGE" || (mediaType === "RAW" && posterUrl)) void warmRenditions(photo.id);
  return { ok: true, photoId: photo.id };
}

/** Write a Web File to a temp path inside the uploads tree (same filesystem). */
export async function fileToTemp(file: File): Promise<string> {
  const tmpDir = path.join(process.cwd(), ".uploads-tmp");
  await mkdir(tmpDir, { recursive: true });
  const p = path.join(tmpDir, `${randomBytes(8).toString("hex")}.part`);
  await writeFile(p, Buffer.from(await file.arrayBuffer()));
  return p;
}

export function chunkDir(uploadId: string) {
  return path.join(process.cwd(), ".uploads-tmp", `chunks-${uploadId.replace(/[^a-zA-Z0-9_-]/g, "")}`);
}

/**
 * Finish a direct-to-B2 upload: the browser has already put the bytes in the
 * bucket through presigned multipart URLs, so nothing streams through this
 * server. We verify the object, probe its metadata in place (ffprobe reads
 * the presigned URL; image dimensions come from a ranged GET), generate the
 * poster / RAW preview sidecar, and create the Photo row pointing at
 * /media/<key>. On a validation failure the object is deleted.
 */
export async function finalizeDirectUpload(opts: {
  userId: string;
  collectionId: string;
  setId: string;
  key: string;
  originalName: string;
  mime: string;
  size: number;
}): Promise<UploadOutcome> {
  const { userId, collectionId, setId, key, originalName, mime, size } = opts;
  const fail = async (error: string): Promise<UploadOutcome> => {
    await deleteKey(key);
    return { ok: false, error };
  };
  const mediaType = mediaTypeFor(originalName, mime);
  if (!mediaType) return fail(`${originalName}: unsupported file type`);
  const pre = await precheckUpload(userId, originalName, mime, size);
  if (pre) return fail(pre);
  const actual = await headSize(key);
  if (actual === null) return { ok: false, error: `${originalName}: the upload did not reach storage, please try again` };
  if (size > 0 && actual !== size) return fail(`${originalName}: the stored file does not match its size, please upload it again`);

  const base = safeName(originalName || "photo.jpg");
  let finalKey = key;
  let width: number | null = null;
  let height: number | null = null;
  let durationSec: number | null = null;
  let posterUrl = "";

  if (mediaType === "IMAGE") {
    try {
      const sharp = (await import("sharp")).default;
      const head = await getBytesRange(key, 512 * 1024);
      let meta = head ? await sharp(head).metadata().catch(() => null) : null;
      if (!meta) {
        const full = await getBytes(key);
        if (full) meta = await sharp(full).metadata().catch(() => null);
      }
      width = meta?.width ?? null;
      height = meta?.height ?? null;
    } catch {}
  } else if (mediaType === "VIDEO") {
    const readUrl = await presignGet(key, 1800);
    if (fileExt(base) === "avi") {
      // Browsers cannot play AVI: transcode from the presigned URL into a
      // local temp MP4, then stream it back up as the playable copy.
      const tmpMp4 = path.join(process.cwd(), ".uploads-tmp", `${randomBytes(8).toString("hex")}-play.mp4`);
      await mkdir(path.dirname(tmpMp4), { recursive: true });
      if (await transcodeToMp4(readUrl, tmpMp4)) {
        const mp4Key = key.replace(/\.avi$/i, "") + "-play.mp4";
        await putFile(mp4Key, tmpMp4);
        await deleteKey(key);
        finalKey = mp4Key;
      }
      await rm(tmpMp4, { force: true });
    }
    const finalReadUrl = finalKey === key ? readUrl : await presignGet(finalKey, 1800);
    durationSec = await probeVideoDuration(finalReadUrl);
    const vsize = await probeVideoSize(finalReadUrl);
    width = vsize?.width ?? null;
    height = vsize?.height ?? null;
    const plan = await planFor(userId);
    const caps = GALLERY_LIMITS[plan.gallery];
    const longEdge = Math.max(width ?? 0, height ?? 0);
    if (longEdge > 4096 || (!caps.video4k && longEdge > 1920)) {
      return fail(
        longEdge > 4096
          ? `${originalName}: videos are accepted up to 4K (4096 px), this one is ${width}x${height}`
          : `${originalName}: 4K video needs the Client Gallery Pro plan or higher`
      );
    }
    const posterKey = finalKey.replace(/\.[^.]+$/, "") + "-poster.jpg";
    const tmpPoster = path.join(process.cwd(), ".uploads-tmp", `${randomBytes(8).toString("hex")}-poster.jpg`);
    await mkdir(path.dirname(tmpPoster), { recursive: true });
    if (await makeVideoPoster(finalReadUrl, tmpPoster)) {
      await putFile(posterKey, tmpPoster);
      posterUrl = storedUrlFor(posterKey);
    }
    await rm(tmpPoster, { force: true });
  } else if (mediaType === "RAW") {
    const tmpRaw = path.join(process.cwd(), ".uploads-tmp", `${randomBytes(8).toString("hex")}-raw`);
    const tmpPreview = `${tmpRaw}-preview.jpg`;
    await mkdir(path.dirname(tmpRaw), { recursive: true });
    try {
      if (await getToFile(key, tmpRaw)) {
        const dims = await makeRawPreviewFromFile(tmpRaw, tmpPreview);
        if (dims) {
          try {
            const previewKey = key.replace(/\.[^.]+$/, "") + "-preview.jpg";
            await putFile(previewKey, tmpPreview);
            posterUrl = storedUrlFor(previewKey);
            width = dims.width;
            height = dims.height;
          } catch {}
        }
      }
    } finally {
      await rm(tmpRaw, { force: true });
      await rm(tmpPreview, { force: true });
    }
  }

  const maxOrder = await db.photo.aggregate({ where: { setId }, _max: { order: true } });
  const photo = await db.photo.create({
    data: {
      collectionId,
      setId,
      filename: base,
      url: storedUrlFor(finalKey),
      isExternal: false,
      width,
      height,
      mediaType,
      durationSec,
      posterUrl,
      fileSize: actual,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  // Fix batch 2026-11-20: generate the 640/1024/2048 preview renditions now, in the background.
  if (mediaType === "IMAGE" || (mediaType === "RAW" && posterUrl)) void warmRenditions(photo.id);
  return { ok: true, photoId: photo.id };
}

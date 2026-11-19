import { mkdir, rename, stat, rm, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { db } from "./db";
import {
  makeRawPreview,
  makeVideoPoster,
  mediaTypeFor,
  probeVideoDuration,
  probeVideoSize,
  transcodeToMp4,
  uploadLimitBytes,
  fileExt,
} from "./media";
import { GALLERY_LIMITS, effectiveGalleryLimits, planFor, videoHoursUsed } from "./plans";

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
      posterUrl = `/uploads/${collectionId}/${posterStored}`;
    }
  } else if (mediaType === "RAW") {
    const previewStored = `${stored.replace(/\.[^.]+$/, "")}-preview.jpg`;
    const { readFile } = await import("fs/promises");
    if (await makeRawPreview(await readFile(storedPath), path.join(dir, previewStored))) {
      posterUrl = `/uploads/${collectionId}/${previewStored}`;
      try {
        const sharp = (await import("sharp")).default;
        const meta = await sharp(path.join(dir, previewStored)).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
      } catch {}
    }
  }

  const maxOrder = await db.photo.aggregate({ where: { setId }, _max: { order: true } });
  const photo = await db.photo.create({
    data: {
      collectionId,
      setId,
      filename: base,
      url: `/uploads/${collectionId}/${stored}`,
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

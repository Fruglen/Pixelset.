import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { loadPhotoBytes } from "./watermark";

// Phase 5B platform: photographer controlled preview renditions.
//
// Gallery previews are generated with sharp at the photographer's chosen
// longest edge and JPEG quality (Settings, Gallery, Preview quality) and
// cached on disk. Originals are never touched and still download untouched.

export const PREVIEW_SIZES = [1024, 1600, 2048, 2560, 3200];
// Fix batch 2026-11-20 (client complaint 6): three standard renditions,
// generated at upload time: 640 for grids, 1024 for large grids and phones,
// 2048 for the full screen view. Larger account sizes add 2560 and 3200.
export const STANDARD_RENDITIONS = [640, 1024, 2048];
export const PREVIEW_WIDTHS = [640, 1024, 2048, 2560, 3200];
export const QUALITY_MIN = 60;
export const QUALITY_MAX = 95;

export function clampPreviewSize(n: number): number {
  return PREVIEW_SIZES.includes(n) ? n : 2048;
}
export function clampQuality(n: number): number {
  return Math.min(QUALITY_MAX, Math.max(QUALITY_MIN, Math.round(n || 85)));
}

/** Pick the rendition width for a request: the next standard width, capped by the account size. */
export function renditionWidth(asked: number, maxSize: number): number {
  const w = PREVIEW_WIDTHS.find((x) => x >= (asked || 1600)) ?? PREVIEW_WIDTHS[PREVIEW_WIDTHS.length - 1];
  return Math.min(w, clampPreviewSize(maxSize));
}

export function renditionFile(photoId: string, width: number, quality: number): string {
  return path.join(process.cwd(), ".cache", "preview", `${photoId}-${width}-q${quality}.jpg`);
}

/** True when the rendition is already on disk (generated at upload or on an earlier view). */
export async function renditionCached(photoId: string, width: number, quality: number): Promise<boolean> {
  try {
    await stat(renditionFile(photoId, width, quality));
    return true;
  } catch {
    return false;
  }
}

/** The widths generated for an account: the standard set, capped by its preview size. */
export function accountRenditionWidths(previewSize: number): number[] {
  const max = clampPreviewSize(previewSize);
  return Array.from(new Set(STANDARD_RENDITIONS.map((w) => Math.min(w, max))));
}

// One rendition job at a time per process: an upload burst must not run
// dozens of sharp resizes in parallel on a small instance.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Generate a photo's standard renditions at the account's quality setting.
 * Runs in the background after an upload is stored; failures are harmless
 * because the preview route renders any missing rendition on first view.
 */
export function warmRenditions(photoId: string): Promise<number[]> {
  const job = queue.then(async () => {
    const photo = await (await import("./db")).db.photo.findUnique({
      where: { id: photoId },
      include: { collection: { select: { user: { select: { previewSize: true, previewQuality: true } } } } },
    });
    if (!photo) return [];
    const src = photo.mediaType === "RAW" ? photo.posterUrl : photo.mediaType === "IMAGE" ? photo.url : "";
    if (!src || /\.gif$/i.test(src)) return [];
    const quality = clampQuality(photo.collection.user.previewQuality);
    const done: number[] = [];
    for (const w of accountRenditionWidths(photo.collection.user.previewSize)) {
      const out = await previewRendition({ id: photo.id, url: src, isExternal: photo.isExternal && photo.mediaType === "IMAGE" }, w, quality);
      if (out) done.push(w);
    }
    return done;
  });
  queue = job.catch(() => undefined);
  return job.catch(() => []);
}

/** Cached JPEG rendition of a photo at a width and quality. */
export async function previewRendition(
  photo: { id: string; url: string; isExternal: boolean },
  width: number,
  quality: number
): Promise<Buffer | null> {
  const file = renditionFile(photo.id, width, quality);
  const dir = path.dirname(file);
  try {
    await stat(file);
    return await readFile(file);
  } catch {}
  const src = await loadPhotoBytes(photo.url, photo.isExternal);
  if (!src) return null;
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(src, { limitInputPixels: 300_000_000 })
      .rotate()
      .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: quality >= 90 ? "4:4:4" : "4:2:0" })
      .toBuffer();
    await mkdir(dir, { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, out);
    const { rename } = await import("fs/promises");
    await rename(tmp, file);
    return out;
  } catch {
    return null;
  }
}

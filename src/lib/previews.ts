import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { loadPhotoBytes } from "./watermark";

// Phase 5B platform: photographer controlled preview renditions.
//
// Gallery previews are generated with sharp at the photographer's chosen
// longest edge and JPEG quality (Settings, Gallery, Preview quality) and
// cached on disk. Originals are never touched and still download untouched.

export const PREVIEW_SIZES = [1024, 1600, 2048, 2560, 3200];
export const PREVIEW_WIDTHS = [480, 800, 1200, 1600, 2048, 2560, 3200];
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

/** Cached JPEG rendition of a photo at a width and quality. */
export async function previewRendition(
  photo: { id: string; url: string; isExternal: boolean },
  width: number,
  quality: number
): Promise<Buffer | null> {
  const dir = path.join(process.cwd(), ".cache", "preview");
  const file = path.join(dir, `${photo.id}-${width}-q${quality}.jpg`);
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

import { readFile, mkdir, writeFile, stat } from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { isStoredUrl, readStoredBytes } from "./storage";

// Phase 5B: server-side watermarking.
//
// The watermark is designed in Settings > Watermark (text or an uploaded
// image file, position, opacity, size) and rendered INTO preview images with
// sharp, so the client never receives an unwatermarked preview of a
// watermarked gallery. Originals on disk are never touched. Web-size downloads
// can carry the watermark too, per the photographer's size choices.

export interface WatermarkSettings {
  mode: string; // text | image
  text: string;
  imageUrl: string; // /uploads/... local path
  position: string; // center | bottom-right | bottom-left | top-right | top-left | tiled
  opacity: number; // 0..100
  scale: number; // percent of image width
}

export const WATERMARK_POSITIONS = [
  { id: "center", label: "Center" },
  { id: "bottom-right", label: "Bottom right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "top-right", label: "Top right" },
  { id: "top-left", label: "Top left" },
  { id: "tiled", label: "Tiled across the photo" },
];

export function watermarkFromUser(u: {
  watermarkMode: string;
  watermarkText: string;
  watermarkImageUrl: string;
  watermarkPosition: string;
  watermarkOpacity: number;
  watermarkScale: number;
  businessName?: string;
  name?: string;
}): WatermarkSettings {
  return {
    mode: u.watermarkMode === "image" && u.watermarkImageUrl ? "image" : "text",
    text: u.watermarkText || u.businessName || u.name || "Pixora",
    imageUrl: u.watermarkImageUrl,
    position: u.watermarkPosition || "center",
    opacity: Math.min(100, Math.max(5, u.watermarkOpacity || 40)),
    scale: Math.min(90, Math.max(5, u.watermarkScale || 30)),
  };
}

export function settingsHash(s: WatermarkSettings): string {
  return createHash("sha1").update(JSON.stringify(s)).digest("hex").slice(0, 10);
}

function esc(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function overlaySvg(s: WatermarkSettings, width: number, height: number): Promise<Buffer | null> {
  const markW = Math.max(40, Math.round((width * s.scale) / 100));
  const alpha = s.opacity / 100;
  if (s.mode === "image") {
    if (!isStoredUrl(s.imageUrl)) return null;
    try {
      const sharp = (await import("sharp")).default;
      const raw = await readStoredBytes(s.imageUrl);
      if (!raw) return null;
      const png = await sharp(raw).resize({ width: markW }).png().toBuffer();
      const meta = await sharp(png).metadata();
      const markH = meta.height ?? Math.round(markW / 3);
      const b64 = png.toString("base64");
      return Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${markW}" height="${markH}"><image width="${markW}" height="${markH}" opacity="${alpha}" xlink:href="data:image/png;base64,${b64}"/></svg>`
      );
    } catch {
      return null;
    }
  }
  // Uppercase serif glyphs run about 0.72em wide plus 0.12em letter spacing;
  // size the text so the whole word fits inside the requested width.
  const chars = Math.max(4, s.text.length);
  const fontSize = Math.max(10, Math.floor(markW / (chars * 0.86)));
  const markH = Math.round(fontSize * 1.6);
  // Tiled marks get breathing room between repeats.
  const boxW = s.position === "tiled" ? Math.round(markW * 1.35) : markW;
  const boxH = s.position === "tiled" ? Math.round(markH * 2.2) : markH;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${boxW}" height="${boxH}"><text x="50%" y="${s.position === "tiled" ? 40 : 62}%" text-anchor="middle" font-family="Georgia, serif" font-size="${fontSize}" fill="white" fill-opacity="${alpha}" stroke="black" stroke-opacity="${alpha * 0.35}" stroke-width="${Math.max(1, fontSize / 28)}" letter-spacing="${fontSize * 0.12}">${esc(
      s.text.toUpperCase()
    )}</text></svg>`
  );
}

const GRAVITY: Record<string, string> = {
  center: "centre",
  "bottom-right": "southeast",
  "bottom-left": "southwest",
  "top-right": "northeast",
  "top-left": "northwest",
};

/** Render the watermark into an image buffer. Returns a JPEG. */
export async function applyWatermark(input: Buffer, s: WatermarkSettings, maxPx: number | null, quality = 88): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  let base = sharp(input, { limitInputPixels: 300_000_000 }).rotate();
  if (maxPx) base = base.resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true });
  const resized = await base.jpeg({ quality: Math.min(98, quality + 2) }).toBuffer();
  const meta = await sharp(resized).metadata();
  const w = meta.width ?? 1200;
  const h = meta.height ?? 800;
  const mark = await overlaySvg(s, w, h);
  if (!mark) return resized;
  const markBuf = await sharp(mark).png().toBuffer();
  const markMeta = await sharp(markBuf).metadata();
  const pad = Math.round(Math.min(w, h) * 0.03);
  if (s.position === "tiled") {
    return sharp(resized).composite([{ input: markBuf, tile: true, blend: "over" }]).jpeg({ quality }).toBuffer();
  }
  // Pad the mark so corner placements keep a margin from the edge.
  const padded = await sharp({
    create: {
      width: Math.min(w, (markMeta.width ?? 100) + pad * 2),
      height: Math.min(h, (markMeta.height ?? 40) + pad * 2),
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: markBuf, gravity: "centre" }])
    .png()
    .toBuffer();
  return sharp(resized)
    .composite([{ input: padded, gravity: GRAVITY[s.position] ?? "centre" }])
    .jpeg({ quality })
    .toBuffer();
}

/** Load the bytes of a stored photo (local upload or external URL). */
export async function loadPhotoBytes(url: string, isExternal: boolean): Promise<Buffer | null> {
  if (!isExternal && isStoredUrl(url)) {
    return readStoredBytes(url);
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Cached watermarked preview for a photo at a given width. */
export async function watermarkedPreview(
  photo: { id: string; url: string; isExternal: boolean },
  s: WatermarkSettings,
  width: number,
  quality = 88
): Promise<Buffer | null> {
  const dir = path.join(process.cwd(), ".cache", "wm");
  const file = path.join(dir, `${photo.id}-${width}-q${quality}-${settingsHash(s)}.jpg`);
  try {
    await stat(file);
    return await readFile(file);
  } catch {}
  const src = await loadPhotoBytes(photo.url, photo.isExternal);
  if (!src) return null;
  try {
    const out = await applyWatermark(src, s, width, quality);
    await mkdir(dir, { recursive: true });
    await writeFile(file, out);
    return out;
  } catch {
    return null;
  }
}

/** Effective watermark state for a photo in a collection. */
export function photoWatermarked(collectionWatermark: boolean, photoMode: string): boolean {
  if (photoMode === "on") return true;
  if (photoMode === "off") return false;
  return collectionWatermark;
}

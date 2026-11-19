import { readFile } from "fs/promises";
import path from "path";

// Night build (Photo Editor): on device image analysis used by the culling
// screen and the editor. Everything here is computed locally with sharp:
// exposure, contrast, saturation, colour cast, sharpness and a perceptual
// hash for duplicate grouping. The AI layer (Gemini, src/lib/gemini.ts)
// builds its picks on top of these facts when it is connected.

export interface PhotoLike {
  url: string;
  isExternal: boolean;
  mediaType: string;
  posterUrl: string;
}

/** Bytes the editor and analysis should work on (RAW photos use their JPEG preview). */
export async function loadPhotoBytes(photo: PhotoLike): Promise<Buffer | null> {
  const src = photo.mediaType === "RAW" ? photo.posterUrl : photo.url;
  if (!src) return null;
  if (!photo.isExternal && src.startsWith("/uploads/")) {
    try {
      return await readFile(path.join(process.cwd(), "public", src));
    } catch {
      return null;
    }
  }
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export interface PhotoStats {
  width: number;
  height: number;
  brightness: number; // mean luminance 0..1
  contrast: number; // luminance stddev 0..~0.5
  saturation: number; // mean HSV saturation 0..1
  warmthCast: number; // -1 (blue) .. 1 (red)
  sharpness: number; // relative edge energy, higher is sharper
  entropy: number;
  hash: string; // perceptual hash bits (256 chars of 0/1)
}

export async function analyzePhoto(buffer: Buffer): Promise<PhotoStats | null> {
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buffer).metadata();
    const stats = await sharp(buffer).stats();
    const ch = stats.channels;
    const mean = (i: number) => ch[i]?.mean ?? 0;
    const r = mean(0), g = mean(1), b = mean(2);
    const brightness = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const contrast = ((ch[0]?.stdev ?? 0) + (ch[1]?.stdev ?? 0) + (ch[2]?.stdev ?? 0)) / 3 / 255;
    const warmthCast = r + b > 0 ? (r - b) / (r + b) : 0;

    // Saturation + hash from small raw renders.
    const small = await sharp(buffer).resize(48, 48, { fit: "fill" }).removeAlpha().raw().toBuffer();
    let satSum = 0;
    const px = 48 * 48;
    for (let i = 0; i < small.length; i += 3) {
      const rr = small[i] / 255, gg = small[i + 1] / 255, bb = small[i + 2] / 255;
      const mx = Math.max(rr, gg, bb), mn = Math.min(rr, gg, bb);
      satSum += mx === 0 ? 0 : (mx - mn) / mx;
    }
    const gray = await sharp(buffer).resize(16, 16, { fit: "fill" }).grayscale().raw().toBuffer();
    let gAvg = 0;
    for (let i = 0; i < gray.length; i++) gAvg += gray[i];
    gAvg /= gray.length;
    let hash = "";
    for (let i = 0; i < gray.length; i++) hash += gray[i] >= gAvg ? "1" : "0";

    let sharpness = typeof stats.sharpness === "number" ? stats.sharpness : 0;
    if (!sharpness) {
      // Fallback: Laplacian energy on a 256px grayscale render.
      const w = 256;
      const g256 = await sharp(buffer).resize(w, w, { fit: "fill" }).grayscale().raw().toBuffer();
      let acc = 0, n = 0;
      for (let y = 1; y < w - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          const lap = 4 * g256[i] - g256[i - 1] - g256[i + 1] - g256[i - w] - g256[i + w];
          acc += lap * lap;
          n++;
        }
      }
      sharpness = Math.sqrt(acc / Math.max(1, n)) / 255;
    }

    return {
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      brightness,
      contrast,
      saturation: satSum / px,
      warmthCast,
      sharpness,
      entropy: stats.entropy ?? 0,
      hash,
    };
  } catch {
    return null;
  }
}

export function hashDistance(a: string, b: string): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d + Math.abs(a.length - b.length);
}

export interface Adjust {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  sepia: number;
  grayscale: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

/** Deterministic correction from measured stats (editor slider units). */
export function suggestFromStats(st: PhotoStats): Adjust {
  const brightness = clamp(100 * Math.pow(0.5 / Math.max(0.05, st.brightness), 0.55), 80, 125);
  const contrast = clamp(100 + (0.21 - st.contrast) * 90, 85, 122);
  const saturation = clamp(100 + (0.38 - st.saturation) * 80, 80, 130);
  const warmth = clamp(-st.warmthCast * 130, -30, 30);
  return { brightness, contrast, saturation, warmth, sepia: 0, grayscale: 0 };
}

/** Quality score 0..100 for culling, relative to the set being analysed. */
export function scorePhoto(st: PhotoStats, sharpMin: number, sharpMax: number): number {
  const sharpPart = sharpMax > sharpMin ? ((st.sharpness - sharpMin) / (sharpMax - sharpMin)) * 50 : 25;
  const exposurePart = 25 * Math.max(0, 1 - Math.abs(st.brightness - 0.48) * 2.2);
  const contrastPart = Math.min(15, st.contrast * 55);
  const satPart = st.saturation > 0.75 ? 4 : 10;
  return Math.round(Math.min(100, Math.max(0, sharpPart + exposurePart + contrastPart + satPart)));
}

export function verdictFor(score: number): "keeper" | "review" | "reject" {
  return score >= 65 ? "keeper" : score >= 40 ? "review" : "reject";
}

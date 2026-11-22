import { open, rename, rm, mkdir, copyFile, stat } from "fs/promises";
import path from "path";
import os from "os";
import { randomBytes } from "crypto";

// RAW previews from the JPEGs the camera embeds inside every RAW file.
//
// libvips can only decode a few TIFF based RAW containers (some DNG), so
// decoding the sensor data fails for Canon, Nikon, Sony, Fuji, Olympus and
// Panasonic files. Every camera RAW also carries one or more JPEG previews
// (that is how the camera's back screen shows the photo instantly). We scan
// the file for those JPEGs, pick the largest decodable one and write it out
// as the photo's preview. Pure Node plus sharp, no external binaries.

const CHUNK = 1024 * 1024;
const MIN_SPAN = 1024;
const MAX_TRIES = 6;
const OUT_MAX = 2560;

interface Span {
  start: number;
  end: number; // exclusive, just past the FF D9; -1 when no EOI came before the next SOI
}

/**
 * Stream the file in chunks and collect JPEG spans: each starts at an SOI
 * (FF D8 FF) and ends at the last EOI (FF D9) seen before the next SOI or EOF.
 * Only offsets are kept, never file contents. Spans without an EOI are kept
 * too (end -1): a preview whose EXIF thumbnail starts before any EOI looks
 * like that, and it is rebuilt by merging with the following span.
 */
async function scanSpans(filePath: string): Promise<Span[]> {
  const fh = await open(filePath, "r");
  const spans: Span[] = [];
  try {
    const buf = Buffer.alloc(CHUNK + 2);
    let carry = 0; // bytes from the previous chunk kept at the front of buf
    let base = 0; // file offset of buf[0]
    let curStart = -1;
    let curEnd = -1;
    const flush = () => {
      if (curStart >= 0) spans.push({ start: curStart, end: curEnd });
    };
    for (;;) {
      const { bytesRead } = await fh.read(buf, carry, CHUNK, base + carry);
      const len = carry + bytesRead;
      const last = bytesRead === 0;
      // Markers are 2 or 3 bytes, so leave the final 2 bytes for the next round
      // unless this is the end of the file.
      const limit = last ? len : len - 2;
      for (let i = buf.indexOf(0xff, 0); i >= 0 && i < limit; i = buf.indexOf(0xff, i + 1)) {
        const b1 = buf[i + 1];
        if (b1 === 0xd8 && i + 2 < len && buf[i + 2] === 0xff) {
          flush();
          curStart = base + i;
          curEnd = -1;
        } else if (b1 === 0xd9 && i + 1 < len && curStart >= 0) {
          curEnd = base + i + 2;
        }
      }
      if (last) break;
      // Move the tail to the front for the next read.
      const keep = len - limit;
      buf.copy(buf, 0, limit, len);
      base += limit;
      carry = keep;
    }
    flush();
  } finally {
    await fh.close();
  }
  return spans;
}

/** Plain spans plus each span merged with the next (an embedded EXIF thumbnail's EOI can split a preview). */
function candidates(spans: Span[]): Span[] {
  const out: Span[] = spans.filter((s) => s.end > 0);
  for (let i = 0; i + 1 < spans.length; i++) {
    if (spans[i + 1].end > 0) out.push({ start: spans[i].start, end: spans[i + 1].end });
  }
  const seen = new Set<string>();
  return out
    .filter((s) => s.end - s.start >= MIN_SPAN)
    .filter((s) => {
      const k = `${s.start}-${s.end}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.end - b.start - (a.end - a.start));
}

async function readSpan(filePath: string, s: Span, maxLen?: number): Promise<Buffer> {
  const len = Math.min(s.end - s.start, maxLen ?? Infinity);
  const fh = await open(filePath, "r");
  try {
    const buf = Buffer.alloc(len);
    const { bytesRead } = await fh.read(buf, 0, len, s.start);
    return bytesRead === len ? buf : buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

/**
 * Walk the marker segments after the SOI to find the frame header. Returns
 * true only for SOF0, SOF1 or SOF2 (baseline, extended, progressive), which
 * libjpeg can decode. Lossless SOF3 tiles (CR2 sensor data) and anything
 * unreadable are rejected before any decode attempt.
 */
async function decodableFrame(filePath: string, s: Span): Promise<boolean> {
  // Headers (EXIF, ICC, tables) normally fit well inside 256 KB.
  const head = await readSpan(filePath, s, 256 * 1024);
  let i = 2;
  while (i + 4 <= head.length) {
    if (head[i] !== 0xff) return false;
    let m = head[i + 1];
    // Fill bytes before a marker
    while (m === 0xff && i + 2 < head.length) {
      i++;
      m = head[i + 1];
    }
    if (m === 0xc0 || m === 0xc1 || m === 0xc2) return true;
    if (m >= 0xc3 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return false;
    if (m === 0xda || m === 0xd9) return false; // scan or end before any frame header
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      i += 2;
      continue;
    }
    if (i + 4 > head.length) break;
    const segLen = head.readUInt16BE(i + 2);
    if (segLen < 2) return false;
    i += 2 + segLen;
  }
  // Headers ran past the read window without a verdict: let sharp decide.
  return head.length >= 256 * 1024;
}

async function writePreview(input: Buffer | string, previewPath: string): Promise<{ width: number; height: number }> {
  const sharp = (await import("sharp")).default;
  const dir = path.dirname(previewPath);
  await mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(previewPath)}.${randomBytes(4).toString("hex")}.tmp`);
  try {
    const info = await sharp(input, { limitInputPixels: 300_000_000 })
      .rotate()
      .resize(OUT_MAX, OUT_MAX, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(tmp);
    await rename(tmp, previewPath);
    return { width: info.width, height: info.height };
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
}

/**
 * Write a JPEG preview for a RAW (or any image) file at `previewPath`.
 * Returns the preview's dimensions, or null when nothing could be produced.
 */
export async function makeRawPreviewFromFile(
  filePath: string,
  previewPath: string
): Promise<{ width: number; height: number } | null> {
  try {
    const sharp = (await import("sharp")).default;
    let spans: Span[] = [];
    try {
      spans = await scanSpans(filePath);
    } catch {
      spans = [];
    }
    let tried = 0;
    let best: { buf: Buffer; long: number } | null = null;
    let bestSmall: { buf: Buffer; long: number } | null = null;
    let chosen: Buffer | null = null;
    for (const s of candidates(spans)) {
      if (tried >= MAX_TRIES) break;
      if (!(await decodableFrame(filePath, s).catch(() => false))) continue;
      tried++;
      const buf = await readSpan(filePath, s);
      const meta = await sharp(buf).metadata().catch(() => null);
      if (!meta || meta.format !== "jpeg" || !meta.width || !meta.height) continue;
      if (meta.width > 100_000 || meta.height > 100_000) continue;
      // A merged span decodes as its first image, which may be the smaller
      // one. Make sure the pixels actually decode before trusting it.
      const ok = await sharp(buf).resize(64, 64, { fit: "inside" }).toBuffer().then(() => true).catch(() => false);
      if (!ok) continue;
      const long = Math.max(meta.width, meta.height);
      if (long >= 1024) {
        chosen = buf;
        break;
      }
      if (long >= 320 && (!best || long > best.long)) best = { buf, long };
      if (!bestSmall || long > bestSmall.long) bestSmall = { buf, long };
    }
    const pick = chosen ?? best?.buf ?? bestSmall?.buf ?? null;
    if (pick) {
      try {
        return await writePreview(pick, previewPath);
      } catch {}
    }
    // Fallback: decode the file itself (works for some DNG files).
    try {
      return await writePreview(filePath, previewPath);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

type HealPhoto = { id: string; url: string; isExternal: boolean; collectionId: string };

// A grid opening fires several preview requests for the same photo at once
// (640 tile, 1024 lightbox). Share one heal per photo instead of racing.
const healing = new Map<string, Promise<string>>();

/**
 * Heal on view: build and store a preview for a RAW photo whose posterUrl is
 * empty (uploaded before embedded JPEG extraction existed). Returns the new
 * posterUrl, or "" when it cannot be produced. Never throws.
 */
export function ensureRawPreview(photo: HealPhoto): Promise<string> {
  const running = healing.get(photo.id);
  if (running) return running;
  const job = healRawPreview(photo)
    .catch(() => "")
    .finally(() => healing.delete(photo.id));
  healing.set(photo.id, job);
  return job;
}

async function healRawPreview(photo: HealPhoto): Promise<string> {
  if (photo.isExternal || !photo.url) return "";
  const tmpDir = path.join(os.tmpdir(), `pixora-raw-${randomBytes(6).toString("hex")}`);
  try {
    const storage = await import("./storage");
    if (!storage.isStoredUrl(photo.url)) return "";
    const key = storage.keyFromStoredUrl(photo.url);
    if (!key) return "";
    await mkdir(tmpDir, { recursive: true });

    // Resolve the original in the same order as readStoredBytes: local disk
    // under public/ first, then B2. The original is only ever read.
    let srcPath = "";
    const localPath = path.join(process.cwd(), "public", key);
    try {
      if ((await stat(localPath)).isFile()) srcPath = localPath;
    } catch {}
    if (!srcPath && storage.b2Enabled()) {
      const tmpRaw = path.join(tmpDir, "original");
      if (await storage.getToFile(key, tmpRaw)) srcPath = tmpRaw;
    }
    if (!srcPath) return "";

    const tmpPreview = path.join(tmpDir, "preview.jpg");
    const dims = await makeRawPreviewFromFile(srcPath, tmpPreview);
    if (!dims) return "";

    const previewKey = key.replace(/\.[^./]+$/, "") + "-preview.jpg";
    let posterUrl = "";
    if (storage.b2Enabled()) {
      await storage.putFile(previewKey, tmpPreview);
      posterUrl = storage.storedUrlFor(previewKey);
    } else {
      const name = path.basename(previewKey);
      const dest = path.join(process.cwd(), "public", "uploads", photo.collectionId, name);
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(tmpPreview, dest);
      posterUrl = `/uploads/${photo.collectionId}/${name}`;
    }

    const { db } = await import("./db");
    await db.photo.update({
      where: { id: photo.id },
      data: { posterUrl, width: dims.width, height: dims.height },
    });
    const { warmRenditions } = await import("./previews");
    void warmRenditions(photo.id);
    return posterUrl;
  } catch {
    return "";
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

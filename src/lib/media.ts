import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);

// Phase 5A, video + RAW media handling for gallery uploads.

export const VIDEO_EXTS = ["mp4", "mov", "m4v"];
export const RAW_EXTS = ["cr2", "cr3", "nef", "arw", "dng", "raf", "orf", "rw2"];

export function fileExt(name: string): string {
  return path.extname(name || "").replace(".", "").toLowerCase();
}

/** Classify an upload by extension + MIME. Returns null for unsupported files. */
export function mediaTypeFor(name: string, mime: string): "IMAGE" | "VIDEO" | "RAW" | null {
  const ext = fileExt(name);
  if (RAW_EXTS.includes(ext)) return "RAW";
  if (VIDEO_EXTS.includes(ext) || (mime || "").startsWith("video/")) {
    // Only the researched formats are accepted
    return VIDEO_EXTS.includes(ext) ? "VIDEO" : null;
  }
  if ((mime || "").startsWith("image/")) return "IMAGE";
  return null;
}

/** Read a video's duration in seconds with ffprobe. Null when unreadable. */
export async function probeVideoDuration(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
      { timeout: 20000 }
    );
    const dur = parseFloat(stdout.trim());
    return Number.isFinite(dur) && dur > 0 ? Math.round(dur * 10) / 10 : null;
  } catch {
    return null;
  }
}

/** Read a video's pixel dimensions with ffprobe. */
export async function probeVideoSize(filePath: string): Promise<{ width: number; height: number } | null> {
  try {
    const { stdout } = await execFileAsync(
      "ffprobe",
      [
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "csv=s=x:p=0",
        filePath,
      ],
      { timeout: 20000 }
    );
    const [w, h] = stdout.trim().split("x").map((n) => parseInt(n, 10));
    return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { width: w, height: h } : null;
  } catch {
    return null;
  }
}

/** Generate a JPEG poster frame (1 second in, or the first frame) with ffmpeg. */
export async function makeVideoPoster(videoPath: string, posterPath: string): Promise<boolean> {
  const attempts: string[][] = [
    ["-ss", "1", "-i", videoPath, "-frames:v", "1", "-q:v", "3", "-y", posterPath],
    ["-i", videoPath, "-frames:v", "1", "-q:v", "3", "-y", posterPath],
  ];
  for (const args of attempts) {
    try {
      await execFileAsync("ffmpeg", ["-v", "error", ...args], { timeout: 30000 });
      return true;
    } catch {
      // try the next recipe
    }
  }
  return false;
}

/**
 * Try to produce a JPEG preview for a RAW file. sharp/libvips reads some
 * TIFF-based RAW containers (notably DNG); most vendor formats need dcraw,
 * which is not installed here, so this usually returns false and the UI shows
 * the honest RAW badge tile instead.
 */
export async function makeRawPreview(buffer: Buffer, previewPath: string): Promise<boolean> {
  try {
    const sharp = (await import("sharp")).default;
    await sharp(buffer, { limitInputPixels: 300_000_000 })
      .jpeg({ quality: 85 })
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .toFile(previewPath);
    return true;
  } catch {
    return false;
  }
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
};

export function contentTypeFor(filename: string): string {
  return CONTENT_TYPES[fileExt(filename)] ?? "application/octet-stream";
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

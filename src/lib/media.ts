import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import { randomBytes } from "crypto";
import { rm, writeFile } from "fs/promises";
import { makeRawPreviewFromFile } from "./raw-preview";

const execFileAsync = promisify(execFile);

// Phase 5A, video + RAW media handling for gallery uploads.

export const VIDEO_EXTS = ["mp4", "mov", "m4v", "avi"];
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

export { makeRawPreviewFromFile };

/**
 * Produce a JPEG preview for a RAW file held in memory. The primary path is
 * extracting the largest JPEG the camera embedded in the RAW file (works for
 * Canon, Nikon, Sony, Fuji, Olympus, Panasonic and DNG). Decoding the file
 * with sharp is only the fallback. Returns false when neither works, and the
 * UI then shows the RAW badge tile. Prefer makeRawPreviewFromFile for files
 * already on disk, it never loads the whole file into memory.
 */
export async function makeRawPreview(buffer: Buffer, previewPath: string): Promise<boolean> {
  const tmp = path.join(os.tmpdir(), `pixora-raw-${randomBytes(6).toString("hex")}`);
  try {
    await writeFile(tmp, buffer);
    return (await makeRawPreviewFromFile(tmp, previewPath)) !== null;
  } catch {
    return false;
  } finally {
    await rm(tmp, { force: true }).catch(() => undefined);
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
  avi: "video/x-msvideo",
};

/**
 * Phase 5B: researched per-format upload limits. JPEG and PNG up to 100 MB,
 * GIF up to 85 MB, other images 100 MB, RAW originals 200 MB, video files 4 GB
 * (videos are additionally capped at 4K resolution).
 */
export function uploadLimitBytes(name: string, mediaType: string): number {
  const ext = fileExt(name);
  const MB = 1024 * 1024;
  if (mediaType === "VIDEO") return 4096 * MB;
  if (mediaType === "RAW") return 200 * MB;
  if (ext === "gif") return 85 * MB;
  return 100 * MB;
}

export const UPLOAD_LIMITS_TEXT = "JPEG and PNG up to 100 MB, GIF up to 85 MB, RAW up to 200 MB, MP4, MOV, AVI and M4V video up to 4K and 4 GB";

/** Transcode a video (AVI) to a browser playable MP4. */
export async function transcodeToMp4(input: string, output: string): Promise<boolean> {
  try {
    await execFileAsync(
      "ffmpeg",
      ["-v", "error", "-i", input, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", "-y", output],
      { timeout: 15 * 60 * 1000 }
    );
    return true;
  } catch {
    return false;
  }
}

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

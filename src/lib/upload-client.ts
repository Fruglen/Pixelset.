// Phase 5B: the researched per format limits, mirrored from src/lib/media.ts
// (the server enforces them; this check only gives instant feedback).
export const UPLOAD_LIMITS_TEXT =
  "JPEG and PNG up to 100 MB, GIF up to 85 MB, RAW up to 200 MB, MP4, MOV, AVI and M4V video up to 4K and 4 GB";
const MB = 1024 * 1024;
const RAW_EXT = ["cr2", "cr3", "nef", "arw", "dng", "raf", "orf", "rw2"];
const VIDEO_EXT = ["mp4", "mov", "m4v", "avi"];
export function clientLimitError(file: File): string | null {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  let limit = 100 * MB;
  let kind = ext.toUpperCase() || "image";
  if (RAW_EXT.includes(ext)) limit = 200 * MB;
  else if (VIDEO_EXT.includes(ext)) limit = 4096 * MB;
  else if (ext === "gif" || file.type === "image/gif") {
    limit = 85 * MB;
    kind = "GIF";
  } else if (!file.type.startsWith("image/")) return `${file.name}: unsupported file type`;
  if (file.size > limit) return `${file.name}: ${(file.size / MB).toFixed(1)} MB is over the ${Math.round(limit / MB)} MB limit for ${kind} files`;
  return null;
}

export type QueueItem = { key: string; name: string; size: number; setName: string; status: "queued" | "uploading" | "done" | "error"; progress: number; error?: string; note?: string; file?: File; setId?: string };

// Phase 5B platform: every dashboard upload is chunked and resumable.
// A file is sent in 4 MB chunks to /api/collections/[id]/photos/chunk. The
// upload id is derived from the collection, set, name, size and modified time,
// so dropping the same file again (after a dropped connection, a closed tab or
// a reload) asks the server which chunks it already has and sends only the
// rest. Each chunk is retried with backoff on network errors and 5xx/429.
export const CHUNK_SIZE = 4 * 1024 * 1024;
const MAX_TRIES = 5;

function hash32(s: string, seed: number): string {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}

export function uploadIdFor(collectionId: string, setId: string, file: File): string {
  const key = `${collectionId}|${setId}|${file.name}|${file.size}|${file.lastModified}`;
  return `u${hash32(key, 2166136261)}${hash32(key, 3735928559)}${file.size.toString(36)}`.slice(0, 64);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ChunkResult = { ok: true; done?: boolean } | { ok: false; fatal: boolean; error: string };

function sendChunk(collectionId: string, form: FormData, onProgress: (loaded: number) => void): Promise<ChunkResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/collections/${collectionId}/photos/chunk`);
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      let data: { done?: boolean; error?: string; fatal?: boolean } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) return resolve({ ok: true, done: !!data.done });
      const retryable = xhr.status >= 500 || xhr.status === 429 || xhr.status === 408 || xhr.status === 0;
      resolve({ ok: false, fatal: !retryable || !!data.fatal, error: data.error || `Upload failed (${xhr.status})` });
    };
    xhr.onerror = () => resolve({ ok: false, fatal: false, error: "Network error" });
    xhr.ontimeout = () => resolve({ ok: false, fatal: false, error: "The connection timed out" });
    xhr.send(form);
  });
}

async function receivedChunks(collectionId: string, uploadId: string): Promise<Set<number>> {
  try {
    const res = await fetch(`/api/collections/${collectionId}/photos/chunk?uploadId=${uploadId}`);
    if (!res.ok) return new Set();
    const d = await res.json();
    return new Set<number>(Array.isArray(d.received) ? d.received : []);
  } catch {
    return new Set();
  }
}

type DirectInit = {
  key: string;
  s3UploadId: string;
  partSize: number;
  parts: { partNumber: number; size: number; etag: string }[];
};

async function directInit(collectionId: string, uploadId: string, setId: string, file: File): Promise<DirectInit | null | { fatal: string }> {
  try {
    const res = await fetch(`/api/collections/${collectionId}/photos/direct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "init", uploadId, setId, name: file.name, type: file.type, size: file.size }),
    });
    if (res.status === 409 || res.status === 404) return null; // direct uploads unavailable here
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (data?.fatal && data?.error) return { fatal: data.error };
      return null;
    }
    if (!data?.key || !data?.s3UploadId) return null;
    return data as DirectInit;
  } catch {
    return null;
  }
}

async function directSign(collectionId: string, key: string, s3UploadId: string, partNumber: number): Promise<string | null> {
  try {
    const res = await fetch(`/api/collections/${collectionId}/photos/direct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sign", key, s3UploadId, partNumber }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return typeof data?.url === "string" ? data.url : null;
  } catch {
    return null;
  }
}

function putPart(url: string, blob: Blob, onProgress: (loaded: number) => void): Promise<{ ok: boolean; etag?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true, etag: xhr.getResponseHeader("ETag") || undefined });
      } else resolve({ ok: false });
    };
    xhr.onerror = () => resolve({ ok: false });
    xhr.ontimeout = () => resolve({ ok: false });
    xhr.send(blob);
  });
}

/**
 * Direct-to-storage upload: bytes go from the browser straight to Backblaze
 * (presigned multipart URLs, 8 MB parts), never through the app server.
 * Returns an error string, null on success, or undefined when direct uploads
 * are unavailable and the caller should use the chunk flow instead.
 */
async function uploadOneDirect(
  collectionId: string,
  setId: string,
  file: File,
  onProgress: (pct: number) => void,
  onRetry?: (attempt: number, error: string) => void
): Promise<string | null | undefined> {
  const uploadId = uploadIdFor(collectionId, setId, file);
  const init = await directInit(collectionId, uploadId, setId, file);
  if (init === null) return undefined;
  if ("fatal" in init) return init.fatal;
  const partSize = init.partSize || 8 * 1024 * 1024;
  const total = Math.max(1, Math.ceil(file.size / partSize));
  const partLen = (i: number) => Math.min(partSize, file.size - i * partSize);
  const etags = new Map<number, string>();
  for (const p of init.parts) {
    // Trust a listed part only when its size matches the expected slice.
    if (p.partNumber >= 1 && p.partNumber <= total && p.size === partLen(p.partNumber - 1) && p.etag) {
      etags.set(p.partNumber, p.etag);
    }
  }
  const doneBytes = () => Array.from(etags.keys()).reduce((n, pn) => n + partLen(pn - 1), 0);
  onProgress(Math.round((doneBytes() / Math.max(1, file.size)) * 100));

  for (let partNumber = 1; partNumber <= total; partNumber++) {
    if (etags.has(partNumber)) continue;
    const blob = file.slice((partNumber - 1) * partSize, Math.min(file.size, partNumber * partSize));
    for (let attempt = 1; ; attempt++) {
      const url = await directSign(collectionId, init.key, init.s3UploadId, partNumber);
      const base = doneBytes();
      const r = url ? await putPart(url, blob, (loaded) => onProgress(Math.min(99, Math.round(((base + loaded) / Math.max(1, file.size)) * 100)))) : { ok: false };
      if (r.ok && r.etag) {
        etags.set(partNumber, r.etag);
        break;
      }
      if (r.ok && !r.etag) return "The storage service did not confirm that part of the file. Drop the file again to resume.";
      if (attempt >= MAX_TRIES) return `Upload failed. Tried ${MAX_TRIES} times, drop the file again to resume where it stopped.`;
      onRetry?.(attempt, "Network error");
      await sleep(Math.min(15_000, 1000 * 2 ** (attempt - 1)) + Math.random() * 300);
    }
  }

  try {
    const res = await fetch(`/api/collections/${collectionId}/photos/direct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        key: init.key,
        s3UploadId: init.s3UploadId,
        setId,
        name: file.name,
        type: file.type,
        size: file.size,
        parts: Array.from(etags.entries()).map(([partNumber, etag]) => ({ partNumber, etag })),
      }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.done) {
      onProgress(100);
      return null;
    }
    return data?.error || `Upload failed (${res.status})`;
  } catch {
    return "The upload did not finish, drop the file again to resume";
  }
}

/**
 * Upload one file with progress, resumable, resolving to an error string or
 * null. Prefers the direct-to-storage flow; falls back to the chunked
 * through-server flow when direct uploads are unavailable. `onRetry` reports
 * a retry in progress (attempt, error).
 */
export async function uploadOne(
  collectionId: string,
  setId: string,
  file: File,
  onProgress: (pct: number) => void,
  onRetry?: (attempt: number, error: string) => void
): Promise<string | null> {
  const direct = await uploadOneDirect(collectionId, setId, file, onProgress, onRetry);
  if (direct !== undefined) return direct;
  return uploadOneChunked(collectionId, setId, file, onProgress, onRetry);
}

async function uploadOneChunked(
  collectionId: string,
  setId: string,
  file: File,
  onProgress: (pct: number) => void,
  onRetry?: (attempt: number, error: string) => void
): Promise<string | null> {
  const uploadId = uploadIdFor(collectionId, setId, file);
  const total = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  let have = await receivedChunks(collectionId, uploadId);
  // The final chunk is what assembles the file: always (re)send it last.
  have.delete(total - 1);
  const doneBytes = () => Array.from(have).reduce((n, i) => n + Math.min(CHUNK_SIZE, file.size - i * CHUNK_SIZE), 0);
  onProgress(Math.round((doneBytes() / Math.max(1, file.size)) * 100));

  for (let index = 0; index < total; index++) {
    if (have.has(index)) continue;
    const start = index * CHUNK_SIZE;
    const blob = file.slice(start, Math.min(file.size, start + CHUNK_SIZE));
    for (let attempt = 1; ; attempt++) {
      const form = new FormData();
      form.append("uploadId", uploadId);
      form.append("index", String(index));
      form.append("total", String(total));
      form.append("name", file.name);
      form.append("type", file.type);
      form.append("size", String(file.size));
      form.append("setId", setId);
      form.append("chunk", blob, `${index}`);
      const base = doneBytes();
      const r = await sendChunk(collectionId, form, (loaded) =>
        onProgress(Math.min(99, Math.round(((base + loaded) / Math.max(1, file.size)) * 100)))
      );
      if (r.ok) {
        have.add(index);
        if (r.done) {
          onProgress(100);
          return null;
        }
        break;
      }
      if (r.fatal) return r.error;
      if (attempt >= MAX_TRIES) return `${r.error}. Tried ${MAX_TRIES} times, drop the file again to resume where it stopped.`;
      onRetry?.(attempt, r.error);
      await sleep(Math.min(15_000, 1000 * 2 ** (attempt - 1)) + Math.random() * 300);
      // The server may have stored the chunk before the connection dropped.
      have = await receivedChunks(collectionId, uploadId);
      have.delete(total - 1);
      if (have.has(index)) break;
    }
  }
  return "The upload did not finish, drop the file again to resume";
}

/** Run uploads with a small concurrency limit (large galleries). */
export async function runPool<T>(items: T[], limit: number, worker: (item: T, i: number) => Promise<void>) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

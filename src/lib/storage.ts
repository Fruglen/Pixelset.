import { createReadStream } from "fs";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  ListMultipartUploadsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { contentTypeFor } from "./media";

// Object storage: Backblaze B2 through its S3-compatible API.
//
// When the B2_* env vars are present, every runtime-written file (photo and
// video uploads, editor exports, covers, brand assets, watermark images,
// website media, message attachments) lives in the B2 bucket and is served
// through /media/<key>, which redirects to a short-lived presigned GET URL.
// That removes the old failure mode where files written at runtime into
// public/ 404'd until the server restarted (Next.js only serves public/
// files that existed at boot), and it survives the free instance's ephemeral
// disk. When the vars are absent, everything falls back to the local
// public/ tree exactly as before, so dev and self-hosted runs are unchanged.
//
// Stored URLs: B2-backed files are referenced as /media/<key> where the key
// mirrors the legacy public path (uploads/<collectionId>/<file>). Legacy
// /uploads/... URLs keep working: reads try local disk first, then B2.

export function b2Enabled(): boolean {
  return Boolean(
    process.env.B2_BUCKET && process.env.B2_ENDPOINT && process.env.B2_KEY_ID && process.env.B2_APP_KEY
  );
}

export function b2Bucket(): string {
  return process.env.B2_BUCKET || "";
}

let client: S3Client | null = null;

export function s3(): S3Client {
  if (!client) {
    const endpointHost = (process.env.B2_ENDPOINT || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    // s3.us-east-005.backblazeb2.com -> region us-east-005
    const region = endpointHost.replace(/^s3\./, "").replace(/\.backblazeb2\.com$/, "") || "us-east-005";
    client = new S3Client({
      endpoint: `https://${endpointHost}`,
      region,
      credentials: {
        accessKeyId: process.env.B2_KEY_ID || "",
        secretAccessKey: process.env.B2_APP_KEY || "",
      },
    });
  }
  return client;
}

/** The public path a stored object is referenced by. */
export function storedUrlFor(key: string): string {
  return `/media/${key}`;
}

/** Object key for a stored URL (/media/<key> or legacy /uploads/...). */
export function keyFromStoredUrl(url: string): string | null {
  if (url.startsWith("/media/")) return url.slice("/media/".length);
  if (url.startsWith("/uploads/")) return url.slice(1);
  return null;
}

export function isStoredUrl(url: string): boolean {
  return url.startsWith("/media/") || url.startsWith("/uploads/");
}

export async function putBuffer(key: string, body: Buffer, contentType?: string): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: b2Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType || contentTypeFor(key),
    })
  );
}

/** Stream a local file into the bucket (never buffers the whole file). */
export async function putFile(key: string, filePath: string, contentType?: string): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: b2Bucket(),
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType || contentTypeFor(key),
    })
  );
}

export async function getBytes(key: string): Promise<Buffer | null> {
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: b2Bucket(), Key: key }));
    if (!res.Body) return null;
    return Buffer.from(await res.Body.transformToByteArray());
  } catch {
    return null;
  }
}

/** First `maxBytes` of an object (metadata probes without a full download). */
export async function getBytesRange(key: string, maxBytes: number): Promise<Buffer | null> {
  try {
    const res = await s3().send(
      new GetObjectCommand({ Bucket: b2Bucket(), Key: key, Range: `bytes=0-${maxBytes - 1}` })
    );
    if (!res.Body) return null;
    return Buffer.from(await res.Body.transformToByteArray());
  } catch {
    return null;
  }
}

/** Stream an object to a local temp file (RAW previews, no full buffering). */
export async function getToFile(key: string, filePath: string): Promise<boolean> {
  try {
    const res = await s3().send(new GetObjectCommand({ Bucket: b2Bucket(), Key: key }));
    if (!res.Body) return false;
    const { createWriteStream } = await import("fs");
    const { pipeline } = await import("stream/promises");
    await pipeline(res.Body as NodeJS.ReadableStream, createWriteStream(filePath));
    return true;
  } catch {
    return false;
  }
}

export async function headSize(key: string): Promise<number | null> {
  try {
    const res = await s3().send(new HeadObjectCommand({ Bucket: b2Bucket(), Key: key }));
    return typeof res.ContentLength === "number" ? res.ContentLength : null;
  } catch {
    return null;
  }
}

export async function deleteKey(key: string): Promise<void> {
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: b2Bucket(), Key: key }));
  } catch {}
}

export async function presignGet(key: string, expiresInSec = 3600): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: b2Bucket(), Key: key }), {
    expiresIn: expiresInSec,
  });
}

// ---------- multipart (direct browser -> B2 uploads) ----------

export async function createMultipart(key: string, contentType?: string): Promise<string | null> {
  const res = await s3().send(
    new CreateMultipartUploadCommand({
      Bucket: b2Bucket(),
      Key: key,
      ContentType: contentType || contentTypeFor(key),
    })
  );
  return res.UploadId ?? null;
}

/** Find an in-progress multipart upload for an exact key (resume support). */
export async function findMultipart(key: string): Promise<string | null> {
  let marker: string | undefined;
  for (let page = 0; page < 5; page++) {
    const res = await s3().send(
      new ListMultipartUploadsCommand({ Bucket: b2Bucket(), Prefix: key, UploadIdMarker: marker })
    );
    const hit = (res.Uploads ?? []).find((u) => u.Key === key);
    if (hit?.UploadId) return hit.UploadId;
    if (!res.IsTruncated || !res.NextUploadIdMarker) return null;
    marker = res.NextUploadIdMarker;
  }
  return null;
}

export async function presignPart(key: string, uploadId: string, partNumber: number): Promise<string> {
  return getSignedUrl(
    s3(),
    new UploadPartCommand({ Bucket: b2Bucket(), Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn: 3600 }
  );
}

export async function listParts(
  key: string,
  uploadId: string
): Promise<{ partNumber: number; size: number; etag: string }[]> {
  const out: { partNumber: number; size: number; etag: string }[] = [];
  let marker: string | undefined;
  for (let page = 0; page < 10; page++) {
    const res = await s3().send(
      new ListPartsCommand({ Bucket: b2Bucket(), Key: key, UploadId: uploadId, PartNumberMarker: marker })
    );
    for (const p of res.Parts ?? []) {
      if (p.PartNumber) out.push({ partNumber: p.PartNumber, size: p.Size ?? 0, etag: p.ETag ?? "" });
    }
    if (!res.IsTruncated || !res.NextPartNumberMarker) break;
    marker = String(res.NextPartNumberMarker);
  }
  return out.sort((a, b) => a.partNumber - b.partNumber);
}

export async function completeMultipart(
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[]
): Promise<void> {
  await s3().send(
    new CompleteMultipartUploadCommand({
      Bucket: b2Bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .slice()
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    })
  );
}

export async function abortMultipart(key: string, uploadId: string): Promise<void> {
  try {
    await s3().send(new AbortMultipartUploadCommand({ Bucket: b2Bucket(), Key: key, UploadId: uploadId }));
  } catch {}
}

// ---------- stored-file helpers shared by the small-write routes ----------

/**
 * Save a small runtime file (cover, brand asset, watermark image, website
 * media, attachment, editor export). Returns the URL to persist: /media/<key>
 * when B2 is on, the legacy /<key> public path otherwise.
 */
export async function saveStoredBuffer(key: string, body: Buffer, contentType?: string): Promise<string> {
  if (b2Enabled()) {
    await putBuffer(key, body, contentType);
    return storedUrlFor(key);
  }
  const p = path.join(process.cwd(), "public", key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, body);
  return `/${key}`;
}

/** Read the bytes behind a stored URL. Local disk first, then B2. */
export async function readStoredBytes(url: string): Promise<Buffer | null> {
  if (!isStoredUrl(url)) return null;
  try {
    return await readFile(path.join(process.cwd(), "public", url.startsWith("/media/") ? url.slice("/media/".length) : url.slice(1)));
  } catch {}
  const key = keyFromStoredUrl(url);
  if (key && b2Enabled()) return getBytes(key);
  return null;
}

/** Delete the object/file behind a stored URL (both backends, best effort). */
export async function deleteStored(url: string): Promise<void> {
  const key = keyFromStoredUrl(url);
  if (!key) return;
  try {
    await rm(path.join(process.cwd(), "public", key), { force: true });
  } catch {}
  if (b2Enabled()) await deleteKey(key);
}

/** Delete every object under a key prefix (collection removal). */
export async function deletePrefix(prefix: string): Promise<void> {
  if (!b2Enabled()) return;
  let token: string | undefined;
  for (let page = 0; page < 50; page++) {
    const res = await s3().send(
      new ListObjectsV2Command({ Bucket: b2Bucket(), Prefix: prefix, ContinuationToken: token })
    );
    const keys = (res.Contents ?? []).map((o) => o.Key).filter((k): k is string => Boolean(k));
    if (keys.length) {
      await s3().send(
        new DeleteObjectsCommand({ Bucket: b2Bucket(), Delete: { Objects: keys.map((Key) => ({ Key })) } })
      );
    }
    if (!res.IsTruncated || !res.NextContinuationToken) break;
    token = res.NextContinuationToken;
  }
}

/**
 * Duplicate the file behind a stored URL under a new key, staying inside
 * whichever backend holds it (server-side copy in B2). Returns the new
 * stored URL, or null when the source cannot be read.
 */
export async function copyStored(url: string, destKey: string): Promise<string | null> {
  const srcKey = keyFromStoredUrl(url);
  if (!srcKey) return null;
  if (b2Enabled()) {
    try {
      await s3().send(
        new CopyObjectCommand({ Bucket: b2Bucket(), CopySource: `${b2Bucket()}/${srcKey}`, Key: destKey })
      );
      return storedUrlFor(destKey);
    } catch {}
    // Source may only exist on local disk (pre-B2 upload): stream it up.
    try {
      await putFile(destKey, path.join(process.cwd(), "public", srcKey));
      return storedUrlFor(destKey);
    } catch {
      return null;
    }
  }
  try {
    const dest = path.join(process.cwd(), "public", destKey);
    await mkdir(path.dirname(dest), { recursive: true });
    const { copyFile } = await import("fs/promises");
    await copyFile(path.join(process.cwd(), "public", srcKey), dest);
    return `/${destKey}`;
  } catch {
    return null;
  }
}

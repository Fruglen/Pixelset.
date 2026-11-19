import { mkdir, writeFile, readdir, readFile, appendFile, rm, rename, stat } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { db } from "./db";
import { chunkDir, ingestFile, precheckUpload } from "./uploads";

// Phase 5B platform: the server half of chunked, resumable uploads, shared by
// /api/collections/[id]/photos/chunk (and exercised directly by load tests).
// Chunks are written atomically; when every chunk is present the file is
// assembled in order, its size verified, and it goes through the one shared
// upload pipeline (format and size limits, plan caps, Photo row).

export type ChunkAnswer = { status: number; body: Record<string, unknown> };

export async function receivedChunkIndexes(uploadId: string): Promise<number[]> {
  try {
    const files = await readdir(chunkDir(uploadId));
    return files.filter((f) => /^\d+$/.test(f)).map(Number).sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export async function receiveChunk(opts: {
  userId: string;
  collectionId: string;
  setId: string;
  uploadId: string;
  index: number;
  total: number;
  name: string;
  type: string;
  size: number;
  bytes: Buffer;
}): Promise<ChunkAnswer> {
  const { userId, collectionId, setId, uploadId, index, total, name, type, size, bytes } = opts;
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(uploadId) || !Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 0 || index >= total) {
    return { status: 400, body: { error: "Bad chunk" } };
  }
  const set = await db.photoSet.findFirst({ where: { id: setId, collectionId } });
  if (!set) return { status: 404, body: { error: "Set not found" } };
  if (index === 0) {
    const pre = await precheckUpload(userId, name, type, size);
    if (pre) return { status: 422, body: { error: pre, fatal: true } };
  }

  const dir = chunkDir(uploadId);
  await mkdir(dir, { recursive: true });
  // Write each chunk atomically so a dropped request never leaves a half
  // written chunk that a resume would trust.
  const tmpChunk = path.join(dir, `${index}.${randomBytes(4).toString("hex")}.tmp`);
  await writeFile(tmpChunk, bytes);
  await rename(tmpChunk, path.join(dir, String(index)));

  const have = (await readdir(dir)).filter((f) => /^\d+$/.test(f));
  if (have.length < total) return { status: 200, body: { ok: true, received: have.length, total } };

  // All chunks present: assemble in order, then ingest.
  const assembled = path.join(path.dirname(dir), `${randomBytes(8).toString("hex")}.part`);
  for (let i = 0; i < total; i++) {
    await appendFile(assembled, await readFile(path.join(dir, String(i))));
  }
  await rm(dir, { recursive: true, force: true });
  if (size > 0 && (await stat(assembled)).size !== size) {
    await rm(assembled, { force: true });
    return { status: 422, body: { error: `${name}: the assembled file does not match its size, please upload it again`, fatal: true } };
  }
  const out = await ingestFile({ userId, collectionId, setId: set.id, tmpPath: assembled, originalName: name, mime: type });
  if (!out.ok) return { status: 422, body: { error: out.error, fatal: true } };
  return { status: 200, body: { ok: true, done: true, photoId: out.photoId } };
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { finalizeDirectUpload, precheckUpload, safeName } from "@/lib/uploads";
import {
  abortMultipart,
  b2Enabled,
  completeMultipart,
  createMultipart,
  findMultipart,
  listParts,
  presignPart,
} from "@/lib/storage";

export const runtime = "nodejs";

// Direct-to-B2 uploads: the browser sends file bytes straight to Backblaze
// with presigned multipart part URLs, in 8 MB resumable parts, so uploads
// never stream through this 512 MB server. The deterministic object key is
// derived from the same upload id the chunk flow uses, so a dropped upload
// resumes by listing the parts already in the bucket. When B2 is not
// configured the client falls back to /photos/chunk.

const PART_SIZE = 8 * 1024 * 1024;

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const collection = await db.collection.findFirst({ where: { id, userId: user.id } });
  return collection ? { user, collection } : null;
}

function keyFor(collectionId: string, uploadId: string, name: string): string | null {
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(uploadId)) return null;
  return `uploads/${collectionId}/direct-${uploadId}-${safeName(name || "photo.jpg")}`;
}

function keyBelongsTo(key: string, collectionId: string): boolean {
  return key.startsWith(`uploads/${collectionId}/direct-`) && !key.includes("..");
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await owned(params.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ enabled: b2Enabled(), partSize: PART_SIZE });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await owned(params.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!b2Enabled()) return NextResponse.json({ error: "Direct uploads are not available" }, { status: 409 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const collectionId = ctx.collection.id;

  if (body.action === "init") {
    const name = String(body.name || "upload");
    const type = String(body.type || "");
    const size = Number(body.size || 0);
    const setId = String(body.setId || "");
    const key = keyFor(collectionId, String(body.uploadId || ""), name);
    if (!key) return NextResponse.json({ error: "Bad upload id" }, { status: 400 });
    const set = await db.photoSet.findFirst({ where: { id: setId, collectionId } });
    if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });
    const pre = await precheckUpload(ctx.user.id, name, type, size);
    if (pre) return NextResponse.json({ error: pre, fatal: true }, { status: 422 });
    try {
      let s3UploadId = await findMultipart(key);
      if (!s3UploadId) s3UploadId = await createMultipart(key, type);
      if (!s3UploadId) return NextResponse.json({ error: "Could not start the upload" }, { status: 502 });
      const parts = await listParts(key, s3UploadId).catch(() => []);
      return NextResponse.json({ key, s3UploadId, partSize: PART_SIZE, parts });
    } catch {
      return NextResponse.json({ error: "Storage unavailable" }, { status: 502 });
    }
  }

  const key = String(body.key || "");
  const s3UploadId = String(body.s3UploadId || "");
  if (!keyBelongsTo(key, collectionId) || !s3UploadId) {
    return NextResponse.json({ error: "Bad upload reference" }, { status: 400 });
  }

  if (body.action === "sign") {
    const partNumber = Number(body.partNumber);
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
      return NextResponse.json({ error: "Bad part number" }, { status: 400 });
    }
    try {
      return NextResponse.json({ url: await presignPart(key, s3UploadId, partNumber) });
    } catch {
      return NextResponse.json({ error: "Storage unavailable" }, { status: 502 });
    }
  }

  if (body.action === "parts") {
    try {
      return NextResponse.json({ parts: await listParts(key, s3UploadId) });
    } catch {
      return NextResponse.json({ parts: [] });
    }
  }

  if (body.action === "abort") {
    await abortMultipart(key, s3UploadId);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "complete") {
    const setId = String(body.setId || "");
    const set = await db.photoSet.findFirst({ where: { id: setId, collectionId } });
    if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });
    const parts = Array.isArray(body.parts)
      ? body.parts
          .filter((p: { partNumber?: unknown; etag?: unknown }) => Number.isInteger(p?.partNumber) && typeof p?.etag === "string")
          .map((p: { partNumber: number; etag: string }) => ({ partNumber: p.partNumber, etag: p.etag }))
      : [];
    if (parts.length === 0) return NextResponse.json({ error: "No parts to complete" }, { status: 400 });
    try {
      await completeMultipart(key, s3UploadId, parts);
    } catch {
      return NextResponse.json({ error: "Could not finish the upload in storage" }, { status: 502 });
    }
    const out = await finalizeDirectUpload({
      userId: ctx.user.id,
      collectionId,
      setId: set.id,
      key,
      originalName: String(body.name || "upload"),
      mime: String(body.type || ""),
      size: Number(body.size || 0),
    });
    if (!out.ok) return NextResponse.json({ error: out.error, fatal: true }, { status: 422 });
    return NextResponse.json({ ok: true, done: true, photoId: out.photoId });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

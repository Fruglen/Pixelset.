import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { receiveChunk, receivedChunkIndexes } from "@/lib/chunk-upload";

export const runtime = "nodejs";

// Phase 5B: chunked, resumable uploads (the dashboard upload queue, see
// src/lib/upload-client.ts uploadOne). Server logic lives in src/lib/chunk-upload.ts.
// GET  ?uploadId=  -> { received: [indexes] } so a client can resume.
// POST multipart { uploadId, index, total, name, type, size, setId, chunk }
//      the final chunk assembles the file and runs the shared upload pipeline.

async function owned(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const collection = await db.collection.findFirst({ where: { id, userId: user.id } });
  return collection ? { user, collection } : null;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await owned(params.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const uploadId = req.nextUrl.searchParams.get("uploadId") || "";
  return NextResponse.json({ received: uploadId ? await receivedChunkIndexes(uploadId) : [] });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await owned(params.id);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const form = await req.formData();
  const chunk = form.get("chunk");
  if (!(chunk instanceof File)) return NextResponse.json({ error: "Bad chunk" }, { status: 400 });
  const r = await receiveChunk({
    userId: ctx.user.id,
    collectionId: ctx.collection.id,
    setId: String(form.get("setId") || ""),
    uploadId: String(form.get("uploadId") || ""),
    index: Number(form.get("index")),
    total: Number(form.get("total")),
    name: String(form.get("name") || "upload"),
    type: String(form.get("type") || ""),
    size: Number(form.get("size") || 0),
    bytes: Buffer.from(await chunk.arrayBuffer()),
  });
  return NextResponse.json(r.body, { status: r.status });
}

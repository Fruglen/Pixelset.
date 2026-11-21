import { NextRequest, NextResponse } from "next/server";
import { rm } from "fs/promises";
import { db } from "@/lib/db";
import { tokenUnauthorized, userFromBearer } from "@/lib/api-token";
import { fileToTemp, ingestFile, precheckUpload } from "@/lib/uploads";

export const runtime = "nodejs";

// Phase 5B platform: token authenticated upload into a collection set, through
// the same pipeline (format, size and plan limits) as dashboard uploads.
// multipart/form-data: file (one or more), setId (optional, defaults to the first set).
//
// Build pack 2026-11-20 (Lightroom groundwork), hardening:
// - at most MAX_FILES files per request (a plugin sends one photo per call);
// - each file is processed on its own: a failure is reported for that file,
//   its temp file is removed, and the other files still go through;
// - empty files are refused before anything is written;
// - the response always lists every file with ok + photoId or error, so a
//   client can retry exactly the files that failed.
const MAX_FILES = 20;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await userFromBearer(req);
  if (!user) return tokenUnauthorized();
  const collection = await db.collection.findFirst({ where: { id: params.id, userId: user.id }, include: { sets: { orderBy: { order: "asc" } } } });
  if (!collection) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  const ctype = req.headers.get("content-type") || "";
  if (!ctype.toLowerCase().startsWith("multipart/form-data")) return NextResponse.json({ error: "Send multipart/form-data" }, { status: 415 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Send multipart/form-data" }, { status: 400 });
  const setId = String(form.get("setId") || collection.sets[0]?.id || "");
  const set = collection.sets.find((s) => s.id === setId);
  if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "Attach at least one file field named file" }, { status: 400 });
  if (files.length > MAX_FILES) return NextResponse.json({ error: `At most ${MAX_FILES} files per request` }, { status: 413 });
  const results: { name: string; ok: boolean; photoId?: string; error?: string }[] = [];
  for (const f of files) {
    if (f.size === 0) {
      results.push({ name: f.name, ok: false, error: `${f.name}: the file is empty` });
      continue;
    }
    const pre = await precheckUpload(user.id, f.name, f.type, f.size);
    if (pre) {
      results.push({ name: f.name, ok: false, error: pre });
      continue;
    }
    let tmp = "";
    try {
      tmp = await fileToTemp(f);
      const out = await ingestFile({ userId: user.id, collectionId: collection.id, setId: set.id, tmpPath: tmp, originalName: f.name, mime: f.type });
      results.push({ name: f.name, ...out });
    } catch (e) {
      if (tmp) await rm(tmp, { force: true }).catch(() => {});
      results.push({ name: f.name, ok: false, error: `${f.name}: ${e instanceof Error ? e.message : "upload failed"}` });
    }
  }
  const uploaded = results.filter((r) => r.ok).length;
  return NextResponse.json({ uploaded, failed: results.length - uploaded, setId: set.id, results }, { status: uploaded === 0 ? 422 : 200 });
}

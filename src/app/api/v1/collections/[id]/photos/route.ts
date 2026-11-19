import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userFromBearer } from "@/lib/api-token";
import { fileToTemp, ingestFile, precheckUpload } from "@/lib/uploads";

export const runtime = "nodejs";

// Phase 5B platform: token authenticated upload into a collection set, through
// the same pipeline (format, size and plan limits) as dashboard uploads.
// multipart/form-data: file (one or more), setId (optional, defaults to the first set).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Invalid or missing API token" }, { status: 401 });
  const collection = await db.collection.findFirst({ where: { id: params.id, userId: user.id }, include: { sets: { orderBy: { order: "asc" } } } });
  if (!collection) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Send multipart/form-data" }, { status: 400 });
  const setId = String(form.get("setId") || collection.sets[0]?.id || "");
  const set = collection.sets.find((s) => s.id === setId);
  if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "Attach at least one file field named file" }, { status: 400 });
  const results = [];
  for (const f of files) {
    const pre = await precheckUpload(user.id, f.name, f.type, f.size);
    if (pre) {
      results.push({ name: f.name, ok: false, error: pre });
      continue;
    }
    const tmp = await fileToTemp(f);
    const out = await ingestFile({ userId: user.id, collectionId: collection.id, setId: set.id, tmpPath: tmp, originalName: f.name, mime: f.type });
    results.push({ name: f.name, ...out });
  }
  return NextResponse.json({ uploaded: results.filter((r) => r.ok).length, results });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fileToTemp, ingestFile, precheckUpload, safeName } from "@/lib/uploads";

export const runtime = "nodejs";


export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const collection = await db.collection.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contentType = req.headers.get("content-type") || "";

  // --- Add by URL (JSON) ---
  if (contentType.includes("application/json")) {
    const body = await req.json();
    const setId = typeof body.setId === "string" ? body.setId : "";
    const urls: string[] = Array.isArray(body.urls)
      ? body.urls.filter((u: unknown) => typeof u === "string" && /^https?:\/\//.test(u as string))
      : [];
    const set = await db.photoSet.findFirst({ where: { id: setId, collectionId: collection.id } });
    if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });
    if (urls.length === 0) return NextResponse.json({ error: "No valid URLs" }, { status: 400 });

    const maxOrder = await db.photo.aggregate({
      where: { setId: set.id },
      _max: { order: true },
    });
    let order = (maxOrder._max.order ?? -1) + 1;
    const created = [];
    for (const url of urls) {
      const filename = decodeURIComponent(url.split("/").pop()?.split("?")[0] || "photo.jpg");
      created.push(
        await db.photo.create({
          data: {
            collectionId: collection.id,
            setId: set.id,
            filename: safeName(filename),
            url,
            isExternal: true,
            order: order++,
          },
        })
      );
    }
    return NextResponse.json({ added: created.length });
  }

  // --- File upload (multipart), through the shared Phase 5B pipeline ---
  const form = await req.formData();
  const setId = String(form.get("setId") || "");
  const set = await db.photoSet.findFirst({ where: { id: setId, collectionId: collection.id } });
  if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "No files" }, { status: 400 });

  let added = 0;
  const errors: string[] = [];
  for (const file of files) {
    const pre = await precheckUpload(user.id, file.name || "", file.type || "", file.size);
    if (pre) {
      errors.push(pre);
      continue;
    }
    const tmp = await fileToTemp(file);
    const out = await ingestFile({
      userId: user.id,
      collectionId: collection.id,
      setId: set.id,
      tmpPath: tmp,
      originalName: file.name || "photo.jpg",
      mime: file.type || "",
    });
    if (out.ok) added++;
    else if (out.error) errors.push(out.error);
  }

  return NextResponse.json({ added, skipped: errors.length, errors });
}

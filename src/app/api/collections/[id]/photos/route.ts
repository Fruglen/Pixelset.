import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  makeRawPreview,
  makeVideoPoster,
  mediaTypeFor,
  probeVideoDuration,
  probeVideoSize,
} from "@/lib/media";

export const runtime = "nodejs";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "photo.jpg";
}

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

  // --- File upload (multipart) ---
  const form = await req.formData();
  const setId = String(form.get("setId") || "");
  const set = await db.photoSet.findFirst({ where: { id: setId, collectionId: collection.id } });
  if (!set) return NextResponse.json({ error: "Set not found" }, { status: 404 });

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: "No files" }, { status: 400 });

  const dir = path.join(process.cwd(), "public", "uploads", collection.id);
  await mkdir(dir, { recursive: true });

  const maxOrder = await db.photo.aggregate({ where: { setId: set.id }, _max: { order: true } });
  let order = (maxOrder._max.order ?? -1) + 1;

  let added = 0;
  let skipped = 0;
  for (const file of files) {
    const mediaType = mediaTypeFor(file.name || "", file.type || "");
    if (!mediaType) {
      skipped++;
      continue;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const base = safeName(file.name || "photo.jpg");
    const stored = `${randomBytes(6).toString("hex")}-${base}`;
    const storedPath = path.join(dir, stored);
    await writeFile(storedPath, buffer);

    let width: number | null = null;
    let height: number | null = null;
    let durationSec: number | null = null;
    let posterUrl = "";

    if (mediaType === "IMAGE") {
      try {
        const sharp = (await import("sharp")).default;
        const meta = await sharp(buffer).metadata();
        width = meta.width ?? null;
        height = meta.height ?? null;
      } catch {}
    } else if (mediaType === "VIDEO") {
      durationSec = await probeVideoDuration(storedPath);
      const size = await probeVideoSize(storedPath);
      width = size?.width ?? null;
      height = size?.height ?? null;
      const posterStored = `${stored.replace(/\.[^.]+$/, "")}-poster.jpg`;
      if (await makeVideoPoster(storedPath, path.join(dir, posterStored))) {
        posterUrl = `/uploads/${collection.id}/${posterStored}`;
      }
    } else if (mediaType === "RAW") {
      // Attempt a JPEG preview; most vendor RAW formats are not decodable with
      // the tools available, so the gallery shows an honest RAW badge tile.
      const previewStored = `${stored.replace(/\.[^.]+$/, "")}-preview.jpg`;
      if (await makeRawPreview(buffer, path.join(dir, previewStored))) {
        posterUrl = `/uploads/${collection.id}/${previewStored}`;
        try {
          const sharp = (await import("sharp")).default;
          const meta = await sharp(path.join(dir, previewStored)).metadata();
          width = meta.width ?? null;
          height = meta.height ?? null;
        } catch {}
      }
    }

    await db.photo.create({
      data: {
        collectionId: collection.id,
        setId: set.id,
        filename: base,
        url: `/uploads/${collection.id}/${stored}`,
        isExternal: false,
        width,
        height,
        mediaType,
        durationSec,
        posterUrl,
        fileSize: buffer.length,
        order: order++,
      },
    });
    added++;
  }

  return NextResponse.json({ added, skipped });
}

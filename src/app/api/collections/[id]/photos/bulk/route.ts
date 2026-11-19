import { NextRequest, NextResponse } from "next/server";
import { rm, copyFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { permissionError } from "@/lib/team";

// Phase 5B: one action applied to many selected photos.
// actions: move | copy | delete | rename | watermark | private | star

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const collection = await db.collection.findFirst({ where: { id: params.id, userId: user.id } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const ids: string[] = Array.isArray(body.photoIds) ? body.photoIds.filter((x: unknown) => typeof x === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "Select photos first" }, { status: 400 });
  const photos = await db.photo.findMany({
    where: { id: { in: ids }, collectionId: collection.id },
    orderBy: [{ setId: "asc" }, { order: "asc" }],
  });
  const action = String(body.action || "");

  if (action === "move" || action === "copy") {
    const targetCollectionId = typeof body.collectionId === "string" && body.collectionId ? body.collectionId : collection.id;
    const target = await db.photoSet.findFirst({
      where: { id: String(body.setId || ""), collectionId: targetCollectionId, collection: { userId: user.id } },
    });
    if (!target) return NextResponse.json({ error: "Choose a destination set" }, { status: 400 });
    const maxOrder = await db.photo.aggregate({ where: { setId: target.id }, _max: { order: true } });
    let order = (maxOrder._max.order ?? -1) + 1;
    for (const p of photos) {
      if (action === "move" && target.collectionId === collection.id) {
        await db.photo.update({ where: { id: p.id }, data: { setId: target.id, order: order++ } });
        continue;
      }
      // Copy (or move to another collection): duplicate the file for local uploads.
      let url = p.url;
      let posterUrl = p.posterUrl;
      if (!p.isExternal && p.url.startsWith("/uploads/")) {
        const dir = path.join(process.cwd(), "public", "uploads", target.collectionId);
        await mkdir(dir, { recursive: true });
        const name = `${randomBytes(6).toString("hex")}-${path.basename(p.url).replace(/^[0-9a-f]{12}-/, "")}`;
        try {
          await copyFile(path.join(process.cwd(), "public", p.url), path.join(dir, name));
          url = `/uploads/${target.collectionId}/${name}`;
        } catch {
          continue;
        }
        if (p.posterUrl.startsWith("/uploads/")) {
          const pn = `${randomBytes(6).toString("hex")}-poster.jpg`;
          try {
            await copyFile(path.join(process.cwd(), "public", p.posterUrl), path.join(dir, pn));
            posterUrl = `/uploads/${target.collectionId}/${pn}`;
          } catch {}
        }
      }
      await db.photo.create({
        data: {
          collectionId: target.collectionId,
          setId: target.id,
          filename: p.filename,
          url,
          isExternal: p.isExternal,
          width: p.width,
          height: p.height,
          isPrivate: p.isPrivate,
          mediaType: p.mediaType,
          durationSec: p.durationSec,
          posterUrl,
          fileSize: p.fileSize,
          starred: p.starred,
          watermarkMode: p.watermarkMode,
          order: order++,
        },
      });
      if (action === "move") {
        await db.photo.delete({ where: { id: p.id } });
        if (!p.isExternal && p.url.startsWith("/uploads/")) await rm(path.join(process.cwd(), "public", p.url), { force: true });
      }
    }
    return NextResponse.json({ ok: true, count: photos.length });
  }

  if (action === "delete") {
    const denied = await permissionError("delete");
    if (denied) return NextResponse.json({ error: denied }, { status: 403 });
    for (const p of photos) {
      await db.photo.delete({ where: { id: p.id } });
      if (!p.isExternal && p.url.startsWith("/uploads/")) {
        await rm(path.join(process.cwd(), "public", p.url), { force: true });
        if (p.posterUrl.startsWith("/uploads/")) await rm(path.join(process.cwd(), "public", p.posterUrl), { force: true });
      }
    }
    if (collection.coverPhotoId && ids.includes(collection.coverPhotoId)) {
      await db.collection.update({ where: { id: collection.id }, data: { coverPhotoId: null } });
    }
    return NextResponse.json({ ok: true, count: photos.length });
  }

  if (action === "rename") {
    // pattern supports {n} (sequence, zero padded) and {name} (original base name)
    const pattern = String(body.pattern || "").trim();
    if (!pattern) return NextResponse.json({ error: "Enter a name pattern, for example Smith-Wedding-{n}" }, { status: 400 });
    const start = Number(body.start) || 1;
    const pad = String(photos.length + start).length;
    let n = start;
    for (const p of photos) {
      const ext = path.extname(p.filename);
      const base = p.filename.slice(0, p.filename.length - ext.length);
      let next = pattern.replace(/\{n\}/g, String(n).padStart(Math.max(pad, 3), "0")).replace(/\{name\}/g, base);
      next = next.replace(/[^a-zA-Z0-9._ -]+/g, "_");
      if (!pattern.includes("{n}") && photos.length > 1) next = `${next}-${String(n).padStart(3, "0")}`;
      await db.photo.update({ where: { id: p.id }, data: { filename: `${next}${ext}` } });
      n++;
    }
    return NextResponse.json({ ok: true, count: photos.length });
  }

  if (action === "watermark") {
    const mode = ["on", "off", "inherit"].includes(body.mode) ? body.mode : "on";
    await db.photo.updateMany({ where: { id: { in: photos.map((p) => p.id) } }, data: { watermarkMode: mode } });
    return NextResponse.json({ ok: true, count: photos.length });
  }

  if (action === "private") {
    await db.photo.updateMany({ where: { id: { in: photos.map((p) => p.id) } }, data: { isPrivate: !!body.value } });
    return NextResponse.json({ ok: true, count: photos.length });
  }

  if (action === "star") {
    await db.photo.updateMany({ where: { id: { in: photos.map((p) => p.id) } }, data: { starred: !!body.value } });
    return NextResponse.json({ ok: true, count: photos.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

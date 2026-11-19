import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Night build: large digital orders bundled into ZIP parts. Any valid item
// download token on the order unlocks the bundle for the whole order's
// digital items; files are grouped into parts under a size cap so no single
// ZIP is unmanageable. Links live and die with the item tokens (7 days).
const PART_CAP = Math.max(10 * 1024 * 1024, Number(process.env.STORE_ZIP_PART_BYTES || 150 * 1024 * 1024));

async function loadBytes(url: string): Promise<Buffer | null> {
  if (url.startsWith("/uploads/")) {
    try {
      return await readFile(path.join(process.cwd(), "public", url));
    } catch {
      return null;
    }
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function loadOrder(token: string) {
  const item = await db.orderItem.findUnique({ where: { downloadToken: token }, include: { order: true } });
  if (!item || !item.downloadExpires) return { error: "Unknown download link", status: 404 as const };
  if (item.order.status === "CANCELLED") return { error: "This order was cancelled", status: 410 as const };
  if (item.downloadExpires.getTime() < Date.now()) {
    return { error: "This download link has expired (links are valid for 7 days). Contact the photographer to resend it.", status: 410 as const };
  }
  const items = await db.orderItem.findMany({ where: { orderId: item.orderId, category: "DIGITAL" } });
  const files: { name: string; bytes: Buffer }[] = [];
  const misses: string[] = [];
  const seen = new Map<string, number>();
  for (const it of items) {
    const photo = it.photoId ? await db.photo.findUnique({ where: { id: it.photoId } }) : null;
    const url = photo?.url ?? it.photoUrl;
    if (!url) {
      misses.push(it.photoName || it.productName);
      continue;
    }
    const bytes = await loadBytes(url);
    if (!bytes) {
      misses.push(it.photoName || it.productName);
      continue;
    }
    let name = (it.photoName || `file-${it.id}`).replace(/[\\/:*?"<>|]+/g, "-");
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    if (n > 1) {
      const dot = name.lastIndexOf(".");
      name = dot > 0 ? `${name.slice(0, dot)}-${n}${name.slice(dot)}` : `${name}-${n}`;
    }
    for (let q = 0; q < Math.max(1, it.qty); q++) files.push({ name: q ? `${name} (${q + 1})` : name, bytes });
  }
  // Group into parts under the cap, one file minimum per part.
  const parts: { files: typeof files; size: number }[] = [];
  let cur: typeof files = [];
  let size = 0;
  for (const f of files) {
    if (cur.length && size + f.bytes.length > PART_CAP) {
      parts.push({ files: cur, size });
      cur = [];
      size = 0;
    }
    cur.push(f);
    size += f.bytes.length;
  }
  if (cur.length) parts.push({ files: cur, size });
  return { order: item.order, parts, misses };
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const out = await loadOrder(params.token);
  if ("error" in out) return NextResponse.json({ error: out.error }, { status: out.status });
  const url = new URL(req.url);
  if (url.searchParams.get("meta") === "1") {
    return NextResponse.json({
      orderNumber: out.order.number,
      parts: out.parts.map((p, i) => ({ part: i + 1, files: p.files.length, sizeBytes: p.size })),
      misses: out.misses,
    });
  }
  const partNo = Math.max(1, Number(url.searchParams.get("part") || 1));
  const part = out.parts[partNo - 1];
  if (!part) return NextResponse.json({ error: "No such part" }, { status: 404 });
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const f of part.files) zip.file(f.name, f.bytes);
  if (out.misses.length) zip.file("_missing-files.txt", `These files could not be fetched at download time:\n${out.misses.join("\n")}\n`);
  const archive = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
  const filename =
    out.parts.length > 1 ? `${out.order.number}-digital-part-${partNo}-of-${out.parts.length}.zip` : `${out.order.number}-digital.zip`;
  return new NextResponse(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Parts-Count": String(out.parts.length),
    },
  });
}

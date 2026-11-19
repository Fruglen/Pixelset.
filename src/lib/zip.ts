import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { db } from "./db";
import { applyWatermark, loadPhotoBytes, photoWatermarked, watermarkFromUser, type WatermarkSettings } from "./watermark";
import { DOWNLOAD_SIZES } from "./design";
import { absoluteUrl, deliveryNote, sendMail } from "./mailer";
import { logActivity } from "./activity";

// Phase 5B: shared download building. Resizing, optional watermark on web
// sizes, ZIP part splitting, and the background "Download All by email" job.

export type DownloadPhoto = {
  id: string;
  url: string;
  filename: string;
  isExternal: boolean;
  isPrivate: boolean;
  setId: string;
  mediaType: string;
  watermarkMode: string;
};

export interface RenderOpts {
  px: number | null;
  watermark: WatermarkSettings | null; // set when this size must carry the watermark
  collectionWatermark: boolean;
}

export async function renderDownload(photo: DownloadPhoto, o: RenderOpts): Promise<{ bytes: Buffer; name: string; type: string } | null> {
  const raw = await loadPhotoBytes(photo.url, photo.isExternal);
  if (!raw) return null;
  if (photo.mediaType !== "IMAGE") return { bytes: raw, name: photo.filename, type: "" };
  const wm = o.watermark && photoWatermarked(o.collectionWatermark, photo.watermarkMode) ? o.watermark : null;
  if (o.px === null && !wm) return { bytes: raw, name: photo.filename, type: "" };
  try {
    let out: Buffer;
    if (wm) out = await applyWatermark(raw, wm, o.px);
    else {
      const sharp = (await import("sharp")).default;
      out = await sharp(raw).rotate().resize({ width: o.px!, height: o.px!, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
    }
    return { bytes: out, name: photo.filename.replace(/(\.[a-z0-9]+)?$/i, ".jpg"), type: "image/jpeg" };
  } catch {
    return { bytes: raw, name: photo.filename, type: "" };
  }
}

export function splitParts<T>(items: T[], partSize: number): T[][] {
  const size = Math.max(1, partSize);
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size));
  return parts.length ? parts : [[]];
}

export async function buildZip(photos: DownloadPhoto[], o: RenderOpts): Promise<{ archive: Buffer; count: number; misses: string[] }> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const misses: string[] = [];
  const used = new Set<string>();
  let count = 0;
  for (const p of photos) {
    const r = await renderDownload(p, o);
    if (!r) {
      misses.push(p.filename);
      continue;
    }
    let name = r.name;
    let n = 2;
    while (used.has(name)) name = r.name.replace(/(\.[a-z0-9]+)?$/i, `-${n++}$1`);
    used.add(name);
    zip.file(name, r.bytes);
    count++;
  }
  if (misses.length) zip.file("_missing-files.txt", `These files could not be fetched at download time:\n${misses.join("\n")}\n`);
  const archive = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
  return { archive, count, misses };
}

export function jobDir(token: string) {
  return path.join(process.cwd(), ".downloads", token.replace(/[^a-z0-9]/gi, ""));
}

/**
 * Build the parts of a Download All job in the background and email the
 * expiring link when it is ready (or note honestly that no email service is
 * connected; the link is still shown to the client on screen).
 */
export async function runDownloadJob(jobId: string) {
  const job = await db.downloadJob.findUnique({ where: { id: jobId }, include: { collection: { include: { user: true } } } });
  if (!job || job.status !== "PENDING") return;
  const c = job.collection;
  try {
    const ids = job.photoIds.split(",").filter(Boolean);
    const photos = (await db.photo.findMany({
      where: { collectionId: c.id, id: { in: ids } },
      orderBy: [{ setId: "asc" }, { order: "asc" }],
    })) as DownloadPhoto[];
    const sizeDef = DOWNLOAD_SIZES.find((s) => s.id === job.size);
    const wmSizes = c.user.watermarkSizes.split(",");
    const o: RenderOpts = {
      px: sizeDef?.px ?? null,
      watermark: c.watermark || photos.some((p) => p.watermarkMode === "on") ? (wmSizes.includes(job.size) ? watermarkFromUser(c.user) : null) : null,
      collectionWatermark: c.watermark,
    };
    const dir = jobDir(job.token);
    await mkdir(dir, { recursive: true });
    const chunks = splitParts(photos, c.zipPartSize);
    const parts: { name: string; files: number; bytes: number }[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const { archive, count } = await buildZip(chunks[i], o);
      const name = chunks.length > 1 ? `${c.slug}-part-${i + 1}-of-${chunks.length}.zip` : `${c.slug}.zip`;
      await writeFile(path.join(dir, `part-${i + 1}.zip`), archive);
      parts.push({ name, files: count, bytes: archive.length });
    }
    await db.downloadJob.update({ where: { id: job.id }, data: { status: "READY", parts: JSON.stringify(parts) } });
    const link = absoluteUrl(`/d/${job.token}`);
    const brand = c.user.businessName || c.user.name;
    const mail = await sendMail({
      userId: c.userId,
      to: job.email,
      subject: `Your photos from ${c.name} are ready to download`,
      text: `Your download of "${c.name}" is ready (${photos.length} files in ${parts.length} ZIP file${parts.length === 1 ? "" : "s"}).\n\n${link}\n\nThe link expires on ${job.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.\n\n${brand}`,
    });
    await logActivity(c.id, "DOWNLOAD_ALL", `Download All link prepared for ${job.email}, ${photos.length} files in ${parts.length} part(s) (${deliveryNote(mail)})`, job.email);
  } catch (e) {
    await db.downloadJob.update({ where: { id: job.id }, data: { status: "FAILED", error: e instanceof Error ? e.message : String(e) } });
  }
}

import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Prisma } from "@prisma/client";
import { db } from "./db";

// Phase 5B: full account export. Every model in the schema that belongs to the
// account (directly through userId, or through a parent that has one) is
// written as CSV and JSON into a ZIP, plus a manifest of every original file
// (gallery photos and videos, website media) and, on request, the original
// files themselves so a photographer can migrate away with everything.

// Fields that are credentials, never exported.
const SECRET_FIELDS = new Set(["passwordHash", "apiToken", "instagramToken", "clientPassword", "password"]);
// Models that only hold login state.
const SKIP_MODELS = new Set(["Session"]);

type DModel = (typeof Prisma.dmmf.datamodel.models)[number];

function accessor(name: string) {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/** Build a Prisma where clause that scopes a model to one user, or null if it cannot be scoped. */
export function ownershipWhere(modelName: string, userId: string): Record<string, unknown> | null {
  const models = Prisma.dmmf.datamodel.models;
  const byName = new Map(models.map((m) => [m.name, m]));
  const start = byName.get(modelName);
  if (!start) return null;
  if (modelName === "User") return { id: userId };
  const hasUserId = (m: DModel) => m.fields.some((f) => f.name === "userId" && f.kind === "scalar");
  if (hasUserId(start)) return { userId };
  // Breadth first over to-one relations, at most 3 hops (e.g. Favorite > list > collection).
  type Node = { model: DModel; chain: string[] };
  const queue: Node[] = [{ model: start, chain: [] }];
  while (queue.length) {
    const { model, chain } = queue.shift()!;
    if (chain.length >= 3) continue;
    for (const f of model.fields) {
      if (f.kind !== "object" || f.isList || !f.relationFromFields?.length) continue;
      const target = byName.get(f.type);
      if (!target) continue;
      const next = [...chain, f.name];
      if (target.name === "User") return nest(next, { id: userId });
      if (hasUserId(target)) return nest(next, { userId });
      queue.push({ model: target, chain: next });
    }
  }
  return null;
}

function nest(chain: string[], leaf: Record<string, unknown>): Record<string, unknown> {
  return chain.reduceRight<Record<string, unknown>>((acc, key) => ({ [key]: acc }), leaf);
}

function scalarFields(m: DModel) {
  return m.fields.filter((f) => f.kind === "scalar" || f.kind === "enum").map((f) => f.name).filter((n) => !SECRET_FIELDS.has(n));
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const out = [headers.join(",")];
  for (const r of rows) out.push(headers.map((h) => csvCell(r[h])).join(","));
  return out.join("\n") + "\n";
}

export interface ExportTable {
  model: string;
  rows: Record<string, unknown>[];
  headers: string[];
}

export async function collectAccountTables(userId: string): Promise<{ tables: ExportTable[]; unscoped: string[] }> {
  const tables: ExportTable[] = [];
  const unscoped: string[] = [];
  for (const m of Prisma.dmmf.datamodel.models) {
    if (SKIP_MODELS.has(m.name)) continue;
    const where = ownershipWhere(m.name, userId);
    if (!where) {
      unscoped.push(m.name);
      continue;
    }
    const headers = scalarFields(m);
    const select = Object.fromEntries(headers.map((h) => [h, true]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (db as any)[accessor(m.name)];
    if (!delegate?.findMany) continue;
    const rows = (await delegate.findMany({ where, select })) as Record<string, unknown>[];
    tables.push({ model: m.name, headers, rows });
  }
  return { tables, unscoped };
}

export interface OriginalFile {
  kind: string;
  owner: string;
  folder: string;
  filename: string;
  url: string;
  external: boolean;
  bytes: number | null;
  zipPath: string;
}

function safeName(s: string) {
  return (s || "untitled").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120);
}

export async function originalsManifest(userId: string): Promise<OriginalFile[]> {
  const files: OriginalFile[] = [];
  const photos = await db.photo.findMany({
    where: { collection: { userId } },
    include: { collection: { select: { name: true, slug: true } }, set: { select: { name: true } } },
    orderBy: [{ collectionId: "asc" }, { order: "asc" }],
  });
  const used = new Set<string>();
  const unique = (p: string) => {
    let c = p;
    let i = 1;
    while (used.has(c)) {
      const ext = path.extname(p);
      c = `${p.slice(0, p.length - ext.length)} (${++i})${ext}`;
    }
    used.add(c);
    return c;
  };
  for (const p of photos) {
    files.push({
      kind: `gallery ${p.mediaType.toLowerCase()}`,
      owner: p.collection.name,
      folder: p.set.name,
      filename: p.filename,
      url: p.url,
      external: p.isExternal,
      bytes: await localSize(p.url, p.isExternal),
      zipPath: unique(`originals/galleries/${safeName(p.collection.slug)}/${safeName(p.set.name)}/${safeName(p.filename)}`),
    });
  }
  const media = await db.siteMedia.findMany({ where: { userId } }).catch(() => []);
  for (const m of media) {
    files.push({
      kind: `website ${m.kind.toLowerCase()}`,
      owner: "Website",
      folder: "media",
      filename: m.filename,
      url: m.url,
      external: !m.url.startsWith("/uploads/"),
      bytes: await localSize(m.url, !m.url.startsWith("/uploads/")),
      zipPath: unique(`originals/website/${safeName(m.filename)}`),
    });
  }
  return files;
}

async function localSize(url: string, external: boolean): Promise<number | null> {
  if (external || !url.startsWith("/uploads/")) return null;
  try {
    return (await stat(localPath(url))).size;
  } catch {
    return null;
  }
}

function localPath(url: string) {
  return path.join(process.cwd(), "public", url);
}

/** Build the export ZIP as a Node stream. includeFiles adds the original local files (streamed from disk). */
export async function buildAccountExport(userId: string, includeFiles: boolean) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const { tables, unscoped } = await collectAccountTables(userId);
  const manifest = await originalsManifest(userId);

  for (const t of tables) {
    zip.file(`data/csv/${t.model}.csv`, toCsv(t.headers, t.rows));
    zip.file(`data/json/${t.model}.json`, JSON.stringify(t.rows, null, 2));
  }

  let bundled = 0;
  let missing = 0;
  const manifestRows = manifest.map((f) => {
    let included = "no";
    if (includeFiles && !f.external && f.bytes !== null) {
      zip.file(f.zipPath, createReadStream(localPath(f.url)), { binary: true });
      included = "yes";
      bundled++;
    } else if (!f.external && f.bytes === null) {
      missing++;
      included = "missing on disk";
    } else if (f.external) included = "external link";
    return { ...f, inZip: included, zipPath: included === "yes" ? f.zipPath : "" };
  });
  const mHeaders = ["kind", "owner", "folder", "filename", "url", "external", "bytes", "inZip", "zipPath"];
  zip.file("originals-manifest.csv", toCsv(mHeaders, manifestRows));
  zip.file("originals-manifest.json", JSON.stringify(manifestRows, null, 2));

  const summary = {
    exportedAt: new Date().toISOString(),
    tables: tables.map((t) => ({ model: t.model, rows: t.rows.length })),
    originals: { total: manifest.length, bundled, external: manifest.filter((f) => f.external).length, missing },
    includesFiles: includeFiles,
    excluded: ["Session (login sessions)", "password hashes and access tokens", ...unscoped.map((m) => `${m} (not tied to an account)`)],
  };
  zip.file(
    "README.txt",
    [
      "Pixora full account export",
      `Exported ${summary.exportedAt}`,
      "",
      "data/csv and data/json: one file per record type, every row that belongs to this account.",
      "originals-manifest.csv: every original gallery and website file with its original URL.",
      includeFiles
        ? "originals/: the original files stored by this app, by gallery and set. External linked photos are listed in the manifest with their URL."
        : "Original files are listed in the manifest but not bundled. Export again with files included to bundle them.",
      "",
      "Passwords, login sessions and access tokens are never exported.",
    ].join("\n")
  );
  zip.file("summary.json", JSON.stringify(summary, null, 2));

  const stream = zip.generateNodeStream({ type: "nodebuffer", streamFiles: true, compression: "DEFLATE", compressionOptions: { level: 3 } });
  return { stream, summary };
}

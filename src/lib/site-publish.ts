// Phase 5B: draft site + publish step.
// The editable rows (Website design fields + SitePage rows) are the DRAFT.
// Publishing copies them into Website.publishedSnapshot, which is what the
// public /site renders. Template switches and edits are therefore staged on
// the draft and only go live when the photographer hits Publish.
import { db } from "./db";
import { siteExt, updateSiteExt, extDiffers, type SiteExt } from "./site-ext";

export const DESIGN_KEYS = [
  "template",
  "palette",
  "fontTheme",
  "headerStyle",
  "logoText",
  "logoUrl",
  "tagline",
  "footerText",
  "socialInstagram",
  "socialFacebook",
  "socialPinterest",
  "spacing",
  "buttonShape",
  "arrowStyle",
] as const;
export type DesignKey = (typeof DESIGN_KEYS)[number];

export interface SnapshotPage {
  id: string;
  type: string;
  title: string;
  slug: string;
  order: number;
  visible: boolean;
  blocks: string;
  seoTitle: string;
  seoDescription: string;
  password?: string; // night build: per page password gate, "" or absent = off
}

export interface SiteSnapshot {
  version: 1;
  design: Record<DesignKey, string>;
  pages: SnapshotPage[];
  ext?: SiteExt; // night build: extended settings (tracking, cookie, animation, fonts, site password)
}

type WebsiteRow = Record<DesignKey, string> & { id: string; publishedSnapshot: string };

function pickDesign(w: Record<string, unknown>): Record<DesignKey, string> {
  const out = {} as Record<DesignKey, string>;
  for (const k of DESIGN_KEYS) out[k] = String(w[k] ?? "");
  return out;
}

function pickPage(p: SnapshotPage): SnapshotPage {
  return {
    id: p.id,
    type: p.type,
    title: p.title,
    slug: p.slug,
    order: p.order,
    visible: p.visible,
    blocks: p.blocks,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    password: String((p as unknown as Record<string, unknown>).password ?? ""),
  };
}

export function parseSnapshot(json: string): SiteSnapshot | null {
  if (!json) return null;
  try {
    const s = JSON.parse(json);
    if (!s || s.version !== 1 || !Array.isArray(s.pages) || typeof s.design !== "object") return null;
    const snap = s as SiteSnapshot;
    snap.pages = snap.pages.map((p) => ({ ...p, password: String((p as unknown as Record<string, unknown>).password ?? "") }));
    if (snap.ext) snap.ext = siteExt(snap.ext);
    return snap;
  } catch {
    return null;
  }
}

export async function draftSnapshot(websiteId: string): Promise<SiteSnapshot> {
  const website = await db.website.findUniqueOrThrow({ where: { id: websiteId } });
  const pages = await db.sitePage.findMany({ where: { websiteId }, orderBy: { order: "asc" } });
  return { version: 1, design: pickDesign(website), pages: pages.map(pickPage), ext: siteExt(website) };
}

export async function publishSite(websiteId: string) {
  const snap = await draftSnapshot(websiteId);
  await db.website.update({
    where: { id: websiteId },
    data: { publishedSnapshot: JSON.stringify(snap), publishedAt: new Date() },
  });
  return snap;
}

// Throw the draft away: restore design fields and pages from the live snapshot.
export async function discardDraft(websiteId: string) {
  const website = await db.website.findUniqueOrThrow({ where: { id: websiteId } });
  const snap = parseSnapshot(website.publishedSnapshot);
  if (!snap) return false;
  await db.$transaction([
    db.sitePage.deleteMany({ where: { websiteId } }),
    ...snap.pages.map((p) => db.sitePage.create({ data: { ...pickPage(p), websiteId } })),
    db.website.update({ where: { id: websiteId }, data: { ...snap.design } }),
  ]);
  if (snap.ext) {
    try {
      await updateSiteExt(websiteId, snap.ext);
    } catch {
      // Extended columns not applied yet; design and pages still restored.
    }
  }
  return true;
}

// Human readable list of what differs between the draft and the live site.
export function diffSnapshots(live: SiteSnapshot | null, draft: SiteSnapshot): string[] {
  if (!live) return ["Site has never been published"];
  const changes: string[] = [];
  for (const k of DESIGN_KEYS) {
    if ((live.design[k] ?? "") !== (draft.design[k] ?? "")) changes.push(k === "template" ? "Template" : `Design: ${k}`);
  }
  const liveById = new Map(live.pages.map((p) => [p.id, p]));
  const draftIds = new Set(draft.pages.map((p) => p.id));
  for (const p of draft.pages) {
    const l = liveById.get(p.id);
    if (!l) {
      changes.push(`New page: ${p.title}`);
      continue;
    }
    if (JSON.stringify(pickPage(l)) !== JSON.stringify(pickPage(p))) changes.push(`Edited page: ${p.title}`);
  }
  for (const p of live.pages) if (!draftIds.has(p.id)) changes.push(`Removed page: ${p.title}`);
  if (extDiffers(live.ext ?? siteExt(null), draft.ext ?? siteExt(null))) {
    changes.push("Site settings: tracking, cookie banner, animation, fonts or passwords");
  }
  return changes;
}

export async function draftStatus(websiteId: string) {
  const website = await db.website.findUniqueOrThrow({ where: { id: websiteId } });
  const draft = await draftSnapshot(websiteId);
  const live = parseSnapshot(website.publishedSnapshot);
  return { changes: diffSnapshots(live, draft), publishedAt: website.publishedAt };
}

// Overlay a website row with its published snapshot (what visitors see).
export function liveView<W extends WebsiteRow, P extends SnapshotPage>(
  website: W,
  draftPages: P[]
): { website: W; pages: SnapshotPage[] } {
  const snap = parseSnapshot(website.publishedSnapshot);
  if (!snap) return { website, pages: draftPages };
  return {
    website: { ...website, ...snap.design, ...(snap.ext ? (snap.ext as unknown as Partial<W>) : {}) } as W,
    pages: [...snap.pages].sort((a, b) => a.order - b.order),
  };
}

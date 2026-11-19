// Phase 5B: 301 redirects for websites. Paths are matched case-insensitively
// and ignoring a trailing slash; the query string is carried over to the target.
import { db } from "./db";

export function normalizeRedirectPath(p: string): string {
  let out = (p || "").trim();
  try {
    if (/^https?:\/\//i.test(out)) out = new URL(out).pathname;
  } catch {
    /* keep as typed */
  }
  out = out.split("#")[0].split("?")[0];
  if (!out.startsWith("/")) out = `/${out}`;
  out = out.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  return out.toLowerCase();
}

export async function findRedirect(websiteId: string, path: string) {
  const fromPath = normalizeRedirectPath(path);
  const exact = await db.siteRedirect.findUnique({ where: { websiteId_fromPath: { websiteId, fromPath } } });
  if (exact) return exact;
  // Legacy rows may have been stored with upper case letters.
  const all = await db.siteRedirect.findMany({ where: { websiteId } });
  return all.find((r) => normalizeRedirectPath(r.fromPath) === fromPath) ?? null;
}

// Follow a redirect chain (A -> B -> C) to its final target, refusing loops.
export async function resolveRedirectTarget(websiteId: string, path: string): Promise<{ toPath: string } | null> {
  const seen = new Set<string>();
  let current = normalizeRedirectPath(path);
  let hit: { toPath: string } | null = null;
  for (let i = 0; i < 10; i++) {
    if (seen.has(current)) return null; // loop, serve nothing rather than bounce forever
    seen.add(current);
    const r = await findRedirect(websiteId, current);
    if (!r) break;
    hit = r;
    if (/^https?:/i.test(r.toPath)) break;
    current = normalizeRedirectPath(r.toPath);
  }
  return hit;
}

// Would adding from -> to create a loop with the existing redirects?
export async function createsLoop(websiteId: string, fromPath: string, toPath: string): Promise<boolean> {
  if (/^https?:/i.test(toPath)) return false;
  const all = await db.siteRedirect.findMany({ where: { websiteId } });
  const map = new Map(all.map((r) => [normalizeRedirectPath(r.fromPath), r.toPath]));
  map.set(normalizeRedirectPath(fromPath), toPath);
  let cur = normalizeRedirectPath(toPath);
  const seen = new Set<string>([normalizeRedirectPath(fromPath)]);
  for (let i = 0; i < 20; i++) {
    if (seen.has(cur)) return true;
    seen.add(cur);
    const next = map.get(cur);
    if (!next || /^https?:/i.test(next)) return false;
    cur = normalizeRedirectPath(next);
  }
  return true;
}

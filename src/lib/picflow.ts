// Phase 5A, Picflow page scraping helpers (img tags, srcset, JSON blobs).

const IMAGE_URL_RE =
  /https?:\/\/[^"'\s\\<>)]+?\.(?:jpe?g|png|webp|gif|avif)(?:\?[^"'\s\\<>)]*)?/gi;

function unescapeJson(html: string): string {
  return html
    .replace(/\\u002[fF]/g, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
}

function resolveUrl(raw: string, base: string): string | null {
  try {
    const u = new URL(raw, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function widthHint(url: string): number {
  try {
    const u = new URL(url);
    const w = parseInt(u.searchParams.get("w") || u.searchParams.get("width") || "0", 10);
    return Number.isFinite(w) ? w : 0;
  } catch {
    return 0;
  }
}

/**
 * Extract candidate image URLs from a gallery page. Variants of the same image
 * (responsive srcset sizes, CDN transform params) are collapsed onto one entry
 * keyed by origin + pathname, keeping the largest-looking variant.
 */
export function extractImageUrls(html: string, baseUrl: string): string[] {
  const unescaped = unescapeJson(html);
  const candidates = new Set<string>();

  for (const m of Array.from(unescaped.matchAll(/<img[^>]+?src=["']([^"']+)["']/gi))) {
    const u = resolveUrl(m[1], baseUrl);
    if (u) candidates.add(u);
  }
  for (const m of Array.from(unescaped.matchAll(/srcset=["']([^"']+)["']/gi))) {
    for (const entry of m[1].split(",")) {
      const part = entry.trim().split(/\s+/)[0];
      const u = part ? resolveUrl(part, baseUrl) : null;
      if (u) candidates.add(u);
    }
  }
  // JSON blobs and anything else in the page source that looks like an image URL
  for (const m of Array.from(unescaped.matchAll(IMAGE_URL_RE))) {
    const u = resolveUrl(m[0], baseUrl);
    if (u) candidates.add(u);
  }

  // Collapse responsive variants: one URL per origin+pathname, widest wins.
  const byKey = new Map<string, string>();
  for (const url of Array.from(candidates)) {
    let key: string;
    try {
      const u = new URL(url);
      // Skip obvious non-gallery assets
      const file = u.pathname.toLowerCase();
      if (/favicon|\/logo|sprite|\.svg/.test(file)) continue;
      key = `${u.origin}${u.pathname}`;
    } catch {
      continue;
    }
    const prev = byKey.get(key);
    if (!prev || widthHint(url) > widthHint(prev)) byKey.set(key, url);
  }
  return Array.from(byKey.values());
}

export function filenameFor(url: string): string {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split("/").pop() || "");
    const clean = last.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80);
    return clean || "picflow-image.jpg";
  } catch {
    return "picflow-image.jpg";
  }
}


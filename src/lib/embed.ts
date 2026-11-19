// Sanitiser for the Custom embed block. Photographers paste embed code from
// video, map, form and social providers; scripts are never allowed through.
// Only <iframe> embeds survive, rebuilt from a strict attribute allowlist
// with an https src, so nothing executable reaches the public page.

export interface SafeEmbed {
  src: string;
  title: string;
  width?: number;
  height?: number;
}

const ALLOWED_ATTRS = ["src", "width", "height", "title", "allow", "allowfullscreen", "loading", "frameborder"] as const;

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!m) return "";
  return (m[2] ?? m[3] ?? m[4] ?? "").trim();
}

function isHttpsUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Known providers whose watch/page URLs convert cleanly to embed URLs. */
export function embedUrlFor(rawUrl: string): string | null {
  const v = rawUrl.trim();
  const yt = v.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = v.match(/vimeo\.com\/(?:video\/)?(\d{6,})/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const maps = v.match(/^https:\/\/www\.google\.com\/maps\/embed/);
  if (maps) return v;
  const spotify = v.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/);
  if (spotify) return `https://open.spotify.com/embed/${spotify[1]}/${spotify[2]}`;
  const calendly = v.match(/^https:\/\/calendly\.com\//);
  if (calendly) return v;
  if (isHttpsUrl(v)) return v;
  return null;
}

/**
 * Parse pasted embed code into safe iframe descriptors. A bare URL is
 * converted when it belongs to a known provider (or used as-is over https).
 * Anything without a usable iframe returns an empty list.
 */
export function sanitizeEmbed(input: string): SafeEmbed[] {
  const code = (input || "").trim();
  if (!code) return [];
  if (!code.includes("<")) {
    const src = embedUrlFor(code);
    return src ? [{ src, title: "Embedded content" }] : [];
  }
  const out: SafeEmbed[] = [];
  for (const m of Array.from(code.matchAll(/<iframe\b[^>]*>/gi))) {
    const tag = m[0];
    const src = attr(tag, "src");
    if (!src || !isHttpsUrl(src)) continue;
    const w = parseInt(attr(tag, "width"), 10);
    const h = parseInt(attr(tag, "height"), 10);
    out.push({
      src,
      title: attr(tag, "title") || "Embedded content",
      ...(Number.isFinite(w) && w > 0 ? { width: w } : {}),
      ...(Number.isFinite(h) && h > 0 ? { height: h } : {}),
    });
    void ALLOWED_ATTRS;
  }
  return out;
}

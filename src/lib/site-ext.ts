import { db } from "./db";

// Night build (Website): extended website settings. These live in columns
// requested in NIGHT-SCHEMA-NEEDS.md (Builder A section). Until the main
// agent applies them, reads fall back to defaults so the public site keeps
// rendering, and writes surface a clear error instead of corrupting data.

export interface CustomFont {
  id: string;
  name: string; // family name visitors' browsers will use
  url: string;
  format: string; // woff2 | woff | truetype | opentype
  mediaId: string;
}

export interface SiteExt {
  gaId: string;
  fbPixelId: string;
  cookieBannerEnabled: boolean;
  cookieBannerText: string;
  animationStyle: string; // none | fade | rise | zoom
  animationSpeed: string; // slow | normal | fast
  sitePassword: string;
  customFonts: CustomFont[];
  fontDisplay: string;
  fontBody: string;
}

export const SITE_EXT_DEFAULTS: SiteExt = {
  gaId: "",
  fbPixelId: "",
  cookieBannerEnabled: false,
  cookieBannerText: "",
  animationStyle: "none",
  animationSpeed: "normal",
  sitePassword: "",
  customFonts: [],
  fontDisplay: "",
  fontBody: "",
};

export const ANIMATION_STYLES = [
  { id: "none", name: "None", desc: "No entrance animation" },
  { id: "fade", name: "Fade", desc: "Sections gently fade in" },
  { id: "rise", name: "Rise", desc: "Sections rise as they appear" },
  { id: "zoom", name: "Zoom", desc: "A subtle scale in" },
] as const;
export const ANIMATION_SPEEDS = [
  { id: "slow", name: "Slow", seconds: 1.1 },
  { id: "normal", name: "Normal", seconds: 0.7 },
  { id: "fast", name: "Fast", seconds: 0.4 },
] as const;

export function parseCustomFonts(raw: unknown): CustomFont[] {
  let v: unknown = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  return v
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({
      id: String(f.id ?? ""),
      name: String(f.name ?? ""),
      url: String(f.url ?? ""),
      format: String(f.format ?? "woff2"),
      mediaId: String(f.mediaId ?? ""),
    }))
    .filter((f) => f.id && f.name && f.url);
}

/** Read the extended settings off any website shaped object. */
export function siteExt(w: unknown): SiteExt {
  if (!w || typeof w !== "object") return { ...SITE_EXT_DEFAULTS };
  const r = w as Record<string, unknown>;
  return {
    gaId: typeof r.gaId === "string" ? r.gaId : "",
    fbPixelId: typeof r.fbPixelId === "string" ? r.fbPixelId : "",
    cookieBannerEnabled: typeof r.cookieBannerEnabled === "boolean" ? r.cookieBannerEnabled : false,
    cookieBannerText: typeof r.cookieBannerText === "string" ? r.cookieBannerText : "",
    animationStyle: typeof r.animationStyle === "string" ? r.animationStyle : "none",
    animationSpeed: typeof r.animationSpeed === "string" ? r.animationSpeed : "normal",
    sitePassword: typeof r.sitePassword === "string" ? r.sitePassword : "",
    customFonts: parseCustomFonts(r.customFonts),
    fontDisplay: typeof r.fontDisplay === "string" ? r.fontDisplay : "",
    fontBody: typeof r.fontBody === "string" ? r.fontBody : "",
  };
}

/** Write extended settings (only the provided keys). Throws until the
 *  schema columns exist; callers turn that into a clear message. */
export async function updateSiteExt(websiteId: string, patch: Partial<SiteExt>): Promise<void> {
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    data[k] = k === "customFonts" ? JSON.stringify(v) : v;
  }
  if (Object.keys(data).length === 0) return;
  await db.website.update({ where: { id: websiteId }, data: data as never });
}

export function extDiffers(a: SiteExt, b: SiteExt): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

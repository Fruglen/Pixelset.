import { db } from "./db";
import { FONT_PAIRINGS } from "./design";

// Phase 5B platform: ONE brand source for the account (Settings > Account >
// Brand). Website, gallery, store, booking, contracts, quotes, questionnaires,
// invoices and payment links all read it, so the same logo, colour and heading
// font appear everywhere a client sees the business. Product level choices
// (a contract template's own logo, a website palette) still win where set.

export interface Brand {
  name: string;
  logoUrl: string;
  color: string; // primary hex, always a valid colour
  accent: string; // secondary hex
  fontId: string;
  display: string; // heading font stack
  body: string;
  custom: boolean; // true when the photographer set a brand colour
}

const HEX = /^#[0-9a-fA-F]{6}$/;
export const DEFAULT_BRAND_COLOR = "#1c1c1c";

export function validHex(v: string | null | undefined): string {
  return v && HEX.test(v) ? v : "";
}

export async function brandFor(userId: string): Promise<Brand> {
  const [u, site] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { name: true, businessName: true, brandLogoUrl: true, brandColor: true, brandAccent: true, brandFont: true },
    }),
    db.website.findUnique({ where: { userId }, select: { logoUrl: true } }),
  ]);
  const font = FONT_PAIRINGS.find((f) => f.id === u?.brandFont) ?? FONT_PAIRINGS[0];
  const color = validHex(u?.brandColor);
  return {
    name: u?.businessName || u?.name || "Studio",
    logoUrl: u?.brandLogoUrl || site?.logoUrl || "",
    color: color || DEFAULT_BRAND_COLOR,
    accent: validHex(u?.brandAccent) || color || DEFAULT_BRAND_COLOR,
    fontId: font.id,
    display: font.display,
    body: font.body,
    custom: !!color,
  };
}

/** Inline style that exposes the brand to a page: CSS variables plus the heading font. */
export function brandVars(b: Brand): Record<string, string> {
  return {
    ["--brand" as string]: b.color,
    ["--brand-accent" as string]: b.accent,
    ["--brand-display" as string]: b.display,
  };
}

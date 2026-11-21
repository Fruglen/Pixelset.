import { db } from "./db";
import { brandFor, type Brand } from "./brand";
import { sitePaletteById } from "./website";
import { fontFaceCss, googleFontsHref, resolveSiteFonts } from "./fonts";

// Fix batch 2026-11-20: contracts, invoices and quotes take the site's
// palette and font theme. The website palette gives the page, paper and
// muted colours; the website font theme (including library picks and
// uploaded fonts) gives the body and heading fonts; the account brand
// (Settings, Account, Brand) wins for the accent colour and heading font
// when the photographer set one. Accounts without a website fall back to
// the brand alone on the plain paper look.

export interface DocTheme {
  brand: Brand;
  paletteId: string;
  fontThemeId: string;
  bg: string;
  text: string;
  paper: string;
  paperText: string;
  accent: string;
  subtle: string;
  display: string;
  body: string;
  dark: boolean;
  fontsHref: string; // extra Google Fonts stylesheet for library picks, "" when none
  faceCss: string; // @font-face rules for uploaded fonts, "" when none
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export async function documentTheme(userId: string): Promise<DocTheme> {
  const [brand, site] = await Promise.all([brandFor(userId), db.website.findUnique({ where: { userId } })]);
  const palette = sitePaletteById(site?.palette ?? "paper");
  const fonts = site ? resolveSiteFonts(site as unknown as { fontTheme: string } & Record<string, unknown>) : null;
  const dark = luminance(palette.bg) < 0.2;
  const brandFontChosen = await db.user
    .findUnique({ where: { id: userId }, select: { brandFont: true } })
    .then((u) => !!u?.brandFont);
  return {
    brand,
    paletteId: site ? palette.id : "none",
    fontThemeId: site?.fontTheme ?? "none",
    bg: site ? palette.bg : "#faf9f7",
    text: site ? palette.text : "#1c1c1c",
    // the document itself reads as paper: white on light palettes, the palette's raised tone on dark ones
    paper: site ? (dark ? palette.muted : "#ffffff") : "#ffffff",
    paperText: site ? palette.text : "#1c1c1c",
    accent: brand.custom ? brand.color : site ? palette.accent : brand.color,
    subtle: site ? palette.subtle : "#737373",
    display: brandFontChosen || !fonts ? brand.display : fonts.displayCss,
    body: fonts ? fonts.bodyCss : brand.body,
    dark,
    fontsHref: fonts && fonts.googleFamilies.length ? googleFontsHref(fonts.googleFamilies) : "",
    faceCss: fonts && fonts.faces.length ? fontFaceCss(fonts.faces) : "",
  };
}

/** CSS variables for a themed document wrapper (use with className="doc-themed"). */
export function docVars(t: DocTheme): Record<string, string> {
  return {
    ["--brand" as string]: t.brand.color,
    ["--brand-accent" as string]: t.accent,
    ["--brand-display" as string]: t.display,
    ["--doc-bg" as string]: t.bg,
    ["--doc-text" as string]: t.text,
    ["--doc-paper" as string]: t.paper,
    ["--doc-paper-text" as string]: t.paperText,
    ["--doc-accent" as string]: t.accent,
    ["--doc-subtle" as string]: t.subtle,
    ["--doc-display" as string]: t.display,
    ["--doc-body" as string]: t.body,
  };
}

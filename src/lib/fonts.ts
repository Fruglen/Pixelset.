import { siteFontById } from "./website";
import { siteExt, type CustomFont } from "./site-ext";

// Night build (Website): the font library. The catalogue is the Google
// Fonts family list (well over 1000 families), fetched from Google's
// public metadata and cached in memory; a built in list of popular
// families covers offline use. Chosen families load from the Google Fonts
// CDN on public pages only. Uploaded fonts (Website.customFonts) resolve
// through @font-face instead and never touch Google.

export const BUILTIN_FONT_FAMILIES = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway", "Nunito", "Work Sans", "Rubik",
  "Playfair Display", "Merriweather", "Lora", "PT Serif", "Libre Baskerville", "Cormorant Garamond", "EB Garamond",
  "Spectral", "Crimson Pro", "Source Serif 4", "Bitter", "Arvo", "Zilla Slab", "Josefin Sans", "Quicksand",
  "Oswald", "Bebas Neue", "Archivo", "Barlow", "Manrope", "DM Sans", "DM Serif Display", "Fraunces", "Marcellus",
  "Cinzel", "Cormorant", "Italiana", "Jost", "Karla", "Mulish", "Heebo", "Assistant", "Cabin", "Hind",
  "Fira Sans", "Titillium Web", "Exo 2", "Ubuntu", "Noto Sans", "Noto Serif", "PT Sans", "Source Sans 3",
  "IBM Plex Sans", "IBM Plex Serif", "IBM Plex Mono", "Space Grotesk", "Space Mono", "Roboto Mono", "JetBrains Mono",
  "Dancing Script", "Great Vibes", "Alex Brush", "Allura", "Pinyon Script", "Tangerine", "Sacramento", "Parisienne",
  "Cormorant SC", "Marcellus SC", "Cinzel Decorative", "Unica One", "Poiret One", "Limelight", "Abril Fatface",
  "Alfa Slab One", "Anton", "Archivo Black", "Libre Franklin", "Public Sans", "Fraunces", "Gloock", "Italiana",
  "Alegreya", "Alegreya Sans", "Cardo", "Gentium Book Plus", "Vollkorn", "Sora", "Outfit", "Plus Jakarta Sans",
  "Bricolage Grotesque", "Instrument Serif", "Instrument Sans", "Gabarito", "Onest", "Wix Madefor Display",
  "Playfair", "Prata", "Yeseva One", "Rozha One", "Bodoni Moda", "Italiana", "Cormorant Infant", "Forum",
  "Tenor Sans", "Julius Sans One", "Michroma", "Syncopate", "Megrim", "Gruppo", "Wire One",
];

let cache: { at: number; families: string[] } | null = null;

export async function googleFontFamilies(): Promise<{ families: string[]; live: boolean }> {
  if (cache && Date.now() - cache.at < 24 * 3600 * 1000) return { families: cache.families, live: true };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch("https://fonts.google.com/metadata/fonts", { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error("bad status");
    let text = await res.text();
    const nl = text.indexOf("\n");
    if (text.startsWith(")]}'")) text = text.slice(nl + 1);
    const data = JSON.parse(text) as { familyMetadataList?: { family: string }[] };
    const families = (data.familyMetadataList ?? []).map((f) => f.family).filter(Boolean);
    if (families.length < 500) throw new Error("short catalogue");
    cache = { at: Date.now(), families };
    return { families, live: true };
  } catch {
    return { families: Array.from(new Set(BUILTIN_FONT_FAMILIES)), live: false };
  }
}

export interface ResolvedFonts {
  displayCss: string;
  bodyCss: string;
  googleFamilies: string[];
  faces: CustomFont[];
}

/** Resolve the effective display/body families for a site, honouring the
 *  photographer's library picks and uploaded fonts over the theme. */
export function resolveSiteFonts(website: { fontTheme: string } & Record<string, unknown>): ResolvedFonts {
  const theme = siteFontById(website.fontTheme);
  const ext = siteExt(website);
  const googleFamilies: string[] = [];
  const faces: CustomFont[] = [];
  const pick = (name: string, fallback: string): string => {
    if (!name) return fallback;
    const uploaded = ext.customFonts.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (uploaded) {
      if (!faces.some((f) => f.id === uploaded.id)) faces.push(uploaded);
      return `'${uploaded.name}', ${fallback}`;
    }
    if (!googleFamilies.includes(name)) googleFamilies.push(name);
    return `'${name}', ${fallback}`;
  };
  return {
    displayCss: pick(ext.fontDisplay, theme.display),
    bodyCss: pick(ext.fontBody, theme.body),
    googleFamilies,
    faces,
  };
}

export function googleFontsHref(families: string[]): string {
  const list = families.slice(0, 4).map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@300;400;500;600;700`);
  return `https://fonts.googleapis.com/css2?${list.join("&")}&display=swap`;
}

export function fontFaceCss(faces: CustomFont[]): string {
  return faces
    .map(
      (f) => `@font-face { font-family: '${f.name.replace(/'/g, "")}'; src: url('${f.url}') format('${f.format}'); font-weight: 100 900; font-display: swap; }`
    )
    .join("\n");
}

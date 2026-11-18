// Website design vocabulary: palettes, font themes, header styles, page set.
// (Pixieset offers ~40 palettes/font themes; the spec allows a 12/12 subset.)

export const SITE_PALETTES = [
  { id: "paper", name: "Paper", bg: "#ffffff", text: "#1c1c1c", accent: "#8a7357", muted: "#f5f3f0", subtle: "#6f6a62" },
  { id: "ivory", name: "Ivory", bg: "#faf7f0", text: "#2b2620", accent: "#a08c5b", muted: "#f1ece1", subtle: "#7a7264" },
  { id: "sand", name: "Sand", bg: "#f6f1e8", text: "#3d3528", accent: "#b5906b", muted: "#ece4d4", subtle: "#857a66" },
  { id: "terracotta", name: "Terracotta", bg: "#faf4ee", text: "#3a2d24", accent: "#b06a45", muted: "#f2e6da", subtle: "#8a7362" },
  { id: "sage", name: "Sage", bg: "#f3f5f1", text: "#2c332c", accent: "#71806a", muted: "#e6ebe3", subtle: "#6d766a" },
  { id: "forest", name: "Forest", bg: "#f1f4f0", text: "#22302a", accent: "#3d5c4c", muted: "#e2e9e4", subtle: "#5d6f66" },
  { id: "blush", name: "Blush", bg: "#fbf4f2", text: "#3a2e2c", accent: "#c08478", muted: "#f4e7e3", subtle: "#8d7672" },
  { id: "ocean", name: "Ocean", bg: "#f2f5f7", text: "#243038", accent: "#4e7187", muted: "#e4ebef", subtle: "#64747f" },
  { id: "slate", name: "Slate", bg: "#eef0f2", text: "#272b30", accent: "#5a6672", muted: "#e2e5e9", subtle: "#696f77" },
  { id: "dove", name: "Dove", bg: "#f7f7f7", text: "#303030", accent: "#8c8c8c", muted: "#ececec", subtle: "#737373" },
  { id: "dusk", name: "Dusk", bg: "#2b2a33", text: "#eceaf2", accent: "#b7a9d6", muted: "#393844", subtle: "#a9a5b8" },
  { id: "noir", name: "Noir", bg: "#121212", text: "#f2f2f2", accent: "#c9a96a", muted: "#1f1f1f", subtle: "#a8a8a8" },
] as const;

export type SitePalette = (typeof SITE_PALETTES)[number];

// Web-safe stacks only (this replica loads no external fonts).
export const SITE_FONT_THEMES = [
  { id: "editorial", name: "Editorial", display: "Georgia, 'Times New Roman', serif", body: "'Helvetica Neue', Helvetica, Arial, sans-serif", displayWeight: "400", displayTracking: "0", displayTransform: "none" },
  { id: "elegant", name: "Elegant", display: "'Didot', 'Bodoni MT', Georgia, serif", body: "'Gill Sans', 'Segoe UI', Verdana, sans-serif", displayWeight: "400", displayTracking: "0.01em", displayTransform: "none" },
  { id: "classicserif", name: "Classic Serif", display: "'Times New Roman', Times, serif", body: "Georgia, 'Times New Roman', serif", displayWeight: "400", displayTracking: "0", displayTransform: "none" },
  { id: "palatial", name: "Palatial", display: "'Palatino Linotype', Palatino, 'Book Antiqua', serif", body: "'Segoe UI', Verdana, sans-serif", displayWeight: "400", displayTracking: "0.01em", displayTransform: "none" },
  { id: "baskerton", name: "Baskerton", display: "Baskerville, 'Baskerville Old Face', Georgia, serif", body: "'Helvetica Neue', Arial, sans-serif", displayWeight: "400", displayTracking: "0", displayTransform: "none" },
  { id: "modern", name: "Modern", display: "'Helvetica Neue', Helvetica, Arial, sans-serif", body: "'Helvetica Neue', Helvetica, Arial, sans-serif", displayWeight: "600", displayTracking: "-0.01em", displayTransform: "none" },
  { id: "statement", name: "Statement", display: "'Arial Black', 'Helvetica Neue', sans-serif", body: "'Helvetica Neue', Arial, sans-serif", displayWeight: "800", displayTracking: "-0.02em", displayTransform: "uppercase" },
  { id: "gallerymono", name: "Gallery Mono", display: "'Courier New', Courier, monospace", body: "'Helvetica Neue', Arial, sans-serif", displayWeight: "600", displayTracking: "0.02em", displayTransform: "uppercase" },
  { id: "airy", name: "Airy", display: "'Trebuchet MS', 'Segoe UI', sans-serif", body: "Verdana, Geneva, sans-serif", displayWeight: "300", displayTracking: "0.14em", displayTransform: "uppercase" },
  { id: "scandi", name: "Scandi", display: "'Segoe UI', 'Helvetica Neue', sans-serif", body: "'Segoe UI', 'Helvetica Neue', sans-serif", displayWeight: "300", displayTracking: "0.08em", displayTransform: "uppercase" },
  { id: "handwritten", name: "Handwritten", display: "'Brush Script MT', 'Segoe Script', cursive", body: "'Trebuchet MS', 'Segoe UI', sans-serif", displayWeight: "400", displayTracking: "0.01em", displayTransform: "none" },
  { id: "bookish", name: "Bookish", display: "'Book Antiqua', 'Palatino Linotype', Georgia, serif", body: "Georgia, serif", displayWeight: "400", displayTracking: "0", displayTransform: "none" },
] as const;

export type SiteFontTheme = (typeof SITE_FONT_THEMES)[number];

export const HEADER_STYLES = [
  { id: "left", name: "Left", desc: "Logo left, navigation right" },
  { id: "center", name: "Center", desc: "Centered logo, navigation beneath" },
  { id: "stacked", name: "Stacked", desc: "Large centered logo over centered navigation" },
  { id: "minimal", name: "Minimal", desc: "Small logo, compact uppercase navigation" },
] as const;

export const PAGE_TYPES = [
  { id: "HOME", title: "Home", slug: "" },
  { id: "PORTFOLIO", title: "Portfolio", slug: "portfolio" },
  { id: "ABOUT", title: "About", slug: "about" },
  { id: "EXPERIENCE", title: "Experience", slug: "experience" },
  { id: "PRICING", title: "Pricing", slug: "pricing" },
  { id: "REVIEWS", title: "Reviews", slug: "reviews" },
  { id: "BLOG", title: "Blog", slug: "blog" },
  { id: "CONTACT", title: "Contact", slug: "contact" },
  { id: "CLIENT_AREA", title: "Client Area", slug: "client-area" },
] as const;

export function sitePaletteById(id: string): SitePalette {
  return SITE_PALETTES.find((p) => p.id === id) ?? SITE_PALETTES[1];
}
export function siteFontById(id: string): SiteFontTheme {
  return SITE_FONT_THEMES.find((f) => f.id === id) ?? SITE_FONT_THEMES[0];
}

// Local SVG placeholder imagery (works offline; users swap in their own URLs
// or gallery photos). Variants: photo | portrait | detail | landscape.
export function ph(opts: { w?: number; h?: number; hue?: number; label?: string; variant?: string }): string {
  const q = new URLSearchParams();
  q.set("w", String(opts.w ?? 1600));
  q.set("h", String(opts.h ?? 1067));
  q.set("hue", String(opts.hue ?? 32));
  if (opts.label) q.set("label", opts.label);
  if (opts.variant) q.set("variant", opts.variant);
  return `/api/placeholder?${q.toString()}`;
}

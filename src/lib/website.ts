// Website design vocabulary: palettes, font themes, header styles, page set.
// Phase 5B: 40 palettes and 40 font themes, matching Pixieset's curated sets.

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
  { id: "linen", name: "Linen", bg: "#f8f5ef", text: "#2f2a24", accent: "#9b8466", muted: "#efe9df", subtle: "#7b7366" },
  { id: "oat", name: "Oat", bg: "#f4efe6", text: "#38322a", accent: "#a68a64", muted: "#e9e1d3", subtle: "#81786a" },
  { id: "almond", name: "Almond", bg: "#fbf6ee", text: "#3b3127", accent: "#c29b6e", muted: "#f2e8d9", subtle: "#8a7c6b" },
  { id: "clay", name: "Clay", bg: "#f5ede6", text: "#3a2b23", accent: "#9c5f43", muted: "#ebddd2", subtle: "#86705f" },
  { id: "rust", name: "Rust", bg: "#f7efe8", text: "#33241c", accent: "#a5502f", muted: "#eedfd2", subtle: "#866b5c" },
  { id: "desert", name: "Desert", bg: "#f6eee3", text: "#3c2f23", accent: "#c07b4f", muted: "#ecdfcc", subtle: "#887661" },
  { id: "honey", name: "Honey", bg: "#fbf6ea", text: "#352c1c", accent: "#c4973d", muted: "#f2e9d2", subtle: "#857a60" },
  { id: "olive", name: "Olive", bg: "#f4f3ec", text: "#2d2f24", accent: "#6f7446", muted: "#e7e6d9", subtle: "#6f7164" },
  { id: "moss", name: "Moss", bg: "#eff2ec", text: "#263024", accent: "#55704a", muted: "#e0e7dc", subtle: "#65715f" },
  { id: "eucalyptus", name: "Eucalyptus", bg: "#f0f4f2", text: "#24302c", accent: "#5f8a7d", muted: "#e0e9e5", subtle: "#64756f" },
  { id: "mint", name: "Mint", bg: "#f2f8f5", text: "#203029", accent: "#4f9a80", muted: "#e1efe8", subtle: "#62776d" },
  { id: "pine", name: "Pine", bg: "#1d2622", text: "#e8eee9", accent: "#9fbf8f", muted: "#28332e", subtle: "#a3b0a8" },
  { id: "rose", name: "Rose", bg: "#fbf1f1", text: "#3b2a2c", accent: "#b7646f", muted: "#f3e1e2", subtle: "#8f7275" },
  { id: "peony", name: "Peony", bg: "#fdf3f5", text: "#3a2830", accent: "#c76f8c", muted: "#f6e2e8", subtle: "#91707c" },
  { id: "mauve", name: "Mauve", bg: "#f7f1f3", text: "#33282e", accent: "#93687c", muted: "#ece0e5", subtle: "#80707a" },
  { id: "plum", name: "Plum", bg: "#271c25", text: "#f1e8ef", accent: "#c79bbd", muted: "#33262f", subtle: "#b3a2ae" },
  { id: "lavender", name: "Lavender", bg: "#f5f3fa", text: "#2b2836", accent: "#7c6fae", muted: "#e9e5f3", subtle: "#716c82" },
  { id: "sky", name: "Sky", bg: "#f1f6fb", text: "#1f2b38", accent: "#4f86b8", muted: "#e0ebf5", subtle: "#62717f" },
  { id: "harbor", name: "Harbor", bg: "#eef2f5", text: "#1f2a33", accent: "#2f5f7f", muted: "#dde5eb", subtle: "#5f6d78" },
  { id: "navy", name: "Navy", bg: "#141c2b", text: "#eef1f6", accent: "#c8a86b", muted: "#1e2839", subtle: "#a3abb9" },
  { id: "storm", name: "Storm", bg: "#e9ebed", text: "#22262a", accent: "#46525d", muted: "#dcdfe2", subtle: "#62686e" },
  { id: "charcoal", name: "Charcoal", bg: "#232323", text: "#ededed", accent: "#e0b88a", muted: "#2e2e2e", subtle: "#a9a9a9" },
  { id: "graphite", name: "Graphite", bg: "#2a2d31", text: "#eceef0", accent: "#8fb3c9", muted: "#353940", subtle: "#a5aab0" },
  { id: "espresso", name: "Espresso", bg: "#241b16", text: "#f3ebe4", accent: "#c89b6d", muted: "#2f241e", subtle: "#b3a397" },
  { id: "wine", name: "Wine", bg: "#faf2f2", text: "#2f1c1f", accent: "#7d2e3a", muted: "#f0e0e1", subtle: "#866c70" },
  { id: "citrus", name: "Citrus", bg: "#fdfaf0", text: "#2f2b1d", accent: "#c98a1a", muted: "#f5eed6", subtle: "#827b62" },
  { id: "coral", name: "Coral", bg: "#fdf4f0", text: "#382621", accent: "#e0725a", muted: "#f7e3da", subtle: "#8d7068" },
  { id: "monochrome", name: "Monochrome", bg: "#ffffff", text: "#000000", accent: "#000000", muted: "#f0f0f0", subtle: "#555555" },
] as const;

export type SitePalette = (typeof SITE_PALETTES)[number];

// Web-safe stacks only (this replica loads no external fonts).
export const SITE_FONT_THEMES = [
  { id: "editorial", name: "Editorial", display: "'EB Garamond', Georgia, serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "400", displayTracking: "0", displayTransform: "none" },
  { id: "elegant", name: "Elegant", display: "'Bodoni Moda', 'EB Garamond', serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "400", displayTracking: "0.01em", displayTransform: "none" },
  { id: "classicserif", name: "Classic Serif", display: "'EB Garamond', Georgia, serif", body: "'EB Garamond', Georgia, serif", displayWeight: "400", displayTracking: "0", displayTransform: "none" },
  { id: "palatial", name: "Palatial", display: "'EB Garamond', Georgia, serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "400", displayTracking: "0.01em", displayTransform: "none" },
  { id: "baskerton", name: "Baskerton", display: "'EB Garamond', Georgia, serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "400", displayTracking: "0", displayTransform: "none" },
  { id: "modern", name: "Modern", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "600", displayTracking: "-0.01em", displayTransform: "none" },
  { id: "statement", name: "Statement", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "800", displayTracking: "-0.02em", displayTransform: "uppercase" },
  { id: "gallerymono", name: "Gallery Mono", display: "'Courier New', Courier, monospace", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "600", displayTracking: "0.02em", displayTransform: "uppercase" },
  { id: "airy", name: "Airy", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "300", displayTracking: "0.14em", displayTransform: "uppercase" },
  { id: "scandi", name: "Scandi", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "300", displayTracking: "0.08em", displayTransform: "uppercase" },
  { id: "handwritten", name: "Handwritten", display: "'Dancing Script', 'EB Garamond', cursive", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "400", displayTracking: "0.01em", displayTransform: "none" },
  { id: "bookish", name: "Bookish", display: "'EB Garamond', Georgia, serif", body: "'EB Garamond', Georgia, serif", displayWeight: "400", displayTracking: "0", displayTransform: "none" },
  { id: "didone", name: "Didone", display: "'Bodoni Moda', 'EB Garamond', serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "400", displayTracking: "0.02em", displayTransform: "uppercase" },
  { id: "couture", name: "Couture", display: "'Bodoni Moda', 'EB Garamond', serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "300", displayTracking: "0.2em", displayTransform: "uppercase" },
  { id: "heirloom", name: "Heirloom", display: "'EB Garamond', Georgia, serif", body: "'EB Garamond', Georgia, serif", displayWeight: "400", displayTracking: "0.01em", displayTransform: "none" },
  { id: "gazette", name: "Gazette", display: "'EB Garamond', Georgia, serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "700", displayTracking: "-0.01em", displayTransform: "none" },
  { id: "broadsheet", name: "Broadsheet", display: "'EB Garamond', Georgia, serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "700", displayTracking: "-0.015em", displayTransform: "none" },
  { id: "folio", name: "Folio", display: "'EB Garamond', Georgia, serif", body: "'EB Garamond', Georgia, serif", displayWeight: "400", displayTracking: "0.12em", displayTransform: "uppercase" },
  { id: "chapel", name: "Chapel", display: "'EB Garamond', Georgia, serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "400", displayTracking: "0.06em", displayTransform: "uppercase" },
  { id: "signature", name: "Signature", display: "'Dancing Script', 'EB Garamond', cursive", body: "'EB Garamond', Georgia, serif", displayWeight: "400", displayTracking: "0", displayTransform: "none" },
  { id: "letterpress", name: "Letterpress", display: "'Courier New', Courier, monospace", body: "'EB Garamond', Georgia, serif", displayWeight: "400", displayTracking: "0.04em", displayTransform: "none" },
  { id: "typewriter", name: "Typewriter", display: "'Courier New', Courier, monospace", body: "'Courier New', Courier, monospace", displayWeight: "400", displayTracking: "0", displayTransform: "none" },
  { id: "swiss", name: "Swiss", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "700", displayTracking: "-0.03em", displayTransform: "none" },
  { id: "grotesk", name: "Grotesk", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "500", displayTracking: "-0.02em", displayTransform: "none" },
  { id: "poster", name: "Poster", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "400", displayTracking: "0.02em", displayTransform: "uppercase" },
  { id: "headline", name: "Headline", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'EB Garamond', Georgia, serif", displayWeight: "900", displayTracking: "-0.03em", displayTransform: "none" },
  { id: "geometric", name: "Geometric", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "400", displayTracking: "0.1em", displayTransform: "uppercase" },
  { id: "futurist", name: "Futurist", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "500", displayTracking: "0.02em", displayTransform: "none" },
  { id: "humanist", name: "Humanist", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "400", displayTracking: "0.02em", displayTransform: "none" },
  { id: "quiet", name: "Quiet", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "300", displayTracking: "0.24em", displayTransform: "uppercase" },
  { id: "nordic", name: "Nordic", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'EB Garamond', Georgia, serif", displayWeight: "400", displayTracking: "0.18em", displayTransform: "uppercase" },
  { id: "studio", name: "Studio", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "600", displayTracking: "0.04em", displayTransform: "none" },
  { id: "journal", name: "Journal", display: "'EB Garamond', Georgia, serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "400", displayTracking: "0", displayTransform: "none" },
  { id: "romance", name: "Romance", display: "'Dancing Script', 'EB Garamond', cursive", body: "'EB Garamond', Georgia, serif", displayWeight: "400", displayTracking: "0.02em", displayTransform: "none" },
  { id: "atelier", name: "Atelier", display: "'EB Garamond', Georgia, serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "300", displayTracking: "0.03em", displayTransform: "none" },
  { id: "vintage", name: "Vintage", display: "'EB Garamond', Georgia, serif", body: "'Courier New', Courier, monospace", displayWeight: "400", displayTracking: "0.08em", displayTransform: "uppercase" },
  { id: "lookbook", name: "Lookbook", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'EB Garamond', Georgia, serif", displayWeight: "700", displayTracking: "0.3em", displayTransform: "uppercase" },
  { id: "minimalist", name: "Minimalist", display: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "200", displayTracking: "0.28em", displayTransform: "uppercase" },
  { id: "bold-serif", name: "Bold Serif", display: "'EB Garamond', Georgia, serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "900", displayTracking: "-0.02em", displayTransform: "none" },
  { id: "whisper", name: "Whisper", display: "'EB Garamond', Georgia, serif", body: "'Nunito Sans', 'Segoe UI', system-ui, sans-serif", displayWeight: "400", displayTracking: "0.32em", displayTransform: "uppercase" },
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

// Phase 5B site-wide design controls (Design tab).
export const SPACING_OPTIONS = [
  { id: "compact", name: "Compact", desc: "Tighter sections", pad: "2rem", padMd: "2.5rem" },
  { id: "regular", name: "Regular", desc: "Balanced breathing room", pad: "2.5rem", padMd: "3.5rem" },
  { id: "airy", name: "Airy", desc: "Generous editorial space", pad: "3.5rem", padMd: "6rem" },
] as const;
export const BUTTON_SHAPES = [
  { id: "square", name: "Square", radius: "2px" },
  { id: "rounded", name: "Rounded", radius: "10px" },
  { id: "pill", name: "Pill", radius: "999px" },
] as const;
export const ARROW_STYLES = [
  { id: "none", name: "None", glyph: "" },
  { id: "arrow", name: "Arrow", glyph: "→" },
  { id: "chevron", name: "Chevron", glyph: "›" },
  { id: "line", name: "Long line", glyph: "⟶" },
] as const;
export function spacingById(id: string) {
  return SPACING_OPTIONS.find((o) => o.id === id) ?? SPACING_OPTIONS[1];
}
export function buttonShapeById(id: string) {
  return BUTTON_SHAPES.find((o) => o.id === id) ?? BUTTON_SHAPES[0];
}
export function arrowById(id: string) {
  return ARROW_STYLES.find((o) => o.id === id) ?? ARROW_STYLES[0];
}

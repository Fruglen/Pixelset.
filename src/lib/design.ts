// Design vocabulary for client galleries (mirrors Pixieset's Design tab:
// Cover / Typography / Color / Grid).

export const COVER_STYLES = [
  { id: "classic", name: "Classic", desc: "Full-bleed cover, title bottom left" },
  { id: "novel", name: "Novel", desc: "Centered title over the photo" },
  { id: "frame", name: "Frame", desc: "Inset border around the cover" },
  { id: "stripe", name: "Stripe", desc: "Split panel, title beside the photo" },
  { id: "journal", name: "Journal", desc: "Photo on top, title block below" },
  { id: "divider", name: "Divider", desc: "Centered title with rule lines" },
  { id: "vintage", name: "Vintage", desc: "Framed photo card on the palette, title and date below" },
  { id: "none", name: "None", desc: "No cover, straight to the grid" },
] as const;

export const FONT_PAIRINGS = [
  {
    id: "editorial",
    name: "Editorial",
    display: "Georgia, 'Times New Roman', serif",
    body: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  {
    id: "elegant",
    name: "Elegant",
    display: "'Didot', 'Bodoni MT', Georgia, serif",
    body: "'Gill Sans', 'Segoe UI', Verdana, sans-serif",
  },
  {
    id: "classicserif",
    name: "Classic Serif",
    display: "'Times New Roman', Times, serif",
    body: "Georgia, 'Times New Roman', serif",
  },
  {
    id: "modern",
    name: "Modern",
    display: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    body: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  {
    id: "mono",
    name: "Gallery Mono",
    display: "'Courier New', Courier, monospace",
    body: "'Helvetica Neue', Arial, sans-serif",
  },
  {
    id: "airy",
    name: "Airy",
    display: "'Trebuchet MS', 'Segoe UI', sans-serif",
    body: "Verdana, Geneva, sans-serif",
  },
] as const;

export const PALETTES = [
  { id: "paper", name: "Paper", bg: "#ffffff", text: "#1c1c1c", accent: "#8a7357", muted: "#f5f3f0" },
  { id: "ivory", name: "Ivory", bg: "#faf7f0", text: "#2b2620", accent: "#a08c5b", muted: "#f1ece1" },
  { id: "sand", name: "Sand", bg: "#f6f1e8", text: "#3d3528", accent: "#b5906b", muted: "#ede5d6" },
  { id: "sage", name: "Sage", bg: "#f3f5f1", text: "#2c332c", accent: "#71806a", muted: "#e6ebe3" },
  { id: "blush", name: "Blush", bg: "#fbf4f2", text: "#3a2e2c", accent: "#c08478", muted: "#f4e7e3" },
  { id: "ocean", name: "Ocean", bg: "#f2f5f7", text: "#243038", accent: "#4e7187", muted: "#e4ebef" },
  { id: "slate", name: "Slate", bg: "#eef0f2", text: "#272b30", accent: "#5a6672", muted: "#e2e5e9" },
  { id: "dusk", name: "Dusk", bg: "#2b2a33", text: "#eceaf2", accent: "#b7a9d6", muted: "#393844" },
  { id: "noir", name: "Noir", bg: "#121212", text: "#f2f2f2", accent: "#c9a96a", muted: "#1f1f1f" },
] as const;

export const GRID_STYLES = [
  { id: "vertical", name: "Vertical", desc: "Column flow, flatters portrait photos" },
  { id: "horizontal", name: "Horizontal", desc: "Row flow, flatters landscape photos" },
] as const;

export const THUMB_SIZES = [
  { id: "regular", name: "Regular" },
  { id: "large", name: "Large" },
] as const;

export const GRID_SPACINGS = [
  { id: "regular", name: "Regular" },
  { id: "large", name: "Large" },
] as const;

export const DOWNLOAD_SIZES = [
  { id: "original", label: "Original", px: null as number | null },
  { id: "high3600", label: "High Resolution (3600px)", px: 3600 },
  { id: "web2048", label: "Web Size (2048px)", px: 2048 },
  { id: "web1024", label: "Web Size (1024px)", px: 1024 },
  { id: "web640", label: "Web Size (640px)", px: 640 },
] as const;

export const COLLECTION_STATUSES = [
  { id: "DRAFT", name: "Draft", desc: "Only you can see this collection" },
  { id: "PRERELEASE", name: "Pre-release", desc: "Clients can register their email to be notified" },
  { id: "PUBLISHED", name: "Published", desc: "Live, anyone with the link (and password) can view" },
] as const;

export function paletteById(id: string) {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}
export function fontById(id: string) {
  return FONT_PAIRINGS.find((f) => f.id === id) ?? FONT_PAIRINGS[0];
}

// Settings fields copied into / applied from a Collection Preset.
export const PRESET_FIELDS = [
  "coverStyle",
  "fontPairing",
  "palette",
  "gridStyle",
  "thumbSize",
  "gridSpacing",
  "emailRegistration",
  "watermark",
  "downloadEnabled",
  "pinEnabled",
  "pinUseLimit",
  "freeDownloadCap",
  "downloadSizes",
  "allowSingle",
  "allowZip",
  "videoDownloadEnabled",
  "expiryReminder",
] as const;

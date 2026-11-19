// Block registry for the website builder (Flex-style block editor).
// Each block = { id, type, props }. Pages store a JSON array of blocks.
// The registry drives both the generic editor forms and the public renderers.

export type FieldKind = "text" | "textarea" | "number" | "toggle" | "select" | "image" | "video" | "items" | "canvas" | "sessionTypes";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  options?: { value: string; label: string }[]; // for select
  fields?: FieldDef[]; // for items (one level of nesting)
  itemLabel?: string; // for items, label of one entry
  help?: string;
}

export interface BlockDef {
  type: string;
  name: string;
  category: string;
  desc: string;
  fields: FieldDef[];
  defaults: Record<string, unknown>;
}

export interface Block {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

export const BLOCK_CATEGORIES = [
  "Hero",
  "Text",
  "Images",
  "Galleries",
  "Business",
  "Social proof",
  "Forms",
  "Dynamic",
  "Layout",
  "Flex canvas",
] as const;

const align = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];
const sides = [
  { value: "left", label: "Image left" },
  { value: "right", label: "Image right" },
];
const heights = [
  { value: "full", label: "Full screen" },
  { value: "tall", label: "Tall" },
  { value: "medium", label: "Medium" },
  { value: "short", label: "Short" },
];
const widths = [
  { value: "narrow", label: "Narrow" },
  { value: "regular", label: "Regular" },
  { value: "wide", label: "Wide" },
  { value: "full", label: "Full width" },
];
const columns = [
  { value: "2", label: "2 columns" },
  { value: "3", label: "3 columns" },
  { value: "4", label: "4 columns" },
];

const img = (key: string, label: string): FieldDef => ({ key, label, kind: "image" });
const txt = (key: string, label: string): FieldDef => ({ key, label, kind: "text" });
const area = (key: string, label: string): FieldDef => ({ key, label, kind: "textarea" });
const sel = (key: string, label: string, options: { value: string; label: string }[]): FieldDef => ({ key, label, kind: "select", options });
const tog = (key: string, label: string): FieldDef => ({ key, label, kind: "toggle" });

export const BLOCK_DEFS: BlockDef[] = [
  // ------------------------------------------------------------- Hero
  {
    type: "hero",
    name: "Hero",
    category: "Hero",
    desc: "Full-bleed cover image with headline and call to action",
    fields: [
      img("image", "Background image"), txt("imageAlt", "Image alt text"),
      txt("kicker", "Kicker (small line above)"), txt("heading", "Heading"), area("subheading", "Subheading"),
      txt("buttonLabel", "Button label"), txt("buttonLink", "Button link"),
      sel("height", "Height", heights), sel("align", "Text alignment", align),
      tog("overlay", "Darken image behind text"),
    ],
    defaults: { image: "", imageAlt: "", kicker: "", heading: "Timeless photography", subheading: "", buttonLabel: "", buttonLink: "", height: "tall", align: "center", overlay: true },
  },
  {
    type: "heroSplit",
    name: "Split hero",
    category: "Hero",
    desc: "Half image, half headline",
    fields: [
      img("image", "Image"), txt("imageAlt", "Image alt text"), sel("side", "Image side", sides),
      txt("kicker", "Kicker"), txt("heading", "Heading"), area("subheading", "Subheading"),
      txt("buttonLabel", "Button label"), txt("buttonLink", "Button link"),
    ],
    defaults: { image: "", imageAlt: "", side: "left", kicker: "", heading: "Photography with feeling", subheading: "", buttonLabel: "", buttonLink: "" },
  },
  {
    type: "slideshow",
    name: "Slideshow hero",
    category: "Hero",
    desc: "Cross-fading full-width slideshow",
    fields: [
      { key: "slides", label: "Slides", kind: "items", itemLabel: "Slide", fields: [img("image", "Image"), txt("imageAlt", "Alt text"), txt("caption", "Caption")] },
      txt("heading", "Overlay heading"), sel("height", "Height", heights),
    ],
    defaults: { slides: [], heading: "", height: "tall" },
  },
  // ------------------------------------------------------------- Text
  {
    type: "heading",
    name: "Section heading",
    category: "Text",
    desc: "Display heading with optional intro line",
    fields: [txt("kicker", "Kicker"), txt("heading", "Heading"), area("intro", "Intro text"), sel("align", "Alignment", align)],
    defaults: { kicker: "", heading: "Section heading", intro: "", align: "center" },
  },
  {
    type: "text",
    name: "Text",
    category: "Text",
    desc: "Paragraphs of body text",
    fields: [area("body", "Text (blank line = new paragraph)"), sel("align", "Alignment", align), sel("width", "Width", widths)],
    defaults: { body: "Write something about your studio.", align: "left", width: "narrow" },
  },
  {
    type: "quote",
    name: "Pull quote",
    category: "Text",
    desc: "Large quote with attribution",
    fields: [area("quote", "Quote"), txt("attribution", "Attribution")],
    defaults: { quote: "Light is the first of painters.", attribution: "" },
  },
  {
    type: "columnsText",
    name: "Text columns",
    category: "Text",
    desc: "Two or three titled text columns",
    fields: [
      { key: "items", label: "Columns", kind: "items", itemLabel: "Column", fields: [txt("title", "Title"), area("body", "Body")] },
      sel("cols", "Columns", columns),
    ],
    defaults: { items: [], cols: "2" },
  },
  {
    type: "list",
    name: "Feature list",
    category: "Text",
    desc: "Checklist of highlights",
    fields: [
      txt("heading", "Heading"),
      { key: "items", label: "Items", kind: "items", itemLabel: "Item", fields: [txt("text", "Text")] },
      sel("cols", "Columns", [{ value: "1", label: "1 column" }, ...columns]),
    ],
    defaults: { heading: "", items: [], cols: "2" },
  },
  // ------------------------------------------------------------- Images
  {
    type: "imageFull",
    name: "Image",
    category: "Images",
    desc: "Single large image with optional caption",
    fields: [img("image", "Image"), txt("imageAlt", "Alt text"), txt("caption", "Caption"), sel("width", "Width", widths)],
    defaults: { image: "", imageAlt: "", caption: "", width: "wide" },
  },
  {
    type: "imageText",
    name: "Image + text",
    category: "Images",
    desc: "Image beside a text block",
    fields: [
      img("image", "Image"), txt("imageAlt", "Alt text"), sel("side", "Image side", sides),
      txt("kicker", "Kicker"), txt("heading", "Heading"), area("body", "Body text"),
      txt("buttonLabel", "Button label"), txt("buttonLink", "Button link"),
    ],
    defaults: { image: "", imageAlt: "", side: "left", kicker: "", heading: "About the studio", body: "", buttonLabel: "", buttonLink: "" },
  },
  {
    type: "imageGrid",
    name: "Image row",
    category: "Images",
    desc: "Two to four images side by side",
    fields: [
      { key: "images", label: "Images", kind: "items", itemLabel: "Image", fields: [img("url", "Image"), txt("alt", "Alt text"), txt("caption", "Caption")] },
    ],
    defaults: { images: [] },
  },
  {
    type: "video",
    name: "Video",
    category: "Images",
    desc: "YouTube or Vimeo embed, or an uploaded MP4 / WebM video",
    fields: [
      { key: "url", label: "Video (YouTube or Vimeo link, or upload an MP4 / WebM)", kind: "video" },
      img("poster", "Poster image (uploaded videos)"),
      txt("caption", "Caption"), sel("width", "Width", widths),
      tog("autoplay", "Autoplay muted and loop (uploaded videos)"),
    ],
    defaults: { url: "", poster: "", caption: "", width: "regular", autoplay: false },
  },
  // ------------------------------------------------------------- Galleries
  {
    type: "galleryGrid",
    name: "Gallery grid",
    category: "Galleries",
    desc: "Uniform grid of images",
    fields: [
      { key: "images", label: "Images", kind: "items", itemLabel: "Image", fields: [img("url", "Image"), txt("alt", "Alt text")] },
      sel("cols", "Columns", columns), tog("gap", "Spacing between images"),
    ],
    defaults: { images: [], cols: "3", gap: true },
  },
  {
    type: "galleryMasonry",
    name: "Masonry gallery",
    category: "Galleries",
    desc: "Column-flow gallery that honors each image's ratio",
    fields: [
      { key: "images", label: "Images", kind: "items", itemLabel: "Image", fields: [img("url", "Image"), txt("alt", "Alt text")] },
      sel("cols", "Columns", columns),
    ],
    defaults: { images: [], cols: "3" },
  },
  {
    type: "carousel",
    name: "Film strip",
    category: "Galleries",
    desc: "Horizontally scrolling strip of images",
    fields: [
      { key: "images", label: "Images", kind: "items", itemLabel: "Image", fields: [img("url", "Image"), txt("alt", "Alt text")] },
    ],
    defaults: { images: [] },
  },
  {
    type: "collectionEmbed",
    name: "Collection photos",
    category: "Galleries",
    desc: "Pulls photos live from one of your client galleries",
    fields: [
      txt("collectionSlug", "Collection URL slug (e.g. emma-james-wedding)"),
      { key: "count", label: "Photos to show", kind: "number" },
      sel("cols", "Columns", columns),
      tog("link", "Link to the gallery"),
    ],
    defaults: { collectionSlug: "", count: 6, cols: "3", link: true },
  },
  {
    type: "beforeAfter",
    name: "Pair",
    category: "Galleries",
    desc: "Two images presented as a pair",
    fields: [
      img("imageA", "First image"), txt("imageAAlt", "First alt text"),
      img("imageB", "Second image"), txt("imageBAlt", "Second alt text"),
      txt("caption", "Caption"),
    ],
    defaults: { imageA: "", imageAAlt: "", imageB: "", imageBAlt: "", caption: "" },
  },
  // ------------------------------------------------------------- Business
  {
    type: "pricingPackages",
    name: "Pricing packages",
    category: "Business",
    desc: "Package cards with features",
    fields: [
      { key: "packages", label: "Packages", kind: "items", itemLabel: "Package", fields: [
        txt("name", "Name"), txt("price", "Price"), txt("unit", "Unit (e.g. per session)"),
        area("features", "Features (one per line)"), tog("featured", "Highlight"),
      ] },
      sel("cols", "Columns", columns),
    ],
    defaults: { packages: [], cols: "3" },
  },
  {
    type: "pricingTable",
    name: "Comparison table",
    category: "Business",
    desc: "Feature-by-feature package comparison",
    fields: [
      area("columns", "Package names (one per line)"),
      { key: "rows", label: "Rows", kind: "items", itemLabel: "Row", fields: [txt("feature", "Feature"), txt("values", "Values, comma separated (✓, -, text)")] },
      txt("note", "Footnote"),
    ],
    defaults: { columns: "Essential\nSignature\nHeirloom", rows: [], note: "" },
  },
  {
    type: "services",
    name: "Services",
    category: "Business",
    desc: "Service cards",
    fields: [
      { key: "items", label: "Services", kind: "items", itemLabel: "Service", fields: [txt("title", "Title"), area("body", "Description"), img("image", "Image (optional)"), txt("imageAlt", "Alt text")] },
      sel("cols", "Columns", columns),
    ],
    defaults: { items: [], cols: "3" },
  },
  {
    type: "experienceTimeline",
    name: "Timeline",
    category: "Business",
    desc: "Milestones, the experience, step by step",
    fields: [
      { key: "items", label: "Steps", kind: "items", itemLabel: "Step", fields: [txt("marker", "Marker (year / step)"), txt("title", "Title"), area("body", "Description")] },
    ],
    defaults: { items: [] },
  },
  {
    type: "stats",
    name: "Numbers",
    category: "Business",
    desc: "Stat counters",
    fields: [
      { key: "items", label: "Stats", kind: "items", itemLabel: "Stat", fields: [txt("value", "Value"), txt("label", "Label")] },
    ],
    defaults: { items: [] },
  },
  {
    type: "team",
    name: "Team",
    category: "Business",
    desc: "People cards with portraits",
    fields: [
      { key: "items", label: "People", kind: "items", itemLabel: "Person", fields: [img("image", "Portrait"), txt("imageAlt", "Alt text"), txt("name", "Name"), txt("role", "Role"), area("bio", "Bio")] },
      sel("cols", "Columns", columns),
    ],
    defaults: { items: [], cols: "3" },
  },
  {
    type: "faq",
    name: "FAQ",
    category: "Business",
    desc: "Expandable questions and answers",
    fields: [
      txt("heading", "Heading"),
      { key: "items", label: "Questions", kind: "items", itemLabel: "Question", fields: [txt("q", "Question"), area("a", "Answer")] },
    ],
    defaults: { heading: "Frequently asked questions", items: [] },
  },
  {
    type: "logos",
    name: "Featured in",
    category: "Business",
    desc: "Press / client name strip",
    fields: [txt("heading", "Heading"), area("names", "Names (one per line)")],
    defaults: { heading: "As seen in", names: "" },
  },
  {
    type: "cta",
    name: "Call to action",
    category: "Business",
    desc: "Banner with heading and button",
    fields: [
      txt("heading", "Heading"), area("body", "Supporting text"),
      txt("buttonLabel", "Button label"), txt("buttonLink", "Button link"),
      tog("tinted", "Tinted background"),
    ],
    defaults: { heading: "Let's make something beautiful", body: "", buttonLabel: "Get in touch", buttonLink: "/contact", tinted: true },
  },
  // ------------------------------------------------------------- Social proof
  {
    type: "testimonials",
    name: "Testimonials",
    category: "Social proof",
    desc: "Grid of client quotes",
    fields: [
      { key: "items", label: "Testimonials", kind: "items", itemLabel: "Testimonial", fields: [area("quote", "Quote"), txt("name", "Client name"), txt("detail", "Detail (e.g. Wedding, 2026)")] },
      sel("cols", "Columns", columns),
    ],
    defaults: { items: [], cols: "2" },
  },
  {
    type: "testimonialSingle",
    name: "Featured testimonial",
    category: "Social proof",
    desc: "One large quote, optionally with a portrait",
    fields: [area("quote", "Quote"), txt("name", "Client name"), txt("detail", "Detail"), img("image", "Portrait (optional)"), txt("imageAlt", "Alt text")],
    defaults: { quote: "", name: "", detail: "", image: "", imageAlt: "" },
  },
  {
    type: "reviewsWall",
    name: "Reviews",
    category: "Social proof",
    desc: "Star-rated reviews",
    fields: [
      { key: "items", label: "Reviews", kind: "items", itemLabel: "Review", fields: [
        sel("stars", "Stars", [5, 4, 3].map((n) => ({ value: String(n), label: `${n} stars` }))),
        area("quote", "Review"), txt("name", "Name"), txt("source", "Source (e.g. Google)"),
      ] },
    ],
    defaults: { items: [] },
  },
  {
    type: "instagram",
    name: "Instagram strip",
    category: "Social proof",
    desc: "Your latest Instagram posts, live when your account is connected",
    fields: [
      sel("source", "Source", [{ value: "live", label: "Live feed when connected (manual images as fallback)" }, { value: "manual", label: "Manual images only" }]),
      { key: "count", label: "Posts to show", kind: "number" },
      txt("handle", "Handle (e.g. @lightandshadow)"), txt("url", "Profile link"),
      { key: "images", label: "Fallback images", kind: "items", itemLabel: "Image", fields: [img("url", "Image"), txt("alt", "Alt text")] },
    ],
    defaults: { source: "live", count: 6, handle: "", url: "", images: [] },
  },
  // ------------------------------------------------------------- Forms
  {
    type: "contactForm",
    name: "Contact form",
    category: "Forms",
    desc: "Working inquiry form, submissions land in your inbox",
    fields: [
      txt("heading", "Heading"), area("intro", "Intro text"),
      tog("phone", "Ask for phone number"), tog("subject", "Ask for a subject"),
      txt("buttonLabel", "Button label"), txt("success", "Success message"),
    ],
    defaults: { heading: "Get in touch", intro: "", phone: false, subject: true, buttonLabel: "Send message", success: "Thank you, we'll be in touch within two business days." },
  },
  {
    type: "bookingEmbed",
    name: "Booking inquiry",
    category: "Forms",
    desc: "Booking request form (session type + preferred date)",
    fields: [
      txt("heading", "Heading"), area("intro", "Intro text"),
      area("sessionTypes", "Session types (one per line)"),
      txt("buttonLabel", "Button label"), txt("success", "Success message"),
    ],
    defaults: { heading: "Book a session", intro: "", sessionTypes: "Portrait session\nWedding\nBrand shoot", buttonLabel: "Request booking", success: "Request received, we'll confirm your date shortly." },
  },
  {
    // Phase 5B (studio): live mini session calendar from the booking engine
    type: "miniSession",
    name: "Mini session calendar",
    category: "Forms",
    desc: "Live open spots for your published mini sessions, each spot books directly",
    fields: [
      txt("heading", "Heading"), area("intro", "Intro text"),
      { key: "miniName", label: "Only this mini session (name, leave empty for all)", kind: "text" },
      tog("showDetails", "Show mini session details"),
    ],
    defaults: { heading: "Mini sessions", intro: "Pick an open spot to book.", miniName: "", showDetails: true },
  },
  {
    type: "newsletter",
    name: "Newsletter signup",
    category: "Forms",
    desc: "Email capture strip",
    fields: [txt("heading", "Heading"), txt("subtext", "Subtext"), txt("buttonLabel", "Button label")],
    defaults: { heading: "Join the mailing list", subtext: "Occasional letters, new work, mini sessions, print sales.", buttonLabel: "Subscribe" },
  },
  // ------------------------------------------------------------- Dynamic
  {
    type: "blogList",
    name: "Blog posts",
    category: "Dynamic",
    desc: "Latest published journal posts, pulled live",
    fields: [txt("heading", "Heading"), { key: "count", label: "Posts to show", kind: "number" }, sel("layout", "Layout", [{ value: "grid", label: "Grid" }, { value: "list", label: "List" }])],
    defaults: { heading: "From the journal", count: 3, layout: "grid" },
  },
  {
    type: "clientGalleries",
    name: "Client gallery access",
    category: "Dynamic",
    desc: "Auto lists your published client galleries, each opening through its own password or email gate",
    fields: [
      txt("heading", "Heading"), area("intro", "Intro text"),
      sel("which", "Galleries", [
        { value: "all", label: "All published galleries" },
        { value: "homepage", label: "Only galleries set to Show on homepage" },
        { value: "chosen", label: "Only the galleries listed below" },
      ]),
      area("slugs", "Gallery URL slugs (one per line, for the listed option)"),
      { key: "count", label: "Maximum galleries", kind: "number" },
      sel("sort", "Order", [{ value: "eventDate", label: "Event date, newest first" }, { value: "created", label: "Recently created" }, { value: "name", label: "Name A-Z" }]),
      sel("cols", "Columns", columns),
      tog("showCovers", "Show gallery covers"), tog("showPrerelease", "Include pre-release galleries (visitors can register for launch)"),
      tog("search", "Show a search box"),
    ],
    defaults: { heading: "Find your gallery", intro: "Enter through your gallery below, you may need the password from your welcome email.", which: "all", slugs: "", count: 24, sort: "eventDate", cols: "3", showCovers: true, showPrerelease: false, search: true },
  },
  {
    type: "map",
    name: "Location",
    category: "Dynamic",
    desc: "Stylized map card with address",
    fields: [txt("heading", "Heading"), txt("address", "Address"), area("details", "Details (hours, parking…)")],
    defaults: { heading: "The studio", address: "", details: "" },
  },
  {
    type: "socialLinks",
    name: "Social links",
    category: "Dynamic",
    desc: "Links to your profiles",
    fields: [
      { key: "items", label: "Links", kind: "items", itemLabel: "Link", fields: [txt("label", "Label"), txt("url", "URL")] },
    ],
    defaults: { items: [] },
  },
  {
    // Night build (Website): bio link list, the link-in-bio page pattern.
    type: "linkList",
    name: "Bio link list",
    category: "Dynamic",
    desc: "A link-in-bio stack: portrait, name, and big tappable link buttons for social profiles",
    fields: [
      img("avatar", "Portrait or logo"), txt("avatarAlt", "Portrait alt text"),
      txt("heading", "Name or heading"), area("subtext", "Short line under the name"),
      { key: "links", label: "Links", kind: "items", itemLabel: "Link", fields: [txt("label", "Label"), txt("url", "URL"), txt("note", "Small note (optional)")] },
      sel("style", "Button style", [{ value: "pill", label: "Pill buttons" }, { value: "cards", label: "Cards with notes" }]),
    ],
    defaults: { avatar: "", avatarAlt: "", heading: "", subtext: "", links: [], style: "pill" },
  },
  // ------------------------------------------------------------- Layout
  {
    type: "divider",
    name: "Divider",
    category: "Layout",
    desc: "Horizontal rule",
    fields: [sel("style", "Style", [{ value: "line", label: "Line" }, { value: "dots", label: "Dots" }, { value: "flourish", label: "Flourish" }])],
    defaults: { style: "line" },
  },
  {
    type: "spacer",
    name: "Spacer",
    category: "Layout",
    desc: "Vertical breathing room",
    fields: [sel("size", "Size", [{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }])],
    defaults: { size: "medium" },
  },
  {
    type: "button",
    name: "Button",
    category: "Layout",
    desc: "Standalone call-to-action button",
    fields: [txt("label", "Label"), txt("link", "Link"), sel("align", "Alignment", align), sel("variant", "Style", [{ value: "solid", label: "Solid" }, { value: "outline", label: "Outline" }, { value: "text", label: "Text link" }])],
    defaults: { label: "Learn more", link: "/about", align: "center", variant: "solid" },
  },
  {
    // Night build (Website): custom embed code, sanitised to https iframes.
    type: "embed",
    name: "Custom embed",
    category: "Layout",
    desc: "Embed a video, map, form or widget from another service (paste the embed code or a link; scripts are stripped for safety)",
    fields: [
      area("code", "Embed code or link (iframe embeds only, https)"),
      txt("title", "Title (for accessibility)"),
      sel("ratio", "Frame shape", [
        { value: "16:9", label: "Responsive 16:9" },
        { value: "4:3", label: "Responsive 4:3" },
        { value: "1:1", label: "Responsive square" },
        { value: "fixed", label: "Use the size in the embed code" },
      ]),
      sel("width", "Width", widths),
    ],
    defaults: { code: "", title: "", ratio: "16:9", width: "wide" },
  },
  // ------------------------------------------------------------- Phase 5B
  {
    type: "bookingCalendar",
    name: "Booking calendar",
    category: "Forms",
    desc: "Live Studio Manager availability with a slot picker, books for real",
    fields: [
      txt("heading", "Heading"), area("intro", "Intro text"),
      { key: "sessionTypeIds", label: "Sessions to offer (none ticked = all open sessions)", kind: "sessionTypes" },
      sel("layout", "Layout", [{ value: "cards", label: "Session cards" }, { value: "list", label: "Compact list" }]),
    ],
    defaults: { heading: "Book your session", intro: "Pick a session, choose an open time, and you're booked.", sessionTypeIds: [], layout: "cards" },
  },
  {
    type: "freeform",
    name: "Flex canvas",
    category: "Flex canvas",
    desc: "Free form section: drag, drop, move and resize text, images, video, buttons and shapes anywhere",
    fields: [{ key: "elements", label: "Canvas", kind: "canvas" }],
    defaults: { height: 560, elements: [] },
  },
];

// Phase 5B: per-block design settings, stored in props with a leading
// underscore so every block type supports them. Rendered by RenderBlocks.
export const BLOCK_STYLE_KEYS = ["_palette", "_anchor", "_navLabel", "_width", "_minHeight", "_dev"] as const;

// Night build (Website): per device layout overrides, stored in props._dev.
// Desktop uses _width/_minHeight; tablet and mobile can override width and
// minimum height, or hide the block entirely on that device class.
export interface DeviceOverride {
  hidden?: boolean;
  width?: number; // percent, 20..100
  minHeight?: number; // px
}
export interface DeviceLayouts {
  tablet?: DeviceOverride;
  mobile?: DeviceOverride;
}
export function parseDeviceLayouts(v: unknown): DeviceLayouts {
  if (!v || typeof v !== "object") return {};
  const raw = v as Record<string, unknown>;
  const one = (x: unknown): DeviceOverride | undefined => {
    if (!x || typeof x !== "object") return undefined;
    const o = x as Record<string, unknown>;
    const out: DeviceOverride = {};
    if (typeof o.hidden === "boolean") out.hidden = o.hidden;
    const w = Number(o.width);
    if (Number.isFinite(w) && w > 0) out.width = Math.min(100, Math.max(20, Math.round(w)));
    const h = Number(o.minHeight);
    if (Number.isFinite(h) && h > 0) out.minHeight = Math.min(2000, Math.round(h));
    return Object.keys(out).length ? out : undefined;
  };
  const tablet = one(raw.tablet);
  const mobile = one(raw.mobile);
  return { ...(tablet ? { tablet } : {}), ...(mobile ? { mobile } : {}) };
}

export interface FreeElement {
  id: string;
  kind: "text" | "image" | "video" | "button" | "shape";
  x: number; // percent of canvas width
  y: number; // percent of canvas height
  w: number; // percent of canvas width
  h: number; // percent of canvas height
  rotate?: number;
  z?: number;
  text?: string;
  fontSize?: number;
  color?: string;
  align?: string;
  font?: string; // display | body
  url?: string;
  alt?: string;
  link?: string;
  variant?: string;
  shape?: string; // rect | circle | line
  fill?: string;
  radius?: number;
  opacity?: number;
}

export const FREEFORM_WIDTH = 1152; // design width of a Flex canvas (matches the site's wide container)

export function newFreeElement(kind: FreeElement["kind"], x = 35, y = 35): FreeElement {
  const id = `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const base = { id, kind, x, y, rotate: 0, z: 1, opacity: 1 };
  switch (kind) {
    case "text":
      return { ...base, w: 36, h: 14, text: "Double click to edit", fontSize: 32, color: "", align: "left", font: "display" };
    case "image":
      return { ...base, w: 30, h: 45, url: "", alt: "" };
    case "video":
      return { ...base, w: 40, h: 40, url: "" };
    case "button":
      return { ...base, w: 18, h: 9, text: "Book now", link: "/contact", variant: "solid" };
    case "shape":
      return { ...base, w: 20, h: 25, shape: "rect", fill: "accent", radius: 0, opacity: 0.85, z: 0 };
  }
}

export function parseFreeElements(v: unknown): FreeElement[] {
  if (!Array.isArray(v)) return [];
  const clamp = (n: unknown, lo: number, hi: number, d: number) => {
    const x = typeof n === "number" ? n : parseFloat(String(n));
    return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
  };
  return v
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object" && typeof (e as Record<string, unknown>).kind === "string")
    .filter((e) => ["text", "image", "video", "button", "shape"].includes(String(e.kind)))
    .map((e) => ({
      ...(e as unknown as FreeElement),
      id: typeof e.id === "string" ? e.id : `e${Math.random().toString(36).slice(2, 9)}`,
      x: clamp(e.x, -50, 150, 10),
      y: clamp(e.y, -50, 150, 10),
      w: clamp(e.w, 1, 200, 20),
      h: clamp(e.h, 1, 200, 10),
      rotate: clamp(e.rotate, -360, 360, 0),
      z: clamp(e.z, 0, 99, 1),
      opacity: clamp(e.opacity, 0, 1, 1),
    }));
}

export const blockDef = (type: string) => BLOCK_DEFS.find((d) => d.type === type);

export function newBlockId(): string {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function makeBlock(type: string, props: Record<string, unknown> = {}): Block {
  const def = blockDef(type);
  return { id: newBlockId(), type, props: { ...(def?.defaults ?? {}), ...props } };
}

export function parseBlocks(json: string): Block[] {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.filter((b) => b && typeof b === "object" && typeof b.type === "string")
      .map((b) => ({ id: typeof b.id === "string" ? b.id : newBlockId(), type: b.type, props: b.props && typeof b.props === "object" ? b.props : {} }));
  } catch {
    return [];
  }
}

// Collect every image reference in a page's blocks (for the SEO alt-text audit).
export function collectImages(blocks: Block[]): { blockId: string; blockType: string; path: string; url: string; alt: string }[] {
  const out: { blockId: string; blockType: string; path: string; url: string; alt: string }[] = [];
  for (const block of blocks) {
    const def = blockDef(block.type);
    if (!def) continue;
    for (const f of def.fields) {
      if (f.kind === "image") {
        const url = String(block.props[f.key] ?? "");
        if (!url) continue;
        // find companion alt field by convention
        const altKey = f.key === "image" ? "imageAlt" : `${f.key}Alt`;
        out.push({ blockId: block.id, blockType: block.type, path: f.key, url, alt: String(block.props[altKey] ?? "") });
      }
      if (f.kind === "items" && f.fields) {
        const imgField = f.fields.find((sf) => sf.kind === "image");
        if (!imgField) continue;
        const items = Array.isArray(block.props[f.key]) ? (block.props[f.key] as Record<string, unknown>[]) : [];
        items.forEach((item, i) => {
          const url = String(item[imgField.key] ?? "");
          if (!url) return;
          const altKey = imgField.key === "image" ? "imageAlt" : imgField.key === "url" ? "alt" : `${imgField.key}Alt`;
          out.push({ blockId: block.id, blockType: block.type, path: `${f.key}.${i}`, url, alt: String(item[altKey] ?? "") });
        });
      }
    }
  }
  return out;
}

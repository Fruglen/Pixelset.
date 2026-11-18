// Block registry for the website builder (Flex-style block editor).
// Each block = { id, type, props }. Pages store a JSON array of blocks.
// The registry drives both the generic editor forms and the public renderers.

export type FieldKind = "text" | "textarea" | "number" | "toggle" | "select" | "image" | "items";

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
    desc: "YouTube or Vimeo embed",
    fields: [txt("url", "YouTube / Vimeo URL"), txt("caption", "Caption"), sel("width", "Width", widths)],
    defaults: { url: "", caption: "", width: "regular" },
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
    desc: "Instagram-style image strip with handle",
    fields: [
      txt("handle", "Handle (e.g. @lightandshadow)"), txt("url", "Profile link"),
      { key: "images", label: "Images", kind: "items", itemLabel: "Image", fields: [img("url", "Image"), txt("alt", "Alt text")] },
    ],
    defaults: { handle: "", url: "", images: [] },
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
    desc: "Your published client galleries with links, the client area",
    fields: [txt("heading", "Heading"), area("intro", "Intro text"), tog("showCovers", "Show gallery covers")],
    defaults: { heading: "Find your gallery", intro: "Enter through your gallery below, you may need the password from your welcome email.", showCovers: true },
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
];

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

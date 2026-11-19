// Website templates, preset bundles of pages/blocks/fonts/palettes in
// Pixieset's named families. Switching templates rebuilds the page set and
// applies the template's palette/font/header; blog posts are stored separately
// and always survive the switch.

import { Block, makeBlock, parseBlocks } from "./blocks";
import { ph } from "./website";

export interface TemplatePage {
  type: string;
  title: string;
  slug: string;
  blocks: Block[];
  visible?: boolean;
}

export type TemplateFamily = "portfolio" | "business" | "onepage";

export const TEMPLATE_FAMILIES: { id: TemplateFamily; name: string; desc: string }[] = [
  { id: "portfolio", name: "Portfolio", desc: "Image led sites for showing the work" },
  { id: "business", name: "Business", desc: "Service, pricing and booking led studio sites" },
  { id: "onepage", name: "One page", desc: "Everything on one scrolling page with anchor navigation" },
];

export interface TemplateDef {
  id: string;
  name: string;
  family: TemplateFamily;
  tagline: string;
  desc: string;
  palette: string;
  fontTheme: string;
  headerStyle: string;
  pages: () => TemplatePage[];
}

// Shorthand helpers ---------------------------------------------------------

const b = makeBlock;

function imgs(hue: number, variant: string, labels: string[], w = 1200, h = 900) {
  return labels.map((label, i) => ({
    url: ph({ w, h: i % 3 === 1 ? Math.round(h * 1.35) : h, hue: (hue + i * 17) % 360, label, variant }),
    alt: label,
  }));
}

interface TplConfig {
  hue: number;
  studio: string;
  voiceHeading: string; // home hero heading
  voiceSub: string;
  galleryStyle: "grid" | "masonry";
  copy: { aboutHeading: string; aboutBody: string; experienceIntro: string; pricingIntro: string };
}

// Shared page builders (each template passes its own voice + imagery) --------

function portfolioPage(c: TplConfig): TemplatePage {
  const gallery =
    c.galleryStyle === "masonry"
      ? b("galleryMasonry", { images: imgs(c.hue, "photo", ["Vows", "First look", "Golden hour", "The dress", "Reception", "Portraits", "Details", "Last dance", "Morning light"]), cols: "3" })
      : b("galleryGrid", { images: imgs(c.hue, "photo", ["Vows", "First look", "Golden hour", "The dress", "Reception", "Portraits", "Details", "Last dance", "Morning light"]), cols: "3", gap: true });
  return {
    type: "PORTFOLIO",
    title: "Portfolio",
    slug: "portfolio",
    blocks: [
      b("heading", { kicker: "Selected work", heading: "Portfolio", intro: "A living archive of the people, places and quiet moments we've been trusted with.", align: "center" }),
      gallery,
      b("divider", { style: "line" }),
      b("collectionEmbed", { collectionSlug: "", count: 6, cols: "3", link: true }),
      b("cta", { heading: "See your story told like this", body: "", buttonLabel: "Start an inquiry", buttonLink: "/contact", tinted: true }),
    ],
  };
}

function aboutPage(c: TplConfig): TemplatePage {
  return {
    type: "ABOUT",
    title: "About",
    slug: "about",
    blocks: [
      b("imageText", {
        image: ph({ w: 1100, h: 1350, hue: c.hue, label: "Portrait", variant: "portrait" }),
        imageAlt: `Portrait of the ${c.studio} photographer`,
        side: "left",
        kicker: "About",
        heading: c.copy.aboutHeading,
        body: c.copy.aboutBody,
        buttonLabel: "Work with me",
        buttonLink: "/contact",
      }),
      b("stats", { items: [
        { value: "11", label: "Years behind the camera" },
        { value: "240+", label: "Weddings photographed" },
        { value: "48", label: "States & countries" },
      ] }),
      b("quote", { quote: "Photographs are the only inheritance that grows more valuable every year.", attribution: c.studio }),
      b("imageGrid", { images: imgs(c.hue + 30, "detail", ["The studio", "On location", "The archive"]) }),
    ],
  };
}

function experiencePage(c: TplConfig): TemplatePage {
  return {
    type: "EXPERIENCE",
    title: "Experience",
    slug: "experience",
    blocks: [
      b("heading", { kicker: "What it's like", heading: "The experience", intro: c.copy.experienceIntro, align: "center" }),
      b("experienceTimeline", { items: [
        { marker: "01", title: "Inquiry & fit", body: "You write, we talk. We make sure the way I work matches the day you're planning, no pressure, ever." },
        { marker: "02", title: "The plan", body: "A short planning guide, a timeline consult, and location scouting where it helps. You'll know exactly what to expect." },
        { marker: "03", title: "The day", body: "I work quietly and stay close. Direction when you want it, invisibility when you don't." },
        { marker: "04", title: "The gallery", body: "A preview within 72 hours; the full online gallery in four to six weeks, ready to download, share and print." },
        { marker: "05", title: "The heirlooms", body: "Albums, fine-art prints and framing, designed together once you've lived with the photographs for a while." },
      ] }),
      b("list", { heading: "Always included", items: [
        { text: "Pre-session planning guide" },
        { text: "Online gallery with downloads" },
        { text: "Print release for personal use" },
        { text: "Sneak peek within 72 hours" },
        { text: "Travel within 50 miles" },
        { text: "A backup photographer plan" },
      ], cols: "2" }),
      b("faq", { heading: "Common questions", items: [
        { q: "How far in advance should we book?", a: "Most weddings book nine to fourteen months out; portraits usually four to six weeks." },
        { q: "Do you travel?", a: "Yes, travel within 50 miles is included, and destination work is quoted flat so there are no surprises." },
        { q: "How many photographs will we receive?", a: "A full wedding day typically delivers 600–800 finished images; portrait sessions 60–90." },
      ] }),
      b("cta", { heading: "Dates are limited each season", body: "", buttonLabel: "Check availability", buttonLink: "/contact", tinted: true }),
    ],
  };
}

function pricingPage(c: TplConfig): TemplatePage {
  return {
    type: "PRICING",
    title: "Pricing",
    slug: "pricing",
    blocks: [
      b("heading", { kicker: "Investment", heading: "Pricing", intro: c.copy.pricingIntro, align: "center" }),
      b("pricingPackages", { cols: "3", packages: [
        { name: "Essential", price: "$2,400", unit: "6 hours", features: "One photographer\nOnline gallery\nPrint release\n300+ images", featured: false },
        { name: "Signature", price: "$3,800", unit: "9 hours", features: "Two photographers\nEngagement session\nOnline gallery\nPrint release\n600+ images", featured: true },
        { name: "Heirloom", price: "$5,600", unit: "Full day", features: "Two photographers\nEngagement session\nFine-art album\nParent albums\nOnline gallery\n800+ images", featured: false },
      ] }),
      b("pricingTable", {
        columns: "Essential\nSignature\nHeirloom",
        rows: [
          { feature: "Hours of coverage", values: "6, 9, Full day" },
          { feature: "Second photographer", values: "-, ✓, ✓" },
          { feature: "Engagement session", values: "-, ✓, ✓" },
          { feature: "Fine-art album", values: "-, -, ✓" },
          { feature: "Online gallery & print release", values: "✓, ✓, ✓" },
        ],
        note: "Collections can be tailored, albums, additional hours and travel are quoted on request.",
      }),
      b("faq", { heading: "Payment questions", items: [
        { q: "How do payments work?", a: "A 25% retainer reserves your date; the balance is split into easy instalments before the day." },
        { q: "Do you offer payment plans?", a: "Yes, monthly plans at no extra cost, arranged when you book." },
      ] }),
      b("cta", { heading: "Request the full pricing guide", body: "Every collection, album and add-on, in one PDF.", buttonLabel: "Request the guide", buttonLink: "/contact", tinted: true }),
    ],
  };
}

function reviewsPage(c: TplConfig): TemplatePage {
  return {
    type: "REVIEWS",
    title: "Reviews",
    slug: "reviews",
    blocks: [
      b("heading", { kicker: "Kind words", heading: "Reviews", intro: "", align: "center" }),
      b("testimonialSingle", {
        quote: "We forgot the photos were even being taken, and then we cried through the whole gallery. Twice.",
        name: "Emma & James",
        detail: "Wedding, Tuscany",
        image: ph({ w: 900, h: 900, hue: c.hue + 10, label: "Emma & James", variant: "portrait" }),
        imageAlt: "Emma and James at their wedding",
      }),
      b("reviewsWall", { items: [
        { stars: "5", quote: "Professional, calm, and the photographs are unreal. Worth every penny.", name: "Priya S.", source: "Google" },
        { stars: "5", quote: "Our families keep saying these are the best wedding photos they've ever seen.", name: "Daniel & Marco", source: "The Knot" },
        { stars: "5", quote: "The gallery arrived early and the album design process was so easy.", name: "Rachel T.", source: "Google" },
        { stars: "5", quote: "Made two very camera-shy people look like a magazine spread.", name: "Hannah & Will", source: "WeddingWire" },
      ] }),
      b("cta", { heading: "Your turn", body: "", buttonLabel: "Start an inquiry", buttonLink: "/contact", tinted: true }),
    ],
  };
}

function blogPage(): TemplatePage {
  return {
    type: "BLOG",
    title: "Journal",
    slug: "blog",
    blocks: [
      b("heading", { kicker: "Notes & stories", heading: "The journal", intro: "", align: "center" }),
      b("blogList", { heading: "", count: 12, layout: "list" }),
      b("newsletter", {}),
    ],
  };
}

function contactPage(c: TplConfig): TemplatePage {
  return {
    type: "CONTACT",
    title: "Contact",
    slug: "contact",
    blocks: [
      b("heading", { kicker: "Say hello", heading: "Contact", intro: "Tell me about your day, the more detail the better.", align: "center" }),
      b("contactForm", { heading: "Start an inquiry", intro: "", phone: true, subject: true, buttonLabel: "Send inquiry", success: "Thank you, you'll hear back within two business days." }),
      b("bookingCalendar", { heading: "Prefer to pick a date?", intro: "See open times and book your session directly.", sessionTypeIds: [], layout: "list" }),
      b("map", { heading: "The studio", address: `${c.studio} · 418 Juniper Row, Austin, TX`, details: "By appointment, Tuesday–Saturday." }),
      b("socialLinks", { items: [
        { label: "Instagram", url: "https://instagram.com" },
        { label: "Pinterest", url: "https://pinterest.com" },
        { label: "Email", url: "mailto:hello@example.com" },
      ] }),
    ],
  };
}

function clientAreaPage(): TemplatePage {
  return {
    type: "CLIENT_AREA",
    title: "Client Area",
    slug: "client-area",
    blocks: [
      b("heading", { kicker: "For clients", heading: "Client area", intro: "", align: "center" }),
      b("clientGalleries", {}),
      b("bookingCalendar", { heading: "Book your next session", intro: "Returning clients can pick a time straight from the studio calendar.", sessionTypeIds: [], layout: "cards" }),
      b("faq", { heading: "Gallery help", items: [
        { q: "Where is my password?", a: "It's in your gallery delivery email. If you can't find it, just write, we'll resend it." },
        { q: "How long is my gallery online?", a: "Twelve months from delivery. Download everything early, and keep two copies." },
        { q: "Can family order prints?", a: "Yes, anyone with the gallery link can favorite photos and order prints directly." },
      ] }),
    ],
  };
}

function standardPages(c: TplConfig, home: Block[]): TemplatePage[] {
  return [
    { type: "HOME", title: "Home", slug: "", blocks: home },
    portfolioPage(c),
    aboutPage(c),
    experiencePage(c),
    pricingPage(c),
    reviewsPage(c),
    blogPage(),
    contactPage(c),
    clientAreaPage(),
  ];
}

// The eight template families ----------------------------------------------

export const TEMPLATES: TemplateDef[] = [
  {
    id: "berlin",
    family: "portfolio",
    name: "Berlin",
    tagline: "Bold, typographic, black on white",
    desc: "A statement opener and strict grids. For photographers whose work does the talking.",
    palette: "paper",
    fontTheme: "statement",
    headerStyle: "minimal",
    pages: () => {
      const c: TplConfig = {
        hue: 210, studio: "Berlin Studio", voiceHeading: "Photographs that don't whisper", voiceSub: "Weddings and editorial portraits, shot with intent.", galleryStyle: "grid",
        copy: {
          aboutHeading: "Direct. Deliberate. There when it matters.",
          aboutBody: "I shoot with hard intention and soft light. Eleven years of weddings, editorial commissions and portraits taught me one thing: the honest frame always outlives the posed one.\n\nBased in the city, booked everywhere.",
          experienceIntro: "No mystery. Five steps between hello and heirloom.",
          pricingIntro: "Flat, published, honest. Collections below; bespoke on request.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1200, hue: c.hue, label: "BERLIN", variant: "photo" }), imageAlt: "Black-and-white wedding portrait", kicker: "Photography", heading: "Photographs that don't whisper", subheading: c.voiceSub, buttonLabel: "See the work", buttonLink: "/portfolio", height: "full", align: "left", overlay: true }),
        b("logos", { heading: "As seen in", names: "VOGUE WEDDINGS\nKINFOLK\nHARPER'S\nBRIDES" }),
        b("galleryGrid", { images: imgs(c.hue, "photo", ["No. 01", "No. 02", "No. 03", "No. 04", "No. 05", "No. 06"]), cols: "3", gap: false }),
        b("heading", { kicker: "", heading: "Shot with intent", intro: "Strict frames, honest light, zero filler. Every gallery is edited twice and delivered once, finished.", align: "left" }),
        b("stats", { items: [{ value: "240+", label: "Weddings" }, { value: "72h", label: "To first preview" }, { value: "2", label: "Photographers, always" }] }),
        b("cta", { heading: "Booking the next season now", body: "", buttonLabel: "Inquire", buttonLink: "/contact", tinted: false }),
      ]);
    },
  },
  {
    id: "vienna",
    family: "portfolio",
    name: "Vienna",
    tagline: "Elegant, editorial, timeless serif",
    desc: "Ivory space and refined serif display. The classic fine-art wedding presence.",
    palette: "ivory",
    fontTheme: "elegant",
    headerStyle: "center",
    pages: () => {
      const c: TplConfig = {
        hue: 36, studio: "Atelier Vienna", voiceHeading: "For love stories told slowly", voiceSub: "Fine-art wedding photography for the quietly romantic.", galleryStyle: "masonry",
        copy: {
          aboutHeading: "A calm presence on the loudest day of your life",
          aboutBody: "I came to photography through painting, and it shows: I wait for composed light, honest gestures, and the in-between seconds everyone else misses.\n\nMy couples tend to love long dinners, handwritten notes and each other, enormously.",
          experienceIntro: "From the first note to the final album, every step is considered.",
          pricingIntro: "An investment in the only thing you'll keep from the day.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1250, hue: c.hue, label: "Vienna", variant: "photo" }), imageAlt: "Bride and groom in golden evening light", kicker: "Fine-art wedding photography", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "View the portfolio", buttonLink: "/portfolio", height: "tall", align: "center", overlay: true }),
        b("heading", { kicker: "The studio", heading: "Photographs as heirlooms", intro: "Quiet, intentional imagery for weddings and families, made to be printed, framed and handed down.", align: "center" }),
        b("galleryMasonry", { images: imgs(c.hue, "photo", ["The vows", "First dance", "Golden hour", "The letter", "Champagne", "Portraits"]), cols: "3" }),
        b("testimonialSingle", { quote: "Looking at our gallery feels like being inside the day again, the nerves, the laughter, all of it.", name: "Clara & Henrik", detail: "Wedding, Lake Como", image: "", imageAlt: "" }),
        b("imageText", { image: ph({ w: 1100, h: 1350, hue: c.hue + 20, label: "The artist", variant: "portrait" }), imageAlt: "The photographer at work", side: "right", kicker: "Behind the lens", heading: "An unhurried eye", body: "Every commission is limited: a small number of weddings each season, so nothing is rushed, not the day, not the edit, not the album.", buttonLabel: "About the studio", buttonLink: "/about" }),
        b("blogList", { heading: "From the journal", count: 3, layout: "grid" }),
        b("cta", { heading: "Now booking next season", body: "A limited number of commissions are taken each year.", buttonLabel: "Begin an inquiry", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "sedona",
    family: "business",
    name: "Sedona",
    tagline: "Warm, earthy, sun-washed",
    desc: "Desert warmth and generous imagery for adventurous couples and golden light.",
    palette: "terracotta",
    fontTheme: "palatial",
    headerStyle: "left",
    pages: () => {
      const c: TplConfig = {
        hue: 20, studio: "Sedona & Co.", voiceHeading: "Love, under open sky", voiceSub: "Elopements and weddings in wild, warm places.", galleryStyle: "masonry",
        copy: {
          aboutHeading: "Happiest at the edge of the map",
          aboutBody: "Red rock, alpine meadow, coastline at dawn, I photograph people who'd rather climb to the view than rent the ballroom.\n\nPermits, trails, sunrise times: handled. You just show up in love.",
          experienceIntro: "Adventure, planned down to the golden minute.",
          pricingIntro: "Collections for elopements, intimate weddings and full celebrations.",
        },
      };
      return standardPages(c, [
        b("heroSplit", { image: ph({ w: 1300, h: 1500, hue: c.hue, label: "Sedona", variant: "photo" }), imageAlt: "Couple embracing at a desert overlook at sunset", side: "left", kicker: "Elopement & wedding photography", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "Plan your day", buttonLink: "/experience" }),
        b("heading", { kicker: "Recent adventures", heading: "Dust on the dress, light in the frame", intro: "", align: "center" }),
        b("imageGrid", { images: imgs(c.hue, "photo", ["Canyon vows", "Desert dance", "Mesa sunrise"]) }),
        b("services", { cols: "3", items: [
          { title: "Elopements", body: "Just the two of you, somewhere unforgettable. Planning help included.", image: "", imageAlt: "" },
          { title: "Intimate weddings", body: "Under fifty guests, over-the-top golden hour.", image: "", imageAlt: "" },
          { title: "Anniversary sessions", body: "Come back to the landscape that married you.", image: "", imageAlt: "" },
        ] }),
        b("testimonials", { cols: "2", items: [
          { quote: "She hiked five miles in a snowstorm and still caught every single moment.", name: "Jess & Tyler", detail: "Elopement, Moab" },
          { quote: "The photos look like a film we get to live inside forever.", name: "Ana & Sofía", detail: "Wedding, Sedona" },
        ] }),
        b("cta", { heading: "Tell me where you're dreaming of", body: "If there's a trailhead, I'm in.", buttonLabel: "Start planning", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "onyx",
    family: "portfolio",
    name: "Onyx",
    tagline: "Dark, dramatic, gallery-grade",
    desc: "A black canvas that makes imagery glow. For editorial and after-dark work.",
    palette: "noir",
    fontTheme: "modern",
    headerStyle: "minimal",
    pages: () => {
      const c: TplConfig = {
        hue: 44, studio: "Onyx Atelier", voiceHeading: "Shot in the dark", voiceSub: "Editorial portraits and weddings with cinematic nerve.", galleryStyle: "grid",
        copy: {
          aboutHeading: "Trained in the studio, loose in the wild",
          aboutBody: "Commercial lighting chops, documentary instincts. The work lives where flash meets dusk, receptions, stages, city nights.\n\nSelect commissions only.",
          experienceIntro: "A tight, professional process from brief to delivery.",
          pricingIntro: "Transparent rates for weddings and editorial commissions.",
        },
      };
      return standardPages(c, [
        b("slideshow", { slides: imgs(c.hue, "photo", ["Noir I", "Noir II", "Noir III"], 2000, 1250).map((s) => ({ image: s.url, imageAlt: s.alt, caption: "" })), heading: "Shot in the dark", height: "full" }),
        b("heading", { kicker: "Onyx Atelier", heading: "Cinematic by design", intro: "Editorial portraits, after-dark weddings, stage and studio work.", align: "center" }),
        b("galleryGrid", { images: imgs(c.hue, "photo", ["Frame 01", "Frame 02", "Frame 03", "Frame 04", "Frame 05", "Frame 06", "Frame 07", "Frame 08"]), cols: "4", gap: false }),
        b("stats", { items: [{ value: "14", label: "Editorial covers" }, { value: "9", label: "Years in studio" }, { value: "∞", label: "Patience for perfect light" }] }),
        b("quote", { quote: "Shadow is not the absence of a photograph. It is half of one.", attribution: "Studio notes" }),
        b("cta", { heading: "Commissions open", body: "", buttonLabel: "Inquire", buttonLink: "/contact", tinted: false }),
      ]);
    },
  },
  {
    id: "marlow",
    family: "business",
    name: "Marlow",
    tagline: "Airy, soft, romantic",
    desc: "Light type, blush tones and gentle pacing for family and maternity studios.",
    palette: "blush",
    fontTheme: "airy",
    headerStyle: "center",
    pages: () => {
      const c: TplConfig = {
        hue: 8, studio: "Marlow & Light", voiceHeading: "The soft years, kept", voiceSub: "Maternity, newborn and family photography in natural light.", galleryStyle: "masonry",
        copy: {
          aboutHeading: "Gentle with people, obsessive about light",
          aboutBody: "Mother of two, photographer of hundreds. The studio is warm, the pace is slow, and nobody has to say cheese.\n\nSessions are relaxed on purpose, real snuggles photograph better than stiff smiles.",
          experienceIntro: "From booking to framed wall art, everything is unhurried.",
          pricingIntro: "Simple session fees, with artwork chosen after you see the gallery.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1150, hue: c.hue, label: "Marlow", variant: "photo" }), imageAlt: "Mother holding newborn by a bright window", kicker: "Family · Newborn · Maternity", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "Book a session", buttonLink: "/contact", height: "medium", align: "center", overlay: false }),
        b("heading", { kicker: "Hello", heading: "They won't be this small tomorrow", intro: "Window-light sessions in the studio or at home, designed around nap time, not against it.", align: "center" }),
        b("galleryMasonry", { images: imgs(c.hue, "photo", ["Ten days new", "Big sister", "The bump", "Sunday morning", "Tiny toes", "First birthday"]), cols: "3" }),
        b("testimonialSingle", { quote: "She made a newborn session with a toddler feel easy. I didn't know that was possible.", name: "Laura M.", detail: "Newborn session", image: "", imageAlt: "" }),
        b("blogList", { heading: "Notes for parents", count: 3, layout: "grid" }),
        b("newsletter", { heading: "Mini session waitlist", subtext: "Seasonal minis sell out, hear about them first.", buttonLabel: "Join the list" }),
      ]);
    },
  },
  {
    id: "montana",
    family: "business",
    name: "Montana",
    tagline: "Rustic, grounded, wide open",
    desc: "Big landscapes and plainspoken warmth for outdoor and ranch photography.",
    palette: "forest",
    fontTheme: "baskerton",
    headerStyle: "stacked",
    pages: () => {
      const c: TplConfig = {
        hue: 140, studio: "Montana Pines Photo", voiceHeading: "Big skies, honest stories", voiceSub: "Weddings, families and working ranches across the mountain west.", galleryStyle: "grid",
        copy: {
          aboutHeading: "Raised on a ranch, fluent in weather",
          aboutBody: "I grew up where the nearest neighbor was a mile off, and I photograph the same way people out here live: patiently, honestly, in all conditions.\n\nMud, snow, wind, the photos are better for it.",
          experienceIntro: "Plain dealing from first call to final print.",
          pricingIntro: "Straightforward pricing. No surprises at the gate.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1250, hue: c.hue, label: "Montana", variant: "photo" }), imageAlt: "Couple on horseback beneath mountain range", kicker: "Mountain west photography", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "See the land", buttonLink: "/portfolio", height: "full", align: "center", overlay: true }),
        b("imageText", { image: ph({ w: 1200, h: 1000, hue: c.hue + 15, label: "The valley", variant: "photo" }), imageAlt: "Ranch valley at dusk", side: "right", kicker: "The work", heading: "Weather-proof memories", body: "Weddings in hayfields, brandings at dawn, four generations on the porch. If it matters to your family, it's worth photographing properly.", buttonLabel: "Portfolio", buttonLink: "/portfolio" }),
        b("list", { heading: "What I photograph", items: [
          { text: "Ranch & backyard weddings" }, { text: "Family land & legacy sessions" },
          { text: "Working ranch days" }, { text: "Senior portraits" },
        ], cols: "2" }),
        b("carousel", { images: imgs(c.hue, "photo", ["High pasture", "The barn dance", "Winter feed", "Branding day", "Porch light"], 1100, 800) }),
        b("faq", { heading: "Before you ask", items: [
          { q: "Will you drive out to us?", a: "Anywhere in the state, and most of the neighboring ones. Mileage is flat-rated past 50 miles." },
          { q: "What if the weather turns?", a: "Then we make better photographs. Truly, some of my favorite frames are from storms." },
        ] }),
        b("cta", { heading: "Let's talk dates", body: "", buttonLabel: "Get in touch", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "oslo",
    family: "portfolio",
    name: "Oslo",
    tagline: "Clean, Scandinavian, quietly modern",
    desc: "Cool grays, generous whitespace, strict grids. For minimalists and brand work.",
    palette: "dove",
    fontTheme: "scandi",
    headerStyle: "left",
    pages: () => {
      const c: TplConfig = {
        hue: 205, studio: "Studio Oslo", voiceHeading: "Less, but better", voiceSub: "Brand, product and portrait photography with a clean Nordic eye.", galleryStyle: "grid",
        copy: {
          aboutHeading: "Form follows feeling",
          aboutBody: "A background in design, a decade in photography. The studio works with founders, makers and small brands that care about restraint.\n\nEvery commission ships with a usage guide and a tidy, named archive.",
          experienceIntro: "A clear scope, a fixed timeline, a calm shoot day.",
          pricingIntro: "Day rates and brand packages, published plainly.",
        },
      };
      return standardPages(c, [
        b("heroSplit", { image: ph({ w: 1300, h: 1400, hue: c.hue, label: "Oslo", variant: "photo" }), imageAlt: "Minimal still life in soft daylight", side: "right", kicker: "Brand & portrait studio", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "View work", buttonLink: "/portfolio" }),
        b("heading", { kicker: "Selected", heading: "Recent commissions", intro: "", align: "left" }),
        b("galleryGrid", { images: imgs(c.hue, "photo", ["Ceramics brand", "Founder portraits", "Knitwear lookbook", "Café identity", "Product line", "Editorial"]), cols: "3", gap: true }),
        b("stats", { items: [{ value: "60+", label: "Brands photographed" }, { value: "10 days", label: "Average delivery" }, { value: "1", label: "Point of contact" }] }),
        b("blogList", { heading: "Studio notes", count: 3, layout: "grid" }),
        b("newsletter", { heading: "Quarterly letter", subtext: "New work and open studio days, four times a year.", buttonLabel: "Subscribe" }),
      ]);
    },
  },
  {
    id: "jennifer",
    family: "business",
    name: "Jennifer",
    tagline: "Personal, warm, signature script",
    desc: "A first-name brand with handwritten warmth for portrait photographers.",
    palette: "sand",
    fontTheme: "handwritten",
    headerStyle: "center",
    pages: () => {
      const c: TplConfig = {
        hue: 42, studio: "Jennifer Lane Photography", voiceHeading: "Hi, I'm Jennifer", voiceSub: "Portraits for people who hate having their picture taken (until now).", galleryStyle: "masonry",
        copy: {
          aboutHeading: "The friend who happens to have a camera",
          aboutBody: "Sessions with me are mostly walking, chatting and laughing, the camera just tags along.\n\nTen years, a thousand families, one rule: everyone leaves liking themselves in photos.",
          experienceIntro: "Easy, honest, and finished before you know it.",
          pricingIntro: "Session fees below, collections and gift prints after your reveal.",
        },
      };
      return standardPages(c, [
        b("heroSplit", { image: ph({ w: 1300, h: 1500, hue: c.hue, label: "Jennifer", variant: "portrait" }), imageAlt: "Jennifer laughing with a camera in hand", side: "left", kicker: "Portraits & families", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "Let's meet", buttonLink: "/contact" }),
        b("heading", { kicker: "", heading: "Real people, at ease", intro: "Golden-hour family sessions, high-school seniors, headshots that don't look like headshots.", align: "center" }),
        b("galleryMasonry", { images: imgs(c.hue, "photo", ["The Hartley crew", "Senior year", "New baby", "Golden hour", "Grandma's 80th", "Backyard tea"]), cols: "3" }),
        b("instagram", { handle: "@jenniferlanephoto", url: "https://instagram.com", images: imgs(c.hue + 25, "detail", ["01", "02", "03", "04", "05", "06"], 700, 700) }),
        b("testimonials", { cols: "2", items: [
          { quote: "My husband said it was 'actually fun'. That's a five-star miracle.", name: "Beth R.", detail: "Family session" },
          { quote: "She got my awkward teenager to genuinely smile. Hire her.", name: "Dana K.", detail: "Senior portraits" },
        ] }),
        b("cta", { heading: "Fall minis are booking now", body: "Twenty-minute sessions, full gallery, zero stress.", buttonLabel: "Grab a spot", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  // ------------------------------------------------------------ one page family
  {
    id: "solo",
    name: "Solo",
    family: "onepage",
    tagline: "One page, scroll to everything",
    desc: "A single scrolling page with anchor navigation: work, about, pricing, reviews, booking and contact.",
    palette: "linen",
    fontTheme: "atelier",
    headerStyle: "left",
    pages: () => {
      const hue = 28;
      const sec = (anchor: string, navLabel: string) => ({ _anchor: anchor, _navLabel: navLabel });
      const home: Block[] = [
        b("hero", { image: ph({ w: 2000, h: 1200, hue, label: "Solo", variant: "photo" }), imageAlt: "Couple walking through a sunlit field", kicker: "Photography", heading: "Everything you need, on one page", subheading: "Weddings, families and portraits. Scroll for the work, the prices and an open date.", buttonLabel: "Check a date", buttonLink: "#book", height: "full", align: "center", overlay: true }),
        b("galleryMasonry", { ...sec("work", "Work"), images: imgs(hue, "photo", ["Morning light", "Vows", "The walk", "Laughter", "Family", "Details"]), cols: "3" }),
        b("imageText", { ...sec("about", "About"), image: ph({ w: 1100, h: 1350, hue: hue + 15, label: "Portrait", variant: "portrait" }), imageAlt: "Portrait of the photographer", side: "left", kicker: "About", heading: "Hi, I am the person behind the camera", body: "I photograph people the way they really are, a little messy, a lot in love.\n\nBased locally, happy to travel.", buttonLabel: "", buttonLink: "" }),
        b("pricingPackages", { ...sec("pricing", "Pricing"), cols: "3", packages: [
          { name: "Session", price: "$450", unit: "per session", features: "One hour\n60 edited images\nOnline gallery", featured: false },
          { name: "Half day", price: "$1,600", unit: "four hours", features: "Four hours\n300 edited images\nPrint credit", featured: true },
          { name: "Full day", price: "$3,200", unit: "eight hours", features: "Eight hours\n700 edited images\nHeirloom album", featured: false },
        ] }),
        b("testimonials", { ...sec("reviews", "Reviews"), cols: "2", items: [
          { quote: "Easy, warm, and the photos made my mother cry (the good kind).", name: "Ana P.", detail: "Family session" },
          { quote: "Booked from her website in two minutes. The gallery arrived early.", name: "Theo & Sam", detail: "Wedding" },
        ] }),
        b("bookingCalendar", { ...sec("book", "Book"), heading: "Book a session", intro: "Pick a session and an open time, you are booked straight away.", sessionTypeIds: [], layout: "cards" }),
        b("contactForm", { ...sec("contact", "Contact"), heading: "Questions first?", intro: "", phone: false, subject: false, buttonLabel: "Send", success: "Thank you, talk soon." }),
      ];
      return [
        { type: "HOME", title: "Home", slug: "", blocks: home },
        { ...blogPage(), visible: false },
        { ...clientAreaPage(), visible: false },
      ];
    },
  },
  // --------------------------------------- night build: remaining researched names
  {
    id: "torres",
    family: "portfolio",
    name: "Torres",
    tagline: "Coastal light, Mediterranean ease",
    desc: "Sea air and white stone. For destination weddings on warm coastlines.",
    palette: "ocean",
    fontTheme: "palatial",
    headerStyle: "left",
    pages: () => {
      const c: TplConfig = {
        hue: 200, studio: "Torres Studio", voiceHeading: "Weddings where the light comes off the water", voiceSub: "Destination and coastal wedding photography, based on the Mediterranean.", galleryStyle: "masonry",
        copy: {
          aboutHeading: "Salt in the air, calm in the frame",
          aboutBody: "I photograph weddings the way the coast feels at seven in the evening: unhurried, golden, honest.\n\nBased between two harbours, booked along the whole coastline.",
          experienceIntro: "Destination logistics handled, so the day feels like a holiday.",
          pricingIntro: "Collections for coastal and destination weddings, travel included along the coast.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1250, hue: c.hue, label: "Torres", variant: "photo" }), imageAlt: "Couple on a whitewashed terrace above the sea", kicker: "Coastal wedding photography", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "See the work", buttonLink: "/portfolio", height: "full", align: "left", overlay: true }),
        b("galleryMasonry", { images: imgs(c.hue, "photo", ["Harbour vows", "Terrace dinner", "The crossing", "Olive shade", "First swim", "Lanterns"]), cols: "3" }),
        b("imageText", { image: ph({ w: 1100, h: 1350, hue: c.hue + 20, label: "The studio", variant: "portrait" }), imageAlt: "The photographer by the harbour", side: "left", kicker: "The studio", heading: "Two harbours, one way of seeing", body: "Every coastal wedding gets a scouted light plan: where the sun drops, where the shade falls, where the two of you can be alone for ten minutes.", buttonLabel: "About the studio", buttonLink: "/about" }),
        b("testimonials", { cols: "2", items: [
          { quote: "The gallery smells like the sea. I do not know how else to say it.", name: "Lucía & Marc", detail: "Wedding, Mallorca" },
          { quote: "Calm, invisible, and the light in every frame is unreal.", name: "Elena R.", detail: "Wedding, Amalfi" },
        ] }),
        b("cta", { heading: "Coastal dates go first", body: "", buttonLabel: "Check your date", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "tofino",
    family: "portfolio",
    name: "Tofino",
    tagline: "Moody, wild, rain-washed",
    desc: "Dark greens and storm light for Pacific Northwest weddings and elopements.",
    palette: "pine",
    fontTheme: "nordic",
    headerStyle: "minimal",
    pages: () => {
      const c: TplConfig = {
        hue: 160, studio: "Tofino Wilds", voiceHeading: "Love, in weather", voiceSub: "Elopements and weddings on the wild west coast.", galleryStyle: "masonry",
        copy: {
          aboutHeading: "Raised by rain and old growth",
          aboutBody: "Out here the light is earned. I photograph couples who would rather have wind and meaning than sunshine and staging.\n\nCedar forests, black sand, low cloud: home.",
          experienceIntro: "Permits, tides and backup plans, sorted before you arrive.",
          pricingIntro: "Elopement and wedding collections for the wild coast.",
        },
      };
      return standardPages(c, [
        b("slideshow", { slides: imgs(c.hue, "photo", ["Storm light", "Old growth", "Black sand"], 2000, 1250).map((s) => ({ image: s.url, imageAlt: s.alt, caption: "" })), heading: "Love, in weather", height: "full" }),
        b("heading", { kicker: "Tofino Wilds", heading: "The coast does the styling", intro: "No ballrooms, no backdrops. Just the two of you and the biggest landscape on the continent.", align: "center" }),
        b("galleryMasonry", { images: imgs(c.hue, "photo", ["Cedar vows", "Tide pools", "Fog line", "The hike in", "Wool and rain", "Last light"]), cols: "3" }),
        b("quote", { quote: "It rained sideways and the photos are the best thing we own.", attribution: "June & Alex, elopement" }),
        b("cta", { heading: "Wild dates, limited season", body: "", buttonLabel: "Start planning", buttonLink: "/contact", tinted: false }),
      ]);
    },
  },
  {
    id: "malibu",
    family: "portfolio",
    name: "Malibu",
    tagline: "Bright, polished, barefoot luxury",
    desc: "Sun-bleached and glossy for beach weddings and bright editorial work.",
    palette: "sky",
    fontTheme: "geometric",
    headerStyle: "center",
    pages: () => {
      const c: TplConfig = {
        hue: 195, studio: "Malibu Light Co.", voiceHeading: "Golden coast, glossy finish", voiceSub: "Beach weddings and bright editorial photography.", galleryStyle: "grid",
        copy: {
          aboutHeading: "Champagne taste, barefoot delivery",
          aboutBody: "Luxury without the stiffness. I shoot bright, clean and joyful, then deliver a gallery that looks like a magazine and feels like your day.\n\nBased on the coast, flown everywhere.",
          experienceIntro: "A polished, pampered process from first call to final album.",
          pricingIntro: "Collections for weddings, editorials and brand days on the coast.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1150, hue: c.hue, label: "Malibu", variant: "photo" }), imageAlt: "Bride and groom laughing on a bright beach", kicker: "Beach weddings · Editorial", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "View the portfolio", buttonLink: "/portfolio", height: "tall", align: "center", overlay: false }),
        b("imageGrid", { images: imgs(c.hue, "photo", ["Barefoot vows", "Pool party", "Sunset toast"]) }),
        b("services", { cols: "3", items: [
          { title: "Weddings", body: "Full day coastal coverage, two photographers.", image: "", imageAlt: "" },
          { title: "Editorial", body: "Bright, glossy shoots for brands and magazines.", image: "", imageAlt: "" },
          { title: "Events", body: "Launch parties and private events, same polish.", image: "", imageAlt: "" },
        ] }),
        b("testimonialSingle", { quote: "Every photo looks like an ad, but it is somehow still exactly our day.", name: "Chloe & Ben", detail: "Wedding, Malibu", image: "", imageAlt: "" }),
        b("cta", { heading: "Summer books early", body: "", buttonLabel: "Inquire now", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "tuscany",
    family: "portfolio",
    name: "Tuscany",
    tagline: "Romantic, golden, countryside",
    desc: "Vineyard rows and villa light for Italian countryside weddings.",
    palette: "honey",
    fontTheme: "heirloom",
    headerStyle: "center",
    pages: () => {
      const c: TplConfig = {
        hue: 38, studio: "Casa Tuscany", voiceHeading: "Slow days, long tables, golden fields", voiceSub: "Wedding photography in the Tuscan countryside.", galleryStyle: "masonry",
        copy: {
          aboutHeading: "A villa, a vineyard, and everyone you love",
          aboutBody: "I photograph destination weddings the slow way: morning swims, long lunches, vows under cypress trees.\n\nBased in the hills each season, fluent in venues, planners and golden hour.",
          experienceIntro: "A whole weekend, photographed like a family story.",
          pricingIntro: "Weekend collections for villa and vineyard weddings.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1250, hue: c.hue, label: "Tuscany", variant: "photo" }), imageAlt: "Long dinner table in a vineyard at golden hour", kicker: "Destination weddings, Italy", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "See the stories", buttonLink: "/portfolio", height: "full", align: "center", overlay: true }),
        b("heading", { kicker: "The countryside", heading: "Weddings that last all weekend", intro: "Welcome drinks, the day itself, and the slow morning after, all of it belongs in the story.", align: "center" }),
        b("galleryMasonry", { images: imgs(c.hue, "photo", ["Cypress vows", "The long table", "Villa mornings", "Vineyard walk", "Pool party", "Festa"]), cols: "3" }),
        b("imageText", { image: ph({ w: 1100, h: 1350, hue: c.hue + 15, label: "In the hills", variant: "portrait" }), imageAlt: "The photographer among cypress trees", side: "right", kicker: "On the ground", heading: "Local knowledge, family feeling", body: "Ten seasons in these hills means the light plan, the rain plan and the nonna-approved photo spots are all handled.", buttonLabel: "About the studio", buttonLink: "/about" }),
        b("cta", { heading: "Next season is half booked", body: "", buttonLabel: "Ask about your weekend", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "alba",
    family: "portfolio",
    name: "Alba",
    tagline: "Dawn-soft, feather light",
    desc: "The lightest touch: pale tones and whisper type for gentle portrait work.",
    palette: "peony",
    fontTheme: "whisper",
    headerStyle: "left",
    pages: () => {
      const c: TplConfig = {
        hue: 340, studio: "Alba Studio", voiceHeading: "Photographs like first light", voiceSub: "Soft, quiet portrait and wedding photography.", galleryStyle: "masonry",
        copy: {
          aboutHeading: "Gentle direction, softer light",
          aboutBody: "Alba means dawn, and that is the brief: photographs that feel like the quiet first hour of the day.\n\nFor couples and families who want beauty without performance.",
          experienceIntro: "Unhurried sessions, honest direction, galleries full of air.",
          pricingIntro: "Simple collections for portraits and intimate weddings.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1150, hue: c.hue, label: "Alba", variant: "photo" }), imageAlt: "Soft portrait in pale morning light", kicker: "Portraits · Intimate weddings", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "View the work", buttonLink: "/portfolio", height: "medium", align: "center", overlay: false }),
        b("galleryMasonry", { images: imgs(c.hue, "photo", ["First light", "Her hands", "Quiet room", "The dress", "Morning vows", "Soft focus"]), cols: "3" }),
        b("testimonialSingle", { quote: "She photographs the way a deep breath feels.", name: "Maren L.", detail: "Portrait session", image: "", imageAlt: "" }),
        b("newsletter", { heading: "Dawn sessions", subtext: "Early morning mini sessions, announced seasonally.", buttonLabel: "Join the list" }),
        b("cta", { heading: "Say hello", body: "", buttonLabel: "Get in touch", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "lisbon",
    family: "business",
    name: "Lisbon",
    tagline: "City editorial, tile blue",
    desc: "Newspaper energy and city colour for editorial and brand photographers.",
    palette: "harbor",
    fontTheme: "gazette",
    headerStyle: "left",
    pages: () => {
      const c: TplConfig = {
        hue: 210, studio: "Lisbon Bureau", voiceHeading: "The city, reported in photographs", voiceSub: "Editorial, brand and wedding photography in the city.", galleryStyle: "grid",
        copy: {
          aboutHeading: "A reporter's eye, a stylist's standards",
          aboutBody: "Fifteen years of editorial commissions taught me to find the story fast and frame it clean.\n\nBrands, publications and couples who want the city in their pictures.",
          experienceIntro: "Brief, shoot, deliver: a newsroom-tight process.",
          pricingIntro: "Day rates for editorial and brand work; wedding collections on request.",
        },
      };
      return standardPages(c, [
        b("heroSplit", { image: ph({ w: 1300, h: 1400, hue: c.hue, label: "Lisbon", variant: "photo" }), imageAlt: "Tram passing blue tiled buildings", side: "right", kicker: "Editorial & brand studio", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "Latest work", buttonLink: "/portfolio" }),
        b("logos", { heading: "Published in", names: "MONOCLE\nTIME OUT\nCONDÉ NAST\nTHE LOCAL" }),
        b("galleryGrid", { images: imgs(c.hue, "photo", ["Tile work", "Tram line", "Market day", "Rooftops", "Café story", "Night edition"]), cols: "3", gap: true }),
        b("stats", { items: [{ value: "300+", label: "Commissions" }, { value: "48h", label: "Editorial turnaround" }, { value: "12", label: "Cover stories" }] }),
        b("blogList", { heading: "From the bureau", count: 3, layout: "grid" }),
        b("cta", { heading: "Commission the bureau", body: "", buttonLabel: "Start a brief", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "morgan",
    family: "portfolio",
    name: "Morgan",
    tagline: "Black tie, timeless, formal",
    desc: "High-formal elegance for black tie weddings and classic portraiture.",
    palette: "monochrome",
    fontTheme: "didone",
    headerStyle: "center",
    pages: () => {
      const c: TplConfig = {
        hue: 0, studio: "Morgan House", voiceHeading: "Formality, photographed beautifully", voiceSub: "Black tie weddings and classic portraiture.", galleryStyle: "grid",
        copy: {
          aboutHeading: "Tradition is a style, not a constraint",
          aboutBody: "Some weddings deserve white gloves and full orchestras. I photograph them with the formality they ask for and the warmth they hide.\n\nDiscreet staff-side manner, impeccable delivery.",
          experienceIntro: "A formal process, rehearsed like the day itself.",
          pricingIntro: "Collections for black tie weddings and formal portraiture.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1250, hue: c.hue, label: "Morgan", variant: "photo" }), imageAlt: "Black tie couple in a grand ballroom", kicker: "Black tie weddings", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "View the portfolio", buttonLink: "/portfolio", height: "full", align: "center", overlay: true }),
        b("galleryGrid", { images: imgs(c.hue, "photo", ["The ballroom", "First waltz", "The portrait", "Champagne tower", "Evening dress", "The farewell"]), cols: "3", gap: false }),
        b("quote", { quote: "Impeccable. The photographs belong in the family archive beside portraits from 1920, and they hold their own.", attribution: "The Ashworth family" }),
        b("cta", { heading: "A small number of commissions each year", body: "", buttonLabel: "Enquire", buttonLink: "/contact", tinted: false }),
      ]);
    },
  },
  {
    id: "esther",
    family: "portfolio",
    name: "Esther",
    tagline: "Film warmth, vintage soul",
    desc: "Shot-on-film softness and heirloom tones for nostalgic storytellers.",
    palette: "almond",
    fontTheme: "vintage",
    headerStyle: "center",
    pages: () => {
      const c: TplConfig = {
        hue: 30, studio: "Esther Film Co.", voiceHeading: "Shot on film, kept forever", voiceSub: "Weddings and families on real film and gentle digital.", galleryStyle: "masonry",
        copy: {
          aboutHeading: "Grain is not a flaw, it is a memory texture",
          aboutBody: "I shoot weddings on medium format film because it slows everyone down and makes every frame deliberate.\n\nDigital rides along for the dance floor; the story is told on film.",
          experienceIntro: "Slower, calmer, and somehow more fun. Film changes the room.",
          pricingIntro: "Film-first collections; film and scanning included, always.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1200, hue: c.hue, label: "Esther", variant: "photo" }), imageAlt: "Film photograph of a couple in warm window light", kicker: "Film wedding photography", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "See the film work", buttonLink: "/portfolio", height: "tall", align: "center", overlay: true }),
        b("galleryMasonry", { images: imgs(c.hue, "photo", ["Roll one", "The porch", "Grandma's house", "Golden grain", "The kitchen", "Last frame"]), cols: "3" }),
        b("imageText", { image: ph({ w: 1100, h: 1350, hue: c.hue + 10, label: "The cameras", variant: "detail" }), imageAlt: "Medium format film camera", side: "left", kicker: "The cameras", heading: "Forty years old and still the best seat", body: "Contax and Rolleiflex, serviced yearly, loaded with Portra. Your gallery arrives as scans with the grain left exactly where life put it.", buttonLabel: "How film works", buttonLink: "/experience" }),
        b("testimonials", { cols: "2", items: [
          { quote: "The photos feel like they were always in our family. That is the only review that matters.", name: "Ruth & Caleb", detail: "Wedding, Vermont" },
          { quote: "Worth every week of waiting for the scans.", name: "The Okafor family", detail: "Family session" },
        ] }),
        b("cta", { heading: "Film dates are limited by hand, not hype", body: "", buttonLabel: "Check your date", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "mono",
    family: "portfolio",
    name: "Mono",
    tagline: "Strictly black and white",
    desc: "A monochrome-only statement: type, grids and photographs in black and white.",
    palette: "paper",
    fontTheme: "gallerymono",
    headerStyle: "minimal",
    pages: () => {
      const c: TplConfig = {
        hue: 220, studio: "MONO", voiceHeading: "Colour is a distraction", voiceSub: "Black and white wedding and portrait photography, only.", galleryStyle: "grid",
        copy: {
          aboutHeading: "One rule: no colour, ever",
          aboutBody: "Strip the colour and a photograph has nowhere to hide: gesture, light and truth remain.\n\nEvery commission is delivered in black and white. It is the whole point.",
          experienceIntro: "Shot for monochrome from the first frame, not converted as an afterthought.",
          pricingIntro: "Monochrome collections for weddings and portraits.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1200, hue: c.hue, label: "MONO", variant: "photo" }), imageAlt: "Black and white portrait with hard shadow", kicker: "Monochrome only", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "Enter", buttonLink: "/portfolio", height: "full", align: "left", overlay: true }),
        b("galleryGrid", { images: imgs(c.hue, "photo", ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"]), cols: "3", gap: false }),
        b("stats", { items: [{ value: "0", label: "Colour photographs" }, { value: "100%", label: "Black and white" }, { value: "1", label: "Rule" }] }),
        b("cta", { heading: "Book the rule", body: "", buttonLabel: "Inquire", buttonLink: "/contact", tinted: false }),
      ]);
    },
  },
  {
    id: "skye",
    family: "business",
    name: "Skye",
    tagline: "Highland elopements, epic scale",
    desc: "Mountains, lochs and weather for elopements in the far north.",
    palette: "moss",
    fontTheme: "baskerton",
    headerStyle: "stacked",
    pages: () => {
      const c: TplConfig = {
        hue: 120, studio: "Skye & Stone", voiceHeading: "Vows at the edge of the map", voiceSub: "Elopements and intimate weddings in the Highlands.", galleryStyle: "masonry",
        copy: {
          aboutHeading: "Small weddings, enormous places",
          aboutBody: "I help couples marry in glens, on loch shores and under mountains older than language, and I photograph it without turning it into a production.\n\nTwo people, a celebrant, a flask of something warm.",
          experienceIntro: "Locations, permissions and weather windows, planned with local knowledge.",
          pricingIntro: "Elopement collections by the day, anywhere in the Highlands.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1250, hue: c.hue, label: "Skye", variant: "photo" }), imageAlt: "Couple beneath a Highland mountain ridge", kicker: "Highland elopements", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "Plan yours", buttonLink: "/experience", height: "full", align: "center", overlay: true }),
        b("imageText", { image: ph({ w: 1200, h: 1000, hue: c.hue + 20, label: "The glen", variant: "photo" }), imageAlt: "Mist over a Highland glen", side: "right", kicker: "The places", heading: "A hundred glens, all scouted", body: "Every location in the portfolio has been walked in every season. You get the quiet ones, not the coach park ones.", buttonLabel: "See the work", buttonLink: "/portfolio" }),
        b("list", { heading: "Elopements include", items: [
          { text: "Location scouting and permits" }, { text: "Celebrant and witness help" },
          { text: "Weather window planning" }, { text: "Full gallery in three weeks" },
        ], cols: "2" }),
        b("testimonialSingle", { quote: "Just us, the mountains, and somehow the best photographs ever taken of either of us.", name: "Fiona & Ross", detail: "Elopement, Glencoe", image: "", imageAlt: "" }),
        b("cta", { heading: "The Highlands are waiting", body: "", buttonLabel: "Start with a call", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "chase",
    family: "business",
    name: "Chase",
    tagline: "Bold, fast, commercial",
    desc: "High-energy imagery for sports, fitness and commercial brands.",
    palette: "charcoal",
    fontTheme: "poster",
    headerStyle: "left",
    pages: () => {
      const c: TplConfig = {
        hue: 210, studio: "CHASE Media", voiceHeading: "Built for speed", voiceSub: "Sports, fitness and commercial photography that hits hard.", galleryStyle: "grid",
        copy: {
          aboutHeading: "Campaign speed, athlete discipline",
          aboutBody: "Former sports desk photographer, now shooting campaigns for brands that move fast.\n\nConcepts, casting, shoot and retouch under one roof, delivered on the deadline, every time.",
          experienceIntro: "A production process built for launch dates.",
          pricingIntro: "Day rates and campaign packages for commercial work.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1150, hue: c.hue, label: "CHASE", variant: "photo" }), imageAlt: "Athlete sprinting under stadium lights", kicker: "Sports · Fitness · Commercial", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "See campaigns", buttonLink: "/portfolio", height: "tall", align: "left", overlay: true }),
        b("galleryGrid", { images: imgs(c.hue, "photo", ["Sprint", "Iron", "Game day", "The gym", "Victory", "Campaign 12"]), cols: "4", gap: true }),
        b("services", { cols: "3", items: [
          { title: "Campaigns", body: "Full production for product and brand launches.", image: "", imageAlt: "" },
          { title: "Athlete portraits", body: "One day, a full season of content.", image: "", imageAlt: "" },
          { title: "Events", body: "Race days and tournaments, same day selects.", image: "", imageAlt: "" },
        ] }),
        b("stats", { items: [{ value: "72h", label: "Campaign delivery" }, { value: "40+", label: "Brand clients" }, { value: "9", label: "Seasons on the desk" }] }),
        b("cta", { heading: "Launch date coming up?", body: "", buttonLabel: "Book the shoot", buttonLink: "/contact", tinted: false }),
      ]);
    },
  },
  {
    id: "odette",
    family: "portfolio",
    name: "Odette",
    tagline: "Parisian, romantic, refined",
    desc: "Soft French romance for weddings in the city of light and beyond.",
    palette: "lavender",
    fontTheme: "romance",
    headerStyle: "center",
    pages: () => {
      const c: TplConfig = {
        hue: 280, studio: "Odette Paris", voiceHeading: "L'amour, en lumière", voiceSub: "Romantic wedding photography, Paris and beyond.", galleryStyle: "masonry",
        copy: {
          aboutHeading: "Romance is a discipline",
          aboutBody: "Paris teaches a photographer everything: the light, the restraint, the timing of a kiss on a bridge at dusk.\n\nI bring that discipline to weddings anywhere in the world.",
          experienceIntro: "Effortless for you, choreographed underneath.",
          pricingIntro: "Collections for Paris weddings and destination celebrations.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1250, hue: c.hue, label: "Odette", variant: "photo" }), imageAlt: "Couple on a Paris bridge at dusk", kicker: "Weddings, Paris", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "Voir le portfolio", buttonLink: "/portfolio", height: "full", align: "center", overlay: true }),
        b("galleryMasonry", { images: imgs(c.hue, "photo", ["Le pont", "La robe", "Café crème", "La danse", "Les toits", "Minuit"]), cols: "3" }),
        b("testimonialSingle", { quote: "Our gallery looks like a film still archive from a movie about us. In Paris. I still cannot believe it.", name: "Camille & Hugo", detail: "Wedding, Paris", image: "", imageAlt: "" }),
        b("blogList", { heading: "Le journal", count: 3, layout: "grid" }),
        b("cta", { heading: "Paris books a year ahead", body: "", buttonLabel: "Begin", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "julia",
    family: "business",
    name: "Julia",
    tagline: "Bright, joyful, family first",
    desc: "Colourful, laughter-led photography for families and celebrations.",
    palette: "citrus",
    fontTheme: "humanist",
    headerStyle: "left",
    pages: () => {
      const c: TplConfig = {
        hue: 45, studio: "Julia Joy Photo", voiceHeading: "Real laughter, bright colours", voiceSub: "Family, newborn and celebration photography.", galleryStyle: "masonry",
        copy: {
          aboutHeading: "Kids do not pose, and that is the point",
          aboutBody: "Sessions with me are playdates with a camera nearby. The real laughs, the chaos, the cuddles: that is the gallery.\n\nFormer teacher, professional silly-face maker.",
          experienceIntro: "Relaxed sessions planned around naps, snacks and moods.",
          pricingIntro: "Family collections with prints and digitals, no hard sell, ever.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1150, hue: c.hue, label: "Julia", variant: "photo" }), imageAlt: "Family laughing in bright sunshine", kicker: "Families · Newborns · Parties", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "Book a playdate", buttonLink: "/contact", height: "medium", align: "center", overlay: false }),
        b("galleryMasonry", { images: imgs(c.hue, "photo", ["Tickle fight", "New brother", "Birthday chaos", "Grandma's garden", "Puddle day", "Cake smash"]), cols: "3" }),
        b("services", { cols: "3", items: [
          { title: "Family sessions", body: "One joyful hour, sixty plus photos.", image: "", imageAlt: "" },
          { title: "Newborn at home", body: "Slow mornings in your own light.", image: "", imageAlt: "" },
          { title: "Parties", body: "Birthdays and celebrations, covered fully.", image: "", imageAlt: "" },
        ] }),
        b("testimonials", { cols: "2", items: [
          { quote: "Our twins asked if Julia can come to every birthday forever.", name: "The Park family", detail: "Family session" },
          { quote: "She got the photo my phone has failed to get for four years.", name: "Melissa G.", detail: "Newborn session" },
        ] }),
        b("cta", { heading: "Weekend slots go fast", body: "", buttonLabel: "Grab yours", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "mason",
    family: "business",
    name: "Mason",
    tagline: "Architectural, precise, industrial",
    desc: "Geometry and concrete for architecture, interiors and corporate work.",
    palette: "graphite",
    fontTheme: "swiss",
    headerStyle: "minimal",
    pages: () => {
      const c: TplConfig = {
        hue: 200, studio: "Mason Works", voiceHeading: "Buildings, photographed precisely", voiceSub: "Architecture, interiors and corporate photography.", galleryStyle: "grid",
        copy: {
          aboutHeading: "Perspective corrected, always",
          aboutBody: "Tilt-shift discipline and a surveyor's patience. I photograph buildings the way architects draw them: true lines, honest materials, considered light.\n\nTrusted by studios, developers and hotels.",
          experienceIntro: "Scouted, scheduled around light, delivered print and web ready.",
          pricingIntro: "Project rates for architecture and interiors; day rates for corporate.",
        },
      };
      return standardPages(c, [
        b("heroSplit", { image: ph({ w: 1300, h: 1400, hue: c.hue, label: "Mason", variant: "photo" }), imageAlt: "Concrete facade in raking light", side: "left", kicker: "Architecture & interiors", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "Selected projects", buttonLink: "/portfolio" }),
        b("galleryGrid", { images: imgs(c.hue, "photo", ["Facade 01", "Atrium", "Stairwell", "Hotel suite", "Office floor", "Night elevation"]), cols: "3", gap: true }),
        b("list", { heading: "Deliverables", items: [
          { text: "Perspective corrected masters" }, { text: "Web and print exports" },
          { text: "Twilight elevations" }, { text: "Licensing for marketing use" },
        ], cols: "2" }),
        b("stats", { items: [{ value: "180+", label: "Buildings delivered" }, { value: "26", label: "Architecture studios" }, { value: "5 days", label: "Standard delivery" }] }),
        b("cta", { heading: "Project completing soon?", body: "", buttonLabel: "Book the shoot", buttonLink: "/contact", tinted: false }),
      ]);
    },
  },
  {
    id: "dahlia",
    family: "portfolio",
    name: "Dahlia",
    tagline: "Garden romance, floral and lush",
    desc: "Blooms and soft colour for garden weddings and floral-led celebrations.",
    palette: "rose",
    fontTheme: "elegant",
    headerStyle: "center",
    pages: () => {
      const c: TplConfig = {
        hue: 330, studio: "Dahlia & Vine", voiceHeading: "Weddings in full bloom", voiceSub: "Garden and estate wedding photography.", galleryStyle: "masonry",
        copy: {
          aboutHeading: "A florist's eye behind the camera",
          aboutBody: "I came to weddings through flowers, and I still photograph the bouquet like a portrait.\n\nGarden venues, estate lawns and celebrations where the flowers are half the guest list.",
          experienceIntro: "Timed to the garden's best hours, coordinated with your florist.",
          pricingIntro: "Collections for garden and estate weddings.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1250, hue: c.hue, label: "Dahlia", variant: "photo" }), imageAlt: "Couple in a rose garden at golden hour", kicker: "Garden weddings", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "Wander the gardens", buttonLink: "/portfolio", height: "full", align: "center", overlay: true }),
        b("galleryMasonry", { images: imgs(c.hue, "photo", ["Rose walk", "The bouquet", "Glasshouse", "Petal aisle", "Orangery", "Evening blooms"]), cols: "3" }),
        b("imageText", { image: ph({ w: 1100, h: 1350, hue: c.hue + 15, label: "The garden", variant: "detail" }), imageAlt: "Close up of wedding flowers", side: "left", kicker: "Details matter", heading: "Your flowers, photographed like family", body: "The bouquet, the buttonholes, the table centres at their morning best, all documented before the day sweeps them away.", buttonLabel: "The experience", buttonLink: "/experience" }),
        b("cta", { heading: "Bloom season books first", body: "", buttonLabel: "Check your date", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "atlas",
    family: "portfolio",
    name: "Atlas",
    tagline: "Documentary, far-flung, honest",
    desc: "Travel documentary photography for adventurous weddings and stories worldwide.",
    palette: "desert",
    fontTheme: "letterpress",
    headerStyle: "left",
    pages: () => {
      const c: TplConfig = {
        hue: 25, studio: "Atlas Field Notes", voiceHeading: "Stories from the far map", voiceSub: "Documentary wedding and travel photography, worldwide.", galleryStyle: "grid",
        copy: {
          aboutHeading: "Nothing staged, everything noticed",
          aboutBody: "A documentary habit formed on four continents: stay quiet, stay close, miss nothing.\n\nWeddings, expeditions and family stories in places the tour buses skip.",
          experienceIntro: "One photographer, two cameras, zero interference.",
          pricingIntro: "Wedding collections worldwide; travel quoted flat, no surprises.",
        },
      };
      return standardPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1200, hue: c.hue, label: "Atlas", variant: "photo" }), imageAlt: "Travellers crossing a desert valley", kicker: "Documentary · Worldwide", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "Read the field notes", buttonLink: "/blog", height: "full", align: "left", overlay: true }),
        b("galleryGrid", { images: imgs(c.hue, "photo", ["Marrakech", "Patagonia", "The ferry", "High pass", "Village wedding", "Night train"]), cols: "3", gap: true }),
        b("blogList", { heading: "Field notes", count: 3, layout: "list" }),
        b("quote", { quote: "He photographed our wedding like a war correspondent covering a peace treaty. Perfectly.", attribution: "Amara & Jon, wedding in Fez" }),
        b("cta", { heading: "Somewhere far in mind?", body: "", buttonLabel: "Write to the atlas", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "enzo",
    family: "portfolio",
    name: "Enzo",
    tagline: "Italian modern, sharp tailoring",
    desc: "Crisp modern editorial for fashion-led weddings and portraits.",
    palette: "espresso",
    fontTheme: "futurist",
    headerStyle: "left",
    pages: () => {
      const c: TplConfig = {
        hue: 15, studio: "Studio Enzo", voiceHeading: "Tailored light, modern lines", voiceSub: "Fashion-led wedding and portrait photography.", galleryStyle: "grid",
        copy: {
          aboutHeading: "From the fashion desk to your wedding",
          aboutBody: "Ten years of Milan fashion weeks, applied to weddings: direction when it flatters, invisibility when it matters.\n\nThe result looks editorial and feels like you.",
          experienceIntro: "Styled where it counts, documentary everywhere else.",
          pricingIntro: "Collections for weddings and portrait commissions.",
        },
      };
      return standardPages(c, [
        b("heroSplit", { image: ph({ w: 1300, h: 1500, hue: c.hue, label: "Enzo", variant: "portrait" }), imageAlt: "Sharp editorial portrait in hard light", side: "right", kicker: "Fashion-led photography", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "The portfolio", buttonLink: "/portfolio" }),
        b("galleryGrid", { images: imgs(c.hue, "photo", ["Look 01", "Look 02", "Look 03", "Look 04", "Look 05", "Look 06"]), cols: "4", gap: false }),
        b("testimonialSingle", { quote: "Our wedding gallery ran in a magazine. A magazine. I still open it weekly.", name: "Giulia & Marco", detail: "Wedding, Milan", image: "", imageAlt: "" }),
        b("cta", { heading: "Commissions open for next season", body: "", buttonLabel: "Inquire", buttonLink: "/contact", tinted: false }),
      ]);
    },
  },
];

// ------------------------------------------------------------ legacy classics
// The older template line: simpler page sets built only from the classic
// blocks (no booking calendar, client gallery or Flex canvas blocks).

function legacyPages(c: TplConfig, home: Block[]): TemplatePage[] {
  return [
    { type: "HOME", title: "Home", slug: "", blocks: home },
    portfolioPage(c),
    aboutPage(c),
    pricingPage(c),
    blogPage(),
    {
      type: "CONTACT",
      title: "Contact",
      slug: "contact",
      blocks: [
        b("heading", { kicker: "Say hello", heading: "Contact", intro: "Tell me about your day, the more detail the better.", align: "center" }),
        b("contactForm", { heading: "Start an inquiry", intro: "", phone: true, subject: true, buttonLabel: "Send inquiry", success: "Thank you, you'll hear back within two business days." }),
        b("socialLinks", { items: [
          { label: "Instagram", url: "https://instagram.com" },
          { label: "Pinterest", url: "https://pinterest.com" },
          { label: "Email", url: "mailto:hello@example.com" },
        ] }),
      ],
    },
  ];
}

const LEGACY_TEMPLATES: TemplateDef[] = [
  {
    id: "canvas",
    family: "portfolio",
    name: "Canvas",
    tagline: "Legacy classic, simple and open",
    desc: "Legacy classic template. A plain, open layout from the original template line, classic blocks only.",
    palette: "paper",
    fontTheme: "classicserif",
    headerStyle: "left",
    pages: () => {
      const c: TplConfig = {
        hue: 100, studio: "Canvas Studio", voiceHeading: "Simple photographs, honestly made", voiceSub: "Weddings and portraits without the fuss.", galleryStyle: "grid",
        copy: {
          aboutHeading: "The camera is simple, the seeing is not",
          aboutBody: "Canvas is where this studio started: one photographer, one bag, and weddings photographed as they happen.\n\nNo trends, no gimmicks, just the day.",
          experienceIntro: "Straightforward from first email to finished gallery.",
          pricingIntro: "Plain pricing for weddings and portraits.",
        },
      };
      return legacyPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1150, hue: c.hue, label: "Canvas", variant: "photo" }), imageAlt: "Couple walking through a field", kicker: "Wedding photography", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "See the work", buttonLink: "/portfolio", height: "tall", align: "center", overlay: true }),
        b("galleryGrid", { images: imgs(c.hue, "photo", ["One", "Two", "Three", "Four", "Five", "Six"]), cols: "3", gap: true }),
        b("cta", { heading: "Booking this season and next", body: "", buttonLabel: "Get in touch", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "avery",
    family: "portfolio",
    name: "Avery",
    tagline: "Legacy classic, bookish and calm",
    desc: "Legacy classic template. Serif type and quiet spacing from the original template line, classic blocks only.",
    palette: "ivory",
    fontTheme: "bookish",
    headerStyle: "center",
    pages: () => {
      const c: TplConfig = {
        hue: 50, studio: "Avery Studio", voiceHeading: "A quiet record of loud days", voiceSub: "Wedding photography for book lovers and old souls.", galleryStyle: "masonry",
        copy: {
          aboutHeading: "Photographs that read like chapters",
          aboutBody: "I think of a wedding gallery as a book you will still be reading at eighty.\n\nChapters, pauses, and all the small print of the day, kept.",
          experienceIntro: "Considered, calm, and finished like a first edition.",
          pricingIntro: "Collections for weddings, with albums at the heart.",
        },
      };
      return legacyPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1200, hue: c.hue, label: "Avery", variant: "photo" }), imageAlt: "Bride reading a letter by window light", kicker: "Wedding photography", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "Open the book", buttonLink: "/portfolio", height: "tall", align: "center", overlay: true }),
        b("galleryMasonry", { images: imgs(c.hue, "photo", ["Chapter one", "The letter", "Interlude", "The feast", "Chapter nine", "Epilogue"]), cols: "3" }),
        b("quote", { quote: "Our album is the best book we own, and we own thousands.", attribution: "Helen & David" }),
        b("cta", { heading: "Your chapter starts with a note", body: "", buttonLabel: "Write to the studio", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "edward",
    family: "business",
    name: "Edward",
    tagline: "Legacy classic, formal and plain",
    desc: "Legacy classic template. A formal, text-forward layout from the original template line, classic blocks only.",
    palette: "slate",
    fontTheme: "broadsheet",
    headerStyle: "left",
    pages: () => {
      const c: TplConfig = {
        hue: 210, studio: "Edward & Co.", voiceHeading: "Photography, properly done", voiceSub: "Weddings, portraits and corporate work, delivered on time.", galleryStyle: "grid",
        copy: {
          aboutHeading: "Established standards, kept daily",
          aboutBody: "Edward & Co. has photographed this city's weddings and boardrooms for two decades.\n\nThe standards are old fashioned: early, prepared, polite, and excellent.",
          experienceIntro: "A proven process, unchanged because it works.",
          pricingIntro: "Published rates for weddings, portraits and corporate days.",
        },
      };
      return legacyPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1150, hue: c.hue, label: "Edward", variant: "photo" }), imageAlt: "Formal wedding portrait in a hall", kicker: "Est. 2004", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "View the portfolio", buttonLink: "/portfolio", height: "medium", align: "left", overlay: true }),
        b("stats", { items: [{ value: "20", label: "Years established" }, { value: "900+", label: "Weddings delivered" }, { value: "14 days", label: "Standard delivery" }] }),
        b("galleryGrid", { images: imgs(c.hue, "photo", ["The hall", "The portrait", "The address", "The dance", "The party", "The send off"]), cols: "3", gap: true }),
        b("cta", { heading: "Appointments available this month", body: "", buttonLabel: "Enquire", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
  {
    id: "montreal",
    family: "business",
    name: "Montreal",
    tagline: "Legacy classic, bilingual city studio",
    desc: "Legacy classic template. A stacked-header city layout from the original template line, classic blocks only.",
    palette: "dove",
    fontTheme: "studio",
    headerStyle: "stacked",
    pages: () => {
      const c: TplConfig = {
        hue: 260, studio: "Studio Montreal", voiceHeading: "Deux langues, une vision", voiceSub: "Wedding and portrait photography, en français et en anglais.", galleryStyle: "masonry",
        copy: {
          aboutHeading: "A city studio with two mother tongues",
          aboutBody: "Montreal weddings mix everything: languages, traditions, grandmothers. We photograph the mix with love.\n\nService entièrement bilingue, du premier courriel à l'album final.",
          experienceIntro: "Bilingual planning, city-smart locations, calm delivery.",
          pricingIntro: "Collections for weddings and portraits across the city.",
        },
      };
      return legacyPages(c, [
        b("hero", { image: ph({ w: 2000, h: 1200, hue: c.hue, label: "Montreal", variant: "photo" }), imageAlt: "Couple in the old port at dusk", kicker: "Photographie · Photography", heading: c.voiceHeading, subheading: c.voiceSub, buttonLabel: "Voir le portfolio", buttonLink: "/portfolio", height: "tall", align: "center", overlay: true }),
        b("galleryMasonry", { images: imgs(c.hue, "photo", ["Vieux-Port", "La cérémonie", "Rue Sainte-Catherine", "La fête", "Les familles", "Minuit"]), cols: "3" }),
        b("testimonials", { cols: "2", items: [
          { quote: "Elle a photographié nos deux familles comme une seule. Merci, merci.", name: "Sophie & Karim", detail: "Mariage, Montréal" },
          { quote: "Bilingual, invisible, and the gallery is stunning.", name: "The Tremblay family", detail: "Portrait session" },
        ] }),
        b("cta", { heading: "Réservez votre date · Book your date", body: "", buttonLabel: "Contact", buttonLink: "/contact", tinted: true }),
      ]);
    },
  },
];

TEMPLATES.push(...LEGACY_TEMPLATES);

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

// One page templates: the navigation is built from the home page's anchored
// sections (blocks with an anchor id and a menu label), plus any other page
// the photographer chose to show.
export function onePageNav(
  templateId: string,
  pages: { type: string; title: string; slug: string; visible: boolean; blocks: string }[]
): { title: string; slug: string; visible: boolean }[] | null {
  if (templateById(templateId)?.family !== "onepage") return null;
  const home = pages.find((p) => p.type === "HOME");
  const nav: { title: string; slug: string; visible: boolean }[] = [];
  if (home) {
    for (const block of parseBlocks(home.blocks)) {
      const anchor = String(block.props._anchor ?? "").trim();
      const label = String(block.props._navLabel ?? "").trim();
      if (anchor && label) nav.push({ title: label, slug: `#${anchor}`, visible: true });
    }
  }
  for (const p of pages) if (p.type !== "HOME" && p.visible) nav.push({ title: p.title, slug: p.slug, visible: true });
  return nav;
}

// ------------------------------------------------------------ landing pages
// Prebuilt landing page bundles, added as custom pages from the Pages tab.
export const LANDING_PAGES: { id: string; name: string; desc: string; title: string; slug: string; blocks: () => Block[] }[] = [
  {
    id: "sessions",
    name: "Session landing page",
    desc: "Sell one session type: hero, what is included, gallery, pricing, reviews, live booking",
    title: "Book a Session",
    slug: "sessions",
    blocks: () => [
      b("heroSplit", { image: ph({ w: 1300, h: 1500, hue: 30, label: "Sessions", variant: "portrait" }), imageAlt: "Family laughing on a blanket", side: "right", kicker: "Now booking", heading: "Portrait sessions that feel easy", subheading: "One relaxed hour, a full gallery in two weeks, prints you will actually hang.", buttonLabel: "See open times", buttonLink: "#book" }),
      b("list", { heading: "Every session includes", items: [{ text: "Planning call and outfit guide" }, { text: "60 minutes, one location" }, { text: "50+ edited images" }, { text: "Online gallery with downloads" }], cols: "2" }),
      b("galleryGrid", { images: imgs(30, "photo", ["Session 1", "Session 2", "Session 3", "Session 4", "Session 5", "Session 6"]), cols: "3", gap: true }),
      b("pricingPackages", { cols: "2", packages: [
        { name: "Mini", price: "$250", unit: "20 minutes", features: "15 images\nOnline gallery", featured: false },
        { name: "Full session", price: "$450", unit: "60 minutes", features: "50+ images\nPrint credit $50", featured: true },
      ] }),
      b("reviewsWall", { items: [{ stars: "5", quote: "The easiest hour of photos we have ever done.", name: "Priya K.", source: "Google" }, { stars: "5", quote: "Our kids actually asked when we can go again.", name: "Mark D.", source: "Google" }] }),
      b("bookingCalendar", { _anchor: "book", heading: "Pick your time", intro: "Live availability, you are booked the moment you confirm.", sessionTypeIds: [], layout: "cards" }),
      b("faq", { heading: "Good to know", items: [{ q: "What if it rains?", a: "We reschedule for free, as many times as needed." }, { q: "When do we get photos?", a: "Your full gallery arrives within two weeks." }] }),
    ],
  },
  {
    id: "workshops",
    name: "Workshop landing page",
    desc: "Promote an in person workshop: date and venue, agenda, instructor, seats, sign up",
    title: "Workshop",
    slug: "workshop",
    blocks: () => [
      b("hero", { image: ph({ w: 2000, h: 1200, hue: 200, label: "Workshop", variant: "photo" }), imageAlt: "Photographers at a lighting workshop", kicker: "One day workshop", heading: "Natural Light, Mastered", subheading: "Saturday, 10am to 5pm, in the studio. Twelve seats.", buttonLabel: "Reserve a seat", buttonLink: "#register", height: "tall", align: "left", overlay: true }),
      b("stats", { items: [{ value: "12", label: "Seats" }, { value: "7h", label: "Hands on" }, { value: "3", label: "Live shoots" }] }),
      b("experienceTimeline", { items: [
        { marker: "10:00", title: "Seeing light", body: "Reading window light, open shade and back light." },
        { marker: "12:30", title: "Lunch and portfolio reviews", body: "Bring ten images, leave with a plan." },
        { marker: "14:00", title: "Live shoots", body: "Three set ups with real couples." },
        { marker: "16:30", title: "Editing session", body: "From raw file to finished gallery." },
      ] }),
      b("imageText", { image: ph({ w: 1100, h: 1350, hue: 210, label: "Instructor", variant: "portrait" }), imageAlt: "Workshop instructor", side: "left", kicker: "Your instructor", heading: "Twelve years behind the camera", body: "Over 240 weddings and a teaching style built on doing, not watching.", buttonLabel: "", buttonLink: "" }),
      b("pricingPackages", { cols: "2", packages: [
        { name: "Seat", price: "$395", unit: "per person", features: "Full day\nLunch included\nPreset pack", featured: true },
        { name: "Seat + mentoring", price: "$595", unit: "per person", features: "Everything in Seat\n1:1 follow up call", featured: false },
      ] }),
      b("contactForm", { _anchor: "register", heading: "Reserve your seat", intro: "Send your details and we will confirm your seat with the payment link.", phone: true, subject: false, buttonLabel: "Reserve", success: "Thank you, your seat is held for 48 hours." }),
    ],
  },
  {
    id: "courses",
    name: "Course landing page",
    desc: "Sell an online course: outcomes, curriculum, testimonials, pricing, FAQ, waitlist",
    title: "Online Course",
    slug: "course",
    blocks: () => [
      b("heroSplit", { image: ph({ w: 1300, h: 1500, hue: 260, label: "Course", variant: "detail" }), imageAlt: "Laptop with editing software open", side: "left", kicker: "Online course", heading: "Edit faster, deliver sooner", subheading: "Eight self paced lessons that cut your editing time in half.", buttonLabel: "Join the course", buttonLink: "#join" }),
      b("columnsText", { cols: "3", items: [{ title: "Learn", body: "A repeatable culling and editing workflow." }, { title: "Practice", body: "Raw files included for every lesson." }, { title: "Ship", body: "Deliver galleries in days, not weeks." }] }),
      b("faq", { heading: "Curriculum", items: [
        { q: "Lesson 1: Culling in one pass", a: "Star ratings, flags and a two pass rule." },
        { q: "Lesson 2: Building your base preset", a: "Profiles, tone curves and colour calibration." },
        { q: "Lesson 3: Batch sync like a pro", a: "Sync by scene, not by image." },
        { q: "Lesson 4 to 8", a: "Skin, black and white, delivery, backups and pricing your time." },
      ] }),
      b("testimonials", { cols: "2", items: [{ quote: "I got my Saturdays back.", name: "Leah M.", detail: "Wedding photographer" }, { quote: "Paid for itself after one wedding.", name: "Chris O.", detail: "Family photographer" }] }),
      b("pricingPackages", { cols: "2", packages: [{ name: "Course", price: "$149", unit: "lifetime access", features: "8 lessons\nRaw files\nPreset pack", featured: true }, { name: "Course + review", price: "$249", unit: "lifetime access", features: "Everything in Course\nOne gallery review", featured: false }] }),
      b("newsletter", { _anchor: "join", heading: "Join the next enrolment", subtext: "Doors open four times a year, get the invite first.", buttonLabel: "Join the waitlist" }),
    ],
  },
  {
    id: "promos",
    name: "Promo landing page",
    desc: "Run a limited offer: headline offer, deadline, what you get, proof, one clear call to action",
    title: "Special Offer",
    slug: "offer",
    blocks: () => [
      b("hero", { image: ph({ w: 2000, h: 1200, hue: 350, label: "Offer", variant: "photo" }), imageAlt: "Holiday family portrait", kicker: "Limited time", heading: "Holiday minis, 30% off", subheading: "Book by Sunday. Twenty minutes, fifteen images, gift ready prints.", buttonLabel: "Claim the offer", buttonLink: "#claim", height: "medium", align: "center", overlay: true }),
      b("stats", { items: [{ value: "30%", label: "Off session fee" }, { value: "15", label: "Edited images" }, { value: "Sun", label: "Offer ends" }] }),
      b("galleryGrid", { images: imgs(350, "photo", ["Holiday 1", "Holiday 2", "Holiday 3"]), cols: "3", gap: true }),
      b("testimonialSingle", { quote: "Our holiday card has never looked this good.", name: "The Alvarez family", detail: "Holiday minis 2025", image: "", imageAlt: "" }),
      b("bookingCalendar", { _anchor: "claim", heading: "Claim your spot", intro: "Spots are first come, first served.", sessionTypeIds: [], layout: "cards" }),
      b("cta", { heading: "Questions about the offer?", body: "", buttonLabel: "Ask us", buttonLink: "/contact", tinted: true }),
    ],
  },
  {
    id: "links",
    name: "Bio link page",
    desc: "A link in bio page for social profiles: portrait, name, and your most important links as big buttons",
    title: "Links",
    slug: "links",
    blocks: () => [
      b("linkList", {
        avatar: ph({ w: 400, h: 400, hue: 32, label: "Portrait", variant: "portrait" }),
        avatarAlt: "Portrait of the photographer",
        heading: "Your Name Photography",
        subtext: "Weddings and portraits. Now booking next season.",
        style: "pill",
        links: [
          { label: "Book a session", url: "/contact", note: "" },
          { label: "See the portfolio", url: "/portfolio", note: "" },
          { label: "Client galleries", url: "/client-area", note: "" },
          { label: "Instagram", url: "https://instagram.com", note: "" },
        ],
      }),
      b("newsletter", { heading: "Get first word on mini sessions", subtext: "One short email a month, no noise.", buttonLabel: "Join" }),
    ],
  },
];

export const landingById = (id: string) => LANDING_PAGES.find((l) => l.id === id);

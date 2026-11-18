// Website templates, preset bundles of pages/blocks/fonts/palettes in
// Pixieset's named families. Switching templates rebuilds the page set and
// applies the template's palette/font/header; blog posts are stored separately
// and always survive the switch.

import { Block, makeBlock } from "./blocks";
import { ph } from "./website";

export interface TemplatePage {
  type: string;
  title: string;
  slug: string;
  blocks: Block[];
}

export interface TemplateDef {
  id: string;
  name: string;
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
      b("bookingEmbed", { heading: "Prefer to pick a date?", intro: "Request a session directly and we'll confirm availability.", sessionTypes: "Wedding\nEngagement session\nPortrait session\nBrand shoot" }),
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
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

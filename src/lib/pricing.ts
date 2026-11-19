// Pixieset-style plan ladders (display only, every feature is unlocked in this
// replica regardless of plan). Prices mirror Pixieset's published Nov-2026
// ladders: annual per-month / monthly.

export interface Plan {
  name: string;
  annual: string; // per month, billed yearly
  monthly: string;
  highlight?: boolean;
  features: string[];
}

export interface ProductPricing {
  id: string;
  name: string;
  tagline: string;
  plans: Plan[];
  footnote?: string;
}

export const PRICING: ProductPricing[] = [
  {
    id: "gallery",
    name: "Client Gallery",
    tagline: "Store and Mobile Gallery App included in every tier.",
    plans: [
      {
        name: "Free",
        annual: "$0",
        monthly: "$0",
        features: ["Unlimited galleries", "Store with 15% commission", "3 mobile apps", "High-res downloads to 3600px"],
      },
      {
        name: "Basic",
        annual: "$8",
        monthly: "$10",
        features: ["0% store commission", "Custom domain & logo", "Remove Pixora branding", "Full-resolution downloads", "Unlimited mobile apps", "100 email campaigns/mo"],
      },
      {
        name: "Plus",
        annual: "$16",
        monthly: "$20",
        highlight: true,
        features: ["Everything in Basic", "500 email campaigns/mo", "1 hr HD video"],
      },
      {
        name: "Pro",
        annual: "$24",
        monthly: "$30",
        features: ["RAW uploads", "4K video (2 hrs) & 4K downloads", "Bulk sharing"],
      },
      {
        name: "Ultimate",
        annual: "$40",
        monthly: "$50",
        features: ["5 hrs 4K video", "10,000 email campaigns/mo", "Unlimited photos"],
      },
    ],
  },
  {
    id: "website",
    name: "Website",
    tagline: "Templates, Flex-style blocks, blog and SEO manager.",
    plans: [
      {
        name: "Free",
        annual: "$0",
        monthly: "$0",
        features: ["15 pages, 100 photos", "5 blog posts", "Free subdomain + SSL", "Unlimited bandwidth"],
      },
      {
        name: "Plus",
        annual: "$12",
        monthly: "$15",
        highlight: true,
        features: ["Unlimited pages, photos & posts", "Custom domain", "Remove Pixora banner", "Analytics integrations"],
      },
      {
        name: "Pro",
        annual: "$18",
        monthly: "$24",
        features: ["Custom code & fonts", "Advanced colors", "URL redirects", "AI alt text & copywriting"],
      },
    ],
  },
  {
    id: "studio",
    name: "Studio Manager",
    tagline: "Bookings, contracts, invoices, questionnaires and projects.",
    plans: [
      {
        name: "Free",
        annual: "$0",
        monthly: "$0",
        features: ["Unlimited invoices", "3 contracts", "3 quotes & questionnaires", "1 active session type"],
      },
      {
        name: "Plus",
        annual: "$12",
        monthly: "$15",
        highlight: true,
        features: ["Unlimited contracts & quotes", "3 session types", "Payment reminders", "Tips & branding"],
      },
      {
        name: "Pro",
        annual: "$18",
        monthly: "$24",
        features: ["Unlimited session types", "Booking reminders", "Retainer collection at booking", "Manual approval", "Branding removed"],
      },
    ],
  },
  {
    id: "volume",
    name: "Studio Manager Volume",
    tagline: "Gallery plans for school, sports and volume studios. Prices per month, billed annually.",
    plans: [
      {
        name: "Volume 2 TB",
        annual: "$48",
        monthly: "$48",
        features: ["2 TB of gallery storage", "IP whitelisting for account access", "Unlimited login sessions", "No bandwidth restrictions"],
      },
      {
        name: "Volume 5 TB",
        annual: "$64",
        monthly: "$64",
        highlight: true,
        features: ["5 TB of gallery storage", "IP whitelisting for account access", "Unlimited login sessions", "No bandwidth restrictions"],
      },
      {
        name: "Volume 10 TB",
        annual: "$96",
        monthly: "$96",
        features: ["10 TB of gallery storage", "IP whitelisting for account access", "Unlimited login sessions", "No bandwidth restrictions"],
      },
    ],
    footnote: "Volume plans are gallery only and billed annually in the researched data. Storage amounts describe the researched product; this replica excludes the storage product itself by the owner's order, while the plan rows, IP whitelisting and session behaviour are built.",
  },
  {
    id: "suite",
    name: "Pixora Suite",
    tagline: "Client Gallery + Website + Studio Manager + Store + Mobile App, bundled.",
    plans: [
      {
        name: "Starter",
        annual: "$28",
        monthly: "$35",
        features: ["1 hr HD video", "500 emails/mo", "3 active session types", "Core Studio Manager, unlimited docs, reminders, tips, intake forms"],
      },
      {
        name: "Pro",
        annual: "$38",
        monthly: "$50",
        highlight: true,
        features: ["4 hrs 4K video", "Booking reminders & retainers at booking", "Manual approval", "Website Pro + Gallery Pro equivalents", "Remove branding"],
      },
      {
        name: "Ultimate",
        annual: "$55",
        monthly: "$65",
        features: ["Unlimited photos", "10 hrs 4K video", "10,000 emails/mo"],
      },
    ],
    footnote: "Suite Pro saves ≈37% vs buying Gallery Pro + Website Pro + Studio Pro separately.",
  },
];

// ---------------------------------------------------------------------------
// Night build (Pricing lane): plan add-ons from the research. Prices in cents
// per month. Add-ons ride on top of any plan and are managed in Settings >
// Plan; billing is parked, so activating one records a simulated add-on
// subscription and never charges a card.
// ---------------------------------------------------------------------------

export const ADD_ON_PRICES = {
  editor: 1200, // Photo Editor, about $12/mo in the research
  videoHour: 500, // extra video, $5/mo per hour
  campaignBlock: 1000, // extra email campaigns, $10/mo per 5,000 sends
} as const;

export interface AddOn {
  id: "editor" | "video" | "campaigns";
  name: string;
  price: string;
  unit: string;
  blurb: string;
}

export const ADD_ONS: AddOn[] = [
  {
    id: "editor",
    name: "Photo Editor",
    price: "$12",
    unit: "per month",
    blurb: "AI culling, editing suggestions and your learned style, on top of a Free Client Gallery plan. Included with every paid Client Gallery plan.",
  },
  {
    id: "video",
    name: "Extra video",
    price: "$5",
    unit: "per month, per hour",
    blurb: "One more hour of video storage on your Client Gallery plan, on top of the hours your tier already includes.",
  },
  {
    id: "campaigns",
    name: "Extra email campaigns",
    price: "$10",
    unit: "per month, per 5,000 sends",
    blurb: "Another 5,000 email campaign sends a month, on top of the sends your Client Gallery tier already includes.",
  },
];

export const VOLUME_TIERS: { id: "" | "volume2" | "volume5" | "volume10"; label: string; monthlyCents: number }[] = [
  { id: "", label: "No volume plan", monthlyCents: 0 },
  { id: "volume2", label: "Volume 2 TB", monthlyCents: 4800 },
  { id: "volume5", label: "Volume 5 TB", monthlyCents: 6400 },
  { id: "volume10", label: "Volume 10 TB", monthlyCents: 9600 },
];

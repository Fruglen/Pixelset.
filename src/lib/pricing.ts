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
        features: ["0% store commission", "Custom domain & logo", "Remove Pixelset branding", "Full-resolution downloads", "Unlimited mobile apps", "100 email campaigns/mo"],
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
        features: ["Unlimited pages, photos & posts", "Custom domain", "Remove Pixelset banner", "Analytics integrations"],
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
    id: "suite",
    name: "Pixelset Suite",
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

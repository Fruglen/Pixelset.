// Fix batch 2026-11-20: in app help centre content. Every guide describes a
// feature that exists in this app today, with the dashboard path that opens
// it. Plain language, short steps, no marketing claims.

export interface HelpGuide {
  id: string;
  product: "Getting started" | "Client Gallery" | "Website" | "Studio Manager" | "Store" | "Photo Editor" | "Account";
  title: string;
  summary: string;
  steps: string[];
  links: { href: string; label: string }[];
  keywords?: string;
}

export const HELP_PRODUCTS = ["Getting started", "Client Gallery", "Website", "Studio Manager", "Store", "Photo Editor", "Account"] as const;

export const HELP_GUIDES: HelpGuide[] = [
  {
    id: "switch-products",
    product: "Getting started",
    title: "Moving between products",
    summary: "Each product (Client Gallery, Website, Studio Manager, Store) has its own dashboard and menu.",
    steps: [
      "Use the product switcher at the top left of every dashboard page to jump to another product.",
      "The left menu changes to that product's own pages. All products takes you back to the account overview.",
      "Settings at the bottom of the menu holds account wide options such as your plan, brand, team and email.",
    ],
    links: [{ href: "/dashboard", label: "Account overview" }],
    keywords: "navigation menu switcher sidebar",
  },
  {
    id: "first-gallery",
    product: "Client Gallery",
    title: "Create and share your first gallery",
    summary: "A collection is one client gallery with its own link, design and privacy settings.",
    steps: [
      "Open Client Gallery and choose New collection. Give it a name, an event date and a link, or start from a preset.",
      "Drag photos and videos onto the Photos tab. Uploads run in the background, resume after a dropped connection and show progress per file.",
      "Organise photos into sets such as Getting Ready or Ceremony, and pick a cover photo.",
      "Set the status to Published, then use Share to email the client, copy the link or show a QR code. Publish and Notify publishes and emails registered clients in one step.",
    ],
    links: [{ href: "/collections", label: "Collections" }],
    keywords: "collection upload share publish invite",
  },
  {
    id: "gallery-privacy",
    product: "Client Gallery",
    title: "Passwords, email registration and private photos",
    summary: "Control who can open a gallery and what each visitor sees.",
    steps: [
      "In Collection Settings, Privacy, set a gallery password or require visitors to register their email before viewing.",
      "Mark single photos as private from the Photos tab so only you see them.",
      "Make a set Client Exclusive to hide it until the client enters their email and access password.",
      "Turn on watermarking for previews. Downloads follow your watermark size rules in Settings.",
    ],
    links: [{ href: "/collections", label: "Collections" }],
    keywords: "password private exclusive watermark registration",
  },
  {
    id: "gallery-downloads",
    product: "Client Gallery",
    title: "Download settings and the download PIN",
    summary: "Decide which sizes clients can download and how many.",
    steps: [
      "Collection Settings, Download turns downloads on or off and picks the offered sizes from Original down to 640px.",
      "A 4 digit download PIN can be required, with a use limit, and a free download cap can be set per client.",
      "Clients on phones see step by step instructions for saving to Photos on iPhone or to the Gallery on Android, and can get a whole gallery ZIP link by email instead.",
    ],
    links: [{ href: "/collections", label: "Collections" }],
    keywords: "download pin zip size iphone android mobile",
  },
  {
    id: "preview-quality",
    product: "Client Gallery",
    title: "Preview quality and renditions",
    summary: "Galleries show sized preview copies of your photos. Your originals are never changed.",
    steps: [
      "When a photo is uploaded, previews at 640, 1024 and 2048 pixels are generated at your chosen quality.",
      "Grids load the small renditions and the full screen view loads the large one, so galleries open quickly without looking soft.",
      "Change the longest preview edge and the JPEG quality in Settings, Gallery, Preview quality. Downloads always come from the original file.",
    ],
    links: [{ href: "/settings/gallery", label: "Gallery settings" }],
    keywords: "preview quality blurry compression rendition resolution",
  },
  {
    id: "favorites-comments",
    product: "Client Gallery",
    title: "Favorites, comments and video timecode notes",
    summary: "See what your clients pick and what they say about it.",
    steps: [
      "Clients build favorite lists, add notes to a photo and can submit a list when they are done. Lists can carry a selection limit.",
      "Comments on photos show under each photo in the full screen view and in the collection's Activities tab.",
      "On a video, clients can pause and leave a comment pinned to that moment. The timecode shows next to the comment and clicking it jumps the video there.",
      "From a favorite list you can send the chosen photos to the client as a download.",
    ],
    links: [{ href: "/collections", label: "Collections" }],
    keywords: "favorites comments notes video timecode activities",
  },
  {
    id: "gallery-language",
    product: "Client Gallery",
    title: "Gallery language",
    summary: "Show the gallery's buttons and messages in your client's language.",
    steps: [
      "In Collection Settings, choose a gallery language: English, Spanish, French, German, Dutch, Chinese (Simplified), Portuguese or Swedish.",
      "The gallery interface (menus, buttons, download and favorites dialogs, password and registration pages) switches to that language.",
      "Your own content, such as the gallery name, set names and comments, is never translated.",
    ],
    links: [{ href: "/collections", label: "Collections" }],
    keywords: "language translate spanish french german dutch chinese portuguese swedish",
  },
  {
    id: "presets-bulk",
    product: "Client Gallery",
    title: "Presets, bulk edit and CSV import",
    summary: "Set up many galleries at once.",
    steps: [
      "Save any collection's settings as a preset, or build one from scratch under Presets. A preset can generate a fresh password for every gallery it creates.",
      "Select several collections to apply a preset to all of them and review the change summary.",
      "Volume photographers can import a CSV in Collections to create one gallery per row with its own password and PIN.",
      "Folders group collections, and a folder can get one share link that lists its published galleries.",
    ],
    links: [
      { href: "/collections/presets", label: "Presets" },
      { href: "/collections", label: "Collections" },
    ],
    keywords: "preset bulk csv import folder volume",
  },
  {
    id: "website-basics",
    product: "Website",
    title: "Build your website",
    summary: "A portfolio site with pages, a blog and its own design.",
    steps: [
      "Open Website to add and order pages (home, portfolio, about, pricing, contact and more).",
      "Design holds the template, palette, fonts, header style and spacing. Changes are a draft until you publish.",
      "SEO sets page titles and descriptions, checks image alt text and broken links, and manages redirects.",
      "Contact form messages arrive in the Website inbox.",
    ],
    links: [
      { href: "/website", label: "Pages" },
      { href: "/website/design", label: "Design" },
    ],
    keywords: "website pages blog seo design domain",
  },
  {
    id: "studio-booking",
    product: "Studio Manager",
    title: "Sessions and online booking",
    summary: "Let clients book and pay for sessions from your availability.",
    steps: [
      "Create session types with a length, price and deposit under Sessions.",
      "Set your weekly availability and blocked dates in Calendar. Mini sessions get their own dates and slots.",
      "Share the booking link. New bookings appear in Calendar and add the client to Contacts.",
    ],
    links: [
      { href: "/studio/sessions", label: "Sessions" },
      { href: "/studio/calendar", label: "Calendar" },
    ],
    keywords: "booking session calendar availability mini",
  },
  {
    id: "studio-documents",
    product: "Studio Manager",
    title: "Contracts, invoices and quotes",
    summary: "Send documents your clients sign and pay online, in your brand's colours and fonts.",
    steps: [
      "Write contract templates with merge fields, then send a contract to a contact for an online signature.",
      "Invoices support line items, tax, discounts and payment schedules. Quotes can be accepted online.",
      "Signed contracts and invoices take the palette and fonts from your website and Settings, Account, Brand.",
    ],
    links: [
      { href: "/studio/contracts", label: "Contracts" },
      { href: "/studio/invoices", label: "Invoices" },
      { href: "/settings", label: "Brand settings" },
    ],
    keywords: "contract invoice quote sign pay brand",
  },
  {
    id: "campaigns",
    product: "Studio Manager",
    title: "Email campaigns",
    summary: "Send print sales, mini session announcements and review requests.",
    steps: [
      "Open Studio Manager, Email campaigns and choose New campaign.",
      "Pick who receives it: everyone who opted in to marketing inside a gallery, your studio contacts, or the people registered on one collection. Duplicate addresses are sent once.",
      "Write the subject and message. {name} becomes the client's first name.",
      "Sending checks your plan's monthly campaign allowance first. If a campaign needs more sends than you have left, nothing is sent and you are told your allowance.",
      "Each campaign keeps a send log per recipient. When no email service is connected the log says the send was logged only.",
    ],
    links: [{ href: "/studio/campaigns", label: "Email campaigns" }],
    keywords: "campaign email marketing newsletter print sale mini session review quota allowance",
  },
  {
    id: "studio-automations",
    product: "Studio Manager",
    title: "Automations and the inbox",
    summary: "Reminders and follow ups that send themselves.",
    steps: [
      "Automations send emails on triggers such as a booking, an unpaid invoice or a session date.",
      "Every email to a client, including campaign sends and gallery invites, shows in the Studio inbox history.",
    ],
    links: [
      { href: "/studio/automations", label: "Automations" },
      { href: "/studio/inbox", label: "Inbox" },
    ],
    keywords: "automation reminder workflow inbox",
  },
  {
    id: "store-basics",
    product: "Store",
    title: "Selling prints and products",
    summary: "Sell from inside your galleries with your own prices.",
    steps: [
      "Build a price sheet with products and variants, then attach it to a collection.",
      "Clients choose Buy on any photo in the gallery. Coupons, gift cards, shipping methods and taxes are set up in the Store menu.",
      "Orders appear under Orders with their status. Print lab connections are shown as coming soon until a lab account is connected.",
    ],
    links: [
      { href: "/store/price-sheets", label: "Price sheets" },
      { href: "/store/orders", label: "Orders" },
    ],
    keywords: "store print sell order price sheet coupon gift card shipping tax",
  },
  {
    id: "editor-basics",
    product: "Photo Editor",
    title: "Editing photos",
    summary: "Adjust gallery photos in the browser without touching the original.",
    steps: [
      "Open Photo Editor and pick a photo from any collection.",
      "Adjust exposure, colour and crop. Saving writes an edited copy and keeps your original.",
      "The Pro Editor opens a photo in a full layered editor and saves back through the same flow.",
    ],
    links: [{ href: "/editor", label: "Photo Editor" }],
    keywords: "editor edit adjust crop exposure",
  },
  {
    id: "account-plan",
    product: "Account",
    title: "Plan, add ons and allowances",
    summary: "What your plan includes and how limits are counted.",
    steps: [
      "Settings, Plan shows each product's tier, what it includes and the add ons you can stack.",
      "Video hours and email campaign sends are metered by plan. Extra campaign blocks add 5,000 sends a month.",
    ],
    links: [{ href: "/settings/plan", label: "Plan" }],
    keywords: "plan billing upgrade add on limit allowance",
  },
  {
    id: "account-team",
    product: "Account",
    title: "Team members",
    summary: "Give assistants and second shooters their own login.",
    steps: [
      "Settings, Team invites a member by email with a role. The invite link creates their own login linked to your studio.",
      "Roles limit what a member can do, for example a second shooter can upload but not delete or see payments.",
    ],
    links: [{ href: "/settings/team", label: "Team" }],
    keywords: "team member assistant login role permission",
  },
  {
    id: "account-brand-email",
    product: "Account",
    title: "Brand and email sending",
    summary: "One brand everywhere, and real email when a sender is connected.",
    steps: [
      "Settings, Account, Brand sets your logo, brand colour and heading font. Galleries, store, booking pages, contracts and invoices use it.",
      "Settings, Emails shows whether email delivery is connected. Without it, emails are recorded in the app and marked as logged only.",
    ],
    links: [
      { href: "/settings", label: "Account settings" },
      { href: "/settings/emails", label: "Emails" },
    ],
    keywords: "brand logo colour font email resend sender",
  },
  {
    id: "support",
    product: "Account",
    title: "Contacting support",
    summary: "Ask a question without leaving the dashboard.",
    steps: [
      "Use the Support button at the bottom right of any dashboard page.",
      "Write your question and send it. It goes straight to the support inbox inside the app.",
      "Replies come by email to your account address, so keep an eye on your inbox.",
    ],
    links: [],
    keywords: "support help chat contact question",
  },
];

/** Case insensitive search over title, summary, steps and keywords. Every word must match. */
export function searchGuides(query: string, guides: HelpGuide[] = HELP_GUIDES): HelpGuide[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return guides;
  return guides.filter((g) => {
    const hay = `${g.product} ${g.title} ${g.summary} ${g.steps.join(" ")} ${g.keywords ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

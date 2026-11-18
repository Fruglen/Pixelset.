# Pixelset Replica — Build Spec

Source research: ~/workspace/research_notes/pixieset-full-feature-research-20261118-1055/report.md (read it for detail).

## Product
A 100% functional replica of Pixieset for photographers: one account, six product areas —
Client Gallery, Store, Website, Studio Manager, Photo Editor, Mobile Gallery App — plus a Suite
dashboard. Brand it "Pixelset" in the UI (working replica; owner will direct next steps).

## Hard exclusion (owner's direct order)
NO photo cloud-storage product: no storage tiers, no storage paywall, no storage upsells.
Galleries hold photos via local upload or external URL (owner uses Picflow for his own storage).
Everything else is in scope, A to Z.

## Stack (decided)
- Next.js 14 App Router + TypeScript + Tailwind CSS, single app.
- Prisma + SQLite (file db) so it runs anywhere with zero config; models designed to port to Postgres.
- Auth: email/password with hashed passwords, session cookie. Two user kinds: Photographer (dashboard) and Client (gallery access by link/password/PIN).
- All money in USD cents. Dates local timezone aware.
- Must `npm run build` clean and run with `npm run start`. Seed script creates a demo photographer
  (demo@pixelset.app / demo1234) with sample collections, a website, session types, products, an invoice and a contract.

## Design language (match Pixieset)
- Clean editorial, image-first, lots of white space. Photographer dashboard: left sidebar with the six
  product areas, top bar, card-based lists. Client-facing pages: elegant serif display headings +
  clean sans body, customizable per collection/site (fonts + palettes below).
- Gallery design settings: 7 cover styles, photo or video (YouTube/Vimeo) cover, focal point,
  6 font pairings, 9 color palettes, Vertical/Horizontal grid, thumbnail size + spacing controls.

## Phase 1 — Core + Client Gallery
- App scaffold, auth, photographer dashboard shell with sidebar (Dashboard, Client Gallery, Store, Website, Studio Manager, Photo Editor, Mobile App, Settings).
- Collections (galleries): create flow (name, date, URL slug), Photo Sets inside a collection,
  photos (upload to /public/uploads or add by URL), per-collection tabs: Photos / Collection Settings / Activities.
- Collection settings: Design (cover style, cover photo, fonts, palette, grid, thumbnail size/spacing),
  Privacy (collection password, per-set Client Exclusive Access, email registration gate, per-photo private),
  Download (on/off, 4-digit PIN with use limits, free-download cap, sizes: Original / High-Res 3600px / Web 2048 / 1024 / 640, single download + Download-All),
  Expiry (auto-hide at date 11:59pm local + reminder flag), Status: Draft / Pre-release / Published.
- Client gallery view: cover, sets navigation, grid, lightbox, Favorite Lists (multiple, per-photo notes,
  selection limits), comments per photo, download flows honoring PIN/caps, watermark overlay toggle on previews.
- Share: invite by email (stored + shown as sent in Activities), copy link, QR placeholder, Quick Share Link.
- Activities log per collection (views, favorites, downloads, comments).
- Folders to organize collections. Collection Presets (save settings as preset, apply on create).

## Phase 2 — Website
- Website builder with Flex-style block editor: 30+ blocks (hero, gallery, text, image+text, pricing,
  testimonials, contact form, booking embed, blog list, FAQ, divider, video, etc.).
- Templates (build at least 8 full templates in Pixieset's named families: Berlin, Vienna, Sedona, Onyx,
  Marlow, Montana, Oslo, Jennifer) as preset page/block/font/palette bundles the user can switch between.
- Pages: Home, Portfolio, About, Experience, Pricing, Reviews, Blog, Contact + Client Area.
  Blog with posts editor; template switch keeps blog content.
- Site settings: logo, 40 palettes / font themes (subset fine: 12 palettes, 12 font themes), custom domain
  field, free subdomain yourname.mypixieset.com style routing (/site/[slug]), SEO manager
  (title/description per page, 301 redirect list, sitemap.xml route, image alt text).
- Public rendering of the site with photographer's branding applied consistently.

## Phase 3 — Studio Manager
- Session Types: name, duration, buffer, cancellation policy, price, add-ons, location/Zoom link.
- Booking Site: public page listing session types; booking flow picks date/time, fills questionnaire,
  signs contract if attached, pays deposit/full (mock payment states), confirmation screen + emails logged.
- MINI SESSIONS: create with duration, add one or more dates (start time, spots, breaks), slots auto-generated,
  publish toggle, direct link, duplicate a mini session, show/hide booked spots, waitlist.
- Calendar view of bookings; Google Calendar sync shown as a settings toggle (state only).
- Contracts: templates with smart fields (client name, date, session type, price), send, client e-sign
  (type/draw name), second signer, expiry, scheduled send, signed PDF-style view.
- Invoices: line items, tax, discount, tips, payment schedules up to 12 instalments, payment links,
  statuses (draft/sent/paid/overdue), Tap to Pay noted. Quotes that convert to invoice draft on acceptance.
- Questionnaires: builder (text, textarea, choice, date fields), attach to session types, responses stored.
- Contacts (CRM): clients list, CSV import (file parse), per-client history (bookings, invoices, galleries).
- Projects board: kanban (Inquiry, Booked, In Progress, Delivered, Complete) fed by bookings.
- Inbox: messages from contact/booking forms in one list.
- Payments settings: Pixieset-Payments-style (Stripe-powered, 2.9% + $0.30 shown), own Stripe, PayPal,
  manual — as settings with mock connect states.

## Phase 4 — Store, Editor, Mobile App, Extras
- Store: price sheets (assign per collection), products: prints (sizes), canvas/metal/acrylic/wood,
  albums/books, cards, digital downloads (expiring 7-day link + license text). Self-fulfillment products
  with variations + shipping options. Lab fulfillment shown as WHCC-style automatic option (mock).
- Cart + checkout (mock payment), coupons (% off, $ off, free shipping, free product), gift cards,
  automatic tax toggle, order management list with fulfillment statuses.
- Client store view inside a gallery (buy prints of the photo you're viewing, packages).
- Photo Editor: browser editor with filters/adjustments (brightness, contrast, saturation, crop presets)
  applied via canvas, save as copy.
- Mobile Gallery App: per-client installable web app page (manifest + add-to-homescreen prompt,
  app icon from cover photo), photographer can create apps for clients (list, 3 free then unlimited note).
- EXTRA features photographers request (build these, they are the point):
  1. Workflow automations WITH conditions (if invoice unpaid 3 days -> reminder; if gallery viewed but
     no favorites in 7 days -> nudge email; if contract unsigned 48h -> resend). Rule builder + run log.
  2. Slideshow with music for galleries (track list, play mode in client view).
  3. Bulk export: export all data (clients, invoices, bookings) as CSV/JSON; gallery photo list CSV for Lightroom.
  4. Reporting dashboard: revenue, bookings, gallery views, conversion — charts from real data.
  5. Team roles: Owner / Assistant / Second Shooter with permission levels (settings page + enforcement on delete/pay actions).
  6. Customizable reminder emails (edit templates, not just presets).
- Pricing pages replicating Pixieset's tier structure (Gallery / Website / Studio Manager / Suite tables)
  as product pages in Settings > Plan (display only, all features unlocked in the replica).

## Quality bar
- Every flow above must actually work end to end with the seeded demo account.
- `npm run build` must pass. No placeholder pages for in-scope features; if a sub-feature must be
  simplified, note it in BUILD-NOTES.md with what was simplified and why.
- Write BUILD-NOTES.md per phase: what was built, routes, how to run, simplifications.

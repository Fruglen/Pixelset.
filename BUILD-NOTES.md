# Pixelset — BUILD NOTES

## Phase 1 — Core platform + Client Gallery (2026-11-18)

### How to run
```bash
npm install          # also runs `prisma generate`
npm run db:push      # creates prisma/dev.db (SQLite)
npm run seed         # demo photographer + sample data
npm run build
npm run start        # http://localhost:3000
```

Demo login: **demo@pixelset.app / demo1234**

Seeded galleries:
- `/g/emma-james-wedding` — published; gallery password `tuscany`; download PIN `4821` (50-use limit); free-download cap 20; 4 sets incl. a **Client Exclusive** set (`emma@example.com` / `family2026`); one private photo; favorite list with notes; a comment; invite + download history in Activities.
- `/g/emma-james-wedding?qs=demoquickshare01` — Quick Share Link (curated 3-photo selection, bypasses the password).
- `/g/rivera-family-fall` — **Pre-release** (email capture page); email-registration gate + watermark enabled for when it publishes.
- `/g/northline-coffee-brand` — Draft (hidden from clients; owner sees a preview banner).

### What was built
**Stack**: Next.js 14 App Router + TypeScript + Tailwind CSS + Prisma + SQLite (`file:./dev.db`). All interactive mutations go through JSON/multipart API route handlers; pages are server components.

**Core platform**
- Email/password auth (scrypt hashes, DB-backed session + httpOnly cookie): `/signup`, `/login`, logout; `/` redirects by session.
- Photographer dashboard shell: left sidebar with the six product areas (Dashboard, Client Gallery, Store, Website, Studio Manager, Photo Editor, Mobile App) + Settings; top bar with identity + sign out. Store/Website/Studio/Editor/Mobile App are explicit "arriving in Phase N" cards (those products are later phases, not Phase 1 scope).
- Dashboard home: live stats (collections, photos, gallery views) + recent collections + latest activity feed.
- Account settings: name, business name, watermark text, password change.

**Client Gallery (photographer side)**
- Collections: create flow (name, event date, custom URL slug w/ uniqueness + auto-suffix), card grid with cover thumb + status badge, delete (also removes uploaded files).
- Folders: create/delete in a sidebar, per-card move-to-folder, filtered counts.
- Collection Presets: "Save as Preset" from any collection's settings (captures Design + Privacy + Download + Expiry defaults per `PRESET_FIELDS`), preset picker in the create modal (PIN presets auto-generate a fresh 4-digit PIN), presets page (list summary chips, rename, delete).
- Photo Sets: add/rename/delete, per-set **Client Exclusive Access** (client email + access password).
- Photos: multi-file upload to `public/uploads/<collectionId>/` (dimensions read via sharp) **and** add-by-URL (external photos, owner uses his own storage — per the hard exclusion there is no storage product). Per-photo actions: set as cover, Private toggle, move between sets, delete. Checkbox multi-select feeds Quick Share.
- Per-collection tabs: **Photos / Collection Settings / Activities** with a header (public-view link, status, photo count).
- Collection Settings:
  - *Design*: 7 cover styles (Classic, Novel, Frame, Stripe, Journal, Divider, None) with visual pickers, cover photo picker, YouTube/Vimeo video cover, focal-point sliders, 6 font pairings, 9 color palettes, Vertical/Horizontal grid, thumbnail size, grid spacing, live palette/type preview.
  - *Privacy*: collection password, email-registration gate, watermark-previews toggle (per-set exclusive + per-photo private live on the Photos tab).
  - *Download*: master toggle, 4-digit PIN (auto-generated on save when enabled) with use limit + live use count, free-download cap per client, size offering (Original / High-Res 3600px / Web 2048 / 1024 / 640), single-download and Download-All toggles.
  - *Expiry*: date (hides at 11:59 pm local), reminder flag, expired-state warning.
  - *Status*: Draft / Pre-release / Published cards.
- Share: email invite (stored, listed as sent, logged in Activities), copy direct link, QR placeholder, **Quick Share Links** (tokenized curated selections with copy buttons).
- Activities tab: filterable log (All / Views / Favorites / Downloads / Comments / Email registrations / Invites), registered-emails export block.

**Client gallery (client side)** — themed per collection via CSS variables (palette + font pairing):
- Status gates: draft → "not available"; pre-release → email registration ("notify me") page; expired → expiry notice; owner always previews with a banner.
- Access gates: collection password (HMAC-signed per-collection cookie), email-registration gate (stores address + Activity), Client Exclusive unlock (email + password reveals exclusive sets).
- Cover rendering in all 7 styles with focal point; video cover via YouTube/Vimeo embed.
- Sets navigation bar, All view, vertical (masonry columns) / horizontal (rows) grid honoring thumbnail size + spacing.
- Lightbox: keyboard arrows/escape, counter, favorite + download actions, per-photo comment sidebar, favorite-note editing.
- Favorite Lists: multiple lists per client (identified by email; "Who's choosing?" prompt), optional selection limits (enforced server-side), per-photo notes, remove, drawer with list switching; favoriting auto-creates a first list.
- Comments per photo (name + email attribution, logged to Activities).
- Downloads: size picker limited to offered sizes, PIN prompt when enabled (use-limit enforced + counted), free-download cap per client (distinct photos, by registered email or anonymous cookie key), single-photo download (sharp-resized JPEG for capped sizes) and Download All as ZIP (jszip; external URLs fetched, misses listed in `_missing-files.txt`), everything logged to Activities + DownloadLog.
- Watermark: when enabled, previews/lightbox carry a diagonal text overlay (photographer's watermark text); downloads are clean.
- View logging once per gallery open (skips owner).
- Quick Share mode: `?qs=<token>` shows only the curated photos, bypasses password/email gates, hides favorites, allows single downloads per settings.

### Routes
- Pages: `/`, `/login`, `/signup`, `/dashboard`, `/collections`, `/collections/presets`, `/collections/[id]` (+ `/settings`, `/activities`), `/store`, `/website`, `/studio`, `/editor`, `/mobile-app`, `/settings`, `/g/[slug]`.
- API: `auth/{login,signup,logout}`, `account`, `collections` (+ `[id]`, `[id]/sets`, `[id]/photos`, `[id]/invite`, `[id]/quick-share`), `sets/[id]`, `photos/[id]`, `folders` (+ `[id]`), `presets` (+ `[id]`), `gallery/[slug]/{unlock,view,favorites,comments}`, `gallery/lists/[id]/{toggle,note}`, `download`.

### Simplifications (and why)
- **QR code** is a labeled placeholder box (spec says "QR placeholder").
- **Watermark** is a CSS text overlay on previews, not a server-side composite; downloads are always clean (Pixieset lets you watermark web-size downloads — skipped; noted for a later pass).
- **Invites** are stored + logged as sent; no real SMTP sending (no mail infrastructure in scope).
- **External (add-by-URL) photos** are served/zip-fetched at download time; if the remote host is unreachable the ZIP lists them in `_missing-files.txt` instead of failing.
- **Expiry reminder** is a stored flag (shown in settings); there is no background mailer to send it (same reason as invites).
- **Free-download cap** counts distinct single-photo downloads per client key (registered email, else anonymous cookie); Download-All does not consume the cap but does consume a PIN use.
- **Seed** covers Phase 1 entities only; the spec's seeded "website, session types, products, invoice, contract" belong to Phases 2–4 models that don't exist yet and will be added to the seed in those phases.
- **Gallery Assist onboarding cards** and multi-language galleries: not built in Phase 1 (not in the Phase 1 spec list).

### Build status (verified 2026-11-18)
- `npm run build`: **PASSING** — "Compiled successfully", type check clean, 23 static pages + all dynamic routes generated (40 routes total: 15 pages incl. `/g/[slug]`, 25 API handlers).
- `npm run start`: verified serving; full smoke test run against the production server:
  login/signup/session ✓, dashboard + all tabs render ✓, draft/pre-release/expired/password/email gates ✓ (wrong password rejected), identify-by-email ✓, favorite list with selection limit enforced server-side ✓ ("allows at most 2 selections"), per-photo note ✓, comment ✓, download PIN required/wrong-PIN rejected/correct-PIN serves resized 640px JPEG ✓, PIN use count increments ✓, size-not-offered rejected ✓, free-download cap blocks distinct photos past the cap ✓, Download All ZIP contains exactly the visible photos (excludes private + locked exclusive sets) ✓, Quick Share link bypasses gates and shows only the curated photos ✓, Client Exclusive unlock reveals the hidden set (and stays hidden for other viewers) ✓, multipart upload to `/public/uploads/<collectionId>/` ✓, add-by-URL ✓, create-from-preset applies settings + generates a fresh PIN ✓, folders create/move/delete ✓, collection delete ✓, invites + activities log categorize correctly ✓.

### Environment notes (sandbox/proxy quirks — not app issues)
- This build machine sits behind a TLS-intercepting egress proxy. Prisma's engine downloader does not trust the proxy's CA, so `npm install` was run with `--ignore-scripts` and the two engines (`libquery_engine-debian-openssl-3.0.x.so.node`, `schema-engine-debian-openssl-3.0.x`) were fetched via curl into `node_modules/@prisma/engines/` and `node_modules/prisma/`. On a normal machine, plain `npm install` works (or set `NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt`).
- `dev`/`start` scripts set `NODE_USE_ENV_PROXY=1` (Node ≥24) so server-side `fetch` of external photo URLs honors `HTTPS_PROXY` when present; it is a no-op without a proxy.
- Seed photos are generated locally with sharp (SVG gradients → JPEG, mixed orientations) so the demo is fully self-contained and downloads are instant; the draft collection keeps external picsum URLs to demonstrate the add-by-URL path.

## Phase 2 — Website (2026-11-18)

### How to run
Same as Phase 1 (`npm run db:push` then `npm run seed` picks up the new models). Demo site after seeding: **/site/light-and-shadow** (Vienna template, published). Dashboard: Website in the sidebar.

### What was built
**Block-based website builder** (Flex-style)
- **40 block types** in a central registry (`src/lib/blocks.ts`), grouped into 9 categories: Hero (hero, split hero, slideshow), Text (section heading, text, pull quote, text columns, feature list), Images (image, image+text, image row, video), Galleries (grid, masonry, film strip, live collection embed, pair), Business (pricing packages, comparison table, services, timeline, numbers, team, FAQ, featured-in, CTA), Social proof (testimonials, featured testimonial, star reviews, Instagram strip), Forms (contact form, booking inquiry, newsletter), Dynamic (blog posts, client gallery access, location map, social links), Layout (divider, spacer, button). Each block declares a typed field schema (text/textarea/number/toggle/select/image/item-lists) that drives both the editor forms and the SEO image audit generically.
- **Page editor** (`/website/pages/[id]`): block list with expand-to-edit forms, move up/down, duplicate, delete, insert-below, add-block modal grouped by category, per-page title/slug editing, Preview link, explicit Save (PATCH of the whole block array). Image fields offer paste-a-URL **or a photo picker over the photographer's own gallery photos** (`/api/website/photos`).
- **Dynamic blocks query live data at render time**: `blogList` (published posts), `clientGalleries` (published, non-expired collections with covers, linking to `/g/<slug>` — this is the Client Area), `collectionEmbed` (photos pulled from one of the user's collections, excluding private photos and Client-Exclusive sets).

**Templates** — 8 full bundles in Pixieset's named families (`src/lib/templates.ts`): **Berlin** (bold typographic, minimal header), **Vienna** (elegant ivory serif), **Sedona** (warm desert split-hero), **Onyx** (dark slideshow hero), **Marlow** (airy blush family studio), **Montana** (rustic stacked-logo), **Oslo** (Scandinavian dove-gray), **Jennifer** (personal brand, script logo). Each bundle = palette + font theme + header style + all 9 pages (Home, Portfolio, About, Experience, Pricing, Reviews, Blog, Contact, Client Area) with distinct block compositions and copy. Switching templates (Design tab, with confirm) rebuilds the page set and applies the template's design; **blog posts live in their own table and survive the switch**, and per-page SEO fields are preserved by page type (verified in the smoke test: Vienna → Berlin → Vienna round trip kept the posts and SEO titles).

**Pages**: the 9 standard pages plus user-created **custom pages** (`POST /api/website/pages`), reorderable (up/down → order array PATCH), hideable from nav (still reachable by URL), renameable/re-sluggable (Home and Blog slugs are locked), deletable except Home.

**Blog**: posts list + editor (`/website/blog/[id]`) with title, slug, excerpt, cover URL + alt, draft/publish toggle (publishedAt set on first publish), SEO title/description, and a minimal body format (blank line = paragraph, `## ` = heading, `> ` = pull quote) rendered on the public post page. Drafts render for the owner only (with a draft banner).

**Site settings** (Design + Settings tabs): logo text / logo image URL / tagline, **12 palettes** and **12 font themes** (spec allows a 12/12 subset of Pixieset's ~40; web-safe stacks, no external font loading), 4 header layouts, publish/unpublish, free-subdomain slug (uniqueness-checked, rendered at `/site/<slug>` — the yourname.mypixieset.com equivalent), custom-domain field (display + used as the sitemap base URL; real DNS is out of scope), footer text, social links, delete-website danger zone.

**SEO manager** (`/website/seo`): per-page title tag + meta description with a Google-style result preview (fed into `generateMetadata` on the public pages), **image alt-text audit** (every image across every page's blocks, with missing-alt counts and inline editing that writes back into the block JSON), **redirect list** (add/remove `/old → /new-or-absolute-URL`), and a link to the generated **`/site/<slug>/sitemap.xml`** (visible pages + published posts, custom domain used as base when set, 404 while unpublished).

**Public rendering** (`/site/[slug]`, `/site/[slug]/<page>`, `/site/[slug]/blog/<post>`): full theming via CSS variables (palette + font theme), 4 header styles, footer with nav/socials/custom domain, working contact / booking-inquiry / newsletter forms that POST to `/api/site/[slug]/contact` and land in the **Inbox tab** (filterable by kind, unread badge in the tabs, open-to-mark-read, reply-by-mailto, delete). Unpublished sites 404 for visitors while the owner gets a preview banner (same pattern as draft galleries).

**Placeholder imagery**: `/api/placeholder` generates deterministic SVG art (size/hue/label/variant params) so all 8 templates ship fully "photographed" offline; users swap in their own URLs or gallery photos.

**Seed additions**: demo website on Vienna at `/site/light-and-shadow` — tagline, custom domain, socials, Home SEO fields, Portfolio's collection embed pointed at the seeded wedding gallery, 3 published blog posts (with locally generated cover images), the `/investment → /pricing` redirect, and 3 inbox messages (contact, booking, read newsletter signup).

### Routes added
- Pages: `/website` (pages list / create-with-template flow), `/website/pages/[id]`, `/website/design`, `/website/blog`, `/website/blog/[id]`, `/website/seo`, `/website/messages`, `/website/settings`, `/site/[slug]`, `/site/[slug]/[...path]` (pages, blog posts, redirects), `/site/[slug]/sitemap.xml`.
- API: `website` (POST/PATCH/DELETE), `website/template`, `website/pages` (+ `[id]`), `website/blog` (+ `[id]`), `website/redirects` (+ `[id]`), `website/photos`, `website/messages/[id]`, `site/[slug]/contact`, `placeholder`.

### Simplifications (and why)
- **301 redirects are served as 308 Permanent Redirect** — Next's `permanentRedirect()` in a page emits 308; semantically equivalent (permanent, cacheable) and the only way to redirect from the catch-all route without an edge middleware + DB (Prisma can't run in edge middleware). Verified: `/investment` → 308 → `/pricing`.
- **Subdomain routing is path-based** (`/site/<slug>`) exactly as the spec specifies; no Host-header rewriting. The custom-domain field is stored, shown in the footer, and used as the sitemap base, but DNS connection is display-only.
- **Editor is a structured block editor, not drag-and-drop WYSIWYG**: ordered block cards with schema-driven forms + one-click Preview of the real rendered page. All Flex concepts (add/reorder/duplicate/configure blocks) are covered.
- **Template previews** in the pickers are typographic palette cards, not screenshots (no headless browser in the build environment to capture real thumbnails).
- **Instagram strip block** is manual images + handle link (no real Instagram API).
- **Booking embed block** is a working inquiry form (session type + preferred date → Inbox); it will embed the real scheduler when Studio Manager lands in Phase 3, and its submissions are already stored as BOOKING messages Phase 3's inbox can consume.
- **Blog body** uses the minimal 3-rule text format above rather than a rich-text editor — keeps posts portable plain text; noted as a candidate for later polish.
- **Fonts** remain web-safe stacks (no Google Fonts fetch) — consistent with Phase 1 and the proxied build environment.

### Build status (verified 2026-11-18)
- `npm run build`: **PASSING** — compiled successfully, types clean, 35 static pages + all dynamic routes (61 routes total).
- Smoke-tested against `npm run start` (production server): all 9 public pages + blog post + sitemap 200 ✓; unknown site 404 ✓; redirect 308 with correct target ✓; placeholder SVG ✓; contact POST stored + invalid email rejected ✓; photo picker lists gallery photos ✓; blog create → publish → live at `/blog/smoke-post` ✓; redirect add via API immediately live ✓; block PATCH renders on the public page + SEO title in `<title>` ✓; custom page create live at its slug ✓; template switch Vienna→Berlin rebuilt pages (Berlin hero live) while blog post stayed live and About's SEO title survived, then switched back ✓; unpublish → anonymous 404 / owner 200 with banner / sitemap 404, republish ✓; slug change moves the site to the new address ✓; all 7 dashboard website screens 200 ✓; message mark-read ✓; fresh-user signup → create website (Oslo) → live site, duplicate create rejected ✓. Test data cleaned up and reseeded (1 website / 9 pages / 3 posts / 3 messages).

## Phase 3 — Studio Manager (2026-11-18)

### Recovery note
Phase 3 had been started before a machine restart: the Prisma models (StudioProfile → StudioMessage), `src/lib/studio.ts` (money/totals, invoice status derivation, retainer math, smart-field renderer, slot generator, lazy scheduled-send flip, quote→invoice conversion) and all 30 `/api/studio/*` + `/api/sign/[token]` route handlers already existed and were inspected route-by-route — all sound, all kept unchanged (one addition: the booking endpoint now also returns the rendered contract body for the in-flow signing step). Everything else below (public booking APIs + pages, the entire dashboard UI, the unified inbox, settings, seed data) was built in this pass.

### How to run
Same as before (`npm run db:push`, `npm run seed`). Demo studio after seeding:
- Dashboard: **Studio Manager** in the sidebar (`/studio`).
- Public booking site: **/book/light-and-shadow** — Full Wedding Coverage ($3,800, 30% retainer, contract + questionnaire), Portrait Session ($450, $150 fixed retainer), free Zoom Consultation Call, and **Holiday Mini Sessions** (published, 2 dates × 8 auto-generated 15-min slots with a mid-morning break, 1 spot each, waitlist on, 1 slot already booked).
- Seeded records: 4 contacts (Emma James with 2 notes), a **SIGNED** contract (full e-sign capture: typed name, timestamp, IP, user-agent), a SENT contract awaiting a second signer, **INV-0001** (SENT, 3 instalments, retainer paid → shows PARTIALLY PAID), **QT-0001** (SENT quote with a discount), 5 project cards across 4 kanban stages, and 4 inbox entries.

### What was built
**Session Types** (`/studio/sessions`, editor at `/studio/sessions/[id]`): name/description/cover URL, duration + buffer, price + tax rate, In-person/Zoom location, cancellation policy, **payment schedule with retainer** (none / percent / fixed / full — collected in the booking flow), **add-ons** (name, price, description), contract template + questionnaire attachment, show/hide on the booking site, duplicate, delete.

**Mini Sessions**: a session type flagged mini with **multiple dates — each with start time, slot length, slot count, spots per slot, and breaks (every N slots, M minutes)**; slots are **auto-generated** server-side (and re-generated on date edit, blocked once bookings exist). **Publish flow** gates the **direct booking link** (copyable; unpublished minis 404 for clients and are hidden from the booking site). Show/hide remaining spots and per-slot **waitlist** toggles. **Duplicating** a mini copies add-ons and all dates with fresh unbooked slots, starting unpublished. The editor shows every slot's booked/capacity (+waitlist count) with client names on hover.

**Public booking flow** (`/book/[slug]` → `/book/[slug]/[typeId]`): booking-site landing listing minis + sessions with prices and retainer labels; then a stepper — **pick a date → pick a slot** (minis; full slots offer "join waitlist" when enabled, spots-left respects the show-booked-spots setting) or date+time picker (regular sessions) → **details** (contact info, add-on selection, attached **questionnaire** rendered from its field schema with required-field enforcement, live price summary) → **sign the contract** if the session type has one (smart fields rendered against the real booking at creation; typed signature + agree checkbox → the same `/api/sign` endpoint, capturing timestamp/IP/UA) → **retainer payment placeholder** (card via "Pixelset Payments (Stripe-powered)", PayPal, or manual per the settings display toggles; mock charge flips the booking to RETAINER_PAID or PAID) → **confirmation screen** with the summary. Bookings upsert the contact, store the questionnaire response, create a Projects card, and log BOOKING/WAITLIST + confirmation-EMAIL entries to the inbox.

**Calendar** (`/studio/calendar`): month grid (`?month=YYYY-MM` navigation, today highlight, per-day booking chips color-coded by status) + an upcoming list with inline status/payment dropdowns, one-click invoice-from-booking, delete, and a **manual booking modal** (session type or custom, existing contact or new client). Waitlist→CONFIRMED promotion is blocked server-side while the slot is full. Google Calendar sync shown as a settings state.

**Contracts** (`/studio/contracts`): template library (create seeds a standard photography agreement; editor at `/studio/contracts/templates/[id]` with a click-to-insert **smart-field palette** — client/session/price/retainer/business/today tokens) and a contracts list with derived statuses (DRAFT / SCHEDULED / SENT / AWAITING SECOND / SIGNED / EXPIRED). Contract editor: body/title editing (locked after signing), contact assignment, **expiry date**, **scheduled send** (flips to SENT lazily when its time passes — verified), **second signer email**, send/revert actions, copyable signing link, and a signatures panel showing both signers' typed names, timestamps, IPs and user-agents. Public `/sign/[token]` renders a **PDF-style document** with signature blocks and the e-sign form (first signer, then second).

**Invoices** (`/studio/invoices`, editor at `/studio/invoices/[id]`): line items, tax, percent/fixed discount, tips (recorded from client payments), due date, notes, statuses **DRAFT / SENT / PARTIALLY PAID / OVERDUE / PAID** (overdue + partial derived from instalments), send (logs the email with the payment link), mark-paid, revert-to-draft. **Payment schedules up to 12 instalments** (13 rejected server-side) with split-into-N helper, per-instalment paid checkboxes, and schedule-vs-total reconciliation hint. Public **`/pay/[token]`** page: itemized invoice, instalment list with sequential mock payment (earlier instalments first), method choice from the enabled toggles, optional tip; the invoice flips to PAID automatically when the last instalment clears.

**Quotes**: same editor shape (`/studio/quotes/[id]`), valid-until date, send → public **`/quote/[token]`** where the client **accepts (auto-converts into a draft invoice, QT→INV linked both ways) or declines**; photographer can also convert manually. Accept/decline/expiry guards verified.

**Questionnaires** (`/studio/questionnaires`): builder with text / long-text / choice / date fields, required flags, reorder, options editing; attach to session types; responses collected in the booking flow and listed per questionnaire (expandable answers) and on the contact.

**Contacts / CRM** (`/studio/contacts`): searchable list with **tag** chips + tag filter, create modal, **CSV import** (file upload or paste; header mapping incl. first/last name, duplicate-email skip — verified 2 imported / 1 skipped), auto-creation from bookings. Detail page: fields + tags, timestamped **notes** (add/delete), and full history — bookings, invoices & quotes, contracts, questionnaire responses, plus galleries the contact's email registered for or favorited in (bridges Phase 1).

**Projects** (`/studio/projects`): kanban across **Inquiry / Booked / In Progress / Delivered / Complete** with HTML5 drag-and-drop between columns (plus arrow buttons), create modal, delete; **bookings file themselves under Booked automatically** (public flow, manual bookings, and waitlist promotions).

**Inbox** (`/studio/inbox`): unified list merging StudioMessages (bookings, waitlist, signed contracts, payments, quote responses, logged outbound emails) **with the Phase 2 website's form submissions** (contact/booking/newsletter — the Phase 2 booking-inquiry block's messages appear here as promised in the Phase 2 notes), kind filters, unread badge on the tab (counts studio unread + website booking unread), open-to-mark-read via the right API per source, reply-by-mailto, delete.

**Settings** (`/studio/settings`): booking link slug (uniqueness-checked), welcome text, Google Calendar sync toggle (state only, per spec), business details (email/phone/address/tax ID/default tax rate applied to new invoices and quotes), and **payments**: Pixelset Payments (Stripe-powered, "2.9% + $0.30" shown), own-Stripe-account, PayPal, and manual instructions — each with mock connect/disconnect state, plus **display toggles** controlling which methods client pay pages offer (verified end-to-end).

### Routes added
- Dashboard pages: `/studio` (overview with stats + next-up + quick actions), `/studio/{sessions,calendar,contacts,contracts,invoices,questionnaires,projects,inbox,settings}`, `/studio/sessions/[id]`, `/studio/contacts/[id]`, `/studio/contracts/[id]`, `/studio/contracts/templates/[id]`, `/studio/invoices/[id]`, `/studio/quotes/[id]`, `/studio/questionnaires/[id]`.
- Public pages: `/book/[slug]`, `/book/[slug]/[typeId]`, `/sign/[token]`, `/pay/[token]`, `/quote/[token]`.
- New API routes this pass: `book/[slug]` (public booking), `book/[slug]/pay` (retainer mock payment), `pay/[token]` (invoice mock payment), `quote/[token]` (accept/decline), `studio/messages/[id]` (inbox read/delete). Pre-existing from the interrupted session (kept): `studio/{profile,session-types(+[id],addons,dates,duplicate),addons/[id],dates/[id],bookings(+[id]),contacts(+[id],notes,import),notes/[id],contract-templates(+[id]),contracts(+[id]),invoices(+[id]),quotes(+[id],convert),questionnaires(+[id]),projects(+[id])}`, `sign/[token]`.

### Simplifications (and why)
- **Payments are mock throughout** (per spec: "mock payment states") — pay endpoints flip states and log receipts; no processor is contacted. Tap to Pay is a note on invoices, Pixieset-style.
- **Regular-session scheduling is an open date picker + half-hour time select (8:00–19:00)**, not an availability engine — Pixieset's working-hours/conflict calculus is out of scope; buffer time is stored and shown. Minis (the headline scheduling feature) have real capacity enforcement.
- **E-sign is typed-name only** (no draw-pad): spec says "type/draw name" — typed was chosen; the capture record (name, timestamp, IP, UA) matches the spec fully. The "signed PDF-style view" is the styled `/sign` document page, not a generated PDF file.
- **Scheduled sends / overdue flips are lazy** (computed on page load / derived at read time) — no cron in this stack; same pattern as gallery expiry in Phase 1.
- **Emails are logged, not sent** (booking confirmations, invoice/quote sends) — consistent with Phase 1's invite decision; they appear in the inbox as "Sent email" entries.
- **Kanban ordering within a column** is append-on-move; fine-grained intra-column reordering wasn't built (stage moves are what the spec asks for).
- **Google Calendar sync** is a settings toggle (state only), exactly per spec.

### Build status (verified 2026-11-18)
- `npm run build`: **PASSING** — compiled successfully, types clean, 55 static pages + all dynamic routes (84 routes total incl. 18 new studio pages and 5 public studio pages).
- Full smoke test against `npm run start` (production server), 32 checks: all 10 studio tabs + all editors 200 ✓; booking site 200 / unknown slug 404 ✓; mini booking on a free slot (totals + FULL retainer computed, contact upserted, project card created, BOOKING + EMAIL logged) ✓; mock pay → PAID ✓; same slot again → waitlisted (WAITLIST entry logged, kept off the board) ✓; waitlist promotion blocked while full, allowed after cancelling the holder ✓; wedding booking with add-on + questionnaire answer → contract returned with **all smart fields resolved (0 unresolved tokens)** ✓; sign without agreeing rejected, proper sign captures forwarded IP + UA ✓; retainer pay → RETAINER_PAID (30% of $4,600.63 = $1,380.19) ✓; already-signed re-sign rejected ✓; invoice instalment 2 paid → PARTIAL, double-pay rejected, final instalment + $50 tip → invoice PAID with tip recorded ✓; quote accept → ACCEPTED + draft INV-0002 created from it ✓; second-signer contract: first sign `complete:false`, second sign → SIGNED with both names ✓; new mini via API + date with `breakEvery:3/breakMin:30` → 6 slots with the 30-min gap in the right place ✓; duplicate → fresh slots, unpublished ✓; CSV import with header mapping + dupe-skip ✓; kanban stage PATCH ✓; scheduled contract flipped to SENT by visiting the contracts page ✓; template smart fields prefilled from the chosen contact ✓; unified inbox shows the Phase 2 website booking message ✓; studio message mark-read ✓; payment display toggle persists ✓; manual booking → project card + prefilled invoice (INV-0003) ✓; 13-instalment schedule rejected ✓; past-date and bad-email bookings rejected ✓. Test data cleared by reseeding; all seeded studio entities verified present after reseed (4 session types, 16 slots, 4 contacts, 2 contracts, 1 invoice, 1 quote, 5 projects, 4 messages).

## Phase 4 — Store, Photo Editor, Mobile Gallery App, Extras, Pricing (2026-11-18)

### How to run
Same as before: `npm install` → `npm run db:push` → `npm run seed` → `npm run build` → `npm run start`.
Phase 4 seed additions (demo@pixelset.app / demo1234):
- **Store**: WHCC-style automatic price sheet "Wedding Collection Store" assigned to `/g/emma-james-wedding` (Fine Art Print 5 sizes, Gallery-Wrapped Canvas, Heirloom Album, self-fulfilled Signed Artist Print, Digital Download), coupons **PRINTS10** (10% off) + **FREESHIP** (min $50), gift card **GC-DEMO-2026** ($50), order **ORD-0001** (PROCESSING, mixed fulfillment, live 7-day digital download link `demodownload0001`).
- **Mobile app** at `/app/emma-james`; slideshow music URL on the wedding gallery.
- **2 automations** (unpaid-invoice reminder with a logged run; contract signature chaser), **2 team members** (Assistant + Second Shooter), a **customized invoice-reminder template**.

### 1. Store
- **Store dashboard** (`/store` + tabs Overview / Orders / Price Sheets / Coupons / Gift Cards / Settings): overview with revenue stats, get-started checklist and fulfillment explainer; NEW-order badge on the tab.
- **Price sheets** (`/store/price-sheets`, editor at `/store/price-sheets/[id]`): create with **Self Fulfillment or Automatic (WHCC) — fulfillment is fixed after creation**, Pixieset-style. Products in 8 categories (Prints, Canvas, Metal, Acrylic, Wood, Albums & Books, Cards, Digital Downloads) with **per-size variants + prices**, per-product flat shipping, **self-fulfillment flag** (lab sheets can still carry self-fulfilled products), hide/show, full variant replacement on edit. **Assign-to-collection** panel (also assignable from each collection's Settings → "Store & Slideshow").
- **Client storefront inside the gallery** (`/g/[slug]`): when a published collection has a price sheet, every photo gets a **Buy button** (grid hover + lightbox) opening a product dialog (photo preview, product/size pickers with prices, quantity), a **cart drawer** (localStorage per gallery), and a **checkout dialog** — customer details, shipping address (physical only), **coupon + gift card fields with live server-computed totals**, automatic tax, mock card payment, confirmation with order number and **expiring 7-day digital download links + the Digital Image License**.
- **Checkout engine** (`/api/gallery/[slug]/checkout`): validates every line against the assigned sheet (active product, real variant, photo belongs to the collection and is not private), coupon rules (**% off, $ off, free shipping, free product** = cheapest unit free; min-spend, expiry, use limits), gift-card balance application (decremented on confirm; $0-due orders pay "gift card"), automatic tax from Store Settings, per-product flat shipping. Preview mode (`confirm:false`) powers the live totals in the UI.
- **Orders** (`/store/orders` + detail): status filter chips (NEW / PROCESSING / SHIPPED / COMPLETED / CANCELLED), per-order fulfillment tag (SELF / LAB / MIXED / DIGITAL — lab orders annotated "routed to WHCC (simulated)"), detail page with items + photo thumbs, totals breakdown, payment/coupon/gift-card record, status dropdown, delete, and a **Lightroom copy list** of self-fulfilled ordered filenames. CSV export button. Orders log to the gallery's Activities and the Studio inbox.
- **Coupons / Gift cards** (`/store/coupons`, `/store/gift-cards`): full CRUD; gift cards get generated `GC-XXXX-XXXX` codes, balances shown, deactivate/delete.
- **Store settings** (`/store/settings`): automatic-tax toggle + rate, Digital Image License text, terms of sale.
- **Digital fulfillment** (`/api/store/download/[token]`): tokenized link, **expires 7 days** after purchase (410 with a resend hint after that; 404 unknown; 410 on cancelled orders).

### 2. Photo Editor
- `/editor`: collection picker + photo grid → **canvas editor** with 8 preset filters (Original, Vivid, Golden, Matte, Fade, Cool, Sepia, B&W) and sliders (**brightness, contrast, saturation, warmth**). Preview renders via `ctx.filter` + a per-pixel warmth pass at display size; **Save as copy** re-renders at full resolution and POSTs to `/api/editor/save`, which writes a JPEG into the collection's uploads and creates a **new Photo in the same set** (`IMG_1001-vivid-….jpg`) — originals are never modified.
- `/api/editor/photo/[id]` proxies photo bytes same-origin (owner-only) so external add-by-URL photos never taint the canvas.

### 3. Mobile Gallery App
- Dashboard (`/mobile-app`): create an app per collection (name, accent color, contact email/phone), list with icon preview, copy-link, enable/disable (disabled apps 404), delete; one app per collection enforced; "3 free then unlimited" noted Pixieset-style (all unlocked).
- Public `/app/[slug]`: installable-style page — collection cover hero, rounded app icon, photographer branding, **Open Gallery / Email / Call buttons**, photo preview strip, and an **Add to Home Screen** button that uses the native `beforeinstallprompt` when available and shows iOS/Android instructions otherwise.
- **Web-app manifest** per app (`/app/[slug]/manifest.webmanifest`: standalone display, accent theme color) with icons generated by `/api/app-icon/[slug]` (sharp center-crop of the cover to PNG at any size; monogram fallback).

### 4. Extras
- **Workflow automations** (`/studio/automations`, new Studio tab): rule builder with **4 triggers** (invoice unpaid, gallery viewed but no favorites, contract unsigned, gallery expiring soon), **condition rows** (days since sent / days overdue / outstanding amount / days since first view / view count / hours since sent / days to expiry, with ≥ ≤ = operators, all-must-match), and **actions** (send templated reminder email → logged to the Studio inbox; resend contract — refreshes sent time; tag the contact). **Run log** per automation (target, what happened, when). Evaluation is lazy (page load + "Run now"), each rule **fires once per target** (dedup by target key) — verified: firing, smart-field rendering ("Hi Olivia Grant…"), and dedup across runs.
- **Slideshow with music**: per-collection music URL + enable toggle (Collection Settings → Store & Slideshow); client gallery gets a **▶ Slideshow** button → fullscreen crossfading autoplay (4s interval) with looping audio, play/pause (space), arrows, mute toggle.
- **Bulk export** (`/api/export`, UI on the Reports page + orders tab): clients, invoices (with derived status + outstanding), bookings, orders as **CSV or JSON**; favorites lists as CSV (gallery, list, client, filename, note — a Lightroom-ready list).
- **Reporting dashboard** (`/reports`, new sidebar item): stat tiles (total revenue split invoices/store, bookings + upcoming, 30-day/all-time views, downloads + favorites, view→order conversion), **revenue by month** (6-month grouped SVG bars, invoice payments vs store orders, legend + hover titles + data table), **views per day** (30-day bars), per-collection engagement table. All figures computed live from Activities, paid instalments, orders and bookings. Chart palette (#2a78d6/#eb6834) validated with the dataviz six-checks script (all pass).
- **Team roles** (`/settings/team`): Owner / Assistant / Second Shooter seats — invite, change role, remove; **permission matrix** (upload / send documents / manage store / settings / payments / delete) displayed and **enforced server-side**: guarded endpoints (collection·invoice·order·price-sheet·gift-card deletes, invoice markPaid, payment settings, store settings, team + templates) return 403 for roles without the permission. A **"work as role" switcher** (cookie) proves the enforcement end-to-end; switching back is always allowed.
- **Customizable reminder emails** (`/settings/emails`): 5 fully editable templates (invoice reminder, gallery favorites nudge, contract signature reminder, gallery expiry, booking reminder) with subject + body, click-to-insert smart-field tokens, "Customized" badge and **reset to default**. Automations render the photographer's custom versions.

### 5. Pricing
- **Public `/pricing`**: Pixieset-style marketing page with all four ladders from the research — Client Gallery (Free/Basic $8/Plus $16/Pro $24/Ultimate $40), Website (Free/Plus $12/Pro $18), Studio Manager (Free/Plus $12/Pro $18), Suite (Starter $28/Pro $38/Ultimate $55) — yearly + monthly prices, feature lists, "Most popular" highlights, bundle-savings footnote. Display only.
- **Settings → Plan**: current plan card ("Suite — Ultimate (replica), everything unlocked") + the same tables, link to the public page. Settings now has tabs (Account / Team / Email Templates / Plan).

### Routes added
- Dashboard pages: `/store` (+ `/orders`, `/orders/[id]`, `/price-sheets`, `/price-sheets/[id]`, `/coupons`, `/gift-cards`, `/settings`), `/editor` (now the real editor), `/mobile-app` (real), `/reports`, `/studio/automations`, `/settings/{team,emails,plan}`.
- Public: `/pricing`, `/app/[slug]` (+ `manifest.webmanifest`).
- API: `store/{price-sheets(+[id]),products(+[id]),coupons(+[id]),gift-cards(+[id]),orders/[id],settings,download/[token]}`, `gallery/[slug]/checkout`, `editor/{photo/[id],save}`, `mobile-apps(+[id])`, `app-icon/[slug]`, `automations(+[id],run)`, `export`, `team(+[id])`, `email-templates`.

### Simplifications (and why)
- **Payments are mock** (per spec): checkout always "succeeds"; the card field is decorative. Gift-card math, coupon accounting and order records are fully real.
- **Lab fulfillment is simulated**: LAB price sheets tag orders as routed to WHCC; no lab API exists to call. Pixieset's per-lab catalogs/markup tooling reduce to the same product+variant model.
- **Automatic tax is a single configurable rate**, not a geo lookup ("auto-pilot" has no free tax API); toggle + rate per store, matching the spec's "automatic tax toggle".
- **Album/book client-designer tool** is out of scope — albums are sold as variant products (size/cover) without a spread-layout editor.
- **Product packages** (bundles) were not built as a separate entity — multi-item carts + FREE_PRODUCT/percent coupons cover the discount mechanics; noted as the one Store sub-feature skipped.
- **Warmth** is a pixel-level channel shift (no color-science white balance); crop presets from the Phase-4 spec header were superseded by the task's slider list (brightness/contrast/saturation/warmth) — crop was not built.
- **Add to Home Screen** depends on the browser: Chromium fires `beforeinstallprompt`; iOS Safari gets instructions (platform limitation). No service worker (nothing to cache offline — galleries are dynamic).
- **Automation emails are logged, not SMTP-sent** — consistent with invites (Phase 1) and invoice sends (Phase 3); they appear in the Studio inbox as outbound email entries with an "Automation:" meta tag.
- **Team members don't get their own logins** — seats are records plus a server-enforced role system; the "work as role" switcher exercises the same guards a scoped login would hit. Real per-member auth would need invite-token signup flows out of scope for a replica.
- **Each automation fires once per target ever** (no re-fire cooldown setting); re-running is safe and idempotent. The RESEND_CONTRACT action naturally re-arms the trigger clock by refreshing `sentAt`.
- **Reports charts hover** uses native SVG `<title>` tooltips (server-rendered page, no client JS); each chart ships its data table alongside.
- **Slideshow music** is any direct audio URL (no uploads/track library) — matches the "music URL field" scope.

### Build status (verified 2026-11-18)
- `npm run build`: **PASSING** — compiled successfully, types clean, 78 static pages + all dynamic routes (156 routes total incl. API handlers), zero warnings.
- Full smoke test against `npm run start` (production server): all 14 new dashboard pages + 4 public pages 200 ✓; checkout totals preview exact (subtotal/discount/tax/shipping math verified: $65.00 cart → PRINTS10 −$6.50, tax $4.83 on the discounted base, gift card −$50, $21.33 charged) ✓; unknown coupon / below-min-spend FREESHIP / private photo / missing shipping address all rejected with correct messages ✓; confirmed order created with coupon useCount +1, gift-card balance decremented to $0, Activities + Studio-inbox entries, LAB fulfillment tag ✓; FREE_PRODUCT coupon makes the cheapest unit free ✓; digital download link serves the JPEG, expired link → 410, unknown token → 404 ✓; order status PATCH + detail page + Lightroom copy list ✓; role enforcement: Second Shooter blocked from order delete, payment settings, invoice markPaid (403 with role message); Assistant allowed order-status PATCH but blocked from delete; Owner deletes fine; switch-back always allowed ✓; automations: lazy page-load run, test rule fired on the unsigned contract (templated email to olivia.grant@example.com, contract sentAt refreshed), seeded-run dedup kept INV-0001 from double-firing, run-again idempotent ✓; editor save created `IMG_1001-vivid-….jpg` in the same set with the file on disk, photo proxy serves image/jpeg ✓; price sheet CRUD incl. variant replacement + unknown-sheet assignment 400 ✓; mobile app disable → 404 / re-enable → 200, second app created with unique slug, duplicate rejected, manifest JSON correct, 192px PNG icon verified ✓; exports: clients CSV, invoices JSON (derived PARTIAL + outstanding), favorites CSV with notes, bookings + orders CSV ✓; email template save + reset-to-default ✓; team invite + duplicate-email 409 + gift-card code generation ✓; gallery page carries Buy buttons (20), Cart and Slideshow controls for the storefront collection while staying password-gated for anonymous visitors ✓; rendered-page screenshots eyeballed (reports charts with legend + table, buy dialog with size prices, installable app page, automations builder) ✓; Phase 1–3 regression sweep all 200 (dashboard, collections, presets, website, blog, SEO, all studio tabs, public site, booking site, quick share, pre-release gate) ✓. Demo data reseeded to pristine state afterwards.

## Final whole-app summary (Phases 1–4 complete)

**Pixelset** is a working Pixieset replica: one Next.js 14 + Prisma/SQLite app, one demo account (**demo@pixelset.app / demo1234**), six product areas plus a Suite dashboard — with the owner's hard exclusion honored throughout (no storage product anywhere; photos live as local uploads or external URLs).

- **Client Gallery** (Phase 1): collections with sets, 7 cover styles, fonts/palettes/grids, passwords, email registration, client-exclusive sets, private photos, watermarks, PIN + capped downloads in 5 sizes, ZIP download-all, favorite lists with notes + limits, comments, quick-share links, invites, activities, folders, presets, expiry.
- **Website** (Phase 2): 40-block Flex-style builder, 8 named templates (Berlin…Jennifer), 9 standard + custom pages, blog that survives template switches, 12 palettes/12 font themes, SEO manager (titles, alt audit, redirects, sitemap), public rendering at `/site/[slug]` with working forms feeding the inbox.
- **Studio Manager** (Phase 3): session types with retainers/add-ons, mini sessions with auto-generated slots + waitlists, public booking flow with questionnaires + in-flow e-signing + mock retainer payment, calendar, contracts with smart fields and second signers, invoices with 12-instalment schedules and public pay pages, quotes that convert, CRM with CSV import, kanban projects, unified inbox, payments settings.
- **Store + Editor + Mobile App + Extras** (Phase 4): per-collection storefronts from price sheets (prints/canvas/albums/digital, self or WHCC-style lab fulfillment), cart/checkout with coupons, gift cards, automatic tax and 7-day digital delivery, order management; a canvas photo editor saving copies; installable per-collection gallery apps with manifests and generated icons; conditional workflow automations with run logs; gallery slideshows with music; bulk CSV/JSON exports; a live reporting dashboard; enforced team roles; editable reminder-email templates; and public Pixieset-style pricing pages (display only — everything unlocked).

**State**: `npm run build` passes clean (156 routes); every phase's smoke suite was run against the production server on final code; seeded demo exercises every area. A production server from this session may still be listening on :3000 (`pgrep -f next-server` to find it) — kill it before starting your own.

## Phase 5A (completed 2026-11-18, finishing pass by main agent after two Claude sessions were interrupted: one by a machine restart, one by Claude usage credits running out)

Scope per PHASE5A-BRIEF.md. All six workstreams were already in code when the finishing pass started; the pass verified each, cleaned copy, rebuilt, reseeded, and smoke tested.

Verified in code and at runtime:
- Resend mailer (src/lib/mailer.ts): every app email routes through it; sends via Resend when RESEND_API_KEY is set, otherwise logs. Settings page shows the connection status honestly (shows Not connected until Glen provides the Resend account) plus a from-address field and a send-test button.
- Lab fulfillment (src/lib/lab.ts): lab order payloads are stored on orders with the full status flow (queued, sent, in production, shipped, delivered, reprint). Seeded order ORD-0001 carries a QUEUED WHCC lab payload marked ready to send, no lab connected. Manual send and reprint actions exist.
- Video in galleries: MP4/MOV/M4V uploads, video item type, HTML5 player, favorites and comments on videos, separate video download toggle. Seed includes a demo video in the Reception set.
- RAW support: CR2/CR3/NEF/ARW/DNG/RAF/ORF/RW2 accepted, RAW badge tiles (seeded in Family Formals), downloads follow gallery settings.
- Editor upgrade: crop with preset aspect ratios, rotate and flip added to the existing quick editor; save-as-copy behavior kept.
- Picflow gallery linking (src/lib/picflow.ts): paste a Picflow gallery URL, the server extracts image URLs and creates external photo references (no file copying), dedupe by URL, Sync now adds only new URLs, failures reported honestly. Seed includes the External Demo Set built from external references.

Fixed in the finishing pass:
- Em dashes removed from all UI copy across src (168 occurrences in blocks, templates, pages, and components), replaced with commas or hyphens per the no-em-dash rule. Zero remain in src.

Checks:
- npm run build: PASSING (79 static pages generated).
- npm run seed: completed; Phase 5A seed additions confirmed in seed output (External Demo Set, demo video, RAW badge demo, lab payload on ORD-0001).
- Smoke test on the production server: login with demo@pixelset.app / demo1234 returns ok; dashboard, editor, settings, and collection pages all return 200 when authenticated; settings shows Resend and lab status. Server stopped after the test.

Honest gaps (unchanged, by design or awaiting Glen):
- Payments remain mock (parked by Glen's order).
- Photo cloud storage remains excluded (excluded by Glen's order; Picflow linking is the bridge).
- Real email delivery waits on Glen providing the Resend account; real lab submission waits on Glen naming the lab and providing that account.
- Public deployment is still outstanding; the app currently runs on the VM only.

## Fix batch 2026-11-20

Built: email campaigns (Studio Manager, Email campaigns: builder, three recipient sources, per recipient send log, metered against `campaignAllowance()` at send time), in app help centre (`/help`, guides in `src/lib/help-guides.ts`), dashboard support bubble with the site owner's support inbox (`/support-inbox`), contract/invoice/quote theming from the website palette and font theme (`src/lib/doc-theme.ts`), device aware mobile save steps in the gallery download dialog, video timecode comments (`Comment.timecodeSec`), 640/1024/2048 preview renditions generated at upload (`warmRenditions()` in `src/lib/previews.ts`), and gallery interface languages (`src/lib/gallery-i18n.ts`, EN ES FR DE NL ZH-Hans PT SV). The product switcher (item 4) was already built in commit 31952b4 and is now covered by a smoke check.

Environment:
- `SUPPORT_INBOX_EMAILS` (comma separated account emails) chooses who sees `/support-inbox`. Unset, it defaults to `demo@pixelset.app`. Set it on Render to the owner's login email.
- Schema additions are additive (`Comment.timecodeSec`, new `SupportMessage` table) and apply through the existing `prisma db push` in `npm start`.

Smoke checks: `scripts/smoke-server.sh [item...]` runs `scripts/smoke-fix-batch.ts` against a built app on :3100 with `prisma/fixbatch.db`; `BROWSER=1 scripts/smoke-server.sh [item...]` runs `scripts/smoke-browser.mjs` (Playwright, pointed at a local install through `PLAYWRIGHT`). Items: campaigns, help, support, switcher, docs, videocomments, previews, languages, books (tsx) and mobile, videocomments, languages (browser).

# Phase 5A brief: integrations, media, Picflow linking

Read FEATURE-ACCOUNTING.md first. It is the checklist. This phase closes the headline gaps. Work in ~/workspace/pixelset-replica (Next.js 14, TypeScript, Tailwind, Prisma, SQLite). Keep the existing design language exactly. Run npm run build at the end; it must pass. Append a Phase 5A section to BUILD-NOTES.md with what you built and what remains simplified. NEVER write state files in place; not relevant here except seed data care. Demo login demo@pixelset.app / demo1234 must keep working; reseed pristine at the end.

## 1. Email that actually sends (Resend)
- Add a mailer module that sends through the Resend API (https://api.resend.com/emails) when env RESEND_API_KEY is set, using fetch. From address from env MAIL_FROM (default "Pixelset <onboarding@resend.dev>"). When the key is absent, fall back to the current behavior (log to inbox/activities) so the app never breaks.
- Route EVERY email the app produces through the mailer: gallery invites, publish notifications, booking confirmations, contract sent/signed notices, invoice sent + payment reminders, quote sent, store order confirmations, purchased download link emails, automation emails, reminder templates. Keep the existing log records too.
- Settings page: email settings section showing whether Resend is connected (key present or not, never show the key), the from address field (stored, used as MAIL_FROM override), and a "send test email" button that sends to the account email and reports success or the provider error.
- Use the official resend npm package if it installs cleanly; otherwise plain fetch is fine.

## 2. Lab fulfillment, real structure
- Build the lab order pipeline as a real integration shape: when a store order with lab fulfillment is placed, generate a complete lab order payload (lab name, product, size, paper, quantity, image URLs, shipping address, order id) stored on the order, with a status flow (queued, sent to lab, in production, shipped, delivered, reprint requested).
- Add a lab settings section: lab name (default WHCC), lab account email field, API endpoint field, enable toggle. When an endpoint and credentials (env LAB_API_KEY) exist, POST the payload to the endpoint; otherwise keep the payload queued and clearly marked "ready to send, no lab connected". A manual "send to lab now" button per order. Reprint request button that clones the payload with a reprint flag.
- This must be honest in the UI: if no lab is connected, say so on the order.

## 3. Video in galleries
- Accept video uploads (MP4, MOV, M4V) in the Photos tab alongside images, stored under public/uploads like photos, with a duration field when readable. Add a video item type in sets.
- Public gallery: video items render with a native HTML5 player in the grid (poster from a generated thumbnail if ffmpeg is available, else a styled placeholder) and in the lightbox. Video cover option: a collection can use an uploaded video as its cover (plays muted looped) in addition to the existing YouTube/Vimeo embed.
- Favorites and comments work on videos. Download control for videos follows the collection download settings plus a separate video download toggle. Store: videos can be sold as digital products with the existing expiring download links.

## 4. RAW support
- Accept RAW extensions (CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2) in uploads. Store the original file; mark the item RAW. If a JPEG preview can be produced with available tools, attach it; otherwise show a RAW badge tile with filename and size, and allow download of the original (subject to download settings). RAW items appear in sets, favorites lists, and order copy lists.

## 5. Photo Editor upgrade
- Add crop with preset aspect ratios (free, 1:1, 4:5, 3:2, 16:9) and rotate/flip, on top of the existing filters and sliders. Keep save-as-copy behavior. Straighten slider if feasible with canvas transforms. All client-side canvas, no external services.

## 6. Picflow gallery linking (owner's key request)
Goal: the owner delivers client photos through Picflow (glenfru.picflow.com). He wants a Pixelset collection that SHOWS a Picflow gallery without importing or copying the image files into Pixelset storage.
- Build "Link a Picflow gallery": a form on the collection create screen and on an existing collection's Photos tab: paste a Picflow gallery URL. The server fetches the public gallery page, extracts the image URLs it references (img tags, srcset, and JSON blobs in the page), and creates photos in a chosen set as EXTERNAL references (isExternal, storing the Picflow CDN URL, no file download, no local copy).
- Dedupe by URL. Show a small "Hosted on Picflow" note in the manager. A "Sync now" button re-fetches the page and adds only new URLs, never deleting existing ones. If the fetch fails or no images are found, report exactly that in the UI, never fake success.
- Public gallery renders external photos like normal ones (they load from Picflow's CDN). Favorites, comments, privacy flags, and store attachment work on them (store digital delivery of an external photo delivers the external URL).
- Seed: link the demo collection "Emma and James Wedding" to nothing real; instead add one demo external set using picsum URLs to prove rendering, clearly named "External Demo Set".

## Rules
- Prefer established open source npm packages over hand-rolling (for example qrcode for real QR codes in galleries, replacing the placeholder box, is in scope if quick).
- No em dashes in UI copy.
- Payments stay mock in this phase by owner's order. Do not build Stripe.
- Photo cloud storage product stays excluded.
- Keep every existing route working; run the existing smoke flows mentally and keep the demo data intact.

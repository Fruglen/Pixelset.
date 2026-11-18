# Pixelset Replica: Full Feature Accounting

Summary: This accounting covers 365 features taken from the Pixieset research inventory dated 18 Nov 2026, checked against the replica build spec, the build notes including every Simplifications section, and spot checks of the app code. Of those, 141 are BUILT, 98 are PARTIAL, and 126 are NOT BUILT. Built means the feature works in the replica as a client or photographer would use it. Partial means a working version exists but is simplified, mocked, logged instead of sent, or missing part of the researched behaviour, and the row says exactly how. Not built means there is no working version in the app. Money movement, real email delivery, lab fulfilment, and subscription billing are mocked or display only throughout, because this is a self hosted replica with no live processor, mail, lab, or billing accounts connected. The photo cloud storage product is not mixed into these counts as a feature gap. It is listed once at the end under Excluded by owner's order.

How to read the notes: for every PARTIAL and NOT BUILT row, the note gives the plain reason in everyday language and then says what it would take to finish it after the words "To finish:".

## Client Gallery

| Feature | Status | Notes |
|---|---|---|
| Free sign up with email and no card | PARTIAL | Sign up and login by email and password are built, and no card is asked for because there is no billing. The guided first gallery walkthrough is not built. To finish: add a first run wizard that ends with a created collection. |
| Collection with name, event date, and its own URL | BUILT | Collections carry a name, an event date, and a unique slug used by the public gallery. |
| Multi file photo upload | BUILT | The Photos tab uploads multiple image files and can also add a photo by URL. |
| Drag and drop uploading | PARTIAL | Upload works through the file picker. A drop zone with drag feedback is not evidenced in the code. To finish: add a drop target to the Photos tab that feeds the same upload route. |
| Background uploading that continues while you work | NOT BUILT | Uploads run inside the request from the Photos tab. There is no upload queue that keeps working in the background. To finish: add a queued uploader with per file progress, retry, and resume. |
| Bulk photo actions in the photo manager | PARTIAL | Photos can be selected for Quick Share, and individual photos can be moved between sets, made private, set as cover, or deleted. Bulk move, bulk copy, bulk delete, bulk rename, and bulk watermark are not built. To finish: add a selection action bar that applies one action to many photos. |
| Lightroom Classic plugin upload and sync | NOT BUILT | No Adobe plugin or sync endpoint exists. The replica does include Lightroom style filename copy lists for favorites and store orders. To finish: build a Lightroom Classic plugin that talks to an authenticated upload and sync API. |
| Upload from a phone camera roll | PARTIAL | The dashboard is web based and the file picker can reach phone photos in a mobile browser, but there is no dedicated mobile upload flow or camera capture path. To finish: add a mobile first upload screen with camera and library sources. |
| File format and size limits: JPEG and PNG to 100 MB, GIF to 85 MB | PARTIAL | The upload route accepts files whose type starts with image, which covers JPEG, PNG, and GIF in a browser, but the researched size limits are not implemented or shown. To finish: enforce and display the per format size limits on the server. |
| RAW photo delivery | NOT BUILT | RAW files are not accepted by the image only upload route and there is no RAW storage or delivery path. To finish: allow RAW file types, store originals separately, and generate previews from them. |
| Video uploads: MP4, MOV, AVI, and M4V up to 4K | NOT BUILT | There is no video upload, player, or video file handling in galleries. A YouTube or Vimeo link can be used as a cover only. To finish: add video storage, transcoding, a player, thumbnails, and download controls. |
| Video allowance metered in hours by plan | NOT BUILT | There is no video in the app, so there is nothing to meter. To finish: track stored video duration per account once video uploads exist. |
| Photo Sets inside a collection | BUILT | Sets can be created, renamed, ordered, and deleted, and photos live inside sets such as Getting Ready or Ceremony. |
| Folders that group collections in the dashboard | BUILT | Folders can be created and renamed, collections can be moved into them, and the collections list filters by folder. |
| One shared link for a whole folder of collections | NOT BUILT | Folders are a dashboard organising tool only. There is no public folder page or single share link. To finish: give each folder a public slug and a page listing its published collections. |
| Starring collections and photos | NOT BUILT | No star field or star action exists for collections or photos. Favorites are a client feature and are not the same thing. To finish: add a star flag, star actions, and a starred filter. |
| Collection Presets and Defaults | BUILT | Presets save and apply design, privacy, download, store related, watermark, and expiry reminder settings, and can be created from scratch or from an existing collection. |
| Preset that auto generates a unique password per collection | NOT BUILT | Preset fields do not include a password rule. Collection passwords are set per collection by hand. To finish: add a preset option that generates a fresh password whenever the preset is applied. |
| Bulk edit of styling and store settings across many galleries | NOT BUILT | A preset is applied collection by collection. There is no multi collection bulk edit. To finish: add collection multi select with an apply preset action and a change summary. |
| Collection status: Draft, Pre-release, Published | BUILT | All three statuses exist, and expired galleries are derived from the expiry date. |
| Publish and Notify | PARTIAL | Publishing works. The notify step records the invite instead of sending a real email, because no mail sending service is connected. To finish: connect an email service and send the notification on publish. |
| Gallery Assist client walkthrough cards | NOT BUILT | Clients get the gallery itself, with gates and dialogs, but no first open walkthrough cards explaining downloads, favorites, and buying. To finish: add dismissible first visit cards to the public gallery. |
| Cover from a collection photo | BUILT | Any collection photo can be set as the cover. |
| Cover from a separately uploaded image | PARTIAL | A cover image has to be a photo in the collection, including one added by URL. There is no separate cover only upload. To finish: add a cover upload field that does not add the image to the photo grid. |
| GIF as a cover | PARTIAL | A GIF can sit in the collection as an image and be chosen as cover, but there is no GIF specific cover handling or check. To finish: accept and test animated GIF covers explicitly. |
| Video cover from a YouTube or Vimeo embed | BUILT | The cover video URL field renders an embedded video cover on the public gallery. |
| Set Focal point for cover cropping | BUILT | Horizontal and vertical focal sliders are stored and applied to the cover image position. |
| No cover option | BUILT | None is one of the cover styles and sends visitors straight to the grid. |
| Seven or more cover styles | PARTIAL | Six styled layouts are built, Classic, Novel, Frame, Stripe, Journal, and Divider, plus None. That is one styled layout short of the researched seven plus. To finish: add at least one more distinct cover layout. |
| Subtle text and button animation on covers | NOT BUILT | Covers are static layouts. No cover animation setting or motion is built. To finish: add tasteful entrance animation to cover text and the view button. |
| Design settings: Cover, Typography, Color, Grid | BUILT | All four design groups are present in collection settings with a live preview. |
| Six curated gallery font options | BUILT | Six font pairings are built and also apply to gallery store pages. |
| Nine gallery colour palettes | BUILT | Nine palettes are built, from Paper and Ivory to Dusk and Noir. |
| Grid style: Vertical or Horizontal | BUILT | Both grid styles are built. |
| Thumbnail size: Regular or Large | BUILT | Both thumbnail sizes are built. |
| Grid spacing: Regular or Large | BUILT | Both spacing options are built. |
| Navigation style: Icons Only or Icons and Text | NOT BUILT | Gallery navigation has one fixed style. There is no icons only versus icons and text setting. To finish: add the setting and render both navigation styles. |
| Immersive photo lightbox | BUILT | The public gallery has a full screen lightbox with keyboard navigation, download, favorite, and comment actions. |
| Lightbox quick actions for the photographer: move, copy, star, download, rename, set as cover | PARTIAL | Download and set as cover exist, and move exists in the photo manager. Copy, star, and rename do not exist anywhere, and the manager actions are not inside the client lightbox. To finish: add the missing photo actions and expose the full set in a photographer preview mode. |
| Collection password | BUILT | A whole gallery can be protected with a password gate. |
| Client Exclusive Access for named sets | BUILT | A set can be locked to one named client email with its own password, while guests see the rest of the gallery. |
| Email registration to view a gallery | BUILT | Viewers can be required to register an email before viewing, and registrations are stored. |
| Registered email addresses stored and exportable | PARTIAL | Registrations are stored and listed in the Activities tab. There is no dedicated export of the registration list. To finish: add a CSV download for registered emails per collection. |
| Clients can mark individual photos Private | BUILT | Photos carry a private flag, private photo activity is tracked, and private photos are hidden from other viewers. |
| Gallery SEO toggle: allow or block search engine indexing | NOT BUILT | Collection settings have no indexing toggle and public galleries emit no per gallery indexing choice. To finish: add the toggle and output the matching robots meta tag. |
| Homepage visibility toggle: Show on Homepage | NOT BUILT | There is no photographer homepage listing in the replica and no visibility toggle on collections. To finish: add a public homepage gallery index plus the per collection toggle. |
| Master download switch for photos | BUILT | Downloads can be turned off per collection. |
| Separate master download switch for videos | NOT BUILT | There are no videos in galleries, so there is no video download switch. To finish: add it with the video feature. |
| Download PIN, four digit | BUILT | A PIN can be enabled per collection and is required for downloads. |
| Limit on the number of PIN uses | BUILT | A PIN use limit and a use counter are stored and enforced. |
| Restrict downloads to clients only: email plus PIN required | NOT BUILT | The PIN check does not also require the viewer to be a registered client. To finish: add the setting and check registration plus PIN before any download. |
| Free download limit per client | PARTIAL | The cap is built and counts distinct single photo downloads per client. Download All does not consume the cap, so a client can bypass it with one ZIP. To finish: charge every photo inside a ZIP against the cap or block ZIP downloads once the cap is reached. |
| Download sizes offered: Original, High Resolution 3600px, Web 2048, 1024, 640 | BUILT | The photographer picks from the same five size choices, and downloads are generated at the chosen size. |
| Single photo download | BUILT | Built, with its own on and off switch. |
| Download All as a ZIP | BUILT | Built, with its own on and off switch. The ZIP is generated in the browser request and lists any missing files in a text file inside the ZIP. |
| Download All delivered by an emailed link | NOT BUILT | The ZIP downloads directly in the browser. No link is emailed. To finish: build the ZIP in the background, store it briefly, and email a signed link. |
| Large galleries split into multiple ZIPs | NOT BUILT | One ZIP is generated for the whole gallery. To finish: split by file count or total size and offer each part for download. |
| Full gallery download restricted to desktop | NOT BUILT | The replica does not restrict Download All by device type. To finish: detect mobile clients and hide or explain Download All there, matching the researched behaviour. |
| Purchased digital download links expire after 7 days | BUILT | Store digital products deliver a download link that expires after 7 days. |
| Purchased download links can be resent | PARTIAL | The buyer reaches the link from checkout and the order. There is no resend action and no email is sent. To finish: add a resend button on the order that issues a fresh 7 day link by email. |
| Download Activity tracking: who downloaded what and when | BUILT | Downloads are logged and shown in the Activities tab with filters. |
| Favorites on and off per collection | NOT BUILT | Favorite lists always exist on a published gallery. There is no per collection favorites switch. To finish: add the switch and hide all favorite controls when it is off. |
| Multiple Favorite Lists per client | BUILT | A client identified by email can create more than one list. |
| Per photo notes and editing requests on favorites | BUILT | Each favorited photo can carry a note. |
| Comments on photos | BUILT | Clients can comment on photos and comments appear in the gallery and activity views. |
| Selection limit preset on a favorite list | BUILT | A list can carry a selection limit, such as a retouching allowance, and the limit is enforced. |
| Client shares a finished list and notifies the photographer | PARTIAL | Lists are visible to the photographer in the dashboard. There is no explicit share or I am done action that notifies the photographer. To finish: add a submit list action that records and sends a notification. |
| Photographer favorite tools: view lists and comments | BUILT | Favorite activity, lists, notes, and comments are visible from the collection Activities area. |
| One click copy of favorite filenames | PARTIAL | A Lightroom ready filename list for favorites is available through the Phase 4 favorites export on the Reports page. It is not a one click copy inside the Activities tab. To finish: add a copy filenames button beside each list. |
| Favorite list CSV and filename export | BUILT | Favorites export in CSV and JSON, including filenames, from the Reports page export panel. |
| Download All favorites | NOT BUILT | There is no action that downloads every photo in a favorite list as one file. To finish: add a ZIP action on each favorite list reusing the gallery ZIP builder. |
| Send as Download from a favorite list | NOT BUILT | A favorite list cannot be turned into a download delivery for the client. To finish: add an action that creates a download link or Quick Share from the list photos. |
| Auto Expiry per collection at 11:59 pm local time | PARTIAL | An expiry date is stored and the gallery becomes hidden once it passes, computed when pages load. The exact 11:59 pm local time rule and a photographer's timezone setting are not implemented. To finish: store the photographer timezone and expire at end of day in that zone. |
| Expired gallery becomes Hidden, not deleted | BUILT | Expiry is derived from the date. The collection and its photos stay in the dashboard. |
| Re publish an expired gallery by changing the date and status | BUILT | Editing the expiry date and setting the status back to Published restores the gallery. |
| Automated expiry reminder email to clients | PARTIAL | The expiry reminder flag exists, a reminder email template exists, and the Gallery Expiring automation can fire it. The send is logged in the inbox, not emailed, because no mail service is connected. To finish: connect an email service so the logged message is actually delivered. |
| Branded email invites with cover preview, personal message, and download instructions | PARTIAL | Invite records store the recipient and message data and are logged as sent. No real email with a rendered cover preview is delivered. To finish: connect an email service and send a branded HTML invite. |
| Scheduled invite sending by date and time | NOT BUILT | Gallery invites have no schedule field. Scheduled sending exists only for contracts. To finish: add a send at field and a lazy or queued sender for invites. |
| Reusable gallery email templates | NOT BUILT | The editable email templates in Settings cover reminders only, not gallery invites. To finish: add invite templates to the template editor and let invites pick one. |
| Bulk sharing to many clients at once | NOT BUILT | Invites are sent one recipient at a time. To finish: add a multi recipient invite form with per recipient personalisation. |
| Quick Share Link for a curated selection | BUILT | Selected photos can be shared through a Quick Share link while the rest of the gallery stays private. |
| Sharing by direct link | BUILT | Every published gallery and Quick Share has a direct link that can be copied. |
| Sharing by QR code | PARTIAL | The share area shows a labelled QR placeholder instead of a scannable code. To finish: generate a real QR image from the gallery URL. |
| Volume photography workflow: CSV upload creates galleries and assigns clients | NOT BUILT | There is no CSV driven gallery creation and no folder upload that creates one gallery per folder. To finish: build a CSV importer that creates collections, sets passwords and PINs, and queues personal invites. |
| Watermark uploaded as your own file | NOT BUILT | The watermark is a text overlay typed in Settings. There is no watermark image upload. To finish: accept a watermark image and composite it on previews. |
| Watermark created in the dashboard | PARTIAL | A watermark can be created as text in Settings and overlaid on previews with CSS. There is no visual watermark designer with size, position, and opacity controls. To finish: add those controls and render the watermark into preview images. |
| Watermark on previews only, never on originals | BUILT | The overlay appears on previews and downloads are always clean files. |
| Photographer chooses whether web size downloads carry the watermark | NOT BUILT | Downloads are always clean at every size, so there is no choice to make. To finish: add per size watermark options and apply them when generating web size downloads. |
| Bulk watermark action | NOT BUILT | Watermarking is a per collection preview setting, not an action run over selected photos. To finish: add watermark to the bulk photo action bar once that bar exists. |
| Paid downloads are watermark free once the PIN is given | BUILT | All replica downloads are clean files, so paid downloads are clean as well. |
| Multi language galleries: Spanish, French, German, Dutch, Chinese Simplified, Portuguese, Swedish | NOT BUILT | Gallery text is English only. There is no language setting on collections or presets. To finish: add a language field and translated gallery interface strings. |
| Dashboard languages: English, Spanish, Portuguese by location | NOT BUILT | The dashboard is English only. To finish: localise the dashboard and select language from the account locale. |
| Google Analytics on galleries | NOT BUILT | There is no analytics ID field for galleries or the account gallery settings. To finish: add the field and inject the tag on public gallery pages. |
| Social sharing buttons toggle | NOT BUILT | There are no social share buttons on galleries and no toggle for them. To finish: add share buttons for the main networks behind a per collection toggle. |
| Built in email campaigns: print sales, mini session announcements, review requests | NOT BUILT | There is no campaign builder, audience picker, or campaign send. Reminder automations are not campaigns. To finish: build a campaign tool with a subject, body, recipient source, and send log. |
| Campaign opt in capture inside galleries | PARTIAL | Email registration in galleries and newsletter forms on the website capture addresses. Those addresses are not connected to any campaign tool. To finish: feed captured addresses into the campaign audience. |
| Email campaign send quotas by plan | NOT BUILT | There are no campaigns and no plan enforcement, so no quota exists. To finish: add quotas only if plan enforcement is ever built. |

## Website

| Feature | Status | Notes |
|---|---|---|
| Templates built: Berlin, Vienna, Sedona, Onyx, Marlow, Montana, Oslo, Jennifer | BUILT | Eight named templates are built as full page bundles with their own palette, font theme, and header style. |
| Remaining researched templates: Torres, Tofino, Malibu, Tuscany, Alba, Lisbon, Morgan, Esther, Mono, Skye, Chase, Odette, Julia, Mason, Dahlia, Atlas, Enzo | NOT BUILT | Only eight of the researched template names were in the replica spec. The other seventeen names have no template bundle. To finish: build a page bundle, palette, and font pairing for each missing name. |
| Template families: Portfolio, Business, One page | PARTIAL | The eight built templates cover portfolio and business styles. There is no dedicated one page family. To finish: add at least one true one page template. |
| Legacy classic templates: Canvas, Avery, Edward, Montreal | NOT BUILT | No legacy template set is included. To finish: add these as simpler templates without the newer block features, if parity with the legacy line is wanted. |
| Switching template keeps the live site untouched through a Draft site | PARTIAL | Template switching is built and blog posts survive it, but the new template is applied to the site directly. There is no separate draft site to preview and then publish. To finish: stage template changes on a draft copy with a publish step. |
| Blog posts migrate when the template changes | BUILT | Blog posts are stored separately from pages, so they survive every template switch. |
| Flex Editor: true drag and drop editing | PARTIAL | The editor is a structured block editor: blocks are added, edited through fields, reordered, and removed. It is not a free form drag and drop canvas. To finish: rebuild the editor as a canvas with drag, drop, and resize handles. |
| Move and resize text, images, video, shapes, and buttons freely | PARTIAL | Content is resized only through block fields and layout choices. Free positioning and resizing are not possible, and there is no shape element at all. To finish: store per block position and size and render them absolutely on each device layout. |
| Per device layouts for desktop, tablet, and mobile | NOT BUILT | One block layout renders responsively. There are no separate per device arrangements or per device previews with adjustments. To finish: store three layout variants per page and add device preview tabs. |
| Block library of 40 blocks | BUILT | Forty block types are registered, covering heroes, galleries, pricing, testimonials, forms, blog, and calls to action. |
| Hero, slideshow, and carousel blocks | BUILT | Hero, split hero, slideshow hero, and film strip carousel blocks are built. |
| Image grid, portfolio, and gallery blocks | BUILT | Image row, gallery grid, masonry gallery, collection photos, and pair blocks are built. |
| Pricing package and pricing table blocks | BUILT | Pricing packages and a comparison table block are built. |
| Testimonial and reviews blocks | BUILT | Testimonials, a featured testimonial, and a reviews wall are built. |
| FAQ and accordion block | BUILT | The FAQ block renders expandable questions. |
| Contact form block | BUILT | Contact form submissions land in the website inbox. |
| Mailing list sign up block | BUILT | The newsletter block records sign ups in the website inbox. |
| Client Gallery block that auto syncs published collections | PARTIAL | Two blocks exist: Collection photos shows a chosen set of images, and Client gallery access links clients to their galleries. Neither auto lists the photographer's published collections or enforces gallery passwords inside the block. To finish: query published collections at render time and link each through its normal gate. |
| Booking calendar block | PARTIAL | The Booking inquiry block collects a session type and preferred date as a website message. It does not show live availability or create a booking. To finish: render the Studio Manager availability and slot picker inside the block. |
| Instagram feed block | PARTIAL | The Instagram strip shows images added by hand plus a handle link. It does not pull a live Instagram feed. To finish: connect the Instagram account API and render the latest posts. |
| Video, GIF, and PNG media in blocks | PARTIAL | A video block and image blocks exist, and images can be GIF or PNG files by URL. There is no media library handling for these formats. To finish: allow media uploads per format inside the block editor. |
| Custom embed code block | NOT BUILT | There is no block that accepts arbitrary embed code. To finish: add a code block with sanitised rendering. |
| Bio link page block | NOT BUILT | There is no bio link page type or block. To finish: add a link list page template for social bios. |
| Anchor link block | NOT BUILT | Buttons link to pages and URLs, but there is no in page anchor link block. To finish: let blocks carry an anchor id and add an anchor link element. |
| Shape blocks | NOT BUILT | No shape element exists in the block registry. To finish: add shape blocks with fill, size, and rotation controls. |
| Curated full page templates: Home, About, Services, Gallery, Team, Pricing, Experience, Reviews, Contact | BUILT | The nine standard pages are generated for every template, and custom pages can be added. |
| Landing page templates for sessions, workshops, courses, and promos | PARTIAL | Any of these pages can be assembled from blocks on a custom page. There are no ready made landing templates for those four purposes. To finish: add four prebuilt landing page bundles. |
| Shareable blocks and pages that other users can preview and import | NOT BUILT | Designs cannot be exported or shared with another account. To finish: add an export link that serialises a page or block and an import action. |
| Logo and branding controls | BUILT | Logo text and logo image URL, plus site wide palette and font theme, are editable in website settings. |
| Forty colour palettes and palette combinations | PARTIAL | Twelve palettes are built. That is a deliberate spec subset of the researched forty. To finish: add the remaining palettes and per block and per word colour application. |
| Colour applied site wide, per block, or to selected words | PARTIAL | Colour applies site wide through the palette. Blocks do not carry their own palette override and text cannot be coloured per word. To finish: add block level and inline colour fields. |
| Forty plus curated font themes | PARTIAL | Twelve font themes are built, again a spec subset. To finish: add the remaining curated themes. |
| Library of 1000 plus font families | NOT BUILT | Fonts are web safe stacks only, chosen so the replica loads no external fonts. To finish: load a large font library from a font service and offer family level picking. |
| Custom font upload: woff, woff2, ttf, otf, up to 20 fonts | NOT BUILT | There is no font upload anywhere. To finish: accept font files, store them, and register them for use in themes. |
| Site wide animation controls | NOT BUILT | Website settings have no animation controls. To finish: add animation style and speed settings applied across blocks. |
| Spacing, button, and arrow design controls | PARTIAL | Spacing exists inside individual block fields, and buttons render in the theme style. There are no site wide spacing, button shape, or arrow style controls. To finish: add those three groups to the Design settings. |
| AI writing assistant | NOT BUILT | No AI helper exists in the editor. To finish: connect a language model and add assist actions on text fields. |
| AI image alt text generation | NOT BUILT | Alt text is typed by hand and audited in the SEO manager. Nothing generates it. To finish: connect an image description model and add generate buttons per image and in bulk. |
| Built in blog with posts | BUILT | A full blog exists with posts, a blog index page, and a blog list block. |
| SEO Manager: status review, per page titles and descriptions | BUILT | The SEO manager lists pages, edits titles and descriptions, and flags missing values. |
| Clean URLs | BUILT | Pages render at clean slug based URLs under the site path. |
| 301 redirects | PARTIAL | Redirects can be created and are served, but as 308 Permanent Redirect responses rather than literal 301 responses. To finish: change the redirect response status to 301. |
| Broken link checks | NOT BUILT | The SEO manager audits titles, descriptions, and image alt text. It does not crawl links. To finish: add a link checker that tests internal and external links on pages. |
| Auto generated sitemap.xml | BUILT | A sitemap is generated for the site using its domain or slug base. |
| Google Analytics connection for the website | NOT BUILT | There is no analytics field in website settings. To finish: add the field and inject the tag on public site pages. |
| Facebook Pixel connection | NOT BUILT | There is no pixel field in website settings. To finish: add the field and inject the pixel script on public site pages. |
| Cookie banner | NOT BUILT | No cookie banner setting or banner exists. To finish: add a configurable consent banner. |
| SSL and HTTPS with hosting included | PARTIAL | The replica is a normal web app that can sit behind HTTPS when deployed, but it does not issue certificates or include hosting by itself. To finish: deploy behind a host that provides certificates automatically and document the setup. |
| Free subdomain: yourname.mypixieset.com style | PARTIAL | Sites render at a path based address using the site slug, presented in the dashboard as a mypixelset style subdomain. Real subdomain routing is not wired. To finish: add host based routing so each slug resolves as a true subdomain. |
| Custom domain connection | PARTIAL | A custom domain can be typed in and is used as the sitemap base, and the settings explain the CNAME step. The DNS connection itself is display only and is not verified or routed. To finish: verify the CNAME and route requests by host name. |
| Password protect individual website pages | NOT BUILT | Pages can be hidden from navigation, but no page can be password protected. To finish: add a per page password and a gate screen. |
| Hide pages from the menu | BUILT | Pages carry a visibility flag used by site navigation. |
| Password protect the whole site | NOT BUILT | There is no site wide password. To finish: add a site password and gate every public page. |
| Typical site structure with a Client Area page and embedded booking | PARTIAL | Templates produce the typical pages including a client galleries page. The booking element is the inquiry block, not an embedded live calendar. To finish: complete the live booking block described above. |
| Website inbox for form submissions | BUILT | Contact, booking inquiry, and newsletter submissions arrive in one inbox with read and unread state. |

## Studio Manager

| Feature | Status | Notes |
|---|---|---|
| Session Types with name, description, photos, duration, and price | BUILT | Session types carry all of these, plus retainers and add ons. |
| Availability rules on session types | PARTIAL | Regular sessions are booked through an open date picker with a half hour time select from 8:00 to 19:00. There is no per type availability rule engine of days, hours, and lead time. To finish: add weekly hours, blocked dates, and lead time rules per session type. |
| Buffer times between sessions | NOT BUILT | No buffer field exists on session types or slots. To finish: add before and after buffers and apply them when generating bookable times. |
| Cancellation and rescheduling policy text | BUILT | The policy is stored on the studio profile and shown in booking and document flows. |
| Client rescheduling of a booking | NOT BUILT | The word reschedule appears only in policy text and a reminder template. Clients cannot move a booking. To finish: add a reschedule action on the booking page that picks a new slot and updates the calendar. |
| Required intake questions on a session type | BUILT | Session types can require a questionnaire inside the booking flow. |
| Add on extra services chosen at booking | BUILT | Add ons are defined per session type and selectable in the booking flow, with prices added to the total. |
| Public Booking Site listing all session types | BUILT | A public booking page lists published session types and mini sessions. |
| Client picks a date and time from live availability | PARTIAL | Mini session slots are real generated slots. Regular sessions use an open date and time picker that does not check existing bookings, so two clients can pick the same time. To finish: generate regular session slots from availability rules minus existing bookings. |
| Booking confirmation email | PARTIAL | A confirmation is created and logged in the unified inbox. It is not emailed, because no mail service is connected. To finish: connect an email service. |
| Pre session reminder emails | PARTIAL | A session reminder template and an automation path exist, and sends are logged, not delivered. To finish: connect an email service. |
| Client can request an alternative slot | NOT BUILT | There is no request another time action in the booking flow. To finish: add a request action that messages the photographer with the requested time. |
| Manual approval mode for bookings | NOT BUILT | Bookings confirm immediately in the flow. There is no hold for approval state. To finish: add an approval setting, a pending state, and approve or decline actions. |
| Manual booking on behalf of a client | PARTIAL | The photographer can create contacts, invoices, contracts, and projects by hand, but there is no create a booking for a client flow in the Sessions area. To finish: add a new booking form that reuses the public flow without payment. |
| Booking status: Awaiting Client, then Confirmed | PARTIAL | Bookings are stored as Confirmed once the flow completes. The two step awaiting state for photographer created bookings is not modelled. To finish: add the awaiting status and flip it when the client completes their steps. |
| Backdating prevention: future dates only | BUILT | The booking flow only offers future dates. |
| Session types for video calls and phone calls | PARTIAL | A session type can be named and described as a call, but there is no meeting link generation or call location type. To finish: add a location type with automatic meeting link creation. |
| Calendar view of sessions and bookings | BUILT | A studio calendar shows bookings and mini session dates. |
| Two way Google Calendar sync that blocks availability | NOT BUILT | Studio settings show a Google Calendar sync toggle state only. Nothing is read from or written to Google Calendar, and personal events cannot block booking. To finish: connect the Google Calendar API, mirror events both ways, and treat personal events as busy time. |
| Booking coupons | NOT BUILT | Coupons exist in the Store only. There is no coupon field in booking checkout and no booking coupon model. To finish: add booking coupons and a code field in the booking payment step. |
| Mini sessions: create from a session type | BUILT | Mini sessions are created with name and information, per session duration, dates, and slots. |
| Mini sessions: add dates with start time, number of spots, and breaks | BUILT | Each date generates its slots automatically, with breaks taken out. |
| Mini sessions: slots stack back to back on one date and location | BUILT | Generated slots run back to back from the start time for the set number of spots. |
| Mini sessions: fee collection at booking | PARTIAL | The booking flow collects a mock retainer payment. No real money moves, because no payment processor is connected. To finish: connect a real processor in the booking payment step. |
| Mini sessions: publish and share a direct booking link | BUILT | Publishing opens the direct link, and an unpublished mini session keeps its link private. |
| Mini sessions: duplicate a schedule across days | BUILT | Mini sessions can be duplicated, and multiple dates can be added to one mini session. |
| Mini sessions: show or hide already booked spots | BUILT | The toggle exists and controls whether booked spots appear on the public booking page. |
| Mini sessions: waitlist | BUILT | A waitlist is kept for full mini sessions. |
| Mini sessions: contract, questionnaire, and payment required inside the booking flow | BUILT | The public flow runs questionnaire, in flow contract signing, and retainer payment in sequence. |
| Mini sessions: session reminders toggle | PARTIAL | Reminders exist as templates and logged sends. There is no per mini session reminder toggle that delivers email. To finish: add the toggle and deliver through a connected mail service. |
| Mini sessions embedded on a Website landing page | PARTIAL | A website page can link to or describe a mini session, and the booking inquiry block can name it. There is no embedded live mini session calendar block. To finish: add a mini session block that renders open slots from the booking engine. |
| Contracts from free sample templates or your own templates | BUILT | Contract templates can be created and used, and contracts are generated from them. |
| Contract branding: logo, brand colours, header image | PARTIAL | Contracts render as a branded public document page using the business name. A per contract logo, colour, and header image editor is not built. To finish: add branding fields to contract templates and render them on the document page. |
| Smart fields the client fills in | BUILT | Templates support smart fields that are resolved for the client and filled during signing. |
| Second signer on a contract | BUILT | A second signer is supported in the contract flow. |
| Sign online on any device | PARTIAL | Signing works in the browser on any device, but the signature is a typed name only. There is no draw your signature pad. To finish: add a drawing pad alongside typed signing. |
| Contract expiry dates | BUILT | Contracts carry an expiry date and expired contracts are derived at read time. |
| Scheduled contract sending | BUILT | A contract can be scheduled, and the scheduled state flips to sent lazily when pages load after the time passes. |
| Automatic reminders for unsigned contracts | PARTIAL | A reminder template and the Contract Not Signed automation exist. Sends are logged, not emailed. To finish: connect an email service. |
| Contract required inside the booking flow | BUILT | Booking flows can require signing before completion. |
| Invoices with line items, discount, and tax | BUILT | Invoice line items, discounts, and tax handling are built, with public pay pages. |
| Invoice tips: preset 5, 10, 15 percent or custom | NOT BUILT | No tip field or tip prompt exists on invoices or pay pages. To finish: add optional tip presets and a custom tip amount to the pay page and invoice totals. |
| Featured photo on an invoice | NOT BUILT | Invoices have no featured photo field. To finish: add a photo picker to the invoice editor and render it on the pay page. |
| Invoice templates | PARTIAL | Invoices share one layout. There are no selectable invoice templates. To finish: add template choices with layout and wording variants. |
| Payment schedules up to 12 instalments | BUILT | An invoice can be split into up to 12 instalments, each with its own due date and paid state. |
| Invoice reminders before, on, and after the due date | PARTIAL | Reminder templates and the unpaid invoice automation exist, with sends logged rather than emailed, and timing is condition based rather than a per invoice reminder schedule. To finish: add per invoice reminder timing and deliver through a connected mail service. |
| Pay online | PARTIAL | The pay page takes a mock card payment and marks instalments paid. No real charge happens. To finish: connect a real payment processor. |
| Tap to Pay in person | NOT BUILT | Tap to Pay is mentioned on invoice and settings screens as demo only text. There is no phone based card acceptance. To finish: integrate a processor's Tap to Pay in a native app. |
| Mark an invoice paid offline: cash, cheque, bank transfer | BUILT | Instalments and invoices can be recorded as paid without an online payment. |
| Quotes where the client selects packages and options | PARTIAL | Quotes carry line items and a total and the client can accept. There is no package and option picker where the client builds their own selection. To finish: add selectable quote options that recompute the total before acceptance. |
| Accepted quote auto creates an invoice draft | BUILT | Quote conversion creates an invoice draft with items, total, and due date for review and sending. |
| Payment Links: reusable standalone branded payment page | NOT BUILT | Each invoice has its own pay page link, but there is no reusable payment link product for services, products, or post session tips. To finish: add payment link objects with an amount or open amount and their own public page. |
| Payment and income reports for invoices and payment links | PARTIAL | The Reports page shows invoice revenue by month from real data, and invoices can be exported. There is no dedicated payments report covering payment links, because payment links do not exist. To finish: add a payments report once payment links exist. |
| Refunds, disputes, and payouts management | NOT BUILT | Mock payments cannot be refunded, and there are no disputes or payout screens. To finish: build these on top of a real processor's refund, dispute, and payout APIs. |
| Pixieset Payments powered by Stripe, US and Canada | NOT BUILT | Studio settings show payment method toggles as demo states. No processor is connected and no money moves. To finish: complete a Stripe Connect style onboarding and wire charges, payouts, and fees. |
| Own Stripe account payments | NOT BUILT | Same blocker as above: the toggle is a display state only. To finish: connect a Stripe account through its OAuth flow and charge through it. |
| PayPal payments | NOT BUILT | The PayPal toggle is a display state only. To finish: connect PayPal Express Checkout and handle its payment callbacks. |
| Manual and offline payment recording | BUILT | Offline payments can be recorded against invoices with no processor involved. |
| Client payment methods: cards, Apple Pay, Google Pay, Link, Affirm, Klarna | NOT BUILT | The mock pay page accepts a typed card number only. Wallets and buy now pay later options need a real processor. To finish: enable these methods inside a connected processor checkout. |
| Processor fee handling and display | NOT BUILT | No fees are calculated because no processor charges anything. To finish: record per charge fees from the processor and show them in reports. |
| Questionnaire builder from samples and templates | BUILT | Questionnaires can be built, sent, and answered, and are used as booking intake. |
| Questionnaire autosave so a client can resume on any device | NOT BUILT | Answers are submitted in one pass. There is no draft answer state or resume link. To finish: save partial answers against a response token and restore them on return. |
| Reminders for incomplete questionnaires | NOT BUILT | Because partial responses are not tracked, nothing can remind a client about one. To finish: track started but unfinished responses and add a reminder template and automation. |
| Post delivery feedback and testimonial questionnaires | PARTIAL | A questionnaire can be written for feedback and sent after delivery by hand. There is no post delivery questionnaire type or automatic sending. To finish: add a feedback questionnaire type and a delivery triggered send. |
| Contact Forms as lead forms with a direct link | PARTIAL | Website contact and booking forms create inbox messages, and contacts can be added by hand. A standalone lead form product with its own shareable link, bio link, and email signature use is not built. To finish: add form objects with public links separate from website pages. |
| Form submission auto creates a contact and a Projects card | NOT BUILT | Website submissions land in the website inbox only. They do not create a Studio contact or a Projects card. To finish: on submission, upsert a contact and open a project in the first board stage. |
| Contacts: manual add and CSV import | BUILT | Both are built, with duplicate email protection on import and manual add. |
| Contacts auto sync from Client Gallery clients | PARTIAL | A contact detail page shows gallery history for a matching email, but gallery registrations do not automatically create contacts. To finish: create or update a contact whenever a gallery registration or favorite list appears. |
| Lead versus client states on contacts | NOT BUILT | Contacts have tags and notes but no lead or client state field. To finish: add a state field with filters and an automatic move to client on first booking. |
| Projects kanban board with customisable stages | BUILT | A kanban board exists with stages such as Inquiry, Booked, Post session, and Completed, and cards move between columns. New cards are appended at the end of a column when moved. |
| Project card aggregates client, documents, sessions, payments, galleries, and emails | PARTIAL | Contact detail pages aggregate bookings, invoices, quotes, contracts, notes, and gallery history. Project cards themselves are lighter and do not gather every one of those in a single card view. To finish: give each project a detail view that pulls all six groups together. |
| Inbox: send and receive email inside Studio Manager | PARTIAL | One unified inbox gathers website messages, studio messages, logged sends, and automation emails, with read state. Replies go out through a mailto link, and incoming email is not received into the app. To finish: connect an email service for real sending and inbound parsing. |
| Inbox email templates | BUILT | Five reminder email templates are editable in Settings, and website and studio messages use template based wording where applicable. |
| Inbox attachments: PDFs and mood boards | NOT BUILT | Messages have no attachment support. To finish: add file attachments to messages in both directions. |
| Unified history including gallery delivery, contract, and invoice emails | PARTIAL | Logged sends and messages from all products appear in one history. Gallery delivery emails are invite records rather than inbox messages, so the history is unified for studio activity only. To finish: write gallery invite and delivery events into the same message store. |
| Instant notifications in the inbox | PARTIAL | Unread state is shown in the inbox. There are no push or in app pop up notifications for new activity. To finish: add a notification feed with unread counts in the dashboard header. |
| Preset reminder automations: unsigned contract, unpaid invoice, unaccepted quote, incomplete questionnaire, upcoming session | PARTIAL | The replica goes further with a conditional automation builder covering unpaid invoices, unsigned contracts, gallery expiry, and galleries with no favorites, each firing once per target. There is no unaccepted quote trigger and no incomplete questionnaire trigger, and all sends are logged, not emailed. To finish: add the two missing triggers and connect a mail service. |
| Scheduled document sending as an automation | BUILT | Contracts support scheduled sending directly, which covers the researched behaviour. |
| Real time notifications for booking, quote accepted, invoice paid, contract signed, questionnaire completed | NOT BUILT | Activity is recorded, but there is no real time notification stream in the dashboard. To finish: add a notifications model fed by those five events, with a header bell and unread count. |
| Studio Manager native mobile app for iOS and Android | NOT BUILT | Studio work is done in the responsive web dashboard. There is no native app, and Tap to Pay depends on one. To finish: build iOS and Android apps over the same API, or ship a packaged app shell with the processor's Tap to Pay support. |

## Store

| Feature | Status | Notes |
|---|---|---|
| Storefront built into every gallery | BUILT | Any published gallery with a price sheet assigned shows a storefront for the photos in that gallery. |
| Store on and off per collection | BUILT | Each collection has a store enabled switch alongside its price sheet assignment. |
| Price sheet assigned to a collection decides what is sold and at what price | BUILT | Price sheets hold the products and variants, and collections point at one sheet. |
| Store dashboard sections: Orders, Products, Taxes, Shipping, Coupons, Settings | PARTIAL | Orders, price sheets, coupons, gift cards, and settings all exist. Taxes are one setting inside Store Settings, and shipping lives per product, so there are no separate Taxes or Shipping sections. To finish: split taxes and shipping into their own dashboard sections. |
| Guided Get Started checklist for the store | BUILT | The store overview shows a four step checklist that ticks off as sheets, assignments, settings, and the first order are completed. |
| Store settings: store status, currency, payment methods, terms of sale, offline payment option | PARTIAL | Terms of sale and a digital license are editable, and currency is shown from the profile. There is no store open or closed status, no payment method settings in the store, and no offline payment option for orders. To finish: add those four settings and enforce them at checkout. |
| Create a price sheet: name, then Automatic or Self Fulfillment | BUILT | Sheets are created with a name and a fulfillment type. |
| Automatic sheet: choose the lab, fixed for the life of the sheet | BUILT | A lab sheet names its lab, shown as WHCC style routing, and the lab is part of the sheet rather than an order choice. |
| Order flow for automatic fulfillment: order sent to lab, printed, packaged, shipped to the client | PARTIAL | Orders on a lab sheet are tagged and tracked through the same order statuses, and the routing is described as simulated. No lab receives anything. To finish: integrate a lab ordering API and pass orders, files, and shipping details to it. |
| White label packaging with no lab or platform branding | NOT BUILT | Nothing is physically shipped, so packaging cannot be provided or verified. To finish: confirm white label packaging in the lab integration agreement and test with a live order. |
| Photographer payout maths: price minus lab cost, shipping, processor fee, and free plan commission | NOT BUILT | Order totals are recorded, but no lab costs, fees, commission, or payout balance are calculated. To finish: store lab cost per product and compute the payout on every order. |
| Partner labs: WHCC, ProDPI, Miller's and Mpix, Fujifilm Canada, Loxley Colour, Atkins Pro | NOT BUILT | WHCC is named as the style of routing. No lab is integrated and the other five labs are not selectable as working options. To finish: integrate each lab or contract through a print fulfilment aggregator. |
| Product catalogue: prints in standard sizes | BUILT | Print products with size variants and prices are built. |
| Product catalogue: canvas, metal, acrylic, wood, and framed wall art | PARTIAL | Canvas, metal, acrylic, and wood categories are built as products with variants. Framed prints and framed wall art are not a category or an option. To finish: add framing options to print and wall art products. |
| Albums and books sold through the store | BUILT | Albums and books are a product category with variants, fulfilled like other products. The client design tool for them is accounted separately below. |
| Built in album and book designer tool for clients | NOT BUILT | Clients can buy an album product but cannot lay out spreads, choose cover material, or add debossed text. The build notes name this as not built. To finish: build a spread editor with page layouts, cover choices, and a proof approval step. |
| Greeting and holiday cards | BUILT | Cards are a product category with variants. |
| Digital downloads sold through the store | BUILT | Digital products deliver an expiring download link at checkout. |
| Photographer sets the final price per product | BUILT | Every variant carries a photographer set price. |
| Markup percentage over lab cost instead of a fixed price | NOT BUILT | Prices are fixed amounts only. There is no lab cost field to mark up from. To finish: add lab cost per variant and a markup mode that derives the price. |
| Recommended pricing from the platform | NOT BUILT | No suggested prices are shown when creating products. To finish: seed products with recommended prices drawn from lab costs and common markups. |
| Self fulfillment: custom products with name, price per variation, and category | BUILT | Self fulfilled products carry a name, description, category, variants with prices, and a self fulfilled flag. |
| Self fulfillment: your own shipping methods and rates | PARTIAL | Shipping is one flat amount per product. There are no named shipping methods, such as standard versus express, with their own rates and speeds. To finish: add shipping method objects and let products and checkout use them. |
| Order paid to the photographer directly on self fulfilled orders | PARTIAL | Checkout is a mock payment, so the order is recorded but no money reaches the photographer. To finish: connect a real processor to store checkout. |
| Lightroom Copy List on an order | BUILT | Order detail pages include the exact ordered filenames as a copy list, with a CSV export of orders. |
| Digital product settings: download type and size, name, price, description | BUILT | Digital variants define the option and price, and the product carries name and description. |
| Secure download link emailed after purchase, expiring in 7 days | PARTIAL | The 7 day expiring link is created and shown at checkout and on the order. It is not emailed, because no mail service is connected. To finish: email the link at purchase and store it for resending. |
| Resend a purchased download link | PARTIAL | The link remains reachable from the order. There is no resend action. To finish: add a resend button that emails a fresh link. |
| Large digital orders split into ZIPs | NOT BUILT | Digital delivery is per item links. Nothing is bundled or split. To finish: bundle multi item digital orders into sized ZIP parts. |
| Digital Image License text attached to sales | BUILT | The license text is editable in Store Settings and attached to digital sales. |
| Videos cannot be sold through the Store | BUILT | This researched limitation holds in the replica too, because there are no video products at all. |
| Product packages: custom bundles to lift basket size | NOT BUILT | The build notes name product packages as not built as their own entity. Individual products cannot be bundled into one purchasable package. To finish: add a package product type that contains other products at one price. |
| Coupons: percent off, amount off, free shipping, free product | PARTIAL | Coupons with percent or fixed amount discounts are built and applied in the cart. Free shipping and free product coupon types are not built. To finish: add coupon type choices and apply them in cart maths. |
| Coupon shown as a banner at the top of the gallery | NOT BUILT | Coupons work by code entry at checkout only. No banner announces them in the gallery. To finish: add a banner field on coupons and render it on assigned galleries. |
| Gift cards: fixed credit redeemable at gallery checkout | BUILT | Gift cards can be created with a balance and redeemed at checkout, with outstanding balances tracked. |
| Automatic local tax calculation | PARTIAL | One configurable automatic tax rate can be switched on and applied to orders. There is no address based or region based tax lookup. To finish: connect a tax calculation service keyed on buyer and seller locations. |
| Manual tax rates | PARTIAL | The single configurable rate is the manual option. Multiple named rates for different regions are not supported. To finish: allow several named rates and assign them by region. |
| Tax applies to print and digital orders | BUILT | The configured rate applies across the checkout, covering physical and digital items. |
| Shipping methods and costs configurable for both fulfillment modes | PARTIAL | A flat shipping amount per product applies on both self fulfilled and lab sheets. Named methods with rates are not configurable. To finish: build the shipping method system described under self fulfillment. |
| Order management: orders list with fulfillment lab shown per order | BUILT | Orders list and detail pages show status, items, customer, totals, and whether the order is self fulfilled or lab routed. |
| Order status tracking | BUILT | Orders move through tracked statuses from placement to completion or cancellation. |
| Client support handled by the photographer | BUILT | Order records, customer details, and exports give the photographer what they need to handle support themselves. There is no client facing support messaging inside the store. |

## Photo Editor

| Feature | Status | Notes |
|---|---|---|
| Photo Editor product exists in the account | BUILT | A canvas based editor is built into the dashboard and works on gallery photos. |
| AI culling: automatic picking of the best frames | NOT BUILT | Nothing analyses or ranks photos. To finish: connect an image quality and similarity model and add a culling review screen. |
| AI editing suggestions | NOT BUILT | Edits are manual presets and sliders only. To finish: generate suggested settings per photo from an image model. |
| RAW editing | NOT BUILT | RAW files cannot be uploaded, so they cannot be edited. To finish: add RAW decoding and a non destructive edit pipeline. |
| Preset styles | BUILT | Eight preset filters are built. |
| Styles learned from your past galleries | NOT BUILT | Presets are fixed. Nothing learns from a photographer's edited galleries. To finish: train or fine tune a style profile from the photographer's edited exports. |
| Manual adjustments: brightness, contrast, saturation, warmth | BUILT | Four adjustment sliders are built and combine with presets. |
| Crop presets and cropping | NOT BUILT | The build notes name editor crop presets as not built, and there is no crop control at all. To finish: add free crop plus ratio presets such as 4 by 5, 1 by 1, and 16 by 9. |
| Edited copy saved back to the gallery | BUILT | Saving creates an edited copy alongside the original rather than destroying it. |
| Export straight from the editor into a client gallery | PARTIAL | Edited copies save into the collection the photo came from. There is no export action that targets a different gallery or a new gallery. To finish: add an export destination picker on save. |
| Editor sold as a paid add on at about 12 dollars a month | NOT BUILT | The editor is unlocked for everyone in the replica and no add on is sold. To finish: this needs plan enforcement and billing, which the replica deliberately does not run. |

## Mobile Gallery App

| Feature | Status | Notes |
|---|---|---|
| Per collection installable gallery app | BUILT | Each collection can have an app page with its own manifest and generated icon, built for Add to Home Screen. |
| App is per client | PARTIAL | The app is unique per collection, not per client. Two clients of the same gallery share one app. To finish: key apps to a client registration as well as a collection. |
| Client photos inside the app | BUILT | The app shows a cover hero and a preview strip and opens the full gallery. |
| Photographer branding in the app | BUILT | The app shows the photographer's brand name, logo mark, and app icon. |
| Photographer contact details in the app | BUILT | Email and Call actions are on the app page. |
| Photographer social links in the app | NOT BUILT | The app page renders no social links even where the website has them. To finish: pull the photographer's social links into the app page. |
| Event date shown in the app | BUILT | The collection event date is displayed on the app page. |
| Install prompt and Add to Home Screen | PARTIAL | The page is installable through the browser's own Add to Home Screen behaviour with a manifest and icon. There is no service worker and no in page install prompt button, so the experience depends on the browser. To finish: add a service worker and an install prompt where the browser supports it. |
| Free plan limit of 3 apps, paid plans unlimited | NOT BUILT | No plan limits are enforced anywhere in the replica, so apps are unlimited for everyone. To finish: this needs the plan system, which is display only by design. |
| Photographer side mobile management through a mobile optimised web dashboard | BUILT | The dashboard is responsive web software, so collections, studio, and store can be managed from a phone browser. |

## Pricing and Plans

| Feature | Status | Notes |
|---|---|---|
| Public pricing page | BUILT | A public pricing page presents the plan ladders. |
| Client Gallery ladder: Free, Basic, Plus, Pro, Ultimate with researched prices | BUILT | The ladder is shown with the researched monthly and annual figures as display data. |
| Website ladder: Free, Plus, Pro with researched prices | BUILT | Shown on the pricing page and in Settings, Plan. |
| Studio Manager ladder: Free, Plus, Pro with researched prices | BUILT | Shown on the pricing page and in Settings, Plan. |
| Suite ladder: Starter, Pro, Ultimate with researched prices | BUILT | The bundle ladder is shown with its researched figures. |
| In app Plan page in Settings | BUILT | Settings shows the same ladders so a photographer can compare plans inside the app. |
| All features unlocked regardless of plan in the replica | BUILT | This is the replica's stated rule: pricing is display only and nothing is paywalled. |
| Subscription sign up and payment for a plan | NOT BUILT | No plan can be bought. There is no checkout, because no billing processor is connected. To finish: connect a subscription billing service and a plan checkout. |
| Subscription auto renewal | NOT BUILT | There are no subscriptions to renew. To finish: this comes with the billing integration above. |
| Plan changes with proration | NOT BUILT | There is no plan state to change. To finish: model the current plan and use the billing service's proration on changes. |
| Cancellation behaviour: no refunds, account closes at cancellation | NOT BUILT | There is nothing to cancel. This is also a policy choice, not only a feature. To finish: define the policy first, then implement it in the billing flow. |
| Free plan store commission of 15 percent | NOT BUILT | Store orders are not charged any commission, because no real payments or payouts exist. To finish: compute commission once real payouts exist. |
| Commission charged on the pre discount subtotal | NOT BUILT | Same blocker: no commission exists at all. To finish: define commission on the pre discount subtotal when payout maths is built. |
| Branding removal on paid plans | NOT BUILT | There is no plan state, so branding cannot be tied to a plan. The replica simply does not force platform branding onto client pages. To finish: add plan state and gate the branding toggle on it. |
| Custom domain unlocked by a paid Website plan | NOT BUILT | The domain field is available to everyone and is display only. To finish: gate and wire it with real domain routing and plan state. |
| Full resolution downloads unlocked by a paid Gallery plan | NOT BUILT | Original size downloads are available to everyone in the replica. To finish: add plan state and cap free accounts at 3600px. |
| Gallery Free caps: 3 mobile apps, no video, high res capped at 3600px | NOT BUILT | None of the free caps are enforced. Apps are unlimited and originals download freely. Video is absent for a different reason, covered in Client Gallery. To finish: add plan state and enforce the caps. |
| Studio Manager Free caps: 3 contracts, 3 quotes and questionnaires, 1 session type, unlimited invoices | NOT BUILT | Nothing is capped in the replica. Every account gets unlimited documents and session types. To finish: add plan state and counters on those four objects. |
| Website Free caps: 15 pages, 100 photos, 5 blog posts | NOT BUILT | Pages, photos, and posts are unlimited in the replica. To finish: add plan state and enforce the three caps. |
| Higher tiers buy video hours and email campaign amounts | NOT BUILT | There is no video and no campaign product, and no plan state to hold the allowances. To finish: build video and campaigns first, then meter them by plan. |
| RAW and 4K unlocked at Gallery Pro | NOT BUILT | RAW and video are not built at any level. To finish: build RAW and video, then gate them if plan parity is wanted. |
| Custom fonts and custom code unlocked at Website Pro | NOT BUILT | Neither custom fonts nor custom code exist in the replica. To finish: build both features first, then gate them. |
| Retainers at booking and manual approval unlocked at Studio Manager Pro | PARTIAL | Retainer collection inside the booking flow is built, as a mock payment, for every account. Manual approval is not built at all. To finish: build manual approval, then decide whether either feature should be plan gated. |
| Studio volume plans at 48, 64, and 96 dollars with 2 TB, 5 TB, and 10 TB | NOT BUILT | The volume ladder is not in the pricing data. Storage sizes are part of the excluded storage product, but the plan rows themselves were not reproduced. To finish: add the three rows to the pricing display. |
| IP whitelisting on Studio volume plans | NOT BUILT | There is no IP allow list for account access. To finish: add an allow list checked at login and session creation. |
| Unlimited login sessions on Studio volume plans | NOT BUILT | Sessions are ordinary cookie sessions with no session management screen. To finish: add a sessions list with revoke actions. |
| No bandwidth restrictions on Studio volume plans | NOT BUILT | Bandwidth is not measured or restricted for anyone, so there is nothing to lift. To finish: nothing needed unless bandwidth metering is ever introduced. |
| Add on: extra video at 5 dollars a month per hour | NOT BUILT | Not in the pricing data and there is no video to extend. To finish: add the row to the pricing display once video exists. |
| Add on: extra email campaigns at 10 dollars a month per 5000 sends | NOT BUILT | Not in the pricing data and there is no campaign product. To finish: add the row once campaigns exist. |
| Add on: Photo Editor at about 12 dollars a month | NOT BUILT | The editor is built but is not presented or sold as an add on. To finish: add the add on row to the pricing display. |

## Platform and Account

| Feature | Status | Notes |
|---|---|---|
| One account holding all products in one dashboard | BUILT | Galleries, Website, Studio Manager, Store, Editor, Mobile Apps, Reports, Automations, Team, and Settings live in one signed in app. |
| Separate dashboards per product, switched from the top of the account | PARTIAL | Each product has its own area and navigation, but switching is through one shared dashboard sidebar rather than a product switcher at the top of the account page. To finish: add a product switcher that swaps the navigation per product. |
| Client Gallery dashboard pages: Collections, Settings, Tools | PARTIAL | Collections and gallery settings exist. There is no Tools page, because the Lightroom plugin it would hold is not built. To finish: add a Tools area when the plugin exists. |
| Gallery account settings: custom domain, watermark, logo, homepage, default settings, Google Analytics | PARTIAL | Watermark text, logo, and collection defaults through presets are built. Gallery custom domain, a gallery homepage, and Google Analytics are not. To finish: add a gallery settings page carrying all six items. |
| Per collection screen with header actions and Photos, Collection Settings, Activities tabs | BUILT | The collection screen has those three tabs plus share and public view actions. |
| Dashboard look: collection cards with cover thumbnails | BUILT | The collections list shows cover based cards with status, folder, and quick actions. |
| Live preview pane in design settings | BUILT | Collection design settings show a live palette and typography preview before saving. |
| Consistent branding across website, gallery, store, booking, contracts, and invoices | PARTIAL | Website, gallery, and store share palettes, fonts, and business identity. Contracts and invoices use a plainer shared document style and do not take the site palette and fonts. To finish: theme document pages from the same brand settings. |
| Sign up issues a free subdomain | PARTIAL | A site slug gives a mypixelset style address in the dashboard, rendered as a path. A real subdomain is not issued. To finish: add host based routing as described under Website. |
| Store onboarding path with a Get Started checklist | BUILT | The store overview checklist covers price sheet, assignment, tax and license review, and first order. |
| Studio Manager onboarding path: branding, profile, contacts, payments, first documents, booking setup | PARTIAL | All of those areas exist and can be set up in any order. There is no guided step by step studio onboarding sequence. To finish: add a studio setup checklist mirroring the store one. |
| Website onboarding path: pick template, replace content, customise, SEO checklist, connect domain, publish | PARTIAL | Template picking, editing, the SEO manager, domain field, and publishing all exist as separate screens. There is no single guided website setup flow. To finish: add a website setup checklist that links each step. |
| In dashboard support chat bubble | NOT BUILT | There is no support chat anywhere in the app. To finish: embed a support chat service or build a simple support message form. |
| Team members with roles: Owner, Assistant, Second Shooter | BUILT | Team members can be added with one of three roles, and permissions are enforced on the server for the areas each role may touch. |
| Work as a role to preview permissions | BUILT | A role switcher lets the owner act as a role and see exactly what it can reach. |
| Team members get their own logins | NOT BUILT | Team members are records with permissions, not accounts. Nobody on the team can sign in as themselves. To finish: add invitations that create linked user accounts carrying the member's role. |
| Bulk data export of your own data | BUILT | Clients, invoices, bookings, orders, and favorites export as CSV or JSON from the Reports page. |
| Account settings: business name, logo, watermark text, currency | BUILT | Profile and brand settings are editable in Settings. |
| Help centre and product documentation inside the app | NOT BUILT | There is no help section. To finish: add a help area linking product guides. |

## Extras: what users asked for and complained about

These rows come from the research section on user requested features and complaints. Each is accounted once, here, as a request or a quality problem rather than as a normal product feature.

| Request or complaint | Status | Notes |
|---|---|---|
| 1. True workflow automation: conditional workflows and automated marketing sequences | PARTIAL | The replica builds a conditional automation builder with four triggers, condition rows, actions, and a run log, which is more than the researched product offers. It has no multi step marketing or upsell sequences, each automation fires once per target, and its emails are logged, not sent. To finish: add sequence steps with delays and connect a mail service. |
| 2. Customisable wording on reminder emails | BUILT | Five reminder templates are fully editable in Settings, which answers the exact complaint that reminder wording is fixed. |
| 3. Post delivery automated follow up and review request sequences | NOT BUILT | There is no delivery triggered sequence. A feedback questionnaire can be sent by hand. To finish: add a gallery delivered trigger with timed follow up and review request steps. |
| 4. Slow and failing uploads on large wedding galleries | PARTIAL | Uploads are simple per file requests with no queue, resume, or chunking, so the replica would struggle with a very large gallery in the same way. It has not been load tested with a full wedding gallery. To finish: add chunked, resumable uploads with retry and test with a 1000 photo gallery. |
| 5. Broken and confusing mobile downloads for clients | PARTIAL | Mobile clients can download single photos and the ZIP in the browser. There is no iPhone specific save to photos guidance and no test evidence on a real iPhone flow. To finish: add device aware download instructions and test on iOS Safari and Android Chrome. |
| 6. Preview compression and blurry gallery images | PARTIAL | Previews are the stored image files shown through CSS, and watermarking is an overlay, so the replica does not recompress previews into softer versions. There is also no photographer control over preview quality because no preview renditions are generated. To finish: generate sized preview renditions with a quality setting. |
| 7. Video treated as a second class citizen | NOT BUILT | The replica has no gallery video at all, so video favorites, timecode notes, and video sales are all absent too. To finish: build video first, then add favorites, timecode comments, and store video products. |
| 8. Limited gallery and storefront customisation | PARTIAL | Galleries have nine palettes, six font pairings, seven cover styles, and grid controls, and stores take the gallery theme. Album branding and deeper storefront layout control are absent. To finish: add storefront layout options and album branding controls. |
| 9. No photographer side mobile management app | PARTIAL | Studio Manager has no native app, covered in its own section. Gallery management works in the mobile web dashboard but has not been audited screen by screen against desktop. To finish: audit the dashboard on a phone and fix the screens that lag. |
| 10. Pricing friction and paywall fragmentation across products | BUILT | The replica answers this by design: one account, every product unlocked, pricing shown for reference only, and no feature held behind a second subscription. |
| 11. No bulk export and a painful exit from the platform | PARTIAL | Clients, invoices, bookings, orders, and favorites export in bulk. There is no bulk download of all gallery photos and files to migrate away with. To finish: add an account level export that bundles every collection's original files. |
| 12. Website SEO weakness compared with WordPress and similar tools | PARTIAL | Titles, descriptions, alt text audit, redirects, and a sitemap are built. Broken link checks are missing, subdirectory hosting is not possible because sites live under their own slug path, and no ranking outcome can be promised by any builder. To finish: add the link checker and, if needed, reverse proxy support for serving the site under an existing domain path. |
| 13. Print quality problems and weak support recourse on lab orders | NOT BUILT | There are no real lab orders, so print quality cannot be delivered or judged, and there is no support or reprint process. To finish: this only becomes real with a lab integration, a sample order test, and a written reprint policy. |
| 14. Role based and tiered download permissions for vendors, second shooters, and family | PARTIAL | Client Exclusive sets give one named client special access, and team roles govern dashboard access. There is no way to give a vendor or family member their own download rights inside a gallery. To finish: add per viewer access groups with their own download permissions per set. |
| 15. Weak reporting and no accounting or CRM integrations | PARTIAL | A reporting dashboard computes revenue, bookings, gallery views, downloads, favorites, and conversion from real data, and exports are built. There are no QuickBooks or other accounting and CRM integrations. To finish: add export mappings or API integrations for the main accounting tools. |
| 16. No team seats or multi user roles named on pricing pages | BUILT | Team roles are built in the app with three named roles and enforced permissions. They are not tied to pricing, because nothing is plan gated. |
| 17. Cancellation and refund behaviour, and regional payment gaps | NOT BUILT | There are no subscriptions to cancel and no live payments, so refunds, regional payment coverage, and currency billing cannot exist yet. To finish: these arrive with real billing and payment integrations, plus a written refund policy. |
| 18. In gallery slideshow with music | BUILT | A gallery slideshow is built and takes a music URL. The music must be a direct audio link, since there is no upload or track library. |
| 19. Workshops and courses selling tab with per course passcode access | NOT BUILT | There is no courses product. A workshop can be sold as a session type or a website page, but not as a passcode protected course. To finish: build a course object with content pages and per course passcodes. |
| 20. Deeper and shareable album design control | NOT BUILT | The album designer is not built at all, covered in the Store section. Shareable album proofs would come after it. To finish: build the designer, then add a client proof link with comments and approval. |
| 21. Receipt printing header cut off | NOT BUILT | Invoices render as web pay pages and a PDF style document page. Print layout has not been tested or tuned, so header clipping cannot be ruled out. To finish: add print styles and test invoice and receipt printing. |

## Excluded by owner's order

The photo cloud storage product is excluded by the owner's order. That means storage tiers, storage amounts per plan, storage paywalls, and storage upsells are not part of this replica and are not counted as gaps anywhere in this document. The owner uses Picflow for his own photo storage and delivery, so Pixelset galleries here hold photos that are uploaded to the app or linked by URL for the purpose of running the gallery, studio, and store features. Nothing in this section is a missing feature. It was left out on purpose.

## The short list of real gaps

These are the not built and partial items a paying photographer would actually notice in daily work, ranked by how much they would feel the absence.

1. No real money movement anywhere. Store checkout, invoice payments, booking retainers, and Tap to Pay are all mock. A photographer cannot take a single real payment through the replica yet. Fixing it means connecting one real payment processor and wiring it into the store, the pay pages, and the booking flow.
2. No real email delivery. Invites, booking confirmations, reminders, automation emails, and purchased download links are recorded or logged instead of sent, because no mail service is connected. Clients would never actually receive anything. One email service integration closes most of this gap at once.
3. No video in galleries. No uploads, no player, no video favorites or timecode notes, no video sales. Wedding and event photographers who deliver highlight films would hit this on day one.
4. No RAW support. RAW files cannot be uploaded, delivered, or edited, which shuts out the Pro tier workflow the research describes.
5. No real lab fulfilment. Automatic fulfilment is simulated, so no print order can actually be printed and shipped, and there are no payouts, refunds, or reprints.
6. No client album designer. Clients can buy an album but cannot lay out spreads or approve a design, which is a core wedding workflow.
7. Regular session booking has no real availability engine. Regular bookings use an open date and time picker that cannot see other bookings, and Google Calendar sync is a settings toggle only, so double bookings are possible. Mini sessions, by contrast, have real generated slots.
8. No custom domain or subdomain routing for websites and galleries. Sites live under a path, and the domain field is display only, so a photographer cannot present the site on their own domain.
9. No Studio Manager native mobile app, and no team member logins. Assistants and second shooters exist as permission records but cannot sign in, and on the go studio work is web only.
10. Uploads are not built for very large galleries. There is no background, chunked, or resumable uploading and no Lightroom plugin, which is the exact pain point photographers complain about most after automation.

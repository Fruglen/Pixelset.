import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";
import { mkdir, rm } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { createWebsiteForUser } from "../src/lib/site-service";
import { seed5b } from "./seed-5b";

const db = new PrismaClient();

// Keep libvips on a short leash: the boot seed runs inside a 512MB instance,
// and sharp's operation cache + parallel pipelines inflate RSS fast.
sharp.cache(false);
sharp.concurrency(1);

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// External sample photos (Lorem Picsum — used only in the draft collection to
// demonstrate the add-by-URL flow; everything else is generated locally).
const pic = (id: number, w = 1600, h = 1067) => `https://picsum.photos/id/${id}/${w}/${h}`;

// Locally generated demo photos so the demo works offline and downloads are instant.
const SEED_DIR = path.join(process.cwd(), "public", "uploads", "seed");

async function generateImage(name: string, w: number, h: number, hue: number, label: string) {
  const c1 = `hsl(${hue}, 32%, 78%)`;
  const c2 = `hsl(${(hue + 50) % 360}, 38%, 30%)`;
  const c3 = `hsl(${(hue + 180) % 360}, 28%, 88%)`;
  const r = Math.min(w, h);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="${w * 0.72}" cy="${h * 0.28}" r="${r * 0.17}" fill="${c3}" opacity="0.55"/>
  <circle cx="${w * 0.2}" cy="${h * 0.75}" r="${r * 0.28}" fill="${c2}" opacity="0.35"/>
  <text x="50%" y="53%" font-family="Georgia, serif" font-size="${r * 0.07}" fill="rgba(255,255,255,0.9)" text-anchor="middle">${label}</text>
</svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(path.join(SEED_DIR, name));
}

async function main() {
  // Boot guard: on instance restarts the database already has the demo
  // account, so skip the (heavy) seed entirely. SEED_FORCE=1 rebuilds.
  const existing = await db.user.findUnique({ where: { email: "demo@pixelset.app" } });
  if (existing && !process.env.SEED_FORCE) {
    console.log("Demo account already seeded — skipping seed (set SEED_FORCE=1 to rebuild).");
    return;
  }
  // Idempotent: wipe the demo user and rebuild
  await db.user.deleteMany({ where: { email: "demo@pixelset.app" } });
  await rm(SEED_DIR, { recursive: true, force: true });
  await mkdir(SEED_DIR, { recursive: true });

  const user = await db.user.create({
    data: {
      email: "demo@pixelset.app",
      passwordHash: hashPassword("demo1234"),
      name: "Demo Photographer",
      businessName: "Light & Shadow Studio",
      watermarkText: "LIGHT & SHADOW",
    },
  });

  const weddingFolder = await db.folder.create({
    data: { userId: user.id, name: "Weddings" },
  });
  await db.folder.create({ data: { userId: user.id, name: "Portraits" } });

  // ---------- Collection 1: published wedding, full feature set ----------
  const wedding = await db.collection.create({
    data: {
      userId: user.id,
      folderId: weddingFolder.id,
      name: "Emma & James — Wedding",
      slug: "emma-james-wedding",
      eventDate: new Date("2026-10-18T12:00:00"),
      status: "PUBLISHED",
      coverStyle: "novel",
      fontPairing: "editorial",
      palette: "ivory",
      gridStyle: "vertical",
      thumbSize: "regular",
      gridSpacing: "regular",
      password: "tuscany",
      emailRegistration: false,
      watermark: false,
      downloadEnabled: true,
      pinEnabled: true,
      downloadPin: "4821",
      pinUseLimit: 50,
      freeDownloadCap: 20,
      downloadSizes: "original,high3600,web2048,web640",
      allowSingle: true,
      allowZip: true,
    },
  });

  const gettingReady = await db.photoSet.create({
    data: { collectionId: wedding.id, name: "Getting Ready", order: 0 },
  });
  const ceremony = await db.photoSet.create({
    data: { collectionId: wedding.id, name: "Ceremony", order: 1 },
  });
  const reception = await db.photoSet.create({
    data: { collectionId: wedding.id, name: "Reception", order: 2 },
  });
  const familyOnly = await db.photoSet.create({
    data: {
      collectionId: wedding.id,
      name: "Family Formals",
      order: 3,
      clientExclusive: true,
      clientEmail: "emma@example.com",
      clientPassword: "family2026",
    },
  });

  const photoIds: string[] = [];
  let hue = 18;
  const makePhotos = async (setId: string, count: number, offset: number) => {
    for (let i = 0; i < count; i++) {
      const portrait = i % 3 === 1; // mix orientations for the masonry grid
      const w = portrait ? 1067 : 1600;
      const h = portrait ? 1600 : 1067;
      const filename = `IMG_${String(offset + i).padStart(4, "0")}.jpg`;
      await generateImage(filename, w, h, hue, filename.replace(".jpg", ""));
      hue = (hue + 37) % 360;
      const p = await db.photo.create({
        data: {
          collectionId: wedding.id,
          setId,
          filename,
          url: `/uploads/seed/${filename}`,
          isExternal: false,
          width: w,
          height: h,
          order: i,
        },
      });
      photoIds.push(p.id);
    }
  };
  await makePhotos(gettingReady.id, 5, 1001);
  await makePhotos(ceremony.id, 6, 1101);
  await makePhotos(reception.id, 5, 1201);
  await makePhotos(familyOnly.id, 3, 1301);

  await db.collection.update({
    where: { id: wedding.id },
    data: { coverPhotoId: photoIds[5] },
  });

  // One private photo
  await db.photo.update({ where: { id: photoIds[3] }, data: { isPrivate: true } });

  // Registered client + favorite list with notes
  await db.emailRegistration.create({
    data: { collectionId: wedding.id, email: "emma@example.com" },
  });
  const list = await db.favoriteList.create({
    data: {
      collectionId: wedding.id,
      clientEmail: "emma@example.com",
      clientName: "Emma",
      name: "Album Picks",
      selectionLimit: 30,
    },
  });
  await db.favorite.create({
    data: { listId: list.id, photoId: photoIds[0], note: "Love this one — full page in the album?" },
  });
  await db.favorite.create({ data: { listId: list.id, photoId: photoIds[6] } });
  await db.favorite.create({
    data: { listId: list.id, photoId: photoIds[11], note: "Please retouch the background" },
  });

  await db.comment.create({
    data: {
      collectionId: wedding.id,
      photoId: photoIds[6],
      authorEmail: "emma@example.com",
      authorName: "Emma",
      body: "This is exactly the moment we hoped you'd catch. Thank you!",
    },
  });

  await db.invite.create({
    data: {
      collectionId: wedding.id,
      email: "emma@example.com",
      message: "Your full wedding gallery is ready — password is tuscany. Enjoy!",
    },
  });

  const quickShare = await db.quickShare.create({
    data: {
      collectionId: wedding.id,
      token: "demoquickshare01",
      photoIds: [photoIds[5], photoIds[6], photoIds[8]].join(","),
    },
  });

  const log = (type: string, detail: string, clientEmail = "", minutesAgo = 0) =>
    db.activity.create({
      data: {
        collectionId: wedding.id,
        type,
        detail,
        clientEmail,
        createdAt: new Date(Date.now() - minutesAgo * 60_000),
      },
    });
  await log("INVITE_SENT", "Invite email sent to emma@example.com", "emma@example.com", 2880);
  await log("EMAIL_REGISTRATION", "Registered to view gallery", "emma@example.com", 2700);
  await log("VIEW", "Gallery opened", "emma@example.com", 2690);
  await log("LIST_CREATED", "Favorite list “Album Picks” created", "emma@example.com", 2650);
  await log("FAVORITE", "IMG_1001.jpg added to “Album Picks”", "emma@example.com", 2640);
  await log("FAVORITE", "IMG_1102.jpg added to “Album Picks”", "emma@example.com", 2635);
  await log("COMMENT", "Comment on IMG_1102.jpg: “This is exactly the moment…”", "emma@example.com", 2600);
  await log("DOWNLOAD", "IMG_1102.jpg (High Resolution (3600px))", "emma@example.com", 1400);
  await log("VIEW", "Gallery opened", "", 300);
  await log("QUICK_SHARE_CREATED", "3 photos shared via quick link", "", 120);

  await db.downloadLog.create({
    data: {
      collectionId: wedding.id,
      photoId: photoIds[6],
      clientKey: "emma@example.com",
      size: "high3600",
    },
  });

  // ---------- Collection 2: pre-release portrait session ----------
  const portraits = await db.collection.create({
    data: {
      userId: user.id,
      name: "Rivera Family — Fall Portraits",
      slug: "rivera-family-fall",
      eventDate: new Date("2026-11-08T12:00:00"),
      status: "PRERELEASE",
      coverStyle: "stripe",
      fontPairing: "elegant",
      palette: "sage",
      gridStyle: "horizontal",
      thumbSize: "large",
      gridSpacing: "large",
      emailRegistration: true,
      watermark: true,
      downloadEnabled: false,
      downloadSizes: "web2048,web1024",
    },
  });
  const outdoorSet = await db.photoSet.create({
    data: { collectionId: portraits.id, name: "Golden Hour", order: 0 },
  });
  const portraitIds: string[] = [];
  let pHue = 95;
  for (let i = 0; i < 6; i++) {
    const portrait = i % 2 === 0;
    const w = portrait ? 1067 : 1600;
    const h = portrait ? 1600 : 1067;
    const filename = `RIV_${String(2001 + i)}.jpg`;
    await generateImage(filename, w, h, pHue, filename.replace(".jpg", ""));
    pHue = (pHue + 24) % 360;
    const p = await db.photo.create({
      data: {
        collectionId: portraits.id,
        setId: outdoorSet.id,
        filename,
        url: `/uploads/seed/${filename}`,
        isExternal: false,
        width: w,
        height: h,
        order: i,
      },
    });
    portraitIds.push(p.id);
  }
  await db.collection.update({
    where: { id: portraits.id },
    data: { coverPhotoId: portraitIds[0] },
  });
  await db.emailRegistration.create({
    data: { collectionId: portraits.id, email: "maria.rivera@example.com" },
  });
  await db.activity.create({
    data: {
      collectionId: portraits.id,
      type: "EMAIL_REGISTRATION",
      detail: "Registered for pre-release notification",
      clientEmail: "maria.rivera@example.com",
    },
  });

  // ---------- Collection 3: draft, dark palette ----------
  const brandShoot = await db.collection.create({
    data: {
      userId: user.id,
      name: "Northline Coffee — Brand Shoot",
      slug: "northline-coffee-brand",
      status: "DRAFT",
      coverStyle: "journal",
      fontPairing: "modern",
      palette: "noir",
      gridStyle: "vertical",
      downloadSizes: "original,web2048",
    },
  });
  const productSet = await db.photoSet.create({
    data: { collectionId: brandShoot.id, name: "Products", order: 0 },
  });
  for (const [i, id] of [425, 431, 435, 442].entries()) {
    await db.photo.create({
      data: {
        collectionId: brandShoot.id,
        setId: productSet.id,
        filename: `NLC_${String(3001 + i)}.jpg`,
        url: pic(id),
        isExternal: true,
        width: 1600,
        height: 1067,
        order: i,
      },
    });
  }

  // ---------- Collection Preset ----------
  await db.preset.create({
    data: {
      userId: user.id,
      name: "Wedding Delivery (PIN + caps)",
      settings: JSON.stringify({
        coverStyle: "novel",
        fontPairing: "editorial",
        palette: "ivory",
        gridStyle: "vertical",
        thumbSize: "regular",
        gridSpacing: "regular",
        emailRegistration: false,
        watermark: false,
        downloadEnabled: true,
        pinEnabled: true,
        pinUseLimit: 50,
        freeDownloadCap: 20,
        downloadSizes: "original,high3600,web2048",
        allowSingle: true,
        allowZip: true,
        expiryReminder: true,
      }),
    },
  });

  // ---------- Phase 2: demo website ----------
  const website = await createWebsiteForUser(user.id, {
    slug: "light-and-shadow",
    templateId: "vienna",
    logoText: "Light & Shadow Studio",
  });
  await db.website.update({
    where: { id: website.id },
    data: {
      tagline: "Fine-art wedding photography",
      customDomain: "www.lightandshadow.studio",
      socialInstagram: "https://instagram.com/lightandshadow",
      socialPinterest: "https://pinterest.com/lightandshadow",
      footerText: "© 2026 Light & Shadow Studio · Austin, Texas",
    },
  });

  // Point the Portfolio page's live collection embed at the seeded wedding gallery,
  // and give Home a search listing so the SEO manager has data to show.
  const portfolioPage = await db.sitePage.findFirst({ where: { websiteId: website.id, type: "PORTFOLIO" } });
  if (portfolioPage) {
    const blocks = JSON.parse(portfolioPage.blocks) as { type: string; props: Record<string, unknown> }[];
    for (const block of blocks) {
      if (block.type === "collectionEmbed") block.props.collectionSlug = "emma-james-wedding";
    }
    await db.sitePage.update({ where: { id: portfolioPage.id }, data: { blocks: JSON.stringify(blocks) } });
  }
  const homePage = await db.sitePage.findFirst({ where: { websiteId: website.id, type: "HOME" } });
  if (homePage) {
    await db.sitePage.update({
      where: { id: homePage.id },
      data: {
        seoTitle: "Light & Shadow Studio — Austin Wedding Photographer",
        seoDescription: "Fine-art wedding photography in Austin, Texas. Quiet, intentional imagery made to be printed, framed and handed down.",
      },
    });
  }

  // Blog posts (stored separately from pages, so they survive template switches).
  await generateImage("blog-tuscany.jpg", 1600, 1000, 36, "Tuscany");
  await generateImage("blog-prep.jpg", 1600, 1000, 150, "Getting Ready");
  await generateImage("blog-prints.jpg", 1600, 1000, 20, "The Print Shelf");
  const posts = [
    {
      title: "Emma & James — a Tuscany wedding",
      slug: "emma-james-tuscany-wedding",
      excerpt: "Three days in the hills above Florence, one thunderstorm, and the calmest couple we've ever photographed.",
      coverUrl: "/uploads/seed/blog-tuscany.jpg",
      coverAlt: "Golden-hour hills above the Tuscany wedding venue",
      publishedAt: new Date("2026-11-02T10:00:00"),
      body: `Some weddings you photograph; this one we lived inside for three days.

## The villa
Emma and James rented a crumbling villa above Florence and filled it with people they love. The light through those shutters at 6pm belongs in a museum.

A thunderstorm rolled in twenty minutes before the ceremony. Nobody panicked — least of all the bride.

> "If it rains, we get married in the rain." — Emma, completely serious

## What we learned
Trust the day you actually get, not the one on the mood board. The storm photos are the ones everyone asks about.

The full gallery is now live in the client area for family and friends.`,
    },
    {
      title: "How to plan your getting-ready photos",
      slug: "plan-getting-ready-photos",
      excerpt: "The morning sets the tone for the whole gallery. Five things that make it effortless.",
      coverUrl: "/uploads/seed/blog-prep.jpg",
      coverAlt: "Wedding dress hanging in window light during preparations",
      publishedAt: new Date("2026-10-14T09:00:00"),
      body: `The getting-ready hour produces more heirloom photographs per minute than any other part of the day. A little planning goes a long way.

## Find the window
Get dressed near the biggest window in the room. Lamps off — mixed light is the enemy of skin tones.

## Declutter one corner
We only need one beautiful corner. Shopping bags and water bottles migrate into every wide shot.

## Build in ten quiet minutes
Ten minutes alone — or with one parent — before you walk out the door. Those frames are always the ones that end up printed large.`,
    },
    {
      title: "Why we still believe in prints",
      slug: "why-we-believe-in-prints",
      excerpt: "Hard drives fail and feeds scroll away. A short case for the photograph you can hold.",
      coverUrl: "/uploads/seed/blog-prints.jpg",
      coverAlt: "Fine-art prints resting on a wooden shelf",
      publishedAt: new Date("2026-09-20T08:30:00"),
      body: `Every year we ask couples what they did with their photographs. The happiest answers are never about files.

## The shoebox test
The photographs your grandchildren will find are the ones that exist on paper. Nobody inherits a Dropbox folder.

## Start small
One album, three frames. That's it. The gallery stays online for a year — but the prints are the point.`,
    },
  ];
  for (const post of posts) {
    await db.blogPost.create({
      data: { websiteId: website.id, status: "PUBLISHED", ...post },
    });
  }

  // A 301 redirect, and a few inbox submissions from the public site forms.
  await db.siteRedirect.create({
    data: { websiteId: website.id, fromPath: "/investment", toPath: "/pricing" },
  });
  await db.siteMessage.create({
    data: {
      websiteId: website.id,
      kind: "CONTACT",
      name: "Olivia Grant",
      email: "olivia.grant@example.com",
      phone: "+1 512 555 0164",
      subject: "June 2027 wedding — are you free?",
      body: "Hi! We're getting married June 12, 2027 at Mercury Hall in Austin (about 90 guests). Your Tuscany gallery made my mother cry. Are you available, and what collection would you recommend?",
      createdAt: new Date("2026-11-15T14:22:00"),
    },
  });
  await db.siteMessage.create({
    data: {
      websiteId: website.id,
      kind: "BOOKING",
      name: "Marcus Lee",
      email: "marcus.lee@example.com",
      subject: "Booking request: Brand shoot",
      body: "Opening a coffee bar in East Austin — need founder portraits and interior shots before our December launch.",
      meta: "Brand shoot · preferred date 2026-12-02",
      createdAt: new Date("2026-11-16T09:05:00"),
    },
  });
  await db.siteMessage.create({
    data: {
      websiteId: website.id,
      kind: "NEWSLETTER",
      email: "jenny.alvarez@example.com",
      subject: "Newsletter signup",
      read: true,
      createdAt: new Date("2026-11-12T19:40:00"),
    },
  });

  // ---------- Phase 3: Studio Manager ----------

  await db.studioProfile.create({
    data: {
      userId: user.id,
      bookingSlug: "light-and-shadow",
      welcomeText:
        "Thanks for considering us for your session. Pick a session below, choose a time, and we'll take care of the rest.",
      businessEmail: "hello@lightandshadow.studio",
      businessPhone: "+1 512 555 0137",
      businessAddress: "2100 South Congress Ave, Austin, TX 78704",
      taxId: "74-1234567",
      defaultTaxRate: 8.25,
      pixelsetPaymentsConnected: true,
      paypalConnected: true,
      paypalEmail: "pay@lightandshadow.studio",
      manualEnabled: true,
      manualInstructions: "Zelle to pay@lightandshadow.studio, or bring a check to the session.",
      googleCalendarSync: true,
    },
  });

  // Contacts
  const emma = await db.contact.create({
    data: {
      userId: user.id,
      name: "Emma James",
      email: "emma@example.com",
      phone: "+1 512 555 0142",
      address: "901 West Ave, Austin, TX",
      tags: "wedding, 2027",
    },
  });
  await db.contactNote.create({
    data: { contactId: emma.id, body: "Loved the Tuscany gallery — wants golden-hour portraits before the reception." },
  });
  await db.contactNote.create({
    data: { contactId: emma.id, body: "Venue confirmed: Mercury Hall. Coordinator is Dana (+1 512 555 0190)." },
  });
  const marcus = await db.contact.create({
    data: {
      userId: user.id,
      name: "Marcus Lee",
      email: "marcus.lee@example.com",
      company: "Northline Coffee",
      tags: "brand",
    },
  });
  const olivia = await db.contact.create({
    data: {
      userId: user.id,
      name: "Olivia Grant",
      email: "olivia.grant@example.com",
      phone: "+1 512 555 0164",
      tags: "wedding, inquiry",
    },
  });
  const sarah = await db.contact.create({
    data: { userId: user.id, name: "Sarah Chen", email: "sarah.chen@example.com", tags: "mini, holiday" },
  });

  // Questionnaire
  const questionnaire = await db.questionnaire.create({
    data: {
      userId: user.id,
      name: "Session Prep",
      fields: JSON.stringify([
        { id: "f1", type: "text", label: "Who is the session for?", options: "", required: true },
        { id: "f2", type: "choice", label: "Preferred style", options: "Candid, Posed, A mix", required: true },
        { id: "f3", type: "date", label: "Any hard deadline for the photos?", options: "", required: false },
        { id: "f4", type: "textarea", label: "Anything we should know beforehand?", options: "", required: false },
      ]),
    },
  });

  // Contract template with smart fields
  const weddingTemplate = await db.contractTemplate.create({
    data: {
      userId: user.id,
      name: "Wedding Photography Agreement",
      body: `PHOTOGRAPHY SERVICES AGREEMENT

This agreement is made on {{today}} between {{business_name}} ("Photographer") and {{client_name}} ("Client").

1. SERVICES
The Photographer will provide the {{session_type}} session on {{session_date}} at {{session_location}}.

2. FEES
The total fee is {{session_price}}. A retainer of {{retainer}} is due at booking and is non-refundable. The remaining balance is due on or before the session date.

3. CANCELLATION
If the Client cancels more than 14 days before the session, any payment beyond the retainer will be refunded. Rescheduling is subject to availability.

4. COPYRIGHT & USAGE
The Photographer retains copyright of all images. The Client receives a personal-use license for delivered photographs.

5. DELIVERY
Edited photographs will be delivered via an online gallery within 6 weeks of the session date.

Agreed and accepted by the parties below.`,
    },
  });

  // Session types
  const weddingType = await db.sessionType.create({
    data: {
      userId: user.id,
      name: "Full Wedding Coverage",
      description:
        "Eight hours of documentary coverage with a fine-art eye — from getting ready to the last dance. Includes an online gallery and print rights.",
      durationMin: 480,
      bufferMin: 60,
      priceCents: 380000,
      taxRate: 8.25,
      locationType: "IN_PERSON",
      location: "Your venue (travel within 100 miles of Austin included)",
      cancellationPolicy: "Cancellations more than 14 days out are refunded beyond the retainer.",
      retainerType: "PERCENT",
      retainerValue: 30,
      contractTemplateId: weddingTemplate.id,
      questionnaireId: questionnaire.id,
    },
  });
  await db.sessionAddOn.create({
    data: { sessionTypeId: weddingType.id, name: "Second shooter", priceCents: 45000, description: "A second photographer for full ceremony + reception coverage.", order: 1 },
  });
  await db.sessionAddOn.create({
    data: { sessionTypeId: weddingType.id, name: "Engagement session", priceCents: 35000, description: "A 60-minute engagement shoot before the big day.", order: 2 },
  });

  const portraitType = await db.sessionType.create({
    data: {
      userId: user.id,
      name: "Portrait Session",
      description: "A relaxed hour on location — families, seniors, headshots. 25+ edited images delivered.",
      durationMin: 60,
      bufferMin: 30,
      priceCents: 45000,
      taxRate: 8.25,
      locationType: "IN_PERSON",
      location: "Zilker Park, Austin",
      cancellationPolicy: "Reschedule free up to 48 hours before your session.",
      retainerType: "FIXED",
      retainerValue: 15000,
      questionnaireId: questionnaire.id,
    },
  });
  await db.sessionAddOn.create({
    data: { sessionTypeId: portraitType.id, name: "10 extra edited photos", priceCents: 7500, order: 1 },
  });

  await db.sessionType.create({
    data: {
      userId: user.id,
      name: "Consultation Call",
      description: "A free 30-minute video call to plan your wedding photography.",
      durationMin: 30,
      priceCents: 0,
      locationType: "ZOOM",
      location: "https://zoom.us/j/5551234567",
      retainerType: "NONE",
    },
  });

  // Mini session with dates + auto-generated slots
  const mini = await db.sessionType.create({
    data: {
      userId: user.id,
      name: "Holiday Mini Sessions",
      description:
        "15 festive minutes under the lights at the Umlauf Sculpture Garden — 5 edited images in time for your cards.",
      isMini: true,
      published: true,
      durationMin: 15,
      priceCents: 17500,
      taxRate: 8.25,
      locationType: "IN_PERSON",
      location: "Umlauf Sculpture Garden, Austin",
      cancellationPolicy: "Mini session payments are non-refundable but transferable to another family.",
      retainerType: "FULL",
      retainerValue: 0,
      showBookedSpots: true,
      waitlistEnabled: true,
    },
  });
  const miniDates = [
    { date: "2026-12-05", startTime: "09:00" },
    { date: "2026-12-12", startTime: "15:00" },
  ];
  const miniSlotIds: string[] = [];
  for (const d of miniDates) {
    const spec = { ...d, slotLengthMin: 15, slotCount: 8, spotsPerSlot: 1, breakEvery: 4, breakMin: 15 };
    const created = await db.miniSessionDate.create({ data: { sessionTypeId: mini.id, ...spec } });
    let cursor = new Date(`${spec.date}T${spec.startTime}:00`);
    for (let i = 0; i < spec.slotCount; i++) {
      const startsAt = new Date(cursor);
      const endsAt = new Date(cursor.getTime() + spec.slotLengthMin * 60_000);
      const slot = await db.miniSlot.create({
        data: { dateId: created.id, startsAt, endsAt, capacity: spec.spotsPerSlot, order: i },
      });
      miniSlotIds.push(slot.id);
      cursor = endsAt;
      if (spec.breakEvery > 0 && (i + 1) % spec.breakEvery === 0 && i + 1 < spec.slotCount) {
        cursor = new Date(cursor.getTime() + spec.breakMin * 60_000);
      }
    }
  }

  // Emma's wedding booking (booked through the booking site)
  const weddingTotal = Math.round(425000 * 1.0825); // coverage + second shooter, 8.25% tax
  const weddingRetainer = Math.round((weddingTotal * 30) / 100);
  const weddingStart = new Date("2027-06-12T14:00:00");
  const weddingBooking = await db.booking.create({
    data: {
      userId: user.id,
      sessionTypeId: weddingType.id,
      contactId: emma.id,
      title: "Full Wedding Coverage",
      startsAt: weddingStart,
      endsAt: new Date(weddingStart.getTime() + 480 * 60_000),
      status: "CONFIRMED",
      totalCents: weddingTotal,
      retainerCents: weddingRetainer,
      paymentStatus: "RETAINER_PAID",
      addOns: JSON.stringify([{ name: "Second shooter", priceCents: 45000 }]),
      notes: "Ceremony at 4pm; golden-hour portraits before the reception.",
      source: "BOOKING_SITE",
    },
  });
  await db.questionnaireResponse.create({
    data: {
      questionnaireId: questionnaire.id,
      bookingId: weddingBooking.id,
      contactId: emma.id,
      respondentName: "Emma James",
      respondentEmail: "emma@example.com",
      answers: JSON.stringify({
        f1: "Emma & James — our wedding",
        f2: "A mix",
        f4: "James's grandmother is flying in from Italy; please get a portrait with her.",
      }),
    },
  });

  // Signed contract for Emma's wedding (full e-sign capture)
  await db.contract.create({
    data: {
      userId: user.id,
      templateId: weddingTemplate.id,
      contactId: emma.id,
      bookingId: weddingBooking.id,
      title: "Wedding Photography Agreement — Emma James",
      body: weddingTemplate.body
        .replace("{{today}}", "November 10, 2026")
        .replace("{{business_name}}", "Light & Shadow Studio")
        .replace("{{client_name}}", "Emma James")
        .replace("{{session_type}}", "Full Wedding Coverage")
        .replace("{{session_date}}", "June 12, 2027")
        .replace("{{session_location}}", "Mercury Hall, Austin")
        .replace("{{session_price}}", "$4,600.63")
        .replace("{{retainer}}", "$1,380.19"),
      status: "SIGNED",
      sentAt: new Date("2026-11-10T09:30:00"),
      signerName: "Emma James",
      signedAt: new Date("2026-11-10T19:42:00"),
      signerIp: "203.0.113.42",
      signerUserAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) Safari/605.1",
    },
  });

  // A second contract still out for signature (with a second signer)
  await db.contract.create({
    data: {
      userId: user.id,
      templateId: weddingTemplate.id,
      contactId: olivia.id,
      title: "Wedding Photography Agreement — Olivia Grant",
      body: weddingTemplate.body
        .replace("{{today}}", "November 16, 2026")
        .replace("{{business_name}}", "Light & Shadow Studio")
        .replace("{{client_name}}", "Olivia Grant")
        .replace("{{session_type}}", "Full Wedding Coverage")
        .replace("{{session_date}}", "June 2027 (date TBC)")
        .replace("{{session_location}}", "Mercury Hall, Austin")
        .replace("{{session_price}}", "$4,113.50")
        .replace("{{retainer}}", "$1,234.05"),
      status: "SENT",
      sentAt: new Date("2026-11-16T10:00:00"),
      secondSignerEmail: "fiance@example.com",
      expiresAt: new Date("2026-12-16T23:59:59"),
    },
  });

  // Invoice with a 3-instalment schedule, first instalment paid
  const invoice = await db.invoice.create({
    data: {
      userId: user.id,
      contactId: emma.id,
      bookingId: weddingBooking.id,
      number: "INV-0001",
      title: "Full Wedding Coverage — Emma & James",
      status: "SENT",
      issueDate: new Date("2026-11-10T10:00:00"),
      dueDate: new Date("2027-06-12T23:59:59"),
      sentAt: new Date("2026-11-10T10:05:00"),
      items: JSON.stringify([
        { description: "Full Wedding Coverage (8 hours)", qty: 1, unitCents: 380000 },
        { description: "Second shooter", qty: 1, unitCents: 45000 },
      ]),
      taxRate: 8.25,
      notes: "Thank you! The balance is split into three payments — the last is due on the wedding day.",
    },
  });
  const instAmounts = [weddingRetainer, Math.round((weddingTotal - weddingRetainer) / 2), 0];
  instAmounts[2] = weddingTotal - instAmounts[0] - instAmounts[1];
  const instDates = ["2026-11-12", "2027-03-01", "2027-06-12"];
  const instLabels = ["Retainer", "Spring payment", "Final balance"];
  for (let i = 0; i < 3; i++) {
    await db.invoiceInstallment.create({
      data: {
        invoiceId: invoice.id,
        label: instLabels[i],
        dueDate: new Date(`${instDates[i]}T23:59:59`),
        amountCents: instAmounts[i],
        paidAt: i === 0 ? new Date("2026-11-11T08:15:00") : null,
        paymentMethod: i === 0 ? "card" : "",
        order: i,
      },
    });
  }

  // A mini-session booking on the first slot (paid in full)
  const firstSlot = await db.miniSlot.findFirst({ where: { id: miniSlotIds[0] } });
  if (firstSlot) {
    const miniTotal = Math.round(17500 * 1.0825);
    const miniBooking = await db.booking.create({
      data: {
        userId: user.id,
        sessionTypeId: mini.id,
        slotId: firstSlot.id,
        contactId: sarah.id,
        title: "Holiday Mini Sessions",
        startsAt: firstSlot.startsAt,
        endsAt: firstSlot.endsAt,
        status: "CONFIRMED",
        totalCents: miniTotal,
        retainerCents: miniTotal,
        paymentStatus: "PAID",
        source: "MINI",
      },
    });
    await db.project.create({
      data: {
        userId: user.id,
        name: "Sarah Chen — Holiday Mini Sessions",
        contactId: sarah.id,
        bookingId: miniBooking.id,
        stage: "BOOKED",
        order: 2,
      },
    });
  }

  // Quote out for review
  await db.quote.create({
    data: {
      userId: user.id,
      contactId: olivia.id,
      number: "QT-0001",
      title: "June 2027 wedding — collection options",
      status: "SENT",
      sentAt: new Date("2026-11-16T09:00:00"),
      items: JSON.stringify([
        { description: "Full Wedding Coverage (8 hours)", qty: 1, unitCents: 380000 },
        { description: "Heirloom album (30 pages)", qty: 1, unitCents: 65000 },
      ]),
      taxRate: 8.25,
      discountType: "FIXED",
      discountValue: 20000,
      notes: "Includes a $200 off-season discount. Accept online and we'll turn this into an invoice.",
      validUntil: new Date("2026-12-16T23:59:59"),
    },
  });

  // Projects board
  await db.project.create({
    data: {
      userId: user.id,
      name: "Emma James — Full Wedding Coverage",
      contactId: emma.id,
      bookingId: weddingBooking.id,
      stage: "BOOKED",
      order: 1,
    },
  });
  await db.project.create({
    data: {
      userId: user.id,
      name: "Olivia Grant — June 2027 wedding",
      contactId: olivia.id,
      stage: "INQUIRY",
      order: 1,
      notes: "Quote QT-0001 sent; contract out with second signer.",
    },
  });
  await db.project.create({
    data: {
      userId: user.id,
      name: "Northline Coffee — brand shoot",
      contactId: marcus.id,
      stage: "IN_PROGRESS",
      order: 1,
      notes: "Interior shots done; founder portraits scheduled.",
    },
  });
  await db.project.create({
    data: {
      userId: user.id,
      name: "Rivera Family — fall portraits",
      stage: "DELIVERED",
      order: 1,
      notes: "Gallery delivered — waiting on print order.",
    },
  });

  // Studio inbox
  await db.studioMessage.create({
    data: {
      userId: user.id,
      kind: "BOOKING",
      name: "Emma James",
      email: "emma@example.com",
      subject: "New booking: Full Wedding Coverage — Emma James",
      body: "Emma James booked Full Wedding Coverage on June 12, 2027 ($4,600.63 total, $1,380.19 retainer due).",
      createdAt: new Date("2026-11-10T09:28:00"),
      read: true,
    },
  });
  await db.studioMessage.create({
    data: {
      userId: user.id,
      kind: "CONTRACT",
      name: "Emma James",
      email: "emma@example.com",
      subject: "Contract signed: Wedding Photography Agreement — Emma James",
      body: "Emma James signed “Wedding Photography Agreement” — 11/10/2026, 7:42 PM · IP 203.0.113.42",
      createdAt: new Date("2026-11-10T19:42:00"),
      read: true,
    },
  });
  await db.studioMessage.create({
    data: {
      userId: user.id,
      kind: "PAYMENT",
      name: "Emma James",
      email: "emma@example.com",
      subject: "Payment received: $1,380.19 on INV-0001",
      body: "Emma James paid $1,380.19 (Retainer) by card on invoice INV-0001.",
      meta: "Mock payment · card",
      createdAt: new Date("2026-11-11T08:15:00"),
    },
  });
  await db.studioMessage.create({
    data: {
      userId: user.id,
      kind: "EMAIL",
      name: "Olivia Grant",
      email: "olivia.grant@example.com",
      subject: "Quote QT-0001 sent",
      body: "Quote QT-0001 was emailed to Olivia Grant for review.",
      read: true,
      createdAt: new Date("2026-11-16T09:00:00"),
    },
  });

  // ---------- Phase 4: Store, Mobile App, Automations, Team ----------

  await db.storeProfile.create({
    data: {
      userId: user.id,
      taxEnabled: true,
      taxRate: 8.25,
      digitalLicense:
        "Personal-use license: images may be printed and shared for personal, non-commercial purposes. Resale, commercial use and editing beyond cropping require written permission from Light & Shadow Studio.",
      termsOfSale: "All print sales are final once production starts. Digital downloads are delivered instantly.",
    },
  });

  // Price sheet (WHCC-style automatic fulfillment) with prints, canvas, album, cards + digital downloads
  const sheet = await db.priceSheet.create({
    data: { userId: user.id, name: "Wedding Collection Store", fulfillment: "LAB", lab: "WHCC" },
  });
  const mkProduct = async (
    data: { name: string; category: string; description?: string; selfFulfilled?: boolean; shippingCents?: number; order: number },
    variants: [string, number][]
  ) =>
    db.product.create({
      data: {
        priceSheetId: sheet.id,
        name: data.name,
        category: data.category,
        description: data.description ?? "",
        selfFulfilled: data.selfFulfilled ?? false,
        shippingCents: data.shippingCents ?? 0,
        order: data.order,
        variants: { create: variants.map(([name, priceCents], i) => ({ name, priceCents, order: i })) },
      },
      include: { variants: { orderBy: { order: "asc" } } },
    });

  const printProduct = await mkProduct(
    { name: "Fine Art Print", category: "PRINT", description: "Archival lustre paper, printed and shipped by WHCC.", shippingCents: 800, order: 0 },
    [["4×6", 800], ["5×7", 1200], ["8×10", 2500], ["11×14", 4500], ["16×20", 7500]]
  );
  await mkProduct(
    { name: "Gallery-Wrapped Canvas", category: "CANVAS", description: "1.5\" gallery wrap, ready to hang.", shippingCents: 1500, order: 1 },
    [["12×18", 12500], ["16×24", 18500], ["24×36", 32000]]
  );
  await mkProduct(
    { name: "Heirloom Album", category: "ALBUM", description: "Lay-flat 30-page album, linen cover with debossing.", shippingCents: 1200, order: 2 },
    [["10×10 Linen", 65000], ["12×12 Leather", 85000]]
  );
  await mkProduct(
    { name: "Signed Artist Print", category: "PRINT", description: "Hand-signed and shipped by the studio.", selfFulfilled: true, shippingCents: 600, order: 3 },
    [["8×10 Signed", 6500]]
  );
  const digitalProduct = await mkProduct(
    { name: "Digital Download", category: "DIGITAL", description: "Delivered as a secure 7-day download link with a personal-use license.", order: 4 },
    [["High-resolution file", 1500], ["Web-size file", 500]]
  );

  // Assign the price sheet + slideshow music to the wedding gallery
  await db.collection.update({
    where: { id: wedding.id },
    data: {
      priceSheetId: sheet.id,
      slideshowEnabled: true,
      slideshowMusicUrl: "https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3",
    },
  });

  // Coupon + gift card
  await db.coupon.create({
    data: { userId: user.id, code: "PRINTS10", type: "PERCENT", value: 10, useLimit: 100, useCount: 1 },
  });
  await db.coupon.create({
    data: { userId: user.id, code: "FREESHIP", type: "FREE_SHIPPING", value: 0, minSpendCents: 5000 },
  });
  const giftCard = await db.giftCard.create({
    data: { userId: user.id, code: "GC-DEMO-2026", initialCents: 5000, balanceCents: 5000, recipient: "Emma James — wedding gift from Aunt May" },
  });
  void giftCard;

  // A delivered order with a digital download (PRINTS10 applied)
  const print810 = printProduct.variants.find((v) => v.name === "8×10")!;
  const digitalHi = digitalProduct.variants.find((v) => v.name === "High-resolution file")!;
  const orderSubtotal = print810.priceCents * 2 + digitalHi.priceCents; // 6500
  const orderDiscount = Math.round(orderSubtotal * 0.1); // 650
  const orderShipping = printProduct.shippingCents; // 800
  const orderTax = Math.round((orderSubtotal - orderDiscount) * 0.0825); // 483
  const ord1 = await db.order.create({
    data: {
      userId: user.id,
      collectionId: wedding.id,
      number: "ORD-0001",
      status: "PROCESSING",
      customerName: "Emma James",
      customerEmail: "emma@example.com",
      shippingAddress: "901 West Ave\nAustin, TX 78701",
      subtotalCents: orderSubtotal,
      discountCents: orderDiscount,
      shippingCents: orderShipping,
      taxCents: orderTax,
      totalCents: orderSubtotal - orderDiscount + orderShipping + orderTax,
      couponCode: "PRINTS10",
      paymentMethod: "card",
      fulfillment: "MIXED",
      createdAt: new Date(Date.now() - 2 * 86_400_000),
      items: {
        create: [
          {
            productId: printProduct.id,
            productName: "Fine Art Print",
            variantName: "8×10",
            category: "PRINT",
            photoId: photoIds[6],
            photoUrl: "/uploads/seed/IMG_1102.jpg",
            photoName: "IMG_1102.jpg",
            qty: 2,
            unitCents: print810.priceCents,
          },
          {
            productId: digitalProduct.id,
            productName: "Digital Download",
            variantName: "High-resolution file",
            category: "DIGITAL",
            photoId: photoIds[5],
            photoUrl: "/uploads/seed/IMG_1101.jpg",
            photoName: "IMG_1101.jpg",
            qty: 1,
            unitCents: digitalHi.priceCents,
            downloadToken: "demodownload0001",
            downloadExpires: new Date(Date.now() + 5 * 86_400_000),
          },
        ],
      },
    },
  });
  await db.activity.create({
    data: {
      collectionId: wedding.id,
      type: "ORDER",
      detail: "Order ORD-0001 — 3 items, $71.33",
      clientEmail: "emma@example.com",
      createdAt: new Date(Date.now() - 2 * 86_400_000),
    },
  });

  // Mobile Gallery App for the wedding collection
  await db.mobileApp.create({
    data: {
      userId: user.id,
      collectionId: wedding.id,
      slug: "emma-james",
      appName: "Emma & James",
      accentColor: "#8a7357",
      contactEmail: "hello@lightandshadow.studio",
      contactPhone: "+1 512 555 0137",
    },
  });

  // Workflow automations: one with a logged run, one that fires on first evaluation
  const invoiceAutomation = await db.automation.create({
    data: {
      userId: user.id,
      name: "Unpaid invoice reminder",
      trigger: "INVOICE_UNPAID",
      conditions: JSON.stringify([{ field: "days_since_sent", op: "gte", value: 3 }]),
      actions: JSON.stringify([{ type: "SEND_EMAIL", templateKey: "INVOICE_REMINDER" }]),
    },
  });
  await db.automationRun.create({
    data: {
      automationId: invoiceAutomation.id,
      targetKey: `invoice:${invoice.id}`,
      targetLabel: "INV-0001 — Emma James",
      status: "OK",
      detail: "Emailed “Friendly reminder: invoice INV-0001 from Light & Shadow Studio” to emma@example.com",
      createdAt: new Date("2026-11-14T09:00:00"),
    },
  });
  await db.automation.create({
    data: {
      userId: user.id,
      name: "Contract signature chaser",
      trigger: "CONTRACT_UNSIGNED",
      conditions: JSON.stringify([{ field: "hours_since_sent", op: "gte", value: 48 }]),
      actions: JSON.stringify([
        { type: "RESEND_CONTRACT" },
        { type: "SEND_EMAIL", templateKey: "CONTRACT_RESEND" },
      ]),
    },
  });

  // Team seats + one customized reminder template
  await db.teamMember.create({
    data: { userId: user.id, name: "Maya Collins", email: "maya@lightandshadow.studio", role: "ASSISTANT" },
  });
  await db.teamMember.create({
    data: { userId: user.id, name: "Diego Ruiz", email: "diego@lightandshadow.studio", role: "SECOND_SHOOTER" },
  });
  await db.emailTemplate.create({
    data: {
      userId: user.id,
      key: "INVOICE_REMINDER",
      subject: "A gentle nudge from {{business_name}} — invoice {{invoice_number}}",
      body: `Hi {{client_name}},

Just a friendly note that invoice {{invoice_number}} ({{invoice_amount}}) is still open{{due_phrase}}.

Pay securely online here: {{payment_link}}

With gratitude,
{{business_name}} · Austin, TX`,
    },
  });

  // ------------------------------------------------------------------
  // Phase 5A — external demo set, demo video, demo RAW, queued lab order
  // ------------------------------------------------------------------

  // External Demo Set: proves external-reference rendering (the Picflow-linking
  // flow creates photos exactly like these). Deliberately NOT linked to a real
  // Picflow gallery; picsum URLs stand in for a CDN-hosted gallery.
  const externalSet = await db.photoSet.create({
    data: { collectionId: wedding.id, name: "External Demo Set", order: 4 },
  });
  const externalIds = [237, 433, 577, 1035];
  for (let i = 0; i < externalIds.length; i++) {
    await db.photo.create({
      data: {
        collectionId: wedding.id,
        setId: externalSet.id,
        filename: `picsum-${externalIds[i]}.jpg`,
        url: pic(externalIds[i]),
        isExternal: true,
        mediaType: "IMAGE",
        order: i,
      },
    });
  }

  // Demo video in the Reception set (generated locally with ffmpeg when
  // available; skipped silently otherwise so the seed never breaks).
  // Skipped on production boot: the ffmpeg subprocess pushes the seed's
  // peak RSS from ~390MB to ~720MB, which OOM-kills a 512MB instance
  // before Next can start. Local `npm run seed` still generates it.
  if (process.env.NODE_ENV === "production") {
    console.log("  (production boot — demo video generation skipped to fit the memory limit)");
  } else try {
    const { execFileSync } = await import("child_process");
    const videoPath = path.join(SEED_DIR, "highlight-reel.mp4");
    const posterPath = path.join(SEED_DIR, "highlight-reel-poster.jpg");
    execFileSync("ffmpeg", [
      "-v", "error", "-y",
      "-f", "lavfi", "-i", "gradients=size=1280x720:duration=4:speed=0.05:nb_colors=3:c0=#caa989:c1=#3a2f28:c2=#e8ded2",
      "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-shortest", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      videoPath,
    ], { timeout: 60000 });
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", "1", "-i", videoPath, "-frames:v", "1", "-q:v", "3", posterPath], { timeout: 30000 });
    const { statSync } = await import("fs");
    await db.photo.create({
      data: {
        collectionId: wedding.id,
        setId: reception.id,
        filename: "highlight-reel.mp4",
        url: "/uploads/seed/highlight-reel.mp4",
        isExternal: false,
        width: 1280,
        height: 720,
        mediaType: "VIDEO",
        durationSec: 4,
        posterUrl: "/uploads/seed/highlight-reel-poster.jpg",
        fileSize: statSync(videoPath).size,
        order: 99,
      },
    });
  } catch {
    console.log("  (ffmpeg not available — demo video skipped)");
  }

  // Demo RAW original: a camera RAW container is not reproducible offline, so
  // this stands in as an undecodable original — the gallery shows the honest
  // RAW badge tile and the original downloads as-is.
  {
    const { writeFileSync } = await import("fs");
    const rawPath = path.join(SEED_DIR, "DSC_4411.nef");
    const rawBytes = Buffer.concat([Buffer.from("NEFDEMO0"), randomBytes(180_000)]);
    writeFileSync(rawPath, rawBytes);
    await db.photo.create({
      data: {
        collectionId: wedding.id,
        setId: familyOnly.id,
        filename: "DSC_4411.nef",
        url: "/uploads/seed/DSC_4411.nef",
        isExternal: false,
        mediaType: "RAW",
        fileSize: rawBytes.length,
        order: 99,
      },
    });
  }

  // Queued lab order payload for ORD-0001's lab-fulfilled prints (no lab is
  // connected, so it sits honestly in "ready to send" state).
  await db.labOrder.create({
    data: {
      orderId: ord1.id,
      lab: "WHCC",
      status: "QUEUED",
      payload: JSON.stringify(
        {
          lab: "WHCC",
          orderId: ord1.id,
          orderNumber: "ORD-0001",
          reprint: false,
          placedAt: ord1.createdAt.toISOString(),
          customer: { name: "Emma James", email: "emma@example.com" },
          shippingAddress: "901 West Ave\nAustin, TX 78701",
          items: [
            {
              product: "Fine Art Print",
              category: "PRINT",
              size: "8×10",
              paper: "Lustre (standard)",
              quantity: 2,
              imageUrl: "http://localhost:3000/uploads/seed/IMG_1102.jpg",
              filename: "IMG_1102.jpg",
            },
          ],
        },
        null,
        2
      ),
    },
  });

  await seed5b(db, user.id);

  console.log("Seeded demo account:");
  console.log("  email:    demo@pixelset.app");
  console.log("  password: demo1234");
  console.log("Collections:");
  console.log(`  /g/emma-james-wedding   (published, password: tuscany, PIN: 4821)`);
  console.log(`  /g/emma-james-wedding?qs=${quickShare.token}   (quick share)`);
  console.log(`  /g/rivera-family-fall   (pre-release, email registration)`);
  console.log(`  /g/northline-coffee-brand   (draft)`);
  console.log("Client Exclusive set: emma@example.com / family2026");
  console.log("Website:");
  console.log("  /site/light-and-shadow   (Vienna template, 9 pages, 3 blog posts, redirect /investment→/pricing)");
  console.log("Studio Manager:");
  console.log("  /book/light-and-shadow   (booking site: wedding, portrait, Zoom consult + Holiday Mini Sessions)");
  console.log("  4 contacts, signed + pending contracts, INV-0001 (3 instalments, 1 paid), QT-0001 sent, projects board, inbox");
  console.log("Store (Phase 4):");
  console.log("  WHCC price sheet on /g/emma-james-wedding (prints, canvas, album, digital), coupons PRINTS10 + FREESHIP, gift card GC-DEMO-2026 ($50)");
  console.log("  ORD-0001 (processing, digital download link), 2 automations (1 run logged), mobile app at /app/emma-james, 2 team members, custom invoice-reminder template");
  console.log("Phase 5A:");
  console.log("  External Demo Set (picsum external references), demo video in Reception, RAW badge demo in Family Formals");
  console.log("  ORD-0001 carries a QUEUED WHCC lab order payload (no lab connected)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

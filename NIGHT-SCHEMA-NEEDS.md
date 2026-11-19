# Night build: schema needs from BUILDER B (Studio Manager + Store)

Appended by Builder B. Builders cannot edit schema.prisma; please apply,
run prisma generate + db push, and note it in NIGHT-BUILD-LOG.md.

## Booking (Studio)
- Booking.couponCode String @default("")
- Booking.discountCents Int @default(0)
- Booking.googleEventId String @default("")

## StudioProfile (Google Calendar + payouts)
- StudioProfile.googleEmail String @default("")
- StudioProfile.googleRefreshToken String @default("")
- StudioProfile.googleCalendarId String @default("primary")
- StudioProfile.googleBusyJson String @default("") // cached busy blocks [{start,end,title}]
- StudioProfile.googleSyncAt DateTime?
- StudioProfile.payoutSchedule String @default("WEEKLY") // DAILY | WEEKLY | MONTHLY

## New model: BookingCoupon (Studio booking checkout coupons)
model BookingCoupon {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  code          String
  type          String    @default("PERCENT") // PERCENT | FIXED
  value         Int       @default(0)
  minSpendCents Int       @default(0)
  active        Boolean   @default(true)
  useLimit      Int?
  useCount      Int       @default(0)
  expiresAt     DateTime?
  sessionTypeId String    @default("") // empty = all session types
  createdAt     DateTime  @default(now())
  @@unique([userId, code])
  @@index([userId])
}
(plus the back-relation `bookingCoupons BookingCoupon[]` on User)

## Invoice
- Invoice.featuredPhotoUrl String @default("")

## StudioPayment (refunds, fees, disputes, processor)
- StudioPayment.status String @default("SUCCEEDED") // SUCCEEDED | REFUNDED | PARTIALLY_REFUNDED | DISPUTED
- StudioPayment.feeCents Int @default(0)
- StudioPayment.refundedCents Int @default(0)
- StudioPayment.processor String @default("") // PIXELSET | STRIPE | PAYPAL | MANUAL
- StudioPayment.processorRef String @default("")

## Product / ProductVariant (lab cost, markup pricing, packages)
- ProductVariant.labCostCents Int @default(0)
- Product.pricingMode String @default("FIXED") // FIXED | MARKUP
- Product.markupPct Float @default(0)
- Product.packageItems String @default("") // JSON [{productId, variantId, qty}] when category = PACKAGE

## Coupon (gallery banner)
- Coupon.showBanner Boolean @default(false)
- Coupon.bannerText String @default("")

## Order (payout maths snapshot)
- Order.labCostCents Int @default(0)
- Order.feeCents Int @default(0)
- Order.commissionCents Int @default(0)
- Order.payoutCents Int @default(0)

## StoreProfile
- StoreProfile.whiteLabelPackaging Boolean @default(false)

## New model: AlbumDesign (client album/book designer)
model AlbumDesign {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token       String   @unique @default(cuid())
  productId   String   @default("")
  orderId     String   @default("")
  clientName  String   @default("")
  clientEmail String   @default("")
  title       String   @default("")
  coverJson   String   @default("{}") // {material, color, debossText, photoUrl}
  pagesJson   String   @default("[]") // [{layout, slots:[{photoUrl, caption}]}]
  status      String   @default("DRAFT") // DRAFT | SUBMITTED | APPROVED | CHANGES_REQUESTED
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([userId])
}
(plus the back-relation `albumDesigns AlbumDesign[]` on User)

# Night build: schema needs from BUILDER A (Website + Photo Editor + Mobile App)

Appended by Builder A. Same drill: apply, prisma generate + db push, note in the log.

## Website (analytics, pixel, cookie banner, animation, site password, fonts, AI)
- Website.gaId String @default("") // Google Analytics measurement id (G-...)
- Website.fbPixelId String @default("") // Facebook Pixel id
- Website.cookieBannerEnabled Boolean @default(false)
- Website.cookieBannerText String @default("")
- Website.animationStyle String @default("none") // none | fade | rise | zoom
- Website.animationSpeed String @default("normal") // slow | normal | fast
- Website.sitePassword String @default("") // whole site password gate, "" = off
- Website.customFonts String @default("[]") // JSON [{id, name, url, format}] uploaded font faces (files live in SiteMedia, kind FONT)
- Website.fontDisplay String @default("") // font override for headings: family name (Google Fonts library or an uploaded font name), "" = theme
- Website.fontBody String @default("") // font override for body text, same convention
- (AI key fields REMOVED by Builder A: owner's rule is one server side Gemini
  helper reading GEMINI_API_KEY from the environment for every AI feature.
  No per site key storage.)

## SitePage
- SitePage.password String @default("") // per page password gate, "" = off
  (site-publish.ts pickPage/SnapshotPage also needs the field carried through;
  Builder A edits that file, it is Website lane.)

## SiteMedia
- kind comment only: allow kind "FONT" (no schema change, String column already).

# Night build: schema needs from PRICING + EXTRAS lane

Appended by the Pricing and Plans + Extras lane. Everything below was built
tonight with safe defaults on existing columns (the plan JSON on User.plan,
like the Phase 5B plan state); these are the proper homes when a future
schema pass happens. Nothing here blocks tonight's build.

## Subscriptions (proper home for src/lib/billing.ts state)
- model Subscription: id, userId, status, cycle, periodStart, periodEnd,
  autoRenew, cancelAtPeriodEnd, processor, stripeCustomerId,
  stripeSubscriptionId, tiers JSON, addOns JSON, volume String,
  history JSON. Tonight the whole state rides in User.plan JSON.

## User
- User.ipAllowlist String @default("[]") // JSON array of IPv4/CIDR entries;
  tonight it rides in User.plan JSON (security.ipAllowlist), enforced at
  sign-in by src/lib/ip-guard.ts while a Volume plan is active.

## Courses (Extras: online courses for clients)
- model Course: id, userId, title, description, coverUrl, priceCents,
  published Boolean, accessCode String, createdAt, updatedAt
- model CourseLesson: id, courseId, title, body, videoUrl, order,
  createdAt
- model CourseAccess: id, courseId, email, grantedAt
  Tonight the Extras lane builds the guarded data layer + honest
  waiting-on-schema UI (same pattern as Builder A's site-ext fields).

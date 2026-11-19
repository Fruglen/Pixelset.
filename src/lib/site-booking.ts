// Phase 5B: data for the website Booking calendar block. Loads the
// photographer's Studio Manager session types with live mini-session slot
// availability (regular sessions load their open times from
// /api/book/[slug]/slots inside the flow), shaped exactly like the
// props of the /book booking flow so the block can embed the same flow and
// create real bookings through POST /api/book/[slug].
import { db } from "./db";

export async function loadSiteBooking(userId: string, onlyIds: string[]) {
  const profile = await db.studioProfile.findUnique({ where: { userId } });
  if (!profile) return null;
  const types = await db.sessionType.findMany({
    where: { userId, ...(onlyIds.length ? { id: { in: onlyIds } } : {}) },
    include: {
      addOns: { orderBy: { order: "asc" } },
      questionnaire: true,
      contractTemplate: true,
      dates: {
        orderBy: { date: "asc" },
        include: {
          slots: {
            orderBy: { order: "asc" },
            include: { bookings: { where: { status: { in: ["CONFIRMED", "PENDING"] } } } },
          },
        },
      },
    },
    orderBy: [{ isMini: "asc" }, { createdAt: "asc" }],
  });
  const now = Date.now();
  const open = types.filter((t) => (t.isMini ? t.published && t.dates.length > 0 : t.active));

  return {
    slug: profile.bookingSlug,
    payMethods: {
      stripe: profile.showStripe,
      paypal: profile.showPaypal,
      manual: profile.showManual && profile.manualEnabled,
      manualInstructions: profile.manualInstructions,
    },
    sessions: open.map((t) => {
      const dates = t.dates
        .map((d) => ({
          id: d.id,
          date: d.date,
          slots: d.slots
            .filter((s) => s.startsAt.getTime() > now)
            .map((s) => ({
              id: s.id,
              startsAt: s.startsAt.toISOString(),
              endsAt: s.endsAt.toISOString(),
              capacity: s.capacity,
              booked: s.bookings.length,
            })),
        }))
        .filter((d) => d.slots.length > 0);
      const openSpots = dates.reduce((n, d) => n + d.slots.reduce((m, s) => m + Math.max(0, s.capacity - s.booked), 0), 0);
      return {
        sessionType: {
          id: t.id,
          name: t.name,
          description: t.description,
          coverUrl: t.coverUrl,
          durationMin: t.durationMin,
          priceCents: t.priceCents,
          taxRate: t.taxRate,
          locationType: t.locationType,
          location: t.location,
          cancellationPolicy: t.cancellationPolicy,
          retainerType: t.retainerType,
          retainerValue: t.retainerValue,
          isMini: t.isMini,
          showBookedSpots: t.showBookedSpots,
          waitlistEnabled: t.waitlistEnabled,
          hasContract: !!t.contractTemplate,
        },
        addOns: t.addOns.map((a) => ({ id: a.id, name: a.name, priceCents: a.priceCents, description: a.description })),
        questionnaireFields: t.questionnaire
          ? (JSON.parse(t.questionnaire.fields || "[]") as { id: string; type: string; label: string; options: string; required: boolean }[])
          : [],
        dates,
        openSpots,
      };
    }),
  };
}

export type SiteBookingData = NonNullable<Awaited<ReturnType<typeof loadSiteBooking>>>;

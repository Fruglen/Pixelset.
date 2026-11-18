import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { BookingFlow } from "./booking-flow";

export const dynamic = "force-dynamic";

async function load(slug: string, typeId: string) {
  const profile = await db.studioProfile.findUnique({ where: { bookingSlug: slug } });
  if (!profile) return null;
  const user = await db.user.findUnique({ where: { id: profile.userId } });
  if (!user) return null;
  const sessionType = await db.sessionType.findFirst({
    where: { id: typeId, userId: user.id },
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
  });
  if (!sessionType) return null;
  if (sessionType.isMini ? !sessionType.published : !sessionType.active) return null;
  return { profile, user, sessionType };
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string; typeId: string };
}): Promise<Metadata> {
  const data = await load(params.slug, params.typeId);
  if (!data) return { title: "Booking" };
  return { title: `Book ${data.sessionType.name}, ${data.user.businessName || data.user.name}` };
}

export default async function BookSessionPage({
  params,
}: {
  params: { slug: string; typeId: string };
}) {
  const data = await load(params.slug, params.typeId);
  if (!data) notFound();
  const { profile, user, sessionType } = data;

  const fields = sessionType.questionnaire
    ? (JSON.parse(sessionType.questionnaire.fields || "[]") as {
        id: string;
        type: string;
        label: string;
        options: string;
        required: boolean;
      }[])
    : [];

  return (
    <div className="min-h-screen bg-[#faf9f7] text-ink">
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link href={`/book/${params.slug}`} className="text-sm text-neutral-500 hover:text-neutral-900">
            ← All sessions
          </Link>
          <span className="font-display">{user.businessName || user.name}</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-10">
        <BookingFlow
          slug={params.slug}
          sessionType={{
            id: sessionType.id,
            name: sessionType.name,
            description: sessionType.description,
            coverUrl: sessionType.coverUrl,
            durationMin: sessionType.durationMin,
            priceCents: sessionType.priceCents,
            taxRate: sessionType.taxRate,
            locationType: sessionType.locationType,
            location: sessionType.location,
            cancellationPolicy: sessionType.cancellationPolicy,
            retainerType: sessionType.retainerType,
            retainerValue: sessionType.retainerValue,
            isMini: sessionType.isMini,
            showBookedSpots: sessionType.showBookedSpots,
            waitlistEnabled: sessionType.waitlistEnabled,
            hasContract: !!sessionType.contractTemplate,
          }}
          addOns={sessionType.addOns.map((a) => ({
            id: a.id,
            name: a.name,
            priceCents: a.priceCents,
            description: a.description,
          }))}
          questionnaireFields={fields}
          dates={sessionType.dates.map((d) => ({
            id: d.id,
            date: d.date,
            slots: d.slots.map((s) => ({
              id: s.id,
              startsAt: s.startsAt.toISOString(),
              endsAt: s.endsAt.toISOString(),
              capacity: s.capacity,
              booked: s.bookings.length,
            })),
          }))}
          payMethods={{
            stripe: profile.showStripe,
            paypal: profile.showPaypal,
            manual: profile.showManual && profile.manualEnabled,
            manualInstructions: profile.manualInstructions,
          }}
        />
      </main>
    </div>
  );
}

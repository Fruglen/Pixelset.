import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudioProfile } from "@/lib/studio";
import { SessionsClient } from "./sessions-client";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getStudioProfile(user.id);

  const types = await db.sessionType.findMany({
    where: { userId: user.id },
    include: {
      addOns: true,
      dates: { include: { slots: { include: { bookings: { where: { status: { in: ["CONFIRMED", "PENDING"] } } } } } } },
      _count: { select: { bookings: true } },
    },
    orderBy: [{ isMini: "asc" }, { createdAt: "asc" }],
  });

  return (
    <SessionsClient
      bookingSlug={profile.bookingSlug}
      types={types.map((t) => ({
        id: t.id,
        name: t.name,
        isMini: t.isMini,
        active: t.active,
        published: t.published,
        durationMin: t.durationMin,
        priceCents: t.priceCents,
        locationType: t.locationType,
        location: t.location,
        addOnCount: t.addOns.length,
        bookingCount: t._count.bookings,
        dateCount: t.dates.length,
        spotsTotal: t.dates.reduce((n, d) => n + d.slots.reduce((m, s) => m + s.capacity, 0), 0),
        spotsBooked: t.dates.reduce((n, d) => n + d.slots.reduce((m, s) => m + s.bookings.length, 0), 0),
      }))}
    />
  );
}

/* eslint-disable @next/next/no-img-element */
import { db } from "@/lib/db";

// Phase 5B: live mini session calendar. Renders each published mini session's
// upcoming dates with its open spots straight from the booking engine; every
// open spot links to the booking flow with that slot preselected. Used by the
// website "Mini session calendar" block and the iframe embed route.

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function MiniSessionSlots({
  userId,
  typeId,
  nameFilter = "",
  target,
  showHeader = true,
}: {
  userId: string;
  typeId?: string;
  nameFilter?: string;
  target?: "_top" | "_blank";
  showHeader?: boolean;
}) {
  const profile = await db.studioProfile.findUnique({ where: { userId } });
  if (!profile) return null;
  const minis = await db.sessionType.findMany({
    where: {
      userId,
      isMini: true,
      published: true,
      ...(typeId ? { id: typeId } : {}),
      ...(nameFilter ? { name: { contains: nameFilter } } : {}),
    },
    include: {
      dates: {
        orderBy: { date: "asc" },
        include: {
          slots: {
            orderBy: { order: "asc" },
            include: { bookings: { where: { status: { in: ["CONFIRMED", "PENDING", "AWAITING_CLIENT"] } } } },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const now = Date.now();
  if (minis.length === 0) {
    return <p className="text-sm opacity-60 text-center">No mini sessions are open for booking right now.</p>;
  }
  return (
    <div className="space-y-10">
      {minis.map((m) => {
        const dates = m.dates
          .map((d) => ({ ...d, slots: d.slots.filter((s) => s.startsAt.getTime() > now) }))
          .filter((d) => d.slots.length > 0);
        return (
          <div key={m.id}>
            {showHeader ? (
              <div className="mb-4 text-center">
                {m.coverUrl ? <img src={m.coverUrl} alt="" className="w-full max-h-64 object-cover mb-4" /> : null}
                <h3 className="text-2xl" style={{ fontFamily: "inherit" }}>{m.name}</h3>
                <p className="text-sm opacity-70 mt-1">
                  {m.durationMin} min · {money(m.priceCents)}
                  {m.location ? ` · ${m.location}` : ""}
                </p>
                {m.description ? <p className="text-sm opacity-70 mt-2 max-w-xl mx-auto">{m.description}</p> : null}
              </div>
            ) : null}
            {dates.length === 0 ? (
              <p className="text-sm opacity-60 text-center">All dates have passed or are fully booked.</p>
            ) : (
              <div className="space-y-5">
                {dates.map((d) => (
                  <div key={d.id}>
                    <p className="text-xs uppercase tracking-[0.2em] opacity-60 mb-2">
                      {new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {d.slots.map((s) => {
                        const left = s.capacity - s.bookings.length;
                        const full = left <= 0;
                        const label = s.startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                        const href = `/book/${profile.bookingSlug}/${m.id}?slot=${s.id}`;
                        if (full && !m.waitlistEnabled) {
                          return (
                            <span key={s.id} className="border border-current/20 opacity-40 px-2 py-2 text-sm text-center line-through">
                              {label}
                            </span>
                          );
                        }
                        return (
                          <a
                            key={s.id}
                            href={href}
                            target={target}
                            className="border border-current/30 px-2 py-2 text-sm text-center hover:opacity-70"
                          >
                            {label}
                            <span className="block text-[10px] opacity-60">
                              {full ? "Waitlist" : m.showBookedSpots ? `${left} left` : "Open"}
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

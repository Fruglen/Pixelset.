import Link from "next/link";
import { brandFor, brandVars } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { fmtMoney, retainerLabel } from "@/lib/studio";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const profile = await db.studioProfile.findUnique({ where: { bookingSlug: slug } });
  if (!profile) return null;
  const user = await db.user.findUnique({ where: { id: profile.userId } });
  if (!user) return null;
  const sessionTypes = await db.sessionType.findMany({
    where: { userId: user.id },
    include: { addOns: { orderBy: { order: "asc" } }, dates: { include: { slots: true } } },
    orderBy: [{ isMini: "asc" }, { createdAt: "asc" }],
  });
  return { profile, user, sessionTypes };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await load(params.slug);
  if (!data) return { title: "Booking" };
  return { title: `Book a session, ${data.user.businessName || data.user.name}` };
}

export default async function BookingSitePage({ params }: { params: { slug: string } }) {
  const data = await load(params.slug);
  if (!data) notFound();
  const { profile, user, sessionTypes } = data;

  const regular = sessionTypes.filter((t) => !t.isMini && t.active);
  const minis = sessionTypes.filter((t) => t.isMini && t.published && t.dates.length > 0);

  const brand = await brandFor(user.id);
  return (
    <div className="min-h-screen bg-[#faf9f7] text-ink branded" style={brandVars(brand)}>
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-8 text-center">
          {brand.logoUrl ? <div className="mb-3"><BrandMark brand={brand} /></div> : null}
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-400">Booking</p>
          <h1 className="font-display text-3xl mt-2" style={brand.custom ? { color: brand.color } : undefined}>{user.businessName || user.name}</h1>
          {profile.welcomeText ? (
            <p className="text-sm text-neutral-500 mt-3 max-w-xl mx-auto">{profile.welcomeText}</p>
          ) : null}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-10">
        {regular.length === 0 && minis.length === 0 ? (
          <p className="text-center text-neutral-500 text-sm py-16">
            No sessions are open for booking right now, check back soon.
          </p>
        ) : null}

        {minis.length > 0 ? (
          <section>
            <h2 className="font-display text-xl mb-4">Mini sessions</h2>
            <div className="space-y-4">
              {minis.map((t) => {
                const totalSpots = t.dates.reduce(
                  (n, d) => n + d.slots.reduce((m, s) => m + s.capacity, 0),
                  0
                );
                return (
                  <Link
                    key={t.id}
                    href={`/book/${params.slug}/${t.id}`}
                    className="card flex gap-5 p-5 hover:shadow-md transition-shadow"
                  >
                    {t.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.coverUrl} alt="" className="w-28 h-28 object-cover rounded-md flex-shrink-0" />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-display text-lg">{t.name}</h3>
                        <span className="text-sm font-medium whitespace-nowrap">{fmtMoney(t.priceCents)}</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">
                        {t.durationMin} min · {t.dates.length} date{t.dates.length === 1 ? "" : "s"} · {totalSpots} spots
                        {t.locationType === "ZOOM" ? " · Zoom" : t.location ? ` · ${t.location}` : ""}
                      </p>
                      {t.description ? (
                        <p className="text-sm text-neutral-600 mt-2 line-clamp-2">{t.description}</p>
                      ) : null}
                      <p className="text-xs text-neutral-400 mt-2">{retainerLabel(t.retainerType, t.retainerValue)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {regular.length > 0 ? (
          <section>
            <h2 className="font-display text-xl mb-4">Sessions</h2>
            <div className="space-y-4">
              {regular.map((t) => (
                <Link
                  key={t.id}
                  href={`/book/${params.slug}/${t.id}`}
                  className="card flex gap-5 p-5 hover:shadow-md transition-shadow"
                >
                  {t.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.coverUrl} alt="" className="w-28 h-28 object-cover rounded-md flex-shrink-0" />
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-display text-lg">{t.name}</h3>
                      <span className="text-sm font-medium whitespace-nowrap">{fmtMoney(t.priceCents)}</span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {t.durationMin} min
                      {t.locationType === "ZOOM" ? " · Zoom" : t.location ? ` · ${t.location}` : ""}
                      {t.addOns.length ? ` · ${t.addOns.length} add-on${t.addOns.length === 1 ? "" : "s"}` : ""}
                    </p>
                    {t.description ? (
                      <p className="text-sm text-neutral-600 mt-2 line-clamp-2">{t.description}</p>
                    ) : null}
                    <p className="text-xs text-neutral-400 mt-2">{retainerLabel(t.retainerType, t.retainerValue)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <footer className="py-8 text-center text-xs text-neutral-400">
        {user.businessName || user.name} · powered by Pixelset
      </footer>
    </div>
  );
}

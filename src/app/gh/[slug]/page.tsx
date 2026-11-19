import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { brandFor, brandVars } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";
import { GaTag } from "@/components/ga-tag";
import { isExpired, formatDate } from "@/lib/utils";
import { photoWatermarked } from "@/lib/watermark";

export const dynamic = "force-dynamic";

// Phase 5B platform: the photographer's public gallery homepage. Lists every
// published, unexpired collection marked Show on Homepage (Client Gallery >
// Settings > Homepage). Served at /gh/<slug>, and at the root of a verified
// gallery custom domain.
async function load(slug: string) {
  const user = await db.user.findUnique({
    where: { galleryHomeSlug: slug },
    select: { id: true, name: true, businessName: true, galleryHomeTitle: true, galleryGaId: true },
  });
  if (!user) return null;
  const collections = await db.collection.findMany({
    where: { userId: user.id, showOnHomepage: true, status: "PUBLISHED" },
    orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    include: { photos: { take: 1, orderBy: { order: "asc" }, where: { mediaType: { not: "VIDEO" } } } },
  });
  return { user, collections: collections.filter((c) => !isExpired(c.expiresAt)) };
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const d = await load(params.slug);
  if (!d) return {};
  return { title: d.user.galleryHomeTitle || `${d.user.businessName || d.user.name}, Client Galleries` };
}

export default async function GalleryHomePage({ params }: { params: { slug: string } }) {
  const d = await load(params.slug);
  if (!d) notFound();
  const brand = await brandFor(d.user.id);
  return (
    <div className="min-h-screen bg-[#faf9f7] text-ink branded" style={brandVars(brand)}>
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-10 text-center">
          <BrandMark brand={brand} />
          <h1 className="font-display text-2xl mt-3">{d.user.galleryHomeTitle || "Client Galleries"}</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-10">
        {d.collections.length === 0 ? (
          <p className="text-center text-sm text-neutral-500">No galleries to show yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {d.collections.map((c) => {
              const first = c.photos[0];
              // Watermarked galleries only ever expose the composited preview, never the clean file.
              const cover =
                c.coverImageUrl ||
                (first ? (photoWatermarked(c.watermark, first.watermarkMode) ? `/api/wm/${first.id}?w=1024` : first.url) : "");
              return (
                <Link key={c.id} href={`/g/${c.slug}`} className="group block">
                  <div className="aspect-[4/3] bg-neutral-200 overflow-hidden rounded-sm">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt={c.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
                    ) : null}
                  </div>
                  <p className="font-display text-lg mt-3">{c.name}</p>
                  {c.eventDate ? <p className="text-xs text-neutral-500">{formatDate(c.eventDate)}</p> : null}
                </Link>
              );
            })}
          </div>
        )}
      </main>
      {d.user.galleryGaId ? <GaTag id={d.user.galleryGaId} /> : null}
    </div>
  );
}

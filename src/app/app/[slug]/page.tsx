import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import InstallPrompt from "./install-prompt";

export const dynamic = "force-dynamic";

async function getApp(slug: string) {
  return db.mobileApp.findUnique({
    where: { slug },
    include: {
      collection: { include: { photos: { orderBy: { order: "asc" } } } },
      user: { select: { businessName: true, name: true } },
    },
  });
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const app = await getApp(params.slug);
  if (!app || !app.enabled) return { title: "Gallery App" };
  return {
    title: app.appName,
    manifest: `/app/${app.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: app.appName, statusBarStyle: "black-translucent" },
    icons: { apple: `/api/app-icon/${app.slug}?size=180` },
  };
}

export async function generateViewport({ params }: { params: { slug: string } }) {
  const app = await getApp(params.slug);
  return { themeColor: app?.accentColor ?? "#1c1c1c" };
}

export default async function MobileAppPage({ params }: { params: { slug: string } }) {
  const app = await getApp(params.slug);
  if (!app || !app.enabled) notFound();

  const collection = app.collection;
  const cover =
    (collection.coverPhotoId
      ? collection.photos.find((p) => p.id === collection.coverPhotoId)?.url
      : undefined) ?? collection.photos[0]?.url ?? "";
  const brand = app.user.businessName || app.user.name;
  const previews = collection.photos.filter((p) => !p.isPrivate).slice(0, 6);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Cover hero */}
      <div className="relative h-[52vh] overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={collection.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: app.accentColor }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/30 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-6 text-center">
          <div
            className="mx-auto mb-4 h-20 w-20 rounded-3xl overflow-hidden border-2 shadow-xl"
            style={{ borderColor: app.accentColor }}
          >
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ background: app.accentColor }} />
            )}
          </div>
          <p className="text-xs tracking-[0.25em] uppercase text-white/60">{brand}</p>
          <h1 className="font-display text-3xl mt-1">{app.appName}</h1>
          {collection.eventDate && (
            <p className="text-xs text-white/50 mt-1">
              {collection.eventDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-6 max-w-md w-full mx-auto space-y-3">
        <a
          href={`/g/${collection.slug}`}
          className="block text-center rounded-full py-3.5 text-sm font-medium tracking-wide"
          style={{ background: app.accentColor }}
        >
          Open Gallery
        </a>
        <div className="grid grid-cols-2 gap-3">
          {app.contactEmail && (
            <a
              href={`mailto:${app.contactEmail}`}
              className="text-center rounded-full py-3 text-sm border border-white/25 hover:bg-white/10"
            >
              ✉ Email
            </a>
          )}
          {app.contactPhone ? (
            <a
              href={`tel:${app.contactPhone}`}
              className="text-center rounded-full py-3 text-sm border border-white/25 hover:bg-white/10"
            >
              ✆ Call
            </a>
          ) : (
            <span className="text-center rounded-full py-3 text-sm border border-white/10 text-white/30">✆ Call</span>
          )}
        </div>
        <InstallPrompt />
      </div>

      {/* Preview strip */}
      {previews.length > 0 && (
        <div className="px-6 pb-8 max-w-md w-full mx-auto">
          <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Preview</p>
          <div className="grid grid-cols-3 gap-1.5">
            {previews.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt="" className="aspect-square object-cover rounded-md" />
            ))}
          </div>
        </div>
      )}

      <footer className="mt-auto text-center text-xs text-white/30 pb-6">
        {brand} · Powered by Pixelset
      </footer>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { greetingFor, resolveMobileApp } from "@/lib/mobile-app";
import { GALLERY_LIMITS, planFor } from "@/lib/plans";
import InstallPrompt from "./install-prompt";

export const dynamic = "force-dynamic";

async function getApp(slug: string) {
  return (await resolveMobileApp(slug))?.app ?? null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const app = await getApp(params.slug);
  if (!app || !app.enabled) return { title: "Gallery App" };
  return {
    title: app.appName,
    manifest: `/app/${params.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: app.appName, statusBarStyle: "black-translucent" },
    icons: { apple: `/api/app-icon/${app.slug}?size=180` },
  };
}

export async function generateViewport({ params }: { params: { slug: string } }) {
  const app = await getApp(params.slug);
  return { themeColor: app?.accentColor ?? "#1c1c1c" };
}

export default async function MobileAppPage({ params }: { params: { slug: string } }) {
  const resolved = await resolveMobileApp(params.slug);
  const app = resolved?.app;
  if (!resolved || !app || !app.enabled) notFound();
  const client = resolved.client;
  if (client) await db.mobileAppClient.update({ where: { id: client.id }, data: { lastOpenedAt: new Date() } });
  const greeting = greetingFor(client, app.collection.name);

  const collection = app.collection;
  // Night build (Pricing lane): the remove branding unlock also hides the
  // Powered by line in client mobile apps.
  const ownerPlan = await planFor(collection.userId);
  const hideBranding = GALLERY_LIMITS[ownerPlan.gallery].removeBranding;
  const cover =
    (collection.coverPhotoId
      ? collection.photos.find((p) => p.id === collection.coverPhotoId)?.url
      : undefined) ?? collection.photos[0]?.url ?? "";
  const brand = app.user.businessName || app.user.name;
  const previews = collection.photos.filter((p) => !p.isPrivate).slice(0, 6);
  const socials = [
    { label: "Instagram", url: app.user.website?.socialInstagram ?? "" },
    { label: "Facebook", url: app.user.website?.socialFacebook ?? "" },
    { label: "Pinterest", url: app.user.website?.socialPinterest ?? "" },
  ].filter((s) => s.url);

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
          {greeting && <p className="text-sm text-white/80 mt-2">{greeting}</p>}
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
        <InstallPrompt appName={app.appName} />
        {socials.length > 0 && (
          <div className="flex justify-center gap-5 pt-1">
            {socials.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noreferrer" className="text-sm text-white/70 underline underline-offset-4">
                {s.label}
              </a>
            ))}
          </div>
        )}
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
        {brand}
        {!hideBranding && " · Powered by Pixora"}
      </footer>
    </div>
  );
}

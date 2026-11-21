import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { GallerySubnav } from "../subnav";
import { ApiTokenCard } from "./api-token-card";

export const dynamic = "force-dynamic";

function siteOrigin() {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  if (!host) return "";
  const proto = h.get("x-forwarded-proto") || (/^(localhost|127\.)/.test(host) ? "http" : "https");
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}

// Phase 5B platform: the Client Gallery dashboard's Tools page.
export default async function GalleryToolsPage() {
  const user = (await getCurrentUser())!;
  const tools = [
    { title: "Watermark designer", body: "Design the watermark rendered into gallery previews.", href: "/collections/settings", cta: "Open designer" },
    { title: "Collection presets", body: "Save design, privacy, download and store settings and apply them to new collections.", href: "/collections/presets", cta: "Manage presets" },
    { title: "Gallery homepage", body: "Publish a page listing chosen galleries, optionally on your own domain.", href: "/collections/settings#homepage", cta: "Set up homepage" },
    { title: "Upload from a phone", body: "Every collection's Photos tab has an Upload from phone QR code for camera roll uploads.", href: "/collections", cta: "Pick a collection" },
    { title: "Favorite lists for Lightroom", body: "Each collection's Activities tab copies a client's picks as a Lightroom ready filename list.", href: "/collections", cta: "Pick a collection" },
    { title: "Export your data", body: "Download your galleries, registrations, orders and every other record.", href: "/reports", cta: "Open exports" },
  ];
  return (
    <div>
      <GallerySubnav />
      <h1 className="font-display text-2xl mb-1">Tools</h1>
      <p className="text-sm text-neutral-500 mb-6">Utilities that work across all your collections.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {tools.map((t) => (
          <div key={t.title} className="card p-5 flex flex-col">
            <h2 className="font-medium">{t.title}</h2>
            <p className="text-sm text-neutral-500 mt-1 flex-1">{t.body}</p>
            <Link href={t.href} className="text-sm underline mt-3">
              {t.cta}
            </Link>
          </div>
        ))}
      </div>
      <ApiTokenCard hasToken={!!user.apiToken} siteOrigin={siteOrigin()} />
    </div>
  );
}

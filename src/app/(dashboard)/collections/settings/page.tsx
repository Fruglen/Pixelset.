import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cnameTarget } from "@/lib/site-domains";
import { galleryDomainToken } from "@/lib/gallery-domain";
import { GALLERY_LIMITS, parsePlan } from "@/lib/plans";
import GallerySettingsPage from "../../settings/gallery/page";
import { GalleryAccountSettings } from "./gallery-account";
import { GallerySubnav } from "../subnav";

export const dynamic = "force-dynamic";

// Phase 5B platform: the Client Gallery dashboard's Settings page. One place
// for every account level gallery setting: timezone and watermark (shared with
// Settings > Gallery), logo, homepage, defaults, Google Analytics and the
// gallery custom domain.
export default async function ClientGallerySettingsPage() {
  const user = (await getCurrentUser())!;
  const [presets, collections] = await Promise.all([
    db.preset.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.collection.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, status: true, showOnHomepage: true } }),
  ]);
  const token = galleryDomainToken(user.id);
  const domainName = user.galleryDomain || "yourdomain.com";
  return (
    <div>
      <GallerySubnav />
      <h1 className="font-display text-2xl mb-1">Client Gallery Settings</h1>
      <p className="text-sm text-neutral-500 mb-6">Account wide settings for every collection.</p>
      <GallerySettingsPage />
      <GalleryAccountSettings
        initial={{
          homeSlug: user.galleryHomeSlug ?? "",
          homeTitle: user.galleryHomeTitle,
          gaId: user.galleryGaId,
          defaultPresetId: user.galleryDefaultPresetId,
          domain: user.galleryDomain,
          domainStatus: user.galleryDomainStatus,
          domainNote: user.galleryDomainNote,
          logoUrl: user.brandLogoUrl,
        }}
        presets={presets}
        collections={collections}
        domainHelp={{ cname: cnameTarget(), txtName: `_pixelset.${domainName}`, txtValue: `pixelset-verify=${token}` }}
        domainAllowed={GALLERY_LIMITS[parsePlan(user.plan).gallery].customDomain}
      />
    </div>
  );
}

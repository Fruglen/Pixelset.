import { notFound } from "next/navigation";
import { galleryT } from "@/lib/gallery-i18n";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readGalleryAccess } from "@/lib/gallery-auth";
import { paletteById, fontById } from "@/lib/design";
import { isExpired } from "@/lib/utils";
import { brandFor } from "@/lib/brand";
import { photoWatermarked } from "@/lib/watermark";
import GalleryGate from "./gallery-gate";
import GalleryView, { type GalleryData } from "./gallery-view";
import { GALLERY_LIMITS, planFor } from "@/lib/plans";
import { activeBannerCoupons } from "@/lib/store";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// Final pass: the per gallery SEO toggle (Collection.seoIndexing) drives the
// robots meta. Default in the replica is noindex until the photographer opts in.
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const c = await db.collection.findUnique({ where: { slug: params.slug }, select: { name: true, seoIndexing: true } });
  if (!c) return {};
  return {
    title: c.name,
    robots: c.seoIndexing ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { qs?: string };
}) {
  const collection = await db.collection.findUnique({
    where: { slug: params.slug },
    include: {
      user: { select: { id: true, businessName: true, name: true, watermarkText: true, previewSize: true, previewQuality: true } },
      accessGroups: true,
      sets: { orderBy: { order: "asc" }, include: { photos: { orderBy: { order: "asc" } } } },
      priceSheet: {
        include: {
          products: {
            where: { active: true },
            orderBy: { order: "asc" },
            include: { variants: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });
  if (!collection) notFound();

  const viewer = await getCurrentUser();
  const isOwner = viewer?.id === collection.userId;
  const palette = paletteById(collection.palette);
  const font = fontById(collection.fontPairing);
  const themeVars: Record<string, string> = {
    "--g-bg": palette.bg,
    "--g-text": palette.text,
    "--g-accent": palette.accent,
    "--g-muted": palette.muted,
    "--g-display": font.display,
    "--g-body": font.body,
  };

  const brand = collection.user.businessName || collection.user.name;
  // Fix batch 2026-11-20: gallery interface language (never the photographer's content)
  const { t, tag: langTag, lang } = galleryT(collection.language);

  // --- Quick Share mode: curated selection, bypasses all gates ---
  const qsToken = searchParams.qs;
  let quickPhotoIds: string[] | null = null;
  if (qsToken) {
    const qs = await db.quickShare.findUnique({ where: { token: qsToken } });
    if (qs && qs.collectionId === collection.id) {
      quickPhotoIds = qs.photoIds.split(",").filter(Boolean);
    }
  }

  const expired = isExpired(collection.expiresAt);

  if (!quickPhotoIds) {
    // Status gates (owner always previews)
    if (!isOwner) {
      if (collection.status === "DRAFT") {
        return (
          <GateShell themeVars={themeVars} brand={brand} lang={langTag}>
            <p className="text-sm opacity-70">{t("notAvailable")}</p>
          </GateShell>
        );
      }
      if (expired) {
        return (
          <GateShell themeVars={themeVars} brand={brand} lang={langTag}>
            <h1 className="gallery-display text-3xl mb-3">{collection.name}</h1>
            <p className="text-sm opacity-70">{t("expired", { brand })}</p>
          </GateShell>
        );
      }
      if (collection.status === "PRERELEASE") {
        return (
          <GalleryGate
            mode="prerelease"
          optIn={collection.campaignOptIn}
            slug={collection.slug}
            collectionName={collection.name}
            brand={brand}
            themeVars={themeVars}
          lang={lang}
          />
        );
      }
    }

    const access = readGalleryAccess(collection.id);

    if (!isOwner && collection.password && !access.pw) {
      return (
        <GalleryGate
          mode="password"
          hasGroups={collection.accessGroups.length > 0}
          slug={collection.slug}
          collectionName={collection.name}
          brand={brand}
          themeVars={themeVars}
          lang={lang}
        />
      );
    }
    if (!isOwner && collection.emailRegistration && !access.email) {
      return (
        <GalleryGate
          mode="email"
          optIn={collection.campaignOptIn}
          slug={collection.slug}
          collectionName={collection.name}
          brand={brand}
          themeVars={themeVars}
          lang={lang}
        />
      );
    }
  }

  const access = readGalleryAccess(collection.id);
  // Phase 5B platform: a viewer who entered with an access group code sees only
  // that group's sets (none chosen = every non exclusive set) and gets the
  // group's own download rights. The download route enforces the same rules.
  const group = !isOwner && access.group ? collection.accessGroups.find((g) => g.id === access.group) ?? null : null;
  const groupSetIds = group ? group.setIds.split(",").filter(Boolean) : [];
  const offeredSizes = collection.downloadSizes.split(",").filter(Boolean);
  const groupSizes = group
    ? group.downloadSizes
        .split(",")
        .filter((s) => offeredSizes.includes(s))
    : null;
  // Preview renditions: the photographer's preview size and quality (cache key).
  const pv = `${collection.user.previewSize}-${collection.user.previewQuality}`;

  // Build visible photo data
  const hasExclusiveSets = collection.sets.some((s) => s.clientExclusive);
  const sets = collection.sets
    .filter((s) => {
      if (!s.clientExclusive) return true;
      if (isOwner) return true;
      return access.sets.includes(s.id);
    })
    .filter((s) => !group || groupSetIds.length === 0 || groupSetIds.includes(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      clientExclusive: s.clientExclusive,
      photos: s.photos
        .filter((p) => (isOwner ? true : !p.isPrivate))
        .filter((p) => (quickPhotoIds ? quickPhotoIds.includes(p.id) : true))
        .map((p) => {
          const wm = p.mediaType !== "VIDEO" && photoWatermarked(collection.watermark, p.watermarkMode);
          return {
          id: p.id,
          // Watermarked images never send the clean file URL to the browser.
          url: wm && !isOwner && p.mediaType === "IMAGE" ? "" : p.url,
          filename: p.filename,
          width: p.width,
          height: p.height,
          isPrivate: p.isPrivate,
          mediaType: p.mediaType,
          durationSec: p.durationSec,
          posterUrl: p.posterUrl || (p.mediaType === "RAW" ? `/api/preview/${p.id}?w=1024` : p.posterUrl),
          fileSize: p.fileSize,
          starred: p.starred,
          // Phase 5B: watermark rendered into the preview image server side
          wm,
          pv,
          maxW: collection.user.previewSize,
        };
        }),
    }))
    .filter((s) => s.photos.length > 0 || !quickPhotoIds);

  const allPhotos = sets.flatMap((s) => s.photos);
  const coverCandidates = allPhotos.filter((p) => p.mediaType !== "RAW" || p.posterUrl);
  const coverPhoto = collection.coverPhotoId
    ? allPhotos.find((p) => p.id === collection.coverPhotoId) ??
      (await db.photo.findUnique({ where: { id: collection.coverPhotoId } }).then((p) =>
        p
          ? {
              id: p.id,
              url: p.url,
              filename: p.filename,
              width: p.width,
              height: p.height,
              isPrivate: p.isPrivate,
              mediaType: p.mediaType,
              durationSec: p.durationSec,
              posterUrl: p.posterUrl || (p.mediaType === "RAW" ? `/api/preview/${p.id}?w=1024` : p.posterUrl),
              fileSize: p.fileSize,
              starred: p.starred,
              wm: false,
              pv,
              maxW: collection.user.previewSize,
            }
          : null
      ))
    : coverCandidates[0] ?? null;

  // Comments for visible photos
  const comments = await db.comment.findMany({
    where: { photoId: { in: allPhotos.map((p) => p.id) } },
    orderBy: { createdAt: "asc" },
  });

  // Favorite lists for this viewer (by registered email)
  const lists = access.email
    ? await db.favoriteList.findMany({
        where: { collectionId: collection.id, clientEmail: access.email },
        include: { favorites: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // Storefront: assigned price sheet + store settings (Phase 4)
  let store: GalleryData["store"] = null;
  if (collection.storeEnabled && collection.priceSheet && collection.priceSheet.products.length > 0) {
    const { getStoreProfile } = await import("@/lib/store");
    const { parseFrames } = await import("@/lib/store-rates");
    const { effectiveVariantPriceCents, parsePackageItems } = await import("@/lib/store-pricing");
    const storeProfile = await getStoreProfile(collection.userId);
    const allProducts = collection.priceSheet.products;
    store = {
      products: allProducts.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        // MARKUP products show the derived price (lab cost + markup), not the stored base.
        variants: p.variants.map((v) => ({
          id: v.id,
          name: v.name,
          priceCents: effectiveVariantPriceCents(p, v),
        })),
        frames: parseFrames(p.frameOptions),
        includes:
          p.category === "PACKAGE"
            ? parsePackageItems(p.packageItems).map((c) => {
                const cp = allProducts.find((x) => x.id === c.productId);
                const cv = cp?.variants.find((x) => x.id === c.variantId);
                return cp ? `${c.qty}× ${cp.name}${cv ? ` (${cv.name})` : ""}` : "An included product";
              })
            : undefined,
      })),
      storeOpen: storeProfile.storeOpen,
      closedMessage: storeProfile.closedMessage,
      currency: storeProfile.currency,
      taxMode: storeProfile.taxMode,
      taxEnabled: storeProfile.taxEnabled,
      taxRate: storeProfile.taxRate,
      digitalLicense: storeProfile.digitalLicense,
      termsOfSale: storeProfile.termsOfSale,
    };
  }

  // Night build (Pricing lane): the remove branding unlock hides the
  // Powered by footer on paid Client Gallery plans.
  const ownerPlan = await planFor(collection.userId);

  // Final pass: store coupon banners (Coupon.showBanner) for the top of the gallery.
  const banners = quickPhotoIds
    ? []
    : (await activeBannerCoupons(collection.userId)).map((b) => ({
        id: b.id,
        code: b.code,
        text: b.text.includes(b.code) ? b.text : `${b.text} Use code ${b.code}.`,
      }));

  const data: GalleryData = {
    id: collection.id,
    slug: collection.slug,
    name: collection.name,
    hideBranding: GALLERY_LIMITS[ownerPlan.gallery].removeBranding,
    eventDate: collection.eventDate ? collection.eventDate.toISOString() : null,
    brand,
    brandLogoUrl: (await brandFor(collection.userId)).logoUrl,
    watermark: collection.watermark,
    watermarkText: collection.user.watermarkText || brand,
    coverStyle: collection.coverStyle,
    // Phase 5B: a separately uploaded cover image (JPEG, PNG, WEBP or an
    // animated GIF served untouched) wins over a collection photo.
    coverUrl: collection.coverImageUrl
      ? collection.coverImageUrl
      : coverPhoto?.mediaType === "VIDEO"
        ? coverPhoto.url
        : coverPhoto?.mediaType === "RAW"
          ? coverPhoto.posterUrl
          : coverPhoto ? (coverPhoto.wm ? `/api/wm/${coverPhoto.id}?w=2048` : /\.gif$/i.test(coverPhoto.url) ? coverPhoto.url : `/api/preview/${coverPhoto.id}?w=2560&v=${pv}`) : "",
    coverMediaType: collection.coverImageUrl ? "IMAGE" : coverPhoto?.mediaType ?? "IMAGE",
    coverVideoUrl: collection.coverVideoUrl,
    focalX: collection.focalX,
    focalY: collection.focalY,
    gridStyle: collection.gridStyle,
    thumbSize: collection.thumbSize,
    gridSpacing: collection.gridSpacing,
    downloadEnabled: collection.downloadEnabled && (!group || (group.canDownload && (groupSizes?.length ?? 0) > 0)),
    videoDownloadEnabled: collection.videoDownloadEnabled,
    pinEnabled: collection.pinEnabled,
    freeDownloadCap: collection.freeDownloadCap,
    downloadSizes: groupSizes ?? offeredSizes,
    accessGroup: group ? { name: group.name, canDownload: group.canDownload } : null,
    hasAccessGroups: collection.accessGroups.length > 0,
    allowSingle: collection.allowSingle,
    allowZip: collection.allowZip && !quickPhotoIds,
    isOwner,
    collectionId: collection.id,
    campaignOptIn: collection.campaignOptIn,
    banners,
    favoritesEnabled: collection.favoritesEnabled,
    navStyle: collection.navStyle,
    socialSharing: collection.socialSharing,
    galleryAssist: collection.galleryAssist,
    emailedDownloadAll: collection.emailedDownloadAll,
    coverAnimation: collection.coverAnimation,
    language: lang,
    isQuickShare: !!quickPhotoIds,
    quickShareToken: quickPhotoIds ? qsToken ?? "" : "",
    store,
    slideshowEnabled: collection.slideshowEnabled && !quickPhotoIds,
    slideshowMusicUrl: collection.slideshowMusicUrl,
    hasExclusiveSets,
    viewerEmail: access.email,
    viewerName: access.name,
    sets,
    comments: comments.map((cm) => ({
      id: cm.id,
      photoId: cm.photoId,
      authorName: cm.authorName || cm.authorEmail || "Guest",
      body: cm.body,
      timecodeSec: cm.timecodeSec,
      createdAt: cm.createdAt.toISOString(),
    })),
    lists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      selectionLimit: l.selectionLimit,
      submittedAt: l.submittedAt ? l.submittedAt.toISOString() : null,
      favorites: l.favorites.map((f) => ({ photoId: f.photoId, note: f.note })),
    })),
  };

  return (
    <div className="gallery-root" lang={langTag} style={themeVars as unknown as React.CSSProperties}>
      <GalleryView data={data} />
    </div>
  );
}

function GateShell({
  children,
  themeVars,
  brand,
  lang,
}: {
  children: React.ReactNode;
  themeVars: Record<string, string>;
  brand: string;
  lang: string;
}) {
  return (
    <div
      lang={lang}
      className="gallery-root flex flex-col items-center justify-center min-h-screen px-4"
      style={themeVars as unknown as React.CSSProperties}
    >
      <p className="gallery-display text-lg mb-8 opacity-80">{brand}</p>
      <div className="text-center max-w-sm">{children}</div>
    </div>
  );
}

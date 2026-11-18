import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readGalleryAccess } from "@/lib/gallery-auth";
import { paletteById, fontById } from "@/lib/design";
import { isExpired } from "@/lib/utils";
import GalleryGate from "./gallery-gate";
import GalleryView, { type GalleryData } from "./gallery-view";

export const dynamic = "force-dynamic";

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
      user: { select: { id: true, businessName: true, name: true, watermarkText: true } },
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
          <GateShell themeVars={themeVars} brand={brand}>
            <p className="text-sm opacity-70">This gallery is not available yet.</p>
          </GateShell>
        );
      }
      if (expired) {
        return (
          <GateShell themeVars={themeVars} brand={brand}>
            <h1 className="gallery-display text-3xl mb-3">{collection.name}</h1>
            <p className="text-sm opacity-70">
              This gallery has expired and is no longer available. Please contact {brand} for access.
            </p>
          </GateShell>
        );
      }
      if (collection.status === "PRERELEASE") {
        return (
          <GalleryGate
            mode="prerelease"
            slug={collection.slug}
            collectionName={collection.name}
            brand={brand}
            themeVars={themeVars}
          />
        );
      }
    }

    const access = readGalleryAccess(collection.id);

    if (!isOwner && collection.password && !access.pw) {
      return (
        <GalleryGate
          mode="password"
          slug={collection.slug}
          collectionName={collection.name}
          brand={brand}
          themeVars={themeVars}
        />
      );
    }
    if (!isOwner && collection.emailRegistration && !access.email) {
      return (
        <GalleryGate
          mode="email"
          slug={collection.slug}
          collectionName={collection.name}
          brand={brand}
          themeVars={themeVars}
        />
      );
    }
  }

  const access = readGalleryAccess(collection.id);

  // Build visible photo data
  const hasExclusiveSets = collection.sets.some((s) => s.clientExclusive);
  const sets = collection.sets
    .filter((s) => {
      if (!s.clientExclusive) return true;
      if (isOwner) return true;
      return access.sets.includes(s.id);
    })
    .map((s) => ({
      id: s.id,
      name: s.name,
      clientExclusive: s.clientExclusive,
      photos: s.photos
        .filter((p) => (isOwner ? true : !p.isPrivate))
        .filter((p) => (quickPhotoIds ? quickPhotoIds.includes(p.id) : true))
        .map((p) => ({
          id: p.id,
          url: p.url,
          filename: p.filename,
          width: p.width,
          height: p.height,
          isPrivate: p.isPrivate,
          mediaType: p.mediaType,
          durationSec: p.durationSec,
          posterUrl: p.posterUrl,
          fileSize: p.fileSize,
        })),
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
              posterUrl: p.posterUrl,
              fileSize: p.fileSize,
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
    const storeProfile = await getStoreProfile(collection.userId);
    store = {
      products: collection.priceSheet.products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        description: p.description,
        variants: p.variants.map((v) => ({ id: v.id, name: v.name, priceCents: v.priceCents })),
      })),
      taxEnabled: storeProfile.taxEnabled,
      taxRate: storeProfile.taxRate,
      digitalLicense: storeProfile.digitalLicense,
      termsOfSale: storeProfile.termsOfSale,
    };
  }

  const data: GalleryData = {
    id: collection.id,
    slug: collection.slug,
    name: collection.name,
    eventDate: collection.eventDate ? collection.eventDate.toISOString() : null,
    brand,
    watermark: collection.watermark,
    watermarkText: collection.user.watermarkText || brand,
    coverStyle: collection.coverStyle,
    coverUrl:
      coverPhoto?.mediaType === "VIDEO"
        ? coverPhoto.url
        : coverPhoto?.mediaType === "RAW"
          ? coverPhoto.posterUrl
          : coverPhoto?.url ?? "",
    coverMediaType: coverPhoto?.mediaType ?? "IMAGE",
    coverVideoUrl: collection.coverVideoUrl,
    focalX: collection.focalX,
    focalY: collection.focalY,
    gridStyle: collection.gridStyle,
    thumbSize: collection.thumbSize,
    gridSpacing: collection.gridSpacing,
    downloadEnabled: collection.downloadEnabled,
    videoDownloadEnabled: collection.videoDownloadEnabled,
    pinEnabled: collection.pinEnabled,
    freeDownloadCap: collection.freeDownloadCap,
    downloadSizes: collection.downloadSizes.split(",").filter(Boolean),
    allowSingle: collection.allowSingle,
    allowZip: collection.allowZip && !quickPhotoIds,
    isOwner,
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
      createdAt: cm.createdAt.toISOString(),
    })),
    lists: lists.map((l) => ({
      id: l.id,
      name: l.name,
      selectionLimit: l.selectionLimit,
      favorites: l.favorites.map((f) => ({ photoId: f.photoId, note: f.note })),
    })),
  };

  return (
    <div className="gallery-root" style={themeVars as unknown as React.CSSProperties}>
      <GalleryView data={data} />
    </div>
  );
}

function GateShell({
  children,
  themeVars,
  brand,
}: {
  children: React.ReactNode;
  themeVars: Record<string, string>;
  brand: string;
}) {
  return (
    <div
      className="gallery-root flex flex-col items-center justify-center min-h-screen px-4"
      style={themeVars as unknown as React.CSSProperties}
    >
      <p className="gallery-display text-lg mb-8 opacity-80">{brand}</p>
      <div className="text-center max-w-sm">{children}</div>
    </div>
  );
}

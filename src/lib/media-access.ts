import { db } from "./db";
import { getCurrentUser } from "./auth";
import { galleryGate, readGalleryAccess } from "./gallery-auth";
import { photoWatermarked } from "./watermark";

// GLE-115 (C1): who may receive a stored file through /media/<key>.
// Owners get everything they own. Gallery visitors only get the files the
// gallery displays (video posters, RAW previews, unwatermarked GIFs, and video
// originals, because no video rendition exists to play instead). Image and RAW
// originals are never served to visitors here. Downloads go through
// /api/download, which has its own checks.

async function quickShareCovers(token: string, collectionId: string, photoId?: string): Promise<boolean> {
  if (!token) return false;
  const qs = await db.quickShare.findUnique({ where: { token } });
  if (!qs || qs.collectionId !== collectionId) return false;
  return photoId ? qs.photoIds.split(",").includes(photoId) : true;
}

type PhotoRow = {
  id: string;
  url: string;
  posterUrl: string;
  isPrivate: boolean;
  mediaType: string;
  watermarkMode: string;
  setId: string;
  set: { id: string; clientExclusive: boolean };
  collection: {
    id: string;
    status: string;
    expiresAt: Date | null;
    password: string | null;
    emailRegistration: boolean;
    watermark: boolean;
    accessGroups: { id: string; setIds: string }[];
  };
};

async function visitorMayLoad(photo: PhotoRow, urls: string[], qsToken: string): Promise<boolean> {
  const c = photo.collection;
  if (photo.isPrivate) return false;
  // Watermarked images are only ever served through /api/wm.
  if (photo.mediaType !== "VIDEO" && photoWatermarked(c.watermark, photo.watermarkMode)) return false;
  const isPoster = urls.includes(photo.posterUrl);
  const isDisplayGif = photo.mediaType === "IMAGE" && urls.includes(photo.url) && /\.gif$/i.test(photo.url);
  const isVideoOriginal = photo.mediaType === "VIDEO" && urls.includes(photo.url);
  if (!isPoster && !isDisplayGif && !isVideoOriginal) return false;
  return visitorMayViewPhoto(photo, qsToken);
}

type PhotoAccessRow = Pick<PhotoRow, "id" | "isPrivate"> & {
  set: PhotoRow["set"];
  collection: Pick<PhotoRow["collection"], "id" | "status" | "expiresAt" | "password" | "emailRegistration" | "accessGroups">;
};

// The visitor decision shared by /media and the rendition routes (GLE-116).
async function visitorMayViewPhoto(photo: PhotoAccessRow, qsToken: string): Promise<boolean> {
  const c = photo.collection;
  if (photo.isPrivate) return false;
  const access = readGalleryAccess(c.id);
  if (photo.set.clientExclusive && !access.sets.includes(photo.set.id)) return false;
  const group = access.group ? c.accessGroups.find((g) => g.id === access.group) : undefined;
  if (group) {
    const allowed = group.setIds.split(",").filter(Boolean);
    if (allowed.length > 0 && !allowed.includes(photo.set.id)) return false;
  }
  if (await quickShareCovers(qsToken, c.id, photo.id)) return true;
  // Same status decision as the gallery page: galleryGate alone.
  return galleryGate(c, access) === null;
}

/**
 * GLE-116 (H1): may this request receive a preview or watermarked rendition?
 * The owner always may. Anyone else goes through the gallery's visitor rules.
 * Any error denies.
 */
export async function canViewPhotoRendition(
  photo: PhotoAccessRow & { collection: { userId: string } },
  qsToken: string
): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (user?.id === photo.collection.userId) return true;
    return await visitorMayViewPhoto(photo, qsToken);
  } catch {
    return false;
  }
}

/**
 * True only when anyone may see this photo with no cookie or token, so a shared
 * cache cannot serve it to the wrong viewer. A collection with an expiry is
 * excluded because a day-long cached copy could outlive it.
 */
export function isFullyPublicPhoto(photo: PhotoAccessRow): boolean {
  const c = photo.collection;
  return (
    c.status === "PUBLISHED" &&
    !c.expiresAt &&
    !c.password &&
    !c.emailRegistration &&
    c.accessGroups.length === 0 &&
    !photo.isPrivate &&
    !photo.set.clientExclusive
  );
}

export async function canReadMediaKey(key: string, qsToken: string): Promise<boolean> {
  // Stored URLs are /media/<key>, or the legacy /uploads/... form of the same key.
  const urls = [`/media/${key}`, `/${key}`];
  const user = await getCurrentUser();

  const photos = await db.photo.findMany({
    where: { OR: [{ url: { in: urls } }, { posterUrl: { in: urls } }] },
    include: { set: true, collection: { include: { accessGroups: true } } },
  });
  if (photos.length > 0) {
    if (user && photos.some((p) => p.collection.userId === user.id)) return true;
    for (const p of photos) {
      if (await visitorMayLoad(p, urls, qsToken)) return true;
    }
    return false;
  }

  const [root, scope] = key.split("/");
  if (root === "uploads" && scope === "inbox") {
    return !!user && key.split("/")[2] === user.id;
  }

  // Files in a collection's folder that are not Photos: its cover and music.
  // The folder check matters: these URL fields are owner-editable, so a field
  // pointing at another account's key must not make that key public.
  if (root === "uploads" && scope) {
    const collection = await db.collection.findUnique({ where: { id: scope } });
    if (collection) {
      if (user?.id === collection.userId) return true;
      if (!urls.includes(collection.coverImageUrl) && !urls.includes(collection.slideshowMusicUrl)) return false;
      if (await quickShareCovers(qsToken, collection.id)) return true;
      return galleryGate(collection, readGalleryAccess(collection.id)) === null;
    }
  }

  // Published website media, fonts and logos appear on logged-out public pages.
  if (root === "uploads" && (scope === "brand" || scope?.startsWith("site-"))) {
    const [media, brandUser, site] = await Promise.all([
      db.siteMedia.findFirst({ where: { url: { in: urls } }, select: { id: true } }),
      db.user.findFirst({ where: { brandLogoUrl: { in: urls } }, select: { id: true } }),
      db.website.findFirst({ where: { logoUrl: { in: urls } }, select: { id: true } }),
    ]);
    if (media || brandUser || site) return true;
  }

  return !!user;
}

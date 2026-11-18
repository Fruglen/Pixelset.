import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import PhotosClient from "./photos-client";

export const dynamic = "force-dynamic";

export default async function PhotosTab({ params }: { params: { id: string } }) {
  const user = (await getCurrentUser())!;
  const collection = await db.collection.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      sets: { orderBy: { order: "asc" }, include: { photos: { orderBy: { order: "asc" } } } },
      quickShares: { orderBy: { createdAt: "desc" } },
      invites: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!collection) notFound();

  return (
    <PhotosClient
      collection={{
        id: collection.id,
        slug: collection.slug,
        coverPhotoId: collection.coverPhotoId,
        status: collection.status,
      }}
      sets={collection.sets.map((s) => ({
        id: s.id,
        name: s.name,
        clientExclusive: s.clientExclusive,
        clientEmail: s.clientEmail,
        externalSource: s.externalSource,
        externalSyncedAt: s.externalSyncedAt ? s.externalSyncedAt.toISOString() : "",
        photos: s.photos.map((p) => ({
          id: p.id,
          url: p.url,
          filename: p.filename,
          isPrivate: p.isPrivate,
          isExternal: p.isExternal,
          mediaType: p.mediaType,
          posterUrl: p.posterUrl,
          durationSec: p.durationSec,
          fileSize: p.fileSize,
        })),
      }))}
      quickShares={collection.quickShares.map((q) => ({
        id: q.id,
        token: q.token,
        count: q.photoIds ? q.photoIds.split(",").filter(Boolean).length : 0,
      }))}
      invites={collection.invites.map((i) => ({
        id: i.id,
        email: i.email,
        createdAt: i.createdAt.toISOString(),
      }))}
    />
  );
}

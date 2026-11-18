import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import SettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsTab({ params }: { params: { id: string } }) {
  const user = (await getCurrentUser())!;
  const collection = await db.collection.findFirst({
    where: { id: params.id, userId: user.id },
    include: { photos: { orderBy: { order: "asc" }, select: { id: true, url: true, mediaType: true, posterUrl: true } } },
  });
  if (!collection) notFound();
  const priceSheets = await db.priceSheet.findMany({
    where: { userId: user.id },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <SettingsClient
      collection={{
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
        eventDate: collection.eventDate ? collection.eventDate.toISOString().slice(0, 10) : "",
        status: collection.status,
        coverStyle: collection.coverStyle,
        coverPhotoId: collection.coverPhotoId,
        coverVideoUrl: collection.coverVideoUrl,
        focalX: collection.focalX,
        focalY: collection.focalY,
        fontPairing: collection.fontPairing,
        palette: collection.palette,
        gridStyle: collection.gridStyle,
        thumbSize: collection.thumbSize,
        gridSpacing: collection.gridSpacing,
        password: collection.password,
        emailRegistration: collection.emailRegistration,
        watermark: collection.watermark,
        downloadEnabled: collection.downloadEnabled,
        pinEnabled: collection.pinEnabled,
        downloadPin: collection.downloadPin,
        pinUseLimit: collection.pinUseLimit,
        pinUseCount: collection.pinUseCount,
        freeDownloadCap: collection.freeDownloadCap,
        downloadSizes: collection.downloadSizes,
        allowSingle: collection.allowSingle,
        allowZip: collection.allowZip,
        videoDownloadEnabled: collection.videoDownloadEnabled,
        expiresAt: collection.expiresAt ? collection.expiresAt.toISOString().slice(0, 10) : "",
        expiryReminder: collection.expiryReminder,
        storeEnabled: collection.storeEnabled,
        priceSheetId: collection.priceSheetId,
        slideshowEnabled: collection.slideshowEnabled,
        slideshowMusicUrl: collection.slideshowMusicUrl,
      }}
      photos={collection.photos}
      priceSheets={priceSheets}
    />
  );
}

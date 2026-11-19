import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import SettingsClient from "./settings-client";
import AccessGroupsSection from "./access-groups";
import { dateInZone } from "@/lib/utils";
import { resendConnected } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export default async function SettingsTab({ params }: { params: { id: string } }) {
  const user = (await getCurrentUser())!;
  const collection = await db.collection.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      photos: { orderBy: { order: "asc" }, select: { id: true, url: true, mediaType: true, posterUrl: true } },
      sets: { orderBy: { order: "asc" }, select: { id: true, name: true, clientExclusive: true } },
    },
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
        // The date is shown as the photographer sees it in their own timezone.
        expiresAt: collection.expiresAt ? dateInZone(collection.expiresAt, user.timezone) : "",
        expired: !!collection.expiresAt && collection.expiresAt < new Date(),
        expiryReminderDays: collection.expiryReminderDays,
        expiryReminderSentAt: collection.expiryReminderSentAt ? collection.expiryReminderSentAt.toISOString() : "",
        coverImageUrl: collection.coverImageUrl,
        campaignOptIn: collection.campaignOptIn,
        expiryReminder: collection.expiryReminder,
        storeEnabled: collection.storeEnabled,
        priceSheetId: collection.priceSheetId,
        slideshowEnabled: collection.slideshowEnabled,
        slideshowMusicUrl: collection.slideshowMusicUrl,
        coverAnimation: collection.coverAnimation,
        navStyle: collection.navStyle,
        seoIndexing: collection.seoIndexing,
        showOnHomepage: collection.showOnHomepage,
        clientOnlyDownloads: collection.clientOnlyDownloads,
        emailedDownloadAll: collection.emailedDownloadAll,
        zipPartSize: collection.zipPartSize,
        desktopOnlyZip: collection.desktopOnlyZip,
        favoritesEnabled: collection.favoritesEnabled,
        socialSharing: collection.socialSharing,
        galleryAssist: collection.galleryAssist,
        language: collection.language,
      }}
      photos={collection.photos}
      priceSheets={priceSheets}
      timezone={user.timezone}
      mailConnected={resendConnected()}
      extraDownload={<AccessGroupsSection collectionId={collection.id} slug={collection.slug} sets={collection.sets} />}
    />
  );
}

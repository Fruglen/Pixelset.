import { getCurrentUser } from "@/lib/auth";
import { TIMEZONES } from "@/lib/utils";
import { WATERMARK_POSITIONS } from "@/lib/watermark";
import GallerySettingsClient from "./gallery-client";
import PreviewQualitySection from "./preview-quality";

export const dynamic = "force-dynamic";

// Phase 5B: account level Client Gallery settings: the photographer's timezone
// (galleries expire at 11:59 pm in it) and the watermark designer.
export default async function GallerySettingsPage() {
  const user = (await getCurrentUser())!;
  return (
    <>
    <GallerySettingsClient
      initial={{
        timezone: user.timezone,
        watermarkText: user.watermarkText || user.businessName || user.name,
        watermarkPosition: user.watermarkPosition,
        watermarkOpacity: user.watermarkOpacity,
        watermarkScale: user.watermarkScale,
        watermarkSizes: user.watermarkSizes,
      }}
      timezones={TIMEZONES.includes(user.timezone) ? TIMEZONES : [user.timezone, ...TIMEZONES]}
      positions={WATERMARK_POSITIONS}
    />
    <PreviewQualitySection initial={{ previewSize: user.previewSize, previewQuality: user.previewQuality }} />
    </>
  );
}

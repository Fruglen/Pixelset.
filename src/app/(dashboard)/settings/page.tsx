import { getCurrentUser } from "@/lib/auth";
import { defaultFrom, resendConnected } from "@/lib/mailer";
import AccountSettingsClient from "./settings-client";
import { BrandSettings } from "./brand-settings";
import { FONT_PAIRINGS } from "@/lib/design";
import { DashboardLanguage } from "./dashboard-language";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const user = (await getCurrentUser())!;
  return (
    <>
    <AccountSettingsClient
      user={{
        name: user.name,
        businessName: user.businessName,
        watermarkText: user.watermarkText,
        email: user.email,
        mailFrom: user.mailFrom,
      }}
      email={{ connected: resendConnected(), defaultFrom: defaultFrom() }}
    />
    <DashboardLanguage initial={user.locale} />
    <BrandSettings
      initial={{ logoUrl: user.brandLogoUrl, color: user.brandColor, accent: user.brandAccent, font: user.brandFont || "editorial", businessName: user.businessName || user.name }}
      fonts={FONT_PAIRINGS.map((f) => ({ id: f.id, name: f.name, display: f.display }))}
    />
    </>
  );
}

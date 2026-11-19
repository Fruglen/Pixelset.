import { getCurrentUser } from "@/lib/auth";
import { getStoreProfile } from "@/lib/store";
import StoreSettingsClient from "./store-settings-client";

export const dynamic = "force-dynamic";

export default async function StoreSettingsPage() {
  const user = (await getCurrentUser())!;
  const profile = await getStoreProfile(user.id);
  return (
    <StoreSettingsClient
      profile={{
        storeOpen: profile.storeOpen,
        closedMessage: profile.closedMessage,
        currency: profile.currency,
        cardPayments: profile.cardPayments,
        offlinePayments: profile.offlinePayments,
        offlineInstructions: profile.offlineInstructions,
        digitalLicense: profile.digitalLicense,
        termsOfSale: profile.termsOfSale,
        labEnabled: profile.labEnabled,
        labName: profile.labName,
        labEmail: profile.labEmail,
        labEndpoint: profile.labEndpoint,
        whiteLabelPackaging: profile.whiteLabelPackaging,
      }}
      labKeyPresent={Boolean(process.env.LAB_API_KEY)}
      webhookPresent={Boolean(process.env.LAB_WEBHOOK_SECRET)}
    />
  );
}

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
        taxEnabled: profile.taxEnabled,
        taxRate: profile.taxRate,
        currency: profile.currency,
        digitalLicense: profile.digitalLicense,
        termsOfSale: profile.termsOfSale,
        labEnabled: profile.labEnabled,
        labName: profile.labName,
        labEmail: profile.labEmail,
        labEndpoint: profile.labEndpoint,
      }}
      labKeyPresent={Boolean(process.env.LAB_API_KEY)}
    />
  );
}

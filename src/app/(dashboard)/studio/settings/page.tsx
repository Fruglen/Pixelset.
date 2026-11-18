import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getStudioProfile } from "@/lib/studio";
import { StudioSettings } from "./studio-settings";

export const dynamic = "force-dynamic";

export default async function StudioSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const p = await getStudioProfile(user.id);

  return (
    <StudioSettings
      profile={{
        bookingSlug: p.bookingSlug,
        welcomeText: p.welcomeText,
        businessEmail: p.businessEmail,
        businessPhone: p.businessPhone,
        businessAddress: p.businessAddress,
        taxId: p.taxId,
        defaultTaxRate: p.defaultTaxRate,
        pixelsetPaymentsConnected: p.pixelsetPaymentsConnected,
        stripeConnected: p.stripeConnected,
        stripeAccount: p.stripeAccount,
        paypalConnected: p.paypalConnected,
        paypalEmail: p.paypalEmail,
        manualEnabled: p.manualEnabled,
        manualInstructions: p.manualInstructions,
        showStripe: p.showStripe,
        showPaypal: p.showPaypal,
        showManual: p.showManual,
        googleCalendarSync: p.googleCalendarSync,
      }}
    />
  );
}

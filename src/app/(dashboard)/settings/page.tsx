import { getCurrentUser } from "@/lib/auth";
import { defaultFrom, resendConnected } from "@/lib/mailer";
import AccountSettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const user = (await getCurrentUser())!;
  return (
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
  );
}

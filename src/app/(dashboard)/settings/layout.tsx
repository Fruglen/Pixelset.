import { SettingsTabs } from "./tabs";
import { getDashT } from "@/lib/dashboard-lang";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getDashT();
  return (
    <div>
      <h1 className="text-2xl font-display mb-6">{t("settingsTitle")}</h1>
      <SettingsTabs />
      {children}
    </div>
  );
}

import { SettingsTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-display mb-6">Settings</h1>
      <SettingsTabs />
      {children}
    </div>
  );
}

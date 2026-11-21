"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashT } from "@/components/dash-lang";
import type { DashKey } from "@/lib/dashboard-i18n";

const TABS: { href: string; label: DashKey }[] = [
  { href: "/settings", label: "tab_account" },
  { href: "/settings/gallery", label: "tab_gallery" },
  { href: "/settings/team", label: "tab_team" },
  { href: "/settings/emails", label: "tab_emails" },
  { href: "/settings/plan", label: "tab_plan" },
  { href: "/settings/security", label: "tab_security" },
];

export function SettingsTabs() {
  const pathname = usePathname();
  const { t } = useDashT();
  return (
    <div className="border-b border-neutral-200 flex gap-5 overflow-x-auto mb-6">
      {TABS.map((tab) => {
        const active = tab.href === "/settings" ? pathname === "/settings" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`pb-2.5 text-sm whitespace-nowrap ${active ? "tab-active" : "tab-inactive"}`}
          >
            {t(tab.label)}
          </Link>
        );
      })}
    </div>
  );
}

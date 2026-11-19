"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings", label: "Account" },
  { href: "/settings/gallery", label: "Gallery" },
  { href: "/settings/team", label: "Team" },
  { href: "/settings/emails", label: "Email Templates" },
  { href: "/settings/plan", label: "Plan" },
  { href: "/settings/security", label: "Security" },
];

export function SettingsTabs() {
  const pathname = usePathname();
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
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

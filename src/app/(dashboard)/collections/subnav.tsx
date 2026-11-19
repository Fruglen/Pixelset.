"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Phase 5B platform: Client Gallery dashboard pages.
const TABS = [
  { href: "/collections", label: "Collections", exact: true },
  { href: "/collections/presets", label: "Presets" },
  { href: "/collections/settings", label: "Settings" },
  { href: "/collections/tools", label: "Tools" },
];

export function GallerySubnav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-neutral-200 flex gap-5 overflow-x-auto mb-6">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={`pb-2.5 text-sm whitespace-nowrap ${active ? "tab-active" : "tab-inactive"}`}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

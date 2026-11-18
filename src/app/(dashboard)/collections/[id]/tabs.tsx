"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CollectionTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/collections/${id}`;
  const tabs = [
    { href: base, label: "Photos" },
    { href: `${base}/settings`, label: "Collection Settings" },
    { href: `${base}/activities`, label: "Activities" },
  ];
  return (
    <nav className="flex gap-6 border-b border-neutral-200 mt-4">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`pb-2 text-sm ${pathname === t.href ? "tab-active" : "tab-inactive"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

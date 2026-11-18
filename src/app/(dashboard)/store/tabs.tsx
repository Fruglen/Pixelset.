"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/store", label: "Overview" },
  { href: "/store/orders", label: "Orders" },
  { href: "/store/price-sheets", label: "Price Sheets" },
  { href: "/store/coupons", label: "Coupons" },
  { href: "/store/gift-cards", label: "Gift Cards" },
  { href: "/store/settings", label: "Settings" },
];

export function StoreTabs({ newOrders }: { newOrders: number }) {
  const pathname = usePathname();
  return (
    <div className="border-b border-neutral-200 flex gap-5 overflow-x-auto">
      {TABS.map((tab) => {
        const active = tab.href === "/store" ? pathname === "/store" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`pb-2.5 text-sm whitespace-nowrap ${active ? "tab-active" : "tab-inactive"}`}
          >
            {tab.label}
            {tab.label === "Orders" && newOrders > 0 ? (
              <span className="ml-1.5 inline-flex items-center justify-center text-[10px] bg-neutral-900 text-white rounded-full px-1.5 py-0.5">
                {newOrders}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

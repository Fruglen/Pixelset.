"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/website", label: "Pages", exact: false },
  { href: "/website/blog", label: "Blog" },
  { href: "/website/design", label: "Design" },
  { href: "/website/seo", label: "SEO" },
  { href: "/website/messages", label: "Inbox" },
  { href: "/website/settings", label: "Settings" },
];

export function WebsiteTabs({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <div className="border-b border-neutral-200 flex gap-6">
      {TABS.map((tab) => {
        const active =
          tab.href === "/website"
            ? pathname === "/website" || pathname.startsWith("/website/pages")
            : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={`pb-2.5 text-sm ${active ? "tab-active" : "tab-inactive"}`}>
            {tab.label}
            {tab.label === "Inbox" && unread > 0 ? (
              <span className="ml-1.5 inline-flex items-center justify-center text-[10px] bg-neutral-900 text-white rounded-full px-1.5 py-0.5">
                {unread}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

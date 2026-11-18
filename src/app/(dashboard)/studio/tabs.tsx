"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/studio", label: "Overview" },
  { href: "/studio/sessions", label: "Sessions" },
  { href: "/studio/calendar", label: "Calendar" },
  { href: "/studio/contacts", label: "Contacts" },
  { href: "/studio/contracts", label: "Contracts" },
  { href: "/studio/invoices", label: "Invoices" },
  { href: "/studio/questionnaires", label: "Questionnaires" },
  { href: "/studio/projects", label: "Projects" },
  { href: "/studio/automations", label: "Automations" },
  { href: "/studio/inbox", label: "Inbox" },
  { href: "/studio/settings", label: "Settings" },
];

export function StudioTabs({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <div className="border-b border-neutral-200 flex gap-5 overflow-x-auto">
      {TABS.map((tab) => {
        const active =
          tab.href === "/studio"
            ? pathname === "/studio"
            : pathname.startsWith(tab.href) ||
              (tab.href === "/studio/invoices" && pathname.startsWith("/studio/quotes"));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`pb-2.5 text-sm whitespace-nowrap ${active ? "tab-active" : "tab-inactive"}`}
          >
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

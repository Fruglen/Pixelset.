"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "◧" },
  { href: "/collections", label: "Client Gallery", icon: "▦" },
  { href: "/store", label: "Store", icon: "⬡" },
  { href: "/website", label: "Website", icon: "◫" },
  { href: "/studio", label: "Studio Manager", icon: "◳" },
  { href: "/editor", label: "Photo Editor", icon: "◐" },
  { href: "/mobile-app", label: "Mobile App", icon: "▯" },
  { href: "/reports", label: "Reports", icon: "▥" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 w-60 border-r border-neutral-200 bg-white flex flex-col">
      <div className="px-6 py-5 border-b border-neutral-100">
        <Link href="/dashboard" className="font-display text-xl tracking-tight">
          Pixelset
        </Link>
      </div>
      <nav className="flex-1 py-4">
        {NAV.map((item) => {
          const active =
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-6 py-2.5 text-sm ${
                active
                  ? "bg-neutral-100 text-neutral-900 font-medium border-r-2 border-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-neutral-100 py-3">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-6 py-2.5 text-sm ${
            pathname.startsWith("/settings")
              ? "bg-neutral-100 text-neutral-900 font-medium"
              : "text-neutral-600 hover:bg-neutral-50"
          }`}
        >
          <span className="text-base leading-none">⚙</span>
          Settings
        </Link>
      </div>
    </aside>
  );
}

export function TopBar({ name, businessName }: { name: string; businessName: string }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="h-14 border-b border-neutral-200 bg-white flex items-center justify-end px-6 gap-4 sticky top-0 z-20">
      <span className="text-sm text-neutral-600">
        {businessName ? `${businessName} · ` : ""}
        {name}
      </span>
      <button onClick={logout} className="text-sm text-neutral-500 hover:text-neutral-900 underline">
        Sign out
      </button>
    </header>
  );
}

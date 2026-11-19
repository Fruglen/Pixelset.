"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "@/components/notification-bell";

// Phase 5B platform: each product has its own dashboard and navigation. The
// product switcher at the top of the account swaps the sidebar to that
// product's pages; "All products" returns to the account overview.
type ProductNav = { id: string; label: string; icon: string; home: string; match: string[]; items: { href: string; label: string; exact?: boolean }[] };
export const PRODUCTS: ProductNav[] = [
  {
    id: "gallery",
    label: "Client Gallery",
    icon: "▦",
    home: "/collections",
    match: ["/collections"],
    items: [
      { href: "/collections", label: "Collections", exact: true },
      { href: "/collections/presets", label: "Presets" },
      { href: "/collections/settings", label: "Settings" },
      { href: "/collections/tools", label: "Tools" },
    ],
  },
  {
    id: "website",
    label: "Website",
    icon: "◫",
    home: "/website",
    match: ["/website"],
    items: [
      { href: "/website", label: "Pages", exact: true },
      { href: "/website/blog", label: "Blog" },
      { href: "/website/design", label: "Design" },
      { href: "/website/seo", label: "SEO" },
      { href: "/website/messages", label: "Inbox" },
      { href: "/website/settings", label: "Settings" },
    ],
  },
  {
    id: "studio",
    label: "Studio Manager",
    icon: "◳",
    home: "/studio",
    match: ["/studio"],
    items: [
      { href: "/studio", label: "Overview", exact: true },
      { href: "/studio/sessions", label: "Sessions" },
      { href: "/studio/calendar", label: "Calendar" },
      { href: "/studio/contacts", label: "Contacts" },
      { href: "/studio/projects", label: "Projects" },
      { href: "/studio/contracts", label: "Contracts" },
      { href: "/studio/invoices", label: "Invoices" },
      { href: "/studio/coupons", label: "Booking coupons" },
      { href: "/studio/questionnaires", label: "Questionnaires" },
      { href: "/studio/forms", label: "Lead forms" },
      { href: "/studio/automations", label: "Automations" },
      { href: "/studio/reports", label: "Payments" },
      { href: "/studio/inbox", label: "Inbox" },
      { href: "/studio/settings", label: "Settings" },
    ],
  },
  {
    id: "store",
    label: "Store",
    icon: "⬡",
    home: "/store",
    match: ["/store"],
    items: [
      { href: "/store", label: "Overview", exact: true },
      { href: "/store/orders", label: "Orders" },
      { href: "/store/price-sheets", label: "Price Sheets" },
      { href: "/store/coupons", label: "Coupons" },
      { href: "/store/albums", label: "Albums" },
      { href: "/store/gift-cards", label: "Gift Cards" },
      { href: "/store/settings", label: "Settings" },
    ],
  },
  { id: "editor", label: "Photo Editor", icon: "◐", home: "/editor", match: ["/editor"], items: [{ href: "/editor", label: "Editor", exact: true }] },
  { id: "mobile", label: "Mobile App", icon: "▯", home: "/mobile-app", match: ["/mobile-app"], items: [{ href: "/mobile-app", label: "Mobile Apps", exact: true }] },
];

export function productFor(pathname: string): ProductNav | null {
  return PRODUCTS.find((p) => p.match.some((m) => pathname === m || pathname.startsWith(`${m}/`))) ?? null;
}

const NAV_EVENT = "pixelset:nav";

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
  const product = productFor(pathname);
  // Phase 5B platform: on phones the sidebar is a drawer opened from the top bar.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const toggle = () => setOpen((o) => !o);
    window.addEventListener(NAV_EVENT, toggle);
    return () => window.removeEventListener(NAV_EVENT, toggle);
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  return (
    <>
    {open ? <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setOpen(false)} /> : null}
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-60 border-r border-neutral-200 bg-white flex-col overflow-y-auto ${
        open ? "flex" : "hidden md:flex"
      }`}
    >
      <div className="px-6 py-5 border-b border-neutral-100">
        <Link href="/dashboard" className="font-display text-xl tracking-tight">
          Pixelset
        </Link>
        {product ? <p className="text-xs text-neutral-400 mt-1">{product.label}</p> : null}
      </div>
      {product ? (
        <nav className="flex-1 py-4" data-product-nav={product.id}>
          <Link href="/dashboard" className="flex items-center gap-2 px-6 pb-3 text-xs text-neutral-500 hover:text-neutral-900">
            ← All products
          </Link>
          {product.items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : (
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
      )}
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
    </>
  );
}

function ProductSwitcher() {
  const pathname = usePathname();
  const product = productFor(pathname);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded border border-neutral-200 hover:border-neutral-400"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="product-switcher"
      >
        <span>{product ? product.icon : "◧"}</span>
        <span>{product ? product.label : "All products"}</span>
        <span className="text-neutral-400 text-xs">▾</span>
      </button>
      {open ? (
        <div role="menu" className="absolute left-0 mt-1 w-56 rounded border border-neutral-200 bg-white shadow-lg py-1 z-50">
          <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50">
            <span>◧</span> All products
          </Link>
          {PRODUCTS.map((p) => (
            <Link
              key={p.id}
              href={p.home}
              className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50 ${product?.id === p.id ? "font-medium" : ""}`}
            >
              <span>{p.icon}</span> {p.label}
              {product?.id === p.id ? <span className="ml-auto text-xs text-neutral-400">current</span> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
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
    <header className="h-14 border-b border-neutral-200 bg-white flex items-center px-4 md:px-6 gap-3 md:gap-4 sticky top-0 z-20">
      <button
        className="md:hidden text-lg px-1"
        aria-label="Open navigation"
        onClick={() => window.dispatchEvent(new Event(NAV_EVENT))}
      >
        ☰
      </button>
      <ProductSwitcher />
      <div className="flex-1" />
      <NotificationBell />
      <span className="text-sm text-neutral-600 hidden sm:inline truncate max-w-[16rem]">
        {businessName ? `${businessName} · ` : ""}
        {name}
      </span>
      <button onClick={logout} className="text-sm text-neutral-500 hover:text-neutral-900 underline">
        Sign out
      </button>
    </header>
  );
}

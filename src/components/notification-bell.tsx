"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Item {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
}

import type { ComponentType } from "react";
import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  ClipboardIcon,
  CreditCardIcon,
  HeartIcon,
  MailIcon,
  PenIcon,
  StoreIcon,
} from "@/components/icons";

const ICON: Record<string, ComponentType<{ className?: string }>> = {
  BOOKING: CalendarIcon,
  QUOTE_ACCEPTED: CheckIcon,
  INVOICE_PAID: CreditCardIcon,
  CONTRACT_SIGNED: PenIcon,
  QUESTIONNAIRE_COMPLETED: ClipboardIcon,
  LIST_SUBMITTED: HeartIcon,
  ORDER: StoreIcon,
  FORM_SUBMISSION: MailIcon,
  MESSAGE: MailIcon,
};

function ago(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Phase 5B: header bell with unread count. Polls every 15 seconds so new
// bookings, payments, signatures and replies appear without a reload, and
// pops a short toast when something new arrives.
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<Item | null>(null);
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/studio/notifications", { cache: "no-store" }).catch(() => null);
    if (!res || !res.ok) return;
    const data = (await res.json()) as { unread: number; items: Item[] };
    setItems(data.items);
    setUnread(data.unread);
    if (seen.current) {
      const fresh = data.items.find((n) => !n.read && !seen.current!.has(n.id));
      if (fresh) {
        setToast(fresh);
        setTimeout(() => setToast(null), 6000);
      }
    }
    seen.current = new Set(data.items.map((n) => n.id));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  async function markAll() {
    await fetch("/api/studio/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    load();
  }

  async function go(n: Item) {
    setOpen(false);
    if (!n.read) {
      await fetch("/api/studio/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }) });
      load();
    }
    if (n.href) router.push(n.href);
  }

  return (
    <div className="relative">
      <button
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => setOpen(!open)}
        className="relative text-neutral-600 hover:text-neutral-900 text-lg leading-none px-1"
      >
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-500 text-white text-[10px] flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-neutral-200 rounded-xl shadow-lift z-30">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 ? (
              <button className="text-xs underline text-neutral-500" onClick={markAll}>
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-neutral-100">
            {items.length === 0 ? <p className="text-sm text-neutral-500 px-4 py-6 text-center">You are all caught up.</p> : null}
            {items.map((n) => (
              <button key={n.id} onClick={() => go(n)} className={`w-full text-left px-4 py-2.5 hover:bg-neutral-50 flex gap-3 ${n.read ? "" : "bg-neutral-50/60"}`}>
                {(() => { const NIcon = ICON[n.kind] ?? BellIcon; return <NIcon className="h-4 w-4 shrink-0 text-neutral-400 mt-0.5" />; })()}
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm truncate ${n.read ? "" : "font-semibold"}`}>{n.title}</span>
                  {n.body ? <span className="block text-xs text-neutral-500 truncate">{n.body}</span> : null}
                  <span className="block text-[11px] text-neutral-400">{ago(n.createdAt)}</span>
                </span>
                {!n.read ? <span className="w-2 h-2 rounded-full bg-brand-500 mt-1.5" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {toast ? (
        <button
          onClick={() => go(toast)}
          className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white rounded-lg shadow-lg px-4 py-3 text-left max-w-xs"
        >
          <span className="block text-sm font-medium">{toast.title}</span>
          {toast.body ? <span className="block text-xs text-neutral-300 mt-0.5">{toast.body}</span> : null}
        </button>
      ) : null}
    </div>
  );
}

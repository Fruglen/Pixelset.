"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Msg {
  id: string;
  source: "studio" | "website";
  kind: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  meta: string;
  read: boolean;
  createdAt: string;
}

const KIND_LABEL: Record<string, string> = {
  BOOKING: "Booking",
  WAITLIST: "Waitlist",
  CONTRACT: "Contract",
  PAYMENT: "Payment",
  QUOTE: "Quote",
  EMAIL: "Sent email",
  WEBSITE: "Website",
  NEWSLETTER: "Newsletter",
};

const KIND_COLOR: Record<string, string> = {
  BOOKING: "bg-emerald-100 text-emerald-700",
  WAITLIST: "bg-purple-100 text-purple-700",
  CONTRACT: "bg-blue-100 text-blue-700",
  PAYMENT: "bg-amber-100 text-amber-700",
  QUOTE: "bg-sky-100 text-sky-700",
  EMAIL: "bg-neutral-100 text-neutral-500",
  WEBSITE: "bg-rose-100 text-rose-700",
  NEWSLETTER: "bg-neutral-100 text-neutral-600",
};

const FILTERS = ["ALL", "BOOKING", "WAITLIST", "CONTRACT", "PAYMENT", "QUOTE", "WEBSITE", "EMAIL"];

export function InboxClient({ messages }: { messages: Msg[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("ALL");
  const [open, setOpen] = useState("");

  const filtered = messages.filter((m) =>
    filter === "ALL" ? true : filter === "WEBSITE" ? m.kind === "WEBSITE" || m.kind === "NEWSLETTER" : m.kind === filter
  );

  function endpoint(m: Msg) {
    return m.source === "studio" ? `/api/studio/messages/${m.id}` : `/api/website/messages/${m.id}`;
  }

  async function openMessage(m: Msg) {
    setOpen(open === m.id ? "" : m.id);
    if (!m.read) {
      await fetch(endpoint(m), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      router.refresh();
    }
  }

  async function remove(m: Msg) {
    if (!confirm("Delete this message?")) return;
    await fetch(endpoint(m), { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              filter === f ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {f === "ALL" ? "All" : KIND_LABEL[f] ?? f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-500 py-10 text-center">
          Nothing here yet, bookings, payments, signed contracts and website messages all land in this inbox.
        </p>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {filtered.map((m) => (
            <div key={`${m.source}-${m.id}`}>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50" onClick={() => openMessage(m)}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.read ? "bg-transparent" : "bg-blue-600"}`} />
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${KIND_COLOR[m.kind] ?? "bg-neutral-100"}`}>
                  {KIND_LABEL[m.kind] ?? m.kind}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm truncate ${m.read ? "" : "font-semibold"}`}>{m.subject}</span>
                  <span className="block text-xs text-neutral-500 truncate">
                    {m.name || m.email || "-"}
                    {m.name && m.email ? ` · ${m.email}` : ""}
                  </span>
                </span>
                <span className="text-xs text-neutral-400 whitespace-nowrap">
                  {new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              </button>
              {open === m.id ? (
                <div className="px-4 pb-4 pl-11">
                  <div className="bg-neutral-50 rounded-md p-4 text-sm">
                    <p className="whitespace-pre-wrap">{m.body || "(no message body)"}</p>
                    {m.meta ? <p className="text-xs text-neutral-500 mt-2">{m.meta}</p> : null}
                    <div className="flex gap-3 mt-3 text-xs">
                      {m.email ? (
                        <a className="underline text-neutral-600" href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`}>
                          Reply by email
                        </a>
                      ) : null}
                      <button className="underline text-red-600" onClick={() => remove(m)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

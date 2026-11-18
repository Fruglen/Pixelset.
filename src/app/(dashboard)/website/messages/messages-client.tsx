"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/utils";

interface Message {
  id: string;
  kind: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  body: string;
  meta: string;
  read: boolean;
  createdAt: string;
}

const KIND_LABEL: Record<string, string> = {
  CONTACT: "Contact",
  BOOKING: "Booking",
  NEWSLETTER: "Newsletter",
};

export function MessagesClient({ messages }: { messages: Message[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("ALL");

  const filtered = filter === "ALL" ? messages : messages.filter((m) => m.kind === filter);

  async function setRead(id: string, read: boolean) {
    await fetch(`/api/website/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this message?")) return;
    await fetch(`/api/website/messages/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {["ALL", "CONTACT", "BOOKING", "NEWSLETTER"].map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              filter === k ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-600 hover:border-neutral-500"
            }`}
          >
            {k === "ALL" ? "All" : KIND_LABEL[k]}
          </button>
        ))}
        <p className="text-xs text-neutral-400 ml-auto">
          Contact-form, booking and newsletter submissions from your public site land here.
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-sm text-neutral-500">No messages yet.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <details key={m.id} className={`card ${m.read ? "" : "border-neutral-900"}`} onToggle={(e) => {
              if ((e.target as HTMLDetailsElement).open && !m.read) setRead(m.id, true);
            }}>
              <summary className="px-4 py-3 cursor-pointer list-none flex items-center gap-3">
                {!m.read ? <span className="w-2 h-2 rounded-full bg-neutral-900 flex-none" /> : <span className="w-2 flex-none" />}
                <span
                  className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 flex-none ${
                    m.kind === "BOOKING" ? "bg-blue-50 text-blue-700" : m.kind === "NEWSLETTER" ? "bg-purple-50 text-purple-700" : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {KIND_LABEL[m.kind] ?? m.kind}
                </span>
                <span className="text-sm font-medium flex-none">{m.name || m.email}</span>
                <span className="text-sm text-neutral-500 truncate flex-1">{m.subject || m.body || m.meta}</span>
                <span className="text-xs text-neutral-400 flex-none">{formatDateTime(m.createdAt)}</span>
              </summary>
              <div className="border-t border-neutral-100 px-4 py-4 text-sm space-y-2">
                <p>
                  <span className="text-neutral-400">From:</span> {m.name} &lt;{m.email}&gt;
                  {m.phone ? ` · ${m.phone}` : ""}
                </p>
                {m.meta ? <p><span className="text-neutral-400">Details:</span> {m.meta}</p> : null}
                {m.body ? <p className="whitespace-pre-wrap bg-neutral-50 rounded p-3">{m.body}</p> : null}
                <div className="flex gap-3 pt-1">
                  <a href={`mailto:${m.email}`} className="btn-secondary !py-1.5 !px-3 text-xs">Reply by email</a>
                  <button className="text-xs text-neutral-500 underline hover:text-neutral-900" onClick={() => setRead(m.id, !m.read)}>
                    Mark as {m.read ? "unread" : "read"}
                  </button>
                  <button className="text-xs text-neutral-500 underline hover:text-red-600" onClick={() => remove(m.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

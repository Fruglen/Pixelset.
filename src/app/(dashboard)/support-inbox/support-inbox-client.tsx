"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Msg = {
  id: string;
  account: string;
  fromName: string;
  fromEmail: string;
  topic: string;
  body: string;
  page: string;
  status: string;
  reply: string;
  replyNote: string;
  repliedAt: string | null;
  createdAt: string;
};

export default function SupportInboxClient({ messages, topics }: { messages: Msg[]; topics: Record<string, string> }) {
  const router = useRouter();
  const [filter, setFilter] = useState("OPEN");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const shown = messages.filter((m) => filter === "ALL" || m.status === filter);
  const count = (s: string) => messages.filter((m) => m.status === s).length;

  async function act(id: string, payload: Record<string, string>) {
    setBusy(id);
    setError("");
    const res = await fetch(`/api/support/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy("");
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Could not update the message");
      return;
    }
    setDrafts((d) => ({ ...d, [id]: "" }));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          ["OPEN", `Open (${count("OPEN")})`],
          ["ANSWERED", `Answered (${count("ANSWERED")})`],
          ["CLOSED", `Closed (${count("CLOSED")})`],
          ["ALL", `All (${messages.length})`],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`text-xs px-3 py-1 rounded-full border ${filter === id ? "border-brand-500 bg-brand-50 text-brand-800" : "border-neutral-200 text-neutral-600"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {shown.length === 0 ? (
        <div className="card p-6 text-sm text-neutral-500">Nothing here.</div>
      ) : (
        shown.map((m) => (
          <div key={m.id} className="card p-5 space-y-3" data-testid="support-message">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="font-medium">{m.fromName || m.fromEmail}</p>
              <p className="text-xs text-neutral-500">
                {m.fromEmail} · {m.account} · {topics[m.topic] ?? m.topic} · {new Date(m.createdAt).toLocaleString()}
                {m.page ? ` · sent from ${m.page}` : ""}
              </p>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">{m.status.toLowerCase()}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{m.body}</p>
            {m.reply ? (
              <div className="rounded-lg bg-brand-50 p-3 text-sm">
                <p className="text-xs text-neutral-500 mb-1">
                  Your reply{m.repliedAt ? `, ${new Date(m.repliedAt).toLocaleString()}` : ""} · {m.replyNote}
                </p>
                <p className="whitespace-pre-wrap">{m.reply}</p>
              </div>
            ) : null}
            {m.status !== "CLOSED" ? (
              <div className="space-y-2">
                <textarea
                  className="input min-h-[5rem]"
                  placeholder={`Reply to ${m.fromEmail} by email`}
                  value={drafts[m.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                />
                <div className="flex justify-end gap-2">
                  <button className="btn-secondary" disabled={busy === m.id} onClick={() => act(m.id, { action: "close" })}>
                    Close
                  </button>
                  <button className="btn-primary" disabled={busy === m.id || !(drafts[m.id] ?? "").trim()} onClick={() => act(m.id, { reply: drafts[m.id] ?? "" })}>
                    Send reply
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button className="btn-secondary" disabled={busy === m.id} onClick={() => act(m.id, { action: "reopen" })}>
                  Reopen
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

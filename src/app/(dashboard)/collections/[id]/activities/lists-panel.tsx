"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ListRow = {
  id: string;
  name: string;
  clientName: string;
  clientEmail: string;
  selectionLimit: number | null;
  submittedAt: string | null;
  favorites: { filename: string; note: string }[];
};

/** Lightroom ready filename list: base names without extension, comma separated. */
function lightroomList(files: string[]) {
  return files.map((f) => f.replace(/\.[^.]+$/, "")).join(", ");
}

// Phase 5B: favorite lists for the photographer, with one click filename copy
// per list, submitted state, and reopen.
export default function ListsPanel({ lists }: { lists: ListRow[] }) {
  const router = useRouter();
  const [copied, setCopied] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, string>>({});
  const [sending, setSending] = useState("");

  async function sendAsDownload(list: ListRow) {
    setSending(list.id);
    try {
      const res = await fetch(`/api/gallery/lists/${list.id}/send-download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Could not send the download");
        return;
      }
      setSent((m) => ({
        ...m,
        [list.id]: `Download link created for ${data.email}: ${window.location.origin}${data.link} (the email goes out when the ZIP is ready, and the link expires in 7 days)`,
      }));
    } finally {
      setSending("");
    }
  }

  async function copy(list: ListRow) {
    const text = lightroomList(list.favorites.map((f) => f.filename));
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy the filenames:", text);
    }
    setCopied(list.id);
    setTimeout(() => setCopied(""), 1800);
  }

  async function reopen(id: string) {
    await fetch(`/api/gallery/lists/${id}/submit`, { method: "DELETE" });
    router.refresh();
  }

  if (lists.length === 0) return null;
  return (
    <div className="card mb-5 divide-y divide-neutral-100">
      <p className="label px-4 pt-4">Favorite lists ({lists.length})</p>
      {lists.map((l) => (
        <div key={l.id} className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <button className="text-sm font-medium hover:underline" onClick={() => setOpen(open === l.id ? null : l.id)}>
              {l.name}
            </button>
            <span className="text-xs text-neutral-500">
              {l.clientName ? `${l.clientName}, ` : ""}
              {l.clientEmail} · {l.favorites.length}
              {l.selectionLimit ? ` of ${l.selectionLimit}` : ""} photos
            </span>
            {l.submittedAt ? (
              <span className="text-[10px] uppercase tracking-wide bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                Submitted {new Date(l.submittedAt).toLocaleDateString()}
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-wide bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">In progress</span>
            )}
            <div className="ml-auto flex gap-2">
              <button className="btn-secondary !py-1 !px-2 text-xs" onClick={() => copy(l)} disabled={l.favorites.length === 0}>
                {copied === l.id ? "Copied!" : "Copy filenames"}
              </button>
              <button
                className="btn-secondary !py-1 !px-2 text-xs"
                onClick={() => sendAsDownload(l)}
                disabled={l.favorites.length === 0 || sending === l.id}
              >
                {sending === l.id ? "Sending…" : "Send as download"}
              </button>
              {l.submittedAt && (
                <button className="btn-secondary !py-1 !px-2 text-xs" onClick={() => reopen(l.id)}>
                  Reopen
                </button>
              )}
            </div>
          </div>
          {sent[l.id] && <p className="text-xs text-emerald-700 mt-2 break-all">{sent[l.id]}</p>}
          {open === l.id && (
            <ul className="mt-2 text-xs text-neutral-600 space-y-0.5">
              {l.favorites.map((f) => (
                <li key={f.filename}>
                  <span className="font-mono">{f.filename}</span>
                  {f.note && <span className="text-neutral-400"> · “{f.note}”</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

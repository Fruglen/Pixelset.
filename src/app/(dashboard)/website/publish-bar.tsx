"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Phase 5B: draft site bar. Every edit (blocks, pages, design, template
// switches) lands on the draft; visitors keep seeing the published site until
// the photographer publishes.
export function PublishBar({ changes, publishedAt, slug }: { changes: string[]; publishedAt: string | null; slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function act(action: "publish" | "discard") {
    if (action === "discard" && !confirm("Discard every unpublished change and go back to the live version of your site?")) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/website/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not update the site");
    router.refresh();
  }

  const dirty = changes.length > 0;
  return (
    <div className={`card px-4 py-3 mb-5 flex items-center gap-3 flex-wrap ${dirty ? "border-amber-300 bg-amber-50/60" : ""}`}>
      <span className={`w-2 h-2 rounded-full ${dirty ? "bg-amber-500" : "bg-emerald-500"}`} />
      <div className="flex-1 min-w-0 text-sm">
        {dirty ? (
          <>
            <span className="font-medium">Draft has {changes.length} unpublished change{changes.length === 1 ? "" : "s"}.</span>{" "}
            <span className="text-neutral-500">Visitors still see the live version.</span>{" "}
            <button className="text-xs underline text-neutral-500" onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "What changed"}</button>
          </>
        ) : (
          <span className="text-neutral-600">
            Draft and live site match{publishedAt ? `, last published ${new Date(publishedAt).toLocaleString()}` : ""}.
          </span>
        )}
        {open && dirty ? (
          <ul className="mt-2 text-xs text-neutral-600 list-disc pl-5 space-y-0.5">
            {changes.slice(0, 20).map((c, i) => <li key={i}>{c}</li>)}
            {changes.length > 20 ? <li>and {changes.length - 20} more</li> : null}
          </ul>
        ) : null}
        {error ? <p className="text-xs text-red-600 mt-1">{error}</p> : null}
      </div>
      <a href={`/api/website/preview?mode=draft&slug=${encodeURIComponent(slug)}`} target="_blank" rel="noreferrer" className="btn-secondary !py-1.5 text-xs">
        Preview draft ↗
      </a>
      {dirty ? (
        <>
          <button className="btn-secondary !py-1.5 text-xs" disabled={busy} onClick={() => act("discard")}>Discard changes</button>
          <button className="btn-primary !py-1.5 text-xs" disabled={busy} onClick={() => act("publish")}>{busy ? "Publishing…" : "Publish changes"}</button>
        </>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";

type Result = { url: string; kind: string; where: string; ok: boolean; status: string };

// Phase 5B platform: broken link check panel for the SEO tab.
export function LinkChecker() {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<{ checked: number; broken: number; results: Result[] } | null>(null);
  const [showAll, setShowAll] = useState(false);
  async function run() {
    setBusy(true);
    const res = await fetch("/api/website/link-check", { method: "POST" });
    setData(res.ok ? await res.json() : { checked: 0, broken: 0, results: [] });
    setBusy(false);
  }
  const rows = data ? (showAll ? data.results : data.results.filter((r) => !r.ok)) : [];
  return (
    <section className="card p-5 space-y-3" id="links">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">Broken links</h2>
          <p className="text-sm text-neutral-500">
            Tests every link and image on your pages and blog posts: internal pages, posts, files and galleries, and a live
            request to each external site.
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={run} disabled={busy}>
          {busy ? "Checking…" : data ? "Check again" : "Check links"}
        </button>
      </div>
      {data ? (
        <>
          <p className={`text-sm ${data.broken ? "text-red-600" : "text-emerald-600"}`}>
            {data.checked} checked, {data.broken} broken.
          </p>
          {data.results.length ? (
            <label className="text-xs text-neutral-500 flex items-center gap-1.5">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show working links too
            </label>
          ) : null}
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-xs text-neutral-400 uppercase tracking-wide">
                    <th className="py-1.5 font-medium">Link</th>
                    <th className="py-1.5 font-medium">On</th>
                    <th className="py-1.5 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1.5 pr-3 break-all">
                        {r.kind === "image" ? "Image: " : ""}
                        {r.url}
                      </td>
                      <td className="py-1.5 pr-3 whitespace-nowrap text-neutral-600">{r.where}</td>
                      <td className={`py-1.5 whitespace-nowrap ${r.ok ? "text-emerald-600" : "text-red-600"}`}>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

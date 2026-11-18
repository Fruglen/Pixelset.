"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Block, blockDef } from "@/lib/blocks";

interface ImageRef {
  blockId: string;
  blockType: string;
  path: string;
  url: string;
  alt: string;
}

interface SeoPage {
  id: string;
  title: string;
  slug: string;
  type: string;
  seoTitle: string;
  seoDescription: string;
  blocks: Block[];
  images: ImageRef[];
}

interface RedirectRow {
  id: string;
  fromPath: string;
  toPath: string;
}

// Apply an alt-text edit back into a page's blocks array.
function withAlt(blocks: Block[], ref: ImageRef, alt: string): Block[] {
  return blocks.map((block) => {
    if (block.id !== ref.blockId) return block;
    const def = blockDef(block.type);
    if (!def) return block;
    if (!ref.path.includes(".")) {
      const altKey = ref.path === "image" ? "imageAlt" : `${ref.path}Alt`;
      return { ...block, props: { ...block.props, [altKey]: alt } };
    }
    const [listKey, idxStr] = ref.path.split(".");
    const idx = parseInt(idxStr, 10);
    const field = def.fields.find((f) => f.key === listKey);
    const imgField = field?.fields?.find((sf) => sf.kind === "image");
    if (!field || !imgField) return block;
    const altKey = imgField.key === "image" ? "imageAlt" : imgField.key === "url" ? "alt" : `${imgField.key}Alt`;
    const items = Array.isArray(block.props[listKey]) ? ([...(block.props[listKey] as Record<string, unknown>[])]) : [];
    if (!items[idx]) return block;
    items[idx] = { ...items[idx], [altKey]: alt };
    return { ...block, props: { ...block.props, [listKey]: items } };
  });
}

export function SeoClient({ siteSlug, logoText, pages: initialPages, redirects }: { siteSlug: string; logoText: string; pages: SeoPage[]; redirects: RedirectRow[] }) {
  const router = useRouter();
  const [pages, setPages] = useState(initialPages);
  const [savingId, setSavingId] = useState("");
  const [note, setNote] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [redirectError, setRedirectError] = useState("");

  const missingAlt = pages.reduce((n, p) => n + p.images.filter((im) => !im.alt.trim()).length, 0);

  function setPage(id: string, patch: Partial<SeoPage>) {
    setPages((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function saveMeta(page: SeoPage) {
    setSavingId(page.id);
    setNote("");
    await fetch(`/api/website/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seoTitle: page.seoTitle, seoDescription: page.seoDescription }),
    });
    setSavingId("");
    setNote(`Saved search listing for ${page.title}.`);
    router.refresh();
  }

  async function saveAlts(page: SeoPage) {
    setSavingId(page.id);
    setNote("");
    await fetch(`/api/website/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks: JSON.stringify(page.blocks) }),
    });
    setSavingId("");
    setNote(`Saved image alt text for ${page.title}.`);
    router.refresh();
  }

  function editAlt(page: SeoPage, ref: ImageRef, alt: string) {
    const blocks = withAlt(page.blocks, ref, alt);
    setPage(page.id, {
      blocks,
      images: page.images.map((im) => (im === ref || (im.blockId === ref.blockId && im.path === ref.path) ? { ...im, alt } : im)),
    });
  }

  async function addRedirect() {
    setRedirectError("");
    const res = await fetch("/api/website/redirects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromPath: from, toPath: to }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setRedirectError(data.error ?? "Could not add redirect");
      return;
    }
    setFrom("");
    setTo("");
    router.refresh();
  }

  async function removeRedirect(id: string) {
    await fetch(`/api/website/redirects/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-10">
      {note ? <p className="text-sm text-emerald-700">{note}</p> : null}

      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-medium">Search listings</h2>
            <p className="text-sm text-neutral-500">Per-page title and description shown in search results.</p>
          </div>
          <a href={`/site/${siteSlug}/sitemap.xml`} target="_blank" rel="noreferrer" className="btn-secondary">
            sitemap.xml ↗
          </a>
        </div>
        <div className="space-y-3">
          {pages.map((page) => (
            <details key={page.id} className="card">
              <summary className="px-4 py-3 cursor-pointer flex items-center gap-3 list-none">
                <span className="text-sm font-medium flex-1">{page.title}</span>
                <span className="text-xs text-neutral-400">/{page.slug}</span>
                <span className={`text-xs ${page.seoTitle || page.seoDescription ? "text-emerald-600" : "text-neutral-400"}`}>
                  {page.seoTitle || page.seoDescription ? "customized" : "defaults"}
                </span>
              </summary>
              <div className="border-t border-neutral-100 px-4 py-4 space-y-3">
                <div>
                  <label className="label">Title tag</label>
                  <input
                    className="input"
                    placeholder={`${page.title}, ${logoText}`}
                    value={page.seoTitle}
                    onChange={(e) => setPage(page.id, { seoTitle: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Meta description</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={page.seoDescription}
                    onChange={(e) => setPage(page.id, { seoDescription: e.target.value })}
                  />
                </div>
                <div className="bg-neutral-50 rounded p-3">
                  <p className="text-[#1a0dab] text-base leading-tight">{page.seoTitle || `${page.title}, ${logoText}`}</p>
                  <p className="text-[#006621] text-xs mt-0.5">{siteSlug}.mypixelset.com/{page.slug}</p>
                  <p className="text-neutral-600 text-xs mt-0.5">{page.seoDescription || "No description set, search engines will pick their own."}</p>
                </div>
                <button className="btn-primary" disabled={savingId === page.id} onClick={() => saveMeta(page)}>
                  {savingId === page.id ? "Saving…" : "Save listing"}
                </button>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-medium">Image alt text</h2>
        <p className="text-sm text-neutral-500 mb-3">
          Describe each image for search engines and screen readers.{" "}
          {missingAlt > 0 ? <span className="text-amber-600">{missingAlt} image{missingAlt === 1 ? "" : "s"} missing alt text.</span> : <span className="text-emerald-600">All images have alt text.</span>}
        </p>
        <div className="space-y-3">
          {pages.filter((p) => p.images.length > 0).map((page) => (
            <details key={page.id} className="card" open={page.images.some((im) => !im.alt.trim())}>
              <summary className="px-4 py-3 cursor-pointer flex items-center gap-3 list-none">
                <span className="text-sm font-medium flex-1">{page.title}</span>
                <span className="text-xs text-neutral-400">{page.images.length} image{page.images.length === 1 ? "" : "s"}</span>
                {page.images.some((im) => !im.alt.trim()) ? <span className="text-xs text-amber-600">missing alt</span> : <span className="text-xs text-emerald-600">✓</span>}
              </summary>
              <div className="border-t border-neutral-100 px-4 py-4 space-y-2">
                {page.images.map((im, i) => (
                  <div key={`${im.blockId}-${im.path}-${i}`} className="flex items-center gap-3">
                    <img src={im.url} alt="" className="w-12 h-12 object-cover rounded border border-neutral-200 flex-none" />
                    <span className="text-xs text-neutral-400 w-28 flex-none truncate">{im.blockType}</span>
                    <input
                      className={`input ${!im.alt.trim() ? "border-amber-400" : ""}`}
                      placeholder="Describe this image…"
                      value={im.alt}
                      onChange={(e) => editAlt(page, im, e.target.value)}
                    />
                  </div>
                ))}
                <button className="btn-primary mt-2" disabled={savingId === page.id} onClick={() => saveAlts(page)}>
                  {savingId === page.id ? "Saving…" : "Save alt text"}
                </button>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-medium">301 redirects</h2>
        <p className="text-sm text-neutral-500 mb-3">
          Permanently forward old paths on your site to new destinations (served as a permanent redirect).
        </p>
        <div className="card p-4">
          <div className="flex gap-2 items-center flex-wrap">
            <input className="input !w-56" placeholder="/old-path" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-neutral-400">→</span>
            <input className="input !w-64" placeholder="/pricing or https://…" value={to} onChange={(e) => setTo(e.target.value)} />
            <button className="btn-primary" onClick={addRedirect} disabled={!from.trim() || !to.trim()}>Add redirect</button>
          </div>
          {redirectError ? <p className="text-sm text-red-600 mt-2">{redirectError}</p> : null}
          {redirects.length > 0 ? (
            <div className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100">
              {redirects.map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2 text-sm">
                  <code className="text-xs bg-neutral-50 rounded px-1.5 py-0.5">{r.fromPath}</code>
                  <span className="text-neutral-400">→</span>
                  <code className="text-xs bg-neutral-50 rounded px-1.5 py-0.5 flex-1 truncate">{r.toPath}</code>
                  <button onClick={() => removeRedirect(r.id)} className="text-neutral-400 hover:text-red-600">✕</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-400 mt-3">No redirects yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

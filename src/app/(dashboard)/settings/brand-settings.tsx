"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Phase 5B platform: one brand source applied to the website, galleries, store,
// booking pages, contracts, quotes, questionnaires, invoices and payment links.
export function BrandSettings({
  initial,
  fonts,
}: {
  initial: { logoUrl: string; color: string; accent: string; font: string; businessName: string };
  fonts: { id: string; name: string; display: string }[];
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const font = fonts.find((f) => f.id === v.font) ?? fonts[0];

  async function save() {
    setMsg(null);
    const res = await fetch("/api/account/brand", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandColor: v.color, brandAccent: v.accent, brandFont: v.font }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: "Brand saved. Every client page now uses it." } : { ok: false, text: data.error || "Could not save" });
    router.refresh();
  }
  async function upload(file: File) {
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/account/brand", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setV({ ...v, logoUrl: data.url });
    setMsg(res.ok ? { ok: true, text: "Logo uploaded" } : { ok: false, text: data.error || "Upload failed" });
    router.refresh();
  }
  async function removeLogo() {
    await fetch("/api/account/brand", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeLogo: true }),
    });
    setV({ ...v, logoUrl: "" });
    router.refresh();
  }

  return (
    <section className="card p-6 space-y-4 max-w-xl mt-6" id="brand">
      <div>
        <h2 className="font-display text-lg">Brand</h2>
        <p className="text-sm text-neutral-500">
          One logo, colour and heading font used on your website, galleries, store, booking pages, contracts, quotes,
          questionnaires, invoices and payment links. A website palette or a contract template&rsquo;s own logo still wins where
          you set one.
        </p>
      </div>
      <div className="flex items-center gap-4">
        {v.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.logoUrl} alt="Brand logo" className="max-h-14 max-w-[180px] object-contain border border-neutral-200 rounded p-1" />
        ) : (
          <div className="h-14 w-32 rounded border border-dashed border-neutral-300 grid place-items-center text-xs text-neutral-400">No logo</div>
        )}
        <label className="btn-secondary cursor-pointer">
          Upload logo
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {v.logoUrl ? (
          <button className="text-xs underline text-neutral-500" onClick={removeLogo}>
            Remove
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Brand colour</label>
          <div className="flex gap-2">
            <input type="color" value={v.color || "#1c1c1c"} onChange={(e) => setV({ ...v, color: e.target.value })} className="h-9 w-12 border border-neutral-200 rounded" />
            <input className="input" placeholder="#1c1c1c" value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Accent colour</label>
          <div className="flex gap-2">
            <input type="color" value={v.accent || v.color || "#1c1c1c"} onChange={(e) => setV({ ...v, accent: e.target.value })} className="h-9 w-12 border border-neutral-200 rounded" />
            <input className="input" placeholder="same as brand" value={v.accent} onChange={(e) => setV({ ...v, accent: e.target.value })} />
          </div>
        </div>
      </div>
      <div>
        <label className="label">Heading font</label>
        <select className="input" value={v.font} onChange={(e) => setV({ ...v, font: e.target.value })}>
          {fonts.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded border border-neutral-200 p-4 text-center" style={{ borderTop: `4px solid ${v.color || "#1c1c1c"}` }}>
        <p className="text-xs text-neutral-400 mb-1">Preview</p>
        {v.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.logoUrl} alt="" className="mx-auto max-h-10" />
        ) : (
          <p className="text-2xl" style={{ fontFamily: font.display, color: v.color || undefined }}>
            {v.businessName || "Your Studio"}
          </p>
        )}
        <span className="inline-block mt-2 text-xs text-white px-3 py-1 rounded" style={{ background: v.accent || v.color || "#1c1c1c" }}>
          Pay invoice
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save}>
          Save Brand
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </section>
  );
}

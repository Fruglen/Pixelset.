"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Phase 5B platform: the photographer chooses the size and JPEG quality of the
// preview renditions clients see in galleries (and of watermarked previews).
// Previews are generated with sharp and cached; originals are never touched.

const SIZES = [
  { v: 1024, label: "1024 px, fastest" },
  { v: 1600, label: "1600 px" },
  { v: 2048, label: "2048 px, recommended" },
  { v: 2560, label: "2560 px, sharp on large screens" },
  { v: 3200, label: "3200 px, maximum detail" },
];

export default function PreviewQualitySection({ initial }: { initial: { previewSize: number; previewQuality: number } }) {
  const router = useRouter();
  const [size, setSize] = useState(initial.previewSize);
  const [quality, setQuality] = useState(initial.previewQuality);
  const [sample, setSample] = useState<{ url: string; bytes: number; dims: string; source: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let made = "";
    const t = setTimeout(async () => {
      const res = await fetch(`/api/account/preview-sample?size=${size}&quality=${quality}`);
      if (!res.ok || cancelled) return;
      const blob = await res.blob();
      made = URL.createObjectURL(blob);
      setSample((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return {
          url: made,
          bytes: Number(res.headers.get("X-Bytes")) || blob.size,
          dims: res.headers.get("X-Dimensions") || "",
          source: res.headers.get("X-Source") || "",
        };
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [size, quality]);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previewSize: size, previewQuality: quality }),
    });
    setSaving(false);
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ ok: true, text: "Preview quality saved. Galleries now serve previews at this size and quality." });
      router.refresh();
    } else setMsg({ ok: false, text: d.error || "Could not save" });
  }

  return (
    <section className="card p-6 max-w-3xl mt-6">
      <h2 className="font-display text-lg mb-1">Preview quality</h2>
      <p className="text-sm text-neutral-500 mb-4">
        Clients see generated preview images, not your full files. Choose how large and how lightly compressed they are. A
        higher setting looks sharper, a lower one loads faster on slow phones. Downloads always use the sizes you offer, and
        originals are never recompressed.
      </p>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="label">Preview size (longest edge)</label>
            <select className="input" value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {SIZES.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">JPEG quality ({quality})</label>
            <input type="range" min={60} max={95} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
            <p className="text-xs text-neutral-400 mt-1">85 is a good balance. 90 and above keeps full colour detail (no chroma subsampling).</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-primary shrink-0 whitespace-nowrap" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Preview Quality"}
            </button>
            {msg && <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
          </div>
        </div>
        <div>
          <p className="label">Result</p>
          {sample ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sample.url} alt="Preview rendition" className="w-full rounded border border-neutral-200" />
              <p className="text-xs text-neutral-500 mt-1">
                {sample.dims} px, {(sample.bytes / 1024).toFixed(0)} KB{sample.source !== "sample" ? `, from ${sample.source}` : ", sample image"}
              </p>
            </>
          ) : (
            <div className="aspect-[3/2] rounded border border-neutral-200 bg-neutral-50" />
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ANIMATION_STYLES, ANIMATION_SPEEDS, type CustomFont } from "@/lib/site-ext";

// Night build (Website): design page extras, entrance animation controls
// and the font library (Google Fonts catalogue + uploads).

async function patchWebsite(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch("/api/website", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.error ?? "Save failed";
}

export function AnimationSettings({ initial }: { initial: { style: string; speed: string } }) {
  const [style, setStyle] = useState(initial.style);
  const [speed, setSpeed] = useState(initial.speed);
  const [error, setError] = useState("");
  async function apply(nextStyle: string, nextSpeed: string) {
    setError("");
    const err = await patchWebsite({ animationStyle: nextStyle, animationSpeed: nextSpeed });
    if (err) return setError(err);
    setStyle(nextStyle);
    setSpeed(nextSpeed);
  }
  return (
    <section className="mt-10">
      <h2 className="font-medium">Motion</h2>
      <p className="text-sm text-neutral-500 mt-1 mb-4">
        How sections of your site appear as visitors scroll. Applied across the whole site; reduced motion preferences are always respected.
      </p>
      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
        {ANIMATION_STYLES.map((a) => (
          <button
            key={a.id}
            className={`card p-3 text-left hover:shadow-md transition-shadow ${style === a.id ? "ring-2 ring-neutral-900" : ""}`}
            onClick={() => apply(a.id, speed)}
          >
            <span className="block text-sm font-medium">{a.name}</span>
            <span className="block text-xs text-neutral-500 mt-1">{a.desc}</span>
          </button>
        ))}
      </div>
      {style !== "none" ? (
        <div className="flex items-center gap-2 mt-4">
          <span className="text-xs text-neutral-500 mr-1">Speed</span>
          {ANIMATION_SPEEDS.map((s) => (
            <button
              key={s.id}
              className={`px-3 py-1.5 rounded-full text-xs border ${speed === s.id ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300"}`}
              onClick={() => apply(style, s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

interface FontsData {
  families: string[];
  total: number;
  live: boolean;
  custom: CustomFont[];
  display: string;
  body: string;
}

export function FontsSettings() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<FontsData | null>(null);
  const [error, setError] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load(query: string) {
    const res = await fetch(`/api/website/fonts?q=${encodeURIComponent(query)}`);
    if (!res.ok) return;
    setData(await res.json());
  }
  useEffect(() => {
    load("");
  }, []);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => load(q), 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Load the visible families so each row previews in its own font.
  const previewHref =
    data && data.families.length > 0
      ? `https://fonts.googleapis.com/css2?${data.families.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;700`).join("&")}&display=swap`
      : null;

  async function pick(role: "display" | "body", family: string) {
    setError("");
    const res = await fetch("/api/website/fonts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [role]: family }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setError(d.error ?? "Save failed");
    }
    setData((d) => (d ? { ...d, [role]: family } : d));
  }

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose a font file first");
    if (!uploadName.trim()) return setError("Give the font a family name");
    setUploading(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("name", uploadName.trim());
    const res = await fetch("/api/website/fonts", { method: "POST", body: form });
    const d = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) return setError(d.error ?? "Upload failed");
    setUploadName("");
    if (fileRef.current) fileRef.current.value = "";
    load(q);
  }

  async function removeFont(id: string) {
    if (!confirm("Remove this uploaded font? Pages using it fall back to the theme font.")) return;
    await fetch(`/api/website/fonts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load(q);
  }

  return (
    <section className="mt-10">
      <h2 className="font-medium">Font library</h2>
      <p className="text-sm text-neutral-500 mt-1 mb-4 max-w-2xl">
        Pick any family from the full Google Fonts library ({data ? `${data.total} families${data.live ? "" : ", offline list"}` : "loading"}) for your headings and body text, or upload your own font files. Picks override the theme fonts everywhere on your site.
      </p>
      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
      {previewHref ? <link rel="stylesheet" href={previewHref} /> : null}

      <div className="flex flex-wrap gap-4 text-sm mb-4">
        <p>
          Headings: <span className="font-medium">{data?.display || "Theme default"}</span>
          {data?.display ? (
            <button className="underline text-neutral-500 ml-2 text-xs" onClick={() => pick("display", "")}>Reset</button>
          ) : null}
        </p>
        <p>
          Body: <span className="font-medium">{data?.body || "Theme default"}</span>
          {data?.body ? (
            <button className="underline text-neutral-500 ml-2 text-xs" onClick={() => pick("body", "")}>Reset</button>
          ) : null}
        </p>
      </div>

      <input className="input max-w-md" placeholder="Search fonts, try Playfair, Inter, Cormorant…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 max-w-4xl">
        {(data?.families ?? []).map((f) => (
          <div key={f} className="card p-3">
            <p className="text-lg leading-tight truncate" style={{ fontFamily: `'${f}', serif` }}>{f}</p>
            <p className="text-xs text-neutral-400 truncate" style={{ fontFamily: `'${f}', serif` }}>Photography tells the story</p>
            <div className="flex gap-2 mt-2">
              <button className={`text-xs underline ${data?.display === f ? "font-semibold" : "text-neutral-500"}`} onClick={() => pick("display", f)}>Headings</button>
              <button className={`text-xs underline ${data?.body === f ? "font-semibold" : "text-neutral-500"}`} onClick={() => pick("body", f)}>Body</button>
            </div>
          </div>
        ))}
      </div>
      {data && data.families.length === 0 ? <p className="text-sm text-neutral-500 mt-3">No families match that search.</p> : null}

      <h3 className="font-medium mt-8 mb-1">Your uploaded fonts</h3>
      <p className="text-sm text-neutral-500 mb-3">{data ? `${data.custom.length} of 20 uploaded.` : ""} Files in woff, woff2, ttf or otf, up to 5 MB each.</p>
      <div className="flex flex-wrap items-center gap-2 max-w-2xl">
        <input ref={fileRef} type="file" accept=".woff,.woff2,.ttf,.otf" className="text-sm" />
        <input className="input max-w-[220px]" placeholder="Family name" value={uploadName} onChange={(e) => setUploadName(e.target.value)} />
        <button className="btn-primary" disabled={uploading} onClick={upload}>{uploading ? "Uploading…" : "Upload font"}</button>
      </div>
      <div className="space-y-2 mt-4 max-w-2xl">
        {(data?.custom ?? []).map((f) => (
          <div key={f.id} className="card p-3 flex items-center gap-3">
            <p className="flex-1 truncate" style={{ fontFamily: `'${f.name}', serif` }}>{f.name}</p>
            <button className="text-xs underline text-neutral-500" onClick={() => pick("display", f.name)}>Headings</button>
            <button className="text-xs underline text-neutral-500" onClick={() => pick("body", f.name)}>Body</button>
            <button className="text-xs underline text-red-600" onClick={() => removeFont(f.id)}>Remove</button>
          </div>
        ))}
      </div>
    </section>
  );
}

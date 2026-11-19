"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  timezone: string;
  watermarkText: string;
  watermarkPosition: string;
  watermarkOpacity: number;
  watermarkScale: number;
  watermarkSizes: string;
};

const SIZE_NAMES: Record<string, string> = {
  high3600: "High Resolution 3600px",
  web2048: "Web 2048px",
  web1024: "Web 1024px",
  web640: "Web 640px",
};

export default function GallerySettingsClient({
  initial,
  timezones,
  positions,
}: {
  initial: Initial;
  timezones: string[];
  positions: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [preview, setPreview] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const now = new Date();

  // Live preview: the watermark rendered into a sample image by the same
  // server code that renders gallery previews.
  useEffect(() => {
    const t = setTimeout(() => {
      const q = new URLSearchParams({
        mode: "text",
        text: v.watermarkText,
        position: v.watermarkPosition,
        opacity: String(v.watermarkOpacity),
        scale: String(v.watermarkScale),
        t: String(Date.now()),
      });
      setPreview(`/api/account/watermark?${q.toString()}`);
    }, 250);
    return () => clearTimeout(t);
  }, [v.watermarkText, v.watermarkPosition, v.watermarkOpacity, v.watermarkScale]);

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timezone: v.timezone,
        watermarkMode: "text",
        watermarkText: v.watermarkText,
        watermarkPosition: v.watermarkPosition,
        watermarkOpacity: v.watermarkOpacity,
        watermarkScale: v.watermarkScale,
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ ok: true, text: "Gallery settings saved. Watermarked previews now use this design." });
      router.refresh();
    } else setMsg({ ok: false, text: data.error || "Could not save" });
  }

  let localTime = "";
  try {
    localTime = now.toLocaleString("en-US", { timeZone: v.timezone, weekday: "short", hour: "numeric", minute: "2-digit" });
  } catch {}

  return (
    <div className="max-w-3xl space-y-6 pb-10">
      <section className="card p-6 space-y-3">
        <h2 className="font-display text-lg">Timezone</h2>
        <p className="text-sm text-neutral-500">
          Galleries with an expiry date are hidden at 11:59 pm on that date in this timezone, and expiry reminders use it too.
        </p>
        <div className="flex items-center gap-3">
          <select className="input !w-auto" value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          {localTime && <span className="text-xs text-neutral-500">Local time there: {localTime}</span>}
        </div>
        <p className="text-xs text-neutral-400">Changing the timezone applies to expiry dates you save from now on.</p>
      </section>

      <section className="card p-6">
        <h2 className="font-display text-lg mb-1">Watermark designer</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Collections with Watermark previews switched on show this watermark rendered into every preview image. Original
          files are never changed.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="label">Watermark text</label>
              <input className="input" value={v.watermarkText} onChange={(e) => setV({ ...v, watermarkText: e.target.value })} />
            </div>
            <div>
              <label className="label">Position</label>
              <div className="grid grid-cols-2 gap-2">
                {positions.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setV({ ...v, watermarkPosition: p.id })}
                    className={`card px-2 py-1.5 text-xs text-left ${
                      v.watermarkPosition === p.id ? "border-neutral-900 ring-1 ring-neutral-900" : "hover:border-neutral-400"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Size ({v.watermarkScale}% of the photo width)</label>
              <input
                type="range"
                min={5}
                max={90}
                value={v.watermarkScale}
                onChange={(e) => setV({ ...v, watermarkScale: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="label">Opacity ({v.watermarkOpacity}%)</label>
              <input
                type="range"
                min={5}
                max={100}
                value={v.watermarkOpacity}
                onChange={(e) => setV({ ...v, watermarkOpacity: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <p className="text-xs text-neutral-400">
              Download sizes that carry the watermark when downloads are not PIN unlocked:{" "}
              {v.watermarkSizes
                .split(",")
                .filter(Boolean)
                .map((s) => SIZE_NAMES[s] ?? s)
                .join(", ") || "none"}
              . Originals always download clean.
            </p>
          </div>
          <div>
            <p className="label">Preview</p>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Watermark preview" className="w-full rounded border border-neutral-200" />
            ) : (
              <div className="aspect-[3/2] rounded border border-neutral-200 bg-neutral-50" />
            )}
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Gallery Settings"}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  COVER_STYLES,
  FONT_PAIRINGS,
  PALETTES,
  GRID_STYLES,
  THUMB_SIZES,
  GRID_SPACINGS,
  DOWNLOAD_SIZES,
  COLLECTION_STATUSES,
} from "@/lib/design";

type CollectionSettings = {
  id: string;
  name: string;
  slug: string;
  eventDate: string;
  status: string;
  coverStyle: string;
  coverPhotoId: string | null;
  coverVideoUrl: string;
  focalX: number;
  focalY: number;
  fontPairing: string;
  palette: string;
  gridStyle: string;
  thumbSize: string;
  gridSpacing: string;
  password: string;
  emailRegistration: boolean;
  watermark: boolean;
  downloadEnabled: boolean;
  pinEnabled: boolean;
  downloadPin: string;
  pinUseLimit: number | null;
  pinUseCount: number;
  freeDownloadCap: number | null;
  downloadSizes: string;
  allowSingle: boolean;
  allowZip: boolean;
  videoDownloadEnabled: boolean;
  expiresAt: string;
  expiryReminder: boolean;
  storeEnabled: boolean;
  priceSheetId: string | null;
  slideshowEnabled: boolean;
  slideshowMusicUrl: string;
};

export default function SettingsClient({
  collection,
  photos,
  priceSheets,
}: {
  collection: CollectionSettings;
  photos: { id: string; url: string; mediaType: string; posterUrl: string }[];
  priceSheets: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [c, setC] = useState(collection);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [error, setError] = useState("");

  function set<K extends keyof CollectionSettings>(key: K, value: CollectionSettings[K]) {
    setC((prev) => ({ ...prev, [key]: value }));
  }

  const sizes = c.downloadSizes.split(",").filter(Boolean);
  function toggleSize(id: string) {
    const next = sizes.includes(id) ? sizes.filter((s) => s !== id) : [...sizes, id];
    if (next.length === 0) return; // must offer at least one size
    set("downloadSizes", next.join(","));
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/collections/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: c.name,
        slug: c.slug,
        eventDate: c.eventDate || null,
        status: c.status,
        coverStyle: c.coverStyle,
        coverPhotoId: c.coverPhotoId,
        coverVideoUrl: c.coverVideoUrl,
        focalX: c.focalX,
        focalY: c.focalY,
        fontPairing: c.fontPairing,
        palette: c.palette,
        gridStyle: c.gridStyle,
        thumbSize: c.thumbSize,
        gridSpacing: c.gridSpacing,
        password: c.password,
        emailRegistration: c.emailRegistration,
        watermark: c.watermark,
        downloadEnabled: c.downloadEnabled,
        pinEnabled: c.pinEnabled,
        pinUseLimit: c.pinUseLimit,
        freeDownloadCap: c.freeDownloadCap,
        downloadSizes: c.downloadSizes,
        allowSingle: c.allowSingle,
        allowZip: c.allowZip,
        videoDownloadEnabled: c.videoDownloadEnabled,
        expiresAt: c.expiresAt || null,
        expiryReminder: c.expiryReminder,
        storeEnabled: c.storeEnabled,
        priceSheetId: c.priceSheetId,
        slideshowEnabled: c.slideshowEnabled,
        slideshowMusicUrl: c.slideshowMusicUrl,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      if (data.downloadPin) set("downloadPin", data.downloadPin);
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not save settings");
    }
  }

  async function saveAsPreset() {
    const name = prompt("Preset name:");
    if (!name) return;
    const res = await fetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, fromCollectionId: c.id }),
    });
    if (res.ok) alert("Preset saved. Apply it when creating a new collection.");
  }

  async function deleteCollection() {
    if (!confirm("Delete this collection, its photos and all activity? This cannot be undone.")) return;
    await fetch(`/api/collections/${c.id}`, { method: "DELETE" });
    router.push("/collections");
    router.refresh();
  }

  const selectedPalette = PALETTES.find((p) => p.id === c.palette) ?? PALETTES[0];

  return (
    <div className="max-w-3xl space-y-10 pb-24">
      {/* General */}
      <Section title="General">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Collection name</label>
            <input className="input" value={c.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="label">Event date</label>
            <input
              className="input"
              type="date"
              value={c.eventDate}
              onChange={(e) => set("eventDate", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className="label">Collection URL</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-neutral-500">/g/</span>
              <input className="input" value={c.slug} onChange={(e) => set("slug", e.target.value)} />
            </div>
          </div>
        </div>
      </Section>

      {/* Status */}
      <Section title="Status">
        <div className="grid grid-cols-3 gap-3">
          {COLLECTION_STATUSES.map((s) => (
            <button
              key={s.id}
              onClick={() => set("status", s.id)}
              className={`card p-3 text-left ${
                c.status === s.id ? "border-neutral-900 ring-1 ring-neutral-900" : "hover:border-neutral-400"
              }`}
            >
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{s.desc}</p>
            </button>
          ))}
        </div>
      </Section>

      {/* Design */}
      <Section title="Design">
        <p className="label">Cover style</p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {COVER_STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => set("coverStyle", s.id)}
              className={`card p-2 text-left ${
                c.coverStyle === s.id ? "border-neutral-900 ring-1 ring-neutral-900" : "hover:border-neutral-400"
              }`}
              title={s.desc}
            >
              <CoverThumb style={s.id} />
              <p className="text-xs mt-1">{s.name}</p>
            </button>
          ))}
        </div>

        <p className="label">Cover photo</p>
        {photos.length === 0 ? (
          <p className="text-xs text-neutral-400 mb-4">Upload photos first to choose a cover.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {photos.map((p) => (
              <button
                key={p.id}
                onClick={() => set("coverPhotoId", c.coverPhotoId === p.id ? null : p.id)}
                className={`shrink-0 rounded overflow-hidden border-2 ${
                  c.coverPhotoId === p.id ? "border-neutral-900" : "border-transparent"
                }`}
              >
                {p.mediaType === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="h-16 w-16 object-cover" />
                ) : p.posterUrl ? (
                  <span className="relative block h-16 w-16">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.posterUrl} alt="" className="h-16 w-16 object-cover" />
                    {p.mediaType === "VIDEO" && (
                      <span className="absolute inset-0 flex items-center justify-center text-white text-lg">▶</span>
                    )}
                  </span>
                ) : (
                  <span className="h-16 w-16 flex items-center justify-center bg-neutral-900 text-white text-[9px] tracking-widest">
                    {p.mediaType === "VIDEO" ? "▶ VIDEO" : "RAW"}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <label className="label">Video cover (YouTube/Vimeo URL, overrides photo)</label>
            <input
              className="input"
              value={c.coverVideoUrl}
              onChange={(e) => set("coverVideoUrl", e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </div>
          <div>
            <label className="label">
              Cover focal point ({Math.round(c.focalX * 100)}% × {Math.round(c.focalY * 100)}%)
            </label>
            <div className="flex gap-3 items-center">
              <input
                type="range"
                min={0}
                max={100}
                value={c.focalX * 100}
                onChange={(e) => set("focalX", Number(e.target.value) / 100)}
                title="Horizontal focal point"
                className="flex-1"
              />
              <input
                type="range"
                min={0}
                max={100}
                value={c.focalY * 100}
                onChange={(e) => set("focalY", Number(e.target.value) / 100)}
                title="Vertical focal point"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <p className="label">Typography</p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {FONT_PAIRINGS.map((f) => (
            <button
              key={f.id}
              onClick={() => set("fontPairing", f.id)}
              className={`card p-3 text-left ${
                c.fontPairing === f.id ? "border-neutral-900 ring-1 ring-neutral-900" : "hover:border-neutral-400"
              }`}
            >
              <p className="text-lg leading-tight" style={{ fontFamily: f.display }}>
                Aa
              </p>
              <p className="text-xs text-neutral-500">{f.name}</p>
            </button>
          ))}
        </div>

        <p className="label">Color palette</p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              onClick={() => set("palette", p.id)}
              className={`card p-2 flex items-center gap-2 ${
                c.palette === p.id ? "border-neutral-900 ring-1 ring-neutral-900" : "hover:border-neutral-400"
              }`}
            >
              <span className="h-6 w-6 rounded-full border border-neutral-200" style={{ background: p.bg }} />
              <span className="h-6 w-6 rounded-full" style={{ background: p.accent }} />
              <span className="text-xs">{p.name}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Grid style</label>
            <select className="input" value={c.gridStyle} onChange={(e) => set("gridStyle", e.target.value)}>
              {GRID_STYLES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Thumbnail size</label>
            <select className="input" value={c.thumbSize} onChange={(e) => set("thumbSize", e.target.value)}>
              {THUMB_SIZES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Grid spacing</label>
            <select className="input" value={c.gridSpacing} onChange={(e) => set("gridSpacing", e.target.value)}>
              {GRID_SPACINGS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 card p-3" style={{ background: selectedPalette.bg, color: selectedPalette.text }}>
          <p
            className="text-xl"
            style={{ fontFamily: (FONT_PAIRINGS.find((f) => f.id === c.fontPairing) ?? FONT_PAIRINGS[0]).display }}
          >
            {c.name || "Collection preview"}
          </p>
          <p className="text-xs mt-1" style={{ color: selectedPalette.accent }}>
            Live palette & typography preview
          </p>
        </div>
      </Section>

      {/* Privacy */}
      <Section title="Privacy">
        <div className="space-y-4">
          <div>
            <label className="label">Collection password (blank = public)</label>
            <input
              className="input max-w-xs"
              value={c.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="No password"
            />
          </div>
          <Toggle
            label="Email registration"
            desc="Visitors must enter their email before viewing. Addresses appear under Activities."
            checked={c.emailRegistration}
            onChange={(v) => set("emailRegistration", v)}
          />
          <Toggle
            label="Watermark previews"
            desc="Overlay your watermark text on gallery previews (never on downloads of originals)."
            checked={c.watermark}
            onChange={(v) => set("watermark", v)}
          />
          <p className="text-xs text-neutral-500">
            Per-set <b>Client Exclusive Access</b> is configured on each set in the Photos tab. Per-photo{" "}
            <b>Private</b> flags are set from each photo’s hover menu.
          </p>
        </div>
      </Section>

      {/* Download */}
      <Section title="Download">
        <div className="space-y-4">
          <Toggle
            label="Photo downloads"
            desc="Master switch for all download buttons in this collection."
            checked={c.downloadEnabled}
            onChange={(v) => set("downloadEnabled", v)}
          />
          {c.downloadEnabled && (
            <>
              <div className="pl-1 space-y-4">
                <Toggle
                  label="Require 4-digit download PIN"
                  desc={
                    c.pinEnabled && c.downloadPin
                      ? `Current PIN: ${c.downloadPin} (used ${c.pinUseCount}×). A PIN is generated when you save.`
                      : "A PIN is auto-generated when you save with this enabled."
                  }
                  checked={c.pinEnabled}
                  onChange={(v) => set("pinEnabled", v)}
                />
                {c.pinEnabled && (
                  <div>
                    <label className="label">PIN use limit (blank = unlimited)</label>
                    <input
                      className="input max-w-[8rem]"
                      type="number"
                      min={1}
                      value={c.pinUseLimit ?? ""}
                      onChange={(e) => set("pinUseLimit", e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                )}
                <div>
                  <label className="label">Free download limit per client (blank = unlimited)</label>
                  <input
                    className="input max-w-[8rem]"
                    type="number"
                    min={1}
                    value={c.freeDownloadCap ?? ""}
                    onChange={(e) => set("freeDownloadCap", e.target.value ? Number(e.target.value) : null)}
                  />
                </div>
                <div>
                  <p className="label">Sizes offered</p>
                  <div className="space-y-1">
                    {DOWNLOAD_SIZES.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="accent-neutral-900"
                          checked={sizes.includes(s.id)}
                          onChange={() => toggleSize(s.id)}
                        />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </div>
                <Toggle
                  label="Single photo download"
                  desc="Download button on individual photos."
                  checked={c.allowSingle}
                  onChange={(v) => set("allowSingle", v)}
                />
                <Toggle
                  label="Download All (ZIP)"
                  desc="One-click ZIP of the whole gallery."
                  checked={c.allowZip}
                  onChange={(v) => set("allowZip", v)}
                />
                <Toggle
                  label="Video downloads"
                  desc="Separate master switch for video files (always the original file)."
                  checked={c.videoDownloadEnabled}
                  onChange={(v) => set("videoDownloadEnabled", v)}
                />
              </div>
            </>
          )}
        </div>
      </Section>

      {/* Expiry */}
      <Section title="Auto Expiry">
        <div className="grid grid-cols-2 gap-4 items-end">
          <div>
            <label className="label">Expiry date (hides at 11:59 pm local time)</label>
            <input
              className="input"
              type="date"
              value={c.expiresAt}
              onChange={(e) => set("expiresAt", e.target.value)}
            />
          </div>
          <Toggle
            label="Expiry reminder"
            desc="Flag to remind clients before this gallery expires."
            checked={c.expiryReminder}
            onChange={(v) => set("expiryReminder", v)}
          />
        </div>
        {c.expiresAt && new Date(`${c.expiresAt}T23:59:59`) < new Date() && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 mt-3">
            This date has passed, the gallery is hidden from clients. Clear or move the date and keep
            status Published to re-open it.
          </p>
        )}
      </Section>

      {/* Store + Slideshow (Phase 4) */}
      <Section title="Store & Slideshow">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Price sheet (enables the gallery storefront)</label>
            <select
              className="input"
              value={c.priceSheetId ?? ""}
              onChange={(e) => set("priceSheetId", e.target.value || null)}
            >
              <option value="">No store for this gallery</option>
              {priceSheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-400 mt-1">
              Manage products under Store → Price Sheets.
            </p>
          </div>
          <Toggle
            label="Storefront visible"
            desc="Clients can buy prints & downloads from this gallery."
            checked={c.storeEnabled}
            onChange={(v) => set("storeEnabled", v)}
          />
          <div>
            <label className="label">Slideshow music URL (MP3)</label>
            <input
              className="input"
              value={c.slideshowMusicUrl}
              onChange={(e) => set("slideshowMusicUrl", e.target.value)}
              placeholder="https://…/song.mp3"
            />
            <p className="text-xs text-neutral-400 mt-1">
              Plays during the client slideshow. Leave blank for a silent slideshow.
            </p>
          </div>
          <Toggle
            label="Slideshow"
            desc="Show the ▶ Slideshow button in the client gallery."
            checked={c.slideshowEnabled}
            onChange={(v) => set("slideshowEnabled", v)}
          />
        </div>
      </Section>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-60 right-0 bg-white border-t border-neutral-200 px-8 py-3 flex items-center gap-3 z-30">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </button>
        <button className="btn-secondary" onClick={saveAsPreset}>
          Save as Preset
        </button>
        {savedAt && <span className="text-xs text-emerald-600">Saved at {savedAt}</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
        <button className="btn-danger ml-auto" onClick={deleteCollection}>
          Delete Collection
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="font-display text-lg mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-neutral-900"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="text-sm font-medium block">{label}</span>
        {desc && <span className="text-xs text-neutral-500 block">{desc}</span>}
      </span>
    </label>
  );
}

function CoverThumb({ style }: { style: string }) {
  const base = "h-12 w-full rounded bg-neutral-200 relative overflow-hidden";
  const bar = "absolute bg-neutral-500/70 rounded-sm";
  switch (style) {
    case "classic":
      return (
        <div className={base}>
          <span className={bar} style={{ left: 4, bottom: 4, width: "40%", height: 4 }} />
        </div>
      );
    case "novel":
      return (
        <div className={base}>
          <span className={bar} style={{ left: "30%", top: "45%", width: "40%", height: 4 }} />
        </div>
      );
    case "frame":
      return <div className={`${base} border-4 border-white ring-1 ring-neutral-300`} />;
    case "stripe":
      return (
        <div className={`${base} flex`}>
          <div className="w-1/2 bg-neutral-100 flex items-center justify-center">
            <span className="bg-neutral-500/70 rounded-sm" style={{ width: "60%", height: 4 }} />
          </div>
          <div className="w-1/2 bg-neutral-300" />
        </div>
      );
    case "journal":
      return (
        <div className={`${base} flex flex-col`}>
          <div className="h-2/3 bg-neutral-300" />
          <div className="h-1/3 bg-neutral-100 flex items-center justify-center">
            <span className="bg-neutral-500/70 rounded-sm" style={{ width: "50%", height: 3 }} />
          </div>
        </div>
      );
    case "divider":
      return (
        <div className={base}>
          <span className={bar} style={{ left: "25%", top: "30%", width: "50%", height: 2 }} />
          <span className={bar} style={{ left: "30%", top: "47%", width: "40%", height: 4 }} />
          <span className={bar} style={{ left: "25%", top: "66%", width: "50%", height: 2 }} />
        </div>
      );
    default:
      return (
        <div className={`${base} !bg-white border border-dashed border-neutral-300 flex items-center justify-center`}>
          <span className="text-[9px] text-neutral-400">No cover</span>
        </div>
      );
  }
}

"use client";

import { GALLERY_LANGUAGES } from "@/lib/gallery-i18n";

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
  expired: boolean;
  expiryReminder: boolean;
  expiryReminderDays: number;
  expiryReminderSentAt: string;
  coverImageUrl: string;
  campaignOptIn: boolean;
  storeEnabled: boolean;
  priceSheetId: string | null;
  slideshowEnabled: boolean;
  slideshowMusicUrl: string;
  // Final pass: gallery experience switches (Phase 5B Collection fields)
  coverAnimation: boolean;
  navStyle: string;
  seoIndexing: boolean;
  showOnHomepage: boolean;
  clientOnlyDownloads: boolean;
  emailedDownloadAll: boolean;
  zipPartSize: number;
  desktopOnlyZip: boolean;
  favoritesEnabled: boolean;
  socialSharing: boolean;
  galleryAssist: boolean;
  language: string;
};

export default function SettingsClient({
  collection,
  photos,
  priceSheets,
  timezone,
  mailConnected,
  extraDownload,
}: {
  extraDownload?: React.ReactNode; // Phase 5B platform: access groups section
  collection: CollectionSettings;
  photos: { id: string; url: string; mediaType: string; posterUrl: string }[];
  priceSheets: { id: string; name: string }[];
  timezone: string;
  mailConnected: boolean;
}) {
  const router = useRouter();
  const [c, setC] = useState(collection);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [error, setError] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverMsg, setCoverMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Phase 5B: a cover image uploaded on its own, never added to the photo grid.
  async function uploadCover(file: File | undefined) {
    if (!file) return;
    setCoverBusy(true);
    setCoverMsg(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/collections/${c.id}/cover`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setCoverBusy(false);
    if (!res.ok) {
      setCoverMsg({ ok: false, text: data.error || "Upload failed" });
      return;
    }
    set("coverImageUrl", data.url);
    setCoverMsg({ ok: true, text: data.animated ? "Animated GIF cover uploaded, the animation is kept." : "Cover image uploaded." });
    router.refresh();
  }

  async function removeCover() {
    await fetch(`/api/collections/${c.id}/cover`, { method: "DELETE" });
    set("coverImageUrl", "");
    setCoverMsg(null);
    router.refresh();
  }

  async function sendReminderNow() {
    setReminderBusy(true);
    setReminderMsg(null);
    const res = await fetch(`/api/collections/${c.id}/expiry-reminder`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setReminderBusy(false);
    if (!res.ok) {
      setReminderMsg({ ok: false, text: data.error || "Could not send" });
      return;
    }
    const n = data.recipients.length;
    const delivered = data.recipients.filter((r: { delivered: boolean }) => r.delivered).length;
    setReminderMsg({
      ok: true,
      text: mailConnected
        ? `Reminder delivered to ${delivered} of ${n} recipient${n === 1 ? "" : "s"}.`
        : `Reminder recorded for ${n} recipient${n === 1 ? "" : "s"}, logged only because email is not connected.`,
    });
    set("expiryReminderSentAt", new Date().toISOString());
  }

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
        expiryReminderDays: c.expiryReminderDays,
        campaignOptIn: c.campaignOptIn,
        storeEnabled: c.storeEnabled,
        priceSheetId: c.priceSheetId,
        slideshowEnabled: c.slideshowEnabled,
        slideshowMusicUrl: c.slideshowMusicUrl,
        coverAnimation: c.coverAnimation,
        navStyle: c.navStyle,
        seoIndexing: c.seoIndexing,
        showOnHomepage: c.showOnHomepage,
        clientOnlyDownloads: c.clientOnlyDownloads,
        emailedDownloadAll: c.emailedDownloadAll,
        zipPartSize: c.zipPartSize,
        desktopOnlyZip: c.desktopOnlyZip,
        favoritesEnabled: c.favoritesEnabled,
        socialSharing: c.socialSharing,
        galleryAssist: c.galleryAssist,
        language: c.language,
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

  // Server truth (photographer timezone) while the date is unchanged.
  const expiredNow = c.expiresAt
    ? c.expiresAt === collection.expiresAt
      ? collection.expired
      : new Date(`${c.expiresAt}T23:59:59`) < new Date()
    : false;
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

        <div className="mb-5">
          <p className="label">Or upload a separate cover image</p>
          <p className="text-xs text-neutral-500 mb-2">
            Used only as the cover, it is not added to the photo grid. JPEG, PNG or WEBP up to 100 MB, animated GIF up to 85 MB
            (the animation plays on the cover).
          </p>
          <div className="flex items-center gap-3">
            {c.coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.coverImageUrl} alt="Uploaded cover" className="h-16 w-24 object-cover rounded border border-neutral-200" />
            )}
            <label className="btn-secondary cursor-pointer">
              {coverBusy ? "Uploading…" : c.coverImageUrl ? "Replace cover image" : "Upload cover image"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={coverBusy}
                onChange={(e) => {
                  uploadCover(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            {c.coverImageUrl && (
              <button className="text-xs text-red-500 underline" onClick={removeCover}>
                Remove, use a collection photo
              </button>
            )}
            {c.coverImageUrl.toLowerCase().endsWith(".gif") && (
              <span className="text-[10px] uppercase tracking-wide bg-neutral-100 px-1.5 py-0.5 rounded">GIF</span>
            )}
          </div>
          {coverMsg && <p className={`text-xs mt-1 ${coverMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{coverMsg.text}</p>}
          {c.coverImageUrl && <p className="text-xs text-neutral-400 mt-1">The uploaded image overrides the cover photo chosen above.</p>}
        </div>

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
            desc="Your watermark (designed in Settings, Gallery) is rendered into every preview image. Originals are never touched."
            checked={c.watermark}
            onChange={(v) => set("watermark", v)}
          />
          <Toggle
            label="Marketing opt in"
            desc="Visitors who enter their email can tick a box to hear about print sales, mini sessions and offers. Opt ins are stored as your campaign audience."
            checked={c.campaignOptIn}
            onChange={(v) => set("campaignOptIn", v)}
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
                          className="accent-brand-600"
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

      {extraDownload}

      {/* Expiry */}
      <Section title="Gallery experience">
        <div className="space-y-4">
          <Toggle
            label="Cover animation"
            desc="The cover eases in when a visitor opens the gallery. Reduced motion visitors see it still."
            checked={c.coverAnimation}
            onChange={(v) => set("coverAnimation", v)}
          />
          <div>
            <label className="label">Navigation style</label>
            <select className="input !w-auto" value={c.navStyle} onChange={(e) => set("navStyle", e.target.value)}>
              <option value="text">Text</option>
              <option value="icons">Icons only</option>
              <option value="iconsText">Icons and text</option>
            </select>
          </div>
          <Toggle
            label="Allow search engine indexing"
            desc="Off (the default) serves a noindex tag with this gallery, keeping it out of Google and other search results."
            checked={c.seoIndexing}
            onChange={(v) => set("seoIndexing", v)}
          />
          <Toggle
            label="Show on homepage"
            desc="List this gallery on your public gallery homepage (set the homepage up in Collections, Settings)."
            checked={c.showOnHomepage}
            onChange={(v) => set("showOnHomepage", v)}
          />
          <Toggle
            label="Favorites"
            desc="Let clients build favorite lists in this gallery. Off hides every heart, the Favorites button and list downloads."
            checked={c.favoritesEnabled}
            onChange={(v) => set("favoritesEnabled", v)}
          />
          <Toggle
            label="Social sharing buttons"
            desc="Show a Share menu in the gallery navigation: Facebook, X, Pinterest, email and copy link."
            checked={c.socialSharing}
            onChange={(v) => set("socialSharing", v)}
          />
          <Toggle
            label="Gallery Assist cards"
            desc="First time visitors see short cards explaining viewing, favorites and downloads. They can dismiss them for good."
            checked={c.galleryAssist}
            onChange={(v) => set("galleryAssist", v)}
          />
          <Toggle
            label="Restrict downloads to clients only"
            desc="Downloads also need a registered client email (plus the PIN when one is set)."
            checked={c.clientOnlyDownloads}
            onChange={(v) => set("clientOnlyDownloads", v)}
          />
          <Toggle
            label="Download All delivered by emailed link"
            desc="Offer Download All as a link emailed to the client instead of a direct ZIP (the phone friendly route)."
            checked={c.emailedDownloadAll}
            onChange={(v) => set("emailedDownloadAll", v)}
          />
          <Toggle
            label="Download All on desktop only"
            desc="Phones are told Download All needs a computer, and offered the emailed link instead."
            checked={c.desktopOnlyZip}
            onChange={(v) => set("desktopOnlyZip", v)}
          />
          <div>
            <label className="label">Max photos per ZIP part</label>
            <input
              className="input max-w-[8rem]"
              type="number"
              min={10}
              max={2000}
              value={c.zipPartSize}
              onChange={(e) => set("zipPartSize", Number(e.target.value) || 200)}
            />
            <p className="text-xs text-neutral-500 mt-1">Large galleries download as several ZIP parts of at most this many photos each.</p>
          </div>
          <div>
            <label className="label">Gallery language</label>
            <select className="input !w-auto" value={c.language === "zh" ? "zh-Hans" : c.language} onChange={(e) => set("language", e.target.value)} data-testid="gallery-language">
              {GALLERY_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-neutral-500 mt-1">Translates the gallery&apos;s buttons, menus, dialogs, download steps and password or registration pages for your client. Your own text (gallery and set names, comments, banners) is shown as you wrote it.</p>
          </div>
        </div>
      </Section>

      <Section title="Auto Expiry">
        <div className="grid grid-cols-2 gap-4 items-end">
          <div>
            <label className="label">Expiry date (hides at 11:59 pm, {timezone.replace(/_/g, " ")})</label>
            <input
              className="input"
              type="date"
              value={c.expiresAt}
              onChange={(e) => set("expiresAt", e.target.value)}
            />
          </div>
          <Toggle
            label="Expiry reminder email"
            desc="Automatically email registered, invited and favorite list clients before the gallery expires."
            checked={c.expiryReminder}
            onChange={(v) => set("expiryReminder", v)}
          />
        </div>
        {c.expiryReminder && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span>Send</span>
              <input
                className="input !w-20"
                type="number"
                min={0}
                max={60}
                value={c.expiryReminderDays}
                onChange={(e) => set("expiryReminderDays", Number(e.target.value) || 0)}
              />
              <span>days before the gallery expires.</span>
            </div>
            <p className="text-xs text-neutral-500">
              {c.expiryReminderSentAt
                ? `Sent ${new Date(c.expiryReminderSentAt).toLocaleString()} for the current expiry date.`
                : "Not sent yet for the current expiry date."}{" "}
              Edit the wording under Settings, Email Templates. Email:{" "}
              {mailConnected ? "connected" : "Not connected, reminders are logged in Activities and the inbox only"}.
            </p>
            {c.expiresAt && !expiredNow && (
              <button className="btn-secondary !py-1 text-xs" onClick={sendReminderNow} disabled={reminderBusy}>
                {reminderBusy ? "Sending…" : "Send reminder now"}
              </button>
            )}
            {reminderMsg && <p className={`text-xs ${reminderMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{reminderMsg.text}</p>}
          </div>
        )}
        {expiredNow && (
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
        className="mt-0.5 h-4 w-4 accent-brand-600"
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
    case "vintage":
      return (
        <div className={`${base} !bg-neutral-100 flex flex-col items-center justify-center gap-1`}>
          <div className="h-6 w-10 bg-neutral-300 ring-2 ring-white" />
          <span className="bg-neutral-500/70 rounded-sm" style={{ width: "40%", height: 3 }} />
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

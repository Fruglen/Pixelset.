"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  homeSlug: string;
  homeTitle: string;
  gaId: string;
  defaultPresetId: string;
  domain: string;
  domainStatus: string;
  domainNote: string;
  logoUrl: string;
};

// Phase 5B platform: account level Client Gallery settings (logo, homepage,
// defaults, Google Analytics, custom domain). The watermark designer and
// timezone sit above this on the same page.
export function GalleryAccountSettings({
  initial,
  presets,
  collections,
  domainHelp,
  domainAllowed,
}: {
  initial: Initial;
  presets: { id: string; name: string }[];
  collections: { id: string; name: string; status: string; showOnHomepage: boolean }[];
  domainHelp: { cname: string; txtName: string; txtValue: string };
  domainAllowed: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [home, setHome] = useState(collections);
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const say = (k: string, ok: boolean, text: string) => setMsg((m) => ({ ...m, [k]: { ok, text } }));

  async function patch(k: string, body: Record<string, unknown>, okText: string) {
    const res = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    say(k, res.ok, res.ok ? okText : data.error || "Could not save");
    if (res.ok) router.refresh();
  }
  async function toggleHome(id: string, on: boolean) {
    setHome((h) => h.map((c) => (c.id === id ? { ...c, showOnHomepage: on } : c)));
    await fetch(`/api/collections/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ showOnHomepage: on }) });
  }
  async function uploadLogo(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/account/brand", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setV({ ...v, logoUrl: data.url });
    say("logo", res.ok, res.ok ? "Logo uploaded" : data.error || "Upload failed");
    router.refresh();
  }
  async function connectDomain() {
    say("domain", true, "Checking DNS…");
    const res = await fetch("/api/account/gallery-domain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: v.domain }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setV({ ...v, domainStatus: data.status, domainNote: data.note ?? "" });
    say("domain", res.ok, res.ok ? (data.status === "VERIFIED" ? "Domain verified and routed" : data.status === "NONE" ? "Domain removed" : "Saved, waiting for DNS") : data.error || "Could not save");
    router.refresh();
  }
  const Msg = ({ k }: { k: string }) =>
    msg[k] ? <span className={`text-sm ${msg[k].ok ? "text-emerald-600" : "text-red-600"}`}>{msg[k].text}</span> : null;
  const homeUrl = v.homeSlug ? `/gh/${v.homeSlug}` : "";

  return (
    <div className="max-w-3xl space-y-6 pb-10 mt-6">
      <section className="card p-6 space-y-3" id="logo">
        <h2 className="font-display text-lg">Logo</h2>
        <p className="text-sm text-neutral-500">
          Shown on the gallery homepage, gallery emails and every client document. This is your account brand logo, shared with
          the website, store and Studio Manager (Settings, Account, Brand).
        </p>
        <div className="flex items-center gap-4">
          {v.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.logoUrl} alt="Logo" className="max-h-14 max-w-[180px] object-contain border border-neutral-200 rounded p-1" />
          ) : (
            <div className="h-14 w-32 rounded border border-dashed border-neutral-300 grid place-items-center text-xs text-neutral-400">No logo</div>
          )}
          <label className="btn-secondary cursor-pointer">
            Upload logo
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
          </label>
          <Msg k="logo" />
        </div>
      </section>

      <section className="card p-6 space-y-4" id="homepage">
        <h2 className="font-display text-lg">Homepage</h2>
        <p className="text-sm text-neutral-500">A public page listing the galleries you choose, for example to link from your website.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Homepage address</label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-neutral-500">/gh/</span>
              <input className="input" value={v.homeSlug} placeholder="your-studio" onChange={(e) => setV({ ...v, homeSlug: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Homepage title</label>
            <input className="input" value={v.homeTitle} placeholder="Client Galleries" onChange={(e) => setV({ ...v, homeTitle: e.target.value })} />
          </div>
        </div>
        <div>
          <p className="label">Show on homepage (published galleries only appear)</p>
          {home.length === 0 ? (
            <p className="text-sm text-neutral-500">No collections yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 max-h-64 overflow-y-auto border border-neutral-100 rounded">
              {home.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={c.showOnHomepage} onChange={(e) => toggleHome(c.id, e.target.checked)} />
                    {c.name}
                  </label>
                  <span className="text-xs text-neutral-400">{c.status.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn-primary" onClick={() => patch("home", { galleryHomeSlug: v.homeSlug, galleryHomeTitle: v.homeTitle }, "Homepage saved")}>
            Save Homepage
          </button>
          {homeUrl ? (
            <a className="text-sm underline" href={homeUrl} target="_blank" rel="noreferrer">
              View homepage ↗
            </a>
          ) : null}
          <Msg k="home" />
        </div>
      </section>

      <section className="card p-6 space-y-3" id="defaults">
        <h2 className="font-display text-lg">Default settings</h2>
        <p className="text-sm text-neutral-500">
          New collections start from this preset (design, privacy, download and store settings) unless you pick another when
          creating them.
        </p>
        <select className="input !w-auto" value={v.defaultPresetId} onChange={(e) => setV({ ...v, defaultPresetId: e.target.value })}>
          <option value="">No default, Pixora defaults</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={() => patch("defaults", { galleryDefaultPresetId: v.defaultPresetId }, "Default preset saved")}>
            Save Defaults
          </button>
          <a className="text-sm underline" href="/collections/presets">
            Manage presets
          </a>
          <Msg k="defaults" />
        </div>
      </section>

      <section className="card p-6 space-y-3" id="analytics">
        <h2 className="font-display text-lg">Google Analytics</h2>
        <p className="text-sm text-neutral-500">
          Add your GA4 measurement ID and the tag loads on every public gallery and the gallery homepage. Leave blank to load no
          analytics.
        </p>
        <input className="input !w-64" placeholder="G-XXXXXXXXXX" value={v.gaId} onChange={(e) => setV({ ...v, gaId: e.target.value })} />
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={() => patch("ga", { galleryGaId: v.gaId }, v.gaId ? "Analytics tag is live on your galleries" : "Analytics removed")}>
            Save Analytics
          </button>
          <span className={`text-xs px-2 py-1 rounded-full ${initial.gaId ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
            {initial.gaId ? "Connected" : "Not connected"}
          </span>
          <Msg k="ga" />
        </div>
      </section>

      <section className="card p-6 space-y-3" id="domain">
        <h2 className="font-display text-lg">Custom domain</h2>
        <p className="text-sm text-neutral-500">
          Serve your gallery homepage at your own address, for example galleries.yourstudio.com. Set a homepage address above
          first. Add a CNAME record pointing at <code className="text-xs">{domainHelp.cname}</code>, or a TXT record{" "}
          <code className="text-xs">{domainHelp.txtName}</code> with the value <code className="text-xs">{domainHelp.txtValue}</code>, then
          check. HTTPS certificates are issued by the host in front of the app.
        </p>
        {!domainAllowed ? (
          <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">A gallery custom domain needs Client Gallery Basic or higher (Settings, Plan).</p>
        ) : null}
        <div className="flex items-center gap-2 flex-wrap">
          <input className="input !w-72" placeholder="galleries.yourstudio.com" value={v.domain} onChange={(e) => setV({ ...v, domain: e.target.value })} />
          <button className="btn-primary" onClick={connectDomain} disabled={!domainAllowed}>
            {v.domain ? "Save and check DNS" : "Remove domain"}
          </button>
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              v.domainStatus === "VERIFIED" ? "bg-emerald-50 text-emerald-700" : v.domainStatus === "PENDING" ? "bg-amber-50 text-amber-700" : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {v.domainStatus === "VERIFIED" ? "Verified" : v.domainStatus === "PENDING" ? "Waiting for DNS" : "Not connected"}
          </span>
        </div>
        {v.domainNote ? <p className="text-xs text-neutral-500">{v.domainNote}</p> : null}
        <Msg k="domain" />
      </section>
    </div>
  );
}

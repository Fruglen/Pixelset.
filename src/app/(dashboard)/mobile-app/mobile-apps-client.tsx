"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type App = {
  id: string;
  slug: string;
  appName: string;
  accentColor: string;
  contactEmail: string;
  contactPhone: string;
  enabled: boolean;
  collectionName: string;
  coverUrl: string;
};

export default function MobileAppsClient({
  apps,
  collections,
  defaultEmail,
}: {
  apps: App[];
  collections: { id: string; name: string }[];
  defaultEmail: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [collectionId, setCollectionId] = useState(collections[0]?.id ?? "");
  const [appName, setAppName] = useState("");
  const [accentColor, setAccentColor] = useState("#1c1c1c");
  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/mobile-apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId, appName, accentColor, contactEmail, contactPhone }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Could not create");
    setCreating(false);
    setAppName("");
    router.refresh();
  }

  async function toggle(a: App) {
    await fetch(`/api/mobile-apps/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !a.enabled }),
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this app link? The gallery itself is unaffected.")) return;
    await fetch(`/api/mobile-apps/${id}`, { method: "DELETE" });
    router.refresh();
  }

  function copy(slug: string) {
    const url = `${window.location.origin}/app/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(slug);
      setTimeout(() => setCopied(""), 1500);
    });
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display">Mobile Gallery App</h1>
          <p className="text-sm text-neutral-500 mt-1">
            An installable, branded app page per collection, clients add it to their home screen with your logo,
            their cover photo, and one-tap contact buttons.
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setCreating((v) => !v)} disabled={collections.length === 0}>
          + Create App
        </button>
      </div>

      <p className="text-xs text-neutral-400 mb-4">
        Pixieset includes 3 apps on the free plan, unlimited on paid, everything is unlocked in this replica.
      </p>

      {creating && (
        <form onSubmit={create} className="card p-4 mb-6 grid md:grid-cols-2 gap-3 max-w-2xl">
          <div>
            <label className="label">Collection</label>
            <select className="input" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">App name (shown under the icon)</label>
            <input className="input" value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Defaults to the collection name" />
          </div>
          <div>
            <label className="label">Accent color</label>
            <input type="color" className="input !p-1 h-10" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
          </div>
          <div>
            <label className="label">Contact email</label>
            <input className="input" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Contact phone (optional)</label>
            <input className="input" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+1 …" />
          </div>
          <div className="flex items-end justify-end gap-2">
            {error && <p className="text-sm text-red-600 mr-auto">{error}</p>}
            <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button className="btn-primary">Create</button>
          </div>
        </form>
      )}

      {apps.length === 0 ? (
        <p className="text-sm text-neutral-400">No apps yet, create one from any collection.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {apps.map((a) => (
            <div key={a.id} className={`card p-4 flex gap-4 ${a.enabled ? "" : "opacity-60"}`}>
              <div
                className="h-16 w-16 rounded-2xl overflow-hidden shrink-0 border"
                style={{ borderColor: a.accentColor }}
              >
                {a.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full" style={{ background: a.accentColor }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{a.appName}</p>
                <p className="text-xs text-neutral-400 truncate">{a.collectionName}</p>
                <p className="text-xs text-neutral-500 mt-1 font-mono truncate">/app/{a.slug}</p>
                <div className="flex flex-wrap gap-3 mt-2 text-xs">
                  <a href={`/app/${a.slug}`} target="_blank" className="underline text-neutral-600">
                    Open ↗
                  </a>
                  <button className="underline text-neutral-600" onClick={() => copy(a.slug)}>
                    {copied === a.slug ? "Copied ✓" : "Copy link"}
                  </button>
                  <button className="underline text-neutral-600" onClick={() => toggle(a)}>
                    {a.enabled ? "Disable" : "Enable"}
                  </button>
                  <button className="underline text-red-500" onClick={() => remove(a.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { MobileIcon } from "@/components/icons";

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
  clients: AppClient[];
};

type AppClient = {
  id: string;
  slug: string;
  clientName: string;
  clientEmail: string;
  greeting: string;
  lastOpenedAt: string | null;
};

type Contact = { id: string; name: string; email: string };

export default function MobileAppsClient({
  apps,
  collections,
  defaultEmail,
  contacts = [],
  planInfo,
}: {
  apps: App[];
  collections: { id: string; name: string }[];
  defaultEmail: string;
  contacts?: Contact[];
  planInfo?: { label: string; limit: number | null; used: number };
}) {
  const atLimit = !!planInfo && planInfo.limit !== null && planInfo.used >= planInfo.limit;
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [collectionId, setCollectionId] = useState(collections[0]?.id ?? "");
  const [appName, setAppName] = useState("");
  const [accentColor, setAccentColor] = useState("#1c1c1c");
  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  async function create(e: FormEvent) {
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
            An installable, branded app page per collection and per client. Clients add it to their home screen with your logo, a personal greeting,
            their cover photo, and one-tap contact buttons.
          </p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setCreating((v) => !v)} disabled={collections.length === 0 || atLimit}>
          + Create App
        </button>
      </div>

      {planInfo ? (
        <p className="text-xs text-neutral-500 mb-4">
          {planInfo.label} plan: {planInfo.used} of {planInfo.limit === null ? "unlimited" : planInfo.limit} apps used.
          {atLimit ? " You have reached your plan's app limit, delete an app or upgrade in Settings, Plan to add more." : ""}
        </p>
      ) : null}

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
        <EmptyState icon={MobileIcon} line="No apps yet. Create one from any collection to give clients a home-screen gallery." />
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
                <ClientInstalls app={a} contacts={contacts} copy={copy} copied={copied} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Phase 5B: per client installs. Each client gets their own app link with a
// personalised greeting and their own home screen install.
function ClientInstalls({
  app,
  contacts,
  copy,
  copied,
}: {
  app: App;
  contacts: Contact[];
  copy: (slug: string) => void;
  copied: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [greeting, setGreeting] = useState("");
  const [send, setSend] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function add(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    const res = await fetch(`/api/mobile-apps/${app.id}/clients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, clientName, clientEmail, greeting, send }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Could not add the client");
    setMsg(json.mail ? `Client added. Link email: ${json.mail}.` : "Client added.");
    setContactId("");
    setClientName("");
    setClientEmail("");
    setGreeting("");
    router.refresh();
  }

  async function removeClient(id: string) {
    if (!confirm("Remove this client's app link? Their installed icon stops opening.")) return;
    await fetch(`/api/mobile-apps/${app.id}/clients/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="mt-3 border-t border-neutral-100 pt-2">
      <button className="text-xs text-neutral-500 underline" onClick={() => setOpen((v) => !v)}>
        {app.clients.length} client app{app.clients.length === 1 ? "" : "s"} {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {app.clients.map((c) => (
            <div key={c.id} className="text-xs flex items-center gap-2">
              <span className="font-medium truncate">{c.clientName}</span>
              <span className="text-neutral-400 truncate">
                {c.lastOpenedAt ? `opened ${new Date(c.lastOpenedAt).toLocaleDateString()}` : "not opened yet"}
              </span>
              <span className="flex-1" />
              <a href={`/app/${c.slug}`} target="_blank" className="underline text-neutral-600">
                Open
              </a>
              <button className="underline text-neutral-600" onClick={() => copy(c.slug)}>
                {copied === c.slug ? "Copied ✓" : "Copy"}
              </button>
              <button className="underline text-red-500" onClick={() => removeClient(c.id)}>
                Remove
              </button>
            </div>
          ))}
          <form onSubmit={add} className="space-y-2 bg-neutral-50 rounded-md p-2">
            <select
              className="input !py-1 text-xs"
              value={contactId}
              onChange={(e) => {
                setContactId(e.target.value);
                const c = contacts.find((x) => x.id === e.target.value);
                if (c) {
                  setClientName(c.name);
                  setClientEmail(c.email);
                }
              }}
            >
              <option value="">Pick a client from your contacts, or type below</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.email ? ` (${c.email})` : ""}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className="input !py-1 text-xs" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" />
              <input className="input !py-1 text-xs" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="Client email" />
            </div>
            <input
              className="input !py-1 text-xs"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="Greeting, e.g. Hi {name}, thank you for a wonderful day!"
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} disabled={!clientEmail} />
                Email the app link
              </label>
              <span className="flex-1" />
              <button className="btn-secondary !py-1 text-xs">Add client</button>
            </div>
            {msg && <p className="text-xs text-emerald-600">{msg}</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </form>
        </div>
      )}
    </div>
  );
}

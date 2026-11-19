"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SiteSettings {
  slug: string;
  customDomain: string;
  published: boolean;
  footerText: string;
  socialInstagram: string;
  socialFacebook: string;
  socialPinterest: string;
  // Night build: extended settings
  gaId: string;
  fbPixelId: string;
  cookieBannerEnabled: boolean;
  cookieBannerText: string;
  sitePassword: string;
  aiConnected: boolean;
}

interface DomainInfo {
  status: string;
  note: string;
  token: string;
  checkedAt: string | null;
  apex: boolean;
  cnameTarget: string;
  aRecord: string;
  rootDomain: string;
}

const STATUS_STYLE: Record<string, string> = {
  VERIFIED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  NONE: "bg-neutral-50 text-neutral-500 border-neutral-200",
};
const STATUS_LABEL: Record<string, string> = { VERIFIED: "Connected", PENDING: "Waiting for DNS", FAILED: "DNS check failing", NONE: "Not connected" };

function DomainCard({ initialDomain, info }: { initialDomain: string; info: DomainInfo }) {
  const router = useRouter();
  const [domain, setDomain] = useState(initialDomain);
  const [state, setState] = useState(info);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/website/domain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not check the domain");
    if (body.action === "remove") {
      setDomain("");
      setState((s) => ({ ...s, status: "NONE", note: "", token: "" }));
    } else {
      setDomain(data.domain);
      setState((s) => ({ ...s, status: data.status, note: data.note, token: data.token, checkedAt: new Date().toISOString(), apex: String(data.domain).split(".").length === 2 }));
    }
    router.refresh();
  }

  const connected = initialDomain || state.token;
  return (
    <div className="space-y-3">
      <label className="label">Custom domain</label>
      <div className="flex gap-2">
        <input className="input" placeholder="www.yourstudio.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
        <button className="btn-primary whitespace-nowrap" disabled={busy || !domain.trim()} onClick={() => call({ action: "connect", domain })}>
          {connected ? "Save and check" : "Connect"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {connected ? (
        <div className="border border-neutral-200 rounded-md p-4 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className={`text-xs border rounded px-2 py-0.5 ${STATUS_STYLE[state.status] ?? STATUS_STYLE.NONE}`}>{STATUS_LABEL[state.status] ?? state.status}</span>
            {state.checkedAt ? <span className="text-xs text-neutral-400">Checked {new Date(state.checkedAt).toLocaleString()}</span> : null}
          </div>
          {state.note ? <p className="text-xs text-neutral-600">{state.note}</p> : null}
          <div>
            <p className="text-xs font-medium mb-1">Add these records at your domain registrar:</p>
            <table className="w-full text-xs border border-neutral-200">
              <thead className="bg-neutral-50 text-neutral-500"><tr><th className="text-left p-2">Type</th><th className="text-left p-2">Name</th><th className="text-left p-2">Value</th></tr></thead>
              <tbody>
                {state.apex ? (
                  <tr className="border-t border-neutral-100"><td className="p-2">A</td><td className="p-2">@</td><td className="p-2 font-mono">{state.aRecord || "your host's IP address (ask your host, set SITE_A_RECORD)"}</td></tr>
                ) : (
                  <tr className="border-t border-neutral-100"><td className="p-2">CNAME</td><td className="p-2 font-mono">{domain.split(".")[0]}</td><td className="p-2 font-mono">{state.cnameTarget}</td></tr>
                )}
                <tr className="border-t border-neutral-100"><td className="p-2">TXT</td><td className="p-2 font-mono">_pixelset</td><td className="p-2 font-mono break-all">pixelset-verify={state.token}</td></tr>
              </tbody>
            </table>
            <p className="text-xs text-neutral-400 mt-2">
              Either record proves the domain is yours. Once verified, visitors to {domain || "your domain"} get your site directly. HTTPS certificates are issued automatically by the hosting layer in front of Pixora (on demand TLS), so the padlock appears a minute after the domain goes live.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary !py-1.5 text-xs" disabled={busy} onClick={() => call({ action: "verify" })}>{busy ? "Checking DNS…" : "Check DNS now"}</button>
            <button className="btn-secondary !py-1.5 text-xs text-red-600" disabled={busy} onClick={() => { if (confirm("Disconnect this domain?")) call({ action: "remove" }); }}>Disconnect</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InstagramCard({ source }: { source: string }) {
  const [status, setStatus] = useState<{ connected: boolean; username?: string; posts?: number; error?: string; source?: string } | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/website/instagram");
    setStatus(await res.json().catch(() => ({ connected: false })));
  }
  useEffect(() => { load(); }, []);

  async function save(t: string) {
    setBusy(true);
    setError("");
    const res = await fetch("/api/website/instagram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not connect");
    setToken("");
    load();
  }

  return (
    <section className="card p-6">
      <h2 className="font-medium mb-1">Instagram feed</h2>
      <p className="text-sm text-neutral-500 mb-4">
        Connect your Instagram professional account so Instagram blocks show your latest posts. Paste a long lived access token from the Instagram API (Meta for Developers, Instagram API with Instagram Login), or set INSTAGRAM_ACCESS_TOKEN on the server.
      </p>
      <p className="text-sm mb-4">
        Status:{" "}
        {status === null ? (
          <span className="text-neutral-400">checking…</span>
        ) : status.connected ? (
          <span className="text-emerald-700">Connected{status.username ? ` as @${status.username}` : ""}, {status.posts} recent posts{status.source === "env" ? " (server token)" : ""}</span>
        ) : (
          <span className="text-amber-700">Not connected{status.error ? `, ${status.error}` : ""}. Instagram blocks show your manually chosen images.</span>
        )}
      </p>
      <div className="flex gap-2">
        <input className="input" type="password" autoComplete="off" placeholder="Instagram access token" value={token} onChange={(e) => setToken(e.target.value)} />
        <button className="btn-primary whitespace-nowrap" disabled={busy || !token.trim()} onClick={() => save(token)}>{busy ? "Checking…" : "Connect"}</button>
      </div>
      {source === "settings" ? (
        <button className="text-xs underline text-neutral-500 hover:text-red-600 mt-2" disabled={busy} onClick={() => save("")}>Disconnect account token</button>
      ) : null}
      {error ? <p className="text-sm text-red-600 mt-2">{error}</p> : null}
    </section>
  );
}

export function SiteSettingsClient({ website, domain, instagramSource }: { website: SiteSettings; domain: DomainInfo; instagramSource: string }) {
  const router = useRouter();
  const [form, setForm] = useState(website);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function patch(body: Record<string, unknown>, message: string) {
    setBusy(true);
    setNote("");
    setError("");
    const res = await fetch("/api/website", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    if (typeof data.slug === "string") setForm((f) => ({ ...f, slug: data.slug }));
    setNote(message);
    router.refresh();
  }

  async function destroy() {
    if (!confirm("Delete your entire website? Pages, blog posts, redirects and inbox messages will be removed. Client galleries are not affected.")) return;
    if (!confirm("This cannot be undone. Really delete the website?")) return;
    setBusy(true);
    await fetch("/api/website", { method: "DELETE" });
    router.push("/website");
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-xl">
      {note ? <p className="text-sm text-emerald-700">{note}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="card p-6">
        <h2 className="font-medium mb-1">Site visibility</h2>
        <p className="text-sm text-neutral-500 mb-4">
          {form.published
            ? "Your site is online, anyone with the link can view the published version."
            : "Your site is offline, only you can preview it."}{" "}
          Edits are saved to your draft and go live with Publish changes at the top of this screen.
        </p>
        <button
          className={form.published ? "btn-secondary" : "btn-primary"}
          disabled={busy}
          onClick={() => {
            const next = !form.published;
            setForm((f) => ({ ...f, published: next }));
            patch({ published: next }, next ? "Site is online." : "Site is offline.");
          }}
        >
          {form.published ? "Take site offline" : "Put site online"}
        </button>
      </section>

      <section className="card p-6">
        <h2 className="font-medium mb-4">Web address</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Free subdomain</label>
            <div className="flex items-center gap-2">
              <input className="input" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
              <span className="text-sm text-neutral-500 whitespace-nowrap">.{domain.rootDomain}</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">Changing this changes every link to your site.</p>
          </div>
          <button className="btn-primary" disabled={busy} onClick={() => patch({ slug: form.slug }, "Address saved.")}>
            Save subdomain
          </button>
          <p className="text-xs text-neutral-400">
            Live at https://{form.slug || "…"}.{domain.rootDomain} once DNS for {domain.rootDomain} points at this app (wildcard record), and always at /site/{form.slug || "…"}.
          </p>
          <hr className="border-neutral-100" />
          <DomainCard initialDomain={form.customDomain} info={domain} />
        </div>
      </section>

      <InstagramCard source={instagramSource} />

      <section className="card p-6">
        <h2 className="font-medium mb-4">Footer &amp; social</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Footer text</label>
            <input className="input" value={form.footerText} onChange={(e) => setForm((f) => ({ ...f, footerText: e.target.value }))} />
          </div>
          <div>
            <label className="label">Instagram URL</label>
            <input className="input" placeholder="https://instagram.com/…" value={form.socialInstagram} onChange={(e) => setForm((f) => ({ ...f, socialInstagram: e.target.value }))} />
          </div>
          <div>
            <label className="label">Facebook URL</label>
            <input className="input" placeholder="https://facebook.com/…" value={form.socialFacebook} onChange={(e) => setForm((f) => ({ ...f, socialFacebook: e.target.value }))} />
          </div>
          <div>
            <label className="label">Pinterest URL</label>
            <input className="input" placeholder="https://pinterest.com/…" value={form.socialPinterest} onChange={(e) => setForm((f) => ({ ...f, socialPinterest: e.target.value }))} />
          </div>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() =>
              patch(
                {
                  footerText: form.footerText,
                  socialInstagram: form.socialInstagram,
                  socialFacebook: form.socialFacebook,
                  socialPinterest: form.socialPinterest,
                },
                "Footer saved."
              )
            }
          >
            Save footer
          </button>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-medium mb-1">Analytics and tracking</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Paste your own IDs and the tracking code loads on your published site for visitors. Leave a field empty to keep that tool off. Nothing is sent anywhere until an ID is saved here.
        </p>
        <div className="space-y-3">
          <div>
            <label className="label">Google Analytics measurement ID</label>
            <input className="input" placeholder="G-XXXXXXXXXX" value={form.gaId} onChange={(e) => setForm((f) => ({ ...f, gaId: e.target.value }))} />
          </div>
          <div>
            <label className="label">Facebook Pixel ID</label>
            <input className="input" placeholder="123456789012345" value={form.fbPixelId} onChange={(e) => setForm((f) => ({ ...f, fbPixelId: e.target.value }))} />
          </div>
          <button className="btn-primary" disabled={busy} onClick={() => patch({ gaId: form.gaId, fbPixelId: form.fbPixelId }, "Tracking saved.")}>
            Save tracking
          </button>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-medium mb-1">Cookie banner</h2>
        <p className="text-sm text-neutral-500 mb-4">Show a consent banner at the bottom of your site. Visitors choose once and the banner stays away.</p>
        <label className="flex items-center gap-2 text-sm mb-3">
          <input type="checkbox" checked={form.cookieBannerEnabled} onChange={(e) => setForm((f) => ({ ...f, cookieBannerEnabled: e.target.checked }))} />
          Show the cookie banner
        </label>
        <label className="label">Banner text (optional)</label>
        <textarea className="input" rows={2} maxLength={300} placeholder="This site uses cookies to understand visits and improve your experience." value={form.cookieBannerText} onChange={(e) => setForm((f) => ({ ...f, cookieBannerText: e.target.value }))} />
        <button className="btn-primary mt-3" disabled={busy} onClick={() => patch({ cookieBannerEnabled: form.cookieBannerEnabled, cookieBannerText: form.cookieBannerText }, "Cookie banner saved.")}>
          Save banner
        </button>
      </section>

      <section className="card p-6">
        <h2 className="font-medium mb-1">Site password</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Require a password before anyone can view your site. Individual pages can also have their own password in the page editor. You are never locked out of your own site. Leave empty to turn it off.
        </p>
        <div className="flex gap-2">
          <input className="input" type="text" autoComplete="off" placeholder="No password set" value={form.sitePassword} onChange={(e) => setForm((f) => ({ ...f, sitePassword: e.target.value }))} />
          <button className="btn-primary whitespace-nowrap" disabled={busy} onClick={() => patch({ sitePassword: form.sitePassword }, "Site password saved.")}>
            Save
          </button>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-medium mb-1">AI tools</h2>
        <p className="text-sm text-neutral-500">
          Status:{" "}
          {form.aiConnected ? (
            <span className="text-emerald-700">Connected. The writing assistant, alt text generator, photo culling and edit suggestions are live.</span>
          ) : (
            <span className="text-amber-700">AI is not connected. The AI buttons stay visible but explain themselves until a Gemini API key is added to the server.</span>
          )}
        </p>
      </section>

      <section className="card p-6 border-red-200">
        <h2 className="font-medium mb-1 text-red-700">Danger zone</h2>
        <p className="text-sm text-neutral-500 mb-4">Deleting your website removes its pages, blog posts, redirects and inbox messages. Galleries are untouched.</p>
        <button className="btn-danger" disabled={busy} onClick={destroy}>
          Delete website
        </button>
      </section>
    </div>
  );
}

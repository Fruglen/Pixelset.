"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SiteSettings {
  slug: string;
  customDomain: string;
  published: boolean;
  footerText: string;
  socialInstagram: string;
  socialFacebook: string;
  socialPinterest: string;
}

export function SiteSettingsClient({ website }: { website: SiteSettings }) {
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
        <h2 className="font-medium mb-1">Publish state</h2>
        <p className="text-sm text-neutral-500 mb-4">
          {form.published
            ? "Your site is live, anyone with the link can view it."
            : "Your site is unpublished, only you can preview it."}
        </p>
        <button
          className={form.published ? "btn-secondary" : "btn-primary"}
          disabled={busy}
          onClick={() => {
            const next = !form.published;
            setForm((f) => ({ ...f, published: next }));
            patch({ published: next }, next ? "Site published." : "Site unpublished.");
          }}
        >
          {form.published ? "Unpublish site" : "Publish site"}
        </button>
      </section>

      <section className="card p-6">
        <h2 className="font-medium mb-4">Web address</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Free subdomain</label>
            <div className="flex items-center gap-2">
              <input className="input" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
              <span className="text-sm text-neutral-500 whitespace-nowrap">.mypixelset.com</span>
            </div>
            <p className="text-xs text-neutral-400 mt-1">Your site is served at /site/{form.slug || "…"}, changing this changes every link.</p>
          </div>
          <div>
            <label className="label">Custom domain</label>
            <input
              className="input"
              placeholder="www.yourstudio.com"
              value={form.customDomain}
              onChange={(e) => setForm((f) => ({ ...f, customDomain: e.target.value }))}
            />
            <p className="text-xs text-neutral-400 mt-1">
              Shown in your footer and used in sitemap URLs. Point your domain&apos;s CNAME at mypixelset.com to connect it (DNS connection is display-only in this replica).
            </p>
          </div>
          <button className="btn-primary" disabled={busy} onClick={() => patch({ slug: form.slug, customDomain: form.customDomain }, "Address saved.")}>
            Save address
          </button>
        </div>
      </section>

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

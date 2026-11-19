"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------- create flow

interface TemplateCard {
  id: string;
  name: string;
  tagline: string;
  desc: string;
  palette: { bg: string; text: string; accent: string; muted: string };
}

export function CreateWebsite({ templates, defaultName }: { templates: TemplateCard[]; defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [templateId, setTemplateId] = useState(templates[1]?.id ?? templates[0]?.id ?? "vienna");
  const [name, setName] = useState(defaultName);
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/website", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, logoText: name, slug: slug || name }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create the website");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-2xl font-display">Build your website</h1>
      <p className="text-sm text-neutral-500 mt-1 mb-8 max-w-2xl">
        Pick a template to start from, each is a full site (Home, Portfolio, About, Experience, Pricing,
        Reviews, Blog, Contact and a Client Area) with its own fonts and palette. You can switch templates
        any time; your blog posts always come along.
      </p>

      {step === 1 ? (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setTemplateId(t.id)}
                className={`card text-left overflow-hidden transition-shadow hover:shadow-md ${templateId === t.id ? "ring-2 ring-neutral-900" : ""}`}
              >
                <div className="h-28 flex flex-col items-center justify-center" style={{ background: t.palette.bg, color: t.palette.text }}>
                  <span className="font-display text-xl">{t.name}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] mt-1" style={{ color: t.palette.accent }}>
                    {t.tagline}
                  </span>
                </div>
                <div className="p-3 border-t border-neutral-100">
                  <div className="flex gap-1.5 mb-2">
                    {[t.palette.bg, t.palette.muted, t.palette.accent, t.palette.text].map((c, i) => (
                      <span key={i} className="w-4 h-4 rounded-full border border-neutral-200" style={{ background: c }} />
                    ))}
                  </div>
                  <p className="text-xs text-neutral-500">{t.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-6">
            <button className="btn-primary" onClick={() => setStep(2)}>
              Continue with {templates.find((t) => t.id === templateId)?.name}
            </button>
          </div>
        </>
      ) : (
        <div className="card p-6 max-w-lg">
          <div className="space-y-4">
            <div>
              <label className="label">Site name (shown as your logo)</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Free web address</label>
              <div className="flex items-center gap-2">
                <input
                  className="input"
                  placeholder={name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
                <span className="text-sm text-neutral-500 whitespace-nowrap">.mypixelset.com</span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">Served at /site/&lt;address&gt;, you can add a custom domain later in Settings.</p>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button className="btn-primary" disabled={busy || !name.trim()} onClick={create}>
                {busy ? "Creating…" : "Create website"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- pages list

interface PageRow {
  id: string;
  type: string;
  title: string;
  slug: string;
  visible: boolean;
  blockCount: number;
}

export function PagesList({ pages, siteSlug, landings }: { pages: PageRow[]; siteSlug: string; landings: { id: string; name: string; desc: string }[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [landingOpen, setLandingOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState("");

  async function importSharedPage() {
    setImportError("");
    setBusy(true);
    const res = await fetch("/api/website/share/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: importCode }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setImportError(data.error ?? "That code is not valid");
    if (data.block) return setImportError("That code is a single block. Import it inside the page editor instead.");
    setImportCode("");
    setImportOpen(false);
    setNote(`Imported "${data.page?.title ?? "page"}" as a new draft page.`);
    router.refresh();
  }

  async function addLanding(id: string) {
    setBusy(true);
    const res = await fetch("/api/website/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ landing: id }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/website/pages/${data.id}`);
      router.refresh();
    }
  }
  const [newTitle, setNewTitle] = useState("");
  async function patchPage(id: string, body: Record<string, unknown>) {
    await fetch(`/api/website/pages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    router.refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const order = pages.map((p) => p.id);
    const j = index + dir;
    if (j < 0 || j >= order.length) return;
    [order[index], order[j]] = [order[j], order[index]];
    await fetch("/api/website/pages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    });
    router.refresh();
  }

  async function addPage() {
    if (!newTitle.trim()) return;
    setBusy(true);
    const res = await fetch("/api/website/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/website/pages/${data.id}`);
      router.refresh();
    }
  }

  async function remove(page: PageRow) {
    if (!confirm(`Delete the "${page.title}" page? Its blocks will be lost.`)) return;
    await fetch(`/api/website/pages/${page.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-500">
          Your site&apos;s pages. Hidden pages stay reachable by link but leave the navigation.
        </p>
        {adding ? (
          <div className="flex gap-2">
            <input
              className="input w-56"
              placeholder="Page title"
              value={newTitle}
              autoFocus
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPage()}
            />
            <button className="btn-primary" disabled={busy} onClick={addPage}>Add</button>
            <button className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setImportOpen((o) => !o)}>Import shared page</button>
            <button className="btn-secondary" onClick={() => setLandingOpen((o) => !o)}>+ Landing page</button>
            <button className="btn-primary" onClick={() => setAdding(true)}>+ Custom page</button>
          </div>
        )}
      </div>
      {note ? <p className="text-sm text-emerald-700 mb-3">{note}</p> : null}
      {importOpen ? (
        <div className="card p-4 mb-4">
          <p className="text-sm font-medium mb-2">Import a page from a share code</p>
          <textarea className="input" rows={3} placeholder="Paste a share code (PXS1.…)" value={importCode} onChange={(e) => setImportCode(e.target.value)} />
          {importError ? <p className="text-sm text-red-600 mt-2">{importError}</p> : null}
          <div className="flex gap-2 mt-3">
            <button className="btn-primary" disabled={busy || !importCode.trim()} onClick={importSharedPage}>Import page</button>
            <button className="btn-secondary" onClick={() => setImportOpen(false)}>Cancel</button>
          </div>
          <p className="text-xs text-neutral-400 mt-2">The page arrives as a new draft page with fresh block ids. Publish when you are ready.</p>
        </div>
      ) : null}
      {landingOpen ? (
        <div className="card p-4 mb-4">
          <p className="text-sm font-medium mb-3">Prebuilt landing pages</p>
          <div className="grid md:grid-cols-4 gap-3">
            {landings.map((l) => (
              <button key={l.id} disabled={busy} onClick={() => addLanding(l.id)} className="border border-neutral-200 rounded-md p-3 text-left hover:border-neutral-900 transition-colors">
                <p className="text-sm font-medium">{l.name}</p>
                <p className="text-xs text-neutral-500 mt-1">{l.desc}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-neutral-400 mt-3">Each adds a ready made page to your draft that you can edit block by block. Publish changes to put it live.</p>
        </div>
      ) : null}

      <div className="card divide-y divide-neutral-100">
        {pages.map((page, i) => (
          <div key={page.id} className="flex items-center gap-4 px-4 py-3">
            <div className="flex flex-col gap-0.5 text-neutral-400">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="hover:text-neutral-900 disabled:opacity-30 leading-none">▲</button>
              <button onClick={() => move(i, 1)} disabled={i === pages.length - 1} className="hover:text-neutral-900 disabled:opacity-30 leading-none">▼</button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{page.title}</span>
                <span className="text-[10px] uppercase tracking-wider text-neutral-400 border border-neutral-200 rounded px-1.5 py-0.5">
                  {page.type === "CUSTOM" ? "Custom" : page.type.replace("_", " ").toLowerCase()}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                /{page.slug || ""} · {page.blockCount} block{page.blockCount === 1 ? "" : "s"}
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-neutral-500 cursor-pointer">
              <input
                type="checkbox"
                checked={page.visible}
                onChange={(e) => patchPage(page.id, { visible: e.target.checked })}
              />
              In nav
            </label>
            <a
              href={`/api/website/preview?mode=draft&to=${encodeURIComponent(`/site/${siteSlug}${page.slug ? `/${page.slug}` : ""}`)}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-neutral-500 hover:text-neutral-900 underline"
            >
              Preview
            </a>
            <button
              className="text-xs text-neutral-500 hover:text-neutral-900 underline"
              title="Copy a share code for this page"
              onClick={async () => {
                const res = await fetch(`/api/website/pages/${page.id}/share`);
                const data = await res.json().catch(() => ({}));
                if (data.code) {
                  await navigator.clipboard.writeText(data.code).catch(() => {});
                  setNote(`Share code for "${page.title}" copied. Anyone with Pixora can import it from their Pages list.`);
                }
              }}
            >
              Share
            </button>
            <Link href={`/website/pages/${page.id}`} className="btn-secondary !py-1.5 !px-3 text-xs">
              Edit blocks
            </Link>
            {page.type !== "HOME" ? (
              <button onClick={() => remove(page)} className="text-neutral-400 hover:text-red-600 text-sm" title="Delete page">
                ✕
              </button>
            ) : (
              <span className="w-4" />
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-neutral-400 mt-3">
        The Blog page lists your posts automatically (manage them in the Blog tab). The Client Area page
        links visitors to your published client galleries.
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  current: {
    template: string;
    palette: string;
    fontTheme: string;
    headerStyle: string;
    logoText: string;
    logoUrl: string;
    tagline: string;
    spacing: string;
    buttonShape: string;
    arrowStyle: string;
  };
  families: { id: string; name: string; desc: string }[];
  spacingOptions: { id: string; name: string; desc: string }[];
  buttonShapes: { id: string; name: string; radius: string }[];
  arrowStyles: { id: string; name: string; glyph: string }[];
  templates: { id: string; name: string; tagline: string; desc: string; family: string; palette: { bg: string; text: string; accent: string; muted: string } }[];
  palettes: { id: string; name: string; bg: string; text: string; accent: string; muted: string }[];
  fontThemes: { id: string; name: string; display: string; body: string }[];
  headerStyles: { id: string; name: string; desc: string }[];
}

export function DesignClient({ current, templates, palettes, fontThemes, headerStyles, families, spacingOptions, buttonShapes, arrowStyles }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [logoText, setLogoText] = useState(current.logoText);
  const [logoUrl, setLogoUrl] = useState(current.logoUrl);
  const [tagline, setTagline] = useState(current.tagline);
  const [note, setNote] = useState("");

  async function patch(body: Record<string, unknown>, message: string) {
    setBusy(true);
    setNote("");
    const res = await fetch("/api/website", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.ok) {
      setNote(message);
      router.refresh();
    }
  }

  async function switchTemplate(id: string) {
    if (id === current.template) return;
    const name = templates.find((t) => t.id === id)?.name ?? id;
    if (
      !confirm(
        `Switch your DRAFT to the ${name} template?\n\nYour live site is not touched. The draft's pages and blocks are rebuilt from the ${name} bundle with its fonts and palette, so you can preview and edit it, then Publish changes when ready (or Discard changes to go back). Blog posts, site address, logo and SEO settings are kept.`
      )
    )
      return;
    setBusy(true);
    const res = await fetch("/api/website/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: id }),
    });
    setBusy(false);
    if (res.ok) {
      setNote(`Draft switched to ${name}. Preview the draft, then publish when you are happy. Your live site is unchanged.`);
      router.refresh();
    }
  }

  return (
    <div className="space-y-10">
      {note ? <p className="text-sm text-emerald-700">{note}</p> : null}

      <section>
        <h2 className="font-medium mb-1">Template</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Switching a template stages it on your draft site, the live site stays untouched until you publish. Blog posts always survive the switch.
        </p>
        {families.map((fam) => {
          const list = templates.filter((t) => t.family === fam.id);
          if (list.length === 0) return null;
          return (
            <div key={fam.id} className="mb-6">
              <p className="label">{fam.name} <span className="normal-case tracking-normal text-neutral-400 font-normal">, {fam.desc}</span></p>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {list.map((t) => {
                  const active = t.id === current.template;
                  return (
                    <button
                      key={t.id}
                      disabled={busy}
                      onClick={() => switchTemplate(t.id)}
                      className={`card text-left overflow-hidden transition-shadow hover:shadow-md ${active ? "ring-2 ring-neutral-900" : ""}`}
                    >
                      <div className="h-24 flex flex-col items-center justify-center" style={{ background: t.palette.bg, color: t.palette.text }}>
                        <span className="font-display text-lg">{t.name}</span>
                        <span className="text-[10px] uppercase tracking-[0.2em] mt-1" style={{ color: t.palette.accent }}>{t.tagline}</span>
                      </div>
                      <div className="px-3 py-2 border-t border-neutral-100 flex items-center justify-between">
                        <p className="text-xs text-neutral-500 truncate">{t.desc}</p>
                        {active ? <span className="text-[10px] uppercase tracking-wider text-neutral-900 font-semibold ml-2">Draft</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="font-medium mb-1">Color palette</h2>
        <p className="text-sm text-neutral-500 mb-4">{palettes.length} palettes. Applies across every page of your site; any block can override it in its block settings, and selected words can be coloured in the editor.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {palettes.map((p) => (
            <button
              key={p.id}
              disabled={busy}
              onClick={() => patch({ palette: p.id }, `Palette set to ${p.name}.`)}
              className={`card p-3 text-left hover:shadow-md transition-shadow ${p.id === current.palette ? "ring-2 ring-neutral-900" : ""}`}
            >
              <div className="flex gap-1.5 mb-2">
                {[p.bg, p.muted, p.accent, p.text].map((c, i) => (
                  <span key={i} className="w-5 h-5 rounded-full border border-neutral-200" style={{ background: c }} />
                ))}
              </div>
              <p className="text-xs font-medium">{p.name}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-1">Font theme</h2>
        <p className="text-sm text-neutral-500 mb-4">{fontThemes.length} curated themes: display type for headings, paired with a body face (web safe families, no external font loading).</p>
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
          {fontThemes.map((f) => (
            <button
              key={f.id}
              disabled={busy}
              onClick={() => patch({ fontTheme: f.id }, `Font theme set to ${f.name}.`)}
              className={`card p-4 text-left hover:shadow-md transition-shadow ${f.id === current.fontTheme ? "ring-2 ring-neutral-900" : ""}`}
            >
              <p className="text-xl leading-tight" style={{ fontFamily: f.display }}>Aa Studio</p>
              <p className="text-xs text-neutral-500 mt-1" style={{ fontFamily: f.body }}>Body, the quick brown fox</p>
              <p className="text-xs font-medium mt-2">{f.name}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-1">Header layout</h2>
        <div className="grid md:grid-cols-4 gap-3 mt-4">
          {headerStyles.map((h) => (
            <button
              key={h.id}
              disabled={busy}
              onClick={() => patch({ headerStyle: h.id }, `Header set to ${h.name}.`)}
              className={`card p-4 text-left hover:shadow-md transition-shadow ${h.id === current.headerStyle ? "ring-2 ring-neutral-900" : ""}`}
            >
              <p className="text-sm font-medium">{h.name}</p>
              <p className="text-xs text-neutral-500 mt-1">{h.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-1">Spacing, buttons and arrows</h2>
        <p className="text-sm text-neutral-500 mb-4">Site wide controls applied to every block.</p>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="label">Section spacing</p>
            <div className="space-y-2">
              {spacingOptions.map((o) => (
                <button key={o.id} disabled={busy} onClick={() => patch({ spacing: o.id }, `Spacing set to ${o.name}.`)}
                  className={`card w-full p-3 text-left hover:shadow-md transition-shadow ${o.id === current.spacing ? "ring-2 ring-neutral-900" : ""}`}>
                  <p className="text-sm font-medium">{o.name}</p>
                  <p className="text-xs text-neutral-500">{o.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Button shape</p>
            <div className="space-y-2">
              {buttonShapes.map((o) => (
                <button key={o.id} disabled={busy} onClick={() => patch({ buttonShape: o.id }, `Buttons set to ${o.name}.`)}
                  className={`card w-full p-3 text-left hover:shadow-md transition-shadow flex items-center gap-3 ${o.id === current.buttonShape ? "ring-2 ring-neutral-900" : ""}`}>
                  <span className="bg-neutral-900 text-white text-[10px] uppercase tracking-widest px-3 py-1.5" style={{ borderRadius: o.radius }}>Book</span>
                  <span className="text-sm font-medium">{o.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">Arrow style (buttons and text links)</p>
            <div className="space-y-2">
              {arrowStyles.map((o) => (
                <button key={o.id} disabled={busy} onClick={() => patch({ arrowStyle: o.id }, `Arrows set to ${o.name}.`)}
                  className={`card w-full p-3 text-left hover:shadow-md transition-shadow flex items-center gap-3 ${o.id === current.arrowStyle ? "ring-2 ring-neutral-900" : ""}`}>
                  <span className="text-xs uppercase tracking-widest">View work {o.glyph}</span>
                  <span className="text-sm font-medium ml-auto">{o.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="card p-6 max-w-xl">
        <h2 className="font-medium mb-4">Logo &amp; tagline</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Logo text</label>
            <input className="input" value={logoText} onChange={(e) => setLogoText(e.target.value)} />
          </div>
          <div>
            <label className="label">Logo image URL (optional, overrides text)</label>
            <input className="input" placeholder="https://…/logo.png" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
          </div>
          <div>
            <label className="label">Tagline</label>
            <input className="input" placeholder="e.g. Fine-art wedding photography" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>
          <button className="btn-primary" disabled={busy} onClick={() => patch({ logoText, logoUrl, tagline }, "Branding saved.")}>
            Save branding
          </button>
        </div>
      </section>
    </div>
  );
}

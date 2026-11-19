"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Cover = { material: string; color: string; debossText: string; photoUrl: string };
type Slot = { photoUrl: string; caption: string };
type Spread = { layout: string; slots: Slot[] };
type Photo = { id: string; url: string; filename: string };

const MATERIALS = ["Linen", "Leather", "Velvet", "Photo cover"];
const COLORS: { name: string; hex: string }[] = [
  { name: "Ivory", hex: "#f5f0e6" },
  { name: "Charcoal", hex: "#2f2f33" },
  { name: "Navy", hex: "#22304a" },
  { name: "Blush", hex: "#e8c4c4" },
  { name: "Sage", hex: "#a8b5a0" },
  { name: "Burgundy", hex: "#5e2129" },
  { name: "Camel", hex: "#b08954" },
  { name: "Black", hex: "#111111" },
];
const LAYOUTS: { id: string; label: string; slots: number }[] = [
  { id: "FULL", label: "Full page", slots: 1 },
  { id: "SPLIT", label: "Two photos", slots: 2 },
  { id: "TRIO", label: "Three photos", slots: 3 },
  { id: "QUAD", label: "Four photos", slots: 4 },
];

const emptyCover: Cover = { material: "Linen", color: "Ivory", debossText: "", photoUrl: "" };

export default function AlbumDesigner({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [studioName, setStudioName] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [editable, setEditable] = useState(true);
  const [cover, setCover] = useState<Cover>(emptyCover);
  const [pages, setPages] = useState<Spread[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [picking, setPicking] = useState<{ spread: number; slot: number } | "cover" | null>(null);
  const [saveNote, setSaveNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/album/${token}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "This album link is not valid");
        setLoading(false);
        return;
      }
      setTitle(json.design.title);
      setStatus(json.design.status);
      setEditable(json.design.editable);
      setCover({ ...emptyCover, ...(json.design.cover ?? {}) });
      setPages(Array.isArray(json.design.pages) ? json.design.pages : []);
      setPhotos(json.photos ?? []);
      setStudioName(json.studioName ?? "");
      setLoading(false);
      hydrated.current = true;
    })();
  }, [token]);

  const save = useCallback(
    async (nextCover: Cover, nextPages: Spread[]) => {
      const res = await fetch(`/api/album/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover: nextCover, pages: nextPages }),
      });
      setSaveNote(res.ok ? "Saved" : "Could not save, check your connection");
    },
    [token]
  );

  // Debounced autosave on every change after the first load.
  useEffect(() => {
    if (!hydrated.current || !editable) return;
    setSaveNote("Saving…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(cover, pages), 700);
  }, [cover, pages, editable, save]);

  function setSlot(spreadIdx: number, slotIdx: number, patch: Partial<Slot>) {
    setPages((ps) =>
      ps.map((s, i) =>
        i === spreadIdx ? { ...s, slots: s.slots.map((sl, j) => (j === slotIdx ? { ...sl, ...patch } : sl)) } : s
      )
    );
  }

  function setLayout(spreadIdx: number, layoutId: string) {
    const layout = LAYOUTS.find((l) => l.id === layoutId) ?? LAYOUTS[0];
    setPages((ps) =>
      ps.map((s, i) => {
        if (i !== spreadIdx) return s;
        const slots = Array.from({ length: layout.slots }, (_, j) => s.slots[j] ?? { photoUrl: "", caption: "" });
        return { layout: layoutId, slots };
      })
    );
  }

  function moveSpread(idx: number, dir: -1 | 1) {
    setPages((ps) => {
      const next = [...ps];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return ps;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  async function submit() {
    if (!confirm("Send this design to the studio for review? You will not be able to edit it while it is being reviewed.")) return;
    setSubmitting(true);
    await save(cover, pages);
    const res = await fetch(`/api/album/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit" }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return setSaveNote(json.error || "Could not submit");
    }
    setStatus("SUBMITTED");
    setEditable(false);
  }

  if (loading) return <main className="max-w-3xl mx-auto px-4 py-16 text-neutral-500">Loading your album…</main>;
  if (error)
    return (
      <main className="max-w-3xl mx-auto px-4 py-16">
        <p className="text-red-600">{error}</p>
      </main>
    );

  const coverColor = COLORS.find((c) => c.name === cover.color) ?? COLORS[0];

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <header className="text-center space-y-1">
        <h1 className="font-display text-3xl">{title || "Your album"}</h1>
        {studioName ? <p className="text-sm text-neutral-500">Designed with {studioName}</p> : null}
        {status === "SUBMITTED" ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
            Submitted. Your photographer is reviewing this design; they will reopen it here if anything needs to
            change.
          </p>
        ) : status === "APPROVED" ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2">
            Approved. This design is final and going to print.
          </p>
        ) : status === "CHANGES_REQUESTED" ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            Your photographer asked for a few changes. Adjust anything below and submit again.
          </p>
        ) : (
          <p className="text-sm text-neutral-500">Pick your cover, lay out each spread, then send it for review.</p>
        )}
        {editable && saveNote ? <p className="text-xs text-neutral-400">{saveNote}</p> : null}
      </header>

      <fieldset disabled={!editable} className="space-y-8 contents">
        <section className="card p-5 space-y-4">
          <h2 className="font-display text-lg">Cover</h2>
          <div
            className="mx-auto w-64 h-80 rounded-md shadow-md flex flex-col items-center justify-center gap-3 p-4 text-center"
            style={{ backgroundColor: coverColor.hex }}
          >
            {cover.material === "Photo cover" && cover.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.photoUrl} alt="Cover" className="w-full h-full object-cover rounded" />
            ) : (
              <>
                <p
                  className={`font-display text-xl tracking-wide ${["Ivory", "Blush", "Sage", "Camel"].includes(cover.color) ? "text-neutral-800" : "text-neutral-100"}`}
                >
                  {cover.debossText || title || "Your names here"}
                </p>
                <p className={`text-xs uppercase tracking-widest ${["Ivory", "Blush", "Sage", "Camel"].includes(cover.color) ? "text-neutral-500" : "text-neutral-300"}`}>
                  {cover.material}
                </p>
              </>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Material</label>
              <select className="input" value={cover.material} onChange={(e) => setCover({ ...cover, material: e.target.value })}>
                {MATERIALS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Colour</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    title={c.name}
                    onClick={() => setCover({ ...cover, color: c.name })}
                    className={`w-8 h-8 rounded-full border ${cover.color === c.name ? "ring-2 ring-neutral-900" : "border-neutral-300"}`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>
          </div>
          {cover.material === "Photo cover" ? (
            <button type="button" className="btn-secondary" onClick={() => setPicking("cover")}>
              {cover.photoUrl ? "Change cover photo" : "Choose cover photo"}
            </button>
          ) : (
            <div>
              <label className="label">Debossed text (names, date)</label>
              <input
                className="input"
                value={cover.debossText}
                maxLength={80}
                onChange={(e) => setCover({ ...cover, debossText: e.target.value })}
                placeholder="Emma & Liam · 14 June 2026"
              />
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Spreads ({pages.length})</h2>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPages((ps) => [...ps, { layout: "SPLIT", slots: [{ photoUrl: "", caption: "" }, { photoUrl: "", caption: "" }] }])}
            >
              + Add spread
            </button>
          </div>
          {pages.map((spread, i) => (
            <div key={i} className="card p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">Spread {i + 1}</span>
                <select className="input !w-40 !py-1" value={spread.layout} onChange={(e) => setLayout(i, e.target.value)}>
                  {LAYOUTS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <span className="flex-1" />
                <button type="button" className="text-xs underline text-neutral-500" onClick={() => moveSpread(i, -1)}>
                  Move up
                </button>
                <button type="button" className="text-xs underline text-neutral-500" onClick={() => moveSpread(i, 1)}>
                  Move down
                </button>
                <button
                  type="button"
                  className="text-xs underline text-red-500"
                  onClick={() => setPages((ps) => ps.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
              <div className={`grid gap-2 ${spread.slots.length === 1 ? "grid-cols-1" : spread.slots.length === 2 ? "grid-cols-2" : spread.slots.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                {spread.slots.map((slot, j) => (
                  <div key={j} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setPicking({ spread: i, slot: j })}
                      className="w-full aspect-[4/3] rounded-md border border-dashed border-neutral-300 bg-neutral-50 overflow-hidden flex items-center justify-center text-xs text-neutral-400 hover:border-neutral-500"
                    >
                      {slot.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={slot.photoUrl} alt={slot.caption || "Spread photo"} className="w-full h-full object-cover" />
                      ) : (
                        "Tap to choose a photo"
                      )}
                    </button>
                    <input
                      className="input !py-1 !text-xs"
                      placeholder="Caption (optional)"
                      value={slot.caption}
                      maxLength={120}
                      onChange={(e) => setSlot(i, j, { caption: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {pages.length === 0 ? <p className="text-sm text-neutral-400">No spreads yet, add your first one.</p> : null}
        </section>
      </fieldset>

      {editable ? (
        <div className="flex justify-center">
          <button className="btn-primary !px-8" disabled={submitting} onClick={submit}>
            {submitting ? "Sending…" : "Submit design for review"}
          </button>
        </div>
      ) : null}

      {picking !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPicking(null)}>
          <div className="bg-white rounded-lg p-5 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg">Choose a photo</h3>
              <button className="text-neutral-400 hover:text-neutral-700" onClick={() => setPicking(null)}>
                ✕
              </button>
            </div>
            {photos.length === 0 ? (
              <p className="text-sm text-neutral-500">No photos are available for this album yet.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.filename}
                    className="rounded-md overflow-hidden border border-neutral-200 hover:border-neutral-900"
                    onClick={() => {
                      if (picking === "cover") setCover({ ...cover, photoUrl: p.url });
                      else if (picking) setSlot(picking.spread, picking.slot, { photoUrl: p.url });
                      setPicking(null);
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.filename} className="w-full h-24 object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

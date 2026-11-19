"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Block,
  BLOCK_DEFS,
  BLOCK_CATEGORIES,
  blockDef,
  makeBlock,
  newBlockId,
  FieldDef,
  parseDeviceLayouts,
  DeviceOverride,
} from "@/lib/blocks";
import { FreeformEditor } from "./freeform-editor";
import { makeShareCode } from "@/lib/site-share";

interface PageInfo {
  id: string;
  type: string;
  title: string;
  slug: string;
  visible: boolean;
  password?: string;
}

interface Pal {
  id?: string;
  name?: string;
  bg: string;
  text: string;
  accent: string;
  muted: string;
  subtle: string;
}

interface SessionTypeOpt {
  id: string;
  name: string;
  open: boolean;
  mini: boolean;
}

type MediaKind = "image" | "video";
type OpenMedia = (kind: MediaKind, cb: (url: string) => void) => void;

// ----------------------------------------------------------- media library

interface MediaRow {
  id: string;
  filename: string;
  url: string;
  mime: string;
  kind: string;
  size: number;
}

function MediaPicker({ kind, onPick, onClose }: { kind: MediaKind; onPick: (url: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"uploads" | "galleries">("uploads");
  const [media, setMedia] = useState<MediaRow[] | null>(null);
  const [photos, setPhotos] = useState<{ id: string; url: string; filename: string; collection: string }[] | null>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function loadMedia() {
    fetch(`/api/website/media?kind=${kind === "video" ? "VIDEO" : "IMAGE"}`)
      .then((r) => r.json())
      .then((d) => setMedia(d.media ?? []))
      .catch(() => setMedia([]));
  }
  useEffect(loadMedia, [kind]);
  useEffect(() => {
    if (tab !== "galleries" || photos) return;
    fetch("/api/website/photos")
      .then((r) => r.json())
      .then((d) => setPhotos(d.photos ?? []))
      .catch(() => setPhotos([]));
  }, [tab, photos]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError("");
    let last = "";
    for (const file of Array.from(files)) {
      setUploading((n) => n + 1);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/website/media", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      setUploading((n) => n - 1);
      if (!res.ok) {
        setError(data.error ?? `Could not upload ${file.name}`);
        continue;
      }
      last = data.media.url;
    }
    loadMedia();
    if (files.length === 1 && last) onPick(last);
  }

  async function remove(id: string) {
    if (!confirm("Delete this file from your media library? Blocks still using it will show a broken image.")) return;
    await fetch(`/api/website/media/${id}`, { method: "DELETE" });
    loadMedia();
  }

  const accept = kind === "video" ? "video/mp4,video/webm,video/quicktime" : "image/jpeg,image/png,image/gif,image/webp,image/svg+xml";
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[82vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200">
          <div className="flex gap-5 text-sm">
            <button className={`pb-1 ${tab === "uploads" ? "tab-active" : "tab-inactive"}`} onClick={() => setTab("uploads")}>
              Media library ({kind === "video" ? "videos" : "images, GIF, PNG"})
            </button>
            {kind === "image" ? (
              <button className={`pb-1 ${tab === "galleries" ? "tab-active" : "tab-inactive"}`} onClick={() => setTab("galleries")}>My galleries</button>
            ) : null}
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900">✕</button>
        </div>
        <div className="p-5 overflow-y-auto">
          {tab === "uploads" ? (
            <>
              <div
                className="border-2 border-dashed border-neutral-300 rounded-md p-5 text-center text-sm text-neutral-500 mb-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  upload(e.dataTransfer.files);
                }}
              >
                <p>Drop {kind === "video" ? "MP4, WebM or MOV videos" : "JPEG, PNG, GIF, WebP or SVG images"} here, or</p>
                <button className="btn-secondary mt-2" onClick={() => fileRef.current?.click()}>Choose files</button>
                <input ref={fileRef} type="file" accept={accept} multiple className="hidden" onChange={(e) => upload(e.target.files)} />
                {uploading > 0 ? <p className="mt-2 text-neutral-700">Uploading {uploading} file{uploading === 1 ? "" : "s"}…</p> : null}
                {error ? <p className="mt-2 text-red-600">{error}</p> : null}
              </div>
              {media === null ? (
                <p className="text-sm text-neutral-500">Loading…</p>
              ) : media.length === 0 ? (
                <p className="text-sm text-neutral-500">Nothing uploaded yet.</p>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {media.map((m) => (
                    <div key={m.id} className="group relative">
                      <button className="w-full" title={m.filename} onClick={() => onPick(m.url)}>
                        {m.kind === "VIDEO" ? (
                          <video src={m.url} className="w-full aspect-square object-cover rounded bg-black" muted />
                        ) : (
                          <img src={m.url} alt={m.filename} className="w-full aspect-square object-cover rounded group-hover:opacity-75" />
                        )}
                        <span className="absolute left-1 bottom-1 text-[9px] uppercase bg-black/60 text-white px-1 rounded">{m.kind === "GIF" ? "GIF" : m.mime.split("/")[1]}</span>
                      </button>
                      <button className="absolute right-1 top-1 hidden group-hover:block text-xs bg-white/90 rounded px-1 text-red-600" onClick={() => remove(m.id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : photos === null ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : photos.length === 0 ? (
            <p className="text-sm text-neutral-500">No photos yet, upload some in Client Gallery first, or use the media library.</p>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {photos.map((p) => (
                <button key={p.id} className="group relative" title={`${p.filename} · ${p.collection}`} onClick={() => onPick(p.url)}>
                  <img src={p.url} alt={p.filename} className="w-full aspect-square object-cover rounded group-hover:opacity-75" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------- per-word colour

function ColorWords({
  value,
  onChange,
  getSelection,
  palette,
}: {
  value: string;
  onChange: (v: string) => void;
  getSelection: () => [number, number];
  palette: Pal;
}) {
  const [custom, setCustom] = useState("#b06a45");
  function wrap(color: string) {
    const [a, b] = getSelection();
    if (a === b) {
      alert("Select the words to colour first.");
      return;
    }
    onChange(`${value.slice(0, a)}[color=${color}]${value.slice(a, b)}[/color]${value.slice(b)}`);
  }
  return (
    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-neutral-400">
      <span>Colour selected words:</span>
      {([["accent", palette.accent], ["subtle", palette.subtle], ["text", palette.text]] as const).map(([role, c]) => (
        <button key={role} type="button" title={role} onMouseDown={(e) => e.preventDefault()} onClick={() => wrap(role)} className="w-4 h-4 rounded-full border border-neutral-300" style={{ background: c }} />
      ))}
      <input type="color" value={custom} onChange={(e) => setCustom(e.target.value)} className="w-5 h-5 p-0 border-0" />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap(custom)} className="underline">apply</button>
      {value.includes("[color=") ? (
        <button type="button" className="underline ml-1" onClick={() => onChange(value.replace(/\[color=[^\]]+\]|\[\/color\]/g, ""))}>clear colours</button>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------- field inputs

const AI_ACTIONS: { id: string; label: string }[] = [
  { id: "rewrite", label: "Rewrite" },
  { id: "shorten", label: "Shorten" },
  { id: "expand", label: "Expand" },
  { id: "formal", label: "More formal" },
  { id: "friendly", label: "Friendlier" },
  { id: "polish", label: "Fix and polish" },
];

// Night build: AI writing assistant (Gemini via /api/website/ai-assist).
// Without a key the menu explains the not connected state honestly.
function AiAssist({ value, onChange }: { value: string; onChange: (v: unknown) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  async function run(action: string) {
    setBusy(action);
    setNote("");
    const res = await fetch("/api/website/ai-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, text: value }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setNote(data.error ?? "AI request failed");
      return;
    }
    if (typeof data.text === "string") onChange(data.text);
    setNote(data.note ?? "Done. Review the new copy, then save.");
    setOpen(false);
  }
  return (
    <div className="mt-1.5">
      <button type="button" className="text-xs underline text-neutral-500 hover:text-neutral-900" onClick={() => setOpen((o) => !o)}>
        AI assist
      </button>
      {open ? (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {AI_ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              className="text-[11px] border border-neutral-300 rounded-full px-2.5 py-1 hover:border-neutral-900 disabled:opacity-50"
              disabled={!!busy || !value.trim()}
              onClick={() => run(a.id)}
            >
              {busy === a.id ? "Working…" : a.label}
            </button>
          ))}
        </div>
      ) : null}
      {note ? <p className="text-[11px] text-neutral-500 mt-1">{note}</p> : null}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  openMedia,
  palette,
  sessionTypes,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  openMedia: OpenMedia;
  palette: Pal;
  sessionTypes: SessionTypeOpt[];
}) {
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const sel = (): [number, number] => [ref.current?.selectionStart ?? 0, ref.current?.selectionEnd ?? 0];
  switch (field.kind) {
    case "text": {
      const v = String(value ?? "");
      const rich = !/link|url|slug|alt|handle/i.test(field.key);
      return (
        <div>
          <label className="label">{field.label}</label>
          <input ref={ref} className="input" value={v} onChange={(e) => onChange(e.target.value)} />
          {rich ? <ColorWords value={v} onChange={onChange} getSelection={sel} palette={palette} /> : null}
          {rich ? <AiAssist value={v} onChange={onChange} /> : null}
        </div>
      );
    }
    case "textarea": {
      const v = String(value ?? "");
      const rich = !/slugs|sessionTypes|columns|names/i.test(field.key);
      return (
        <div>
          <label className="label">{field.label}</label>
          <textarea ref={ref} className="input" rows={4} value={v} onChange={(e) => onChange(e.target.value)} />
          {rich ? <ColorWords value={v} onChange={onChange} getSelection={sel} palette={palette} /> : null}
          {rich ? <AiAssist value={v} onChange={onChange} /> : null}
        </div>
      );
    }
    case "number":
      return (
        <div>
          <label className="label">{field.label}</label>
          <input
            className="input w-28"
            type="number"
            min={1}
            value={Number(value ?? 0) || ""}
            onChange={(e) => onChange(parseInt(e.target.value, 10) || 1)}
          />
        </div>
      );
    case "toggle":
      return (
        <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer py-1">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
      );
    case "select":
      return (
        <div>
          <label className="label">{field.label}</label>
          <select className="input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    case "image":
    case "video": {
      const url = String(value ?? "");
      const isVideo = field.kind === "video";
      return (
        <div>
          <label className="label">{field.label}</label>
          <div className="flex gap-2 items-start">
            {url && !isVideo ? <img src={url} alt="" className="w-14 h-14 object-cover rounded border border-neutral-200 flex-none" /> : null}
            {url && isVideo && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) ? <video src={url} className="w-20 h-14 object-cover rounded border border-neutral-200 flex-none bg-black" muted /> : null}
            <div className="flex-1 space-y-1.5">
              <input className="input" placeholder={isVideo ? "https:// YouTube, Vimeo or video file URL" : "https:// image URL"} value={url} onChange={(e) => onChange(e.target.value)} />
              <div className="flex gap-3">
                <button type="button" className="text-xs underline text-neutral-500 hover:text-neutral-900" onClick={() => openMedia(isVideo ? "video" : "image", (u) => onChange(u))}>
                  Upload or choose from library
                </button>
                {url ? (
                  <button type="button" className="text-xs underline text-neutral-500 hover:text-red-600" onClick={() => onChange("")}>
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      );
    }
    case "sessionTypes": {
      const chosen = Array.isArray(value) ? (value as unknown[]).map(String) : [];
      return (
        <div>
          <label className="label">{field.label}</label>
          {sessionTypes.length === 0 ? (
            <p className="text-xs text-amber-700">No session types yet. Create them in Studio Manager, Booking, and they appear here with live availability.</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {sessionTypes.map((t) => (
                <label key={t.id} className="flex items-center gap-1.5 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={chosen.includes(t.id)}
                    onChange={(e) => onChange(e.target.checked ? [...chosen, t.id] : chosen.filter((x) => x !== t.id))}
                  />
                  {t.name}
                  <span className="text-[10px] text-neutral-400">{t.mini ? "mini" : "session"}{t.open ? "" : ", closed"}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      );
    }
    case "canvas":
      return null; // the Flex canvas renders its own editor
    case "items": {
      const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const update = (i: number, key: string, v: unknown) => {
        const next = items.map((item, j) => (j === i ? { ...item, [key]: v } : item));
        onChange(next);
      };
      const moveItem = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= items.length) return;
        const next = [...items];
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next);
      };
      return (
        <div>
          <label className="label">{field.label}</label>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="border border-neutral-200 rounded-md p-3 relative">
                <div className="absolute right-2 top-2 flex gap-1 text-neutral-400 text-xs">
                  <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} className="hover:text-neutral-900 disabled:opacity-30">▲</button>
                  <button type="button" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="hover:text-neutral-900 disabled:opacity-30">▼</button>
                  <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="hover:text-red-600">✕</button>
                </div>
                <div className="space-y-2.5 pr-12">
                  {(field.fields ?? []).map((sf) => (
                    <FieldInput key={sf.key} field={sf} value={item[sf.key]} onChange={(v) => update(i, sf.key, v)} openMedia={openMedia} palette={palette} sessionTypes={sessionTypes} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 text-xs underline text-neutral-500 hover:text-neutral-900"
            onClick={() => onChange([...items, Object.fromEntries((field.fields ?? []).map((sf) => [sf.key, sf.kind === "toggle" ? false : ""]))])}
          >
            + Add {field.itemLabel?.toLowerCase() ?? "item"}
          </button>
        </div>
      );
    }
  }
}

// ----------------------------------------------------------- block settings + resize

function BlockSettings({
  block,
  palettes,
  onChange,
}: {
  block: Block;
  palettes: Pal[];
  onChange: (key: string, value: unknown) => void;
}) {
  const p = block.props;
  return (
    <div className="grid md:grid-cols-4 gap-3 border border-neutral-100 bg-neutral-50/60 rounded-md p-3">
      <p className="md:col-span-4 text-xs font-medium uppercase tracking-wider text-neutral-500">Block settings</p>
      <div className="md:col-span-2">
        <label className="label">Colour palette for this block</label>
        <div className="flex gap-2 items-center">
          <select className="input" value={String(p._palette ?? "")} onChange={(e) => onChange("_palette", e.target.value)}>
            <option value="">Site palette</option>
            {palettes.map((pl) => (
              <option key={pl.id} value={pl.id}>{pl.name}</option>
            ))}
          </select>
          {p._palette ? (
            <span className="flex gap-1">
              {(() => {
                const pl = palettes.find((x) => x.id === p._palette);
                return pl ? [pl.bg, pl.muted, pl.accent, pl.text].map((c, i) => <span key={i} className="w-4 h-4 rounded-full border border-neutral-200" style={{ background: c }} />) : null;
              })()}
            </span>
          ) : null}
        </div>
      </div>
      <div>
        <label className="label">Anchor id (for #links)</label>
        <input className="input" placeholder="e.g. pricing" value={String(p._anchor ?? "")} onChange={(e) => onChange("_anchor", e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))} />
      </div>
      <div>
        <label className="label">Menu label (one page sites)</label>
        <input className="input" placeholder="e.g. Pricing" value={String(p._navLabel ?? "")} onChange={(e) => onChange("_navLabel", e.target.value)} />
      </div>
      <DeviceLayoutSettings block={block} onChange={onChange} />
    </div>
  );
}

// Night build (Website): per device layout overrides (props._dev). Desktop
// uses the resize frame above; tablet and mobile get their own width,
// minimum height and visibility, previewed with the device preview tabs.
function DeviceLayoutSettings({ block, onChange }: { block: Block; onChange: (key: string, value: unknown) => void }) {
  const dev = parseDeviceLayouts(block.props._dev);
  const [tab, setTab] = useState<"tablet" | "mobile">("tablet");
  const cur = dev[tab] ?? {};
  function set(patch: Partial<DeviceOverride>) {
    const next = { ...dev, [tab]: { ...(dev[tab] ?? {}), ...patch } };
    if (next[tab] && Object.values(next[tab] as object).every((v) => v === undefined || v === false)) delete next[tab];
    onChange("_dev", next);
  }
  return (
    <div className="md:col-span-4 border-t border-neutral-200/70 pt-3 mt-1">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Per device layout</p>
        <span className="flex-1" />
        {(["tablet", "mobile"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setTab(d)}
            className={`text-xs px-3 py-1 rounded-full border ${tab === d ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-600"}`}
          >
            {d === "tablet" ? "Tablet" : "Mobile"}
            {dev[d] ? " •" : ""}
          </button>
        ))}
        <span className="text-xs text-neutral-400">Desktop uses the resize frame. Check the result with the preview device tabs above.</span>
      </div>
      <div className="grid md:grid-cols-4 gap-3">
        <div>
          <label className="label">Width on {tab} (%)</label>
          <input
            className="input"
            type="number"
            min={20}
            max={100}
            placeholder="Same as desktop"
            value={cur.width ?? ""}
            onChange={(e) => set({ width: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Min height on {tab} (px)</label>
          <input
            className="input"
            type="number"
            min={0}
            max={2000}
            placeholder="Same as desktop"
            value={cur.minHeight ?? ""}
            onChange={(e) => set({ minHeight: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-600 pt-6">
          <input type="checkbox" checked={!!cur.hidden} onChange={(e) => set({ hidden: e.target.checked || undefined })} />
          Hide this block on {tab}
        </label>
        {(dev.tablet || dev.mobile) && (
          <button type="button" className="text-xs underline text-neutral-400 pt-6 text-left" onClick={() => onChange("_dev", {})}>
            Clear device overrides
          </button>
        )}
      </div>
    </div>
  );
}

// Visual frame with drag handles: left/right edges set the block's width,
// the bottom edge sets its minimum height.
function ResizeFrame({ block, onChange }: { block: Block; onChange: (key: string, value: unknown) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.min(100, Math.max(20, Number(block.props._width) || 100));
  const minHeight = Math.max(0, Number(block.props._minHeight) || 0);
  const drag = useRef<{ mode: "l" | "r" | "b"; x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    function move(ev: PointerEvent) {
      const d = drag.current;
      if (!d || !ref.current) return;
      const full = ref.current.clientWidth;
      if (d.mode === "b") {
        onChange("_minHeight", Math.max(0, Math.round((d.h + (ev.clientY - d.y) * 4) / 10) * 10));
      } else {
        const dx = ((ev.clientX - d.x) / full) * 100 * 2 * (d.mode === "l" ? -1 : 1);
        onChange("_width", Math.min(100, Math.max(20, Math.round(d.w + dx))));
      }
    }
    function up() {
      drag.current = null;
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  });

  const start = (mode: "l" | "r" | "b") => (ev: React.PointerEvent) => {
    ev.preventDefault();
    drag.current = { mode, x: ev.clientX, y: ev.clientY, w: width, h: minHeight };
  };

  return (
    <div ref={ref} className="relative h-9 bg-neutral-50 rounded" title="Drag the handles to resize this block">
      <div className="absolute inset-y-1 rounded border border-sky-400 bg-sky-50 flex items-center justify-center text-[10px] text-sky-700" style={{ left: `${(100 - width) / 2}%`, right: `${(100 - width) / 2}%` }}>
        width {width}% · min height {minHeight ? `${minHeight}px` : "auto"}
        <span onPointerDown={start("l")} className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-5 bg-white border-2 border-sky-500 rounded-sm cursor-ew-resize" data-resize="left" />
        <span onPointerDown={start("r")} className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-5 bg-white border-2 border-sky-500 rounded-sm cursor-ew-resize" data-resize="right" />
        <span onPointerDown={start("b")} className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-6 h-3 bg-white border-2 border-sky-500 rounded-sm cursor-ns-resize" data-resize="bottom" />
      </div>
      {width !== 100 || minHeight ? (
        <button type="button" className="absolute right-1 top-1 text-[10px] underline text-neutral-400" onClick={() => { onChange("_width", 100); onChange("_minHeight", 0); }}>reset</button>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------- block card summary

function summarize(block: Block): string {
  const p = block.props;
  const firstString =
    [p.heading, p.title, p.quote, p.label, p.body, p.url, p.handle, p.address, p.collectionSlug]
      .map((v) => (typeof v === "string" ? v.replace(/\[color=[^\]]+\]|\[\/color\]/g, "").trim() : ""))
      .find(Boolean) ?? "";
  const listKeys = ["items", "images", "slides", "packages", "rows", "elements"];
  const counts = listKeys
    .filter((k) => Array.isArray(p[k]) && (p[k] as unknown[]).length > 0)
    .map((k) => `${(p[k] as unknown[]).length} ${k === "rows" ? "rows" : k === "elements" ? "elements" : "items"}`);
  return [firstString.slice(0, 70), counts.join(", ")].filter(Boolean).join(" · ");
}

function ShareBlockButton({ block }: { block: Block }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      await navigator.clipboard.writeText(makeShareCode({ v: 1, kind: "block", block }));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }
  return (
    <button className="text-xs text-neutral-400 hover:text-neutral-900" onClick={share} title="Copy a share code for this block">
      {copied ? "Copied ✓" : "Share"}
    </button>
  );
}

function BlockLibrary({ onAdd, onImportBlock }: { onAdd: (type: string) => void; onImportBlock?: (block: Block) => void }) {
  const [q, setQ] = useState("");
  const [importCode, setImportCode] = useState("");
  const [importError, setImportError] = useState("");
  async function doImport() {
    setImportError("");
    const res = await fetch("/api/website/share/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: importCode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setImportError(data.error ?? "That code is not valid");
    if (data.block && onImportBlock) {
      onImportBlock(data.block as Block);
      setImportCode("");
    } else if (data.page) {
      setImportError("That code is a whole page. Import it from the Pages list instead.");
    }
  }
  return (
    <div className="card p-3 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
      <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 mb-2">Blocks</p>
      {onImportBlock ? (
        <div className="mb-3 border border-dashed border-neutral-300 rounded p-2">
          <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">Import a shared block</p>
          <textarea className="input !py-1.5 text-xs" rows={2} placeholder="Paste a share code (PXS1.…)" value={importCode} onChange={(e) => setImportCode(e.target.value)} />
          {importError ? <p className="text-[11px] text-red-600 mt-1">{importError}</p> : null}
          <button className="btn-secondary w-full mt-2 !py-1.5 text-xs" disabled={!importCode.trim()} onClick={doImport}>Import block</button>
        </div>
      ) : null}
      <input className="input !py-1.5 text-xs mb-3" placeholder="Search blocks" value={q} onChange={(e) => setQ(e.target.value)} />
      {BLOCK_CATEGORIES.map((cat) => {
        const defs = BLOCK_DEFS.filter((d) => d.category === cat && (!q || `${d.name} ${d.desc}`.toLowerCase().includes(q.toLowerCase())));
        if (defs.length === 0) return null;
        return (
          <div key={cat} className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">{cat}</p>
            <div className="space-y-1">
              {defs.map((d) => (
                <div
                  key={d.type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-block-type", d.type);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onAdd(d.type)}
                  className="border border-neutral-200 rounded px-2 py-1.5 text-xs cursor-grab hover:border-neutral-900 bg-white"
                  title={d.desc}
                  data-block-type={d.type}
                >
                  {d.name}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-neutral-400">Drag a block onto the page, or click to add it at the end.</p>
    </div>
  );
}

function DropZone({ index, active, onDrop, setActive }: { index: number; active: boolean; onDrop: (index: number, dt: DataTransfer) => void; setActive: (i: number | null) => void }) {
  return (
    <div
      className={`transition-all rounded ${active ? "h-10 border-2 border-dashed border-sky-500 bg-sky-50 flex items-center justify-center text-xs text-sky-700" : "h-2"}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-block-type") || e.dataTransfer.types.includes("application/x-block-id")) {
          e.preventDefault();
          setActive(index);
        }
      }}
      onDragLeave={() => setActive(null)}
      onDrop={(e) => {
        e.preventDefault();
        setActive(null);
        onDrop(index, e.dataTransfer);
      }}
      data-dropzone={index}
    >
      {active ? "Drop here" : null}
    </div>
  );
}

// ----------------------------------------------------------- editor

export function PageEditor({
  page,
  initialBlocks,
  siteSlug,
  sitePalette,
  siteFonts,
  palettes,
  sessionTypes,
}: {
  page: PageInfo;
  initialBlocks: Block[];
  siteSlug: string;
  sitePalette: Pal;
  siteFonts: { display: string; body: string };
  palettes: Pal[];
  sessionTypes: SessionTypeOpt[];
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [pagePassword, setPagePassword] = useState(page.password ?? "");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [media, setMedia] = useState<{ kind: MediaKind; cb: (url: string) => void } | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const slugLocked = page.type === "HOME" || page.type === "BLOG";
  const pagePath = `/site/${siteSlug}${page.slug ? `/${page.slug}` : ""}`;
  const previewHref = `/api/website/preview?mode=draft&to=${encodeURIComponent(pagePath)}`;
  const openMedia: OpenMedia = (kind, cb) => setMedia({ kind, cb });

  function markDirty() {
    setDirty(true);
    setSavedAt(null);
  }

  function updateBlock(id: string, key: string, value: unknown) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, props: { ...b.props, [key]: value } } : b)));
    markDirty();
  }
  function replaceProps(id: string, props: Record<string, unknown>) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, props } : b)));
    markDirty();
  }
  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[j]] = [next[j], next[index]];
    setBlocks(next);
    markDirty();
  }
  function duplicate(index: number) {
    const src = blocks[index];
    const copy: Block = { id: newBlockId(), type: src.type, props: JSON.parse(JSON.stringify(src.props)) };
    const next = [...blocks];
    next.splice(index + 1, 0, copy);
    setBlocks(next);
    markDirty();
  }
  function remove(index: number) {
    setBlocks((bs) => bs.filter((_, i) => i !== index));
    markDirty();
  }
  function insert(type: string, at: number) {
    const block = makeBlock(type);
    const next = [...blocks];
    next.splice(Math.max(0, Math.min(at, next.length)), 0, block);
    setBlocks(next);
    setOpenId(block.id);
    markDirty();
  }
  function onDrop(index: number, dt: DataTransfer) {
    const type = dt.getData("application/x-block-type");
    if (type) return insert(type, index);
    const id = dt.getData("application/x-block-id");
    if (!id) return;
    const from = blocks.findIndex((b) => b.id === id);
    if (from < 0) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(index > from ? index - 1 : index, 0, moved);
    setBlocks(next);
    markDirty();
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/website/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug: slugLocked ? undefined : slug, blocks: JSON.stringify(blocks), password: pagePassword }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
      return;
    }
    setDirty(false);
    setSavedAt(Date.now());
    setPreviewKey((k) => k + 1);
    router.refresh();
  }

  const openBlock = useMemo(() => blocks.find((b) => b.id === openId) ?? null, [blocks, openId]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Link href="/website" className="text-sm text-neutral-500 hover:text-neutral-900">← Pages</Link>
        <input className="input !w-56" value={title} onChange={(e) => { setTitle(e.target.value); markDirty(); }} />
        <div className="flex items-center gap-1 text-sm text-neutral-500">
          <span>/</span>
          <input
            className="input !w-36"
            value={slug}
            disabled={slugLocked}
            onChange={(e) => { setSlug(e.target.value); markDirty(); }}
            placeholder={page.type === "HOME" ? "(home)" : "slug"}
          />
        </div>
        <input
          className="input !w-44"
          type="text"
          autoComplete="off"
          title="Page password. Visitors must enter it to view this page. Empty means no password."
          placeholder="Page password (optional)"
          value={pagePassword}
          onChange={(e) => { setPagePassword(e.target.value); markDirty(); }}
        />
        <div className="flex-1" />
        <button className="btn-secondary" onClick={() => setPreview((p) => !p)}>{preview ? "Hide preview" : "Show draft preview"}</button>
        <a href={previewHref} target="_blank" rel="noreferrer" className="btn-secondary">Open draft ↗</a>
        <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : dirty ? "Save to draft" : savedAt ? "Saved ✓" : "Saved"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}

      <div className="grid gap-5 lg:grid-cols-[200px_1fr]">
        <BlockLibrary
          onAdd={(type) => insert(type, blocks.length)}
          onImportBlock={(b) => {
            const block: Block = { ...b, id: newBlockId() };
            setBlocks((bs) => [...bs, block]);
            setOpenId(block.id);
            markDirty();
          }}
        />

        <div className="min-w-0">
          {preview ? (
            <div className="card mb-4 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-100">
                <p className="text-xs text-neutral-500">Draft preview, refreshes after each save</p>
                <span className="flex-1" />
                {(
                  [
                    { id: "desktop", label: "Desktop", w: "100%" },
                    { id: "tablet", label: "Tablet", w: "768px" },
                    { id: "mobile", label: "Mobile", w: "390px" },
                  ] as const
                ).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setPreviewDevice(d.id)}
                    className={`text-xs px-3 py-1 rounded-full border ${previewDevice === d.id ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-600"}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="bg-neutral-100 py-3">
                <iframe
                  key={previewKey}
                  src={previewHref}
                  className="h-[520px] bg-white mx-auto block shadow"
                  style={{ width: previewDevice === "tablet" ? 768 : previewDevice === "mobile" ? 390 : "100%", maxWidth: "100%" }}
                  title="Draft preview"
                />
              </div>
            </div>
          ) : null}

          <DropZone index={0} active={dropAt === 0} onDrop={onDrop} setActive={setDropAt} />
          {blocks.map((block, i) => {
            const def = blockDef(block.type);
            const open = openId === block.id;
            return (
              <div key={block.id}>
                <div className={`card ${open ? "ring-1 ring-neutral-300" : ""}`} data-block-id={block.id}>
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/x-block-id", block.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      className="cursor-grab text-neutral-400 hover:text-neutral-900 select-none"
                      title="Drag to reorder"
                      data-drag-handle
                    >
                      ⠿
                    </span>
                    <div className="flex flex-col gap-0.5 text-neutral-400 text-[10px]">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="hover:text-neutral-900 disabled:opacity-30 leading-none">▲</button>
                      <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="hover:text-neutral-900 disabled:opacity-30 leading-none">▼</button>
                    </div>
                    <button className="flex-1 text-left min-w-0" onClick={() => setOpenId(open ? null : block.id)}>
                      <span className="text-sm font-medium">{def?.name ?? block.type}</span>
                      {block.props._palette ? <span className="ml-2 text-[10px] uppercase tracking-wider text-sky-700">{String(block.props._palette)} palette</span> : null}
                      {block.props._anchor ? <span className="ml-2 text-[10px] text-neutral-400">#{String(block.props._anchor)}</span> : null}
                      <span className="text-xs text-neutral-400 ml-2 truncate">{summarize(block)}</span>
                    </button>
                    <ShareBlockButton block={block} />
                    <button className="text-xs text-neutral-400 hover:text-neutral-900" onClick={() => duplicate(i)}>Duplicate</button>
                    <button className="text-xs text-neutral-400 hover:text-red-600" onClick={() => remove(i)}>Delete</button>
                    <button className="text-neutral-400 hover:text-neutral-900 text-sm" onClick={() => setOpenId(open ? null : block.id)}>
                      {open ? "▴" : "▾"}
                    </button>
                  </div>
                  {open ? (
                    <div className="px-4 pb-2">
                      <ResizeFrame block={block} onChange={(k, v) => updateBlock(block.id, k, v)} />
                    </div>
                  ) : null}
                  {open && def ? (
                    <div className="border-t border-neutral-100 px-4 py-4 space-y-4">
                      {block.type === "freeform" ? (
                        <FreeformEditor props={block.props} onChange={(next) => replaceProps(block.id, next)} palette={sitePalette as unknown as Record<string, string>} fonts={siteFonts} openMedia={openMedia} />
                      ) : (
                        <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
                          {def.fields.map((f) => (
                            <div key={f.key} className={f.kind === "items" || f.kind === "textarea" || f.kind === "sessionTypes" ? "md:col-span-2" : ""}>
                              <FieldInput
                                field={f}
                                value={block.props[f.key]}
                                onChange={(v) => updateBlock(block.id, f.key, v)}
                                openMedia={openMedia}
                                palette={sitePalette}
                                sessionTypes={sessionTypes}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      <BlockSettings block={block} palettes={palettes} onChange={(k, v) => updateBlock(block.id, k, v)} />
                    </div>
                  ) : null}
                </div>
                <DropZone index={i + 1} active={dropAt === i + 1} onDrop={onDrop} setActive={setDropAt} />
              </div>
            );
          })}

          <p className="text-xs text-neutral-400 mt-3">
            {blocks.length} block{blocks.length === 1 ? "" : "s"} on this page.
            {openBlock ? "" : " Click a block to edit it, drag ⠿ to reorder, drag blocks in from the library."} Saving stores the page on your draft site; use Publish changes to put it live.
          </p>
        </div>
      </div>

      {media ? (
        <MediaPicker
          kind={media.kind}
          onPick={(url) => {
            media.cb(url);
            setMedia(null);
          }}
          onClose={() => setMedia(null)}
        />
      ) : null}
    </div>
  );
}

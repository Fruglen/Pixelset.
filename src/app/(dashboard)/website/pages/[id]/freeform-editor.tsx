"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FreeElement, FREEFORM_WIDTH, newFreeElement, parseFreeElements } from "@/lib/blocks";

// Phase 5B: Flex canvas editor. A WYSIWYG canvas at the site's design width
// (scaled to fit the editor): drag elements to move them, pull the handles to
// resize, drag new elements in from the toolbar and drop them where they go.

type Kind = FreeElement["kind"];
const KINDS: { kind: Kind; label: string; icon: string }[] = [
  { kind: "text", label: "Text", icon: "T" },
  { kind: "image", label: "Image", icon: "▣" },
  { kind: "video", label: "Video", icon: "▶" },
  { kind: "button", label: "Button", icon: "⬭" },
  { kind: "shape", label: "Shape", icon: "◆" },
];
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];

const FILLS = [
  { value: "accent", label: "Accent" },
  { value: "text", label: "Text colour" },
  { value: "muted", label: "Muted" },
  { value: "subtle", label: "Subtle" },
];

function fill(f: string | undefined, palette: Record<string, string>): string {
  const v = f || "accent";
  return v.startsWith("#") ? v : palette[v] ?? palette.accent;
}

function Preview({ el, palette, fonts }: { el: FreeElement; palette: Record<string, string>; fonts: { display: string; body: string } }) {
  switch (el.kind) {
    case "text":
      return (
        <div
          style={{
            fontSize: el.fontSize ?? 32,
            lineHeight: 1.15,
            textAlign: (el.align as "left" | "center" | "right") ?? "left",
            color: el.color ? fill(el.color, palette) : palette.text,
            fontFamily: el.font === "body" ? fonts.body : fonts.display,
            whiteSpace: "pre-wrap",
            width: "100%",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {(el.text ?? "").replace(/\[color=[^\]]+\]|\[\/color\]/g, "")}
        </div>
      );
    case "image":
      return el.url ? (
        <img src={el.url} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-sm" style={{ background: palette.muted, color: palette.subtle }}>Image, set it in the panel</div>
      );
    case "video":
      return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(el.url ?? "") ? (
        <video src={el.url} className="w-full h-full object-cover pointer-events-none" muted />
      ) : (
        <div className="w-full h-full bg-neutral-800 text-white text-sm flex items-center justify-center px-3 text-center">▶ {el.url || "Video, set it in the panel"}</div>
      );
    case "button":
      return (
        <div
          className="w-full h-full flex items-center justify-center uppercase tracking-[0.12em] text-sm"
          style={el.variant === "outline" ? { border: `1px solid ${palette.text}`, color: palette.text } : { background: palette.accent, color: palette.bg }}
        >
          {el.text}
        </div>
      );
    case "shape":
      if (el.shape === "line") return <div className="w-full" style={{ borderTop: `2px solid ${fill(el.fill, palette)}`, marginTop: "50%" }} />;
      return <div className="w-full h-full" style={{ background: fill(el.fill, palette), borderRadius: el.shape === "circle" ? 9999 : el.radius ?? 0 }} />;
  }
}

export function FreeformEditor({
  props,
  onChange,
  palette,
  fonts,
  openMedia,
}: {
  props: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  palette: Record<string, string>;
  fonts: { display: string; body: string };
  openMedia: (kind: "image" | "video", cb: (url: string) => void) => void;
}) {
  const elements = parseFreeElements(props.elements);
  const height = Math.max(160, Math.min(2400, Number(props.height) || 560));
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [selected, setSelected] = useState<string | null>(null);
  const [snap, setSnap] = useState(true);
  const drag = useRef<{ id: string; mode: "move" | Handle; startX: number; startY: number; orig: FreeElement } | null>(null);
  const live = useRef(elements);
  live.current = elements;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / FREEFORM_WIDTH)));
    ro.observe(el);
    setScale(Math.min(1, el.clientWidth / FREEFORM_WIDTH));
    return () => ro.disconnect();
  }, []);

  const setElements = useCallback(
    (next: FreeElement[]) => onChange({ ...props, elements: next }),
    [onChange, props]
  );
  const update = (id: string, patch: Partial<FreeElement>) => setElements(elements.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const round = (n: number) => (snap ? Math.round(n * 2) / 2 : Math.round(n * 100) / 100);

  useEffect(() => {
    function move(ev: PointerEvent) {
      const d = drag.current;
      if (!d) return;
      const dx = ((ev.clientX - d.startX) / scale / FREEFORM_WIDTH) * 100;
      const dy = ((ev.clientY - d.startY) / scale / height) * 100;
      const o = d.orig;
      let { x, y, w, h } = o;
      if (d.mode === "move") {
        x = o.x + dx;
        y = o.y + dy;
      } else {
        if (d.mode.includes("e")) w = Math.max(2, o.w + dx);
        if (d.mode.includes("s")) h = Math.max(2, o.h + dy);
        if (d.mode.includes("w")) {
          w = Math.max(2, o.w - dx);
          x = o.x + (o.w - w);
        }
        if (d.mode.includes("n")) {
          h = Math.max(2, o.h - dy);
          y = o.y + (o.h - h);
        }
      }
      const next = live.current.map((e) => (e.id === d.id ? { ...e, x: round(x), y: round(y), w: round(w), h: round(h) } : e));
      onChange({ ...props, elements: next });
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

  function startDrag(ev: React.PointerEvent, el: FreeElement, mode: "move" | Handle) {
    ev.preventDefault();
    ev.stopPropagation();
    setSelected(el.id);
    drag.current = { id: el.id, mode, startX: ev.clientX, startY: ev.clientY, orig: { ...el } };
  }

  function add(kind: Kind, x?: number, y?: number) {
    const el = newFreeElement(kind, x, y);
    if (x !== undefined) el.x = round(Math.max(0, x - el.w / 2));
    if (y !== undefined) el.y = round(Math.max(0, y - el.h / 2));
    el.z = Math.max(1, ...elements.map((e) => (e.z ?? 1) + 1));
    if (kind === "shape") el.z = 0;
    setElements([...elements, el]);
    setSelected(el.id);
  }

  function onDrop(ev: React.DragEvent) {
    const kind = ev.dataTransfer.getData("application/x-free-kind") as Kind;
    if (!kind) return;
    ev.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 100;
    const y = ((ev.clientY - rect.top) / rect.height) * 100;
    add(kind, x, y);
  }

  function onKey(ev: React.KeyboardEvent) {
    if (!selected) return;
    const el = elements.find((e) => e.id === selected);
    if (!el) return;
    const tag = (ev.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const step = ev.shiftKey ? 5 : 0.5;
    const moves: Record<string, Partial<FreeElement>> = {
      ArrowLeft: { x: el.x - step },
      ArrowRight: { x: el.x + step },
      ArrowUp: { y: el.y - step },
      ArrowDown: { y: el.y + step },
    };
    if (moves[ev.key]) {
      ev.preventDefault();
      update(el.id, moves[ev.key]);
    } else if (ev.key === "Delete" || ev.key === "Backspace") {
      ev.preventDefault();
      setElements(elements.filter((e) => e.id !== el.id));
      setSelected(null);
    }
  }

  const sel = elements.find((e) => e.id === selected) ?? null;

  return (
    <div className="space-y-3" onKeyDown={onKey} tabIndex={-1}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-neutral-500 mr-1">Drag onto the canvas, or click to add:</span>
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/x-free-kind", k.kind);
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => add(k.kind)}
            className="border border-neutral-300 rounded-md px-2.5 py-1 text-xs hover:border-neutral-900 cursor-grab"
          >
            <span className="mr-1">{k.icon}</span>
            {k.label}
          </button>
        ))}
        <div className="flex-1" />
        <label className="text-xs text-neutral-500 flex items-center gap-1">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Snap
        </label>
        <label className="text-xs text-neutral-500 flex items-center gap-1">
          Canvas height
          <input
            type="number"
            className="input !w-20 !py-1"
            min={160}
            max={2400}
            step={20}
            value={height}
            onChange={(e) => onChange({ ...props, height: parseInt(e.target.value, 10) || 560 })}
          />
          px
        </label>
      </div>

      <div ref={wrapRef} className="w-full">
        <div style={{ width: FREEFORM_WIDTH * scale, height: height * scale }} className="relative">
          <div
            ref={canvasRef}
            className="absolute top-0 left-0 origin-top-left border border-dashed border-neutral-300"
            style={{
              width: FREEFORM_WIDTH,
              height,
              transform: `scale(${scale})`,
              background: palette.bg,
              backgroundImage: "linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)",
              backgroundSize: `${FREEFORM_WIDTH / 12}px ${FREEFORM_WIDTH / 12}px`,
              fontFamily: fonts.body,
              color: palette.text,
            }}
            onPointerDown={() => setSelected(null)}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("application/x-free-kind")) e.preventDefault();
            }}
            onDrop={onDrop}
          >
            {elements.map((el) => {
              const active = el.id === selected;
              return (
                <div
                  key={el.id}
                  className={`absolute select-none ${active ? "outline outline-2 outline-sky-500" : "hover:outline hover:outline-1 hover:outline-sky-300"}`}
                  style={{
                    left: `${el.x}%`,
                    top: `${el.y}%`,
                    width: `${el.w}%`,
                    height: `${el.h}%`,
                    transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined,
                    zIndex: el.z ?? 1,
                    opacity: el.opacity ?? 1,
                    cursor: "move",
                  }}
                  onPointerDown={(e) => startDrag(e, el, "move")}
                  onDoubleClick={() => setSelected(el.id)}
                  data-free-id={el.id}
                >
                  <Preview el={el} palette={palette} fonts={fonts} />
                  {active
                    ? HANDLES.map((hd) => (
                        <span
                          key={hd}
                          onPointerDown={(e) => startDrag(e, el, hd)}
                          className="absolute w-3.5 h-3.5 bg-white border-2 border-sky-500 rounded-sm"
                          style={{
                            transform: `scale(${1 / scale})`,
                            left: hd.includes("w") ? -7 : hd.includes("e") ? undefined : "calc(50% - 7px)",
                            right: hd.includes("e") ? -7 : undefined,
                            top: hd.includes("n") ? -7 : hd.includes("s") ? undefined : "calc(50% - 7px)",
                            bottom: hd.includes("s") ? -7 : undefined,
                            cursor: `${hd}-resize`,
                          }}
                          data-handle={hd}
                        />
                      ))
                    : null}
                </div>
              );
            })}
            {elements.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-2xl pointer-events-none">
                Drop text, images, video, buttons or shapes here
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {sel ? (
        <div className="border border-neutral-200 rounded-md p-3 grid md:grid-cols-4 gap-3 text-sm">
          <p className="md:col-span-4 text-xs font-medium uppercase tracking-wider text-neutral-500">
            {sel.kind} element · {sel.x.toFixed(1)}%, {sel.y.toFixed(1)}% · {sel.w.toFixed(1)}% x {sel.h.toFixed(1)}% (arrow keys nudge, Delete removes)
          </p>
          {sel.kind === "text" || sel.kind === "button" ? (
            <div className="md:col-span-2">
              <label className="label">Text</label>
              <textarea className="input" rows={2} value={sel.text ?? ""} onChange={(e) => update(sel.id, { text: e.target.value })} />
            </div>
          ) : null}
          {sel.kind === "text" ? (
            <>
              <div>
                <label className="label">Size (px)</label>
                <input className="input" type="number" min={8} max={240} value={sel.fontSize ?? 32} onChange={(e) => update(sel.id, { fontSize: parseInt(e.target.value, 10) || 32 })} />
              </div>
              <div>
                <label className="label">Font</label>
                <select className="input" value={sel.font ?? "display"} onChange={(e) => update(sel.id, { font: e.target.value })}>
                  <option value="display">Display (headings)</option>
                  <option value="body">Body</option>
                </select>
              </div>
              <div>
                <label className="label">Align</label>
                <select className="input" value={sel.align ?? "left"} onChange={(e) => update(sel.id, { align: e.target.value })}>
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <label className="label">Colour</label>
                <div className="flex gap-1.5 items-center">
                  <select className="input" value={sel.color?.startsWith("#") ? "custom" : sel.color ?? ""} onChange={(e) => update(sel.id, { color: e.target.value === "custom" ? "#333333" : e.target.value })}>
                    <option value="">Text colour</option>
                    {FILLS.filter((f) => f.value !== "text").map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    <option value="custom">Custom</option>
                  </select>
                  {sel.color?.startsWith("#") ? <input type="color" value={sel.color} onChange={(e) => update(sel.id, { color: e.target.value })} /> : null}
                </div>
              </div>
            </>
          ) : null}
          {sel.kind === "image" || sel.kind === "video" ? (
            <div className="md:col-span-2">
              <label className="label">{sel.kind === "image" ? "Image URL" : "Video URL (YouTube, Vimeo or MP4)"}</label>
              <input className="input" value={sel.url ?? ""} onChange={(e) => update(sel.id, { url: e.target.value })} />
              <button type="button" className="text-xs underline text-neutral-500 mt-1" onClick={() => openMedia(sel.kind === "video" ? "video" : "image", (url) => update(sel.id, { url }))}>
                Upload or choose from library
              </button>
            </div>
          ) : null}
          {sel.kind === "image" ? (
            <div>
              <label className="label">Alt text</label>
              <input className="input" value={sel.alt ?? ""} onChange={(e) => update(sel.id, { alt: e.target.value })} />
            </div>
          ) : null}
          {sel.kind === "button" ? (
            <>
              <div>
                <label className="label">Link</label>
                <input className="input" value={sel.link ?? ""} onChange={(e) => update(sel.id, { link: e.target.value })} />
              </div>
              <div>
                <label className="label">Style</label>
                <select className="input" value={sel.variant ?? "solid"} onChange={(e) => update(sel.id, { variant: e.target.value })}>
                  <option value="solid">Solid</option>
                  <option value="outline">Outline</option>
                </select>
              </div>
            </>
          ) : null}
          {sel.kind === "shape" ? (
            <>
              <div>
                <label className="label">Shape</label>
                <select className="input" value={sel.shape ?? "rect"} onChange={(e) => update(sel.id, { shape: e.target.value })}>
                  <option value="rect">Rectangle</option>
                  <option value="circle">Circle / oval</option>
                  <option value="line">Line</option>
                </select>
              </div>
              <div>
                <label className="label">Fill</label>
                <div className="flex gap-1.5 items-center">
                  <select className="input" value={sel.fill?.startsWith("#") ? "custom" : sel.fill ?? "accent"} onChange={(e) => update(sel.id, { fill: e.target.value === "custom" ? "#c08478" : e.target.value })}>
                    {FILLS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    <option value="custom">Custom</option>
                  </select>
                  {sel.fill?.startsWith("#") ? <input type="color" value={sel.fill} onChange={(e) => update(sel.id, { fill: e.target.value })} /> : null}
                </div>
              </div>
              <div>
                <label className="label">Corner radius</label>
                <input className="input" type="number" min={0} max={400} value={sel.radius ?? 0} onChange={(e) => update(sel.id, { radius: parseInt(e.target.value, 10) || 0 })} />
              </div>
            </>
          ) : null}
          <div>
            <label className="label">Rotation (deg)</label>
            <input className="input" type="number" min={-180} max={180} value={sel.rotate ?? 0} onChange={(e) => update(sel.id, { rotate: parseInt(e.target.value, 10) || 0 })} />
          </div>
          <div>
            <label className="label">Opacity</label>
            <input type="range" min={0.1} max={1} step={0.05} value={sel.opacity ?? 1} onChange={(e) => update(sel.id, { opacity: parseFloat(e.target.value) })} className="w-full" />
          </div>
          <div className="md:col-span-4 flex gap-3 text-xs">
            <button type="button" className="underline text-neutral-500" onClick={() => update(sel.id, { z: Math.max(...elements.map((e) => e.z ?? 1)) + 1 })}>Bring to front</button>
            <button type="button" className="underline text-neutral-500" onClick={() => update(sel.id, { z: 0 })}>Send to back</button>
            <button type="button" className="underline text-neutral-500" onClick={() => {
              const copy = { ...sel, id: newFreeElement(sel.kind).id, x: sel.x + 3, y: sel.y + 3 };
              setElements([...elements, copy]);
              setSelected(copy.id);
            }}>Duplicate</button>
            <button type="button" className="underline text-red-600" onClick={() => { setElements(elements.filter((e) => e.id !== sel.id)); setSelected(null); }}>Delete element</button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-neutral-400">Click an element to edit it. Positions are stored as a share of the canvas, so the layout scales with the screen; on phones the elements stack top to bottom.</p>
      )}
    </div>
  );
}

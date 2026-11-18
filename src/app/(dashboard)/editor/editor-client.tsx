"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Photo = { id: string; url: string; filename: string };
type Col = { id: string; name: string; photos: Photo[] };

type Adjust = {
  brightness: number; // 50–150 (%)
  contrast: number; // 50–150 (%)
  saturation: number; // 0–200 (%)
  warmth: number; // −50…50
  sepia: number; // 0–100 (%)
  grayscale: number; // 0–100 (%)
};

// Phase 5A, geometry on top of the filters: 90° rotation, flips, a straighten
// slider, and crop with preset aspect ratios. All client-side canvas.
type Geometry = {
  rotate90: number; // 0..3 quarter turns
  flipH: boolean;
  flipV: boolean;
  straighten: number; // −15…15 degrees, auto-zoomed so no empty corners show
  crop: { x: number; y: number; w: number; h: number } | null; // normalized 0..1
};

const NEUTRAL: Adjust = { brightness: 100, contrast: 100, saturation: 100, warmth: 0, sepia: 0, grayscale: 0 };
const NEUTRAL_GEO: Geometry = { rotate90: 0, flipH: false, flipV: false, straighten: 0, crop: null };

const PRESETS: { name: string; adjust: Adjust }[] = [
  { name: "Original", adjust: NEUTRAL },
  { name: "Vivid", adjust: { ...NEUTRAL, saturation: 140, contrast: 112 } },
  { name: "Golden", adjust: { ...NEUTRAL, warmth: 22, brightness: 105, saturation: 108 } },
  { name: "Matte", adjust: { ...NEUTRAL, contrast: 84, brightness: 106, saturation: 90 } },
  { name: "Fade", adjust: { ...NEUTRAL, brightness: 110, contrast: 78, saturation: 78 } },
  { name: "Cool", adjust: { ...NEUTRAL, warmth: -22, saturation: 95 } },
  { name: "Sepia", adjust: { ...NEUTRAL, sepia: 70, warmth: 8, contrast: 95 } },
  { name: "B&W", adjust: { ...NEUTRAL, grayscale: 100, contrast: 112 } },
];

const ASPECTS: { id: string; name: string; ratio: number | null }[] = [
  { id: "free", name: "Free", ratio: null },
  { id: "1:1", name: "1:1", ratio: 1 },
  { id: "4:5", name: "4:5", ratio: 4 / 5 },
  { id: "3:2", name: "3:2", ratio: 3 / 2 },
  { id: "16:9", name: "16:9", ratio: 16 / 9 },
];

function filterString(a: Adjust): string {
  return `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturation}%) sepia(${a.sepia}%) grayscale(${a.grayscale}%)`;
}

/** Image dimensions after the 90° rotation step. */
function rotatedDims(img: HTMLImageElement, geo: Geometry): { w: number; h: number } {
  const swap = geo.rotate90 % 2 === 1;
  return { w: swap ? img.naturalHeight : img.naturalWidth, h: swap ? img.naturalWidth : img.naturalHeight };
}

/**
 * Draw the geometry-transformed image (rotate, flip, straighten with cover
 * zoom) onto an offscreen canvas at the image's natural scale.
 */
function renderGeometry(img: HTMLImageElement, geo: Geometry): HTMLCanvasElement {
  const { w, h } = rotatedDims(img, geo);
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d")!;
  const theta = (geo.straighten * Math.PI) / 180;
  // Cover zoom: scale so the straightened image still fills the full frame
  const cos = Math.abs(Math.cos(theta));
  const sin = Math.abs(Math.sin(theta));
  const zoom = Math.max((w * cos + h * sin) / w, (w * sin + h * cos) / h);

  ctx.translate(w / 2, h / 2);
  ctx.rotate((geo.rotate90 * Math.PI) / 2 + theta);
  ctx.scale(geo.flipH ? -1 : 1, geo.flipV ? -1 : 1);
  ctx.scale(zoom, zoom);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return off;
}

/** Full pipeline: geometry → crop → filters (+ warmth pixel pass). */
function render(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  a: Adjust,
  geo: Geometry,
  maxDim: number | null
) {
  const geoCanvas = renderGeometry(img, geo);
  const crop = geo.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const sx = crop.x * geoCanvas.width;
  const sy = crop.y * geoCanvas.height;
  const sw = Math.max(1, crop.w * geoCanvas.width);
  const sh = Math.max(1, crop.h * geoCanvas.height);

  let w = Math.round(sw);
  let h = Math.round(sh);
  if (maxDim && Math.max(w, h) > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.filter = filterString(a);
  ctx.drawImage(geoCanvas, sx, sy, sw, sh, 0, 0, w, h);
  ctx.filter = "none";
  if (a.warmth !== 0) {
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    const shift = a.warmth;
    for (let i = 0; i < px.length; i += 4) {
      px[i] = Math.min(255, Math.max(0, px[i] + shift));
      px[i + 2] = Math.min(255, Math.max(0, px[i + 2] - shift));
    }
    ctx.putImageData(data, 0, 0);
  }
}

/** Largest centered crop rect with the given aspect ratio, normalized. */
function centeredCrop(frameW: number, frameH: number, ratio: number | null) {
  if (!ratio) return { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };
  const frameRatio = frameW / frameH;
  let w = 1;
  let h = 1;
  if (ratio > frameRatio) h = frameRatio / ratio;
  else w = ratio / frameRatio;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

export default function EditorClient({ collections }: { collections: Col[] }) {
  const router = useRouter();
  const [colId, setColId] = useState(collections[0]?.id ?? "");
  const col = collections.find((c) => c.id === colId) ?? collections[0];
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [adjust, setAdjust] = useState<Adjust>(NEUTRAL);
  const [geo, setGeo] = useState<Geometry>(NEUTRAL_GEO);
  const [preset, setPreset] = useState("Original");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState("");
  const [error, setError] = useState("");
  const [cropMode, setCropMode] = useState(false);
  const [cropAspect, setCropAspect] = useState("free");
  // Working crop while in crop mode (applied to geo.crop on Apply)
  const [workingCrop, setWorkingCrop] = useState({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropFrameRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ kind: string; startX: number; startY: number; crop: typeof workingCrop } | null>(null);

  // Load the selected photo through the same-origin proxy (never taints the canvas).
  useEffect(() => {
    if (!photo) return;
    setLoading(true);
    setImg(null);
    setError("");
    setSavedName("");
    setAdjust(NEUTRAL);
    setGeo(NEUTRAL_GEO);
    setCropMode(false);
    setPreset("Original");
    const el = new Image();
    el.onload = () => {
      setImg(el);
      setLoading(false);
    };
    el.onerror = () => {
      setError("Could not load this photo.");
      setLoading(false);
    };
    el.src = `/api/editor/photo/${photo.id}`;
  }, [photo]);

  // Re-render the preview whenever anything changes. In crop mode the preview
  // shows the uncropped geometry so the crop frame can be placed on it.
  useEffect(() => {
    if (!img || !canvasRef.current) return;
    render(canvasRef.current, img, adjust, cropMode ? { ...geo, crop: null } : geo, 1400);
  }, [img, adjust, geo, cropMode]);

  const applyPreset = useCallback((name: string) => {
    const p = PRESETS.find((x) => x.name === name);
    if (!p) return;
    setPreset(name);
    setAdjust(p.adjust);
  }, []);

  function enterCropMode() {
    if (!img) return;
    const { w, h } = rotatedDims(img, geo);
    const ratio = ASPECTS.find((a) => a.id === cropAspect)?.ratio ?? null;
    setWorkingCrop(geo.crop ?? centeredCrop(w, h, ratio));
    setCropMode(true);
  }

  function pickAspect(id: string) {
    setCropAspect(id);
    if (!img) return;
    const { w, h } = rotatedDims(img, geo);
    setWorkingCrop(centeredCrop(w, h, ASPECTS.find((a) => a.id === id)?.ratio ?? null));
  }

  function applyCrop() {
    setGeo({ ...geo, crop: workingCrop });
    setCropMode(false);
  }

  function clearCrop() {
    setGeo({ ...geo, crop: null });
    setCropMode(false);
  }

  function rotate() {
    // Quarter-turn; the crop no longer matches the rotated frame, so it resets.
    setGeo({ ...geo, rotate90: (geo.rotate90 + 1) % 4, crop: null });
    setCropMode(false);
  }

  // ---- Crop frame dragging (move + corner resize, aspect honored) ----
  function cropPointerDown(e: React.PointerEvent, kind: string) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { kind, startX: e.clientX, startY: e.clientY, crop: { ...workingCrop } };
  }

  function cropPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const frame = cropFrameRef.current;
    if (!drag || !frame) return;
    const rect = frame.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    const ratio = ASPECTS.find((a) => a.id === cropAspect)?.ratio ?? null;
    const frameRatio = rect.width / rect.height;
    const c = { ...drag.crop };

    if (drag.kind === "move") {
      c.x = Math.min(1 - c.w, Math.max(0, drag.crop.x + dx));
      c.y = Math.min(1 - c.h, Math.max(0, drag.crop.y + dy));
    } else {
      // Corner resize anchored at the opposite corner
      const anchorX = drag.kind.includes("w") ? drag.crop.x + drag.crop.w : drag.crop.x;
      const anchorY = drag.kind.includes("n") ? drag.crop.y + drag.crop.h : drag.crop.y;
      let px = drag.kind.includes("w") ? drag.crop.x + dx : drag.crop.x + drag.crop.w + dx;
      let py = drag.kind.includes("n") ? drag.crop.y + dy : drag.crop.y + drag.crop.h + dy;
      px = Math.min(1, Math.max(0, px));
      py = Math.min(1, Math.max(0, py));
      let w = Math.abs(px - anchorX);
      let h = Math.abs(py - anchorY);
      if (ratio) {
        // Honor the aspect lock in actual pixels of the frame
        const hFromW = (w * frameRatio) / ratio;
        if (hFromW <= h) h = hFromW;
        else w = (h * ratio) / frameRatio;
      }
      w = Math.max(0.05, w);
      h = Math.max(0.05, h);
      c.x = px < anchorX || drag.kind.includes("w") ? Math.max(0, anchorX - w) : anchorX;
      c.y = py < anchorY || drag.kind.includes("n") ? Math.max(0, anchorY - h) : anchorY;
      c.w = Math.min(w, 1 - c.x);
      c.h = Math.min(h, 1 - c.y);
    }
    setWorkingCrop(c);
  }

  function cropPointerUp() {
    dragRef.current = null;
  }

  async function save() {
    if (!img || !photo) return;
    setSaving(true);
    setError("");
    // Render at full resolution for the saved copy.
    const full = document.createElement("canvas");
    render(full, img, adjust, geo, null);
    const dataUrl = full.toDataURL("image/jpeg", 0.92);
    const geoTouched =
      geo.rotate90 !== 0 || geo.flipH || geo.flipV || geo.straighten !== 0 || geo.crop !== null;
    const label = preset && preset !== "Original" ? preset : geoTouched ? "edited" : "edited";
    const res = await fetch("/api/editor/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId: photo.id, dataUrl, label }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(json.error || "Could not save");
    setSavedName(json.filename);
    router.refresh();
  }

  if (collections.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-display mb-2">Photo Editor</h1>
        <p className="text-sm text-neutral-500">Upload photos to a collection first, then edit them here.</p>
      </div>
    );
  }

  const geoActive = geo.rotate90 !== 0 || geo.flipH || geo.flipV || geo.straighten !== 0 || geo.crop !== null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display">Photo Editor</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Crop, rotate, straighten, preset filters and adjustments, applied on canvas. Saving creates a new copy
          in the collection, originals are never touched.
        </p>
      </div>

      <div className="grid lg:grid-cols-[280px,1fr] gap-6">
        {/* Picker */}
        <div>
          <label className="label">Collection</label>
          <select
            className="input mb-3"
            value={colId}
            onChange={(e) => {
              setColId(e.target.value);
              setPhoto(null);
            }}
          >
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-1.5 max-h-[60vh] overflow-y-auto pr-1">
            {col?.photos.map((p) => (
              <button
                key={p.id}
                onClick={() => setPhoto(p)}
                className={`relative aspect-square overflow-hidden rounded ${photo?.id === p.id ? "ring-2 ring-neutral-900" : "hover:opacity-80"}`}
                title={p.filename}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.filename} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>

        {/* Canvas + controls */}
        <div>
          {!photo ? (
            <div className="card flex items-center justify-center h-96 text-sm text-neutral-400">
              Pick a photo to start editing.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card p-3 bg-neutral-900 flex items-center justify-center min-h-72">
                {loading ? (
                  <p className="text-sm text-neutral-400 py-24">Loading photo…</p>
                ) : (
                  <div className="relative inline-block" ref={cropFrameRef}>
                    <canvas ref={canvasRef} className="max-w-full max-h-[55vh] block" />
                    {cropMode && (
                      <div
                        className="absolute inset-0 touch-none"
                        onPointerMove={cropPointerMove}
                        onPointerUp={cropPointerUp}
                      >
                        {/* Dimmed outside area */}
                        <div
                          className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] cursor-move"
                          style={{
                            left: `${workingCrop.x * 100}%`,
                            top: `${workingCrop.y * 100}%`,
                            width: `${workingCrop.w * 100}%`,
                            height: `${workingCrop.h * 100}%`,
                          }}
                          onPointerDown={(e) => cropPointerDown(e, "move")}
                        >
                          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                            <span
                              key={corner}
                              onPointerDown={(e) => cropPointerDown(e, corner)}
                              className="absolute h-3.5 w-3.5 bg-white rounded-sm"
                              style={{
                                top: corner.includes("n") ? "-7px" : undefined,
                                bottom: corner.includes("s") ? "-7px" : undefined,
                                left: corner.includes("w") ? "-7px" : undefined,
                                right: corner.includes("e") ? "-7px" : undefined,
                                cursor: corner === "nw" || corner === "se" ? "nwse-resize" : "nesw-resize",
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Geometry toolbar */}
              <div className="card p-3 flex flex-wrap items-center gap-2">
                {!cropMode ? (
                  <>
                    <button className="btn-secondary !py-1 text-xs" onClick={enterCropMode} disabled={!img}>
                      ⬚ Crop
                    </button>
                    <button className="btn-secondary !py-1 text-xs" onClick={rotate} disabled={!img}>
                      ⟳ Rotate 90°
                    </button>
                    <button
                      className={`btn-secondary !py-1 text-xs ${geo.flipH ? "!bg-neutral-900 !text-white" : ""}`}
                      onClick={() => setGeo({ ...geo, flipH: !geo.flipH })}
                      disabled={!img}
                    >
                      ⇋ Flip H
                    </button>
                    <button
                      className={`btn-secondary !py-1 text-xs ${geo.flipV ? "!bg-neutral-900 !text-white" : ""}`}
                      onClick={() => setGeo({ ...geo, flipV: !geo.flipV })}
                      disabled={!img}
                    >
                      ⇵ Flip V
                    </button>
                    {geo.crop && (
                      <button className="btn-secondary !py-1 text-xs" onClick={clearCrop}>
                        Remove crop
                      </button>
                    )}
                    <div className="flex-1 min-w-48 ml-2">
                      <Slider
                        label={`Straighten (${geo.straighten}°)`}
                        min={-15}
                        max={15}
                        value={geo.straighten}
                        onChange={(v) => setGeo({ ...geo, straighten: v })}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-neutral-500 uppercase tracking-wide font-semibold">Crop ratio</span>
                    {ASPECTS.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => pickAspect(a.id)}
                        className={`text-xs px-3 py-1 rounded-full border ${
                          cropAspect === a.id
                            ? "bg-neutral-900 text-white border-neutral-900"
                            : "border-neutral-300 text-neutral-600 hover:border-neutral-500"
                        }`}
                      >
                        {a.name}
                      </button>
                    ))}
                    <span className="flex-1" />
                    <button className="btn-secondary !py-1 text-xs" onClick={() => setCropMode(false)}>
                      Cancel
                    </button>
                    <button className="btn-primary !py-1 text-xs" onClick={applyCrop}>
                      Apply crop
                    </button>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p.name)}
                    className={`text-xs px-3 py-1.5 rounded-full border ${
                      preset === p.name ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-600 hover:border-neutral-500"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <div className="card p-4 grid md:grid-cols-2 gap-x-8 gap-y-3">
                <Slider label="Brightness" min={50} max={150} value={adjust.brightness} onChange={(v) => { setAdjust({ ...adjust, brightness: v }); setPreset(""); }} />
                <Slider label="Contrast" min={50} max={150} value={adjust.contrast} onChange={(v) => { setAdjust({ ...adjust, contrast: v }); setPreset(""); }} />
                <Slider label="Saturation" min={0} max={200} value={adjust.saturation} onChange={(v) => { setAdjust({ ...adjust, saturation: v }); setPreset(""); }} />
                <Slider label="Warmth" min={-50} max={50} value={adjust.warmth} onChange={(v) => { setAdjust({ ...adjust, warmth: v }); setPreset(""); }} />
              </div>

              <div className="flex items-center gap-3">
                <button className="btn-primary" onClick={save} disabled={saving || loading || !img || cropMode}>
                  {saving ? "Saving…" : "Save as copy"}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    applyPreset("Original");
                    setGeo(NEUTRAL_GEO);
                    setCropMode(false);
                  }}
                >
                  Reset
                </button>
                {geoActive && !cropMode && (
                  <span className="text-xs text-neutral-400">
                    {[
                      geo.crop ? "cropped" : "",
                      geo.rotate90 ? `rotated ${geo.rotate90 * 90}°` : "",
                      geo.flipH ? "flipped H" : "",
                      geo.flipV ? "flipped V" : "",
                      geo.straighten ? `straightened ${geo.straighten}°` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
                {savedName && <span className="text-sm text-green-600">Saved as {savedName} ✓</span>}
                {error && <span className="text-sm text-red-600">{error}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-neutral-500 mb-1">
        <span className="font-semibold uppercase tracking-wide">{label}</span>
        <span>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-neutral-900"
      />
    </div>
  );
}

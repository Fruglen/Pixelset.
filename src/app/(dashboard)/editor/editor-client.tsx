"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AI_TOOLS } from "@/lib/ai-tools";
import { useRouter } from "next/navigation";

type Photo = { id: string; url: string; filename: string; setId?: string; raw?: boolean };
type Destination = { id: string; name: string; sets: { id: string; name: string }[] };
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

/**
 * Per-pixel adjustment pass (brightness, contrast, saturation, sepia,
 * grayscale, warmth — applied in that order, matching the CSS filter order
 * this replaced). The editor used to rely on ctx.filter, which Safari
 * (notably older versions on Apple devices) does not support on
 * CanvasRenderingContext2D: there the sliders silently did nothing while
 * the warmth pixel pass kept working. Routing every adjustment through
 * this single pixel pass makes preview and full-res save produce the
 * identical result on every browser.
 */
function applyAdjustments(ctx: CanvasRenderingContext2D, w: number, h: number, a: Adjust) {
  if (
    a.brightness === 100 && a.contrast === 100 && a.saturation === 100 &&
    a.sepia === 0 && a.grayscale === 0 && a.warmth === 0
  ) {
    return; // neutral: leave the drawn pixels untouched
  }
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const bF = a.brightness / 100;
  const cF = a.contrast / 100;
  const s = a.saturation / 100;
  const sep = a.sepia / 100;
  const gry = a.grayscale / 100;
  const shift = a.warmth;
  // saturate() matrix coefficients (feColorMatrix saturate)
  const sr = 0.213 + 0.787 * s, sg = 0.715 - 0.715 * s, sb = 0.072 - 0.072 * s;
  const tr = 0.213 - 0.213 * s, tg = 0.715 + 0.285 * s, tb = 0.072 - 0.072 * s;
  const ur = 0.213 - 0.213 * s, ug = 0.715 - 0.715 * s, ub = 0.072 + 0.928 * s;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i], g = px[i + 1], b = px[i + 2];
    // brightness, then contrast (midpoint 127.5)
    r = (r * bF - 127.5) * cF + 127.5;
    g = (g * bF - 127.5) * cF + 127.5;
    b = (b * bF - 127.5) * cF + 127.5;
    // saturate
    const r2 = r * sr + g * sg + b * sb;
    const g2 = r * tr + g * tg + b * tb;
    const b2 = r * ur + g * ug + b * ub;
    r = r2; g = g2; b = b2;
    // sepia (blend identity -> sepia matrix by amount)
    if (sep > 0) {
      const rS = 0.393 * r + 0.769 * g + 0.189 * b;
      const gS = 0.349 * r + 0.686 * g + 0.168 * b;
      const bS = 0.272 * r + 0.534 * g + 0.131 * b;
      r += (rS - r) * sep;
      g += (gS - g) * sep;
      b += (bS - b) * sep;
    }
    // grayscale (blend identity -> luminance by amount)
    if (gry > 0) {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r += (lum - r) * gry;
      g += (lum - g) * gry;
      b += (lum - b) * gry;
    }
    // warmth (red up / blue down), as the old standalone pass did
    if (shift !== 0) {
      r += shift;
      b -= shift;
    }
    px[i] = r; px[i + 1] = g; px[i + 2] = b; // Uint8ClampedArray clamps + rounds
  }
  ctx.putImageData(data, 0, 0);
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

/** Full pipeline: geometry → crop → adjustment pixel pass. */
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
  ctx.drawImage(geoCanvas, sx, sy, sw, sh, 0, 0, w, h);
  // No ctx.filter anywhere in this pipeline: it is unsupported on older
  // Safari, where the adjustments silently no-oped. applyAdjustments is a
  // pure pixel pass, so the 1400px preview and the full-res save agree.
  applyAdjustments(ctx, w, h, a);
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

export default function EditorClient({ collections, destinations = [], aiConnected = false, aiToolsConnected = false }: { collections: Col[]; destinations?: Destination[]; aiConnected?: boolean; aiToolsConnected?: boolean }) {
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
  // Phase 5B: export destination ("" = same set as the original)
  const [destCol, setDestCol] = useState("");
  const [destSet, setDestSet] = useState("");
  const [newSetName, setNewSetName] = useState("");
  const [newColName, setNewColName] = useState("");
  const [savedWhere, setSavedWhere] = useState<{ collectionId: string; label: string } | null>(null);
  const [error, setError] = useState("");
  const [cropMode, setCropMode] = useState(false);
  const [cropAspect, setCropAspect] = useState("free");
  // Night build: AI suggestions (Gemini), learned style, culling panel
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [aiLocal, setAiLocal] = useState<Adjust | null>(null);
  const [styleInfo, setStyleInfo] = useState<{ pairs: number; adjust: Adjust } | null>(null);
  // Working crop while in crop mode (applied to geo.crop on Apply)
  const [workingCrop, setWorkingCrop] = useState({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropFrameRef = useRef<HTMLDivElement | null>(null);
  // Pro Editor (Photopea) + open-source AI tools
  const [mode, setMode] = useState<"standard" | "pro">("standard");
  const [ppReady, setPpReady] = useState(false);
  const ppFrameRef = useRef<HTMLIFrameElement | null>(null);
  const ppReadyRef = useRef(false);
  const ppOpenedRef = useRef("");
  const ppSaveRef = useRef<((buf: ArrayBuffer) => void) | null>(null);
  const [aiToolBusy, setAiToolBusy] = useState("");
  const [aiToolNote, setAiToolNote] = useState("");
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

  // Photopea embed protocol (photopea.com/api): the iframe posts the
  // string "done" when its API is ready and after each command; the host
  // opens a photo by posting its ArrayBuffer, runs scripts by posting a
  // string, and receives saved files back as ArrayBuffer messages.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== "https://www.photopea.com") return;
      if (e.data === "done") {
        if (!ppReadyRef.current) {
          ppReadyRef.current = true;
          setPpReady(true);
        }
        return;
      }
      if (e.data instanceof ArrayBuffer && ppSaveRef.current) {
        const waiter = ppSaveRef.current;
        ppSaveRef.current = null;
        waiter(e.data);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function openInPhotopea(photoId: string) {
    try {
      const res = await fetch(`/api/editor/photo/${photoId}`);
      if (!res.ok) throw new Error();
      const buf = await res.arrayBuffer();
      ppOpenedRef.current = photoId;
      ppFrameRef.current?.contentWindow?.postMessage(buf, "https://www.photopea.com", [buf]);
    } catch {
      setError("Could not open this photo in the Pro Editor.");
    }
  }

  // Open the selected photo in Photopea when entering Pro mode or when
  // the selection changes while Pro mode is active.
  useEffect(() => {
    if (mode !== "pro" || !ppReady || !photo) return;
    if (ppOpenedRef.current === photo.id) return;
    void openInPhotopea(photo.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ppReady, photo]);

  const applyPreset = useCallback((name: string) => {
    const p = PRESETS.find((x) => x.name === name);
    if (!p) return;
    setPreset(name);
    setAdjust(p.adjust);
  }, []);

  // Learned style: measured average of this photographer's own past edits.
  useEffect(() => {
    fetch("/api/editor/style-profile")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.pairs > 0 && d.adjust) setStyleInfo({ pairs: d.pairs, adjust: { ...NEUTRAL, ...d.adjust } });
      })
      .catch(() => {});
  }, []);

  async function aiSuggest() {
    if (!photo) return;
    setAiBusy(true);
    setAiNote("");
    setAiLocal(null);
    const res = await fetch("/api/editor/ai-suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId: photo.id }),
    });
    const data = await res.json().catch(() => ({}));
    setAiBusy(false);
    if (data.local) setAiLocal({ ...NEUTRAL, ...data.local });
    if (res.ok && data.adjust) {
      setAdjust({ ...NEUTRAL, ...data.adjust });
      setPreset("");
      setAiNote(`AI suggestion applied${data.reason ? `: ${data.reason}` : ""}`);
    } else if (data.aiConnected === false) {
      setAiNote("AI is not connected yet (the server needs its Gemini key), so no AI suggestion was made. The on device suggestion from this photo's measured exposure and colour is ready below if you want it.");
    } else {
      setAiNote(data.error || "AI suggestion failed.");
    }
  }

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
      body: JSON.stringify({
        photoId: photo.id,
        dataUrl,
        label,
        destCollectionId: destCol === "__new" ? "" : destCol,
        destSetId: destSet === "__new" ? "" : destSet,
        newSetName: destSet === "__new" ? newSetName : "",
        newCollectionName: destCol === "__new" ? newColName : "",
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(json.error || "Could not save");
    setSavedName(json.filename);
    setSavedWhere(json.collectionId ? { collectionId: json.collectionId, label: json.destination } : null);
    router.refresh();
  }

  // Pro Editor save round-trip: ask Photopea for the flattened JPEG via
  // its scripting API, then persist the returned bytes through the exact
  // same /api/editor/save flow (and destination choices) as the standard
  // editor. The original photo is never touched.
  async function saveFromPhotopea() {
    if (!photo || !ppReady) return;
    setSaving(true);
    setError("");
    const buf = await new Promise<ArrayBuffer | null>((resolve) => {
      ppSaveRef.current = resolve;
      ppFrameRef.current?.contentWindow?.postMessage(
        'app.activeDocument.saveToOE("jpg:0.92");',
        "https://www.photopea.com"
      );
      setTimeout(() => {
        if (ppSaveRef.current) {
          ppSaveRef.current = null;
          resolve(null);
        }
      }, 30_000);
    });
    if (!buf) {
      setSaving(false);
      return setError("Photopea did not return an image. Make sure a photo is open in the Pro Editor.");
    }
    let binary = "";
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
    }
    const dataUrl = `data:image/jpeg;base64,${btoa(binary)}`;
    const res = await fetch("/api/editor/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photoId: photo.id,
        dataUrl,
        label: "photopea",
        destCollectionId: destCol === "__new" ? "" : destCol,
        destSetId: destSet === "__new" ? "" : destSet,
        newSetName: destSet === "__new" ? newSetName : "",
        newCollectionName: destCol === "__new" ? newColName : "",
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(json.error || "Could not save");
    setSavedName(json.filename);
    setSavedWhere(json.collectionId ? { collectionId: json.collectionId, label: json.destination } : null);
    router.refresh();
  }

  // Open-source AI tools (AI_TOOLS_ENDPOINT). Results save as new copies
  // in the same set as the original; when no endpoint is connected the
  // panel below says so and these never run.
  async function runAiTool(tool: string) {
    if (!photo) return;
    setAiToolBusy(tool);
    setAiToolNote("");
    const res = await fetch("/api/editor/ai-tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId: photo.id, tool }),
    });
    const json = await res.json().catch(() => ({}));
    setAiToolBusy("");
    if (!res.ok) return setAiToolNote(json.error || "The AI tool failed.");
    setAiToolNote(`Saved ${json.filename} to ${json.destination}.`);
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
                {p.raw ? (
                  <span className="absolute bottom-1 left-1 text-[9px] font-semibold tracking-wider bg-black/70 text-white px-1.5 py-0.5 rounded">RAW</span>
                ) : null}
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
              {/* Editor mode: standard canvas tools or the Photopea Pro Editor.
                  Both live behind the same Photo Editor add-on gate. */}
              <div className="card p-2 flex flex-wrap items-center gap-2">
                <button
                  className={`text-xs px-3 py-1.5 rounded-full border ${mode === "standard" ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-600 hover:border-neutral-500"}`}
                  onClick={() => setMode("standard")}
                >
                  Standard editor
                </button>
                <button
                  className={`text-xs px-3 py-1.5 rounded-full border ${mode === "pro" ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-600 hover:border-neutral-500"}`}
                  onClick={() => setMode("pro")}
                >
                  Pro Editor (Photopea)
                </button>
                <span className="text-xs text-neutral-400 ml-1">
                  {mode === "pro" ? "Layers, masks and full retouching in Photopea." : "Quick presets, adjustments, crop and rotate."}
                </span>
              </div>

              <div className={mode === "pro" ? "hidden" : "space-y-4"}>
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

              <div className="flex flex-wrap gap-2 items-center">
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
                {styleInfo ? (
                  <button
                    onClick={() => { setAdjust(styleInfo.adjust); setPreset("Your style"); }}
                    className={`text-xs px-3 py-1.5 rounded-full border ${
                      preset === "Your style" ? "bg-violet-700 text-white border-violet-700" : "border-violet-300 text-violet-700 hover:border-violet-500"
                    }`}
                    title={`Learned from ${styleInfo.pairs} of your past edited photos`}
                  >
                    Your style (learned from {styleInfo.pairs} edits)
                  </button>
                ) : null}
                <span className="flex-1" />
                <button
                  className="btn-secondary !py-1.5 text-xs"
                  onClick={aiSuggest}
                  disabled={aiBusy || !img}
                  title={aiConnected ? "Ask AI for suggested settings for this photo" : "AI is not connected yet"}
                >
                  {aiBusy ? "Thinking…" : "AI suggestions"}
                </button>
              </div>
              {photo?.raw ? (
                <p className="text-xs text-neutral-400">
                  This is a RAW original. You are editing its full size JPEG preview; saving creates a JPEG copy and the RAW file is never changed.
                </p>
              ) : null}
              {aiNote ? (
                <div className="card p-3 text-sm text-neutral-600 space-y-2">
                  <p>{aiNote}</p>
                  {aiLocal ? (
                    <button
                      className="btn-secondary !py-1 text-xs"
                      onClick={() => { setAdjust(aiLocal); setPreset(""); setAiNote("On device suggestion applied."); }}
                    >
                      Use the on device suggestion instead
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="card p-4 grid md:grid-cols-2 gap-x-8 gap-y-3">
                <Slider label="Brightness" min={50} max={150} value={adjust.brightness} onChange={(v) => { setAdjust({ ...adjust, brightness: v }); setPreset(""); }} />
                <Slider label="Contrast" min={50} max={150} value={adjust.contrast} onChange={(v) => { setAdjust({ ...adjust, contrast: v }); setPreset(""); }} />
                <Slider label="Saturation" min={0} max={200} value={adjust.saturation} onChange={(v) => { setAdjust({ ...adjust, saturation: v }); setPreset(""); }} />
                <Slider label="Warmth" min={-50} max={50} value={adjust.warmth} onChange={(v) => { setAdjust({ ...adjust, warmth: v }); setPreset(""); }} />
              </div>

              </div>

              {mode === "pro" ? (
                <div className="card overflow-hidden">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-neutral-100">
                    <p className="text-sm font-medium">Pro Editor, powered by Photopea</p>
                    <span className="text-xs text-neutral-400">
                      {ppReady
                        ? photo
                          ? `Editing ${photo.filename}`
                          : "Pick a photo and it opens here"
                        : "Loading Photopea…"}
                    </span>
                    <span className="flex-1" />
                    <button
                      className="btn-secondary !py-1 text-xs"
                      disabled={!photo || !ppReady}
                      onClick={() => photo && void openInPhotopea(photo.id)}
                    >
                      Reopen original
                    </button>
                  </div>
                  <iframe
                    ref={ppFrameRef}
                    title="Photopea Pro Editor"
                    src="https://www.photopea.com"
                    className="w-full h-[68vh] block bg-white"
                    allow="clipboard-read; clipboard-write"
                  />
                  <p className="px-4 py-2.5 text-xs text-neutral-400 border-t border-neutral-100">
                    Photopea runs entirely in your browser. When you finish, press “Save from Photopea as copy”
                    below: the flattened result is stored as a new photo in the destination chosen below, and the
                    original is never touched.
                  </p>
                </div>
              ) : null}

              <div className="card p-4 flex flex-wrap items-end gap-3">
                <div>
                  <label className="label">Export to gallery</label>
                  <select
                    className="input !w-56"
                    value={destCol}
                    onChange={(e) => {
                      setDestCol(e.target.value);
                      setDestSet("");
                    }}
                  >
                    <option value="">Same set as the original</option>
                    {destinations.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                    <option value="__new">New gallery…</option>
                  </select>
                </div>
                {destCol === "__new" && (
                  <div>
                    <label className="label">New gallery name</label>
                    <input className="input !w-56" value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="Smith Family, edits" />
                  </div>
                )}
                {destCol && destCol !== "__new" && (
                  <div>
                    <label className="label">Set</label>
                    <select className="input !w-48" value={destSet} onChange={(e) => setDestSet(e.target.value)}>
                      <option value="">First set</option>
                      {destinations
                        .find((d) => d.id === destCol)
                        ?.sets.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      <option value="__new">New set…</option>
                    </select>
                  </div>
                )}
                {destSet === "__new" && (
                  <div>
                    <label className="label">New set name</label>
                    <input className="input !w-44" value={newSetName} onChange={(e) => setNewSetName(e.target.value)} placeholder="Edited" />
                  </div>
                )}
                <p className="text-xs text-neutral-400 basis-full">
                  The original is never changed. The edited copy is added to the chosen gallery and set.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {mode === "pro" ? (
                  <button className="btn-primary" onClick={saveFromPhotopea} disabled={saving || !ppReady || !photo}>
                    {saving ? "Saving…" : "Save from Photopea as copy"}
                  </button>
                ) : (
                  <button className="btn-primary" onClick={save} disabled={saving || loading || !img || cropMode}>
                    {saving ? "Saving…" : "Save as copy"}
                  </button>
                )}
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
                {savedName && (
                  <span className="text-sm text-green-600">
                    Saved as {savedName}
                    {savedWhere ? (
                      <>
                        {" "}to{" "}
                        <a className="underline" href={`/collections/${savedWhere.collectionId}`}>
                          {savedWhere.label}
                        </a>
                      </>
                    ) : null}{" "}
                    ✓
                  </span>
                )}
                {error && <span className="text-sm text-red-600">{error}</span>}
              </div>

              {/* Open-source AI tools: wired to AI_TOOLS_ENDPOINT underneath,
                  presented as Coming Soon until an endpoint is connected
                  (owner's call, Nov 19, 2026: the hosting costs money, so the
                  tools stay labelled rather than half-live). */}
              <div className="card p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">AI tools</p>
                  {aiToolsConnected ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">Connected</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Coming Soon</span>
                  )}
                </div>
                {aiToolsConnected ? (
                  <>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {AI_TOOLS.map((t) => (
                        <button
                          key={t.id}
                          className="btn-secondary !py-1.5 text-xs"
                          disabled={!!aiToolBusy || !photo}
                          onClick={() => void runAiTool(t.id)}
                        >
                          {aiToolBusy === t.id ? "Working…" : t.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-neutral-400 mt-2">
                      Results save as new copies in the same set as the original. Object removal currently runs
                      in the endpoint's automatic mode (no mask painting yet).
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-neutral-500 mt-2">
                    Coming soon: background removal, object removal, upscaling and face restore, powered by
                    open source AI. The wiring is already built; the tools switch on as soon as the AI
                    endpoint is connected.
                  </p>
                )}
                {aiToolNote ? <p className="text-sm text-neutral-600 mt-2">{aiToolNote}</p> : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <CullingPanel
        collections={collections}
        aiConnected={aiConnected}
        onOpen={(cId, p) => {
          setColId(cId);
          setPhoto(p);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}

// --------------------------------------------------------------- AI culling
type CullRow = {
  id: string; filename: string; url: string; mediaType: string; starred: boolean;
  score: number; verdict: string; group: number; groupBest: boolean; issues: string[];
  brightness: number; contrast: number; sharpness: number;
};
type AiCall = { verdict: "pick" | "drop" | "keep"; reason: string };

function CullingPanel({
  collections,
  aiConnected,
  onOpen,
}: {
  collections: Col[];
  aiConnected: boolean;
  onOpen: (collectionId: string, photo: Photo) => void;
}) {
  const [cId, setCId] = useState(collections[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [rows, setRows] = useState<CullRow[] | null>(null);
  const [calls, setCalls] = useState<Record<string, AiCall>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [applied, setApplied] = useState("");

  async function analyse() {
    setBusy(true);
    setNote("");
    setApplied("");
    setCalls({});
    const res = await fetch("/api/editor/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId: cId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setNote(data.error || "Analysis failed.");
    const list = data.photos as CullRow[];
    setRows(list);
    setSelected(new Set(list.filter((r) => r.verdict === "keeper" || r.groupBest).map((r) => r.id)));
    setNote(`Analysed ${list.length} photos in ${data.groups} groups (near duplicates share a group; the best frame of each group is marked). Nothing is changed until you star the picks.`);
  }

  async function aiCull() {
    setAiBusy(true);
    setNote("");
    const res = await fetch("/api/editor/ai-cull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionId: cId }),
    });
    const data = await res.json().catch(() => ({}));
    setAiBusy(false);
    if (!res.ok) {
      if (data.aiConnected === false) return setNote("AI is not connected yet (the server needs its Gemini key). The on device analysis above still works: it scores sharpness, exposure and duplicates.");
      return setNote(data.error || "AI culling failed.");
    }
    const aiCalls = data.calls as Record<string, AiCall>;
    setCalls(aiCalls);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const [id, call] of Object.entries(aiCalls)) {
        if (call.verdict === "pick") next.add(id);
        if (call.verdict === "drop") next.delete(id);
      }
      return next;
    });
    setNote("AI culling applied its calls on top of the analysis: picks were selected, drops were deselected. Review before starring.");
  }

  async function applyStars() {
    setBusy(true);
    const res = await fetch("/api/editor/cull-apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ star: Array.from(selected) }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setNote(data.error || "Could not star the picks.");
    setApplied(`Starred ${data.changed} photos. Starred photos show first in your gallery tools.`);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const col = collections.find((c) => c.id === cId);
  return (
    <section className="card p-5 mt-8">
      <div className="flex flex-wrap items-end gap-3 mb-2">
        <div>
          <h2 className="font-medium">AI culling</h2>
          <p className="text-sm text-neutral-500 mt-0.5 max-w-xl">
            Analyse a collection for sharpness, exposure and near duplicates, then let AI pick the strongest
            frame of each moment. You confirm every star.
          </p>
        </div>
        <span className="flex-1" />
        <select className="input !w-56" value={cId} onChange={(e) => { setCId(e.target.value); setRows(null); }}>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button className="btn-secondary" onClick={analyse} disabled={busy || !cId}>{busy ? "Analysing…" : "Analyse collection"}</button>
        <button className="btn-primary" onClick={aiCull} disabled={aiBusy || !rows} title={aiConnected ? "" : "AI is not connected yet"}>
          {aiBusy ? "AI is culling…" : "Ask AI to cull"}
        </button>
      </div>
      {!aiConnected ? (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
          AI is not connected yet, so AI culling and AI suggestions are waiting on the server Gemini key. The on
          device analysis (scores, duplicate groups, best frames) works fully without it.
        </p>
      ) : null}
      {note ? <p className="text-sm text-neutral-600 mb-3">{note}</p> : null}
      {applied ? <p className="text-sm text-emerald-700 mb-3">{applied}</p> : null}
      {rows ? (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-[52vh] overflow-y-auto pr-1">
            {rows.map((r) => {
              const call = calls[r.id];
              const isSel = selected.has(r.id);
              return (
                <div key={r.id} className={`relative rounded overflow-hidden border ${isSel ? "border-violet-600 ring-1 ring-violet-600" : "border-neutral-200"}`}>
                  <button className="block w-full" onClick={() => toggle(r.id)} title={`${r.filename}: click to ${isSel ? "deselect" : "select"} for starring`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.url} alt={r.filename} className="w-full aspect-square object-cover" loading="lazy" />
                  </button>
                  <div className="absolute top-1 left-1 flex gap-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${r.score >= 65 ? "bg-emerald-600 text-white" : r.score >= 40 ? "bg-amber-500 text-white" : "bg-red-600 text-white"}`}>{r.score}</span>
                    {r.groupBest ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-900 text-white">Best of G{r.group + 1}</span> : null}
                  </div>
                  {call ? (
                    <span className={`absolute top-1 right-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${call.verdict === "pick" ? "bg-violet-700 text-white" : call.verdict === "drop" ? "bg-red-700 text-white" : "bg-neutral-700 text-white"}`} title={call.reason}>
                      AI: {call.verdict}
                    </span>
                  ) : null}
                  <div className="px-1.5 py-1 bg-white">
                    <p className="text-[10px] text-neutral-500 truncate">{r.filename}</p>
                    <p className="text-[10px] text-neutral-400 truncate">
                      {r.verdict}{r.issues.length ? ` · ${r.issues.join(", ")}` : ""}{call?.reason ? ` · ${call.reason}` : ""}
                    </p>
                    <button
                      className="text-[10px] underline text-neutral-500"
                      onClick={() => {
                        const p = col?.photos.find((x) => x.id === r.id);
                        if (p) onOpen(cId, p);
                      }}
                    >
                      Open in editor
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button className="btn-primary" onClick={applyStars} disabled={busy || selected.size === 0}>
              Star the selected picks ({selected.size})
            </button>
            <span className="text-xs text-neutral-400">Starring marks the frames you will deliver first. Rejects are never deleted by culling.</span>
          </div>
        </>
      ) : null}
    </section>
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
        className="w-full accent-brand-600"
      />
    </div>
  );
}

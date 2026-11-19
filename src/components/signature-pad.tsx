"use client";

import { useEffect, useRef } from "react";

// Phase 5B: draw-your-signature pad. Pointer events cover mouse, pen and touch,
// so it works on phones and tablets. Emits a PNG data URL (empty when cleared).
export function SignaturePad({ onChange, height = 160 }: { onChange: (dataUrl: string) => void; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    c.width = w * ratio;
    c.height = height * ratio;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1c1c1c";
  }, [height]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    dirty.current = true;
  }

  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (dirty.current && ref.current) onChange(ref.current.toDataURL("image/png"));
  }

  function clear() {
    const c = ref.current;
    if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    onChange("");
  }

  return (
    <div>
      <canvas
        ref={ref}
        style={{ height, touchAction: "none" }}
        className="w-full rounded-md border border-dashed border-neutral-300 bg-white cursor-crosshair"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
        aria-label="Signature drawing area"
      />
      <div className="flex justify-between mt-1 text-xs text-neutral-400">
        <span>Sign with your finger, stylus, or mouse</span>
        <button type="button" className="underline hover:text-neutral-700" onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  );
}

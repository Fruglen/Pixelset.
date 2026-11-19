/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { CSSProperties } from "react";
import { FreeElement, FREEFORM_WIDTH, parseFreeElements } from "@/lib/blocks";
import { siteHref } from "@/lib/site-data";
import { rt, colorValue } from "./rich-text";

// Phase 5B: Flex canvas renderer. Each element carries its own position and
// size (percent of the canvas) and is placed absolutely on tablet and desktop;
// on phones elements stack in reading order (top to bottom).

export function fillValue(fill: string | undefined): string {
  const f = fill || "accent";
  if (f.startsWith("#")) return f;
  return colorValue(f);
}

function videoEmbed(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d{6,})/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

export function FreeElementView({ el, basePath, editing = false }: { el: FreeElement; basePath: string; editing?: boolean }) {
  switch (el.kind) {
    case "text":
      return (
        <div
          className={el.font === "body" ? "" : "site-display"}
          style={{ fontSize: `${el.fontSize ?? 32}px`, lineHeight: 1.15, textAlign: (el.align as CSSProperties["textAlign"]) ?? "left", color: el.color ? fillValue(el.color) : undefined, whiteSpace: "pre-wrap", width: "100%", height: "100%" }}
        >
          {rt(el.text ?? "")}
        </div>
      );
    case "image":
      return el.url ? (
        <img src={el.url} alt={el.alt ?? ""} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="w-full h-full site-muted-bg flex items-center justify-center site-subtle text-xs">Image</div>
      );
    case "video": {
      const url = el.url ?? "";
      const embed = videoEmbed(url);
      if (embed) {
        return editing ? (
          <div className="w-full h-full bg-black/80 text-white text-xs flex items-center justify-center">Video: {url}</div>
        ) : (
          <iframe src={embed} className="w-full h-full" allowFullScreen title="Video" />
        );
      }
      return url ? (
        <video src={url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
      ) : (
        <div className="w-full h-full bg-black/70 text-white text-xs flex items-center justify-center">Video</div>
      );
    }
    case "button": {
      const cls = `site-btn w-full h-full ${el.variant === "outline" ? "site-btn-outline" : ""}`;
      return editing ? (
        <span className={cls}>{el.text}</span>
      ) : (
        <Link href={siteHref(basePath, el.link ?? "")} className={cls}>
          {el.text}
        </Link>
      );
    }
    case "shape": {
      const shape = el.shape ?? "rect";
      if (shape === "line") {
        return <div className="w-full" style={{ height: 0, borderTop: `2px solid ${fillValue(el.fill)}`, marginTop: "50%" }} />;
      }
      return (
        <div
          className="w-full h-full"
          style={{
            background: fillValue(el.fill),
            borderRadius: shape === "circle" ? "9999px" : `${el.radius ?? 0}px`,
          }}
        />
      );
    }
  }
}

export function elementBoxStyle(el: FreeElement): CSSProperties {
  return {
    left: `${el.x}%`,
    top: `${el.y}%`,
    width: `${el.w}%`,
    height: `${el.h}%`,
    transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined,
    zIndex: el.z ?? 1,
    opacity: el.opacity ?? 1,
  };
}

export function FreeformBlock({ props, basePath }: { props: Record<string, unknown>; basePath: string }) {
  const els = parseFreeElements(props.elements).sort((a, b) => a.y - b.y || a.x - b.x);
  const height = Math.max(160, Math.min(2400, Number(props.height) || 560));
  return (
    <section className="px-6 py-6">
      <div className="mx-auto site-free-canvas" style={{ maxWidth: FREEFORM_WIDTH, ["--free-h" as string]: `${height}px` } as CSSProperties}>
        {els.map((el) => {
          const box = elementBoxStyle(el);
          // phones: keep each element's width and aspect, drop absolute position
          const mobileAspect = el.kind === "text" || el.kind === "button" ? undefined : `${(el.w * FREEFORM_WIDTH) / 100} / ${(el.h * height) / 100}`;
          return (
            <div
              key={el.id}
              className="site-free-el"
              style={{ ...box, ["--m-aspect" as string]: mobileAspect } as CSSProperties}
              data-kind={el.kind}
            >
              <FreeElementView el={el} basePath={basePath} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

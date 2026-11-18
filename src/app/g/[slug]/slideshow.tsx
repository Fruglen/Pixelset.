"use client";

import { useEffect, useRef, useState } from "react";
import type { GalleryPhoto } from "./gallery-view";

// Fullscreen autoplay slideshow with optional music (collection setting).
// Crossfades between photos every 4 seconds; space pauses, arrows navigate.
export default function Slideshow({
  photos,
  musicUrl,
  title,
  onClose,
}: {
  photos: GalleryPhoto[];
  musicUrl: string;
  title: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % photos.length), 4000);
    return () => clearInterval(t);
  }, [playing, photos.length]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.play().catch(() => {});
    else audio.pause();
  }, [playing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % photos.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + photos.length) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, photos.length]);

  if (photos.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black">
      {musicUrl && (
        <audio ref={audioRef} src={musicUrl} autoPlay loop muted={muted} className="hidden" />
      )}
      {photos.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.id}
          src={p.url}
          alt={p.filename}
          className="absolute inset-0 w-full h-full object-contain transition-opacity duration-1000"
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}

      <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between text-white/80 bg-gradient-to-b from-black/50 to-transparent">
        <p className="text-sm tracking-widest uppercase">{title}</p>
        <button onClick={onClose} className="hover:text-white text-xl" title="Close (Esc)">
          ✕
        </button>
      </div>

      <div className="absolute bottom-0 inset-x-0 p-4 flex items-center justify-center gap-5 text-white/80 bg-gradient-to-t from-black/50 to-transparent text-sm">
        <button onClick={() => setIndex((index - 1 + photos.length) % photos.length)} className="hover:text-white text-xl">
          ‹
        </button>
        <button onClick={() => setPlaying((p) => !p)} className="hover:text-white text-xl w-8" title="Play / pause (Space)">
          {playing ? "⏸" : "▶"}
        </button>
        <button onClick={() => setIndex((index + 1) % photos.length)} className="hover:text-white text-xl">
          ›
        </button>
        <span className="text-white/50 text-xs w-14 text-center">
          {index + 1} / {photos.length}
        </span>
        {musicUrl && (
          <button onClick={() => setMuted((m) => !m)} className="hover:text-white" title="Toggle music">
            {muted ? "🔇" : "♫"}
          </button>
        )}
      </div>
    </div>
  );
}

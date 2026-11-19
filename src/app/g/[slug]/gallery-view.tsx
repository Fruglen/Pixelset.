"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGalleryStore, type StoreData } from "./store-client";
import Slideshow from "./slideshow";

export type GalleryPhoto = {
  id: string;
  url: string;
  filename: string;
  width: number | null;
  height: number | null;
  isPrivate: boolean;
  mediaType: string; // IMAGE | VIDEO | RAW
  durationSec: number | null;
  posterUrl: string;
  fileSize: number | null;
  starred?: boolean;
  wm?: boolean; // Phase 5B: preview carries the watermark, rendered server side
  pv?: string; // Phase 5B platform: preview rendition version (size-quality)
  maxW?: number; // Phase 5B platform: longest preview edge chosen by the photographer
};

/** Best displayable image source for a media item ("" = none, show a tile). */
function displaySrc(p: GalleryPhoto, width = 1600): string {
  const w = p.maxW ? Math.min(width, p.maxW) : width;
  if (p.wm && (p.mediaType === "IMAGE" || p.posterUrl)) return `/api/wm/${p.id}?w=${w}${p.pv ? `&v=${p.pv}` : ""}`;
  // Phase 5B platform: sized, photographer controlled preview renditions (GIFs keep their animation).
  if (p.mediaType === "IMAGE" && p.pv && p.url && !/\.gif$/i.test(p.url)) return `/api/preview/${p.id}?w=${w}&v=${p.pv}`;
  if (p.mediaType === "IMAGE") return p.url;
  return p.posterUrl;
}

// Phase 5B platform: device aware download help for clients on phones.
type Device = "ios" | "android" | "desktop";
function detectDevice(): Device {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}
function canShareFiles(): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files: [new File([""], "x.jpg", { type: "image/jpeg" })] });
  } catch {
    return false;
  }
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
export type GalleryData = {
  id: string;
  slug: string;
  name: string;
  hideBranding?: boolean; // Night build (Pricing lane): remove branding plan unlock
  eventDate: string | null;
  brand: string;
  brandLogoUrl?: string; // Phase 5B platform: account brand logo
  watermark: boolean;
  watermarkText: string;
  coverStyle: string;
  coverUrl: string;
  coverMediaType: string; // IMAGE | VIDEO, an uploaded video can be the cover
  coverVideoUrl: string;
  focalX: number;
  focalY: number;
  gridStyle: string;
  thumbSize: string;
  gridSpacing: string;
  downloadEnabled: boolean;
  videoDownloadEnabled: boolean;
  pinEnabled: boolean;
  freeDownloadCap: number | null;
  downloadSizes: string[];
  allowSingle: boolean;
  allowZip: boolean;
  isOwner: boolean;
  collectionId: string;
  campaignOptIn: boolean;
  // Final pass: gallery experience switches + coupon banners (Collection fields)
  banners: { id: string; code: string; text: string }[];
  favoritesEnabled: boolean;
  navStyle: string; // text | icons | iconsText
  socialSharing: boolean;
  galleryAssist: boolean;
  emailedDownloadAll: boolean;
  coverAnimation: boolean;
  language: string;
  isQuickShare: boolean;
  quickShareToken: string;
  store: StoreData | null;
  slideshowEnabled: boolean;
  slideshowMusicUrl: string;
  hasExclusiveSets: boolean;
  accessGroup?: { name: string; canDownload: boolean } | null; // Phase 5B platform
  hasAccessGroups?: boolean;
  viewerEmail: string;
  viewerName: string;
  sets: { id: string; name: string; clientExclusive: boolean; photos: GalleryPhoto[] }[];
  comments: { id: string; photoId: string; authorName: string; body: string; createdAt: string }[];
  lists: {
    id: string;
    name: string;
    selectionLimit: number | null;
    submittedAt: string | null;
    favorites: { photoId: string; note: string }[];
  }[];
};

const SIZE_LABELS: Record<string, string> = {
  original: "Original",
  high3600: "High Resolution (3600px)",
  web2048: "Web Size (2048px)",
  web1024: "Web Size (1024px)",
  web640: "Web Size (640px)",
};

function videoEmbedUrl(url: string): string {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&mute=1&loop=1&playlist=${yt[1]}&controls=0`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&muted=1&loop=1&background=1`;
  return "";
}

export default function GalleryView({ data }: { data: GalleryData }) {
  const router = useRouter();
  const [lists, setLists] = useState(data.lists);
  const [comments, setComments] = useState(data.comments);
  const [activeSet, setActiveSet] = useState<string | "all">("all");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [activeListId, setActiveListId] = useState(lists[0]?.id ?? "");
  const [identify, setIdentify] = useState<{ open: boolean; then: (() => void) | null }>({
    open: false,
    then: null,
  });
  const [idEmail, setIdEmail] = useState("");
  const [idName, setIdName] = useState("");
  const [idOptIn, setIdOptIn] = useState(false);
  const [download, setDownload] = useState<{ photoId: string | null; all: boolean; listId?: string } | null>(null);
  const [pin, setPin] = useState("");
  const [dlSize, setDlSize] = useState(data.downloadSizes[0] ?? "original");
  const [dlError, setDlError] = useState("");
  const [dlBusy, setDlBusy] = useState(false);
  const [exclusiveOpen, setExclusiveOpen] = useState(false);
  const [exEmail, setExEmail] = useState("");
  const [exPassword, setExPassword] = useState("");
  const [exError, setExError] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [noteDraftFor, setNoteDraftFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [ownerMsg, setOwnerMsg] = useState("");
  const [ownerBusy, setOwnerBusy] = useState(false);
  // Phase 5B platform: mobile downloads and access groups
  const [device, setDevice] = useState<Device>("desktop");
  const [prepared, setPrepared] = useState<{ file: File; url: string; share: boolean } | null>(null);
  const [dlEmail, setDlEmail] = useState(data.viewerEmail);
  const [dlNeedsEmail, setDlNeedsEmail] = useState(false);
  const [dlParts, setDlParts] = useState<{ part: number; files: number }[] | null>(null);
  const [dlQueued, setDlQueued] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupCode, setGroupCode] = useState("");
  const [groupError, setGroupError] = useState("");
  // Final pass: Gallery Assist dismissal (per gallery, this browser) + share menu
  const [assistOff, setAssistOff] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  useEffect(() => {
    try {
      setAssistOff(localStorage.getItem(`px-assist-${data.id}`) === "1");
    } catch {
      setAssistOff(false);
    }
  }, [data.id]);
  const iconsOnly = data.navStyle === "icons";
  function dismissAssist() {
    setAssistOff(true);
    try {
      localStorage.setItem(`px-assist-${data.id}`, "1");
    } catch {}
  }
  useEffect(() => setDevice(detectDevice()), []);
  const storeApi = useGalleryStore(data.slug, data.store);

  const viewerEmail = data.viewerEmail;

  // Log a gallery view once per mount (skip owner preview)
  useEffect(() => {
    if (!data.isOwner) {
      fetch(`/api/gallery/${data.slug}/view`, { method: "POST" }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleSets = data.sets.filter((s) => s.photos.length > 0);
  const photos = useMemo(
    () =>
      (activeSet === "all" ? visibleSets.flatMap((s) => s.photos) : visibleSets.find((s) => s.id === activeSet)?.photos) ??
      [],
    [activeSet, visibleSets]
  );

  const activeList = lists.find((l) => l.id === activeListId) ?? lists[0] ?? null;
  const favoritedIds = new Set(activeList?.favorites.map((f) => f.photoId) ?? []);

  const requireIdentity = useCallback(
    (then: () => void) => {
      if (viewerEmail) then();
      else setIdentify({ open: true, then });
    },
    [viewerEmail]
  );

  async function submitIdentify(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/gallery/${data.slug}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "identify", email: idEmail, name: idName, optIn: data.campaignOptIn && idOptIn }),
    });
    if (res.ok) {
      setIdentify({ open: false, then: null });
      router.refresh();
    }
  }

  async function createList(name: string, limitStr: string) {
    const res = await fetch(`/api/gallery/${data.slug}/favorites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, selectionLimit: limitStr ? Number(limitStr) : null }),
    });
    if (res.ok) {
      const created = await res.json();
      setLists((prev) => [...prev, { id: created.id, name, selectionLimit: limitStr ? Number(limitStr) : null, submittedAt: null, favorites: [] }]);
      setActiveListId(created.id);
    }
  }

  async function toggleFavorite(photoId: string) {
    requireIdentity(async () => {
      let listId = activeList?.id;
      if (!listId) {
        // Auto-create a first list
        const res = await fetch(`/api/gallery/${data.slug}/favorites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "My Favorites", selectionLimit: null }),
        });
        if (!res.ok) return;
        const created = await res.json();
        listId = created.id as string;
        setLists((prev) => [...prev, { id: listId!, name: "My Favorites", selectionLimit: null, submittedAt: null, favorites: [] }]);
        setActiveListId(listId);
      }
      const res = await fetch(`/api/gallery/lists/${listId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      });
      if (res.ok) {
        const result = await res.json();
        setLists((prev) =>
          prev.map((l) =>
            l.id === listId
              ? {
                  ...l,
                  favorites: result.favorited
                    ? [...l.favorites, { photoId, note: "" }]
                    : l.favorites.filter((f) => f.photoId !== photoId),
                }
              : l
          )
        );
      } else {
        const err = await res.json().catch(() => ({}));
        if (err.error) alert(err.error);
      }
    });
  }

  async function saveNote(listId: string, photoId: string, note: string) {
    await fetch(`/api/gallery/lists/${listId}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId, note }),
    });
    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? { ...l, favorites: l.favorites.map((f) => (f.photoId === photoId ? { ...f, note } : f)) }
          : l
      )
    );
  }

  // Phase 5B: the client marks a list finished; the photographer is notified.
  async function submitList(listId: string, message: string): Promise<string | null> {
    const res = await fetch(`/api/gallery/lists/${listId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return err.error || "Could not send the list";
    }
    const at = new Date().toISOString();
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, submittedAt: at } : l)));
    return null;
  }

  async function postComment(photoId: string) {
    const body = commentDraft.trim();
    if (!body) return;
    requireIdentity(async () => {
      const res = await fetch(`/api/gallery/${data.slug}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, body }),
      });
      if (res.ok) {
        const created = await res.json();
        setComments((prev) => [
          ...prev,
          {
            id: created.id,
            photoId,
            authorName: created.authorName,
            body,
            createdAt: new Date().toISOString(),
          },
        ]);
        setCommentDraft("");
      }
    });
  }

  async function runDownload(opts: { part?: number; email?: boolean } = {}) {
    setDlBusy(true);
    setDlError("");
    const params = new URLSearchParams();
    params.set("slug", data.slug);
    params.set("size", dlSize);
    if (data.pinEnabled) params.set("pin", pin);
    if (data.isQuickShare) params.set("qs", data.quickShareToken);
    if (download?.photoId) params.set("photo", download.photoId);
    if (download?.all) params.set("all", "1");
    if (download?.listId) params.set("list", download.listId);
    if (opts.part) params.set("part", String(opts.part));
    if (opts.email) {
      params.set("email", "1");
      if (dlEmail) params.set("to", dlEmail);
    }

    const res = await fetch(`/api/download?${params.toString()}`);
    setDlBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // Phase 5B platform: phones get the emailed link instead of a ZIP they cannot open.
      if (err.desktopOnly || err.needsEmail) setDlNeedsEmail(true);
      if (Array.isArray(err.parts)) setDlParts(err.parts);
      setDlError(err.error || "Download failed");
      return;
    }
    if (opts.email) {
      const d = await res.json().catch(() => ({}));
      setDlQueued(d.email || dlEmail);
      return;
    }
    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") || "";
    const match = cd.match(/filename="?([^";]+)"?/);
    const name = match?.[1] || (download?.all ? `${data.slug}.zip` : "photo.jpg");
    // Phase 5B platform: on a phone, a single photo is handed to the system
    // share sheet (Save Image puts it in Photos on iOS, Gallery on Android).
    if (device !== "desktop" && !download?.all && (blob.type.startsWith("image/") || blob.type.startsWith("video/"))) {
      const file = new File([blob], name, { type: blob.type });
      setPrepared({ file, url: URL.createObjectURL(blob), share: canShareFiles() });
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    closeDownload();
  }

  function closeDownload() {
    if (prepared) URL.revokeObjectURL(prepared.url);
    setPrepared(null);
    setDownload(null);
    setDlError("");
    setDlNeedsEmail(false);
    setDlParts(null);
    setDlQueued("");
    setPin("");
  }

  async function savePrepared() {
    if (!prepared) return;
    try {
      await navigator.share({ files: [prepared.file], title: prepared.file.name });
      closeDownload();
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setDlError("Your browser could not open the share sheet. Use Open photo and save it from there.");
    }
  }

  async function unlockGroup(e: React.FormEvent) {
    e.preventDefault();
    setGroupError("");
    const res = await fetch(`/api/gallery/${data.slug}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "group", code: groupCode }),
    });
    if (res.ok) {
      setGroupOpen(false);
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      setGroupError(err.error || "Could not use that code");
    }
  }

  async function unlockExclusive(e: React.FormEvent) {
    e.preventDefault();
    setExError("");
    const res = await fetch(`/api/gallery/${data.slug}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "exclusive", email: exEmail, password: exPassword }),
    });
    if (res.ok) {
      setExclusiveOpen(false);
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      setExError(err.error || "Could not unlock");
    }
  }

  // Phase 5B: photographer preview mode actions inside the lightbox.
  async function ownerAction(photo: GalleryPhoto, action: string, extra: Record<string, unknown> = {}) {
    setOwnerBusy(true);
    setOwnerMsg("");
    try {
      let res: Response;
      if (action === "cover") {
        res = await fetch(`/api/collections/${data.collectionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coverPhotoId: photo.id, coverImageUrl: "" }),
        });
      } else {
        res = await fetch(`/api/collections/${data.collectionId}/photos/bulk`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoIds: [photo.id], action, ...extra }),
        });
      }
      const out = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOwnerMsg(out.error || "That action failed");
        return;
      }
      const labels: Record<string, string> = {
        cover: "Set as the collection cover",
        star: extra.value ? "Starred" : "Star removed",
        rename: "Renamed",
        move: "Moved",
        copy: "Copied",
      };
      setOwnerMsg(labels[action] ?? "Done");
      router.refresh();
    } finally {
      setOwnerBusy(false);
    }
  }

  // Keyboard navigation in lightbox
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (lightboxIdx === null) return;
      if (e.key === "Escape") setLightboxIdx(null);
      if (e.key === "ArrowRight") setLightboxIdx((i) => (i === null ? null : Math.min(photos.length - 1, i + 1)));
      if (e.key === "ArrowLeft") setLightboxIdx((i) => (i === null ? null : Math.max(0, i - 1)));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, photos.length]);

  const gapClass = data.gridSpacing === "large" ? "gap-6" : "gap-2";
  const colClass =
    data.gridStyle === "vertical"
      ? data.thumbSize === "large"
        ? "columns-2 md:columns-3"
        : "columns-2 md:columns-4"
      : "";
  const embedUrl = data.coverVideoUrl ? videoEmbedUrl(data.coverVideoUrl) : "";
  const current = lightboxIdx !== null ? photos[lightboxIdx] : null;
  const currentComments = current ? comments.filter((cm) => cm.photoId === current.id) : [];
  const currentFav = current ? favoritedIds.has(current.id) : false;
  const currentNote = current ? activeList?.favorites.find((f) => f.photoId === current.id)?.note ?? "" : "";

  return (
    <div>
      {data.isOwner && !data.isQuickShare && (
        <div className="bg-black/80 text-white text-xs text-center py-1.5">
          Owner preview, you always see this gallery, including private photos and draft status.
        </div>
      )}
      {data.isQuickShare && (
        <div className="text-xs text-center py-1.5" style={{ background: "var(--g-muted)" }}>
          Curated selection shared by {data.brand}
        </div>
      )}

      {/* ---------- COUPON BANNERS ---------- */}
      {data.banners.map((b) => (
        <div key={b.id} className="text-center text-sm py-2 px-4 text-white" style={{ background: "var(--g-accent)" }}>
          {b.text}
        </div>
      ))}

      {/* ---------- COVER ---------- */}
      <div className={data.coverAnimation ? "gallery-cover-anim" : undefined}>
        <Cover data={data} embedUrl={embedUrl} />
      </div>

      {/* ---------- NAV ---------- */}
      <div className="sticky top-0 z-30 border-b" style={{ background: "var(--g-bg)", borderColor: "var(--g-muted)" }}>
        <div className="max-w-6xl mx-auto px-4 flex items-center gap-5 h-12 overflow-x-auto">
          {data.brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.brandLogoUrl} alt={data.brand} className="h-6 max-w-[120px] object-contain shrink-0" />
          ) : (
            <span className="gallery-display text-sm shrink-0 opacity-80">{data.brand}</span>
          )}
          <span className="opacity-20">|</span>
          <button
            onClick={() => setActiveSet("all")}
            className={`text-sm shrink-0 ${activeSet === "all" ? "underline underline-offset-4" : "opacity-60 hover:opacity-100"}`}
          >
            All
          </button>
          {visibleSets.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSet(s.id)}
              className={`text-sm shrink-0 ${activeSet === s.id ? "underline underline-offset-4" : "opacity-60 hover:opacity-100"}`}
            >
              {s.name}
              {s.clientExclusive ? " ✦" : ""}
            </button>
          ))}
          <span className="flex-1" />
          {data.slideshowEnabled && photos.length > 0 && (
            <button onClick={() => setSlideshowOpen(true)} className="text-sm shrink-0 opacity-70 hover:opacity-100">
              ▶{iconsOnly ? "" : " Slideshow"}
            </button>
          )}
          {storeApi.enabled && (
            <button onClick={storeApi.openCart} className="text-sm shrink-0 opacity-70 hover:opacity-100">
              ⬡{iconsOnly ? "" : " Cart"}{storeApi.cartCount > 0 ? ` (${storeApi.cartCount})` : ""}
            </button>
          )}
          {!data.isQuickShare && data.favoritesEnabled && (
            <button onClick={() => setShowFavorites(true)} className="text-sm shrink-0 opacity-70 hover:opacity-100">
              ♥{iconsOnly ? "" : " Favorites"}{lists.length > 0 ? ` (${lists.reduce((n, l) => n + l.favorites.length, 0)})` : ""}
            </button>
          )}
          {data.hasExclusiveSets && !data.isOwner && !data.isQuickShare && (
            <button onClick={() => setExclusiveOpen(true)} className="text-sm shrink-0 opacity-70 hover:opacity-100">
              ✦{iconsOnly ? "" : " Client access"}
            </button>
          )}
          {data.hasAccessGroups && !data.isOwner && !data.isQuickShare && (
            <button onClick={() => setGroupOpen(true)} className="text-sm shrink-0 opacity-70 hover:opacity-100">
              {iconsOnly ? "⚿" : data.accessGroup ? `Viewing as ${data.accessGroup.name}` : "Access code"}
            </button>
          )}
          {data.downloadEnabled && data.allowZip && (
            <button
              onClick={() => setDownload({ photoId: null, all: true })}
              className="text-sm shrink-0 opacity-70 hover:opacity-100"
            >
              ⬇{iconsOnly ? "" : " Download All"}
            </button>
          )}
          {data.socialSharing && !data.isQuickShare && (
            <span className="relative shrink-0">
              <button onClick={() => setShareOpen((v) => !v)} className="text-sm opacity-70 hover:opacity-100">
                ↗{iconsOnly ? "" : " Share"}
              </button>
              {shareOpen && (
                <span className="absolute right-0 top-full mt-1 block w-44 rounded border border-neutral-200 bg-white py-1 text-left shadow-lg z-40" style={{ color: "#262626" }}>
                  <a className="block px-3 py-1.5 text-sm hover:bg-neutral-100" target="_blank" rel="noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}>
                    Facebook
                  </a>
                  <a className="block px-3 py-1.5 text-sm hover:bg-neutral-100" target="_blank" rel="noreferrer" href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}&text=${encodeURIComponent(data.name)}`}>
                    X (Twitter)
                  </a>
                  <a className="block px-3 py-1.5 text-sm hover:bg-neutral-100" target="_blank" rel="noreferrer" href={`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}&description=${encodeURIComponent(data.name)}`}>
                    Pinterest
                  </a>
                  <a className="block px-3 py-1.5 text-sm hover:bg-neutral-100" href={`mailto:?subject=${encodeURIComponent(data.name)}&body=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}>
                    Email
                  </a>
                  <button
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(window.location.href);
                        setShareCopied(true);
                      } catch {}
                    }}
                  >
                    {shareCopied ? "Link copied ✓" : "Copy link"}
                  </button>
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* ---------- GRID ---------- */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        {data.galleryAssist && !data.isOwner && !data.isQuickShare && !assistOff && (
          <div className="mb-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded border p-4" style={{ borderColor: "var(--g-muted)" }}>
                <p className="gallery-display text-base mb-1">⤢ See photos full screen</p>
                <p className="text-sm opacity-70">Tap any photo to view it large, then use the arrows to move through the gallery.</p>
              </div>
              {data.favoritesEnabled && (
                <div className="rounded border p-4" style={{ borderColor: "var(--g-muted)" }}>
                  <p className="gallery-display text-base mb-1">♥ Save your favorites</p>
                  <p className="text-sm opacity-70">Tap the heart on any photo to build a favorites list and send it to {data.brand} when you are done.</p>
                </div>
              )}
              {data.downloadEnabled && (
                <div className="rounded border p-4" style={{ borderColor: "var(--g-muted)" }}>
                  <p className="gallery-display text-base mb-1">⬇ Download your photos</p>
                  <p className="text-sm opacity-70">
                    {data.allowZip ? "Use Download All in the menu above to get the whole gallery as one ZIP file." : "Open a photo and use Download to save it to your device."}
                  </p>
                </div>
              )}
            </div>
            <div className="text-right mt-2">
              <button onClick={dismissAssist} className="text-xs opacity-60 hover:opacity-100 underline underline-offset-2">
                Got it, hide these tips
              </button>
            </div>
          </div>
        )}
        {photos.length === 0 ? (
          <p className="text-center text-sm opacity-60 py-20">No photos here yet.</p>
        ) : data.gridStyle === "vertical" ? (
          <div className={`${colClass} ${gapClass} [column-fill:_balance]`}>
            {photos.map((p, i) => (
              <GridItem
                key={p.id}
                photo={p}
                data={data}
                favorited={favoritedIds.has(p.id)}
                onOpen={() => setLightboxIdx(i)}
                onFavorite={() => toggleFavorite(p.id)}
                onDownload={() => setDownload({ photoId: p.id, all: false })}
                onBuy={storeApi.enabled ? () => storeApi.buy({ ...p, url: displaySrc(p) || p.url }) : null}
                vertical
                spacing={data.gridSpacing}
              />
            ))}
          </div>
        ) : (
          <div
            className={`grid ${gapClass} ${
              data.thumbSize === "large" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2 md:grid-cols-3"
            }`}
          >
            {photos.map((p, i) => (
              <GridItem
                key={p.id}
                photo={p}
                data={data}
                favorited={favoritedIds.has(p.id)}
                onOpen={() => setLightboxIdx(i)}
                onFavorite={() => toggleFavorite(p.id)}
                onDownload={() => setDownload({ photoId: p.id, all: false })}
                onBuy={storeApi.enabled ? () => storeApi.buy({ ...p, url: displaySrc(p) || p.url }) : null}
                vertical={false}
                spacing={data.gridSpacing}
              />
            ))}
          </div>
        )}
      </div>

      <footer className="text-center text-xs opacity-50 pb-10">
        {data.brand}
        {!data.hideBranding && " · Powered by Pixelset"}
      </footer>

      {/* ---------- LIGHTBOX ---------- */}
      {current && (
        <div className="fixed inset-0 z-50 bg-black/95 flex">
          <div className="flex-1 relative flex items-center justify-center p-6">
            {current.mediaType === "VIDEO" ? (
              <video
                key={current.id}
                src={current.url}
                poster={current.posterUrl || undefined}
                controls
                autoPlay
                playsInline
                className="max-h-full max-w-full object-contain"
              />
            ) : current.mediaType === "RAW" && !current.posterUrl ? (
              <div className="text-center text-white/80 space-y-2">
                <span className="inline-block text-xs tracking-widest uppercase border border-white/50 px-3 py-1 rounded">
                  RAW file
                </span>
                <p className="text-sm break-all">{current.filename}</p>
                {current.fileSize ? <p className="text-xs text-white/50">{formatBytes(current.fileSize)}</p> : null}
                <p className="text-xs text-white/50">No preview available. The original file can be downloaded where downloads are enabled.</p>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displaySrc(current, 3200)} alt={current.filename} className="max-h-full max-w-full object-contain" />
            )}
            {data.watermark && current.mediaType === "VIDEO" && (
              <div className="watermark-overlay">
                <span>{data.watermarkText}</span>
              </div>
            )}
            {data.isOwner && !data.isQuickShare && (
              <div className="absolute top-4 left-4 right-16 flex flex-wrap items-center gap-2 text-xs text-white/90">
                <span className="uppercase tracking-widest text-[10px] text-white/50 mr-1">Photographer</span>
                <button
                  className="border border-white/30 rounded px-2 py-1 hover:bg-white/10"
                  disabled={ownerBusy}
                  onClick={() => ownerAction(current, "star", { value: !current.starred })}
                >
                  {current.starred ? "★ Starred" : "☆ Star"}
                </button>
                <button className="border border-white/30 rounded px-2 py-1 hover:bg-white/10" disabled={ownerBusy} onClick={() => ownerAction(current, "cover")}>
                  Set as cover
                </button>
                <button
                  className="border border-white/30 rounded px-2 py-1 hover:bg-white/10"
                  disabled={ownerBusy}
                  onClick={() => {
                    const base = current.filename.replace(/\.[^.]+$/, "");
                    const next = prompt("New file name (the extension is kept):", base);
                    if (next && next.trim() && next.trim() !== base) ownerAction(current, "rename", { pattern: next.trim() });
                  }}
                >
                  Rename
                </button>
                <select
                  className="bg-black/60 border border-white/30 rounded px-1 py-1"
                  value=""
                  disabled={ownerBusy}
                  onChange={(e) => e.target.value && ownerAction(current, "move", { setId: e.target.value })}
                  title="Move to another set"
                >
                  <option value="">Move to…</option>
                  {data.sets.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
                <select
                  className="bg-black/60 border border-white/30 rounded px-1 py-1"
                  value=""
                  disabled={ownerBusy}
                  onChange={(e) => e.target.value && ownerAction(current, "copy", { setId: e.target.value })}
                  title="Copy into a set"
                >
                  <option value="">Copy to…</option>
                  {data.sets.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
                <a
                  className="border border-white/30 rounded px-2 py-1 hover:bg-white/10"
                  href={`/api/download?slug=${encodeURIComponent(data.slug)}&photo=${current.id}&size=original`}
                >
                  Download original
                </a>
                {ownerMsg && <span className="text-emerald-300">{ownerMsg}</span>}
              </div>
            )}
            <button
              className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl"
              onClick={() => setLightboxIdx(null)}
            >
              ✕
            </button>
            {lightboxIdx !== null && lightboxIdx > 0 && (
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl"
                onClick={() => setLightboxIdx(lightboxIdx - 1)}
              >
                ‹
              </button>
            )}
            {lightboxIdx !== null && lightboxIdx < photos.length - 1 && (
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-3xl"
                onClick={() => setLightboxIdx(lightboxIdx + 1)}
              >
                ›
              </button>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 text-white/80 text-sm">
              {!data.isQuickShare && data.favoritesEnabled && (
                <button onClick={() => toggleFavorite(current.id)} className="hover:text-white">
                  {currentFav ? "♥ Favorited" : "♡ Favorite"}
                </button>
              )}
              {storeApi.enabled && (
                <button onClick={() => storeApi.buy({ ...current, url: displaySrc(current) || current.url })} className="hover:text-white">
                  ⬡ Buy
                </button>
              )}
              {data.downloadEnabled &&
                data.allowSingle &&
                (current.mediaType !== "VIDEO" || data.videoDownloadEnabled) && (
                  <button onClick={() => setDownload({ photoId: current.id, all: false })} className="hover:text-white">
                    ⬇ Download
                  </button>
                )}
              <span className="text-white/40">
                {(lightboxIdx ?? 0) + 1} / {photos.length}
              </span>
            </div>
          </div>

          {/* Comments / notes sidebar */}
          {!data.isQuickShare && (
            <aside className="w-80 bg-white flex flex-col max-h-screen">
              <div className="p-4 border-b border-neutral-200">
                <p className="text-sm font-medium truncate">{current.filename}</p>
                {currentFav && activeList && (
                  <div className="mt-2">
                    <p className="label">Note for “{activeList.name}”</p>
                    {noteDraftFor === current.id ? (
                      <div className="flex gap-1">
                        <input
                          className="input !py-1 text-xs"
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          placeholder="e.g. retouch this one"
                          autoFocus
                        />
                        <button
                          className="btn-primary !py-1 !px-2 text-xs"
                          onClick={() => {
                            saveNote(activeList.id, current.id, noteDraft);
                            setNoteDraftFor(null);
                          }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        className="text-xs text-neutral-600 underline"
                        onClick={() => {
                          setNoteDraft(currentNote);
                          setNoteDraftFor(current.id);
                        }}
                      >
                        {currentNote ? `“${currentNote}”, edit` : "+ Add a note"}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <p className="label">Comments ({currentComments.length})</p>
                {currentComments.map((cm) => (
                  <div key={cm.id} className="text-sm">
                    <p className="font-medium text-xs">{cm.authorName}</p>
                    <p className="text-neutral-700">{cm.body}</p>
                  </div>
                ))}
                {currentComments.length === 0 && (
                  <p className="text-xs text-neutral-400">No comments on this photo yet.</p>
                )}
              </div>
              <div className="p-4 border-t border-neutral-200">
                <textarea
                  className="input h-16 text-sm"
                  placeholder="Leave a comment…"
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                />
                <button className="btn-primary w-full mt-2 !py-1.5" onClick={() => postComment(current.id)}>
                  Post Comment
                </button>
              </div>
            </aside>
          )}
        </div>
      )}

      {/* ---------- FAVORITES DRAWER ---------- */}
      {showFavorites && (
        <FavoritesDrawer
          lists={lists}
          activeListId={activeList?.id ?? ""}
          setActiveListId={setActiveListId}
          allPhotos={visibleSets.flatMap((s) => s.photos)}
          onClose={() => setShowFavorites(false)}
          onCreate={(name, limit) => requireIdentity(() => createList(name, limit))}
          onToggle={toggleFavorite}
          onSaveNote={saveNote}
          onSubmit={submitList}
          onDownloadList={(id) => {
            setShowFavorites(false);
            setDownload({ photoId: null, all: true, listId: id });
          }}
          viewerEmail={viewerEmail}
          brand={data.brand}
        />
      )}

      {/* ---------- DOWNLOAD DIALOG ---------- */}
      {download && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-lg sm:rounded-lg p-6 w-full sm:max-w-sm text-ink max-h-[90vh] overflow-y-auto">
            <h3 className="font-display text-lg mb-3">
              {download.all ? "Download All Photos" : "Download Photo"}
            </h3>
            {prepared ? (
              // Phase 5B platform: the photo is ready on the phone, hand it to the system.
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {prepared.file.type.startsWith("image/") && <img src={prepared.url} alt="" className="w-full max-h-60 object-contain rounded bg-neutral-50" />}
                {prepared.share ? (
                  <button className="btn-primary w-full" onClick={savePrepared}>
                    {device === "ios" ? "Save to Photos" : "Save to Gallery"}
                  </button>
                ) : null}
                <a className="btn-secondary w-full text-center block" href={prepared.url} target="_blank" rel="noreferrer" download={device === "ios" ? undefined : prepared.file.name}>
                  Open photo
                </a>
                <p className="text-xs text-neutral-500">
                  {device === "ios"
                    ? prepared.share
                      ? "Tap Save to Photos, then choose Save Image in the share sheet. Or tap Open photo, press and hold the photo and choose Save to Photos."
                      : "Tap Open photo, press and hold the photo and choose Save to Photos (Add to Photos on older iOS)."
                    : prepared.share
                      ? "Tap Save to Gallery and pick where to keep it, or tap Open photo to save it to Downloads, where your Gallery or Photos app finds it."
                      : "Tap Open photo. It saves to Downloads, where your Gallery or Photos app finds it."}
                </p>
                {dlError && <p className="text-sm text-red-600">{dlError}</p>}
                <div className="flex justify-end">
                  <button className="btn-secondary" onClick={closeDownload}>
                    Done
                  </button>
                </div>
              </div>
            ) : dlQueued ? (
              <div className="space-y-3">
                <p className="text-sm text-neutral-700">
                  Your ZIP is being prepared. A download link is on its way to {dlQueued}. Open it on a computer for the
                  easiest download.
                </p>
                <div className="flex justify-end">
                  <button className="btn-secondary" onClick={closeDownload}>
                    Close
                  </button>
                </div>
              </div>
            ) : !data.downloadEnabled ? (
              <p className="text-sm text-neutral-600">
                {data.accessGroup ? `Downloads are not included for ${data.accessGroup.name}.` : "Downloads are disabled for this gallery."}
              </p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const target = download.photoId
                    ? visibleSets.flatMap((s) => s.photos).find((p) => p.id === download.photoId)
                    : null;
                  if (target && target.mediaType !== "IMAGE") {
                    return (
                      <p className="text-xs text-neutral-500">
                        {target.mediaType === "VIDEO" ? "Videos" : "RAW files"} download as the original file.
                      </p>
                    );
                  }
                  return (
                    <div>
                      <label className="label">Size</label>
                      <select className="input" value={dlSize} onChange={(e) => setDlSize(e.target.value)}>
                        {data.downloadSizes.map((s) => (
                          <option key={s} value={s}>
                            {SIZE_LABELS[s] ?? s}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}
                {data.pinEnabled && (
                  <div>
                    <label className="label">4-digit download PIN</label>
                    <input
                      className="input tracking-[0.5em] text-center"
                      maxLength={4}
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="••••"
                    />
                  </div>
                )}
                {data.freeDownloadCap !== null && !data.isOwner && (
                  <p className="text-xs text-neutral-500">
                    This gallery allows {data.freeDownloadCap} free photo downloads per client
                    {download.all ? ", and every photo in a ZIP counts toward that limit." : "."}
                  </p>
                )}
                {device !== "desktop" && (
                  <p className="text-xs text-neutral-500 bg-neutral-50 rounded p-2">
                    {download.all
                      ? device === "ios"
                        ? "On iPhone a ZIP opens in the Files app, not in Photos. For the whole gallery, get the link by email and open it on a computer, or save photos one by one from the photo view."
                        : "On Android a ZIP lands in Downloads and has to be extracted with the Files app. For the whole gallery, getting the link by email and opening it on a computer is easiest."
                      : device === "ios"
                        ? "On iPhone the photo opens in the share sheet so you can save it straight to Photos."
                        : "On Android the photo can go straight to your Gallery through the share sheet, or to Downloads."}
                  </p>
                )}
                {dlParts && (
                  <div className="space-y-1">
                    <p className="text-xs text-neutral-500">Large gallery, choose a part:</p>
                    {dlParts.map((pt) => (
                      <button key={pt.part} className="btn-secondary w-full" disabled={dlBusy} onClick={() => runDownload({ part: pt.part })}>
                        Part {pt.part} ({pt.files} files)
                      </button>
                    ))}
                  </div>
                )}
                {download.all && (dlNeedsEmail || device !== "desktop" || data.emailedDownloadAll) && (
                  <div className="space-y-2">
                    <label className="label">Email me the download link</label>
                    <input className="input" type="email" placeholder="you@example.com" value={dlEmail} onChange={(e) => setDlEmail(e.target.value)} />
                    <button className="btn-secondary w-full" disabled={dlBusy || !dlEmail.includes("@")} onClick={() => runDownload({ email: true })}>
                      Send link
                    </button>
                  </div>
                )}
                {dlError && <p className="text-sm text-red-600">{dlError}</p>}
                <div className="flex justify-end gap-2">
                  <button className="btn-secondary" onClick={closeDownload}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={() => runDownload()} disabled={dlBusy}>
                    {dlBusy ? "Preparing…" : "Download"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- ACCESS GROUP CODE (Phase 5B platform) ---------- */}
      {groupOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={unlockGroup} className="bg-white rounded-lg p-6 w-full max-w-sm text-ink space-y-3">
            <h3 className="font-display text-lg">Access code</h3>
            <p className="text-xs text-neutral-500">
              Vendors, second shooters and family can enter the access code {data.brand} gave them to see their photos and
              download options.
            </p>
            <input className="input font-mono" placeholder="Access code" value={groupCode} onChange={(e) => setGroupCode(e.target.value)} required />
            {groupError && <p className="text-sm text-red-600">{groupError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setGroupOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary">Continue</button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- IDENTIFY DIALOG ---------- */}
      {identify.open && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={submitIdentify} className="bg-white rounded-lg p-6 w-full max-w-sm text-ink space-y-3">
            <h3 className="font-display text-lg">Who’s choosing?</h3>
            <p className="text-xs text-neutral-500">
              Enter your email so {data.brand} knows whose favorites and comments these are.
            </p>
            <input className="input" placeholder="Your name" value={idName} onChange={(e) => setIdName(e.target.value)} />
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={idEmail}
              onChange={(e) => setIdEmail(e.target.value)}
              required
            />
            {data.campaignOptIn && (
              <label className="flex items-start gap-2 text-xs text-neutral-600">
                <input type="checkbox" className="mt-0.5 accent-neutral-900" checked={idOptIn} onChange={(e) => setIdOptIn(e.target.checked)} />
                <span>Keep me posted about print sales, mini sessions and offers from {data.brand}. Unsubscribe any time.</span>
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setIdentify({ open: false, then: null })}>
                Cancel
              </button>
              <button className="btn-primary">Continue</button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- SLIDESHOW (image items; videos and bare RAW files are skipped) ---------- */}
      {slideshowOpen && (
        <Slideshow
          photos={photos
            .filter((p) => displaySrc(p))
            .map((p) => ({ ...p, url: displaySrc(p, 2048) }))}
          musicUrl={data.slideshowMusicUrl}
          title={data.name}
          onClose={() => setSlideshowOpen(false)}
        />
      )}

      {/* ---------- STORE (buy dialog / cart / checkout) ---------- */}
      {storeApi.element}

      {/* ---------- CLIENT EXCLUSIVE UNLOCK ---------- */}
      {exclusiveOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={unlockExclusive} className="bg-white rounded-lg p-6 w-full max-w-sm text-ink space-y-3">
            <h3 className="font-display text-lg">Client Exclusive Access</h3>
            <p className="text-xs text-neutral-500">
              Some sets in this gallery are reserved for a specific client. Enter the email and access
              password {data.brand} gave you.
            </p>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={exEmail}
              onChange={(e) => setExEmail(e.target.value)}
              required
            />
            <input
              className="input"
              type="password"
              placeholder="Access password"
              value={exPassword}
              onChange={(e) => setExPassword(e.target.value)}
              required
            />
            {exError && <p className="text-sm text-red-600">{exError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setExclusiveOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary">Unlock</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Cover({ data, embedUrl }: { data: GalleryData; embedUrl: string }) {
  if (data.coverStyle === "none") {
    return (
      <div className="max-w-6xl mx-auto px-4 pt-12 pb-4">
        <h1 className="gallery-display text-4xl">{data.name}</h1>
        {data.eventDate && (
          <p className="text-sm opacity-60 mt-1">{new Date(data.eventDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        )}
      </div>
    );
  }

  const focal = { objectPosition: `${data.focalX * 100}% ${data.focalY * 100}%` };
  const dateStr = data.eventDate
    ? new Date(data.eventDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "";

  const media = embedUrl ? (
    <iframe
      src={embedUrl}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ transform: "scale(1.4)" }}
      allow="autoplay; fullscreen"
      title="Cover video"
    />
  ) : data.coverMediaType === "VIDEO" && data.coverUrl ? (
    <video
      src={data.coverUrl}
      className="absolute inset-0 w-full h-full object-cover"
      style={focal}
      autoPlay
      muted
      loop
      playsInline
    />
  ) : data.coverUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={data.coverUrl} alt={data.name} className="absolute inset-0 w-full h-full object-cover" style={focal} />
  ) : (
    <div className="absolute inset-0" style={{ background: "var(--g-muted)" }} />
  );

  const titleBlock = (dark: boolean) => (
    <div className={dark ? "text-white" : ""}>
      <h1 className="gallery-display text-4xl md:text-6xl leading-tight">{data.name}</h1>
      {dateStr && <p className="text-sm tracking-widest uppercase mt-3 opacity-80">{dateStr}</p>}
      <a
        href="#grid"
        onClick={(e) => {
          e.preventDefault();
          window.scrollTo({ top: window.innerHeight * 0.8, behavior: "smooth" });
        }}
        className={`inline-block mt-6 border px-5 py-2 text-xs tracking-widest uppercase hover:opacity-70 ${
          dark ? "border-white/70" : ""
        }`}
        style={dark ? {} : { borderColor: "var(--g-text)" }}
      >
        View Gallery
      </a>
    </div>
  );

  switch (data.coverStyle) {
    case "novel":
      return (
        <div className="relative h-[85vh] overflow-hidden flex items-center justify-center text-center">
          {media}
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative z-10">{titleBlock(true)}</div>
        </div>
      );
    case "frame":
      return (
        <div className="p-6 md:p-10">
          <div className="relative h-[75vh] overflow-hidden flex items-center justify-center text-center border-8" style={{ borderColor: "var(--g-muted)" }}>
            {media}
            <div className="absolute inset-0 bg-black/25" />
            <div className="relative z-10">{titleBlock(true)}</div>
          </div>
        </div>
      );
    case "stripe":
      return (
        <div className="grid md:grid-cols-2 min-h-[70vh]">
          <div className="flex items-center justify-center p-10 order-2 md:order-1">{titleBlock(false)}</div>
          <div className="relative h-[40vh] md:h-auto overflow-hidden order-1 md:order-2">{media}</div>
        </div>
      );
    case "journal":
      return (
        <div>
          <div className="relative h-[60vh] overflow-hidden">{media}</div>
          <div className="text-center py-12 px-4">{titleBlock(false)}</div>
        </div>
      );
    case "divider":
      return (
        <div className="relative h-[85vh] overflow-hidden flex items-center justify-center text-center">
          {media}
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative z-10 text-white">
            <div className="w-24 h-px bg-white/70 mx-auto mb-6" />
            {titleBlock(true)}
            <div className="w-24 h-px bg-white/70 mx-auto mt-6" />
          </div>
        </div>
      );
    case "vintage":
      return (
        <div className="px-6 pt-14 pb-10 md:pt-20 text-center" style={{ background: "var(--g-muted)" }}>
          <div className="mx-auto max-w-3xl bg-white p-3 md:p-4 shadow-sm">
            <div className="relative h-[55vh] overflow-hidden">{media}</div>
          </div>
          <div className="mt-10">
            <p className="text-[11px] tracking-[0.4em] uppercase opacity-60 mb-3">{data.brand}</p>
            {titleBlock(false)}
          </div>
        </div>
      );
    default: // classic
      return (
        <div className="relative h-[85vh] overflow-hidden flex items-end">
          {media}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="relative z-10 p-10">{titleBlock(true)}</div>
        </div>
      );
  }
}

function GridItem({
  photo,
  data,
  favorited,
  onOpen,
  onFavorite,
  onDownload,
  onBuy,
  vertical,
  spacing,
}: {
  photo: GalleryPhoto;
  data: GalleryData;
  favorited: boolean;
  onOpen: () => void;
  onFavorite: () => void;
  onDownload: () => void;
  onBuy: (() => void) | null;
  vertical: boolean;
  spacing: string;
}) {
  return (
    <div
      className={`relative group cursor-pointer overflow-hidden ${vertical ? "break-inside-avoid" : ""} ${
        spacing === "large" ? "mb-6" : "mb-2"
      }`}
      onClick={onOpen}
    >
      {photo.mediaType === "VIDEO" ? (
        <div className={vertical ? "" : "aspect-[3/2]"}>
          <video
            src={photo.url}
            poster={photo.posterUrl || undefined}
            controls
            preload="metadata"
            playsInline
            className={`w-full ${vertical ? "" : "h-full object-cover"}`}
            onClick={(e) => e.stopPropagation()}
          />
          <span className="absolute top-2 left-2 text-[10px] tracking-wide uppercase bg-black/60 text-white px-1.5 py-0.5 rounded pointer-events-none">
            Video{photo.durationSec ? ` · ${formatDuration(photo.durationSec)}` : ""}
          </span>
        </div>
      ) : photo.mediaType === "RAW" && !photo.posterUrl ? (
        <div
          className={`w-full ${vertical ? "aspect-[3/2]" : "aspect-[3/2]"} flex flex-col items-center justify-center gap-1 text-center px-3`}
          style={{ background: "var(--g-muted)" }}
        >
          <span className="text-[10px] tracking-widest uppercase border px-2 py-0.5 rounded" style={{ borderColor: "var(--g-text)" }}>
            RAW
          </span>
          <span className="text-xs opacity-80 break-all">{photo.filename}</span>
          {photo.fileSize ? <span className="text-[10px] opacity-50">{formatBytes(photo.fileSize)}</span> : null}
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displaySrc(photo, 800)}
            alt={photo.filename}
            loading="lazy"
            className={`w-full ${vertical ? "" : "aspect-[3/2] object-cover"} transition-transform duration-500 group-hover:scale-[1.02]`}
          />
          {photo.mediaType === "RAW" && (
            <span className="absolute top-2 left-2 text-[10px] tracking-wide uppercase bg-black/60 text-white px-1.5 py-0.5 rounded pointer-events-none">
              RAW
            </span>
          )}
        </>
      )}
      {data.watermark && photo.mediaType === "VIDEO" && (
        <div className="watermark-overlay">
          <span>{data.watermarkText}</span>
        </div>
      )}
      <div
        className={`absolute inset-x-0 ${
          photo.mediaType === "VIDEO"
            ? "top-0 bg-gradient-to-b" // keep the native video controls at the bottom usable
            : "bottom-0 bg-gradient-to-t"
        } from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-3 p-3 text-white text-lg`}
      >
        {!data.isQuickShare && data.favoritesEnabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavorite();
            }}
            title="Favorite"
            className="hover:scale-110 transition-transform"
          >
            {favorited ? "♥" : "♡"}
          </button>
        )}
        {onBuy && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBuy();
            }}
            title="Buy this photo"
            className="hover:scale-110 transition-transform"
          >
            ⬡
          </button>
        )}
        {data.downloadEnabled &&
          data.allowSingle &&
          (photo.mediaType !== "VIDEO" || data.videoDownloadEnabled) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              title="Download"
              className="hover:scale-110 transition-transform"
            >
              ⬇
            </button>
          )}
      </div>
      {favorited && <span className="absolute top-2 right-2 text-white drop-shadow">♥</span>}
    </div>
  );
}

function FavoritesDrawer({
  lists,
  activeListId,
  setActiveListId,
  allPhotos,
  onClose,
  onCreate,
  onToggle,
  onSaveNote,
  onSubmit,
  onDownloadList,
  viewerEmail,
  brand,
}: {
  lists: GalleryData["lists"];
  activeListId: string;
  setActiveListId: (id: string) => void;
  allPhotos: GalleryPhoto[];
  onClose: () => void;
  onCreate: (name: string, limit: string) => void;
  onToggle: (photoId: string) => void;
  onSaveNote: (listId: string, photoId: string, note: string) => void;
  onSubmit: (listId: string, message: string) => Promise<string | null>;
  onDownloadList: (listId: string) => void;
  viewerEmail: string;
  brand: string;
}) {
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitErr, setSubmitErr] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLimit, setNewLimit] = useState("");
  const [creating, setCreating] = useState(false);
  const active = lists.find((l) => l.id === activeListId) ?? lists[0] ?? null;
  const photoById = new Map(allPhotos.map((p) => [p.id, p]));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="w-full max-w-md bg-white h-full overflow-y-auto text-ink p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">Favorite Lists</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900">
            ✕
          </button>
        </div>

        {!viewerEmail && lists.length === 0 && (
          <p className="text-xs text-neutral-500 mb-3">
            Heart a photo or create a list, you’ll be asked for your email so the photographer knows
            whose picks these are.
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {lists.map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveListId(l.id)}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                active?.id === l.id
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "border-neutral-300 text-neutral-600"
              }`}
            >
              {l.name} ({l.favorites.length}
              {l.selectionLimit ? `/${l.selectionLimit}` : ""}){l.submittedAt ? " ✓" : ""}
            </button>
          ))}
          <button
            onClick={() => setCreating((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-full border border-dashed border-neutral-400 text-neutral-500"
          >
            + New list
          </button>
        </div>

        {creating && (
          <form
            className="card p-3 mb-4 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              onCreate(newName.trim(), newLimit);
              setNewName("");
              setNewLimit("");
              setCreating(false);
            }}
          >
            <input
              className="input"
              placeholder="List name (e.g. Album picks)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <input
              className="input"
              type="number"
              min={1}
              placeholder="Selection limit (optional)"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
            />
            <button className="btn-primary w-full !py-1.5">Create List</button>
          </form>
        )}

        {active ? (
          <>
            {active.submittedAt ? (
              <p className="text-xs bg-emerald-50 text-emerald-700 rounded p-2 mb-3">
                Sent to {brand} on {new Date(active.submittedAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. This
                list is locked, ask {brand} to reopen it if you want to change your picks.
              </p>
            ) : active.favorites.length > 0 ? (
              submitOpen ? (
                <div className="card p-3 mb-3 space-y-2">
                  <p className="text-xs text-neutral-600">
                    Send “{active.name}” ({active.favorites.length} photos) to {brand}. They will be notified, and the list is
                    locked after sending.
                  </p>
                  <textarea
                    className="input h-16 text-xs"
                    placeholder="Message for your photographer (optional)"
                    value={submitMsg}
                    onChange={(e) => setSubmitMsg(e.target.value)}
                  />
                  {submitErr && <p className="text-xs text-red-600">{submitErr}</p>}
                  <div className="flex gap-2 justify-end">
                    <button className="btn-secondary !py-1 text-xs" onClick={() => setSubmitOpen(false)}>
                      Cancel
                    </button>
                    <button
                      className="btn-primary !py-1 text-xs"
                      disabled={submitBusy}
                      onClick={async () => {
                        setSubmitBusy(true);
                        setSubmitErr("");
                        const e = await onSubmit(active.id, submitMsg.trim());
                        setSubmitBusy(false);
                        if (e) setSubmitErr(e);
                        else {
                          setSubmitOpen(false);
                          setSubmitMsg("");
                        }
                      }}
                    >
                      {submitBusy ? "Sending…" : "Send to photographer"}
                    </button>
                  </div>
                </div>
              ) : (
                <button className="btn-primary w-full !py-1.5 text-xs mb-3" onClick={() => setSubmitOpen(true)}>
                  I’m done, send this list to {brand}
                </button>
              )
            ) : null}
            {active.favorites.length > 0 && (
              <button className="btn-secondary w-full !py-1.5 text-xs mb-3" onClick={() => onDownloadList(active.id)}>
                ⬇ Download all {active.favorites.length} photos in this list
              </button>
            )}
            {active.selectionLimit && (
              <p className="text-xs text-neutral-500 mb-2">
                {active.favorites.length} of {active.selectionLimit} selections used.
              </p>
            )}
            {active.favorites.length === 0 ? (
              <p className="text-sm text-neutral-400">
                No favorites in this list yet, hover a photo and tap the heart.
              </p>
            ) : (
              <div className="space-y-3">
                {active.favorites.map((f) => {
                  const p = photoById.get(f.photoId);
                  if (!p) return null;
                  return (
                    <div key={f.photoId} className="flex gap-3 items-start">
                      {displaySrc(p) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={displaySrc(p)} alt="" className="h-16 w-16 object-cover rounded" />
                      ) : (
                        <div className="h-16 w-16 rounded bg-neutral-100 flex items-center justify-center text-[9px] tracking-widest text-neutral-500">
                          {p.mediaType}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.filename}</p>
                        {active.submittedAt ? (
                          f.note ? <p className="text-xs text-neutral-500">“{f.note}”</p> : null
                        ) : (
                          <NoteEditor note={f.note} onSave={(note) => onSaveNote(active.id, f.photoId, note)} />
                        )}
                      </div>
                      {!active.submittedAt && (
                        <button className="text-xs text-red-500 hover:underline shrink-0" onClick={() => onToggle(f.photoId)}>
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-neutral-400">Create a list to start selecting photos.</p>
        )}
      </aside>
    </div>
  );
}

function NoteEditor({ note, onSave }: { note: string; onSave: (note: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  if (!editing) {
    return (
      <button className="text-xs text-neutral-500 underline text-left" onClick={() => setEditing(true)}>
        {note ? `“${note}”` : "+ Add note"}
      </button>
    );
  }
  return (
    <div className="flex gap-1 mt-1">
      <input className="input !py-1 text-xs" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
      <button
        className="btn-primary !py-1 !px-2 text-xs"
        onClick={() => {
          onSave(draft);
          setEditing(false);
        }}
      >
        Save
      </button>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

type PhotoItem = {
  id: string;
  url: string;
  filename: string;
  isPrivate: boolean;
  isExternal: boolean;
  mediaType: string;
  posterUrl: string;
  durationSec: number | null;
  fileSize: number | null;
};
type SetItem = {
  id: string;
  name: string;
  clientExclusive: boolean;
  clientEmail: string;
  externalSource: string;
  externalSyncedAt: string;
  photos: PhotoItem[];
};

const UPLOAD_ACCEPT =
  "image/*,video/mp4,video/quicktime,video/x-m4v,.mp4,.mov,.m4v,.cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.rw2";

function fmtDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Thumb({ p }: { p: PhotoItem }) {
  if (p.mediaType === "VIDEO") {
    return (
      <div className="w-full h-full relative bg-neutral-900">
        {p.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.posterUrl} alt={p.filename} className="w-full h-full object-cover opacity-80" loading="lazy" />
        ) : null}
        <span className="absolute inset-0 flex items-center justify-center text-white/90 text-2xl">▶</span>
        <span className="absolute bottom-1 right-1 text-[9px] bg-black/70 text-white px-1 rounded">
          VIDEO{p.durationSec ? ` ${fmtDuration(p.durationSec)}` : ""}
        </span>
      </div>
    );
  }
  if (p.mediaType === "RAW") {
    return (
      <div className="w-full h-full relative bg-neutral-100">
        {p.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.posterUrl} alt={p.filename} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-neutral-400 px-2 text-center">
            <span className="text-[10px] tracking-widest border border-neutral-300 px-1.5 rounded">RAW</span>
            <span className="text-[9px]">{fmtBytes(p.fileSize)}</span>
          </div>
        )}
        <span className="absolute bottom-1 right-1 text-[9px] bg-black/70 text-white px-1 rounded">RAW</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.url} alt={p.filename} className="w-full h-full object-cover" loading="lazy" />
  );
}

export default function PhotosClient({
  collection,
  sets,
  quickShares,
  invites,
}: {
  collection: { id: string; slug: string; coverPhotoId: string | null; status: string };
  sets: SetItem[];
  quickShares: { id: string; token: string; count: number }[];
  invites: { id: string; email: string; createdAt: string }[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [targetSet, setTargetSet] = useState(sets[0]?.id ?? "");
  const [uploading, setUploading] = useState(false);
  const [urlText, setUrlText] = useState("");
  const [showUrlBox, setShowUrlBox] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showShare, setShowShare] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteSent, setInviteSent] = useState("");
  const [copied, setCopied] = useState("");
  const [newSetName, setNewSetName] = useState("");
  const [addingSet, setAddingSet] = useState(false);
  const [editingSet, setEditingSet] = useState<string | null>(null);
  const [showPicflow, setShowPicflow] = useState(false);
  const [picflowUrl, setPicflowUrl] = useState("");
  const [picflowSet, setPicflowSet] = useState("");
  const [picflowNewSet, setPicflowNewSet] = useState("Picflow Gallery");
  const [picflowBusy, setPicflowBusy] = useState(false);
  const [picflowResult, setPicflowResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncBusy, setSyncBusy] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");

  const shareOpen = showShare;
  useEffect(() => {
    if (!shareOpen) return;
    const url = `${window.location.origin}/g/${collection.slug}`;
    QRCode.toDataURL(url, { width: 224, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [shareOpen, collection.slug]);

  async function linkPicflow() {
    if (!/^https?:\/\//.test(picflowUrl.trim())) {
      setPicflowResult({ ok: false, message: "Paste a full gallery URL (https://…)" });
      return;
    }
    setPicflowBusy(true);
    setPicflowResult(null);
    try {
      const res = await fetch(`/api/collections/${collection.id}/picflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: picflowUrl.trim(),
          setId: picflowSet || undefined,
          newSetName: picflowSet ? undefined : picflowNewSet.trim() || "Picflow Gallery",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPicflowResult({ ok: false, message: data.error || "The gallery could not be linked" });
      } else {
        setPicflowResult({
          ok: true,
          message: `Linked. ${data.added} photo${data.added === 1 ? "" : "s"} added${
            data.skipped ? `, ${data.skipped} already linked` : ""
          }.`,
        });
        setPicflowUrl("");
        router.refresh();
      }
    } finally {
      setPicflowBusy(false);
    }
  }

  async function syncPicflow(setId: string) {
    setSyncBusy(setId);
    try {
      const res = await fetch(`/api/collections/${collection.id}/picflow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId, sync: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(data.error || "Sync failed");
      else alert(`Sync complete. ${data.added} new photo${data.added === 1 ? "" : "s"} added, ${data.skipped} already present.`);
      router.refresh();
    } finally {
      setSyncBusy("");
    }
  }

  const galleryUrl =
    typeof window !== "undefined" ? `${window.location.origin}/g/${collection.slug}` : `/g/${collection.slug}`;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0 || !targetSet) return;
    setUploading(true);
    const form = new FormData();
    form.append("setId", targetSet);
    Array.from(files).forEach((f) => form.append("files", f));
    await fetch(`/api/collections/${collection.id}/photos`, { method: "POST", body: form });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  async function addByUrl() {
    const urls = urlText
      .split(/\s+/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//.test(u));
    if (urls.length === 0 || !targetSet) return;
    setUploading(true);
    await fetch(`/api/collections/${collection.id}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: targetSet, urls }),
    });
    setUploading(false);
    setUrlText("");
    setShowUrlBox(false);
    router.refresh();
  }

  async function addSet(e: React.FormEvent) {
    e.preventDefault();
    if (!newSetName.trim()) return;
    await fetch(`/api/collections/${collection.id}/sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSetName.trim() }),
    });
    setNewSetName("");
    setAddingSet(false);
    router.refresh();
  }

  async function patchSet(id: string, data: Record<string, unknown>) {
    await fetch(`/api/sets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    router.refresh();
  }

  async function deleteSet(id: string) {
    if (!confirm("Delete this set and all photos in it?")) return;
    await fetch(`/api/sets/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function patchPhoto(id: string, data: Record<string, unknown>) {
    await fetch(`/api/photos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    router.refresh();
  }

  async function deletePhoto(id: string) {
    if (!confirm("Delete this photo?")) return;
    await fetch(`/api/photos/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function setCover(photoId: string) {
    await fetch(`/api/collections/${collection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverPhotoId: photoId }),
    });
    router.refresh();
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/collections/${collection.id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, message: inviteMessage }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      setInviteSent(
        data.delivered
          ? `Invite delivered to ${inviteEmail} via Resend`
          : data.deliveryError
            ? `Invite to ${inviteEmail} logged, but sending failed: ${data.deliveryError}`
            : `Invite to ${inviteEmail} logged (no email service connected)`
      );
      setInviteEmail("");
      setInviteMessage("");
      router.refresh();
    }
  }

  async function createQuickShare() {
    if (selected.size === 0) {
      alert("Select photos first (checkboxes on thumbnails), then create a Quick Share Link.");
      return;
    }
    const res = await fetch(`/api/collections/${collection.id}/quick-share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoIds: Array.from(selected) }),
    });
    if (res.ok) {
      setSelected(new Set());
      router.refresh();
    }
  }

  function copy(text: string, tag: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(tag);
      setTimeout(() => setCopied(""), 1500);
    });
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select className="input !w-auto" value={targetSet} onChange={(e) => setTargetSet(e.target.value)}>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              Upload to: {s.name}
            </option>
          ))}
        </select>
        <input
          ref={fileRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files)}
        />
        <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading || !targetSet}>
          {uploading ? "Uploading…" : "⬆ Upload Media"}
        </button>
        <button className="btn-secondary" onClick={() => setShowUrlBox((v) => !v)} disabled={!targetSet}>
          + Add by URL
        </button>
        <button className="btn-secondary" onClick={() => setShowPicflow((v) => !v)}>
          Link a Picflow gallery
        </button>
        <button className="btn-secondary" onClick={() => setShowShare(true)}>
          Share
        </button>
        {selected.size > 0 && (
          <button className="btn-secondary" onClick={createQuickShare}>
            Quick Share {selected.size} selected
          </button>
        )}
      </div>

      {showPicflow && (
        <div className="card p-4 mb-6 space-y-3">
          <div>
            <p className="font-medium text-sm">Link a Picflow gallery</p>
            <p className="text-xs text-neutral-500">
              Paste a public Picflow gallery URL (e.g. https://glenfru.picflow.com/…). The photos stay hosted
              on Picflow; Pixelset stores only external references, no copies.
            </p>
          </div>
          <div>
            <label className="label">Gallery URL</label>
            <input
              className="input font-mono text-xs"
              value={picflowUrl}
              onChange={(e) => setPicflowUrl(e.target.value)}
              placeholder="https://yourname.picflow.com/your-gallery"
            />
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className="label">Add into</label>
              <select className="input !w-auto" value={picflowSet} onChange={(e) => setPicflowSet(e.target.value)}>
                <option value="">New set…</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {!picflowSet && (
              <div>
                <label className="label">New set name</label>
                <input
                  className="input !w-56"
                  value={picflowNewSet}
                  onChange={(e) => setPicflowNewSet(e.target.value)}
                />
              </div>
            )}
            <button className="btn-primary" onClick={linkPicflow} disabled={picflowBusy}>
              {picflowBusy ? "Fetching gallery…" : "Link Gallery"}
            </button>
          </div>
          {picflowResult && (
            <p className={`text-sm ${picflowResult.ok ? "text-emerald-600" : "text-red-600"}`}>
              {picflowResult.message}
            </p>
          )}
        </div>
      )}

      {showUrlBox && (
        <div className="card p-4 mb-6">
          <label className="label">Photo URLs (one per line)</label>
          <textarea
            className="input h-24 font-mono text-xs"
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            placeholder={"https://example.com/photo-1.jpg\nhttps://example.com/photo-2.jpg"}
          />
          <div className="flex justify-end mt-2">
            <button className="btn-primary" onClick={addByUrl} disabled={uploading}>
              Add Photos
            </button>
          </div>
        </div>
      )}

      {/* Sets */}
      {sets.map((set) => (
        <section key={set.id} className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            {editingSet === set.id ? (
              <input
                className="input !w-64"
                defaultValue={set.name}
                autoFocus
                onBlur={(e) => {
                  patchSet(set.id, { name: e.target.value });
                  setEditingSet(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            ) : (
              <h3
                className="font-display text-lg cursor-pointer"
                title="Click to rename"
                onClick={() => setEditingSet(set.id)}
              >
                {set.name}
              </h3>
            )}
            <span className="text-xs text-neutral-400">{set.photos.length} photos</span>
            {set.clientExclusive && (
              <span className="text-[10px] uppercase tracking-wide bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded">
                Client exclusive{set.clientEmail ? ` · ${set.clientEmail}` : ""}
              </span>
            )}
            {set.externalSource && (
              <>
                <span
                  className="text-[10px] uppercase tracking-wide bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded"
                  title={set.externalSource}
                >
                  Hosted on Picflow
                </span>
                <button
                  className="text-xs text-sky-700 hover:underline"
                  onClick={() => syncPicflow(set.id)}
                  disabled={syncBusy === set.id}
                >
                  {syncBusy === set.id ? "Syncing…" : "Sync now"}
                </button>
              </>
            )}
            <div className="ml-auto flex gap-2">
              <button
                className="text-xs text-neutral-500 hover:text-neutral-900 underline"
                onClick={() => {
                  if (set.clientExclusive) {
                    patchSet(set.id, { clientExclusive: false, clientEmail: "", clientPassword: "" });
                  } else {
                    const email = prompt("Client email for exclusive access:");
                    if (!email) return;
                    const password = prompt("Set access password for this client:");
                    if (!password) return;
                    patchSet(set.id, { clientExclusive: true, clientEmail: email, clientPassword: password });
                  }
                }}
              >
                {set.clientExclusive ? "Remove exclusive access" : "Client Exclusive Access"}
              </button>
              <button className="text-xs text-red-500 hover:text-red-700 underline" onClick={() => deleteSet(set.id)}>
                Delete set
              </button>
            </div>
          </div>

          {set.photos.length === 0 ? (
            <div className="border border-dashed border-neutral-300 rounded-lg p-8 text-center text-sm text-neutral-400">
              No photos in this set yet.
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {set.photos.map((p) => (
                <div key={p.id} className="group relative card overflow-hidden">
                  <div className="aspect-square bg-neutral-100">
                    <Thumb p={p} />
                  </div>
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    className="absolute top-2 left-2 h-4 w-4 accent-neutral-900"
                    title="Select for Quick Share"
                  />
                  {collection.coverPhotoId === p.id && (
                    <span className="absolute top-2 right-2 text-[10px] bg-neutral-900 text-white px-1.5 py-0.5 rounded">
                      Cover
                    </span>
                  )}
                  {p.isPrivate && (
                    <span className="absolute bottom-10 left-2 text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded">
                      Private
                    </span>
                  )}
                  <div className="p-1.5 flex items-center justify-between gap-1 text-[11px]">
                    <span className="truncate text-neutral-500" title={p.filename}>
                      {p.filename}
                    </span>
                    {p.isExternal && (
                      <span className="shrink-0 text-[9px] text-sky-600" title={`External reference: ${p.url}`}>
                        ext
                      </span>
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-7 hidden group-hover:flex justify-center gap-1 bg-black/60 py-1">
                    <button
                      className="text-[10px] text-white hover:underline"
                      onClick={() => setCover(p.id)}
                      title="Set as collection cover"
                    >
                      Cover
                    </button>
                    <span className="text-white/40 text-[10px]">·</span>
                    <button
                      className="text-[10px] text-white hover:underline"
                      onClick={() => patchPhoto(p.id, { isPrivate: !p.isPrivate })}
                    >
                      {p.isPrivate ? "Unhide" : "Private"}
                    </button>
                    <span className="text-white/40 text-[10px]">·</span>
                    <select
                      className="text-[10px] bg-transparent text-white border-0"
                      value={set.id}
                      onChange={(e) => patchPhoto(p.id, { setId: e.target.value })}
                      title="Move to set"
                    >
                      {sets.map((s) => (
                        <option key={s.id} value={s.id} className="text-black">
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <span className="text-white/40 text-[10px]">·</span>
                    <button className="text-[10px] text-red-300 hover:underline" onClick={() => deletePhoto(p.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      {addingSet ? (
        <form onSubmit={addSet} className="max-w-xs">
          <input
            className="input"
            autoFocus
            value={newSetName}
            onChange={(e) => setNewSetName(e.target.value)}
            placeholder="Set name (e.g. Ceremony)"
            onBlur={() => !newSetName && setAddingSet(false)}
          />
        </form>
      ) : (
        <button className="btn-secondary" onClick={() => setAddingSet(true)}>
          + Add Photo Set
        </button>
      )}

      {/* Share modal */}
      {showShare && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Share Collection</h2>
              <button className="text-neutral-400 hover:text-neutral-900" onClick={() => setShowShare(false)}>
                ✕
              </button>
            </div>

            {collection.status !== "PUBLISHED" && (
              <p className="text-xs bg-amber-50 text-amber-800 rounded p-2">
                This collection is not published yet, visitors will see the{" "}
                {collection.status === "PRERELEASE" ? "pre-release page" : "draft notice"}.
              </p>
            )}

            <section>
              <p className="label">Direct link</p>
              <div className="flex gap-2">
                <input className="input font-mono text-xs" readOnly value={galleryUrl} />
                <button className="btn-secondary shrink-0" onClick={() => copy(galleryUrl, "link")}>
                  {copied === "link" ? "Copied!" : "Copy"}
                </button>
              </div>
            </section>

            <section>
              <p className="label">QR code</p>
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt={`QR code for ${galleryUrl}`} className="h-28 w-28 border border-neutral-200 rounded" />
              ) : (
                <div className="h-28 w-28 border border-neutral-300 rounded flex items-center justify-center text-neutral-300 text-xs text-center">
                  Generating…
                </div>
              )}
            </section>

            <section>
              <p className="label">Email invite</p>
              <form onSubmit={sendInvite} className="space-y-2">
                <input
                  className="input"
                  type="email"
                  placeholder="client@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
                <textarea
                  className="input h-20"
                  placeholder="Personal message (optional)"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                />
                <button className="btn-primary">Send Invite</button>
                {inviteSent && <p className="text-xs text-emerald-600">{inviteSent}</p>}
              </form>
              {invites.length > 0 && (
                <ul className="mt-2 text-xs text-neutral-500 space-y-0.5">
                  {invites.map((i) => (
                    <li key={i.id}>✓ Sent to {i.email}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <p className="label">Quick Share Links</p>
              <p className="text-xs text-neutral-500 mb-2">
                Share a curated selection only, select photos in the grid, then press “Quick Share
                selected”. Quick share links bypass the gallery password.
              </p>
              {quickShares.length === 0 ? (
                <p className="text-xs text-neutral-400">No quick share links yet.</p>
              ) : (
                <ul className="space-y-1">
                  {quickShares.map((q) => {
                    const url =
                      typeof window !== "undefined"
                        ? `${window.location.origin}/g/${collection.slug}?qs=${q.token}`
                        : "";
                    return (
                      <li key={q.id} className="flex items-center gap-2 text-xs">
                        <span className="text-neutral-500">{q.count} photos</span>
                        <input className="input !py-1 font-mono text-[10px]" readOnly value={url} />
                        <button className="btn-secondary !py-1 !px-2 shrink-0" onClick={() => copy(url, q.id)}>
                          {copied === q.id ? "Copied!" : "Copy"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

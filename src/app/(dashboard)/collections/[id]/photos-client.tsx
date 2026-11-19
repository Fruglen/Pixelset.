"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { UPLOAD_LIMITS_TEXT, clientLimitError, runPool, uploadOne, type QueueItem } from "@/lib/upload-client";

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
  starred: boolean;
  watermarkMode: string;
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
  "image/*,video/mp4,video/quicktime,video/x-m4v,video/x-msvideo,.mp4,.mov,.m4v,.avi,.cr2,.cr3,.nef,.arw,.dng,.raf,.orf,.rw2";



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
  targets,
  mailConnected,
}: {
  collection: { id: string; slug: string; coverPhotoId: string | null; status: string };
  sets: SetItem[];
  quickShares: { id: string; token: string; count: number }[];
  invites: { id: string; email: string; createdAt: string; status: string; deliveryNote: string }[];
  targets: { id: string; name: string; sets: { id: string; name: string }[] }[];
  mailConnected: boolean;
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
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragSet, setDragSet] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPhone, setShowPhone] = useState(false);
  const [phoneQr, setPhoneQr] = useState("");
  const [invitePreview, setInvitePreview] = useState("");
  const [inviteName, setInviteName] = useState("");
  // Final pass: invite templates, scheduling and multi recipient sending
  const [inviteTemplates, setInviteTemplates] = useState<{ id: string; name: string; subject: string }[]>([]);
  const [inviteTemplateId, setInviteTemplateId] = useState("");
  const [inviteSendAt, setInviteSendAt] = useState("");
  const [inviteTplName, setInviteTplName] = useState("");
  const [inviteTplMsg, setInviteTplMsg] = useState("");
  useEffect(() => {
    fetch("/api/gallery-templates")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((d) => setInviteTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);
  const [starredOnly, setStarredOnly] = useState(false);
  const allPhotoIds = sets.flatMap((s) => s.photos.map((p) => p.id));

  useEffect(() => {
    if (!showPhone) return;
    QRCode.toDataURL(`${window.location.origin}/m/upload/${collection.id}`, { width: 200, margin: 1 })
      .then(setPhoneQr)
      .catch(() => setPhoneQr(""));
  }, [showPhone, collection.id]);

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

  // Phase 5B: every file (picker or drag and drop) goes through one queue with
  // its own progress and result. Phase 5B platform: uploads are chunked and
  // resumable with automatic retry (src/lib/upload-client.ts), three files run
  // at a time so a 1000 photo wedding keeps moving, and failed files can be
  // retried, resuming from the chunks the server already has.
  async function runQueue(items: QueueItem[]) {
    setUploading(true);
    const patch = (key: string, d: Partial<QueueItem>) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...d } : x)));
    await runPool(items, 3, async (item) => {
      const f = item.file!;
      const pre = clientLimitError(f);
      if (pre) {
        patch(item.key, { status: "error", error: pre });
        return;
      }
      patch(item.key, { status: "uploading", error: undefined, note: undefined });
      const error = await uploadOne(
        collection.id,
        item.setId!,
        f,
        (pct) => patch(item.key, { progress: pct }),
        (attempt, why) => patch(item.key, { note: `${why}, retrying (attempt ${attempt + 1})` })
      );
      patch(item.key, error ? { status: "error", error, note: undefined } : { status: "done", progress: 100, note: undefined, file: undefined });
    });
    setUploading(false);
    router.refresh();
  }

  async function uploadFiles(files: FileList | File[] | null, setId = targetSet) {
    const list = files ? Array.from(files) : [];
    if (list.length === 0 || !setId) return;
    const setName = sets.find((x) => x.id === setId)?.name ?? "";
    const stamp = Date.now();
    const items: QueueItem[] = list.map((f, i) => ({ key: `${stamp}-${i}`, name: f.name, size: f.size, setName, status: "queued", progress: 0, file: f, setId }));
    setQueue((q) => [...items, ...q.filter((x) => x.status !== "done")]);
    if (fileRef.current) fileRef.current.value = "";
    await runQueue(items);
  }

  function retryFailed() {
    const failed = queue.filter((q) => q.status === "error" && q.file);
    if (failed.length === 0) return;
    setQueue((q) => q.map((x) => (x.status === "error" && x.file ? { ...x, status: "queued", error: undefined } : x)));
    runQueue(failed);
  }

  // Warn before leaving while files are still uploading (a resume is possible, but explain it).
  useEffect(() => {
    if (!uploading) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [uploading]);

  function onDrop(e: React.DragEvent, setId: string) {
    e.preventDefault();
    e.stopPropagation();
    setDragSet(null);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files, setId);
  }

  function dragProps(setId: string) {
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (dragSet !== setId) setDragSet(setId);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragSet((d) => (d === setId ? null : d));
      },
      onDrop: (e: React.DragEvent) => onDrop(e, setId),
    };
  }

  // Phase 5B: one action applied to every selected photo.
  async function bulk(action: string, extra: Record<string, unknown> = {}, confirmText = "") {
    if (selected.size === 0) return;
    if (confirmText && !confirm(confirmText)) return;
    setBulkBusy(true);
    setBulkMsg(null);
    try {
      const res = await fetch(`/api/collections/${collection.id}/photos/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: Array.from(selected), action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBulkMsg({ ok: false, text: data.error || "That action failed" });
        return;
      }
      const verbs: Record<string, string> = {
        move: "moved",
        copy: "copied",
        delete: "deleted",
        rename: "renamed",
        watermark: "updated",
        private: "updated",
        star: "updated",
      };
      setBulkMsg({ ok: true, text: `${data.count} photo${data.count === 1 ? "" : "s"} ${verbs[action] ?? "updated"}` });
      if (action === "delete" || action === "move") setSelected(new Set());
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  function bulkRename() {
    const pattern = prompt("Rename the selected photos. Use {n} for a sequence number and {name} for the current name:", "Gallery-{n}");
    if (!pattern || !pattern.trim()) return;
    bulk("rename", { pattern: pattern.trim(), start: 1 });
  }

  function selectSet(set: SetItem) {
    setSelected((prev) => {
      const next = new Set(prev);
      const all = set.photos.every((p) => next.has(p.id));
      set.photos.forEach((p) => (all ? next.delete(p.id) : next.add(p.id)));
      return next;
    });
  }

  async function loadInvitePreview() {
    const params = new URLSearchParams({ preview: "1", message: inviteMessage, name: inviteName });
    const res = await fetch(`/api/collections/${collection.id}/invite?${params.toString()}`);
    const data = await res.json().catch(() => ({}));
    setInvitePreview(res.ok ? data.html : "");
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
    const emails = inviteEmail
      .split(/[\n,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.includes("@"));
    if (emails.length === 0) {
      setInviteSent("Add at least one valid email address.");
      return;
    }
    const payload: Record<string, unknown> = { message: inviteMessage };
    if (emails.length === 1) {
      payload.email = emails[0];
      payload.name = inviteName;
    } else {
      payload.recipients = emails.map((email) => ({ email }));
    }
    if (inviteTemplateId) payload.templateId = inviteTemplateId;
    if (inviteSendAt) payload.sendAt = new Date(inviteSendAt).toISOString();
    const res = await fetch(`/api/collections/${collection.id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setInviteSent(data.error || "Could not send the invite.");
      return;
    }
    if (data.scheduled) {
      setInviteSent(
        `Invite scheduled for ${emails.length} recipient${emails.length === 1 ? "" : "s"} at ${new Date(inviteSendAt).toLocaleString()}. It sends on its own when the time comes.`
      );
    } else if (emails.length > 1) {
      const sent = (data.results ?? []).filter((r: { delivered: boolean }) => r.delivered).length;
      setInviteSent(`Invites sent to ${emails.length} clients: ${sent} delivered now, the rest logged.`);
    } else {
      setInviteSent(
        data.delivered
          ? `Invite delivered to ${emails[0]} via Resend`
          : data.deliveryError
            ? `Invite to ${emails[0]} logged, but sending failed: ${data.deliveryError}`
            : `Invite to ${emails[0]} logged only. Email is not connected, so nothing was delivered.`
      );
    }
    setInviteEmail("");
    setInviteName("");
    setInviteMessage("");
    setInvitePreview("");
    setInviteSendAt("");
    router.refresh();
  }

  async function saveInviteTemplate() {
    if (!inviteTplName.trim()) {
      setInviteTplMsg("Name the template first.");
      return;
    }
    const res = await fetch("/api/gallery-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: inviteTplName.trim(),
        subject: "Your gallery is ready",
        body: inviteMessage.trim() || "Your photos are ready. Open your gallery from the button below.",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setInviteTemplates((t) => [...t, { id: data.id, name: inviteTplName.trim(), subject: "Your gallery is ready" }]);
      setInviteTplName("");
      setInviteTplMsg("Template saved. Pick it from the template list on the next invite.");
    } else {
      setInviteTplMsg(data.error || "Could not save the template.");
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
        <button className="btn-secondary" onClick={() => setShowPhone((v) => !v)}>
          Upload from phone
        </button>
        <button className="btn-secondary" onClick={() => setShowShare(true)}>
          Share
        </button>
      </div>

      {/* Phase 5B: drag and drop target feeding the same upload route */}
      <div
        {...dragProps(targetSet)}
        onClick={() => fileRef.current?.click()}
        className={`mb-6 rounded-lg border-2 border-dashed px-6 py-6 text-center cursor-pointer transition-colors ${
          dragSet === targetSet ? "border-neutral-900 bg-neutral-100" : "border-neutral-300 hover:border-neutral-500"
        }`}
      >
        <p className="text-sm font-medium">
          {dragSet === targetSet ? "Drop to upload" : "Drag and drop photos and videos here, or click to choose files"}
        </p>
        <p className="text-xs text-neutral-500 mt-1">
          Uploading to {sets.find((x) => x.id === targetSet)?.name ?? "a set"}. You can also drop files straight onto any set below.
        </p>
        <p className="text-[11px] text-neutral-400 mt-1">Limits: {UPLOAD_LIMITS_TEXT}.</p>
      </div>

      {queue.length > 0 && (
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">
              Uploads: {queue.filter((q) => q.status === "done").length} done
              {queue.some((q) => q.status === "error") ? `, ${queue.filter((q) => q.status === "error").length} failed` : ""}
              {uploading ? `, ${queue.filter((q) => q.status === "queued" || q.status === "uploading").length} remaining` : ""}
            </p>
            {!uploading && (
              <span className="flex gap-3">
                {queue.some((q) => q.status === "error" && q.file) && (
                  <button className="text-xs text-neutral-900 underline" onClick={retryFailed}>
                    Retry failed
                  </button>
                )}
                <button className="text-xs text-neutral-500 underline" onClick={() => setQueue([])}>
                  Clear
                </button>
              </span>
            )}
          </div>
          <ul className="space-y-1.5 max-h-56 overflow-y-auto">
            {queue.slice(0, 300).map((q) => (
              <li key={q.key} className="text-xs">
                <div className="flex items-center gap-2">
                  <span className="truncate flex-1" title={q.name}>
                    {q.name} <span className="text-neutral-400">to {q.setName}</span>
                  </span>
                  <span
                    className={
                      q.status === "done" ? "text-emerald-600" : q.status === "error" ? "text-red-600" : "text-neutral-500"
                    }
                  >
                    {q.status === "done" ? "Uploaded" : q.status === "error" ? "Failed" : q.status === "uploading" ? `${q.progress}%` : "Waiting"}
                  </span>
                </div>
                {q.status === "uploading" && (
                  <div className="h-1 bg-neutral-100 rounded mt-1">
                    <div className="h-1 bg-neutral-900 rounded" style={{ width: `${q.progress}%` }} />
                  </div>
                )}
                {q.note && q.status === "uploading" && <p className="text-amber-600 mt-0.5">{q.note}</p>}
                {q.error && <p className="text-red-600 mt-0.5">{q.error}</p>}
              </li>
            ))}
          </ul>
          {queue.length > 300 && <p className="text-[11px] text-neutral-400 mt-1">Showing the first 300 of {queue.length} files.</p>}
          <p className="text-[11px] text-neutral-400 mt-1">
            Files go up in 4 MB chunks with automatic retry. If the connection drops or you close the tab, drop the same files
            again and they resume from where they stopped.
          </p>
        </div>
      )}

      {showPhone && (
        <div className="card p-4 mb-6 flex items-center gap-5">
          {phoneQr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={phoneQr} alt="QR code for the phone upload screen" className="h-32 w-32 border border-neutral-200 rounded" />
          ) : (
            <div className="h-32 w-32 border border-neutral-200 rounded" />
          )}
          <div className="text-sm">
            <p className="font-medium">Upload from your phone</p>
            <p className="text-xs text-neutral-500 mt-1 max-w-md">
              Scan this code with your phone (signed in to Pixelset) to open the mobile upload screen. Take photos with the
              camera or pick them from your camera roll, they land in this collection.
            </p>
            <a className="text-xs underline mt-2 inline-block" href={`/m/upload/${collection.id}`} target="_blank" rel="noreferrer">
              Open the mobile upload screen
            </a>
          </div>
        </div>
      )}

      {/* Phase 5B: bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 card px-4 py-3 mb-6 flex flex-wrap items-center gap-2 shadow-md">
          <span className="text-sm font-medium mr-1">{selected.size} selected</span>
          <button className="text-xs underline text-neutral-500" onClick={() => setSelected(new Set(allPhotoIds))}>
            Select all
          </button>
          <button className="text-xs underline text-neutral-500 mr-2" onClick={() => setSelected(new Set())}>
            Clear
          </button>
          <select
            className="input !w-auto !py-1 text-xs"
            value=""
            disabled={bulkBusy}
            onChange={(e) => e.target.value && bulk("move", { setId: e.target.value })}
          >
            <option value="">Move to set…</option>
            {sets.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select
            className="input !w-auto !py-1 text-xs"
            value=""
            disabled={bulkBusy}
            onChange={(e) => {
              const [cid, sid] = e.target.value.split("|");
              if (sid) bulk("copy", { collectionId: cid, setId: sid });
            }}
          >
            <option value="">Copy to…</option>
            {targets.map((t) => (
              <optgroup key={t.id} label={t.id === collection.id ? `${t.name} (this collection)` : t.name}>
                {t.sets.map((x) => (
                  <option key={x.id} value={`${t.id}|${x.id}`}>
                    {x.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button className="btn-secondary !py-1 !px-2 text-xs" disabled={bulkBusy} onClick={bulkRename}>
            Rename
          </button>
          <select
            className="input !w-auto !py-1 text-xs"
            value=""
            disabled={bulkBusy}
            onChange={(e) => e.target.value && bulk("watermark", { mode: e.target.value })}
          >
            <option value="">Watermark…</option>
            <option value="on">Always watermark</option>
            <option value="off">Never watermark</option>
            <option value="inherit">Follow collection setting</option>
          </select>
          <button className="btn-secondary !py-1 !px-2 text-xs" disabled={bulkBusy} onClick={() => bulk("star", { value: true })}>
            ★ Star
          </button>
          <button className="btn-secondary !py-1 !px-2 text-xs" disabled={bulkBusy} onClick={() => bulk("star", { value: false })}>
            Unstar
          </button>
          <button className="btn-secondary !py-1 !px-2 text-xs" disabled={bulkBusy} onClick={() => bulk("private", { value: true })}>
            Make private
          </button>
          <button className="btn-secondary !py-1 !px-2 text-xs" disabled={bulkBusy} onClick={() => bulk("private", { value: false })}>
            Unhide
          </button>
          <button className="btn-secondary !py-1 !px-2 text-xs" disabled={bulkBusy} onClick={createQuickShare}>
            Quick Share
          </button>
          <button
            className="btn-danger !py-1 !px-2 text-xs"
            disabled={bulkBusy}
            onClick={() => bulk("delete", {}, `Delete ${selected.size} photo${selected.size === 1 ? "" : "s"}? This cannot be undone.`)}
          >
            Delete
          </button>
          {bulkMsg && <span className={`text-xs ${bulkMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{bulkMsg.text}</span>}
        </div>
      )}

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
      <div className="flex justify-end mb-3">
        <button
          type="button"
          onClick={() => setStarredOnly((v) => !v)}
          aria-pressed={starredOnly}
          className={`text-xs px-2 py-1 rounded border ${starredOnly ? "bg-amber-50 border-amber-300 text-amber-700" : "border-neutral-200 text-neutral-500 hover:text-neutral-900"}`}
        >
          ★ {starredOnly ? "Showing starred photos" : "Show starred only"} ({sets.reduce((n, st) => n + st.photos.filter((p) => p.starred).length, 0)})
        </button>
      </div>
      {sets.map((set) => (
        <section
          key={set.id}
          {...dragProps(set.id)}
          className={`mb-8 rounded-lg ${dragSet === set.id && set.id !== targetSet ? "ring-2 ring-neutral-900 ring-offset-4" : ""}`}
        >
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
            {set.photos.length > 0 && (
              <button className="text-xs text-neutral-500 underline" onClick={() => selectSet(set)}>
                {set.photos.every((p) => selected.has(p.id)) ? "Deselect set" : "Select set"}
              </button>
            )}
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
              No photos in this set yet. Drop files here to upload them into {set.name}.
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {set.photos.filter((p) => !starredOnly || p.starred).map((p) => (
                <div key={p.id} className="group relative card overflow-hidden">
                  <div className="aspect-square bg-neutral-100">
                    <Thumb p={p} />
                  </div>
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    className="absolute top-2 left-2 h-4 w-4 accent-neutral-900"
                    title="Select for bulk actions"
                  />
                  <div className="absolute top-8 left-2 flex flex-col gap-1 items-start">
                    {p.starred && <span className="text-[10px] bg-amber-400 text-white px-1.5 py-0.5 rounded">★</span>}
                    {p.watermarkMode !== "inherit" && (
                      <span className="text-[9px] bg-neutral-800/80 text-white px-1.5 py-0.5 rounded">
                        {p.watermarkMode === "on" ? "WM on" : "WM off"}
                      </span>
                    )}
                  </div>
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
                {!mailConnected && (
                  <p className="text-xs bg-neutral-100 text-neutral-600 rounded p-2">
                    Email: Not connected. Invites are recorded and shown below, but nothing is delivered until RESEND_API_KEY is
                    set (Settings, Email sending).
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input"
                    type="text"
                    placeholder="client@example.com (several: separate with commas)"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                  <input className="input" placeholder="Client name (optional)" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
                </div>
                <textarea
                  className="input h-20"
                  placeholder="Personal message (optional)"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <select className="input" value={inviteTemplateId} onChange={(e) => setInviteTemplateId(e.target.value)}>
                    <option value="">No template, one-off message</option>
                    {inviteTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    type="datetime-local"
                    value={inviteSendAt}
                    onChange={(e) => setInviteSendAt(e.target.value)}
                    title="Send at (leave empty to send now)"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    className="input"
                    placeholder="Template name (to reuse this message)"
                    value={inviteTplName}
                    onChange={(e) => setInviteTplName(e.target.value)}
                  />
                  <button type="button" className="btn-secondary shrink-0" onClick={saveInviteTemplate}>
                    Save as template
                  </button>
                </div>
                {inviteTplMsg && <p className="text-xs text-neutral-500">{inviteTplMsg}</p>}
                <div className="flex gap-2">
                  <button className="btn-primary">{inviteSendAt ? "Schedule Invite" : "Send Invite"}</button>
                  <button type="button" className="btn-secondary" onClick={loadInvitePreview}>
                    Preview email
                  </button>
                </div>
                {inviteSent && <p className="text-xs text-emerald-600">{inviteSent}</p>}
              </form>
              {invitePreview && (
                <div className="mt-3 border border-neutral-200 rounded overflow-hidden">
                  <div className="flex items-center justify-between bg-neutral-50 px-2 py-1 text-[11px] text-neutral-500">
                    <span>Branded invite preview (cover, message, download instructions)</span>
                    <button onClick={() => setInvitePreview("")}>✕</button>
                  </div>
                  <iframe title="Invite preview" srcDoc={invitePreview} className="w-full h-96 bg-white" />
                </div>
              )}
              {invites.length > 0 && (
                <ul className="mt-2 text-xs text-neutral-500 space-y-0.5">
                  {invites.map((i) => (
                    <li key={i.id}>
                      {i.status === "FAILED" ? "✕" : i.status === "SCHEDULED" ? "◷" : "✓"} {i.email}
                      <span className="text-neutral-400"> · {i.deliveryNote || (i.status === "SCHEDULED" ? "Scheduled" : "Recorded")}</span>
                    </li>
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

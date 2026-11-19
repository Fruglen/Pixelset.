"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { GalleryIcon, ImagesIcon } from "@/components/icons";

type CollectionItem = {
  id: string;
  name: string;
  slug: string;
  status: string;
  folderId: string | null;
  starred: boolean;
  eventDate: string | null;
  expiresAt: string | null;
  photoCount: number;
  cover: string;
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-600",
  PRERELEASE: "bg-amber-50 text-amber-700",
  PUBLISHED: "bg-emerald-50 text-emerald-700",
};

export default function CollectionsClient({
  collections,
  folders,
  presets,
  defaultPresetId = "",
}: {
  defaultPresetId?: string;
  collections: CollectionItem[];
  folders: { id: string; name: string }[];
  presets: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [activeFolder, setActiveFolder] = useState<string | "all" | "starred">("all");
  const [starMap, setStarMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(collections.map((c) => [c.id, c.starred]))
  );

  async function toggleStar(id: string) {
    const next = !starMap[id];
    setStarMap((m) => ({ ...m, [id]: next }));
    const res = await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: next }),
    });
    if (!res.ok) setStarMap((m) => ({ ...m, [id]: !next }));
  }
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [slug, setSlug] = useState("");
  const [presetId, setPresetId] = useState(defaultPresetId);
  const [picflowUrl, setPicflowUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);

  const visible =
    activeFolder === "all"
      ? collections
      : activeFolder === "starred"
        ? collections.filter((c) => starMap[c.id])
        : collections.filter((c) => c.folderId === activeFolder);

  async function createCollection(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        eventDate: eventDate || null,
        slug: slug || undefined,
        presetId: presetId || "none",
        folderId: activeFolder === "all" || activeFolder === "starred" ? undefined : activeFolder,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      // Optional Picflow link right on the create screen: the photos stay on
      // Picflow and become external references in a new set. Failures are
      // reported but never block the collection itself.
      if (/^https?:\/\//.test(picflowUrl.trim())) {
        const pf = await fetch(`/api/collections/${data.id}/picflow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: picflowUrl.trim(), newSetName: "Picflow Gallery" }),
        });
        if (!pf.ok) {
          const pfErr = await pf.json().catch(() => ({}));
          alert(
            `Collection created, but the Picflow gallery could not be linked: ${pfErr.error || "unknown error"}. You can retry from the Photos tab.`
          );
        }
      }
      setBusy(false);
      router.push(`/collections/${data.id}`);
      router.refresh();
    } else {
      setBusy(false);
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not create collection");
    }
  }

  async function addFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFolderName.trim() }),
    });
    setNewFolderName("");
    setAddingFolder(false);
    router.refresh();
  }

  async function deleteFolder(id: string) {
    if (!confirm("Delete this folder? Collections inside are kept.")) return;
    await fetch(`/api/folders/${id}`, { method: "DELETE" });
    if (activeFolder === id) setActiveFolder("all");
    router.refresh();
  }

  async function moveToFolder(collectionId: string, folderId: string) {
    await fetch(`/api/collections/${collectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: folderId || null }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl">Client Gallery</h1>
        <div className="flex gap-2">
          <Link href="/collections/presets" className="btn-secondary">
            View Presets
          </Link>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + New Collection
          </button>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Folders */}
        <aside className="w-48 shrink-0">
          <p className="label">Folders</p>
          <button
            onClick={() => setActiveFolder("all")}
            className={`block w-full text-left px-2 py-1.5 rounded text-sm ${
              activeFolder === "all" ? "bg-neutral-200 font-medium" : "hover:bg-neutral-100"
            }`}
          >
            All collections ({collections.length})
          </button>
          <button
            onClick={() => setActiveFolder("starred")}
            className={`block w-full text-left px-2 py-1.5 rounded text-sm ${
              activeFolder === "starred" ? "bg-neutral-200 font-medium" : "hover:bg-neutral-100"
            }`}
          >
            ★ Starred ({Object.values(starMap).filter(Boolean).length})
          </button>
          {folders.map((f) => (
            <div key={f.id} className="group flex items-center">
              <button
                onClick={() => setActiveFolder(f.id)}
                className={`flex-1 text-left px-2 py-1.5 rounded text-sm truncate ${
                  activeFolder === f.id ? "bg-neutral-200 font-medium" : "hover:bg-neutral-100"
                }`}
              >
                ▸ {f.name} ({collections.filter((c) => c.folderId === f.id).length})
              </button>
              <button
                onClick={() => deleteFolder(f.id)}
                className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-600 px-1 text-xs"
                title="Delete folder"
              >
                ✕
              </button>
            </div>
          ))}
          {addingFolder ? (
            <form onSubmit={addFolder} className="mt-2">
              <input
                className="input text-sm"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                onBlur={() => !newFolderName && setAddingFolder(false)}
              />
            </form>
          ) : (
            <button
              onClick={() => setAddingFolder(true)}
              className="mt-2 text-sm text-neutral-500 hover:text-neutral-900 px-2"
            >
              + New folder
            </button>
          )}
        </aside>

        {/* Collection grid */}
        <div className="flex-1">
          {visible.length === 0 ? (
            <EmptyState icon={GalleryIcon} line="No collections here yet. Create your first collection to get started.">
              <button className="btn-primary mt-5" onClick={() => setShowCreate(true)}>
                New collection
              </button>
            </EmptyState>
          ) : (
            <div className="grid grid-cols-3 gap-5">
              {visible.map((c) => (
                <div key={c.id} className="card overflow-hidden group">
                  <Link href={`/collections/${c.id}`} className="block">
                    <div className="aspect-[4/3] bg-neutral-100 overflow-hidden">
                      {c.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.cover}
                          alt={c.name}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-300">
                          <ImagesIcon className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleStar(c.id)}
                          title={starMap[c.id] ? "Unstar" : "Star"}
                          aria-pressed={starMap[c.id]}
                          className={`text-sm leading-none ${starMap[c.id] ? "text-amber-500" : "text-neutral-300 hover:text-neutral-500"}`}
                        >
                          {starMap[c.id] ? "★" : "☆"}
                        </button>
                        <Link href={`/collections/${c.id}`} className="font-medium text-sm truncate">
                          {c.name}
                        </Link>
                      </div>
                      <span
                        className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          STATUS_STYLES[c.status] ?? "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        {c.status === "PRERELEASE" ? "Pre-release" : c.status.toLowerCase()}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {c.photoCount} photos
                      {c.eventDate ? ` · ${formatDate(c.eventDate)}` : ""}
                      {c.expiresAt && new Date(c.expiresAt) < new Date() ? " · expired" : ""}
                    </p>
                    <select
                      className="mt-2 w-full text-xs border border-neutral-200 rounded px-1 py-1 text-neutral-500 bg-white"
                      value={c.folderId ?? ""}
                      onChange={(e) => moveToFolder(c.id, e.target.value)}
                    >
                      <option value="">No folder</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={createCollection} className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="font-display text-xl">New Collection</h2>
            <div>
              <label className="label">Collection name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Emma & James Wedding"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Event date (optional)</label>
              <input
                className="input"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Custom URL (optional)</label>
              <input
                className="input"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="emma-james-wedding"
              />
              <p className="text-xs text-neutral-400 mt-1">Leave blank to generate from the name.</p>
            </div>
            {presets.length > 0 && (
              <div>
                <label className="label">Apply a Collection Preset</label>
                <select className="input" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
                  <option value="">No preset, Pixora defaults</option>
                  {/* Phase 5B platform: the account default preset is preselected */}
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">Link a Picflow gallery (optional)</label>
              <input
                className="input font-mono text-xs"
                value={picflowUrl}
                onChange={(e) => setPicflowUrl(e.target.value)}
                placeholder="https://yourname.picflow.com/your-gallery"
              />
              <p className="text-xs text-neutral-400 mt-1">
                Shows the Picflow gallery in this collection as external references, without copying any files.
              </p>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy}>
                {busy ? "Creating…" : "Create Collection"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

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

type FolderItem = { id: string; name: string; slug: string | null; isPublic: boolean };

export default function CollectionsClient({
  collections,
  folders,
  presets,
  defaultPresetId = "",
}: {
  defaultPresetId?: string;
  collections: CollectionItem[];
  folders: FolderItem[];
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

  // Multi-select bulk edit + CSV import + folder sharing
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkPresetId, setBulkPresetId] = useState("");
  const [bulkFolderId, setBulkFolderId] = useState("__keep");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNote, setBulkNote] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<{ created: { name: string; slug: string }[]; errors: { row: number; message: string }[] } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareNote, setShareNote] = useState("");

  const selectedIds = collections.filter((c) => selected[c.id]).map((c) => c.id);
  const activeFolderObj = folders.find((f) => f.id === activeFolder);

  async function applyBulk() {
    setBulkBusy(true);
    setBulkNote("");
    const payload: Record<string, unknown> = { ids: selectedIds };
    if (bulkPresetId) payload.presetId = bulkPresetId;
    if (bulkFolderId === "__none") payload.folderId = null;
    else if (bulkFolderId !== "__keep") payload.folderId = bulkFolderId;
    if (bulkStatus) payload.status = bulkStatus;
    const res = await fetch("/api/collections/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setBulkBusy(false);
    if (!res.ok) return setBulkNote(data.error || "Bulk edit failed");
    const summary = (data.results as { name: string; changes: string[] }[])
      .map((r) => `${r.name}: ${r.changes.join(", ")}`)
      .join(" · ");
    setBulkNote(`Updated ${data.updated} collection${data.updated === 1 ? "" : "s"}. ${summary}`);
    setSelected({});
    router.refresh();
  }

  async function runImport() {
    setImportBusy(true);
    setImportResult(null);
    const res = await fetch("/api/collections/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText }),
    });
    const data = await res.json().catch(() => ({}));
    setImportBusy(false);
    if (!res.ok) {
      setImportResult({ created: [], errors: [{ row: 0, message: data.error || "Import failed" }] });
      return;
    }
    setImportResult({ created: data.created ?? [], errors: data.errors ?? [] });
    router.refresh();
  }

  async function setFolderSharing(folder: FolderItem, isPublic: boolean) {
    setShareBusy(true);
    setShareNote("");
    const res = await fetch(`/api/folders/${folder.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic }),
    });
    const data = await res.json().catch(() => ({}));
    setShareBusy(false);
    if (!res.ok) return setShareNote("Could not update folder sharing");
    setShareNote(isPublic ? "Folder share link is on." : "Folder share link is off.");
    router.refresh();
  }

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
          <button className="btn-secondary" onClick={() => { setShowImport(true); setImportResult(null); }}>
            Import CSV
          </button>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + New Collection
          </button>
        </div>
      </div>

      {/* Bulk edit bar */}
      {selectedIds.length > 0 && (
        <div className="card p-3 mb-5 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <select className="input !w-48 !py-1.5 text-sm" value={bulkPresetId} onChange={(e) => setBulkPresetId(e.target.value)}>
            <option value="">Apply preset…</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className="input !w-44 !py-1.5 text-sm" value={bulkFolderId} onChange={(e) => setBulkFolderId(e.target.value)}>
            <option value="__keep">Keep folder</option>
            <option value="__none">No folder</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                Move to {f.name}
              </option>
            ))}
          </select>
          <select className="input !w-40 !py-1.5 text-sm" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
            <option value="">Keep status</option>
            <option value="DRAFT">Draft</option>
            <option value="PRERELEASE">Pre-release</option>
            <option value="PUBLISHED">Published</option>
          </select>
          <button className="btn-primary !py-1.5" onClick={applyBulk} disabled={bulkBusy}>
            {bulkBusy ? "Applying…" : "Apply to selected"}
          </button>
          <button className="btn-secondary !py-1.5" onClick={() => setSelected({})}>
            Clear
          </button>
        </div>
      )}
      {bulkNote && <p className="text-sm text-neutral-600 mb-5">{bulkNote}</p>}

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

          {/* One share link for the whole folder */}
          {activeFolderObj && (
            <div className="mt-6 border-t border-neutral-100 pt-4">
              <p className="label">Folder share link</p>
              <label className="flex items-center gap-2 text-sm mt-1">
                <input
                  type="checkbox"
                  checked={activeFolderObj.isPublic}
                  disabled={shareBusy}
                  onChange={(e) => setFolderSharing(activeFolderObj, e.target.checked)}
                />
                Share this folder
              </label>
              {activeFolderObj.isPublic && activeFolderObj.slug ? (
                <p className="text-xs text-neutral-500 mt-2 break-all">
                  {typeof window !== "undefined" ? window.location.origin : ""}/folder/{activeFolderObj.slug}
                  <span className="block text-neutral-400 mt-1">
                    Anyone with the link sees this folder&rsquo;s published galleries. Each gallery keeps its
                    own password.
                  </span>
                </p>
              ) : (
                <p className="text-xs text-neutral-400 mt-2">
                  Off: the folder is only an organising tool in your dashboard.
                </p>
              )}
              {shareNote && <p className="text-xs text-neutral-500 mt-1">{shareNote}</p>}
            </div>
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
                <div key={c.id} className="card overflow-hidden group relative">
                  <label
                    className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-white/90 rounded px-1.5 py-1 text-xs shadow-sm cursor-pointer"
                    title="Select for bulk edit"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(selected[c.id])}
                      onChange={(e) => setSelected((m) => ({ ...m, [c.id]: e.target.checked }))}
                    />
                    Select
                  </label>
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

      {/* CSV import modal: one collection per row (volume workflow) */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-xl">Import collections from CSV</h2>
            <p className="text-sm text-neutral-500">
              One collection per row. Header row: <span className="font-mono text-xs">name,eventDate,folder,password,pin,preset,status</span>{" "}
              (only name is required). Folders are created when missing, presets are matched by name, and every
              row reports its own result.
            </p>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="text-sm"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setCsvText(await f.text());
              }}
            />
            <textarea
              className="input h-40 font-mono text-xs"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"name,eventDate,folder,password,pin,preset,status\nSpring Minis A,2026-04-12,Minis,,,Standard,DRAFT"}
            />
            {importResult && (
              <div className="text-sm space-y-1">
                {importResult.created.length > 0 && (
                  <p className="text-emerald-700">
                    Created {importResult.created.length}: {importResult.created.map((c) => c.name).join(", ")}
                  </p>
                )}
                {importResult.errors.map((e) => (
                  <p key={e.row} className="text-red-600">
                    Row {e.row}: {e.message}
                  </p>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowImport(false)}>
                Close
              </button>
              <button className="btn-primary" onClick={runImport} disabled={importBusy || !csvText.trim()}>
                {importBusy ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

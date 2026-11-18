"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Block,
  BLOCK_DEFS,
  BLOCK_CATEGORIES,
  blockDef,
  makeBlock,
  newBlockId,
  FieldDef,
} from "@/lib/blocks";

interface PageInfo {
  id: string;
  type: string;
  title: string;
  slug: string;
  visible: boolean;
}

// ----------------------------------------------------------- photo picker

function PhotoPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const [photos, setPhotos] = useState<{ id: string; url: string; filename: string; collection: string }[] | null>(null);
  useEffect(() => {
    fetch("/api/website/photos")
      .then((r) => r.json())
      .then((d) => setPhotos(d.photos ?? []))
      .catch(() => setPhotos([]));
  }, []);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200">
          <h3 className="font-medium text-sm">Pick a photo from your galleries</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900">✕</button>
        </div>
        <div className="p-5 overflow-y-auto">
          {photos === null ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : photos.length === 0 ? (
            <p className="text-sm text-neutral-500">No photos yet, upload some in Client Gallery first, or paste an image URL instead.</p>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {photos.map((p) => (
                <button key={p.id} className="group relative" title={`${p.filename} · ${p.collection}`} onClick={() => onPick(p.url)}>
                  <img src={p.url} alt={p.filename} className="w-full aspect-square object-cover rounded group-hover:opacity-75" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------- field inputs

function FieldInput({
  field,
  value,
  onChange,
  openPicker,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  openPicker: (cb: (url: string) => void) => void;
}) {
  switch (field.kind) {
    case "text":
      return (
        <div>
          <label className="label">{field.label}</label>
          <input className="input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "textarea":
      return (
        <div>
          <label className="label">{field.label}</label>
          <textarea className="input" rows={4} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "number":
      return (
        <div>
          <label className="label">{field.label}</label>
          <input
            className="input w-28"
            type="number"
            min={1}
            value={Number(value ?? 0) || ""}
            onChange={(e) => onChange(parseInt(e.target.value, 10) || 1)}
          />
        </div>
      );
    case "toggle":
      return (
        <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer py-1">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {field.label}
        </label>
      );
    case "select":
      return (
        <div>
          <label className="label">{field.label}</label>
          <select className="input" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    case "image": {
      const url = String(value ?? "");
      return (
        <div>
          <label className="label">{field.label}</label>
          <div className="flex gap-2 items-start">
            {url ? <img src={url} alt="" className="w-14 h-14 object-cover rounded border border-neutral-200 flex-none" /> : null}
            <div className="flex-1 space-y-1.5">
              <input className="input" placeholder="https:// image URL" value={url} onChange={(e) => onChange(e.target.value)} />
              <div className="flex gap-2">
                <button type="button" className="text-xs underline text-neutral-500 hover:text-neutral-900" onClick={() => openPicker((u) => onChange(u))}>
                  Pick from my galleries
                </button>
                {url ? (
                  <button type="button" className="text-xs underline text-neutral-500 hover:text-red-600" onClick={() => onChange("")}>
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      );
    }
    case "items": {
      const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const update = (i: number, key: string, v: unknown) => {
        const next = items.map((item, j) => (j === i ? { ...item, [key]: v } : item));
        onChange(next);
      };
      const moveItem = (i: number, dir: -1 | 1) => {
        const j = i + dir;
        if (j < 0 || j >= items.length) return;
        const next = [...items];
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next);
      };
      return (
        <div>
          <label className="label">{field.label}</label>
          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={i} className="border border-neutral-200 rounded-md p-3 relative">
                <div className="absolute right-2 top-2 flex gap-1 text-neutral-400 text-xs">
                  <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} className="hover:text-neutral-900 disabled:opacity-30">▲</button>
                  <button type="button" onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="hover:text-neutral-900 disabled:opacity-30">▼</button>
                  <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="hover:text-red-600">✕</button>
                </div>
                <div className="space-y-2.5 pr-12">
                  {(field.fields ?? []).map((sf) => (
                    <FieldInput key={sf.key} field={sf} value={item[sf.key]} onChange={(v) => update(i, sf.key, v)} openPicker={openPicker} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 text-xs underline text-neutral-500 hover:text-neutral-900"
            onClick={() => onChange([...items, Object.fromEntries((field.fields ?? []).map((sf) => [sf.key, sf.kind === "toggle" ? false : ""]))])}
          >
            + Add {field.itemLabel?.toLowerCase() ?? "item"}
          </button>
        </div>
      );
    }
  }
}

// ----------------------------------------------------------- block card

function summarize(block: Block): string {
  const p = block.props;
  const firstString =
    [p.heading, p.title, p.quote, p.label, p.body, p.url, p.handle, p.address, p.collectionSlug]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .find(Boolean) ?? "";
  const listKeys = ["items", "images", "slides", "packages", "rows"];
  const counts = listKeys
    .filter((k) => Array.isArray(p[k]) && (p[k] as unknown[]).length > 0)
    .map((k) => `${(p[k] as unknown[]).length} ${k === "rows" ? "rows" : "items"}`);
  return [firstString.slice(0, 70), counts.join(", ")].filter(Boolean).join(" · ");
}

function AddBlockModal({ onAdd, onClose }: { onAdd: (type: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[82vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200">
          <h3 className="font-medium text-sm">Add a block</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900">✕</button>
        </div>
        <div className="p-5 overflow-y-auto">
          {BLOCK_CATEGORIES.map((cat) => {
            const defs = BLOCK_DEFS.filter((d) => d.category === cat);
            if (defs.length === 0) return null;
            return (
              <div key={cat} className="mb-5">
                <p className="label">{cat}</p>
                <div className="grid md:grid-cols-3 gap-2">
                  {defs.map((d) => (
                    <button
                      key={d.type}
                      className="border border-neutral-200 rounded-md p-3 text-left hover:border-neutral-900 transition-colors"
                      onClick={() => onAdd(d.type)}
                    >
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{d.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------- editor

export function PageEditor({ page, initialBlocks, siteSlug }: { page: PageInfo; initialBlocks: Block[]; siteSlug: string }) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addAt, setAddAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<{ cb: (url: string) => void } | null>(null);

  const slugLocked = page.type === "HOME" || page.type === "BLOG";
  const viewHref = `/site/${siteSlug}${page.slug ? `/${page.slug}` : ""}`;

  function markDirty() {
    setDirty(true);
    setSavedAt(null);
  }

  function updateBlock(id: string, key: string, value: unknown) {
    setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, props: { ...b.props, [key]: value } } : b)));
    markDirty();
  }
  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[j]] = [next[j], next[index]];
    setBlocks(next);
    markDirty();
  }
  function duplicate(index: number) {
    const src = blocks[index];
    const copy: Block = { id: newBlockId(), type: src.type, props: JSON.parse(JSON.stringify(src.props)) };
    const next = [...blocks];
    next.splice(index + 1, 0, copy);
    setBlocks(next);
    markDirty();
  }
  function remove(index: number) {
    setBlocks((bs) => bs.filter((_, i) => i !== index));
    markDirty();
  }
  function addBlock(type: string) {
    const block = makeBlock(type);
    const next = [...blocks];
    const at = addAt === null ? next.length : addAt;
    next.splice(at, 0, block);
    setBlocks(next);
    setAddOpen(false);
    setAddAt(null);
    setOpenId(block.id);
    markDirty();
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/website/pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug: slugLocked ? undefined : slug, blocks: JSON.stringify(blocks) }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
      return;
    }
    setDirty(false);
    setSavedAt(Date.now());
    router.refresh();
  }

  const openBlock = useMemo(() => blocks.find((b) => b.id === openId) ?? null, [blocks, openId]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Link href="/website" className="text-sm text-neutral-500 hover:text-neutral-900">← Pages</Link>
        <input className="input !w-56" value={title} onChange={(e) => { setTitle(e.target.value); markDirty(); }} />
        <div className="flex items-center gap-1 text-sm text-neutral-500">
          <span>/</span>
          <input
            className="input !w-36"
            value={slug}
            disabled={slugLocked}
            onChange={(e) => { setSlug(e.target.value); markDirty(); }}
            placeholder={page.type === "HOME" ? "(home)" : "slug"}
          />
        </div>
        <div className="flex-1" />
        <a href={viewHref} target="_blank" rel="noreferrer" className="btn-secondary">Preview ↗</a>
        <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : dirty ? "Save page" : savedAt ? "Saved ✓" : "Saved"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}

      <div className="space-y-2">
        {blocks.map((block, i) => {
          const def = blockDef(block.type);
          const open = openId === block.id;
          return (
            <div key={block.id} className="card">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex flex-col gap-0.5 text-neutral-400 text-xs">
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="hover:text-neutral-900 disabled:opacity-30 leading-none">▲</button>
                  <button onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="hover:text-neutral-900 disabled:opacity-30 leading-none">▼</button>
                </div>
                <button className="flex-1 text-left min-w-0" onClick={() => setOpenId(open ? null : block.id)}>
                  <span className="text-sm font-medium">{def?.name ?? block.type}</span>
                  <span className="text-xs text-neutral-400 ml-2 truncate">{summarize(block)}</span>
                </button>
                <button className="text-xs text-neutral-400 hover:text-neutral-900" onClick={() => { setAddAt(i + 1); setAddOpen(true); }} title="Insert block below">+ below</button>
                <button className="text-xs text-neutral-400 hover:text-neutral-900" onClick={() => duplicate(i)}>Duplicate</button>
                <button className="text-xs text-neutral-400 hover:text-red-600" onClick={() => remove(i)}>Delete</button>
                <button className="text-neutral-400 hover:text-neutral-900 text-sm" onClick={() => setOpenId(open ? null : block.id)}>
                  {open ? "▴" : "▾"}
                </button>
              </div>
              {open && def ? (
                <div className="border-t border-neutral-100 px-4 py-4 grid md:grid-cols-2 gap-x-6 gap-y-3">
                  {def.fields.map((f) => (
                    <div key={f.key} className={f.kind === "items" || f.kind === "textarea" ? "md:col-span-2" : ""}>
                      <FieldInput
                        field={f}
                        value={block.props[f.key]}
                        onChange={(v) => updateBlock(block.id, f.key, v)}
                        openPicker={(cb) => setPicker({ cb })}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <button className="btn-secondary w-full border-dashed" onClick={() => { setAddAt(null); setAddOpen(true); }}>
          + Add block
        </button>
      </div>
      <p className="text-xs text-neutral-400 mt-3">
        {blocks.length} block{blocks.length === 1 ? "" : "s"} on this page.
        {openBlock ? "" : " Click a block to edit its content."} Changes publish when you hit Save.
      </p>

      {addOpen ? <AddBlockModal onAdd={addBlock} onClose={() => { setAddOpen(false); setAddAt(null); }} /> : null}
      {picker ? (
        <PhotoPicker
          onPick={(url) => {
            picker.cb(url);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </div>
  );
}

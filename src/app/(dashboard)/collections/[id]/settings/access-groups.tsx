"use client";

import { useEffect, useState } from "react";

// Phase 5B platform: per viewer access groups. A vendor, a second shooter or
// the family gets their own access code, sees only the sets chosen here, and
// downloads only what the group allows. Enforced by the gallery page and the
// download route; the viewer enters the code on the gallery.

type Group = { id: string; name: string; code: string; canDownload: boolean; downloadSizes: string; setIds: string };

const SIZES = [
  { id: "original", label: "Original" },
  { id: "high3600", label: "High Resolution (3600px)" },
  { id: "web2048", label: "Web Size (2048px)" },
  { id: "web1024", label: "Web Size (1024px)" },
  { id: "web640", label: "Web Size (640px)" },
];

export default function AccessGroupsSection({
  collectionId,
  slug,
  sets,
}: {
  collectionId: string;
  slug: string;
  sets: { id: string; name: string; clientExclusive: boolean }[];
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/collections/${collectionId}/access-groups`)
      .then((r) => r.json())
      .then((d) => setGroups(d.groups ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [collectionId]);

  async function create() {
    setError("");
    const res = await fetch(`/api/collections/${collectionId}/access-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setError(d.error || "Could not create the group");
    setGroups((g) => [...g, d.group]);
    setNewName("");
  }

  async function save(g: Group) {
    setError("");
    setSaved("");
    const res = await fetch(`/api/collections/${collectionId}/access-groups/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: g.name,
        code: g.code,
        canDownload: g.canDownload,
        downloadSizes: g.downloadSizes.split(",").filter(Boolean),
        setIds: g.setIds.split(",").filter(Boolean),
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setError(d.error || "Could not save the group");
    setSaved(`${g.name} saved`);
  }

  async function remove(g: Group) {
    if (!confirm(`Delete the ${g.name} group? Anyone using its code loses that access.`)) return;
    await fetch(`/api/collections/${collectionId}/access-groups/${g.id}`, { method: "DELETE" });
    setGroups((all) => all.filter((x) => x.id !== g.id));
  }

  function patch(id: string, p: Partial<Group>) {
    setGroups((all) => all.map((g) => (g.id === id ? { ...g, ...p } : g)));
  }

  function toggleCsv(csv: string, id: string) {
    const list = csv.split(",").filter(Boolean);
    return (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]).join(",");
  }

  return (
    <section className="card p-6">
      <h2 className="font-display text-lg mb-1">Access Groups</h2>
      <p className="text-sm text-neutral-500 mb-4">
        Give vendors, second shooters or family their own access code. Each group sees only the sets you tick (none ticked
        means every set that is not client exclusive) and gets its own download rights. Group codes also open a password
        protected gallery. Viewers enter the code from Access code on the gallery at /g/{slug}.
      </p>
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.id} className="border border-neutral-200 rounded p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Group name</label>
                <input className="input" value={g.name} onChange={(e) => patch(g.id, { name: e.target.value })} />
              </div>
              <div>
                <label className="label">Access code</label>
                <input className="input font-mono" value={g.code} onChange={(e) => patch(g.id, { code: e.target.value })} />
              </div>
            </div>
            <div>
              <p className="label">Sets this group can see</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {sets.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-brand-600"
                      checked={g.setIds.split(",").includes(s.id)}
                      onChange={() => patch(g.id, { setIds: toggleCsv(g.setIds, s.id) })}
                    />
                    {s.name}
                    {s.clientExclusive ? " (client exclusive)" : ""}
                  </label>
                ))}
              </div>
              {!g.setIds && <p className="text-xs text-neutral-400 mt-1">No set ticked: all sets that are not client exclusive.</p>}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-brand-600"
                checked={g.canDownload}
                onChange={(e) => patch(g.id, { canDownload: e.target.checked })}
              />
              This group can download
            </label>
            {g.canDownload && (
              <div>
                <p className="label">Sizes this group may download</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {SIZES.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-brand-600"
                        checked={g.downloadSizes.split(",").includes(s.id)}
                        onChange={() => patch(g.id, { downloadSizes: toggleCsv(g.downloadSizes, s.id) })}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-neutral-400 mt-1">Only sizes the gallery also offers in Download are available.</p>
              </div>
            )}
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => save(g)}>
                Save group
              </button>
              <button className="btn-danger" onClick={() => remove(g)}>
                Delete
              </button>
            </div>
          </div>
        ))}
        <div className="flex gap-2 items-end">
          <div className="flex-1 max-w-xs">
            <label className="label">New group</label>
            <input className="input" placeholder="Vendors, Family, Second shooter" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={create} disabled={!loaded || !newName.trim()}>
            Add group
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">{saved}</p>}
      </div>
    </section>
  );
}

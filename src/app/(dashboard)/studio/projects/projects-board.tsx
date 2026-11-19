"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STAGES = [
  { key: "INQUIRY", label: "Inquiry" },
  { key: "BOOKED", label: "Booked" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "COMPLETE", label: "Complete" },
];

interface ProjectRow {
  id: string;
  name: string;
  stage: string;
  notes: string;
  contactName: string;
  bookingStart: string;
}

export function ProjectsBoard({
  projects,
  contacts,
}: {
  projects: ProjectRow[];
  contacts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [contactId, setContactId] = useState("");
  const [stage, setStage] = useState("INQUIRY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragId, setDragId] = useState("");
  const [dragOver, setDragOver] = useState("");

  const [toast, setToast] = useState("");
  async function patch(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/studio/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const out = await res.json().catch(() => ({}));
    if (out.feedback) {
      setToast(out.feedback);
      setTimeout(() => setToast(""), 5000);
    }
    router.refresh();
  }

  async function create() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/studio/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, contactId, stage }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not create");
    setShowCreate(false);
    setName("");
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this project card?")) return;
    await fetch(`/api/studio/projects/${id}`, { method: "DELETE" });
    router.refresh();
  }

  function moveStage(p: ProjectRow, dir: -1 | 1) {
    const idx = STAGES.findIndex((s) => s.key === p.stage);
    const next = STAGES[idx + dir];
    if (next) patch(p.id, { stage: next.key });
  }

  return (
    <div className="space-y-5">
      {toast ? <p className="text-sm text-emerald-700 mb-3">{toast}</p> : null}
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Bookings land in <span className="font-medium">Booked</span> automatically; drag cards (or use the
          arrows) to move them through your workflow.
        </p>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + Project
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
      <div className="grid grid-cols-5 gap-3 min-h-[420px] min-w-[880px] md:min-w-0">
        {STAGES.map((s) => {
          const cards = projects.filter((p) => p.stage === s.key);
          return (
            <div
              key={s.key}
              className={`rounded-lg border p-2.5 flex flex-col gap-2 ${
                dragOver === s.key ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 bg-neutral-50/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(s.key);
              }}
              onDragLeave={() => setDragOver("")}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver("");
                if (dragId) patch(dragId, { stage: s.key });
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 px-1">
                {s.label} <span className="text-neutral-400 font-normal">({cards.length})</span>
              </p>
              {cards.map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => setDragId(p.id)}
                  onDragEnd={() => setDragId("")}
                  className="card p-3 cursor-grab active:cursor-grabbing bg-white"
                >
                  <Link href={`/studio/projects/${p.id}`} className="text-sm font-medium leading-snug hover:underline block" draggable={false}>
                    {p.name}
                  </Link>
                  {p.contactName ? <p className="text-xs text-neutral-500 mt-0.5">{p.contactName}</p> : null}
                  {p.bookingStart ? (
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {new Date(p.bookingStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <div className="flex gap-1">
                      <button
                        className="text-neutral-400 hover:text-neutral-900 disabled:opacity-30"
                        disabled={s.key === "INQUIRY"}
                        onClick={() => moveStage(p, -1)}
                      >
                        ←
                      </button>
                      <button
                        className="text-neutral-400 hover:text-neutral-900 disabled:opacity-30"
                        disabled={s.key === "COMPLETE"}
                        onClick={() => moveStage(p, 1)}
                      >
                        →
                      </button>
                    </div>
                    <button className="text-neutral-300 hover:text-red-600" onClick={() => remove(p.id)}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      </div>

      {showCreate ? (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg mb-4">New project</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Name</label>
                <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Contact</label>
                  <select className="input" value={contactId} onChange={(e) => setContactId(e.target.value)}>
                    <option value="">None</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Stage</label>
                  <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button className="btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button className="btn-primary" disabled={busy || !name.trim()} onClick={create}>
                  {busy ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

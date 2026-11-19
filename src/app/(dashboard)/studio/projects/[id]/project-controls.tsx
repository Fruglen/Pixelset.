"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STAGES = [
  { key: "INQUIRY", label: "Inquiry" },
  { key: "BOOKED", label: "Booked" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "COMPLETE", label: "Complete" },
];

export function ProjectControls({
  project,
  contacts,
}: {
  project: { id: string; name: string; stage: string; notes: string; contactId: string };
  contacts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(project);
  const [msg, setMsg] = useState("");

  async function save(data: Record<string, unknown>) {
    const res = await fetch(`/api/studio/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const out = await res.json().catch(() => ({}));
    setMsg(out.feedback || (res.ok ? "Saved" : out.error || "Save failed"));
    setTimeout(() => setMsg(""), 4000);
    router.refresh();
  }

  return (
    <section className="card p-5 space-y-3 text-sm">
      <h2 className="font-display text-lg">Project</h2>
      <div>
        <label className="label">Name</label>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="label">Stage</label>
        <select
          className="input"
          value={form.stage}
          onChange={(e) => {
            setForm({ ...form, stage: e.target.value });
            save({ stage: e.target.value });
          }}
        >
          {STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Client</label>
        <select className="input" value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
          <option value="">None</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input min-h-[100px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-emerald-600">{msg}</span>
        <button className="btn-primary" onClick={() => save({ name: form.name, notes: form.notes, contactId: form.contactId || null })}>
          Save
        </button>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const BADGE: Record<string, string> = {
  SIGNED: "bg-emerald-100 text-emerald-700",
  SENT: "bg-blue-100 text-blue-700",
  AWAITING_SECOND: "bg-amber-100 text-amber-700",
  SCHEDULED: "bg-purple-100 text-purple-700",
  EXPIRED: "bg-red-100 text-red-700",
  DRAFT: "bg-neutral-100 text-neutral-600",
};

export function ContractsClient({
  templates,
  contracts,
  contacts,
  sessionTypes,
}: {
  templates: { id: string; name: string; contracts: number; sessionTypes: number }[];
  contracts: {
    id: string;
    title: string;
    status: string;
    contactName: string;
    templateName: string;
    createdAt: string;
    signedAt: string;
  }[];
  contacts: { id: string; name: string }[];
  sessionTypes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showTemplate, setShowTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [form, setForm] = useState({ templateId: "", contactId: "", sessionTypeId: "", title: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createTemplate() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/studio/contract-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: templateName }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not create template");
    setShowTemplate(false);
    setTemplateName("");
    router.push(`/studio/contracts/templates/${data.id}`);
    router.refresh();
  }

  async function createContract() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/studio/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not create contract");
    setShowCreate(false);
    router.push(`/studio/contracts/${data.id}`);
    router.refresh();
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template? Existing contracts keep their text.")) return;
    await fetch(`/api/studio/contract-templates/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg">Templates</h2>
          <button className="btn-secondary" onClick={() => setShowTemplate(true)}>
            + Template
          </button>
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No templates yet. Templates hold your boilerplate with smart fields like {"{{client_name}}"} and{" "}
            {"{{session_price}}"} that fill in automatically.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map((t) => (
              <div key={t.id} className="card p-4">
                <Link href={`/studio/contracts/templates/${t.id}`} className="font-medium text-sm hover:underline">
                  {t.name}
                </Link>
                <p className="text-xs text-neutral-500 mt-1">
                  {t.contracts} contract{t.contracts === 1 ? "" : "s"} · attached to {t.sessionTypes} session type
                  {t.sessionTypes === 1 ? "" : "s"}
                </p>
                <div className="flex gap-3 mt-3">
                  <Link href={`/studio/contracts/templates/${t.id}`} className="text-xs underline text-neutral-600">
                    Edit
                  </Link>
                  <button className="text-xs underline text-red-600" onClick={() => deleteTemplate(t.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg">Contracts</h2>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + Contract
          </button>
        </div>
        {contracts.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No contracts yet. They're created here or automatically when a client books a session type with a
            template attached.
          </p>
        ) : (
          <div className="card divide-y divide-neutral-100">
            {contracts.map((c) => (
              <Link key={c.id} href={`/studio/contracts/${c.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.title}</p>
                  <p className="text-xs text-neutral-500">
                    {c.contactName || "No contact"} · {fmtDate(c.createdAt)}
                    {c.signedAt ? ` · signed ${fmtDate(c.signedAt)}` : ""}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${BADGE[c.status] ?? BADGE.DRAFT}`}>
                  {c.status.replace("_", " ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {showTemplate ? (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setShowTemplate(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg mb-4">New contract template</h3>
            {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
            <label className="label">Template name</label>
            <input
              className="input"
              autoFocus
              placeholder="Wedding Photography Agreement"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <p className="text-xs text-neutral-500 mt-2">Starts with a standard photography agreement you can edit.</p>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary" onClick={() => setShowTemplate(false)}>
                Cancel
              </button>
              <button className="btn-primary" disabled={busy || !templateName.trim()} onClick={createTemplate}>
                {busy ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreate ? (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg mb-4">New contract</h3>
            {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
            <div className="space-y-3">
              <div>
                <label className="label">From template</label>
                <select className="input" value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
                  <option value="">Blank contract</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Client</label>
                <select className="input" value={form.contactId} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
                  <option value="">Pick later…</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Session type (fills smart fields)</label>
                <select className="input" value={form.sessionTypeId} onChange={(e) => setForm({ ...form, sessionTypeId: e.target.value })}>
                  <option value="">None</option>
                  {sessionTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Title (optional)</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button className="btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button className="btn-primary" disabled={busy} onClick={createContract}>
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

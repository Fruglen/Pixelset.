"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { UsersIcon } from "@/components/icons";

interface ContactRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  tags: string[];
  bookings: number;
  invoices: number;
  notes: number;
  state: string; // LEAD | CLIENT
  source: string;
}

export function ContactsClient({ contacts }: { contacts: ContactRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", tags: "" });
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState("");

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const c of contacts) for (const t of c.tags) s.add(t);
    return Array.from(s).sort();
  }, [contacts]);

  const leadCount = contacts.filter((c) => c.state !== "CLIENT").length;
  const clientCount = contacts.length - leadCount;

  const filtered = contacts.filter((c) => {
    if (tag && !c.tags.includes(tag)) return false;
    if (stateFilter === "LEAD" && c.state === "CLIENT") return false;
    if (stateFilter === "CLIENT" && c.state !== "CLIENT") return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q)
    );
  });

  async function create() {
    setError("");
    setBusy(true);
    const res = await fetch("/api/studio/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not create the contact");
    setShowCreate(false);
    setForm({ name: "", email: "", phone: "", company: "", tags: "" });
    router.push(`/studio/contacts/${data.id}`);
    router.refresh();
  }

  async function runImport() {
    setError("");
    setBusy(true);
    const res = await fetch("/api/studio/contacts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Import failed");
    setImportResult(`Imported ${data.imported} contact${data.imported === 1 ? "" : "s"} (${data.skipped} skipped).`);
    setCsv("");
    router.refresh();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(f);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            className="input !w-64"
            placeholder="Search name, email, company…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="input !w-auto" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
            <option value="">All people ({contacts.length})</option>
            <option value="LEAD">Leads ({leadCount})</option>
            <option value="CLIENT">Clients ({clientCount})</option>
          </select>
          {allTags.length ? (
            <select className="input !w-auto" value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowImport(true)}>
            Import CSV
          </button>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + Contact
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        contacts.length === 0 ? (
          <EmptyState icon={UsersIcon} line="No contacts yet. They're added automatically when someone books, or add one yourself.">
            <button className="btn-primary mt-5" onClick={() => setShowCreate(true)}>
              + Contact
            </button>
          </EmptyState>
        ) : (
          <p className="text-sm text-neutral-500 py-8 text-center">No matches.</p>
        )
      ) : (
        <div className="card divide-y divide-neutral-100">
          {filtered.map((c) => (
            <Link key={c.id} href={`/studio/contacts/${c.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50">
              <div className="w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {c.name}
                  {c.company ? <span className="text-neutral-400 font-normal"> · {c.company}</span> : null}
                </p>
                <p className="text-xs text-neutral-500 truncate">
                  {c.email || "no email"}
                  {c.phone ? ` · ${c.phone}` : ""}
                </p>
              </div>
              <span
                className={
                  c.state === "CLIENT"
                    ? "text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap"
                    : "text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap"
                }
              >
                {c.state === "CLIENT" ? "Client" : "Lead"}
              </span>
              <button
                className="text-[11px] underline text-neutral-400 whitespace-nowrap"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  await fetch(`/api/studio/contacts/${c.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ state: c.state === "CLIENT" ? "LEAD" : "CLIENT" }),
                  });
                  router.refresh();
                }}
              >
                {c.state === "CLIENT" ? "Move to lead" : "Mark as client"}
              </button>
              <div className="hidden sm:flex gap-1.5">
                {c.tags.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-xs text-neutral-400 whitespace-nowrap">
                {c.bookings} bookings · {c.invoices} invoices
              </p>
            </Link>
          ))}
        </div>
      )}

      {showCreate ? (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg mb-4">New contact</h3>
            {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
            <div className="space-y-3">
              <div>
                <label className="label">Name *</label>
                <input className="input" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Email</label>
                  <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Company</label>
                <input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
              <div>
                <label className="label">Tags (comma-separated)</label>
                <input className="input" placeholder="wedding, 2027" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button className="btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button className="btn-primary" disabled={busy || !form.name.trim()} onClick={create}>
                  {busy ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showImport ? (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setShowImport(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg mb-2">Import contacts from CSV</h3>
            <p className="text-xs text-neutral-500 mb-4">
              Upload or paste a CSV. Recognized header columns: name (or first/last name), email, phone,
              address, company, tags. Rows with an email you already have are skipped.
            </p>
            {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
            {importResult ? <p className="text-sm text-emerald-600 mb-3">{importResult}</p> : null}
            <input type="file" accept=".csv,text/csv" className="text-sm mb-3" onChange={onFile} />
            <textarea
              className="input min-h-[140px] font-mono text-xs"
              placeholder={"name,email,phone\nJane Doe,jane@example.com,+1 555 0100"}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary" onClick={() => setShowImport(false)}>
                Close
              </button>
              <button className="btn-primary" disabled={busy || !csv.trim()} onClick={runImport}>
                {busy ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_BADGE: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700",
  SIGNED: "bg-emerald-100 text-emerald-700",
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  OVERDUE: "bg-red-100 text-red-700",
  DECLINED: "bg-red-100 text-red-700",
  CANCELLED: "bg-neutral-100 text-neutral-400",
  PARTIAL: "bg-amber-100 text-amber-700",
  PENDING: "bg-amber-100 text-amber-700",
  WAITLIST: "bg-purple-100 text-purple-700",
};

function Badge({ s }: { s: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[s] ?? "bg-neutral-100 text-neutral-600"}`}>
      {s.replace("_", " ")}
    </span>
  );
}

export function ContactDetail({
  contact,
  notes,
  bookings,
  invoices,
  quotes,
  contracts,
  responses,
  galleries,
}: {
  contact: { id: string; name: string; email: string; phone: string; address: string; company: string; tags: string };
  notes: { id: string; body: string; createdAt: string }[];
  bookings: { id: string; title: string; startsAt: string; status: string; paymentStatus: string; totalCents: number }[];
  invoices: { id: string; number: string; title: string; status: string; createdAt: string }[];
  quotes: { id: string; number: string; title: string; status: string; createdAt: string }[];
  contracts: { id: string; title: string; status: string; createdAt: string }[];
  responses: { id: string; questionnaire: string; createdAt: string }[];
  galleries: { id: string; name: string; slug: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({ ...contact });
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/studio/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
      return;
    }
    setMsg("Saved");
    setTimeout(() => setMsg(""), 2000);
    router.refresh();
  }

  async function addNote() {
    if (!note.trim()) return;
    const res = await fetch(`/api/studio/contacts/${contact.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: note }),
    });
    if (res.ok) {
      setNote("");
      router.refresh();
    }
  }

  async function deleteNote(id: string) {
    await fetch(`/api/studio/notes/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this contact? Bookings and invoices keep their records but lose the link.")) return;
    await fetch(`/api/studio/contacts/${contact.id}`, { method: "DELETE" });
    router.push("/studio/contacts");
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <Link href="/studio/contacts" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Contacts
        </Link>
        <div className="flex items-center gap-2">
          {msg ? <span className="text-sm text-emerald-600">{msg}</span> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
          <button className="btn-danger" onClick={remove}>
            Delete
          </button>
          <button className="btn-primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <section className="card p-5 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Company</label>
            <input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div>
          <label className="label">Tags (comma-separated)</label>
          <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          <div className="flex gap-1.5 mt-2">
            {form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
              .map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                  {t}
                </span>
              ))}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-display text-lg mb-3">Notes</h2>
        <div className="flex gap-2 mb-4">
          <input
            className="input"
            placeholder="Add a note…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNote()}
          />
          <button className="btn-secondary" onClick={addNote}>
            Add
          </button>
        </div>
        {notes.length === 0 ? (
          <p className="text-sm text-neutral-500">No notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="text-sm bg-neutral-50 rounded-md px-3 py-2 flex items-start justify-between gap-3">
                <div>
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="text-xs text-neutral-400 mt-1">{fmtDate(n.createdAt)}</p>
                </div>
                <button className="text-xs text-red-600 underline" onClick={() => deleteNote(n.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5 space-y-5">
        <h2 className="font-display text-lg">History</h2>

        <div>
          <h3 className="label">Bookings ({bookings.length})</h3>
          {bookings.length === 0 ? (
            <p className="text-sm text-neutral-400">None.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {bookings.map((b) => (
                <li key={b.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <span>
                    {b.title} · {fmtDate(b.startsAt)} · {money(b.totalCents)}
                  </span>
                  <span className="flex gap-1.5">
                    <Badge s={b.status} />
                    <Badge s={b.paymentStatus} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="label">Invoices & quotes ({invoices.length + quotes.length})</h3>
          {invoices.length + quotes.length === 0 ? (
            <p className="text-sm text-neutral-400">None.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {invoices.map((i) => (
                <li key={i.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <Link href={`/studio/invoices/${i.id}`} className="hover:underline">
                    {i.number}
                    {i.title ? `, ${i.title}` : ""}
                  </Link>
                  <Badge s={i.status} />
                </li>
              ))}
              {quotes.map((q) => (
                <li key={q.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <Link href={`/studio/quotes/${q.id}`} className="hover:underline">
                    {q.number}
                    {q.title ? `, ${q.title}` : ""} (quote)
                  </Link>
                  <Badge s={q.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="label">Contracts ({contracts.length})</h3>
          {contracts.length === 0 ? (
            <p className="text-sm text-neutral-400">None.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {contracts.map((c) => (
                <li key={c.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <Link href={`/studio/contracts/${c.id}`} className="hover:underline">
                    {c.title}
                  </Link>
                  <Badge s={c.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {responses.length ? (
          <div>
            <h3 className="label">Questionnaire responses ({responses.length})</h3>
            <ul className="divide-y divide-neutral-100">
              {responses.map((r) => (
                <li key={r.id} className="py-2 text-sm">
                  {r.questionnaire} · {fmtDate(r.createdAt)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {galleries.length ? (
          <div>
            <h3 className="label">Galleries ({galleries.length})</h3>
            <ul className="divide-y divide-neutral-100">
              {galleries.map((g) => (
                <li key={g.id} className="py-2 text-sm">
                  <Link href={`/collections/${g.id}`} className="hover:underline">
                    {g.name}
                  </Link>{" "}
                  <span className="text-neutral-400">· /g/{g.slug}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}

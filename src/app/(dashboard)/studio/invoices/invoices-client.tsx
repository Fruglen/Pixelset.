"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const BADGE: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700",
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  SENT: "bg-blue-100 text-blue-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
  DECLINED: "bg-red-100 text-red-700",
  DRAFT: "bg-neutral-100 text-neutral-600",
};

export function InvoicesClient({
  openNew,
  invoices,
  quotes,
  contacts,
}: {
  openNew: boolean;
  invoices: {
    id: string;
    number: string;
    title: string;
    contactName: string;
    status: string;
    totalCents: number;
    paidCents: number;
    installments: number;
    dueDate: string;
  }[];
  quotes: {
    id: string;
    number: string;
    title: string;
    contactName: string;
    status: string;
    totalCents: number;
    invoiceId: string;
    invoiceNumber: string;
  }[];
  contacts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(openNew);
  const [kind, setKind] = useState<"invoice" | "quote">("invoice");
  const [contactId, setContactId] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    const res = await fetch(kind === "invoice" ? "/api/studio/invoices" : "/api/studio/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, title }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "Could not create");
    setShowNew(false);
    router.push(kind === "invoice" ? `/studio/invoices/${data.id}` : `/studio/quotes/${data.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-end gap-2">
        <button
          className="btn-secondary"
          onClick={() => {
            setKind("quote");
            setShowNew(true);
          }}
        >
          + Quote
        </button>
        <button
          className="btn-primary"
          onClick={() => {
            setKind("invoice");
            setShowNew(true);
          }}
        >
          + Invoice
        </button>
      </div>

      <section>
        <h2 className="font-display text-lg mb-3">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="text-sm text-neutral-500">No invoices yet.</p>
        ) : (
          <div className="card divide-y divide-neutral-100">
            {invoices.map((i) => (
              <Link key={i.id} href={`/studio/invoices/${i.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {i.number}
                    {i.title ? <span className="text-neutral-500 font-normal">, {i.title}</span> : null}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {i.contactName || "No contact"}
                    {i.dueDate
                      ? ` · due ${new Date(i.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                      : ""}
                    {i.installments ? ` · ${i.installments} instalment${i.installments === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{money(i.totalCents)}</p>
                  {i.paidCents > 0 && i.status !== "PAID" ? (
                    <p className="text-xs text-neutral-400">{money(i.paidCents)} paid</p>
                  ) : null}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${BADGE[i.status] ?? BADGE.DRAFT}`}>
                  {i.status === "PARTIAL" ? "PARTIALLY PAID" : i.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg mb-3">Quotes</h2>
        {quotes.length === 0 ? (
          <p className="text-sm text-neutral-500">No quotes yet, a quote the client accepts converts into a draft invoice.</p>
        ) : (
          <div className="card divide-y divide-neutral-100">
            {quotes.map((q) => (
              <Link key={q.id} href={`/studio/quotes/${q.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-neutral-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {q.number}
                    {q.title ? <span className="text-neutral-500 font-normal">, {q.title}</span> : null}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {q.contactName || "No contact"}
                    {q.invoiceNumber ? ` · converted to ${q.invoiceNumber}` : ""}
                  </p>
                </div>
                <p className="text-sm font-medium">{money(q.totalCents)}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${BADGE[q.status] ?? BADGE.DRAFT}`}>
                  {q.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {showNew ? (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg mb-4">New {kind}</h3>
            {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
            <div className="space-y-3">
              <div>
                <label className="label">Client</label>
                <select className="input" value={contactId} onChange={(e) => setContactId(e.target.value)}>
                  <option value="">Pick later…</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Title (optional)</label>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button className="btn-secondary" onClick={() => setShowNew(false)}>
                  Cancel
                </button>
                <button className="btn-primary" disabled={busy} onClick={create}>
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

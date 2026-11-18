"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const BADGE: Record<string, string> = {
  ACCEPTED: "bg-emerald-100 text-emerald-700",
  SENT: "bg-blue-100 text-blue-700",
  DECLINED: "bg-red-100 text-red-700",
  DRAFT: "bg-neutral-100 text-neutral-600",
};

export function QuoteEditor({
  quote,
  contacts,
}: {
  quote: {
    id: string;
    number: string;
    title: string;
    status: string;
    token: string;
    contactId: string;
    validUntil: string;
    items: { description: string; qty: number; unitCents: number }[];
    taxRate: number;
    discountType: string;
    discountValue: number;
    notes: string;
    invoiceId: string;
    invoiceNumber: string;
  };
  contacts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const locked = quote.status === "ACCEPTED" || quote.status === "DECLINED";
  const [title, setTitle] = useState(quote.title);
  const [contactId, setContactId] = useState(quote.contactId);
  const [validUntil, setValidUntil] = useState(quote.validUntil);
  const [items, setItems] = useState(
    quote.items.length
      ? quote.items.map((it) => ({ description: it.description, qty: String(it.qty), unit: (it.unitCents / 100).toFixed(2) }))
      : [{ description: "", qty: "1", unit: "" }]
  );
  const [taxRate, setTaxRate] = useState(String(quote.taxRate));
  const [discountType, setDiscountType] = useState(quote.discountType);
  const [discountValue, setDiscountValue] = useState(
    quote.discountType === "FIXED" ? (quote.discountValue / 100).toFixed(2) : String(quote.discountValue)
  );
  const [notes, setNotes] = useState(quote.notes);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const total = useMemo(() => {
    const subtotal = items.reduce(
      (n, it) => n + Math.round((parseFloat(it.qty) || 0) * Math.round((parseFloat(it.unit) || 0) * 100)),
      0
    );
    let discount = 0;
    if (discountType === "PERCENT") discount = Math.round((subtotal * (parseFloat(discountValue) || 0)) / 100);
    else if (discountType === "FIXED") discount = Math.round((parseFloat(discountValue) || 0) * 100);
    discount = Math.min(discount, subtotal);
    const taxable = subtotal - discount;
    return taxable + Math.round((taxable * (parseFloat(taxRate) || 0)) / 100);
  }, [items, taxRate, discountType, discountValue]);

  async function patch(extra: Record<string, unknown> = {}) {
    setError("");
    const res = await fetch(`/api/studio/quotes/${quote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        contactId: contactId || null,
        validUntil: validUntil || null,
        items: items
          .filter((it) => it.description.trim())
          .map((it) => ({
            description: it.description,
            qty: parseFloat(it.qty) || 0,
            unitCents: Math.round((parseFloat(it.unit) || 0) * 100),
          })),
        taxRate: parseFloat(taxRate) || 0,
        discountType,
        discountValue:
          discountType === "FIXED" ? Math.round((parseFloat(discountValue) || 0) * 100) : Math.round(parseFloat(discountValue) || 0),
        notes,
        ...extra,
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(out.error ?? "Save failed");
      return false;
    }
    router.refresh();
    return true;
  }

  async function save() {
    setBusy(true);
    const ok = await patch();
    setBusy(false);
    if (ok) {
      setMsg("Saved");
      setTimeout(() => setMsg(""), 2000);
    }
  }

  async function convert() {
    const res = await fetch(`/api/studio/quotes/${quote.id}/convert`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      router.push(`/studio/invoices/${data.invoiceId}`);
      router.refresh();
    }
  }

  async function remove() {
    if (!confirm("Delete this quote?")) return;
    await fetch(`/api/studio/quotes/${quote.id}`, { method: "DELETE" });
    router.push("/studio/invoices");
    router.refresh();
  }

  const link = `/quote/${quote.token}`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/studio/invoices" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Invoices & quotes
          </Link>
          <h2 className="font-display text-lg">{quote.number}</h2>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${BADGE[quote.status] ?? BADGE.DRAFT}`}>
            {quote.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {msg ? <span className="text-sm text-emerald-600">{msg}</span> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
          <button className="btn-danger" onClick={remove}>
            Delete
          </button>
          {!locked ? (
            <button className="btn-secondary" disabled={busy} onClick={save}>
              Save
            </button>
          ) : null}
          {quote.status === "DRAFT" ? (
            <button className="btn-primary" disabled={busy} onClick={() => patch({ action: "send" })}>
              Send
            </button>
          ) : quote.status === "SENT" ? (
            <button className="btn-secondary" disabled={busy} onClick={() => patch({ action: "revertToDraft" })}>
              Revert to draft
            </button>
          ) : null}
          {!quote.invoiceId ? (
            <button className="btn-primary" onClick={convert}>
              Convert to invoice
            </button>
          ) : (
            <Link href={`/studio/invoices/${quote.invoiceId}`} className="btn-secondary">
              Invoice {quote.invoiceNumber} →
            </Link>
          )}
        </div>
      </div>

      {quote.status !== "DRAFT" ? (
        <div className="card p-4 flex items-center gap-2">
          <span className="text-sm text-neutral-500 whitespace-nowrap">Client link:</span>
          <input className="input font-mono text-xs" readOnly value={link} onFocus={(e) => e.target.select()} />
          <button
            className="btn-secondary whitespace-nowrap"
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}${link}`)}
          >
            Copy
          </button>
          <a href={link} target="_blank" rel="noreferrer" className="btn-secondary whitespace-nowrap">
            Open ↗
          </a>
        </div>
      ) : null}

      <section className="card p-5 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Title</label>
            <input className="input" disabled={locked} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Client</label>
            <select className="input" disabled={locked} value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">None</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Valid until</label>
            <input type="date" className="input" disabled={locked} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="card p-5 space-y-3">
        <h3 className="font-display text-lg">Line items</h3>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_100px_auto] gap-2 items-center">
              <input
                className="input"
                placeholder="Description"
                disabled={locked}
                value={it.description}
                onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
              />
              <input
                className="input text-right"
                disabled={locked}
                value={it.qty}
                onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
              />
              <input
                className="input text-right"
                placeholder="0.00"
                disabled={locked}
                value={it.unit}
                onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))}
              />
              {!locked ? (
                <button className="text-xs text-red-600 underline" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                  ✕
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
        {!locked ? (
          <button className="btn-secondary !py-1.5 text-xs" onClick={() => setItems([...items, { description: "", qty: "1", unit: "" }])}>
            + Line item
          </button>
        ) : null}
        <div className="grid sm:grid-cols-3 gap-3 pt-3 border-t border-neutral-100">
          <div>
            <label className="label">Tax rate (%)</label>
            <input className="input" disabled={locked} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
          </div>
          <div>
            <label className="label">Discount</label>
            <select className="input" disabled={locked} value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
              <option value="NONE">None</option>
              <option value="PERCENT">Percent off</option>
              <option value="FIXED">Amount off</option>
            </select>
          </div>
          {discountType !== "NONE" ? (
            <div>
              <label className="label">{discountType === "PERCENT" ? "Discount (%)" : "Discount ($)"}</label>
              <input className="input" disabled={locked} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
            </div>
          ) : null}
        </div>
        <div className="flex justify-end text-sm font-semibold">Total {money(total)}</div>
      </section>

      <section className="card p-5">
        <label className="label">Notes</label>
        <textarea className="input min-h-[70px]" disabled={locked} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <p className="text-xs text-neutral-400 mt-2">
          When the client accepts this quote online, it converts into a draft invoice automatically.
        </p>
      </section>
    </div>
  );
}

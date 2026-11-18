"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface ItemRow {
  description: string;
  qty: number;
  unitCents: number;
}

interface InstRow {
  label: string;
  dueDate: string;
  amount: string;
  paid: boolean;
}

const BADGE: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700",
  SENT: "bg-blue-100 text-blue-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
  DRAFT: "bg-neutral-100 text-neutral-600",
};

export function InvoiceEditor({
  invoice,
  contacts,
}: {
  invoice: {
    id: string;
    number: string;
    title: string;
    status: string;
    effectiveStatus: string;
    token: string;
    contactId: string;
    dueDate: string;
    items: ItemRow[];
    taxRate: number;
    discountType: string;
    discountValue: number;
    tipCents: number;
    notes: string;
    bookingTitle: string;
    quoteNumber: string;
    installments: InstRow[];
  };
  contacts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const locked = invoice.status === "PAID";
  const [title, setTitle] = useState(invoice.title);
  const [contactId, setContactId] = useState(invoice.contactId);
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [items, setItems] = useState<{ description: string; qty: string; unit: string }[]>(
    invoice.items.length
      ? invoice.items.map((it) => ({ description: it.description, qty: String(it.qty), unit: (it.unitCents / 100).toFixed(2) }))
      : [{ description: "", qty: "1", unit: "" }]
  );
  const [taxRate, setTaxRate] = useState(String(invoice.taxRate));
  const [discountType, setDiscountType] = useState(invoice.discountType);
  const [discountValue, setDiscountValue] = useState(
    invoice.discountType === "FIXED" ? (invoice.discountValue / 100).toFixed(2) : String(invoice.discountValue)
  );
  const [notes, setNotes] = useState(invoice.notes);
  const [insts, setInsts] = useState<InstRow[]>(invoice.installments);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (n, it) => n + Math.round((parseFloat(it.qty) || 0) * Math.round((parseFloat(it.unit) || 0) * 100)),
      0
    );
    let discount = 0;
    if (discountType === "PERCENT") discount = Math.round((subtotal * (parseFloat(discountValue) || 0)) / 100);
    else if (discountType === "FIXED") discount = Math.round((parseFloat(discountValue) || 0) * 100);
    discount = Math.min(discount, subtotal);
    const taxable = subtotal - discount;
    const tax = Math.round((taxable * (parseFloat(taxRate) || 0)) / 100);
    return { subtotal, discount, tax, tip: invoice.tipCents, total: taxable + tax + invoice.tipCents };
  }, [items, taxRate, discountType, discountValue, invoice.tipCents]);

  const scheduledTotal = insts.reduce((n, i) => n + Math.round((parseFloat(i.amount) || 0) * 100), 0);

  function payload(extra: Record<string, unknown> = {}) {
    return {
      title,
      contactId: contactId || null,
      dueDate: dueDate || null,
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
      installments: insts.map((i) => ({
        label: i.label,
        dueDate: i.dueDate,
        amountCents: Math.round((parseFloat(i.amount) || 0) * 100),
        paid: i.paid,
      })),
      ...extra,
    };
  }

  async function patch(extra: Record<string, unknown> = {}) {
    setError("");
    const res = await fetch(`/api/studio/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(extra)),
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

  function splitInto(n: number) {
    const total = totals.total;
    const base = Math.floor(total / n);
    const rows: InstRow[] = [];
    const start = new Date();
    for (let i = 0; i < n; i++) {
      const due = new Date(start);
      due.setMonth(due.getMonth() + i);
      rows.push({
        label: i === 0 ? "Deposit" : `Payment ${i + 1}`,
        dueDate: due.toISOString().slice(0, 10),
        amount: ((i === n - 1 ? total - base * (n - 1) : base) / 100).toFixed(2),
        paid: false,
      });
    }
    setInsts(rows);
  }

  async function remove() {
    if (!confirm("Delete this invoice?")) return;
    await fetch(`/api/studio/invoices/${invoice.id}`, { method: "DELETE" });
    router.push("/studio/invoices");
    router.refresh();
  }

  const payLink = `/pay/${invoice.token}`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/studio/invoices" className="text-sm text-neutral-500 hover:text-neutral-900">
            ← Invoices
          </Link>
          <h2 className="font-display text-lg">{invoice.number}</h2>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${BADGE[invoice.effectiveStatus] ?? BADGE.DRAFT}`}>
            {invoice.effectiveStatus === "PARTIAL" ? "PARTIALLY PAID" : invoice.effectiveStatus}
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
          {invoice.status === "DRAFT" ? (
            <button className="btn-primary" disabled={busy} onClick={() => patch({ action: "send" })}>
              Send
            </button>
          ) : invoice.status === "SENT" ? (
            <>
              <button className="btn-secondary" disabled={busy} onClick={() => patch({ action: "revertToDraft" })}>
                Revert to draft
              </button>
              <button className="btn-primary" disabled={busy} onClick={() => patch({ action: "markPaid" })}>
                Mark paid
              </button>
            </>
          ) : null}
        </div>
      </div>

      {invoice.status !== "DRAFT" ? (
        <div className="card p-4 flex items-center gap-2">
          <span className="text-sm text-neutral-500 whitespace-nowrap">Payment link:</span>
          <input className="input font-mono text-xs" readOnly value={payLink} onFocus={(e) => e.target.select()} />
          <button
            className="btn-secondary whitespace-nowrap"
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}${payLink}`)}
          >
            Copy
          </button>
          <a href={payLink} target="_blank" rel="noreferrer" className="btn-secondary whitespace-nowrap">
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
            <label className="label">Due date</label>
            <input type="date" className="input" disabled={locked} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        {invoice.bookingTitle || invoice.quoteNumber ? (
          <p className="text-xs text-neutral-400">
            {invoice.bookingTitle ? `Linked booking: ${invoice.bookingTitle}. ` : ""}
            {invoice.quoteNumber ? `Converted from quote ${invoice.quoteNumber}.` : ""}
          </p>
        ) : null}
      </section>

      <section className="card p-5 space-y-3">
        <h3 className="font-display text-lg">Line items</h3>
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_100px_90px_auto] gap-2 items-center">
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
              <span className="text-sm text-right text-neutral-600">
                {money(Math.round((parseFloat(it.qty) || 0) * Math.round((parseFloat(it.unit) || 0) * 100)))}
              </span>
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

        <div className="flex justify-end">
          <div className="w-60 text-sm space-y-1">
            <div className="flex justify-between text-neutral-600">
              <span>Subtotal</span>
              <span>{money(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 ? (
              <div className="flex justify-between text-neutral-600">
                <span>Discount</span>
                <span>-{money(totals.discount)}</span>
              </div>
            ) : null}
            {totals.tax > 0 ? (
              <div className="flex justify-between text-neutral-600">
                <span>Tax</span>
                <span>{money(totals.tax)}</span>
              </div>
            ) : null}
            {totals.tip > 0 ? (
              <div className="flex justify-between text-neutral-600">
                <span>Tip received</span>
                <span>{money(totals.tip)}</span>
              </div>
            ) : null}
            <div className="flex justify-between font-semibold border-t border-neutral-200 pt-1">
              <span>Total</span>
              <span>{money(totals.total)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-display text-lg">Payment schedule</h3>
          {!locked ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500">Split into</span>
              {[2, 3, 4, 6, 12].map((n) => (
                <button key={n} className="btn-secondary !px-2 !py-1 text-xs" onClick={() => splitInto(n)}>
                  {n}
                </button>
              ))}
              <button className="btn-secondary !px-2 !py-1 text-xs" onClick={() => setInsts([])}>
                Clear
              </button>
            </div>
          ) : null}
        </div>
        {insts.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No schedule, the client pays the full balance in one payment. Add up to 12 instalments.
          </p>
        ) : (
          <div className="space-y-2">
            {insts.map((inst, i) => (
              <div key={i} className="grid grid-cols-[1fr_140px_110px_90px_auto] gap-2 items-center">
                <input
                  className="input"
                  placeholder={`Payment ${i + 1}`}
                  disabled={locked}
                  value={inst.label}
                  onChange={(e) => setInsts(insts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <input
                  type="date"
                  className="input"
                  disabled={locked}
                  value={inst.dueDate}
                  onChange={(e) => setInsts(insts.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))}
                />
                <input
                  className="input text-right"
                  disabled={locked}
                  value={inst.amount}
                  onChange={(e) => setInsts(insts.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                />
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inst.paid}
                    disabled={locked}
                    onChange={(e) => setInsts(insts.map((x, j) => (j === i ? { ...x, paid: e.target.checked } : x)))}
                  />
                  Paid
                </label>
                {!locked ? (
                  <button className="text-xs text-red-600 underline" onClick={() => setInsts(insts.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
            <div className="flex items-center justify-between text-xs pt-1">
              {!locked && insts.length < 12 ? (
                <button
                  className="btn-secondary !py-1.5 text-xs"
                  onClick={() =>
                    setInsts([
                      ...insts,
                      { label: `Payment ${insts.length + 1}`, dueDate: new Date().toISOString().slice(0, 10), amount: "0.00", paid: false },
                    ])
                  }
                >
                  + Instalment ({insts.length}/12)
                </button>
              ) : (
                <span />
              )}
              <span className={scheduledTotal === totals.total ? "text-emerald-600" : "text-amber-600"}>
                Scheduled {money(scheduledTotal)} of {money(totals.total)}
                {scheduledTotal !== totals.total ? ", amounts don't match the total" : " ✓"}
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="card p-5">
        <label className="label">Notes (shown on the invoice)</label>
        <textarea className="input min-h-[70px]" disabled={locked} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <p className="text-xs text-neutral-400 mt-2">Tap to Pay: accept in-person card payments from the mobile app (shown for parity; demo only).</p>
      </section>
    </div>
  );
}

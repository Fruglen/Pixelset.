"use client";

import { useMemo, useState } from "react";
import { INVOICE_TEMPLATES } from "@/lib/invoice-templates";
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
  photos = [],
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
    template: string;
    reminderSchedule: number[];
    remindersSent: number[];
    featuredPhotoUrl: string;
  };
  contacts: { id: string; name: string }[];
  photos?: { id: string; url: string; filename: string }[];
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
  const [featuredPhotoUrl, setFeaturedPhotoUrl] = useState(invoice.featuredPhotoUrl);
  const [template, setTemplate] = useState(invoice.template);
  const [schedule, setSchedule] = useState<number[]>(invoice.reminderSchedule);
  const [newOffset, setNewOffset] = useState("7");
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
      featuredPhotoUrl,
      template,
      reminderSchedule: schedule,
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
              <button className="btn-secondary" disabled={busy} onClick={() => patch({ action: "tapToPay" })}>
                Tap to Pay
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

      <section className="card p-5 space-y-3">
        <h2 className="font-display text-lg">Featured photo</h2>
        <p className="text-sm text-neutral-500">
          Shown at the top of the client's invoice and pay page. Pick one of your gallery photos or paste an
          image address.
        </p>
        {featuredPhotoUrl ? (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={featuredPhotoUrl} alt="Featured" className="w-40 h-28 object-cover rounded-md border border-neutral-200" />
            <button className="text-sm underline text-red-500" disabled={locked} onClick={() => setFeaturedPhotoUrl("")}>
              Remove
            </button>
          </div>
        ) : null}
        {photos.length > 0 ? (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={locked}
                title={p.filename}
                onClick={() => setFeaturedPhotoUrl(p.url)}
                className={`rounded-md overflow-hidden border ${
                  featuredPhotoUrl === p.url ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-200"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.filename} className="w-full h-16 object-cover" />
              </button>
            ))}
          </div>
        ) : null}
        <input
          className="input"
          placeholder="…or paste an image address (https://…)"
          disabled={locked}
          value={featuredPhotoUrl}
          onChange={(e) => setFeaturedPhotoUrl(e.target.value)}
        />
        <p className="text-xs text-neutral-400">Save the invoice to apply the change.</p>
      </section>

      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg">Template</h2>
          <a className="text-sm underline text-neutral-500" href={`/pay/${invoice.token}?template=${template}`} target="_blank" rel="noreferrer">
            Preview the client view ↗
          </a>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          {INVOICE_TEMPLATES.map((t) => (
            <label
              key={t.id}
              className={`card p-3 cursor-pointer text-sm ${template === t.id ? "ring-1 ring-neutral-900 border-neutral-900" : ""}`}
            >
              <input type="radio" className="mr-2" disabled={locked} checked={template === t.id} onChange={() => setTemplate(t.id)} />
              <span className="font-medium">{t.name}</span>
              <span className="block text-xs text-neutral-500 mt-1">{t.description}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="card p-5 space-y-3">
        <div>
          <h2 className="font-display text-lg">Payment reminders</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Emailed to the client while a balance is outstanding, relative to the due date{dueDate ? "" : " (set a due date to enable)"}.
            Edit the wording under Settings, Email templates, Invoice payment reminder.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {schedule.length === 0 ? <span className="text-sm text-neutral-400">No reminders scheduled.</span> : null}
          {schedule.map((o) => (
            <span key={o} className="inline-flex items-center gap-1.5 text-xs border border-neutral-300 rounded-full px-2.5 py-1">
              {o === 0 ? "On the due date" : o < 0 ? `${-o} day${o === -1 ? "" : "s"} before` : `${o} day${o === 1 ? "" : "s"} after`}
              {invoice.remindersSent.includes(o) ? <span className="text-emerald-600">sent</span> : null}
              <button className="text-neutral-400 hover:text-red-600" disabled={locked} onClick={() => setSchedule(schedule.filter((x) => x !== o))}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input className="input w-20" value={newOffset} onChange={(e) => setNewOffset(e.target.value)} />
          <span className="text-neutral-500">days</span>
          <button
            className="btn-secondary"
            disabled={locked}
            onClick={() => {
              const n = Math.abs(parseInt(newOffset) || 0);
              setSchedule(Array.from(new Set([...schedule, -n])).sort((a, b) => a - b));
            }}
          >
            Before due
          </button>
          <button className="btn-secondary" disabled={locked} onClick={() => setSchedule(Array.from(new Set([...schedule, 0])).sort((a, b) => a - b))}>
            On due date
          </button>
          <button
            className="btn-secondary"
            disabled={locked}
            onClick={() => {
              const n = Math.abs(parseInt(newOffset) || 0);
              setSchedule(Array.from(new Set([...schedule, n])).sort((a, b) => a - b));
            }}
          >
            After due
          </button>
        </div>
        <p className="text-xs text-neutral-400">Save the invoice to apply changes.</p>
      </section>

      <section className="card p-5">
        <label className="label">Notes (shown on the invoice)</label>
        <textarea className="input min-h-[70px]" disabled={locked} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <p className="text-xs text-neutral-400 mt-2">Tap to Pay: accept in-person card payments from the mobile app (shown for parity; demo only).</p>
      </section>
    </div>
  );
}

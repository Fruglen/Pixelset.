"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Item {
  index: number;
  description: string;
  qty: number;
  unitCents: number;
  kind: "fixed" | "optional" | "package";
  group: string;
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Phase 5B: the client builds their own selection (one package per choice
// group, any optional extras); the total recomputes live before acceptance.
export function QuoteClient({
  token,
  items,
  initial,
  taxRate,
  discountType,
  discountValue,
}: {
  token: string;
  items: Item[];
  initial: number[];
  taxRate: number;
  discountType: string;
  discountValue: number;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<number[]>(initial);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of items) if (it.kind === "package") m.set(it.group, [...(m.get(it.group) ?? []), it]);
    return Array.from(m.entries());
  }, [items]);
  const optional = items.filter((it) => it.kind === "optional");

  const totals = useMemo(() => {
    const subtotal = items.filter((it) => sel.includes(it.index)).reduce((n, it) => n + Math.round(it.qty * it.unitCents), 0);
    let discount = discountType === "PERCENT" ? Math.round((subtotal * discountValue) / 100) : discountType === "FIXED" ? discountValue : 0;
    discount = Math.min(discount, subtotal);
    const tax = Math.round(((subtotal - discount) * taxRate) / 100);
    return { subtotal, discount, tax, total: subtotal - discount + tax };
  }, [items, sel, taxRate, discountType, discountValue]);

  function pickPackage(group: string, index: number) {
    const others = items.filter((it) => it.kind === "package" && it.group === group).map((it) => it.index);
    setSel([...sel.filter((i) => !others.includes(i)), index]);
  }

  async function act(action: "accept" | "decline") {
    setError("");
    setBusy(action);
    const res = await fetch(`/api/quote/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, selection: sel }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {groups.map(([group, list]) => (
        <div key={group} className="card p-5">
          <h3 className="font-display text-lg mb-3">Choose your {group.toLowerCase()}</h3>
          <div className="space-y-2">
            {list.map((it) => (
              <label key={it.index} className={`flex items-center justify-between gap-3 border rounded-md px-3 py-2.5 cursor-pointer text-sm ${sel.includes(it.index) ? "border-neutral-900" : "border-neutral-200"}`}>
                <span className="flex items-center gap-2">
                  <input type="radio" name={`g-${group}`} checked={sel.includes(it.index)} onChange={() => pickPackage(group, it.index)} />
                  {it.description}
                </span>
                <span>{money(Math.round(it.qty * it.unitCents))}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      {optional.length ? (
        <div className="card p-5">
          <h3 className="font-display text-lg mb-3">Optional extras</h3>
          <div className="space-y-2">
            {optional.map((it) => (
              <label key={it.index} className="flex items-center justify-between gap-3 border border-neutral-200 rounded-md px-3 py-2.5 cursor-pointer text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={sel.includes(it.index)}
                    onChange={(e) => setSel(e.target.checked ? [...sel, it.index] : sel.filter((i) => i !== it.index))}
                  />
                  {it.description}
                </span>
                <span>{money(Math.round(it.qty * it.unitCents))}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
      {groups.length || optional.length ? (
        <div className="card p-5 text-sm space-y-1.5">
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
              <span>Tax ({taxRate}%)</span>
              <span>{money(totals.tax)}</span>
            </div>
          ) : null}
          <div className="flex justify-between font-semibold border-t border-neutral-200 pt-1.5">
            <span>Your total</span>
            <span>{money(totals.total)}</span>
          </div>
        </div>
      ) : null}
      <div className="card p-6 text-center space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <p className="text-sm text-neutral-600">Happy with your selection? Accepting turns it into an invoice.</p>
        <div className="flex justify-center gap-3">
          <button className="btn-primary" disabled={!!busy} onClick={() => act("accept")}>
            {busy === "accept" ? "Accepting…" : `Accept quote, ${money(totals.total)}`}
          </button>
          <button className="btn-secondary" disabled={!!busy} onClick={() => act("decline")}>
            {busy === "decline" ? "…" : "Decline"}
          </button>
        </div>
      </div>
    </div>
  );
}

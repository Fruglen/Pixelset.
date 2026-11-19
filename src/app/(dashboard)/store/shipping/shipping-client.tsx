"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatStoreMoney } from "@/lib/store-rates";

type Method = {
  id: string;
  name: string;
  speed: string;
  appliesTo: string;
  baseCents: number;
  perItemCents: number;
  freeOverCents: number;
  active: boolean;
};

type Draft = { id: string | null; name: string; speed: string; appliesTo: string; base: string; perItem: string; freeOver: string };

const APPLIES: Record<string, string> = {
  ALL: "All orders",
  SELF: "Self fulfilled items",
  LAB: "Lab fulfilled items",
};

const cents = (v: string) => Math.round((parseFloat(v || "0") || 0) * 100);

export default function ShippingClient({ methods, currency, hasLab }: { methods: Method[]; currency: string; hasLab: boolean }) {
  const router = useRouter();
  const money = (c: number) => formatStoreMoney(c, currency);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");

  function edit(m: Method) {
    setDraft({
      id: m.id,
      name: m.name,
      speed: m.speed,
      appliesTo: m.appliesTo,
      base: (m.baseCents / 100).toFixed(2),
      perItem: (m.perItemCents / 100).toFixed(2),
      freeOver: m.freeOverCents ? (m.freeOverCents / 100).toFixed(2) : "",
    });
    setError("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const res = await fetch(draft.id ? `/api/store/shipping-methods/${draft.id}` : "/api/store/shipping-methods", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        speed: draft.speed,
        appliesTo: draft.appliesTo,
        baseCents: cents(draft.base),
        perItemCents: cents(draft.perItem),
        freeOverCents: cents(draft.freeOver),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Could not save");
    setDraft(null);
    router.refresh();
  }

  async function patch(id: string, data: Record<string, unknown>) {
    await fetch(`/api/store/shipping-methods/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this shipping method?")) return;
    await fetch(`/api/store/shipping-methods/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const covers = (g: "SELF" | "LAB") => methods.some((m) => m.active && (m.appliesTo === "ALL" || m.appliesTo === g));

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-neutral-500">
          Shipping methods the client chooses from at checkout. Each method has its own rate and delivery speed, and can
          cover self fulfilled items, lab fulfilled items, or both. Orders with both kinds pick a method for each.
        </p>
        <button
          className="btn-primary shrink-0"
          onClick={() => setDraft({ id: null, name: "", speed: "", appliesTo: "ALL", base: "", perItem: "0", freeOver: "" })}
        >
          + Add method
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-sm">
        {(["SELF", "LAB"] as const).map((g) => (
          <div key={g} className="card p-3">
            <p className="font-medium">{g === "SELF" ? "Self fulfillment" : "Automatic lab fulfillment"}</p>
            <p className="text-xs text-neutral-500 mt-1">
              {covers(g)
                ? `${methods.filter((m) => m.active && (m.appliesTo === "ALL" || m.appliesTo === g)).length} method(s) offered at checkout.`
                : "No method yet, each product's flat shipping amount from its price sheet applies."}
              {g === "LAB" && !hasLab ? " You have no lab price sheet yet." : ""}
            </p>
          </div>
        ))}
      </div>

      {methods.length === 0 ? (
        <p className="text-sm text-neutral-400">No shipping methods yet, add Standard and Express for example.</p>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {methods.map((m) => (
            <div key={m.id} className={`px-4 py-3 flex items-center gap-4 text-sm ${m.active ? "" : "opacity-50"}`}>
              <div className="flex-1 min-w-0">
                <p className="font-medium">
                  {m.name}
                  {m.speed && <span className="text-neutral-400 font-normal"> · {m.speed}</span>}
                </p>
                <p className="text-xs text-neutral-500">
                  {APPLIES[m.appliesTo] ?? m.appliesTo} · {money(m.baseCents)}
                  {m.perItemCents ? ` + ${money(m.perItemCents)} each extra item` : ""}
                  {m.freeOverCents ? ` · free over ${money(m.freeOverCents)}` : ""}
                </p>
              </div>
              <button className="text-xs underline text-neutral-500" onClick={() => edit(m)}>
                Edit
              </button>
              <button className="text-xs underline text-neutral-500" onClick={() => patch(m.id, { active: !m.active })}>
                {m.active ? "Pause" : "Activate"}
              </button>
              <button className="text-xs underline text-red-500" onClick={() => remove(m.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={save} className="bg-white rounded-lg p-6 w-full max-w-md space-y-3">
            <h3 className="font-display text-lg">{draft.id ? "Edit shipping method" : "New shipping method"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Name</label>
                <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Express" required />
              </div>
              <div>
                <label className="label">Delivery speed</label>
                <input className="input" value={draft.speed} onChange={(e) => setDraft({ ...draft, speed: e.target.value })} placeholder="1-2 business days" />
              </div>
            </div>
            <div>
              <label className="label">Applies to</label>
              <select className="input" value={draft.appliesTo} onChange={(e) => setDraft({ ...draft, appliesTo: e.target.value })}>
                {Object.entries(APPLIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Rate</label>
                <input className="input" inputMode="decimal" value={draft.base} onChange={(e) => setDraft({ ...draft, base: e.target.value })} placeholder="9.00" required />
              </div>
              <div>
                <label className="label">Each extra item</label>
                <input className="input" inputMode="decimal" value={draft.perItem} onChange={(e) => setDraft({ ...draft, perItem: e.target.value })} />
              </div>
              <div>
                <label className="label">Free over</label>
                <input className="input" inputMode="decimal" value={draft.freeOver} onChange={(e) => setDraft({ ...draft, freeOver: e.target.value })} placeholder="Never" />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button className="btn-primary">{draft.id ? "Save" : "Add method"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

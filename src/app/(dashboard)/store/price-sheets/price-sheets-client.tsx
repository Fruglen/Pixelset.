"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Sheet = {
  id: string;
  name: string;
  fulfillment: string;
  lab: string;
  products: number;
  collections: number;
};
type Col = { id: string; name: string; status: string; priceSheetId: string | null; storeEnabled: boolean };

export default function PriceSheetsClient({ sheets, collections }: { sheets: Sheet[]; collections: Col[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [fulfillment, setFulfillment] = useState("SELF");
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/store/price-sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, fulfillment, lab: fulfillment === "LAB" ? "WHCC" : "" }),
    });
    const json = await res.json();
    if (!res.ok) return setError(json.error || "Could not create");
    router.push(`/store/price-sheets/${json.id}`);
  }

  async function assign(collectionId: string, priceSheetId: string) {
    const res = await fetch(`/api/collections/${collectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceSheetId: priceSheetId || null }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error || "Could not assign");
    }
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium">Price sheets</h2>
          <button className="btn-primary" onClick={() => setCreating((v) => !v)}>
            + Add Price Sheet
          </button>
        </div>

        {creating && (
          <form onSubmit={create} className="card p-4 mb-4 space-y-3 max-w-lg">
            <div>
              <label className="label">Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wedding Store" required autoFocus />
            </div>
            <div>
              <label className="label">Fulfillment (cannot be changed later, Pixieset-style)</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFulfillment("SELF")}
                  className={`border rounded-md p-3 text-left text-sm ${fulfillment === "SELF" ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-300"}`}
                >
                  <span className="font-medium block">Self Fulfillment</span>
                  <span className="text-xs text-neutral-500">You print & ship; your own shipping rates.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillment("LAB")}
                  className={`border rounded-md p-3 text-left text-sm ${fulfillment === "LAB" ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-300"}`}
                >
                  <span className="font-medium block">Automatic (WHCC)</span>
                  <span className="text-xs text-neutral-500">Lab prints & ships white-label (mock).</span>
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button className="btn-primary">Create</button>
            </div>
          </form>
        )}

        {sheets.length === 0 && !creating ? (
          <p className="text-sm text-neutral-400">No price sheets yet, create one, add products, then assign it to a collection below.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {sheets.map((s) => (
              <Link key={s.id} href={`/store/price-sheets/${s.id}`} className="card p-4 hover:border-neutral-400 transition-colors block">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{s.name}</p>
                  <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-neutral-200 text-neutral-500">
                    {s.fulfillment === "LAB" ? `Lab · ${s.lab}` : "Self-fulfilled"}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">
                  {s.products} product{s.products === 1 ? "" : "s"} · assigned to {s.collections} collection{s.collections === 1 ? "" : "s"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-medium mb-1">Assign to collections</h2>
        <p className="text-xs text-neutral-400 mb-3">
          A collection with a price sheet gets a storefront inside its client gallery.
        </p>
        <div className="card divide-y divide-neutral-100">
          {collections.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-[11px] uppercase tracking-wide text-neutral-400">{c.status}</p>
              </div>
              <select
                className="input !w-56"
                value={c.priceSheetId ?? ""}
                onChange={(e) => assign(c.id, e.target.value)}
              >
                <option value="">No store</option>
                {sheets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {collections.length === 0 && <p className="px-4 py-3 text-sm text-neutral-400">No collections yet.</p>}
        </div>
      </div>
    </div>
  );
}

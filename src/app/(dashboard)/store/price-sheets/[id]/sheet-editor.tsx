"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { id: "PRINT", label: "Prints" },
  { id: "CANVAS", label: "Canvas" },
  { id: "METAL", label: "Metal" },
  { id: "ACRYLIC", label: "Acrylic" },
  { id: "WOOD", label: "Wood" },
  { id: "ALBUM", label: "Albums & Books" },
  { id: "CARD", label: "Cards" },
  { id: "DIGITAL", label: "Digital Downloads" },
];

type Variant = { id?: string; name: string; priceCents: number };
type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  selfFulfilled: boolean;
  shippingCents: number;
  active: boolean;
  variants: Variant[];
};
type Sheet = {
  id: string;
  name: string;
  fulfillment: string;
  lab: string;
  collectionNames: string[];
  products: Product[];
};

type Draft = {
  id: string | null; // null = creating
  name: string;
  category: string;
  description: string;
  selfFulfilled: boolean;
  shipping: string; // dollars
  variants: { name: string; price: string }[]; // dollars
};

const emptyDraft = (lab: boolean): Draft => ({
  id: null,
  name: "",
  category: "PRINT",
  description: "",
  selfFulfilled: !lab,
  shipping: "0",
  variants: [{ name: "", price: "" }],
});

export default function SheetEditor({ sheet }: { sheet: Sheet }) {
  const router = useRouter();
  const isLab = sheet.fulfillment === "LAB";
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [sheetName, setSheetName] = useState(sheet.name);

  async function saveName() {
    if (sheetName.trim() === sheet.name) return;
    await fetch(`/api/store/price-sheets/${sheet.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: sheetName }),
    });
    router.refresh();
  }

  async function deleteSheet() {
    if (!confirm("Delete this price sheet? Collections using it lose their storefront.")) return;
    const res = await fetch(`/api/store/price-sheets/${sheet.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return alert(json.error || "Could not delete");
    }
    router.push("/store/price-sheets");
    router.refresh();
  }

  function editProduct(p: Product) {
    setDraft({
      id: p.id,
      name: p.name,
      category: p.category,
      description: p.description,
      selfFulfilled: p.selfFulfilled,
      shipping: (p.shippingCents / 100).toFixed(2),
      variants: p.variants.map((v) => ({ name: v.name, price: (v.priceCents / 100).toFixed(2) })),
    });
    setError("");
  }

  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError("");
    const variants = draft.variants
      .filter((v) => v.name.trim())
      .map((v) => ({ name: v.name, priceCents: Math.round(parseFloat(v.price || "0") * 100) }));
    if (variants.length === 0) return setError("Add at least one size/option with a price.");
    const payload = {
      priceSheetId: sheet.id,
      name: draft.name,
      category: draft.category,
      description: draft.description,
      selfFulfilled: draft.selfFulfilled,
      shippingCents: draft.category === "DIGITAL" ? 0 : Math.round(parseFloat(draft.shipping || "0") * 100),
      variants,
    };
    const res = await fetch(draft.id ? `/api/store/products/${draft.id}` : "/api/store/products", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setError(json.error || "Could not save");
    setDraft(null);
    router.refresh();
  }

  async function deleteProduct(id: string) {
    if (!confirm("Delete this product?")) return;
    await fetch(`/api/store/products/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function toggleActive(p: Product) {
    await fetch(`/api/store/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    router.refresh();
  }

  const byCategory = CATEGORIES.map((c) => ({
    ...c,
    products: sheet.products.filter((p) => p.category === c.id),
  })).filter((c) => c.products.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/store/price-sheets" className="text-xs text-neutral-400 hover:underline">
            ← Price sheets
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <input
              className="input !w-72 font-medium"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              onBlur={saveName}
            />
            <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-neutral-200 text-neutral-500">
              {isLab ? `Automatic · ${sheet.lab}` : "Self Fulfillment"}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {sheet.collectionNames.length > 0
              ? `Assigned to: ${sheet.collectionNames.join(", ")}`
              : "Not assigned to any collection yet."}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-danger" onClick={deleteSheet}>
            Delete sheet
          </button>
          <button className="btn-primary" onClick={() => setDraft(emptyDraft(isLab))}>
            + Add Product
          </button>
        </div>
      </div>

      {isLab && (
        <p className="text-xs text-neutral-500 card p-3">
          Lab products on this sheet are routed to {sheet.lab}-style automatic fulfillment (simulated): printed,
          packaged and shipped white-label to the client. Mark a product self-fulfilled to handle it yourself.
        </p>
      )}

      {sheet.products.length === 0 && (
        <p className="text-sm text-neutral-400">No products yet, add prints, canvases or digital downloads.</p>
      )}

      {byCategory.map((cat) => (
        <div key={cat.id}>
          <h3 className="label !mb-2">{cat.label}</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {cat.products.map((p) => (
              <div key={p.id} className={`card p-4 ${p.active ? "" : "opacity-50"}`}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{p.name}</p>
                  <div className="flex gap-2 text-xs">
                    <button className="underline text-neutral-500" onClick={() => editProduct(p)}>
                      Edit
                    </button>
                    <button className="underline text-neutral-500" onClick={() => toggleActive(p)}>
                      {p.active ? "Hide" : "Show"}
                    </button>
                    <button className="underline text-red-500" onClick={() => deleteProduct(p.id)}>
                      Delete
                    </button>
                  </div>
                </div>
                {p.description && <p className="text-xs text-neutral-500 mt-1">{p.description}</p>}
                <ul className="mt-2 text-xs text-neutral-600 space-y-0.5">
                  {p.variants.map((v) => (
                    <li key={v.id ?? v.name} className="flex justify-between">
                      <span>{v.name}</span>
                      <span>${(v.priceCents / 100).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-neutral-400 mt-2">
                  {p.category === "DIGITAL"
                    ? "Digital · 7-day download link"
                    : `${p.selfFulfilled ? "Self-fulfilled" : `Lab (${sheet.lab || "WHCC"})`} · shipping $${(p.shippingCents / 100).toFixed(2)}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {draft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={saveDraft} className="bg-white rounded-lg p-6 w-full max-w-lg space-y-3 my-8">
            <h3 className="font-display text-lg">{draft.id ? "Edit product" : "New product"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Name</label>
                <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Fine Art Print" required />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Description (optional)</label>
              <input className="input" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>

            <div>
              <label className="label">{draft.category === "DIGITAL" ? "Options & prices" : "Sizes & prices"}</label>
              <div className="space-y-2">
                {draft.variants.map((v, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="input flex-1"
                      placeholder={draft.category === "DIGITAL" ? "e.g. High-res file" : "e.g. 8×10"}
                      value={v.name}
                      onChange={(e) =>
                        setDraft({ ...draft, variants: draft.variants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })
                      }
                    />
                    <div className="relative w-28">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-neutral-400">$</span>
                      <input
                        className="input !pl-6"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={v.price}
                        onChange={(e) =>
                          setDraft({ ...draft, variants: draft.variants.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })
                        }
                      />
                    </div>
                    <button
                      type="button"
                      className="text-neutral-400 hover:text-red-500"
                      onClick={() => setDraft({ ...draft, variants: draft.variants.filter((_, j) => j !== i) })}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="text-xs underline text-neutral-500 mt-2"
                onClick={() => setDraft({ ...draft, variants: [...draft.variants, { name: "", price: "" }] })}
              >
                + Add size
              </button>
            </div>

            {draft.category !== "DIGITAL" && (
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="label">Flat shipping</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-neutral-400">$</span>
                    <input className="input !pl-6" inputMode="decimal" value={draft.shipping} onChange={(e) => setDraft({ ...draft, shipping: e.target.value })} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm pb-2">
                  <input
                    type="checkbox"
                    checked={draft.selfFulfilled}
                    onChange={(e) => setDraft({ ...draft, selfFulfilled: e.target.checked })}
                  />
                  Self-fulfilled (you print & ship)
                </label>
              </div>
            )}
            {draft.category === "DIGITAL" && (
              <p className="text-xs text-neutral-400">
                Digital products deliver an expiring 7-day download link at checkout, with your Digital Image License attached.
              </p>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button className="btn-primary">{draft.id ? "Save" : "Add product"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

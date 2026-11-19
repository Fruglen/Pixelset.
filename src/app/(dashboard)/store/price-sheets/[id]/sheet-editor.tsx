"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RECOMMENDED_PRODUCTS, suggestedFor } from "@/lib/recommended-pricing";

const CATEGORIES = [
  { id: "PRINT", label: "Prints" },
  { id: "CANVAS", label: "Canvas" },
  { id: "METAL", label: "Metal" },
  { id: "ACRYLIC", label: "Acrylic" },
  { id: "WOOD", label: "Wood" },
  { id: "FRAMED", label: "Framed Prints & Wall Art" },
  { id: "ALBUM", label: "Albums & Books" },
  { id: "CARD", label: "Cards" },
  { id: "DIGITAL", label: "Digital Downloads" },
  { id: "PACKAGE", label: "Packages" },
];

type Variant = { id?: string; name: string; priceCents: number; labCostCents: number };
type PackageComponent = { productId: string; variantId: string; qty: number };

function parseComponents(json: string): PackageComponent[] {
  try {
    const arr = JSON.parse(json || "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c) => c && typeof c.productId === "string" && typeof c.variantId === "string")
      .map((c) => ({ productId: c.productId, variantId: c.variantId, qty: Math.max(1, Math.round(Number(c.qty) || 1)) }));
  } catch {
    return [];
  }
}
type Frame = { name: string; priceCents: number };
// Categories that can offer frame choices (framed wall art requires one).
const FRAMEABLE = ["PRINT", "CANVAS", "METAL", "ACRYLIC", "WOOD", "FRAMED"];
const FRAME_PRESETS = ["Black wood frame", "White wood frame", "Natural oak frame", "Gold gallery frame", "Floating frame"];
type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  selfFulfilled: boolean;
  shippingCents: number;
  active: boolean;
  pricingMode: string;
  markupPct: number;
  packageItems: string;
  variants: Variant[];
  frames: Frame[];
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
  variants: { name: string; price: string; labCost: string }[]; // dollars
  frames: { name: string; price: string }[]; // dollars
  pricingMode: string; // FIXED | MARKUP
  markupPct: string;
  components: PackageComponent[];
};

const emptyDraft = (lab: boolean): Draft => ({
  id: null,
  name: "",
  category: "PRINT",
  description: "",
  selfFulfilled: !lab,
  shipping: "0",
  variants: [{ name: "", price: "", labCost: "" }],
  frames: [],
  pricingMode: "FIXED",
  markupPct: "",
  components: [],
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
      variants: p.variants.map((v) => ({
        name: v.name,
        price: (v.priceCents / 100).toFixed(2),
        labCost: (v.labCostCents / 100).toFixed(2),
      })),
      frames: p.frames.map((f) => ({ name: f.name, price: (f.priceCents / 100).toFixed(2) })),
      pricingMode: p.pricingMode,
      markupPct: String(p.markupPct),
      components: parseComponents(p.packageItems),
    });
    setError("");
  }

  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError("");
    const markupPct = Math.max(0, parseFloat(draft.markupPct || "0") || 0);
    const variants = draft.variants
      .filter((v) => v.name.trim())
      .map((v) => {
        const labCostCents = Math.round(parseFloat(v.labCost || "0") * 100);
        // MARKUP mode: the selling price is derived from the lab cost, never typed.
        const priceCents =
          draft.pricingMode === "MARKUP"
            ? Math.round(labCostCents * (1 + markupPct / 100))
            : Math.round(parseFloat(v.price || "0") * 100);
        return { name: v.name, priceCents, labCostCents };
      });
    if (variants.length === 0) return setError("Add at least one size/option with a price.");
    if (draft.category === "PACKAGE" && draft.components.length === 0)
      return setError("A package needs at least one component product from this sheet.");
    const frames = FRAMEABLE.includes(draft.category)
      ? draft.frames.filter((f) => f.name.trim()).map((f) => ({ name: f.name.trim(), priceCents: Math.round(parseFloat(f.price || "0") * 100) }))
      : [];
    if (draft.category === "FRAMED" && frames.length === 0) return setError("Framed wall art needs at least one frame option.");
    const payload = {
      priceSheetId: sheet.id,
      name: draft.name,
      category: draft.category,
      description: draft.description,
      selfFulfilled: draft.selfFulfilled,
      shippingCents: draft.category === "DIGITAL" ? 0 : Math.round(parseFloat(draft.shipping || "0") * 100),
      pricingMode: draft.pricingMode,
      markupPct,
      packageItems: draft.category === "PACKAGE" ? draft.components : [],
      variants,
      frames,
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
                      <span>
                        {v.labCostCents > 0 ? (
                          <span className="text-neutral-400 mr-2">lab ${(v.labCostCents / 100).toFixed(2)}</span>
                        ) : null}
                        ${(v.priceCents / 100).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
                {p.pricingMode === "MARKUP" ? (
                  <p className="text-[11px] text-neutral-500 mt-1">Priced at lab cost + {p.markupPct}% markup</p>
                ) : null}
                {p.category === "PACKAGE" ? (
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Includes:{" "}
                    {parseComponents(p.packageItems)
                      .map((c) => {
                        const cp = sheet.products.find((x) => x.id === c.productId);
                        const cv = cp?.variants.find((x) => x.id === c.variantId);
                        return cp ? `${c.qty}× ${cp.name}${cv ? ` (${cv.name})` : ""}` : "a removed product";
                      })
                      .join(", ") || "nothing yet"}
                  </p>
                ) : null}
                {p.frames.length > 0 && (
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Frames: {p.frames.map((f) => `${f.name}${f.priceCents ? ` +$${(f.priceCents / 100).toFixed(2)}` : ""}`).join(", ")}
                  </p>
                )}
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
            {!draft.id ? (
              <div className="bg-neutral-50 border border-neutral-100 rounded-md p-3 space-y-2">
                <label className="label">Start from recommended pricing</label>
                <select
                  className="input"
                  value=""
                  onChange={(e) => {
                    const t = RECOMMENDED_PRODUCTS.find((x) => x.name === e.target.value);
                    if (!t) return;
                    setDraft({
                      ...draft,
                      name: t.name,
                      category: t.category,
                      description: t.blurb,
                      variants: t.variants.map((x) => ({
                        name: x.name,
                        price: (x.suggestedCents / 100).toFixed(2),
                        labCost: (x.labCostCents / 100).toFixed(2),
                      })),
                    });
                  }}
                >
                  <option value="">Choose a template…</option>
                  {RECOMMENDED_PRODUCTS.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}: {t.variants.map((x) => `${x.name} $${(x.suggestedCents / 100).toFixed(0)}`).join(", ")}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-400">
                  Suggested prices come from typical lab costs with the markup photographers commonly charge. Adjust anything before
                  saving.
                </p>
              </div>
            ) : null}
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
                  <div key={i}>
                    <div className="flex gap-2">
                      <input
                        className="input flex-1"
                        placeholder={draft.category === "DIGITAL" ? "e.g. High-res file" : "e.g. 8×10"}
                        value={v.name}
                        onChange={(e) =>
                          setDraft({ ...draft, variants: draft.variants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })
                        }
                      />
                    <div className="relative w-28" title="Lab cost, what the lab charges you">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-neutral-400">$</span>
                      <input
                        className="input !pl-6"
                        inputMode="decimal"
                        placeholder="Lab cost"
                        value={v.labCost}
                        onChange={(e) =>
                          setDraft({ ...draft, variants: draft.variants.map((x, j) => (j === i ? { ...x, labCost: e.target.value } : x)) })
                        }
                      />
                    </div>
                    {draft.pricingMode === "MARKUP" ? (
                      <div className="w-28 flex items-center text-sm text-neutral-600" title="Selling price, worked out from the lab cost and your markup">
                        = $
                        {(
                          (Math.round(parseFloat(v.labCost || "0") * 100) *
                            (1 + Math.max(0, parseFloat(draft.markupPct || "0") || 0) / 100)) /
                          100
                        ).toFixed(2)}
                      </div>
                    ) : (
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
                    )}
                      <button
                        type="button"
                        className="text-neutral-400 hover:text-red-500"
                        onClick={() => setDraft({ ...draft, variants: draft.variants.filter((_, j) => j !== i) })}
                      >
                        ✕
                      </button>
                    </div>
                    {(() => {
                      const sug = suggestedFor(draft.category, v.name);
                      if (!sug) return null;
                      return (
                        <p className="text-[11px] text-neutral-400 mt-1">
                          Lab cost about ${(sug.labCostCents / 100).toFixed(2)} · recommended price $
                          {(sug.suggestedCents / 100).toFixed(2)}{" "}
                          <button
                            type="button"
                            className="underline"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                variants: draft.variants.map((x, j) =>
                                  j === i ? { ...x, price: (sug.suggestedCents / 100).toFixed(2) } : x
                                ),
                              })
                            }
                          >
                            Use it
                          </button>
                        </p>
                      );
                    })()}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="text-xs underline text-neutral-500 mt-2"
                onClick={() => setDraft({ ...draft, variants: [...draft.variants, { name: "", price: "", labCost: "" }] })}
              >
                + Add size
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Pricing</label>
                <select
                  className="input"
                  value={draft.pricingMode}
                  onChange={(e) => setDraft({ ...draft, pricingMode: e.target.value })}
                >
                  <option value="FIXED">Fixed prices, typed per size</option>
                  <option value="MARKUP">Markup, price from lab cost</option>
                </select>
              </div>
              {draft.pricingMode === "MARKUP" ? (
                <div>
                  <label className="label">Markup % over lab cost</label>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder="e.g. 150"
                    value={draft.markupPct}
                    onChange={(e) => setDraft({ ...draft, markupPct: e.target.value })}
                  />
                </div>
              ) : (
                <p className="text-xs text-neutral-400 self-end pb-2">
                  Lab cost is optional on fixed pricing; it feeds your payout maths either way.
                </p>
              )}
            </div>

            {draft.category === "PACKAGE" && (
              <div>
                <label className="label">What is in the package</label>
                <div className="space-y-2">
                  {draft.components.map((c, i) => {
                    const comp = sheet.products.find((p) => p.id === c.productId);
                    return (
                      <div key={i} className="flex gap-2 items-center">
                        <select
                          className="input flex-1"
                          value={c.productId}
                          onChange={(e) => {
                            const prod = sheet.products.find((p) => p.id === e.target.value);
                            setDraft({
                              ...draft,
                              components: draft.components.map((x, j) =>
                                j === i ? { productId: e.target.value, variantId: prod?.variants[0]?.id ?? "", qty: x.qty } : x
                              ),
                            });
                          }}
                        >
                          <option value="">Choose a product…</option>
                          {sheet.products
                            .filter((p) => p.id !== draft.id && p.category !== "PACKAGE")
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                        <select
                          className="input w-32"
                          value={c.variantId}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              components: draft.components.map((x, j) => (j === i ? { ...x, variantId: e.target.value } : x)),
                            })
                          }
                        >
                          {(comp?.variants ?? []).map((v) => (
                            <option key={v.id ?? v.name} value={v.id ?? ""}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                        <input
                          className="input w-16"
                          type="number"
                          min={1}
                          max={50}
                          value={c.qty}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              components: draft.components.map((x, j) =>
                                j === i ? { ...x, qty: Math.max(1, Math.min(50, Number(e.target.value) || 1)) } : x
                              ),
                            })
                          }
                        />
                        <button
                          type="button"
                          className="text-neutral-400 hover:text-red-500"
                          onClick={() => setDraft({ ...draft, components: draft.components.filter((_, j) => j !== i) })}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="text-xs underline text-neutral-500 mt-2"
                  onClick={() => setDraft({ ...draft, components: [...draft.components, { productId: "", variantId: "", qty: 1 }] })}
                >
                  + Add component
                </button>
                <p className="text-xs text-neutral-400 mt-1">
                  Components are fulfilled as part of the bundle: prints go to the lab with the order, digital
                  components get their own download links.
                </p>
              </div>
            )}

            {FRAMEABLE.includes(draft.category) && (
              <div>
                <label className="label">Frame options{draft.category === "FRAMED" ? " (at least one)" : " (optional, added to the size price)"}</label>
                <div className="space-y-2">
                  {draft.frames.map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="input flex-1"
                        list="frame-presets"
                        placeholder="e.g. Black wood frame"
                        value={f.name}
                        onChange={(e) => setDraft({ ...draft, frames: draft.frames.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                      />
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-neutral-400">+$</span>
                        <input
                          className="input !pl-7"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={f.price}
                          onChange={(e) => setDraft({ ...draft, frames: draft.frames.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })}
                        />
                      </div>
                      <button type="button" className="text-neutral-400 hover:text-red-500" onClick={() => setDraft({ ...draft, frames: draft.frames.filter((_, j) => j !== i) })}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <datalist id="frame-presets">
                  {FRAME_PRESETS.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
                <button type="button" className="text-xs underline text-neutral-500 mt-2" onClick={() => setDraft({ ...draft, frames: [...draft.frames, { name: "", price: "" }] })}>
                  + Add frame option
                </button>
              </div>
            )}

            {draft.category !== "DIGITAL" && (
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="label">Flat shipping (used when no shipping method covers it)</label>
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

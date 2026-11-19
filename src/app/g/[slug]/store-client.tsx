"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GalleryPhoto } from "./gallery-view";
import { COUNTRIES, TAX_REGIONS, formatStoreMoney } from "@/lib/store-rates";

export type StoreData = {
  products: {
    id: string;
    name: string;
    category: string;
    description: string;
    variants: { id: string; name: string; priceCents: number }[];
    frames?: { name: string; priceCents: number }[];
    includes?: string[];
  }[];
  storeOpen?: boolean;
  closedMessage?: string;
  currency?: string;
  taxMode?: string;
  taxEnabled: boolean;
  taxRate: number;
  digitalLicense: string;
  termsOfSale: string;
};

type CartLine = {
  productId: string;
  variantId: string;
  photoId: string;
  qty: number;
  frame?: string; // Phase 5B: chosen frame option name
  // display snapshots
  productName: string;
  variantName: string;
  unitCents: number;
  photoUrl: string;
  photoName: string;
};

type Totals = {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  giftCard: number;
  total: number;
  couponError: string;
  giftCardError: string;
  freeProductName: string;
};

// Store currency (set from the photographer's store settings on each render).
let storeCurrency = "USD";
const money = (c: number) => formatStoreMoney(c, storeCurrency);

type ShippingGroup = {
  group: string;
  label: string;
  options: { id: string; name: string; speed: string; cents: number }[];
  selectedId: string;
  selectedName: string;
  cents: number;
};
type PaymentMethod = { id: string; label: string; instructions?: string };

const CATEGORY_LABELS: Record<string, string> = {
  PRINT: "Prints",
  CANVAS: "Canvas",
  METAL: "Metal",
  ACRYLIC: "Acrylic",
  WOOD: "Wood",
  FRAMED: "Framed Prints & Wall Art",
  ALBUM: "Albums & Books",
  CARD: "Cards",
  DIGITAL: "Digital Downloads",
  PACKAGE: "Packages",
};

export function useGalleryStore(slug: string, store: StoreData | null) {
  const storageKey = `pxl_cart_${slug}`;
  const [cart, setCart] = useState<CartLine[]>([]);
  const [buyPhoto, setBuyPhoto] = useState<GalleryPhoto | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Hydrate cart from localStorage
  useEffect(() => {
    if (!store) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(
    (next: CartLine[]) => {
      setCart(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
    },
    [storageKey]
  );

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  storeCurrency = store?.currency || "USD";
  const closed = !!store && store.storeOpen === false;

  const element = closed ? (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-white text-ink text-sm rounded-full shadow-lg px-5 py-2.5 border border-neutral-200">
      {store?.closedMessage || "The store is closed right now, please check back soon."}
    </div>
  ) : store ? (
    <>
      {buyPhoto && (
        <BuyDialog
          store={store}
          photo={buyPhoto}
          onClose={() => setBuyPhoto(null)}
          onAdd={(line) => {
            const existing = cart.find(
              (l) =>
                l.productId === line.productId &&
                l.variantId === line.variantId &&
                l.photoId === line.photoId &&
                (l.frame ?? "") === (line.frame ?? "")
            );
            const next = existing
              ? cart.map((l) => (l === existing ? { ...l, qty: l.qty + line.qty } : l))
              : [...cart, line];
            persist(next);
            setBuyPhoto(null);
            setCartOpen(true);
          }}
        />
      )}
      {cartOpen && (
        <CartDrawer
          cart={cart}
          onClose={() => setCartOpen(false)}
          onRemove={(i) => persist(cart.filter((_, j) => j !== i))}
          onQty={(i, qty) => persist(cart.map((l, j) => (j === i ? { ...l, qty } : l)))}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
        />
      )}
      {checkoutOpen && (
        <CheckoutDialog
          slug={slug}
          store={store}
          cart={cart}
          onClose={() => setCheckoutOpen(false)}
          onComplete={() => persist([])}
        />
      )}
    </>
  ) : null;

  return {
    enabled: !!store && !closed && store.products.length > 0,
    cartCount,
    buy: (photo: GalleryPhoto) => setBuyPhoto(photo),
    openCart: () => setCartOpen(true),
    element,
  };
}

// ---------------------------------------------------------------- buy dialog

function BuyDialog({
  store,
  photo,
  onClose,
  onAdd,
}: {
  store: StoreData;
  photo: GalleryPhoto;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
}) {
  const grouped = useMemo(() => {
    const cats = new Map<string, StoreData["products"]>();
    for (const p of store.products) {
      if (!cats.has(p.category)) cats.set(p.category, []);
      cats.get(p.category)!.push(p);
    }
    return Array.from(cats.entries());
  }, [store.products]);

  const [productId, setProductId] = useState(store.products[0]?.id ?? "");
  const product = store.products.find((p) => p.id === productId) ?? store.products[0];
  const [variantId, setVariantId] = useState(product?.variants[0]?.id ?? "");
  const variant = product?.variants.find((v) => v.id === variantId) ?? product?.variants[0];
  const [qty, setQty] = useState(1);
  const [frameName, setFrameName] = useState("");
  const frames = product?.frames ?? [];
  const frame = frames.find((f) => f.name === frameName);
  const unit = (variant?.priceCents ?? 0) + (frame?.priceCents ?? 0);

  useEffect(() => {
    setVariantId(product?.variants[0]?.id ?? "");
    setQty(1);
    setFrameName("");
  }, [productId, product]);

  if (!product || !variant) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-2xl text-ink flex flex-col md:flex-row overflow-hidden max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="md:w-1/2 bg-neutral-100 flex items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt={photo.filename} className="max-h-72 md:max-h-96 object-contain" />
        </div>
        <div className="md:w-1/2 p-5 space-y-3 overflow-y-auto">
          <div className="flex items-start justify-between">
            <h3 className="font-display text-lg">Buy this photo</h3>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900">✕</button>
          </div>
          <p className="text-xs text-neutral-400 -mt-2">{photo.filename}</p>

          <div>
            <label className="label">Product</label>
            <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {grouped.map(([cat, products]) => (
                <optgroup key={cat} label={CATEGORY_LABELS[cat] ?? cat}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {product.description && <p className="text-xs text-neutral-500 mt-1">{product.description}</p>}
            {product.includes && product.includes.length > 0 && (
              <p className="text-xs text-neutral-600 mt-1">
                <span className="font-medium">Includes:</span> {product.includes.join(", ")}
              </p>
            )}
          </div>

          <div>
            <label className="label">{product.category === "DIGITAL" ? "Option" : "Size"}</label>
            <div className="space-y-1.5">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariantId(v.id)}
                  className={`w-full flex justify-between items-center border rounded-md px-3 py-2 text-sm ${
                    v.id === variant.id ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-300 hover:border-neutral-500"
                  }`}
                >
                  <span>{v.name}</span>
                  <span className="font-medium">{money(v.priceCents)}</span>
                </button>
              ))}
            </div>
          </div>

          {frames.length > 0 && (
            <div>
              <label className="label">Frame</label>
              <select className="input" value={frameName} onChange={(e) => setFrameName(e.target.value)}>
                <option value="">{product.category === "FRAMED" ? "Choose a frame" : "No frame"}</option>
                {frames.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name}
                    {f.priceCents ? `, +${money(f.priceCents)}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {product.category !== "DIGITAL" ? (
            <div>
              <label className="label">Quantity</label>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-secondary !px-3" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
                <span className="w-8 text-center text-sm">{qty}</span>
                <button type="button" className="btn-secondary !px-3" onClick={() => setQty(Math.min(50, qty + 1))}>+</button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-400">Delivered as a secure download link valid for 7 days.</p>
          )}

          <button
            className="btn-primary w-full"
            disabled={product.category === "FRAMED" && frames.length > 0 && !frame}
            onClick={() =>
              onAdd({
                productId: product.id,
                variantId: variant.id,
                photoId: photo.id,
                qty: product.category === "DIGITAL" ? 1 : qty,
                frame: frame?.name,
                productName: product.name,
                variantName: frame ? `${variant.name}, ${frame.name}` : variant.name,
                unitCents: unit,
                photoUrl: photo.url,
                photoName: photo.filename,
              })
            }
          >
            Add to cart, {money(unit * (product.category === "DIGITAL" ? 1 : qty))}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- cart drawer

function CartDrawer({
  cart,
  onClose,
  onRemove,
  onQty,
  onCheckout,
}: {
  cart: CartLine[];
  onClose: () => void;
  onRemove: (index: number) => void;
  onQty: (index: number, qty: number) => void;
  onCheckout: () => void;
}) {
  const subtotal = cart.reduce((s, l) => s + l.qty * l.unitCents, 0);
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/40" onClick={onClose}>
      <aside className="w-full max-w-md bg-white h-full flex flex-col text-ink" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-neutral-200">
          <h2 className="font-display text-xl">Your Cart</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cart.length === 0 && <p className="text-sm text-neutral-400">Your cart is empty, tap the bag icon on any photo.</p>}
          {cart.map((l, i) => (
            <div key={`${l.productId}-${l.variantId}-${l.photoId}-${l.frame ?? ""}`} className="flex gap-3 items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.photoUrl} alt="" className="h-16 w-16 object-cover rounded" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {l.productName}, {l.variantName}
                </p>
                <p className="text-xs text-neutral-400 truncate">{l.photoName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <button className="text-xs border rounded px-1.5" onClick={() => onQty(i, Math.max(1, l.qty - 1))}>−</button>
                  <span className="text-xs">{l.qty}</span>
                  <button className="text-xs border rounded px-1.5" onClick={() => onQty(i, Math.min(50, l.qty + 1))}>+</button>
                  <button className="text-xs underline text-red-500 ml-2" onClick={() => onRemove(i)}>
                    Remove
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium shrink-0">{money(l.qty * l.unitCents)}</p>
            </div>
          ))}
        </div>
        <div className="p-5 border-t border-neutral-200 space-y-3">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span className="font-medium">{money(subtotal)}</span>
          </div>
          <button className="btn-primary w-full" disabled={cart.length === 0} onClick={onCheckout}>
            Checkout
          </button>
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- checkout

function CheckoutDialog({
  slug,
  store,
  cart,
  onClose,
  onComplete,
}: {
  slug: string;
  store: StoreData;
  cart: CartLine[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [coupon, setCoupon] = useState("");
  const [giftCard, setGiftCard] = useState("");
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [country, setCountry] = useState("US");
  const [region, setRegion] = useState("");
  const [shipSel, setShipSel] = useState<Record<string, string>>({});
  const [payMethod, setPayMethod] = useState("");
  const [groups, setGroups] = useState<ShippingGroup[]>([]);
  const [payMethods, setPayMethods] = useState<PaymentMethod[]>([]);
  const [taxLabel, setTaxLabel] = useState("");
  const [totals, setTotals] = useState<Totals | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{
    orderNumber: string;
    totals: Totals;
    downloads: { photoName: string; productName: string; url: string; expires: string }[];
    awaitingPayment: boolean;
    offlineInstructions: string;
    emailDelivered: boolean;
  } | null>(null);

  const hasPhysical = cart.some((l) => {
    const p = store.products.find((x) => x.id === l.productId);
    return p?.category !== "DIGITAL";
  });

  const lines = cart.map((l) => ({ productId: l.productId, variantId: l.variantId, photoId: l.photoId, qty: l.qty, frame: l.frame ?? "" }));
  const regions = TAX_REGIONS.filter((r) => r.country === country);
  const extras = { country: country === "OTHER" ? "" : country, region, shipping: shipSel, paymentMethod: payMethod };

  const preview = useCallback(async () => {
    const res = await fetch(`/api/gallery/${slug}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines, couponCode: coupon, giftCardCode: giftCard, ...extras, confirm: false }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setError("");
      setTotals(json.totals);
      setGroups(json.shippingGroups ?? []);
      setTaxLabel(json.taxLabel ?? "");
      setPayMethods(json.paymentMethods ?? []);
      if (!payMethod && json.paymentMethods?.[0]) setPayMethod(json.paymentMethods[0].id);
    } else setError(json.error || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupon, giftCard, slug, JSON.stringify(lines), JSON.stringify(extras)]);

  useEffect(() => {
    preview();
  }, [preview]);

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/gallery/${slug}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines,
        couponCode: coupon,
        giftCardCode: giftCard,
        customerName: name,
        customerEmail: email,
        shippingAddress: address,
        ...extras,
        confirm: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error || "Could not place the order");
    setDone({
      orderNumber: json.orderNumber,
      totals: json.totals,
      downloads: json.downloads ?? [],
      awaitingPayment: !!json.awaitingPayment,
      offlineInstructions: json.offlineInstructions ?? "",
      emailDelivered: !!json.emailDelivered,
    });
    onComplete();
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg w-full max-w-md text-ink p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="text-center">
            <p className="text-3xl mb-2">✓</p>
            <h3 className="font-display text-xl">Thank you, order {done.orderNumber}</h3>
            <p className="text-sm text-neutral-500 mt-1">
              {done.emailDelivered
                ? "A confirmation email with your order details is on its way."
                : "Your order was received. Email is not connected for this store, so keep this page for your records."}{" "}
              {done.awaitingPayment
                ? `${money(done.totals.total)} is due, paid offline.`
                : done.totals.total > 0
                  ? `${money(done.totals.total)} charged (mocked per the owner's payments exclusion).`
                  : "Fully covered by gift card."}
            </p>
          </div>
          {done.awaitingPayment && (
            <div className="border border-amber-200 bg-amber-50 rounded-md p-4 text-sm space-y-1">
              <p className="font-medium">How to pay</p>
              <p className="text-neutral-600 whitespace-pre-line">
                {done.offlineInstructions || "The photographer will contact you with payment details."}
              </p>
              <p className="text-xs text-neutral-500">Your order is processed, and any download links are emailed, once payment is received.</p>
            </div>
          )}
          {done.downloads.length > 0 && (
            <div className="border border-neutral-200 rounded-md p-4 space-y-2">
              <p className="text-sm font-medium">Your digital downloads</p>
              <p className="text-xs text-neutral-400">Links are valid for 7 days.</p>
              {done.downloads.map((d) => (
                <a key={d.url} href={d.url} className="block text-sm underline" download>
                  ⬇ {d.photoName}, {d.productName}
                </a>
              ))}
              <p className="text-[11px] text-neutral-400 whitespace-pre-line border-t border-neutral-100 pt-2">
                {store.digitalLicense}
              </p>
            </div>
          )}
          <button className="btn-primary w-full" onClick={onClose}>
            Back to gallery
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={placeOrder}
        className="bg-white rounded-lg w-full max-w-lg text-ink p-6 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl">Checkout</h3>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-900">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </div>
        {hasPhysical && (
          <div>
            <label className="label">Shipping address</label>
            <textarea className="input h-16" value={address} onChange={(e) => setAddress(e.target.value)} required />
          </div>
        )}
        {(hasPhysical || store.taxEnabled) && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Country</label>
              <select
                className="input"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setRegion("");
                }}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{country === "CA" ? "Province" : "State"}</label>
              {regions.length > 0 ? (
                <select className="input" value={region} onChange={(e) => setRegion(e.target.value)} required={store.taxEnabled && store.taxMode === "AUTO"}>
                  <option value="">Choose</option>
                  {regions.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="input" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region" />
              )}
            </div>
          </div>
        )}
        {groups.map((g) =>
          g.options.length > 0 ? (
            <div key={g.group}>
              <label className="label">Shipping{groups.length > 1 ? `, ${g.label.toLowerCase()}` : ""}</label>
              <div className="space-y-1.5">
                {g.options.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm border border-neutral-200 rounded-md px-3 py-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`ship-${g.group}`}
                      checked={g.selectedId === o.id}
                      onChange={() => setShipSel({ ...shipSel, [g.group]: o.id })}
                    />
                    <span className="flex-1">
                      {o.name}
                      {o.speed && <span className="text-xs text-neutral-400"> · {o.speed}</span>}
                    </span>
                    <span className="font-medium">{o.cents === 0 ? "Free" : money(o.cents)}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Coupon code</label>
            <input className="input uppercase" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Optional" />
            {totals?.couponError && <p className="text-xs text-red-600 mt-1">{totals.couponError}</p>}
            {totals && !totals.couponError && coupon && (
              <p className="text-xs text-green-600 mt-1">
                Applied{totals.freeProductName ? `, ${totals.freeProductName} free` : ""}
              </p>
            )}
          </div>
          <div>
            <label className="label">Gift card</label>
            <input className="input uppercase" value={giftCard} onChange={(e) => setGiftCard(e.target.value.toUpperCase())} placeholder="GC-…" />
            {totals?.giftCardError && <p className="text-xs text-red-600 mt-1">{totals.giftCardError}</p>}
          </div>
        </div>

        {totals && (
          <div className="border border-neutral-200 rounded-md p-3 text-sm space-y-1">
            <Row label="Subtotal" value={money(totals.subtotal)} />
            {totals.discount > 0 && <Row label="Discount" value={`−${money(totals.discount)}`} />}
            {hasPhysical && <Row label="Shipping" value={totals.shipping === 0 ? "Free" : money(totals.shipping)} />}
            {store.taxEnabled && <Row label={taxLabel || "Tax"} value={money(totals.tax)} />}
            {totals.giftCard > 0 && <Row label="Gift card" value={`−${money(totals.giftCard)}`} />}
            <div className="flex justify-between font-medium border-t border-neutral-100 pt-1">
              <span>Total due</span>
              <span>{money(totals.total)}</span>
            </div>
          </div>
        )}

        {(totals?.total ?? 1) > 0 && payMethods.length > 1 && (
          <div>
            <label className="label">Payment</label>
            <div className="flex gap-4 text-sm">
              {payMethods.map((m) => (
                <label key={m.id} className="flex items-center gap-2">
                  <input type="radio" name="pay" checked={payMethod === m.id} onChange={() => setPayMethod(m.id)} />
                  {m.id === "card" ? "Card" : "Pay offline"}
                </label>
              ))}
            </div>
          </div>
        )}
        {(totals?.total ?? 1) > 0 && payMethod === "card" && (
          <div>
            <label className="label">Card number (mocked per the owner&rsquo;s payments exclusion, any number works)</label>
            <input className="input font-mono" value={card} onChange={(e) => setCard(e.target.value)} />
          </div>
        )}
        {(totals?.total ?? 1) > 0 && payMethod === "offline" && (
          <p className="text-xs text-neutral-600 bg-neutral-50 rounded-md p-3 whitespace-pre-line">
            {payMethods.find((m) => m.id === "offline")?.instructions || "The photographer will contact you with payment details."}
          </p>
        )}
        {payMethods.length === 0 && (totals?.total ?? 0) > 0 && (
          <p className="text-xs text-red-600">This store has no payment method switched on.</p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {store.termsOfSale && <p className="text-[11px] text-neutral-400">{store.termsOfSale}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy
            ? "Placing order…"
            : (totals && totals.total === 0) || payMethod === "offline"
              ? "Place order"
              : `Pay ${totals ? money(totals.total) : ""}`}
        </button>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-neutral-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

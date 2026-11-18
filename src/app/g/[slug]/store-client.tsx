"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GalleryPhoto } from "./gallery-view";

export type StoreData = {
  products: {
    id: string;
    name: string;
    category: string;
    description: string;
    variants: { id: string; name: string; priceCents: number }[];
  }[];
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

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

const CATEGORY_LABELS: Record<string, string> = {
  PRINT: "Prints",
  CANVAS: "Canvas",
  METAL: "Metal",
  ACRYLIC: "Acrylic",
  WOOD: "Wood",
  ALBUM: "Albums & Books",
  CARD: "Cards",
  DIGITAL: "Digital Downloads",
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

  const element = store ? (
    <>
      {buyPhoto && (
        <BuyDialog
          store={store}
          photo={buyPhoto}
          onClose={() => setBuyPhoto(null)}
          onAdd={(line) => {
            const existing = cart.find(
              (l) => l.productId === line.productId && l.variantId === line.variantId && l.photoId === line.photoId
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
    enabled: !!store && store.products.length > 0,
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

  useEffect(() => {
    setVariantId(product?.variants[0]?.id ?? "");
    setQty(1);
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
            onClick={() =>
              onAdd({
                productId: product.id,
                variantId: variant.id,
                photoId: photo.id,
                qty: product.category === "DIGITAL" ? 1 : qty,
                productName: product.name,
                variantName: variant.name,
                unitCents: variant.priceCents,
                photoUrl: photo.url,
                photoName: photo.filename,
              })
            }
          >
            Add to cart, {money(variant.priceCents * (product.category === "DIGITAL" ? 1 : qty))}
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
            <div key={`${l.productId}-${l.variantId}-${l.photoId}`} className="flex gap-3 items-start">
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
  const [totals, setTotals] = useState<Totals | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{
    orderNumber: string;
    totals: Totals;
    downloads: { photoName: string; productName: string; url: string; expires: string }[];
  } | null>(null);

  const hasPhysical = cart.some((l) => {
    const p = store.products.find((x) => x.id === l.productId);
    return p?.category !== "DIGITAL";
  });

  const lines = cart.map((l) => ({ productId: l.productId, variantId: l.variantId, photoId: l.photoId, qty: l.qty }));

  const preview = useCallback(async () => {
    const res = await fetch(`/api/gallery/${slug}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines, couponCode: coupon, giftCardCode: giftCard, confirm: false }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) setTotals(json.totals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupon, giftCard, slug, JSON.stringify(lines)]);

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
        confirm: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(json.error || "Could not place the order");
    setDone({ orderNumber: json.orderNumber, totals: json.totals, downloads: json.downloads ?? [] });
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
              A confirmation was sent to the photographer.{" "}
              {done.totals.total > 0 ? `${money(done.totals.total)} charged (mock payment).` : "Fully covered by gift card."}
            </p>
          </div>
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
            {store.taxEnabled && <Row label={`Tax (${store.taxRate}%)`} value={money(totals.tax)} />}
            {totals.giftCard > 0 && <Row label="Gift card" value={`−${money(totals.giftCard)}`} />}
            <div className="flex justify-between font-medium border-t border-neutral-100 pt-1">
              <span>Total due</span>
              <span>{money(totals.total)}</span>
            </div>
          </div>
        )}

        {(totals?.total ?? 1) > 0 && (
          <div>
            <label className="label">Card number (mock payment, any number works)</label>
            <input className="input font-mono" value={card} onChange={(e) => setCard(e.target.value)} />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {store.termsOfSale && <p className="text-[11px] text-neutral-400">{store.termsOfSale}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Placing order…" : totals && totals.total === 0 ? "Place order" : `Pay ${totals ? money(totals.total) : ""}`}
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

import { randomBytes } from "crypto";
import { db } from "./db";

// ---------------------------------------------------------------- catalog

export const PRODUCT_CATEGORIES = [
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
] as const;

export function categoryLabel(id: string): string {
  return PRODUCT_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export const ORDER_STATUSES = ["NEW", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELLED"] as const;

export async function nextOrderNumber(userId: string): Promise<string> {
  const count = await db.order.count({ where: { userId } });
  return `ORD-${String(count + 1).padStart(4, "0")}`;
}

export async function getStoreProfile(userId: string) {
  const existing = await db.storeProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  return db.storeProfile.create({
    data: {
      userId,
      digitalLicense:
        "Personal-use license: images may be printed and shared for personal, non-commercial purposes. Resale, commercial use and editing beyond cropping require written permission from the photographer.",
    },
  });
}

// ---------------------------------------------------------------- checkout math

export interface CartLine {
  productId: string;
  variantId: string;
  photoId: string;
  qty: number;
}

export interface PricedLine {
  productId: string;
  productName: string;
  variantName: string;
  category: string;
  photoId: string;
  photoUrl: string;
  photoName: string;
  qty: number;
  unitCents: number;
  shippingCents: number; // per-product flat shipping (counted once per product line)
  isDigital: boolean;
  selfFulfilled?: boolean; // Phase 5B: shipping group
  frameName?: string; // Phase 5B: chosen frame (price included in unitCents)
}

export interface CheckoutTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  giftCard: number;
  total: number; // amount charged after gift card
  couponError: string;
  giftCardError: string;
  freeProductName: string;
}

/**
 * Compute checkout totals: coupon (percent / fixed / free shipping / free product),
 * automatic tax, gift-card application. Mirrors Pixieset's checkout order of operations.
 */
export function computeCheckout(opts: {
  lines: PricedLine[];
  coupon: {
    type: string;
    value: number;
    minSpendCents: number;
  } | null;
  couponError?: string;
  taxEnabled: boolean;
  taxRate: number;
  giftCardBalance: number | null;
  giftCardError?: string;
  shippingCents?: number; // Phase 5B: quoted from shipping methods (overrides per product flat)
  taxShipping?: boolean; // Phase 5B: tax applies to shipping too
}): CheckoutTotals {
  const subtotal = opts.lines.reduce((s, l) => s + l.qty * l.unitCents, 0);
  // Flat shipping: counted once per distinct physical line.
  let shipping =
    opts.shippingCents ?? opts.lines.filter((l) => !l.isDigital).reduce((s, l) => s + l.shippingCents, 0);

  let discount = 0;
  let couponError = opts.couponError ?? "";
  let freeProductName = "";
  if (opts.coupon && !couponError) {
    if (subtotal < opts.coupon.minSpendCents) {
      couponError = `Coupon requires a minimum spend of $${(opts.coupon.minSpendCents / 100).toFixed(2)}`;
    } else if (opts.coupon.type === "PERCENT") {
      discount = Math.round((subtotal * opts.coupon.value) / 100);
    } else if (opts.coupon.type === "FIXED") {
      discount = Math.min(opts.coupon.value, subtotal);
    } else if (opts.coupon.type === "FREE_SHIPPING") {
      discount = 0;
      shipping = 0;
    } else if (opts.coupon.type === "FREE_PRODUCT") {
      // Cheapest single unit in the cart is free.
      const cheapest = [...opts.lines].sort((a, b) => a.unitCents - b.unitCents)[0];
      if (cheapest) {
        discount = cheapest.unitCents;
        freeProductName = `${cheapest.productName}${cheapest.variantName ? ` (${cheapest.variantName})` : ""}`;
      }
    }
  }
  discount = Math.min(discount, subtotal);

  const taxable = subtotal - discount;
  const tax = opts.taxEnabled ? Math.round(((taxable + (opts.taxShipping ? shipping : 0)) * opts.taxRate) / 100) : 0;
  const preGift = taxable + shipping + tax;

  let giftCard = 0;
  if (opts.giftCardBalance !== null && !opts.giftCardError) {
    giftCard = Math.min(opts.giftCardBalance, preGift);
  }

  return {
    subtotal,
    discount,
    shipping,
    tax,
    giftCard,
    total: preGift - giftCard,
    couponError,
    giftCardError: opts.giftCardError ?? "",
    freeProductName,
  };
}

export function newDownloadToken(): string {
  return randomBytes(20).toString("hex");
}

export function downloadExpiry(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days, per Pixieset
}

export function giftCardCode(): string {
  // GC-XXXX-XXXX (unambiguous alphabet)
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const pick = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `GC-${pick()}-${pick()}`;
}

/** Validate a coupon code for a user at checkout time. Returns the coupon or an error. */
export async function resolveCoupon(userId: string, code: string) {
  if (!code.trim()) return { coupon: null, error: "" };
  const coupon = await db.coupon.findUnique({
    where: { userId_code: { userId, code: code.trim().toUpperCase() } },
  });
  if (!coupon) return { coupon: null, error: "Unknown coupon code" };
  if (!coupon.active) return { coupon: null, error: "This coupon is no longer active" };
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now())
    return { coupon: null, error: "This coupon has expired" };
  if (coupon.useLimit !== null && coupon.useCount >= coupon.useLimit)
    return { coupon: null, error: "This coupon has reached its use limit" };
  return { coupon, error: "" };
}

/**
 * Coupons flagged for the gallery banner (night build follow-up, store lane).
 * Returns the active, unexpired coupons whose showBanner flag is on, newest
 * first, with the display text resolved (bannerText, else a generated line).
 * The gallery render that mounts this banner lives in the Client Gallery
 * files owned by another lane; this helper is the data hand-off for it.
 */
export async function activeBannerCoupons(userId: string) {
  const now = new Date();
  const coupons = await db.coupon.findMany({
    where: { userId, active: true, showBanner: true },
    orderBy: { createdAt: "desc" },
  });
  return coupons
    .filter((c) => !c.expiresAt || c.expiresAt > now)
    .filter((c) => c.useLimit == null || c.useLimit === 0 || c.useCount < c.useLimit)
    .map((c) => ({
      id: c.id,
      code: c.code,
      type: c.type,
      value: c.value,
      text:
        c.bannerText ||
        (c.type === "PERCENT"
          ? `Save ${c.value}% with code ${c.code}`
          : `Save with code ${c.code}`),
    }));
}

/** Validate a gift card code at checkout time. */
export async function resolveGiftCard(userId: string, code: string) {
  if (!code.trim()) return { giftCard: null, error: "" };
  const gc = await db.giftCard.findUnique({
    where: { userId_code: { userId, code: code.trim().toUpperCase() } },
  });
  if (!gc) return { giftCard: null, error: "Unknown gift card code" };
  if (!gc.active) return { giftCard: null, error: "This gift card is no longer active" };
  if (gc.balanceCents <= 0) return { giftCard: null, error: "This gift card has no remaining balance" };
  return { giftCard: gc, error: "" };
}

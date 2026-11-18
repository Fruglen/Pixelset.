import { randomBytes } from "crypto";
import { db } from "./db";

// ---------------------------------------------------------------- catalog

export const PRODUCT_CATEGORIES = [
  { id: "PRINT", label: "Prints" },
  { id: "CANVAS", label: "Canvas" },
  { id: "METAL", label: "Metal" },
  { id: "ACRYLIC", label: "Acrylic" },
  { id: "WOOD", label: "Wood" },
  { id: "ALBUM", label: "Albums & Books" },
  { id: "CARD", label: "Cards" },
  { id: "DIGITAL", label: "Digital Downloads" },
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
}): CheckoutTotals {
  const subtotal = opts.lines.reduce((s, l) => s + l.qty * l.unitCents, 0);
  // Flat shipping: counted once per distinct physical line.
  let shipping = opts.lines.filter((l) => !l.isDigital).reduce((s, l) => s + l.shippingCents, 0);

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
  const tax = opts.taxEnabled ? Math.round((taxable * opts.taxRate) / 100) : 0;
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

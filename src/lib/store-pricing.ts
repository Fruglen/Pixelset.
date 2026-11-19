import { processorFeeCents } from "./processors";

// Night build follow-up (Store): markup pricing, product packages and the
// photographer payout maths snapshot written onto every order at checkout.

// ---------------------------------------------------------------------------
// Markup pricing. A product priced FIXED sells at the variant's stored price.
// A product priced MARKUP derives every variant price from that variant's lab
// cost plus the product's markup percent, so changing either number reprices
// the whole product everywhere (editor, storefront, checkout) at once.

export function effectiveVariantPriceCents(
  product: { pricingMode: string; markupPct: number },
  variant: { priceCents: number; labCostCents: number }
): number {
  if (product.pricingMode === "MARKUP") {
    return Math.max(0, Math.round(variant.labCostCents * (1 + (product.markupPct || 0) / 100)));
  }
  return variant.priceCents;
}

// ---------------------------------------------------------------------------
// Product packages. A product in the PACKAGE category carries its components
// as JSON: [{ productId, variantId, qty }]. The package sells at its own
// variant price; the components are what actually get fulfilled.

export interface PackageComponent {
  productId: string;
  variantId: string;
  qty: number;
}

export function parsePackageItems(json: string | null | undefined): PackageComponent[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (c): c is PackageComponent =>
          !!c && typeof c.productId === "string" && typeof c.variantId === "string" && c.productId !== "" && c.variantId !== ""
      )
      .map((c) => ({
        productId: c.productId,
        variantId: c.variantId,
        qty: Math.min(50, Math.max(1, Math.round(Number(c.qty) || 1))),
      }));
  } catch {
    return [];
  }
}

export function packageItemsJson(items: PackageComponent[]): string {
  return JSON.stringify(
    items.map((c) => ({
      productId: c.productId,
      variantId: c.variantId,
      qty: Math.min(50, Math.max(1, Math.round(Number(c.qty) || 1))),
    }))
  );
}

// ---------------------------------------------------------------------------
// Payout maths. Snapshotted onto the Order when it is placed:
//   gross      = subtotal - discount + shipping + tax (what the client paid,
//                including any gift card share)
//   labCost    = sum of variant lab costs for physical items (digital = 0)
//   fee        = estimated processor fee on the amount actually charged
//                (published card rate; offline and gift card carry no fee)
//   commission = the plan's store commission percent, charged on the
//                PRE-DISCOUNT subtotal (Free plan: 15%, paid plans: 0%)
//   payout     = gross - labCost - fee - commission, never below zero

export interface PayoutLine {
  qty: number;
  labCostCents: number;
  isDigital: boolean;
}

export interface OrderPayout {
  labCostCents: number;
  feeCents: number;
  commissionCents: number;
  payoutCents: number;
}

export function computeOrderPayout(opts: {
  lines: PayoutLine[];
  subtotalCents: number; // pre-discount
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  chargedCents: number; // amount actually charged to the payment method
  paymentMethod: string;
  commissionPct: number;
}): OrderPayout {
  const labCostCents = opts.lines.reduce(
    (s, l) => s + (l.isDigital ? 0 : Math.max(0, l.labCostCents) * Math.max(0, l.qty)),
    0
  );
  const feeCents = processorFeeCents(opts.chargedCents, opts.paymentMethod === "offline" ? "manual" : opts.paymentMethod);
  const commissionCents = Math.round((Math.max(0, opts.subtotalCents) * Math.max(0, opts.commissionPct)) / 100);
  const gross = Math.max(0, opts.subtotalCents - opts.discountCents + opts.shippingCents + opts.taxCents);
  const payoutCents = Math.max(0, gross - labCostCents - feeCents - commissionCents);
  return { labCostCents, feeCents, commissionCents, payoutCents };
}

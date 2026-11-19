import { db } from "./db";
import { GALLERY_LIMITS, planFor } from "./plans";
import { computeOrderPayout } from "./store-pricing";

// ---------------------------------------------------------------------------
// Night build (Pricing lane): snapshot the payout maths onto a store order.
//
// The maths itself lives in src/lib/store-pricing.ts (computeOrderPayout):
//   commission = the plan's store commission percent on the PRE-DISCOUNT
//                subtotal (Free Client Gallery plan: 15%, paid plans: 0%)
//   payout     = what the client paid, minus lab costs, minus the estimated
//                processor fee, minus commission.
// This helper rebuilds the lines from the saved order (variant lab costs are
// looked up by product and variant name) and stores the snapshot on the
// Order. It runs when an order is placed and again when an offline order is
// marked paid, so older orders pick the numbers up too.
// ---------------------------------------------------------------------------

export async function settleOrderMaths(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return null;

  const productIds = Array.from(
    new Set(order.items.map((i) => i.productId).filter((x): x is string => !!x)),
  );
  const variants = productIds.length
    ? await db.productVariant.findMany({ where: { productId: { in: productIds } } })
    : [];
  const labCostFor = (productId: string | null, variantName: string | null) =>
    variants.find((v) => v.productId === productId && v.name === variantName)?.labCostCents ?? 0;

  const plan = await planFor(order.userId);
  const payout = computeOrderPayout({
    lines: order.items.map((i) => ({
      qty: i.qty,
      labCostCents: labCostFor(i.productId, i.variantName),
      isDigital: i.category === "DIGITAL",
    })),
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    chargedCents: order.totalCents,
    paymentMethod: order.paymentMethod,
    commissionPct: GALLERY_LIMITS[plan.gallery].commissionPct,
  });

  if (
    payout.labCostCents === order.labCostCents &&
    payout.feeCents === order.feeCents &&
    payout.commissionCents === order.commissionCents &&
    payout.payoutCents === order.payoutCents
  ) {
    return order;
  }
  return db.order.update({ where: { id: orderId }, data: payout });
}

import { db } from "./db";

// Night build follow-up (Studio): booking coupons. Separate from Store
// coupons: these discount a session booking at the public booking checkout.
// A coupon can be limited to one session type (sessionTypeId) or apply to
// every session (empty sessionTypeId), with a minimum spend, an optional use
// limit and an optional expiry, mirroring the store coupon rules.

export interface BookingCouponResult {
  coupon: {
    id: string;
    code: string;
    type: string;
    value: number;
  } | null;
  discountCents: number;
  error: string;
}

/** Discount a coupon gives on a pre-tax subtotal, in cents. */
export function bookingCouponDiscount(type: string, value: number, subtotalCents: number): number {
  if (subtotalCents <= 0) return 0;
  if (type === "PERCENT") return Math.min(subtotalCents, Math.round((subtotalCents * value) / 100));
  if (type === "FIXED") return Math.min(subtotalCents, value);
  return 0;
}

export async function resolveBookingCoupon(
  userId: string,
  code: string,
  sessionTypeId: string,
  subtotalCents: number
): Promise<BookingCouponResult> {
  const clean = (code ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!clean) return { coupon: null, discountCents: 0, error: "" };
  const coupon = await db.bookingCoupon.findUnique({
    where: { userId_code: { userId, code: clean } },
  });
  if (!coupon) return { coupon: null, discountCents: 0, error: "Unknown coupon code" };
  if (!coupon.active) return { coupon: null, discountCents: 0, error: "This coupon is no longer active" };
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now())
    return { coupon: null, discountCents: 0, error: "This coupon has expired" };
  if (coupon.useLimit !== null && coupon.useCount >= coupon.useLimit)
    return { coupon: null, discountCents: 0, error: "This coupon has reached its use limit" };
  if (coupon.sessionTypeId && coupon.sessionTypeId !== sessionTypeId)
    return { coupon: null, discountCents: 0, error: "This coupon does not apply to this session" };
  if (subtotalCents < coupon.minSpendCents)
    return {
      coupon: null,
      discountCents: 0,
      error: `This coupon needs a booking of at least $${(coupon.minSpendCents / 100).toFixed(2)}`,
    };
  return {
    coupon: { id: coupon.id, code: coupon.code, type: coupon.type, value: coupon.value },
    discountCents: bookingCouponDiscount(coupon.type, coupon.value, subtotalCents),
    error: "",
  };
}

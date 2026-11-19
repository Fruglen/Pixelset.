import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import BookingCouponsClient from "./booking-coupons-client";

export const dynamic = "force-dynamic";

export default async function BookingCouponsPage() {
  const user = (await getCurrentUser())!;
  const [coupons, sessionTypes] = await Promise.all([
    db.bookingCoupon.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.sessionType.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div>
      <h1 className="font-display text-2xl mb-1">Booking coupons</h1>
      <p className="text-sm text-neutral-500 mb-5">
        Discount codes clients enter when booking a session. These are separate from Store coupons, which only
        work at gallery checkout.
      </p>
      <BookingCouponsClient
        coupons={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          type: c.type,
          value: c.value,
          minSpendCents: c.minSpendCents,
          active: c.active,
          useLimit: c.useLimit,
          useCount: c.useCount,
          expiresAt: c.expiresAt ? c.expiresAt.toISOString().slice(0, 10) : null,
          sessionTypeId: c.sessionTypeId,
        }))}
        sessionTypes={sessionTypes}
      />
    </div>
  );
}

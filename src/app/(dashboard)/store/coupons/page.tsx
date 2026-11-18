import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import CouponsClient from "./coupons-client";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const user = (await getCurrentUser())!;
  const coupons = await db.coupon.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return (
    <CouponsClient
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
      }))}
    />
  );
}

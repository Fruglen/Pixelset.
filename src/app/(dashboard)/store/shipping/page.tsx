import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStoreProfile } from "@/lib/store";
import ShippingClient from "./shipping-client";

export const dynamic = "force-dynamic";

export default async function StoreShippingPage() {
  const user = (await getCurrentUser())!;
  const [methods, profile, sheets] = await Promise.all([
    db.shippingMethod.findMany({ where: { userId: user.id }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    getStoreProfile(user.id),
    db.priceSheet.findMany({ where: { userId: user.id }, select: { fulfillment: true } }),
  ]);
  return (
    <ShippingClient
      currency={profile.currency}
      hasLab={sheets.some((s) => s.fulfillment === "LAB")}
      methods={methods.map((m) => ({
        id: m.id,
        name: m.name,
        speed: m.speed,
        appliesTo: m.appliesTo,
        baseCents: m.baseCents,
        perItemCents: m.perItemCents,
        freeOverCents: m.freeOverCents,
        active: m.active,
      }))}
    />
  );
}

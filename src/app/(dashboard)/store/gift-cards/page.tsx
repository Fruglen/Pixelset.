import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import GiftCardsClient from "./gift-cards-client";

export const dynamic = "force-dynamic";

export default async function GiftCardsPage() {
  const user = (await getCurrentUser())!;
  const cards = await db.giftCard.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return (
    <GiftCardsClient
      cards={cards.map((g) => ({
        id: g.id,
        code: g.code,
        initialCents: g.initialCents,
        balanceCents: g.balanceCents,
        active: g.active,
        recipient: g.recipient,
      }))}
    />
  );
}

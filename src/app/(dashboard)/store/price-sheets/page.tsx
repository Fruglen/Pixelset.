import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import PriceSheetsClient from "./price-sheets-client";

export const dynamic = "force-dynamic";

export default async function PriceSheetsPage() {
  const user = (await getCurrentUser())!;
  const [sheets, collections] = await Promise.all([
    db.priceSheet.findMany({
      where: { userId: user.id },
      include: { _count: { select: { products: true, collections: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.collection.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, status: true, priceSheetId: true, storeEnabled: true },
    }),
  ]);

  return (
    <PriceSheetsClient
      sheets={sheets.map((s) => ({
        id: s.id,
        name: s.name,
        fulfillment: s.fulfillment,
        lab: s.lab,
        products: s._count.products,
        collections: s._count.collections,
      }))}
      collections={collections}
    />
  );
}

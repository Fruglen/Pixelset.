import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import SheetEditor from "./sheet-editor";

export const dynamic = "force-dynamic";

export default async function PriceSheetEditorPage({ params }: { params: { id: string } }) {
  const user = (await getCurrentUser())!;
  const sheet = await db.priceSheet.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      products: { orderBy: { order: "asc" }, include: { variants: { orderBy: { order: "asc" } } } },
      collections: { select: { name: true } },
    },
  });
  if (!sheet) notFound();

  return (
    <SheetEditor
      sheet={{
        id: sheet.id,
        name: sheet.name,
        fulfillment: sheet.fulfillment,
        lab: sheet.lab,
        collectionNames: sheet.collections.map((c) => c.name),
        products: sheet.products.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          description: p.description,
          selfFulfilled: p.selfFulfilled,
          shippingCents: p.shippingCents,
          active: p.active,
          variants: p.variants.map((v) => ({ id: v.id, name: v.name, priceCents: v.priceCents })),
        })),
      }}
    />
  );
}

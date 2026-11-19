import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PRODUCT_CATEGORIES, getStoreProfile } from "@/lib/store";
import { formatStoreMoney, parseFrames } from "@/lib/store-rates";

export const dynamic = "force-dynamic";

// Phase 5B: Products section, every product across every price sheet.
export default async function StoreProductsPage({ searchParams }: { searchParams: { category?: string } }) {
  const user = (await getCurrentUser())!;
  const profile = await getStoreProfile(user.id);
  const money = (c: number) => formatStoreMoney(c, profile.currency);
  const products = await db.product.findMany({
    where: { priceSheet: { userId: user.id } },
    include: { variants: { orderBy: { order: "asc" } }, priceSheet: true, _count: { select: { orderItems: true } } },
    orderBy: [{ priceSheet: { createdAt: "asc" } }, { order: "asc" }],
  });
  const filter = searchParams.category;
  const shown = filter ? products.filter((p) => p.category === filter) : products;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/store/products" className={`text-xs px-3 py-1.5 rounded-full border ${!filter ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-600"}`}>
          All ({products.length})
        </Link>
        {PRODUCT_CATEGORIES.map((c) => {
          const n = products.filter((p) => p.category === c.id).length;
          return (
            <Link
              key={c.id}
              href={`/store/products?category=${c.id}`}
              className={`text-xs px-3 py-1.5 rounded-full border ${filter === c.id ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-600"}`}
            >
              {c.label} ({n})
            </Link>
          );
        })}
        <span className="flex-1" />
        <Link href="/store/price-sheets" className="text-xs underline text-neutral-500">
          Add products in a price sheet
        </Link>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-neutral-400">No products{filter ? " in this category" : " yet, open a price sheet and add prints, wall art, or digital downloads"}.</p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-400 border-b border-neutral-100">
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Price sheet</th>
                <th className="px-4 py-2 font-medium">Fulfillment</th>
                <th className="px-4 py-2 font-medium text-right">Prices</th>
                <th className="px-4 py-2 font-medium text-right">Sold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {shown.map((p) => {
                const prices = p.variants.map((v) => v.priceCents);
                const frames = parseFrames(p.frameOptions);
                return (
                  <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                    <td className="px-4 py-2">
                      <Link href={`/store/price-sheets/${p.priceSheetId}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      <p className="text-xs text-neutral-400">
                        {PRODUCT_CATEGORIES.find((c) => c.id === p.category)?.label ?? p.category} · {p.variants.length} option(s)
                        {frames.length ? ` · ${frames.length} frame choice(s)` : ""}
                        {p.active ? "" : " · hidden"}
                      </p>
                    </td>
                    <td className="px-4 py-2 text-neutral-600">{p.priceSheet.name}</td>
                    <td className="px-4 py-2 text-neutral-600">
                      {p.category === "DIGITAL" ? "Digital" : p.selfFulfilled ? "Self" : `Lab (${p.priceSheet.lab || "WHCC"})`}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {prices.length ? (Math.min(...prices) === Math.max(...prices) ? money(prices[0]) : `${money(Math.min(...prices))} to ${money(Math.max(...prices))}`) : "-"}
                    </td>
                    <td className="px-4 py-2 text-right">{p._count.orderItems}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

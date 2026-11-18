import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { StoreTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <>{children}</>;
  const newOrders = await db.order.count({ where: { userId: user.id, status: "NEW" } });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-display">Store</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Price sheets, print & digital products, coupons, gift cards and orders, sold inside your client galleries.
        </p>
      </div>
      <StoreTabs newOrders={newOrders} />
      <div className="mt-6">{children}</div>
    </div>
  );
}

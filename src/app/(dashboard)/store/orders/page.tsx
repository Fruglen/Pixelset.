import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStoreProfile } from "@/lib/store";
import { formatStoreMoney } from "@/lib/store-rates";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { StoreIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-neutral-900 text-white",
  PROCESSING: "bg-amber-100 text-amber-800",
  SHIPPED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-neutral-100 text-neutral-400",
};

export default async function OrdersPage({ searchParams }: { searchParams: { status?: string } }) {
  const user = (await getCurrentUser())!;
  const filter = searchParams.status;
  const profile = await getStoreProfile(user.id);
  const fmtMoney = (c: number) => formatStoreMoney(c, profile.currency);
  const orders = await db.order.findMany({
    where: { userId: user.id, ...(filter ? { status: filter } : {}) },
    include: { collection: true, items: true },
    orderBy: { createdAt: "desc" },
  });

  const statuses = ["NEW", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELLED"];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link href="/store/orders" className={`text-xs px-3 py-1.5 rounded-full border ${!filter ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-600"}`}>
          All
        </Link>
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/store/orders?status=${s}`}
            className={`text-xs px-3 py-1.5 rounded-full border ${filter === s ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-600"}`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </Link>
        ))}
        <span className="flex-1" />
        <a href="/api/export?what=orders&format=csv" className="text-xs underline text-neutral-500">
          Export CSV
        </a>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={StoreIcon}
          line={filter ? "No orders with this status." : "No orders yet. Orders appear here when clients buy from a gallery storefront."}
          ctaLabel="View galleries"
          ctaHref="/collections"
        />
      ) : (
        <div className="card divide-y divide-neutral-100">
          {orders.map((o) => (
            <Link key={o.id} href={`/store/orders/${o.id}`} className="flex items-center gap-x-4 gap-y-1 flex-wrap sm:flex-nowrap px-4 py-3 hover:bg-neutral-50">
              <div className="w-20 shrink-0">
                <p className="text-sm font-medium">{o.number}</p>
              </div>
              <div className="flex-1 min-w-[12rem]">
                <p className="text-sm truncate">
                  {o.customerName} <span className="text-neutral-400">· {o.customerEmail}</span>
                </p>
                <p className="text-xs text-neutral-400 truncate">
                  {o.collection?.name ?? "-"} · {o.items.reduce((s, i) => s + i.qty, 0)} item(s) · {formatDateTime(o.createdAt)}
                </p>
              </div>
              {o.paymentStatus === "AWAITING_PAYMENT" && (
                <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 shrink-0">Awaiting payment</span>
              )}
              <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-neutral-200 text-neutral-500 shrink-0">
                {o.fulfillment}
              </span>
              <span className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded-full shrink-0 ${STATUS_STYLES[o.status] ?? ""}`}>
                {o.status}
              </span>
              <p className="text-sm font-medium w-20 text-right shrink-0">{fmtMoney(o.totalCents + o.giftCardCents)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

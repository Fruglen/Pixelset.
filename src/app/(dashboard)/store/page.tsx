import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStoreProfile } from "@/lib/store";
import { formatStoreMoney } from "@/lib/store-rates";
import { labConnected } from "@/lib/lab";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StoreOverviewPage() {
  const user = (await getCurrentUser())!;
  const profile = await getStoreProfile(user.id);
  const fmtMoney = (c: number) => formatStoreMoney(c, profile.currency);
  const [payouts, shippingCount, taxRateCount] = await Promise.all([
    db.storePayout.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.shippingMethod.count({ where: { userId: user.id, active: true } }),
    db.taxRate.count({ where: { userId: user.id, active: true } }),
  ]);
  const payoutOrders = await db.order.findMany({
    where: { id: { in: payouts.slice(0, 6).map((p) => p.orderId) } },
    select: { id: true, number: true, customerName: true },
  });
  const paidOut = payouts.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amountCents, 0);
  const owed = payouts.filter((p) => p.status === "AWAITING_PAYMENT").reduce((s, p) => s + p.amountCents, 0);
  const lab = labConnected({ labEnabled: profile.labEnabled, labName: profile.labName, labEmail: profile.labEmail, labEndpoint: profile.labEndpoint });
  const [orders, sheets, couponCount, giftCards, collectionsWithSheet] = await Promise.all([
    db.order.findMany({
      where: { userId: user.id },
      include: { collection: true, items: true },
      orderBy: { createdAt: "desc" },
    }),
    db.priceSheet.findMany({ where: { userId: user.id }, include: { _count: { select: { products: true, collections: true } } } }),
    db.coupon.count({ where: { userId: user.id } }),
    db.giftCard.findMany({ where: { userId: user.id } }),
    db.collection.count({ where: { userId: user.id, priceSheetId: { not: null } } }),
  ]);

  const activeOrders = orders.filter((o) => o.status !== "CANCELLED");
  const revenue = activeOrders.reduce((s, o) => s + o.totalCents + o.giftCardCents, 0);
  // Net payout snapshot total (after lab costs, processor fees, commission).
  const netPayout = activeOrders.reduce((s, o) => s + o.payoutCents, 0);
  const recent = orders.slice(0, 5);
  const giftOutstanding = giftCards.filter((g) => g.active).reduce((s, g) => s + g.balanceCents, 0);

  const steps = [
    { done: sheets.length > 0, label: "Create a price sheet with products", href: "/store/price-sheets" },
    { done: collectionsWithSheet > 0, label: "Assign the price sheet to a collection", href: "/store/price-sheets" },
    { done: profile.taxEnabled || taxRateCount > 0 || orders.length > 0, label: "Review tax settings", href: "/store/taxes" },
    { done: orders.length > 0, label: "Receive your first order", href: "/store/orders" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Store revenue" value={fmtMoney(revenue)} />
        <Stat label="Net payout" value={fmtMoney(netPayout)} />
        <Stat label="Orders" value={String(orders.length)} />
        <Stat label="Price sheets" value={String(sheets.length)} />
        <Stat label="Gift card balance out" value={fmtMoney(giftOutstanding)} />
      </div>

      {!profile.storeOpen && (
        <p className="card p-3 text-sm text-amber-700">
          Your store is closed, galleries show your closed message and checkout is off.{" "}
          <Link href="/store/settings" className="underline">
            Open it in Settings
          </Link>
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-6 [&>*]:min-w-0">
        <div className="card p-5">
          <h2 className="font-medium mb-3">Get started</h2>
          <ul className="space-y-2">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                <span className={s.done ? "text-green-600" : "text-neutral-300"}>{s.done ? "✓" : "○"}</span>
                <Link href={s.href} className={s.done ? "text-neutral-500 line-through" : "text-neutral-800 hover:underline"}>
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-400 mt-4">
            The storefront appears automatically inside any published gallery that has a price sheet assigned -
            clients buy prints and downloads of the exact photo they&rsquo;re viewing.
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Recent orders</h2>
            <Link href="/store/orders" className="text-xs underline text-neutral-500">
              All orders
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-neutral-400">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {recent.map((o) => (
                <li key={o.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <Link href={`/store/orders/${o.id}`} className="font-medium hover:underline">
                      {o.number}
                    </Link>
                    <span className="text-neutral-500"> · {o.customerName}</span>
                    <p className="text-xs text-neutral-400 truncate">
                      {o.collection?.name ?? "-"} · {formatDateTime(o.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium">{fmtMoney(o.totalCents + o.giftCardCents)}</p>
                    <p className="text-[11px] uppercase tracking-wide text-neutral-400">{o.status}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-medium mb-2">Fulfillment</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm text-neutral-600">
          <div>
            <p className="font-medium text-neutral-800 mb-1">Self-fulfillment</p>
            <p>
              You print and ship (or deliver digitally) yourself, and the money is paid to you directly. Order detail
              pages include a Lightroom copy list of the exact ordered files.
            </p>
          </div>
          <div>
            <p className="font-medium text-neutral-800 mb-1">Automatic lab fulfillment ({profile.labName || "WHCC"})</p>
            <p>
              Lab orders get a complete lab payload and a status timeline from queued to delivered.{" "}
              {lab ? `Orders are sent to ${profile.labName} automatically.` : "No lab connected, payloads stay queued until you connect a lab in Settings."}
            </p>
          </div>
        </div>
        <p className="text-xs text-neutral-400 mt-3">
          {couponCount} coupon{couponCount === 1 ? "" : "s"} · {shippingCount} shipping method{shippingCount === 1 ? "" : "s"} ·{" "}
          {taxRateCount} manual tax rate{taxRateCount === 1 ? "" : "s"} · currency {profile.currency}
        </p>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-medium">Paid to you directly</h2>
          <span className="text-xs text-neutral-400">mocked per the owner&rsquo;s payments exclusion</span>
        </div>
        <p className="text-sm text-neutral-500 mb-3">
          Self fulfilled and digital sales go straight to you. {fmtMoney(paidOut)} settled
          {owed ? `, ${fmtMoney(owed)} still to collect from offline payments` : ""}.
        </p>
        {payouts.length === 0 ? (
          <p className="text-sm text-neutral-400">No payouts yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {payouts.slice(0, 6).map((p) => {
              const o = payoutOrders.find((x) => x.id === p.orderId);
              return (
                <li key={p.id} className="py-2 flex items-center justify-between text-sm">
                  <span>
                    {o ? (
                      <Link href={`/store/orders/${o.id}`} className="font-medium hover:underline">
                        {o.number}
                      </Link>
                    ) : (
                      "Deleted order"
                    )}
                    <span className="text-neutral-500"> · {o?.customerName} · {p.method}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-[11px] uppercase tracking-wide text-neutral-400">
                      {p.status === "AWAITING_PAYMENT" ? "To collect" : p.status === "PAID" ? "Settled" : "Cancelled"}
                    </span>
                    <span className="font-medium">{fmtMoney(p.amountCents)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="text-xl font-display mt-1">{value}</p>
    </div>
  );
}

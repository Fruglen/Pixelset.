import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/studio";
import { syncStatus } from "@/lib/accounting";
import ExportIntegrations from "./integrations-client";

export const dynamic = "force-dynamic";

// Reporting dashboard, every number is computed from real data: Activity log
// (views / downloads / favorites / comments), paid invoice instalments, store
// orders and bookings. Charts are server-rendered SVG with native hover titles
// plus the data tables beneath them.

const SERIES = {
  invoice: { color: "#2a78d6", label: "Invoice payments" }, // validated pair (dataviz palette slots 1+2)
  store: { color: "#eb6834", label: "Store orders" },
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
}
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function ReportsPage() {
  const user = (await getCurrentUser())!;

  const [collections, activities, installments, orders, bookings, favorites] = await Promise.all([
    db.collection.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, slug: true, status: true },
    }),
    db.activity.findMany({
      where: { collection: { userId: user.id } },
      select: { collectionId: true, type: true, createdAt: true },
    }),
    db.invoiceInstallment.findMany({
      where: { invoice: { userId: user.id }, paidAt: { not: null } },
      select: { amountCents: true, paidAt: true },
    }),
    db.order.findMany({
      where: { userId: user.id, status: { not: "CANCELLED" } },
      select: { collectionId: true, totalCents: true, giftCardCents: true, createdAt: true },
    }),
    db.booking.findMany({
      where: { userId: user.id, status: { not: "CANCELLED" } },
      select: { createdAt: true, startsAt: true, totalCents: true },
    }),
    db.favorite.findMany({
      where: { list: { collection: { userId: user.id } } },
      select: { list: { select: { collectionId: true } } },
    }),
  ]);

  // ---- monthly revenue, last 6 months (invoice payments vs store orders) ----
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  const revenueByMonth = months.map((m) => ({
    month: m,
    invoice: installments.filter((i) => i.paidAt && monthKey(i.paidAt) === m).reduce((s, i) => s + i.amountCents, 0),
    store: orders.filter((o) => monthKey(o.createdAt) === m).reduce((s, o) => s + o.totalCents + o.giftCardCents, 0),
  }));

  // ---- gallery views, last 30 days ----
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    days.push(dayKey(new Date(Date.now() - i * 86_400_000)));
  }
  const views = activities.filter((a) => a.type === "VIEW");
  const viewsByDay = days.map((d) => ({
    day: d,
    count: views.filter((a) => dayKey(a.createdAt) === d).length,
  }));
  const views30 = viewsByDay.reduce((s, d) => s + d.count, 0);

  // ---- totals ----
  const invoiceRevenue = installments.reduce((s, i) => s + i.amountCents, 0);
  const storeRevenue = orders.reduce((s, o) => s + o.totalCents + o.giftCardCents, 0);
  const downloadsTotal = activities.filter((a) => a.type === "DOWNLOAD" || a.type === "DOWNLOAD_ALL").length;
  const favoritesTotal = favorites.length;
  const viewedCollections = new Set(views.map((v) => v.collectionId));
  const orderedCollections = new Set(orders.map((o) => o.collectionId).filter(Boolean));
  const conversion =
    viewedCollections.size > 0 ? Math.round((orderedCollections.size / viewedCollections.size) * 100) : 0;

  // ---- per-collection table ----
  const perCollection = collections
    .map((c) => ({
      ...c,
      views: views.filter((a) => a.collectionId === c.id).length,
      downloads: activities.filter(
        (a) => a.collectionId === c.id && (a.type === "DOWNLOAD" || a.type === "DOWNLOAD_ALL")
      ).length,
      favorites: favorites.filter((f) => f.list.collectionId === c.id).length,
      orders: orders.filter((o) => o.collectionId === c.id).length,
    }))
    .sort((a, b) => b.views - a.views);

  const upcomingBookings = bookings.filter((b) => b.startsAt.getTime() > Date.now()).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display">Reports</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Revenue, bookings, gallery engagement and conversion, computed live from your actual data.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Stat label="Total revenue" value={fmtMoney(invoiceRevenue + storeRevenue)} sub={`${fmtMoney(invoiceRevenue)} invoices · ${fmtMoney(storeRevenue)} store`} />
        <Stat label="Bookings" value={String(bookings.length)} sub={`${upcomingBookings} upcoming`} />
        <Stat label="Gallery views (30d)" value={String(views30)} sub={`${views.length} all time`} />
        <Stat label="Downloads" value={String(downloadsTotal)} sub={`${favoritesTotal} favorites`} />
        <Stat label="View → order conversion" value={`${conversion}%`} sub={`${orderedCollections.size} of ${viewedCollections.size} viewed galleries`} />
      </div>

      {/* Revenue by month, grouped bars, 2 series with legend */}
      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h2 className="font-medium">Revenue, last 6 months</h2>
          <div className="flex gap-4 text-xs text-neutral-600">
            {Object.values(SERIES).map((s) => (
              <span key={s.label} className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
        <RevenueChart data={revenueByMonth} />
        <div className="overflow-x-auto">
        <table className="w-full text-xs mt-3">
          <thead>
            <tr className="text-left text-neutral-400 uppercase tracking-wide">
              <th className="py-1 font-medium">Month</th>
              <th className="py-1 font-medium text-right">Invoice payments</th>
              <th className="py-1 font-medium text-right">Store orders</th>
              <th className="py-1 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {revenueByMonth.map((r) => (
              <tr key={r.month}>
                <td className="py-1">{monthLabel(r.month)}</td>
                <td className="py-1 text-right">{fmtMoney(r.invoice)}</td>
                <td className="py-1 text-right">{fmtMoney(r.store)}</td>
                <td className="py-1 text-right font-medium">{fmtMoney(r.invoice + r.store)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Views, single series, no legend needed (title names it) */}
      <div className="card p-5">
        <h2 className="font-medium mb-1">Gallery views, last 30 days</h2>
        <ViewsChart data={viewsByDay} />
      </div>

      {/* Per-collection engagement */}
      <div className="card p-5">
        <h2 className="font-medium mb-3">Galleries</h2>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-neutral-400 uppercase tracking-wide">
              <th className="py-1.5 font-medium">Collection</th>
              <th className="py-1.5 font-medium text-right">Views</th>
              <th className="py-1.5 font-medium text-right">Favorites</th>
              <th className="py-1.5 font-medium text-right">Downloads</th>
              <th className="py-1.5 font-medium text-right">Orders</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {perCollection.map((c) => (
              <tr key={c.id}>
                <td className="py-2">
                  <a href={`/collections/${c.id}`} className="hover:underline font-medium">
                    {c.name}
                  </a>
                  <span className="text-xs text-neutral-400 ml-2">{c.status}</span>
                </td>
                <td className="py-2 text-right">{c.views}</td>
                <td className="py-2 text-right">{c.favorites}</td>
                <td className="py-2 text-right">{c.downloads}</td>
                <td className="py-2 text-right">{c.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Bulk export */}
      <div className="card p-5">
        <h2 className="font-medium mb-1">Bulk export</h2>
        <p className="text-xs text-neutral-400 mb-3">
          Download your data as CSV or JSON, clients, invoices, bookings, orders, plus every favorites list
          (a Lightroom-ready filename list).
        </p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { what: "clients", label: "Clients" },
            { what: "invoices", label: "Invoices" },
            { what: "bookings", label: "Bookings" },
            { what: "orders", label: "Store orders" },
            { what: "favorites", label: "Favorites lists" },
          ].map((e) => (
            <div key={e.what} className="flex items-center justify-between border border-neutral-200 rounded-md px-3 py-2 text-sm">
              <span>{e.label}</span>
              <span className="flex gap-2 text-xs">
                <a className="underline text-neutral-600" href={`/api/export?what=${e.what}&format=csv`}>
                  CSV
                </a>
                <a className="underline text-neutral-600" href={`/api/export?what=${e.what}&format=json`}>
                  JSON
                </a>
              </span>
            </div>
          ))}
        </div>
      </div>

      <ExportIntegrations status={await syncStatus(user.id)} />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="text-xl font-display mt-1">{value}</p>
      <p className="text-[11px] text-neutral-400 mt-0.5">{sub}</p>
    </div>
  );
}

// ---------------------------------------------------------------- charts (SVG)

function RevenueChart({ data }: { data: { month: string; invoice: number; store: number }[] }) {
  const W = 720;
  const H = 180;
  const pad = { l: 8, r: 8, t: 10, b: 22 };
  const max = Math.max(100, ...data.flatMap((d) => [d.invoice, d.store]));
  const groupW = (W - pad.l - pad.r) / data.length;
  const barW = Math.min(26, groupW / 3);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly revenue, invoice payments and store orders">
      {/* recessive baseline */}
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#e5e5e5" />
      {data.map((d, i) => {
        const cx = pad.l + groupW * i + groupW / 2;
        return (
          <g key={d.month}>
            {([
              ["invoice", d.invoice, SERIES.invoice.color, SERIES.invoice.label],
              ["store", d.store, SERIES.store.color, SERIES.store.label],
            ] as const).map(([key, v, color, label], j) => {
              const x = cx - barW - 1 + j * (barW + 2);
              const top = y(v);
              const h = Math.max(v > 0 ? 3 : 0, H - pad.b - top);
              return (
                <g key={key}>
                  {/* thin mark, rounded data end anchored to the baseline */}
                  <path
                    d={
                      h > 0
                        ? `M ${x} ${H - pad.b} V ${top + 4} Q ${x} ${top} ${x + 4} ${top} H ${x + barW - 4} Q ${x + barW} ${top} ${x + barW} ${top + 4} V ${H - pad.b} Z`
                        : ""
                    }
                    fill={color}
                  >
                    <title>{`${monthLabel(d.month)}, ${label}: $${(v / 100).toFixed(2)}`}</title>
                  </path>
                </g>
              );
            })}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill="#737373">
              {monthLabel(d.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ViewsChart({ data }: { data: { day: string; count: number }[] }) {
  const W = 720;
  const H = 140;
  const pad = { l: 8, r: 8, t: 10, b: 20 };
  const max = Math.max(3, ...data.map((d) => d.count));
  const step = (W - pad.l - pad.r) / data.length;
  const barW = Math.max(6, step - 4);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gallery views per day, last 30 days">
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="#e5e5e5" />
      {data.map((d, i) => {
        const x = pad.l + step * i + (step - barW) / 2;
        const top = y(d.count);
        const h = Math.max(d.count > 0 ? 3 : 0, H - pad.b - top);
        const label = new Date(`${d.day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return (
          <g key={d.day}>
            {h > 0 ? (
              <path
                d={`M ${x} ${H - pad.b} V ${top + 3} Q ${x} ${top} ${x + 3} ${top} H ${x + barW - 3} Q ${x + barW} ${top} ${x + barW} ${top + 3} V ${H - pad.b} Z`}
                fill="#2a78d6"
              >
                <title>{`${label}: ${d.count} view${d.count === 1 ? "" : "s"}`}</title>
              </path>
            ) : (
              <rect x={x} y={H - pad.b - 1} width={barW} height={1} fill="#e5e5e5">
                <title>{`${label}: 0 views`}</title>
              </rect>
            )}
            {(i === 0 || i === data.length - 1 || i === 15) && (
              <text x={x + barW / 2} y={H - 5} textAnchor="middle" fontSize="10" fill="#737373">
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtMoney } from "@/lib/studio";
import { formatDateTime } from "@/lib/utils";
import { categoryLabel, getStoreProfile } from "@/lib/store";
import { labConnected, labConnectionNote } from "@/lib/lab";
import OrderActions from "./order-actions";
import LabPanel from "./lab-panel";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const user = (await getCurrentUser())!;
  const order = await db.order.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      collection: true,
      items: { include: { product: true } },
      labOrders: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) notFound();

  const selfItems = order.items.filter(
    (i) => i.category !== "DIGITAL" && (i.product ? i.product.selfFulfilled : true)
  );
  const copyList = Array.from(new Set(selfItems.map((i) => i.photoName).filter(Boolean)));
  const hasLabItems = order.items.some(
    (i) => i.category !== "DIGITAL" && i.product && !i.product.selfFulfilled
  );
  const storeProfile = await getStoreProfile(user.id);
  const labSettings = {
    labEnabled: storeProfile.labEnabled,
    labName: storeProfile.labName,
    labEmail: storeProfile.labEmail,
    labEndpoint: storeProfile.labEndpoint,
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/store/orders" className="text-xs text-neutral-400 hover:underline">
            ← Orders
          </Link>
          <h2 className="text-xl font-display mt-1">{order.number}</h2>
          <p className="text-sm text-neutral-500">
            {formatDateTime(order.createdAt)} · {order.collection ? (
              <>from <Link className="underline" href={`/g/${order.collection.slug}`}>{order.collection.name}</Link></>
            ) : "gallery removed"}
          </p>
        </div>
        <OrderActions id={order.id} status={order.status} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <p className="label">Customer</p>
          <p className="text-sm font-medium">{order.customerName}</p>
          <p className="text-sm text-neutral-600">{order.customerEmail}</p>
          {order.shippingAddress && (
            <>
              <p className="label mt-3">Ship to</p>
              <p className="text-sm text-neutral-600 whitespace-pre-line">{order.shippingAddress}</p>
            </>
          )}
        </div>
        <div className="card p-4">
          <p className="label">Payment & fulfillment</p>
          <p className="text-sm">
            Paid by <span className="font-medium">{order.paymentMethod}</span> (mock payment)
          </p>
          {order.couponCode && <p className="text-sm text-neutral-600">Coupon: {order.couponCode}</p>}
          {order.giftCardCode && (
            <p className="text-sm text-neutral-600">
              Gift card {order.giftCardCode}: {fmtMoney(order.giftCardCents)}
            </p>
          )}
          <p className="text-sm text-neutral-600 mt-1">
            Fulfillment: <span className="font-medium">{order.fulfillment}</span>
            {hasLabItems &&
              (labConnected(labSettings)
                ? ` · lab orders go to ${labSettings.labName}`
                : " · lab items queued, no lab connected")}
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-neutral-400 border-b border-neutral-100">
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium">Photo</th>
              <th className="px-4 py-2 font-medium text-right">Qty</th>
              <th className="px-4 py-2 font-medium text-right">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {order.items.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2">
                  <p className="font-medium">
                    {i.productName}
                    {i.variantName ? `, ${i.variantName}` : ""}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {categoryLabel(i.category)}
                    {i.downloadToken
                      ? ` · download link ${i.downloadExpires && i.downloadExpires.getTime() > Date.now() ? `expires ${formatDateTime(i.downloadExpires)}` : "expired"}`
                      : ""}
                  </p>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {i.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={i.photoUrl} alt="" className="h-10 w-10 object-cover rounded" />
                    )}
                    <span className="text-xs text-neutral-500">{i.photoName}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right">{i.qty}</td>
                <td className="px-4 py-2 text-right">{fmtMoney(i.unitCents * i.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-neutral-100 px-4 py-3 text-sm space-y-1">
          <Row label="Subtotal" value={fmtMoney(order.subtotalCents)} />
          {order.discountCents > 0 && <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`−${fmtMoney(order.discountCents)}`} />}
          {order.shippingCents > 0 && <Row label="Shipping" value={fmtMoney(order.shippingCents)} />}
          {order.taxCents > 0 && <Row label="Tax" value={fmtMoney(order.taxCents)} />}
          {order.giftCardCents > 0 && <Row label="Gift card" value={`−${fmtMoney(order.giftCardCents)}`} />}
          <div className="flex justify-between font-medium pt-1 border-t border-neutral-100">
            <span>Charged</span>
            <span>{fmtMoney(order.totalCents)}</span>
          </div>
        </div>
      </div>

      <LabPanel
        orderId={order.id}
        hasLabItems={hasLabItems}
        connected={labConnected(labSettings)}
        connectionNote={labConnectionNote(labSettings)}
        labOrders={order.labOrders.map((lo) => ({
          id: lo.id,
          status: lo.status,
          lab: lo.lab,
          payload: lo.payload,
          isReprint: lo.isReprint,
          sentAt: lo.sentAt ? formatDateTime(lo.sentAt) : "",
          response: lo.response,
          createdAt: formatDateTime(lo.createdAt),
        }))}
      />

      {copyList.length > 0 && (
        <div className="card p-4">
          <p className="label">Lightroom copy list (self-fulfilled files)</p>
          <p className="text-xs text-neutral-400 mb-2">
            Paste into Lightroom&rsquo;s Library filter to locate the ordered files.
          </p>
          <pre className="text-xs bg-neutral-50 rounded p-3 overflow-x-auto">{copyList.join("\n")}</pre>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-neutral-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

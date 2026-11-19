import { db } from "./db";
import { absoluteUrl, deliveryNote, sendMail } from "./mailer";
import { downloadExpiry, newDownloadToken } from "./store";
import { sendLabOrder } from "./lab";
import { formatStoreMoney } from "./store-rates";

// Phase 5B store order helpers: payout records (paid to the photographer
// directly, mocked per the owner's payments exclusion) and the offline payment
// flow (mark paid, then release download links and lab orders).

/** Share of the order total that belongs to self fulfilled and digital items. */
export function selfShareCents(order: { totalCents: number; subtotalCents: number }, items: { category: string; qty: number; unitCents: number; selfFulfilled: boolean }[]) {
  const own = items.filter((i) => i.category === "DIGITAL" || i.selfFulfilled).reduce((s, i) => s + i.qty * i.unitCents, 0);
  if (order.subtotalCents <= 0) return own > 0 ? order.totalCents : 0;
  if (own >= order.subtotalCents) return order.totalCents;
  return Math.round((order.totalCents * own) / order.subtotalCents);
}

export async function createPayout(opts: {
  userId: string;
  orderId: string;
  amountCents: number;
  method: string;
  awaiting: boolean;
  note: string;
}) {
  if (opts.amountCents <= 0) return null;
  return db.storePayout.create({
    data: {
      userId: opts.userId,
      orderId: opts.orderId,
      amountCents: opts.amountCents,
      method: opts.method,
      status: opts.awaiting ? "AWAITING_PAYMENT" : "PAID",
      paidAt: opts.awaiting ? null : new Date(),
      note: opts.note,
    },
  });
}

/** Give every digital item on the order a fresh 7 day link when it has none. */
export async function issueDownloadLinks(orderId: string) {
  const items = await db.orderItem.findMany({ where: { orderId, category: "DIGITAL" } });
  const out: { photoName: string; productName: string; token: string; expires: Date }[] = [];
  for (const i of items) {
    let token = i.downloadToken;
    let expires = i.downloadExpires;
    if (!token) {
      token = newDownloadToken();
      expires = downloadExpiry();
      await db.orderItem.update({ where: { id: i.id }, data: { downloadToken: token, downloadExpires: expires } });
    }
    out.push({ photoName: i.photoName, productName: i.productName, token, expires: expires ?? downloadExpiry() });
  }
  return out;
}

/** Offline payment received: release downloads (emailed), send lab orders, settle the payout. */
export async function markOrderPaid(orderId: string, userId: string) {
  const order = await db.order.findFirst({ where: { id: orderId, userId }, include: { user: true, collection: true, labOrders: true } });
  if (!order) return { error: "Not found" };
  if (order.paymentStatus !== "AWAITING_PAYMENT") return { error: "This order is not awaiting payment" };
  await db.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID" } });
  await db.storePayout.updateMany({ where: { orderId: order.id }, data: { status: "PAID", paidAt: new Date() } });

  const links = await issueDownloadLinks(order.id);
  const profile = await db.storeProfile.findUnique({ where: { userId } });
  const currency = profile?.currency || "USD";
  const brand = order.user.businessName || order.user.name;
  const mail = await sendMail({
    userId,
    to: order.customerEmail,
    subject: `Payment received for order ${order.number}`,
    text: `Hi ${order.customerName || "there"},\n\nThank you, your payment of ${formatStoreMoney(order.totalCents, currency)} for order ${order.number} has been received.${
      links.length
        ? `\n\nYour digital downloads (links expire in 7 days):\n${links.map((l) => `- ${l.photoName}: ${absoluteUrl(`/api/store/download/${l.token}`)}`).join("\n")}`
        : ""
    }\n\n${brand}`,
  });

  const labResults: string[] = [];
  for (const lo of order.labOrders.filter((l) => l.status === "QUEUED")) {
    labResults.push((await sendLabOrder(lo.id)).detail);
  }
  return { ok: true, links: links.length, mail: deliveryNote(mail), delivered: mail.sent, lab: labResults };
}

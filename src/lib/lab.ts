import { db } from "./db";
import { absoluteUrl } from "./mailer";

// Phase 5A, lab fulfillment pipeline (WHCC-style, real integration shape).
//
// When a store order containing lab-fulfilled physical items is placed, a
// complete lab order payload is generated and stored on the order as a
// LabOrder row (status QUEUED). When a lab endpoint + LAB_API_KEY exist and
// the lab is enabled in Store Settings, the payload is POSTed to the endpoint;
// otherwise it stays queued and the UI says exactly that.

export const LAB_STATUSES = [
  "QUEUED",
  "SENT",
  "IN_PRODUCTION",
  "SHIPPED",
  "DELIVERED",
  "REPRINT_REQUESTED",
] as const;

export const LAB_STATUS_LABELS: Record<string, string> = {
  QUEUED: "Queued",
  SENT: "Sent to lab",
  IN_PRODUCTION: "In production",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  REPRINT_REQUESTED: "Reprint requested",
};

export interface LabSettings {
  labEnabled: boolean;
  labName: string;
  labEmail: string;
  labEndpoint: string;
}

export function labConnected(settings: LabSettings): boolean {
  return settings.labEnabled && Boolean(settings.labEndpoint) && Boolean(process.env.LAB_API_KEY);
}

export function labConnectionNote(settings: LabSettings): string {
  if (labConnected(settings)) return `Connected to ${settings.labName || "the lab"}`;
  if (!settings.labEnabled) return "Ready to send, no lab connected (lab fulfillment is disabled in Store Settings)";
  if (!settings.labEndpoint) return "Ready to send, no lab connected (no API endpoint configured)";
  return "Ready to send, no lab connected (LAB_API_KEY is not set)";
}

/**
 * Build the complete lab order payload for the lab-fulfilled physical items of
 * a store order. Returns null when the order has no lab-fulfilled items.
 */
export async function buildLabPayload(
  orderId: string,
  opts: { reprint?: boolean } = {}
): Promise<Record<string, unknown> | null> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } }, collection: true },
  });
  if (!order) return null;
  const labItems = order.items.filter(
    (i) => i.category !== "DIGITAL" && i.product && !i.product.selfFulfilled
  );
  if (labItems.length === 0) return null;

  const profile = await db.storeProfile.findUnique({ where: { userId: order.userId } });
  const sheetLab = order.collection?.priceSheetId
    ? (await db.priceSheet.findUnique({ where: { id: order.collection.priceSheetId } }))?.lab
    : "";
  const labName = sheetLab || profile?.labName || "WHCC";

  return {
    lab: labName,
    orderId: order.id,
    orderNumber: order.number,
    reprint: Boolean(opts.reprint),
    placedAt: order.createdAt.toISOString(),
    customer: { name: order.customerName, email: order.customerEmail },
    shippingAddress: order.shippingAddress,
    items: labItems.map((i) => ({
      product: i.productName,
      category: i.category,
      size: i.variantName,
      // No paper option exists on products; labs receive the standard default.
      paper: i.category === "PRINT" || i.category === "CARD" ? "Lustre (standard)" : "",
      quantity: i.qty,
      imageUrl: absoluteUrl(i.photoUrl),
      filename: i.photoName,
    })),
  };
}

/** Create a LabOrder row (QUEUED) for a store order. */
export async function createLabOrder(orderId: string, opts: { reprint?: boolean } = {}) {
  const payload = await buildLabPayload(orderId, opts);
  if (!payload) return null;
  return db.labOrder.create({
    data: {
      orderId,
      lab: String(payload.lab),
      payload: JSON.stringify(payload, null, 2),
      isReprint: Boolean(opts.reprint),
      status: opts.reprint ? "REPRINT_REQUESTED" : "QUEUED",
    },
  });
}

/**
 * Attempt to POST a queued lab order's payload to the configured lab endpoint.
 * Honest result either way: when no lab is connected the order stays queued
 * and the reason is reported verbatim.
 */
export async function sendLabOrder(
  labOrderId: string
): Promise<{ sent: boolean; detail: string }> {
  const labOrder = await db.labOrder.findUnique({
    where: { id: labOrderId },
    include: { order: true },
  });
  if (!labOrder) return { sent: false, detail: "Lab order not found" };

  const profile = await db.storeProfile.findUnique({ where: { userId: labOrder.order.userId } });
  const settings: LabSettings = {
    labEnabled: profile?.labEnabled ?? false,
    labName: profile?.labName ?? "WHCC",
    labEmail: profile?.labEmail ?? "",
    labEndpoint: profile?.labEndpoint ?? "",
  };
  if (!labConnected(settings)) {
    const note = labConnectionNote(settings);
    await db.labOrder.update({ where: { id: labOrder.id }, data: { response: note } });
    return { sent: false, detail: note };
  }

  try {
    const res = await fetch(settings.labEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LAB_API_KEY}`,
        "X-Lab-Account": settings.labEmail,
      },
      body: labOrder.payload,
    });
    const text = (await res.text()).slice(0, 2000);
    if (!res.ok) {
      const detail = `Lab endpoint returned ${res.status}: ${text}`;
      await db.labOrder.update({ where: { id: labOrder.id }, data: { response: detail } });
      return { sent: false, detail };
    }
    await db.labOrder.update({
      where: { id: labOrder.id },
      data: { status: "SENT", sentAt: new Date(), response: text || `Accepted (${res.status})` },
    });
    return { sent: true, detail: `Sent to ${settings.labName} (${res.status})` };
  } catch (e) {
    const detail = `Lab endpoint unreachable: ${e instanceof Error ? e.message : String(e)}`;
    await db.labOrder.update({ where: { id: labOrder.id }, data: { response: detail } });
    return { sent: false, detail };
  }
}

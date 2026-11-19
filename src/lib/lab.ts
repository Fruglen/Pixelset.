import { db } from "./db";
import { absoluteUrl, deliveryNote, sendMail } from "./mailer";

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

  const owner = await db.user.findUnique({
    where: { id: order.userId },
    select: { businessName: true, name: true },
  });
  const studioName = owner?.businessName || owner?.name || "";

  return {
    lab: labName,
    orderId: order.id,
    orderNumber: order.number,
    reprint: Boolean(opts.reprint),
    placedAt: order.createdAt.toISOString(),
    customer: { name: order.customerName, email: order.customerEmail },
    shippingAddress: order.shippingAddress,
    // White label packaging (Store Settings): when on, the lab ships with no
    // Pixelset or lab branding, the studio name only.
    packaging: profile?.whiteLabelPackaging
      ? { whiteLabel: true, branding: "none", senderName: studioName }
      : { whiteLabel: false, branding: "standard", senderName: studioName },
    items: labItems.map((i) => ({
      product: i.productName,
      category: i.category,
      size: i.variantName,
      // No paper option exists on products; labs receive the standard default.
      paper: i.category === "PRINT" || i.category === "CARD" || i.category === "FRAMED" ? "Lustre (standard)" : "",
      frame: i.frameName || "",
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
  const labOrder = await db.labOrder.create({
    data: {
      orderId,
      lab: String(payload.lab),
      payload: JSON.stringify(payload, null, 2),
      isReprint: Boolean(opts.reprint),
      status: opts.reprint ? "REPRINT_REQUESTED" : "QUEUED",
    },
  });
  await recordLabEvent(
    labOrder.id,
    labOrder.status,
    opts.reprint ? "Reprint payload generated" : "Lab order payload generated",
    "SYSTEM"
  );
  return labOrder;
}

/**
 * Prodigi submission (owner's lab pick, Nov 18, 2026). When PRODIGI_API_KEY
 * is set, lab orders go to the Prodigi API instead of the generic endpoint:
 * sandbox at api.sandbox.prodigi.com unless PRODIGI_ENV=live. A product with
 * no Prodigi SKU mapped (product.labSku, or PRODIGI_DEFAULT_SKU) keeps the
 * order QUEUED with that reason stated, never a guessed SKU.
 */
export function prodigiConnected(): boolean {
  return Boolean(process.env.PRODIGI_API_KEY);
}

function prodigiBase(): string {
  return process.env.PRODIGI_ENV === "live"
    ? "https://api.prodigi.com"
    : "https://api.sandbox.prodigi.com";
}

async function submitToProdigi(
  labOrder: { id: string; orderId: string },
  payload: Record<string, unknown>
): Promise<{ sent: boolean; detail: string }> {
  const items = (payload.items as Array<Record<string, unknown>>) ?? [];
  const order = await db.order.findUnique({
    where: { id: labOrder.orderId },
    include: { items: { include: { product: true } } },
  });
  if (!order) return { sent: false, detail: "Order not found for Prodigi submission" };
  const labItems = order.items.filter(
    (i) => i.category !== "DIGITAL" && i.product && !i.product.selfFulfilled
  );
  const prodigiItems = [];
  for (let idx = 0; idx < labItems.length; idx++) {
    const i = labItems[idx];
    const sku =
      (i.product as unknown as { labSku?: string })?.labSku ||
      process.env.PRODIGI_DEFAULT_SKU ||
      "";
    if (!sku) {
      const detail = `Prodigi SKU not mapped for "${i.productName}". Set the product's lab SKU or PRODIGI_DEFAULT_SKU; the order stays queued.`;
      await db.labOrder.update({ where: { id: labOrder.id }, data: { response: detail } });
      return { sent: false, detail };
    }
    prodigiItems.push({
      sku,
      copies: i.qty,
      sizing: "fillPrintArea",
      assets: [{ printArea: "default", url: absoluteUrl(i.photoUrl) }],
    });
  }
  let addr: Record<string, string> = {};
  try {
    addr = typeof order.shippingAddress === "string"
      ? JSON.parse(order.shippingAddress)
      : (order.shippingAddress as Record<string, string>) ?? {};
  } catch {
    addr = {};
  }
  const body = {
    merchantReference: order.number,
    shippingMethod: "Budget",
    recipient: {
      name: order.customerName,
      email: order.customerEmail,
      address: {
        line1: addr.line1 ?? addr.address1 ?? "",
        line2: addr.line2 ?? addr.address2 ?? "",
        townOrCity: addr.city ?? "",
        stateOrCounty: addr.state ?? "",
        postalOrZipCode: addr.zip ?? addr.postalCode ?? "",
        countryCode: addr.countryCode ?? "US",
      },
    },
    items: prodigiItems,
  };
  try {
    const res = await fetch(`${prodigiBase()}/v4.0/Orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.PRODIGI_API_KEY as string,
      },
      body: JSON.stringify(body),
    });
    const text = (await res.text()).slice(0, 2000);
    if (!res.ok) {
      const detail = `Prodigi returned ${res.status}: ${text}`;
      await db.labOrder.update({ where: { id: labOrder.id }, data: { response: detail } });
      return { sent: false, detail };
    }
    let labReference = "";
    try {
      const parsed = JSON.parse(text);
      labReference = String(parsed.order?.id ?? parsed.id ?? "");
    } catch {
      // keep the raw acknowledgement only
    }
    await db.labOrder.update({
      where: { id: labOrder.id },
      data: { status: "SENT", sentAt: new Date(), response: text || `Accepted (${res.status})`, labReference, lab: "Prodigi" },
    });
    await recordLabEvent(labOrder.id, "SENT", `Accepted by Prodigi (${res.status})${labReference ? `, Prodigi order ${labReference}` : ""}`, "SYSTEM");
    await syncOrderFromLab(labOrder.orderId);
    return { sent: true, detail: `Sent to Prodigi (${res.status})` };
  } catch (e) {
    const detail = `Prodigi unreachable: ${e instanceof Error ? e.message : String(e)}`;
    await db.labOrder.update({ where: { id: labOrder.id }, data: { response: detail } });
    return { sent: false, detail };
  }
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

  if (prodigiConnected()) {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(labOrder.payload);
    } catch {
      payload = {};
    }
    return submitToProdigi(labOrder, payload);
  }

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
    let labReference = "";
    try {
      const parsed = JSON.parse(text);
      labReference = String(parsed.id ?? parsed.orderId ?? parsed.reference ?? "");
    } catch {
      // non JSON acknowledgement, keep the raw text only
    }
    await db.labOrder.update({
      where: { id: labOrder.id },
      data: { status: "SENT", sentAt: new Date(), response: text || `Accepted (${res.status})`, labReference },
    });
    await recordLabEvent(labOrder.id, "SENT", `Accepted by ${settings.labName} (${res.status})${labReference ? `, lab ref ${labReference}` : ""}`, "SYSTEM");
    await syncOrderFromLab(labOrder.orderId);
    return { sent: true, detail: `Sent to ${settings.labName} (${res.status})` };
  } catch (e) {
    const detail = `Lab endpoint unreachable: ${e instanceof Error ? e.message : String(e)}`;
    await db.labOrder.update({ where: { id: labOrder.id }, data: { response: detail } });
    return { sent: false, detail };
  }
}

// ---------------------------------------------------------------- Phase 5B timeline

export async function recordLabEvent(labOrderId: string, status: string, note: string, source: "SYSTEM" | "PHOTOGRAPHER" | "LAB") {
  return db.labOrderEvent.create({ data: { labOrderId, status, note, source } });
}

/** Normalise a lab's status word (webhooks send e.g. "in_production", "Shipped"). */
export function normaliseLabStatus(raw: string): string | null {
  const v = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    RECEIVED: "SENT",
    ACCEPTED: "SENT",
    PRINTING: "IN_PRODUCTION",
    PRODUCTION: "IN_PRODUCTION",
    PACKAGED: "IN_PRODUCTION",
    IN_TRANSIT: "SHIPPED",
    COMPLETE: "DELIVERED",
    COMPLETED: "DELIVERED",
    REPRINT: "REPRINT_REQUESTED",
  };
  const s = aliases[v] ?? v;
  return (LAB_STATUSES as readonly string[]).includes(s) ? s : null;
}

/**
 * Move a lab order to a new status, write the timeline event, store tracking,
 * sync the store order status, and email the client when it ships.
 */
export async function applyLabStatus(
  labOrderId: string,
  status: string,
  opts: { note?: string; source: "SYSTEM" | "PHOTOGRAPHER" | "LAB"; trackingNumber?: string; carrier?: string }
) {
  const labOrder = await db.labOrder.findUnique({ where: { id: labOrderId }, include: { order: { include: { user: true, collection: true } } } });
  if (!labOrder) return null;
  const data: Record<string, unknown> = { status };
  if (opts.trackingNumber !== undefined) data.trackingNumber = opts.trackingNumber.trim();
  if (opts.carrier !== undefined) data.carrier = opts.carrier.trim();
  if (status === "SENT" && !labOrder.sentAt) data.sentAt = new Date();
  await db.labOrder.update({ where: { id: labOrderId }, data });
  const tracking = opts.trackingNumber?.trim() || labOrder.trackingNumber;
  const carrier = opts.carrier?.trim() || labOrder.carrier;
  let note = opts.note?.trim() || "";
  if (status === "SHIPPED" && tracking) note = [note, `${carrier ? `${carrier} ` : ""}tracking ${tracking}`].filter(Boolean).join(", ");

  if (status === "SHIPPED" && labOrder.status !== "SHIPPED") {
    const order = labOrder.order;
    const brand = order.user.businessName || order.user.name;
    const mail = await sendMail({
      userId: order.userId,
      to: order.customerEmail,
      subject: `Your order ${order.number} has shipped`,
      text: `Hi ${order.customerName || "there"},\n\nGood news, your prints from ${order.collection?.name ? `"${order.collection.name}"` : "your gallery"} are on the way.${tracking ? `\n\nTracking: ${carrier ? `${carrier} ` : ""}${tracking}` : ""}\n\n${brand}`,
    });
    note = [note, `client shipping email: ${deliveryNote(mail)}`].filter(Boolean).join(", ");
  }
  await recordLabEvent(labOrderId, status, note, opts.source);
  await syncOrderFromLab(labOrder.orderId);
  return { ok: true };
}

/** Roll lab progress up into the store order status. */
export async function syncOrderFromLab(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { labOrders: true } });
  if (!order || order.status === "CANCELLED" || order.labOrders.length === 0) return;
  const live = order.labOrders.filter((l) => !(l.isReprint && l.status === "REPRINT_REQUESTED"));
  const all = (s: string[]) => live.length > 0 && live.every((l) => s.includes(l.status));
  let next = order.status;
  if (all(["DELIVERED"]) && order.fulfillment === "LAB") next = "COMPLETED";
  else if (all(["SHIPPED", "DELIVERED"])) next = order.status === "COMPLETED" ? "COMPLETED" : "SHIPPED";
  else if (live.some((l) => ["SENT", "IN_PRODUCTION", "SHIPPED", "DELIVERED"].includes(l.status)) && order.status === "NEW") next = "PROCESSING";
  if (next !== order.status) await db.order.update({ where: { id: orderId }, data: { status: next } });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { logStudioMessage, fmtMoney } from "@/lib/studio";
import { absoluteUrl, deliveryNote, sendMail } from "@/lib/mailer";
import { createLabOrder, sendLabOrder } from "@/lib/lab";
import {
  computeCheckout,
  downloadExpiry,
  getStoreProfile,
  newDownloadToken,
  nextOrderNumber,
  resolveCoupon,
  resolveGiftCard,
  type PricedLine,
} from "@/lib/store";
import { formatStoreMoney, parseFrames, quoteShipping, resolveTax } from "@/lib/store-rates";
import { createPayout, selfShareCents } from "@/lib/store-orders";
import { settleOrderMaths } from "@/lib/order-maths";
import { effectiveVariantPriceCents, parsePackageItems } from "@/lib/store-pricing";

// Public gallery checkout. POST { lines, customer, couponCode, giftCardCode, confirm }
// confirm=false → totals preview; confirm=true → create the order.
// Online payment is parked (GLE-120): no client input can make an order PAID.
// Anything with a balance is created AWAITING_PAYMENT, with downloads and lab
// orders held until the photographer records the payment (mark-paid).
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const collection = await db.collection.findUnique({
    where: { slug: params.slug },
    include: {
      priceSheet: { include: { products: { include: { variants: true } } } },
      user: true,
    },
  });
  if (!collection || !collection.storeEnabled || !collection.priceSheet) {
    return NextResponse.json({ error: "The store is not available for this gallery" }, { status: 404 });
  }
  if (collection.status === "DRAFT") {
    return NextResponse.json({ error: "This gallery is not available" }, { status: 404 });
  }

  const storeProfile = await getStoreProfile(collection.userId);
  if (!storeProfile.storeOpen) {
    return NextResponse.json(
      { error: storeProfile.closedMessage || "The store is closed right now, please check back soon" },
      { status: 403 }
    );
  }

  const body = await req.json();
  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  if (rawLines.length === 0) return NextResponse.json({ error: "Your cart is empty" }, { status: 400 });
  if (rawLines.length > 100) return NextResponse.json({ error: "Too many items" }, { status: 400 });

  // Resolve + price each line against the assigned price sheet.
  const products = new Map(collection.priceSheet.products.map((p) => [p.id, p]));
  const photoIds = Array.from(
    new Set(rawLines.map((l: { photoId?: unknown }) => String(l.photoId ?? "")).filter(Boolean))
  ) as string[];
  const photos = await db.photo.findMany({ where: { id: { in: photoIds }, collectionId: collection.id } });
  const photoById = new Map(photos.map((p) => [p.id, p]));

  const lines: PricedLine[] = [];
  for (const raw of rawLines) {
    const product = products.get(String(raw.productId ?? ""));
    if (!product || !product.active) return NextResponse.json({ error: "A product in your cart is no longer available" }, { status: 400 });
    const variant = product.variants.find((v) => v.id === String(raw.variantId ?? ""));
    if (!variant) return NextResponse.json({ error: "A size in your cart is no longer available" }, { status: 400 });
    const photo = photoById.get(String(raw.photoId ?? ""));
    if (!photo || photo.isPrivate) return NextResponse.json({ error: "A photo in your cart is not available" }, { status: 400 });
    const qty = Math.min(50, Math.max(1, Math.round(Number(raw.qty) || 1)));
    // Phase 5B: optional frame choice, priced on top of the size
    const frameWanted = typeof raw.frame === "string" ? raw.frame.trim() : "";
    const frame = frameWanted ? parseFrames(product.frameOptions).find((f) => f.name === frameWanted) : undefined;
    if (frameWanted && !frame) return NextResponse.json({ error: "A frame option in your cart is no longer available" }, { status: 400 });
    lines.push({
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      category: product.category,
      photoId: photo.id,
      photoUrl: photo.url,
      photoName: photo.filename,
      qty,
      // MARKUP products price from lab cost + markup; FIXED use the stored price.
      unitCents: effectiveVariantPriceCents(product, variant) + (frame?.priceCents ?? 0),
      shippingCents: product.shippingCents,
      isDigital: product.category === "DIGITAL",
      selfFulfilled: product.selfFulfilled,
      frameName: frame?.name ?? "",
    });
  }

  // Night build follow-up: package products expand into their component
  // items, so fulfillment, lab routing, payout maths and digital downloads
  // treat the bundle's contents as real items (priced at 0; the package line
  // carries the price). Components use the package line's photo.
  type ExtraItem = {
    productId: string;
    productName: string;
    variantName: string;
    category: string;
    photoId: string;
    photoUrl: string;
    photoName: string;
    qty: number;
    unitCents: number;
    frameName: string;
    isDigital: boolean;
    selfFulfilled: boolean;
  };
  const extraItems: ExtraItem[] = [];
  for (const l of lines) {
    const product = products.get(l.productId);
    if (!product || product.category !== "PACKAGE") continue;
    for (const comp of parsePackageItems(product.packageItems)) {
      const cp = products.get(comp.productId);
      const cv = cp?.variants.find((v) => v.id === comp.variantId);
      if (!cp || !cv) {
        return NextResponse.json({ error: "A product inside a package in your cart is no longer available" }, { status: 400 });
      }
      extraItems.push({
        productId: cp.id,
        productName: `${cp.name} · in ${product.name}`,
        variantName: cv.name,
        category: cp.category,
        photoId: l.photoId,
        photoUrl: l.photoUrl,
        photoName: l.photoName,
        qty: l.qty * comp.qty,
        unitCents: 0,
        frameName: "",
        isDigital: cp.category === "DIGITAL",
        selfFulfilled: cp.selfFulfilled,
      });
    }
  }

  const couponCode = typeof body.couponCode === "string" ? body.couponCode : "";
  const giftCode = typeof body.giftCardCode === "string" ? body.giftCardCode : "";
  const { coupon, error: couponError } = await resolveCoupon(collection.userId, couponCode);
  const { giftCard, error: giftCardError } = await resolveGiftCard(collection.userId, giftCode);

  // Phase 5B: named shipping methods per fulfillment group, regional tax.
  const [methods, manualRates] = await Promise.all([
    db.shippingMethod.findMany({ where: { userId: collection.userId, active: true }, orderBy: { order: "asc" } }),
    db.taxRate.findMany({ where: { userId: collection.userId, active: true } }),
  ]);
  const selection = body.shipping && typeof body.shipping === "object" ? (body.shipping as Record<string, string>) : {};
  const shippingQuote = quoteShipping(
    lines.map((l) => ({ ...l, selfFulfilled: l.selfFulfilled !== false })),
    methods,
    selection
  );
  const country = typeof body.country === "string" ? body.country.trim().toUpperCase().slice(0, 10) : "";
  const region = typeof body.region === "string" ? body.region.trim().toUpperCase().slice(0, 10) : "";
  const tax = resolveTax(storeProfile, manualRates, country, region);

  const totals = computeCheckout({
    lines,
    coupon,
    couponError,
    taxEnabled: storeProfile.taxEnabled,
    taxRate: tax.ratePct,
    giftCardBalance: giftCard ? giftCard.balanceCents : null,
    giftCardError,
    shippingCents: shippingQuote.total,
    taxShipping: storeProfile.taxShipping,
  });
  // Card is not offered while online payment is parked, whatever the store setting says.
  const paymentMethods = [{ id: "offline", label: "Pay offline", instructions: storeProfile.offlineInstructions }];
  const meta = {
    shippingGroups: shippingQuote.groups,
    taxLabel: tax.label,
    taxRatePct: tax.ratePct,
    paymentMethods,
    currency: storeProfile.currency,
  };

  if (!body.confirm) {
    return NextResponse.json({ totals, ...meta, digitalLicense: storeProfile.digitalLicense });
  }

  // ---- Confirm: validate customer, create the unpaid order ----
  if (totals.couponError) return NextResponse.json({ error: totals.couponError }, { status: 400 });
  if (totals.giftCardError) return NextResponse.json({ error: totals.giftCardError }, { status: 400 });

  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim().toLowerCase() : "";
  const shippingAddress = typeof body.shippingAddress === "string" ? body.shippingAddress.trim() : "";
  if (!customerName || !/.+@.+\..+/.test(customerEmail)) {
    return NextResponse.json({ error: "Please enter your name and a valid email" }, { status: 400 });
  }
  const hasPhysical = lines.some((l) => !l.isDigital) || extraItems.some((e) => !e.isDigital);
  if (storeProfile.taxEnabled && storeProfile.taxMode === "AUTO" && !country) {
    return NextResponse.json({ error: "Please choose your country and state or province for tax" }, { status: 400 });
  }
  // The client's paymentMethod is ignored. Only a server-computed zero balance
  // (fully covered by a validated coupon or gift card) skips AWAITING_PAYMENT.
  const awaiting = totals.total > 0;
  const paymentMethod = awaiting ? "offline" : "gift card";
  if (hasPhysical && !shippingAddress) {
    return NextResponse.json({ error: "A shipping address is required for print orders" }, { status: 400 });
  }

  const selfCount =
    lines.filter((l) => !l.isDigital && products.get(l.productId)?.selfFulfilled).length +
    extraItems.filter((e) => !e.isDigital && e.selfFulfilled).length;
  const labCount =
    lines.filter((l) => !l.isDigital && !products.get(l.productId)?.selfFulfilled).length +
    extraItems.filter((e) => !e.isDigital && !e.selfFulfilled).length;
  const fulfillment = !hasPhysical ? "DIGITAL" : labCount === 0 ? "SELF" : selfCount === 0 ? "LAB" : "MIXED";

  const order = await db.order.create({
    data: {
      userId: collection.userId,
      collectionId: collection.id,
      number: await nextOrderNumber(collection.userId),
      status: "NEW",
      customerName,
      customerEmail,
      shippingAddress,
      subtotalCents: totals.subtotal,
      discountCents: totals.discount,
      shippingCents: totals.shipping,
      taxCents: totals.tax,
      giftCardCents: totals.giftCard,
      totalCents: totals.total,
      couponCode: coupon ? coupon.code : "",
      giftCardCode: giftCard ? giftCard.code : "",
      paymentMethod,
      paymentStatus: awaiting ? "AWAITING_PAYMENT" : "PAID",
      shippingMethod: shippingQuote.groups.map((g) => `${g.label}: ${g.selectedName}`).join("; "),
      shippingCountry: country,
      shippingRegion: region,
      taxLabel: totals.tax > 0 ? tax.label : "",
      fulfillment,
      items: {
        create: [
          ...lines.map((l) => ({
            productId: l.productId,
            productName: l.productName,
            variantName: l.variantName,
            category: l.category,
            photoId: l.photoId,
            photoUrl: l.photoUrl,
            photoName: l.photoName,
            qty: l.qty,
            unitCents: l.unitCents,
            frameName: l.frameName ?? "",
            // offline orders get their links once the photographer marks them paid
            downloadToken: l.isDigital && !awaiting ? newDownloadToken() : null,
            downloadExpires: l.isDigital && !awaiting ? downloadExpiry() : null,
          })),
          // Package components ride along as their own items at $0.
          ...extraItems.map((e) => ({
            productId: e.productId,
            productName: e.productName,
            variantName: e.variantName,
            category: e.category,
            photoId: e.photoId,
            photoUrl: e.photoUrl,
            photoName: e.photoName,
            qty: e.qty,
            unitCents: 0,
            frameName: "",
            downloadToken: e.isDigital && !awaiting ? newDownloadToken() : null,
            downloadExpires: e.isDigital && !awaiting ? downloadExpiry() : null,
          })),
        ],
      },
    },
    include: { items: true },
  });

  // Night build (Pricing lane): snapshot the payout maths (lab costs,
  // processor fee, plan commission on the pre-discount subtotal, payout).
  await settleOrderMaths(order.id);

  if (coupon) {
    await db.coupon.update({ where: { id: coupon.id }, data: { useCount: { increment: 1 } } });
  }
  if (giftCard && totals.giftCard > 0) {
    await db.giftCard.update({
      where: { id: giftCard.id },
      data: { balanceCents: { decrement: totals.giftCard } },
    });
  }

  // Lab fulfillment: generate + store the complete lab order payload, then
  // attempt to send it when a lab is connected (stays queued otherwise).
  let labNote = "";
  if (labCount > 0) {
    const labOrder = await createLabOrder(order.id);
    if (labOrder && !awaiting) {
      const result = await sendLabOrder(labOrder.id);
      labNote = result.detail;
    } else if (labOrder) {
      labNote = "held until the offline payment is marked received";
    }
  }

  // Self fulfilled and digital revenue is collected by the photographer
  // directly, recorded as a payout that settles when they mark the order paid.
  await createPayout({
    userId: collection.userId,
    orderId: order.id,
    amountCents: selfShareCents(
      order,
      lines.map((l) => ({ category: l.category, qty: l.qty, unitCents: l.unitCents, selfFulfilled: l.selfFulfilled !== false }))
    ),
    method: paymentMethod,
    awaiting,
    note: awaiting ? "Offline payment, collect directly from the client" : "No payment due",
  });
  const money = (c: number) => formatStoreMoney(c, storeProfile.currency);

  await logActivity(
    collection.id,
    "ORDER",
    `Order ${order.number}, ${lines.length} item${lines.length === 1 ? "" : "s"}, ${fmtMoney(totals.total)}`,
    customerEmail
  );

  // Real order confirmation to the customer (incl. expiring download links).
  const businessName = collection.user.businessName || collection.user.name;
  const digitalItems = order.items.filter((i) => i.downloadToken);
  const confirmationMail = await sendMail({
    userId: collection.userId,
    to: customerEmail,
    subject: `Order ${order.number} confirmed, ${businessName}`,
    text: `Hi ${customerName},

Thank you for your order from "${collection.name}".

${[...lines, ...extraItems].map((l) => `- ${l.productName} (${l.variantName}${l.frameName ? `, ${l.frameName}` : ""}) x ${l.qty}, ${money(l.unitCents * l.qty)}`).join("\n")}

Subtotal: ${money(totals.subtotal)}${totals.discount ? `\nDiscount: -${money(totals.discount)}` : ""}${totals.shipping ? `\nShipping (${shippingQuote.groups.map((g) => g.selectedName).join(", ")}): ${money(totals.shipping)}` : ""}${totals.tax ? `\n${tax.label}: ${money(totals.tax)}` : ""}${totals.giftCard ? `\nGift card: -${money(totals.giftCard)}` : ""}
${awaiting ? `Total due: ${money(totals.total)}\n\nYou have not been charged. Online payment is not enabled yet.\nHow to pay: ${storeProfile.offlineInstructions || "the photographer will contact you with payment details"}.${digitalItems.length ? " Your download links are emailed once payment is received." : ""}` : `Total due: ${money(totals.total)}`}
${
  digitalItems.length
    ? `\nYour digital downloads (links expire in 7 days):\n${digitalItems
        .map((i) => `- ${i.photoName}: ${absoluteUrl(`/api/store/download/${i.downloadToken}`)}`)
        .join("\n")}\n`
    : ""
}
${businessName}`,
  });

  await logStudioMessage(collection.userId, {
    kind: "PAYMENT",
    name: customerName,
    email: customerEmail,
    subject: `New store order ${order.number}, ${fmtMoney(totals.total)}`,
    body: `${customerName} ordered ${lines.length} item${lines.length === 1 ? "" : "s"} from “${collection.name}” (${fmtMoney(totals.total)} ${awaiting ? "due, not yet paid" : "due"}${totals.giftCard ? `, ${fmtMoney(totals.giftCard)} by gift card` : ""}). Fulfillment: ${fulfillment}.${labNote ? ` Lab: ${labNote}.` : ""}`,
    meta: `${awaiting ? "Offline payment, awaiting" : "No payment due"} · store · confirmation ${deliveryNote(confirmationMail)}`,
    read: false,
  });

  return NextResponse.json({
    orderNumber: order.number,
    totals,
    ...meta,
    paymentMethod,
    awaitingPayment: awaiting,
    onlinePaymentEnabled: false,
    offlineInstructions: awaiting ? storeProfile.offlineInstructions : "",
    emailDelivered: confirmationMail.sent,
    emailNote: deliveryNote(confirmationMail),
    digitalLicense: storeProfile.digitalLicense,
    downloads: order.items
      .filter((i) => i.downloadToken)
      .map((i) => ({
        photoName: i.photoName,
        productName: i.productName,
        url: `/api/store/download/${i.downloadToken}`,
        expires: i.downloadExpires?.toISOString() ?? "",
      })),
  });
}

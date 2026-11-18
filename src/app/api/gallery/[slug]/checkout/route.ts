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

// Public gallery checkout. POST { lines, customer, couponCode, giftCardCode, confirm }
// confirm=false → totals preview; confirm=true → create the order (mock payment always succeeds).
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
    lines.push({
      productId: product.id,
      productName: product.name,
      variantName: variant.name,
      category: product.category,
      photoId: photo.id,
      photoUrl: photo.url,
      photoName: photo.filename,
      qty,
      unitCents: variant.priceCents,
      shippingCents: product.shippingCents,
      isDigital: product.category === "DIGITAL",
    });
  }

  const storeProfile = await getStoreProfile(collection.userId);
  const couponCode = typeof body.couponCode === "string" ? body.couponCode : "";
  const giftCode = typeof body.giftCardCode === "string" ? body.giftCardCode : "";
  const { coupon, error: couponError } = await resolveCoupon(collection.userId, couponCode);
  const { giftCard, error: giftCardError } = await resolveGiftCard(collection.userId, giftCode);

  const totals = computeCheckout({
    lines,
    coupon,
    couponError,
    taxEnabled: storeProfile.taxEnabled,
    taxRate: storeProfile.taxRate,
    giftCardBalance: giftCard ? giftCard.balanceCents : null,
    giftCardError,
  });

  if (!body.confirm) {
    return NextResponse.json({ totals, digitalLicense: storeProfile.digitalLicense });
  }

  // ---- Confirm: validate customer, create the order (mock payment) ----
  if (totals.couponError) return NextResponse.json({ error: totals.couponError }, { status: 400 });
  if (totals.giftCardError) return NextResponse.json({ error: totals.giftCardError }, { status: 400 });

  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim().toLowerCase() : "";
  const shippingAddress = typeof body.shippingAddress === "string" ? body.shippingAddress.trim() : "";
  if (!customerName || !/.+@.+\..+/.test(customerEmail)) {
    return NextResponse.json({ error: "Please enter your name and a valid email" }, { status: 400 });
  }
  const hasPhysical = lines.some((l) => !l.isDigital);
  if (hasPhysical && !shippingAddress) {
    return NextResponse.json({ error: "A shipping address is required for print orders" }, { status: 400 });
  }

  const selfCount = lines.filter((l) => !l.isDigital && products.get(l.productId)?.selfFulfilled).length;
  const labCount = lines.filter((l) => !l.isDigital && !products.get(l.productId)?.selfFulfilled).length;
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
      paymentMethod: totals.total === 0 ? "gift card" : "card",
      fulfillment,
      items: {
        create: lines.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          variantName: l.variantName,
          category: l.category,
          photoId: l.photoId,
          photoUrl: l.photoUrl,
          photoName: l.photoName,
          qty: l.qty,
          unitCents: l.unitCents,
          downloadToken: l.isDigital ? newDownloadToken() : null,
          downloadExpires: l.isDigital ? downloadExpiry() : null,
        })),
      },
    },
    include: { items: true },
  });

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
    if (labOrder) {
      const result = await sendLabOrder(labOrder.id);
      labNote = result.detail;
    }
  }

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

${lines.map((l) => `- ${l.productName} (${l.variantName}) × ${l.qty}, ${fmtMoney(l.unitCents * l.qty)}`).join("\n")}

Subtotal: ${fmtMoney(totals.subtotal)}${totals.discount ? `\nDiscount: -${fmtMoney(totals.discount)}` : ""}${totals.shipping ? `\nShipping: ${fmtMoney(totals.shipping)}` : ""}${totals.tax ? `\nTax: ${fmtMoney(totals.tax)}` : ""}${totals.giftCard ? `\nGift card: -${fmtMoney(totals.giftCard)}` : ""}
Total charged: ${fmtMoney(totals.total)}
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
    body: `${customerName} ordered ${lines.length} item${lines.length === 1 ? "" : "s"} from “${collection.name}” (${fmtMoney(totals.total)} charged${totals.giftCard ? `, ${fmtMoney(totals.giftCard)} by gift card` : ""}). Fulfillment: ${fulfillment}.${labNote ? ` Lab: ${labNote}.` : ""}`,
    meta: `Mock payment · store · confirmation ${deliveryNote(confirmationMail)}`,
    read: false,
  });

  return NextResponse.json({
    orderNumber: order.number,
    totals,
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

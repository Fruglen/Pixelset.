import type { PrismaClient } from "@prisma/client";

// Phase 5B seed data for the store section: shipping methods, manual and
// automatic tax, offline payments, a framed wall art product, payouts, a lab
// order timeline, and a per client mobile app install.
export async function seed(db: PrismaClient, userId: string) {
  // The base seed wipes the classic tables but does not know these Phase 5B
  // models (they carry no relation to User), so clear them for a clean reset.
  await db.storePayout.deleteMany({});
  await db.labOrderEvent.deleteMany({});
  await db.mobileAppClient.deleteMany({});
  await db.shippingMethod.deleteMany({});
  await db.taxRate.deleteMany({});

  await db.storeProfile.updateMany({
    where: { userId },
    data: {
      storeOpen: true,
      currency: "USD",
      cardPayments: true,
      offlinePayments: true,
      offlineInstructions: "Pay by Zelle or bank transfer to payments@lightandshadow.studio, with your order number as the reference.",
      taxMode: "AUTO",
      taxNexus: "",
      taxShipping: false,
    },
  });

  await db.shippingMethod.deleteMany({ where: { userId } });
  await db.shippingMethod.createMany({
    data: [
      { userId, name: "Standard", speed: "5-7 business days", appliesTo: "ALL", baseCents: 800, perItemCents: 100, freeOverCents: 15000, order: 0 },
      { userId, name: "Express", speed: "2 business days", appliesTo: "ALL", baseCents: 2400, perItemCents: 200, order: 1 },
      { userId, name: "Studio pickup", speed: "Ready in 3 days, Austin studio", appliesTo: "SELF", baseCents: 0, order: 2 },
    ],
  });

  await db.taxRate.deleteMany({ where: { userId } });
  await db.taxRate.createMany({
    data: [
      { userId, name: "Austin combined rate", country: "US", region: "TX", ratePct: 8.25 },
      { userId, name: "Canada GST only", country: "CA", region: "AB", ratePct: 5 },
    ],
  });

  // Framed wall art on the wedding price sheet, and frame choices on prints.
  const sheet = await db.priceSheet.findFirst({ where: { userId, name: "Wedding Collection Store" } });
  if (sheet) {
    await db.product.updateMany({
      where: { priceSheetId: sheet.id, name: "Fine Art Print" },
      data: {
        frameOptions: JSON.stringify([
          { name: "Black wood frame", priceCents: 4500 },
          { name: "White wood frame", priceCents: 4500 },
          { name: "Natural oak frame", priceCents: 5500 },
        ]),
      },
    });
    const exists = await db.product.findFirst({ where: { priceSheetId: sheet.id, category: "FRAMED" } });
    if (!exists) {
      await db.product.create({
        data: {
          priceSheetId: sheet.id,
          name: "Framed Wall Art",
          category: "FRAMED",
          description: "Museum matted print in a handmade frame, ready to hang. Printed, framed and shipped by WHCC.",
          selfFulfilled: false,
          shippingCents: 1800,
          order: 5,
          frameOptions: JSON.stringify([
            { name: "Black wood frame", priceCents: 0 },
            { name: "White wood frame", priceCents: 0 },
            { name: "Natural oak frame", priceCents: 1500 },
            { name: "Gold gallery frame", priceCents: 3500 },
          ]),
          variants: {
            create: [
              { name: "8×10", priceCents: 9500, order: 0 },
              { name: "11×14", priceCents: 14500, order: 1 },
              { name: "16×20", priceCents: 22500, order: 2 },
            ],
          },
        },
      });
    }
  }

  // Payout records for existing orders (self fulfilled and digital share).
  const orders = await db.order.findMany({ where: { userId }, include: { items: { include: { product: true } }, labOrders: true } });
  for (const o of orders) {
    const own = o.items
      .filter((i) => i.category === "DIGITAL" || (i.product ? i.product.selfFulfilled : true))
      .reduce((s, i) => s + i.qty * i.unitCents, 0);
    const amount = o.subtotalCents > 0 ? Math.round((o.totalCents * Math.min(own, o.subtotalCents)) / o.subtotalCents) : 0;
    if (amount > 0 && !(await db.storePayout.findUnique({ where: { orderId: o.id } }))) {
      await db.storePayout.create({
        data: {
          userId,
          orderId: o.id,
          amountCents: amount,
          method: o.paymentMethod,
          status: o.status === "CANCELLED" ? "CANCELLED" : "PAID",
          paidAt: o.createdAt,
          note: "Paid to you directly (mocked per the owner's payments exclusion)",
          createdAt: o.createdAt,
        },
      });
    }
    if (o.shippingAddress.includes("TX") && !o.shippingCountry) {
      await db.order.update({ where: { id: o.id }, data: { shippingCountry: "US", shippingRegion: "TX", taxLabel: o.taxCents ? "Austin combined rate (8.25%)" : "" } });
    }
    for (const lo of o.labOrders) {
      if ((await db.labOrderEvent.count({ where: { labOrderId: lo.id } })) === 0) {
        await db.labOrderEvent.create({
          data: { labOrderId: lo.id, status: "QUEUED", note: "Lab order payload generated, no lab connected", source: "SYSTEM", createdAt: lo.createdAt },
        });
      }
    }
  }

  // Per client mobile app install for Emma.
  const app = await db.mobileApp.findFirst({ where: { userId } });
  const emma = await db.contact.findFirst({ where: { userId, email: "emma@example.com" } });
  if (app && !(await db.mobileAppClient.findFirst({ where: { appId: app.id } }))) {
    await db.mobileAppClient.create({
      data: {
        userId,
        appId: app.id,
        contactId: emma?.id ?? "",
        clientName: emma?.name ?? "Emma James",
        clientEmail: emma?.email ?? "emma@example.com",
        greeting: "Hi {name}, thank you for letting us be part of your day!",
        slug: `${app.slug}-emma`,
      },
    });
  }
}

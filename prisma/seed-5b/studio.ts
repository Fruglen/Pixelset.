import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

// Phase 5B seed data for the studio section.
export async function seed(db: PrismaClient, userId: string) {
  // Phase 5B studio models carry userId without a relation, so a reseed (which
  // deletes and recreates the demo user) leaves orphans behind: clear them.
  const users = (await db.user.findMany({ select: { id: true } })).map((u) => u.id);
  for (const m of [db.leadForm, db.paymentLink, db.studioPayment, db.questionnaireRequest] as unknown as { deleteMany: (a: unknown) => Promise<unknown> }[]) {
    await m.deleteMany({ where: { userId: { notIn: users } } });
  }

  // ---- Availability rules on the regular session types
  const weekdays = [{ start: "09:00", end: "17:00" }];
  const nextSaturday = new Date();
  nextSaturday.setDate(nextSaturday.getDate() + ((6 - nextSaturday.getDay() + 7) % 7 || 7) + 7);
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await db.sessionType.updateMany({
    where: { userId, name: "Portrait Session" },
    data: {
      bufferBeforeMin: 15,
      bufferMin: 30,
      reminderHoursBefore: 48,
      availability: JSON.stringify({
        hours: { "0": [], "1": weekdays, "2": weekdays, "3": [{ start: "09:00", end: "12:00" }, { start: "15:00", end: "19:00" }], "4": weekdays, "5": weekdays, "6": [{ start: "10:00", end: "14:00" }] },
        overrides: [{ date: ymd(nextSaturday), closed: true }],
        minNoticeHours: 48,
        maxPerDay: 2,
        intervalMin: 30,
        windowDays: 90,
      }),
    },
  });
  await db.sessionType.updateMany({
    where: { userId, name: "Full Wedding Coverage" },
    data: {
      availability: JSON.stringify({
        hours: { "0": [{ start: "10:00", end: "20:00" }], "1": [], "2": [], "3": [], "4": [], "5": [{ start: "12:00", end: "20:00" }], "6": [{ start: "10:00", end: "20:00" }] },
        overrides: [],
        minNoticeHours: 24 * 30,
        maxPerDay: 1,
        intervalMin: 60,
        windowDays: 540,
      }),
    },
  });
  // Consultation call becomes a real video call type with an auto generated room per booking.
  await db.sessionType.updateMany({
    where: { userId, name: "Consultation Call" },
    data: { locationType: "VIDEO", location: "", meetingLink: "", reminderHoursBefore: 2 },
  });
  // A phone call session type.
  const existingPhone = await db.sessionType.findFirst({ where: { userId, name: "Quick Phone Chat" } });
  if (!existingPhone) {
    await db.sessionType.create({
      data: {
        userId,
        name: "Quick Phone Chat",
        description: "A 15 minute call to answer your questions. We will call you at the number you give us.",
        durationMin: 15,
        priceCents: 0,
        locationType: "PHONE",
        location: "",
        retainerType: "NONE",
      },
    });
  }

  // ---- Contract template branding
  await db.contractTemplate.updateMany({
    where: { userId, name: "Wedding Photography Agreement" },
    data: {
      brandColor: "#8a6a4f",
      brandLogoUrl: "/api/placeholder?w=440&h=120&seed=logo&text=Light%20%26%20Shadow",
      headerImageUrl: "/api/placeholder?w=1400&h=420&seed=contract-header",
    },
  });
  await db.contract.updateMany({
    where: { userId, template: { name: "Wedding Photography Agreement" } },
    data: {
      brandColor: "#8a6a4f",
      brandLogoUrl: "/api/placeholder?w=440&h=120&seed=logo&text=Light%20%26%20Shadow",
      headerImageUrl: "/api/placeholder?w=1400&h=420&seed=contract-header",
    },
  });

  // ---- Invoice template + reminder schedule on the seeded invoice
  await db.invoice.updateMany({ where: { userId, number: "INV-0001" }, data: { template: "MODERN", reminderSchedule: JSON.stringify([-3, 0, 3, 7]) } });

  // ---- Quote with packages and optional extras
  await db.quote.updateMany({
    where: { userId, number: "QT-0001" },
    data: {
      title: "June 2027 wedding, collection options",
      items: JSON.stringify([
        { description: "Engagement session", qty: 1, unitCents: 45000, kind: "fixed", group: "", preselected: false },
        { description: "Full Wedding Coverage (8 hours)", qty: 1, unitCents: 380000, kind: "package", group: "Coverage", preselected: true },
        { description: "Essential Coverage (6 hours)", qty: 1, unitCents: 300000, kind: "package", group: "Coverage", preselected: false },
        { description: "Signature Coverage (10 hours, second shooter)", qty: 1, unitCents: 480000, kind: "package", group: "Coverage", preselected: false },
        { description: "Heirloom album (30 pages)", qty: 1, unitCents: 65000, kind: "optional", group: "", preselected: true },
        { description: "Parent albums (pair)", qty: 1, unitCents: 50000, kind: "optional", group: "", preselected: false },
        { description: "Rehearsal dinner coverage (2 hours)", qty: 1, unitCents: 60000, kind: "optional", group: "", preselected: false },
      ]),
    },
  });

  // ---- Feedback questionnaire, auto sent after delivery
  const feedback = await db.questionnaire.create({
    data: {
      userId,
      name: "How did we do?",
      kind: "FEEDBACK",
      fields: JSON.stringify([
        { id: "rating", type: "choice", label: "How would you rate your experience?", options: "5 - Wonderful, 4 - Great, 3 - Good, 2 - Fair, 1 - Poor", required: true },
        { id: "loved", type: "textarea", label: "What did you love most?", options: "", required: false },
        { id: "testimonial", type: "textarea", label: "A few words we could share as a testimonial", options: "", required: false },
        { id: "improve", type: "textarea", label: "Anything we could do better?", options: "", required: false },
      ]),
    },
  });
  await db.studioProfile.updateMany({ where: { userId }, data: { feedbackQuestionnaireId: feedback.id, inboundToken: "demo7f3a2c" } });
  const olivia = await db.contact.findFirst({ where: { userId, email: "olivia.grant@example.com" } });
  const emma = await db.contact.findFirst({ where: { userId, email: "emma@example.com" } });
  if (olivia) {
    const req = await db.questionnaireRequest.create({
      data: { userId, questionnaireId: feedback.id, contactId: olivia.id, email: olivia.email, name: olivia.name, reason: "DELIVERY", sentAt: new Date(Date.now() - 5 * 86_400_000) },
    });
    const resp = await db.questionnaireResponse.create({
      data: {
        questionnaireId: feedback.id,
        contactId: olivia.id,
        respondentName: olivia.name,
        respondentEmail: olivia.email,
        testimonial: true,
        answers: JSON.stringify({ rating: "5 - Wonderful", loved: "How relaxed the whole day felt.", testimonial: "We forgot the camera was even there, and the photos made us cry happy tears." }),
      },
    });
    await db.questionnaireRequest.update({ where: { id: req.id }, data: { completedAt: new Date(Date.now() - 4 * 86_400_000), responseId: resp.id } });
  }
  const wedQ = await db.questionnaire.findFirst({ where: { userId, kind: "STANDARD" } });
  if (wedQ && emma) {
    await db.questionnaireRequest.create({
      data: { userId, questionnaireId: wedQ.id, contactId: emma.id, email: emma.email, name: emma.name, sentAt: new Date(Date.now() - 3 * 86_400_000) },
    });
  }

  // ---- Lead form
  await db.leadForm.create({
    data: {
      userId,
      name: "Wedding inquiry",
      token: "wedding-inquiry-demo",
      heading: "Let's plan your wedding photography",
      intro: "Tell us about your day and we'll reply within two business days with availability and collections.",
      fields: JSON.stringify([
        { id: "date", type: "date", label: "Wedding date", options: "", required: true },
        { id: "venue", type: "text", label: "Venue or city", options: "", required: false },
        { id: "guests", type: "choice", label: "Guest count", options: "Under 50, 50 to 120, 120 to 200, 200 plus", required: false },
        { id: "message", type: "textarea", label: "Tell us about your plans", options: "", required: false },
      ]),
      thanks: "Thank you! We'll be in touch within two business days.",
    },
  });

  // ---- Payment links
  await db.paymentLink.create({ data: { userId, title: "Post session tip", description: "Thank you for the kindness, it is always appreciated.", amountCents: 0, token: "tip-demo" } });
  const printLink = await db.paymentLink.create({ data: { userId, title: "16x20 fine art print", description: "Archival giclee print, signed.", amountCents: 18500, token: "print-demo" } });
  await db.studioPayment.create({
    data: { userId, source: "PAYMENT_LINK", sourceId: printLink.id, label: printLink.title, payerName: "Marcus Lee", payerEmail: "marcus.lee@example.com", amountCents: 18500, method: "card", createdAt: new Date(Date.now() - 6 * 86_400_000) },
  });

  // ---- Preset reminder automations that are not already in the base seed
  const presets = [
    { name: "Unaccepted quote reminder", trigger: "QUOTE_UNACCEPTED", conditions: [{ field: "days_since_sent", op: "gte", value: 3 }], actions: [{ type: "SEND_EMAIL", templateKey: "QUOTE_REMINDER" }] },
    { name: "Incomplete questionnaire reminder", trigger: "QUESTIONNAIRE_INCOMPLETE", conditions: [{ field: "days_since_sent", op: "gte", value: 2 }], actions: [{ type: "SEND_EMAIL", templateKey: "QUESTIONNAIRE_REMINDER" }] },
    { name: "Upcoming session reminder", trigger: "SESSION_UPCOMING", conditions: [{ field: "hours_until_session", op: "lte", value: 48 }], actions: [{ type: "SEND_EMAIL", templateKey: "BOOKING_REMINDER" }] },
  ];
  for (const p of presets) {
    const exists = await db.automation.findFirst({ where: { userId, trigger: p.trigger } });
    if (!exists) await db.automation.create({ data: { userId, name: p.name, trigger: p.trigger, conditions: JSON.stringify(p.conditions), actions: JSON.stringify(p.actions), active: true } });
  }

  // ---- An Awaiting Client booking created by the photographer
  const portrait = await db.sessionType.findFirst({ where: { userId, name: "Portrait Session" } });
  const marcus = await db.contact.findFirst({ where: { userId, email: "marcus.lee@example.com" } });
  if (portrait && marcus) {
    const start = new Date();
    start.setDate(start.getDate() + 12);
    while (start.getDay() === 0 || start.getDay() === 6) start.setDate(start.getDate() + 1);
    start.setHours(10, 0, 0, 0);
    const booking = await db.booking.create({
      data: {
        userId,
        sessionTypeId: portrait.id,
        contactId: marcus.id,
        title: portrait.name,
        startsAt: start,
        endsAt: new Date(start.getTime() + portrait.durationMin * 60_000),
        status: "AWAITING_CLIENT",
        totalCents: portrait.priceCents,
        retainerCents: 15000,
        source: "MANUAL",
        clientToken: "awaiting-demo",
      },
    });
    await db.project.create({ data: { userId, name: `${marcus.name}, ${portrait.name}`, contactId: marcus.id, bookingId: booking.id, stage: "BOOKED", order: 99 } });
  }
  // Older seeded bookings get a client page token so the manage link works.
  const untokened = await db.booking.findMany({ where: { userId, clientToken: null }, select: { id: true } });
  for (const b of untokened) await db.booking.update({ where: { id: b.id }, data: { clientToken: randomUUID() } });

  // ---- An inbound email and a few notifications for the header bell
  await db.studioMessage.create({
    data: {
      userId,
      kind: "INBOUND",
      name: "Olivia Grant",
      email: "olivia.grant@example.com",
      subject: "Re: Your quote QT-0001 from Light & Shadow",
      body: "Hi! We love the Signature coverage option. Could we add the rehearsal dinner too? Thank you, Olivia",
      meta: "Received by email · to inbox+demo7f3a2c@mail.pixelset.app",
      read: false,
    },
  });
  const now = Date.now();
  await db.notification.createMany({
    data: [
      { userId, kind: "MESSAGE", title: "New email from Olivia Grant", body: "Re: Your quote QT-0001", href: "/studio/inbox", createdAt: new Date(now - 20 * 60_000) },
      { userId, kind: "QUESTIONNAIRE_COMPLETED", title: "Olivia Grant completed How did we do?", body: "New feedback", href: `/studio/questionnaires/${feedback.id}`, createdAt: new Date(now - 4 * 86_400_000), read: true },
      { userId, kind: "INVOICE_PAID", title: "Marcus Lee paid $185.00", body: "16x20 fine art print", href: "/studio/reports", createdAt: new Date(now - 6 * 86_400_000), read: true },
    ],
  });
}

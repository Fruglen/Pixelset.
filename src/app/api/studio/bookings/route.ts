import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { calcTotals, fmtMoney, logStudioMessage, renderSmartFields, retainerAmount, upsertContact } from "@/lib/studio";
import { computeSlots, generateMeetingLink, whereLabel, ymd } from "@/lib/availability";
import { sendBookingCompletionRequest, sendBookingConfirmation } from "@/lib/studio-flow";
import { formatDate } from "@/lib/utils";

// Manual booking from the dashboard (Phase 5B: same rules as the public flow,
// without payment). mode CONFIRMED books it outright; mode AWAITING_CLIENT
// reserves the time and emails the client a link to finish their steps
// (questionnaire, contract, retainer), which flips it to Confirmed.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const mode = body.mode === "AWAITING_CLIENT" ? "AWAITING_CLIENT" : "CONFIRMED";

  // Contact: existing id or new name/email
  let contactId: string | null = null;
  if (typeof body.contactId === "string" && body.contactId) {
    const c = await db.contact.findFirst({ where: { id: body.contactId, userId: user.id } });
    if (!c) return NextResponse.json({ error: "Contact not found" }, { status: 400 });
    contactId = c.id;
  } else if (typeof body.clientName === "string" && body.clientName.trim()) {
    const c = await upsertContact(user.id, {
      name: body.clientName.trim(),
      email: typeof body.clientEmail === "string" ? body.clientEmail : "",
      phone: typeof body.clientPhone === "string" ? body.clientPhone : "",
    });
    contactId = c.id;
  }
  const contact = contactId ? await db.contact.findUnique({ where: { id: contactId } }) : null;
  if (mode === "AWAITING_CLIENT" && !contact?.email) {
    return NextResponse.json({ error: "The client needs an email address to complete their booking." }, { status: 400 });
  }

  let sessionType = null;
  if (typeof body.sessionTypeId === "string" && body.sessionTypeId) {
    sessionType = await db.sessionType.findFirst({
      where: { id: body.sessionTypeId, userId: user.id },
      include: { contractTemplate: true },
    });
  }

  let startsAt: Date;
  let endsAt: Date;
  let slotId: string | null = null;
  if (sessionType?.isMini) {
    const slot = await db.miniSlot.findFirst({
      where: { id: String(body.slotId ?? ""), date: { sessionTypeId: sessionType.id } },
      include: { bookings: { where: { status: { in: ["CONFIRMED", "PENDING", "AWAITING_CLIENT"] } } } },
    });
    if (!slot) return NextResponse.json({ error: "Pick a mini session spot" }, { status: 400 });
    if (slot.bookings.length >= slot.capacity) return NextResponse.json({ error: "That spot is full." }, { status: 409 });
    slotId = slot.id;
    startsAt = slot.startsAt;
    endsAt = slot.endsAt;
  } else {
    const date = typeof body.date === "string" ? body.date : "";
    const time = typeof body.time === "string" ? body.time : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ error: "Pick a date and time" }, { status: 400 });
    }
    startsAt = new Date(`${date}T${time}:00`);
    if (isNaN(startsAt.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    const durationMin = Math.max(5, Math.round(Number(body.durationMin) || sessionType?.durationMin || 60));
    endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
    // Availability and conflicts apply unless the photographer chose to book anyway.
    if (sessionType && body.force !== true) {
      const days = await computeSlots(sessionType, { from: ymd(startsAt), days: 1, ignoreNotice: true });
      if (!days.some((d) => d.slots.includes(startsAt.toISOString()))) {
        return NextResponse.json(
          { error: "That time is outside this session type's availability or clashes with another booking.", conflict: true },
          { status: 409 }
        );
      }
    }
  }

  const title = (typeof body.title === "string" && body.title.trim()) || sessionType?.name || "Session";
  const priceCents = sessionType ? sessionType.priceCents : Math.max(0, Math.round(Number(body.priceCents) || 0));
  const totals = calcTotals([{ description: title, qty: 1, unitCents: priceCents }], sessionType?.taxRate ?? 0, "NONE", 0);
  const retainer = sessionType ? retainerAmount(sessionType.retainerType, sessionType.retainerValue, totals.total) : 0;

  const booking = await db.booking.create({
    data: {
      userId: user.id,
      sessionTypeId: sessionType?.id ?? null,
      slotId,
      contactId,
      title,
      startsAt,
      endsAt,
      status: mode,
      totalCents: totals.total,
      retainerCents: retainer,
      paymentStatus: "UNPAID",
      notes: typeof body.notes === "string" ? body.notes : "",
      source: "MANUAL",
      clientToken: randomUUID(),
      meetingLink:
        sessionType?.locationType === "VIDEO"
          ? sessionType.meetingLink || generateMeetingLink(`${title}-${contact?.name ?? ""}`)
          : sessionType?.locationType === "ZOOM"
            ? sessionType.location
            : "",
      callPhone: sessionType?.locationType === "PHONE" ? contact?.phone ?? "" : "",
    },
  });

  // Contract opens for the client to sign on their booking page.
  if (mode === "AWAITING_CLIENT" && sessionType?.contractTemplate && contact) {
    const rendered = renderSmartFields(sessionType.contractTemplate.body, {
      client_name: contact.name,
      client_email: contact.email,
      client_phone: contact.phone,
      session_type: title,
      session_date: formatDate(startsAt),
      session_location: whereLabel(sessionType, booking),
      session_price: fmtMoney(totals.total),
      retainer: fmtMoney(retainer),
      business_name: user.businessName || user.name,
      photographer_name: user.name,
      today: formatDate(new Date()),
    });
    await db.contract.create({
      data: {
        userId: user.id,
        templateId: sessionType.contractTemplate.id,
        contactId: contact.id,
        bookingId: booking.id,
        title: `${sessionType.contractTemplate.name}, ${contact.name}`,
        body: rendered,
        status: "SENT",
        sentAt: new Date(),
        brandLogoUrl: sessionType.contractTemplate.brandLogoUrl,
        brandColor: sessionType.contractTemplate.brandColor,
        headerImageUrl: sessionType.contractTemplate.headerImageUrl,
      },
    });
  }

  // Feed the projects board.
  const max = await db.project.aggregate({ where: { userId: user.id, stage: "BOOKED" }, _max: { order: true } });
  await db.project.create({
    data: {
      userId: user.id,
      name: contact ? `${contact.name}, ${title}` : title,
      contactId,
      bookingId: booking.id,
      stage: "BOOKED",
      order: (max._max.order ?? 0) + 1,
    },
  });

  let delivery = "";
  if (mode === "AWAITING_CLIENT") {
    delivery = await sendBookingCompletionRequest(booking.id);
  } else {
    if (contact) await db.contact.update({ where: { id: contact.id }, data: { state: "CLIENT" } });
    if (body.sendConfirmation !== false && contact?.email) delivery = await sendBookingConfirmation(booking.id);
  }
  await logStudioMessage(user.id, {
    kind: "BOOKING",
    name: contact?.name ?? "",
    email: contact?.email ?? "",
    subject: `${mode === "AWAITING_CLIENT" ? "Booking awaiting client" : "Booking created"}: ${title}${contact ? `, ${contact.name}` : ""}`,
    body: `Created by you for ${formatDate(startsAt)}.`,
    meta: delivery,
    read: true,
  });

  return NextResponse.json({ id: booking.id, status: mode, delivery, manageUrl: `/book/manage/${booking.clientToken}` });
}

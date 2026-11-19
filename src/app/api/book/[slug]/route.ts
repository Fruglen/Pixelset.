import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calcTotals,
  fmtMoney,
  logStudioMessage,
  renderSmartFields,
  retainerAmount,
  upsertContact,
} from "@/lib/studio";
import { formatDate } from "@/lib/utils";
import { generateMeetingLink, isSlotOpen, whereLabel } from "@/lib/availability";
import { resolveBookingCoupon } from "@/lib/booking-coupons";
import { syncBookingToGoogle } from "@/lib/google-calendar";
import { sendBookingConfirmation } from "@/lib/studio-flow";
import { notify } from "@/lib/notify";
import { randomUUID } from "crypto";
import { STUDIO_LIMITS, planFor } from "@/lib/plans";

// Public booking endpoint for /book/[slug]. Creates the booking (or a waitlist
// entry when a mini slot is full), the contact, the questionnaire response and -
// when the session type carries a contract template, the contract to sign.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const profile = await db.studioProfile.findUnique({ where: { bookingSlug: params.slug } });
  if (!profile) return NextResponse.json({ error: "Booking site not found" }, { status: 404 });
  const user = await db.user.findUnique({ where: { id: profile.userId } });
  if (!user) return NextResponse.json({ error: "Booking site not found" }, { status: 404 });

  const body = await req.json();
  const sessionType = await db.sessionType.findFirst({
    where: { id: String(body.sessionTypeId ?? ""), userId: user.id },
    include: { addOns: true, questionnaire: true, contractTemplate: true },
  });
  if (!sessionType || (sessionType.isMini ? !sessionType.published : !sessionType.active)) {
    return NextResponse.json({ error: "That session is not open for booking" }, { status: 404 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!name) return NextResponse.json({ error: "Enter your name" }, { status: 400 });
  if (!/.+@.+\..+/.test(email)) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (sessionType.locationType === "PHONE" && !sessionType.location && !phone) {
    // the photographer calls the client, so a number is required
    return NextResponse.json({ error: "Enter a phone number so we can call you." }, { status: 400 });
  }

  // ---- Resolve the time: a mini slot, or a date + time for regular sessions.
  let startsAt: Date;
  let endsAt: Date;
  let slotId: string | null = null;
  let waitlisted = false;

  if (sessionType.isMini) {
    const slot = await db.miniSlot.findFirst({
      where: { id: String(body.slotId ?? ""), date: { sessionTypeId: sessionType.id } },
      include: { bookings: { where: { status: { in: ["CONFIRMED", "PENDING", "AWAITING_CLIENT"] } } } },
    });
    if (!slot) return NextResponse.json({ error: "Pick a time slot" }, { status: 400 });
    if (slot.bookings.length >= slot.capacity) {
      if (!sessionType.waitlistEnabled) {
        return NextResponse.json({ error: "That slot just filled up, pick another time." }, { status: 409 });
      }
      waitlisted = true;
    }
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
    if (startsAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Pick a date in the future" }, { status: 400 });
    }
    // Phase 5B: the time must be one of the live computed slots (hours, notice,
    // daily cap, buffers, and every existing booking are all checked here).
    if (!(await isSlotOpen(sessionType, startsAt))) {
      return NextResponse.json({ error: "That time is no longer available, pick another slot." }, { status: 409 });
    }
    endsAt = new Date(startsAt.getTime() + sessionType.durationMin * 60_000);
  }

  // ---- Add-ons (ids validated against the session type's own list).
  const addOnIds: string[] = Array.isArray(body.addOnIds) ? body.addOnIds.map(String) : [];
  const chosenAddOns = sessionType.addOns.filter((a) => addOnIds.includes(a.id));

  // ---- Totals + retainer.
  const items = [{ description: sessionType.name, qty: 1, unitCents: sessionType.priceCents }];
  for (const a of chosenAddOns) items.push({ description: a.name, qty: 1, unitCents: a.priceCents });
  // Night build follow-up: booking coupon, validated against the pre-tax
  // subtotal and applied as a fixed discount before tax and retainer maths.
  const subtotalCents = items.reduce((s, it) => s + it.unitCents, 0);
  const couponCodeIn = typeof body.couponCode === "string" ? body.couponCode : "";
  const couponOut = couponCodeIn
    ? await resolveBookingCoupon(user.id, couponCodeIn, sessionType.id, subtotalCents)
    : { coupon: null, discountCents: 0, error: "" };
  if (couponCodeIn && !couponOut.coupon) {
    return NextResponse.json({ error: couponOut.error || "Unknown coupon code" }, { status: 400 });
  }
  const totals = calcTotals(items, sessionType.taxRate, couponOut.discountCents > 0 ? "FIXED" : "NONE", couponOut.discountCents);
  // Phase 5B platform: retainers at booking and manual approval are Studio
  // Manager Pro features, enforced against the account's (simulated) plan.
  const studioLimits = STUDIO_LIMITS[(await planFor(user.id)).studio];
  const retainer = studioLimits.retainers
    ? retainerAmount(sessionType.retainerType, sessionType.retainerValue, totals.total)
    : 0;
  const needsApproval = !waitlisted && sessionType.requiresApproval && studioLimits.manualApproval;

  const contact = await upsertContact(user.id, { name, email, phone });

  const booking = await db.booking.create({
    data: {
      userId: user.id,
      sessionTypeId: sessionType.id,
      slotId,
      contactId: contact.id,
      title: sessionType.name,
      startsAt,
      endsAt,
      status: waitlisted ? "WAITLIST" : needsApproval ? "PENDING" : "CONFIRMED",
      approvalState: needsApproval ? "REQUESTED" : "",
      totalCents: totals.total,
      couponCode: couponOut.coupon?.code ?? "",
      discountCents: couponOut.discountCents,
      retainerCents: retainer,
      paymentStatus: "UNPAID",
      addOns: JSON.stringify(chosenAddOns.map((a) => ({ name: a.name, priceCents: a.priceCents }))),
      notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : "",
      source: sessionType.isMini ? "MINI" : "BOOKING_SITE",
      clientToken: randomUUID(),
      meetingLink:
        sessionType.locationType === "VIDEO"
          ? sessionType.meetingLink || generateMeetingLink(`${sessionType.name}-${name}`)
          : sessionType.locationType === "ZOOM"
            ? sessionType.location
            : "",
      callPhone: sessionType.locationType === "PHONE" ? phone : "",
    },
  });


  if (couponOut.coupon) {
    await db.bookingCoupon.update({
      where: { id: couponOut.coupon.id },
      data: { useCount: { increment: 1 } },
    });
  }
  // Night build follow-up: mirror the booking to Google Calendar when the
  // photographer has two way sync connected (best effort, never blocks).
  await syncBookingToGoogle(booking.id);

  // ---- Questionnaire response (answers keyed by field id).
  if (sessionType.questionnaire && body.answers && typeof body.answers === "object") {
    const fields = JSON.parse(sessionType.questionnaire.fields || "[]") as { id: string }[];
    const answers: Record<string, string> = {};
    for (const f of fields) {
      const v = (body.answers as Record<string, unknown>)[f.id];
      if (typeof v === "string" && v.trim()) answers[f.id] = v.slice(0, 2000);
    }
    await db.questionnaireResponse.create({
      data: {
        questionnaireId: sessionType.questionnaire.id,
        bookingId: booking.id,
        contactId: contact.id,
        respondentName: name,
        respondentEmail: email,
        answers: JSON.stringify(answers),
      },
    });
  }

  // ---- Contract (rendered from the template, immediately open for signing).
  let contractToken: string | null = null;
  let contractBody = "";
  let contractTitle = "";
  if (sessionType.contractTemplate && !waitlisted) {
    const rendered = renderSmartFields(sessionType.contractTemplate.body, {
      client_name: name,
      client_email: email,
      client_phone: phone,
      session_type: sessionType.name,
      session_date: formatDate(startsAt),
      session_location: whereLabel(sessionType, booking),
      session_price: fmtMoney(totals.total),
      retainer: fmtMoney(retainer),
      business_name: user.businessName || user.name,
      photographer_name: user.name,
      today: formatDate(new Date()),
    });
    const contract = await db.contract.create({
      data: {
        userId: user.id,
        templateId: sessionType.contractTemplate.id,
        contactId: contact.id,
        bookingId: booking.id,
        title: `${sessionType.contractTemplate.name}, ${name}`,
        body: rendered,
        status: "SENT",
        brandLogoUrl: sessionType.contractTemplate.brandLogoUrl,
        brandColor: sessionType.contractTemplate.brandColor,
        headerImageUrl: sessionType.contractTemplate.headerImageUrl,
        sentAt: new Date(),
      },
    });
    contractToken = contract.token;
    contractBody = rendered;
    contractTitle = contract.title;
  }

  // ---- Feed the projects board (waitlist entries stay off the board until promoted).
  if (!waitlisted && !needsApproval) {
    const max = await db.project.aggregate({ where: { userId: user.id, stage: "BOOKED" }, _max: { order: true } });
    await db.project.create({
      data: {
        userId: user.id,
        name: `${name}, ${sessionType.name}`,
        contactId: contact.id,
        bookingId: booking.id,
        stage: "BOOKED",
        order: (max._max.order ?? 0) + 1,
      },
    });
  }

  // ---- Inbox + logged confirmation email.
  await logStudioMessage(user.id, {
    kind: waitlisted ? "WAITLIST" : "BOOKING",
    name,
    email,
    subject: waitlisted
      ? `Waitlist: ${sessionType.name}, ${name}`
      : needsApproval
        ? `Booking request (needs your approval): ${sessionType.name}, ${name}`
        : `New booking: ${sessionType.name}, ${name}`,
    body: waitlisted
      ? `${name} joined the waitlist for ${sessionType.name} on ${formatDate(startsAt)}.`
      : `${name} booked ${sessionType.name} on ${formatDate(startsAt)} (${fmtMoney(totals.total)} total${retainer ? `, ${fmtMoney(retainer)} retainer due` : ""}).`,
    meta: phone ? `Phone ${phone}` : "",
  });
  await sendBookingConfirmation(booking.id);
  await upsertContactState(contact.id, waitlisted || needsApproval);
  await notify(
    user.id,
    "BOOKING",
    waitlisted ? `Waitlist: ${name}` : needsApproval ? `Booking request to approve: ${name}` : `New booking: ${name}`,
    `${sessionType.name} on ${formatDate(startsAt)}`,
    "/studio/calendar"
  );

  return NextResponse.json({
    bookingId: booking.id,
    waitlisted,
    awaitingApproval: needsApproval,
    // With manual approval the contract and retainer wait until the photographer approves.
    contractToken: needsApproval ? null : contractToken,
    contractBody: needsApproval ? "" : contractBody,
    contractTitle: needsApproval ? "" : contractTitle,
    totalCents: totals.total,
    discountCents: couponOut.discountCents,
    couponCode: couponOut.coupon?.code ?? "",
    retainerCents: needsApproval ? 0 : retainer,
    meetingLink: booking.meetingLink,
    where: whereLabel(sessionType, booking),
    manageToken: booking.clientToken,
  });
}

// First confirmed booking moves a contact from lead to client.
async function upsertContactState(contactId: string, waitlisted: boolean) {
  if (waitlisted) return;
  await db.contact.update({ where: { id: contactId }, data: { state: "CLIENT" } }).catch(() => null);
}

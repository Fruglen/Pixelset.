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
import { deliveryNote, sendMail } from "@/lib/mailer";

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

  // ---- Resolve the time: a mini slot, or a date + time for regular sessions.
  let startsAt: Date;
  let endsAt: Date;
  let slotId: string | null = null;
  let waitlisted = false;

  if (sessionType.isMini) {
    const slot = await db.miniSlot.findFirst({
      where: { id: String(body.slotId ?? ""), date: { sessionTypeId: sessionType.id } },
      include: { bookings: { where: { status: { in: ["CONFIRMED", "PENDING"] } } } },
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
    endsAt = new Date(startsAt.getTime() + sessionType.durationMin * 60_000);
  }

  // ---- Add-ons (ids validated against the session type's own list).
  const addOnIds: string[] = Array.isArray(body.addOnIds) ? body.addOnIds.map(String) : [];
  const chosenAddOns = sessionType.addOns.filter((a) => addOnIds.includes(a.id));

  // ---- Totals + retainer.
  const items = [{ description: sessionType.name, qty: 1, unitCents: sessionType.priceCents }];
  for (const a of chosenAddOns) items.push({ description: a.name, qty: 1, unitCents: a.priceCents });
  const totals = calcTotals(items, sessionType.taxRate, "NONE", 0);
  const retainer = retainerAmount(sessionType.retainerType, sessionType.retainerValue, totals.total);

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
      status: waitlisted ? "WAITLIST" : "CONFIRMED",
      totalCents: totals.total,
      retainerCents: retainer,
      paymentStatus: "UNPAID",
      addOns: JSON.stringify(chosenAddOns.map((a) => ({ name: a.name, priceCents: a.priceCents }))),
      notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : "",
      source: sessionType.isMini ? "MINI" : "BOOKING_SITE",
    },
  });

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
      session_location: sessionType.locationType === "ZOOM" ? "Zoom (link to follow)" : sessionType.location,
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
        sentAt: new Date(),
      },
    });
    contractToken = contract.token;
    contractBody = rendered;
    contractTitle = contract.title;
  }

  // ---- Feed the projects board (waitlist entries stay off the board until promoted).
  if (!waitlisted) {
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
      : `New booking: ${sessionType.name}, ${name}`,
    body: waitlisted
      ? `${name} joined the waitlist for ${sessionType.name} on ${formatDate(startsAt)}.`
      : `${name} booked ${sessionType.name} on ${formatDate(startsAt)} (${fmtMoney(totals.total)} total${retainer ? `, ${fmtMoney(retainer)} retainer due` : ""}).`,
    meta: phone ? `Phone ${phone}` : "",
  });
  const businessName = user.businessName || user.name;
  const confirmationMail = await sendMail({
    userId: user.id,
    to: email,
    subject: waitlisted
      ? `You're on the waitlist: ${sessionType.name}`
      : `Booking confirmed: ${sessionType.name} on ${formatDate(startsAt)}`,
    text: waitlisted
      ? `Hi ${name},

You're on the waitlist for ${sessionType.name} on ${formatDate(startsAt)}. We'll contact you as soon as a spot opens up.

${businessName}`
      : `Hi ${name},

Your booking is confirmed.

Session: ${sessionType.name}
Date: ${formatDate(startsAt)}
${sessionType.location ? `Location: ${sessionType.location}\n` : ""}Total: ${fmtMoney(totals.total)}${retainer ? `\nRetainer due now: ${fmtMoney(retainer)}` : ""}

We're looking forward to seeing you.

${businessName}`,
  });
  await logStudioMessage(user.id, {
    kind: "EMAIL",
    name,
    email,
    subject: waitlisted ? `Waitlist confirmation emailed to ${email}` : `Booking confirmation emailed to ${email}`,
    body: waitlisted
      ? `We emailed ${name} that they're on the waitlist for ${sessionType.name} and will be contacted if a spot opens.`
      : `We emailed ${name} their booking confirmation for ${sessionType.name} on ${formatDate(startsAt)}.`,
    meta: deliveryNote(confirmationMail),
  });

  return NextResponse.json({
    bookingId: booking.id,
    waitlisted,
    contractToken,
    contractBody,
    contractTitle,
    totalCents: totals.total,
    retainerCents: retainer,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logStudioMessage } from "@/lib/studio";
import { sendBookingConfirmation, sessionDateLabel } from "@/lib/studio-flow";
import { computeSlots, isSlotOpen } from "@/lib/availability";
import { syncBookingToGoogle } from "@/lib/google-calendar";
import { notify } from "@/lib/notify";

// Phase 5B: the client side of an Awaiting Client booking. The client answers
// the questionnaire, signs the contract (via /api/sign), has the retainer
// recorded by the photographer (online payment is parked), then confirms,
// which flips the booking to Confirmed and sends the confirmation email.

async function load(token: string) {
  return db.booking.findUnique({
    where: { clientToken: token },
    include: { contact: true, sessionType: { include: { questionnaire: true } }, contract: true, response: true },
  });
}

function remainingSteps(b: NonNullable<Awaited<ReturnType<typeof load>>>): string[] {
  const steps: string[] = [];
  if (b.sessionType?.questionnaire && !b.response) steps.push("questionnaire");
  if (b.contract && b.contract.status !== "SIGNED") steps.push("contract");
  if (b.retainerCents > 0 && b.paymentStatus === "UNPAID") steps.push("payment");
  return steps;
}

// Night build: reschedule options for the client. Regular session types get
// live open times from the availability engine (this booking excluded); mini
// sessions get the other open slots on their dates.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const b = await load(params.token);
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!b.sessionType) return NextResponse.json({ error: "This booking cannot be rescheduled online" }, { status: 400 });
  if (b.sessionType.isMini) {
    const slots = await db.miniSlot.findMany({
      where: { date: { sessionTypeId: b.sessionType.id }, startsAt: { gt: new Date() } },
      include: { bookings: { where: { status: { in: ["CONFIRMED", "PENDING", "AWAITING_CLIENT"] } } } },
      orderBy: { startsAt: "asc" },
      take: 60,
    });
    return NextResponse.json({
      mini: true,
      slots: slots
        .filter((s) => s.id !== b.slotId && s.bookings.length < s.capacity)
        .map((s) => ({ id: s.id, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), label: sessionDateLabel(s.startsAt) })),
    });
  }
  const days = await computeSlots(b.sessionType, { days: 21, excludeBookingId: b.id });
  return NextResponse.json({ mini: false, days });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const b = await load(params.token);
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const body = await req.json();

  // Night build: reschedule + request-another-time work on live bookings too,
  // not only Awaiting Client ones.
  if (body.action === "reschedule" || body.action === "request-slot") {
    if (["CANCELLED", "COMPLETED", "WAITLIST"].includes(b.status)) {
      return NextResponse.json({ error: "This booking can no longer be changed." }, { status: 400 });
    }
    if (!b.sessionType) return NextResponse.json({ error: "This booking cannot be changed online" }, { status: 400 });
    const who = b.contact?.name ?? "The client";

    if (body.action === "request-slot") {
      const when = typeof body.when === "string" ? body.when.slice(0, 120) : "";
      if (!when) return NextResponse.json({ error: "Tell us the time you would prefer" }, { status: 400 });
      const note = typeof body.note === "string" ? body.note.slice(0, 1000) : "";
      await logStudioMessage(b.userId, {
        kind: "BOOKING",
        name: b.contact?.name ?? "",
        email: b.contact?.email ?? "",
        subject: `Alternative time requested: ${b.title}`,
        body: `${who} asked for a different time for ${b.title} (currently ${sessionDateLabel(b.startsAt)}).\n\nRequested: ${when}${note ? `\n\nNote: ${note}` : ""}\n\nReply to agree the new time, then move the booking on the calendar.`,
      });
      await notify(b.userId, "BOOKING", `${who} requested another time`, `${b.title}: ${when}`, "/studio/calendar");
      return NextResponse.json({ ok: true, requested: true });
    }

    // reschedule: move the booking itself.
    let startsAt: Date;
    let endsAt: Date;
    let slotId: string | null = b.slotId;
    if (b.sessionType.isMini) {
      const slot = await db.miniSlot.findFirst({
        where: { id: String(body.slotId ?? ""), date: { sessionTypeId: b.sessionType.id } },
        include: { bookings: { where: { status: { in: ["CONFIRMED", "PENDING", "AWAITING_CLIENT"] } } } },
      });
      if (!slot) return NextResponse.json({ error: "Pick a new time slot" }, { status: 400 });
      if (slot.bookings.filter((x) => x.id !== b.id).length >= slot.capacity) {
        return NextResponse.json({ error: "That slot just filled up, pick another time." }, { status: 409 });
      }
      startsAt = slot.startsAt;
      endsAt = slot.endsAt;
      slotId = slot.id;
    } else {
      const date = typeof body.date === "string" ? body.date : "";
      const time = typeof body.time === "string" ? body.time : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
        return NextResponse.json({ error: "Pick a new date and time" }, { status: 400 });
      }
      startsAt = new Date(`${date}T${time}:00`);
      if (isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now()) {
        return NextResponse.json({ error: "Pick a date in the future" }, { status: 400 });
      }
      if (!(await isSlotOpen(b.sessionType, startsAt, b.id))) {
        return NextResponse.json({ error: "That time is no longer available, pick another slot." }, { status: 409 });
      }
      endsAt = new Date(startsAt.getTime() + b.sessionType.durationMin * 60_000);
      slotId = null;
    }
    const before = sessionDateLabel(b.startsAt);
    await db.booking.update({ where: { id: b.id }, data: { startsAt, endsAt, slotId, reminderSentAt: null } });
    await syncBookingToGoogle(b.id);
    await logStudioMessage(b.userId, {
      kind: "BOOKING",
      name: b.contact?.name ?? "",
      email: b.contact?.email ?? "",
      subject: `Booking rescheduled: ${b.title}`,
      body: `${who} moved ${b.title} from ${before} to ${sessionDateLabel(startsAt)}.`,
    });
    await notify(b.userId, "BOOKING", `${who} rescheduled`, `${b.title} now ${sessionDateLabel(startsAt)}`, "/studio/calendar");
    if (b.status === "CONFIRMED") await sendBookingConfirmation(b.id);
    return NextResponse.json({ ok: true, startsAt: startsAt.toISOString() });
  }

  if (b.status !== "AWAITING_CLIENT") return NextResponse.json({ error: "This booking does not need anything from you." }, { status: 400 });

  if (body.action === "answers") {
    const q = b.sessionType?.questionnaire;
    if (!q) return NextResponse.json({ error: "No questionnaire for this booking" }, { status: 400 });
    if (b.response) return NextResponse.json({ ok: true });
    const fields = JSON.parse(q.fields || "[]") as { id: string; label: string; required: boolean }[];
    const answers: Record<string, string> = {};
    for (const f of fields) {
      const v = body.answers?.[f.id];
      if (typeof v === "string" && v.trim()) answers[f.id] = v.slice(0, 2000);
      else if (f.required) return NextResponse.json({ error: `Please answer: ${f.label}` }, { status: 400 });
    }
    await db.questionnaireResponse.create({
      data: {
        questionnaireId: q.id,
        bookingId: b.id,
        contactId: b.contactId,
        respondentName: b.contact?.name ?? "",
        respondentEmail: b.contact?.email ?? "",
        answers: JSON.stringify(answers),
      },
    });
    await notify(b.userId, "QUESTIONNAIRE_COMPLETED", `${b.contact?.name ?? "A client"} completed ${q.name}`, b.title, `/studio/questionnaires/${q.id}`);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "pay") {
    if (b.retainerCents <= 0 || b.paymentStatus !== "UNPAID") return NextResponse.json({ ok: true, paymentStatus: b.paymentStatus });
    // Online payment is parked (GLE-120): the retainer stays UNPAID until the
    // photographer records it, which then unlocks the "complete" step.
    return NextResponse.json(
      {
        error: "Online payment is not enabled yet. You have not been charged, and your photographer will arrange payment with you.",
        paymentStatus: b.paymentStatus,
        onlinePaymentEnabled: false,
      },
      { status: 409 }
    );
  }

  if (body.action === "complete") {
    const left = remainingSteps(b);
    if (left.length) return NextResponse.json({ error: `Please finish: ${left.join(", ")}` }, { status: 400 });
    await db.booking.update({ where: { id: b.id }, data: { status: "CONFIRMED" } });
    if (b.contactId) await db.contact.update({ where: { id: b.contactId }, data: { state: "CLIENT" } });
    await sendBookingConfirmation(b.id);
    await notify(b.userId, "BOOKING", `${b.contact?.name ?? "A client"} confirmed their booking`, b.title, "/studio/calendar");
    await logStudioMessage(b.userId, {
      kind: "BOOKING",
      name: b.contact?.name ?? "",
      email: b.contact?.email ?? "",
      subject: `Booking confirmed by client: ${b.title}`,
      body: `${b.contact?.name ?? "The client"} completed every step, the booking is now Confirmed.`,
    });
    return NextResponse.json({ ok: true, status: "CONFIRMED" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

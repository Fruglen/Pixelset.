import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { calcTotals, retainerAmount, upsertContact } from "@/lib/studio";

// Manual booking from the dashboard.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

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
    });
    contactId = c.id;
  }

  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ error: "Pick a date and time" }, { status: 400 });
  }
  const startsAt = new Date(`${date}T${time}:00`);
  if (isNaN(startsAt.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  let sessionType = null;
  if (typeof body.sessionTypeId === "string" && body.sessionTypeId) {
    sessionType = await db.sessionType.findFirst({ where: { id: body.sessionTypeId, userId: user.id } });
  }
  const durationMin = Math.max(5, Math.round(Number(body.durationMin) || sessionType?.durationMin || 60));
  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);

  const title =
    (typeof body.title === "string" && body.title.trim()) || sessionType?.name || "Session";
  const priceCents = sessionType ? sessionType.priceCents : Math.max(0, Math.round(Number(body.priceCents) || 0));
  const totals = calcTotals(
    [{ description: title, qty: 1, unitCents: priceCents }],
    sessionType?.taxRate ?? 0,
    "NONE",
    0
  );
  const retainer = sessionType
    ? retainerAmount(sessionType.retainerType, sessionType.retainerValue, totals.total)
    : 0;

  const booking = await db.booking.create({
    data: {
      userId: user.id,
      sessionTypeId: sessionType?.id ?? null,
      contactId,
      title,
      startsAt,
      endsAt,
      status: "CONFIRMED",
      totalCents: totals.total,
      retainerCents: retainer,
      paymentStatus: "UNPAID",
      notes: typeof body.notes === "string" ? body.notes : "",
      source: "MANUAL",
    },
  });

  // Feed the projects board.
  const contact = contactId ? await db.contact.findUnique({ where: { id: contactId } }) : null;
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

  return NextResponse.json({ id: booking.id });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateSlots } from "@/lib/studio";

async function own(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.miniSessionDate.findFirst({
    where: { id, sessionType: { userId: user.id } },
    include: { slots: { include: { bookings: { where: { status: { not: "CANCELLED" } } } } } },
  });
}

// Update a date's settings and regenerate its slots (blocked once bookings exist).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const date = await own(params.id);
  if (!date) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const booked = date.slots.reduce((n, s) => n + s.bookings.length, 0);
  if (booked > 0) {
    return NextResponse.json(
      { error: "This date already has bookings, cancel them before regenerating its slots." },
      { status: 400 }
    );
  }
  const body = await req.json();
  const spec = {
    date: /^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") ? body.date : date.date,
    startTime: /^\d{2}:\d{2}$/.test(body.startTime ?? "") ? body.startTime : date.startTime,
    slotLengthMin: Math.max(5, Math.round(Number(body.slotLengthMin) || date.slotLengthMin)),
    slotCount: Math.min(48, Math.max(1, Math.round(Number(body.slotCount) || date.slotCount))),
    spotsPerSlot: Math.min(50, Math.max(1, Math.round(Number(body.spotsPerSlot) || date.spotsPerSlot))),
    breakEvery: Math.max(0, body.breakEvery !== undefined ? Math.round(Number(body.breakEvery) || 0) : date.breakEvery),
    breakMin: Math.max(0, body.breakMin !== undefined ? Math.round(Number(body.breakMin) || 0) : date.breakMin),
  };
  const slots = generateSlots(spec);
  if (!slots.length) return NextResponse.json({ error: "Could not generate slots" }, { status: 400 });

  await db.miniSlot.deleteMany({ where: { dateId: date.id } });
  await db.miniSessionDate.update({ where: { id: date.id }, data: spec });
  for (const s of slots) {
    await db.miniSlot.create({ data: { dateId: date.id, ...s } });
  }
  return NextResponse.json({ ok: true, slotCount: slots.length });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const date = await own(params.id);
  if (!date) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const booked = date.slots.reduce((n, s) => n + s.bookings.length, 0);
  if (booked > 0) {
    return NextResponse.json({ error: "This date has bookings, cancel them first." }, { status: 400 });
  }
  await db.miniSessionDate.delete({ where: { id: date.id } });
  return NextResponse.json({ ok: true });
}

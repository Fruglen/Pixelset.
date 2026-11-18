import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "WAITLIST", "COMPLETED"];
const PAY_STATUSES = ["UNPAID", "RETAINER_PAID", "PAID"];

async function own(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  return db.booking.findFirst({ where: { id, userId: user.id } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const booking = await own(params.id);
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (STATUSES.includes(body.status)) data.status = body.status;
  if (PAY_STATUSES.includes(body.paymentStatus)) data.paymentStatus = body.paymentStatus;
  if (typeof body.notes === "string") data.notes = body.notes;

  // Promote a waitlist entry onto its slot only when a spot is actually free.
  if (booking.status === "WAITLIST" && data.status === "CONFIRMED" && booking.slotId) {
    const slot = await db.miniSlot.findUnique({
      where: { id: booking.slotId },
      include: { bookings: { where: { status: { in: ["CONFIRMED", "PENDING"] } } } },
    });
    if (slot && slot.bookings.length >= slot.capacity) {
      return NextResponse.json({ error: "That slot is still full, cancel a booking first." }, { status: 400 });
    }
  }

  await db.booking.update({ where: { id: booking.id }, data });

  // Keep the kanban roughly in sync: confirming a waitlist/pending booking files it under Booked.
  if (data.status === "CONFIRMED") {
    const project = await db.project.findUnique({ where: { bookingId: booking.id } });
    if (!project) {
      const contact = booking.contactId ? await db.contact.findUnique({ where: { id: booking.contactId } }) : null;
      const max = await db.project.aggregate({ where: { userId: booking.userId, stage: "BOOKED" }, _max: { order: true } });
      await db.project.create({
        data: {
          userId: booking.userId,
          name: contact ? `${contact.name}, ${booking.title}` : booking.title,
          contactId: booking.contactId,
          bookingId: booking.id,
          stage: "BOOKED",
          order: (max._max.order ?? 0) + 1,
        },
      });
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const booking = await own(params.id);
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.booking.delete({ where: { id: booking.id } });
  return NextResponse.json({ ok: true });
}

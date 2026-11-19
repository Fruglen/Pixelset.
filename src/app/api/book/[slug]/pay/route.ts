import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fmtMoney, logStudioMessage } from "@/lib/studio";
import { recordPayment } from "@/lib/studio-flow";
import { notify } from "@/lib/notify";

const METHODS = ["card", "paypal", "manual"];

// Mock retainer payment for the public booking flow (mocked per the owner's
// payments exclusion). Flips the booking's
// payment state and logs the (pretend) receipt, no real charge happens.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const profile = await db.studioProfile.findUnique({ where: { bookingSlug: params.slug } });
  if (!profile) return NextResponse.json({ error: "Booking site not found" }, { status: 404 });

  const body = await req.json();
  const booking = await db.booking.findFirst({
    where: { id: String(body.bookingId ?? ""), userId: profile.userId },
    include: { contact: true },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status === "WAITLIST") {
    return NextResponse.json({ error: "Waitlist spots don't require payment." }, { status: 400 });
  }
  if (booking.paymentStatus !== "UNPAID") {
    return NextResponse.json({ ok: true, paymentStatus: booking.paymentStatus });
  }
  const method = METHODS.includes(body.method) ? body.method : "card";
  if (booking.retainerCents <= 0) {
    return NextResponse.json({ ok: true, paymentStatus: "UNPAID" });
  }

  const paid = booking.retainerCents >= booking.totalCents ? "PAID" : "RETAINER_PAID";
  await db.booking.update({ where: { id: booking.id }, data: { paymentStatus: paid } });
  await logStudioMessage(profile.userId, {
    kind: "PAYMENT",
    name: booking.contact?.name ?? "",
    email: booking.contact?.email ?? "",
    subject: `${paid === "PAID" ? "Payment" : "Retainer"} received: ${fmtMoney(booking.retainerCents)}, ${booking.title}`,
    body: `${booking.contact?.name ?? "A client"} paid ${fmtMoney(booking.retainerCents)} by ${method} for ${booking.title}.`,
    meta: `Mock payment · ${method}`,
  });
  await recordPayment({
    userId: profile.userId,
    source: "BOOKING",
    sourceId: booking.id,
    label: booking.title,
    payerName: booking.contact?.name,
    payerEmail: booking.contact?.email,
    amountCents: booking.retainerCents,
    method,
  });
  await notify(profile.userId, "INVOICE_PAID", `${booking.contact?.name ?? "A client"} paid ${fmtMoney(booking.retainerCents)}`, booking.title, "/studio/reports");
  return NextResponse.json({ ok: true, paymentStatus: paid });
}

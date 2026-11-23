import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public booking payment. Online payment is parked (GLE-120), so this route
// never changes a booking's payment state: a retainer stays UNPAID until a
// verified payment path exists or the photographer records it themselves.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const profile = await db.studioProfile.findUnique({ where: { bookingSlug: params.slug } });
  if (!profile) return NextResponse.json({ error: "Booking site not found" }, { status: 404 });

  const body = await req.json();
  const booking = await db.booking.findFirst({
    where: { id: String(body.bookingId ?? ""), userId: profile.userId },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status === "WAITLIST") {
    return NextResponse.json({ error: "Waitlist spots don't require payment." }, { status: 400 });
  }
  if (booking.paymentStatus !== "UNPAID" || booking.retainerCents <= 0) {
    return NextResponse.json({ ok: true, paymentStatus: booking.paymentStatus });
  }
  return NextResponse.json(
    {
      error: "Online payment is not enabled yet. You have not been charged, and your photographer will arrange payment with you.",
      paymentStatus: booking.paymentStatus,
      onlinePaymentEnabled: false,
    },
    { status: 409 }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveBookingCoupon } from "@/lib/booking-coupons";

// Public coupon check for the booking flow: the client enters a code in the
// price summary and sees the discount before booking. The booking endpoint
// re-validates the same code when the booking is created.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const profile = await db.studioProfile.findUnique({ where: { bookingSlug: params.slug } });
  if (!profile) return NextResponse.json({ error: "Booking site not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const sessionType = await db.sessionType.findFirst({
    where: { id: String(body.sessionTypeId ?? ""), userId: profile.userId },
  });
  if (!sessionType) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const subtotal = Math.max(0, Math.round(Number(body.subtotalCents) || 0));
  const out = await resolveBookingCoupon(profile.userId, String(body.code ?? ""), sessionType.id, subtotal);
  if (!out.coupon) return NextResponse.json({ error: out.error || "Unknown coupon code" }, { status: 400 });
  return NextResponse.json({ code: out.coupon.code, discountCents: out.discountCents });
}

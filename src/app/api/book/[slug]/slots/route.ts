import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeSlots } from "@/lib/availability";

// Phase 5B: live bookable times for a regular session type, computed from the
// type's availability rules minus every existing booking and its buffers.
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const profile = await db.studioProfile.findUnique({ where: { bookingSlug: params.slug } });
  if (!profile) return NextResponse.json({ error: "Booking site not found" }, { status: 404 });
  const url = new URL(req.url);
  const type = await db.sessionType.findFirst({
    where: { id: url.searchParams.get("typeId") ?? "", userId: profile.userId, isMini: false, active: true },
  });
  if (!type) return NextResponse.json({ error: "Session type not found" }, { status: 404 });
  const days = await computeSlots(type, {
    from: url.searchParams.get("from") ?? undefined,
    days: Number(url.searchParams.get("days")) || 14,
    excludeBookingId: url.searchParams.get("exclude") ?? undefined,
  });
  return NextResponse.json({ days });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { computeSlots } from "@/lib/availability";

// Phase 5B: open times for the photographer's manual booking form (minimum
// notice is ignored for the photographer; hours, caps and conflicts still apply).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const type = await db.sessionType.findFirst({ where: { id: url.searchParams.get("typeId") ?? "", userId: user.id } });
  if (!type) return NextResponse.json({ error: "Session type not found" }, { status: 404 });
  if (type.isMini) {
    const dates = await db.miniSessionDate.findMany({
      where: { sessionTypeId: type.id },
      orderBy: { date: "asc" },
      include: { slots: { orderBy: { order: "asc" }, include: { bookings: { where: { status: { in: ["CONFIRMED", "PENDING", "AWAITING_CLIENT"] } } } } } },
    });
    return NextResponse.json({
      mini: true,
      dates: dates.map((d) => ({
        date: d.date,
        slots: d.slots
          .filter((s) => s.startsAt.getTime() > Date.now())
          .map((s) => ({ id: s.id, startsAt: s.startsAt.toISOString(), left: s.capacity - s.bookings.length })),
      })),
    });
  }
  const days = await computeSlots(type, {
    from: url.searchParams.get("from") ?? undefined,
    days: Number(url.searchParams.get("days")) || 14,
    ignoreNotice: true,
  });
  return NextResponse.json({ mini: false, days });
}

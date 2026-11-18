import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateSlots } from "@/lib/studio";

// Add a date to a mini session; slots are auto-generated from the settings.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const st = await db.sessionType.findFirst({ where: { id: params.id, userId: user.id } });
  if (!st) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const date = typeof body.date === "string" ? body.date : "";
  const startTime = typeof body.startTime === "string" ? body.startTime : "09:00";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Pick a date" }, { status: 400 });
  if (!/^\d{2}:\d{2}$/.test(startTime)) return NextResponse.json({ error: "Invalid start time" }, { status: 400 });

  const spec = {
    date,
    startTime,
    slotLengthMin: Math.max(5, Math.round(Number(body.slotLengthMin) || st.durationMin || 15)),
    slotCount: Math.min(48, Math.max(1, Math.round(Number(body.slotCount) || 8))),
    spotsPerSlot: Math.min(50, Math.max(1, Math.round(Number(body.spotsPerSlot) || 1))),
    breakEvery: Math.max(0, Math.round(Number(body.breakEvery) || 0)),
    breakMin: Math.max(0, Math.round(Number(body.breakMin) || 0)),
  };
  const slots = generateSlots(spec);
  if (!slots.length) return NextResponse.json({ error: "Could not generate slots" }, { status: 400 });

  const created = await db.miniSessionDate.create({ data: { sessionTypeId: st.id, ...spec } });
  for (const s of slots) {
    await db.miniSlot.create({ data: { dateId: created.id, ...s } });
  }
  return NextResponse.json({ id: created.id, slotCount: slots.length });
}

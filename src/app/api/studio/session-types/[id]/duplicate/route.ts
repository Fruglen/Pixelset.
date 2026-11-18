import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { generateSlots } from "@/lib/studio";

// Duplicate a session type (incl. add-ons; for minis also dates + freshly generated,
// unbooked slots). The copy starts unpublished so it can be adjusted before going live.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const src = await db.sessionType.findFirst({
    where: { id: params.id, userId: user.id },
    include: { addOns: true, dates: true },
  });
  if (!src) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const copy = await db.sessionType.create({
    data: {
      userId: user.id,
      name: `${src.name} (copy)`,
      description: src.description,
      coverUrl: src.coverUrl,
      durationMin: src.durationMin,
      bufferMin: src.bufferMin,
      priceCents: src.priceCents,
      taxRate: src.taxRate,
      locationType: src.locationType,
      location: src.location,
      cancellationPolicy: src.cancellationPolicy,
      retainerType: src.retainerType,
      retainerValue: src.retainerValue,
      contractTemplateId: src.contractTemplateId,
      questionnaireId: src.questionnaireId,
      active: true,
      isMini: src.isMini,
      published: false,
      showBookedSpots: src.showBookedSpots,
      waitlistEnabled: src.waitlistEnabled,
    },
  });
  for (const a of src.addOns) {
    await db.sessionAddOn.create({
      data: { sessionTypeId: copy.id, name: a.name, priceCents: a.priceCents, description: a.description, order: a.order },
    });
  }
  for (const d of src.dates) {
    const date = await db.miniSessionDate.create({
      data: {
        sessionTypeId: copy.id,
        date: d.date,
        startTime: d.startTime,
        slotLengthMin: d.slotLengthMin,
        slotCount: d.slotCount,
        spotsPerSlot: d.spotsPerSlot,
        breakEvery: d.breakEvery,
        breakMin: d.breakMin,
      },
    });
    const slots = generateSlots(d);
    for (const s of slots) {
      await db.miniSlot.create({ data: { dateId: date.id, ...s } });
    }
  }
  return NextResponse.json({ id: copy.id });
}

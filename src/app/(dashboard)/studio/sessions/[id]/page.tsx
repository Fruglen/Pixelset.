import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudioProfile } from "@/lib/studio";
import { SessionEditor } from "./session-editor";
import { STUDIO_LIMITS, planFor } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function SessionTypeEditPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const profile = await getStudioProfile(user.id);

  const t = await db.sessionType.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      addOns: { orderBy: { order: "asc" } },
      dates: {
        orderBy: { date: "asc" },
        include: {
          slots: {
            orderBy: { order: "asc" },
            include: {
              bookings: {
                where: { status: { in: ["CONFIRMED", "PENDING", "WAITLIST"] } },
                include: { contact: true },
              },
            },
          },
        },
      },
    },
  });
  if (!t) notFound();

  const [templates, questionnaires] = await Promise.all([
    db.contractTemplate.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    db.questionnaire.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
  ]);

  return (
    <SessionEditor
      bookingSlug={profile.bookingSlug}
      type={{
        id: t.id,
        name: t.name,
        description: t.description,
        coverUrl: t.coverUrl,
        durationMin: t.durationMin,
        bufferMin: t.bufferMin,
        bufferBeforeMin: t.bufferBeforeMin,
        availability: t.availability,
        remindersEnabled: t.remindersEnabled,
        reminderHoursBefore: t.reminderHoursBefore,
        meetingLink: t.meetingLink,
        priceCents: t.priceCents,
        taxRate: t.taxRate,
        locationType: t.locationType,
        location: t.location,
        cancellationPolicy: t.cancellationPolicy,
        retainerType: t.retainerType,
        retainerValue: t.retainerValue,
        requiresApproval: t.requiresApproval,
        contractTemplateId: t.contractTemplateId ?? "",
        questionnaireId: t.questionnaireId ?? "",
        active: t.active,
        isMini: t.isMini,
        published: t.published,
        showBookedSpots: t.showBookedSpots,
        waitlistEnabled: t.waitlistEnabled,
      }}
      addOns={t.addOns.map((a) => ({
        id: a.id,
        name: a.name,
        priceCents: a.priceCents,
        description: a.description,
      }))}
      dates={t.dates.map((d) => ({
        id: d.id,
        date: d.date,
        startTime: d.startTime,
        slotLengthMin: d.slotLengthMin,
        slotCount: d.slotCount,
        spotsPerSlot: d.spotsPerSlot,
        breakEvery: d.breakEvery,
        breakMin: d.breakMin,
        slots: d.slots.map((s) => ({
          id: s.id,
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
          capacity: s.capacity,
          booked: s.bookings.filter((b) => b.status !== "WAITLIST").length,
          waitlist: s.bookings.filter((b) => b.status === "WAITLIST").length,
          names: s.bookings.map((b) => b.contact?.name ?? "").filter(Boolean),
        })),
      }))}
      templates={templates.map((x) => ({ id: x.id, name: x.name }))}
      questionnaires={questionnaires.map((x) => ({ id: x.id, name: x.name }))}
      studioPro={STUDIO_LIMITS[(await planFor(user.id)).studio].manualApproval}
    />
  );
}
